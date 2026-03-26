#!/usr/bin/env node
/**
 * Build lego-bar.png spritesheet — 5 colored Lego brick segments in a single row.
 *
 * lego-bar.png — 16x8 cells, single row:
 *   Frame 0: Blue
 *   Frame 1: Green
 *   Frame 2: Yellow
 *   Frame 3: Red
 *   Frame 4: Special
 *
 * @module build-lego-bar
 */

import sharp from 'sharp'
import { mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const RESOURCES = resolve(ROOT, '../Phaser.Resources')
const OUT_DIR = resolve(ROOT, 'public/sprites')

const CELL_W = 16
const CELL_H = 8

// Each entry: [color label, relative path from Legos/Default/]
const BRICKS = [
  ['Blue',    'Blue/brick_low_2.png'],
  ['Green',   'Green/brick_low_2.png'],
  ['Yellow',  'Yellow/brick_low_2.png'],
  ['Red',     'Red/brick_low_2.png'],
  ['Special', 'Special/extra_box_coin.png'],
]

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })

  console.log('Building lego-bar.png...')

  const composites = []

  for (let i = 0; i < BRICKS.length; i++) {
    const [color, relPath] = BRICKS[i]
    const src = resolve(RESOURCES, `Legos/Default/${relPath}`)
    const buf = await sharp(src)
      .resize(CELL_W, CELL_H, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer()
    composites.push({ input: buf, left: i * CELL_W, top: 0 })
    console.log(`  [${i}] ${color}`)
  }

  const totalWidth = BRICKS.length * CELL_W
  const outPath = resolve(OUT_DIR, 'lego-bar.png')

  await sharp({
    create: { width: totalWidth, height: CELL_H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite(composites)
    .png({ compressionLevel: 9 })
    .toFile(outPath)

  console.log(`  -> ${outPath}  (${totalWidth}x${CELL_H}, ${BRICKS.length} frames)`)
  console.log('\nDone.')
}

main().catch((err) => {
  console.error('build-lego-bar failed:', err)
  process.exit(1)
})
