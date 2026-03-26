#!/usr/bin/env node
/**
 * Build lego-specials.png spritesheet from Lego Special items.
 *
 * lego-specials.png — 24x24 cells, single row:
 *   Frame 0: extra_box_coin.png       — coin/credits reward
 *   Frame 1: extra_box_exclamation.png — quest alert
 *   Frame 2: extra_crate.png           — loot/reward crate
 *   Frame 3: extra_crate_explosive.png — epic/legendary quest
 *   Frame 4: extra_character_a.png     — rank up "A" grade
 *
 * @module build-lego-specials
 */

import sharp from 'sharp'
import { mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const RESOURCES = resolve(ROOT, '../Phaser.Resources')
const OUT_DIR = resolve(ROOT, 'public/sprites')

const CELL = 24

async function loadIcon(src) {
  return sharp(src)
    .resize(CELL, CELL, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })
  console.log('Building lego-specials.png...')

  const SPECIAL_DIR = resolve(RESOURCES, 'Legos/Default/Special')

  const frames = [
    { file: 'extra_box_coin.png',        label: 'coin' },
    { file: 'extra_box_exclamation.png',  label: 'exclamation' },
    { file: 'extra_crate.png',            label: 'crate' },
    { file: 'extra_crate_explosive.png',  label: 'explosive' },
    { file: 'extra_character_a.png',      label: 'grade-a' },
  ]

  const composites = []
  for (let i = 0; i < frames.length; i++) {
    const src = resolve(SPECIAL_DIR, frames[i].file)
    const buf = await loadIcon(src)
    composites.push({ input: buf, left: i * CELL, top: 0 })
    console.log(`  [${i}] ${frames[i].label}`)
  }

  const totalWidth = frames.length * CELL
  const outPath = resolve(OUT_DIR, 'lego-specials.png')

  await sharp({
    create: { width: totalWidth, height: CELL, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite(composites)
    .png({ compressionLevel: 9 })
    .toFile(outPath)

  console.log(`  -> ${outPath}  (${totalWidth}x${CELL}, ${frames.length} frames)`)
  console.log('\nDone.')
}

main().catch((err) => {
  console.error('build-lego-specials failed:', err)
  process.exit(1)
})
