#!/usr/bin/env node
/**
 * Build kenney-ui spritesheet from Kenney's ui-pack (Blue/Default).
 *
 * kenney-ui.png — 32x32 cells, single row (25 frames):
 *   Frame  0: button_rectangle_depth_flat  — depth-style rect button
 *   Frame  1: button_rectangle_flat        — flat rect button
 *   Frame  2: button_round_depth_flat      — depth-style round button
 *   Frame  3: button_round_flat            — flat round button
 *   Frame  4: button_square_depth_flat     — depth-style square button
 *   Frame  5: button_square_flat           — flat square button
 *   Frame  6: arrow_basic_e               — arrow east (right)
 *   Frame  7: arrow_basic_n               — arrow north (up)
 *   Frame  8: arrow_basic_s               — arrow south (down)
 *   Frame  9: arrow_basic_w               — arrow west (left)
 *   Frame 10: arrow_decorative_e          — decorative arrow east
 *   Frame 11: arrow_decorative_n          — decorative arrow north
 *   Frame 12: arrow_decorative_s          — decorative arrow south
 *   Frame 13: arrow_decorative_w          — decorative arrow west
 *   Frame 14: check_square_color_checkmark — filled checkbox (checked)
 *   Frame 15: icon_checkmark              — bare checkmark glyph
 *   Frame 16: icon_circle                 — filled circle glyph
 *   Frame 17: icon_cross                  — cross/close glyph
 *   Frame 18: icon_outline_square         — outline square glyph
 *   Frame 19: star                        — filled star
 *   Frame 20: star_outline                — outline star
 *   Frame 21: slide_horizontal_color      — horizontal slider fill track
 *   Frame 22: slide_horizontal_grey       — horizontal slider empty track
 *   Frame 23: slide_vertical_color        — vertical slider fill track
 *   Frame 24: slide_vertical_grey         — vertical slider empty track
 *
 * @module build-kenney-ui
 */

import sharp from 'sharp'
import { mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const RESOURCES = resolve(ROOT, '../Phaser.Resources')
const SOURCE_DIR = resolve(RESOURCES, 'ui-pack/PNG/Blue/Default')
const OUT_DIR = resolve(ROOT, 'public/sprites')

const CELL = 32 // output cell size

/**
 * The ordered list of filenames to pack into the strip.
 * Each maps 1-to-1 to a frame index.
 */
const ELEMENTS = [
  'button_rectangle_depth_flat.png',
  'button_rectangle_flat.png',
  'button_round_depth_flat.png',
  'button_round_flat.png',
  'button_square_depth_flat.png',
  'button_square_flat.png',
  'arrow_basic_e.png',
  'arrow_basic_n.png',
  'arrow_basic_s.png',
  'arrow_basic_w.png',
  'arrow_decorative_e.png',
  'arrow_decorative_n.png',
  'arrow_decorative_s.png',
  'arrow_decorative_w.png',
  'check_square_color_checkmark.png',
  'icon_checkmark.png',
  'icon_circle.png',
  'icon_cross.png',
  'icon_outline_square.png',
  'star.png',
  'star_outline.png',
  'slide_horizontal_color.png',
  'slide_horizontal_grey.png',
  'slide_vertical_color.png',
  'slide_vertical_grey.png',
]

/**
 * Load and resize a single source image into a CELL x CELL buffer.
 * @param {string} srcPath - Absolute path to the source PNG.
 * @returns {Promise<Buffer>}
 */
async function loadElement(srcPath) {
  return sharp(srcPath)
    .resize(CELL, CELL, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })

  console.log('Building kenney-ui.png...')

  const composites = []
  for (let i = 0; i < ELEMENTS.length; i++) {
    const filename = ELEMENTS[i]
    const srcPath = resolve(SOURCE_DIR, filename)
    const buf = await loadElement(srcPath)
    composites.push({ input: buf, left: i * CELL, top: 0 })
    // Strip extension for log readability
    const label = filename.replace('.png', '')
    console.log(`  [${i.toString().padStart(2, '0')}] ${label}`)
  }

  const totalWidth = ELEMENTS.length * CELL
  const outPath = resolve(OUT_DIR, 'kenney-ui.png')

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

  console.log(`  -> ${outPath}  (${totalWidth}x${CELL}, ${ELEMENTS.length} frames)`)
  console.log('\nDone.')
}

main().catch((err) => {
  console.error('build-kenney-ui failed:', err)
  process.exit(1)
})
