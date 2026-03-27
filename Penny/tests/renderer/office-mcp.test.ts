// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock Phaser before any game code imports it
// ---------------------------------------------------------------------------
vi.mock('phaser', () => {
  const Linear = (a: number, b: number, t: number) => a + (b - a) * t
  return {
    default: { Math: { Linear }, GameObjects: {} },
    Math: { Linear },
    GameObjects: {},
  }
})

// Now safe to import game code that pulls in Phaser
import { OfficeMcp } from '../../src/renderer/src/game/office-mcp'
import type { Room, WorkstationSprite } from '../../src/renderer/src/game/office-types'
import type { AgentState } from '../../src/renderer/src/types'

// ---------------------------------------------------------------------------
// Phaser mock helpers
// ---------------------------------------------------------------------------

function mockGraphics() {
  return {
    setDepth: vi.fn().mockReturnThis(),
    clear: vi.fn().mockReturnThis(),
    lineStyle: vi.fn().mockReturnThis(),
    beginPath: vi.fn().mockReturnThis(),
    moveTo: vi.fn().mockReturnThis(),
    lineTo: vi.fn().mockReturnThis(),
    strokePath: vi.fn().mockReturnThis(),
    fillStyle: vi.fn().mockReturnThis(),
    fillCircle: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
  }
}

function mockSprite() {
  return {
    setScale: vi.fn().mockReturnThis(),
    setTint: vi.fn().mockReturnThis(),
    setAlpha: vi.fn().mockReturnThis(),
    setDepth: vi.fn().mockReturnThis(),
    setVisible: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
  }
}

function mockText() {
  return {
    setAlpha: vi.fn().mockReturnThis(),
    setDepth: vi.fn().mockReturnThis(),
    setVisible: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
  }
}

function createMockScene() {
  const sprites: ReturnType<typeof mockSprite>[] = []
  const texts: ReturnType<typeof mockText>[] = []
  const graphics: ReturnType<typeof mockGraphics>[] = []

  return {
    sprites,
    texts,
    graphics,
    add: {
      graphics: vi.fn(() => {
        const g = mockGraphics()
        graphics.push(g)
        return g
      }),
      sprite: vi.fn((_x: number, _y: number, _key: string, _frame?: number) => {
        const s = mockSprite()
        sprites.push(s)
        return s
      }),
      text: vi.fn((_x: number, _y: number, _text: string, _style?: object) => {
        const t = mockText()
        texts.push(t)
        return t
      }),
    },
    textures: {
      exists: vi.fn().mockReturnValue(true),
    },
  }
}

// ---------------------------------------------------------------------------
// Room / workstation factory
// ---------------------------------------------------------------------------

function makeAgentState(overrides: Partial<AgentState> = {}): AgentState {
  return {
    id: 'agent-1',
    name: 'Test Agent',
    status: 'active',
    sessionMode: 'working',
    needsInteraction: false,
    interactionType: undefined,
    lastBlurb: '',
    taskCount: 0,
    cwd: '/project',
    config: {
      id: 'agent-1',
      name: 'Test Agent',
      allowedTools: [],
      ...overrides.config,
    },
    ...overrides,
  } as AgentState
}

function makeWorkstation(state: AgentState | null): WorkstationSprite {
  return {
    container: { x: 50, y: 50 } as any,
    state,
    sprite: {} as any,
    nameText: {} as any,
    statusDot: {} as any,
    roleBadge: null,
    deskBody: {} as any,
    deskTop: {} as any,
    monitorSprite: null,
    chairSprite: null,
    thoughtBubble: {} as any,
    thoughtBubbleText: {} as any,
    thoughtBubbleBg: {} as any,
    blockedIndicator: {} as any,
    blockedIndicatorPulse: {} as any,
    blockedIndicatorBadge: {} as any,
    blockedIndicatorStem: {} as any,
    blockedIndicatorText: {} as any,
    lodLevel2Objects: [],
    lodLevel3Objects: [],
    localTaskCount: 0,
    energyLevel: 1,
  } as WorkstationSprite
}

function makeRoom(workstations: Map<string, WorkstationSprite>): Room {
  return {
    cwd: '/project',
    label: 'test-room',
    teamKey: 'team-a',
    teamLabel: 'Team A',
    agents: [],
    x: 100,
    y: 100,
    width: 400,
    height: 300,
    container: {} as any,
    workstations,
    floorGraphics: {} as any,
    activityBar: {} as any,
    activityBarTween: null,
    waitingBar: {} as any,
    waitingBarTween: null,
    statusLed: {} as any,
    statusLedGlow: {} as any,
    statusLedTween: null,
    ledMode: 'idle',
    doorGraphics: {} as any,
    doorFrameGraphics: {} as any,
    doorPulseTween: null,
    prevAgentCount: 0,
    statusStrip: null,
    statusStripTween: null,
    badgeDotTween: null,
    doorSide: 'top',
  } as Room
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('OfficeMcp', () => {
  let scene: ReturnType<typeof createMockScene>
  let mcp: OfficeMcp

  beforeEach(() => {
    scene = createMockScene()
    mcp = new OfficeMcp(scene as any)
    mcp.init()
  })

  it('agent with MCP connection shows line', () => {
    const state = makeAgentState({
      config: {
        id: 'agent-1',
        name: 'Test Agent',
        allowedTools: [
          'mcp__serena__find_symbol',
          'mcp__serena__get_symbols_overview',
          'mcp__github__search_code',
          'Read',
          'Write',
        ],
      },
    } as any)

    const ws = makeWorkstation(state)
    const workstations = new Map<string, WorkstationSprite>()
    workstations.set('agent-1', ws)

    const room = makeRoom(workstations)
    const rooms = new Map<string, Room>()
    rooms.set('/project', room)

    mcp.drawMcpLines(0, rooms)

    // The init graphics object is the first one created (index 0)
    const gfx = scene.graphics[0]
    expect(gfx.lineStyle).toHaveBeenCalled()

    // Should have created icon sprites (one per unique server: serena + github = 2)
    expect(scene.sprites.length).toBeGreaterThanOrEqual(2)
  })

  it('agent without MCP shows no line', () => {
    const state = makeAgentState({
      config: {
        id: 'agent-2',
        name: 'Plain Agent',
        allowedTools: ['Read', 'Write', 'Bash', 'Glob', 'Grep'],
      },
    } as any)

    const ws = makeWorkstation(state)
    const workstations = new Map<string, WorkstationSprite>()
    workstations.set('agent-2', ws)

    const room = makeRoom(workstations)
    const rooms = new Map<string, Room>()
    rooms.set('/project', room)

    mcp.drawMcpLines(0, rooms)

    const gfx = scene.graphics[0]
    // lineStyle should NOT have been called — no MCP connections to draw
    expect(gfx.lineStyle).not.toHaveBeenCalled()

    // No icon sprites created
    expect(scene.sprites.length).toBe(0)
  })
})
