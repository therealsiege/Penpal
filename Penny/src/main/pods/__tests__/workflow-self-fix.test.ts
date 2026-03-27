import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../sessions', () => ({
  runAgentHeadless: vi.fn(),
}))

import { runAgentHeadless } from '../../sessions'
import { createPod, getPodStatus } from '../../pods'

type MockResult = {
  success: boolean
  output?: string
  error?: string
  durationMs?: number
}

function queueRuns(results: MockResult[]): void {
  const mocked = vi.mocked(runAgentHeadless)
  mocked.mockReset()
  for (const result of results) {
    mocked.mockResolvedValueOnce({
      success: result.success,
      output: result.output ?? '',
      error: result.error,
      durationMs: result.durationMs ?? 500,
    })
  }
}

async function waitForDone(workflowId: string): Promise<void> {
  for (let i = 0; i < 200; i += 1) {
    const status = getPodStatus(workflowId)?.status
    if (status === 'complete' || status === 'failed') return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error(`Workflow ${workflowId} did not finish in time`)
}

describe('self-fix workflow loop', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('maxSelfFixes=0 escalates immediately with no self-fix stage', async () => {
    queueRuns([
      { success: true, output: 'solver #1' },
      { success: true, output: 'reviewer plan' },
      { success: true, output: 'RESULT: FAIL\nTest Case 1: FAIL' },
      { success: true, output: 'solver #2' },
      { success: true, output: 'RESULT: PASS\nTest Case 1: PASS' },
    ])

    const wf = createPod('task', { maxIterations: 2, maxSelfFixes: 0 })
    await waitForDone(wf.id)
    const final = getPodStatus(wf.id)!

    expect(final.status).toBe('complete')
    expect(final.selfFixAttempts).toBe(0)
    expect(final.stageHistory.some((h) => h.stage === 'self-fixing')).toBe(false)
  })

  it('maxSelfFixes=2 permits exactly two self-fix attempts', async () => {
    queueRuns([
      { success: true, output: 'solver #1' },
      { success: true, output: 'reviewer plan' },
      { success: true, output: 'RESULT: FAIL\ninitial failure' },
      { success: true, output: 'RESULT: FAIL\nself-fix 1 failed' },
      { success: true, output: 'RESULT: FAIL\nself-fix 2 failed' },
      { success: true, output: 'solver #2' },
      { success: true, output: 'RESULT: PASS\nretry iteration passed' },
    ])

    const wf = createPod('task', { maxIterations: 2, maxSelfFixes: 2 })
    await waitForDone(wf.id)
    const final = getPodStatus(wf.id)!

    expect(final.status).toBe('complete')
    expect(final.selfFixAttempts).toBe(2)
    expect(final.artifacts.filter((a) => a.stage === 'self-fix')).toHaveLength(2)
  })

  it('successful self-fix completes without solver retry', async () => {
    queueRuns([
      { success: true, output: 'solver #1' },
      { success: true, output: 'reviewer plan' },
      { success: true, output: 'RESULT: FAIL\ninitial failure' },
      { success: true, output: 'RESULT: PASS\nfixed and reran tests' },
    ])

    const wf = createPod('task', { maxIterations: 3, maxSelfFixes: 2 })
    await waitForDone(wf.id)
    const final = getPodStatus(wf.id)!

    expect(final.status).toBe('complete')
    expect(final.iteration).toBe(1)
    expect(final.selfFixAttempts).toBe(1)
    expect(final.artifacts.some((a) => a.stage === 'self-fix' && a.path.includes('pass'))).toBe(true)
  })
})
