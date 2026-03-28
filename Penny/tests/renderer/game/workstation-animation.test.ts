import { beforeEach, describe, expect, it, vi } from 'vitest'
import { WorkstationAnimator } from '../../../src/renderer/src/game/workstation-animation'
import type { WorkstationSprite } from '../../../src/renderer/src/game/office-types'
import { OfficeUI } from '../../../src/renderer/src/game/office-ui'
import {
  EVAL_GLOW_AMBER,
  EVAL_GLOW_GREEN,
  EVAL_GLOW_GREY,
  EVAL_GLOW_RED,
} from '../../../src/renderer/src/game/office-constants'

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

describe('WorkstationAnimator eval glow', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-27T12:00:00.000Z'))
  })

  it('maps success rate thresholds to green/amber/red and missing data to grey', async () => {
    const reportsMock = vi.fn()
      .mockResolvedValueOnce([
        { agentId: 'green', totalTasks: 10, successRate: 0.9 },
        { agentId: 'amber', totalTasks: 10, successRate: 0.7 },
        { agentId: 'red', totalTasks: 10, successRate: 0.4 },
      ])

    ;(window as unknown as { api: { evalsReportAll: () => Promise<unknown[]> } }).api = {
      evalsReportAll: reportsMock,
    }

    const animator = new WorkstationAnimator(
      makeFakeScene(),
      {} as unknown as Parameters<typeof WorkstationAnimator>[1],
      vi.fn(),
      vi.fn(),
    )

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

  it('refreshes eval data on a 30-second cadence, not every call', async () => {
    const reportsMock = vi.fn().mockResolvedValue([
      { agentId: 'agent-1', totalTasks: 10, successRate: 0.85 },
    ])
    ;(window as unknown as { api: { evalsReportAll: () => Promise<unknown[]> } }).api = {
      evalsReportAll: reportsMock,
    }

    const animator = new WorkstationAnimator(
      makeFakeScene(),
      {} as unknown as Parameters<typeof WorkstationAnimator>[1],
      vi.fn(),
      vi.fn(),
    )
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
})

describe('OfficeUI LOD behavior for eval glow', () => {
  it('hides at LOD 1 and shows at LOD 2+', () => {
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
