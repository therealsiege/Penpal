// ---------------------------------------------------------------------------
// Lab facility decor — LAB_PROPS background detail for lab-themed rooms.
//
// Design: clean, sparse, purposeful — like a real top-down sci-fi lab.
// Consoles along walls, a centerpiece machine in larger rooms, warning signs
// at doorways, cable runs on the floor. Organized, not cluttered.
//
// Rules:
//   - MAX 12-15 decor sprites per room
//   - Scale: 0.15-0.20 for wall items, 0.25-0.30 for centerpieces
//   - Alpha: 0.70-0.85 — decor is background, not foreground
//   - Wall placement only — top/bottom walls, middle clear for workstations
//   - 1 centerpiece per large room in a gap between workstation rows
//   - Warning signs at room edges, 1-2 small sprites
//   - Depth: -2 to -1.5 — below workstations (which are at 50+)
//   - NO sprites in the central workstation zone (middle 60% of height)
//
// Zone types (hash-picked per region):
//   1. Control Room — consoles along top wall, animated screen, stool
//   2. Chemical Station — sink, microscope, beakers along top wall
//   3. Machinery — generator/tank centerpiece, power cells along bottom wall
//   4. Pod Bay — pods along top wall, warning signs at edges
// ---------------------------------------------------------------------------

import type { GameObjects } from 'phaser'
import type { TeamAreaLayout } from './office-types'
import { SPRITESHEET_KEYS, LAB_ANIM_KEYS, ICON_FRAMES } from './office-asset-keys'
import { LAB_PROP_FRAMES } from './lab-prop-frames.generated'
import { computeReferenceLabRegions, type LabRegion } from './lab-footprint'
import type { EnvironmentAnimator } from './environment-animator'

export interface LabFacilityDecorHost {
  hashToken(value: string): number
}

const LP = LAB_PROP_FRAMES

const DEPTH_FLOOR = -2.0
const DEPTH_WALL = -1.8
const DEPTH_EQUIP = -1.6
const DEPTH_TOP = -1.5

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

function pickFrom(pool: number[], hashToken: (s: string) => number, salt: string): number {
  return pool[hashToken(salt) % pool.length]!
}

interface SpriteOpts {
  frame: number
  x: number
  y: number
  scale: number
  depth: number
  alpha?: number
  flipX?: boolean
}

function pushSprite(
  scene: Phaser.Scene,
  out: GameObjects.GameObject[],
  opts: SpriteOpts,
): void {
  const s = scene.add
    .sprite(opts.x, opts.y, SPRITESHEET_KEYS.LAB_PROPS, opts.frame)
    .setScale(opts.flipX ? -opts.scale : opts.scale, opts.scale)
    .setDepth(opts.depth)
    .setAlpha(opts.alpha ?? 0.75)
  out.push(s)
}

function pushAnim(
  scene: Phaser.Scene,
  out: GameObjects.GameObject[],
  animKey: string,
  x: number,
  y: number,
  scale: number,
  depth: number,
  alpha = 0.75,
): void {
  const spr = scene.add
    .sprite(x, y, SPRITESHEET_KEYS.LAB_PROPS)
    .setScale(scale)
    .setDepth(depth)
    .setAlpha(alpha)
  if (scene.anims.exists(animKey)) {
    spr.play(animKey)
  } else {
    spr.setFrame(LP.CONSOLE_SCREEN)
  }
  out.push(spr)
}

// ---------------------------------------------------------------------------
// Zone: Control Room — consoles along top wall, 1 animated screen, stool
// Target: 8-12 sprites
// ---------------------------------------------------------------------------

function placeControlRoom(
  scene: Phaser.Scene,
  out: GameObjects.GameObject[],
  hashToken: (s: string) => number,
  salt: string,
  left: number,
  top: number,
  w: number,
  h: number,
  animator?: EnvironmentAnimator,
): void {
  const right = left + w
  const bottom = top + h

  // --- 2-3 consoles along top wall, evenly spaced ---
  const consoleCount = w > 140 ? 3 : 2
  const spacing = w / (consoleCount + 1)
  const consoleFrames = [LP.CONSOLE_EXAMPLE_LONG, LP.CONSOLE_EXAMPLE_SHORT, LP.CONSOLE_EXAMPLE_CORNER]
  for (let i = 0; i < consoleCount; i++) {
    const cx = left + spacing * (i + 1)
    pushSprite(scene, out, {
      frame: pickFrom(consoleFrames, hashToken, `${salt}|con|${i}`),
      x: cx, y: top + 8, scale: 0.18, depth: DEPTH_EQUIP, alpha: 0.80,
    })
  }

  // --- 1 animated screen on the first console ---
  const animKey = hashToken(`${salt}|anim`) % 2 === 0
    ? LAB_ANIM_KEYS.CONSOLE_WAVE
    : LAB_ANIM_KEYS.CONSOLE_LINES
  pushAnim(scene, out, animKey, left + spacing, top + 14, 0.16, DEPTH_TOP, 0.75)

  // --- 1 stool below a console (bottom margin) ---
  pushSprite(scene, out, {
    frame: LP.STOOL, x: left + spacing * 2, y: bottom - 10,
    scale: 0.15, depth: DEPTH_WALL, alpha: 0.70,
  })

  // --- 1 keyboard on bottom wall ---
  pushSprite(scene, out, {
    frame: LP.COMPUTER_KEYBOARD, x: right - w * 0.3, y: bottom - 8,
    scale: 0.15, depth: DEPTH_WALL, alpha: 0.70,
  })

  // --- 2 cable pieces along bottom edge ---
  const cableFrames = [LP.CABLE_PIECE_01, LP.CABLE_PIECE_02, LP.CABLE_PIECE_03]
  pushSprite(scene, out, {
    frame: pickFrom(cableFrames, hashToken, `${salt}|cab0`),
    x: left + 12, y: bottom - 6, scale: 0.15, depth: DEPTH_FLOOR, alpha: 0.70,
  })
  pushSprite(scene, out, {
    frame: pickFrom(cableFrames, hashToken, `${salt}|cab1`),
    x: left + 36, y: bottom - 6, scale: 0.15, depth: DEPTH_FLOOR, alpha: 0.70,
  })

  // --- 1 warning sign at room edge ---
  const warnFrames = [LP.WARNING_POWER, LP.WARNING_WARNING, LP.WARNING_STRIPES]
  pushSprite(scene, out, {
    frame: pickFrom(warnFrames, hashToken, `${salt}|warn`),
    x: right - 10, y: top + 8, scale: 0.15, depth: DEPTH_WALL, alpha: 0.75,
  })

  // --- Atmosphere: 2 vent sources along bottom wall + 1 plant near stool ---
  if (animator) {
    animator.registerVent(left + 16, bottom - 4)
    animator.registerVent(right - 16, bottom - 4)

    const plant = scene.add
      .sprite(left + spacing * 2 + 14, bottom - 10, SPRITESHEET_KEYS.GAME_ICONS, ICON_FRAMES.CIRCLE_GREEN)
      .setScale(0.18)
      .setDepth(DEPTH_WALL)
      .setAlpha(0.80)
    out.push(plant)
    animator.registerPlant(plant, Math.random() * 3000)
  }
}

// ---------------------------------------------------------------------------
// Zone: Chemical Station — sink, microscope, beakers along walls
// Target: 8-10 sprites
// ---------------------------------------------------------------------------

function placeChemicalStation(
  scene: Phaser.Scene,
  out: GameObjects.GameObject[],
  hashToken: (s: string) => number,
  salt: string,
  left: number,
  top: number,
  w: number,
  h: number,
  animator?: EnvironmentAnimator,
): void {
  const right = left + w
  const bottom = top + h

  // --- Sink centered on top wall ---
  pushSprite(scene, out, {
    frame: LP.CIRCULAR_SINK, x: left + w * 0.5, y: top + 10,
    scale: 0.20, depth: DEPTH_EQUIP, alpha: 0.80,
  })

  // --- Microscope left of sink ---
  pushSprite(scene, out, {
    frame: LP.MICROSCOPE, x: left + w * 0.25, y: top + 10,
    scale: 0.18, depth: DEPTH_EQUIP, alpha: 0.80,
  })

  // --- 2 beakers right of sink ---
  pushSprite(scene, out, {
    frame: LP.BEAKER, x: left + w * 0.7, y: top + 8,
    scale: 0.15, depth: DEPTH_WALL, alpha: 0.75,
  })
  pushSprite(scene, out, {
    frame: LP.CONICAL_BEAKER, x: left + w * 0.78, y: top + 8,
    scale: 0.15, depth: DEPTH_WALL, alpha: 0.75,
  })

  // --- Petri dish on top wall ---
  pushSprite(scene, out, {
    frame: LP.PETRI_DISH, x: left + w * 0.15, y: top + 6,
    scale: 0.15, depth: DEPTH_WALL, alpha: 0.70,
  })

  // --- Shelf on bottom wall ---
  pushSprite(scene, out, {
    frame: LP.SHELF, x: left + w * 0.4, y: bottom - 8,
    scale: 0.18, depth: DEPTH_WALL, alpha: 0.75,
  })

  // --- Small apparatus on bottom wall ---
  pushSprite(scene, out, {
    frame: LP.SMALL_APPARATUS, x: left + w * 0.65, y: bottom - 8,
    scale: 0.15, depth: DEPTH_WALL, alpha: 0.70,
  })

  // --- Warning biological sign at edge ---
  pushSprite(scene, out, {
    frame: LP.WARNING_BIOLOGICAL, x: left + 8, y: top + 6,
    scale: 0.15, depth: DEPTH_WALL, alpha: 0.75,
  })

  // --- Atmosphere: vent near sink + 2 potted plants ---
  if (animator) {
    animator.registerVent(left + w * 0.5, top + 14)

    const plantPositions = [
      { x: left + w * 0.88, y: top + 10 },
      { x: left + w * 0.12, y: bottom - 10 },
    ]
    plantPositions.forEach((pos, idx) => {
      const plant = scene.add
        .sprite(pos.x, pos.y, SPRITESHEET_KEYS.GAME_ICONS, ICON_FRAMES.CIRCLE_GREEN)
        .setScale(0.18)
        .setDepth(DEPTH_WALL)
        .setAlpha(0.80)
      out.push(plant)
      animator.registerPlant(plant, idx * 1200 + Math.random() * 800)
    })
  }
}

// ---------------------------------------------------------------------------
// Zone: Machinery — centerpiece generator/tank, power cells along walls
// Target: 8-12 sprites
// ---------------------------------------------------------------------------

function placeMachinery(
  scene: Phaser.Scene,
  out: GameObjects.GameObject[],
  hashToken: (s: string) => number,
  salt: string,
  left: number,
  top: number,
  w: number,
  h: number,
  animator?: EnvironmentAnimator,
): void {
  const right = left + w
  const bottom = top + h

  // --- Centerpiece: 1 large machine on top wall ---
  const centerpieces = [LP.GENERATOR, LP.LAB_MACHINE_01, LP.LARGE_TANK]
  pushSprite(scene, out, {
    frame: pickFrom(centerpieces, hashToken, `${salt}|center`),
    x: left + w * 0.5, y: top + 12, scale: 0.28, depth: DEPTH_EQUIP, alpha: 0.85,
  })

  // --- Warning sign next to centerpiece ---
  pushSprite(scene, out, {
    frame: pickFrom([LP.WARNING_POWER, LP.WARNING_DEATH], hashToken, `${salt}|warn`),
    x: left + w * 0.5 + 20, y: top + 6, scale: 0.15, depth: DEPTH_WALL, alpha: 0.75,
  })

  // --- Dome on left side of top wall ---
  pushSprite(scene, out, {
    frame: LP.DOME, x: left + w * 0.2, y: top + 10,
    scale: 0.20, depth: DEPTH_EQUIP, alpha: 0.80,
  })

  // --- 2-3 power cells along bottom wall ---
  const cellCount = w > 120 ? 3 : 2
  const cellSpacing = w / (cellCount + 1)
  for (let i = 0; i < cellCount; i++) {
    pushSprite(scene, out, {
      frame: LP.POWER_CELL, x: left + cellSpacing * (i + 1), y: bottom - 8,
      scale: 0.17, depth: DEPTH_WALL, alpha: 0.75,
    })
  }

  // --- Fan unit on bottom wall ---
  pushSprite(scene, out, {
    frame: LP.FAN_UNIT_HOUSING, x: right - 16, y: bottom - 10,
    scale: 0.18, depth: DEPTH_WALL, alpha: 0.75,
  })

  // --- Vent on bottom edge ---
  pushSprite(scene, out, {
    frame: LP.SUNKEN_VENT, x: left + 12, y: bottom - 6,
    scale: 0.15, depth: DEPTH_FLOOR, alpha: 0.70,
  })

  // --- Atmosphere: register both vent positions for steam ---
  if (animator) {
    animator.registerVent(left + 12, bottom - 6)
    animator.registerVent(right - 16, bottom - 8)
  }
}

// ---------------------------------------------------------------------------
// Zone: Pod Bay — pods along top wall, sliding door, warning signs
// Target: 8-12 sprites
// ---------------------------------------------------------------------------

function placePodBay(
  scene: Phaser.Scene,
  out: GameObjects.GameObject[],
  hashToken: (s: string) => number,
  salt: string,
  left: number,
  top: number,
  w: number,
  h: number,
  animator?: EnvironmentAnimator,
): void {
  const right = left + w
  const bottom = top + h

  // --- 2-3 pods along top wall ---
  const podCount = w > 140 ? 3 : 2
  const podSpacing = w / (podCount + 1)
  for (let i = 0; i < podCount; i++) {
    const isBroken = hashToken(`${salt}|pod|${i}|brk`) % 5 === 0
    pushSprite(scene, out, {
      frame: isBroken ? LP.BROKEN_POD : LP.POD,
      x: left + podSpacing * (i + 1), y: top + 12,
      scale: 0.20, depth: DEPTH_EQUIP, alpha: isBroken ? 0.70 : 0.80,
    })
  }

  // --- Sliding door at left edge ---
  pushSprite(scene, out, {
    frame: LP.SLIDING_DOOR, x: left + 10, y: top + h * 0.5,
    scale: 0.18, depth: DEPTH_WALL, alpha: 0.75,
  })

  // --- Warning signs at room edges ---
  pushSprite(scene, out, {
    frame: LP.WARNING_BIOLOGICAL, x: left + 8, y: top + 6,
    scale: 0.15, depth: DEPTH_WALL, alpha: 0.75,
  })
  pushSprite(scene, out, {
    frame: LP.WARNING_STRIPES, x: right - 10, y: top + 6,
    scale: 0.15, depth: DEPTH_WALL, alpha: 0.75,
  })

  // --- Warning stripes along bottom edge (2 max) ---
  pushSprite(scene, out, {
    frame: LP.WARNING_STRIPES, x: left + w * 0.3, y: bottom - 6,
    scale: 0.15, depth: DEPTH_FLOOR, alpha: 0.70,
  })
  pushSprite(scene, out, {
    frame: LP.WARNING_STRIPES, x: left + w * 0.7, y: bottom - 6,
    scale: 0.15, depth: DEPTH_FLOOR, alpha: 0.70,
  })

  // --- 1 cable run along bottom wall ---
  pushSprite(scene, out, {
    frame: LP.CABLE_PIECE_01, x: left + w * 0.5, y: bottom - 6,
    scale: 0.15, depth: DEPTH_FLOOR, alpha: 0.70,
  })

  // --- Atmosphere: vent near warning stripes + 1 plant near door ---
  if (animator) {
    animator.registerVent(left + w * 0.3, bottom - 4)

    const plant = scene.add
      .sprite(left + 14, top + h * 0.5 + 12, SPRITESHEET_KEYS.GAME_ICONS, ICON_FRAMES.CIRCLE_GREEN)
      .setScale(0.18)
      .setDepth(DEPTH_WALL)
      .setAlpha(0.80)
    out.push(plant)
    animator.registerPlant(plant, Math.random() * 3000)
  }
}

// ---------------------------------------------------------------------------
// placeZone — pick a zone type by hash, place 8-12 sprites
// ---------------------------------------------------------------------------

function placeZone(
  scene: Phaser.Scene,
  out: GameObjects.GameObject[],
  hashToken: (s: string) => number,
  salt: string,
  left: number,
  top: number,
  w: number,
  h: number,
  forceZone?: 'control' | 'chemical' | 'machinery' | 'pod',
  animator?: EnvironmentAnimator,
): void {
  if (w < 40 || h < 30) return

  const zone = forceZone ?? (['control', 'chemical', 'machinery', 'pod'] as const)[hashToken(`${salt}|zone`) % 4]
  switch (zone) {
    case 'control':
      placeControlRoom(scene, out, hashToken, salt, left, top, w, h, animator)
      break
    case 'chemical':
      placeChemicalStation(scene, out, hashToken, salt, left, top, w, h, animator)
      break
    case 'machinery':
      placeMachinery(scene, out, hashToken, salt, left, top, w, h, animator)
      break
    case 'pod':
      placePodBay(scene, out, hashToken, salt, left, top, w, h, animator)
      break
  }
}

// ---------------------------------------------------------------------------
// Public entry point — placeLabFacilityDecor
// ---------------------------------------------------------------------------

export function placeLabFacilityDecor(
  scene: Phaser.Scene,
  out: GameObjects.GameObject[],
  host: LabFacilityDecorHost,
  area: TeamAreaLayout,
  x: number,
  y: number,
  width: number,
  height: number,
  bannerH: number,
  animator?: EnvironmentAnimator,
): void {
  const hashToken = (s: string) => host.hashToken(s)

  const uniX = x + 4
  const uniY = y + bannerH + 4
  const uniW = Math.max(4, width - 8)
  const uniH = Math.max(4, height - bannerH - 8)
  const footprintRegions = computeReferenceLabRegions(uniX, uniY, uniW, uniH)

  if (footprintRegions.length > 1) {
    const salt = area.teamKey
    const main = footprintRegions.find((rr) => rr.id === 'main')!
    const wingL = footprintRegions.find((rr) => rr.id === 'wingL')
    const wingR = footprintRegions.find((rr) => rr.id === 'wingR')

    // Main hall — machinery or control room
    const mainPad = 10
    placeZone(
      scene, out, hashToken, `${salt}|main`,
      main.x + mainPad, main.y + mainPad,
      Math.max(0, main.w - mainPad * 2), Math.max(0, main.h - mainPad * 2),
      hashToken(`${salt}|mainZone`) % 2 === 0 ? 'machinery' : 'control',
      animator,
    )

    // Wing L — chemical station
    if (wingL) {
      const wPad = 8
      placeZone(
        scene, out, hashToken, `${salt}|wl`,
        wingL.x + wPad, wingL.y + wPad,
        Math.max(0, wingL.w - wPad * 2), Math.max(0, wingL.h - wPad * 2),
        'chemical',
        animator,
      )
    }

    // Wing R — pod bay
    if (wingR) {
      const wPad = 8
      placeZone(
        scene, out, hashToken, `${salt}|wr`,
        wingR.x + wPad, wingR.y + wPad,
        Math.max(0, wingR.w - wPad * 2), Math.max(0, wingR.h - wPad * 2),
        'pod',
        animator,
      )
    }
    return
  }

  // --- Single-rectangle fallback (no L-shaped footprint) ---
  const innerTop = y + bannerH + 6
  const innerH = Math.max(28, height - bannerH - 16)

  type Band = { zleft: number; zwidth: number; zkey: string }
  const bands: Band[] =
    area.directoryZones && area.directoryZones.length > 0
      ? area.directoryZones.map((z) => ({
          zleft: x + z.x,
          zwidth: z.width,
          zkey: z.label,
        }))
      : [{ zleft: x, zwidth: width, zkey: area.teamKey }]

  for (const band of bands) {
    const pad = 8
    const zleft = band.zleft + pad
    const zw = Math.max(0, band.zwidth - pad * 2)
    if (zw < 28) continue

    const zSalt = `${area.teamKey}|${band.zkey}`
    placeZone(scene, out, hashToken, zSalt, zleft, innerTop, zw, innerH, undefined, animator)
  }
}
