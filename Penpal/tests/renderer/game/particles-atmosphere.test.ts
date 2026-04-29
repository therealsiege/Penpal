// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('phaser', () => {
  const BlendModes = { ADD: 1 }
  const MathPhaser = { DegToRad: (deg: number) => (deg * Math.PI) / 180 }
  return {
    default: { BlendModes, Math: MathPhaser, GameObjects: {}, Geom: {} },
    BlendModes,
    Math: MathPhaser,
  }
})

vi.mock('../../../src/renderer/src/game/sound-engine', () => ({
  soundEngine: {
    coffeePour: vi.fn(),
    notification: vi.fn(),
    click: vi.fn(),
    levelUp: vi.fn(),
    ding: vi.fn(),
    achievement: vi.fn(),
  },
}))

import Phaser from 'phaser'
import { WeatherParticles } from '../../../src/renderer/src/game/particles-weather'
import { AmbientParticles } from '../../../src/renderer/src/game/particles-ambient'
import { OfficeParticles } from '../../../src/renderer/src/game/office-particles'
import { OfficeAtmosphere } from '../../../src/renderer/src/game/office-atmosphere'
import { AtmosphereSky } from '../../../src/renderer/src/game/atmosphere-sky'
import { AtmosphereLighting } from '../../../src/renderer/src/game/atmosphere-lighting'
import { OfficeAmbient } from '../../../src/renderer/src/game/office-ambient'
import { CelebrationManager } from '../../../src/renderer/src/game/celebrations'
import { SPRITESHEET_KEYS, ICON_FRAMES, EFFECT_ANIM_KEYS } from '../../../src/renderer/src/game/office-asset-keys'
import { LOD_L2_MAX } from '../../../src/renderer/src/game/office-constants'
import { createRendererPhaserScene } from './test-phaser-fakes'

function makeOverlayRect() {
  return {
    setFillStyle: vi.fn().mockReturnThis(),
    setAlpha: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
  }
}

describe('WeatherParticles', () => {
  it('allocates 40 rain lines and 30 snow flakes on init', () => {
    const { scene } = createRendererPhaserScene({ texturesExist: false })
    const w = new WeatherParticles(scene)
    w.init(800, 600)
    const internal = w as unknown as { rainDropPool: unknown[]; snowPool: unknown[] }
    expect(internal.rainDropPool).toHaveLength(40)
    expect(internal.snowPool).toHaveLength(30)
  })

  it('toggles rain on night and hides on non-night; snow on morning only', () => {
    const { scene } = createRendererPhaserScene({ texturesExist: false })
    const w = new WeatherParticles(scene)
    w.init(800, 600)
    w.setWeather('night', 800, 600)
    expect(w.isRainActive()).toBe(true)
    const internal = w as unknown as { rainDropPool: { visible: boolean }[] }
    expect(internal.rainDropPool.every(d => d.visible)).toBe(true)

    w.setWeather('day', 800, 600)
    expect(w.isRainActive()).toBe(false)
    expect(internal.rainDropPool.every(d => !d.visible)).toBe(true)

    w.setWeather('morning', 800, 600)
    expect(w.isSnowActive()).toBe(true)
    const sn = w as unknown as { snowPool: { visible: boolean }[] }
    expect(sn.snowPool.every(f => f.visible)).toBe(true)

    w.setWeather('evening', 800, 600)
    expect(w.isSnowActive()).toBe(false)
    expect(sn.snowPool.every(f => !f.visible)).toBe(true)
  })

  it('tickRain moves visible drops by speed and x drift', () => {
    const { scene } = createRendererPhaserScene({ texturesExist: false })
    const w = new WeatherParticles(scene)
    w.init(100, 100)
    w.setWeather('night', 100, 100)
    const internal = w as unknown as { rainDropPool: { visible: boolean; x: number; y: number; getData(k: string): number }[] }
    const drop = internal.rainDropPool.find(d => d.visible)
    expect(drop).toBeTruthy()
    drop!.setData('speed', 4)
    const x0 = drop!.x
    const y0 = drop!.y
    w.tickRain(100, 100)
    expect(drop!.x).toBe(x0 + 1)
    expect(drop!.y).toBe(y0 + 4)
  })

  it('uses STAR_GREY sprites for snow when game-icons texture exists', () => {
    const { scene, sprite } = createRendererPhaserScene({ texturesExist: true })
    const w = new WeatherParticles(scene)
    w.init(400, 300)
    expect(sprite).toHaveBeenCalled()
    const starGreyCall = sprite.mock.calls.find((c) => c[2] === SPRITESHEET_KEYS.GAME_ICONS && c[3] === ICON_FRAMES.STAR_GREY)
    expect(starGreyCall).toBeTruthy()
  })

  it('tickSnow advances y by stored speed and applies horizontal wobble', () => {
    const { scene } = createRendererPhaserScene({ texturesExist: false })
    const w = new WeatherParticles(scene)
    w.init(200, 200)
    w.setWeather('morning', 200, 200)
    const sn = w as unknown as { snowPool: { visible: boolean; x: number; y: number; getData(k: string): number }[] }
    const flake = sn.snowPool.find(f => f.visible)
    expect(flake).toBeTruthy()
    flake!.setData('speed', 2.5)
    const y0 = flake!.y
    const x0 = flake!.x
    w.tickSnow(1000, 200, 200)
    expect(flake!.y).toBe(y0 + 2.5)
    expect(flake!.x).not.toBe(x0)
  })

  it('triggers lightning flash graphics + tween when interval elapsed', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99)
    const { scene, graphicsInstances, tweensAdd, setTimeNow } = createRendererPhaserScene({ texturesExist: false, animsExistKeys: new Set() })
    const w = new WeatherParticles(scene)
    w.init(400, 300)
    w.setWeather('night', 400, 300)
    const internal = w as unknown as { lastLightningAt: number; lightningInterval: number }
    internal.lastLightningAt = 0
    internal.lightningInterval = 100
    setTimeNow(500)
    w.tickRain(400, 300)
    const flashGfx = graphicsInstances.find(g => g.fills.some(f => f.color === 0xffffff && f.alpha === 0.08))
    expect(flashGfx).toBeTruthy()
    expect(tweensAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        alpha: 0,
        duration: 120,
        delay: 30,
        ease: 'Power2',
      }),
    )
    vi.mocked(Math.random).mockRestore()
  })

  it('destroy clears pools and deactivates rain/snow', () => {
    const { scene } = createRendererPhaserScene({ texturesExist: false })
    const w = new WeatherParticles(scene)
    w.init(200, 200)
    w.setWeather('night', 200, 200)
    const internal = w as unknown as { rainDropPool: { destroy: ReturnType<typeof vi.fn> }[]; snowPool: { destroy: ReturnType<typeof vi.fn> }[] }
    w.destroy()
    expect(w.isRainActive()).toBe(false)
    expect(w.isSnowActive()).toBe(false)
    expect(internal.rainDropPool).toHaveLength(0)
    expect(internal.snowPool).toHaveLength(0)
    expect(internal.rainDropPool).toEqual([])
  })
})

describe('AmbientParticles', () => {
  it('recycles ambient mote busy flag after lifetime (pool find uses !busy)', () => {
    const { scene, setTimeNow } = createRendererPhaserScene({ zoom: 1, texturesExist: false })
    vi.spyOn(Math, 'random').mockReturnValue(0.4)
    const a = new AmbientParticles(scene)
    a.init()
    a.tickAmbientMotes()
    const pool = a as unknown as { ambientMotePool: { getData(k: string): unknown; setData(k: string, v: unknown): void; setVisible(v: boolean): void }[] }
    const busy = pool.ambientMotePool.filter(m => m.getData('busy'))
    expect(busy.length).toBeGreaterThanOrEqual(1)
    const mote = busy[0]!
    mote.setData('lifetime', 100)
    mote.setData('elapsed', 0)
    setTimeNow(0)
    scene.game.loop.delta = 120
    a.tickAmbientMotes()
    expect(mote.getData('busy')).toBe(false)
    vi.mocked(Math.random).mockRestore()
  })

  it('tickMakoMotes sets alpha 0.25 and tween duration in [3000, 5000]', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const { scene, tweensAdd, setTimeNow } = createRendererPhaserScene({ zoom: 0.5, texturesExist: false, tweensAutoComplete: false })
    const a = new AmbientParticles(scene)
    a.init()
    setTimeNow(10_000)
    a.tickMakoMotes(0, 0, 800, 600, 0.5)
    const makoTween = tweensAdd.mock.calls.map(c => c[0]).find(cfg => (cfg as { duration?: number }).duration != null && (cfg as { duration: number }).duration >= 3000)
    expect(makoTween).toBeTruthy()
    expect((makoTween as { duration: number }).duration).toBe(3000)
    const pool = a as unknown as { makoMotePool: { getData(k: string): boolean; setAlpha: ReturnType<typeof vi.fn> }[] }
    const used = pool.makoMotePool.find(m => m.getData('busy'))
    expect(used?.alpha).toBe(0.25)
    vi.mocked(Math.random).mockRestore()
  })

  it('tickSteam uses fill alpha in ~0.06–0.12 and rising tween', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const { scene, tweensAdd, setTimeNow, graphicsInstances } = createRendererPhaserScene({ zoom: 0.5, texturesExist: false, tweensAutoComplete: false })
    const a = new AmbientParticles(scene)
    a.init()
    setTimeNow(20_000)
    a.tickSteam(0, 0, 800, 600, 0.5)
    const steamGfx = graphicsInstances.find(g => g.fills.some(f => f.color === 0x8a96a4))
    expect(steamGfx).toBeTruthy()
    const steamAlpha = steamGfx!.fills.find(f => f.color === 0x8a96a4)!.alpha
    expect(steamAlpha).toBeGreaterThanOrEqual(0.06)
    expect(steamAlpha).toBeLessThanOrEqual(0.12)
    const steamTween = tweensAdd.mock.calls.map(c => c[0]).find(cfg => (cfg as { scaleX?: number }).scaleX === 2)
    expect(steamTween).toBeTruthy()
    expect((steamTween as { duration: number }).duration).toBe(2000)
    vi.mocked(Math.random).mockRestore()
  })

  it('destroy stops timer and clears pools without throwing', () => {
    const { scene } = createRendererPhaserScene({ texturesExist: false })
    const a = new AmbientParticles(scene)
    a.init()
    expect(() => a.destroy()).not.toThrow()
  })
})

describe('OfficeParticles', () => {
  it('spawnTypingParticle uses free pool slot and clears busy on tween complete', () => {
    const { scene } = createRendererPhaserScene({ texturesExist: false })
    const p = new OfficeParticles(scene)
    ;(p as unknown as { initParticlePool(): void }).initParticlePool()
    p.spawnTypingParticle(100, 200, false, false)
    const pool = p as unknown as { typingParticlePool: { getData(k: string): boolean }[] }
    const busyCount = pool.typingParticlePool.filter(c => c.getData('busy')).length
    expect(busyCount).toBe(0)
  })

  it('spawnSteamParticles adds 3 circles with staggered delays and clearSteamParticles cleans up', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const { scene, circle, tweensAdd, delayedCall } = createRendererPhaserScene({ texturesExist: false, tweensAutoComplete: false })
    const p = new OfficeParticles(scene)
    const steamContainer = {
      add: vi.fn().mockReturnThis(),
      remove: vi.fn(),
      removeAll: vi.fn(),
    }
    const ws = { steamContainer, steamTweens: [] as unknown[], lastAnimMode: 'idle' }
    p.spawnSteamParticles(ws)
    expect(circle).toHaveBeenCalledTimes(3)
    const delays = tweensAdd.mock.calls.map(c => (c[0] as { delay?: number }).delay ?? 0)
    expect(delays.sort((a, b) => a - b)).toEqual([0, 400, 800])
    const durations = tweensAdd.mock.calls.map(c => (c[0] as { duration: number }).duration)
    durations.forEach(d => {
      expect(d).toBeGreaterThanOrEqual(1200)
      expect(d).toBeLessThanOrEqual(1800)
    })
    expect(delayedCall).toHaveBeenCalled()
    p.clearSteamParticles(ws)
    expect(steamContainer.removeAll).toHaveBeenCalled()
    vi.mocked(Math.random).mockRestore()
  })

  it('spawnSpriteReaction recycles busy after tween chain completes', () => {
    const { scene } = createRendererPhaserScene({ texturesExist: false })
    const p = new OfficeParticles(scene)
    ;(p as unknown as { initSpriteReactionPool(): void }).initSpriteReactionPool()
    p.spawnSpriteReaction(50, 60, 3)
    const pool = p as unknown as { spriteReactionPool: { getData(k: string): boolean }[] }
    expect(pool.spriteReactionPool.every(s => !s.getData('busy'))).toBe(true)
  })
})

describe('AtmosphereSky.drawSkyGradient', () => {
  it('fills expected phase colors (top strip morning/day/evening/night)', () => {
    const { scene, graphicsInstances } = createRendererPhaserScene({ texturesExist: false })
    const sky = new AtmosphereSky(scene)
    scene.add.graphics()
    const g = graphicsInstances[graphicsInstances.length - 1]!
    ;(sky as unknown as { skyGradient: typeof g }).skyGradient = g as unknown as Phaser.GameObjects.Graphics
    sky.drawSkyGradient('morning')
    expect(g.fills.length).toBeGreaterThan(100)
    expect(g.fills[0]!.color).toBe(0x1e1b4b)
    g.fills.length = 0
    sky.drawSkyGradient('day')
    expect(g.fills[0]!.color).toBe(0x0c4a6e)
    g.fills.length = 0
    sky.drawSkyGradient('evening')
    expect(g.fills[0]!.color).toBe(0x1e1b4b)
    g.fills.length = 0
    sky.drawSkyGradient('night')
    expect(g.fills[0]!.color).toBe(0x030712)
  })
})

describe('OfficeAtmosphere', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('getTimePhase maps hours to four phases with expected tokens', () => {
    vi.useFakeTimers()
    const { scene } = createRendererPhaserScene()
    const onPhaseChange = vi.fn()
    const atm = new OfficeAtmosphere(scene, {
      onPhaseChange,
      invalidateOfficeBgCache: vi.fn(),
      showToast: vi.fn(),
      getCamera: () => ({ width: 800, height: 600 } as Phaser.Cameras.Scene2D.Camera),
    })
    vi.setSystemTime(new Date('2026-06-15T08:00:00'))
    expect(atm.getTimePhase().phase).toBe('morning')
    vi.setSystemTime(new Date('2026-06-15T12:00:00'))
    expect(atm.getTimePhase().phase).toBe('day')
    vi.setSystemTime(new Date('2026-06-15T18:00:00'))
    expect(atm.getTimePhase().phase).toBe('evening')
    vi.setSystemTime(new Date('2026-06-15T22:00:00'))
    expect(atm.getTimePhase().phase).toBe('night')
  })

  it('applyDayNightCycle(true) fires dawn/dusk/night flash with correct tween; day skips flash', () => {
    vi.useFakeTimers()
    const { scene, graphicsInstances, tweensAdd } = createRendererPhaserScene({ tweensAutoComplete: false })
    const onPhaseChange = vi.fn()
    const atm = new OfficeAtmosphere(scene, {
      onPhaseChange,
      invalidateOfficeBgCache: vi.fn(),
      showToast: vi.fn(),
      getCamera: () => ({ width: 800, height: 600 } as Phaser.Cameras.Scene2D.Camera),
    })
    const skyStub = {
      drawSkyGradient: vi.fn(),
      setStarPhaseMultiplier: vi.fn(),
      stars: [] as unknown[],
      clouds: [] as unknown[],
      haze: null,
      redrawCloud: vi.fn(),
    }
    ;(atm as unknown as { sky: typeof skyStub }).sky = skyStub
    ;(atm as unknown as { dayNightOverlay: ReturnType<typeof makeOverlayRect> }).dayNightOverlay = makeOverlayRect()
    vi.setSystemTime(new Date('2026-06-15T08:00:00'))
    atm.currentTimePhase = 'night'
    graphicsInstances.length = 0
    atm.applyDayNightCycle(true)
    const flashFill = graphicsInstances.find(g => g.fills.some(f => f.color === 0xffa500 && f.alpha === 0.12))
    expect(flashFill).toBeTruthy()
    expect(tweensAdd).toHaveBeenCalledWith(expect.objectContaining({ duration: 600, delay: 100, alpha: 0 }))
    expect(onPhaseChange).toHaveBeenCalledWith('morning', true, [], [], 0, 0)

    vi.setSystemTime(new Date('2026-06-15T12:00:00'))
    atm.currentTimePhase = 'morning'
    graphicsInstances.length = 0
    atm.applyDayNightCycle(true)
    const noWarmFlash = graphicsInstances.find(g => g.fills.some(f => f.alpha === 0.12 && [0xffa500, 0xff6a00, 0x1a3a6a].includes(f.color)))
    expect(noWarmFlash).toBeUndefined()

    atm.applyDayNightCycle(false)
    graphicsInstances.length = 0
    vi.setSystemTime(new Date('2026-06-15T18:00:00'))
    atm.currentTimePhase = 'day'
    atm.applyDayNightCycle(false)
    expect(graphicsInstances.filter(g => g.fills.some(f => f.alpha === 0.12)).length).toBe(0)
  })

  it('tickWallClock draws hands using same trigonometry as wall time', () => {
    vi.useFakeTimers()
    const { scene } = createRendererPhaserScene()
    const atm = new OfficeAtmosphere(scene, {
      onPhaseChange: vi.fn(),
      invalidateOfficeBgCache: vi.fn(),
      showToast: vi.fn(),
      getCamera: () => ({ width: 800, height: 600 } as Phaser.Cameras.Scene2D.Camera),
    })
    vi.setSystemTime(new Date('2026-06-15T15:30:45'))
    const secondHand = { clear: vi.fn(), lineStyle: vi.fn(), lineBetween: vi.fn() }
    const minuteHand = { clear: vi.fn(), lineStyle: vi.fn(), lineBetween: vi.fn() }
    const hourHand = { clear: vi.fn(), lineStyle: vi.fn(), lineBetween: vi.fn() }
    atm.clockSecondHand = secondHand as unknown as Phaser.GameObjects.Graphics
    atm.clockMinuteHand = minuteHand as unknown as Phaser.GameObjects.Graphics
    atm.clockHourHand = hourHand as unknown as Phaser.GameObjects.Graphics
    atm.wallClockContainer = {} as Phaser.GameObjects.Container
    atm.tickWallClock()
    const s = 45
    const m = 30
    const h = 3
    const secAngle = Phaser.Math.DegToRad((s / 60) * 360 - 90)
    const minAngle = Phaser.Math.DegToRad((m / 60) * 360 + (s / 60) * 6 - 90)
    const hourAngle = Phaser.Math.DegToRad((h / 12) * 360 + (m / 60) * 30 - 90)
    expect(secondHand.lineBetween).toHaveBeenCalledWith(0, 0, Math.cos(secAngle) * 10, Math.sin(secAngle) * 10)
    expect(minuteHand.lineBetween).toHaveBeenCalledWith(0, 0, Math.cos(minAngle) * 9, Math.sin(minAngle) * 9)
    expect(hourHand.lineBetween).toHaveBeenCalledWith(0, 0, Math.cos(hourAngle) * 6, Math.sin(hourAngle) * 6)
  })
})

describe('AtmosphereLighting.tickCeilingLightActivity', () => {
  it('tweens inner core alpha between active and idle bands when activity changes', () => {
    const { scene, tweensAdd, setTimeNow } = createRendererPhaserScene({ tweensAutoComplete: false })
    const lighting = new AtmosphereLighting(scene)
    const innerCore = { alpha: 0.15 }
    const lightContainer = { getAll: () => [null, null, innerCore] }
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const roomsIdle = new Map([['r', { workstations: new Map([['a', { state: { sessionMode: 'idle', needsInteraction: false } }]]) }]])
    setTimeNow(0)
    lighting.tickCeilingLightActivity(0, [lightContainer as unknown as Phaser.GameObjects.Container], roomsIdle)
    setTimeNow(6000)
    lighting.tickCeilingLightActivity(6000, [lightContainer as unknown as Phaser.GameObjects.Container], roomsIdle)
    const roomsActive = new Map([['r', { workstations: new Map([['a', { state: { sessionMode: 'working', needsInteraction: false } }]]) }]])
    setTimeNow(12_000)
    lighting.tickCeilingLightActivity(12_000, [lightContainer as unknown as Phaser.GameObjects.Container], roomsActive)
    const yoyo = tweensAdd.mock.calls.map(c => c[0]).find(cfg => (cfg as { yoyo?: boolean }).yoyo === true)
    expect(yoyo).toBeTruthy()
    expect((yoyo as { targets: unknown }).targets).toBe(innerCore)
    expect((yoyo as { alpha: { from: number; to: number } }).alpha).toEqual({ from: 0.2, to: 0.35 })
    vi.mocked(Math.random).mockRestore()
  })
})

describe('OfficeAmbient', () => {
  it('scheduleNext uses delayedCall delay in [8000, 15000]', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const { scene, delayedCall } = createRendererPhaserScene()
    const amb = new OfficeAmbient(scene)
    amb.start(() => new Map(), () => ({ worldWidth: 2000, worldHeight: 1200 }))
    const d = delayedCall.mock.calls[0]![0] as number
    expect(d).toBe(8000)
    vi.spyOn(Math, 'random').mockReturnValue(0.999999)
    const amb2 = new OfficeAmbient(scene)
    amb2.start(() => new Map(), () => ({ worldWidth: 2000, worldHeight: 1200 }))
    const d2 = delayedCall.mock.calls[delayedCall.mock.calls.length - 1]![0] as number
    expect(d2).toBeGreaterThan(14999)
    expect(d2).toBeLessThanOrEqual(15000)
    vi.mocked(Math.random).mockRestore()
  })

  it('paper airplane tween uses quadratic Bezier over 1500ms', () => {
    let call = 0
    vi.spyOn(Math, 'random').mockImplementation(() => {
      call += 1
      if (call === 1) return 0.1
      if (call === 2) return 0.05
      if (call === 3) return 0
      if (call === 4) return 0.99
      return 0
    })
    const captured: Record<string, unknown>[] = []
    const { scene } = createRendererPhaserScene({ zoom: 0.6, captureTweenConfigs: captured, tweensAutoComplete: false })
    scene.anims.exists = vi.fn(() => true)
    const ws = (x: number, y: number) => ({
      container: { x, y },
      lastAnimMode: 'idle' as const,
      steamContainer: undefined,
      phoneLight: undefined,
    })
    const room = { x: 0, y: 0, workstations: new Map<string, ReturnType<typeof ws>>([['a', ws(0, 0)], ['b', ws(100, 50)]]) }
    const rooms = new Map([['r', room]])
    const amb = new OfficeAmbient(scene)
    amb.start(() => rooms, () => ({ worldWidth: 2400, worldHeight: 1200 }))
    ;(amb as unknown as { tick(): void }).tick()
    vi.mocked(Math.random).mockRestore()

    const planeTween = captured.find(c => (c as { duration?: number }).duration === 1500)
    expect(planeTween).toBeTruthy()
    const graphicsAdd = vi.mocked(scene.add.graphics)
    const plane = graphicsAdd.mock.results[graphicsAdd.mock.results.length - 1]!.value as {
      x: number
      y: number
    }
    const fromX = 0
    const fromY = -10
    const toX = 100
    const toY = 40
    const midX = (fromX + toX) / 2
    const midY = Math.min(fromY, toY) - 40
    ;(planeTween as { onUpdate: (tw: { progress: number }) => void }).onUpdate({ progress: 0 })
    expect(plane.x).toBeCloseTo(fromX, 5)
    expect(plane.y).toBeCloseTo(fromY, 5)
    ;(planeTween as { onUpdate: (tw: { progress: number }) => void }).onUpdate({ progress: 0.5 })
    expect(plane.x).toBeCloseTo(0.25 * fromX + 0.5 * midX + 0.25 * toX, 5)
    ;(planeTween as { onUpdate: (tw: { progress: number }) => void }).onUpdate({ progress: 1 })
    expect(plane.x).toBeCloseTo(toX, 5)
    expect(plane.y).toBeCloseTo(toY, 5)
  })

  it('coffee refill adds 3 steam sprites with 600ms duration and delays 0,120,240', async () => {
    const { soundEngine } = await import('../../../src/renderer/src/game/sound-engine')
    let call = 0
    vi.spyOn(Math, 'random').mockImplementation(() => {
      call += 1
      if (call === 1) return 0.1
      if (call === 2) return 0.25
      return 0
    })
    const captured: Record<string, unknown>[] = []
    const { scene } = createRendererPhaserScene({ zoom: 0.6, captureTweenConfigs: captured, tweensAutoComplete: false, texturesExist: true })
    const steamContainer = { x: 4, y: 2, add: vi.fn().mockReturnThis(), remove: vi.fn() }
    const ws = {
      container: { x: 10, y: 20 },
      lastAnimMode: 'idle' as const,
      steamContainer,
      phoneLight: undefined,
    }
    const room = { x: 0, y: 0, workstations: new Map([['a', ws]]) }
    const rooms = new Map([['r', room]])
    const amb = new OfficeAmbient(scene)
    amb.start(() => rooms, () => ({ worldWidth: 2400, worldHeight: 1200 }))
    ;(amb as unknown as { tick(): void }).tick()
    expect(soundEngine.coffeePour).toHaveBeenCalled()
    const steamTweens = captured.filter(c => (c as { duration?: number }).duration === 600)
    expect(steamTweens).toHaveLength(3)
    expect(steamTweens.map(t => (t as { delay?: number }).delay).sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual([0, 120, 240])
    vi.mocked(Math.random).mockRestore()
  })

  it('phone ring runs 6 blink steps and optional flash tween when zoom > LOD_L2_MAX', () => {
    let call = 0
    vi.spyOn(Math, 'random').mockImplementation(() => {
      call += 1
      if (call === 1) return 0.1
      if (call === 2) return 0.45
      return 0
    })
    const captured: Record<string, unknown>[] = []
    const { scene } = createRendererPhaserScene({
      zoom: LOD_L2_MAX + 0.01,
      captureTweenConfigs: captured,
      tweensAutoComplete: false,
      texturesExist: true,
    })
    const light = {
      alpha: 0.5,
      fillColor: 0x111111,
      y: -20,
      setAlpha: vi.fn(function (this: { alpha: number }, a: number) {
        this.alpha = a
        return this
      }),
      setFillStyle: vi.fn().mockReturnThis(),
    }
    const ws = {
      container: { x: 10, y: 20 },
      lastAnimMode: 'idle',
      steamContainer: undefined,
      phoneLight: light,
    }
    const room = { x: 0, y: 0, workstations: new Map([['a', ws]]) }
    const rooms = new Map([['r', room]])
    const amb = new OfficeAmbient(scene)
    amb.start(() => rooms, () => ({ worldWidth: 2400, worldHeight: 1200 }))
    const dc = vi.mocked(scene.time.delayedCall)
    dc.mockImplementation((_delay, fn: () => void) => {
      fn()
      return { destroy: vi.fn() }
    })
    ;(amb as unknown as { tick(): void }).tick()
    expect(light.setAlpha.mock.calls.length).toBeGreaterThanOrEqual(6)
    const flashTween = captured.find(c => (c as { repeat?: number }).repeat === 2 && (c as { yoyo?: boolean }).yoyo === true)
    expect(flashTween).toBeTruthy()
    vi.mocked(Math.random).mockRestore()
  })
})

describe('CelebrationManager.questComplete', () => {
  it('uses 220ms star pop tween and spawns burst particles after queue drain', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const captured: Record<string, unknown>[] = []
    const { scene, delayedCall } = createRendererPhaserScene({ texturesExist: true, captureTweenConfigs: captured, tweensAutoComplete: false })
    const mgr = new CelebrationManager(scene)
    mgr.questComplete(200, 300, 'normal')
    // Drain the celebration queue by invoking the dispatch timer callback
    const lastCall = delayedCall.mock.calls[delayedCall.mock.calls.length - 1]
    if (lastCall) {
      const cb = lastCall[1] as () => void
      cb()
    }
    const starTween = captured.find(c => (c as { duration?: number }).duration === 220)
    expect(starTween).toBeTruthy()
    const burstPool = mgr as unknown as { _burstPool: { getData(k: string): boolean }[] }
    const busy = burstPool._burstPool.filter(p => p.getData('busy'))
    expect(busy).toHaveLength(6)
    vi.mocked(Math.random).mockRestore()
  })
})
