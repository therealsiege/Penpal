// ---------------------------------------------------------------------------
// office-constants.ts
// All module-level constants extracted from OfficeScene.ts.
// No imports required — all values are primitives.
// ---------------------------------------------------------------------------

// Global text scale — multiplied into all fontSize values
export const TEXT_SCALE = 1.5

/** Scale a pixel font size by TEXT_SCALE and return as CSS string, e.g. '15px' */
export function scaledFontSize(basePx: number): string {
  return `${Math.round(basePx * TEXT_SCALE)}px`
}

// Keyboard shortcut constants
export const KB_ZOOM_STEP = 0.15
export const KB_AUTO_PAN_INTERVAL = 3000

// ---------------------------------------------------------------------------
// Spritesheet constants
// ---------------------------------------------------------------------------

export const CHAR_FRAME_W = 256
export const CHAR_FRAME_H = 512
export const CHAR_COLS    = 6
export const NUM_CHARS    = 3  // Character 1, Character 2, Character 1 tinted

// ---------------------------------------------------------------------------
// RPG 8-direction character spritesheet (characters-rpg.png)
// ---------------------------------------------------------------------------

/** Columns per row in the RPG character spritesheet (= max frames per row). */
export const RPG_CHAR_COLS           = 16
/** Total frames per character variant (8 walk dirs × 4 + 8 idle + 4 sit + 4 action). */
export const RPG_CHAR_FRAMES_PER_VAR = 48
/** Rows per character variant in the spritesheet (RPG_CHAR_FRAMES_PER_VAR / RPG_CHAR_COLS). */
export const RPG_CHAR_ROWS_PER_VAR   = 3   // 48 frames / 16 cols
/** Number of character variants in characters-rpg.png. */
export const RPG_NUM_CHARS           = 3
/** Walk animation frame rate (fps). */
export const RPG_WALK_FPS            = 8
/** Idle animation frame rate (fps). */
export const RPG_IDLE_FPS            = 4
/** Action animation frame rate (fps). */
export const RPG_ACTION_FPS          = 6

export const POSE_IDLE     = 0
export const POSE_INTERACT = 1
export const POSE_SIT      = 2
export const POSE_SURPRISE = 3
export const POSE_HURT     = 4
export const POSE_WALK     = 5

export const OFFICE_TILE_SIZE = 48
export const FRAME_CHAIR_DARK   = 112
export const FRAME_MONITOR      = 122

export const ROOM_TILE_SIZE = 48
export const LAB_TILE_SIZE  = 128

// GDS-exported scene dimensions (medium layout)
export const GDS_SCENE_WIDTH  = 3840
export const GDS_SCENE_HEIGHT = 2160

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

export const CHAR_SCALE      = 0.16
/** Desk grid cell size — console-desk at 0.38 ≈ 198×158px, cells match with gap for connectors */
export const WORKSTATION_W   = 210
export const WORKSTATION_H   = 130
export const ROOM_PADDING    = 18
export const ROOM_TOP_EXTRA  = 16   // extra top padding so desks + thought bubbles clear top wall
export const LAB_EQUIP_ZONE_H = 16  // minimal equip zone — props placed by layout engine
export const ROOM_HEADER_H   = 18
export const ROOM_GAP        = 50   // corridor space between zones
export const MAX_AGENTS_PER_ROW = 4
export const TEAM_AREA_PAD_X = 8
export const TEAM_AREA_PAD_Y = 8
export const TEAM_AREA_GAP_X = 4   // teams butt up against each other
export const TEAM_AREA_GAP_Y = 4
export const TEAM_LABEL_H = 16

export const WS_CHAIR_Y    = 5
export const WS_SPRITE_Y   = -4
export const WS_DESK_Y     = 16
export const WS_MONITOR_Y  = 4
export const WS_NAME_Y     = 34
export const WS_DOT_GAP    = 4
export const IDLE_WALK_BREAK_MIN_MS = 9000
export const IDLE_WALK_BREAK_VAR_MS = 7000
export const IDLE_WALK_RANGE_X = 20

// Colors
export const COLOR_BG          = 0x111827
/** Facility shell — deep navy to match vector sci‑fi lab reference */
export const COLOR_WALL        = 0x1a2744
export const COLOR_DESK_BODY   = 0x475569
export const COLOR_DESK_TOP    = 0x64748b
export const COLOR_HEADER_BG   = 0x0f172a
export const COLOR_DOOR_FRAME  = 0x3b82f6
export const COLOR_DOOR_FILL   = 0x0f172a
export const COLOR_DOOR_ACCENT = 0x3b82f6
export const COLOR_LED_GREEN   = 0x34d399
export const COLOR_LED_AMBER   = 0xfbbf24
export const COLOR_LED_GRAY    = 0x64748b

// Lab reskin desk colors (issue #144)
export const COLOR_LAB_DESK_BODY   = 0x1a3a52
export const COLOR_LAB_DESK_STROKE = 0x22d3ee
export const COLOR_LAB_DESK_STROKE_ALPHA = 0.4

export const WORLD_MARGIN   = 30

// Camera & navigation constants
export const ZOOM_MIN = 1.0
export const ZOOM_MAX = 4.0
export const ZOOM_FIT_MAX = 1.0
export const ZOOM_LERP_SPEED = 0.08
export const FOLLOW_LERP_SPEED = 0.06
// LOD thresholds — zoom boundaries between 3 detail levels
// Level 1 (zoom < LOD_L1_MAX): building overview — rooms as colored rects only
// Level 2 (LOD_L1_MAX..LOD_L2_MAX): room view — agents + desks, no micro-accessories
// Level 3 (zoom > LOD_L2_MAX): full detail — all accessories, particles, monitor content
export const LOD_L1_MAX = 0.9
export const LOD_L2_MAX = 1.5
export const POD_REFRESH_MS = 90
export const AMBIENT_MOTE_POOL_SIZE = 26
export const MAKO_MOTE_POOL_SIZE = 15
export const SPARK_POOL_SIZE = 12
export const STEAM_WISP_POOL_SIZE = 8

// Maximum active particles per pool type — hard caps enforced at spawn time.
export const MAX_RAIN_POOL        = 200
export const MAX_SNOW_POOL        = 150
export const MAX_MAKO_MOTE_POOL   = 50
export const MAX_SPARK_POOL       = 30
export const MAX_STEAM_WISP_POOL  = 20
export const MAX_AMBIENT_MOTE_POOL = 40

// Eval glow — success-rate indicator behind workstation desk (sidekick#18)
// Thresholds (successRate 0–1): green if >80%, amber if 60–80% inclusive, red if <60%, grey if no data.
export const EVAL_GLOW_GREEN   = 0x22c55e
export const EVAL_GLOW_AMBER   = 0xf59e0b
export const EVAL_GLOW_RED     = 0xef4444
export const EVAL_GLOW_GREY    = 0x6b7280
export const EVAL_GLOW_RADIUS  = 14
/** Object alpha pulse (issue: ~0.15 effective mid; tween 0.1 ↔ 0.2) */
export const EVAL_GLOW_ALPHA_MIN      = 0.1
export const EVAL_GLOW_ALPHA_MAX      = 0.2
export const EVAL_GLOW_PULSE_DURATION = 2000
export const EVAL_GLOW_REFRESH_MS     = 30_000

// Context utilization meter
export const CTX_METER_W = 30
export const CTX_METER_H = 4
export const CTX_GREEN = 0x22c55e
export const CTX_AMBER = 0xf59e0b
export const CTX_RED = 0xef4444
export const CTX_THRESHOLD_AMBER = 0.6
export const CTX_THRESHOLD_RED = 0.8
export const CTX_METER_BASE_ALPHA = 0.6
export const CTX_METER_PULSE_ALPHA_MIN = 0.4
export const CTX_METER_PULSE_ALPHA_MAX = 1.0
export const CTX_METER_PULSE_MS = 600
export const CTX_ROT_SHAKE_PX = 1
export const CTX_ROT_SHAKE_MS = 80
export const CTX_ROT_SHAKE_REPEATS = 3

// Thinking dots (best-of-N reasoning animation)
export const THINKING_DOT_RADIUS = 3
export const THINKING_DOT_SPACING = 10
/** Above agent head, between speech bubble band (~-40) and thought bubble (~-62) */
export const THINKING_DOT_Y = -55
/** Per-dot appear duration (issue #19: 0.3s each) */
export const THINKING_DOT_APPEAR_MS = 300
/** Shared fade-out duration after hold */
export const THINKING_DOT_FADE_MS = 300
/** Hold with all dots visible before fade (issue #19: 0.5s) */
export const THINKING_DOT_HOLD_MS = 500

// ---------------------------------------------------------------------------
// MCP connection line constants
// ---------------------------------------------------------------------------

/** Color per MCP server name — used for dashed connection lines in the game view */
export const MCP_SERVER_COLORS: Record<string, number> = {
  penny:     0x3b82f6, // blue
  serena:    0x22c55e, // green
  context7:  0x22d3ee, // cyan
  github:    0xc4ccd6, // grey-white
  neon:      0x4ade80, // green
  magic:     0xf472b6, // pink
  linear:    0x818cf8, // indigo
  firecrawl: 0xfb923c, // orange
  memory:    0xfbbf24, // amber
  notion:    0xf87171, // red
  'phaser-editor': 0x60a5fa, // blue
  'ddg-search':    0x38bdf8, // sky
  'sequential-thinking': 0xa78bfa, // purple
}
export const MCP_SERVER_COLOR_DEFAULT = 0x64748b // slate fallback

/** Redraw cadence for MCP connection lines (ms) — same as pod lines */
export const MCP_REFRESH_MS = 90

/** Offset from room right edge for the MCP icon cluster */
export const MCP_ICON_CLUSTER_OFFSET_X = 70
export const MCP_ICON_CLUSTER_SPACING_Y = 14
export const MCP_DASH_LENGTH = 4
export const MCP_DASH_GAP = 4
