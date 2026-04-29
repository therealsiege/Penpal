#!/usr/bin/env node
/**
 * build-all-sprites.mjs
 * Master sprite build script — runs all individual build-*.mjs scripts in sequence.
 * Each step is independent; failures are logged but don't block subsequent steps.
 *
 * Usage:
 *   node scripts/build-all-sprites.mjs
 *   npm run sprites:all
 */

import { execFileSync } from 'child_process'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const SCRIPTS = [
  'build-sprites.mjs',
  'build-game-icons.mjs',
  'build-game-items.mjs',
  'build-desk-pets.mjs',
  'build-pet-faces.mjs',
  'build-lego-bar.mjs',
  'build-lego-specials.mjs',
  'build-icons-hd.mjs',
  'build-ui-panels.mjs',
  // Wave 7 — asset upgrade scripts
  'build-animal-pets.mjs',
  'build-office-furniture.mjs',
  'build-kenney-ui.mjs',
  'build-monster-parts.mjs',
  'build-medals-hd.mjs',
  'build-lab-props.mjs',
]

let passed = 0
let failed = 0

for (const script of SCRIPTS) {
  const scriptPath = resolve(__dirname, script)
  console.log(`\n--- Running ${script} ---`)
  try {
    execFileSync('node', [scriptPath], { stdio: 'inherit' })
    passed++
  } catch (err) {
    console.error(`  FAILED: ${script}`, err.message ?? '')
    failed++
  }
}

console.log(`\n=== Sprite build complete: ${passed} passed, ${failed} failed ===`)
if (failed > 0) process.exit(1)
