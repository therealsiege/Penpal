#!/usr/bin/env node
/**
 * Build medals-hd.png spritesheet from Phaser.Resources/medals.png.
 *
 * Source: 216x165 PNG, 5 columns x 2 rows of detailed medal sprites.
 * Output: Single-row strip of 10 medals at 43x82 each.
 *
 * medals-hd.png — 43x82 cells, single row (10 frames):
 *   Frame 0: Gold star medal
 *   Frame 1: Silver floral medal
 *   Frame 2: Bronze floral medal
 *   Frame 3: Silver round medal
 *   Frame 4: Bronze round medal
 *   Frame 5: Gold blue medal
 *   Frame 6: Gold purple medal
 *   Frame 7: Gold white medal
 *   Frame 8: Silver white medal
 *   Frame 9: Bronze white medal
 *
 * @module build-medals-hd
 */

import sharp from 'sharp'
import { mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const RESOURCES = resolve(ROOT, '../Phaser.Resources')
const OUT_DIR = resolve(ROOT, 'public/sprites')

const SRC = resolve(RESOURCES, 'medals.png')
const COLS = 5
const ROWS = 2
const CELL_W = 43  // 216 / 5 = 43.2 -> 43
const CELL_H = 82  // 165 / 2 = 82.5 -> 82

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })

  console.log('Building medals-hd.png...')
  console.log(`  Source: ${SRC} (${COLS}x${ROWS} grid, ${CELL_W}x${CELL_H} cells)`)

  const composites = []
  let frameIdx = 0

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const buf = await sharp(SRC)
        .extract({
          left: col * CELL_W,
          top: row * CELL_H,
          width: Math.min(CELL_W, 216 - col * CELL_W),
          height: Math.min(CELL_H, 165 - row * CELL_H),
        })
        .resize(CELL_W, CELL_H, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer()
      composites.push({ input: buf, left: frameIdx * CELL_W, top: 0 })
      console.log(`  [${frameIdx}] row ${row}, col ${col}`)
      frameIdx++
    }
  }

  const totalWidth = frameIdx * CELL_W
  const outPath = resolve(OUT_DIR, 'medals-hd.png')

  await sharp({
    create: { width: totalWidth, height: CELL_H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite(composites)
    .png({ compressionLevel: 9 })
    .toFile(outPath)

  console.log(`  -> ${outPath}  (${totalWidth}x${CELL_H}, ${frameIdx} frames)`)
  console.log('\nDone.')
}

main().catch((err) => {
  console.error('build-medals-hd failed:', err)
  process.exit(1)
})
