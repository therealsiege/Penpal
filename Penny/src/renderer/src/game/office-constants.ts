// ---------------------------------------------------------------------------
// office-constants.ts
// All module-level constants extracted from OfficeScene.ts.
// No imports required — all values are primitives.
// ---------------------------------------------------------------------------

// Keyboard shortcut constants
export const KB_ZOOM_STEP = 0.15
export const KB_ZOOM_DURATION = 200
export const KB_PAN_DURATION = 400
export const KB_AUTO_PAN_INTERVAL = 3000

// ---------------------------------------------------------------------------
// Spritesheet constants
// ---------------------------------------------------------------------------

export const CHAR_FRAME_W = 256
export const CHAR_FRAME_H = 512
export const CHAR_COLS    = 6
export const NUM_CHARS    = 3  // Character 1, Character 2, Character 1 tinted

export const POSE_IDLE     = 0
export const POSE_INTERACT = 1
export const POSE_SIT      = 2
export const POSE_SURPRISE = 3
export const POSE_HURT     = 4
export const POSE_WALK     = 5

// Compact spritesheet frame map (duder-compact / duder-compact-2)
// Row 1: idle(4 rotations) + walk(12 rotations) + sit(1) = 17 frames
// Rotation order: front, 3/4-right, side-right, back-right, back, back-left, side-left, 3/4-left, ...
export const COMPACT_COLS = 17
export const COMPACT_IDLE_START    = 0   // 4 frames: front, 3/4, side, back
export const COMPACT_WALK_START    = 4   // 12 frames: full rotation walk cycle
export const COMPACT_SIT_START     = 16  // 1 frame
// Walk rotation indices (offset from COMPACT_WALK_START)
// Step A (first walk pose): 8 directions
export const WALK_A_FRONT     = 0
export const WALK_A_FRONT_R   = 1
export const WALK_A_SIDE_R    = 2
export const WALK_A_BACK_R    = 3
export const WALK_A_BACK      = 4
export const WALK_A_BACK_L    = 5
export const WALK_A_SIDE_L    = 6
export const WALK_A_FRONT_L   = 7
// Step B (alternate walk pose): 4 key directions
export const WALK_B_FRONT     = 8
export const WALK_B_FRONT_R   = 9
export const WALK_B_SIDE_R    = 10
export const WALK_B_BACK_R    = 11

export const OFFICE_TILE_SIZE = 48
export const FRAME_CHAIR_DARK   = 112
export const FRAME_MONITOR      = 122

export const ROOM_TILE_SIZE = 48

// Office decoration frame indices
export const OFFICE_FRAME_PLANT      = 68
export const OFFICE_FRAME_PLANT_SM  = 53
export const OFFICE_FRAME_PICTURE    = 64
export const OFFICE_FRAME_PICTURE2   = 65
export const OFFICE_FRAME_PICTURE3   = 66
export const OFFICE_FRAME_BOOKSHELF  = 96
// Additional decorations
export const OFFICE_FRAME_PLANT_TALL    = 54
export const OFFICE_FRAME_CACTUS       = 55
export const OFFICE_FRAME_HANGING_PLANT = 67
export const OFFICE_FRAME_FERN         = 69
export const OFFICE_FRAME_MONSTERA     = 70
export const OFFICE_FRAME_CLOCK        = 63
export const OFFICE_FRAME_LAMP         = 115
export const OFFICE_FRAME_TRASH        = 119
export const OFFICE_FRAME_STORAGE      = 97
export const OFFICE_FRAME_FILE_CABINET = 98
export const OFFICE_FRAME_WATER_COOLER = 120
export const OFFICE_FRAME_WHITEBOARD   = 94
export const OFFICE_FRAME_MONITOR      = 122
export const OFFICE_FRAME_SOFA         = 102
export const OFFICE_FRAME_PRINTER      = 126

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

export const CHAR_SCALE      = 0.134
export const WORKSTATION_W   = 70 // ~20% tighter office footprint
export const WORKSTATION_H   = 77 // ~20% tighter office footprint
export const ROOM_PADDING    = 12
export const ROOM_TOP_EXTRA  = 30   // extra top padding so thought bubbles clear room headers
export const ROOM_HEADER_H   = 20
export const ROOM_GAP        = 18
export const MAX_AGENTS_PER_ROW = 4
export const TEAM_AREA_PAD_X = 18
export const TEAM_AREA_PAD_Y = 18
export const TEAM_AREA_GAP_X = 28
export const TEAM_AREA_GAP_Y = 40
export const TEAM_LABEL_H = 16

export const WS_CHAIR_Y    = 6
export const WS_SPRITE_Y   = -5
export const WS_DESK_Y     = 18
export const WS_MONITOR_Y  = 5
export const WS_NAME_Y     = 40
export const WS_DOT_GAP    = 4
export const IDLE_WALK_BREAK_MIN_MS = 9000
export const IDLE_WALK_BREAK_VAR_MS = 7000
export const IDLE_WALK_RANGE_X = 20

// Colors
export const COLOR_BG          = 0x111827
export const COLOR_ROOM_FLOOR  = 0x1e293b
export const COLOR_ROOM_FLOOR2 = 0x334155
export const COLOR_WALL        = 0x334155
export const COLOR_WALL_INNER  = 0x475569
export const COLOR_DESK_BODY   = 0x475569
export const COLOR_DESK_TOP    = 0x64748b
export const COLOR_HEADER_BG   = 0x0f172a
export const COLOR_DOOR_FRAME  = 0x3b82f6
export const COLOR_POD_EDGE    = 0x64748b
export const COLOR_POD_GROOVE  = 0x0f172a
export const COLOR_DOOR_FILL   = 0x0f172a
export const COLOR_DOOR_ACCENT = 0x3b82f6
export const COLOR_LED_GREEN   = 0x34d399
export const COLOR_LED_AMBER   = 0xfbbf24
export const COLOR_LED_GRAY    = 0x64748b

export const WORLD_MARGIN   = 30

// Camera & navigation constants
export const ZOOM_MIN = 0.4
export const ZOOM_MAX = 2.0
export const ZOOM_FIT_MAX = 1.14
export const ZOOM_LERP_SPEED = 0.08
export const FOLLOW_LERP_SPEED = 0.06
// LOD thresholds — zoom boundaries between 3 detail levels
// Level 1 (zoom < LOD_L1_MAX): building overview — rooms as colored rects only
// Level 2 (LOD_L1_MAX..LOD_L2_MAX): room view — agents + desks, no micro-accessories
// Level 3 (zoom > LOD_L2_MAX): full detail — all accessories, particles, monitor content
export const LOD_L1_MAX = 0.5
export const LOD_L2_MAX = 0.85
export const MINIMAP_W = 160
export const MINIMAP_H = 100
export const MINIMAP_MARGIN = 12
export const MINIMAP_BG = 0x0f172a
export const MINIMAP_ROOM_COLOR = 0x334155
export const MINIMAP_VIEWPORT_COLOR = 0x3b82f6
export const MINIMAP_REFRESH_MS = 120
export const TRIPLET_REFRESH_MS = 90
export const AMBIENT_MOTE_POOL_SIZE = 26
