// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'

vi.mock('phaser', () => ({
  default: { GameObjects: {}, Math: { Linear: (a: number, b: number, t: number) => a + (b - a) * t } },
  GameObjects: {},
  Math: { Linear: (a: number, b: number, t: number) => a + (b - a) * t },
}))

import {
  normalizeContextUtilization,
  getContextMeterColor,
  isContextRotTransition,
} from '../../src/renderer/src/game/office-workstation'
import {
  CTX_GREEN,
  CTX_AMBER,
  CTX_RED,
} from '../../src/renderer/src/game/office-constants'

describe('context meter utils', () => {
  it('maps 50% utilization to green and half width input', () => {
    const utilization = normalizeContextUtilization(0.5)
    expect(utilization).toBe(0.5)
    expect(getContextMeterColor(utilization!)).toBe(CTX_GREEN)
  })

  it('maps 85% utilization to red', () => {
    const utilization = normalizeContextUtilization(0.85)
    expect(utilization).toBe(0.85)
    expect(getContextMeterColor(utilization!)).toBe(CTX_RED)
  })

  it('uses amber between 60% and 80%', () => {
    expect(getContextMeterColor(0.6)).toBe(CTX_AMBER)
    expect(getContextMeterColor(0.79)).toBe(CTX_AMBER)
  })

  it('clamps invalid utilization and treats missing as hidden', () => {
    expect(normalizeContextUtilization(-0.2)).toBe(0)
    expect(normalizeContextUtilization(1.4)).toBe(1)
    expect(normalizeContextUtilization(undefined)).toBeNull()
    expect(normalizeContextUtilization(Number.NaN)).toBeNull()
  })

  it('only shakes monitor on false to true rot transition', () => {
    expect(isContextRotTransition(false, true)).toBe(true)
    expect(isContextRotTransition(undefined, true)).toBe(true)
    expect(isContextRotTransition(true, true)).toBe(false)
    expect(isContextRotTransition(true, false)).toBe(false)
    expect(isContextRotTransition(false, false)).toBe(false)
  })
})
