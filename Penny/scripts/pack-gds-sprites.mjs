#!/usr/bin/env node

/**
 * pack-gds-sprites.mjs
 *
 * Packs individual PNGs from a GDS export into a single Phaser 3 texture atlas.
 * Unlike the composited scene atlas, each sprite is packed separately — no
 * overlap artifacts when rendering individual components.
 *
 * Usage:
 *   node scripts/pack-gds-sprites.mjs <pngs-dir> <output-image> <output-json>
 *
 * Requires: sharp
 */

import { readdirSync, writeFileSync } from 'fs'
import { resolve, join, basename, extname } from 'path'
import sharp from 'sharp'

const [,, pngsDirArg, outputImageArg, outputJsonArg] = process.argv

if (!pngsDirArg || !outputImageArg || !outputJsonArg) {
  console.error('Usage: node scripts/pack-gds-sprites.mjs <pngs-dir> <output.png> <output.json>')
  process.exit(1)
}

const pngsDir = resolve(pngsDirArg)
const outputImage = resolve(outputImageArg)
const outputJson = resolve(outputJsonArg)

// ---------------------------------------------------------------------------
// Read all PNGs and get their dimensions
// ---------------------------------------------------------------------------

const files = readdirSync(pngsDir)
  .filter(f => f.endsWith('.png'))
  .sort()

console.log(`Found ${files.length} PNGs`)

const sprites = []
for (const file of files) {
  const filePath = join(pngsDir, file)
  const name = basename(file, extname(file))
  const meta = await sharp(filePath).metadata()
  const w = meta.width ?? 0
  const h = meta.height ?? 0

  // Skip full-scene backgrounds (e.g., "map complete" at 3840x2160)
  if (w > 2048 || h > 2048) {
    console.log(`  Skipping oversized: ${name} (${w}x${h})`)
    continue
  }

  sprites.push({ name, filePath, w, h })
}

console.log(`Packing ${sprites.length} sprites`)

// ---------------------------------------------------------------------------
// Simple shelf packer — sort by height descending, pack left-to-right in rows
// ---------------------------------------------------------------------------

sprites.sort((a, b) => b.h - a.h || b.w - a.w)

const PAD = 1 // 1px padding between sprites
const MAX_WIDTH = 4096

let cursorX = 0
let cursorY = 0
let rowHeight = 0
let atlasW = 0
let atlasH = 0

for (const spr of sprites) {
  if (cursorX + spr.w + PAD > MAX_WIDTH) {
    // New row
    cursorY += rowHeight + PAD
    cursorX = 0
    rowHeight = 0
  }

  spr.x = cursorX
  spr.y = cursorY
  cursorX += spr.w + PAD
  rowHeight = Math.max(rowHeight, spr.h)
  atlasW = Math.max(atlasW, cursorX)
  atlasH = Math.max(atlasH, cursorY + spr.h)
}

// Round up to power of 2 for GPU efficiency
function nextPow2(n) {
  let p = 1
  while (p < n) p *= 2
  return p
}

const finalW = Math.min(nextPow2(atlasW), MAX_WIDTH)
const finalH = nextPow2(atlasH)

console.log(`Atlas size: ${finalW}x${finalH}`)

// ---------------------------------------------------------------------------
// Composite all sprites into the atlas
// ---------------------------------------------------------------------------

const composites = sprites.map(spr => ({
  input: spr.filePath,
  left: spr.x,
  top: spr.y,
}))

await sharp({
  create: {
    width: finalW,
    height: finalH,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
})
  .composite(composites)
  .png()
  .toFile(outputImage)

console.log(`Wrote atlas image: ${outputImage}`)

// ---------------------------------------------------------------------------
// Generate Phaser 3 JSONHash atlas metadata
// ---------------------------------------------------------------------------

const frames = {}
for (const spr of sprites) {
  frames[spr.name] = {
    frame: { x: spr.x, y: spr.y, w: spr.w, h: spr.h },
    rotated: false,
    trimmed: false,
    spriteSourceSize: { x: 0, y: 0, w: spr.w, h: spr.h },
    sourceSize: { w: spr.w, h: spr.h },
  }
}

const atlas = {
  frames,
  meta: {
    image: basename(outputImage),
    size: { w: finalW, h: finalH },
    scale: 1,
  },
}

writeFileSync(outputJson, JSON.stringify(atlas, null, 2), 'utf8')
console.log(`Wrote atlas JSON: ${outputJson} (${Object.keys(frames).length} frames)`)
