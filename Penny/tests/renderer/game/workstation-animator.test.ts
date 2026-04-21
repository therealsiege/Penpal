/**
 * Vitest unit tests for WorkstationAnimator (issue #63).
 * Focus: animation state machine, mood bubble, monitor glow, idle micro-variety,
 * speech bubble — deterministic mocks, no real wall-clock waits.
 */
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentState } from '../../../src/renderer/src/types'
import { activeTheme } from '../../../src/renderer/src/game/office-theme'
import {
  CHAR_COLS,
  POSE_IDLE,
  POSE_INTERACT,
  POSE_SIT,
  WS_SPRITE_Y,
} from '../../../src/renderer/src/game/office-constants'
import { ICON_FRAMES } from '../../../src/renderer/src/game/office-asset-keys'
import { MOOD_CONFIGS } from '../../../src/renderer/src/game/agent-mood'
import type { WorkstationSprite } from '../../../src/renderer/src/game/office-types'
import type { WorkstationHost } from '../../../src/renderer/src/game/office-workstation'
import { TweenBag } from '../../../src/renderer/src/game/tween-lifecycle'

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
  leaderboardManager: {
    recordXP: vi.fn(),
    recordTaskComplete: vi.fn(),
  },
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

import { WorkstationAnimator } from '../../../src/renderer/src/game/workstation-animation'

function agentBase(id: string): AgentState {
  return {
    config: { id, name: 'Test' },
    xp: { currentStreak: 0, level: 1, rank: 'Intern', totalXP: 0 },
  } as AgentState
}

type TimeEventConfig = { delay: number; loop?: boolean; callback: () => void }

function makeAnimScene(options?: { syncDelayedCall?: boolean }) {
  const timeEvents: TimeEventConfig[] = []
  const tweensChain: Array<{ destroy: ReturnType<typeof vi.fn>; cfg: Record<string, unknown> }> = []

  const runTween = (cfg: Record<string, unknown>) => {
    const targets = cfg.targets as Record<string, unknown> | undefined
    if (targets && typeof cfg.alpha === 'number') (targets as { alpha: number }).alpha = cfg.alpha as number
    if (targets && typeof cfg.outerStrength === 'number') {
      ;(targets as { outerStrength: number }).outerStrength = cfg.outerStrength as number
    }
    if (targets && 'val' in targets && typeof cfg.val === 'number') {
      ;(targets as { val: number }).val = cfg.val as number
      ;(cfg.onUpdate as (() => void) | undefined)?.()
    }
    if (cfg.from !== undefined && cfg.to !== undefined && cfg.onUpdate) {
      const tw = { getValue: () => Number(cfg.to) }
      ;(cfg.onUpdate as (t: { getValue: () => number }) => void)(tw)
    }
    const onComplete = cfg.onComplete as (() => void) | undefined
    onComplete?.()
  }

  const tweensAdd = vi.fn((cfg: Record<string, unknown>) => {
    const tw = { destroy: vi.fn(), isPlaying: () => false, stop: vi.fn(), getValue: () => 100 }
    tweensChain.push({ destroy: tw.destroy, cfg })
    runTween(cfg)
    return tw
  })

  const delayedCall = options?.syncDelayedCall
    ? vi.fn((_delay: number, cb: () => void) => {
        cb()
        return { remove: vi.fn() }
      })
    : vi.fn((delay: number, cb: () => void) => {
        const handle = { remove: vi.fn() }
        setTimeout(cb, delay)
        return handle
      })

  const scene = {
    scene: { isActive: vi.fn(() => true) },
    cameras: { main: { zoom: 0.8 } },
    tweens: { add: tweensAdd, killTweensOf: vi.fn() },
    time: {
      addEvent: vi.fn((ev: TimeEventConfig) => {
        timeEvents.push(ev)
        return { destroy: vi.fn(), ...ev }
      }),
      delayedCall,
    },
    anims: { exists: vi.fn(() => false) },
    add: {
      graphics: vi.fn(() =>
        Object.assign(
          {
            clear: vi.fn().mockReturnThis(),
            fillStyle: vi.fn().mockReturnThis(),
            fillRoundedRect: vi.fn().mockReturnThis(),
            lineStyle: vi.fn().mockReturnThis(),
            strokeRoundedRect: vi.fn().mockReturnThis(),
            beginPath: vi.fn().mockReturnThis(),
            strokePath: vi.fn().mockReturnThis(),
            arc: vi.fn().mockReturnThis(),
            fillTriangle: vi.fn().mockReturnThis(),
            setAlpha: vi.fn().mockReturnThis(),
            setVisible: vi.fn().mockReturnThis(),
            x: 0,
            y: 0,
            width: 10,
            height: 8,
          },
          { active: true },
        ),
      ),
      text: vi.fn((_x: number, _y: number, _t: string, _style?: unknown) => {
        const o = {
          active: true,
          text: '',
          width: 4,
          height: 8,
          setOrigin: vi.fn().mockReturnThis(),
          setText: vi.fn(function (this: { text: string }, s: string) {
            this.text = s
            return this
          }),
        }
        return o
      }),
      container: vi.fn((_x: number, _y: number, _ch?: unknown[]) => {
        const c = {
          active: true,
          x: 0,
          y: 0,
          alpha: 0,
          visible: false,
          list: [] as unknown[],
          add: vi.fn(),
          remove: vi.fn(),
          setAlpha: vi.fn(function (this: { alpha: number }, a: number) {
            this.alpha = a
            return this
          }),
          setVisible: vi.fn(function (this: { visible: boolean }, v: boolean) {
            this.visible = v
            return this
          }),
          setPosition: vi.fn().mockReturnThis(),
        }
        return c
      }),
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
      circle: vi.fn(() => ({
        active: true,
        x: 0,
        y: 0,
        alpha: 1,
        setAlpha: vi.fn().mockReturnThis(),
        destroy: vi.fn(),
      })),
      ellipse: vi.fn(() => ({ setDepth: vi.fn().mockReturnThis(), destroy: vi.fn() })),
    },
  } as unknown as Phaser.Scene

  return { scene, tweensAdd, tweensChain, timeEvents, delayedCall }
}

function makeMinimalHost(ws: WorkstationSprite, extras?: Partial<WorkstationHost>): WorkstationHost {
  const room = {
    x: 100,
    y: 200,
    width: 400,
    height: 300,
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

function makeTweenBagMock(): WorkstationSprite['tweenBag'] {
  type Entry = { handle: { destroy?: () => void }; reset?: () => void }
  const entries = new Map<string, Entry>()
  const destroyEntry = (entry: Entry | undefined) => {
    if (!entry) return
    entry.handle.destroy?.()
    entry.reset?.()
  }

  return {
    add: (key, tween, reset) => {
      destroyEntry(entries.get(key))
      entries.set(key, { handle: tween as { destroy?: () => void }, reset })
    },
    addTimer: (key, timer, reset) => {
      destroyEntry(entries.get(key))
      entries.set(key, { handle: timer as { destroy?: () => void }, reset })
    },
    remove: (key) => {
      const entry = entries.get(key)
      destroyEntry(entry)
      entries.delete(key)
    },
    clearAll: () => {
      for (const entry of entries.values()) destroyEntry(entry)
      entries.clear()
    },
    has: (key) => entries.has(key),
    get: (key) => entries.get(key)?.handle as Phaser.Tweens.Tween | undefined,
    setTimerPaused: (key, paused) => {
      const entry = entries.get(key)
      if (!entry) return
      const handle = entry.handle as { paused?: boolean }
      if ('paused' in handle) handle.paused = paused
    },
  } as WorkstationSprite['tweenBag']
}

function makeWorkstation(agentId: string, overrides?: Partial<WorkstationSprite>): WorkstationSprite {
  const data = new Map<string, unknown>()
  const sprite = {
    x: 0,
    y: WS_SPRITE_Y,
    visible: true,
    alpha: 1,
    setFrame: vi.fn(),
    setScale: vi.fn(),
    setAngle: vi.fn(),
    setAlpha: vi.fn(function (this: { alpha: number }, alpha: number) {
      this.alpha = alpha
      return this
    }),
    setData: vi.fn((k: string, v: unknown) => {
      data.set(k, v)
    }),
    getData: vi.fn((k: string) => data.get(k)),
    setVisible: vi.fn(),
  }
  const monitorGlowFx = { color: 0, outerStrength: 0 }
  const statusDot = { setAlpha: vi.fn() }
  const deskBody = { setStrokeStyle: vi.fn() }
  const container = {
    x: 0,
    y: 0,
    alpha: 1,
    visible: true,
    active: true,
    add: vi.fn(),
    setVisible: vi.fn(),
    setAlpha: vi.fn(),
  }
  const base: WorkstationSprite = {
    tweenBag: new TweenBag(),
    state: { config: { id: agentId, name: 'T' } } as AgentState,
    sprite: sprite as unknown as WorkstationSprite['sprite'],
    statusDot: statusDot as unknown as WorkstationSprite['statusDot'],
    deskBody: deskBody as unknown as WorkstationSprite['deskBody'],
    container: container as unknown as WorkstationSprite['container'],
    monitorGlowFx: monitorGlowFx as unknown as WorkstationSprite['monitorGlowFx'],
    thoughtBubble: {} as WorkstationSprite['thoughtBubble'],
    thoughtBubbleText: {} as WorkstationSprite['thoughtBubbleText'],
    thoughtBubbleBg: {} as WorkstationSprite['thoughtBubbleBg'],
    blockedIndicator: {
      setVisible: vi.fn(),
      setAlpha: vi.fn(),
      setScale: vi.fn(),
    } as unknown as WorkstationSprite['blockedIndicator'],
    blockedIndicatorPulse: { setFillStyle: vi.fn() } as unknown as WorkstationSprite['blockedIndicatorPulse'],
    blockedIndicatorBadge: { setFrame: vi.fn() } as unknown as WorkstationSprite['blockedIndicatorBadge'],
    blockedIndicatorStem: { setFillStyle: vi.fn() } as unknown as WorkstationSprite['blockedIndicatorStem'],
    blockedIndicatorText: { setText: vi.fn() } as unknown as WorkstationSprite['blockedIndicatorText'],
    tweenBag: makeTweenBagMock(),
    lodLevel2Objects: [],
    lodLevel3Objects: [],
    localTaskCount: 0,
    energyLevel: 1,
    progressRing: undefined,
    soundWaveGfx: undefined,
    keyboard: undefined,
    questIcon: undefined,
    chairSprite: null,
    ...overrides,
  }
  return base
}

describe('WorkstationAnimator — animation state machine', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('idle → working sets interact pose (base + POSE_INTERACT)', () => {
    const { scene } = makeAnimScene()
    const ws = makeWorkstation('a1')
    const host = makeMinimalHost(ws)
    const animator = new WorkstationAnimator(scene, host, vi.fn(), vi.fn())
    const agent = { ...agentBase('a1'), sessionMode: 'working' as const, needsInteraction: false }

    animator.updateAnimation(ws, agent)

    expect(ws.lastAnimMode).toBe('working')
    expect(ws.sprite.setFrame).toHaveBeenCalledWith(0 * CHAR_COLS + POSE_INTERACT)
  })

  it('idle → plan uses working branch and interact pose', () => {
    const { scene } = makeAnimScene()
    const ws = makeWorkstation('a2')
    const animator = new WorkstationAnimator(scene, makeMinimalHost(ws), vi.fn(), vi.fn())
    animator.updateAnimation(ws, { ...agentBase('a2'), sessionMode: 'plan', needsInteraction: false })
    expect(ws.sprite.setFrame).toHaveBeenCalledWith(0 * CHAR_COLS + POSE_INTERACT)
  })

  it('working → idle sets sit pose, confetti, refreshTaskCount', () => {
    const { scene } = makeAnimScene()
    const ws = makeWorkstation('a3')
    const host = makeMinimalHost(ws)
    const refresh = vi.fn()
    const animator = new WorkstationAnimator(scene, host, vi.fn(), refresh)

    animator.updateAnimation(ws, { ...agentBase('a3'), sessionMode: 'working', needsInteraction: false })
    expect(ws.lastAnimMode).toBe('working')

    animator.updateAnimation(ws, { ...agentBase('a3'), sessionMode: 'idle', needsInteraction: false })

    expect(ws.lastAnimMode).toBe('idle')
    expect(ws.sprite.setFrame).toHaveBeenLastCalledWith(0 * CHAR_COLS + POSE_SIT)
    expect(host.burstConfetti).toHaveBeenCalled()
    expect(refresh).toHaveBeenCalledWith(ws)
    expect(ws.localTaskCount).toBe(1)
  })

  it('waiting uses idle pose and registers pulse, sway, and dot tweens', () => {
    const { scene, tweensAdd } = makeAnimScene()
    const ws = makeWorkstation('a4')
    const animator = new WorkstationAnimator(scene, makeMinimalHost(ws), vi.fn(), vi.fn())
    animator.updateAnimation(ws, {
      ...agentBase('a4'),
      sessionMode: 'working',
      needsInteraction: true,
    })
    expect(ws.lastAnimMode).toBe('waiting')
    expect(ws.sprite.setFrame).toHaveBeenCalledWith(0 * CHAR_COLS + POSE_IDLE)
    const repeatCalls = tweensAdd.mock.calls.filter((c) => (c[0] as { repeat?: number }).repeat === -1)
    expect(repeatCalls.length).toBeGreaterThanOrEqual(3)
  })

  it('does not re-enter animation when mode unchanged (early return)', () => {
    const { scene, tweensAdd } = makeAnimScene()
    const ws = makeWorkstation('a5')
    const animator = new WorkstationAnimator(scene, makeMinimalHost(ws), vi.fn(), vi.fn())
    const agent = { ...agentBase('a5'), sessionMode: 'idle' as const, needsInteraction: false }
    animator.updateAnimation(ws, agent)
    const n = tweensAdd.mock.calls.length
    animator.updateAnimation(ws, agent)
    expect(tweensAdd.mock.calls.length).toBe(n)
  })

  it('needsInteraction wins over sessionMode working (waiting)', () => {
    const { scene } = makeAnimScene()
    const ws = makeWorkstation('a6')
    const animator = new WorkstationAnimator(scene, makeMinimalHost(ws), vi.fn(), vi.fn())
    animator.updateAnimation(ws, {
      ...agentBase('a6'),
      sessionMode: 'working',
      needsInteraction: true,
    })
    expect(ws.lastAnimMode).toBe('waiting')
    expect(ws.sprite.setFrame).toHaveBeenCalledWith(0 * CHAR_COLS + POSE_IDLE)
  })

  it('working → waiting clears working tweens before setting waiting tweens', () => {
    const { scene } = makeAnimScene()
    const ws = makeWorkstation('a7')
    const animator = new WorkstationAnimator(scene, makeMinimalHost(ws), vi.fn(), vi.fn())

    // Enter working state
    animator.updateAnimation(ws, {
      ...agentBase('a7'),
      sessionMode: 'working',
      needsInteraction: false,
    })
    expect(ws.lastAnimMode).toBe('working')

    // Transition to waiting — previous tweens should be cleaned up
    animator.updateAnimation(ws, {
      ...agentBase('a7'),
      sessionMode: 'working',
      needsInteraction: true,
    })
    expect(ws.lastAnimMode).toBe('waiting')
  })
})

describe('WorkstationAnimator — monitor glow', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('working sets cyan monitor color', () => {
    const { scene } = makeAnimScene()
    const ws = makeWorkstation('g1')
    const animator = new WorkstationAnimator(scene, makeMinimalHost(ws), vi.fn(), vi.fn())
    animator.updateMonitorGlow(ws, true, false)
    expect(ws.monitorGlowFx!.color).toBe(activeTheme.monitorGlowActive)
  })

  it('waiting sets yellow glow', () => {
    const { scene } = makeAnimScene()
    const ws = makeWorkstation('g2')
    const animator = new WorkstationAnimator(scene, makeMinimalHost(ws), vi.fn(), vi.fn())
    animator.updateMonitorGlow(ws, false, true)
    expect(ws.monitorGlowFx!.color).toBe(0xfbbf24)
  })

  it('orchestrator stages map to planning / executing / validating colors', () => {
    const { scene } = makeAnimScene()
    const animator = new WorkstationAnimator(scene, makeMinimalHost(makeWorkstation('_')), vi.fn(), vi.fn())
    const stages: Array<{ stage: 'planning' | 'executing' | 'validating'; color: number }> = [
      { stage: 'planning', color: 0xa78bfa },
      { stage: 'executing', color: 0xf97316 },
      { stage: 'validating', color: 0x06b6d4 },
    ]
    for (const { stage, color } of stages) {
      const ws = makeWorkstation(`g-${stage}`)
      ws.state = {
        ...agentBase(ws.state!.config.id),
        isOrchestratorTask: true,
        taskStage: stage,
      } as AgentState
      animator.updateMonitorGlow(ws, true, false)
      expect(ws.monitorGlowFx!.color).toBe(color)
    }
  })

  it('unknown orchestrator stage falls back to orange', () => {
    const { scene } = makeAnimScene()
    const ws = makeWorkstation('g-unknown')
    ws.state = {
      ...agentBase('g-unknown'),
      isOrchestratorTask: true,
      taskStage: 'weird' as 'executing',
    } as AgentState
    const animator = new WorkstationAnimator(scene, makeMinimalHost(ws), vi.fn(), vi.fn())
    animator.updateMonitorGlow(ws, true, false)
    expect(ws.monitorGlowFx!.color).toBe(0xf97316)
  })

  it('idle non-orch uses activeTheme.deskBody', () => {
    const { scene } = makeAnimScene()
    const ws = makeWorkstation('g-idle')
    ws.state = { ...agentBase('g-idle'), isOrchestratorTask: false } as AgentState
    const animator = new WorkstationAnimator(scene, makeMinimalHost(ws), vi.fn(), vi.fn())
    animator.updateMonitorGlow(ws, false, false)
    expect(ws.monitorGlowFx!.color).toBe(activeTheme.deskBody)
  })

  it('no monitorGlowFx returns early without throwing', () => {
    const { scene } = makeAnimScene()
    const ws = makeWorkstation('g-none', { monitorGlowFx: undefined as unknown as WorkstationSprite['monitorGlowFx'] })
    const animator = new WorkstationAnimator(scene, makeMinimalHost(ws), vi.fn(), vi.fn())
    expect(() => animator.updateMonitorGlow(ws, true, false)).not.toThrow()
  })

  it('destroys previous monitor glow tween on transition', () => {
    const { scene, tweensChain } = makeAnimScene()
    const ws = makeWorkstation('g-tw')
    const animator = new WorkstationAnimator(scene, makeMinimalHost(ws), vi.fn(), vi.fn())
    animator.updateMonitorGlow(ws, true, false)
    const firstDestroy = tweensChain[tweensChain.length - 1]?.destroy
    expect(firstDestroy).toBeDefined()
    animator.updateAnimation(ws, { ...agentBase('g-tw'), sessionMode: 'idle', needsInteraction: false })
    expect(firstDestroy!.mock.calls.length).toBeGreaterThanOrEqual(1)
  })
})

describe('WorkstationAnimator — mood', () => {
  const { scene } = makeAnimScene()
  const animator = new WorkstationAnimator(scene, makeMinimalHost(makeWorkstation('m0')), vi.fn(), vi.fn())

  it.each([
    ['tool-approval + interaction', { needsInteraction: true, interactionType: 'tool-approval' as const }, '😤'],
    ['question + interaction', { needsInteraction: true, interactionType: 'question' as const }, '🤔'],
    ['working', { sessionMode: 'working' as const }, '💻'],
    ['plan', { sessionMode: 'plan' as const }, '🧠'],
    ['compressing', { sessionMode: 'compressing' as const }, '😵'],
    ['default idle', { sessionMode: 'idle' as const }, '☕'],
  ])('getAgentMood: %s', (_label, partial, emoji) => {
    const agent = { ...agentBase('mx'), ...partial } as AgentState
    expect(animator.getAgentMood(agent).emoji).toBe(emoji)
  })

  it('updateMood skips tweens when emoji unchanged', () => {
    const { scene: s, tweensAdd } = makeAnimScene()
    const anim = new WorkstationAnimator(s, makeMinimalHost(makeWorkstation('m1')), vi.fn(), vi.fn())
    const moodEmoji = {
      active: true,
      getData: vi.fn(() => '☕'),
      setData: vi.fn(),
      setText: vi.fn(),
      y: 10,
    }
    const ws = makeWorkstation('m1', { moodEmoji: moodEmoji as unknown as WorkstationSprite['moodEmoji'] })
    anim.updateMood(ws, { ...agentBase('m1'), sessionMode: 'idle' } as AgentState)
    expect(tweensAdd).not.toHaveBeenCalled()
  })

  it('updateMood runs fade chain when emoji changes', () => {
    const { scene: s, tweensAdd } = makeAnimScene()
    const anim = new WorkstationAnimator(s, makeMinimalHost(makeWorkstation('m2')), vi.fn(), vi.fn())
    const moodEmoji = {
      active: true,
      getData: vi.fn(() => '☕'),
      setData: vi.fn(),
      setText: vi.fn(),
      setScale: vi.fn().mockReturnThis(),
      y: 10,
    }
    const ws = makeWorkstation('m2', { moodEmoji: moodEmoji as unknown as WorkstationSprite['moodEmoji'] })
    anim.updateMood(ws, { ...agentBase('m2'), sessionMode: 'working' } as AgentState)
    expect(tweensAdd).toHaveBeenCalled()
    expect(moodEmoji.setText).toHaveBeenCalledWith('💻')
  })

  it('updateMood returns early without throwing when moodEmoji is undefined', () => {
    const { scene: s, tweensAdd } = makeAnimScene()
    const anim = new WorkstationAnimator(s, makeMinimalHost(makeWorkstation('m4')), vi.fn(), vi.fn())
    const ws = makeWorkstation('m4', { moodEmoji: undefined as unknown as WorkstationSprite['moodEmoji'] })
    expect(() => anim.updateMood(ws, { ...agentBase('m4'), sessionMode: 'working' } as AgentState)).not.toThrow()
    expect(tweensAdd).not.toHaveBeenCalled()
  })

  it('updateMood sets mood badge frame from MOOD_CONFIGS for working (focused)', () => {
    const { scene: s } = makeAnimScene()
    const anim = new WorkstationAnimator(s, makeMinimalHost(makeWorkstation('m3')), vi.fn(), vi.fn())
    const moodEmoji = {
      active: true,
      getData: vi.fn(() => '☕'),
      setData: vi.fn(),
      setText: vi.fn(),
      setScale: vi.fn().mockReturnThis(),
      y: 10,
    }
    const moodBadge = {
      active: true,
      getData: vi.fn(() => -1),
      setData: vi.fn(),
      setFrame: vi.fn(),
      setVisible: vi.fn(),
      setScale: vi.fn(),
      y: 8,
    }
    moodBadge.setFrame.mockImplementation(() => moodBadge)
    moodBadge.setVisible.mockImplementation(() => moodBadge)
    moodBadge.setScale.mockImplementation(() => moodBadge)
    const ws = makeWorkstation('m3', {
      moodEmoji: moodEmoji as unknown as WorkstationSprite['moodEmoji'],
      moodBadge: moodBadge as unknown as WorkstationSprite['moodBadge'],
    })
    anim.updateMood(ws, { ...agentBase('m3'), sessionMode: 'working' } as AgentState)
    expect(moodBadge.setFrame).toHaveBeenCalledWith(MOOD_CONFIGS.focused.spriteFrame)
  })
})

describe('WorkstationAnimator — blocked indicator', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  function wsBlocked(agentId: string) {
    return makeWorkstation(agentId)
  }

  it('hides blocked UI when not needsInteraction', () => {
    const { scene } = makeAnimScene()
    const ws = wsBlocked('b1')
    const animator = new WorkstationAnimator(scene, makeMinimalHost(ws), vi.fn(), vi.fn())
    animator.updateBlockedIndicator(ws, { ...agentBase('b1'), needsInteraction: false })
    expect(ws.blockedIndicator.setVisible).toHaveBeenCalledWith(false)
  })

  it('tool-approval uses red badge frame', () => {
    const { scene } = makeAnimScene()
    const ws = wsBlocked('b2')
    const animator = new WorkstationAnimator(scene, makeMinimalHost(ws), vi.fn(), vi.fn())
    animator.updateBlockedIndicator(ws, {
      ...agentBase('b2'),
      needsInteraction: true,
      interactionType: 'tool-approval',
    })
    expect(ws.blockedIndicatorBadge.setFrame).toHaveBeenCalledWith(ICON_FRAMES.CIRCLE_RED)
    expect(ws.blockedIndicatorText.setText).toHaveBeenCalledWith('!')
  })

  it('question uses blue badge and ? glyph', () => {
    const { scene } = makeAnimScene()
    const ws = wsBlocked('b3')
    const animator = new WorkstationAnimator(scene, makeMinimalHost(ws), vi.fn(), vi.fn())
    animator.updateBlockedIndicator(ws, {
      ...agentBase('b3'),
      needsInteraction: true,
      interactionType: 'question',
    })
    expect(ws.blockedIndicatorBadge.setFrame).toHaveBeenCalledWith(ICON_FRAMES.CIRCLE_BLUE)
    expect(ws.blockedIndicatorText.setText).toHaveBeenCalledWith('?')
  })

  it('accept-edits uses blue badge and ~ glyph', () => {
    const { scene } = makeAnimScene()
    const ws = wsBlocked('b4')
    const animator = new WorkstationAnimator(scene, makeMinimalHost(ws), vi.fn(), vi.fn())
    animator.updateBlockedIndicator(ws, {
      ...agentBase('b4'),
      needsInteraction: true,
      interactionType: 'accept-edits',
    })
    expect(ws.blockedIndicatorBadge.setFrame).toHaveBeenCalledWith(ICON_FRAMES.CIRCLE_BLUE)
    expect(ws.blockedIndicatorText.setText).toHaveBeenCalledWith('~')
  })

  it('destroys existing blockedIndicatorTween before creating new one', () => {
    const { scene } = makeAnimScene()
    const ws = wsBlocked('b5')
    const oldTween = { destroy: vi.fn() }
    ws.blockedIndicatorTween = oldTween as unknown as WorkstationSprite['blockedIndicatorTween']
    const animator = new WorkstationAnimator(scene, makeMinimalHost(ws), vi.fn(), vi.fn())
    animator.updateBlockedIndicator(ws, {
      ...agentBase('b5'),
      needsInteraction: true,
      interactionType: 'tool-approval',
    })
    expect(oldTween.destroy).toHaveBeenCalled()
  })
})

describe('WorkstationAnimator — idle micro-variety', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  function findTimerByDelay(timeEvents: TimeEventConfig[], delay: number) {
    const ev = timeEvents.find((e) => e.delay === delay)
    expect(ev).toBeDefined()
    return ev!.callback
  }

  it('pet glance runs head tilt and deskPet bounce tweens', () => {
    const { scene, tweensAdd, timeEvents } = makeAnimScene()
    const deskPet = {
      visible: true,
      active: true,
      x: 5,
      y: 10,
    }
    const ws = makeWorkstation('p1', { deskPet: deskPet as unknown as WorkstationSprite['deskPet'] })
    const animator = new WorkstationAnimator(scene, makeMinimalHost(ws), vi.fn(), vi.fn())
    animator.updateAnimation(ws, { ...agentBase('p1'), sessionMode: 'idle', needsInteraction: false })
    const cb = findTimerByDelay(timeEvents, 15000)
    cb()
    const petTweens = tweensAdd.mock.calls.filter((c) => (c[0] as { targets?: unknown }).targets === deskPet)
    expect(petTweens.length).toBeGreaterThanOrEqual(1)
  })

  it('signature item tap runs angle tween on visible item', () => {
    const { scene, tweensAdd, timeEvents } = makeAnimScene()
    const signatureItem = { visible: true, active: true, x: 0, y: 0 }
    const ws = makeWorkstation('p2', {
      signatureItem: signatureItem as unknown as WorkstationSprite['signatureItem'],
    })
    const animator = new WorkstationAnimator(scene, makeMinimalHost(ws), vi.fn(), vi.fn())
    animator.updateAnimation(ws, { ...agentBase('p2'), sessionMode: 'idle', needsInteraction: false })
    findTimerByDelay(timeEvents, 25000)()
    const itemTweens = tweensAdd.mock.calls.filter((c) => (c[0] as { targets?: unknown }).targets === signatureItem)
    expect(itemTweens.length).toBeGreaterThanOrEqual(1)
  })

  it('low energy triggers head tilt tween', () => {
    const { scene, tweensAdd, timeEvents } = makeAnimScene()
    const ws = makeWorkstation('p3', { energyLevel: 0.2 })
    const animator = new WorkstationAnimator(scene, makeMinimalHost(ws), vi.fn(), vi.fn())
    animator.updateAnimation(ws, { ...agentBase('p3'), sessionMode: 'idle', needsInteraction: false })
    findTimerByDelay(timeEvents, 18000)()
    expect(tweensAdd.mock.calls.some((c) => (c[0] as { targets?: unknown }).targets === ws.sprite)).toBe(true)
  })

  it('energy above 30% skips energy glance tween', () => {
    const { scene, tweensAdd, timeEvents } = makeAnimScene()
    const ws = makeWorkstation('p4', { energyLevel: 0.5 })
    const animator = new WorkstationAnimator(scene, makeMinimalHost(ws), vi.fn(), vi.fn())
    animator.updateAnimation(ws, { ...agentBase('p4'), sessionMode: 'idle', needsInteraction: false })
    const n = tweensAdd.mock.calls.length
    findTimerByDelay(timeEvents, 18000)()
    expect(tweensAdd.mock.calls.length).toBe(n)
  })

  it('pet glance no-ops when walkBreakTween is set', () => {
    const { scene, tweensAdd, timeEvents } = makeAnimScene()
    const deskPet = { visible: true, active: true, x: 5, y: 10 }
    const ws = makeWorkstation('p5', {
      deskPet: deskPet as unknown as WorkstationSprite['deskPet'],
    })
    const animator = new WorkstationAnimator(scene, makeMinimalHost(ws), vi.fn(), vi.fn())
    animator.updateAnimation(ws, { ...agentBase('p5'), sessionMode: 'idle', needsInteraction: false })
    ws.tweenBag.add('walkBreak', { destroy: vi.fn() } as unknown as Phaser.Tweens.Tween)
    const n = tweensAdd.mock.calls.length
    findTimerByDelay(timeEvents, 15000)()
    expect(tweensAdd.mock.calls.length).toBe(n)
  })
})

describe('WorkstationAnimator — speech bubble', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(0)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('orchestrator with taskTitle shows [Task] prefix in bubble text path', () => {
    const { scene } = makeAnimScene()
    const ws = makeWorkstation('s1')
    ws.state = {
      ...agentBase('s1'),
      isOrchestratorTask: true,
      taskTitle: 'My Task',
    } as AgentState
    const animator = new WorkstationAnimator(scene, makeMinimalHost(ws), vi.fn(), vi.fn())
    animator.updateAnimation(ws, {
      ...agentBase('s1'),
      sessionMode: 'working',
      needsInteraction: false,
      isOrchestratorTask: true,
      taskTitle: 'My Task',
    } as AgentState)
    expect(ws.speechBubbleText?.setText).toHaveBeenCalled()
    const calls = (ws.speechBubbleText!.setText as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0] as string)
    expect(calls.some((t) => t.includes('[Task]') && t.includes('My Task'))).toBe(true)
  })

  it('orchestrator without taskTitle does not create speech timer', () => {
    const { scene, timeEvents } = makeAnimScene()
    const ws = makeWorkstation('s2')
    ws.state = { ...agentBase('s2'), isOrchestratorTask: true, taskTitle: '' } as AgentState
    const animator = new WorkstationAnimator(scene, makeMinimalHost(ws), vi.fn(), vi.fn())
    animator.updateAnimation(ws, {
      ...agentBase('s2'),
      sessionMode: 'working',
      needsInteraction: false,
      isOrchestratorTask: true,
      taskTitle: '',
    } as AgentState)
    expect(ws.speechBubble).toBeUndefined()
    expect(timeEvents.filter((e) => e.delay === 8000 && e.loop)).toHaveLength(0)
  })

  it('truncates non-orchestrator blurb longer than 40 characters', () => {
    const { scene } = makeAnimScene()
    const long = 'a'.repeat(45)
    const ws = makeWorkstation('s3')
    ws.state = { ...agentBase('s3'), lastAssistantBlurb: long } as AgentState
    const animator = new WorkstationAnimator(scene, makeMinimalHost(ws), vi.fn(), vi.fn())
    animator.updateAnimation(ws, {
      ...agentBase('s3'),
      sessionMode: 'working',
      needsInteraction: false,
      lastAssistantBlurb: long,
    } as AgentState)
    expect(ws.speechBubbleText?.setText).toHaveBeenCalled()
    const calls = (ws.speechBubbleText!.setText as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0] as string)
    expect(calls.some((t) => t.endsWith('...') && t.length <= 44)).toBe(true)
  })

  it('typewriter completes then hold delayedCall fades bubble', () => {
    const { scene } = makeAnimScene()
    const ws = makeWorkstation('s4')
    const agent = {
      ...agentBase('s4'),
      sessionMode: 'working' as const,
      needsInteraction: false,
      lastAssistantBlurb: 'Hi',
    } as AgentState
    ws.state = agent as AgentState
    const animator = new WorkstationAnimator(scene, makeMinimalHost(ws), vi.fn(), vi.fn())
    animator.updateAnimation(ws, agent)
    vi.advanceTimersByTime(5000)
    expect(ws.speechBubble?.setVisible).toHaveBeenCalledWith(false)
  })

  it('speech repeat timer does nothing when lastAnimMode is not working', () => {
    const { scene, timeEvents } = makeAnimScene()
    const ws = makeWorkstation('s5')
    const agent = {
      ...agentBase('s5'),
      sessionMode: 'working' as const,
      needsInteraction: false,
      lastAssistantBlurb: 'x',
    } as AgentState
    ws.state = agent as AgentState
    const animator = new WorkstationAnimator(scene, makeMinimalHost(ws), vi.fn(), vi.fn())
    animator.updateAnimation(ws, agent)
    const speechEv = timeEvents.filter((e) => e.delay === 8000 && e.loop)
    expect(speechEv.length).toBeGreaterThanOrEqual(1)
    ws.lastAnimMode = 'idle'
    const setText = ws.speechBubbleText!.setText as ReturnType<typeof vi.fn>
    setText.mockClear()
    speechEv[speechEv.length - 1]!.callback()
    expect(setText).not.toHaveBeenCalled()
  })

  it('speech repeat timer re-runs typewriter when still working and blurb on ws.state', () => {
    const { scene, timeEvents } = makeAnimScene()
    const ws = makeWorkstation('s6')
    const agent = {
      ...agentBase('s6'),
      sessionMode: 'working' as const,
      needsInteraction: false,
      lastAssistantBlurb: 'hello',
    } as AgentState
    ws.state = { ...agent, lastAssistantBlurb: 'updated' } as AgentState
    const animator = new WorkstationAnimator(scene, makeMinimalHost(ws), vi.fn(), vi.fn())
    animator.updateAnimation(ws, agent)
    const speechEv = timeEvents.filter((e) => e.delay === 8000 && e.loop)
    const setText = ws.speechBubbleText!.setText as ReturnType<typeof vi.fn>
    setText.mockClear()
    speechEv[speechEv.length - 1]!.callback()
    expect(setText).toHaveBeenCalled()
  })

  it('leaving working tears down speech bubble tweens and visibility', () => {
    const { scene, tweensChain } = makeAnimScene()
    const ws = makeWorkstation('s7')
    const agent = {
      ...agentBase('s7'),
      sessionMode: 'working' as const,
      needsInteraction: false,
      lastAssistantBlurb: 'bye',
    } as AgentState
    ws.state = agent as AgentState
    const animator = new WorkstationAnimator(scene, makeMinimalHost(ws), vi.fn(), vi.fn())
    animator.updateAnimation(ws, agent)
    expect(ws.speechBubble).toBeDefined()
    const bubbleTween = ws.tweenBag.get('speechBubble')
    animator.updateAnimation(ws, { ...agentBase('s7'), sessionMode: 'idle', needsInteraction: false })
    expect(bubbleTween?.destroy).toHaveBeenCalled()
    expect(ws.tweenBag.has('speechBubbleTimer')).toBe(false)
    expect(ws.speechBubble?.setVisible).toHaveBeenCalledWith(false)
  })
})
