#!/usr/bin/env node
/**
 * Build office-furniture.png spritesheet from Modern Office singles.
 *
 * Packs all 339 individual 48x48 PNGs into a grid atlas:
 *   - 20 columns x 17 rows = 340 cells (last cell empty)
 *   - Output: 960x816 px (20*48 x 17*48)
 *   - Frame index = tile number - 1  (0-based, sorted numerically)
 *
 * Source: Modern_Office_Singles_48x48_1.png … Modern_Office_Singles_48x48_339.png
 *
 * Usage in Phaser:
 *   this.load.spritesheet('office-furniture', 'sprites/office-furniture.png', {
 *     frameWidth: 48, frameHeight: 48,
 *   })
 *   // frame 0 = tile #1, frame 233 = tile #234 (desk-dark-l), etc.
 *
 * Known useful frame indices (0-based, tile number - 1):
 *   233 desk-dark-l    234 desk-dark-r
 *   235 desk-light-l   236 desk-light-r
 *   249 chair-office   250 chair-task
 *   199 monitor-on     200 monitor-off
 *    66 plant-small     67 plant-large
 *    95 bookshelf       96 bookshelf-full
 *   125 printer        119 water-cooler
 *    93 whiteboard     101 sofa-l         102 sofa-r
 *    97 filing-cabinet 118 trash-bin      120 coffee-machine
 *
 * @module build-office-furniture
 */

import sharp from 'sharp'
import { mkdirSync, readdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const HOME = process.env.HOME || process.env.USERPROFILE || '/Users/fuzeelogik'
const SOURCE_DIR = resolve(HOME, 'Downloads/Resources/Modern_Office/4_Modern_Office_singles/48x48')
const OUT_DIR = resolve(ROOT, 'public/sprites')

const CELL = 48        // each tile is 48x48
const COLS = 20        // columns per row

/**
 * Parse the numeric suffix from a tile filename.
 * "Modern_Office_Singles_48x48_123.png" -> 123
 *
 * @param {string} filename
 * @returns {number}
 */
function parseTileNumber(filename) {
  const match = filename.match(/(\d+)\.png$/)
  return match ? parseInt(match[1], 10) : 0
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })

  // Read and sort all PNGs numerically by tile number.
  const allFiles = readdirSync(SOURCE_DIR)
    .filter((f) => f.endsWith('.png'))
    .sort((a, b) => parseTileNumber(a) - parseTileNumber(b))

  const tileCount = allFiles.length
  const rows = Math.ceil(tileCount / COLS)
  const canvasW = COLS * CELL
  const canvasH = rows * CELL

  console.log(`Building office-furniture.png...`)
  console.log(`  Source: ${SOURCE_DIR}`)
  console.log(`  Tiles:  ${tileCount}`)
  console.log(`  Grid:   ${COLS} cols x ${rows} rows`)
  console.log(`  Canvas: ${canvasW}x${canvasH} px`)

  const composites = []

  for (let i = 0; i < tileCount; i++) {
    const filename = allFiles[i]
    const tileNum = parseTileNumber(filename)
    const col = i % COLS
    const row = Math.floor(i / COLS)
    const left = col * CELL
    const top = row * CELL

    // Tiles are already 48x48; resize is a no-op for correct tiles but guards
    // against any edge cases in the source pack.
    const buf = await sharp(resolve(SOURCE_DIR, filename))
      .resize(CELL, CELL, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer()

    composites.push({ input: buf, left, top })

    if (i % 50 === 0 || i === tileCount - 1) {
      console.log(`  [${String(i).padStart(3)}/${tileCount}] tile #${tileNum}  -> (${col}, ${row})`)
    }
  }

  const outPath = resolve(OUT_DIR, 'office-furniture.png')

  await sharp({
    create: { width: canvasW, height: canvasH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite(composites)
    .png({ compressionLevel: 9 })
    .toFile(outPath)

  console.log(`  -> ${outPath}  (${canvasW}x${canvasH}, ${tileCount} frames)`)
  console.log('\nDone.')
}

main().catch((err) => {
  console.error('build-office-furniture failed:', err)
  process.exit(1)
})
