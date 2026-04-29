#!/usr/bin/env node
/**
 * Build desk-pet-faces spritesheet from composable.monsters.png.
 *
 * desk-pet-faces.png — 16x8 cells, single row (8 frames):
 *   Frame 0: Eyes cute round
 *   Frame 1: Eyes angry x-eyes
 *   Frame 2: Eyes wide surprised
 *   Frame 3: Eyes sleepy
 *   Frame 4: Mouth happy smile
 *   Frame 5: Mouth teeth grin
 *   Frame 6: Mouth small o
 *   Frame 7: Mouth flat line
 *
 * @module build-pet-faces
 */

import sharp from 'sharp'
import { mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const RESOURCES = resolve(ROOT, '../Phaser.Resources')
const OUT_DIR = resolve(ROOT, 'public/sprites')

const CELL_W = 16 // output cell width
const CELL_H = 8  // output cell height
const SRC = resolve(RESOURCES, 'composable.monsters.png')

// Extraction regions from composable.monsters.png (1479x1480).
// Coordinates are approximate — extracting eye pairs and mouths from the
// feature components area of the composable monster atlas.
const FACES = [
  // Eye pairs
  { label: 'eyes-cute',     x: 230, y: 330, w: 80, h: 30 },
  { label: 'eyes-angry',    x: 100, y: 530, w: 80, h: 30 },
  { label: 'eyes-wide',     x: 230, y: 250, w: 80, h: 30 },
  { label: 'eyes-sleepy',   x: 345, y: 340, w: 60, h: 20 },
  // Mouths
  { label: 'mouth-happy',   x: 175, y: 340, w: 50, h: 25 },
  { label: 'mouth-grin',    x: 160, y: 530, w: 60, h: 30 },
  { label: 'mouth-o',       x: 285, y: 340, w: 30, h: 20 },
  { label: 'mouth-flat',    x: 280, y: 250, w: 40, h: 15 },
]

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })

  console.log('Building desk-pet-faces.png...')

  const composites = []
  for (let i = 0; i < FACES.length; i++) {
    const face = FACES[i]
    const buf = await sharp(SRC)
      .extract({ left: face.x, top: face.y, width: face.w, height: face.h })
      .resize(CELL_W, CELL_H, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer()
    composites.push({ input: buf, left: i * CELL_W, top: 0 })
    console.log(`  [${i}] ${face.label}`)
  }

  const totalWidth = FACES.length * CELL_W
  const outPath = resolve(OUT_DIR, 'desk-pet-faces.png')

  await sharp({
    create: { width: totalWidth, height: CELL_H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite(composites)
    .png({ compressionLevel: 9 })
    .toFile(outPath)

  console.log(`  -> ${outPath}  (${totalWidth}x${CELL_H}, ${FACES.length} frames)`)
  console.log('\nDone.')
}

main().catch((err) => {
  console.error('build-pet-faces failed:', err)
  process.exit(1)
})
