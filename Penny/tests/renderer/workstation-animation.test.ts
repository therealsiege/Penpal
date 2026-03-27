// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('phaser', () => ({
  default: { Math: {}, GameObjects: {} },
  Math: {},
  GameObjects: {},
}))

import { WorkstationAnimator } from '../../src/renderer/src/game/workstation-animation'
import type { WorkstationSprite } from '../../src/renderer/src/game/office-types'
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

function makeFakeScene() {
  return {
    tweens: {
      add: (config: FakeTweenConfig) => {
        const target = config.targets as { alpha?: number } | undefined
        if (target && typeof config.alpha === 'number') target.alpha = config.alpha
        config.onComplete?.()
        return { destroy: vi.fn() }
      },
      killTweensOf: vi.fn(),
    },
  } as unknown as Phaser.Scene
}

function makeWorkstationStub(agentId: string): WorkstationSprite {
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

  return {
    evalGlow: evalGlow as unknown as Phaser.GameObjects.Arc,
    state: { config: { id: agentId } } as WorkstationSprite['state'],
    lodLevel2Objects: [evalGlow as unknown as Phaser.GameObjects.GameObject],
    lodLevel3Objects: [],
    container: {
      alpha: 1,
      visible: true,
      setVisible(v: boolean) {
        this.visible = v
        return this
      },
      setAlpha(a: number) {
        this.alpha = a
        return this
      },
    } as unknown as Phaser.GameObjects.Container,
  } as WorkstationSprite
}

describe('workstation eval glow behavior', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-27T12:00:00.000Z'))
  })

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

    expect((green.evalGlow as unknown as { fillColor: number }).fillColor).toBe(EVAL_GLOW_GREEN)
    expect((amber.evalGlow as unknown as { fillColor: number }).fillColor).toBe(EVAL_GLOW_AMBER)
    expect((red.evalGlow as unknown as { fillColor: number }).fillColor).toBe(EVAL_GLOW_RED)
    expect((grey.evalGlow as unknown as { fillColor: number }).fillColor).toBe(EVAL_GLOW_GREY)
  })

  it('refreshes eval reports on 30s cadence, not every update tick', async () => {
    const reportsMock = vi.fn().mockResolvedValue([
      { agentId: 'agent-1', totalTasks: 10, successRate: 0.85 },
    ])
    ;(window as unknown as { api: { evalsReportAll: () => Promise<unknown[]> } }).api = {
      evalsReportAll: reportsMock,
    }

    const animator = new WorkstationAnimator(makeFakeScene(), {} as any, vi.fn(), vi.fn())
    const ws = makeWorkstationStub('agent-1')

    animator.updateEvalGlow(ws)
    await Promise.resolve()
    expect(reportsMock).toHaveBeenCalledTimes(1)

    vi.setSystemTime(new Date('2026-03-27T12:00:10.000Z'))
    animator.updateEvalGlow(ws)
    await Promise.resolve()
    expect(reportsMock).toHaveBeenCalledTimes(1)

    vi.setSystemTime(new Date('2026-03-27T12:00:31.000Z'))
    animator.updateEvalGlow(ws)
    await Promise.resolve()
    expect(reportsMock).toHaveBeenCalledTimes(2)
  })

  it('hides eval glow at LOD 1 and shows it at LOD 2+', () => {
    const ui = new OfficeUI(makeFakeScene())
    const ws = makeWorkstationStub('agent-lod')
    const evalGlow = ws.lodLevel2Objects[0] as unknown as { visible: boolean }

    ui.applyLodToWorkstation(ws, 1, false)
    expect(evalGlow.visible).toBe(false)
    expect((ws.container as unknown as { visible: boolean }).visible).toBe(false)

    ui.applyLodToWorkstation(ws, 2, false)
    expect((ws.container as unknown as { visible: boolean }).visible).toBe(true)
    expect(evalGlow.visible).toBe(true)
  })
})

type FlameTimer = {
  callback: () => void
  destroy: ReturnType<typeof vi.fn>
}

function makeFlameScene() {
  let lastTimer: FlameTimer | null = null
  const smokeSprite = {
    setDepth: vi.fn().mockReturnThis(),
    setScale: vi.fn().mockReturnThis(),
    setAlpha: vi.fn().mockReturnThis(),
    play: vi.fn(),
    once: vi.fn((_event: string, cb: () => void) => cb()),
    destroy: vi.fn(),
  }
  const scene = {
    time: {
      addEvent: vi.fn((cfg: { callback: () => void }) => {
        const timer: FlameTimer = { callback: cfg.callback, destroy: vi.fn() }
        lastTimer = timer
        return timer
      }),
    },
    tweens: {
      add: vi.fn(() => ({ destroy: vi.fn(), isPlaying: () => false, stop: vi.fn() })),
      killTweensOf: vi.fn(),
    },
    anims: { exists: vi.fn(() => true) },
    add: { sprite: vi.fn(() => smokeSprite) },
  } as unknown as Phaser.Scene
  return { scene, getLastTimer: () => lastTimer, smokeSprite }
}

function makeFlameWorkstation(): WorkstationSprite {
  return {
    currentLodLevel: 3,
    container: { x: 10, y: 20, active: true, add: vi.fn() } as unknown as Phaser.GameObjects.Container,
    flameContainer: { visible: false, setVisible: vi.fn().mockReturnThis(), removeAll: vi.fn() } as unknown as Phaser.GameObjects.Container,
    flameTweens: [],
    lodLevel2Objects: [],
    lodLevel3Objects: [],
    state: { config: { id: 'agent-1' } } as unknown as WorkstationSprite['state'],
  } as WorkstationSprite
}

describe('workstation streak flame behavior', () => {
  it('enables flame at streak 5 but not streak 4', () => {
    const { scene, getLastTimer } = makeFlameScene()
    const host = {
      getRooms: vi.fn(() => new Map([['r1', { x: 100, y: 200, workstations: new Map([['agent-1', {}]]) }]])),
      getLastLodLevel: vi.fn(() => 3),
      spawnFlameParticle: vi.fn(),
    } as any
    const animator = new WorkstationAnimator(scene, host, vi.fn(), vi.fn())
    const ws = makeFlameWorkstation()
    const agent = { config: { id: 'agent-1' }, xp: { currentStreak: 4 } } as any

    animator.updateStreakFlame(ws, agent)
    expect(getLastTimer()).toBeNull()

    agent.xp.currentStreak = 5
    animator.updateStreakFlame(ws, agent)
    expect(getLastTimer()).not.toBeNull()
  })

  it('scales spawn intensity across tiers and caps high-streak output', () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0)
    const { scene, getLastTimer } = makeFlameScene()
    const host = { spawnFlameParticle: vi.fn(), getLastLodLevel: vi.fn(() => 3) } as any
    const animator = new WorkstationAnimator(scene, host, vi.fn(), vi.fn())
    const ws = makeFlameWorkstation()
    const room = { x: 10, y: 10 } as any

    animator.startStreakFlame(ws, 5, room)
    getLastTimer()!.callback()
    const smallCalls = host.spawnFlameParticle.mock.calls.length

    animator.startStreakFlame(ws, 10, room)
    getLastTimer()!.callback()
    const mediumCalls = host.spawnFlameParticle.mock.calls.length - smallCalls

    animator.startStreakFlame(ws, 20, room)
    getLastTimer()!.callback()
    const largeCalls = host.spawnFlameParticle.mock.calls.length - smallCalls - mediumCalls

    expect(smallCalls).toBeGreaterThan(0)
    expect(mediumCalls).toBeGreaterThanOrEqual(smallCalls)
    expect(largeCalls).toBeGreaterThanOrEqual(mediumCalls)
    expect(largeCalls).toBeLessThanOrEqual(2)
    randomSpy.mockRestore()
  })

  it('disables flame below LOD3 and emits smoke when streak breaks', () => {
    const { scene, getLastTimer, smokeSprite } = makeFlameScene()
    const host = {
      getRooms: vi.fn(() => new Map([['r1', { x: 0, y: 0, workstations: new Map([['agent-1', {}]]) }]])),
      getLastLodLevel: vi.fn(() => 2),
      spawnFlameParticle: vi.fn(),
    } as any
    const animator = new WorkstationAnimator(scene, host, vi.fn(), vi.fn())
    const ws = makeFlameWorkstation()
    ws.currentLodLevel = 2
    const agent = { config: { id: 'agent-1' }, xp: { currentStreak: 8 } } as any

    animator.updateStreakFlame(ws, agent)
    expect(getLastTimer()).toBeNull()

    ws.currentLodLevel = 3
    animator.updateStreakFlame(ws, agent)
    expect(getLastTimer()).not.toBeNull()

    agent.xp.currentStreak = 2
    animator.updateStreakFlame(ws, agent)
    expect(smokeSprite.play).toHaveBeenCalled()
    expect((ws.flameContainer as any).removeAll).toHaveBeenCalled()
  })
})
