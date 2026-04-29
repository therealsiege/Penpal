#!/usr/bin/env node
/**
 * Build desk-pets spritesheet from composable.monsters.png.
 *
 * desk-pets.png — 24x24 cells, single row (6 frames):
 *   Frame 0: Brown body
 *   Frame 1: Green body
 *   Frame 2: Blue/cyan body
 *   Frame 3: Pink body
 *   Frame 4: Yellow body
 *   Frame 5: Grey body
 *
 * @module build-desk-pets
 */

import sharp from 'sharp'
import { mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const RESOURCES = resolve(ROOT, '../Phaser.Resources')
const OUT_DIR = resolve(ROOT, 'public/sprites')

const CELL = 24 // output cell size
const SRC = resolve(RESOURCES, 'composable.monsters.png')

// Extraction regions — body circles/ovals from the composable monsters sheet.
// Coordinates refined from visual inspection of the 1479x1480 image.
const PETS = [
  { label: 'brown',  x: 8,   y: 8,   w: 140, h: 140 }, // top-left brown circle
  { label: 'green',  x: 150, y: 8,   w: 140, h: 140 }, // green circle right of brown
  { label: 'blue',   x: 8,   y: 230, w: 140, h: 140 }, // blue circle row 2 left
  { label: 'pink',   x: 430, y: 8,   w: 130, h: 160 }, // pink oval top row
  { label: 'yellow', x: 8,   y: 600, w: 145, h: 145 }, // yellow circle row 4
  { label: 'grey',   x: 8,   y: 440, w: 140, h: 140 }, // grey circle row 3
]

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })

  console.log('Building desk-pets.png...')

  const composites = []
  for (let i = 0; i < PETS.length; i++) {
    const pet = PETS[i]
    const buf = await sharp(SRC)
      .extract({ left: pet.x, top: pet.y, width: pet.w, height: pet.h })
      .resize(CELL, CELL, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer()
    composites.push({ input: buf, left: i * CELL, top: 0 })
    console.log(`  [${i}] pet-${pet.label}`)
  }

  const totalWidth = PETS.length * CELL
  const outPath = resolve(OUT_DIR, 'desk-pets.png')

  await sharp({
    create: { width: totalWidth, height: CELL, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite(composites)
    .png({ compressionLevel: 9 })
    .toFile(outPath)

  console.log(`  -> ${outPath}  (${totalWidth}x${CELL}, ${PETS.length} frames)`)
  console.log('\nDone.')
}

main().catch((err) => {
  console.error('build-desk-pets failed:', err)
  process.exit(1)
})
