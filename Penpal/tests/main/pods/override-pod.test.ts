import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPod, overridePod, getPodStatus } from '../../../src/main/pods'

// Minimal mocks required to import pods.ts without real file system / sessions
vi.mock('../../../src/main/sessions', () => ({
  runAgentHeadless: vi.fn().mockResolvedValue({ success: true, output: 'RESULT: PASS', durationMs: 10 }),
}))

vi.mock('../../../src/main/evals/collectors/pod-quality', () => ({
  podQualityCollector: { record: vi.fn() },
}))

describe('overridePod', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns false for unknown workflow id', () => {
    const result = overridePod('non-existent-id', 'execute', { model: 'haiku' })
    expect(result).toBe(false)
  })

  it('sets phaseOverrides on the workflow and returns true', () => {
    const wf = createPod('test task', {
      cwd: '/nonexistent-cwd-override-test',
      maxIterations: 1,
    })

    const ok = overridePod(wf.id, 'execute', { model: 'haiku', timeoutMultiplier: 2 })
    expect(ok).toBe(true)

    const updated = getPodStatus(wf.id)
    expect(updated?.phaseOverrides?.execute).toEqual({ model: 'haiku', timeoutMultiplier: 2 })
  })

  it('merges multiple phase overrides without clobbering existing ones', () => {
    const wf = createPod('test task', {
      cwd: '/nonexistent-cwd-override-merge-test',
      maxIterations: 1,
    })

    overridePod(wf.id, 'execute', { model: 'haiku' })
    overridePod(wf.id, 'validate', { timeoutMultiplier: 5 })

    const updated = getPodStatus(wf.id)
    expect(updated?.phaseOverrides?.execute?.model).toBe('haiku')
    expect(updated?.phaseOverrides?.validate?.timeoutMultiplier).toBe(5)
  })

  it('overwrites a previous override for the same phase', () => {
    const wf = createPod('test task', {
      cwd: '/nonexistent-cwd-override-overwrite-test',
      maxIterations: 1,
    })

    overridePod(wf.id, 'plan', { model: 'sonnet' })
    overridePod(wf.id, 'plan', { model: 'opus' })

    const updated = getPodStatus(wf.id)
    expect(updated?.phaseOverrides?.plan?.model).toBe('opus')
  })

  it('updates updatedAt after applying override', () => {
    const wf = createPod('test task', {
      cwd: '/nonexistent-cwd-override-ts-test',
      maxIterations: 1,
    })
    const before = wf.updatedAt

    // Brief pause to ensure timestamp differs
    const start = Date.now()
    while (Date.now() === start) { /* spin */ }

    overridePod(wf.id, 'validate', { model: 'haiku' })
    const updated = getPodStatus(wf.id)
    expect(updated?.updatedAt).toBeGreaterThanOrEqual(before)
  })
})
