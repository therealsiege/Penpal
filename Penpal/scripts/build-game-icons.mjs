#!/usr/bin/env node
/**
 * Build game-icons spritesheet + game-effects spritesheets from Phaser.Resources.
 *
 * game-icons.png — 32x32 cells, single row:
 *   Frame 0-4:   Stars (Grey, Blue, Green, Yellow, Red) — quest difficulty
 *   Frame 5-7:   Medals (gold, silver, bronze) — leaderboard rank icons
 *   Frame 8:     Checkmark (green) — challenge complete
 *   Frame 9:     Square outline (grey) — challenge incomplete
 *   Frame 10:    Red cross — error/failed quest
 *   Frame 11:    Blue circle — working status dot
 *   Frame 12:    Green circle — active/online status dot
 *   Frame 13:    Yellow circle — waiting/needs-attention status dot
 *   Frame 14:    Red circle — error status dot
 *   Frame 15:    Grey circle — idle/offline status dot
 *   Frame 16:    Blue check_square_color_checkmark — achievement badge
 *   Frame 17:    Yellow star outline — empty/unfilled star
 *   Frame 18:    Grey star outline depth — locked achievement
 *   Frame 19:    Blue arrow east — navigation/working indicator
 *   Frame 22-26: 5 remaining medals (row 0 cols 3-4, row 1 cols 0-2)
 *   Frame 27:    Blue button_round_depth_flat — round HUD button
 *
 * game-effects-flash.png     — 9 frames at 128x128 each (single row)
 * game-effects-puff.png      — 25 frames at 128x128 each (single row)
 * game-effects-explosion.png — 9 frames at 128x128 each (single row)
 * game-effects-smoke.png     — 25 frames at 128x128 each (single row)
 * game-effects-fart.png      — 9 frames at 128x128 each (single row)
 *
 * @module build-game-icons
 */

import sharp from 'sharp'
import { mkdirSync, readdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const RESOURCES = resolve(ROOT, '../Phaser.Resources')
const OUT_DIR = resolve(ROOT, 'public/sprites')

const CELL = 32 // icon cell size

// Helper to load and resize a single icon to CELL x CELL
async function loadIcon(src) {
  return sharp(src)
    .resize(CELL, CELL, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()
}

// ---------------------------------------------------------------------------
// game-icons.png
// ---------------------------------------------------------------------------

async function buildGameIcons() {
  console.log('Building game-icons.png...')

  const composites = []
  let col = 0

  // Stars: Grey, Blue, Green, Yellow, Red (quest difficulty: trivial->legendary)
  const starColors = ['Grey', 'Blue', 'Green', 'Yellow', 'Red']
  for (const color of starColors) {
    const src = resolve(RESOURCES, `ui-pack/PNG/${color}/Default/star.png`)
    const buf = await loadIcon(src)
    composites.push({ input: buf, left: col * CELL, top: 0 })
    console.log(`  [${col}] star-${color.toLowerCase()}`)
    col++
  }

  // Medals from medals.png (216x165, 5 columns x 2 rows)
  // Row 0: gold star, silver floral, bronze floral, silver round, bronze round
  // Row 1: gold round yellow/blue, gold round purple, gold round white, silver round white, bronze round white?
  // We want: gold (col 0, row 0), silver (col 1, row 0), bronze (col 2, row 0)
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

  // Checkmark (green)
  const checkSrc = resolve(RESOURCES, 'ui-pack/PNG/Green/Default/icon_checkmark.png')
  composites.push({ input: await loadIcon(checkSrc), left: col * CELL, top: 0 })
  console.log(`  [${col}] checkmark`)
  col++

  // Square outline (grey) — incomplete challenge
  const squareSrc = resolve(RESOURCES, 'ui-pack/PNG/Grey/Default/icon_outline_square.png')
  composites.push({ input: await loadIcon(squareSrc), left: col * CELL, top: 0 })
  console.log(`  [${col}] square-outline`)
  col++

  // --- NEW FRAMES ---

  // [10] Red cross — error/failed indicator
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

  // [17] Yellow star outline — empty/unfilled star
  const starOutlineSrc = resolve(RESOURCES, 'ui-pack/PNG/Yellow/Default/star_outline.png')
  composites.push({ input: await loadIcon(starOutlineSrc), left: col * CELL, top: 0 })
  console.log(`  [${col}] star-outline`)
  col++

  // [18] Grey star outline depth — locked achievement placeholder
  const starLockedSrc = resolve(RESOURCES, 'ui-pack/PNG/Grey/Default/star_outline_depth.png')
  composites.push({ input: await loadIcon(starLockedSrc), left: col * CELL, top: 0 })
  console.log(`  [${col}] star-locked`)
  col++

  // [19] Blue arrow east — navigation/working direction
  const arrowSrc = resolve(RESOURCES, 'ui-pack/PNG/Blue/Default/arrow_basic_e.png')
  composites.push({ input: await loadIcon(arrowSrc), left: col * CELL, top: 0 })
  console.log(`  [${col}] arrow-east`)
  col++

  // [20-21] Reserved (skip for alignment)
  // Leave empty transparent frames for future use
  col += 2

  // [22-26] 5 remaining medals from medals.png (row 0 cols 3-4, row 1 cols 0-2)
  const extraMedalPositions = [
    { col: 3, row: 0, label: 'silver-round' },
    { col: 4, row: 0, label: 'bronze-round' },
    { col: 0, row: 1, label: 'gold-blue' },
    { col: 1, row: 1, label: 'gold-purple' },
    { col: 2, row: 1, label: 'gold-white' },
  ]

  for (const mp of extraMedalPositions) {
    const buf = await sharp(medalSrc)
      .extract({ left: mp.col * medalColW, top: mp.row * medalRowH, width: medalColW, height: medalRowH })
      .resize(CELL, CELL, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer()
    composites.push({ input: buf, left: col * CELL, top: 0 })
    console.log(`  [${col}] medal-${mp.label}`)
    col++
  }

  // [27] Blue button_round_depth_flat — HUD round button
  const btnSrc = resolve(RESOURCES, 'ui-pack/PNG/Blue/Default/button_round_depth_flat.png')
  composites.push({ input: await loadIcon(btnSrc), left: col * CELL, top: 0 })
  console.log(`  [${col}] button-round`)
  col++

  // [28] Play icon (dark) — working/active indicator
  const playSrc = resolve(RESOURCES, 'ui-pack/PNG/Extra/Default/icon_play_dark.png')
  composites.push({ input: await loadIcon(playSrc), left: col * CELL, top: 0 })
  console.log(`  [${col}] play-dark`)
  col++

  // [29] Repeat icon (dark) — compressing/retry indicator
  const repeatSrc = resolve(RESOURCES, 'ui-pack/PNG/Extra/Default/icon_repeat_dark.png')
  composites.push({ input: await loadIcon(repeatSrc), left: col * CELL, top: 0 })
  console.log(`  [${col}] repeat-dark`)
  col++

  // [30] Arrow up icon (dark) — rank up indicator
  const arrowUpSrc = resolve(RESOURCES, 'ui-pack/PNG/Extra/Default/icon_arrow_up_dark.png')
  composites.push({ input: await loadIcon(arrowUpSrc), left: col * CELL, top: 0 })
  console.log(`  [${col}] arrow-up-dark`)
  col++

  const totalWidth = col * CELL
  const outPath = resolve(OUT_DIR, 'game-icons.png')

  await sharp({
    create: { width: totalWidth, height: CELL, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite(composites)
    .png({ compressionLevel: 9 })
    .toFile(outPath)

  console.log(`  -> ${outPath}  (${totalWidth}x${CELL}, ${col} frames)`)
}

// ---------------------------------------------------------------------------
// game-effects-*.png — N frames packed into a single-row strip
// ---------------------------------------------------------------------------

async function buildEffectStrip(effectName, prefix, frameCount, outName) {
  console.log(`Building ${outName}...`)
  const EFFECT_CELL = 128
  const dir = resolve(RESOURCES, `effects/${effectName}`)

  // Sort frames numerically
  const files = readdirSync(dir)
    .filter(f => f.startsWith(prefix) && f.endsWith('.png'))
    .sort((a, b) => {
      const numA = parseInt(a.replace(prefix, '').replace('.png', ''), 10)
      const numB = parseInt(b.replace(prefix, '').replace('.png', ''), 10)
      return numA - numB
    })
    .slice(0, frameCount)

  const composites = []
  for (let i = 0; i < files.length; i++) {
    const src = resolve(dir, files[i])
    const buf = await sharp(src)
      .resize(EFFECT_CELL, EFFECT_CELL, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer()
    composites.push({ input: buf, left: i * EFFECT_CELL, top: 0 })
  }

  const totalWidth = files.length * EFFECT_CELL
  const outPath = resolve(OUT_DIR, outName)

  await sharp({
    create: { width: totalWidth, height: EFFECT_CELL, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite(composites)
    .png({ compressionLevel: 9 })
    .toFile(outPath)

  console.log(`  -> ${outPath}  (${totalWidth}x${EFFECT_CELL}, ${files.length} frames)`)
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })

  await buildGameIcons()
  await buildEffectStrip('Flash', 'flash', 9, 'game-effects-flash.png')
  await buildEffectStrip('White puff', 'whitePuff', 25, 'game-effects-puff.png')
  await buildEffectStrip('Explosion', 'explosion', 9, 'game-effects-explosion.png')
  await buildEffectStrip('Black smoke', 'blackSmoke', 25, 'game-effects-smoke.png')
  await buildEffectStrip('Fart', 'fart', 9, 'game-effects-fart.png')

  // Copy slider track/fill sprites for season HUD progress bar
  console.log('Copying slider sprites...')
  const sliderTrackSrc = resolve(RESOURCES, 'ui-pack/PNG/Grey/Default/slide_horizontal_grey.png')
  const sliderFillSrc = resolve(RESOURCES, 'ui-pack/PNG/Blue/Default/slide_horizontal_color.png')
  await sharp(sliderTrackSrc).png().toFile(resolve(OUT_DIR, 'slider-track.png'))
  console.log('  -> slider-track.png')
  await sharp(sliderFillSrc).png().toFile(resolve(OUT_DIR, 'slider-fill.png'))
  console.log('  -> slider-fill.png')

  // Copy vertical slider sprites for workstation energy bars
  const vSliderTrackSrc = resolve(RESOURCES, 'ui-pack/PNG/Grey/Default/slide_vertical_grey.png')
  const vSliderFillSrc = resolve(RESOURCES, 'ui-pack/PNG/Blue/Default/slide_vertical_color.png')
  await sharp(vSliderTrackSrc).png().toFile(resolve(OUT_DIR, 'vslider-track.png'))
  console.log('  -> vslider-track.png')
  await sharp(vSliderFillSrc).png().toFile(resolve(OUT_DIR, 'vslider-fill.png'))
  console.log('  -> vslider-fill.png')

  // Copy divider sprite for panel section dividers
  console.log('Copying divider sprite...')
  const dividerSrc = resolve(RESOURCES, 'ui-pack/PNG/Extra/Default/divider.png')
  await sharp(dividerSrc).png().toFile(resolve(OUT_DIR, 'divider.png'))
  console.log('  -> divider.png')

  console.log('\nDone.')
}

main().catch((err) => {
  console.error('build-game-icons failed:', err)
  process.exit(1)
})
