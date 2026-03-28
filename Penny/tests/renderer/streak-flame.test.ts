import { describe, expect, it } from 'vitest'
import {
  getFlameEmissionProfile,
  getFlameTier,
  normalizeQualityStreak,
  shouldRenderStreakFlame,
} from '../../src/renderer/src/game/streak-flame'

describe('streak flame thresholds', () => {
  it('does not render flame for streak 4', () => {
    expect(getFlameTier(4)).toBe('none')
    expect(shouldRenderStreakFlame(4, 3)).toBe(false)
  })

  it('renders flame for streak 5', () => {
    expect(getFlameTier(5)).toBe('small')
    expect(shouldRenderStreakFlame(5, 3)).toBe(true)
  })

  it('requires LOD3 for flame rendering', () => {
    expect(shouldRenderStreakFlame(15, 1)).toBe(false)
    expect(shouldRenderStreakFlame(15, 2)).toBe(false)
    expect(shouldRenderStreakFlame(15, 3)).toBe(true)
  })
})

describe('streak flame intensity scaling', () => {
  it('increases intensity profile at streak 10 and 15', () => {
    const small = getFlameEmissionProfile(5)
    const medium = getFlameEmissionProfile(10)
    const large = getFlameEmissionProfile(15)

    expect(small.tier).toBe('small')
    expect(medium.tier).toBe('medium')
    expect(large.tier).toBe('large')

    expect(medium.perTick).toBeGreaterThan(small.perTick)
    expect(large.perTick).toBeGreaterThan(medium.perTick)
    expect(medium.delayMs).toBeLessThan(small.delayMs)
    expect(large.delayMs).toBeLessThan(medium.delayMs)
    expect(small.maxPerCycle).toBe(10)
    expect(medium.maxPerCycle).toBe(20)
    expect(large.maxPerCycle).toBe(30)
  })
})

describe('streak normalization', () => {
  it('clamps invalid streak values to zero', () => {
    expect(normalizeQualityStreak(undefined)).toBe(0)
    expect(normalizeQualityStreak(-7)).toBe(0)
    expect(normalizeQualityStreak(Number.NaN)).toBe(0)
    expect(normalizeQualityStreak(8.9)).toBe(8)
  })
})
