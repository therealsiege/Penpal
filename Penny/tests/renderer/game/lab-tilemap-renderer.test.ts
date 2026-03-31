// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

// Mock Phaser before any imports that depend on it
vi.mock('phaser', () => ({
  default: {
    Scene: class MockScene {
      constructor(_config?: unknown) {}
    },
    Math: { DegToRad: (deg: number) => (deg * Math.PI) / 180 },
    GameObjects: {},
    BlendModes: { ADD: 1 },
  },
  Scene: class MockScene {
    constructor(_config?: unknown) {}
  },
}))

vi.mock('../../../src/renderer/src/game/events', async importOriginal => {
  const mod = await importOriginal<typeof import('../../../src/renderer/src/game/events')>()
  return {
    ...mod,
    EventBus: { ...mod.EventBus, emit: vi.fn(), on: vi.fn() },
  }
})

const GAME_DIR = path.resolve(__dirname, '../../../src/renderer/src/game')
const readSrc = (file: string) => fs.readFileSync(path.resolve(GAME_DIR, file), 'utf-8')

describe('Lab Tilemap Renderer — Asset Keys', () => {
  it('SPRITESHEET_KEYS includes LAB_MAIN_TILESET, LAB_SMOOTH, LAB_PROPS', async () => {
    const { SPRITESHEET_KEYS } = await import('../../../src/renderer/src/game/office-asset-keys')
    expect(SPRITESHEET_KEYS.LAB_MAIN_TILESET).toBe('lab-tileset')
    expect(SPRITESHEET_KEYS.LAB_SMOOTH).toBe('lab-smooth')
    expect(SPRITESHEET_KEYS.LAB_PROPS).toBe('lab-props')
  })

  it('LAB_TILESET_FRAMES has correct hex floor frame indices (12-13)', async () => {
    const { LAB_TILESET_FRAMES } = await import('../../../src/renderer/src/game/office-asset-keys')
    expect(LAB_TILESET_FRAMES.HEX_FLOOR_A).toBe(12)
    expect(LAB_TILESET_FRAMES.HEX_FLOOR_B).toBe(13)
    expect(LAB_TILESET_FRAMES.PLAIN_FLOOR).toBe(14)
    expect(LAB_TILESET_FRAMES.GRATED_FLOOR).toBe(15)
  })

  it('LAB_TILESET_FRAMES has wall edge frames (0-3) and corner frames (4-7)', async () => {
    const { LAB_TILESET_FRAMES } = await import('../../../src/renderer/src/game/office-asset-keys')
    expect(LAB_TILESET_FRAMES.WALL_TOP).toBe(0)
    expect(LAB_TILESET_FRAMES.WALL_RIGHT).toBe(1)
    expect(LAB_TILESET_FRAMES.WALL_BOTTOM).toBe(2)
    expect(LAB_TILESET_FRAMES.WALL_LEFT).toBe(3)
    expect(LAB_TILESET_FRAMES.CORNER_TL).toBe(4)
    expect(LAB_TILESET_FRAMES.CORNER_TR).toBe(5)
    expect(LAB_TILESET_FRAMES.CORNER_BL).toBe(6)
    expect(LAB_TILESET_FRAMES.CORNER_BR).toBe(7)
  })

  it('LAB_TILESET_FRAMES has inner edge frames (8-11)', async () => {
    const { LAB_TILESET_FRAMES } = await import('../../../src/renderer/src/game/office-asset-keys')
    expect(LAB_TILESET_FRAMES.INNER_TOP).toBe(8)
    expect(LAB_TILESET_FRAMES.INNER_RIGHT).toBe(9)
    expect(LAB_TILESET_FRAMES.INNER_BOTTOM).toBe(10)
    expect(LAB_TILESET_FRAMES.INNER_LEFT).toBe(11)
  })

  it('LAB_SMOOTH_FRAMES has outer corners (0-3) and inner corners (4-7)', async () => {
    const { LAB_SMOOTH_FRAMES } = await import('../../../src/renderer/src/game/office-asset-keys')
    expect(LAB_SMOOTH_FRAMES.OUTER_TL).toBe(0)
    expect(LAB_SMOOTH_FRAMES.OUTER_TR).toBe(1)
    expect(LAB_SMOOTH_FRAMES.OUTER_BL).toBe(2)
    expect(LAB_SMOOTH_FRAMES.OUTER_BR).toBe(3)
    expect(LAB_SMOOTH_FRAMES.INNER_TL).toBe(4)
    expect(LAB_SMOOTH_FRAMES.INNER_TR).toBe(5)
    expect(LAB_SMOOTH_FRAMES.INNER_BL).toBe(6)
    expect(LAB_SMOOTH_FRAMES.INNER_BR).toBe(7)
  })

  it('LAB_PROPS_FRAMES has all 8 prop types', async () => {
    const { LAB_PROPS_FRAMES } = await import('../../../src/renderer/src/game/office-asset-keys')
    expect(LAB_PROPS_FRAMES.VENT_GRATE).toBe(0)
    expect(LAB_PROPS_FRAMES.PIPE_SECTION).toBe(1)
    expect(LAB_PROPS_FRAMES.FLOOR_PANEL).toBe(2)
    expect(LAB_PROPS_FRAMES.HAZARD_STRIPE).toBe(3)
    expect(LAB_PROPS_FRAMES.CONSOLE_PANEL).toBe(4)
    expect(LAB_PROPS_FRAMES.CABLE_CONDUIT).toBe(5)
    expect(LAB_PROPS_FRAMES.WARNING_LIGHT).toBe(6)
    expect(LAB_PROPS_FRAMES.DRAINAGE_GRATE).toBe(7)
  })
})

describe('Lab Tilemap Renderer — Constants', () => {
  it('LAB_TILE_SIZE is 48', async () => {
    const { LAB_TILE_SIZE } = await import('../../../src/renderer/src/game/office-constants')
    expect(LAB_TILE_SIZE).toBe(48)
  })
})

describe('Lab Tilemap Renderer — Boot Scene Loading', () => {
  it('boot-scene.ts loads all 3 LAB spritesheets', () => {
    const src = readSrc('boot-scene.ts')
    expect(src).toContain('SPRITESHEET_KEYS.LAB_MAIN_TILESET')
    expect(src).toContain('SPRITESHEET_KEYS.LAB_SMOOTH')
    expect(src).toContain('SPRITESHEET_KEYS.LAB_PROPS')
  })

  it('boot-scene.ts uses LAB_TILE_SIZE for frame dimensions', () => {
    const src = readSrc('boot-scene.ts')
    expect(src).toContain('LAB_TILE_SIZE')
  })

  it('boot-scene.ts has display names for LAB assets', () => {
    const src = readSrc('boot-scene.ts')
    expect(src).toContain("'Lab Tileset'")
    expect(src).toContain("'Lab Smooth'")
    expect(src).toContain("'Lab Props'")
  })
})

describe('Lab Tilemap Renderer — Room Floor Rendering', () => {
  it('office-rooms.ts imports LAB_TILESET_FRAMES and LAB_SMOOTH_FRAMES', () => {
    const src = readSrc('office-rooms.ts')
    expect(src).toContain('LAB_TILESET_FRAMES')
    expect(src).toContain('LAB_SMOOTH_FRAMES')
  })

  it('office-rooms.ts has tileHexFloor method', () => {
    const src = readSrc('office-rooms.ts')
    expect(src).toContain('tileHexFloor')
  })

  it('office-rooms.ts has tileWallEdges method', () => {
    const src = readSrc('office-rooms.ts')
    expect(src).toContain('tileWallEdges')
  })

  it('office-rooms.ts has applyLodToRoomTiles method', () => {
    const src = readSrc('office-rooms.ts')
    expect(src).toContain('applyLodToRoomTiles')
  })

  it('tileHexFloor uses HEX_FLOOR_A and HEX_FLOOR_B frames', () => {
    const src = readSrc('office-rooms.ts')
    expect(src).toContain('LAB_TILESET_FRAMES.HEX_FLOOR_A')
    expect(src).toContain('LAB_TILESET_FRAMES.HEX_FLOOR_B')
  })

  it('tileWallEdges uses WALL_TOP/RIGHT/BOTTOM/LEFT frames', () => {
    const src = readSrc('office-rooms.ts')
    expect(src).toContain('LAB_TILESET_FRAMES.WALL_TOP')
    expect(src).toContain('LAB_TILESET_FRAMES.WALL_RIGHT')
    expect(src).toContain('LAB_TILESET_FRAMES.WALL_BOTTOM')
    expect(src).toContain('LAB_TILESET_FRAMES.WALL_LEFT')
  })

  it('tileWallEdges uses LAB_SMOOTH outer corner frames', () => {
    const src = readSrc('office-rooms.ts')
    expect(src).toContain('LAB_SMOOTH_FRAMES.OUTER_TL')
    expect(src).toContain('LAB_SMOOTH_FRAMES.OUTER_TR')
    expect(src).toContain('LAB_SMOOTH_FRAMES.OUTER_BL')
    expect(src).toContain('LAB_SMOOTH_FRAMES.OUTER_BR')
  })

  it('tileHexFloor falls back to procedural when textures not loaded', () => {
    const src = readSrc('office-rooms.ts')
    // Must check for texture existence before using sprites
    expect(src).toContain("this.scene.textures.exists(SPRITESHEET_KEYS.LAB_MAIN_TILESET)")
    // Must have fallback diamond-plate pattern
    expect(src).toContain('Fallback: procedural diamond-plate pattern')
  })

  it('floor tiles are set to depth -2.5 (between floor and workstations)', () => {
    const src = readSrc('office-rooms.ts')
    expect(src).toContain('.setDepth(-2.5)')
  })

  it('wall tiles are set to depth -2', () => {
    const src = readSrc('office-rooms.ts')
    expect(src).toContain('.setDepth(-2)')
  })

  it('room cleanup destroys wall and corner tile sprites', () => {
    const src = readSrc('office-rooms.ts')
    expect(src).toContain('room.wallTileSprites')
    expect(src).toContain('room.cornerTileSprites')
  })
})

describe('Lab Tilemap Renderer — Room Type', () => {
  it('Room interface has wallTileSprites and cornerTileSprites', () => {
    const src = readSrc('office-types.ts')
    expect(src).toContain('wallTileSprites')
    expect(src).toContain('cornerTileSprites')
  })
})

describe('Lab Tilemap Renderer — Workspace Unified Floor', () => {
  it('workspace-unified-floor.ts exists and exports WorkspaceUnifiedFloor', () => {
    const src = readSrc('workspace-unified-floor.ts')
    expect(src).toContain('export class WorkspaceUnifiedFloor')
  })

  it('uses LAB_MAIN_TILESET hex floor frames', () => {
    const src = readSrc('workspace-unified-floor.ts')
    expect(src).toContain('LAB_TILESET_FRAMES.HEX_FLOOR_A')
    expect(src).toContain('LAB_TILESET_FRAMES.HEX_FLOOR_B')
  })

  it('retains hazard stripe perimeter', () => {
    const src = readSrc('workspace-unified-floor.ts')
    expect(src).toContain('hazardAlpha')
    expect(src).toContain('chevronW')
  })

  it('retains cyan glow pools', () => {
    const src = readSrc('workspace-unified-floor.ts')
    expect(src).toContain('0x00e5ff')
  })

  it('respects LOD system', () => {
    const src = readSrc('workspace-unified-floor.ts')
    expect(src).toContain('applyLod')
    expect(src).toContain('lodLevel >= 2')
  })

  it('floor tiles set at depth -3', () => {
    const src = readSrc('workspace-unified-floor.ts')
    expect(src).toContain('.setDepth(-3)')
  })
})

describe('Lab Tilemap Renderer — Background Integration', () => {
  it('office-background.ts imports WorkspaceUnifiedFloor', () => {
    const src = readSrc('office-background.ts')
    expect(src).toContain("import { WorkspaceUnifiedFloor }")
  })

  it('office-background.ts calls unifiedFloor.drawFloor in drawTeamAreas', () => {
    const src = readSrc('office-background.ts')
    expect(src).toContain('this.unifiedFloor.drawFloor')
  })

  it('office-background.ts applies LOD to unified floor', () => {
    const src = readSrc('office-background.ts')
    expect(src).toContain('this.unifiedFloor.applyLod')
  })

  it('office-background.ts cleans up unified floor on destroy', () => {
    const src = readSrc('office-background.ts')
    expect(src).toContain('this.unifiedFloor.destroy()')
  })
})

describe('Lab Tilemap Renderer — OfficeScene LOD Integration', () => {
  it('OfficeScene applies LOD to room tiles on zoom change', () => {
    const src = readSrc('OfficeScene.ts')
    expect(src).toContain('applyLodToRoomTiles')
  })
})

describe('Lab Tilemap Renderer — Sprite Assets', () => {
  const SPRITE_DIR = path.resolve(__dirname, '../../../public/sprites')

  it('lab-tileset.png exists', () => {
    expect(fs.existsSync(path.resolve(SPRITE_DIR, 'lab-tileset.png'))).toBe(true)
  })

  it('lab-smooth.png exists', () => {
    expect(fs.existsSync(path.resolve(SPRITE_DIR, 'lab-smooth.png'))).toBe(true)
  })

  it('lab-props.png exists', () => {
    expect(fs.existsSync(path.resolve(SPRITE_DIR, 'lab-props.png'))).toBe(true)
  })
})
