import { describe, it, expect, beforeEach } from 'vitest'
import { AnimConfig, patchAnimConfig, resetAnimConfig } from '../../src/renderer/src/game/animation-config'

describe('Camera Juice — sidekick#79', () => {
  beforeEach(() => {
    resetAnimConfig()
  })

  // -------------------------------------------------------------------------
  // Tuned defaults per issue spec
  // -------------------------------------------------------------------------

  it('taskComplete pulse defaults to 2% delta and 200ms', () => {
    expect(AnimConfig.camera.pulse.taskComplete.delta).toBe(0.02)
    expect(AnimConfig.camera.pulse.taskComplete.durationMs).toBe(200)
  })

  it('rankUp pulse defaults to 5% delta', () => {
    expect(AnimConfig.camera.pulse.rankUp.delta).toBe(0.05)
  })

  it('errorZoomOut pulse defaults to -1% delta', () => {
    expect(AnimConfig.camera.pulse.errorZoomOut.delta).toBe(-0.01)
  })

  it('agentLeave pulse defaults to -1% delta', () => {
    expect(AnimConfig.camera.pulse.agentLeave.delta).toBe(-0.01)
  })

  it('epicQuestHoldMs defaults to 500', () => {
    expect(AnimConfig.camera.epicQuestHoldMs).toBe(500)
  })

  it('workstationRefitThreshold defaults to ±3', () => {
    expect(AnimConfig.camera.workstationRefitThreshold).toBe(3)
  })

  it('pan ease defaults to Power2.easeInOut', () => {
    expect(AnimConfig.camera.pan.ease).toBe('Power2.easeInOut')
  })

  // -------------------------------------------------------------------------
  // Deep merge — 3-level nesting (camera.pulse.taskComplete)
  // -------------------------------------------------------------------------

  it('patchAnimConfig deep-merges camera.pulse without clobbering sibling pulse kinds', () => {
    const origRankUp = { ...AnimConfig.camera.pulse.rankUp }
    const origEpicQuest = { ...AnimConfig.camera.pulse.epicQuest }

    patchAnimConfig({ camera: { pulse: { taskComplete: { delta: 0.05 } } } })

    expect(AnimConfig.camera.pulse.taskComplete.delta).toBe(0.05)
    // durationMs within taskComplete should be preserved
    expect(AnimConfig.camera.pulse.taskComplete.durationMs).toBe(200)
    // Sibling pulse kinds untouched
    expect(AnimConfig.camera.pulse.rankUp).toEqual(origRankUp)
    expect(AnimConfig.camera.pulse.epicQuest).toEqual(origEpicQuest)
  })

  it('patchAnimConfig deep-merges camera.pan without clobbering pulse', () => {
    const origPulse = JSON.parse(JSON.stringify(AnimConfig.camera.pulse))

    patchAnimConfig({ camera: { pan: { ease: 'Linear' } } })

    expect(AnimConfig.camera.pan.ease).toBe('Linear')
    // Pan sibling keys preserved
    expect(AnimConfig.camera.pan.minMs).toBe(400)
    expect(AnimConfig.camera.pan.maxMs).toBe(800)
    // Pulse section untouched
    expect(AnimConfig.camera.pulse).toEqual(origPulse)
  })

  it('patchAnimConfig preserves scalar camera siblings when patching nested', () => {
    patchAnimConfig({ camera: { epicQuestHoldMs: 999 } })

    expect(AnimConfig.camera.epicQuestHoldMs).toBe(999)
    // Nested objects untouched
    expect(AnimConfig.camera.pulse.taskComplete.delta).toBe(0.02)
    expect(AnimConfig.camera.pan.ease).toBe('Power2.easeInOut')
    expect(AnimConfig.camera.workstationRefitThreshold).toBe(3)
  })

  it('resetAnimConfig restores camera defaults after patch', () => {
    patchAnimConfig({
      camera: {
        pulse: { taskComplete: { delta: 0.99, durationMs: 1 } },
        pan: { ease: 'Cubic.easeIn' },
        epicQuestHoldMs: 9999,
      },
    })

    resetAnimConfig()

    expect(AnimConfig.camera.pulse.taskComplete.delta).toBe(0.02)
    expect(AnimConfig.camera.pulse.taskComplete.durationMs).toBe(200)
    expect(AnimConfig.camera.pan.ease).toBe('Power2.easeInOut')
    expect(AnimConfig.camera.epicQuestHoldMs).toBe(500)
  })
})
