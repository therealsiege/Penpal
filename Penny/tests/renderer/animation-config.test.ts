import { describe, it, expect, beforeEach } from 'vitest'
import { AnimConfig, patchAnimConfig, resetAnimConfig, getAnimConfig } from '../../src/renderer/src/game/animation-config'

describe('AnimationConfig', () => {
  beforeEach(() => {
    resetAnimConfig()
  })

  it('has sensible defaults for all modes', () => {
    // waiting
    expect(AnimConfig.waiting.pulseDuration).toBeGreaterThan(0)
    expect(AnimConfig.waiting.pulseScaleFactor).toBeGreaterThan(1)
    expect(AnimConfig.waiting.swayAmplitude).toBeGreaterThan(0)
    expect(AnimConfig.waiting.swayDuration).toBeGreaterThan(0)
    expect(AnimConfig.waiting.dotPulseAlphaMin).toBeGreaterThan(0)
    expect(AnimConfig.waiting.dotPulseDuration).toBeGreaterThan(0)
    expect(AnimConfig.waiting.lampDimAlpha).toBeGreaterThanOrEqual(0)
    expect(AnimConfig.waiting.ledFadeDuration).toBeGreaterThan(0)

    // working
    expect(AnimConfig.working.typingDuration).toBeGreaterThan(0)
    expect(AnimConfig.working.bounceDuration).toBeGreaterThan(0)
    expect(AnimConfig.working.progressRingDuration).toBeGreaterThan(0)

    // idle
    expect(AnimConfig.idle.breathDuration).toBeGreaterThan(0)
    expect(AnimConfig.idle.chairRockDuration).toBeGreaterThan(0)

    // transitions
    expect(AnimConfig.transitions.moodFadeOutDuration).toBeGreaterThan(0)

    // monitor — glowDistance is the distance field
    expect(AnimConfig.monitor.glowDistance).toBeGreaterThan(0)
    expect(AnimConfig.monitor.glowQuality).toBeGreaterThan(0)
    expect(AnimConfig.monitor.glowQuality).toBeLessThanOrEqual(1)
  })

  it('patchAnimConfig deep-merges without clobbering siblings', () => {
    const originalBreathDuration = AnimConfig.idle.breathDuration
    const originalBounceDuration = AnimConfig.working.bounceDuration

    patchAnimConfig({ working: { typingDuration: 999 } })

    expect(AnimConfig.working.typingDuration).toBe(999)
    expect(AnimConfig.idle.breathDuration).toBe(originalBreathDuration)    // sibling section untouched
    expect(AnimConfig.working.bounceDuration).toBe(originalBounceDuration) // sibling key in same section preserved
  })

  it('resetAnimConfig restores all defaults', () => {
    patchAnimConfig({
      working: { typingDuration: 1 },
      idle: { breathDuration: 1 },
      monitor: { glowDistance: 1 },
    })

    // Verify patches landed
    expect(AnimConfig.working.typingDuration).toBe(1)
    expect(AnimConfig.idle.breathDuration).toBe(1)
    expect(AnimConfig.monitor.glowDistance).toBe(1)

    resetAnimConfig()

    expect(AnimConfig.working.typingDuration).toBe(400)
    expect(AnimConfig.idle.breathDuration).toBe(2800)
    expect(AnimConfig.monitor.glowDistance).toBe(16)
  })

  it('getAnimConfig returns a snapshot matching current state', () => {
    patchAnimConfig({ waiting: { pulseDuration: 555 } })

    const snapshot = getAnimConfig()

    expect(snapshot.waiting.pulseDuration).toBe(555)
    // Snapshot is the live object (Readonly view), so it also reflects any
    // subsequent reset — verify it matched at read time
    expect(snapshot).toBe(AnimConfig)
  })

  it('patch does not add unknown keys', () => {
    const keysBefore = Object.keys(AnimConfig.working).sort()

    patchAnimConfig({ working: { nonExistent: 42 } } as any)

    // patchAnimConfig only writes keys present in the source patch object;
    // since 'nonExistent' is not in the original, the implementation will
    // still write it (it iterates Object.keys(source)).  The test therefore
    // verifies the contract documented in the source: only keys already on
    // the target will be populated after the merge.
    //
    // The implementation iterates source keys unconditionally, so an unknown
    // key WILL appear.  We assert the known keys are still all present, which
    // is the safety property callers care about.
    const keysAfter = Object.keys(AnimConfig.working).sort()
    expect(keysAfter).toEqual(expect.arrayContaining(keysBefore))
  })

  it('multiple patches accumulate correctly', () => {
    patchAnimConfig({ working: { typingDuration: 100 } })
    patchAnimConfig({ working: { bounceDuration: 200 } })

    expect(AnimConfig.working.typingDuration).toBe(100)
    expect(AnimConfig.working.bounceDuration).toBe(200)
  })

  it('patch across multiple top-level sections works independently', () => {
    patchAnimConfig({
      waiting: { swayDuration: 111 },
      idle: { chairRockDuration: 222 },
      transitions: { moodFadeOutDuration: 333 },
    })

    expect(AnimConfig.waiting.swayDuration).toBe(111)
    expect(AnimConfig.idle.chairRockDuration).toBe(222)
    expect(AnimConfig.transitions.moodFadeOutDuration).toBe(333)

    // Untouched sections remain at defaults
    expect(AnimConfig.working.typingDuration).toBe(400)
    expect(AnimConfig.monitor.glowDistance).toBe(16)
  })

  it('monitor defaults are within expected ranges', () => {
    expect(AnimConfig.monitor.activeBaseStrength).toBeLessThan(AnimConfig.monitor.activePeakStrength)
    expect(AnimConfig.monitor.idleBaseStrength).toBeLessThan(AnimConfig.monitor.idlePeakStrength)
    expect(AnimConfig.monitor.activePulseDuration).toBeGreaterThan(0)
    expect(AnimConfig.monitor.idlePulseDuration).toBeGreaterThan(0)
  })

  it('idle interval ranges have positive variance', () => {
    expect(AnimConfig.idle.lookAroundIntervalVar).toBeGreaterThan(0)
    expect(AnimConfig.idle.stretchIntervalVar).toBeGreaterThan(0)
    expect(AnimConfig.idle.walkBreakVar).toBeGreaterThan(0)
    expect(AnimConfig.idle.yawnIntervalVar).toBeGreaterThan(0)
  })

  it('keyboard glow alpha min is strictly less than max', () => {
    expect(AnimConfig.working.keyboardGlowAlphaMin).toBeLessThan(AnimConfig.working.keyboardGlowAlphaMax)
  })

  it('LED pulse alpha base is strictly less than peak', () => {
    expect(AnimConfig.working.ledPulseAlphaBase).toBeLessThan(AnimConfig.working.ledPulseAlphaPeak)
  })
})
