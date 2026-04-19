#!/usr/bin/env node
/**
 * Build character spritesheets for the Phaser game engine.
 *
 * Outputs:
 *   1. characters.png      — 6 cols × 3 rows static-pose sheet (legacy, unchanged)
 *   2. characters-rpg.png  — 8-direction walk-cycle sheet (new RPG layout)
 *
 * ─── characters-rpg.png layout ───────────────────────────────────────────────
 * Frame size : 256 × 512 px
 * Grid       : 16 cols × (3 rows × NUM_CHARS)  →  4096 × 4608 px total
 * Per character (charIdx 0–2), frame offset = charIdx * FRAMES_PER_CHAR (48):
 *
 *   Frames  0– 3  walk-n   (N,  4 frames)    Frames  4– 7  walk-ne  (NE, 4 frames)
 *   Frames  8–11  walk-e   (E,  4 frames)    Frames 12–15  walk-se  (SE, 4 frames)
 *   Frames 16–19  walk-s   (S,  4 frames)    Frames 20–23  walk-sw  (SW, 4 frames)
 *   Frames 24–27  walk-w   (W,  4 frames)    Frames 28–31  walk-nw  (NW, 4 frames)
 *   Frame  32     idle-n   Frame 33  idle-ne  Frame 34  idle-e   Frame 35  idle-se
 *   Frame  36     idle-s   Frame 37  idle-sw  Frame 38  idle-w   Frame 39  idle-nw
 *   Frame  40     sit-front  Frame 41 sit-back  Frame 42 sit-left  Frame 43 sit-right
 *   Frame  44     action-type  Frame 45 action-drink  Frame 46 action-celebrate  Frame 47 action-talk
 *
 * Source material (all 256×512 per frame):
 *   walk-1.png  — 12 frames: 4 cardinal directions × 3-frame walk cycles
 *                 [0-2]=S  [3-5]=E  [6-8]=N  [9-11]=W
 *   idle-1.png  —  4 frames: one idle pose per cardinal direction  [0]=S [1]=E [2]=N [3]=W
 *   sit-1.png   —  4 frames: sit variants  [0]=front [1]=back [2]=left [3]=right
 *   characters.png — 6 cols × 3 rows static poses; col 1 = interact (action-type),
 *                    col 2 = sit, col 3 = surprise (action-celebrate),
 *                    col 0 = idle (action-talk), col 4 = hurt (action-drink fallback)
 *
 * Diagonal walk cycles are synthesised from the nearest cardinal source frames.
 * This provides a functional 8-direction walk while true diagonal artwork is pending.
 *
 * @module build-sprites
 */

import sharp from 'sharp'
import { mkdirSync, copyFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

// ── Source paths ──────────────────────────────────────────────────────────────
const ANIM_DIR = resolve(ROOT, '../game-assets/favorite-vector-rpg-characters/Individual Animations')
const OFFICE_TILES_SRC = resolve(ROOT, '../game-assets/Modern_Office_Revamped_v1.2/Modern_Office_48x48.png')
const SPRITES_DIR = resolve(ROOT, 'public/sprites')

// ── Frame dimensions ──────────────────────────────────────────────────────────
const FRAME_W = 256
const FRAME_H = 512

// ── Legacy (characters.png) layout ───────────────────────────────────────────
const LEGACY_COLS = 6
const LEGACY_ROWS = 3
const LEGACY_ANIMATIONS = [
  { col: 0, anim: 'idle' },
  { col: 1, anim: 'interact' },
  { col: 2, anim: 'sit' },
  { col: 3, anim: 'surprise' },
  { col: 4, anim: 'hurt' },
  { col: 5, anim: 'walk' },
]

// ── RPG layout constants ──────────────────────────────────────────────────────
const RPG_COLS            = 16   // 16 frames per row
const RPG_FRAMES_PER_CHAR = 48   // 48 frames per character variant
const RPG_ROWS_PER_CHAR   = 3    // RPG_FRAMES_PER_CHAR / RPG_COLS
const RPG_NUM_CHARS       = 3    // Claude, Cursor, OpenCode tinted

/**
 * 8-direction walk source mapping from walk-1.png.
 *
 * walk-1.png has 12 frames arranged as 4 cardinal directions × 3-frame walk cycles:
 *   S: frames [0, 1, 2]    E: frames [3, 4, 5]
 *   N: frames [6, 7, 8]    W: frames [9, 10, 11]
 *
 * For each RPG output direction we specify 4 source frames (step0, neutral, step1, neutral).
 * Diagonals borrow from the nearer adjacent cardinal pair.
 * Entries are [frameIndex, frameIndex, frameIndex, frameIndex] into walk-1.png.
 */
const WALK_SOURCE_FRAMES = {
  //         step0   neutral step1    neutral
  n:  [6,    7,      8,       7],   // North: step forward, mid, step back, mid
  ne: [6,    3,      8,       3],   // NE: blend N step with E neutral
  e:  [3,    4,      5,       4],   // East
  se: [3,    0,      5,       0],   // SE: blend E step with S neutral
  s:  [0,    1,      2,       1],   // South
  sw: [0,    9,      2,       9],   // SW: blend S step with W neutral
  w:  [9,    10,     11,      10],  // West
  nw: [9,    6,      11,      6],   // NW: blend W step with N neutral
}

/**
 * 8-direction idle source mapping from idle-1.png.
 *
 * idle-1.png has 4 frames:  [0]=S  [1]=E  [2]=N  [3]=W
 * Diagonals use the nearest cardinal.
 */
const IDLE_SOURCE_FRAMES = {
  n: 2, ne: 2, e: 1, se: 1,
  s: 0, sw: 3, w: 3, nw: 2,
}

/** sit-1.png frame mapping: [0]=front [1]=back [2]=left [3]=right */
const SIT_SOURCE_FRAMES = {
  front: 0, back: 1, left: 2, right: 3,
}

/**
 * Action source frames extracted from characters.png row 0 (char 1 / Claude).
 * Each entry is [col, row] in the 6-col × 3-row characters.png sheet.
 */
const ACTION_SOURCE_CELLS = {
  type:      [1, 0],  // interact pose
  drink:     [4, 0],  // hurt pose (closest to "drinking" — sprite pack limitation)
  celebrate: [3, 0],  // surprise pose
  talk:      [0, 0],  // idle pose
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Extract a single 256×512 frame from a horizontal strip by frame index. */
async function extractStripFrame(stripPath, frameIndex) {
  return sharp(stripPath)
    .extract({ left: frameIndex * FRAME_W, top: 0, width: FRAME_W, height: FRAME_H })
    .ensureAlpha()
    .png()
    .toBuffer()
}

/** Extract a single frame from a grid spritesheet by (col, row). */
async function extractGridFrame(sheetPath, col, row) {
  return sharp(sheetPath)
    .extract({ left: col * FRAME_W, top: row * FRAME_H, width: FRAME_W, height: FRAME_H })
    .ensureAlpha()
    .png()
    .toBuffer()
}

/** Extract the first 256×512 frame from a source strip (legacy helper). */
async function extractFirstFrame(srcPath) {
  return extractStripFrame(srcPath, 0)
}

/**
 * Apply a colour tint to create the OpenCode variant of a character frame.
 * Produces a teal/purple hue shift.
 */
async function applyTint(frameBuffer) {
  return sharp(frameBuffer)
    .modulate({ saturation: 0.8 })
    .tint({ r: 100, g: 80, b: 200, alpha: 0.15 })
    .png()
    .toBuffer()
}

// ─────────────────────────────────────────────────────────────────────────────
// Legacy character sheet (characters.png)  —  6 cols × 3 rows, unchanged
// ─────────────────────────────────────────────────────────────────────────────

async function buildCharacterSheet() {
  const outPath = resolve(SPRITES_DIR, 'characters.png')
  console.log('Building legacy character spritesheet (characters.png)…')

  const composites = []

  // Row 0: Character 1 (Claude)
  for (const { col, anim } of LEGACY_ANIMATIONS) {
    const srcPath = resolve(ANIM_DIR, `${anim}-1_256.png`)
    console.log(`  [legacy] ${anim}-1 → row 0 col ${col}`)
    const frameBuffer = await extractFirstFrame(srcPath)
    composites.push({ input: frameBuffer, left: col * FRAME_W, top: 0 })
  }

  // Row 1: Character 2 (Cursor)
  for (const { col, anim } of LEGACY_ANIMATIONS) {
    const srcPath = resolve(ANIM_DIR, `${anim}-2_256.png`)
    console.log(`  [legacy] ${anim}-2 → row 1 col ${col}`)
    const frameBuffer = await extractFirstFrame(srcPath)
    composites.push({ input: frameBuffer, left: col * FRAME_W, top: FRAME_H })
  }

  // Row 2: Character 1 tinted (OpenCode)
  console.log('  [legacy] creating tinted variations for row 2…')
  for (const { col, anim } of LEGACY_ANIMATIONS) {
    const srcPath = resolve(ANIM_DIR, `${anim}-1_256.png`)
    const frameBuffer = await extractFirstFrame(srcPath)
    const tinted = await applyTint(frameBuffer)
    composites.push({ input: tinted, left: col * FRAME_W, top: 2 * FRAME_H })
  }

  const totalW = LEGACY_COLS * FRAME_W   // 1536
  const totalH = LEGACY_ROWS * FRAME_H   // 1536

  await sharp({ create: { width: totalW, height: totalH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(composites)
    .png({ compressionLevel: 9 })
    .toFile(outPath)

  console.log(`  → ${outPath}  (${totalW}×${totalH})`)
}

// ─────────────────────────────────────────────────────────────────────────────
// RPG 8-direction character sheet (characters-rpg.png)  —  16 cols × 9 rows
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a 48-frame RPG animation block for one character variant.
 *
 * @param {Buffer[]} walkFrames  — walk-1.png frames (12 buffers, 0-indexed)
 * @param {Buffer[]} idleFrames  — idle-1.png frames (4 buffers)
 * @param {Buffer[]} sitFrames   — sit-1.png frames (4 buffers)
 * @param {Buffer[]} charFrames  — characters.png row N frames (6 buffers)
 * @param {(b: Buffer) => Promise<Buffer>} [tintFn]  — optional tint transform
 * @returns {Promise<Buffer[]>}  48 frame buffers in RPG layout order
 */
async function buildRpgCharFrames(walkFrames, idleFrames, sitFrames, charFrames, tintFn) {
  const out = []

  const maybeApply = async (buf) => tintFn ? tintFn(buf) : buf

  // ── Walk: 8 directions × 4 frames (frames 0–31) ──────────────────────────
  const dirs = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw']
  for (const dir of dirs) {
    const [f0, f1, f2, f3] = WALK_SOURCE_FRAMES[dir]
    out.push(await maybeApply(walkFrames[f0]))
    out.push(await maybeApply(walkFrames[f1]))
    out.push(await maybeApply(walkFrames[f2]))
    out.push(await maybeApply(walkFrames[f3]))
  }

  // ── Idle: 8 directions × 1 frame (frames 32–39) ──────────────────────────
  for (const dir of dirs) {
    out.push(await maybeApply(idleFrames[IDLE_SOURCE_FRAMES[dir]]))
  }

  // ── Sit: 4 variants × 1 frame (frames 40–43) ─────────────────────────────
  out.push(await maybeApply(sitFrames[SIT_SOURCE_FRAMES.front]))
  out.push(await maybeApply(sitFrames[SIT_SOURCE_FRAMES.back]))
  out.push(await maybeApply(sitFrames[SIT_SOURCE_FRAMES.left]))
  out.push(await maybeApply(sitFrames[SIT_SOURCE_FRAMES.right]))

  // ── Action: 4 types × 1 frame (frames 44–47) ─────────────────────────────
  out.push(await maybeApply(charFrames[ACTION_SOURCE_CELLS.type[0]]))      // action-type
  out.push(await maybeApply(charFrames[ACTION_SOURCE_CELLS.drink[0]]))     // action-drink
  out.push(await maybeApply(charFrames[ACTION_SOURCE_CELLS.celebrate[0]])) // action-celebrate
  out.push(await maybeApply(charFrames[ACTION_SOURCE_CELLS.talk[0]]))      // action-talk

  if (out.length !== RPG_FRAMES_PER_CHAR) {
    throw new Error(`Expected ${RPG_FRAMES_PER_CHAR} frames, got ${out.length}`)
  }
  return out
}

/**
 * Place one character's 48 frames into the composite array.
 *
 * With RPG_COLS=16, char charIdx occupies rows [charIdx*3 .. charIdx*3+2].
 * Frame i is placed at col = i % RPG_COLS, row = charIdx*3 + Math.floor(i / RPG_COLS).
 */
function placeCharFrames(frames, charIdx, composites) {
  const rowBase = charIdx * RPG_ROWS_PER_CHAR
  for (let i = 0; i < frames.length; i++) {
    const col = i % RPG_COLS
    const row = rowBase + Math.floor(i / RPG_COLS)
    composites.push({ input: frames[i], left: col * FRAME_W, top: row * FRAME_H })
  }
}

async function buildRpgCharacterSheet() {
  const outPath = resolve(SPRITES_DIR, 'characters-rpg.png')
  console.log('Building RPG 8-direction character spritesheet (characters-rpg.png)…')

  // ── Load source strips ────────────────────────────────────────────────────
  const walk1Path  = resolve(SPRITES_DIR, 'walk-1.png')
  const walk2Path  = resolve(SPRITES_DIR, 'walk-2.png')
  const idle1Path  = resolve(SPRITES_DIR, 'idle-1.png')
  const idle2Path  = resolve(SPRITES_DIR, 'idle-2.png')
  const sit1Path   = resolve(SPRITES_DIR, 'sit-1.png')
  const sit2Path   = resolve(SPRITES_DIR, 'sit-2.png')
  const charsPath  = resolve(SPRITES_DIR, 'characters.png')

  // Pre-extract all walk frames (12) from each character
  console.log('  Loading source strips…')
  const walk1Frames = await Promise.all(Array.from({ length: 12 }, (_, i) => extractStripFrame(walk1Path, i)))
  const walk2Frames = existsSync(walk2Path)
    ? await Promise.all(Array.from({ length: 12 }, (_, i) => extractStripFrame(walk2Path, i)))
    : walk1Frames

  const idle1Frames = await Promise.all(Array.from({ length: 4 }, (_, i) => extractStripFrame(idle1Path, i)))
  const idle2Frames = existsSync(idle2Path)
    ? await Promise.all(Array.from({ length: 4 }, (_, i) => extractStripFrame(idle2Path, i)))
    : idle1Frames

  const sit1Frames = await Promise.all(Array.from({ length: 4 }, (_, i) => extractStripFrame(sit1Path, i)))
  const sit2Frames = existsSync(sit2Path)
    ? await Promise.all(Array.from({ length: 4 }, (_, i) => extractStripFrame(sit2Path, i)))
    : sit1Frames

  // Extract char row frames (6 cols) for action poses
  const charRow0 = await Promise.all(Array.from({ length: 6 }, (_, col) => extractGridFrame(charsPath, col, 0)))
  const charRow1 = await Promise.all(Array.from({ length: 6 }, (_, col) => extractGridFrame(charsPath, col, 1)))

  const composites = []

  // ── Character 0: Claude (walk-1 / idle-1 / sit-1) ────────────────────────
  console.log('  Building char 0 (Claude)…')
  const char0Frames = await buildRpgCharFrames(walk1Frames, idle1Frames, sit1Frames, charRow0)
  placeCharFrames(char0Frames, 0, composites)

  // ── Character 1: Cursor (walk-2 / idle-2 / sit-2) ────────────────────────
  console.log('  Building char 1 (Cursor)…')
  const char1Frames = await buildRpgCharFrames(walk2Frames, idle2Frames, sit2Frames, charRow1)
  placeCharFrames(char1Frames, 1, composites)

  // ── Character 2: OpenCode (tinted char 0) ────────────────────────────────
  console.log('  Building char 2 (OpenCode tinted)…')
  const char2Frames = await buildRpgCharFrames(walk1Frames, idle1Frames, sit1Frames, charRow0, applyTint)
  placeCharFrames(char2Frames, 2, composites)

  const totalW = RPG_COLS * FRAME_W                          // 4096
  const totalH = RPG_NUM_CHARS * RPG_ROWS_PER_CHAR * FRAME_H // 4608

  await sharp({
    create: { width: totalW, height: totalH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite(composites)
    .png({ compressionLevel: 9 })
    .toFile(outPath)

  console.log(`  → ${outPath}  (${totalW}×${totalH}, ${RPG_NUM_CHARS * RPG_FRAMES_PER_CHAR} frames)`)
}

// ─────────────────────────────────────────────────────────────────────────────
// Copy tile assets
// ─────────────────────────────────────────────────────────────────────────────

function copyOfficeTiles() {
  const destPath = resolve(SPRITES_DIR, 'office-tiles.png')
  console.log('Copying office tileset…')
  console.log(`  ${OFFICE_TILES_SRC}`)
  copyFileSync(OFFICE_TILES_SRC, destPath)
  console.log(`  → ${destPath}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  mkdirSync(SPRITES_DIR, { recursive: true })

  // Check whether source animation strips exist (may be absent in the worktree).
  const spritesExist = existsSync(resolve(SPRITES_DIR, 'walk-1.png'))

  if (existsSync(resolve(ANIM_DIR, 'idle-1_256.png'))) {
    // Raw game-assets directory available — build legacy sheet from source PNGs.
    await buildCharacterSheet()
    copyOfficeTiles()
  } else {
    console.log('  (game-assets not found — skipping legacy character sheet rebuild)')
  }

  if (spritesExist) {
    // Pre-built strips exist — build the RPG sheet from them.
    await buildRpgCharacterSheet()
  } else {
    console.log('  (walk-1.png not found in public/sprites — skipping RPG sheet build)')
    console.log('  Run "npm run sprites:all" first to generate the base strips.')
  }

  console.log('\nDone.')
}

main().catch((err) => {
  console.error('build-sprites failed:', err)
  process.exit(1)
})
