import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockPodWorkflow } from '../../helpers/factories'
import { createPod, getPodStatus } from '../../../src/main/pods'

const runAgentHeadlessMock = vi.fn()
const podQualityRecordMock = vi.fn()

vi.mock('../../../src/main/sessions', () => ({
  runAgentHeadless: (...args: unknown[]) => runAgentHeadlessMock(...args),
}))

vi.mock('../../../src/main/evals/collectors/pod-quality', () => ({
  podQualityCollector: {
    record: (...args: unknown[]) => podQualityRecordMock(...args),
  },
}))

async function waitForTerminalStatus(workflowId: string): Promise<'complete' | 'failed'> {
  for (let i = 0; i < 100; i++) {
    const wf = getPodStatus(workflowId)
    if (!wf) throw new Error('Workflow not found')
    if (wf.status === 'complete' || wf.status === 'failed') return wf.status
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error('Timed out waiting for terminal status')
}

describe('pods', () => {
  beforeEach(() => {
    runAgentHeadlessMock.mockReset()
    podQualityRecordMock.mockReset()
  })

  it('factory produces valid PodWorkflow shape', () => {
    const pod = createMockPodWorkflow()
    expect(pod.id).toBeDefined()
    expect(pod.status).toBe('pending')
    expect(pod.iteration).toBe(0)
    expect(pod.solver.agentId).toBeDefined()
    expect(pod.reviewer.agentId).toBeDefined()
    expect(pod.executor.agentId).toBeDefined()
  })

  it('records terminal pod-quality event on first-pass completion', async () => {
    runAgentHeadlessMock
      .mockResolvedValueOnce({ success: true, output: 'solver output', durationMs: 10 })
      .mockResolvedValueOnce({ success: true, output: 'review output', durationMs: 10 })
      .mockResolvedValueOnce({ success: true, output: 'RESULT: PASS', durationMs: 10 })

    const wf = createPod('pod quality pass', {
      cwd: process.cwd(),
      maxIterations: 1,
      presetId: 'frontend-feature',
    })

    const terminal = await waitForTerminalStatus(wf.id)
    expect(terminal).toBe('complete')
    expect(podQualityRecordMock).toHaveBeenCalledTimes(1)
  })
})
