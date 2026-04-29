import { describe, it, expect, vi, beforeEach } from 'vitest'

const runAgentHeadlessMock = vi.fn()

vi.mock('../../../src/main/sessions', () => ({
  runAgentHeadless: (...args: unknown[]) => runAgentHeadlessMock(...args),
}))

vi.mock('../../../src/main/evals/collectors/pod-quality', () => ({
  podQualityCollector: { record: vi.fn() },
}))

import { createPod, getPodStatus, pausePod, resumePod, cancelPod, overridePod } from '../../../src/main/pods'

function makePod() {
  return createPod('lifecycle test task', {
    cwd: process.cwd(),
    maxIterations: 1,
    presetId: 'frontend-feature',
  })
}

describe('pod lifecycle controls', () => {
  beforeEach(() => {
    runAgentHeadlessMock.mockReset()
    // Keep solver running forever so we can test pause/cancel during execution
    runAgentHeadlessMock.mockReturnValue(new Promise(() => {}))
  })

  describe('pausePod', () => {
    it('pauses a running pod', async () => {
      const wf = makePod()
      // Wait for it to enter solving
      await new Promise(r => setTimeout(r, 50))
      const result = pausePod(wf.id)
      expect(result).toBe(true)
      expect(getPodStatus(wf.id)?.status).toBe('paused')
    })

    it('returns false for already paused pod', async () => {
      const wf = makePod()
      await new Promise(r => setTimeout(r, 50))
      pausePod(wf.id)
      const historyBefore = getPodStatus(wf.id)!.stageHistory.length
      const result = pausePod(wf.id)
      expect(result).toBe(false)
      // No duplicate stageHistory entry
      expect(getPodStatus(wf.id)!.stageHistory.length).toBe(historyBefore)
    })

    it('returns false for completed pod', () => {
      const wf = createPod('done pod', {
        cwd: '/nonexistent-test-path-12345',
        presetId: 'frontend-feature',
      })
      // This pod fails immediately due to invalid cwd
      expect(wf.status).toBe('failed')
      expect(pausePod(wf.id)).toBe(false)
    })

    it('returns false for non-existent pod', () => {
      expect(pausePod('does-not-exist')).toBe(false)
    })
  })

  describe('resumePod', () => {
    it('returns false for non-paused pod', async () => {
      const wf = makePod()
      await new Promise(r => setTimeout(r, 50))
      expect(resumePod(wf.id)).toBe(false)
    })

    it('returns false for non-existent pod', () => {
      expect(resumePod('does-not-exist')).toBe(false)
    })
  })

  describe('cancelPod', () => {
    it('cancels a running pod', async () => {
      const wf = makePod()
      await new Promise(r => setTimeout(r, 50))
      const result = cancelPod(wf.id)
      expect(result).toBe(true)
      const status = getPodStatus(wf.id)
      expect(status?.status).toBe('failed')
      expect(status?.error).toBe('Cancelled by user')
    })

    it('returns false for non-existent pod', () => {
      expect(cancelPod('does-not-exist')).toBe(false)
    })
  })

  describe('overridePod', () => {
    it('sets phase override on active pod', async () => {
      const wf = makePod()
      await new Promise(r => setTimeout(r, 50))
      const result = overridePod(wf.id, 'execute', { model: 'haiku' })
      expect(result).toBe(true)
      expect(getPodStatus(wf.id)?.phaseOverrides?.execute?.model).toBe('haiku')
    })

    it('merges multiple overrides without clobbering', async () => {
      const wf = makePod()
      await new Promise(r => setTimeout(r, 50))
      overridePod(wf.id, 'execute', { model: 'haiku' })
      overridePod(wf.id, 'validate', { timeoutMultiplier: 5 })
      const overrides = getPodStatus(wf.id)?.phaseOverrides
      expect(overrides?.execute?.model).toBe('haiku')
      expect(overrides?.validate?.timeoutMultiplier).toBe(5)
    })

    it('rejects invalid phase', async () => {
      const wf = makePod()
      await new Promise(r => setTimeout(r, 50))
      const result = overridePod(wf.id, 'invalid-phase' as 'plan', { model: 'haiku' })
      expect(result).toBe(false)
    })

    it('returns false for non-existent pod', () => {
      expect(overridePod('does-not-exist', 'plan', { model: 'opus' })).toBe(false)
    })
  })
})
