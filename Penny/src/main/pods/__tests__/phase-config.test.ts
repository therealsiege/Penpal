import { describe, it, expect } from 'vitest'
import { getPhaseConfig, PHASE_CONFIGS } from '../phase-config'

describe('getPhaseConfig', () => {
  it('critical priority returns candidates=3, selfEvaluation=true, maxSelfFixes=2', () => {
    const cfg = getPhaseConfig('critical')
    expect(cfg).toEqual({
      candidates: 3,
      selfEvaluation: true,
      confidenceThreshold: 0.8,
      maxSelfFixes: 2,
    })
  })

  it('high priority returns candidates=2', () => {
    const cfg = getPhaseConfig('high')
    expect(cfg.candidates).toBe(2)
    expect(cfg.selfEvaluation).toBe(true)
    expect(cfg.confidenceThreshold).toBe(0.7)
    expect(cfg.maxSelfFixes).toBe(1)
  })

  it('normal priority returns candidates=1, selfEvaluation=false', () => {
    const cfg = getPhaseConfig('normal')
    expect(cfg.candidates).toBe(1)
    expect(cfg.selfEvaluation).toBe(false)
  })

  it('low priority returns candidates=1, maxSelfFixes=0', () => {
    const cfg = getPhaseConfig('low')
    expect(cfg.candidates).toBe(1)
    expect(cfg.maxSelfFixes).toBe(0)
  })

  it('unknown priority falls back to normal config', () => {
    const cfg = getPhaseConfig('unknown')
    expect(cfg).toEqual(PHASE_CONFIGS.normal)
  })

  it('undefined priority falls back to normal config', () => {
    const cfg = getPhaseConfig(undefined as unknown as string)
    expect(cfg).toEqual(PHASE_CONFIGS.normal)
  })
})
