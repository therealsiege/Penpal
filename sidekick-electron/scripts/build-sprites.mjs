#!/usr/bin/env node
/**
 * Build character spritesheet for the Phaser game engine.
 *
 * Source: game-assets/favorite-vector-rpg-characters/Individual Animations/
 * Output: sidekick-electron/public/sprites/characters.png
 *
 * Layout — 6 columns × 2 rows, each cell 256×512 px:
 *   Row 0 = Character 1, Row 1 = Character 2
 *   Col 0 = idle       (frame 0 of idle-{n}_256.png)
 *   Col 1 = interact   (frame 0 of interact-{n}_256.png)  — "working"
 *   Col 2 = sit        (frame 0 of sit-{n}_256.png)       — "idle at desk"
 *   Col 3 = surprise   (frame 0 of surprise-{n}_256.png)  — "needs attention" (! bubble)
 *   Col 4 = hurt       (frame 0 of hurt-{n}_256.png)      — "error"
 *   Col 5 = walk       (frame 0 of walk-{n}_256.png)      — "moving"
 *
 * Total output: 1536×1024 (6 × 256w, 2 × 512h)
 *
 * Also copies the Modern Office 48×48 tileset to public/sprites/office-tiles.png.
 *
 * @module build-sprites
 */

import sharp from 'sharp'
import { mkdirSync, copyFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

/** Absolute path to the raw animation PNGs. */
const ANIM_DIR = resolve(
  ROOT,
  '../game-assets/favorite-vector-rpg-characters/Individual Animations'
)

/** Absolute path to the Modern Office tileset source. */
const OFFICE_TILES_SRC = resolve(
  ROOT,
  '../game-assets/Modern_Office_Revamped_v1.2/Modern_Office_48x48.png'
)

/** Output directory (must be inside public/ so Vite / Electron serves it). */
const OUT_DIR = resolve(ROOT, 'public/sprites')

/** Width and height of a single sprite frame (px). */
const FRAME_W = 256
const FRAME_H = 512

/** Number of animation columns in the output sheet. */
const COLS = 6

/** Number of character rows in the output sheet. */
const ROWS = 2

/**
 * Animation columns, in order.
 * Each entry maps a column index to the source filename stem (without character
 * suffix and extension) so we can derive the full path at runtime.
 *
 * @type {Array<{col: number, anim: string}>}
 */
const ANIMATIONS = [
  { col: 0, anim: 'idle' },
  { col: 1, anim: 'interact' },
  { col: 2, anim: 'sit' },
  { col: 3, anim: 'surprise' },
  { col: 4, anim: 'hurt' },
  { col: 5, anim: 'walk' },
]

/**
 * Extract the first 256×512 frame (front-facing, direction 0) from a source
 * strip PNG and return a Sharp instance ready for compositing.
 *
 * @param {string} srcPath - Absolute path to the source animation PNG.
 * @returns {Promise<Buffer>} Raw PNG buffer of the extracted frame.
 */
async function extractFirstFrame(srcPath) {
  return sharp(srcPath)
    .extract({ left: 0, top: 0, width: FRAME_W, height: FRAME_H })
    .ensureAlpha()
    .png()
    .toBuffer()
}

/**
 * Build the character spritesheet and write it to disk.
 *
 * @returns {Promise<void>}
 */
async function buildCharacterSheet() {
  const outPath = resolve(OUT_DIR, 'characters.png')
  console.log('Building character spritesheet...')

  /** @type {Array<{input: Buffer, left: number, top: number}>} */
  const composites = []

  for (let charIdx = 0; charIdx < ROWS; charIdx++) {
    const charNum = charIdx + 1 // 1-based suffix in filenames

    for (const { col, anim } of ANIMATIONS) {
      const srcPath = resolve(ANIM_DIR, `${anim}-${charNum}_256.png`)
      console.log(`  Extracting ${anim}-${charNum} frame 0 from ${srcPath}`)

      const frameBuffer = await extractFirstFrame(srcPath)

      composites.push({
        input: frameBuffer,
        left: col * FRAME_W,
        top: charIdx * FRAME_H,
      })
    }
  }

  const totalWidth = COLS * FRAME_W   // 1536
  const totalHeight = ROWS * FRAME_H  // 1024

  await sharp({
    create: {
      width: totalWidth,
      height: totalHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composites)
    .png({ compressionLevel: 9 })
    .toFile(outPath)

  console.log(`  -> ${outPath}  (${totalWidth}x${totalHeight})`)
}

/**
 * Copy the Modern Office 48×48 tileset to public/sprites/office-tiles.png.
 *
 * @returns {void}
 */
function copyOfficeTiles() {
  const destPath = resolve(OUT_DIR, 'office-tiles.png')
  console.log(`Copying office tileset...`)
  console.log(`  ${OFFICE_TILES_SRC}`)
  copyFileSync(OFFICE_TILES_SRC, destPath)
  console.log(`  -> ${destPath}`)
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })

  await buildCharacterSheet()
  copyOfficeTiles()

  console.log('\nDone.')
}

main().catch((err) => {
  console.error('build-sprites failed:', err)
  process.exit(1)
})
