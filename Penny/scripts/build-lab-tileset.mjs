#!/usr/bin/env node
/**
 * Build lab tileset spritesheets — procedurally generated hex floor tiles,
 * wall edge tiles, smooth corner transitions, and lab props.
 *
 * lab-tileset.png  — 48x48 cells, 16 frames (single row):
 *   Frame 0-3:   Wall edges (top, right, bottom, left)
 *   Frame 4-7:   Wall corners (TL, TR, BL, BR)
 *   Frame 8-11:  Wall inner edges (top, right, bottom, left)
 *   Frame 12:    Hex floor tile variant A
 *   Frame 13:    Hex floor tile variant B
 *   Frame 14:    Plain dark floor
 *   Frame 15:    Grated floor
 *
 * lab-smooth.png  — 48x48 cells, 8 frames (single row):
 *   Frame 0-3:   Outer rounded corners (TL, TR, BL, BR)
 *   Frame 4-7:   Inner rounded corners (TL, TR, BL, BR)
 *
 * lab-props.png   — 48x48 cells, 8 frames (single row):
 *   Frame 0: Vent grate
 *   Frame 1: Pipe section
 *   Frame 2: Floor panel
 *   Frame 3: Hazard stripe
 *   Frame 4: Console panel
 *   Frame 5: Cable conduit
 *   Frame 6: Warning light
 *   Frame 7: Drainage grate
 *
 * @module build-lab-tileset
 */

import sharp from 'sharp'
import { mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const OUT_DIR = resolve(ROOT, 'public/sprites')

const CELL = 48

// Color palette — dark blue lab aesthetic
const C = {
  wallOuter:   [30, 41, 59],     // #1e293b — slate-800
  wallInner:   [51, 65, 85],     // #334155 — slate-700
  wallHighlight: [71, 85, 105],  // #475569 — slate-600
  floorBase:   [15, 23, 42],     // #0f172a — slate-900
  floorHex:    [30, 41, 59],     // #1e293b — hex edge color
  floorHexAlt: [24, 35, 52],     // #182334 — hex edge alt
  floorGrid:   [51, 65, 85],     // #334155 — grid line
  accent:      [0, 255, 136],    // #00ff88 — mako green
  accentDim:   [0, 100, 60],     // dim mako green for subtle elements
  grate:       [40, 52, 68],     // #283444 — grate metal
  hazardYellow:[212, 160, 23],   // #d4a017 — hazard yellow
  dark:        [8, 10, 14],      // #080a0e — deep dark
}

/**
 * Create a raw RGBA pixel buffer (48x48)
 */
function createBuffer() {
  return Buffer.alloc(CELL * CELL * 4, 0)
}

/**
 * Set pixel at (x, y) in an RGBA buffer
 */
function setPixel(buf, x, y, r, g, b, a = 255) {
  if (x < 0 || x >= CELL || y < 0 || y >= CELL) return
  const idx = (y * CELL + x) * 4
  // Alpha blend
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

/**
 * Fill entire buffer with a color
 */
function fillBuffer(buf, [r, g, b], a = 255) {
  for (let y = 0; y < CELL; y++) {
    for (let x = 0; x < CELL; x++) {
      setPixel(buf, x, y, r, g, b, a)
    }
  }
}

/**
 * Draw a filled rectangle
 */
function fillRect(buf, x0, y0, w, h, [r, g, b], a = 255) {
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      setPixel(buf, x0 + dx, y0 + dy, r, g, b, a)
    }
  }
}

/**
 * Draw a line (Bresenham)
 */
function drawLine(buf, x0, y0, x1, y1, [r, g, b], a = 255) {
  const dx = Math.abs(x1 - x0)
  const dy = Math.abs(y1 - y0)
  const sx = x0 < x1 ? 1 : -1
  const sy = y0 < y1 ? 1 : -1
  let err = dx - dy
  let cx = x0, cy = y0
  while (true) {
    setPixel(buf, cx, cy, r, g, b, a)
    if (cx === x1 && cy === y1) break
    const e2 = 2 * err
    if (e2 > -dy) { err -= dy; cx += sx }
    if (e2 < dx) { err += dx; cy += sy }
  }
}

/**
 * Draw a hexagon centered at (cx, cy) with given radius
 */
function drawHexagon(buf, cx, cy, radius, color, a = 255) {
  const points = []
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6 // flat-top hex
    points.push({
      x: Math.round(cx + radius * Math.cos(angle)),
      y: Math.round(cy + radius * Math.sin(angle)),
    })
  }
  for (let i = 0; i < 6; i++) {
    const p0 = points[i]
    const p1 = points[(i + 1) % 6]
    drawLine(buf, p0.x, p0.y, p1.x, p1.y, color, a)
  }
}

// ---------------------------------------------------------------------------
// Tile generators
// ---------------------------------------------------------------------------

/** Wall edge tile — top edge */
function makeWallTop() {
  const buf = createBuffer()
  fillBuffer(buf, C.floorBase)
  // Wall band along top
  fillRect(buf, 0, 0, CELL, 6, C.wallOuter)
  fillRect(buf, 0, 6, CELL, 2, C.wallInner)
  // Highlight line
  fillRect(buf, 0, 8, CELL, 1, C.wallHighlight, 80)
  // Bolt details
  for (let bx = 6; bx < CELL; bx += 12) {
    setPixel(buf, bx, 3, ...C.wallHighlight, 150)
    setPixel(buf, bx + 1, 3, ...C.wallHighlight, 100)
  }
  return buf
}

/** Wall edge tile — right edge */
function makeWallRight() {
  const buf = createBuffer()
  fillBuffer(buf, C.floorBase)
  fillRect(buf, CELL - 6, 0, 6, CELL, C.wallOuter)
  fillRect(buf, CELL - 8, 0, 2, CELL, C.wallInner)
  fillRect(buf, CELL - 9, 0, 1, CELL, C.wallHighlight, 80)
  for (let by = 6; by < CELL; by += 12) {
    setPixel(buf, CELL - 4, by, ...C.wallHighlight, 150)
  }
  return buf
}

/** Wall edge tile — bottom edge */
function makeWallBottom() {
  const buf = createBuffer()
  fillBuffer(buf, C.floorBase)
  fillRect(buf, 0, CELL - 6, CELL, 6, C.wallOuter)
  fillRect(buf, 0, CELL - 8, CELL, 2, C.wallInner)
  fillRect(buf, 0, CELL - 9, CELL, 1, C.wallHighlight, 80)
  for (let bx = 6; bx < CELL; bx += 12) {
    setPixel(buf, bx, CELL - 4, ...C.wallHighlight, 150)
  }
  return buf
}

/** Wall edge tile — left edge */
function makeWallLeft() {
  const buf = createBuffer()
  fillBuffer(buf, C.floorBase)
  fillRect(buf, 0, 0, 6, CELL, C.wallOuter)
  fillRect(buf, 6, 0, 2, CELL, C.wallInner)
  fillRect(buf, 8, 0, 1, CELL, C.wallHighlight, 80)
  for (let by = 6; by < CELL; by += 12) {
    setPixel(buf, 3, by, ...C.wallHighlight, 150)
  }
  return buf
}

/** Wall corner — top-left */
function makeCornerTL() {
  const buf = createBuffer()
  fillBuffer(buf, C.floorBase)
  fillRect(buf, 0, 0, CELL, 6, C.wallOuter)
  fillRect(buf, 0, 0, 6, CELL, C.wallOuter)
  fillRect(buf, 6, 6, 2, CELL - 6, C.wallInner)
  fillRect(buf, 6, 6, CELL - 6, 2, C.wallInner)
  // Corner accent
  setPixel(buf, 7, 7, ...C.accent, 100)
  setPixel(buf, 8, 7, ...C.accent, 60)
  setPixel(buf, 7, 8, ...C.accent, 60)
  return buf
}

/** Wall corner — top-right */
function makeCornerTR() {
  const buf = createBuffer()
  fillBuffer(buf, C.floorBase)
  fillRect(buf, 0, 0, CELL, 6, C.wallOuter)
  fillRect(buf, CELL - 6, 0, 6, CELL, C.wallOuter)
  fillRect(buf, CELL - 8, 6, 2, CELL - 6, C.wallInner)
  fillRect(buf, 0, 6, CELL - 6, 2, C.wallInner)
  setPixel(buf, CELL - 8, 7, ...C.accent, 100)
  return buf
}

/** Wall corner — bottom-left */
function makeCornerBL() {
  const buf = createBuffer()
  fillBuffer(buf, C.floorBase)
  fillRect(buf, 0, CELL - 6, CELL, 6, C.wallOuter)
  fillRect(buf, 0, 0, 6, CELL, C.wallOuter)
  fillRect(buf, 6, 0, 2, CELL - 6, C.wallInner)
  fillRect(buf, 6, CELL - 8, CELL - 6, 2, C.wallInner)
  setPixel(buf, 7, CELL - 8, ...C.accent, 100)
  return buf
}

/** Wall corner — bottom-right */
function makeCornerBR() {
  const buf = createBuffer()
  fillBuffer(buf, C.floorBase)
  fillRect(buf, 0, CELL - 6, CELL, 6, C.wallOuter)
  fillRect(buf, CELL - 6, 0, 6, CELL, C.wallOuter)
  fillRect(buf, CELL - 8, 0, 2, CELL - 6, C.wallInner)
  fillRect(buf, 0, CELL - 8, CELL - 6, 2, C.wallInner)
  setPixel(buf, CELL - 8, CELL - 8, ...C.accent, 100)
  return buf
}

/** Wall inner edge — top */
function makeInnerTop() {
  const buf = createBuffer()
  fillBuffer(buf, C.floorBase)
  fillRect(buf, 0, 0, CELL, 3, C.wallInner)
  fillRect(buf, 0, 3, CELL, 1, C.wallHighlight, 60)
  return buf
}

/** Wall inner edge — right */
function makeInnerRight() {
  const buf = createBuffer()
  fillBuffer(buf, C.floorBase)
  fillRect(buf, CELL - 3, 0, 3, CELL, C.wallInner)
  fillRect(buf, CELL - 4, 0, 1, CELL, C.wallHighlight, 60)
  return buf
}

/** Wall inner edge — bottom */
function makeInnerBottom() {
  const buf = createBuffer()
  fillBuffer(buf, C.floorBase)
  fillRect(buf, 0, CELL - 3, CELL, 3, C.wallInner)
  fillRect(buf, 0, CELL - 4, CELL, 1, C.wallHighlight, 60)
  return buf
}

/** Wall inner edge — left */
function makeInnerLeft() {
  const buf = createBuffer()
  fillBuffer(buf, C.floorBase)
  fillRect(buf, 0, 0, 3, CELL, C.wallInner)
  fillRect(buf, 3, 0, 1, CELL, C.wallHighlight, 60)
  return buf
}

/** Hex floor tile variant A */
function makeHexFloorA() {
  const buf = createBuffer()
  fillBuffer(buf, C.floorBase)
  // Draw hex grid — flat-top hexagons
  const hexR = 8
  const hexW = hexR * 2
  const hexH = Math.round(hexR * Math.sqrt(3))
  for (let row = -1; row < 5; row++) {
    for (let col = -1; col < 5; col++) {
      const cx = col * Math.round(hexW * 0.75) + 4
      const cy = row * hexH + (col % 2 === 0 ? 0 : Math.round(hexH / 2)) + 4
      drawHexagon(buf, cx, cy, hexR, C.floorHex, 90)
      // Subtle center dot
      setPixel(buf, cx, cy, ...C.floorGrid, 40)
    }
  }
  // Steel plate joint lines
  for (let jy = 0; jy < CELL; jy += 24) {
    for (let jx = 0; jx < CELL; jx++) {
      setPixel(buf, jx, jy, ...C.floorGrid, 25)
    }
  }
  return buf
}

/** Hex floor tile variant B */
function makeHexFloorB() {
  const buf = createBuffer()
  fillBuffer(buf, C.floorBase)
  // Slightly offset hex grid for seamless tiling variety
  const hexR = 8
  const hexW = hexR * 2
  const hexH = Math.round(hexR * Math.sqrt(3))
  for (let row = -1; row < 5; row++) {
    for (let col = -1; col < 5; col++) {
      const cx = col * Math.round(hexW * 0.75) + 12
      const cy = row * hexH + (col % 2 === 0 ? Math.round(hexH / 2) : 0) + 8
      drawHexagon(buf, cx, cy, hexR, C.floorHexAlt, 80)
      setPixel(buf, cx, cy, ...C.floorGrid, 30)
    }
  }
  // Bolt circles at grid intersections
  for (let by = 12; by < CELL; by += 24) {
    for (let bx = 12; bx < CELL; bx += 24) {
      setPixel(buf, bx, by, ...C.wallHighlight, 50)
      setPixel(buf, bx + 1, by, ...C.wallHighlight, 30)
      setPixel(buf, bx, by + 1, ...C.wallHighlight, 30)
    }
  }
  return buf
}

/** Plain dark floor */
function makePlainFloor() {
  const buf = createBuffer()
  fillBuffer(buf, C.floorBase)
  // Subtle diamond-plate pattern
  for (let y = 0; y < CELL; y += 6) {
    for (let x = 0; x < CELL; x += 6) {
      const cx = x + 3, cy = y + 3
      setPixel(buf, cx, cy - 1, ...C.floorHex, 40)
      setPixel(buf, cx + 1, cy, ...C.floorHex, 40)
      setPixel(buf, cx, cy + 1, ...C.floorHex, 40)
      setPixel(buf, cx - 1, cy, ...C.floorHex, 40)
    }
  }
  return buf
}

/** Grated floor */
function makeGratedFloor() {
  const buf = createBuffer()
  fillBuffer(buf, C.dark)
  // Horizontal grate bars
  for (let y = 0; y < CELL; y += 4) {
    fillRect(buf, 0, y, CELL, 2, C.grate)
    // Highlight on top edge of each bar
    fillRect(buf, 0, y, CELL, 1, C.wallHighlight, 40)
  }
  // Cross bars
  for (let x = 0; x < CELL; x += 12) {
    fillRect(buf, x, 0, 2, CELL, C.grate, 180)
  }
  return buf
}

// ---------------------------------------------------------------------------
// Smooth corner generators (LAB_SMOOTH)
// ---------------------------------------------------------------------------

/** Smooth outer corner — top-left */
function makeSmoothOuterTL() {
  const buf = createBuffer()
  fillBuffer(buf, C.floorBase)
  // Rounded corner: fill the corner quadrant with wall color
  const r = 10
  for (let y = 0; y < CELL; y++) {
    for (let x = 0; x < CELL; x++) {
      if (x < r && y < r) {
        const dist = Math.sqrt((r - x) ** 2 + (r - y) ** 2)
        if (dist > r) {
          setPixel(buf, x, y, ...C.wallOuter)
        } else if (dist > r - 2) {
          setPixel(buf, x, y, ...C.wallInner, 180)
        }
      } else if (x < 2 || y < 2) {
        setPixel(buf, x, y, ...C.wallInner, 120)
      }
    }
  }
  return buf
}

/** Smooth outer corner — top-right */
function makeSmoothOuterTR() {
  const buf = createBuffer()
  fillBuffer(buf, C.floorBase)
  const r = 10
  for (let y = 0; y < CELL; y++) {
    for (let x = 0; x < CELL; x++) {
      if (x >= CELL - r && y < r) {
        const dist = Math.sqrt((x - (CELL - r - 1)) ** 2 + (r - y) ** 2)
        if (dist > r) {
          setPixel(buf, x, y, ...C.wallOuter)
        } else if (dist > r - 2) {
          setPixel(buf, x, y, ...C.wallInner, 180)
        }
      } else if (x >= CELL - 2 || y < 2) {
        setPixel(buf, x, y, ...C.wallInner, 120)
      }
    }
  }
  return buf
}

/** Smooth outer corner — bottom-left */
function makeSmoothOuterBL() {
  const buf = createBuffer()
  fillBuffer(buf, C.floorBase)
  const r = 10
  for (let y = 0; y < CELL; y++) {
    for (let x = 0; x < CELL; x++) {
      if (x < r && y >= CELL - r) {
        const dist = Math.sqrt((r - x) ** 2 + (y - (CELL - r - 1)) ** 2)
        if (dist > r) {
          setPixel(buf, x, y, ...C.wallOuter)
        } else if (dist > r - 2) {
          setPixel(buf, x, y, ...C.wallInner, 180)
        }
      } else if (x < 2 || y >= CELL - 2) {
        setPixel(buf, x, y, ...C.wallInner, 120)
      }
    }
  }
  return buf
}

/** Smooth outer corner — bottom-right */
function makeSmoothOuterBR() {
  const buf = createBuffer()
  fillBuffer(buf, C.floorBase)
  const r = 10
  for (let y = 0; y < CELL; y++) {
    for (let x = 0; x < CELL; x++) {
      if (x >= CELL - r && y >= CELL - r) {
        const dist = Math.sqrt((x - (CELL - r - 1)) ** 2 + (y - (CELL - r - 1)) ** 2)
        if (dist > r) {
          setPixel(buf, x, y, ...C.wallOuter)
        } else if (dist > r - 2) {
          setPixel(buf, x, y, ...C.wallInner, 180)
        }
      } else if (x >= CELL - 2 || y >= CELL - 2) {
        setPixel(buf, x, y, ...C.wallInner, 120)
      }
    }
  }
  return buf
}

/** Smooth inner corner — top-left */
function makeSmoothInnerTL() {
  const buf = createBuffer()
  fillBuffer(buf, C.wallOuter)
  const r = 10
  for (let y = 0; y < CELL; y++) {
    for (let x = 0; x < CELL; x++) {
      const dist = Math.sqrt(x ** 2 + y ** 2)
      if (dist < r) {
        setPixel(buf, x, y, ...C.floorBase)
      } else if (dist < r + 2) {
        setPixel(buf, x, y, ...C.wallInner)
      }
    }
  }
  return buf
}

/** Smooth inner corner — top-right */
function makeSmoothInnerTR() {
  const buf = createBuffer()
  fillBuffer(buf, C.wallOuter)
  const r = 10
  for (let y = 0; y < CELL; y++) {
    for (let x = 0; x < CELL; x++) {
      const dist = Math.sqrt((CELL - 1 - x) ** 2 + y ** 2)
      if (dist < r) {
        setPixel(buf, x, y, ...C.floorBase)
      } else if (dist < r + 2) {
        setPixel(buf, x, y, ...C.wallInner)
      }
    }
  }
  return buf
}

/** Smooth inner corner — bottom-left */
function makeSmoothInnerBL() {
  const buf = createBuffer()
  fillBuffer(buf, C.wallOuter)
  const r = 10
  for (let y = 0; y < CELL; y++) {
    for (let x = 0; x < CELL; x++) {
      const dist = Math.sqrt(x ** 2 + (CELL - 1 - y) ** 2)
      if (dist < r) {
        setPixel(buf, x, y, ...C.floorBase)
      } else if (dist < r + 2) {
        setPixel(buf, x, y, ...C.wallInner)
      }
    }
  }
  return buf
}

/** Smooth inner corner — bottom-right */
function makeSmoothInnerBR() {
  const buf = createBuffer()
  fillBuffer(buf, C.wallOuter)
  const r = 10
  for (let y = 0; y < CELL; y++) {
    for (let x = 0; x < CELL; x++) {
      const dist = Math.sqrt((CELL - 1 - x) ** 2 + (CELL - 1 - y) ** 2)
      if (dist < r) {
        setPixel(buf, x, y, ...C.floorBase)
      } else if (dist < r + 2) {
        setPixel(buf, x, y, ...C.wallInner)
      }
    }
  }
  return buf
}

// ---------------------------------------------------------------------------
// Lab props generators (LAB_PROPS)
// ---------------------------------------------------------------------------

/** Vent grate prop */
function makeVentGrate() {
  const buf = createBuffer()
  fillBuffer(buf, C.dark)
  fillRect(buf, 2, 2, CELL - 4, CELL - 4, C.grate)
  // Louver bars
  for (let y = 6; y < CELL - 4; y += 6) {
    fillRect(buf, 4, y, CELL - 8, 3, C.dark, 200)
    fillRect(buf, 4, y, CELL - 8, 1, C.wallHighlight, 40)
  }
  // Frame
  fillRect(buf, 2, 2, CELL - 4, 2, C.wallInner)
  fillRect(buf, 2, CELL - 4, CELL - 4, 2, C.wallInner)
  fillRect(buf, 2, 2, 2, CELL - 4, C.wallInner)
  fillRect(buf, CELL - 4, 2, 2, CELL - 4, C.wallInner)
  return buf
}

/** Pipe section prop */
function makePipeSection() {
  const buf = createBuffer()
  fillBuffer(buf, C.floorBase)
  // Horizontal pipe
  const pipeY = CELL / 2 - 3
  fillRect(buf, 0, pipeY, CELL, 6, C.wallInner)
  fillRect(buf, 0, pipeY, CELL, 2, C.wallHighlight, 80)
  // Bracket mounts
  for (let bx = 8; bx < CELL; bx += 16) {
    fillRect(buf, bx - 1, pipeY - 2, 4, 10, C.grate, 200)
  }
  return buf
}

/** Floor panel prop */
function makeFloorPanel() {
  const buf = createBuffer()
  fillBuffer(buf, C.floorBase)
  fillRect(buf, 4, 4, CELL - 8, CELL - 8, C.wallOuter, 100)
  // Panel grid
  drawLine(buf, 4, CELL / 2, CELL - 4, CELL / 2, C.wallHighlight, 60)
  drawLine(buf, CELL / 2, 4, CELL / 2, CELL - 4, C.wallHighlight, 60)
  // Corner screws
  for (const [sx, sy] of [[6, 6], [CELL - 7, 6], [6, CELL - 7], [CELL - 7, CELL - 7]]) {
    setPixel(buf, sx, sy, ...C.wallHighlight, 150)
  }
  return buf
}

/** Hazard stripe prop */
function makeHazardStripe() {
  const buf = createBuffer()
  fillBuffer(buf, C.dark)
  // Diagonal yellow/black hazard stripes
  for (let i = -CELL; i < CELL * 2; i += 12) {
    for (let d = 0; d < 6; d++) {
      for (let y = 0; y < CELL; y++) {
        const x = i + d + y
        if (x >= 0 && x < CELL) {
          setPixel(buf, x, y, ...C.hazardYellow, 180)
        }
      }
    }
  }
  return buf
}

/** Console panel prop */
function makeConsolePanel() {
  const buf = createBuffer()
  fillBuffer(buf, C.wallOuter)
  // Screen area
  fillRect(buf, 6, 6, CELL - 12, CELL - 18, C.dark)
  // Scan lines
  for (let y = 8; y < CELL - 14; y += 2) {
    fillRect(buf, 8, y, CELL - 16, 1, C.accent, 30)
  }
  // Buttons below screen
  for (let bx = 8; bx < CELL - 8; bx += 8) {
    fillRect(buf, bx, CELL - 10, 4, 4, C.grate)
    setPixel(buf, bx + 1, CELL - 9, ...C.accent, 80)
  }
  return buf
}

/** Cable conduit prop */
function makeCableConduit() {
  const buf = createBuffer()
  fillBuffer(buf, C.floorBase)
  // Vertical cable channel
  fillRect(buf, CELL / 2 - 4, 0, 8, CELL, C.grate, 150)
  // Cable bundles
  fillRect(buf, CELL / 2 - 2, 0, 1, CELL, C.accent, 60)
  fillRect(buf, CELL / 2 + 1, 0, 1, CELL, C.accentDim, 80)
  // Clips
  for (let cy = 8; cy < CELL; cy += 16) {
    fillRect(buf, CELL / 2 - 5, cy, 10, 3, C.wallInner)
  }
  return buf
}

/** Warning light prop */
function makeWarningLight() {
  const buf = createBuffer()
  fillBuffer(buf, C.wallOuter)
  // Circular light housing
  const cx = CELL / 2, cy = CELL / 2
  for (let y = 0; y < CELL; y++) {
    for (let x = 0; x < CELL; x++) {
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2)
      if (dist < 12) {
        setPixel(buf, x, y, ...C.hazardYellow, 150)
      } else if (dist < 14) {
        setPixel(buf, x, y, ...C.grate, 200)
      }
      if (dist < 6) {
        setPixel(buf, x, y, ...C.hazardYellow, 220)
      }
    }
  }
  return buf
}

/** Drainage grate prop */
function makeDrainageGrate() {
  const buf = createBuffer()
  fillBuffer(buf, C.dark)
  // Cross-hatch pattern
  for (let y = 0; y < CELL; y += 6) {
    fillRect(buf, 0, y, CELL, 2, C.grate)
  }
  for (let x = 0; x < CELL; x += 6) {
    fillRect(buf, x, 0, 2, CELL, C.grate)
  }
  // Central drain hole
  const cx = CELL / 2, cy = CELL / 2
  for (let y = 0; y < CELL; y++) {
    for (let x = 0; x < CELL; x++) {
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2)
      if (dist < 6) setPixel(buf, x, y, ...C.dark)
    }
  }
  return buf
}

// ---------------------------------------------------------------------------
// Build orchestration
// ---------------------------------------------------------------------------

async function bufferToSharp(buf) {
  return sharp(buf, { raw: { width: CELL, height: CELL, channels: 4 } }).png().toBuffer()
}

async function buildStrip(frames, outName) {
  console.log(`Building ${outName}...`)
  const composites = []
  for (let i = 0; i < frames.length; i++) {
    const pngBuf = await bufferToSharp(frames[i])
    composites.push({ input: pngBuf, left: i * CELL, top: 0 })
    console.log(`  [${i}] frame`)
  }

  const totalWidth = frames.length * CELL
  await sharp({
    create: { width: totalWidth, height: CELL, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite(composites)
    .png({ compressionLevel: 9 })
    .toFile(resolve(OUT_DIR, outName))

  console.log(`  -> ${outName}  (${totalWidth}x${CELL}, ${frames.length} frames)`)
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })

  // LAB_MAIN_TILESET — 16 frames
  const mainFrames = [
    makeWallTop(),       // 0
    makeWallRight(),     // 1
    makeWallBottom(),    // 2
    makeWallLeft(),      // 3
    makeCornerTL(),      // 4
    makeCornerTR(),      // 5
    makeCornerBL(),      // 6
    makeCornerBR(),      // 7
    makeInnerTop(),      // 8
    makeInnerRight(),    // 9
    makeInnerBottom(),   // 10
    makeInnerLeft(),     // 11
    makeHexFloorA(),     // 12
    makeHexFloorB(),     // 13
    makePlainFloor(),    // 14
    makeGratedFloor(),   // 15
  ]
  await buildStrip(mainFrames, 'lab-tileset.png')

  // LAB_SMOOTH — 8 frames
  const smoothFrames = [
    makeSmoothOuterTL(), // 0
    makeSmoothOuterTR(), // 1
    makeSmoothOuterBL(), // 2
    makeSmoothOuterBR(), // 3
    makeSmoothInnerTL(), // 4
    makeSmoothInnerTR(), // 5
    makeSmoothInnerBL(), // 6
    makeSmoothInnerBR(), // 7
  ]
  await buildStrip(smoothFrames, 'lab-smooth.png')

  // LAB_PROPS — 8 frames
  const propFrames = [
    makeVentGrate(),     // 0
    makePipeSection(),   // 1
    makeFloorPanel(),    // 2
    makeHazardStripe(),  // 3
    makeConsolePanel(),  // 4
    makeCableConduit(),  // 5
    makeWarningLight(),  // 6
    makeDrainageGrate(), // 7
  ]
  await buildStrip(propFrames, 'lab-props.png')

  console.log('\nDone.')
}

main().catch((err) => {
  console.error('build-lab-tileset failed:', err)
  process.exit(1)
})
