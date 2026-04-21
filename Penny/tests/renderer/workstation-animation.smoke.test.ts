// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentState } from '../../src/renderer/src/types'

vi.mock('phaser', () => ({
  default: { Math: {}, GameObjects: {} },
  Math: {},
  GameObjects: {},
}))

import { WorkstationAnimator } from '../../src/renderer/src/game/workstation-animation'
import type { WorkstationSprite } from '../../src/renderer/src/game/office-types'
import { TweenBag } from '../../src/renderer/src/game/tween-lifecycle'
import { OfficeUI } from '../../src/renderer/src/game/office-ui'
import {
  EVAL_GLOW_AMBER,
  EVAL_GLOW_GREEN,
  EVAL_GLOW_GREY,
  EVAL_GLOW_RED,
} from '../../src/renderer/src/game/office-constants'

type FakeTweenConfig = {
  targets?: unknown
  alpha?: number
  onComplete?: () => void
}

function makeFakeScene(options?: { smokeAnim?: boolean }) {
  const addEvent = vi.fn(() => ({ destroy: vi.fn(), callback: undefined as (() => void) | undefined }))
  return {
    tweens: {
      add: (config: FakeTweenConfig) => {
        const target = config.targets as { alpha?: number } | undefined
        if (target && typeof config.alpha === 'number') target.alpha = config.alpha
        config.onComplete?.()
        return { destroy: vi.fn(), isPlaying: () => false, stop: vi.fn() }
      },
      killTweensOf: vi.fn(),
    },
    time: { addEvent: addEvent },
    anims: { exists: vi.fn((key: string) => key === 'effect-smoke' && options?.smokeAnim === true) },
    add: {
      sprite: vi.fn(() => {
        const spr = {
          play: vi.fn().mockReturnThis(),
          once: vi.fn((_ev: string, fn: () => void) => {
            fn()
            return spr
          }),
          setDepth: vi.fn().mockReturnThis(),
          setScale: vi.fn().mockReturnThis(),
          setAlpha: vi.fn().mockReturnThis(),
          destroy: vi.fn(),
        }
        return spr
      }),
    },
  } as unknown as Phaser.Scene & { time: { addEvent: ReturnType<typeof vi.fn> } }
}

function makeWorkstationStub(agentId: string, withFlame = false): WorkstationSprite {
  const evalGlow = {
    active: true,
    visible: true,
    alpha: 0.15,
    fillColor: EVAL_GLOW_GREY,
    setFillStyle(color: number) {
      this.fillColor = color
      return this
    },
    setVisible(v: boolean) {
      this.visible = v
      return this
    },
    setAlpha(a: number) {
      this.alpha = a
      return this
    },
  }

  const flameContainer = withFlame
    ? {
        visible: false,
        setVisible(v: boolean) {
          this.visible = v
          return this
        },
        removeAll: vi.fn(),
      }
    : undefined

  const base: Record<string, unknown> = {
    tweenBag: new TweenBag(),
    evalGlow: evalGlow as unknown as Phaser.GameObjects.Arc,
    state: { config: { id: agentId } } as WorkstationSprite['state'],
    lodLevel2Objects: [evalGlow as unknown as Phaser.GameObjects.GameObject],
    lodLevel3Objects: [],
    flameContainer: flameContainer as unknown as Phaser.GameObjects.Container | undefined,
    container: {
      alpha: 1,
      visible: true,
      active: true,
      add: vi.fn(),
      setVisible(v: boolean) {
        this.visible = v
        return this
      },
      setAlpha(a: number) {
        this.alpha = a
        return this
      },
    } as unknown as Phaser.GameObjects.Container,
  }
  if (withFlame) base.currentLodLevel = 3
  return base as WorkstationSprite
}

describe('workstation eval glow behavior', () => {
  it('maps success-rate thresholds and missing data to expected glow colors', async () => {
    const reportsMock = vi.fn()
      .mockResolvedValueOnce([
        { agentId: 'green', totalTasks: 10, successRate: 0.9 },
        { agentId: 'amber', totalTasks: 10, successRate: 0.7 },
        { agentId: 'red', totalTasks: 10, successRate: 0.4 },
      ])

    ;(window as unknown as { api: { evalsReportAll: () => Promise<unknown[]> } }).api = {
      evalsReportAll: reportsMock,
    }

    const animator = new WorkstationAnimator(makeFakeScene(), {} as any, vi.fn(), vi.fn())

    const green = makeWorkstationStub('green')
    const amber = makeWorkstationStub('amber')
    const red = makeWorkstationStub('red')
    const grey = makeWorkstationStub('no-data')

    animator.updateEvalGlow(green)
    animator.updateEvalGlow(amber)
    animator.updateEvalGlow(red)
    animator.updateEvalGlow(grey)
    await Promise.resolve()
    // Cache fills asynchronously — re-apply glow after fetch completes
    animator.updateEvalGlow(green)
    animator.updateEvalGlow(amber)
    animator.updateEvalGlow(red)
    animator.updateEvalGlow(grey)

    expect((green.evalGlow as unknown as { fillColor: number }).fillColor).toBe(EVAL_GLOW_GREEN)
    expect((amber.evalGlow as unknown as { fillColor: number }).fillColor).toBe(EVAL_GLOW_AMBER)
    expect((red.evalGlow as unknown as { fillColor: number }).fillColor).toBe(EVAL_GLOW_RED)
    expect((grey.evalGlow as unknown as { fillColor: number }).fillColor).toBe(EVAL_GLOW_GREY)
  })

  it('does not start a second eval fetch while one is already in flight', async () => {
    let resolveFirst!: (rows: unknown[]) => void
    const firstHang = new Promise<unknown[]>((r) => {
      resolveFirst = r
    })
    const row = { agentId: 'agent-1', totalTasks: 10, successRate: 0.85 }
    const reportsMock = vi.fn().mockReturnValueOnce(firstHang).mockResolvedValue([row])

    ;(window as unknown as { api: { evalsReportAll: () => Promise<unknown[]> } }).api = {
      evalsReportAll: reportsMock,
    }

    const animator = new WorkstationAnimator(makeFakeScene(), {} as any, vi.fn(), vi.fn())
    const ws = makeWorkstationStub('agent-1')

    animator.updateEvalGlow(ws)
    expect(reportsMock).toHaveBeenCalledTimes(1)

    animator.updateEvalGlow(ws)
    expect(reportsMock).toHaveBeenCalledTimes(1)

    resolveFirst([row])
    await Promise.resolve()
    await Promise.resolve()
    expect(reportsMock).toHaveBeenCalledTimes(1)
  })

  it('hides eval glow at LOD 1 and shows it at LOD 2+', () => {
    const ui = new OfficeUI(makeFakeScene())
    const ws = makeWorkstationStub('agent-lod')
    const evalGlow = ws.lodLevel2Objects[0] as unknown as { visible: boolean }

    // L2→L1 fades the workstation container out (L2 children are not individually hidden)
    ui.applyLodToWorkstation(ws, 2, false)
    ui.applyLodToWorkstation(ws, 1, false)
    expect((ws.container as unknown as { visible: boolean }).visible).toBe(false)

    ui.applyLodToWorkstation(ws, 2, false)
    expect((ws.container as unknown as { visible: boolean }).visible).toBe(true)
    expect(evalGlow.visible).toBe(true)
  })
})

describe('thinking dots (best-of-N)', () => {
  type CircleStub = {
    x: number
    alpha: number
    scaleX: number
    scaleY: number
    active: boolean
    setAlpha: (a: number) => CircleStub
    setFillStyle: (c: number, a?: number) => CircleStub
    setVisible: (v: boolean) => CircleStub
  }

  function makeThinkingScene() {
    const killTweensOf = vi.fn()
    const tweensAdd = vi.fn((cfg: Record<string, unknown>) => {
      const tw = { destroy: vi.fn(), cfg }
      return tw
    })
    const circles: CircleStub[] = []
    const makeCircle = (): CircleStub => {
      const dot: CircleStub = {
        x: 0,
        y: 0,
        alpha: 0,
        scaleX: 1,
        scaleY: 1,
        active: true,
        setAlpha(a: number) {
          this.alpha = a
          return this
        },
        setFillStyle(_c: number, a?: number) {
          if (a !== undefined) this.alpha = a
          return this
        },
        setVisible(_v: boolean) {
          return this
        },
      }
      circles.push(dot)
      return dot
    }
    let lastContainer: { destroy: ReturnType<typeof vi.fn>; add: ReturnType<typeof vi.fn> }
    const scene = {
      tweens: { add: tweensAdd, killTweensOf },
      add: {
        circle: (_x: number, _y: number, _r: number, _color: number, _fillAlpha: number) => makeCircle(),
        container: (_x: number, _y: number) => {
          lastContainer = {
            add: vi.fn(),
            destroy: vi.fn(),
          }
          return lastContainer
        },
      },
    } as unknown as Phaser.Scene
    return { scene, tweensAdd, circles, killTweensOf, getLastContainer: () => lastContainer! }
  }

  function makeWsForThinking(agentId: string): WorkstationSprite {
    const ws = makeWorkstationStub(agentId)
    return {
      ...ws,
      lodLevel3Objects: [],
      container: {
        alpha: 1,
        visible: true,
        add: vi.fn(),
        setVisible(v: boolean) {
          this.visible = v
        },
        setAlpha(a: number) {
          this.alpha = a
        },
      } as unknown as WorkstationSprite['container'],
    }
  }

  const minimalHost = { getRooms: () => new Map() } as import('../../src/renderer/src/game/office-workstation').WorkstationHost

  it('showThinkingDots creates candidateCount Arc dots, registers lodLevel3Objects, starts repeat tween', () => {
    const { scene, tweensAdd, circles, getLastContainer } = makeThinkingScene()
    const animator = new WorkstationAnimator(scene, minimalHost, vi.fn(), vi.fn())
    const ws = makeWsForThinking('solver-1')

    animator.showThinkingDots(ws, 3)

    expect(circles.length).toBe(3)
    expect(ws.lodLevel3Objects.length).toBe(1)
    expect(ws.container.add).toHaveBeenCalled()
    expect(getLastContainer().add).toHaveBeenCalledTimes(3)
    expect(ws.thinkingCandidateCount).toBe(3)
    expect(tweensAdd).toHaveBeenCalledWith(
      expect.objectContaining({ repeat: -1 }),
    )
  })

  it('showThinkingDots is a no-op when candidateCount < 2', () => {
    const { scene, tweensAdd, circles } = makeThinkingScene()
    const animator = new WorkstationAnimator(scene, minimalHost, vi.fn(), vi.fn())
    const ws = makeWsForThinking('solver-1')
    animator.showThinkingDots(ws, 1)
    expect(circles.length).toBe(0)
    expect(tweensAdd).not.toHaveBeenCalled()
  })

  it('hideThinkingDots destroys loop tween, removes lod entry, clears refs', () => {
    const { scene, tweensAdd, getLastContainer } = makeThinkingScene()
    const animator = new WorkstationAnimator(scene, minimalHost, vi.fn(), vi.fn())
    const ws = makeWsForThinking('solver-1')
    animator.showThinkingDots(ws, 2)
    const loopTween = tweensAdd.mock.results[0].value as { destroy: ReturnType<typeof vi.fn> }

    animator.hideThinkingDots(ws)

    expect(loopTween.destroy).toHaveBeenCalled()
    expect(ws.lodLevel3Objects.length).toBe(0)
    expect(ws.thinkingDots).toBeUndefined()
    expect(ws.thinkingDotsContainer).toBeUndefined()
    expect(getLastContainer().destroy).toHaveBeenCalled()
  })

  it('playThinkingMerge stops the loop tween and schedules cleanup', () => {
    const { scene, tweensAdd } = makeThinkingScene()
    const tweensChain: Array<{ destroy: ReturnType<typeof vi.fn>; cfg: Record<string, unknown> }> = []
    ;(scene.tweens as { add: typeof scene.tweens.add }).add = vi.fn((cfg: Record<string, unknown>) => {
      const tw = { destroy: vi.fn(), cfg }
      tweensChain.push(tw)
      return tw
    }) as typeof scene.tweens.add

    const animator = new WorkstationAnimator(scene, minimalHost, vi.fn(), vi.fn())
    const ws = makeWsForThinking('solver-1')
    animator.showThinkingDots(ws, 2)
    const loopTween = tweensChain[0]
    expect(loopTween).toBeDefined()

    animator.playThinkingMerge(ws)

    expect(loopTween.destroy).toHaveBeenCalled()
    // merge: 2 position tweens + pulse + fade
    expect(tweensChain.length).toBeGreaterThanOrEqual(3)
    const posTweens = tweensChain.slice(1, 3)
    for (const t of posTweens) {
      const onComplete = t.cfg.onComplete as (() => void) | undefined
      expect(typeof onComplete).toBe('function')
      onComplete!()
    }
    const pulseTween = tweensChain.find(t => t.cfg.yoyo === true)
    expect(pulseTween).toBeDefined()
    const pulseComplete = pulseTween!.cfg.onComplete as (() => void) | undefined
    pulseComplete!()
    const fadeTween = tweensChain[tweensChain.length - 1]
    const fadeComplete = fadeTween.cfg.onComplete as (() => void) | undefined
    fadeComplete!()
    expect(ws.thinkingDots).toBeUndefined()
  })
})

describe('quality streak flame', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-27T12:00:00.000Z'))
    vi.spyOn(Math, 'random').mockReturnValue(0)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function makeHost(
    ws: WorkstationSprite,
    spawnFlame: ReturnType<typeof vi.fn>,
    lastLod = 3,
  ) {
    const room = {
      x: 100,
      y: 200,
      workstations: new Map([[ws.state!.config.id, ws]]),
    }
    return {
      getRooms: () => new Map([['r1', room]]),
      getLastLodLevel: () => lastLod,
      spawnFlameParticle: spawnFlame,
    }
  }

  function agentWithStreak(id: string, streak: number): AgentState {
    return {
      config: { id, name: 'Test' },
      xp: { currentStreak: streak, level: 1, rank: 'Intern', totalXP: 0 },
    } as AgentState
  }

  it('starts flame timer at streak 5, not at streak 4', async () => {
    const scene = makeFakeScene() as ReturnType<typeof makeFakeScene>
    const spawnFlame = vi.fn()
    const ws = makeWorkstationStub('agent-a', true)
    const host = makeHost(ws, spawnFlame)
    const animator = new WorkstationAnimator(scene, host as never, vi.fn(), vi.fn())

    const reportsMock = vi.fn().mockResolvedValue([
      { agentId: 'agent-a', totalTasks: 1, successRate: 1, streak: 0 },
    ])
    ;(window as unknown as { api: { evalsReportAll: () => Promise<unknown[]> } }).api = {
      evalsReportAll: reportsMock,
    }

    animator.updateEvalGlow(ws)
    await Promise.resolve()

    animator.updateStreakFlame(ws, agentWithStreak('agent-a', 4))
    expect(ws.flameTimer).toBeUndefined()
    expect((ws.flameContainer as unknown as { visible: boolean }).visible).toBe(false)

    animator.updateStreakFlame(ws, agentWithStreak('agent-a', 5))
    expect(scene.time.addEvent).toHaveBeenCalled()
    expect(ws.flameTimer).toBeDefined()
    expect((ws.flameContainer as unknown as { visible: boolean }).visible).toBe(true)
  })

  it('uses higher eval harness streak when XP is lower', async () => {
    const scene = makeFakeScene() as ReturnType<typeof makeFakeScene>
    const spawnFlame = vi.fn()
    const ws = makeWorkstationStub('harness-a', true)
    const host = makeHost(ws, spawnFlame)
    const animator = new WorkstationAnimator(scene, host as never, vi.fn(), vi.fn())

    const reportsMock = vi.fn().mockResolvedValue([
      { agentId: 'harness-a', totalTasks: 10, successRate: 0.9, streak: 6 },
    ])
    ;(window as unknown as { api: { evalsReportAll: () => Promise<unknown[]> } }).api = {
      evalsReportAll: reportsMock,
    }

    animator.updateEvalGlow(ws)
    await Promise.resolve()

    animator.updateStreakFlame(ws, agentWithStreak('harness-a', 0))
    expect(ws.flameTimer).toBeDefined()
    const addCall = scene.time.addEvent.mock.calls.find((c) => c[0]?.loop === true)
    expect(addCall).toBeDefined()
    const cb = addCall![0].callback as () => void
    cb()
    expect(spawnFlame).toHaveBeenCalledWith(expect.any(Number), expect.any(Number), 6)
  })

  it('passes larger streak to spawnFlameParticle for higher XP tiers', async () => {
    const scene = makeFakeScene() as ReturnType<typeof makeFakeScene>
    const spawnFlame = vi.fn()
    const ws = makeWorkstationStub('tier-a', true)
    const host = makeHost(ws, spawnFlame)
    const animator = new WorkstationAnimator(scene, host as never, vi.fn(), vi.fn())

    ;(window as unknown as { api: { evalsReportAll: () => Promise<unknown[]> } }).api = {
      evalsReportAll: vi.fn().mockResolvedValue([]),
    }

    animator.updateEvalGlow(ws)
    await Promise.resolve()

    animator.updateStreakFlame(ws, agentWithStreak('tier-a', 5))
    const cb5 = scene.time.addEvent.mock.calls.find((c) => c[0]?.loop === true)?.[0].callback as () => void
    spawnFlame.mockClear()
    cb5()
    expect(spawnFlame).toHaveBeenCalledWith(expect.any(Number), expect.any(Number), 5)

    animator.updateStreakFlame(ws, agentWithStreak('tier-a', 12))
    const lastCall = scene.time.addEvent.mock.calls.filter((c) => c[0]?.loop === true).pop()
    const cb12 = lastCall![0].callback as () => void
    spawnFlame.mockClear()
    cb12()
    expect(spawnFlame).toHaveBeenCalledWith(expect.any(Number), expect.any(Number), 12)
  })

  it('stops flame and plays smoke when streak drops from 5+ to below 5', async () => {
    const scene = makeFakeScene({ smokeAnim: true }) as ReturnType<typeof makeFakeScene>
    const ws = makeWorkstationStub('break-a', true)
    const host = makeHost(ws, vi.fn())
    const animator = new WorkstationAnimator(scene, host as never, vi.fn(), vi.fn())

    ;(window as unknown as { api: { evalsReportAll: () => Promise<unknown[]> } }).api = {
      evalsReportAll: vi.fn().mockResolvedValue([]),
    }

    animator.updateEvalGlow(ws)
    await Promise.resolve()

    animator.updateStreakFlame(ws, agentWithStreak('break-a', 5))
    expect(ws.flameTimer).toBeDefined()

    animator.updateStreakFlame(ws, agentWithStreak('break-a', 3))
    expect(ws.flameTimer).toBeUndefined()
    expect((ws.flameContainer as unknown as { visible: boolean }).visible).toBe(false)
    expect(scene.add.sprite).toHaveBeenCalled()
  })

  it('stops flame without smoke when LOD drops below 3', async () => {
    const scene = makeFakeScene({ smokeAnim: true }) as ReturnType<typeof makeFakeScene>
    const ws = makeWorkstationStub('lod-a', true)
    const host = makeHost(ws, vi.fn(), 2)
    const animator = new WorkstationAnimator(scene, host as never, vi.fn(), vi.fn())

    ;(window as unknown as { api: { evalsReportAll: () => Promise<unknown[]> } }).api = {
      evalsReportAll: vi.fn().mockResolvedValue([]),
    }

    animator.updateEvalGlow(ws)
    await Promise.resolve()

    ws.currentLodLevel = 3
    animator.updateStreakFlame(ws, agentWithStreak('lod-a', 5))
    expect(ws.flameTimer).toBeDefined()

    ws.currentLodLevel = 2
    scene.add.sprite.mockClear()
    animator.updateStreakFlame(ws, agentWithStreak('lod-a', 5))
    expect(ws.flameTimer).toBeUndefined()
    expect(scene.add.sprite).not.toHaveBeenCalled()
  })
})
