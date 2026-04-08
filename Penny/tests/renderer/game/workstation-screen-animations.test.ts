/**
 * Unit tests for issue #154: workstation terminal/monitor animations.
 * Covers: screen mode activation, cursor blink timer, keyboard scale pulse,
 * terminal text scroll, LED blink config, and teardown cleanup.
 */
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentState } from '../../../src/renderer/src/types'
import type { WorkstationSprite } from '../../../src/renderer/src/game/office-types'
import type { WorkstationHost } from '../../../src/renderer/src/game/office-workstation'
import { AnimConfig, resetAnimConfig } from '../../../src/renderer/src/game/animation-config'
import { WS_SPRITE_Y } from '../../../src/renderer/src/game/office-constants'

vi.mock('phaser', () => ({
  default: {
    Math: { DegToRad: (deg: number) => (deg * Math.PI) / 180 },
    GameObjects: {},
  },
  Math: { DegToRad: (deg: number) => (deg * Math.PI) / 180 },
  GameObjects: {},
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
    trackQuestCompleted: vi.fn(),
  },
}))

vi.mock('../../../src/renderer/src/game/events', () => ({
  EventBus: { emit: vi.fn() },
  EVENTS: { QUEST_COMPLETED: 'QUEST_COMPLETED' },
}))

import { WorkstationAnimator } from '../../../src/renderer/src/game/workstation-animation'

type TimeEventConfig = { delay: number; loop?: boolean; callback: () => void }

function makeScene() {
  const tweensChain: Array<{ destroy: ReturnType<typeof vi.fn>; cfg: Record<string, unknown>; isPaused: () => boolean; resume: ReturnType<typeof vi.fn>; pause: ReturnType<typeof vi.fn> }> = []
  const timeEvents: Array<{ destroy: ReturnType<typeof vi.fn>; cfg: TimeEventConfig; paused: boolean }> = []

  const tweensAdd = vi.fn((cfg: Record<string, unknown>) => {
    const tw = {
      destroy: vi.fn(),
      isPlaying: () => true,
      isPaused: () => false,
      resume: vi.fn(),
      pause: vi.fn(),
      stop: vi.fn(),
      getValue: () => 0,
      cfg,
    }
    tweensChain.push(tw)
    // Run onComplete synchronously for LED fade tweens
    const onComplete = cfg.onComplete as (() => void) | undefined
    onComplete?.()
    return tw
  })

  const addEvent = vi.fn((cfg: TimeEventConfig) => {
    const ev = { destroy: vi.fn(), cfg, paused: false }
    timeEvents.push(ev)
    return ev
  })

  const scene = {
    scene: { isActive: vi.fn(() => true) },
    cameras: { main: { zoom: 0.8 } },
    tweens: {
      add: tweensAdd,
      killTweensOf: vi.fn(),
      addCounter: vi.fn((cfg: Record<string, unknown>) => {
        const tw = {
          destroy: vi.fn(),
          isPaused: () => true,
          resume: vi.fn(),
          pause: vi.fn(),
          stop: vi.fn(),
          getValue: () => 0,
          cfg,
        }
        return tw
      }),
    },
    time: { addEvent, delayedCall: vi.fn(() => ({ remove: vi.fn() })) },
    anims: { exists: vi.fn(() => false) },
    add: {
      graphics: vi.fn(() => ({
        clear: vi.fn().mockReturnThis(),
        fillStyle: vi.fn().mockReturnThis(),
        fillRoundedRect: vi.fn().mockReturnThis(),
        lineStyle: vi.fn().mockReturnThis(),
        strokeRoundedRect: vi.fn().mockReturnThis(),
        beginPath: vi.fn().mockReturnThis(),
        strokePath: vi.fn().mockReturnThis(),
        arc: vi.fn().mockReturnThis(),
        setAlpha: vi.fn().mockReturnThis(),
        setVisible: vi.fn().mockReturnThis(),
        active: true,
      })),
      sprite: vi.fn(() => ({
        active: true,
        setScale: vi.fn().mockReturnThis(),
        setAlpha: vi.fn().mockReturnThis(),
        setDepth: vi.fn().mockReturnThis(),
        setOrigin: vi.fn().mockReturnThis(),
        setPosition: vi.fn().mockReturnThis(),
        play: vi.fn().mockReturnThis(),
        once: vi.fn().mockReturnThis(),
        destroy: vi.fn(),
      })),
      text: vi.fn(() => ({
        active: true,
        text: '',
        y: 0,
        setText: vi.fn().mockReturnThis(),
        setVisible: vi.fn().mockReturnThis(),
        setAlpha: vi.fn().mockReturnThis(),
        setOrigin: vi.fn().mockReturnThis(),
        setDepth: vi.fn().mockReturnThis(),
        setWordWrapWidth: vi.fn().mockReturnThis(),
      })),
      ellipse: vi.fn(() => ({ setDepth: vi.fn().mockReturnThis(), destroy: vi.fn() })),
      container: vi.fn((_x: number, _y: number, _ch?: unknown[]) => ({
        active: true,
        x: 0, y: 0, alpha: 0, visible: false,
        list: [] as unknown[],
        add: vi.fn().mockReturnThis(),
        setAlpha: vi.fn().mockReturnThis(),
        setVisible: vi.fn().mockReturnThis(),
        setPosition: vi.fn().mockReturnThis(),
        destroy: vi.fn(),
      })),
    },
  } as unknown as Phaser.Scene

  return { scene, tweensAdd, tweensChain, timeEvents }
}

function makeWorkstation(agentId: string, overrides?: Partial<WorkstationSprite>): WorkstationSprite {
  const data = new Map<string, unknown>()
  const sprite = {
    x: 0,
    y: WS_SPRITE_Y,
    visible: true,
    setFrame: vi.fn(),
    setScale: vi.fn(),
    setAngle: vi.fn(),
    setData: vi.fn((k: string, v: unknown) => data.set(k, v)),
    getData: vi.fn((k: string) => data.get(k)),
    setVisible: vi.fn(),
  }

  const makeLedGlow = () => ({
    active: true,
    alpha: 0,
    clear: vi.fn().mockReturnThis(),
    fillStyle: vi.fn().mockReturnThis(),
    fillRoundedRect: vi.fn().mockReturnThis(),
    setAlpha: vi.fn(function (this: { alpha: number }, a: number) { this.alpha = a; return this }),
  })

  const makeMonitorText = () => ({
    active: true,
    text: '',
    y: 0,
    visible: false,
    setText: vi.fn(function (this: { text: string }, s: string) { this.text = s; return this }),
    setVisible: vi.fn(function (this: { visible: boolean }, v: boolean) { this.visible = v; return this }),
    setAlpha: vi.fn().mockReturnThis(),
  })

  const makeKeyboard = () => ({
    active: true,
    scaleX: 1,
    scaleY: 1,
    alpha: 0.8,
    setStrokeStyle: vi.fn().mockReturnThis(),
    setAlpha: vi.fn(function (this: { alpha: number }, a: number) { this.alpha = a; return this }),
  })

  const makeScreenLines = () => ({
    active: true,
    visible: false,
    setVisible: vi.fn(function (this: { visible: boolean }, v: boolean) { this.visible = v; return this }),
    clear: vi.fn().mockReturnThis(),
    fillStyle: vi.fn().mockReturnThis(),
    fillRect: vi.fn().mockReturnThis(),
  })

  const base: WorkstationSprite = {
    state: { config: { id: agentId, name: 'Test' } } as AgentState,
    sprite: sprite as unknown as WorkstationSprite['sprite'],
    statusDot: { setAlpha: vi.fn() } as unknown as WorkstationSprite['statusDot'],
    deskBody: { setStrokeStyle: vi.fn() } as unknown as WorkstationSprite['deskBody'],
    container: {
      x: 0, y: 0, alpha: 1, visible: true, active: true,
      add: vi.fn(), setVisible: vi.fn(), setAlpha: vi.fn(),
    } as unknown as WorkstationSprite['container'],
    monitorGlowFx: { color: 0, outerStrength: 0 } as unknown as WorkstationSprite['monitorGlowFx'],
    thoughtBubble: {} as WorkstationSprite['thoughtBubble'],
    thoughtBubbleText: {} as WorkstationSprite['thoughtBubbleText'],
    thoughtBubbleBg: {} as WorkstationSprite['thoughtBubbleBg'],
    blockedIndicator: { setVisible: vi.fn(), setAlpha: vi.fn(), setScale: vi.fn() } as unknown as WorkstationSprite['blockedIndicator'],
    blockedIndicatorPulse: { setFillStyle: vi.fn() } as unknown as WorkstationSprite['blockedIndicatorPulse'],
    blockedIndicatorBadge: { setFrame: vi.fn() } as unknown as WorkstationSprite['blockedIndicatorBadge'],
    blockedIndicatorStem: { setFillStyle: vi.fn() } as unknown as WorkstationSprite['blockedIndicatorStem'],
    blockedIndicatorText: { setText: vi.fn() } as unknown as WorkstationSprite['blockedIndicatorText'],
    lodLevel2Objects: [],
    lodLevel3Objects: [],
    localTaskCount: 0,
    energyLevel: 1,
    progressRing: undefined,
    soundWaveGfx: undefined,
    keyboard: makeKeyboard() as unknown as WorkstationSprite['keyboard'],
    questIcon: undefined,
    chairSprite: null,
    ledGlow: makeLedGlow() as unknown as WorkstationSprite['ledGlow'],
    monitorText: makeMonitorText() as unknown as WorkstationSprite['monitorText'],
    screenLines: makeScreenLines() as unknown as WorkstationSprite['screenLines'],
    screenState: { mode: 'idle' },
    screenTween: {
      destroy: vi.fn(),
      isPaused: () => true,
      resume: vi.fn(),
      pause: vi.fn(),
    } as unknown as WorkstationSprite['screenTween'],
    ...overrides,
  }
  return base
}

function makeHost(ws: WorkstationSprite, extras?: Partial<WorkstationHost>): WorkstationHost {
  const room = {
    x: 100, y: 200, width: 400, height: 300,
    workstations: new Map([[ws.state!.config.id, ws]]),
  }
  return {
    getRooms: () => new Map([['r1', room]]),
    getAgentCharacterIndex: () => 0,
    getNavMesh: () => null,
    clearSteamParticles: vi.fn(),
    burstConfetti: vi.fn(),
    getLastLodLevel: () => 2,
    ...extras,
  } as WorkstationHost
}

function agentBase(id: string, overrides?: Partial<AgentState>): AgentState {
  return {
    config: { id, name: 'Test' },
    xp: { currentStreak: 0, level: 1, rank: 'Intern', totalXP: 0 },
    ...overrides,
  } as AgentState
}

// ---------------------------------------------------------------------------

describe('AnimConfig — new #154 fields', () => {
  beforeEach(() => resetAnimConfig())

  it('working.kbPulseScale is > 1 (scale-up for key-press pulse)', () => {
    expect(AnimConfig.working.kbPulseScale).toBeGreaterThan(1)
  })

  it('working.kbPulseDuration is a positive number', () => {
    expect(AnimConfig.working.kbPulseDuration).toBeGreaterThan(0)
  })

  it('idle.ledBlinkDuration is a positive number', () => {
    expect(AnimConfig.idle.ledBlinkDuration).toBeGreaterThan(0)
  })

  it('idle.ledBlinkAlphaPeak is > 0 and <= 1', () => {
    expect(AnimConfig.idle.ledBlinkAlphaPeak).toBeGreaterThan(0)
    expect(AnimConfig.idle.ledBlinkAlphaPeak).toBeLessThanOrEqual(1)
  })

  it('idle LED blink peak alpha is higher than near-zero base', () => {
    expect(AnimConfig.idle.ledBlinkAlphaPeak).toBeGreaterThan(0.04)
  })

  it('kbPulseScale is modest (< 1.1) — not too jarring', () => {
    expect(AnimConfig.working.kbPulseScale).toBeLessThan(1.1)
  })
})

// ---------------------------------------------------------------------------

describe('workstation screen animations — working mode', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    resetAnimConfig()
  })
  afterEach(() => vi.restoreAllMocks())

  it('sets screenState.mode to "working"', () => {
    const { scene } = makeScene()
    const ws = makeWorkstation('w1')
    const animator = new WorkstationAnimator(scene, makeHost(ws), vi.fn(), vi.fn())
    animator.updateAnimation(ws, agentBase('w1', { sessionMode: 'working', needsInteraction: false }))
    expect(ws.screenState?.mode).toBe('working')
  })

  it('resumes screenTween when entering working mode', () => {
    const { scene } = makeScene()
    const ws = makeWorkstation('w2')
    const resumeSpy = ws.screenTween!.resume as ReturnType<typeof vi.fn>
    const animator = new WorkstationAnimator(scene, makeHost(ws), vi.fn(), vi.fn())
    animator.updateAnimation(ws, agentBase('w2', { sessionMode: 'working', needsInteraction: false }))
    expect(resumeSpy).toHaveBeenCalled()
  })

  it('shows screenLines when entering working mode', () => {
    const { scene } = makeScene()
    const ws = makeWorkstation('w3')
    const animator = new WorkstationAnimator(scene, makeHost(ws), vi.fn(), vi.fn())
    animator.updateAnimation(ws, agentBase('w3', { sessionMode: 'working', needsInteraction: false }))
    const setVisible = ws.screenLines!.setVisible as ReturnType<typeof vi.fn>
    expect(setVisible).toHaveBeenCalledWith(true)
  })

  it('creates kbPulseTween for keyboard scale pulse', () => {
    const { scene, tweensAdd } = makeScene()
    const ws = makeWorkstation('w4')
    const animator = new WorkstationAnimator(scene, makeHost(ws), vi.fn(), vi.fn())
    animator.updateAnimation(ws, agentBase('w4', { sessionMode: 'working', needsInteraction: false }))
    // kbPulseTween should have been created with yoyo + repeat: -1
    const kbPulseCfg = tweensAdd.mock.calls.find((args) => {
      const cfg = args[0] as Record<string, unknown>
      return cfg.targets === ws.keyboard && cfg.yoyo === true && cfg.repeat === -1
        && typeof cfg.scaleX === 'number'
    })
    expect(kbPulseCfg).toBeDefined()
    expect(ws.kbPulseTween).toBeDefined()
  })

  it('creates screenScrollTween when agent has a blurb', () => {
    const { scene, tweensAdd } = makeScene()
    const ws = makeWorkstation('w5')
    const animator = new WorkstationAnimator(scene, makeHost(ws), vi.fn(), vi.fn())
    animator.updateAnimation(ws, agentBase('w5', {
      sessionMode: 'working',
      needsInteraction: false,
      lastAssistantBlurb: 'Fixing the auth bug',
    }))
    const scrollCfg = tweensAdd.mock.calls.find((args) => {
      const cfg = args[0] as Record<string, unknown>
      return cfg.targets === ws.monitorText && cfg.yoyo === true
    })
    expect(scrollCfg).toBeDefined()
    expect(ws.screenScrollTween).toBeDefined()
  })

  it('sets monitorText to truncated blurb (max 20 chars)', () => {
    const { scene } = makeScene()
    const ws = makeWorkstation('w6')
    const animator = new WorkstationAnimator(scene, makeHost(ws), vi.fn(), vi.fn())
    const longBlurb = 'Refactoring the entire authentication module to use JWT'
    animator.updateAnimation(ws, agentBase('w6', {
      sessionMode: 'working',
      needsInteraction: false,
      lastAssistantBlurb: longBlurb,
    }))
    const setText = ws.monitorText!.setText as ReturnType<typeof vi.fn>
    const firstTextArg = setText.mock.calls.find((args: unknown[]) => {
      const s = args[0] as string
      return s.length > 0 && s !== '' && s !== '_' && s !== ' '
    })
    expect(firstTextArg).toBeDefined()
    expect((firstTextArg![0] as string).length).toBeLessThanOrEqual(20)
  })

  it('does not create screenScrollTween when agent has no blurb', () => {
    const { scene } = makeScene()
    const ws = makeWorkstation('w7')
    const animator = new WorkstationAnimator(scene, makeHost(ws), vi.fn(), vi.fn())
    animator.updateAnimation(ws, agentBase('w7', { sessionMode: 'working', needsInteraction: false }))
    expect(ws.screenScrollTween).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------

describe('workstation screen animations — idle mode', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    resetAnimConfig()
  })
  afterEach(() => vi.restoreAllMocks())

  it('sets screenState.mode to "idle"', () => {
    const { scene } = makeScene()
    const ws = makeWorkstation('i1')
    const animator = new WorkstationAnimator(scene, makeHost(ws), vi.fn(), vi.fn())
    animator.updateAnimation(ws, agentBase('i1', { sessionMode: 'idle', needsInteraction: false }))
    expect(ws.screenState?.mode).toBe('idle')
  })

  it('resumes screenTween when entering idle mode', () => {
    const { scene } = makeScene()
    const ws = makeWorkstation('i2')
    const resumeSpy = ws.screenTween!.resume as ReturnType<typeof vi.fn>
    const animator = new WorkstationAnimator(scene, makeHost(ws), vi.fn(), vi.fn())
    animator.updateAnimation(ws, agentBase('i2', { sessionMode: 'idle', needsInteraction: false }))
    expect(resumeSpy).toHaveBeenCalled()
  })

  it('shows screenLines when entering idle mode', () => {
    const { scene } = makeScene()
    const ws = makeWorkstation('i3')
    const animator = new WorkstationAnimator(scene, makeHost(ws), vi.fn(), vi.fn())
    animator.updateAnimation(ws, agentBase('i3', { sessionMode: 'idle', needsInteraction: false }))
    const setVisible = ws.screenLines!.setVisible as ReturnType<typeof vi.fn>
    expect(setVisible).toHaveBeenCalledWith(true)
  })

  it('creates cursorBlinkTimer when idle', () => {
    const { scene } = makeScene()
    const ws = makeWorkstation('i4')
    const animator = new WorkstationAnimator(scene, makeHost(ws), vi.fn(), vi.fn())
    animator.updateAnimation(ws, agentBase('i4', { sessionMode: 'idle', needsInteraction: false }))
    expect(ws.cursorBlinkTimer).toBeDefined()
  })

  it('sets monitorText to cursor underscore when idle', () => {
    const { scene } = makeScene()
    const ws = makeWorkstation('i5')
    const animator = new WorkstationAnimator(scene, makeHost(ws), vi.fn(), vi.fn())
    animator.updateAnimation(ws, agentBase('i5', { sessionMode: 'idle', needsInteraction: false }))
    const setText = ws.monitorText!.setText as ReturnType<typeof vi.fn>
    expect(setText).toHaveBeenCalledWith('_')
  })

  it('creates ledPulseTween for idle LED (slow blink)', () => {
    const { scene, tweensAdd } = makeScene()
    const ws = makeWorkstation('i6')
    const animator = new WorkstationAnimator(scene, makeHost(ws), vi.fn(), vi.fn())
    animator.updateAnimation(ws, agentBase('i6', { sessionMode: 'idle', needsInteraction: false }))
    expect(ws.ledPulseTween).toBeDefined()
    // Should use AnimConfig.idle.ledBlinkDuration
    const ledPulseCfg = tweensAdd.mock.calls.find((args) => {
      const cfg = args[0] as Record<string, unknown>
      return cfg.targets === ws.ledGlow && cfg.yoyo === true && cfg.repeat === -1
        && cfg.duration === AnimConfig.idle.ledBlinkDuration
    })
    expect(ledPulseCfg).toBeDefined()
  })
})

// ---------------------------------------------------------------------------

describe('workstation screen animations — waiting (blocked) mode', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    resetAnimConfig()
  })
  afterEach(() => vi.restoreAllMocks())

  it('sets screenState.mode to "blocked"', () => {
    const { scene } = makeScene()
    const ws = makeWorkstation('b1')
    const animator = new WorkstationAnimator(scene, makeHost(ws), vi.fn(), vi.fn())
    animator.updateAnimation(ws, agentBase('b1', { sessionMode: 'idle', needsInteraction: true }))
    expect(ws.screenState?.mode).toBe('blocked')
  })

  it('resumes screenTween when entering blocked mode', () => {
    const { scene } = makeScene()
    const ws = makeWorkstation('b2')
    const resumeSpy = ws.screenTween!.resume as ReturnType<typeof vi.fn>
    const animator = new WorkstationAnimator(scene, makeHost(ws), vi.fn(), vi.fn())
    animator.updateAnimation(ws, agentBase('b2', { sessionMode: 'idle', needsInteraction: true }))
    expect(resumeSpy).toHaveBeenCalled()
  })

  it('creates fast ledPulseTween for blocked amber LED', () => {
    const { scene, tweensAdd } = makeScene()
    const ws = makeWorkstation('b3')
    const animator = new WorkstationAnimator(scene, makeHost(ws), vi.fn(), vi.fn())
    animator.updateAnimation(ws, agentBase('b3', { sessionMode: 'idle', needsInteraction: true }))
    expect(ws.ledPulseTween).toBeDefined()
    // Blocked LED should be fast (300ms) and repeat -1
    const ledCfg = tweensAdd.mock.calls.find((args) => {
      const cfg = args[0] as Record<string, unknown>
      return cfg.targets === ws.ledGlow && cfg.yoyo === true && cfg.repeat === -1
        && cfg.duration === 300
    })
    expect(ledCfg).toBeDefined()
  })
})

// ---------------------------------------------------------------------------

describe('workstation screen animations — teardown on mode transition', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    resetAnimConfig()
  })
  afterEach(() => vi.restoreAllMocks())

  it('destroys kbPulseTween and resets keyboard scale when transitioning away from working', () => {
    const { scene } = makeScene()
    const ws = makeWorkstation('td1')
    const animator = new WorkstationAnimator(scene, makeHost(ws), vi.fn(), vi.fn())

    // Go working
    animator.updateAnimation(ws, agentBase('td1', { sessionMode: 'working', needsInteraction: false }))
    expect(ws.kbPulseTween).toBeDefined()
    const kbPulseDestroy = ws.kbPulseTween!.destroy as ReturnType<typeof vi.fn>

    // Transition to idle — teardown should fire
    animator.updateAnimation(ws, agentBase('td1', { sessionMode: 'idle', needsInteraction: false }))
    expect(kbPulseDestroy).toHaveBeenCalled()
    expect(ws.kbPulseTween).toBeUndefined()
    // Keyboard scale should be reset to 1
    expect(ws.keyboard!.scaleX).toBe(1)
    expect(ws.keyboard!.scaleY).toBe(1)
  })

  it('destroys screenScrollTween when transitioning away from working', () => {
    const { scene } = makeScene()
    const ws = makeWorkstation('td2')
    const animator = new WorkstationAnimator(scene, makeHost(ws), vi.fn(), vi.fn())

    animator.updateAnimation(ws, agentBase('td2', {
      sessionMode: 'working',
      needsInteraction: false,
      lastAssistantBlurb: 'Some blurb text here',
    }))
    expect(ws.screenScrollTween).toBeDefined()
    const scrollDestroy = ws.screenScrollTween!.destroy as ReturnType<typeof vi.fn>

    animator.updateAnimation(ws, agentBase('td2', { sessionMode: 'idle', needsInteraction: false }))
    expect(scrollDestroy).toHaveBeenCalled()
    expect(ws.screenScrollTween).toBeUndefined()
  })

  it('destroys cursorBlinkTimer when transitioning away from idle', () => {
    const { scene } = makeScene()
    const ws = makeWorkstation('td3')
    const animator = new WorkstationAnimator(scene, makeHost(ws), vi.fn(), vi.fn())

    animator.updateAnimation(ws, agentBase('td3', { sessionMode: 'idle', needsInteraction: false }))
    expect(ws.cursorBlinkTimer).toBeDefined()
    const blinkDestroy = ws.cursorBlinkTimer!.destroy as ReturnType<typeof vi.fn>

    animator.updateAnimation(ws, agentBase('td3', { sessionMode: 'working', needsInteraction: false }))
    expect(blinkDestroy).toHaveBeenCalled()
    expect(ws.cursorBlinkTimer).toBeUndefined()
  })

  it('pauses screenTween and hides screenLines on each mode transition', () => {
    const { scene } = makeScene()
    const ws = makeWorkstation('td4')
    // Start with screenTween not paused
    ws.screenTween = {
      destroy: vi.fn(),
      isPaused: () => false,
      resume: vi.fn(),
      pause: vi.fn(),
    } as unknown as WorkstationSprite['screenTween']
    const pauseSpy = ws.screenTween!.pause as ReturnType<typeof vi.fn>

    const animator = new WorkstationAnimator(scene, makeHost(ws), vi.fn(), vi.fn())
    animator.updateAnimation(ws, agentBase('td4', { sessionMode: 'working', needsInteraction: false }))

    // screenTween.pause should have been called during teardown at the start
    expect(pauseSpy).toHaveBeenCalled()
  })

  it('clears monitorText on mode transition', () => {
    const { scene } = makeScene()
    const ws = makeWorkstation('td5')
    // Manually set monitorText to visible with some text
    const mtSetText = ws.monitorText!.setText as ReturnType<typeof vi.fn>
    const mtSetVisible = ws.monitorText!.setVisible as ReturnType<typeof vi.fn>

    const animator = new WorkstationAnimator(scene, makeHost(ws), vi.fn(), vi.fn())
    // First go to working (text gets set), then idle (teardown clears text)
    animator.updateAnimation(ws, agentBase('td5', {
      sessionMode: 'working',
      needsInteraction: false,
      lastAssistantBlurb: 'doing stuff',
    }))
    // Transition to idle — teardown should hide/clear monitorText before setting cursor
    animator.updateAnimation(ws, agentBase('td5', { sessionMode: 'idle', needsInteraction: false }))
    // setText('') called during teardown, then setText('_') in idle branch
    expect(mtSetText).toHaveBeenCalledWith('')
    expect(mtSetVisible).toHaveBeenCalledWith(false)
  })
})

// ---------------------------------------------------------------------------

describe('pauseAll / resumeAll includes cursorBlinkTimer', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    resetAnimConfig()
  })
  afterEach(() => vi.restoreAllMocks())

  it('pauses cursorBlinkTimer in pauseAll', () => {
    const { scene } = makeScene()
    const ws = makeWorkstation('pa1')
    const animator = new WorkstationAnimator(scene, makeHost(ws), vi.fn(), vi.fn())

    // Enter idle to create cursorBlinkTimer
    animator.updateAnimation(ws, agentBase('pa1', { sessionMode: 'idle', needsInteraction: false }))
    expect(ws.cursorBlinkTimer).toBeDefined()

    animator.pauseAll()
    expect((ws.cursorBlinkTimer as unknown as { paused: boolean }).paused).toBe(true)
  })

  it('resumes cursorBlinkTimer in resumeAll', () => {
    const { scene } = makeScene()
    const ws = makeWorkstation('pa2')
    const animator = new WorkstationAnimator(scene, makeHost(ws), vi.fn(), vi.fn())

    animator.updateAnimation(ws, agentBase('pa2', { sessionMode: 'idle', needsInteraction: false }))
    animator.pauseAll()
    animator.resumeAll()
    expect((ws.cursorBlinkTimer as unknown as { paused: boolean }).paused).toBe(false)
  })
})
