// ---------------------------------------------------------------------------
// Lab facility geometry — world-space room floor rects + desk positions.
// OfficeScene runs computeLabLayout once per lab room, then merges sprites (see rebuildLabFacilityProps).
// ---------------------------------------------------------------------------

import { ROOM_HEADER_H } from './office-constants'
import { computeRoomLayout, detectRoomType } from './office-layout'
import type { Room } from './office-types'

/** Usable floor in world space (room center convention matches office-layout). */
export function labRoomFloorWorldRect(room: {
  x: number
  y: number
  width: number
  height: number
}): { x: number; y: number; width: number; height: number } {
  const w = room.width
  const h = room.height
  const floorH = h - ROOM_HEADER_H
  return {
    x: room.x - w / 2,
    y: room.y - h / 2,
    width: w,
    height: floorH,
  }
}

export function unionWorldRects(
  rects: Array<{ x: number; y: number; width: number; height: number }>,
): { x: number; y: number; width: number; height: number } | null {
  if (rects.length === 0) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const r of rects) {
    const rx2 = r.x + r.width
    const ry2 = r.y + r.height
    minX = Math.min(minX, r.x)
    minY = Math.min(minY, r.y)
    maxX = Math.max(maxX, rx2)
    maxY = Math.max(maxY, ry2)
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

export function collectFacilityDeskPositionsWorld(
  rooms: Array<Pick<Room, 'x' | 'y' | 'cwd' | 'agents' | 'doorSide'>>,
): Array<{ x: number; y: number }> {
  const out: Array<{ x: number; y: number }> = []
  for (const room of rooms) {
    const roomType = detectRoomType(room.cwd)
    const layout = computeRoomLayout(room.agents.length, roomType, room.doorSide ?? 'bottom')
    for (const d of layout.deskPositions) {
      out.push({ x: room.x + d.x, y: room.y + d.y })
    }
  }
  return out
}

/** Stable hash from sorted cwd list so facility props don’t jitter across frames. */
export function hashFacilityLabProps(rooms: Array<{ cwd: string }>): number {
  const key = [...rooms].map(r => r.cwd).sort().join('\0')
  let h = 0
  for (let i = 0; i < key.length; i++) {
    h = ((h << 5) - h) + key.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}
