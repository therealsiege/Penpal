#!/usr/bin/env node
/**
 * Build animal-pets spritesheets from individual idle/blink/hurt frames.
 *
 * Outputs:
 *   animal-pets.png       — 768x320  (5 rows × 12 cols, 64×64 per cell)
 *   animal-pets-blink.png — 768×Npx  (rows only for animals that have blink frames)
 *   animal-pets-hurt.png  — 64×320   (5 rows × 1 col, first hurt frame per animal)
 *
 * Source layout (per animal):
 *   {RESOURCES}/{NAME}/NUDE/01-Idle/01-Idle/        → idle frames
 *   {RESOURCES}/{NAME}/NUDE/01-Idle/02-Idle_Blink/  → blink frames (optional)
 *   {RESOURCES}/{NAME}/NUDE/07-Hurt/01-Hurt/        → hurt frames  (optional)
 *
 * Files inside each folder are discovered via readdirSync so non-standard
 * naming conventions (e.g., POLAR) are handled automatically.
 *
 * @module build-animal-pets
 */

import sharp from 'sharp'
import { mkdirSync, readdirSync, existsSync } from 'fs'
import { resolve, dirname, extname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const HOME = process.env.HOME || process.env.USERPROFILE || '/Users/fuzeelogik'
const RESOURCES = resolve(HOME, 'Downloads/Resources/Characters/Animals')
const OUT_DIR = resolve(ROOT, 'public/sprites')

/** Output cell dimensions. */
const CELL = 64
/** Number of idle/blink frames per animal. */
const IDLE_FRAMES = 12

/** Animals in display order (top row → bottom row). */
const ANIMALS = ['CHICKEN', 'TEDDY', 'PENGUIN', 'DUCKY', 'POLAR']

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Return sorted PNG file paths found inside a directory, or [] if the
 * directory does not exist.
 *
 * @param {string} dir - Absolute directory path.
 * @returns {string[]} Sorted absolute file paths for .png files.
 */
function pngFiles(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => extname(f).toLowerCase() === '.png')
    .sort()
    .map((f) => resolve(dir, f))
}

/**
 * Resize a single source PNG to CELL×CELL with transparent letterboxing.
 *
 * @param {string} src - Absolute path to source PNG.
 * @returns {Promise<Buffer>} PNG buffer.
 */
async function resizeFrame(src) {
  return sharp(src)
    .resize(CELL, CELL, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()
}

/**
 * Composite a 2-D grid of frame buffers into a single PNG file.
 * Each row is an animal; each column is a frame index.
 *
 * @param {Array<{ name: string; frames: string[] }>} rows
 *   Only rows with at least one frame are composited.
 * @param {number} cols   Number of columns (grid width in cells).
 * @param {string} outPath  Absolute output path.
 * @param {string} label    Human-readable label for console output.
 * @returns {Promise<void>}
 */
async function buildSheet(rows, cols, outPath, label) {
  const activeRows = rows.filter((r) => r.frames.length > 0)
  if (activeRows.length === 0) {
    console.log(`  [${label}] no source frames found — skipping`)
    return
  }

  const sheetW = cols * CELL
  const sheetH = activeRows.length * CELL
  const composites = []

  for (let rowIdx = 0; rowIdx < activeRows.length; rowIdx++) {
    const { name, frames } = activeRows[rowIdx]
    // Use up to `cols` frames; silently pad missing frames with nothing.
    const count = Math.min(frames.length, cols)
    for (let col = 0; col < count; col++) {
      const buf = await resizeFrame(frames[col])
      composites.push({ input: buf, left: col * CELL, top: rowIdx * CELL })
    }
    console.log(`  [${label}] ${name}: ${count} frame(s) placed at row ${rowIdx}`)
  }

  await sharp({
    create: { width: sheetW, height: sheetH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite(composites)
    .png({ compressionLevel: 9 })
    .toFile(outPath)

  console.log(`  -> ${outPath}  (${sheetW}x${sheetH}, ${activeRows.length} row(s))`)
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })

  // Resolve frame paths for every animal up front.
  const idleRows = []
  const blinkRows = []
  const hurtRows = []

  for (const name of ANIMALS) {
    const base = resolve(RESOURCES, name, 'NUDE')

    const idleDir = resolve(base, '01-Idle', '01-Idle')
    const blinkDir = resolve(base, '01-Idle', '02-Idle_Blink')
    const hurtDir = resolve(base, '07-Hurt', '01-Hurt')

    const idleFrames = pngFiles(idleDir)
    const blinkFrames = pngFiles(blinkDir)
    const hurtFrames = pngFiles(hurtDir)

    idleRows.push({ name, frames: idleFrames })
    blinkRows.push({ name, frames: blinkFrames })
    // Hurt sheet uses only the first frame.
    hurtRows.push({ name, frames: hurtFrames.slice(0, 1) })

    if (idleFrames.length === 0) {
      console.warn(`  WARNING: no idle frames found for ${name} at ${idleDir}`)
    }
  }

  // ------------------------------------------------------------------
  // 1. animal-pets.png — idle sheet (5 rows × 12 cols)
  // ------------------------------------------------------------------
  console.log('\nBuilding animal-pets.png (idle)...')
  await buildSheet(idleRows, IDLE_FRAMES, resolve(OUT_DIR, 'animal-pets.png'), 'idle')

  // ------------------------------------------------------------------
  // 2. animal-pets-blink.png — blink sheet (N rows × 12 cols)
  //    Rows without blink frames are excluded entirely.
  // ------------------------------------------------------------------
  console.log('\nBuilding animal-pets-blink.png (blink)...')
  await buildSheet(blinkRows, IDLE_FRAMES, resolve(OUT_DIR, 'animal-pets-blink.png'), 'blink')

  // ------------------------------------------------------------------
  // 3. animal-pets-hurt.png — hurt sheet (5 rows × 1 col)
  //    Rows without hurt frames are excluded.
  // ------------------------------------------------------------------
  console.log('\nBuilding animal-pets-hurt.png (hurt)...')
  await buildSheet(hurtRows, 1, resolve(OUT_DIR, 'animal-pets-hurt.png'), 'hurt')

  console.log('\nDone.')
}

main().catch((err) => {
  console.error('build-animal-pets failed:', err)
  process.exit(1)
})
