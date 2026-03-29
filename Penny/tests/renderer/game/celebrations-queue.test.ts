// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('phaser', () => ({
  default: {
    BlendModes: { ADD: 'ADD' },
  },
}))

import { CelebrationManager } from '../../../src/renderer/src/game/celebrations'
import { patchAnimConfig, resetAnimConfig } from '../../../src/renderer/src/game/animation-config'

class MockCircle {
  private data = new Map<string, unknown>()
  setDepth() { return this }
  setVisible() { return this }
  setBlendMode() { return this }
  setData(k: string, v: unknown) { this.data.set(k, v); return this }
  getData(k: string) { return this.data.get(k) }
  setPosition() { return this }
  setFillStyle() { return this }
  setRadius() { return this }
  setAlpha() { return this }
  setScale() { return this }
  destroy() {}
}

class MockGraphics {
  setDepth() { return this }
  setVisible() { return this }
  setScrollFactor() { return this }
  setData() { return this }
  getData() { return false }
  clear() { return this }
  fillStyle() { return this }
  fillRect() { return this }
  lineStyle() { return this }
  strokeCircle() { return this }
  setPosition() { return this }
  setAlpha() { return this }
  destroy() {}
}

function createScene() {
  const timers: Array<() => void> = []
  const clock = { now: 10_000 }
  const time = {
    get now() { return clock.now },
    delayedCall: vi.fn((_delay: number, cb: () => void) => {
      timers.push(cb)
      return { remove: vi.fn() }
    }),
  }
  const scene = {
    time,
    add: {
      circle: vi.fn(() => new MockCircle() as unknown as Phaser.GameObjects.Arc),
      graphics: vi.fn(() => new MockGraphics() as unknown as Phaser.GameObjects.Graphics),
      sprite: vi.fn(),
      text: vi.fn(),
    },
    tweens: {
      add: vi.fn(() => ({})),
      addCounter: vi.fn(() => ({})),
      killTweensOf: vi.fn(),
    },
    cameras: { main: { width: 800, height: 600, scrollX: 0, scrollY: 0, shake: vi.fn() } },
    anims: { exists: vi.fn(() => false) },
    textures: { exists: vi.fn(() => false) },
  } as unknown as Phaser.Scene

  function flushTimers() {
    for (let g = 0; g < 80 && timers.length > 0; g++) {
      const batch = timers.splice(0, timers.length)
      batch.forEach(fn => fn())
    }
  }

  return { scene, clock, flushTimers }
}

describe('CelebrationManager queue (sidekick#72)', () => {
  beforeEach(() => {
    resetAnimConfig()
    vi.restoreAllMocks()
  })

  it('runs higher-priority celebration first when queued together', () => {
    patchAnimConfig({ celebrations: { queueGapMs: 0, taskCompleteCooldownMs: 0, rankUpCooldownMs: 0 } })
    const playRank = vi.spyOn(CelebrationManager.prototype as unknown as { _playRankUp: () => void }, '_playRankUp').mockImplementation(() => {})
    const playTask = vi.spyOn(CelebrationManager.prototype as unknown as { _playTaskComplete: () => void }, '_playTaskComplete').mockImplementation(() => {})
    const { scene, flushTimers } = createScene()
    const mgr = new CelebrationManager(scene)

    mgr.taskComplete(10, 20, { agentId: 'a', skipCooldown: true })
    mgr.rankUp(10, 20, 'N', 'R', 0xff0000, { agentId: 'a', skipCooldown: true })
    flushTimers()

    expect(playRank).toHaveBeenCalledTimes(1)
    expect(playTask).toHaveBeenCalledTimes(1)
    const ri = playRank.mock.invocationCallOrder[0]
    const ti = playTask.mock.invocationCallOrder[0]
    expect(ri).toBeLessThan(ti)
  })

  it('drops second rank-up for same agent within cooldown', () => {
    patchAnimConfig({ celebrations: { rankUpCooldownMs: 5000, queueGapMs: 0 } })
    const playRank = vi.spyOn(CelebrationManager.prototype as unknown as { _playRankUp: () => void }, '_playRankUp').mockImplementation(() => {})
    const { scene, clock, flushTimers } = createScene()
    const mgr = new CelebrationManager(scene)

    mgr.rankUp(1, 2, 'A', 'R1', 0xff0000, { agentId: 'x' })
    flushTimers()
    expect(playRank).toHaveBeenCalledTimes(1)

    clock.now += 1000
    mgr.rankUp(1, 2, 'A', 'R2', 0xff0000, { agentId: 'x' })
    flushTimers()
    expect(playRank).toHaveBeenCalledTimes(1)
  })

  it('merges two taskComplete within merge window into one play', () => {
    patchAnimConfig({
      celebrations: {
        queueGapMs: 0,
        taskCompleteCooldownMs: 0,
        sameTypeMergeWindowMs: 2000,
      },
    })
    const playTask = vi.spyOn(CelebrationManager.prototype as unknown as { _playTaskComplete: (x: number, y: number, m: number) => void }, '_playTaskComplete').mockImplementation(() => {})
    const { scene, flushTimers } = createScene()
    const mgr = new CelebrationManager(scene)

    mgr.taskComplete(5, 5, { agentId: 'z', skipCooldown: true })
    mgr.taskComplete(5, 5, { agentId: 'z', skipCooldown: true })
    flushTimers()

    expect(playTask).toHaveBeenCalledTimes(1)
    expect(playTask).toHaveBeenCalledWith(5, 5, 2)
  })
})
