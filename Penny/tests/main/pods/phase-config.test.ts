import { describe, expect, it } from 'vitest'
import { getPhaseConfig, PHASE_CONFIGS } from '../../../src/main/pods/phase-config'

describe('phase config mapping', () => {
  it('critical priority returns candidates=3', () => {
    expect(getPhaseConfig('critical')).toEqual(PHASE_CONFIGS.critical)
    expect(getPhaseConfig('critical').candidates).toBe(3)
  })

  it('low priority returns candidates=1 and maxSelfFixes=0', () => {
    expect(getPhaseConfig('low')).toEqual(PHASE_CONFIGS.low)
    expect(getPhaseConfig('low').candidates).toBe(1)
    expect(getPhaseConfig('low').maxSelfFixes).toBe(0)
  })

  it('unknown and missing priorities fall back to normal config', () => {
    expect(getPhaseConfig('urgent')).toEqual(PHASE_CONFIGS.normal)
    expect(getPhaseConfig(undefined)).toEqual(PHASE_CONFIGS.normal)
  })
})
