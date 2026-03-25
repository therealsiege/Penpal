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
  /** Main character sheet — 17-frame rows (4 idle + 12 walk + 1 sit), 256×512 per frame */
  CHARACTERS: 'characters',
  /** Office prop tiles (chairs, monitors, desks, plants, etc.) */
  OFFICE: 'office',
  /** Room background tiles */
  ROOMS: 'rooms',
  /** Alt character variant 1 (compact duder style A) */
  DUDER_1: 'duder1',
  /** Alt character variant 2 (compact duder style B) */
  DUDER_2: 'duder2',
} as const)

// ---------------------------------------------------------------------------
// Spritesheets — animation strips
// Naming convention: anim-{pose}-{charVariant}
// Each strip is 256px wide × 512px tall per frame.
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
  OFFICE: 'OfficeScene',
} as const)

// ---------------------------------------------------------------------------
// Type helpers — derive union types from the frozen objects above
// ---------------------------------------------------------------------------

export type SpritesheetKey = typeof SPRITESHEET_KEYS[keyof typeof SPRITESHEET_KEYS]
export type AnimKey        = typeof ANIM_KEYS[keyof typeof ANIM_KEYS]
export type SceneKey       = typeof SCENE_KEYS[keyof typeof SCENE_KEYS]
