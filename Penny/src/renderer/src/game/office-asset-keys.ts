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
