#!/usr/bin/env node
/**
 * Build lab-furniture.png — procedurally generated lab desk furniture sprites.
 *
 * lab-furniture.png — 64x64 cells, single row, 16 frames:
 *   Frame 0:  Stool (lab chair replacement)
 *   Frame 1:  Console screen (lab monitor)
 *   Frame 2:  Desk lamp
 *   Frame 3:  Keyboard
 *   Frame 4:  Desk top long
 *   Frame 5:  Desk top short
 *   Frame 6:  Desk drawer
 *   Frame 7:  Free-standing screen
 *   Frame 8:  Microscope
 *   Frame 9:  Beaker
 *   Frame 10: Petri dish
 *   Frame 11: Tablet
 *   Frame 12: Clipboard
 *   Frame 13: Scale
 *   Frame 14: Console lines (animation frame)
 *   Frame 15: Console wave (animation frame)
 *
 * @module build-lab-furniture
 */

import sharp from 'sharp'
import { mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const OUT_DIR = resolve(ROOT, 'public/sprites')

const CELL = 64

// Lab color palette
const C = {
  metalDark:   [40, 52, 68],      // #283444
  metalMid:    [71, 85, 105],     // #475569
  metalLight:  [100, 116, 139],   // #64748b
  metalHighlight: [148, 163, 184],// #94a3b8
  screenDark:  [15, 23, 42],      // #0f172a
  screenGlow:  [34, 211, 238],    // #22d3ee (cyan)
  screenGreen: [52, 211, 153],    // #34d399
  accent:      [14, 165, 233],    // #0ea5e9 (blue)
  wood:        [120, 90, 60],     // warm brown for clipboard
  paper:       [220, 215, 205],   // off-white paper
  glass:       [180, 220, 240],   // glass tint
  liquidGreen: [100, 200, 120],   // beaker liquid
  liquidAmber: [200, 170, 60],    // petri culture
  cushion:     [51, 65, 85],      // stool cushion
  legs:        [80, 80, 80],      // stool/stand legs
  deskBody:    [26, 58, 82],      // #1a3a52
  lampShade:   [59, 130, 246],    // #3b82f6
}

function createBuffer() {
  return Buffer.alloc(CELL * CELL * 4, 0)
}

function setPixel(buf, x, y, r, g, b, a = 255) {
  if (x < 0 || x >= CELL || y < 0 || y >= CELL) return
  const idx = (y * CELL + x) * 4
  const srcA = a / 255
  const dstA = buf[idx + 3] / 255
  const outA = srcA + dstA * (1 - srcA)
  if (outA > 0) {
    buf[idx + 0] = Math.round((r * srcA + buf[idx + 0] * dstA * (1 - srcA)) / outA)
    buf[idx + 1] = Math.round((g * srcA + buf[idx + 1] * dstA * (1 - srcA)) / outA)
    buf[idx + 2] = Math.round((b * srcA + buf[idx + 2] * dstA * (1 - srcA)) / outA)
    buf[idx + 3] = Math.round(outA * 255)
  }
}

function fillRect(buf, x0, y0, w, h, [r, g, b], a = 255) {
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      setPixel(buf, x0 + dx, y0 + dy, r, g, b, a)
    }
  }
}

function fillEllipse(buf, cx, cy, rx, ry, [r, g, b], a = 255) {
  for (let y = cy - ry; y <= cy + ry; y++) {
    for (let x = cx - rx; x <= cx + rx; x++) {
      if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) {
        setPixel(buf, Math.round(x), Math.round(y), r, g, b, a)
      }
    }
  }
}

function fillCircle(buf, cx, cy, radius, [r, g, b], a = 255) {
  fillEllipse(buf, cx, cy, radius, radius, [r, g, b], a)
}

function drawLine(buf, x0, y0, x1, y1, [r, g, b], a = 255) {
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0)
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1
  let err = dx - dy, cx = x0, cy = y0
  while (true) {
    setPixel(buf, cx, cy, r, g, b, a)
    if (cx === x1 && cy === y1) break
    const e2 = 2 * err
    if (e2 > -dy) { err -= dy; cx += sx }
    if (e2 < dx) { err += dx; cy += sy }
  }
}

// Frame 0: Stool
function makeStool() {
  const buf = createBuffer()
  // Seat cushion — flat ellipse
  fillEllipse(buf, 32, 28, 14, 6, C.cushion)
  fillEllipse(buf, 32, 26, 14, 5, C.metalMid) // highlight ring
  fillEllipse(buf, 32, 27, 12, 4, C.cushion)
  // Center post
  fillRect(buf, 30, 34, 4, 14, C.legs)
  fillRect(buf, 31, 34, 2, 14, C.metalMid, 120)
  // Base legs (X-shape)
  drawLine(buf, 20, 54, 44, 54, C.legs)
  drawLine(buf, 32, 48, 20, 54, C.legs)
  drawLine(buf, 32, 48, 44, 54, C.legs)
  // Footrest ring
  fillEllipse(buf, 32, 42, 8, 2, C.metalMid, 160)
  return buf
}

// Frame 1: Console screen
function makeConsoleScreen() {
  const buf = createBuffer()
  // Monitor housing
  fillRect(buf, 14, 10, 36, 28, C.metalDark)
  fillRect(buf, 15, 11, 34, 26, C.metalMid, 80)
  // Screen area
  fillRect(buf, 17, 13, 30, 22, C.screenDark)
  // Scan lines
  for (let y = 14; y < 34; y += 2) {
    fillRect(buf, 18, y, 28, 1, C.screenGlow, 25)
  }
  // Stand
  fillRect(buf, 28, 38, 8, 4, C.metalDark)
  fillRect(buf, 22, 42, 20, 3, C.metalDark)
  // Accent dot
  fillCircle(buf, 32, 37, 1, C.screenGlow, 180)
  return buf
}

// Frame 2: Desk lamp
function makeDeskLamp() {
  const buf = createBuffer()
  // Base
  fillEllipse(buf, 32, 52, 10, 4, C.metalDark)
  fillEllipse(buf, 32, 51, 8, 3, C.metalMid, 140)
  // Arm
  drawLine(buf, 32, 48, 28, 24, C.metalMid)
  drawLine(buf, 33, 48, 29, 24, C.metalMid)
  // Shade
  fillRect(buf, 18, 18, 22, 8, C.lampShade, 200)
  fillRect(buf, 20, 26, 18, 2, C.lampShade, 100) // light cone hint
  // Bulb glow
  fillCircle(buf, 29, 24, 3, [255, 255, 200], 60)
  return buf
}

// Frame 3: Keyboard
function makeKeyboard() {
  const buf = createBuffer()
  // Keyboard body
  fillRect(buf, 10, 24, 44, 16, C.metalDark)
  fillRect(buf, 11, 25, 42, 14, C.metalMid, 100)
  // Key rows
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 10; col++) {
      const kx = 13 + col * 4
      const ky = 26 + row * 3
      fillRect(buf, kx, ky, 3, 2, C.metalLight, 140)
    }
  }
  // Spacebar
  fillRect(buf, 20, 35, 20, 2, C.metalLight, 140)
  return buf
}

// Frame 4: Desk top long
function makeDeskTopLong() {
  const buf = createBuffer()
  fillRect(buf, 4, 24, 56, 16, C.deskBody)
  fillRect(buf, 5, 25, 54, 2, C.screenGlow, 40) // edge highlight
  fillRect(buf, 4, 24, 56, 1, C.screenGlow, 60) // top edge
  return buf
}

// Frame 5: Desk top short
function makeDeskTopShort() {
  const buf = createBuffer()
  fillRect(buf, 12, 24, 40, 16, C.deskBody)
  fillRect(buf, 13, 25, 38, 2, C.screenGlow, 40)
  fillRect(buf, 12, 24, 40, 1, C.screenGlow, 60)
  return buf
}

// Frame 6: Desk drawer
function makeDeskDrawer() {
  const buf = createBuffer()
  // Drawer body
  fillRect(buf, 14, 20, 36, 24, C.deskBody)
  fillRect(buf, 15, 21, 34, 22, C.metalDark, 100)
  // Drawer face (pulled out slightly)
  fillRect(buf, 16, 22, 32, 10, C.metalMid)
  fillRect(buf, 16, 22, 32, 1, C.metalLight, 120)
  // Handle
  fillRect(buf, 26, 26, 12, 2, C.metalHighlight)
  // Second drawer
  fillRect(buf, 16, 34, 32, 8, C.metalMid, 200)
  fillRect(buf, 26, 37, 12, 2, C.metalHighlight, 180)
  return buf
}

// Frame 7: Free-standing screen
function makeFreeStandingScreen() {
  const buf = createBuffer()
  // Tall thin monitor
  fillRect(buf, 18, 6, 28, 36, C.metalDark)
  fillRect(buf, 20, 8, 24, 32, C.screenDark)
  // Scan lines
  for (let y = 9; y < 39; y += 2) {
    fillRect(buf, 21, y, 22, 1, C.screenGlow, 20)
  }
  // Stand pole
  fillRect(buf, 30, 42, 4, 10, C.legs)
  // Base plate
  fillRect(buf, 20, 52, 24, 3, C.metalDark)
  return buf
}

// Frame 8: Microscope
function makeMicroscope() {
  const buf = createBuffer()
  // Base plate
  fillRect(buf, 18, 48, 28, 6, C.metalDark)
  fillRect(buf, 19, 48, 26, 1, C.metalHighlight, 80)
  // Stage
  fillRect(buf, 22, 38, 20, 4, C.metalMid)
  // Arm (vertical post)
  fillRect(buf, 36, 14, 4, 34, C.metalMid)
  fillRect(buf, 37, 14, 2, 34, C.metalLight, 60)
  // Eyepiece tube
  fillRect(buf, 24, 8, 14, 6, C.metalDark)
  fillRect(buf, 22, 6, 8, 6, C.metalMid) // eyepiece
  // Objective lens
  fillCircle(buf, 32, 36, 3, C.glass, 160)
  fillCircle(buf, 32, 36, 1, [255, 255, 255], 80)
  // Focus knob
  fillCircle(buf, 42, 30, 3, C.metalLight, 180)
  return buf
}

// Frame 9: Beaker
function makeBeaker() {
  const buf = createBuffer()
  // Beaker body (trapezoid)
  for (let y = 16; y < 50; y++) {
    const t = (y - 16) / 34
    const halfW = 8 + t * 6
    const cx = 32
    fillRect(buf, Math.round(cx - halfW), y, Math.round(halfW * 2), 1, C.glass, 100)
  }
  // Liquid fill
  for (let y = 28; y < 49; y++) {
    const t = (y - 16) / 34
    const halfW = 7 + t * 5
    fillRect(buf, Math.round(32 - halfW), y, Math.round(halfW * 2), 1, C.liquidGreen, 140)
  }
  // Rim
  fillRect(buf, 24, 15, 16, 2, C.glass, 180)
  // Graduation marks
  for (let m = 30; m < 48; m += 4) {
    fillRect(buf, 38, m, 3, 1, [255, 255, 255], 60)
  }
  // Base
  fillRect(buf, 20, 50, 24, 2, C.glass, 120)
  return buf
}

// Frame 10: Petri dish
function makePetriDish() {
  const buf = createBuffer()
  // Dish body (ellipse from above)
  fillEllipse(buf, 32, 34, 18, 10, C.glass, 80)
  fillEllipse(buf, 32, 34, 16, 8, [220, 215, 205], 60) // inner plate
  // Culture spots
  fillCircle(buf, 28, 32, 3, C.liquidAmber, 120)
  fillCircle(buf, 36, 30, 2, C.liquidAmber, 100)
  fillCircle(buf, 32, 36, 4, C.liquidAmber, 80)
  fillCircle(buf, 26, 36, 2, C.liquidAmber, 90)
  // Rim highlight
  fillEllipse(buf, 32, 34, 18, 10, C.metalHighlight, 40)
  fillEllipse(buf, 32, 34, 17, 9, [0, 0, 0], 0) // cut inner (transparent)
  // Lid edge
  fillEllipse(buf, 32, 28, 19, 4, C.glass, 60)
  return buf
}

// Frame 11: Tablet
function makeTablet() {
  const buf = createBuffer()
  // Device body
  fillRect(buf, 16, 12, 32, 40, C.metalDark)
  fillRect(buf, 17, 13, 30, 38, C.metalMid, 60)
  // Screen
  fillRect(buf, 19, 15, 26, 32, C.screenDark)
  // Content lines
  for (let y = 18; y < 44; y += 3) {
    const w = 10 + Math.floor((y * 7) % 12)
    fillRect(buf, 21, y, w, 1, C.screenGlow, 35)
  }
  // Home button
  fillCircle(buf, 32, 49, 2, C.metalMid, 140)
  // Camera dot
  setPixel(buf, 32, 13, ...C.metalLight, 160)
  return buf
}

// Frame 12: Clipboard
function makeClipboard() {
  const buf = createBuffer()
  // Board
  fillRect(buf, 18, 10, 28, 44, C.wood, 200)
  fillRect(buf, 19, 11, 26, 42, C.wood, 160)
  // Paper
  fillRect(buf, 20, 16, 24, 34, C.paper)
  // Clip at top
  fillRect(buf, 26, 8, 12, 6, C.metalMid)
  fillRect(buf, 28, 6, 8, 4, C.metalHighlight, 200)
  // Text lines on paper
  for (let y = 20; y < 46; y += 3) {
    const w = 8 + (y * 3) % 14
    fillRect(buf, 22, y, w, 1, C.metalMid, 60)
  }
  // Checkbox squares
  for (let y = 20; y < 44; y += 6) {
    fillRect(buf, 22, y, 2, 2, C.metalMid, 100)
  }
  return buf
}

// Frame 13: Scale / balance
function makeScale() {
  const buf = createBuffer()
  // Base
  fillRect(buf, 16, 48, 32, 4, C.metalDark)
  fillRect(buf, 17, 48, 30, 1, C.metalHighlight, 60)
  // Central post
  fillRect(buf, 30, 20, 4, 28, C.metalMid)
  // Display panel
  fillRect(buf, 22, 18, 20, 8, C.screenDark)
  fillRect(buf, 24, 20, 16, 4, C.screenGlow, 50)
  // Weighing platform
  fillRect(buf, 12, 42, 40, 3, C.metalMid)
  fillRect(buf, 13, 42, 38, 1, C.metalHighlight, 80)
  // Platform supports
  fillRect(buf, 14, 44, 2, 4, C.legs)
  fillRect(buf, 48, 44, 2, 4, C.legs)
  return buf
}

// Frame 14: Console lines (animation frame — scrolling text)
function makeConsoleLines() {
  const buf = createBuffer()
  fillRect(buf, 14, 10, 36, 28, C.metalDark)
  fillRect(buf, 17, 13, 30, 22, C.screenDark)
  // Scrolling code lines
  const lineColors = [C.screenGlow, C.screenGreen, C.screenGlow, C.screenGreen]
  for (let i = 0; i < 8; i++) {
    const y = 15 + i * 2.5
    const w = 8 + (i * 7) % 18
    const color = lineColors[i % lineColors.length]
    fillRect(buf, 19, Math.round(y), w, 1, color, 120)
  }
  // Stand
  fillRect(buf, 28, 38, 8, 4, C.metalDark)
  fillRect(buf, 22, 42, 20, 3, C.metalDark)
  return buf
}

// Frame 15: Console wave (animation frame — waveform display)
function makeConsoleWave() {
  const buf = createBuffer()
  fillRect(buf, 14, 10, 36, 28, C.metalDark)
  fillRect(buf, 17, 13, 30, 22, C.screenDark)
  // Waveform
  const cy = 24
  for (let x = 18; x < 46; x++) {
    const t = (x - 18) / 28
    const y = Math.round(cy + Math.sin(t * Math.PI * 4) * 6)
    setPixel(buf, x, y, ...C.screenGlow, 200)
    setPixel(buf, x, y + 1, ...C.screenGlow, 100)
    setPixel(buf, x, y - 1, ...C.screenGlow, 100)
  }
  // Grid lines
  for (let gy = 16; gy < 34; gy += 4) {
    for (let gx = 18; gx < 46; gx += 4) {
      setPixel(buf, gx, gy, ...C.screenGlow, 20)
    }
  }
  // Stand
  fillRect(buf, 28, 38, 8, 4, C.metalDark)
  fillRect(buf, 22, 42, 20, 3, C.metalDark)
  return buf
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

async function bufferToSharp(buf) {
  return sharp(buf, { raw: { width: CELL, height: CELL, channels: 4 } }).png().toBuffer()
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })

  const frames = [
    makeStool(),             // 0
    makeConsoleScreen(),     // 1
    makeDeskLamp(),          // 2
    makeKeyboard(),          // 3
    makeDeskTopLong(),       // 4
    makeDeskTopShort(),      // 5
    makeDeskDrawer(),        // 6
    makeFreeStandingScreen(),// 7
    makeMicroscope(),        // 8
    makeBeaker(),            // 9
    makePetriDish(),         // 10
    makeTablet(),            // 11
    makeClipboard(),         // 12
    makeScale(),             // 13
    makeConsoleLines(),      // 14
    makeConsoleWave(),       // 15
  ]

  console.log('Building lab-furniture.png...')

  const composites = []
  const NAMES = [
    'Stool', 'Console Screen', 'Desk Lamp', 'Keyboard',
    'Desk Top Long', 'Desk Top Short', 'Desk Drawer', 'Free-Standing Screen',
    'Microscope', 'Beaker', 'Petri Dish', 'Tablet',
    'Clipboard', 'Scale', 'Console Lines', 'Console Wave',
  ]

  for (let i = 0; i < frames.length; i++) {
    const pngBuf = await bufferToSharp(frames[i])
    composites.push({ input: pngBuf, left: i * CELL, top: 0 })
    console.log(`  [${i}] ${NAMES[i]}`)
  }

  const totalWidth = frames.length * CELL
  const outPath = resolve(OUT_DIR, 'lab-furniture.png')

  await sharp({
    create: { width: totalWidth, height: CELL, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite(composites)
    .png({ compressionLevel: 9 })
    .toFile(outPath)

  console.log(`  -> lab-furniture.png  (${totalWidth}x${CELL}, ${frames.length} frames)`)
  console.log('\nDone.')
}

main().catch((err) => {
  console.error('build-lab-furniture failed:', err)
  process.exit(1)
})
