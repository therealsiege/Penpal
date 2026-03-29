// @vitest-environment jsdom
/**
 * Room layout, LOD, and visibility tests (sidekick#65).
 * LOD assertions target OfficeUI.applyLodToWorkstation (public API); OfficeScene keeps a private duplicate.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('phaser', () => ({
  default: { Math: {}, GameObjects: {}, BlendModes: { ADD: 0 } },
  Math: {},
  GameObjects: {},
  BlendModes: { ADD: 0 },
}))

import {
  computeRoomLayout,
  detectRoomType,
  getPropsForRoomType,
  PROP_STRIP_W,
} from '../../../src/renderer/src/game/office-layout'
import { MAX_AGENTS_PER_ROW, WORKSTATION_H, WORKSTATION_W } from '../../../src/renderer/src/game/office-constants'
import { getTeamInfo } from '../../../src/renderer/src/game/office-helpers'
import { RoomVisibilityManager } from '../../../src/renderer/src/game/room-visibility'
import { OfficeRooms, type RoomsHostScene } from '../../../src/renderer/src/game/office-rooms'
import { OfficeUI } from '../../../src/renderer/src/game/office-ui'
import type { WorkstationSprite } from '../../../src/renderer/src/game/office-types'
import type { Room } from '../../../src/renderer/src/game/office-types'
import type { AgentState } from '../../../src/renderer/src/types'
import { EventBus, EVENTS } from '../../../src/renderer/src/game/events'

// ---------------------------------------------------------------------------
// Layout helpers (mirror formulas for desk grid expectations)
// ---------------------------------------------------------------------------

function effectiveAgentCount(agentCount: number): number {
  return Math.max(1, agentCount)
}

function expectedGrid(agentCount: number): { cols: number; rows: number; n: number } {
  const n = effectiveAgentCount(agentCount)
  const cols = Math.min(n, MAX_AGENTS_PER_ROW)
  const rows = Math.ceil(n / cols)
  return { cols, rows, n }
}

// ---------------------------------------------------------------------------
// LOD test scene — tweens apply props synchronously and run onComplete
// ---------------------------------------------------------------------------

type TweenTarget = {
  alpha?: number
  scaleX?: number
  scaleY?: number
  visible?: boolean
  setVisible?: (v: boolean) => unknown
  setAlpha?: (a: number) => unknown
}

function makeLodScene() {
  const tweensAdd = vi.fn((config: Record<string, unknown>) => {
    const targets = config.targets as TweenTarget | undefined
    if (targets && typeof config.scaleX === 'number') targets.scaleX = config.scaleX
    if (targets && typeof config.scaleY === 'number') targets.scaleY = config.scaleY
    if (targets && typeof config.alpha === 'number') targets.alpha = config.alpha
    const onComplete = config.onComplete as (() => void) | undefined
    onComplete?.()
    return { destroy: vi.fn(), isPlaying: () => false, stop: vi.fn(), pause: vi.fn(), resume: vi.fn() }
  })
  return {
    scene: {
      tweens: {
        add: tweensAdd,
        killTweensOf: vi.fn(),
      },
    } as unknown as Phaser.Scene,
    tweensAdd,
  }
}

function makeLodObject() {
  const o = {
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
  }
  return o
}

function makeWorkstationForLod(): WorkstationSprite {
  const l2a = makeLodObject()
  const l2b = makeLodObject()
  const l3a = makeLodObject()
  const l3b = makeLodObject()
  const container = {
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
  }
  return {
    state: { config: { id: 'ws-1' } } as WorkstationSprite['state'],
    lodLevel2Objects: [l2a, l2b] as unknown as Phaser.GameObjects.GameObject[],
    lodLevel3Objects: [l3a, l3b] as unknown as Phaser.GameObjects.GameObject[],
    container: container as unknown as WorkstationSprite['container'],
    currentLodLevel: undefined,
    screenLines: undefined,
    monitorGlowFx: undefined,
    monitorGlowTween: undefined,
  } as WorkstationSprite
}

// ---------------------------------------------------------------------------
// computeRoomLayout / calcRoomSize parity
// ---------------------------------------------------------------------------

describe('computeRoomLayout (calcRoomSize parity for standard cwd)', () => {
  it('matches 1-agent dimensions for agentCount 0 (clamped to one desk slot)', () => {
    const z = computeRoomLayout(0, 'standard')
    const one = computeRoomLayout(1, 'standard')
    expect(z.width).toBe(one.width)
    expect(z.height).toBe(one.height)
    expect(z.deskPositions.length).toBe(1)
  })

  it('reports width/height for 1, 4, 8, 16 agents (standard room type)', () => {
    const counts = [1, 4, 8, 16] as const
    const layouts = counts.map((n) => computeRoomLayout(n, 'standard'))
    for (let i = 1; i < layouts.length; i++) {
      expect(layouts[i]!.width).toBeGreaterThanOrEqual(layouts[i - 1]!.width)
      expect(layouts[i]!.height).toBeGreaterThanOrEqual(layouts[i - 1]!.height)
    }
    expect(layouts[0]!.deskPositions.length).toBe(1)
    expect(layouts[1]!.deskPositions.length).toBe(4)
    expect(layouts[2]!.deskPositions.length).toBe(8)
    expect(layouts[3]!.deskPositions.length).toBe(16)
  })

  it('scales to 4 columns and 13 rows for 52 agents', () => {
    const layout = computeRoomLayout(52, 'standard')
    const { cols, rows, n } = expectedGrid(52)
    expect(cols).toBe(4)
    expect(rows).toBe(13)
    expect(layout.deskPositions.length).toBe(n)
    expect(layout.deskPositions.length).toBe(52)
    const wallBorder = (8 + 4 + 12) * 2
    const baseWidth = wallBorder + cols * WORKSTATION_W
    expect(layout.width).toBe(baseWidth + PROP_STRIP_W)
    const expectedH =
      (8 + 4) * 2 + 20 + 12 * 2 + 30 + rows * WORKSTATION_H + 30
    expect(layout.height).toBeCloseTo(expectedH, 5)
  })

  it('deskArea size matches cols*cellW and rows*cellH', () => {
    const layout = computeRoomLayout(7, 'standard', 'bottom')
    const { cols, rows, n } = expectedGrid(7)
    expect(layout.deskPositions.length).toBe(n)
    const cellW = layout.deskArea.width / cols
    const cellH = layout.deskArea.height / rows
    expect(layout.deskArea.width).toBeCloseTo(cols * cellW, 6)
    expect(layout.deskArea.height).toBeCloseTo(rows * cellH, 6)
  })
})

describe('workstation grid geometry', () => {
  it('uses bottom door ordering: first desk is top row (lower y than next row)', () => {
    const layout = computeRoomLayout(8, 'standard', 'bottom')
    const { cols } = expectedGrid(8)
    expect(layout.deskPositions[0]!.y).toBeLessThan(layout.deskPositions[cols]!.y)
  })

  it('uses top door: vertical flip so first index sits in lower visual row vs bottom door', () => {
    const bottom = computeRoomLayout(8, 'standard', 'bottom')
    const top = computeRoomLayout(8, 'standard', 'top')
    const { cols } = expectedGrid(8)
    const deltaBottom = bottom.deskPositions[cols]!.y - bottom.deskPositions[0]!.y
    const deltaTop = top.deskPositions[cols]!.y - top.deskPositions[0]!.y
    expect(deltaBottom).toBeGreaterThan(0)
    expect(deltaTop).toBeLessThan(0)
  })
})

describe('detectRoomType and props', () => {
  const cases: [string, string][] = [
    ['/Users/acme/Penny/src/renderer/foo', 'design-studio'],
    ['/srv/backend/api', 'server-room'],
    ['/apps/mobile-expo', 'mobile-lab'],
    ['/src/game/phaser', 'game-den'],
    ['/site/docs/blog', 'creative-suite'],
    ['/infra/docker/ci', 'ops-center'],
    ['/packages/test/qa', 'qa-lab'],
    ['/unknown/vanilla/repo', 'standard'],
  ]

  it.each(cases)('detectRoomType(%s) → %s', (cwd, expected) => {
    expect(detectRoomType(cwd)).toBe(expected)
  })

  it('layout dimensions for cwd types match standard 4-agent room; prop slots differ', () => {
    const std = computeRoomLayout(4, 'standard')
    const game = computeRoomLayout(4, 'game-den')
    expect(game.width).toBe(std.width)
    expect(game.height).toBe(std.height)
    expect(getPropsForRoomType('game-den')).not.toEqual(getPropsForRoomType('standard'))
    expect(game.propSlots.map((p) => p.type)).toEqual(getPropsForRoomType('game-den'))
  })
})

// ---------------------------------------------------------------------------
// OfficeRooms.updateRoom resize animation
// ---------------------------------------------------------------------------

describe('OfficeRooms.updateRoom', () => {
  it('tweens container scale when room dimensions change', () => {
    vi.spyOn(OfficeRooms.prototype, 'drawRoomBackground').mockImplementation(() => {})

    const layout1 = computeRoomLayout(1, 'standard')
    const layout4 = computeRoomLayout(4, 'standard')
    const tweensAdd = vi.fn((config: Record<string, unknown>) => ({
      destroy: vi.fn(),
      cfg: config,
    }))
    const scene = { tweens: { add: tweensAdd } } as unknown as Phaser.Scene

    const host: RoomsHostScene = {
      atmosphere: {} as RoomsHostScene['atmosphere'],
      calcRoomSize: vi.fn((count: number) => {
        const l = computeRoomLayout(count, 'standard')
        return { width: l.width, height: l.height }
      }),
      syncWorkstations: vi.fn(),
      updateRoomActivity: vi.fn(),
      destroyWorkstation: vi.fn(),
      formatLabel: (s) => s,
    }

    const rooms = new OfficeRooms(scene, host)
    const setScale = vi.fn()
    const room = {
      cwd: '/proj/standard',
      width: layout1.width,
      height: layout1.height,
      agents: [] as AgentState[],
      container: { setScale } as unknown as Room['container'],
      doorFrameGraphics: { active: false } as unknown as Room['doorFrameGraphics'],
      doorPulseTween: null,
    } as unknown as Room

    const fourAgents = [{}, {}, {}, {}] as AgentState[]
    rooms.updateRoom(room, fourAgents)

    expect(setScale).toHaveBeenCalledWith(
      layout1.width / layout4.width,
      layout1.height / layout4.height,
    )
    expect(tweensAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        targets: room.container,
        scaleX: 1,
        scaleY: 1,
        duration: 300,
        ease: 'Sine.easeOut',
      }),
    )

    vi.mocked(OfficeRooms.prototype.drawRoomBackground).mockRestore()
  })

  it('does not add resize tween when dimensions unchanged', () => {
    vi.spyOn(OfficeRooms.prototype, 'drawRoomBackground').mockImplementation(() => {})

    const layout2 = computeRoomLayout(2, 'standard')
    const tweensAdd = vi.fn()
    const scene = { tweens: { add: tweensAdd } } as unknown as Phaser.Scene
    const host: RoomsHostScene = {
      atmosphere: {} as RoomsHostScene['atmosphere'],
      calcRoomSize: vi.fn().mockReturnValue({ width: layout2.width, height: layout2.height }),
      syncWorkstations: vi.fn(),
      updateRoomActivity: vi.fn(),
      destroyWorkstation: vi.fn(),
      formatLabel: (s) => s,
    }
    const rooms = new OfficeRooms(scene, host)
    const setScale = vi.fn()
    const room = {
      cwd: '/proj/standard',
      width: layout2.width,
      height: layout2.height,
      agents: [] as AgentState[],
      container: { setScale } as unknown as Room['container'],
      doorFrameGraphics: { active: false } as unknown as Room['doorFrameGraphics'],
      doorPulseTween: null,
    } as unknown as Room

    rooms.updateRoom(room, [{} as AgentState, {} as AgentState])

    expect(tweensAdd).not.toHaveBeenCalled()
    expect(setScale).not.toHaveBeenCalled()

    vi.mocked(OfficeRooms.prototype.drawRoomBackground).mockRestore()
  })
})

// ---------------------------------------------------------------------------
// OfficeUI.applyLodToWorkstation — lodLevel2 / lodLevel3
// ---------------------------------------------------------------------------

describe('OfficeUI.applyLodToWorkstation', () => {
  it('1→2 shows L2 objects and container; 2→3 shows L3; 3→2 fades L3 out; 2→1 hides container and L2/L3', () => {
    const { scene, tweensAdd } = makeLodScene()
    const ui = new OfficeUI(scene)
    const ws = makeWorkstationForLod()

    ui.applyLodToWorkstation(ws, 2, false)
    expect(ws.container.visible).toBe(true)
    for (const o of ws.lodLevel2Objects) {
      expect((o as unknown as { visible: boolean }).visible).toBe(true)
    }

    ui.applyLodToWorkstation(ws, 3, false)
    for (const o of ws.lodLevel3Objects) {
      expect((o as unknown as { visible: boolean }).visible).toBe(true)
    }
    for (const o of ws.lodLevel2Objects) {
      expect((o as unknown as { visible: boolean }).visible).toBe(true)
    }

    ui.applyLodToWorkstation(ws, 2, false)
    for (const o of ws.lodLevel3Objects) {
      expect((o as unknown as { visible: boolean }).visible).toBe(false)
    }

    ui.applyLodToWorkstation(ws, 1, false)
    expect(ws.container.visible).toBe(false)
    for (const o of ws.lodLevel2Objects) {
      expect((o as unknown as { visible: boolean }).visible).toBe(false)
    }
    for (const o of ws.lodLevel3Objects) {
      expect((o as unknown as { visible: boolean }).visible).toBe(false)
    }

    expect(tweensAdd).toHaveBeenCalled()
  })

  it('is a no-op when LOD level unchanged', () => {
    const { scene, tweensAdd } = makeLodScene()
    const ui = new OfficeUI(scene)
    const ws = makeWorkstationForLod()
    ui.applyLodToWorkstation(ws, 2, false)
    const n = tweensAdd.mock.calls.length
    ui.applyLodToWorkstation(ws, 2, false)
    expect(tweensAdd.mock.calls.length).toBe(n)
  })
})

// ---------------------------------------------------------------------------
// RoomVisibilityManager
// ---------------------------------------------------------------------------

describe('RoomVisibilityManager', () => {
  let emitSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    emitSpy = vi.spyOn(EventBus, 'emit').mockImplementation(() => {})
  })

  afterEach(() => {
    emitSpy.mockRestore()
  })

  function makeCamera(
    scrollX: number,
    scrollY: number,
    width: number,
    height: number,
    zoom: number,
  ): Phaser.Cameras.Scene2D.Camera {
    return { scrollX, scrollY, width, height, zoom } as Phaser.Cameras.Scene2D.Camera
  }

  function makeManagedObject() {
    const o = {
      active: false,
      visible: false,
      setActive(v: boolean) {
        this.active = v
      },
      setVisible(v: boolean) {
        this.visible = v
      },
    }
    return o
  }

  it('enables objects when room bounds intersect padded viewport; disables when not', () => {
    const mgr = new RoomVisibilityManager()
    const insideObj = makeManagedObject()
    const outsideObj = makeManagedObject()

    mgr.registerRoom({
      id: 'inside',
      bounds: { x: 0, y: 0, width: 200, height: 200 },
      objects: [insideObj as unknown as Phaser.GameObjects.GameObject],
    })
    mgr.registerRoom({
      id: 'outside',
      bounds: { x: 5000, y: 0, width: 100, height: 100 },
      objects: [outsideObj as unknown as Phaser.GameObjects.GameObject],
    })

    const cam = makeCamera(0, 0, 800, 600, 1)
    mgr.update(cam)

    expect(mgr.isRoomActive('inside')).toBe(true)
    expect(mgr.isRoomActive('outside')).toBe(false)
    expect(insideObj.active).toBe(true)
    expect(insideObj.visible).toBe(true)
    expect(outsideObj.active).toBe(false)

    emitSpy.mockClear()
    mgr.update(makeCamera(4800, 0, 800, 600, 1))

    expect(mgr.isRoomActive('inside')).toBe(false)
    expect(mgr.isRoomActive('outside')).toBe(true)
    expect(emitSpy).toHaveBeenCalledWith(EVENTS.ROOM_EXITED, 'inside')
    expect(emitSpy).toHaveBeenCalledWith(EVENTS.ROOM_ENTERED, 'outside')
  })

  it('enableRoom / disableRoom force state when id not in active set', () => {
    const mgr = new RoomVisibilityManager()
    const o = makeManagedObject()
    mgr.registerRoom({
      id: 'r1',
      bounds: { x: 10000, y: 10000, width: 10, height: 10 },
      objects: [o as unknown as Phaser.GameObjects.GameObject],
    })
    mgr.update(makeCamera(0, 0, 400, 300, 1))
    expect(mgr.isRoomActive('r1')).toBe(false)

    mgr.enableRoom('r1')
    expect(mgr.isRoomActive('r1')).toBe(true)
    expect(o.active).toBe(true)

    mgr.disableRoom('r1')
    expect(mgr.isRoomActive('r1')).toBe(false)
    expect(o.active).toBe(false)
  })

  it('getActiveRooms returns current id set', () => {
    const mgr = new RoomVisibilityManager()
    mgr.registerRoom({
      id: 'a',
      bounds: { x: 0, y: 0, width: 50, height: 50 },
      objects: [],
    })
    mgr.update(makeCamera(0, 0, 100, 100, 1))
    expect(mgr.getActiveRooms().has('a')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// getTeamInfo
// ---------------------------------------------------------------------------

describe('getTeamInfo', () => {
  it('maps __unassigned__ to Unassigned label', () => {
    expect(getTeamInfo('__unassigned__')).toEqual({
      key: '__unassigned__',
      label: 'Unassigned',
    })
  })

  it('uses parent segment as key when path has at least three segments', () => {
    expect(getTeamInfo('/a/b/c')).toEqual({ key: 'b', label: 'b' })
    expect(getTeamInfo('/a/b/c/')).toEqual({ key: 'b', label: 'b' })
  })

  it('uses leaf for two-segment unix paths', () => {
    expect(getTeamInfo('/foo/bar')).toEqual({ key: 'bar', label: 'bar' })
  })

  it('documents current behavior for backslash-only Windows-style cwd (no path split)', () => {
    const win = 'C:\\proj\\team\\repo'
    expect(getTeamInfo(win)).toEqual({ key: win, label: win })
  })
})
