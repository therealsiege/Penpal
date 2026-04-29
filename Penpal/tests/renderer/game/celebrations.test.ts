// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('phaser', () => ({
  default: {
    BlendModes: { ADD: 'ADD' },
  },
}))

import { CelebrationManager } from '../../../src/renderer/src/game/celebrations'
import { EFFECT_ANIM_KEYS, ICON_FRAMES, LEGO_SPECIAL_FRAMES, SPRITESHEET_KEYS } from '../../../src/renderer/src/game/office-asset-keys'
import { soundEngine } from '../../../src/renderer/src/game/sound-engine'

class MockCircle {
  x = 0
  y = 0
  visible = false
  alpha = 1
  scaleX = 1
  scaleY = 1
  private data = new Map<string, unknown>([['busy', false]])
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
  x = 0
  y = 0
  angle = 0
  alpha = 1
  visible = false
  private data = new Map<string, unknown>([['busy', false]])
  clear() { return this }
  fillStyle() { return this }
  fillRect() { return this }
  fillRoundedRect() { return this }
  fillTriangle() { return this }
  lineStyle() { return this }
  strokeCircle() { return this }
  strokeRoundedRect() { return this }
  setScrollFactor() { return this }
  setDepth() { return this }
  setVisible(v: boolean) { this.visible = v; return this }
  setAlpha(a: number) { this.alpha = a; return this }
  setPosition(x: number, y: number) { this.x = x; this.y = y; return this }
  setAngle(a: number) { this.angle = a; return this }
  setData(k: string, v: unknown) { this.data.set(k, v); return this }
  getData(k: string) { return this.data.get(k) }
  destroy() {}
}

class MockSprite {
  x = 0
  y = 0
  alpha = 1
  scaleX = 1
  scaleY = 1
  play = vi.fn()
  once = vi.fn((_ev: string, cb: () => void) => { cb(); return this })
  destroy = vi.fn()
  setScale() { return this }
  setOrigin() { return this }
  setAlpha() { return this }
  setDepth() { return this }
  setTint() { return this }
  setBlendMode() { return this }
  setScrollFactor() { return this }
}

class MockText {
  x = 0
  y = 0
  alpha = 0
  destroy = vi.fn()
  setOrigin() { return this }
  setAlpha() { return this }
  setDepth() { return this }
  setScrollFactor() { return this }
  setScale() { return this }
}

type SceneBundle = {
  scene: Record<string, unknown>
  tweenConfigs: Array<Record<string, unknown>>
  tweenCounterConfigs: Array<Record<string, unknown>>
  delayedCalls: Array<{ delay: number; cb: () => void }>
  addCircle: ReturnType<typeof vi.fn>
  addGraphics: ReturnType<typeof vi.fn>
  addSprite: ReturnType<typeof vi.fn>
  addText: ReturnType<typeof vi.fn>
  shake: ReturnType<typeof vi.fn>
  killTweensOf: ReturnType<typeof vi.fn>
  addCounter: ReturnType<typeof vi.fn>
  animsExists: ReturnType<typeof vi.fn>
  texturesExists: ReturnType<typeof vi.fn>
  addRectangle: ReturnType<typeof vi.fn>
}

function createScene(options?: {
  animsExists?: (key: string) => boolean
  texturesExists?: (key: string) => boolean
}): SceneBundle {
  const tweenConfigs: Array<Record<string, unknown>> = []
  const tweenCounterConfigs: Array<Record<string, unknown>> = []
  const delayedCalls: Array<{ delay: number; cb: () => void }> = []
  const addCircle = vi.fn(() => new MockCircle())
  const addGraphics = vi.fn(() => new MockGraphics())
  const addSprite = vi.fn(() => new MockSprite())
  const addText = vi.fn(() => new MockText())
  const shake = vi.fn()
  const killTweensOf = vi.fn()
  const addCounter = vi.fn((cfg: Record<string, unknown>) => {
    tweenCounterConfigs.push(cfg)
    return {}
  })
  const animsExists = vi.fn((key: string) => options?.animsExists?.(key) ?? false)
  const texturesExists = vi.fn((key: string) => options?.texturesExists?.(key) ?? false)
  const addRectangle = vi.fn(() => ({
    setScrollFactor: vi.fn().mockReturnThis(),
    setDepth: vi.fn().mockReturnThis(),
    setOrigin: vi.fn().mockReturnThis(),
    setAlpha: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
  }))

  const scene = {
    add: {
      circle: addCircle,
      graphics: addGraphics,
      sprite: addSprite,
      text: addText,
      rectangle: addRectangle,
      container: vi.fn(() => ({
        add: vi.fn(),
        setScrollFactor: vi.fn().mockReturnThis(),
        setDepth: vi.fn().mockReturnThis(),
      })),
    },
    tweens: {
      add: vi.fn((cfg: Record<string, unknown>) => {
        tweenConfigs.push(cfg)
        return {}
      }),
      addCounter,
      killTweensOf,
    },
    time: {
      now: 10000,
      delayedCall: vi.fn((delay: number, cb: () => void) => {
        delayedCalls.push({ delay, cb })
        return { remove: vi.fn() }
      }),
    },
    cameras: {
      main: { width: 1000, height: 700, scrollX: 100, scrollY: 50, shake },
    },
    anims: { exists: animsExists },
    textures: { exists: texturesExists },
  }

  return {
    scene,
    tweenConfigs,
    tweenCounterConfigs,
    delayedCalls,
    addCircle,
    addGraphics,
    addSprite,
    addText,
    shake,
    killTweensOf,
    addCounter,
    animsExists,
    texturesExists,
    addRectangle,
  }
}

/**
 * Drain the celebration queue by invoking the dispatch timer callback.
 * The queue uses scene.time.delayedCall to schedule _dispatchOne.
 * We find and invoke the most recent delayedCall to flush one queued effect.
 */
function drainQueue(b: SceneBundle): void {
  // The dispatch timer is the last delayedCall added by _kickDispatch.
  // Invoke it to trigger _dispatchOne which runs the queued celebration.
  const last = b.delayedCalls[b.delayedCalls.length - 1]
  if (last) {
    last.cb()
  }
}

function burstBusy(m: CelebrationManager): number {
  return (m as unknown as { _burstPool: MockCircle[] })._burstPool.filter(c => c.getData('busy')).length
}

function sparkleBusy(m: CelebrationManager): number {
  return (m as unknown as { _sparklePool: MockCircle[] })._sparklePool.filter(c => c.getData('busy')).length
}

function confettiBusy(m: CelebrationManager): number {
  return (m as unknown as { _confettiPool: MockGraphics[] })._confettiPool.filter(g => g.getData('busy')).length
}

function findDelayed(delayedCalls: SceneBundle['delayedCalls'], ms: number) {
  const hit = delayedCalls.find(d => d.delay === ms)
  expect(hit).toBeDefined()
  return hit!.cb
}

describe('CelebrationManager', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('rankUp', () => {
    it('plays levelUp, uses 10 burst particles, screen flash tween, no camera shake', () => {
      const levelUpSpy = vi.spyOn(soundEngine, 'levelUp').mockImplementation(() => {})
      vi.spyOn(Math, 'random').mockReturnValue(0.25)
      const b = createScene()
      const manager = new CelebrationManager(b.scene as never)
      b.shake.mockClear()

      manager.rankUp(200, 300, 'Agent', 'Senior', 0x3b82f6)
      drainQueue(b)

      expect(levelUpSpy).toHaveBeenCalledTimes(1)
      expect(burstBusy(manager)).toBe(10)
      expect(b.shake).not.toHaveBeenCalled()

      const flashTween = b.tweenConfigs.find(
        c => c.duration === 160 && c.delay === 50 && c.targets && typeof (c.targets as MockGraphics).fillRect === 'function',
      )
      expect(flashTween).toBeDefined()

      const delays = b.delayedCalls.map(d => d.delay).sort((a, x) => a - x)
      expect(delays).toContain(200)
      expect(delays).toContain(400)
    })
  })

  describe('taskComplete', () => {
    it('creates checkmark sprite, tween pop 180 Back.easeOut and nested fade 260 delay 300', () => {
      vi.spyOn(soundEngine, 'click').mockImplementation(() => {})
      vi.spyOn(Math, 'random').mockReturnValue(0)
      const b = createScene()
      const manager = new CelebrationManager(b.scene as never)

      manager.taskComplete(120, 200)
      drainQueue(b)

      expect(b.addSprite).toHaveBeenCalledWith(120, 186, SPRITESHEET_KEYS.GAME_ICONS, ICON_FRAMES.CHECKMARK)
      const firstPop = b.tweenConfigs.find(c => c.duration === 180 && c.ease === 'Back.easeOut')
      expect(firstPop).toBeDefined()
      expect(firstPop!.targets).toMatchObject({ alpha: expect.any(Number) })
      const onComplete = firstPop!.onComplete as () => void
      onComplete()
      const fade = b.tweenConfigs.find(c => c.duration === 260 && c.delay === 300)
      expect(fade).toBeDefined()
    })

    it('spawns 3 sparkles when Math.random is 0', () => {
      vi.spyOn(soundEngine, 'click').mockImplementation(() => {})
      vi.spyOn(Math, 'random').mockReturnValue(0)
      const b = createScene()
      const manager = new CelebrationManager(b.scene as never)
      manager.taskComplete(0, 0)
      drainQueue(b)
      expect(sparkleBusy(manager)).toBe(3)
    })

    it('plays puff when animation exists', () => {
      vi.spyOn(soundEngine, 'click').mockImplementation(() => {})
      vi.spyOn(Math, 'random').mockReturnValue(0)
      const b = createScene({
        animsExists: key => key === EFFECT_ANIM_KEYS.PUFF,
      })
      const manager = new CelebrationManager(b.scene as never)
      manager.taskComplete(50, 60)
      drainQueue(b)
      expect(b.animsExists).toHaveBeenCalledWith(EFFECT_ANIM_KEYS.PUFF)
      const puffIdx = b.addSprite.mock.calls.findIndex(call => call[2] === SPRITESHEET_KEYS.EFFECTS_PUFF)
      expect(puffIdx).toBeGreaterThanOrEqual(0)
      const puff = b.addSprite.mock.results[puffIdx].value as MockSprite
      expect(puff.play).toHaveBeenCalled()
    })
  })

  describe('milestone', () => {
    it('shakes camera, plays burst and confetti', () => {
      vi.spyOn(soundEngine, 'levelUp').mockImplementation(() => {})
      vi.spyOn(Math, 'random').mockReturnValue(0.1)
      const b = createScene()
      const manager = new CelebrationManager(b.scene as never)

      manager.milestone(400, 500, '100 tasks!')
      drainQueue(b)

      // With mergeCount=1: shake(100, 0.003), 16 burst, 22 confetti
      expect(b.shake).toHaveBeenCalledWith(100, 0.003)
      expect(burstBusy(manager)).toBe(16)
      expect(confettiBusy(manager)).toBe(22)

      findDelayed(b.delayedCalls, 80)()
      expect(burstBusy(manager)).toBe(24)
    })

    it('banner slide-in tween duration 340', () => {
      vi.spyOn(soundEngine, 'levelUp').mockImplementation(() => {})
      vi.spyOn(Math, 'random').mockReturnValue(0.1)
      const b = createScene()
      const manager = new CelebrationManager(b.scene as never)
      manager.milestone(0, 0, 'Hi')
      drainQueue(b)
      const bannerTween = b.tweenConfigs.find(c => c.duration === 340 && c.ease === 'Back.easeOut')
      expect(bannerTween).toBeDefined()
    })
  })

  describe('error', () => {
    it('shakes (60, 0.002), plays error sound, cross tweens 200 then 400 delay 500', () => {
      const errSpy = vi.spyOn(soundEngine, 'error').mockImplementation(() => {})
      const b = createScene()
      const manager = new CelebrationManager(b.scene as never)

      manager.error(80, 90)
      drainQueue(b)

      expect(b.shake).toHaveBeenCalledWith(60, 0.002)
      expect(errSpy).toHaveBeenCalledTimes(1)
      const first = b.tweenConfigs.find(c => c.duration === 200 && c.ease === 'Back.easeOut')
      expect(first).toBeDefined()
      ;(first!.onComplete as () => void)()
      const second = b.tweenConfigs.find(c => c.duration === 400 && c.delay === 500)
      expect(second).toBeDefined()
    })
  })

  describe('questReward', () => {
    it('uses coin frame, schedules XP at 120ms and credits at 250ms, 6 burst, normal has no crate', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.2)
      const b = createScene()
      const manager = new CelebrationManager(b.scene as never)

      manager.questReward(100, 200, 'normal', 42, 7)
      drainQueue(b)

      const coinCall = b.addSprite.mock.calls.find(
        c => c[2] === SPRITESHEET_KEYS.LEGO_SPECIALS && c[3] === LEGO_SPECIAL_FRAMES.COIN,
      )
      expect(coinCall).toBeDefined()

      const delays = b.delayedCalls.map(d => d.delay)
      expect(delays.filter(d => d === 120).length).toBeGreaterThanOrEqual(1)
      expect(delays.filter(d => d === 250).length).toBeGreaterThanOrEqual(1)

      expect(burstBusy(manager)).toBeGreaterThanOrEqual(6)

      const explosive = b.addSprite.mock.calls.filter(
        c => c[3] === LEGO_SPECIAL_FRAMES.EXPLOSIVE,
      )
      expect(explosive.length).toBe(0)
    })

    it('epic adds explosive crate sprite', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.2)
      const b = createScene()
      const manager = new CelebrationManager(b.scene as never)
      manager.questReward(10, 20, 'epic', 1, 1)
      drainQueue(b)
      const explosive = b.addSprite.mock.calls.filter(c => c[3] === LEGO_SPECIAL_FRAMES.EXPLOSIVE)
      expect(explosive.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('seasonEnd', () => {
    it('plays achievement sound via seasonEndCeremony', () => {
      const ach = vi.spyOn(soundEngine, 'achievement').mockImplementation(() => {})
      vi.spyOn(Math, 'random').mockReturnValue(0.15)
      const b = createScene()
      const manager = new CelebrationManager(b.scene as never)

      manager.seasonEnd('Spring', 1234)

      expect(ach).toHaveBeenCalledTimes(1)
    })
  })

  describe('purchase', () => {
    it('with textures: coin/star tween chain 250, 140, 300 delay 200', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.2)
      const b = createScene({ texturesExists: key => key === SPRITESHEET_KEYS.GAME_ICONS })
      const manager = new CelebrationManager(b.scene as never)
      manager.purchase(300, 400, 'Hat')

      const starCall = b.addSprite.mock.calls.find(
        c => c[3] === ICON_FRAMES.STAR_YELLOW,
      )
      expect(starCall).toBeDefined()

      const first = b.tweenConfigs.find(c => c.duration === 250 && c.ease === 'Back.easeOut')
      expect(first).toBeDefined()
      ;(first!.onComplete as () => void)()
      const settle = b.tweenConfigs.find(c => c.duration === 140 && c.ease === 'Bounce.easeOut')
      expect(settle).toBeDefined()
      ;(settle!.onComplete as () => void)()
      const fade = b.tweenConfigs.find(c => c.duration === 300 && c.delay === 200)
      expect(fade).toBeDefined()
    })

    it('without textures: skips coin sprite, still 5 confetti + rising text', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.2)
      const b = createScene({ texturesExists: () => false })
      const manager = new CelebrationManager(b.scene as never)
      const spritesBefore = b.addSprite.mock.calls.length
      manager.purchase(10, 20, 'Item')
      const starSprites = b.addSprite.mock.calls.slice(spritesBefore).filter(c => c[3] === ICON_FRAMES.STAR_YELLOW)
      expect(starSprites.length).toBe(0)
      expect(confettiBusy(manager)).toBe(5)
      expect(b.addText).toHaveBeenCalled()
    })
  })

  describe('questComplete', () => {
    it('star sprite, expanding ring counter, burst particles', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.2)
      const b = createScene()
      const manager = new CelebrationManager(b.scene as never)
      manager.questComplete(55, 66, 'hard')
      drainQueue(b)
      expect(b.addCounter).toHaveBeenCalled()
      expect(burstBusy(manager)).toBeGreaterThanOrEqual(6)
      const star = b.addSprite.mock.calls.find(c => c[2] === SPRITESHEET_KEYS.GAME_ICONS)
      expect(star).toBeDefined()
    })
  })

  describe('seasonStart', () => {
    it('title text tween and particle burst at world center', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.2)
      const b = createScene()
      const manager = new CelebrationManager(b.scene as never)
      manager.seasonStart('Alpha')
      // seasonStart bypasses the queue (fires immediately via seasonStartIntro)
      // Title text should be created
      expect(b.addText).toHaveBeenCalled()
      // Particle burst scheduled via delayedCall at 300ms
      expect(b.delayedCalls.some(d => d.delay === 300)).toBe(true)
    })
  })

  describe('challengeCompleted', () => {
    it('checkmark at center, delayed text 100ms, 6 burst', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.2)
      const b = createScene()
      const manager = new CelebrationManager(b.scene as never)
      manager.challengeCompleted('Daily done')
      const cx = 500
      const cy = 315
      expect(b.addSprite.mock.calls.some(c => c[0] === cx && c[1] === cy)).toBe(true)
      expect(b.delayedCalls.some(d => d.delay === 100)).toBe(true)
      expect(burstBusy(manager)).toBe(6)
    })
  })

  describe('achievementUnlocked', () => {
    it('delayedCall 150 for title text, 6 burst above badge', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.2)
      const b = createScene()
      const manager = new CelebrationManager(b.scene as never)
      manager.achievementUnlocked(400, 500, 'Badge', 2)
      expect(b.delayedCalls.some(d => d.delay === 150)).toBe(true)
      expect(burstBusy(manager)).toBe(6)
    })
  })

  describe('xpGain', () => {
    it('Grade A sprite and +amount text with tween phases', () => {
      const b = createScene()
      const manager = new CelebrationManager(b.scene as never)
      manager.xpGain(200, 220, 15, 0x00ff00)
      const grade = b.addSprite.mock.calls.find(
        c => c[2] === SPRITESHEET_KEYS.LEGO_SPECIALS && c[3] === LEGO_SPECIAL_FRAMES.GRADE_A,
      )
      expect(grade).toBeDefined()
      const txt = b.addText.mock.calls.find(c => c[2] === '+15')
      expect(txt).toBeDefined()
      const t200 = b.tweenConfigs.find(c => c.duration === 200 && c.ease === 'Power2')
      expect(t200).toBeDefined()
    })
  })

  describe('screen shake: only milestone and error', () => {
    it('does not shake for rankUp, taskComplete, purchase, questReward', () => {
      vi.spyOn(soundEngine, 'levelUp').mockImplementation(() => {})
      vi.spyOn(soundEngine, 'click').mockImplementation(() => {})
      vi.spyOn(soundEngine, 'achievement').mockImplementation(() => {})
      vi.spyOn(Math, 'random').mockReturnValue(0.2)

      const b = createScene({ texturesExists: () => true })
      const m = new CelebrationManager(b.scene as never)
      b.shake.mockClear()

      // rankUp is queued - drain to execute
      m.rankUp(1, 2, 'a', 'b', 0xffffff)
      drainQueue(b)
      expect(b.shake).not.toHaveBeenCalled()

      // Advance time past cooldown for next celebration
      ;(b.scene as { time: { now: number } }).time.now = 20000

      m.taskComplete(1, 2)
      drainQueue(b)
      expect(b.shake).not.toHaveBeenCalled()

      m.purchase(1, 2, 'x')
      expect(b.shake).not.toHaveBeenCalled()
    })
  })

  describe('guards', () => {
    it('setCelebrationsAllowed(false) skips queued effects', () => {
      vi.spyOn(soundEngine, 'levelUp').mockImplementation(() => {})
      const b = createScene()
      const m = new CelebrationManager(b.scene as never)
      m.setCelebrationsAllowed(false)
      m.milestone(1, 2, 'x')
      // With queue disabled, nothing should be enqueued or dispatched
      expect(b.shake).not.toHaveBeenCalled()
      expect(soundEngine.levelUp).not.toHaveBeenCalled()
    })

    it('drops duplicate rankUp for same agent within cooldown window', () => {
      vi.spyOn(soundEngine, 'levelUp').mockImplementation(() => {})
      vi.spyOn(Math, 'random').mockReturnValue(0.2)
      const b = createScene()
      const m = new CelebrationManager(b.scene as never)

      m.rankUp(1, 2, 'agent-A', 'Senior', 0xffffff)
      drainQueue(b)
      const firstSoundCount = (soundEngine.levelUp as ReturnType<typeof vi.fn>).mock.calls.length

      // Second rankUp for same agent — cooldown not expired, should be dropped
      m.rankUp(1, 2, 'agent-A', 'Staff', 0xffffff)
      drainQueue(b)

      expect((soundEngine.levelUp as ReturnType<typeof vi.fn>).mock.calls.length).toBe(firstSoundCount)
    })
  })

  describe('destroy', () => {
    it('killTweensOf each pool object and clears pools', () => {
      const b = createScene()
      const m = new CelebrationManager(b.scene as never)
      const burst = (m as unknown as { _burstPool: MockCircle[] })._burstPool
      const conf = (m as unknown as { _confettiPool: MockGraphics[] })._confettiPool
      const spark = (m as unknown as { _sparklePool: MockCircle[] })._sparklePool
      const destroyBurst = vi.spyOn(burst[0], 'destroy')
      m.destroy()
      expect(b.killTweensOf).toHaveBeenCalled()
      expect(destroyBurst).toHaveBeenCalled()
      expect((m as unknown as { _burstPool: unknown[] })._burstPool.length).toBe(0)
      expect((m as unknown as { _confettiPool: unknown[] })._confettiPool.length).toBe(0)
      expect((m as unknown as { _sparklePool: unknown[] })._sparklePool.length).toBe(0)
    })
  })
})
