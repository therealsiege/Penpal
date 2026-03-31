// ---------------------------------------------------------------------------
// office-layout.ts
// Unified layout engine: room sizing, desk grid, and prop placement.
// Pure math — no Phaser dependency.
// ---------------------------------------------------------------------------

import type { PropType } from './interactive-props'
import {
  WORKSTATION_W,
  WORKSTATION_H,
  ROOM_PADDING,
  ROOM_TOP_EXTRA,
  ROOM_HEADER_H,
  MAX_AGENTS_PER_ROW,
  LAB_EQUIP_ZONE_H,
} from './office-constants'

export { PropType }

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Width of the right-wall prop strip added to every room. */
export const PROP_STRIP_W = 60

// Shared wall geometry constants (mirrored from calcRoomSize / layoutWorkstations)
const WALL_T = 8
const WALL_I = 4
const DOOR_CLEARANCE = 30

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RoomLayout {
  /** Total room width including prop strip. */
  width: number
  /** Total room height (same formula as current calcRoomSize). */
  height: number
  /**
   * Desk center positions expressed relative to the room's world-space center
   * (i.e. room.x, room.y). Matches the coordinate frame used by layoutWorkstations.
   */
  deskPositions: { x: number; y: number }[]
  /** Prop type + position relative to room center, inside the right-wall strip. */
  propSlots: { type: PropType; x: number; y: number }[]
  /** Bounding rect of the desk grid area, relative to room center. */
  deskArea: { x: number; y: number; width: number; height: number }
  /** Bounding rect of the prop strip, relative to room center. */
  propArea: { x: number; y: number; width: number; height: number }
}

// ---------------------------------------------------------------------------
// Room-type → prop assignments
// ---------------------------------------------------------------------------

const ROOM_PROPS: Record<string, PropType[]> = {
  'design-studio':  ['whiteboard', 'mako-lamp'],
  'server-room':    ['server-rack', 'lava-lamp'],
  'mobile-lab':     ['mako-lamp', 'coffee-machine'],
  'game-den':       ['arcade', 'fish-tank'],
  'creative-suite': ['whiteboard', 'trophy-shelf'],
  'ops-center':     ['server-rack', 'printer'],
  'qa-lab':         ['coffee-machine', 'lava-lamp'],
  'standard':       ['plant', 'mako-lamp'],
}

/**
 * Returns the ordered list of prop types for a given room type.
 * Falls back to the standard set for unrecognised types.
 */
export function getPropsForRoomType(roomType: string): PropType[] {
  return ROOM_PROPS[roomType] ?? ROOM_PROPS['standard']
}

// ---------------------------------------------------------------------------
// Room-type detection (mirrors room-renderer.ts — kept here so this module
// has no dependency on Phaser or on room-renderer itself)
// ---------------------------------------------------------------------------

const ROOM_TYPE_KEYWORDS: [string[], string][] = [
  [['renderer', 'frontend', 'ui', 'web', 'nextjs'],     'design-studio'],
  [['backend', 'api', 'server', 'graph', 'etl'],         'server-room'],
  [['mobile', 'expo', 'ios', 'android'],                 'mobile-lab'],
  [['game', 'phaser', 'unity'],                          'game-den'],
  [['docs', 'content', 'blog', 'marketing'],             'creative-suite'],
  [['infra', 'deploy', 'ci', 'docker'],                  'ops-center'],
  [['test', 'qa', 'spec'],                               'qa-lab'],
]

/**
 * Derives a room type string from a filesystem cwd path by matching path
 * segments against keyword lists. Returns 'standard' when no match is found.
 */
export function detectRoomType(cwd: string): string {
  const lower = cwd.toLowerCase()
  const segments = lower.split(/[\\/]/)
  for (const [keywords, type] of ROOM_TYPE_KEYWORDS) {
    for (const kw of keywords) {
      if (segments.some((seg) => seg.includes(kw))) return type
    }
  }
  return 'standard'
}

// ---------------------------------------------------------------------------
// Core layout computation
// ---------------------------------------------------------------------------

/**
 * Computes the complete layout for a room: dimensions, desk grid positions,
 * prop strip slots, and usable area boundaries.
 *
 * All desk positions and area rects are expressed relative to the room's
 * world-space center (room.x / room.y), matching the coordinate convention
 * used by layoutWorkstations and calcRoomSize.
 *
 * @param agentCount  Number of agents (desks) in the room.
 * @param roomType    Room type string from detectRoomType() or getRoomType().
 * @param doorSide    Which side the door is on ('top' | 'bottom'); affects
 *                    which desk rows are packed away from the door.
 */
export function computeRoomLayout(
  agentCount: number,
  roomType: string,
  doorSide: 'top' | 'bottom' = 'bottom',
): RoomLayout {
  const n    = Math.max(1, agentCount)
  const cols = Math.min(n, MAX_AGENTS_PER_ROW)
  const rows = Math.ceil(n / cols)

  // -------------------------------------------------------------------------
  // 1. Base room dimensions (same formula as calcRoomSize, minus prop strip)
  // -------------------------------------------------------------------------

  const wallBorder = (WALL_T + WALL_I + ROOM_PADDING) * 2
  const LAB_SIDE_PAD = 100  // side margins for equipment within zone
  const baseWidth =
    wallBorder + cols * WORKSTATION_W + LAB_SIDE_PAD
  const height =
    (WALL_T + WALL_I) * 2 + ROOM_HEADER_H + ROOM_PADDING * 2 + ROOM_TOP_EXTRA +
    LAB_EQUIP_ZONE_H +  // equipment shelf at top
    rows * WORKSTATION_H + DOOR_CLEARANCE + 60  // extra bottom for equipment

  // Zone width — big enough for properly-scaled lab props (consoles at 3x, tanks at 2.5x)
  const MIN_ROOM_W = 520
  const MIN_ROOM_H = 400
  const width = Math.max(MIN_ROOM_W, baseWidth + PROP_STRIP_W)
  const finalHeight = Math.max(MIN_ROOM_H, height)

  // -------------------------------------------------------------------------
  // 2. Desk grid — mirrors layoutWorkstations positioning math
  // -------------------------------------------------------------------------

  const topDoorPad = doorSide === 'top' ? DOOR_CLEARANCE : 0
  const botDoorPad = doorSide === 'bottom' ? DOOR_CLEARANCE : 0

  // Desk area starts at top-left of the usable interior, relative to room center
  const deskAreaX = -width / 2 + WALL_T + WALL_I + ROOM_PADDING
  // Header bar is at the bottom of the room; desk area starts below equipment zone
  const deskAreaY = -finalHeight / 2 + WALL_T + WALL_I + ROOM_PADDING + ROOM_TOP_EXTRA + LAB_EQUIP_ZONE_H + topDoorPad

  const usableW = baseWidth - wallBorder           // cols * WORKSTATION_W
  const usableH =
    finalHeight -
    (WALL_T + WALL_I) * 2 -
    ROOM_HEADER_H -
    ROOM_PADDING * 2 -
    ROOM_TOP_EXTRA -
    topDoorPad -
    botDoorPad

  const cellW = usableW / cols
  const cellH = usableH / rows
  const flipRows = doorSide === 'top'

  const deskPositions: { x: number; y: number }[] = []
  for (let i = 0; i < n; i++) {
    const col = i % cols
    const row = Math.floor(i / cols)
    const effectiveRow = flipRows ? rows - 1 - row : row
    deskPositions.push({
      x: deskAreaX + col * cellW + cellW / 2,
      y: deskAreaY + effectiveRow * cellH + cellH / 2,
    })
  }

  const deskArea = {
    x:      deskAreaX,
    y:      deskAreaY,
    width:  usableW,
    height: usableH,
  }

  // -------------------------------------------------------------------------
  // 3. Prop strip — right-hand 60px column of the room
  // -------------------------------------------------------------------------

  // Strip left edge relative to room center
  const propAreaX = width / 2 - PROP_STRIP_W
  const propAreaY = -finalHeight / 2 + WALL_T + WALL_I

  const propAreaH = finalHeight - (WALL_T + WALL_I) * 2 - ROOM_HEADER_H

  const propArea = {
    x:      propAreaX,
    y:      propAreaY,
    width:  PROP_STRIP_W,
    height: propAreaH,
  }

  // Distribute props evenly along the vertical centre of the strip
  const propTypes = getPropsForRoomType(roomType)
  const count = propTypes.length
  const propCenterX = propAreaX + PROP_STRIP_W / 2

  const propSlots: { type: PropType; x: number; y: number }[] = propTypes.map(
    (type, idx) => ({
      type,
      x: propCenterX,
      // Divide strip height into (count + 1) equal segments and place at each division
      y: propAreaY + propAreaH * ((idx + 1) / (count + 1)),
    }),
  )

  return {
    width,
    height: finalHeight,
    deskPositions,
    propSlots,
    deskArea,
    propArea,
  }
}
