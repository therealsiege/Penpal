#!/usr/bin/env node
/**
 * Build game-icons-hd.png — double-size (64x64) variant of the most-used
 * game-icons frames (0-19) for LOD level 3 full-detail zoom.
 *
 * Frame layout matches game-icons.png frames 0-19:
 *   0-4:   Stars (Grey, Blue, Green, Yellow, Red)
 *   5-7:   Medals (gold, silver, bronze)
 *   8:     Checkmark (green)
 *   9:     Square outline (grey)
 *   10:    Red cross
 *   11-15: Colored circles (Blue, Green, Yellow, Red, Grey)
 *   16:    Achievement badge
 *   17:    Yellow star outline
 *   18:    Grey star outline depth
 *   19:    Blue arrow east
 *
 * @module build-icons-hd
 */

import sharp from 'sharp'
import { mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const RESOURCES = resolve(ROOT, '../Phaser.Resources')
const OUT_DIR = resolve(ROOT, 'public/sprites')

const CELL = 64 // HD cell size (2x the standard 32)

// Helper to load and resize a single icon to CELL x CELL
async function loadIcon(src) {
  return sharp(src)
    .resize(CELL, CELL, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })
  console.log('Building game-icons-hd.png (64x64 cells, frames 0-19)...')

  const composites = []
  let col = 0

  // [0-4] Stars: Grey, Blue, Green, Yellow, Red
  const starColors = ['Grey', 'Blue', 'Green', 'Yellow', 'Red']
  for (const color of starColors) {
    const src = resolve(RESOURCES, `ui-pack/PNG/${color}/Default/star.png`)
    const buf = await loadIcon(src)
    composites.push({ input: buf, left: col * CELL, top: 0 })
    console.log(`  [${col}] star-${color.toLowerCase()}`)
    col++
  }

  // [5-7] Medals from medals.png
  const medalSrc = resolve(RESOURCES, 'medals.png')
  const medalMeta = await sharp(medalSrc).metadata()
  const medalColW = Math.floor(medalMeta.width / 5)
  const medalRowH = Math.floor(medalMeta.height / 2)

  const medalPositions = [
    { col: 0, row: 0, label: 'gold' },
    { col: 1, row: 0, label: 'silver' },
    { col: 2, row: 0, label: 'bronze' },
  ]

  for (const mp of medalPositions) {
    const buf = await sharp(medalSrc)
      .extract({ left: mp.col * medalColW, top: mp.row * medalRowH, width: medalColW, height: medalRowH })
      .resize(CELL, CELL, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer()
    composites.push({ input: buf, left: col * CELL, top: 0 })
    console.log(`  [${col}] medal-${mp.label}`)
    col++
  }

  // [8] Checkmark (green)
  const checkSrc = resolve(RESOURCES, 'ui-pack/PNG/Green/Default/icon_checkmark.png')
  composites.push({ input: await loadIcon(checkSrc), left: col * CELL, top: 0 })
  console.log(`  [${col}] checkmark`)
  col++

  // [9] Square outline (grey)
  const squareSrc = resolve(RESOURCES, 'ui-pack/PNG/Grey/Default/icon_outline_square.png')
  composites.push({ input: await loadIcon(squareSrc), left: col * CELL, top: 0 })
  console.log(`  [${col}] square-outline`)
  col++

  // [10] Red cross
  const crossSrc = resolve(RESOURCES, 'ui-pack/PNG/Red/Default/icon_cross.png')
  composites.push({ input: await loadIcon(crossSrc), left: col * CELL, top: 0 })
  console.log(`  [${col}] cross-red`)
  col++

  // [11-15] Colored circle status dots: Blue, Green, Yellow, Red, Grey
  const circleColors = ['Blue', 'Green', 'Yellow', 'Red', 'Grey']
  for (const color of circleColors) {
    const src = resolve(RESOURCES, `ui-pack/PNG/${color}/Default/icon_circle.png`)
    composites.push({ input: await loadIcon(src), left: col * CELL, top: 0 })
    console.log(`  [${col}] circle-${color.toLowerCase()}`)
    col++
  }

  // [16] Blue check_square_color_checkmark — achievement badge
  const achieveBadgeSrc = resolve(RESOURCES, 'ui-pack/PNG/Blue/Default/check_square_color_checkmark.png')
  composites.push({ input: await loadIcon(achieveBadgeSrc), left: col * CELL, top: 0 })
  console.log(`  [${col}] achievement-badge`)
  col++

  // [17] Yellow star outline
  const starOutlineSrc = resolve(RESOURCES, 'ui-pack/PNG/Yellow/Default/star_outline.png')
  composites.push({ input: await loadIcon(starOutlineSrc), left: col * CELL, top: 0 })
  console.log(`  [${col}] star-outline`)
  col++

  // [18] Grey star outline depth
  const starLockedSrc = resolve(RESOURCES, 'ui-pack/PNG/Grey/Default/star_outline_depth.png')
  composites.push({ input: await loadIcon(starLockedSrc), left: col * CELL, top: 0 })
  console.log(`  [${col}] star-locked`)
  col++

  // [19] Blue arrow east
  const arrowSrc = resolve(RESOURCES, 'ui-pack/PNG/Blue/Default/arrow_basic_e.png')
  composites.push({ input: await loadIcon(arrowSrc), left: col * CELL, top: 0 })
  console.log(`  [${col}] arrow-east`)
  col++

  const totalWidth = col * CELL
  const outPath = resolve(OUT_DIR, 'game-icons-hd.png')

  await sharp({
    create: { width: totalWidth, height: CELL, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite(composites)
    .png({ compressionLevel: 9 })
    .toFile(outPath)

  console.log(`  -> ${outPath}  (${totalWidth}x${CELL}, ${col} frames)`)
  console.log('\nDone.')
}

main().catch((err) => {
  console.error('build-icons-hd failed:', err)
  process.exit(1)
})
