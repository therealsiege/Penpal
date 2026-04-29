#!/usr/bin/env node
/**
 * Build UI panel sprites from Phaser.Resources ui-pack.
 *
 * Copies and optimizes individual panel images (not a spritesheet — they're
 * different sizes):
 *   - panel-bg.png        — dark filled rectangle (thought bubble background)
 *   - panel-outline.png   — outlined rectangle (monitor screen frame)
 *   - button-square.png   — square button (mini HUD elements)
 *
 * @module build-ui-panels
 */

import sharp from 'sharp'
import { mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const RESOURCES = resolve(ROOT, '../Phaser.Resources')
const OUT_DIR = resolve(ROOT, 'public/sprites')
const EXTRA = resolve(RESOURCES, 'ui-pack/PNG/Extra/Default')

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })

  const files = [
    { src: 'input_rectangle.png', out: 'panel-bg.png', label: 'panel-bg (dark filled rect)' },
    { src: 'input_outline_rectangle.png', out: 'panel-outline.png', label: 'panel-outline (outlined rect)' },
    { src: 'button_square_depth_line.png', out: 'button-square.png', label: 'button-square (square button)' },
  ]

  for (const f of files) {
    const srcPath = resolve(EXTRA, f.src)
    const outPath = resolve(OUT_DIR, f.out)
    await sharp(srcPath).png({ compressionLevel: 9 }).toFile(outPath)
    console.log(`  -> ${f.out}  (${f.label})`)
  }

  console.log('\nDone.')
}

main().catch((err) => {
  console.error('build-ui-panels failed:', err)
  process.exit(1)
})
