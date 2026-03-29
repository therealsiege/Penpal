// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('phaser', () => ({
  default: {
    BlendModes: { ADD: 'ADD' },
  },
}))

import { CelebrationManager } from '../../../src/renderer/src/game/celebrations'
import { soundEngine } from '../../../src/renderer/src/game/sound-engine'

class MockCircle {
  x = 0
  y = 0
  visible = false
  alpha = 1
  scaleX = 1
  scaleY = 1
  private data = new Map<string, unknown>()
  setDepth() { return this }
  setVisible(v: boolean) { this.visible = v; return this }
  setBlendMode() { return this }
  setData(k: string, v: unknown) { this.data.set(k, v); return this }
  getData(k: string) { return this.data.get(k) }
  setPosition(x: number, y: number) { this.x = x; this.y = y; return this }
  setFillStyle() { return this }
  setRadius() { return this }
  setAlpha(v: number) { this.alpha = v; return this }
  setScale(v: number) { this.scaleX = v; this.scaleY = v; return this }
  destroy() {}
}

class MockGraphics {
  setDepth() { return this }
  setVisible() { return this }
  setData() { return this }
  getData() { return false }
  destroy() {}
}

function createScene() {
  const tweenConfigs: any[] = []
  const addCircle = vi.fn(() => new MockCircle())
  return {
    scene: {
      add: {
        circle: addCircle,
        graphics: vi.fn(() => new MockGraphics()),
        sprite: vi.fn(),
        text: vi.fn(),
      },
      tweens: {
        add: vi.fn((cfg: any) => {
          tweenConfigs.push(cfg)
          return {}
        }),
        addCounter: vi.fn(),
        killTweensOf: vi.fn(),
      },
      time: { delayedCall: vi.fn() },
      cameras: { main: { width: 1000, height: 700, scrollX: 0, scrollY: 0, shake: vi.fn() } },
      anims: { exists: vi.fn(() => false) },
      textures: { exists: vi.fn(() => false) },
    } as any,
    tweenConfigs,
    addCircle,
  }
}

describe('CelebrationManager approveSparkle', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('uses sparkle pool and cleans particles after completion', () => {
    const dingSpy = vi.spyOn(soundEngine, 'ding').mockImplementation(() => {})
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const { scene, tweenConfigs, addCircle } = createScene()
    const manager = new CelebrationManager(scene)
    const circlesAtInit = addCircle.mock.calls.length

    manager.approveSparkle(100, 120)

    expect(dingSpy).toHaveBeenCalledTimes(1)
    expect(addCircle.mock.calls.length).toBe(circlesAtInit)
    expect(tweenConfigs.length).toBeGreaterThanOrEqual(8)
    expect(tweenConfigs.every(cfg => cfg.duration <= 500)).toBe(true)

    const sparkles = (manager as any)._sparklePool as MockCircle[]
    const first = sparkles[0]
    expect(first.getData('busy')).toBe(true)
    expect(first.visible).toBe(true)

    const firstTween = tweenConfigs[0]
    firstTween.onComplete()

    expect(first.getData('busy')).toBe(false)
    expect(first.visible).toBe(false)
    expect(first.alpha).toBe(0)
    expect(first.scaleX).toBe(1)
    expect(first.scaleY).toBe(1)
  })
})
