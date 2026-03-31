// ---------------------------------------------------------------------------
// Combined Lab / Office layout — one building each, columns by cwd.
// ---------------------------------------------------------------------------

import type { Room, LabZoneBand } from './office-types'
import {
  LAB_COMBINED_TEAM_KEY,
  LAB_ZONE_DIRECTORY_GAP,
  OFFICE_COMBINED_TEAM_KEY,
  ROOM_GAP,
  TEAM_AREA_PAD_X,
  TEAM_AREA_PAD_Y,
  TEAM_LABEL_H,
} from './office-constants'
import { directoryZoneKeyForLab, roomIsLabDuderRoom } from './office-helpers'

function widestInList(rooms: Room[]): number {
  if (rooms.length === 0) return 100
  return rooms.reduce((m, r) => Math.max(m, r.width), 0)
}

export function shortDirectoryLabel(cwd: string): string {
  const n = cwd.replace(/\/$/, '')
  if (!n || n === '__unassigned__') return 'Unassigned'
  const parts = n.split('/').filter(Boolean)
  if (parts.length <= 2) return parts.join('/') || n
  return parts.slice(-2).join('/')
}

export function partitionRoomsByLabCampus(roomList: Room[]): {
  labRooms: Room[]
  campusRooms: Room[]
} {
  const campusRooms: Room[] = []
  const labRooms: Room[] = []
  for (const room of roomList) {
    if (roomIsLabDuderRoom(room)) {
      labRooms.push(room)
    } else {
      campusRooms.push(room)
    }
  }
  return { labRooms, campusRooms }
}

export type CombinedDirectoryDraft = {
  teamKey: string
  teamLabel: string
  rooms: Room[]
  roomLocalPos: Map<Room, { x: number; y: number }>
  width: number
  height: number
  directoryZones: LabZoneBand[]
}

function buildCombinedDirectoryZonedDraft(
  rooms: Room[],
  preferredTeamWidth: number,
  teamKey: string,
  teamLabel: string,
): CombinedDirectoryDraft {
  const areaPadX = TEAM_AREA_PAD_X
  const areaPadY = TEAM_AREA_PAD_Y
  const teamLabelH = TEAM_LABEL_H
  const zoneGap = LAB_ZONE_DIRECTORY_GAP

  const zoneMap = new Map<string, Room[]>()
  for (const room of rooms) {
    const zk = directoryZoneKeyForLab(room.cwd)
    if (!zoneMap.has(zk)) zoneMap.set(zk, [])
    zoneMap.get(zk)!.push(room)
  }
  const zoneKeys = Array.from(zoneMap.keys()).sort((a, b) => a.localeCompare(b))
  for (const zk of zoneKeys) {
    zoneMap.get(zk)!.sort((a, b) => a.label.localeCompare(b.label))
  }

  const roomLocalPos = new Map<Room, { x: number; y: number }>()
  const directoryZones: LabZoneBand[] = []

  let zoneLeft = areaPadX
  let globalContentH = 0

  const zoneInnerCap = Math.max(200, Math.min(520, Math.floor(preferredTeamWidth * 0.95)))

  for (const zk of zoneKeys) {
    const zRooms = zoneMap.get(zk)!
    const zoneWidest = Math.max(...zRooms.map(r => r.width), 100)
    const zoneInnerMaxW = Math.max(160, Math.min(zoneInnerCap, zoneWidest * 3 + ROOM_GAP * 3))

    let cx = 0
    let cy = 0
    let rowH = 0
    let zoneMaxX = 0

    for (const room of zRooms) {
      if (cx > 0 && cx + room.width > zoneInnerMaxW) {
        zoneMaxX = Math.max(zoneMaxX, cx - ROOM_GAP)
        cx = 0
        cy += rowH + ROOM_GAP
        rowH = 0
      }
      roomLocalPos.set(room, {
        x: zoneLeft + cx + room.width / 2,
        y: areaPadY + teamLabelH + cy + room.height / 2,
      })
      cx += room.width + ROOM_GAP
      rowH = Math.max(rowH, room.height)
    }
    zoneMaxX = Math.max(zoneMaxX, cx - ROOM_GAP)
    const zoneH = cy + rowH
    globalContentH = Math.max(globalContentH, zoneH)

    directoryZones.push({
      x: zoneLeft,
      width: Math.max(zoneMaxX, zoneWidest),
      label: shortDirectoryLabel(zk === '__unassigned__' ? '__unassigned__' : zk),
    })

    zoneLeft += zoneMaxX + zoneGap
  }

  const contentWidth = zoneLeft - zoneGap + areaPadX
  const teamMinWidth = Math.max(150, widestInList(rooms) + areaPadX * 2)
  const teamWidth = Math.max(teamMinWidth, contentWidth)
  const teamHeight = Math.max(115, areaPadY * 2 + teamLabelH + globalContentH)

  return {
    teamKey,
    teamLabel,
    rooms,
    roomLocalPos,
    width: teamWidth,
    height: teamHeight,
    directoryZones,
  }
}

/** One merged Lab building — all lab-skinned rooms, columns by cwd. */
export function buildCombinedLabTeamDraft(
  labRooms: Room[],
  preferredTeamWidth: number,
): CombinedDirectoryDraft {
  return buildCombinedDirectoryZonedDraft(
    labRooms,
    preferredTeamWidth,
    LAB_COMBINED_TEAM_KEY,
    'Lab',
  )
}

/** One merged Office building — all campus rooms, columns by cwd. */
export function buildCombinedOfficeTeamDraft(
  campusRooms: Room[],
  preferredTeamWidth: number,
): CombinedDirectoryDraft {
  return buildCombinedDirectoryZonedDraft(
    campusRooms,
    preferredTeamWidth,
    OFFICE_COMBINED_TEAM_KEY,
    'Office',
  )
}
