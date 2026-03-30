/**
 * Vitest unit tests for sleep/wake lifecycle (issue #91).
 * Validates that pause()/resume() methods on each module correctly
 * pause timers, block spawns, and resume cleanly.
 */
// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'

vi.mock('phaser', () => {
  const BlendModes = { ADD: 1 }
  const MathPhaser = { DegToRad: (deg: number) => (deg * Math.PI) / 180 }
  const Scenes = { Events: { SLEEP: 'sleep', WAKE: 'wake' } }
  return {
    default: { BlendModes, Math: MathPhaser, GameObjects: {}, Geom: {}, Scenes },
    BlendModes,
    Math: MathPhaser,
    Scenes,
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

vi.mock('../../../src/renderer/src/game/quest-system', () => ({
  questSystem: {
    getAgentActiveQuests: vi.fn(() => []),
    startQuest: vi.fn(),
    completeQuest: vi.fn(() => null),
  },
}))

vi.mock('../../../src/renderer/src/game/leaderboard', () => ({
  leaderboardManager: { recordXP: vi.fn(), recordTaskComplete: vi.fn() },
}))

vi.mock('../../../src/renderer/src/game/credits', () => ({
  creditManager: { earn: vi.fn() },
}))

vi.mock('../../../src/renderer/src/game/seasons', () => ({
  seasonManager: {
    trackCreditsEarned: vi.fn(),
    trackQuestDifficulty: vi.fn(),
    trackTaskCompleted: vi.fn(),
  },
}))

vi.mock('../../../src/renderer/src/game/events', () => ({
  EventBus: { emit: vi.fn() },
  EVENTS: { QUEST_COMPLETED: 'QUEST_COMPLETED' },
}))

import { OfficeParticles } from '../../../src/renderer/src/game/office-particles'
import { OfficeAtmosphere } from '../../../src/renderer/src/game/office-atmosphere'
import { OfficeAmbient } from '../../../src/renderer/src/game/office-ambient'
import { CafeCoffeeRunManager } from '../../../src/renderer/src/game/cafe-coffee-run'
import { WorkstationAnimator } from '../../../src/renderer/src/game/workstation-animation'
import { createRendererPhaserScene } from './test-phaser-fakes'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTimer(paused = false) {
  return { paused, destroy: vi.fn() }
}

function makeTween() {
  return {
    pause: vi.fn(),
    resume: vi.fn(),
    destroy: vi.fn(),
    isPlaying: () => true,
    stop: vi.fn(),
  }
}

// ---------------------------------------------------------------------------
// OfficeAtmosphere — pause / resume
// ---------------------------------------------------------------------------

describe('OfficeAtmosphere sleep/wake', () => {
  it('pause() pauses the dayNightTimer and scene tweens', () => {
    const { scene } = createRendererPhaserScene()
    const pauseAll = vi.fn()
    scene.tweens.pauseAll = pauseAll
    const atm = new OfficeAtmosphere(scene, {
      onPhaseChange: vi.fn(),
      invalidateOfficeBgCache: vi.fn(),
      showToast: vi.fn(),
      getCamera: () => ({ width: 800, height: 600 } as Phaser.Cameras.Scene2D.Camera),
    })
    const timer = makeTimer()
    ;(atm as unknown as { dayNightTimer: typeof timer }).dayNightTimer = timer
    atm.pause()
    expect(timer.paused).toBe(true)
    expect(pauseAll).toHaveBeenCalled()
  })

  it('resume() unpauses timer, resumes tweens, re-syncs day/night', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-15T12:00:00'))
    const { scene } = createRendererPhaserScene()
    const resumeAll = vi.fn()
    scene.tweens.resumeAll = resumeAll
    const atm = new OfficeAtmosphere(scene, {
      onPhaseChange: vi.fn(),
      invalidateOfficeBgCache: vi.fn(),
      showToast: vi.fn(),
      getCamera: () => ({ width: 800, height: 600 } as Phaser.Cameras.Scene2D.Camera),
    })
    const timer = makeTimer(true)
    ;(atm as unknown as { dayNightTimer: typeof timer }).dayNightTimer = timer
    // Stub sky/overlay so applyDayNightCycle doesn't crash
    const skyStub = {
      drawSkyGradient: vi.fn(),
      setStarPhaseMultiplier: vi.fn(),
      stars: [],
      clouds: [],
      haze: null,
      redrawCloud: vi.fn(),
    }
    ;(atm as unknown as { sky: typeof skyStub }).sky = skyStub
    ;(atm as unknown as { dayNightOverlay: unknown }).dayNightOverlay = {
      setFillStyle: vi.fn().mockReturnThis(),
      setAlpha: vi.fn().mockReturnThis(),
    }

    atm.resume()
    expect(timer.paused).toBe(false)
    expect(resumeAll).toHaveBeenCalled()
    // applyDayNightCycle(false) should have been called — verify phase is 'day' at noon
    expect(atm.currentTimePhase).toBe('day')
    vi.useRealTimers()
  })
})

// ---------------------------------------------------------------------------
// OfficeParticles — pause / resume + sleeping guard
// ---------------------------------------------------------------------------

describe('OfficeParticles sleep/wake', () => {
  it('pause() pauses timers and sets _sleeping flag', () => {
    const { scene } = createRendererPhaserScene({ texturesExist: false })
    const p = new OfficeParticles(scene)
    const typingTimer = makeTimer()
    const corridorTimer = makeTimer()
    ;(p as unknown as { typingParticleTimer: typeof typingTimer }).typingParticleTimer = typingTimer
    ;(p as unknown as { corridorParticleTimer: typeof corridorTimer }).corridorParticleTimer = corridorTimer
    p.pause()
    expect(typingTimer.paused).toBe(true)
    expect(corridorTimer.paused).toBe(true)
    expect((p as unknown as { _sleeping: boolean })._sleeping).toBe(true)
  })

  it('resume() unpauses timers and clears _sleeping flag', () => {
    const { scene } = createRendererPhaserScene({ texturesExist: false })
    const p = new OfficeParticles(scene)
    const typingTimer = makeTimer(true)
    const corridorTimer = makeTimer(true)
    ;(p as unknown as { typingParticleTimer: typeof typingTimer }).typingParticleTimer = typingTimer
    ;(p as unknown as { corridorParticleTimer: typeof corridorTimer }).corridorParticleTimer = corridorTimer
    ;(p as unknown as { _sleeping: boolean })._sleeping = true
    p.resume()
    expect(typingTimer.paused).toBe(false)
    expect(corridorTimer.paused).toBe(false)
    expect((p as unknown as { _sleeping: boolean })._sleeping).toBe(false)
  })

  it('spawn methods bail out when sleeping', () => {
    const { scene } = createRendererPhaserScene({ texturesExist: false })
    const p = new OfficeParticles(scene)
    // Initialize the typing particle pool so there's a free slot
    ;(p as unknown as { initParticlePool(): void }).initParticlePool()
    ;(p as unknown as { _sleeping: boolean })._sleeping = true

    // spawnTypingParticle should be a no-op
    p.spawnTypingParticle(100, 200, false, false)
    const pool = (p as unknown as { typingParticlePool: { getData(k: string): boolean }[] }).typingParticlePool
    const busyCount = pool.filter(c => c.getData('busy')).length
    expect(busyCount).toBe(0)
  })

  it('spawnAlertRipple bails out when sleeping', () => {
    const { scene } = createRendererPhaserScene({ texturesExist: false })
    const p = new OfficeParticles(scene)
    ;(p as unknown as { initAlertRipplePool(): void }).initAlertRipplePool()
    ;(p as unknown as { _sleeping: boolean })._sleeping = true
    p.spawnAlertRipple(100, 200, 0xff0000)
    const pool = (p as unknown as { alertRipplePool: { getData(k: string): boolean }[] }).alertRipplePool
    expect(pool.every(c => !c.getData('busy'))).toBe(true)
  })

  it('spawnEmojiReaction bails out when sleeping', () => {
    const { scene } = createRendererPhaserScene({ texturesExist: false })
    const p = new OfficeParticles(scene)
    ;(p as unknown as { initEmojiReactionPool(): void }).initEmojiReactionPool()
    ;(p as unknown as { _sleeping: boolean })._sleeping = true
    p.spawnEmojiReaction(50, 60, '🎉')
    const pool = (p as unknown as { emojiReactionPool: { getData(k: string): boolean }[] }).emojiReactionPool
    expect(pool.every(t => !t.getData('busy'))).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// OfficeAmbient — pause / resume
// ---------------------------------------------------------------------------

describe('OfficeAmbient sleep/wake', () => {
  it('pause() pauses the delayedCall timer', () => {
    const { scene } = createRendererPhaserScene()
    const amb = new OfficeAmbient(scene)
    const timer = makeTimer()
    ;(amb as unknown as { timer: typeof timer }).timer = timer
    amb.pause()
    expect(timer.paused).toBe(true)
  })

  it('resume() unpauses the timer', () => {
    const { scene } = createRendererPhaserScene()
    const amb = new OfficeAmbient(scene)
    const timer = makeTimer(true)
    ;(amb as unknown as { timer: typeof timer }).timer = timer
    amb.resume()
    expect(timer.paused).toBe(false)
  })

  it('pause/resume are safe when timer is null', () => {
    const { scene } = createRendererPhaserScene()
    const amb = new OfficeAmbient(scene)
    expect(() => amb.pause()).not.toThrow()
    expect(() => amb.resume()).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// CafeCoffeeRunManager — pause / resume
// ---------------------------------------------------------------------------

describe('CafeCoffeeRunManager sleep/wake', () => {
  it('pause() pauses the coffeeRunTimer', () => {
    const { scene } = createRendererPhaserScene()
    const host = {
      seatedVisitors: new Map(),
      stoolOccupied: new Set(),
      coffeeRunners: new Map(),
      getNavMesh: () => null,
      getRooms: () => new Map(),
      getCafeWorldPos: () => ({ x: 0, y: 0 }),
      getBaristas: () => [],
      getBaristaHomeX: () => [],
      getStoolCount: () => 4,
      pickStool: () => 0,
      addVisitorToStool: vi.fn(),
      removeVisitorFromStool: vi.fn(),
      cleanupVisitor: vi.fn(),
    }
    const mgr = new CafeCoffeeRunManager(scene as never, host as never)
    const timer = makeTimer()
    ;(mgr as unknown as { coffeeRunTimer: typeof timer }).coffeeRunTimer = timer
    mgr.pause()
    expect(timer.paused).toBe(true)
  })

  it('resume() unpauses the coffeeRunTimer', () => {
    const { scene } = createRendererPhaserScene()
    const mgr = new CafeCoffeeRunManager(scene as never, {} as never)
    const timer = makeTimer(true)
    ;(mgr as unknown as { coffeeRunTimer: typeof timer }).coffeeRunTimer = timer
    mgr.resume()
    expect(timer.paused).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// WorkstationAnimator — pauseAll / resumeAll
// ---------------------------------------------------------------------------

describe('WorkstationAnimator sleep/wake', () => {
  function makeWorkstation() {
    return {
      lookAroundTimer: makeTimer(),
      stretchTimer: makeTimer(),
      walkBreakTimer: makeTimer(),
      lookAtNeighborTimer: makeTimer(),
      yawnTimer: makeTimer(),
      lampFlickerTimer: makeTimer(),
      typingNoteTimer: makeTimer(),
      speechBubbleTimer: makeTimer(),
      flameTimer: makeTimer(),
      blurbFadeTimer: makeTimer(),
      walkBreakTween: makeTween(),
      container: { x: 0, y: 0, visible: true, alpha: 1 },
    }
  }

  function makeHost(workstations: Map<string, ReturnType<typeof makeWorkstation>>) {
    const rooms = new Map([['room1', { workstations }]])
    return {
      getRooms: () => rooms,
      getLastLodLevel: () => 3,
      getAgentCharacterIndex: () => 0,
      burstConfetti: vi.fn(),
      clearSteamParticles: vi.fn(),
      spawnFlameParticle: vi.fn(),
      getPodLines: () => [],
      isCoffeeRunActive: () => false,
      cancelCoffeeRun: vi.fn(),
      getOrchestratorTaskForAgent: () => undefined,
      getNavMesh: () => null,
    }
  }

  it('pauseAll() pauses all workstation timers and tweens', () => {
    const ws = makeWorkstation()
    const host = makeHost(new Map([['agent1', ws]]) as never)
    const animator = new WorkstationAnimator(
      {} as Phaser.Scene,
      host as never,
      vi.fn(),
      vi.fn(),
    )
    animator.pauseAll()
    expect(ws.lookAroundTimer.paused).toBe(true)
    expect(ws.stretchTimer.paused).toBe(true)
    expect(ws.walkBreakTimer.paused).toBe(true)
    expect(ws.lookAtNeighborTimer.paused).toBe(true)
    expect(ws.yawnTimer.paused).toBe(true)
    expect(ws.lampFlickerTimer.paused).toBe(true)
    expect(ws.typingNoteTimer.paused).toBe(true)
    expect(ws.speechBubbleTimer.paused).toBe(true)
    expect(ws.flameTimer.paused).toBe(true)
    expect(ws.blurbFadeTimer.paused).toBe(true)
    expect(ws.walkBreakTween.pause).toHaveBeenCalled()
  })

  it('resumeAll() resumes all workstation timers and tweens', () => {
    const ws = makeWorkstation()
    // Start everything paused
    ws.lookAroundTimer.paused = true
    ws.stretchTimer.paused = true
    ws.walkBreakTimer.paused = true
    ws.lookAtNeighborTimer.paused = true
    ws.yawnTimer.paused = true
    ws.lampFlickerTimer.paused = true
    ws.typingNoteTimer.paused = true
    ws.speechBubbleTimer.paused = true
    ws.flameTimer.paused = true
    ws.blurbFadeTimer.paused = true
    const host = makeHost(new Map([['agent1', ws]]) as never)
    const animator = new WorkstationAnimator(
      {} as Phaser.Scene,
      host as never,
      vi.fn(),
      vi.fn(),
    )
    animator.resumeAll()
    expect(ws.lookAroundTimer.paused).toBe(false)
    expect(ws.stretchTimer.paused).toBe(false)
    expect(ws.walkBreakTimer.paused).toBe(false)
    expect(ws.lookAtNeighborTimer.paused).toBe(false)
    expect(ws.yawnTimer.paused).toBe(false)
    expect(ws.lampFlickerTimer.paused).toBe(false)
    expect(ws.typingNoteTimer.paused).toBe(false)
    expect(ws.speechBubbleTimer.paused).toBe(false)
    expect(ws.flameTimer.paused).toBe(false)
    expect(ws.blurbFadeTimer.paused).toBe(false)
    expect(ws.walkBreakTween.resume).toHaveBeenCalled()
  })

  it('pauseAll/resumeAll handle workstations with no timers gracefully', () => {
    const ws = { container: { x: 0, y: 0, visible: true, alpha: 1 } }
    const host = makeHost(new Map([['agent1', ws]]) as never)
    const animator = new WorkstationAnimator(
      {} as Phaser.Scene,
      host as never,
      vi.fn(),
      vi.fn(),
    )
    expect(() => animator.pauseAll()).not.toThrow()
    expect(() => animator.resumeAll()).not.toThrow()
  })
})
