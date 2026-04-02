/**
 * Facility-scoped lab layout: OfficeScene merges one computeLabLayout per lab room
 * so strategic anchors use each room's floor rect (no union-wide stacking in the corridor).
 */
import { describe, expect, it } from 'vitest'
import { computeLabLayout } from '../../../src/renderer/src/game/lab-layout-engine'
import {
  labRoomFloorWorldRect,
  collectFacilityDeskPositionsWorld,
  hashFacilityLabProps,
} from '../../../src/renderer/src/game/lab-facility-geometry'
import { ROOM_GAP } from '../../../src/renderer/src/game/office-constants'
import { computeStrategicReferencePlacements } from '../../../src/renderer/src/game/lab-strategic-layout'
import { LAB_PROP_FRAMES as LP } from '../../../src/renderer/src/game/lab-prop-frames.generated'

function mergePerRoomLayouts(
  rooms: Array<{
    x: number
    y: number
    width: number
    height: number
    cwd: string
    agents: { id: string }[]
    doorSide: 'top' | 'bottom'
  }>,
) {
  const allProps: { x: number; y: number }[] = []
  const sorted = [...rooms].sort((a, b) => labRoomFloorWorldRect(a).x - labRoomFloorWorldRect(b).x)
  for (let i = 0; i < sorted.length; i++) {
    const room = sorted[i]!
    const floorRect = labRoomFloorWorldRect(room)
    const desks = collectFacilityDeskPositionsWorld([room])
    const hash = hashFacilityLabProps([room])
    const strategicWing: 'west' | 'east' =
      sorted.length >= 2 && i === sorted.length - 1 ? 'east' : 'west'
    const { propPlacements } = computeLabLayout(
      floorRect.x, floorRect.y, floorRect.width, floorRect.height,
      hash, desks, undefined,
      { floorClipRects: [floorRect], strategicWing },
    )
    allProps.push(...propPlacements)
  }
  return allProps
}

function inAnyFloorRect(
  x: number,
  y: number,
  rects: Array<{ x: number; y: number; width: number; height: number }>,
): boolean {
  return rects.some(r => x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height)
}

describe('lab facility layout', () => {
  it('keeps merged facility props inside each room floor (not in the inter-zone gap)', () => {
    const w = 600
    const h = 460
    const cy = 400

    const r1cx = 300
    const r2cx = r1cx + w / 2 + ROOM_GAP + w / 2

    const roomA = {
      x: r1cx,
      y: cy,
      width: w,
      height: h,
      cwd: '/org/atlas',
      agents: [] as { id: string }[],
      doorSide: 'top' as const,
    }
    const roomB = {
      x: r2cx,
      y: cy,
      width: w,
      height: h,
      cwd: '/org/sidekick',
      agents: [] as { id: string }[],
      doorSide: 'top' as const,
    }

    const floors = [labRoomFloorWorldRect(roomA), labRoomFloorWorldRect(roomB)]
    const merged = mergePerRoomLayouts([roomA, roomB])
    expect(merged.length).toBeGreaterThan(12)

    expect(floors[1]!.x).toBeGreaterThan(floors[0]!.x + floors[0]!.width)

    for (const p of merged) {
      expect(inAnyFloorRect(p.x, p.y, floors)).toBe(true)
    }
  })

  it('JSON strategic layout resolves frames and emits props on an open floor (v10+ minimal silhouette)', () => {
    const placements = computeStrategicReferencePlacements(
      0,
      0,
      400,
      300,
      [{ x: -9000, y: -9000 }],
      0xabc,
    )
    expect(placements.length).toBeGreaterThan(6)
  })

  it('computeLabLayout strategicMode none yields empty placements', () => {
    const r = computeLabLayout(0, 0, 400, 300, 42, [{ x: 50, y: 50 }], undefined, {
      strategicMode: 'none',
    })
    expect(r.propPlacements).toEqual([])
    expect(r.glowPlacements).toEqual([])
  })

  it('clipped facility pass adds no glow and no loose KEYBOARD on strategic art', () => {
    const w = 520
    const h = 420
    const floorRect = { x: 2000, y: 100, width: w, height: h }
    const r = computeLabLayout(floorRect.x, floorRect.y, w, h, 9, [], undefined, {
      floorClipRects: [floorRect],
    })
    expect(r.glowPlacements.length).toBe(0)
    expect(r.propPlacements.some(p => p.frame === LP.KEYBOARD)).toBe(false)
    expect(r.propPlacements.length).toBeGreaterThan(6)
  })

  it('minimal kit (v31) — north composed consoles, one center machine, south desk only', () => {
    const w = 520
    const h = 420
    const floorRect = { x: 2000, y: 100, width: w, height: h }
    const r = computeLabLayout(floorRect.x, floorRect.y, w, h, 9, [], undefined, {
      floorClipRects: [floorRect],
    })
    expect(r.propPlacements.length).toBeGreaterThan(6)
    const frames = new Set(r.propPlacements.map(p => p.frame))
    expect(
      frames.has(LP.BLANK_CONSOLE_LONG) ||
        frames.has(LP.BLANK_CONSOLE_SHORT) ||
        frames.has(LP.BLANK_CONSOLE_CORNER),
    ).toBe(true)
    expect(frames.has(LP.LAB_MACHINE_01)).toBe(true)
    expect(frames.has(LP.DESK_TOP_LONG)).toBe(true)
    expect(frames.has(LP.LASER_HEAD)).toBe(false)
    expect(frames.has(LP.GENERATOR)).toBe(false)
  })

  it('east strategicWing mirrors BLANK_CONSOLE_LONG across room midline vs west', () => {
    const floorX = 2000
    const floorW = 520
    const floorH = 420
    const hash = 7
    const west = computeLabLayout(floorX, 100, floorW, floorH, hash, [], undefined, {})
    const east = computeLabLayout(floorX, 100, floorW, floorH, hash, [], undefined, {
      strategicWing: 'east',
    })
    const wLong = west.propPlacements.filter(p => p.frame === LP.BLANK_CONSOLE_LONG)
    const eLong = east.propPlacements.filter(p => p.frame === LP.BLANK_CONSOLE_LONG)
    expect(wLong.length).toBeGreaterThan(0)
    expect(eLong.length).toBe(wLong.length)
    const mid = floorX + floorW / 2
    for (const wl of wLong) {
      const mirroredX = 2 * mid - wl.x
      expect(eLong.some(el => Math.abs(el.x - mirroredX) < 4)).toBe(true)
    }
  })
})
