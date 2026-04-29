// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'

vi.mock('phaser', () => ({
  default: { Math: {}, GameObjects: {} },
  Math: {},
  GameObjects: {},
}))

import {
  CTX_AMBER,
  CTX_GREEN,
  CTX_RED,
} from '../../src/renderer/src/game/office-constants'
import {
  getContextMeterColor,
  normalizeContextUtilization,
} from '../../src/renderer/src/game/office-workstation'
import { OfficeUI } from '../../src/renderer/src/game/office-ui'
import type { WorkstationSprite } from '../../src/renderer/src/game/office-types'
import {
  contextRotDetectedFromHealth,
  mergeAgentContextFromHealth,
} from '../../src/renderer/src/utils/contextHealthMerge'
import type { AgentState, ContextHealth } from '../../src/renderer/src/types'

describe('normalizeContextUtilization', () => {
  it('returns null for missing or invalid values', () => {
    expect(normalizeContextUtilization(undefined)).toBeNull()
    expect(normalizeContextUtilization(null)).toBeNull()
    expect(normalizeContextUtilization(Number.NaN)).toBeNull()
    expect(normalizeContextUtilization(Number.POSITIVE_INFINITY)).toBeNull()
  })

  it('clamps to 0–1', () => {
    expect(normalizeContextUtilization(-0.1)).toBe(0)
    expect(normalizeContextUtilization(1.2)).toBe(1)
    expect(normalizeContextUtilization(0.5)).toBe(0.5)
  })
})

describe('getContextMeterColor', () => {
  it('uses green below 60% utilization', () => {
    expect(getContextMeterColor(0.5)).toBe(CTX_GREEN)
  })

  it('uses amber from 60% to below 80%', () => {
    expect(getContextMeterColor(0.6)).toBe(CTX_AMBER)
    expect(getContextMeterColor(0.79)).toBe(CTX_AMBER)
  })

  it('uses red at 80% and above', () => {
    expect(getContextMeterColor(0.8)).toBe(CTX_RED)
    expect(getContextMeterColor(0.85)).toBe(CTX_RED)
  })
})

describe('mergeAgentContextFromHealth', () => {
  const baseAgent = (over: Partial<AgentState>): AgentState =>
    ({
      config: {
        id: 'a1',
        name: 'A',
        title: '',
        podRole: 'solver',
        systemPrompt: '',
        model: 'x',
        mcpProfile: '',
        skills: [],
        allowedTools: [],
        subAgents: {},
        defaultRepos: [],
        avatar: 'fullstack',
        desk: { row: 0, col: 0 },
        autonomy: 'unknown',
      },
      status: 'idle',
      sessionId: 'sess-1',
      contextUtilization: 0.2,
      contextRotDetected: false,
      ...over,
    }) as AgentState

  it('leaves agents unchanged when health is empty or undefined', () => {
    const agents = [baseAgent({})]
    expect(mergeAgentContextFromHealth(agents, undefined)).toBe(agents)
    expect(mergeAgentContextFromHealth(agents, [])).toBe(agents)
  })

  it('matches by sessionId and overlays utilization + rot', () => {
    const health: ContextHealth[] = [{
      agentId: 'proj',
      sessionId: 'sess-1',
      tokenCount: 1,
      contextWindowSize: 100,
      utilizationPct: 85,
      rotScore: 0.7,
      recommendation: 'compress',
    }]
    const merged = mergeAgentContextFromHealth([baseAgent({})], health)[0]
    expect(merged.contextUtilization).toBe(0.85)
    expect(merged.contextRotDetected).toBe(true)
  })

  it('does not match when sessionId differs', () => {
    const health: ContextHealth[] = [{
      agentId: 'proj',
      sessionId: 'other',
      tokenCount: 1,
      contextWindowSize: 100,
      utilizationPct: 99,
      rotScore: 0,
      recommendation: 'healthy',
    }]
    const a = baseAgent({ contextUtilization: 0.33 })
    const merged = mergeAgentContextFromHealth([a], health)[0]
    expect(merged.contextUtilization).toBe(0.33)
  })
})

describe('contextRotDetectedFromHealth', () => {
  it('is true for compress and restart recommendations', () => {
    const h = (rec: ContextHealth['recommendation']): ContextHealth => ({
      agentId: 'x',
      sessionId: 's',
      tokenCount: 0,
      contextWindowSize: 1,
      utilizationPct: 0,
      rotScore: 0,
      recommendation: rec,
    })
    expect(contextRotDetectedFromHealth(h('compress'))).toBe(true)
    expect(contextRotDetectedFromHealth(h('restart'))).toBe(true)
    expect(contextRotDetectedFromHealth(h('warning'))).toBe(false)
    expect(contextRotDetectedFromHealth(h('healthy'))).toBe(false)
  })
})

function makeSceneWithTweens() {
  return {
    tweens: {
      add: (config: { onComplete?: () => void; targets?: unknown }) => {
        config.onComplete?.()
        return { destroy: vi.fn() }
      },
      killTweensOf: vi.fn(),
    },
  } as unknown as Phaser.Scene
}

describe('context meter LOD', () => {
  it('hides lodLevel3Objects (e.g. context meter graphics) at L2 and shows them at L3', () => {
    const gfx = {
      visible: true,
      alpha: 1,
      setVisible(v: boolean) {
        this.visible = v
      },
      setAlpha: vi.fn(),
    }
    const ws = {
      lodLevel2Objects: [],
      lodLevel3Objects: [gfx as unknown as Phaser.GameObjects.GameObject],
      container: {
        visible: true,
        alpha: 1,
        setVisible(v: boolean) {
          this.visible = v
          return this
        },
        setAlpha(a: number) {
          this.alpha = a
          return this
        },
      },
      currentLodLevel: undefined,
    } as unknown as WorkstationSprite

    const ui = new OfficeUI(makeSceneWithTweens())
    ui.applyLodToWorkstation(ws, 2, false)
    expect(gfx.visible).toBe(false)

    ui.applyLodToWorkstation(ws, 3, false)
    expect(gfx.visible).toBe(true)
  })
})
