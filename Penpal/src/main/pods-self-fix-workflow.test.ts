import { describe, it, expect, vi, beforeEach } from 'vitest'

const runAgentHeadlessMock = vi.hoisted(() => vi.fn())

vi.mock('./sessions', () => ({
  runAgentHeadless: runAgentHeadlessMock,
}))

import { createPod, getPodStatus } from './pods'

function fencedCritique(obj: Record<string, unknown>): string {
  return `\`\`\`json\n${JSON.stringify(obj)}\n\`\`\``
}

async function waitForTerminal(id: string, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const w = getPodStatus(id)
    if (w && (w.status === 'complete' || w.status === 'failed')) return w
    await new Promise<void>(r => setTimeout(r, 15))
  }
  return getPodStatus(id)
}

describe('runWorkflow executor self-fix (mocked agents)', () => {
  beforeEach(() => {
    runAgentHeadlessMock.mockReset()
  })

  it('maxSelfFixes=0 skips self-fix and fails when execute returns FAIL (single iteration)', async () => {
    const critique = fencedCritique({
      verdict: 'approve',
      confidence: 0.9,
      issues: [],
      strengths: [],
      summary: 'OK',
    })
    let executorCalls = 0
    runAgentHeadlessMock.mockImplementation(async (agentId: string) => {
      if (agentId === 'fullstack-dev') return { success: true, output: 'solver', durationMs: 1 }
      if (agentId === 'backend-arch') return { success: true, output: critique, durationMs: 1 }
      if (agentId === 'electron-dev') {
        executorCalls += 1
        return { success: true, output: 'RESULT: FAIL\nbroken', durationMs: 1 }
      }
      return { success: false, output: '', error: 'unknown', durationMs: 0 }
    })

    const wf = createPod('task', {
      maxIterations: 1,
      maxSelfFixes: 0,
      cwd: process.cwd(),
    })
    const done = await waitForTerminal(wf.id)
    expect(done?.status).toBe('failed')
    expect(executorCalls).toBe(1)
    expect(done?.selfFixAttempts).toBe(0)
    expect(done?.artifacts.filter(a => a.stage === 'self-fix')).toHaveLength(0)
    const selfFixPrompts = runAgentHeadlessMock.mock.calls.filter(
      (c) => typeof c[2] === 'string' && (c[2] as string).includes('Your test run failed with these errors:'),
    )
    expect(selfFixPrompts).toHaveLength(0)
  })

  it('maxSelfFixes=2 runs two self-fix headless calls then completes without second solve', async () => {
    const critique = fencedCritique({
      verdict: 'approve',
      confidence: 0.9,
      issues: [],
      strengths: [],
      summary: 'OK',
    })
    runAgentHeadlessMock.mockImplementation(async (agentId: string, _cwd: string, prompt?: string) => {
      if (agentId === 'fullstack-dev') return { success: true, output: 'solver-once', durationMs: 1 }
      if (agentId === 'backend-arch') return { success: true, output: critique, durationMs: 1 }
      if (agentId === 'electron-dev') {
        if (prompt && prompt.includes('Your test run failed with these errors:')) {
          if (prompt.includes('attempt 1/2')) {
            return { success: true, output: 'RESULT: FAIL\nstill bad', durationMs: 1 }
          }
          if (prompt.includes('attempt 2/2')) {
            return { success: true, output: 'RESULT: PASS\n', durationMs: 1 }
          }
        }
        return { success: true, output: 'RESULT: FAIL\ninitial fail', durationMs: 1 }
      }
      return { success: false, output: '', error: 'unknown', durationMs: 0 }
    })

    const wf = createPod('task', {
      maxIterations: 3,
      maxSelfFixes: 2,
      cwd: process.cwd(),
    })
    const done = await waitForTerminal(wf.id)
    expect(done?.status).toBe('complete')
    expect(done?.iteration).toBe(1)
    expect(done?.selfFixAttempts).toBe(2)
    expect(done?.artifacts.filter(a => a.stage === 'self-fix')).toHaveLength(2)

    const solverCalls = runAgentHeadlessMock.mock.calls.filter(c => c[0] === 'fullstack-dev').length
    expect(solverCalls).toBe(1)

    const executorCalls = runAgentHeadlessMock.mock.calls.filter(c => c[0] === 'electron-dev').length
    expect(executorCalls).toBe(3)
  })

  it('successful self-fix leaves outer iteration at 1 (no solver retry)', async () => {
    const critique = fencedCritique({
      verdict: 'approve',
      confidence: 0.9,
      issues: [],
      strengths: [],
      summary: 'OK',
    })
    runAgentHeadlessMock.mockImplementation(async (agentId: string, _cwd: string, prompt?: string) => {
      if (agentId === 'fullstack-dev') return { success: true, output: 'solver', durationMs: 1 }
      if (agentId === 'backend-arch') return { success: true, output: critique, durationMs: 1 }
      if (agentId === 'electron-dev') {
        if (prompt?.includes('Your test run failed with these errors:')) {
          return { success: true, output: 'RESULT: PASS\n', durationMs: 1 }
        }
        return { success: true, output: 'RESULT: FAIL\n', durationMs: 1 }
      }
      return { success: false, output: '', error: 'unknown', durationMs: 0 }
    })

    const wf = createPod('task', {
      maxIterations: 2,
      maxSelfFixes: 1,
      cwd: process.cwd(),
    })
    const done = await waitForTerminal(wf.id)
    expect(done?.status).toBe('complete')
    expect(done?.iteration).toBe(1)
    expect(done?.selfFixAttempts).toBe(1)
    expect(runAgentHeadlessMock.mock.calls.filter(c => c[0] === 'fullstack-dev')).toHaveLength(1)
  })

  it('self-fix headless runner failure counts as an attempt and escalates without failing the pod', async () => {
    const critique = fencedCritique({
      verdict: 'approve',
      confidence: 0.9,
      issues: [],
      strengths: [],
      summary: 'OK',
    })
    runAgentHeadlessMock.mockImplementation(async (agentId: string, _cwd: string, prompt?: string) => {
      if (agentId === 'fullstack-dev') {
        if (prompt?.includes('Feedback from QA')) {
          return { success: true, output: 'solver-round-2', durationMs: 1 }
        }
        return { success: true, output: 'solver-round-1', durationMs: 1 }
      }
      if (agentId === 'backend-arch') return { success: true, output: critique, durationMs: 1 }
      if (agentId === 'electron-dev') {
        if (prompt?.includes('Your test run failed with these errors:')) {
          return { success: false, output: '', error: 'runner crashed', durationMs: 0 }
        }
        if (prompt?.includes('solver-round-2')) {
          return { success: true, output: 'RESULT: PASS\n', durationMs: 1 }
        }
        return { success: true, output: 'RESULT: FAIL\n', durationMs: 1 }
      }
      return { success: false, output: '', error: 'unknown', durationMs: 0 }
    })

    const wf = createPod('task', {
      maxIterations: 2,
      maxSelfFixes: 1,
      cwd: process.cwd(),
    })
    const done = await waitForTerminal(wf.id)
    expect(done?.status).toBe('complete')
    expect(done?.iteration).toBe(2)
    expect(done?.artifacts.filter(a => a.stage === 'self-fix')).toHaveLength(1)
    expect(runAgentHeadlessMock.mock.calls.some((c) => {
      const p = c[2] as string | undefined
      return c[0] === 'electron-dev' && typeof p === 'string' && p.includes('Your test run failed with these errors:')
    })).toBe(true)
  })
})
