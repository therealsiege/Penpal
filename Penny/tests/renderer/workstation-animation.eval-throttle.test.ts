// @vitest-environment jsdom
/**
 * Throttle behavior uses Date.now(); Vitest/Vite can isolate Date from app code, so we assert
 * refresh cadence against a mocked EVAL_GLOW_REFRESH_MS and real setTimeout.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../src/renderer/src/game/office-constants', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../src/renderer/src/game/office-constants')>()
  return { ...mod, EVAL_GLOW_REFRESH_MS: 5 }
})

vi.mock('phaser', () => ({
  default: { Math: {}, GameObjects: {} },
  Math: {},
  GameObjects: {},
}))

import { WorkstationAnimator } from '../../src/renderer/src/game/workstation-animation'
import type { WorkstationSprite } from '../../src/renderer/src/game/office-types'

function makeFakeScene() {
  return {
    tweens: {
      add: (config: { targets?: unknown; alpha?: number; onComplete?: () => void }) => {
        const target = config.targets as { alpha?: number } | undefined
        if (target && typeof config.alpha === 'number') target.alpha = config.alpha
        config.onComplete?.()
        return { destroy: vi.fn(), isPlaying: () => false, stop: vi.fn() }
      },
      killTweensOf: vi.fn(),
    },
    time: { addEvent: vi.fn(() => ({ destroy: vi.fn() })) },
    anims: { exists: vi.fn(() => false) },
    add: { container: vi.fn(() => ({ setDepth: vi.fn(), setVisible: vi.fn() })) },
  } as unknown as Phaser.Scene
}

function makeWorkstationStub(agentId: string): WorkstationSprite {
  return {
    state: { config: { id: agentId } } as WorkstationSprite['state'],
    evalGlow: { setFillStyle: vi.fn() } as unknown as Phaser.GameObjects.Arc,
    lodLevel2Objects: [],
    container: { visible: true } as unknown as Phaser.GameObjects.Container,
  } as unknown as WorkstationSprite
}

describe('workstation eval glow throttle (mocked refresh window)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('refetches only after EVAL_GLOW_REFRESH_MS since the last fetch start', async () => {
    const row = { agentId: 'agent-1', totalTasks: 10, successRate: 0.85 }
    const reportsMock = vi.fn().mockResolvedValue([row])
    ;(window as unknown as { api: { evalsReportAll: () => Promise<unknown[]> } }).api = {
      evalsReportAll: reportsMock,
    }

    const animator = new WorkstationAnimator(makeFakeScene(), {} as any, vi.fn(), vi.fn())
    const ws = makeWorkstationStub('agent-1')

    animator.updateEvalGlow(ws)
    await Promise.resolve()
    expect(reportsMock).toHaveBeenCalledTimes(1)

    animator.updateEvalGlow(ws)
    await Promise.resolve()
    expect(reportsMock).toHaveBeenCalledTimes(1)

    await new Promise((r) => setTimeout(r, 50))

    animator.updateEvalGlow(ws)
    await Promise.resolve()
    expect(reportsMock).toHaveBeenCalledTimes(2)
  })
})
