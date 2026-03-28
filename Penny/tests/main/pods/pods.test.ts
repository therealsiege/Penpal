import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockPodWorkflow } from '../../helpers/factories'
import { PHASE_CONFIGS } from '../../../src/main/pods/phase-config'
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
    expect(pod.iteration).toBe(1)
    expect(pod.solver.agentId).toBeDefined()
    expect(pod.reviewer.agentId).toBeDefined()
    expect(pod.executor.agentId).toBeDefined()
  })

  it('critical priority snapshots phase config and solver candidate count', () => {
    // Invalid cwd: assert create-time policy without starting runWorkflow (no headless mocks required).
    const wf = createPod('task', {
      cwd: '/nonexistent-pod-test-cwd-xyz',
      maxIterations: 1,
      presetId: 'frontend-feature',
      priority: 'critical',
    })
    expect(wf.phaseConfig).toEqual(PHASE_CONFIGS.critical)
    expect(wf.solverCandidateCount).toBe(3)
    expect(wf.maxSelfFixes).toBe(2)
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
    const evt = podQualityRecordMock.mock.calls[0][0] as {
      status: string
      iterations: number
      firstPassAccepted: boolean
      executorPassed: boolean
    }
    expect(evt.status).toBe('complete')
    expect(evt.iterations).toBe(1)
    expect(evt.firstPassAccepted).toBe(true)
    expect(evt.executorPassed).toBe(true)
  })

  it('records pod-quality when cwd is invalid at create time', () => {
    const wf = createPod('bad cwd', {
      cwd: '/this/path/does/not/exist-12345',
      presetId: 'frontend-feature',
    })
    expect(wf.status).toBe('failed')
    expect(podQualityRecordMock).toHaveBeenCalledTimes(1)
    const evt = podQualityRecordMock.mock.calls[0][0] as { status: string; executorPassed: boolean }
    expect(evt.status).toBe('failed')
    expect(evt.executorPassed).toBe(false)
  })

  it('records pod-quality on solver failure before review (executor not pass)', async () => {
    runAgentHeadlessMock.mockResolvedValueOnce({ success: false, error: 'solver died', durationMs: 10 })

    const wf = createPod('fail early', {
      cwd: process.cwd(),
      maxIterations: 2,
      presetId: 'frontend-feature',
    })

    const terminal = await waitForTerminalStatus(wf.id)
    expect(terminal).toBe('failed')
    expect(podQualityRecordMock).toHaveBeenCalledTimes(1)
    const evt = podQualityRecordMock.mock.calls[0][0] as {
      status: string
      executorPassed: boolean
      firstPassAccepted: boolean
    }
    expect(evt.status).toBe('failed')
    expect(evt.executorPassed).toBe(false)
    expect(evt.firstPassAccepted).toBe(false)
  })

  it('records pod-quality once on reviewer reject', async () => {
    runAgentHeadlessMock
      .mockResolvedValueOnce({ success: true, output: 'solver output', durationMs: 10 })
      .mockResolvedValueOnce({
        success: true,
        output: '```json\n{"verdict":"reject","confidence":0.9,"issues":[{"severity":"critical","location":"x","description":"bad","suggestion":"fix"}],"strengths":[],"summary":"no"}\n```',
        durationMs: 10,
      })

    const wf = createPod('rejected', {
      cwd: process.cwd(),
      maxIterations: 2,
      presetId: 'backend-feature',
    })

    const terminal = await waitForTerminalStatus(wf.id)
    expect(terminal).toBe('failed')
    expect(podQualityRecordMock).toHaveBeenCalledTimes(1)
    const evt = podQualityRecordMock.mock.calls[0][0] as {
      status: string
      presetId: string
      firstPassAccepted: boolean
      executorPassed: boolean
    }
    expect(evt.status).toBe('failed')
    expect(evt.presetId).toBe('backend-feature')
    expect(evt.firstPassAccepted).toBe(false)
    expect(evt.executorPassed).toBe(false)
  })
})
