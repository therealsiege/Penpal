#!/usr/bin/env node

/**
 * convert-gds-scene.mjs
 *
 * Converts a GDS scene JSON export into a normalized layout file for
 * the Phaser GDS scene renderer.
 *
 * The output preserves all per-component transform data (position, z-order,
 * rotation, flip, opacity) and applies the same name-deduplication logic as
 * convert-gds-atlas.mjs so frame names match the generated Phaser atlas.
 *
 * Usage:
 *   node scripts/convert-gds-scene.mjs <input-scene.json> <output-layout.json>
 */

import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'

const [,, inputArg, outputArg] = process.argv

if (!inputArg || !outputArg) {
  console.error('Usage: node scripts/convert-gds-scene.mjs <input-scene.json> <output-layout.json>')
  process.exit(1)
}

const inputPath = resolve(inputArg)
const outputPath = resolve(outputArg)

let gds
try {
  gds = JSON.parse(readFileSync(inputPath, 'utf8'))
} catch (err) {
  console.error(`Failed to read/parse input: ${err.message}`)
  process.exit(1)
}

if (!Array.isArray(gds.components)) {
  console.error('Input JSON must have a top-level "components" array.')
  process.exit(1)
}

const sceneW = gds.width ?? 0
const sceneH = gds.height ?? 0

// Determine atlas bounding box (same logic as convert-gds-atlas.mjs)
let maxX = 0
let maxY = 0
for (const c of gds.components) {
  const right = Math.round(c.x) + Math.round(c.width)
  const bottom = Math.round(c.y) + Math.round(c.height)
  if (right > maxX) maxX = right
  if (bottom > maxY) maxY = bottom
}
const atlasW = maxX
const atlasH = maxY

// Apply same dedup + skip logic as convert-gds-atlas.mjs
const nameCounts = {}
const components = []
let skippedLayer = 0
let skippedEmpty = 0

for (const c of gds.components) {
  const w = Math.round(c.width)
  const h = Math.round(c.height)

  if (w <= 0 || h <= 0) { skippedEmpty++; continue }
  if (w >= atlasW || h >= atlasH) { skippedLayer++; continue }

  const baseName = (c.name ?? 'frame').trim()
  if (!(baseName in nameCounts)) {
    nameCounts[baseName] = 1
  } else {
    nameCounts[baseName]++
  }
  const count = nameCounts[baseName]
  // GDS names duplicates starting at _01 (not _02)
  const frameName = count === 1 ? baseName : `${baseName}_${String(count - 1).padStart(2, '0')}`

  components.push({
    frame: frameName,
    x: c.x,
    y: c.y,
    width: c.width,
    height: c.height,
    zOrder: c.zOrder ?? 0,
    rotationRadians: c.rotationRadians ?? 0,
    flipX: c.flipX ?? false,
    flipY: c.flipY ?? false,
    opacity: c.opacity ?? 1,
  })
}

// Sort by zOrder ascending for correct render order
components.sort((a, b) => a.zOrder - b.zOrder)

const output = {
  width: sceneW,
  height: sceneH,
  componentCount: components.length,
  components,
}

try {
  writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf8')
} catch (err) {
  console.error(`Failed to write output: ${err.message}`)
  process.exit(1)
}

console.log('GDS Scene Converter')
console.log('-------------------')
console.log(`Input:           ${inputPath}`)
console.log(`Output:          ${outputPath}`)
console.log(`Scene size:      ${sceneW} x ${sceneH}`)
console.log(`Total input:     ${gds.components.length}`)
console.log(`Skipped (layer): ${skippedLayer}`)
console.log(`Skipped (empty): ${skippedEmpty}`)
console.log(`Components:      ${components.length}`)
