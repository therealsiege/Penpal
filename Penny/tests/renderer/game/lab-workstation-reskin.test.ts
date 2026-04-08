/**
 * Unit tests for lab workstation reskin (issue #144).
 * Validates LAB_PROP_FRAMES constants, lab desk colors, and
 * WorkstationFactory conditional sprite selection.
 */
// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import {
  SPRITESHEET_KEYS,
  LAB_PROP_FRAMES,
} from '../../../src/renderer/src/game/office-asset-keys'
import {
  COLOR_LAB_DESK_BODY,
  COLOR_LAB_DESK_STROKE,
  COLOR_LAB_DESK_STROKE_ALPHA,
  COLOR_DESK_BODY,
  COLOR_DESK_TOP,
  FRAME_CHAIR_DARK,
  FRAME_MONITOR,
  WS_CHAIR_Y,
  WS_MONITOR_Y,
  WS_DESK_Y,
} from '../../../src/renderer/src/game/office-constants'

// ---------------------------------------------------------------------------
// LAB_PROP_FRAMES — frame index constants
// ---------------------------------------------------------------------------

describe('LAB_PROP_FRAMES constants', () => {
  it('defines STOOL frame index', () => {
    expect(LAB_PROP_FRAMES.STOOL).toBe(0)
  })

  it('defines CONSOLE_SCREEN frame index', () => {
    expect(LAB_PROP_FRAMES.CONSOLE_SCREEN).toBe(1)
  })

  it('defines CONSOLE_LINES_01 for animation start frame', () => {
    expect(LAB_PROP_FRAMES.CONSOLE_LINES_01).toBe(14)
  })

  it('defines CONSOLE_WAVE_01 for animation start frame', () => {
    expect(LAB_PROP_FRAMES.CONSOLE_WAVE_01).toBe(15)
  })

  it('defines KEYBOARD frame index', () => {
    expect(LAB_PROP_FRAMES.KEYBOARD).toBe(3)
  })

  it('defines DESK_LAMP frame index', () => {
    expect(LAB_PROP_FRAMES.DESK_LAMP).toBe(2)
  })

  it('defines lab signature item frames (issue #127)', () => {
    expect(LAB_PROP_FRAMES.MICROSCOPE).toBe(8)
    expect(LAB_PROP_FRAMES.BEAKER).toBe(9)
    expect(LAB_PROP_FRAMES.PETRI_DISH).toBe(10)
    expect(LAB_PROP_FRAMES.TABLET).toBe(11)
    expect(LAB_PROP_FRAMES.CLIPBOARD).toBe(12)
    expect(LAB_PROP_FRAMES.SCALE).toBe(13)
  })

  it('defines DESK_DRAW frame index (issue #127)', () => {
    expect(LAB_PROP_FRAMES.DESK_DRAW).toBe(6)
  })

  it('defines FREE_STANDING_SCREEN frame index (issue #127)', () => {
    expect(LAB_PROP_FRAMES.FREE_STANDING_SCREEN).toBe(7)
  })

  it('is frozen (immutable)', () => {
    expect(Object.isFrozen(LAB_PROP_FRAMES)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// SPRITESHEET_KEYS — LAB_PROPS key
// ---------------------------------------------------------------------------

describe('SPRITESHEET_KEYS.LAB_PROPS', () => {
  it('is defined as "lab-props"', () => {
    expect(SPRITESHEET_KEYS.LAB_PROPS).toBe('lab-props')
  })
})

// ---------------------------------------------------------------------------
// Lab desk color constants (issue #144)
// ---------------------------------------------------------------------------

describe('Lab desk color constants', () => {
  it('COLOR_LAB_DESK_BODY is a dark blue (0x1a3a52)', () => {
    expect(COLOR_LAB_DESK_BODY).toBe(0x1a3a52)
  })

  it('COLOR_LAB_DESK_STROKE is cyan (0x22d3ee)', () => {
    expect(COLOR_LAB_DESK_STROKE).toBe(0x22d3ee)
  })

  it('COLOR_LAB_DESK_STROKE_ALPHA is 0.4', () => {
    expect(COLOR_LAB_DESK_STROKE_ALPHA).toBe(0.4)
  })

  it('lab colors differ from default office colors', () => {
    expect(COLOR_LAB_DESK_BODY).not.toBe(COLOR_DESK_BODY)
    expect(COLOR_LAB_DESK_STROKE).not.toBe(COLOR_DESK_TOP)
  })
})

// ---------------------------------------------------------------------------
// WorkstationFactory.create — lab sprite selection logic
// ---------------------------------------------------------------------------
// The factory lives behind a complex Phaser scene; we mock it minimally to
// verify that the correct spritesheet + frame is chosen depending on whether
// the LAB_PROPS texture is loaded.

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

describe('WorkstationFactory — lab reskin sprite selection', () => {
  /**
   * Build a minimal mock scene that tracks sprite creation calls.
   * Returns the scene and a log of all scene.add.sprite() calls.
   */
  function buildMockScene(opts: { labPropsLoaded: boolean; officeTilesLoaded: boolean }) {
    const spriteLog: Array<{ x: number; y: number; sheet: string; frame: number; scale: number }> = []
    const textures = new Set<string>()
    if (opts.labPropsLoaded) textures.add(SPRITESHEET_KEYS.LAB_PROPS)
    // Always add textures that the factory may check
    textures.add(SPRITESHEET_KEYS.GAME_ICONS)
    textures.add(SPRITESHEET_KEYS.GAME_ITEMS)

    const makeMockGO = () => {
      const go: Record<string, unknown> = {
        x: 0, y: 0, width: 10, height: 8, active: true, visible: true, alpha: 1,
        setScale: vi.fn(function (this: typeof go, s: number) { (this as any)._scale = s; return this }),
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
        delayedCall: vi.fn((_d: number, cb: () => void) => { return { remove: vi.fn() } }),
      },
      add: {
        container: vi.fn((_x: number, _y: number, _ch?: unknown[]) => makeMockGO()),
        sprite: vi.fn((x: number, y: number, sheet: string, frame: number) => {
          const go = makeMockGO()
          go.x = x; go.y = y
          spriteLog.push({ x, y, sheet, frame, scale: 1 })
          // Track scale from setScale calls
          const origSetScale = go.setScale as ReturnType<typeof vi.fn>
          go.setScale = vi.fn(function (this: typeof go, s: number) {
            const entry = spriteLog.find(e => e.sheet === sheet && e.frame === frame && e.x === x && e.y === y)
            if (entry) entry.scale = s
            return this
          }) as unknown as typeof go.setScale
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

  it('uses LAB_PROPS stool when lab textures are loaded', async () => {
    const { WorkstationFactory } = await import('../../../src/renderer/src/game/workstation-creation')
    const { scene, spriteLog } = buildMockScene({ labPropsLoaded: true, officeTilesLoaded: true })
    const host = makeHost(true)
    const factory = new WorkstationFactory(scene, host, vi.fn(), vi.fn())

    factory.create(makeRoom(), makeAgent('a1'))

    // Chair should use LAB_PROPS with STOOL frame at 0.22 scale
    const stoolSprite = spriteLog.find(s => s.sheet === SPRITESHEET_KEYS.LAB_PROPS && s.frame === LAB_PROP_FRAMES.STOOL)
    expect(stoolSprite).toBeDefined()
    expect(stoolSprite!.y).toBe(WS_CHAIR_Y + 4)
    expect(stoolSprite!.scale).toBe(0.22)
  })

  it('uses LAB_PROPS console screen when lab textures are loaded', async () => {
    const { WorkstationFactory } = await import('../../../src/renderer/src/game/workstation-creation')
    const { scene, spriteLog } = buildMockScene({ labPropsLoaded: true, officeTilesLoaded: true })
    const host = makeHost(true)
    const factory = new WorkstationFactory(scene, host, vi.fn(), vi.fn())

    factory.create(makeRoom(), makeAgent('a2'))

    const consoleSprite = spriteLog.find(s => s.sheet === SPRITESHEET_KEYS.LAB_PROPS && s.frame === LAB_PROP_FRAMES.CONSOLE_SCREEN)
    expect(consoleSprite).toBeDefined()
    expect(consoleSprite!.y).toBe(WS_MONITOR_Y)
    expect(consoleSprite!.scale).toBe(0.26)
  })

  it('falls back to office chair when lab textures are NOT loaded', async () => {
    const { WorkstationFactory } = await import('../../../src/renderer/src/game/workstation-creation')
    const { scene, spriteLog } = buildMockScene({ labPropsLoaded: false, officeTilesLoaded: true })
    const host = makeHost(true)
    const factory = new WorkstationFactory(scene, host, vi.fn(), vi.fn())

    factory.create(makeRoom(), makeAgent('a3'))

    // Should NOT use LAB_PROPS at all
    const labSprites = spriteLog.filter(s => s.sheet === SPRITESHEET_KEYS.LAB_PROPS)
    expect(labSprites).toHaveLength(0)

    // Should use the office FRAME_CHAIR_DARK
    const officeChair = spriteLog.find(s => s.sheet === SPRITESHEET_KEYS.OFFICE && s.frame === FRAME_CHAIR_DARK)
    expect(officeChair).toBeDefined()
  })

  it('falls back to office monitor when lab textures are NOT loaded', async () => {
    const { WorkstationFactory } = await import('../../../src/renderer/src/game/workstation-creation')
    const { scene, spriteLog } = buildMockScene({ labPropsLoaded: false, officeTilesLoaded: true })
    const host = makeHost(true)
    const factory = new WorkstationFactory(scene, host, vi.fn(), vi.fn())

    factory.create(makeRoom(), makeAgent('a4'))

    const officeMonitor = spriteLog.find(s => s.sheet === SPRITESHEET_KEYS.OFFICE && s.frame === FRAME_MONITOR)
    expect(officeMonitor).toBeDefined()
  })

  it('does not use lab sprites when neither lab nor office textures are loaded', async () => {
    const { WorkstationFactory } = await import('../../../src/renderer/src/game/workstation-creation')
    const { scene, spriteLog } = buildMockScene({ labPropsLoaded: false, officeTilesLoaded: false })
    const host = makeHost(false)
    const factory = new WorkstationFactory(scene, host, vi.fn(), vi.fn())

    factory.create(makeRoom(), makeAgent('a5'))

    // No lab or office chair/monitor sprites
    const labOrOfficeSprites = spriteLog.filter(s =>
      s.sheet === SPRITESHEET_KEYS.LAB_PROPS || (s.sheet === SPRITESHEET_KEYS.OFFICE && (s.frame === FRAME_CHAIR_DARK || s.frame === FRAME_MONITOR)),
    )
    expect(labOrOfficeSprites).toHaveLength(0)
  })

  it('desk body uses lab colors when lab textures are loaded', async () => {
    const { WorkstationFactory } = await import('../../../src/renderer/src/game/workstation-creation')
    const { scene } = buildMockScene({ labPropsLoaded: true, officeTilesLoaded: true })
    const host = makeHost(true)
    const factory = new WorkstationFactory(scene, host, vi.fn(), vi.fn())

    factory.create(makeRoom(), makeAgent('a6'))

    // Lab desk body: wider/taller than default office desk
    const rectCalls = (scene.add.rectangle as ReturnType<typeof vi.fn>).mock.calls
    const deskBodyCall = rectCalls.find((c: number[]) => c[0] === 0 && c[1] === WS_DESK_Y && c[2] === 112 && c[3] === 24)
    expect(deskBodyCall).toBeDefined()
    // The fill color should be COLOR_LAB_DESK_BODY
    expect(deskBodyCall![4]).toBe(COLOR_LAB_DESK_BODY)
  })

  it('desk body uses default colors when lab textures are NOT loaded', async () => {
    const { WorkstationFactory } = await import('../../../src/renderer/src/game/workstation-creation')
    const { scene } = buildMockScene({ labPropsLoaded: false, officeTilesLoaded: true })
    const host = makeHost(true)
    const factory = new WorkstationFactory(scene, host, vi.fn(), vi.fn())

    factory.create(makeRoom(), makeAgent('a7'))

    const rectCalls = (scene.add.rectangle as ReturnType<typeof vi.fn>).mock.calls
    const deskBodyCall = rectCalls.find((c: number[]) => c[0] === 0 && c[1] === WS_DESK_Y && c[2] === 80 && c[3] === 21)
    expect(deskBodyCall).toBeDefined()
    expect(deskBodyCall![4]).toBe(COLOR_DESK_BODY)
  })
})
