#!/usr/bin/env node
/**
 * Build monster-parts spritesheets from composable.monsters.png (1479x1480).
 *
 * Produces three single-row strips:
 *
 *   monster-bodies.png — 32x32 cells, 6 frames:
 *     Frame 0: brown  body
 *     Frame 1: green  body
 *     Frame 2: blue   body
 *     Frame 3: pink   body
 *     Frame 4: yellow body
 *     Frame 5: grey   body
 *
 *   monster-eyes.png — 16x8 cells, 6 frames:
 *     Frame 0: eyes-round
 *     Frame 1: eyes-wide
 *     Frame 2: eyes-angry
 *     Frame 3: eyes-cute
 *     Frame 4: eyes-sleepy
 *     Frame 5: eyes-tiny
 *
 *   monster-mouths.png — 16x8 cells, 6 frames:
 *     Frame 0: mouth-happy
 *     Frame 1: mouth-grin
 *     Frame 2: mouth-o
 *     Frame 3: mouth-flat
 *     Frame 4: mouth-teeth
 *     Frame 5: mouth-fangs
 *
 * @module build-monster-parts
 */

import sharp from 'sharp'
import { mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const RESOURCES = resolve(ROOT, '../Phaser.Resources')
const OUT_DIR = resolve(ROOT, 'public/sprites')

const SRC = resolve(RESOURCES, 'composable.monsters.png')

// ---------------------------------------------------------------------------
// Body extraction regions — large circular/oval shapes.
// Coordinates refined from visual inspection of the 1479x1480 source.
// Extended from build-desk-pets.mjs body definitions.
// ---------------------------------------------------------------------------

/** @type {Array<{label: string, x: number, y: number, w: number, h: number}>} */
const BODIES = [
  { label: 'brown',  x: 8,   y: 8,   w: 140, h: 140 }, // top-left brown circle
  { label: 'green',  x: 150, y: 8,   w: 140, h: 140 }, // green circle right of brown
  { label: 'blue',   x: 8,   y: 230, w: 140, h: 140 }, // blue circle row 2 left
  { label: 'pink',   x: 430, y: 8,   w: 130, h: 160 }, // pink oval top row
  { label: 'yellow', x: 8,   y: 600, w: 145, h: 145 }, // yellow circle row 4
  { label: 'grey',   x: 8,   y: 440, w: 140, h: 140 }, // grey circle row 3
]

// ---------------------------------------------------------------------------
// Eye-pair extraction regions — approximate positions in the parts area.
// ---------------------------------------------------------------------------

/** @type {Array<{label: string, x: number, y: number, w: number, h: number}>} */
const EYES = [
  { label: 'eyes-round',  x: 300, y: 8,   w: 60, h: 30 },
  { label: 'eyes-wide',   x: 300, y: 50,  w: 60, h: 30 },
  { label: 'eyes-angry',  x: 300, y: 95,  w: 60, h: 30 },
  { label: 'eyes-cute',   x: 300, y: 140, w: 60, h: 30 },
  { label: 'eyes-sleepy', x: 300, y: 185, w: 60, h: 30 },
  { label: 'eyes-tiny',   x: 300, y: 230, w: 60, h: 30 },
]

// ---------------------------------------------------------------------------
// Mouth extraction regions — approximate positions in the parts area.
// ---------------------------------------------------------------------------

/** @type {Array<{label: string, x: number, y: number, w: number, h: number}>} */
const MOUTHS = [
  { label: 'mouth-happy', x: 370, y: 8,   w: 40, h: 30 },
  { label: 'mouth-grin',  x: 370, y: 50,  w: 40, h: 30 },
  { label: 'mouth-o',     x: 370, y: 95,  w: 40, h: 30 },
  { label: 'mouth-flat',  x: 370, y: 140, w: 40, h: 30 },
  { label: 'mouth-teeth', x: 370, y: 185, w: 40, h: 30 },
  { label: 'mouth-fangs', x: 370, y: 230, w: 40, h: 30 },
]

// ---------------------------------------------------------------------------
// Strip builder — generic single-row packer.
// ---------------------------------------------------------------------------

/**
 * Extract a list of regions from the source image and pack them into a
 * single-row PNG strip at the specified cell dimensions.
 *
 * @param {string} label        - Human-readable label for console output.
 * @param {Array<{label: string, x: number, y: number, w: number, h: number}>} regions
 * @param {number} cellW        - Output cell width in pixels.
 * @param {number} cellH        - Output cell height in pixels.
 * @param {string} outFilename  - Basename of the output file (no path prefix).
 * @returns {Promise<void>}
 */
async function buildStrip(label, regions, cellW, cellH, outFilename) {
  console.log(`Building ${outFilename}...`)

  const composites = []
  for (let i = 0; i < regions.length; i++) {
    const region = regions[i]
    const buf = await sharp(SRC)
      .extract({ left: region.x, top: region.y, width: region.w, height: region.h })
      .resize(cellW, cellH, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer()
    composites.push({ input: buf, left: i * cellW, top: 0 })
    console.log(`  [${i}] ${region.label}`)
  }

  const totalWidth = regions.length * cellW
  const outPath = resolve(OUT_DIR, outFilename)

  await sharp({
    create: {
      width: totalWidth,
      height: cellH,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composites)
    .png({ compressionLevel: 9 })
    .toFile(outPath)

  console.log(`  -> ${outPath}  (${totalWidth}x${cellH}, ${regions.length} frames)`)
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })

  await buildStrip('bodies',  BODIES, 32, 32, 'monster-bodies.png')
  await buildStrip('eyes',    EYES,   16,  8, 'monster-eyes.png')
  await buildStrip('mouths',  MOUTHS, 16,  8, 'monster-mouths.png')

  console.log('\nDone.')
}

main().catch((err) => {
  console.error('build-monster-parts failed:', err)
  process.exit(1)
})
