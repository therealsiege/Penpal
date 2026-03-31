/**
 * Unit tests for lab workstation variants (issue #127).
 * Validates LabWorkstationFactory, lab signature items,
 * variant switching, and desk drawer prop integration.
 */
// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import {
  SPRITESHEET_KEYS,
  LAB_PROP_FRAMES,
  LAB_TILESET_FRAMES,
  LAB_SMOOTH_FRAMES,
} from '../../../src/renderer/src/game/office-asset-keys'

vi.mock('phaser', () => ({
  default: {
    Math: { DegToRad: (deg: number) => (deg * Math.PI) / 180 },
    GameObjects: {},
  },
  Math: { DegToRad: (deg: number) => (deg * Math.PI) / 180 },
  GameObjects: {},
}))

vi.mock('../../../src/renderer/src/game/quest-system', () => ({
  questSystem: { getAgentActiveQuests: vi.fn(() => []) },
}))
vi.mock('../../../src/renderer/src/game/leaderboard', () => ({
  leaderboardManager: { recordXP: vi.fn(), recordTaskComplete: vi.fn() },
}))
vi.mock('../../../src/renderer/src/game/credits', () => ({
  creditManager: { earn: vi.fn() },
}))
vi.mock('../../../src/renderer/src/game/seasons', () => ({
  seasonManager: { trackCreditsEarned: vi.fn(), trackQuestDifficulty: vi.fn(), trackTaskCompleted: vi.fn() },
}))
vi.mock('../../../src/renderer/src/game/events', () => ({
  EventBus: { emit: vi.fn(), on: vi.fn(), off: vi.fn(), removeAll: vi.fn() },
  EVENTS: { AGENT_CLICKED: 'AGENT_CLICKED', AGENT_DOUBLE_CLICKED: 'AGENT_DOUBLE_CLICKED' },
}))

// ---------------------------------------------------------------------------
// SPRITESHEET_KEYS — new lab tileset keys (issue #127)
// ---------------------------------------------------------------------------

describe('SPRITESHEET_KEYS — lab tileset keys', () => {
  it('defines LAB_MAIN_TILESET', () => {
    expect(SPRITESHEET_KEYS.LAB_MAIN_TILESET).toBe('lab-tileset')
  })

  it('defines LAB_SMOOTH', () => {
    expect(SPRITESHEET_KEYS.LAB_SMOOTH).toBe('lab-smooth')
  })

  it('LAB_PROPS remains defined', () => {
    expect(SPRITESHEET_KEYS.LAB_PROPS).toBe('lab-props')
  })
})

// ---------------------------------------------------------------------------
// LAB_TILESET_FRAMES — tileset frame indices
// ---------------------------------------------------------------------------

describe('LAB_TILESET_FRAMES', () => {
  it('defines wall edge frames 0-3', () => {
    expect(LAB_TILESET_FRAMES.WALL_TOP).toBe(0)
    expect(LAB_TILESET_FRAMES.WALL_RIGHT).toBe(1)
    expect(LAB_TILESET_FRAMES.WALL_BOTTOM).toBe(2)
    expect(LAB_TILESET_FRAMES.WALL_LEFT).toBe(3)
  })

  it('defines hex floor frames 12-13', () => {
    expect(LAB_TILESET_FRAMES.HEX_FLOOR_A).toBe(12)
    expect(LAB_TILESET_FRAMES.HEX_FLOOR_B).toBe(13)
  })

  it('is frozen', () => {
    expect(Object.isFrozen(LAB_TILESET_FRAMES)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// LAB_SMOOTH_FRAMES — smooth corner frame indices
// ---------------------------------------------------------------------------

describe('LAB_SMOOTH_FRAMES', () => {
  it('defines outer corner frames 0-3', () => {
    expect(LAB_SMOOTH_FRAMES.OUTER_TL).toBe(0)
    expect(LAB_SMOOTH_FRAMES.OUTER_TR).toBe(1)
    expect(LAB_SMOOTH_FRAMES.OUTER_BL).toBe(2)
    expect(LAB_SMOOTH_FRAMES.OUTER_BR).toBe(3)
  })

  it('defines inner corner frames 4-7', () => {
    expect(LAB_SMOOTH_FRAMES.INNER_TL).toBe(4)
    expect(LAB_SMOOTH_FRAMES.INNER_TR).toBe(5)
    expect(LAB_SMOOTH_FRAMES.INNER_BL).toBe(6)
    expect(LAB_SMOOTH_FRAMES.INNER_BR).toBe(7)
  })

  it('is frozen', () => {
    expect(Object.isFrozen(LAB_SMOOTH_FRAMES)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// LAB_PROP_FRAMES — lab furniture frame indices (issue #127)
// ---------------------------------------------------------------------------

describe('LAB_PROP_FRAMES — lab furniture', () => {
  it('defines all 16 frame indices', () => {
    const allFrames = Object.values(LAB_PROP_FRAMES)
    expect(allFrames.length).toBe(16)
    // All should be unique non-negative integers
    const unique = new Set(allFrames)
    expect(unique.size).toBe(16)
    for (const f of allFrames) {
      expect(f).toBeGreaterThanOrEqual(0)
      expect(f).toBeLessThan(16)
    }
  })

  it('lab signature items are in frames 8-13', () => {
    expect(LAB_PROP_FRAMES.MICROSCOPE).toBe(8)
    expect(LAB_PROP_FRAMES.BEAKER).toBe(9)
    expect(LAB_PROP_FRAMES.PETRI_DISH).toBe(10)
    expect(LAB_PROP_FRAMES.TABLET).toBe(11)
    expect(LAB_PROP_FRAMES.CLIPBOARD).toBe(12)
    expect(LAB_PROP_FRAMES.SCALE).toBe(13)
  })
})

// ---------------------------------------------------------------------------
// LabWorkstationFactory
// ---------------------------------------------------------------------------

describe('LabWorkstationFactory', () => {
  function buildMockScene(labPropsLoaded: boolean) {
    const spriteLog: Array<{ x: number; y: number; sheet: string; frame: number }> = []
    const textures = new Set<string>()
    if (labPropsLoaded) textures.add(SPRITESHEET_KEYS.LAB_PROPS)

    const makeMockGO = () => ({
      x: 0, y: 0, active: true, visible: true, alpha: 1,
      setScale: vi.fn().mockReturnThis(),
      setAlpha: vi.fn().mockReturnThis(),
      setOrigin: vi.fn().mockReturnThis(),
      setVisible: vi.fn().mockReturnThis(),
      destroy: vi.fn(),
    })

    const scene = {
      textures: { exists: vi.fn((key: string) => textures.has(key)) },
      add: {
        sprite: vi.fn((x: number, y: number, sheet: string, frame: number) => {
          spriteLog.push({ x, y, sheet, frame })
          return makeMockGO()
        }),
      },
    } as unknown as Phaser.Scene

    return { scene, spriteLog }
  }

  it('isAvailable returns true when LAB_PROPS texture exists', async () => {
    const { LabWorkstationFactory } = await import('../../../src/renderer/src/game/lab-workstation')
    const { scene } = buildMockScene(true)
    const factory = new LabWorkstationFactory(scene)
    expect(factory.isAvailable).toBe(true)
  })

  it('isAvailable returns false when LAB_PROPS texture is missing', async () => {
    const { LabWorkstationFactory } = await import('../../../src/renderer/src/game/lab-workstation')
    const { scene } = buildMockScene(false)
    const factory = new LabWorkstationFactory(scene)
    expect(factory.isAvailable).toBe(false)
  })

  it('createStool creates sprite with STOOL frame', async () => {
    const { LabWorkstationFactory } = await import('../../../src/renderer/src/game/lab-workstation')
    const { scene, spriteLog } = buildMockScene(true)
    const factory = new LabWorkstationFactory(scene)

    const stool = factory.createStool(10, 20)
    expect(stool).not.toBeNull()
    expect(spriteLog).toContainEqual(expect.objectContaining({
      x: 10, y: 20, sheet: SPRITESHEET_KEYS.LAB_PROPS, frame: LAB_PROP_FRAMES.STOOL,
    }))
  })

  it('createStool returns null when sheet not loaded', async () => {
    const { LabWorkstationFactory } = await import('../../../src/renderer/src/game/lab-workstation')
    const { scene } = buildMockScene(false)
    const factory = new LabWorkstationFactory(scene)

    expect(factory.createStool(10, 20)).toBeNull()
  })

  it('createConsoleScreen creates sprite with CONSOLE_SCREEN frame', async () => {
    const { LabWorkstationFactory } = await import('../../../src/renderer/src/game/lab-workstation')
    const { scene, spriteLog } = buildMockScene(true)
    const factory = new LabWorkstationFactory(scene)

    const screen = factory.createConsoleScreen(0, 5)
    expect(screen).not.toBeNull()
    expect(spriteLog).toContainEqual(expect.objectContaining({
      sheet: SPRITESHEET_KEYS.LAB_PROPS, frame: LAB_PROP_FRAMES.CONSOLE_SCREEN,
    }))
  })

  it('createDeskDrawer creates sprite with DESK_DRAW frame', async () => {
    const { LabWorkstationFactory } = await import('../../../src/renderer/src/game/lab-workstation')
    const { scene, spriteLog } = buildMockScene(true)
    const factory = new LabWorkstationFactory(scene)

    const drawer = factory.createDeskDrawer(34, 20)
    expect(drawer).not.toBeNull()
    expect(spriteLog).toContainEqual(expect.objectContaining({
      sheet: SPRITESHEET_KEYS.LAB_PROPS, frame: LAB_PROP_FRAMES.DESK_DRAW,
    }))
  })

  it('createSignatureItem cycles through 6 lab items deterministically', async () => {
    const { LabWorkstationFactory, LAB_SIGNATURE_ITEMS } = await import('../../../src/renderer/src/game/lab-workstation')
    const { scene, spriteLog } = buildMockScene(true)
    const factory = new LabWorkstationFactory(scene)

    // Create items with different name hashes
    for (let i = 0; i < 6; i++) {
      factory.createSignatureItem(0, 0, i)
    }

    // Each should use a different frame from LAB_SIGNATURE_ITEMS
    const usedFrames = spriteLog.map(s => s.frame)
    for (let i = 0; i < 6; i++) {
      expect(usedFrames[i]).toBe(LAB_SIGNATURE_ITEMS[i])
    }
  })

  it('createSignatureItem returns null when sheet not loaded', async () => {
    const { LabWorkstationFactory } = await import('../../../src/renderer/src/game/lab-workstation')
    const { scene } = buildMockScene(false)
    const factory = new LabWorkstationFactory(scene)

    expect(factory.createSignatureItem(0, 0, 42)).toBeNull()
  })

  it('getSignatureItemName returns correct names', async () => {
    const { LabWorkstationFactory } = await import('../../../src/renderer/src/game/lab-workstation')

    expect(LabWorkstationFactory.getSignatureItemName(LAB_PROP_FRAMES.MICROSCOPE)).toBe('Researcher')
    expect(LabWorkstationFactory.getSignatureItemName(LAB_PROP_FRAMES.BEAKER)).toBe('Chemist')
    expect(LabWorkstationFactory.getSignatureItemName(LAB_PROP_FRAMES.PETRI_DISH)).toBe('Biologist')
    expect(LabWorkstationFactory.getSignatureItemName(LAB_PROP_FRAMES.TABLET)).toBe('Data Analyst')
    expect(LabWorkstationFactory.getSignatureItemName(LAB_PROP_FRAMES.CLIPBOARD)).toBe('Lab Manager')
    expect(LabWorkstationFactory.getSignatureItemName(LAB_PROP_FRAMES.SCALE)).toBe('Metrologist')
  })

  it('getSignatureItemName returns fallback for unknown frames', async () => {
    const { LabWorkstationFactory } = await import('../../../src/renderer/src/game/lab-workstation')
    expect(LabWorkstationFactory.getSignatureItemName(999)).toBe('Scientist')
  })
})

// ---------------------------------------------------------------------------
// getLabSignatureItem — deterministic hash-based item selection
// ---------------------------------------------------------------------------

describe('getLabSignatureItem', () => {
  it('returns different items for different hashes', async () => {
    const { getLabSignatureItem, LAB_SIGNATURE_ITEMS } = await import('../../../src/renderer/src/game/lab-workstation')

    const results = new Set<number>()
    for (let i = 0; i < 6; i++) {
      results.add(getLabSignatureItem(i))
    }

    // Should produce all 6 unique items
    expect(results.size).toBe(6)
    for (const r of results) {
      expect(LAB_SIGNATURE_ITEMS).toContain(r)
    }
  })

  it('wraps around for hashes > item count', async () => {
    const { getLabSignatureItem, LAB_SIGNATURE_ITEMS } = await import('../../../src/renderer/src/game/lab-workstation')

    // Hash 0 and hash 6 should produce the same item
    expect(getLabSignatureItem(0)).toBe(getLabSignatureItem(6))
    expect(getLabSignatureItem(0)).toBe(LAB_SIGNATURE_ITEMS[0])
  })
})

// ---------------------------------------------------------------------------
// WorkstationFactory variant integration
// ---------------------------------------------------------------------------

describe('WorkstationFactory — lab variant integration', () => {
  function buildMockScene(labPropsLoaded: boolean) {
    const spriteLog: Array<{ x: number; y: number; sheet: string; frame: number }> = []
    const textures = new Set<string>()
    if (labPropsLoaded) textures.add(SPRITESHEET_KEYS.LAB_PROPS)
    textures.add(SPRITESHEET_KEYS.GAME_ICONS)
    textures.add(SPRITESHEET_KEYS.GAME_ITEMS)

    const makeMockGO = () => {
      const go: Record<string, unknown> = {
        x: 0, y: 0, width: 10, height: 8, active: true, visible: true, alpha: 1,
        setScale: vi.fn().mockReturnThis(),
        setAlpha: vi.fn().mockReturnThis(),
        setOrigin: vi.fn().mockReturnThis(),
        setVisible: vi.fn().mockReturnThis(),
        setTint: vi.fn().mockReturnThis(),
        setDisplaySize: vi.fn().mockReturnThis(),
        setAngle: vi.fn().mockReturnThis(),
        setFrame: vi.fn().mockReturnThis(),
        setData: vi.fn().mockReturnThis(),
        getData: vi.fn(),
        setInteractive: vi.fn().mockReturnThis(),
        setDepth: vi.fn().mockReturnThis(),
        setPosition: vi.fn().mockReturnThis(),
        setStrokeStyle: vi.fn().mockReturnThis(),
        setScrollFactor: vi.fn().mockReturnThis(),
        setFillStyle: vi.fn().mockReturnThis(),
        setFlip: vi.fn().mockReturnThis(),
        play: vi.fn().mockReturnThis(),
        once: vi.fn().mockReturnThis(),
        on: vi.fn().mockReturnThis(),
        destroy: vi.fn(),
        postFX: { addGlow: vi.fn(() => ({ color: 0, outerStrength: 0 })) },
        frame: { name: '0' },
        list: [] as unknown[],
        add: vi.fn(),
        remove: vi.fn(),
        removeAll: vi.fn(),
      }
      return go
    }

    const scene = {
      scene: { isActive: vi.fn(() => true) },
      cameras: { main: { zoom: 1 } },
      textures: { exists: vi.fn((key: string) => textures.has(key)) },
      anims: { exists: vi.fn(() => false) },
      input: { activePointer: { x: 0, y: 0 } },
      tweens: {
        add: vi.fn(() => ({ destroy: vi.fn(), isPlaying: () => false, stop: vi.fn() })),
        addCounter: vi.fn(() => ({ destroy: vi.fn(), pause: vi.fn(), isPlaying: () => false, stop: vi.fn(), getValue: () => 0 })),
        killTweensOf: vi.fn(),
      },
      time: {
        addEvent: vi.fn(() => ({ destroy: vi.fn() })),
        delayedCall: vi.fn(() => ({ remove: vi.fn() })),
      },
      add: {
        container: vi.fn((_x: number, _y: number, _ch?: unknown[]) => makeMockGO()),
        sprite: vi.fn((x: number, y: number, sheet: string, frame: number) => {
          const go = makeMockGO()
          go.x = x; go.y = y
          spriteLog.push({ x, y, sheet, frame })
          return go
        }),
        rectangle: vi.fn(() => makeMockGO()),
        graphics: vi.fn(() => {
          const g = makeMockGO()
          g.clear = vi.fn().mockReturnThis()
          g.fillStyle = vi.fn().mockReturnThis()
          g.fillRect = vi.fn().mockReturnThis()
          g.fillRoundedRect = vi.fn().mockReturnThis()
          g.lineStyle = vi.fn().mockReturnThis()
          g.lineBetween = vi.fn().mockReturnThis()
          g.strokeRoundedRect = vi.fn().mockReturnThis()
          g.beginPath = vi.fn().mockReturnThis()
          g.strokePath = vi.fn().mockReturnThis()
          g.arc = vi.fn().mockReturnThis()
          return g
        }),
        text: vi.fn(() => makeMockGO()),
        arc: vi.fn(() => makeMockGO()),
        triangle: vi.fn(() => makeMockGO()),
        image: vi.fn(() => makeMockGO()),
        ellipse: vi.fn(() => makeMockGO()),
        circle: vi.fn(() => makeMockGO()),
      },
    } as unknown as Phaser.Scene

    return { scene, spriteLog }
  }

  function makeHost(officeTilesLoaded: boolean) {
    return {
      officeTilesLoaded,
      getAgentCharacterIndex: vi.fn(() => 0),
      getPoseFrame: vi.fn(() => 0),
      getStatusColor: vi.fn(() => 0x6b7280),
      applyLodToWorkstation: vi.fn(),
      getLastLodLevel: vi.fn(() => 3),
      enterFocusMode: vi.fn(),
      drawHoverRing: vi.fn(),
      clearHoverRing: vi.fn(),
      showRichTooltip: vi.fn(),
      hideTooltip: vi.fn(),
      showToast: vi.fn(),
      propsManager: null,
    } as any
  }

  function makeRoom() {
    return {
      container: { add: vi.fn(), x: 0, y: 0 },
      workstations: new Map(),
      cwd: '/test',
    } as any
  }

  function makeAgent(id: string) {
    return {
      config: { id, name: 'TestAgent' },
      xp: { level: 1, rank: 'Intern', totalXP: 0, currentStreak: 0 },
      sessionMode: 'idle',
      needsInteraction: false,
    } as any
  }

  it('uses lab signature items when variant is lab and LAB_PROPS loaded', async () => {
    const { WorkstationFactory } = await import('../../../src/renderer/src/game/workstation-creation')
    const { scene, spriteLog } = buildMockScene(true)
    const host = makeHost(true)
    const factory = new WorkstationFactory(scene, host, vi.fn(), vi.fn())
    factory.variant = 'lab'

    factory.create(makeRoom(), makeAgent('lab-agent'))

    // Should have a sprite from LAB_PROPS sheet with a signature item frame (8-13)
    const labSigSprites = spriteLog.filter(s =>
      s.sheet === SPRITESHEET_KEYS.LAB_PROPS &&
      s.frame >= LAB_PROP_FRAMES.MICROSCOPE &&
      s.frame <= LAB_PROP_FRAMES.SCALE,
    )
    expect(labSigSprites.length).toBeGreaterThanOrEqual(1)
  })

  it('uses desk drawer when variant is lab and LAB_PROPS loaded', async () => {
    const { WorkstationFactory } = await import('../../../src/renderer/src/game/workstation-creation')
    const { scene, spriteLog } = buildMockScene(true)
    const host = makeHost(true)
    const factory = new WorkstationFactory(scene, host, vi.fn(), vi.fn())
    factory.variant = 'lab'

    factory.create(makeRoom(), makeAgent('lab-agent'))

    // Should have a DESK_DRAW sprite
    const drawerSprites = spriteLog.filter(s =>
      s.sheet === SPRITESHEET_KEYS.LAB_PROPS && s.frame === LAB_PROP_FRAMES.DESK_DRAW,
    )
    expect(drawerSprites.length).toBe(1)
  })

  it('falls back to office items when variant is office', async () => {
    const { WorkstationFactory } = await import('../../../src/renderer/src/game/workstation-creation')
    const { scene, spriteLog } = buildMockScene(true)
    const host = makeHost(true)
    const factory = new WorkstationFactory(scene, host, vi.fn(), vi.fn())
    factory.variant = 'office'

    factory.create(makeRoom(), makeAgent('office-agent'))

    // Should use GAME_ITEMS for signature item, not LAB_PROPS
    const gameItemSigSprites = spriteLog.filter(s => s.sheet === SPRITESHEET_KEYS.GAME_ITEMS)
    expect(gameItemSigSprites.length).toBeGreaterThanOrEqual(1)

    // Should NOT have desk drawer
    const drawerSprites = spriteLog.filter(s =>
      s.sheet === SPRITESHEET_KEYS.LAB_PROPS && s.frame === LAB_PROP_FRAMES.DESK_DRAW,
    )
    expect(drawerSprites.length).toBe(0)
  })

  it('falls back to office items when LAB_PROPS not loaded even if variant is lab', async () => {
    const { WorkstationFactory } = await import('../../../src/renderer/src/game/workstation-creation')
    const { scene, spriteLog } = buildMockScene(false) // no lab props
    const host = makeHost(true)
    const factory = new WorkstationFactory(scene, host, vi.fn(), vi.fn())
    factory.variant = 'lab'

    factory.create(makeRoom(), makeAgent('agent-no-lab'))

    // Should use GAME_ITEMS for signature item as fallback
    const gameItemSigSprites = spriteLog.filter(s => s.sheet === SPRITESHEET_KEYS.GAME_ITEMS)
    expect(gameItemSigSprites.length).toBeGreaterThanOrEqual(1)

    // No lab signature items or drawer
    const labSigSprites = spriteLog.filter(s =>
      s.sheet === SPRITESHEET_KEYS.LAB_PROPS &&
      s.frame >= LAB_PROP_FRAMES.MICROSCOPE &&
      s.frame <= LAB_PROP_FRAMES.SCALE,
    )
    expect(labSigSprites.length).toBe(0)
  })
})
