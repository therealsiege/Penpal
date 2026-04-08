// office-asset-keys.ts
// Centralized registry of all Phaser asset keys used in the PenPal office game.
// Import from here instead of inlining string literals — prevents typos and
// makes key renames a single-file change.
//
// Keys are grouped by category and frozen at runtime.
// All names are UPPER_SNAKE_CASE; the string values match the keys passed to
// this.load.spritesheet / this.load.image / etc. in OfficeScene.preload().

// ---------------------------------------------------------------------------
// Spritesheets — tile / prop sheets
// ---------------------------------------------------------------------------

export const SPRITESHEET_KEYS = Object.freeze({
  /** Main character sheet — 17-frame rows (4 idle + 12 walk + 1 sit), 256x512 per frame */
  CHARACTERS: 'characters',
  /** Office prop tiles (chairs, monitors, desks, plants, etc.) */
  OFFICE: 'office',
  /** Room background tiles */
  ROOMS: 'rooms',
  /** Alt character variant 1 (compact duder style A) */
  DUDER_1: 'duder1',
  /** Alt character variant 2 (compact duder style B) */
  DUDER_2: 'duder2',
  /** Game icons: stars, medals, checkmark, square, status dots, badges, arrows */
  GAME_ICONS: 'game-icons',
  /** Flash VFX — 9 frames at 128x128 */
  EFFECTS_FLASH: 'game-effects-flash',
  /** White puff VFX — 25 frames at 128x128 */
  EFFECTS_PUFF: 'game-effects-puff',
  /** Explosion VFX — 9 frames at 128x128 */
  EFFECTS_EXPLOSION: 'game-effects-explosion',
  /** Black smoke VFX — 25 frames at 128x128 */
  EFFECTS_SMOKE: 'game-effects-smoke',
  /** Fart VFX — 9 frames at 128x128 */
  EFFECTS_FART: 'game-effects-fart',
  /** Lego brick XP bar segments — 5 frames at 16x8 (Blue, Green, Yellow, Red, Special) */
  LEGO_BAR: 'lego-bar',
  /** Game items: coffee cup, monitor, book, headphones, phone, pizza, palette, wrench, beer, first aid, camera, donut — 32x32 cells */
  GAME_ITEMS: 'game-items',
  /** Desk pet bodies — 6 frames at 24x24 (Brown, Green, Blue, Pink, Yellow, Grey) */
  DESK_PETS: 'desk-pets',
  /** HD game icons — 64x64 cells, frames 0-19 only (double-size for LOD3 detail) */
  GAME_ICONS_HD: 'game-icons-hd',
  /** Lego special items — 5 frames at 24x24 (Coin, Exclamation, Crate, Explosive, Grade A) */
  LEGO_SPECIALS: 'lego-specials',
  /** Desk pet face parts — 8 frames at 16x8 (4 eye pairs + 4 mouths) */
  DESK_PET_FACES: 'desk-pet-faces',
  /** Animated animal pets — 5 rows (Chicken, Teddy, Penguin, Ducky, Polar) x 12 idle frames, 64x64 */
  ANIMAL_PETS: 'animal-pets',
  /** Animal pet blink animation — same layout as ANIMAL_PETS */
  ANIMAL_PETS_BLINK: 'animal-pets-blink',
  /** Animal pet hurt frame — 5 rows x 1 frame, 64x64 */
  ANIMAL_PETS_HURT: 'animal-pets-hurt',
  /** Modern Office furniture tiles — 48x48 grid, 20 cols */
  OFFICE_FURNITURE: 'office-furniture',
  /** Kenney UI elements (Blue theme) — 32x32 cells, single row */
  KENNEY_UI: 'kenney-ui',
  /** Composable monster bodies — 6 frames at 32x32 */
  MONSTER_BODIES: 'monster-bodies',
  /** Composable monster eyes — 6 frames at 16x8 */
  MONSTER_EYES: 'monster-eyes',
  /** Composable monster mouths — 6 frames at 16x8 */
  MONSTER_MOUTHS: 'monster-mouths',
  /** HD medals spritesheet — full medals.png sliced into individual frames */
  MEDALS_HD: 'medals-hd',
  /** Lab props — 64x64 cells, 12 cols; built from Phaser.Resources/lab/props/SVGS */
  LAB_PROPS: 'lab-props',
  /** Lab pipes — 128x128 cells, 7 cols × 5 rows (35 frames). Pipe straights, T-connectors, crosses, caps, valves */
  LAB_PIPES: 'lab-pipes',
  /** Lab cables — 128x128 cells, 7 cols × 9 rows (63 frames). Cable routing, connectors, plugs */
  LAB_CABLES: 'lab-cables',
  /** Lab main tileset — 128x128 cells, 8 cols × 9 rows (72 frames). Hex floors, wall edges, transitions */
  LAB_MAIN_TILESET: 'lab-main-tileset',
  /** Lab smooth corners — 48x48 cells, 8 cols × 1 row (8 frames). Corner/edge transition pieces */
  LAB_SMOOTH: 'lab-smooth',
  /** GDS-exported medium lab scene — packed atlas with all scene sprites */
  GDS_MEDIUM: 'gds-medium',
  /** GDS world map — default start scene backdrop */
  GDS_WORLDMAP: 'gds-worldmap',
} as const)

// ---------------------------------------------------------------------------
// GDS scene layout JSON keys (loaded via this.load.json in BootScene)
// ---------------------------------------------------------------------------

export const GDS_SCENE_KEYS = Object.freeze({
  MEDIUM_LAYOUT: 'gds-medium-layout',
  LAB_MAP: 'gds-lab-map',
} as const)

// ---------------------------------------------------------------------------
// Standalone image keys (non-spritesheet)
// ---------------------------------------------------------------------------

export const IMAGE_KEYS = Object.freeze({
  /** Season HUD progress bar track (grey slider, 96x16) */
  SLIDER_TRACK: 'slider-track',
  /** Season HUD progress bar fill (blue slider, 96x16) */
  SLIDER_FILL: 'slider-fill',
  /** Horizontal divider line (decorative rule for panel sections) */
  DIVIDER: 'divider',
  /** Vertical slider track for workstation energy bar (grey, ~16x96) */
  VSLIDER_TRACK: 'vslider-track',
  /** Vertical slider fill for workstation energy bar (blue, ~16x96) */
  VSLIDER_FILL: 'vslider-fill',
  /** Dark filled rectangle panel — thought bubble background */
  PANEL_BG: 'panel-bg',
  /** Outlined rectangle panel — monitor screen frame overlay */
  PANEL_OUTLINE: 'panel-outline',
  /** Square button — mini HUD elements */
  BUTTON_SQUARE: 'button-square',
  /** Terrain props — 64x64 Lego-style crate */
  TERRAIN_CRATE: 'terrain-crate',
  /** Terrain props — 64x64 hazard crate (explosive) */
  TERRAIN_CRATE_HAZARD: 'terrain-crate-hazard',
  /** Terrain props — 64x64 stone block */
  TERRAIN_STONE: 'terrain-stone',
  /** Terrain props — 64x64 dirt block */
  TERRAIN_DIRT: 'terrain-dirt',
  /** Terrain props — 64x64 coin box */
  TERRAIN_BOX_COIN: 'terrain-box-coin',
} as const)

// ---------------------------------------------------------------------------
// Game icon frame indices (32x32 cells in GAME_ICONS spritesheet)
// ---------------------------------------------------------------------------

export const ICON_FRAMES = Object.freeze({
  // Stars — quest difficulty (trivial -> legendary)
  STAR_GREY:   0,
  STAR_BLUE:   1,
  STAR_GREEN:  2,
  STAR_YELLOW: 3,
  STAR_RED:    4,
  // Medals — leaderboard rank
  MEDAL_GOLD:   5,
  MEDAL_SILVER: 6,
  MEDAL_BRONZE: 7,
  // UI icons
  CHECKMARK:      8,
  SQUARE_OUTLINE: 9,
  // Error/cross
  CROSS_RED:      10,
  // Colored circle status dots
  CIRCLE_BLUE:    11,
  CIRCLE_GREEN:   12,
  CIRCLE_YELLOW:  13,
  CIRCLE_RED:     14,
  CIRCLE_GREY:    15,
  // Achievement badge
  ACHIEVEMENT_BADGE: 16,
  // Star variants
  STAR_OUTLINE:      17,
  STAR_LOCKED:       18,
  // Arrow
  ARROW_EAST:        19,
  // Extra medals (season rewards, rivalry badges)
  MEDAL_SILVER_ROUND: 22,
  MEDAL_BRONZE_ROUND: 23,
  MEDAL_GOLD_BLUE:    24,
  MEDAL_GOLD_PURPLE:  25,
  MEDAL_GOLD_WHITE:   26,
  // HUD button
  BUTTON_ROUND:       27,
  // Extra UI icons
  PLAY_DARK:          28,
  REPEAT_DARK:        29,
  ARROW_UP_DARK:      30,
} as const)

// ---------------------------------------------------------------------------
// Lego bar frame indices (16x8 cells in LEGO_BAR spritesheet)
// ---------------------------------------------------------------------------

export const LEGO_FRAMES = Object.freeze({
  BLUE:    0,
  GREEN:   1,
  YELLOW:  2,
  RED:     3,
  SPECIAL: 4,
} as const)

// ---------------------------------------------------------------------------
// Game item frame indices (32x32 cells in GAME_ITEMS spritesheet)
// ---------------------------------------------------------------------------

export const ITEM_FRAMES = Object.freeze({
  COFFEE_CUP:    0,
  MONITOR:       1,
  BOOK:          2,
  HEADPHONES:    3,
  PHONE:         4,
  PIZZA:         5,
  PAINT_PALETTE: 6,
  WRENCH:        7,
  BEER:          8,
  FIRST_AID:     9,
  CAMERA:        10,
  DONUT:         11,
} as const)

// ---------------------------------------------------------------------------
// Desk pet frame indices (24x24 cells in DESK_PETS spritesheet)
// ---------------------------------------------------------------------------

export const PET_FRAMES = Object.freeze({
  BROWN:  0,
  GREEN:  1,
  BLUE:   2,
  PINK:   3,
  YELLOW: 4,
  GREY:   5,
} as const)

/** Total number of desk pet variants. */
export const PET_COUNT = 6

// ---------------------------------------------------------------------------
// Desk pet face frame indices (16x8 cells in DESK_PET_FACES spritesheet)
// ---------------------------------------------------------------------------

export const PET_FACE_FRAMES = Object.freeze({
  EYES_CUTE:   0,
  EYES_ANGRY:  1,
  EYES_WIDE:   2,
  EYES_SLEEPY: 3,
  MOUTH_HAPPY: 4,
  MOUTH_GRIN:  5,
  MOUTH_O:     6,
  MOUTH_FLAT:  7,
} as const)

// ---------------------------------------------------------------------------
// Lego special item frame indices (24x24 cells in LEGO_SPECIALS spritesheet)
// ---------------------------------------------------------------------------

export const LEGO_SPECIAL_FRAMES = Object.freeze({
  COIN: 0,
  EXCLAMATION: 1,
  CRATE: 2,
  EXPLOSIVE: 3,
  GRADE_A: 4,
} as const)

// ---------------------------------------------------------------------------
// Animal pet constants
// ---------------------------------------------------------------------------

/** Animal species in the ANIMAL_PETS sheet — row order. */
export const ANIMAL_SPECIES = ['chicken', 'teddy', 'penguin', 'ducky', 'polar'] as const
export type AnimalSpecies = typeof ANIMAL_SPECIES[number]

/** Number of idle frames per animal in the ANIMAL_PETS sheet. */
export const ANIMAL_IDLE_FRAMES = 12

/** Total animal species count. */
export const ANIMAL_COUNT = ANIMAL_SPECIES.length

// ---------------------------------------------------------------------------
// Kenney UI frame indices (32x32 cells in KENNEY_UI spritesheet)
// ---------------------------------------------------------------------------

export const KENNEY_UI_FRAMES = Object.freeze({
  BTN_RECT_DEPTH: 0,
  BTN_RECT_FLAT: 1,
  BTN_ROUND_DEPTH: 2,
  BTN_ROUND_FLAT: 3,
  BTN_SQUARE_DEPTH: 4,
  BTN_SQUARE_FLAT: 5,
  ARROW_E: 6,
  ARROW_N: 7,
  ARROW_S: 8,
  ARROW_W: 9,
  ARROW_DECO_E: 10,
  ARROW_DECO_N: 11,
  ARROW_DECO_S: 12,
  ARROW_DECO_W: 13,
  CHECK_SQUARE: 14,
  ICON_CHECK: 15,
  ICON_CIRCLE: 16,
  ICON_CROSS: 17,
  ICON_SQUARE_OUTLINE: 18,
  STAR: 19,
  STAR_OUTLINE: 20,
  SLIDER_H_COLOR: 21,
  SLIDER_H_GREY: 22,
  SLIDER_V_COLOR: 23,
  SLIDER_V_GREY: 24,
} as const)

// ---------------------------------------------------------------------------
// HD medal frame indices (from medals-hd spritesheet — medals.png sliced)
// ---------------------------------------------------------------------------

export const MEDAL_HD_FRAMES = Object.freeze({
  GOLD_STAR: 0,
  SILVER_FLORAL: 1,
  BRONZE_FLORAL: 2,
  SILVER_ROUND: 3,
  BRONZE_ROUND: 4,
  GOLD_BLUE: 5,
  GOLD_PURPLE: 6,
  GOLD_WHITE: 7,
  SILVER_WHITE: 8,
  BRONZE_WHITE: 9,
} as const)

// ---------------------------------------------------------------------------
// Lab prop frame indices (64x64 cells in LAB_PROPS — generated from repo SVGS)
// ---------------------------------------------------------------------------

export { LAB_PROP_FRAMES, type LabPropFrameKey } from './lab-prop-frames.generated'

export type LabPropFrame =
  (typeof import('./lab-prop-frames.generated').LAB_PROP_FRAMES)[keyof typeof import('./lab-prop-frames.generated').LAB_PROP_FRAMES]

// ---------------------------------------------------------------------------
// Lab prop sprite animations (frames live on LAB_PROPS)
// ---------------------------------------------------------------------------

export const LAB_ANIM_KEYS = Object.freeze({
  CONSOLE_WAVE: 'lab-console-wave',
  CONSOLE_LINES: 'lab-console-lines',
} as const)

// ---------------------------------------------------------------------------
// Lab tileset frame indices (128x128 cells, alphabetical file order = frame index)
// ---------------------------------------------------------------------------

/** Main tileset (8 cols × 9 rows) — autotile frames for lab rooms.
 *  Frame index = row * 8 + col (128×128 cells). */
export const LAB_TILESET_FRAMES = Object.freeze({
  // ── Hex floor fills (tileable interior) ──
  HEX_FLOOR_A: 9,       // row 1 col 1 — clean hex floor
  HEX_FLOOR_B: 35,      // row 4 col 3 — hex floor variant
  HEX_FLOOR_C: 64,      // row 8 col 0
  HEX_FLOOR_D: 65,      // row 8 col 1

  // ── Outer wall corners (hex floor inside, wall border outside) ──
  CORNER_TL: 0,         // row 0 col 0 — wall on bottom+right
  CORNER_TR: 2,         // row 0 col 2 — wall on bottom+left
  CORNER_BL: 16,        // row 2 col 0 — wall on top+right
  CORNER_BR: 18,        // row 2 col 2 — wall on top+left

  // ── Wall edges (hex floor on interior side, wall on edge) ──
  WALL_TOP: 1,          // row 0 col 1 — horizontal wall along top
  WALL_BOTTOM: 17,      // row 2 col 1 — horizontal wall along bottom
  WALL_LEFT: 8,         // row 1 col 0 — vertical wall on left
  WALL_RIGHT: 11,       // row 1 col 3 — vertical wall on right

  // ── Inner corners (for wall-to-wall concave corners) ──
  INNER_TL: 15,         // row 1 col 7
  INNER_TR: 14,         // row 1 col 6
  INNER_BL: 7,          // row 0 col 7
  INNER_BR: 6,          // row 0 col 6

  // ── Dark void fill (exterior / outside rooms) ──
  DARK_FILL: 12,        // row 1 col 4 — solid dark navy
  OUTER_FILL: 12,       // alias for backwards compat

  // ── Thick wall variants (inner pipe detail, for variety in larger rooms) ──
  WALL_TOP_THICK: 4,    // row 0 col 4 — top wall with yellow stud border
  WALL_BOTTOM_THICK: 20,// row 2 col 4 — bottom wall with yellow stud border
  CORNER_TL_THICK: 3,   // row 0 col 3 — thick TL corner with inner pipe
  CORNER_TR_THICK: 5,   // row 0 col 5 — thick TR corner with inner pipe
  CORNER_BL_THICK: 19,  // row 2 col 3 — thick BL corner
  CORNER_BR_THICK: 21,  // row 2 col 5 — thick BR corner

  // ── Wall-with-window accent tiles (yellow panels in wall) ──
  WALL_BOTTOM_WINDOW_A: 38, // row 4 col 6 — bottom wall with two yellow windows
  WALL_BOTTOM_WINDOW_B: 39, // row 4 col 7 — bottom wall variant
  WALL_BOTTOM_WINDOW_C: 46, // row 5 col 6 — bottom wall with windows
  WALL_BOTTOM_WINDOW_D: 47, // row 5 col 7 — bottom wall variant

  // ── Equipment / console on hex floor (decoration) ──
  CONSOLE_SMALL: 43,    // row 5 col 3 — small console on floor
  CONSOLE_TOP: 51,      // row 6 col 3 — console at top of tile
  CONSOLE_RIGHT: 56,    // row 7 col 0 — console on right side
  CONSOLE_LEFT: 57,     // row 7 col 1 — console on left side
  CONSOLE_RIGHT_B: 58,  // row 7 col 2 — console right variant
  CONSOLE_LEFT_B: 59,   // row 7 col 3 — console left variant
  CONSOLE_BOT_RIGHT: 66,// row 8 col 2 — console bottom-right
  CONSOLE_BOT_LEFT: 67, // row 8 col 3 — console bottom-left
  FLOOR_FEATURE: 22,    // row 2 col 6 — reactor/light feature

  // ── T-junction / corridor interface tiles ──
  T_JUNCTION_LEFT: 52,  // row 6 col 4 — wall with corridor going left
  T_JUNCTION_RIGHT: 53, // row 6 col 5 — wall with corridor going right
  T_JUNCTION_BOT_A: 54, // row 6 col 6 — wall-floor transition with bottom detail
  T_JUNCTION_BOT_B: 55, // row 6 col 7 — wall-floor transition variant

  // ── Hex-to-dark smooth transitions ──
  TRANSITION_TOP: 49,   // row 6 col 1 — dark bite along top
  TRANSITION_BOTTOM: 33,// row 4 col 1 — dark bite along bottom
  TRANSITION_LEFT: 42,  // row 5 col 2 — dark bite along left (note: hex right, dark left)
  TRANSITION_RIGHT: 40, // row 5 col 0 — dark bite along right (note: hex left, dark right)
  TRANSITION_TL: 50,    // row 6 col 2 — dark corner top-left
  TRANSITION_TR: 48,    // row 6 col 0 — dark corner top-right
  TRANSITION_BL: 34,    // row 4 col 2 — dark corner bottom-left
  TRANSITION_BR: 32,    // row 4 col 0 — dark corner bottom-right

  // ── Corridor crossings / junctions ──
  CROSS_A: 24,          // row 3 col 0
  CROSS_B: 25,          // row 3 col 1
} as const)

/** Smooth tileset (8 cols × 1 row, 48x48 cells) — corner/edge transitions */
export const LAB_SMOOTH_FRAMES = Object.freeze({
  OUTER_TL: 0,
  OUTER_TR: 1,
  OUTER_BL: 2,
  OUTER_BR: 3,
  EDGE_TOP: 4,
  EDGE_BOTTOM: 5,
  EDGE_LEFT: 6,
  EDGE_RIGHT: 7,
} as const)

// ---------------------------------------------------------------------------
// Lab tile pack — individual image keys (loaded as separate PNGs, not spritesheets)
// ---------------------------------------------------------------------------

/** Individual image keys for the Itch.io lab tile pack.
 *  Each maps to a single PNG loaded via `this.load.image()` in BootScene.
 *  Used in autotiler functions instead of LAB_TILESET_FRAMES numeric indices. */
export const LAB_IMAGE_KEYS = Object.freeze({
  // ── Floors ──
  HEX_FLOOR_A: 'lab-floor-a',
  HEX_FLOOR_B: 'lab-floor-b',
  OUTER_FILL:  'lab-outer-fill',
  OUTSIDE_FILL: 'lab-outside-fill',

  // ── Outer wall corners ──
  CORNER_TL: 'lab-corner-tl',
  CORNER_TR: 'lab-corner-tr',
  CORNER_BL: 'lab-corner-bl',
  CORNER_BR: 'lab-corner-br',

  // ── Wall edges ──
  WALL_TOP:    'lab-wall-top',
  WALL_BOTTOM: 'lab-wall-bottom',
  WALL_LEFT:   'lab-wall-left',
  WALL_RIGHT:  'lab-wall-right',

  // ── Inner corners ──
  INNER_TL: 'lab-inner-tl',
  INNER_TR: 'lab-inner-tr',
  INNER_BL: 'lab-inner-bl',
  INNER_BR: 'lab-inner-br',

  // ── T-junctions ──
  T_TOP:    'lab-t-top',
  T_BOTTOM: 'lab-t-bottom',
  T_LEFT:   'lab-t-left',
  T_RIGHT:  'lab-t-right',

  // ── Intersections ──
  FOUR_WAY: 'lab-four-way',
  SINGLE:   'lab-single',

  // ── Pipes ──
  PIPE_H:         'lab-pipe-h',
  PIPE_H2:        'lab-pipe-h2',
  PIPE_V:         'lab-pipe-v',
  PIPE_CROSS:     'lab-pipe-cross',
  PIPE_CAP_TOP:   'lab-pipe-cap-top',
  PIPE_CAP_BOTTOM:'lab-pipe-cap-bottom',
  PIPE_CAP_LEFT:  'lab-pipe-cap-left',
  PIPE_CAP_RIGHT: 'lab-pipe-cap-right',
  PIPE_VALVE:     'lab-pipe-valve',
  PIPE_CORNER_TL: 'lab-pipe-corner-tl',
  PIPE_CORNER_TR: 'lab-pipe-corner-tr',
  PIPE_CORNER_BL: 'lab-pipe-corner-bl',
  PIPE_CORNER_BR: 'lab-pipe-corner-br',

  // ── Props ──
  PROP_CONSOLE_LONG:  'lab-prop-console-long',
  PROP_CONSOLE_SHORT: 'lab-prop-console-short',
  PROP_CONSOLE_CORNER:'lab-prop-console-corner',
  PROP_POD:           'lab-prop-pod',
  PROP_GENERATOR:     'lab-prop-generator',
  PROP_TANK:          'lab-prop-tank',
  PROP_MICROSCOPE:    'lab-prop-microscope',
  PROP_BEAKER:        'lab-prop-beaker',
  PROP_MONITOR:       'lab-prop-monitor',
  PROP_KEYBOARD:      'lab-prop-keyboard',
  PROP_STOOL:         'lab-prop-stool',
  PROP_LASER_HEAD:    'lab-prop-laser-head',
  PROP_WARNING:       'lab-prop-warning',
  PROP_VENT:          'lab-prop-vent',
  PROP_SHELF:         'lab-prop-shelf',
  PROP_LED_ON:        'lab-prop-led-on',
  PROP_LED_OFF:       'lab-prop-led-off',
  PROP_SLIDING_DOOR:  'lab-prop-sliding-door',
  PROP_DESK_LAMP:     'lab-prop-desk-lamp',
  PROP_DOME:          'lab-prop-dome',
  PROP_SINK:          'lab-prop-sink',
  PROP_PETRI_DISH:    'lab-prop-petri-dish',
  PROP_TEST_TUBES:    'lab-prop-test-tubes',
  PROP_SCREEN:        'lab-prop-screen',
  PROP_WALL_LIGHT:    'lab-prop-wall-light',
  PROP_CONSOLE_DESK:  'lab-prop-console-desk',
} as const)

// ---------------------------------------------------------------------------
// Lab pipe frame indices (128x128 cells, 7 cols × 5 rows in LAB_PIPES spritesheet)
// Frame layout identified from the sprite image (row-major, 0-indexed):
//   Row 0: corner-TL, horiz-top, corner-TR, horiz-arrow, T-down, T-left, coupling-horiz
//   Row 1: vert-left, cross, vert-right, vert-arrow-down, T-right, coupling-horiz-short, horiz-short
//   Row 2: corner-BL, horiz-bottom, corner-BR, valve-wheel, vert-long, coupling-vert, vert-stub
//   Row 3: cap-top, coupling-center, funnel, vert-mid, broken-A, broken-B, broken-C
//   Row 4: broken-flat, broken-angled, broken-pieces, cap-bottom, leak-A, leak-B, leak-C
// ---------------------------------------------------------------------------

export const PIPE_FRAMES = Object.freeze({
  // Corners (90-degree elbows)
  CORNER_TL: 0,
  CORNER_TR: 2,
  CORNER_BL: 14,
  CORNER_BR: 16,
  // Straight segments
  HORIZ_TOP: 1,       // horizontal straight (with edge detail on top)
  HORIZ_ARROW: 3,     // horizontal with flow arrow
  VERT_LEFT: 7,       // vertical straight (left-side detail)
  VERT_RIGHT: 9,      // vertical straight (right-side detail)
  VERT_ARROW: 10,     // vertical with flow arrow
  VERT_LONG: 18,      // long vertical segment
  HORIZ_SHORT: 13,    // short horizontal coupling
  // T-connectors
  T_DOWN: 4,          // T facing down
  T_LEFT: 5,          // T facing left
  T_RIGHT: 11,        // T facing right
  // Cross connector
  CROSS: 8,
  // Accessories
  VALVE: 17,          // valve wheel
  COUPLING_HORIZ: 6,  // horizontal coupling/flange
  COUPLING_VERT: 19,  // vertical coupling/flange
  CAP_TOP: 21,        // pipe end cap (top)
  FUNNEL: 23,         // funnel/reducer
  // Damaged
  BROKEN_A: 25,
  BROKEN_FLAT: 28,
} as const)

// ---------------------------------------------------------------------------
// Lab cable frame indices (128x128 cells, 7 cols × 9 rows in LAB_CABLES spritesheet)
// ---------------------------------------------------------------------------

export const CABLE_FRAMES = Object.freeze({
  // Cable routing pieces (top rows)
  LOOP_ROUND_A: 0,     // rounded loop
  LOOP_ROUND_B: 1,     // rounded loop variant
  RECT_LOOP: 2,        // rectangular cable loop
  STUB_A: 3,           // short cable stub
  STUB_B: 4,           // cable dot/connector
  STUB_C: 5,           // cable dot small
  STUB_D: 6,           // cable dot tiny
  HORIZ_STRAIGHT: 7,   // horizontal cable run
  RECT_PLATE: 8,       // rectangular plate/cover
  VERT_PLATE: 9,       // vertical plate connector
  CONNECTOR_A: 10,     // 4-dot connector panel
  CONNECTOR_B: 11,     // 2-dot connector
  DOT_SINGLE: 12,      // single cable dot
  DOT_PAIR: 13,        // pair of dots
  // Lower rows — more routing
  KNOT_A: 42,          // cable knot
  KNOT_TRIPLE: 43,     // triple knot
  CURVE_A: 44,         // curved cable
  CURVE_B: 45,         // curved cable variant
  WAVE_A: 49,          // wavy cable
  WAVE_B: 50,          // wavy cable variant
  PLUG_A: 56,          // cable plug end
  PLUG_B: 57,          // cable plug end variant
} as const)

// ---------------------------------------------------------------------------
// Audio keys — OGG sound effects
// ---------------------------------------------------------------------------

export const AUDIO_KEYS = Object.freeze({
  CLICK_A: 'sfx-click-a',
  CLICK_B: 'sfx-click-b',
  SWITCH_A: 'sfx-switch-a',
  SWITCH_B: 'sfx-switch-b',
  TAP_A: 'sfx-tap-a',
  TAP_B: 'sfx-tap-b',
} as const)

/** Map quest difficulty to the corresponding star frame index. */
export const DIFFICULTY_STAR_FRAME: Record<string, number> = {
  trivial:   ICON_FRAMES.STAR_GREY,
  normal:    ICON_FRAMES.STAR_BLUE,
  hard:      ICON_FRAMES.STAR_GREEN,
  epic:      ICON_FRAMES.STAR_YELLOW,
  legendary: ICON_FRAMES.STAR_RED,
}

/** Map agent status color (hex) to the corresponding circle status dot frame. */
export const STATUS_DOT_FRAMES: Record<number, number> = {
  0x3b82f6: ICON_FRAMES.CIRCLE_BLUE,   // working
  0x34d399: ICON_FRAMES.CIRCLE_GREEN,   // active/idle
  0xfbbf24: ICON_FRAMES.CIRCLE_YELLOW,  // waiting/needs-attention
  0xef4444: ICON_FRAMES.CIRCLE_RED,     // error
  0x6b7280: ICON_FRAMES.CIRCLE_GREY,    // offline/idle
}

/** Map toast type to icon frame. */
export const TOAST_ICON_FRAMES: Record<string, number> = {
  success: ICON_FRAMES.CHECKMARK,
  error:   ICON_FRAMES.CROSS_RED,
  warning: ICON_FRAMES.CIRCLE_YELLOW,
  info:    ICON_FRAMES.CIRCLE_BLUE,
}

// ---------------------------------------------------------------------------
// Effect animation keys
// ---------------------------------------------------------------------------

export const EFFECT_ANIM_KEYS = Object.freeze({
  FLASH:     'effect-flash',
  PUFF:      'effect-puff',
  EXPLOSION: 'effect-explosion',
  SMOKE:     'effect-smoke',
  FART:      'effect-fart',
} as const)

// ---------------------------------------------------------------------------
// Spritesheets — animation strips
// Naming convention: anim-{pose}-{charVariant}
// Each strip is 256px wide x 512px tall per frame.
//   walk: 12 frames (8 walk-A rotations + 4 walk-B rotations)
//   idle:  4 frames (4 rotations)
//   sit:   4 frames (4 rotations)
// ---------------------------------------------------------------------------

export const ANIM_KEYS = Object.freeze({
  WALK_1: 'anim-walk-1',
  WALK_2: 'anim-walk-2',
  IDLE_1: 'anim-idle-1',
  IDLE_2: 'anim-idle-2',
  SIT_1:  'anim-sit-1',
  SIT_2:  'anim-sit-2',
} as const)

// ---------------------------------------------------------------------------
// Scene keys
// ---------------------------------------------------------------------------

export const SCENE_KEYS = Object.freeze({
  BOOT:     'BootScene',
  CAMPUS:   'CampusScene',
  OFFICE:   'OfficeScene',
  UI_SCENE: 'UIScene',
} as const)

// ---------------------------------------------------------------------------
// Type helpers — derive union types from the frozen objects above
// ---------------------------------------------------------------------------

export type SpritesheetKey  = typeof SPRITESHEET_KEYS[keyof typeof SPRITESHEET_KEYS]
export type AnimKey         = typeof ANIM_KEYS[keyof typeof ANIM_KEYS]
export type SceneKey        = typeof SCENE_KEYS[keyof typeof SCENE_KEYS]
export type IconFrame       = typeof ICON_FRAMES[keyof typeof ICON_FRAMES]
export type EffectAnimKey   = typeof EFFECT_ANIM_KEYS[keyof typeof EFFECT_ANIM_KEYS]
export type ItemFrame       = typeof ITEM_FRAMES[keyof typeof ITEM_FRAMES]
export type AudioKey        = typeof AUDIO_KEYS[keyof typeof AUDIO_KEYS]
export type MedalHDFrame    = typeof MEDAL_HD_FRAMES[keyof typeof MEDAL_HD_FRAMES]
