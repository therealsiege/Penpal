#!/usr/bin/env node

/**
 * convert-gds-atlas.mjs
 *
 * Converts a GDS JSON layout file to a Phaser 3 JSONHash texture atlas.
 *
 * Usage:
 *   node scripts/convert-gds-atlas.mjs <input.json> <output.json> <imageName.png>
 *
 * GDS input format:
 *   { "components": [{ "name": string, "x": number, "y": number, "width": number, "height": number }, ...] }
 *
 * Output: Phaser 3 JSONHash atlas format.
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const [,, inputArg, outputArg, imageArg] = process.argv;

if (!inputArg || !outputArg || !imageArg) {
  console.error(
    'Usage: node scripts/convert-gds-atlas.mjs <input.json> <output.json> <imageName.png>'
  );
  process.exit(1);
}

const inputPath  = resolve(inputArg);
const outputPath = resolve(outputArg);
const imageName  = imageArg;

// ---------------------------------------------------------------------------
// Load GDS JSON
// ---------------------------------------------------------------------------

/** @type {{ components: Array<{ name: string, x: number, y: number, width: number, height: number }> }} */
let gds;
try {
  gds = JSON.parse(readFileSync(inputPath, 'utf8'));
} catch (err) {
  console.error(`Failed to read/parse input file: ${err.message}`);
  process.exit(1);
}

if (!Array.isArray(gds.components)) {
  console.error('Input JSON must have a top-level "components" array.');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Determine atlas image dimensions (bounding box of all components)
// ---------------------------------------------------------------------------

let maxX = 0;
let maxY = 0;

for (const c of gds.components) {
  const right  = Math.round(c.x) + Math.round(c.width);
  const bottom = Math.round(c.y) + Math.round(c.height);
  if (right  > maxX) maxX = right;
  if (bottom > maxY) maxY = bottom;
}

const atlasW = maxX;
const atlasH = maxY;

// ---------------------------------------------------------------------------
// Build frames — dedup names and skip full-image layer backgrounds
// ---------------------------------------------------------------------------

/** @type {Record<string, { frame: { x:number, y:number, w:number, h:number }, rotated: boolean, trimmed: boolean, spriteSourceSize: { x:number, y:number, w:number, h:number }, sourceSize: { w:number, h:number } }>} */
const frames = {};

/** Tracks how many times a base name has been seen. */
const nameCounts = /** @type {Record<string, number>} */ ({});

let totalInput   = gds.components.length;
let skippedLayer = 0;
let skippedEmpty = 0;
let converted    = 0;
let deduped      = 0;

for (const component of gds.components) {
  const x = Math.round(component.x);
  const y = Math.round(component.y);
  const w = Math.round(component.width);
  const h = Math.round(component.height);

  // Skip components with no area
  if (w <= 0 || h <= 0) {
    skippedEmpty++;
    continue;
  }

  // Skip full-image layer backgrounds (covers the entire atlas in either dimension)
  if (w >= atlasW || h >= atlasH) {
    skippedLayer++;
    continue;
  }

  const baseName = (component.name ?? 'frame').trim();

  // Deduplicate: first occurrence keeps the bare name; subsequent ones get _02, _03, …
  if (!(baseName in nameCounts)) {
    nameCounts[baseName] = 1;
  } else {
    nameCounts[baseName]++;
    deduped++;
  }

  const count = nameCounts[baseName];
  const frameName = count === 1 ? baseName : `${baseName}_${String(count).padStart(2, '0')}`;

  frames[frameName] = {
    frame:            { x, y, w, h },
    rotated:          false,
    trimmed:          false,
    spriteSourceSize: { x: 0, y: 0, w, h },
    sourceSize:       { w, h },
  };

  converted++;
}

// ---------------------------------------------------------------------------
// Compose Phaser 3 JSONHash output
// ---------------------------------------------------------------------------

const atlas = {
  frames,
  meta: {
    image:  imageName,
    size:   { w: atlasW, h: atlasH },
    scale:  1,
  },
};

// ---------------------------------------------------------------------------
// Write output
// ---------------------------------------------------------------------------

try {
  writeFileSync(outputPath, JSON.stringify(atlas, null, 2), 'utf8');
} catch (err) {
  console.error(`Failed to write output file: ${err.message}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(`GDS Atlas Converter`);
console.log(`-------------------`);
console.log(`Input:           ${inputPath}`);
console.log(`Output:          ${outputPath}`);
console.log(`Image:           ${imageName}`);
console.log(`Atlas size:      ${atlasW} x ${atlasH}`);
console.log(`Total input:     ${totalInput}`);
console.log(`Skipped (layer): ${skippedLayer}`);
console.log(`Skipped (empty): ${skippedEmpty}`);
console.log(`Deduplicated:    ${deduped}`);
console.log(`Frames written:  ${converted}`);
