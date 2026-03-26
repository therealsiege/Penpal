#!/usr/bin/env node
/**
 * Build game-items.png spritesheet from generic.items.png.
 *
 * Extracts individual items by pixel bounding box from the irregularly-packed
 * 1024x2048 source atlas, resizes each to 32x32, and packs them into a
 * single-row spritesheet.
 *
 * game-items.png — 32x32 cells, single row:
 *   Frame 0:  Coffee cup (white)
 *   Frame 1:  Monitor / laptop
 *   Frame 2:  Book (blue)
 *   Frame 3:  Headphones
 *   Frame 4:  Phone / mobile
 *   Frame 5:  Pizza slice
 *   Frame 6:  Paint palette
 *   Frame 7:  Wrench / tool
 *   Frame 8:  Beer / drink
 *   Frame 9:  First aid kit (red)
 *   Frame 10: Camera
 *   Frame 11: Donut
 *
 * @module build-game-items
 */

import sharp from 'sharp'
import { mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const RESOURCES = resolve(ROOT, '../Phaser.Resources')
const OUT_DIR = resolve(ROOT, 'public/sprites')
const SOURCE = resolve(RESOURCES, 'generic.items.png')

const CELL = 32 // output cell size

// Item extraction regions — approximate bounding boxes within generic.items.png
// { name, x, y, w, h } — pixel coordinates in the 1024x2048 source
const ITEMS = [
  { name: 'coffee-cup',    x: 270, y: 160, w: 50, h: 60 },
  { name: 'monitor',       x: 10,  y: 10,  w: 80, h: 60 },
  { name: 'book',          x: 210, y: 605, w: 50, h: 55 },
  { name: 'headphones',    x: 270, y: 880, w: 60, h: 55 },
  { name: 'phone',         x: 875, y: 860, w: 35, h: 55 },
  { name: 'pizza',         x: 180, y: 350, w: 50, h: 45 },
  { name: 'paint-palette', x: 205, y: 465, w: 65, h: 50 },
  { name: 'wrench',        x: 445, y: 380, w: 50, h: 50 },
  { name: 'beer',          x: 620, y: 640, w: 35, h: 60 },
  { name: 'first-aid',     x: 10,  y: 440, w: 70, h: 55 },
  { name: 'camera',        x: 480, y: 500, w: 65, h: 50 },
  { name: 'donut',         x: 410, y: 445, w: 45, h: 45 },
]

async function buildGameItems() {
  console.log('Building game-items.png...')
  console.log(`  Source: ${SOURCE}`)
  console.log(`  Items: ${ITEMS.length}`)

  const composites = []

  for (let i = 0; i < ITEMS.length; i++) {
    const item = ITEMS[i]

    // Extract the bounding box region from the source atlas
    const buf = await sharp(SOURCE)
      .extract({ left: item.x, top: item.y, width: item.w, height: item.h })
      .resize(CELL, CELL, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer()

    composites.push({ input: buf, left: i * CELL, top: 0 })
    console.log(`  [${i}] ${item.name}  (${item.x},${item.y} ${item.w}x${item.h})`)
  }

  const totalWidth = ITEMS.length * CELL
  const outPath = resolve(OUT_DIR, 'game-items.png')

  await sharp({
    create: {
      width: totalWidth,
      height: CELL,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composites)
    .png({ compressionLevel: 9 })
    .toFile(outPath)

  console.log(`  -> ${outPath}  (${totalWidth}x${CELL}, ${ITEMS.length} frames)`)
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })
  await buildGameItems()
  console.log('\nDone.')
}

main().catch((err) => {
  console.error('build-game-items failed:', err)
  process.exit(1)
})
