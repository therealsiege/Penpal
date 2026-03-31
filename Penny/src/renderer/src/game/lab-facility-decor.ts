// ---------------------------------------------------------------------------
// Lab facility decor — LAB_PROPS background detail for lab-themed rooms.
// Depth: back clutter → equipment → console pits → animated hero (on top).
//
// IMPORTANT: All placement respects workstation exclusion zones. The central
// ~60% of each zone's height is kept sparse so agent desks/characters remain
// readable. Heavy equipment is pushed to TOP and BOTTOM margins only.
//
// Zone types:
//   1. Control Room — wall of consoles, animated screens, LEDs, gauges, stools
//   2. Chemical Station — sink, beakers, test tubes, microscope on bench surfaces
//   3. Machinery — generator, lab machine, tanks, power cells, fan units
//   4. Pod Bay — pods (normal + broken), sliding doors, warning signs
//   5. Infrastructure — cables, pipes, blocks, vents, panels on floor
// ---------------------------------------------------------------------------

import type { GameObjects } from 'phaser'
import type { TeamAreaLayout } from './office-types'
import { SPRITESHEET_KEYS, LAB_ANIM_KEYS } from './office-asset-keys'
import { LAB_PROP_FRAMES } from './lab-prop-frames.generated'
import { computeReferenceLabRegions, type LabRegion } from './lab-footprint'

export interface LabFacilityDecorHost {
  hashToken(value: string): number
}

const LP = LAB_PROP_FRAMES

/** Laser burst frames are only meaningful as animation — skip for static scatter. */
const EXCLUDE_STATIC = new Set<number>([
  LP.LASER_END_START_END_EFFECT_01,
  LP.LASER_END_START_END_EFFECT_02,
  LP.LASER_END_START_END_EFFECT_03,
  LP.LASER_END_START_END_EFFECT_04,
])

/** ~130+ tiles — everything in the sheet except the 4 laser-effect frames. */
const ALL_STATIC_FRAMES: number[] = (Object.values(LP) as number[]).filter(
  (f) => typeof f === 'number' && !EXCLUDE_STATIC.has(f),
)

function pickAny(hashToken: (s: string) => number, salt: string): number {
  return ALL_STATIC_FRAMES[hashToken(salt) % ALL_STATIC_FRAMES.length]!
}

const DEPTH_BACK = -2.38
const DEPTH_MID = -2.22
const DEPTH_FORE = -2.08
const DEPTH_HERO = -1.98

// ---------------------------------------------------------------------------
// Themed frame pools — curated sets for each zone type
// ---------------------------------------------------------------------------

const CONSOLE_FRAMES = [
  LP.CONSOLE_EXAMPLE_CORNER, LP.CONSOLE_EXAMPLE_LONG, LP.CONSOLE_EXAMPLE_SHORT,
  LP.BLANK_CONSOLE_CORNER, LP.BLANK_CONSOLE_LONG, LP.BLANK_CONSOLE_SHORT,
  LP.CONSOLE_SCREEN, LP.CONSOLE_LED_ON, LP.CONSOLE_LED_OFF,
  LP.FREE_STANDING_SCREEN, LP.MONITOR, LP.KEYBOARD, LP.COMPUTER_KEYBOARD,
]

const CONTROL_SMALL = [
  LP.SWITCH_UP, LP.SWITCH_DOWN, LP.STOP_BUTTON, LP.STOP_BUTTON_02,
  LP.JOYSTICK, LP.NUMB_PAD, LP.DIAL, LP.DIAL_02,
  LP.GUAGE, LP.GUAGE_NEEDLE, LP.LED_ON, LP.LED_OFF,
  LP.TABLET, LP.CLIPBOARD, LP.CLIPBOARD_02,
]

const CHEMICAL_FRAMES = [
  LP.CIRCULAR_SINK, LP.CIRCULAR_SINK_FAN, LP.CIRCULAR_SINK_ITEM, LP.CIRCULAR_SINK_LEVER,
  LP.BEAKER, LP.CONICAL_BEAKER, LP.TEST_TUBE_HOLDER, LP.PETRI_DISH,
  LP.MICROSCOPE, LP.SPILT_TEST_TUBE, LP.SMALL_APPARATUS, LP.SCALE,
  LP.CIRCULAR_PANEL, LP.GAS_VALVE_ON, LP.GAS_VALVE_OFF,
]

const BENCH_FRAMES = [
  LP.DESK_TOP_LONG, LP.DESK_TOP_SHORT, LP.DESK_LAMP, LP.DESK_DRAW,
  LP.SHELF, LP.STOOL,
]

const MACHINERY_FRAMES = [
  LP.GENERATOR, LP.LAB_MACHINE_01, LP.LARGE_TANK, LP.DOME,
  LP.FAN_UNIT_FAN, LP.FAN_UNIT_HOUSING, LP.POWER_CELL,
  LP.UNIT_LARGE, LP.UNIT_SMALL, LP.UNIT_SQUARE,
  LP.UNIT_EXAMPLE_01, LP.UNIT_EXAMPLE_02, LP.UNIT_EXAMPLE_03, LP.UNIT_EXAMPLE_04,
  LP.SUNKEN_CELL, LP.SUNKEN_VENT, LP.SUNKEN_NUT,
]

const POD_FRAMES = [
  LP.POD, LP.BROKEN_POD, LP.SLIDING_DOOR,
]

const WARNING_FRAMES = [
  LP.WARNING_BIOLOGICAL, LP.WARNING_DEATH, LP.WARNING_POWER,
  LP.WARNING_STRIPES, LP.WARNING_WARNING,
]

const INFRASTRUCTURE_FRAMES = [
  LP.CABLE_PIECE_01, LP.CABLE_PIECE_02, LP.CABLE_PIECE_03,
  LP.CABLE_COVER, LP.CABLE_COVER_WITH_RAMP,
  LP.PIPE_CONNECTOR_ANGLED_TO_ANGLED, LP.PIPE_CONNECTOR_ANGLED_TO_SIDE,
  LP.PIPE_CONNECTOR_ARCHED, LP.PIPE_CONNECTOR_TO_ANGLE, LP.PIPE_CONNECTOR_TO_SIDE,
  LP.CLAMP_SINGLE, LP.CLAMP_DOUBLE, LP.NUT,
  LP.BLOCK_01, LP.BLOCK_02, LP.BLOCK_03, LP.BLOCK_04, LP.BLOCK_05,
  LP.VENT, LP.VENT_SLATS, LP.TUBE,
  LP.OCTAGONAL_PANEL, LP.OCTOGON_PLATE, LP.OCTOGON_PLATE_SMALL,
  LP.RECTANGLE_PANEL, LP.SMALL_RECTANGLE_PANEL,
  LP.FLOOR_SPIKE_DOWN, LP.FLOOR_SPIKE_UP,
]

const MISC_SMALL = [
  LP.CUP, LP.CUP_02, LP.PENCIL, LP.PAPER_SHEET, LP.PAPER_SHEET_02,
  LP.CHEST_CLOSED, LP.CHEST_OPEN, LP.SPEAKER, LP.SPEAKER_02, LP.WALL_LIGHT,
  LP.NARROW_SKYLIGHT, LP.SMALL_SKYLIGHT, LP.LARGE_SKYLIGHT,
  LP.PUDDLE,
]

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
  hashToken: (s: string) => number,
  salt: string,
  opts: SpriteOpts,
): void {
  const h = hashToken(`flip|${salt}`)
  const autoFlip = opts.flipX !== undefined ? opts.flipX : h % 5 === 0
  const flipMul = autoFlip ? -1 : 1
  out.push(
    scene.add
      .sprite(opts.x, opts.y, SPRITESHEET_KEYS.LAB_PROPS, opts.frame)
      .setScale(opts.scale * flipMul, opts.scale)
      .setDepth(opts.depth)
      .setAlpha(opts.alpha ?? 0.6),
  )
}

function pushAnim(
  scene: Phaser.Scene,
  out: GameObjects.GameObject[],
  hashToken: (s: string) => number,
  salt: string,
  animKey: string,
  x: number,
  y: number,
  scale: number,
  depth: number,
  alpha = 0.6,
): void {
  const h = hashToken(`aflip|${salt}`)
  const flipX = h % 6 === 0 ? -1 : 1
  const spr = scene.add
    .sprite(x, y, SPRITESHEET_KEYS.LAB_PROPS)
    .setScale(scale * flipX, scale)
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
// Zone: Control Room — wall of consoles with animated screens
// ---------------------------------------------------------------------------

function placeControlRoomZone(
  scene: Phaser.Scene,
  out: GameObjects.GameObject[],
  hashToken: (s: string) => number,
  salt: string,
  left: number,
  top: number,
  w: number,
  h: number,
): void {
  if (w < 60 || h < 40) return

  const step = 42
  const right = left + w
  const bottom = top + h
  // Workstation exclusion: keep the central 60% of height sparse
  const midTop = top + h * 0.2
  const midBot = top + h * 0.8

  // --- Back wall: row of consoles flush against top edge (TOP margin only) ---
  let cx = left + 4
  let consoleIdx = 0
  while (cx + step < right - 4) {
    const s = `${salt}|cwall|${consoleIdx}`
    // Skip every other console to reduce density
    if (consoleIdx % 2 !== 0) { cx += step; consoleIdx++; continue }
    const variant = hashToken(s) % 6
    let frame: number
    if (variant < 2) frame = LP.CONSOLE_EXAMPLE_CORNER
    else if (variant < 4) frame = LP.CONSOLE_EXAMPLE_LONG
    else frame = LP.BLANK_CONSOLE_LONG
    pushSprite(scene, out, hashToken, s, {
      frame, x: cx, y: top + 6, scale: 0.32 + (hashToken(`${s}sc`) % 4) * 0.01,
      depth: DEPTH_FORE, alpha: 0.65,
    })
    // Animated screen on top of every other kept console
    if (consoleIdx % 4 === 0 && cx + step * 0.5 < right - 8) {
      const anim = hashToken(`${s}anim`) % 2 === 0 ? LAB_ANIM_KEYS.CONSOLE_WAVE : LAB_ANIM_KEYS.CONSOLE_LINES
      pushAnim(scene, out, hashToken, `${s}|scr`, anim, cx + 2, top + 18, 0.28, DEPTH_HERO, 0.60)
    }
    cx += step
    consoleIdx++
  }

  // --- LED indicator strips along TOP edge only ---
  const ledY = top + 8
  for (let li = 0; li < Math.min(5, Math.floor(w / 28)); li++) {
    const lx = left + 8 + li * 28
    const ls = `${salt}|led|${li}`
    const frame = hashToken(ls) % 3 === 0 ? LP.LED_OFF : LP.LED_ON
    pushSprite(scene, out, hashToken, ls, {
      frame, x: lx, y: ledY, scale: 0.14, depth: DEPTH_FORE, alpha: 0.55,
    })
  }

  // --- Gauge/dial clusters on side walls (skip mid zone) ---
  const gaugeCount = Math.max(1, Math.floor(h / 44))
  for (let gi = 0; gi < gaugeCount; gi++) {
    const gy = top + 10 + gi * 42
    if (gy + 10 > bottom) break
    if (gy > midTop && gy < midBot) continue // skip workstation zone
    const gs = `${salt}|gauge|${gi}`
    const gfL = pickFrom([LP.GUAGE, LP.GUAGE_NEEDLE, LP.DIAL, LP.DIAL_02], hashToken, `${gs}L`)
    pushSprite(scene, out, hashToken, `${gs}L`, {
      frame: gfL, x: left + 4, y: gy, scale: 0.18, depth: DEPTH_MID, alpha: 0.55,
    })
    const gfR = pickFrom([LP.GUAGE, LP.GUAGE_NEEDLE, LP.DIAL, LP.DIAL_02], hashToken, `${gs}R`)
    pushSprite(scene, out, hashToken, `${gs}R`, {
      frame: gfR, x: right - 6, y: gy, scale: 0.18, depth: DEPTH_MID, alpha: 0.55,
    })
  }

  // --- Free-standing screen in wider rooms (BOTTOM margin only) ---
  if (w > 160) {
    const fsx = left + w * 0.72
    const fsy = bottom - 18
    pushSprite(scene, out, hashToken, `${salt}|fscreen`, {
      frame: LP.FREE_STANDING_SCREEN, x: fsx, y: fsy, scale: 0.28,
      depth: DEPTH_FORE, alpha: 0.60,
    })
    const fsAnim = hashToken(`${salt}|fsanim`) % 2 === 0 ? LAB_ANIM_KEYS.CONSOLE_WAVE : LAB_ANIM_KEYS.CONSOLE_LINES
    pushAnim(scene, out, hashToken, `${salt}|fsanim`, fsAnim, fsx + 2, fsy + 10, 0.24, DEPTH_HERO, 0.55)
  }
}

// ---------------------------------------------------------------------------
// Zone: Chemical Station — lab benches with instruments
// ---------------------------------------------------------------------------

function placeChemicalStationZone(
  scene: Phaser.Scene,
  out: GameObjects.GameObject[],
  hashToken: (s: string) => number,
  salt: string,
  left: number,
  top: number,
  w: number,
  h: number,
): void {
  if (w < 50 || h < 36) return

  const right = left + w
  const bottom = top + h

  // --- Sink in TOP margin only (away from workstations) ---
  const csx = left + w * 0.5
  const csy = top + 12
  pushSprite(scene, out, hashToken, `${salt}|sink`, {
    frame: LP.CIRCULAR_SINK, x: csx, y: csy, scale: 0.30,
    depth: DEPTH_FORE, alpha: 0.60,
  })
  // One sink accessory only
  pushSprite(scene, out, hashToken, `${salt}|sinkacc|0`, {
    frame: LP.CIRCULAR_SINK_LEVER, x: csx + 14, y: csy + 4, scale: 0.20,
    depth: DEPTH_FORE + 0.01, alpha: 0.55,
  })

  // --- Microscope station in TOP margin ---
  const mx = left + w * 0.22
  const my = top + 14
  pushSprite(scene, out, hashToken, `${salt}|micro`, {
    frame: LP.MICROSCOPE, x: mx, y: my, scale: 0.30,
    depth: DEPTH_HERO, alpha: 0.65,
  })
  // One petri dish
  pushSprite(scene, out, hashToken, `${salt}|petri|0`, {
    frame: LP.PETRI_DISH, x: mx + 16, y: my + 4, scale: 0.16,
    depth: DEPTH_FORE, alpha: 0.55,
  })

  // --- Scale + gas valve on side wall ---
  if (w > 100) {
    pushSprite(scene, out, hashToken, `${salt}|scale`, {
      frame: LP.SCALE, x: right - 16, y: top + 10, scale: 0.24,
      depth: DEPTH_FORE, alpha: 0.58,
    })
    pushSprite(scene, out, hashToken, `${salt}|gasv`, {
      frame: hashToken(`${salt}gv`) % 2 === 0 ? LP.GAS_VALVE_ON : LP.GAS_VALVE_OFF,
      x: right - 8, y: bottom - 14, scale: 0.18,
      depth: DEPTH_MID, alpha: 0.52,
    })
  }

  // --- Spill / puddle in BOTTOM margin ---
  if (hashToken(`${salt}|spill`) % 3 !== 0) {
    const spX = left + w * (0.3 + (hashToken(`${salt}spx`) % 4) * 0.1)
    const spY = bottom - 12
    pushSprite(scene, out, hashToken, `${salt}|spill`, {
      frame: LP.SPILT_TEST_TUBE, x: spX, y: spY, scale: 0.20,
      depth: DEPTH_BACK + 0.04, alpha: 0.55,
    })
  }
}

// ---------------------------------------------------------------------------
// Zone: Machinery — heavy equipment centerpieces
// ---------------------------------------------------------------------------

function placeMachineryZone(
  scene: Phaser.Scene,
  out: GameObjects.GameObject[],
  hashToken: (s: string) => number,
  salt: string,
  left: number,
  top: number,
  w: number,
  h: number,
): void {
  if (w < 50 || h < 36) return

  const right = left + w
  const bottom = top + h
  // Workstation exclusion zone
  const midTop = top + h * 0.2
  const midBot = top + h * 0.8

  // --- Central machinery in TOP margin ---
  const centerpieces = [LP.GENERATOR, LP.LAB_MACHINE_01, LP.DOME]
  const mainFrame = pickFrom(centerpieces, hashToken, `${salt}|center`)
  pushSprite(scene, out, hashToken, `${salt}|mainMach`, {
    frame: mainFrame, x: left + w * 0.5, y: top + 14, scale: 0.35,
    depth: DEPTH_FORE, alpha: 0.65,
  })

  // --- Warning sign next to centerpiece ---
  const warnFrame = pickFrom(WARNING_FRAMES, hashToken, `${salt}|warn`)
  pushSprite(scene, out, hashToken, `${salt}|warnSign`, {
    frame: warnFrame, x: left + w * 0.5 + 22, y: top + 6, scale: 0.18,
    depth: DEPTH_FORE + 0.01, alpha: 0.58,
  })

  // --- One tank on side wall (TOP margin only) ---
  const tankSide = hashToken(`${salt}|tankSide`) % 2 === 0 ? left + 10 : right - 18
  pushSprite(scene, out, hashToken, `${salt}|tank|0`, {
    frame: LP.LARGE_TANK, x: tankSide, y: top + 10,
    scale: 0.30, depth: DEPTH_FORE, alpha: 0.60,
  })

  // --- Power cells in BOTTOM margin ---
  const pcY = bottom - 12
  const pcCount = Math.min(3, Math.max(1, Math.floor(w / 48)))
  for (let pi = 0; pi < pcCount; pi++) {
    const px = left + 12 + pi * 44
    if (px > right - 8) break
    pushSprite(scene, out, hashToken, `${salt}|pcell|${pi}`, {
      frame: LP.POWER_CELL, x: px, y: pcY, scale: 0.22,
      depth: DEPTH_MID, alpha: 0.55,
    })
  }

  // --- One fan unit in BOTTOM margin ---
  if (w > 100) {
    pushSprite(scene, out, hashToken, `${salt}|fanH`, {
      frame: LP.FAN_UNIT_HOUSING, x: left + w * 0.7, y: bottom - 14, scale: 0.26,
      depth: DEPTH_MID, alpha: 0.55,
    })
  }

  // --- Vents on BOTTOM edge ---
  const ventY = bottom - 8
  for (let vi = 0; vi < Math.min(3, Math.floor(w / 48)); vi++) {
    const vx = left + 16 + vi * 46
    pushSprite(scene, out, hashToken, `${salt}|vent|${vi}`, {
      frame: hashToken(`${salt}v${vi}`) % 2 === 0 ? LP.SUNKEN_VENT : LP.VENT_SLATS,
      x: vx, y: ventY, scale: 0.20, depth: DEPTH_BACK + 0.05, alpha: 0.50,
    })
  }
}

// ---------------------------------------------------------------------------
// Zone: Pod Bay — organized pod bays with doors & warnings
// ---------------------------------------------------------------------------

function placePodBayZone(
  scene: Phaser.Scene,
  out: GameObjects.GameObject[],
  hashToken: (s: string) => number,
  salt: string,
  left: number,
  top: number,
  w: number,
  h: number,
): void {
  if (w < 60 || h < 40) return

  const right = left + w
  const bottom = top + h

  // --- Pod bays in TOP margin only ---
  const podSpacing = 60
  const podCount = Math.max(1, Math.min(3, Math.floor((w - 16) / podSpacing)))
  const podStartX = left + (w - podCount * podSpacing) / 2 + podSpacing / 2
  const podY = top + 14

  for (let pi = 0; pi < podCount; pi++) {
    const px = podStartX + pi * podSpacing
    const ps = `${salt}|pod|${pi}`
    const isBroken = hashToken(`${ps}|brk`) % 5 === 0
    pushSprite(scene, out, hashToken, ps, {
      frame: isBroken ? LP.BROKEN_POD : LP.POD, x: px, y: podY,
      scale: 0.30, depth: DEPTH_FORE, alpha: isBroken ? 0.52 : 0.65,
    })
    // LED indicator above each pod
    pushSprite(scene, out, hashToken, `${ps}|led`, {
      frame: isBroken ? LP.LED_OFF : LP.LED_ON, x: px, y: podY - 14,
      scale: 0.12, depth: DEPTH_FORE + 0.01, alpha: 0.55,
    })
  }

  // --- Warning signs at side walls ---
  pushSprite(scene, out, hashToken, `${salt}|warnBio`, {
    frame: LP.WARNING_BIOLOGICAL, x: left + 6, y: top + 10, scale: 0.16,
    depth: DEPTH_MID, alpha: 0.55,
  })
  pushSprite(scene, out, hashToken, `${salt}|warnPow`, {
    frame: LP.WARNING_POWER, x: right - 6, y: top + 10, scale: 0.16,
    depth: DEPTH_MID, alpha: 0.55,
  })

  // --- Warning stripes along BOTTOM edge ---
  const stripeY = bottom - 6
  for (let si = 0; si < Math.min(4, Math.floor(w / 32)); si++) {
    pushSprite(scene, out, hashToken, `${salt}|stripe|${si}`, {
      frame: LP.WARNING_STRIPES, x: left + 10 + si * 32, y: stripeY,
      scale: 0.16, depth: DEPTH_BACK + 0.02, alpha: 0.50,
    })
  }
}

// ---------------------------------------------------------------------------
// Zone: Infrastructure floor layer — cables, pipes, blocks, panels
// ---------------------------------------------------------------------------

function placeInfrastructureLayer(
  scene: Phaser.Scene,
  out: GameObjects.GameObject[],
  hashToken: (s: string) => number,
  salt: string,
  left: number,
  top: number,
  w: number,
  h: number,
): void {
  if (w < 30 || h < 20) return

  const right = left + w
  const bottom = top + h
  // Workstation exclusion zone
  const midTop = top + h * 0.2
  const midBot = top + h * 0.8

  // --- Cable runs along BOTTOM edge ---
  const cableY = bottom - 8
  {
    let cx = left + 4
    let ci = 0
    while (cx + 24 < right - 4 && ci < 10) {
      const cs = `${salt}|cable|${ci}`
      const frame = pickFrom(
        [LP.CABLE_PIECE_01, LP.CABLE_PIECE_02, LP.CABLE_PIECE_03, LP.CABLE_COVER, LP.CABLE_COVER_WITH_RAMP],
        hashToken, cs,
      )
      pushSprite(scene, out, hashToken, cs, {
        frame, x: cx, y: cableY, scale: 0.16 + (hashToken(`${cs}s`) % 3) * 0.01,
        depth: DEPTH_BACK + 0.01, alpha: 0.45 + (hashToken(`${cs}a`) % 3) * 0.04,
      })
      cx += 24 + hashToken(`${cs}gap`) % 6
      ci++
    }
  }

  // --- Pipe connectors along walls (skip mid zone) ---
  const pipeFrames = [
    LP.PIPE_CONNECTOR_ANGLED_TO_ANGLED, LP.PIPE_CONNECTOR_ANGLED_TO_SIDE,
    LP.PIPE_CONNECTOR_ARCHED, LP.PIPE_CONNECTOR_TO_ANGLE, LP.PIPE_CONNECTOR_TO_SIDE,
  ]
  for (let pi = 0; pi < Math.min(3, Math.floor(h / 36)); pi++) {
    const py = top + 6 + pi * 36
    if (py > midTop && py < midBot) continue // skip workstation zone
    const ps = `${salt}|pipeL|${pi}`
    if (hashToken(ps) % 3 === 0) continue
    pushSprite(scene, out, hashToken, ps, {
      frame: pickFrom(pipeFrames, hashToken, ps), x: left + 3, y: py,
      scale: 0.18, depth: DEPTH_BACK + 0.02, alpha: 0.50,
    })
  }
  for (let pi = 0; pi < Math.min(3, Math.floor(h / 36)); pi++) {
    const py = top + 14 + pi * 36
    if (py > midTop && py < midBot) continue
    const ps = `${salt}|pipeR|${pi}`
    if (hashToken(ps) % 3 === 0) continue
    pushSprite(scene, out, hashToken, ps, {
      frame: pickFrom(pipeFrames, hashToken, ps), x: right - 5, y: py,
      scale: 0.18, depth: DEPTH_BACK + 0.02, alpha: 0.50, flipX: true,
    })
  }

  // --- Floor blocks / panels — TOP and BOTTOM margins only ---
  const blockCount = Math.max(1, Math.floor((w * h) / 3200))
  for (let bi = 0; bi < blockCount; bi++) {
    const bs = `${salt}|blk|${bi}`
    const bx = left + 6 + (hashToken(`${bs}x`) % Math.max(1, w - 12))
    const by = top + 6 + (hashToken(`${bs}y`) % Math.max(1, h - 12))
    // Skip workstation zone
    if (by > midTop && by < midBot) continue
    const pool = [...INFRASTRUCTURE_FRAMES.slice(10), ...MISC_SMALL.slice(0, 4)]
    pushSprite(scene, out, hashToken, bs, {
      frame: pickFrom(pool, hashToken, bs), x: bx, y: by,
      scale: 0.13 + (hashToken(`${bs}s`) % 4) * 0.01,
      depth: DEPTH_BACK, alpha: 0.40 + (hashToken(`${bs}a`) % 4) * 0.04,
    })
  }
}

// ---------------------------------------------------------------------------
// Zone: Wall equipment strip — dense items along top/bottom/side walls
// ---------------------------------------------------------------------------

function placeWallEquipmentStrip(
  scene: Phaser.Scene,
  out: GameObjects.GameObject[],
  hashToken: (s: string) => number,
  salt: string,
  left: number,
  top: number,
  w: number,
  h: number,
): void {
  if (w < 30 || h < 20) return

  const right = left + w
  const bottom = top + h

  // --- Top wall: shelves with small items (wider spacing) ---
  const shelfStep = 56
  for (let si = 0; si < Math.floor(w / shelfStep); si++) {
    const sx = left + 6 + si * shelfStep
    if (sx + 20 > right) break
    const ss = `${salt}|shelf|${si}`
    if (hashToken(ss) % 3 === 0) continue
    pushSprite(scene, out, hashToken, ss, {
      frame: LP.SHELF, x: sx, y: top + 4, scale: 0.22,
      depth: DEPTH_MID - 0.01, alpha: 0.55,
    })
    const shelfItem = pickFrom([...MISC_SMALL, ...CHEMICAL_FRAMES.slice(4, 8)], hashToken, `${ss}item`)
    pushSprite(scene, out, hashToken, `${ss}|item`, {
      frame: shelfItem, x: sx + 4, y: top + 2, scale: 0.13,
      depth: DEPTH_MID, alpha: 0.50,
    })
  }

  // --- Bottom wall: equipment units (wider spacing) ---
  const botStep = 48
  for (let bi = 0; bi < Math.floor(w / botStep); bi++) {
    const bx = left + 8 + bi * botStep
    if (bx + 16 > right) break
    const bs = `${salt}|botEq|${bi}`
    if (hashToken(bs) % 3 === 0) continue
    const frame = pickFrom(MACHINERY_FRAMES.slice(7), hashToken, bs)
    pushSprite(scene, out, hashToken, bs, {
      frame, x: bx, y: bottom - 8, scale: 0.18,
      depth: DEPTH_MID - 0.02, alpha: 0.52,
    })
  }

  // --- Side walls: wall lights (wider spacing, skip mid zone) ---
  const midTop = top + h * 0.2
  const midBot = top + h * 0.8
  const sideStep = 38
  for (let si = 0; si < Math.floor(h / sideStep); si++) {
    const sy = top + 8 + si * sideStep
    if (sy + 8 > bottom) break
    if (sy > midTop && sy < midBot) continue // skip workstation zone
    const ls = `${salt}|wallL|${si}`
    if (hashToken(ls) % 3 !== 0) {
      pushSprite(scene, out, hashToken, ls, {
        frame: pickFrom([LP.WALL_LIGHT, LP.SPEAKER, LP.SPEAKER_02], hashToken, ls),
        x: left + 3, y: sy, scale: 0.14, depth: DEPTH_MID - 0.01, alpha: 0.50,
      })
    }
    const rs = `${salt}|wallR|${si}`
    if (hashToken(rs) % 3 !== 0) {
      pushSprite(scene, out, hashToken, rs, {
        frame: pickFrom([LP.WALL_LIGHT, LP.SPEAKER, LP.SPEAKER_02], hashToken, rs),
        x: right - 3, y: sy, scale: 0.14, depth: DEPTH_MID - 0.01, alpha: 0.50,
        flipX: true,
      })
    }
  }

  // --- Skylights on ceiling (top edge) ---
  const skylightFrames = [LP.NARROW_SKYLIGHT, LP.SMALL_SKYLIGHT, LP.LARGE_SKYLIGHT]
  if (w > 140) {
    for (let ski = 0; ski < Math.min(2, Math.floor(w / 64)); ski++) {
      const skx = left + 24 + ski * 60
      pushSprite(scene, out, hashToken, `${salt}|sky|${ski}`, {
        frame: pickFrom(skylightFrames, hashToken, `${salt}sky${ski}`),
        x: skx, y: top + 2, scale: 0.18, depth: DEPTH_BACK + 0.06, alpha: 0.48,
      })
    }
  }
}

// ---------------------------------------------------------------------------
// Composite: fill entire region with themed zones + infrastructure base
// ---------------------------------------------------------------------------

/**
 * Decides zone assignment for a region based on hash, then layers:
 *   1. Infrastructure floor (cables, pipes, blocks) — always
 *   2. Wall equipment strip — always
 *   3. Primary zone (control / chemical / machinery / pod) — hash-picked
 * This replaces the old purely-random placeDenseAssetField for themed regions.
 */
function placeThemedRegion(
  scene: Phaser.Scene,
  out: GameObjects.GameObject[],
  hashToken: (s: string) => number,
  salt: string,
  left: number,
  top: number,
  w: number,
  h: number,
  forceZone?: 'control' | 'chemical' | 'machinery' | 'pod',
): void {
  // Layer 1: infrastructure floor (always)
  placeInfrastructureLayer(scene, out, hashToken, `${salt}|infra`, left, top, w, h)

  // Layer 2: wall equipment strip (always)
  placeWallEquipmentStrip(scene, out, hashToken, `${salt}|wall`, left, top, w, h)

  // Layer 3: primary zone
  const zone = forceZone ?? (['control', 'chemical', 'machinery', 'pod'] as const)[hashToken(`${salt}|zone`) % 4]
  switch (zone) {
    case 'control':
      placeControlRoomZone(scene, out, hashToken, `${salt}|ctrl`, left, top, w, h)
      break
    case 'chemical':
      placeChemicalStationZone(scene, out, hashToken, `${salt}|chem`, left, top, w, h)
      break
    case 'machinery':
      placeMachineryZone(scene, out, hashToken, `${salt}|mach`, left, top, w, h)
      break
    case 'pod':
      placePodBayZone(scene, out, hashToken, `${salt}|podbay`, left, top, w, h)
      break
  }
}

// ---------------------------------------------------------------------------
// L-shaped control pits — console_example_* + blank_console_* + animated screens.
// (Preserved from original — used as hero overlay on main hall)
// ---------------------------------------------------------------------------

function placeConsolePits(
  scene: Phaser.Scene,
  out: GameObjects.GameObject[],
  hashToken: (s: string) => number,
  zSalt: string,
  zleft: number,
  zw: number,
  innerTop: number,
  innerH: number,
): void {
  // Place console pits in the TOP margin only (above workstations)
  const backY = innerTop + 4
  const pitY = innerTop + innerH * 0.14
  const step = 34

  const ax = zleft + Math.min(42, zw * 0.12)
  pushSprite(scene, out, hashToken, `${zSalt}|exCorner`, {
    frame: LP.CONSOLE_EXAMPLE_CORNER, x: ax, y: backY, scale: 0.32,
    depth: DEPTH_FORE, alpha: 0.65,
  })
  pushSprite(scene, out, hashToken, `${zSalt}|exLong`, {
    frame: LP.CONSOLE_EXAMPLE_LONG, x: ax + step, y: backY, scale: 0.30,
    depth: DEPTH_FORE, alpha: 0.62,
  })

  const waveOrLines = hashToken(zSalt) % 2 === 0 ? LAB_ANIM_KEYS.CONSOLE_WAVE : LAB_ANIM_KEYS.CONSOLE_LINES
  pushAnim(scene, out, hashToken, `${zSalt}|heroAnim`, waveOrLines, ax + step * 1.1, pitY, 0.28, DEPTH_HERO, 0.60)

  const bx = ax + step * 2.4
  if (bx + step < zleft + zw - 16) {
    pushSprite(scene, out, hashToken, `${zSalt}|blCorner`, {
      frame: LP.BLANK_CONSOLE_CORNER, x: bx, y: backY, scale: 0.30,
      depth: DEPTH_FORE, alpha: 0.58,
    })
    pushSprite(scene, out, hashToken, `${zSalt}|blLong`, {
      frame: LP.BLANK_CONSOLE_LONG, x: bx + step, y: backY, scale: 0.28,
      depth: DEPTH_FORE, alpha: 0.55,
    })
  }

  if (zw > 220) {
    const cx = zleft + zw * 0.55
    pushSprite(scene, out, hashToken, `${zSalt}|exCornerR`, {
      frame: LP.CONSOLE_EXAMPLE_CORNER, x: cx, y: backY, scale: 0.30,
      depth: DEPTH_FORE, alpha: 0.60,
    })
    pushAnim(scene, out, hashToken, `${zSalt}|animR`, LAB_ANIM_KEYS.CONSOLE_LINES, cx + step * 0.9, pitY + 4, 0.26, DEPTH_HERO, 0.55)
  }
}

/** Optional red beam — static LASER_BEAM stretched between outlets. */
function placeLaserAccent(
  scene: Phaser.Scene,
  out: GameObjects.GameObject[],
  hashToken: (s: string) => number,
  zSalt: string,
  zleft: number,
  zw: number,
  innerTop: number,
  innerH: number,
): void {
  if (hashToken(`${zSalt}|laser`) % 3 === 0) return
  const ly = innerTop + innerH * (0.25 + (hashToken(zSalt) % 5) * 0.08)
  const x0 = zleft + zw * 0.2
  const x1 = zleft + zw * 0.82
  out.push(
    scene.add
      .sprite(x0, ly, SPRITESHEET_KEYS.LAB_PROPS, LP.LASER_OUTLET)
      .setScale(0.16, 0.16)
      .setDepth(DEPTH_MID)
      .setAlpha(0.50),
  )
  out.push(
    scene.add
      .sprite(x1, ly, SPRITESHEET_KEYS.LAB_PROPS, LP.LASER_OUTLET)
      .setScale(-0.16, 0.16)
      .setDepth(DEPTH_MID)
      .setAlpha(0.50),
  )
  const beam = scene.add
    .sprite((x0 + x1) / 2, ly, SPRITESHEET_KEYS.LAB_PROPS, LP.LASER_BEAM)
    .setScale((x1 - x0) / 64, 0.10)
    .setDepth(DEPTH_MID + 0.01)
    .setAlpha(0.45)
  out.push(beam)
}

// ---------------------------------------------------------------------------
// Reference main hall hero — reactor + tank farm + console pit (original)
// Enhanced with themed zones filling spare space
// ---------------------------------------------------------------------------

function placeReferenceMainHero(
  scene: Phaser.Scene,
  out: GameObjects.GameObject[],
  hashToken: (s: string) => number,
  r: LabRegion,
  zSalt: string,
): void {
  const pad = 10
  const zleft = r.x + pad
  const zw = r.w - pad * 2
  const innerTop = r.y + pad
  const innerBottom = r.y + r.h - pad
  const innerH = Math.max(20, innerBottom - innerTop)
  if (zw < 80 || innerH < 40) return

  // Place hero elements in TOP margin only (above workstation zone)
  const heroY = innerTop + 10

  // Central dome (smaller, in top margin)
  const cx = r.x + r.w / 2
  pushSprite(scene, out, hashToken, `${zSalt}|dome`, {
    frame: LP.DOME, x: cx, y: heroY, scale: 0.35, depth: DEPTH_MID, alpha: 0.60,
  })
  pushSprite(scene, out, hashToken, `${zSalt}|labMac`, {
    frame: LP.LAB_MACHINE_01, x: cx + 4, y: heroY + 14, scale: 0.28,
    depth: DEPTH_MID - 0.02, alpha: 0.58,
  })

  // One tank on left side (top margin)
  const tx = zleft + 14
  pushSprite(scene, out, hashToken, `${zSalt}|t1`, {
    frame: LP.LARGE_TANK, x: tx, y: heroY,
    scale: 0.30, depth: DEPTH_FORE, alpha: 0.58,
  })

  // Right console cluster (top margin)
  const step = 32
  const rx = zleft + zw - 6
  const ry = innerTop + 6
  out.push(
    scene.add
      .sprite(rx, ry, SPRITESHEET_KEYS.LAB_PROPS, LP.CONSOLE_EXAMPLE_CORNER)
      .setScale(-0.32, 0.32)
      .setDepth(DEPTH_FORE)
      .setAlpha(0.62),
  )
  out.push(
    scene.add
      .sprite(rx - step, ry, SPRITESHEET_KEYS.LAB_PROPS, LP.CONSOLE_EXAMPLE_LONG)
      .setScale(-0.30, 0.30)
      .setDepth(DEPTH_FORE)
      .setAlpha(0.58),
  )
  const waveOrLines = hashToken(zSalt) % 2 === 0 ? LAB_ANIM_KEYS.CONSOLE_WAVE : LAB_ANIM_KEYS.CONSOLE_LINES
  const hA = hashToken(`aflip|${zSalt}|heroR`)
  const sprA = scene.add
    .sprite(rx - step * 1.05, ry + 20, SPRITESHEET_KEYS.LAB_PROPS)
    .setScale(0.28 * (hA % 6 === 0 ? -1 : 1), 0.28)
    .setDepth(DEPTH_HERO)
    .setAlpha(0.58)
  if (scene.anims.exists(waveOrLines)) sprA.play(waveOrLines)
  else sprA.setFrame(LP.CONSOLE_SCREEN)
  out.push(sprA)

  // Warning sign near dome
  pushSprite(scene, out, hashToken, `${zSalt}|warnDome`, {
    frame: LP.WARNING_POWER, x: cx + 18, y: heroY - 6, scale: 0.16,
    depth: DEPTH_FORE + 0.01, alpha: 0.55,
  })

  // LEDs along top edge
  for (let li = 0; li < Math.min(4, Math.floor(zw / 36)); li++) {
    pushSprite(scene, out, hashToken, `${zSalt}|ledTop|${li}`, {
      frame: hashToken(`${zSalt}ledT${li}`) % 3 === 0 ? LP.LED_OFF : LP.LED_ON,
      x: zleft + 12 + li * 34, y: innerTop + 2, scale: 0.12,
      depth: DEPTH_FORE, alpha: 0.50,
    })
  }
}

// ---------------------------------------------------------------------------
// Wing L: science office cluster (enhanced with chemical bench)
// ---------------------------------------------------------------------------

function placeWingLOfficeCluster(
  scene: Phaser.Scene,
  out: GameObjects.GameObject[],
  hashToken: (s: string) => number,
  r: LabRegion,
  zSalt: string,
  splitBottom: boolean,
): void {
  const pad = 8
  const zleft = r.x + pad
  const zw = r.w - pad * 2
  const innerTop = r.y + pad
  const innerBottom = r.y + r.h - pad
  const innerH = innerBottom - innerTop
  if (zw < 36 || innerH < 28) return

  // Themed fill: chemical station zone
  placeThemedRegion(scene, out, hashToken, `${zSalt}|wlTheme`, zleft, innerTop, zw, innerH, 'chemical')

  // Hero desk + microscope in TOP margin only
  const cx = r.x + r.w * 0.48
  const cy = innerTop + 10
  pushSprite(scene, out, hashToken, `${zSalt}|wlMicro`, {
    frame: LP.MICROSCOPE, x: cx + 14, y: cy, scale: 0.28,
    depth: DEPTH_HERO, alpha: 0.60,
  })
  pushSprite(scene, out, hashToken, `${zSalt}|wlMon`, {
    frame: LP.MONITOR, x: cx - 18, y: cy + 4, scale: 0.24,
    depth: DEPTH_FORE, alpha: 0.55,
  })
}

// ---------------------------------------------------------------------------
// Wing R: heavy equipment / utility (enhanced with machinery zone)
// ---------------------------------------------------------------------------

function placeWingRUtilityCluster(
  scene: Phaser.Scene,
  out: GameObjects.GameObject[],
  hashToken: (s: string) => number,
  r: LabRegion,
  zSalt: string,
): void {
  const pad = 8
  const zleft = r.x + pad
  const zw = r.w - pad * 2
  const innerTop = r.y + pad
  const innerBottom = r.y + r.h - pad
  const innerH = innerBottom - innerTop
  if (zw < 36 || innerH < 28) return

  // Themed fill: machinery zone
  placeThemedRegion(scene, out, hashToken, `${zSalt}|wrTheme`, zleft, innerTop, zw, innerH, 'machinery')

  // Hero equipment in TOP margin only
  const ix = zleft + zw * 0.48
  const iy = innerTop + 10
  pushSprite(scene, out, hashToken, `${zSalt}|wrUnit`, {
    frame: LP.UNIT_LARGE, x: ix - 18, y: iy, scale: 0.30,
    depth: DEPTH_FORE, alpha: 0.60,
  })
  pushSprite(scene, out, hashToken, `${zSalt}|wrGen`, {
    frame: LP.GENERATOR, x: ix + 20, y: iy + 4, scale: 0.28,
    depth: DEPTH_FORE, alpha: 0.58,
  })
  // Vent in BOTTOM margin
  pushSprite(scene, out, hashToken, `${zSalt}|wrVent`, {
    frame: LP.SUNKEN_VENT, x: zleft + 12, y: innerBottom - 10, scale: 0.24,
    depth: DEPTH_BACK + 0.04, alpha: 0.48,
  })
}

// ---------------------------------------------------------------------------
// Edge strip — top/bottom/side equipment rails (enhanced density)
// ---------------------------------------------------------------------------

function placeEdgeStrip(
  scene: Phaser.Scene,
  out: GameObjects.GameObject[],
  hashToken: (s: string) => number,
  zSalt: string,
  zleft: number,
  zw: number,
  innerTop: number,
  innerBottom: number,
): void {
  const step = 28
  let i = 0
  for (let px = zleft + 4; px < zleft + zw - 4; px += step) {
    const saltT = `et|${zSalt}|${i}`
    const saltB = `eb|${zSalt}|${i}`
    const hT = hashToken(saltT)
    const hB = hashToken(saltB)
    // Top edge — 50% fill rate
    if (hT % 2 !== 0) {
      const f = pickAny(hashToken, saltT)
      const flipX = hT % 5 === 0 ? -1 : 1
      const sc = 0.14 + (hT % 6) * 0.012
      out.push(
        scene.add
          .sprite(px, innerTop + 4 + (hT % 4), SPRITESHEET_KEYS.LAB_PROPS, f)
          .setScale(sc * flipX, sc)
          .setDepth(DEPTH_MID - 0.03)
          .setAlpha(0.52),
      )
    }
    // Bottom edge — 50% fill rate
    if (hB % 2 !== 0) {
      const f = pickAny(hashToken, saltB)
      const flipX = hB % 5 === 0 ? -1 : 1
      const sc = 0.13 + (hB % 6) * 0.012
      out.push(
        scene.add
          .sprite(px, innerBottom - 10 - (hB % 5), SPRITESHEET_KEYS.LAB_PROPS, f)
          .setScale(sc * flipX, sc)
          .setDepth(DEPTH_MID - 0.03)
          .setAlpha(0.48),
      )
    }
    i++
  }

  // Side strips — wider spacing, skip workstation mid zone
  const midTop = innerTop + (innerBottom - innerTop) * 0.2
  const midBot = innerTop + (innerBottom - innerTop) * 0.8
  for (let py = innerTop + 18; py < innerBottom - 18; py += 32) {
    if (py > midTop && py < midBot) continue // skip workstation zone
    const saltL = `sl|${zSalt}|${py}`
    const saltR = `sr|${zSalt}|${py}`
    const fL = pickAny(hashToken, saltL)
    const fR = pickAny(hashToken, saltR)
    const hL = hashToken(saltL)
    const hR = hashToken(saltR)
    if (hL % 3 !== 0) {
      out.push(
        scene.add
          .sprite(zleft + 5, py, SPRITESHEET_KEYS.LAB_PROPS, fL)
          .setScale((0.13 + (hL % 5) * 0.01) * (hL % 7 === 0 ? -1 : 1), 0.13 + (hL % 5) * 0.01)
          .setDepth(DEPTH_MID)
          .setAlpha(0.48),
      )
    }
    if (hR % 3 !== 0) {
      out.push(
        scene.add
          .sprite(zleft + zw - 5, py, SPRITESHEET_KEYS.LAB_PROPS, fR)
          .setScale((0.13 + (hR % 5) * 0.01) * (hR % 8 === 0 ? -1 : 1), 0.13 + (hR % 5) * 0.01)
          .setDepth(DEPTH_MID)
          .setAlpha(0.48),
      )
    }
  }
}

// ---------------------------------------------------------------------------
// Dense asset field — tight staggered grids (kept for fallback fill)
// Now uses themed frame pools instead of purely random
// ---------------------------------------------------------------------------

type DenseFieldOpts = { maxDense?: number; maxMid?: number; skipSecondGrid?: boolean }

function placeDenseAssetField(
  scene: Phaser.Scene,
  out: GameObjects.GameObject[],
  hashToken: (s: string) => number,
  zSalt: string,
  zleft: number,
  zw: number,
  innerTop: number,
  innerBottom: number,
  opts?: DenseFieldOpts,
): void {
  const bandH = innerBottom - innerTop
  const cellW = zw > 480 ? 44 : zw > 320 ? 38 : 34
  const cellH = bandH > 200 ? 38 : bandH > 140 ? 34 : 30
  let idx = 0
  let placed = 0
  const maxDense = opts?.maxDense ?? 200
  // Workstation exclusion: central 60% of height
  const midTop = innerTop + bandH * 0.2
  const midBot = innerTop + bandH * 0.8

  const pushAt = (px: number, py: number, salt: string, depth: number, scaleMul: number): void => {
    if (placed >= maxDense) return
    // Skip workstation zone — only place in top/bottom margins
    if (py > midTop && py < midBot) return
    const h0 = hashToken(salt)
    if (h0 % 14 === 0) return
    const frame = ALL_STATIC_FRAMES[(idx + h0) % ALL_STATIC_FRAMES.length]!
    idx++
    const flipX = h0 % 7 === 0 ? -1 : 1
    const sc = (0.10 + (h0 % 9) * 0.012) * scaleMul
    const al = 0.38 + (h0 % 5) * 0.05
    out.push(
      scene.add
        .sprite(px, py, SPRITESHEET_KEYS.LAB_PROPS, frame)
        .setScale(sc * flipX, sc)
        .setDepth(depth)
        .setAlpha(Math.min(al, 0.65)),
    )
    placed++
  }

  // Grid A only (no second grid — removed for density reduction)
  for (let py = innerTop + 12; py < innerBottom - 14; py += cellH) {
    for (let px = zleft + 8; px < zleft + zw - 8; px += cellW) {
      pushAt(px + (py % (cellH * 2)) * 0.08, py, `dA|${zSalt}|${px}|${py}`, DEPTH_BACK, 1)
    }
  }

  // Mid layer — coarser grid, only in margins
  const midW = zw > 480 ? 56 : 48
  const midCH = bandH > 200 ? 52 : 44
  let midIdx = Math.floor(ALL_STATIC_FRAMES.length / 3)
  let midPlaced = 0
  const maxMid = opts?.maxMid ?? 60
  for (let py = innerTop + 18; py < innerBottom - 20 && midPlaced < maxMid; py += midCH) {
    if (py > midTop && py < midBot) continue // skip workstation zone
    for (let px = zleft + 14; px < zleft + zw - 14 && midPlaced < maxMid; px += midW) {
      const salt = `mid|${zSalt}|${px}|${py}`
      const h0 = hashToken(salt)
      if (h0 % 5 === 0) continue
      const frame = ALL_STATIC_FRAMES[(midIdx + h0) % ALL_STATIC_FRAMES.length]!
      midIdx += 3
      const flipX = h0 % 6 === 0 ? -1 : 1
      const sc = 0.15 + (h0 % 7) * 0.015
      out.push(
        scene.add
          .sprite(px, py, SPRITESHEET_KEYS.LAB_PROPS, frame)
          .setScale(sc * flipX, sc)
          .setDepth(DEPTH_MID)
          .setAlpha(0.42 + (h0 % 4) * 0.05),
      )
      midPlaced++
    }
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

    const fillRegion = (r: LabRegion, key: string, denseMax: number, midMax: number): void => {
      const pad = 8
      const zl = r.x + pad
      const zw = Math.max(0, r.w - pad * 2)
      if (zw < 24) return
      const innerTopR = r.y + pad
      const innerBottomR = r.y + r.h - pad
      // Dense background field
      placeDenseAssetField(scene, out, hashToken, `${salt}|${key}`, zl, zw, innerTopR, innerBottomR, {
        maxDense: denseMax,
        maxMid: midMax,
        skipSecondGrid: true,
      })
      // Edge strips
      placeEdgeStrip(scene, out, hashToken, `${salt}|${key}|e`, zl, zw, innerTopR, innerBottomR)
      // NEW: themed zone overlay for each region
      const innerH = innerBottomR - innerTopR
      if (zw > 40 && innerH > 30) {
        placeThemedRegion(scene, out, hashToken, `${salt}|${key}|zone`, zl, innerTopR, zw, innerH)
      }
    }

    fillRegion(main, 'main', 80, 20)
    const mpad = 10
    const mzleft = main.x + mpad
    const mzw = Math.max(0, main.w - mpad * 2)
    const mTop = main.y + mpad
    const mBot = main.y + main.h - mpad
    const mH = Math.max(28, mBot - mTop)
    if (mzw > 140) {
      placeLaserAccent(scene, out, hashToken, `${salt}|main`, mzleft, mzw, mTop, mH)
    }
    placeReferenceMainHero(scene, out, hashToken, main, salt)

    if (wingL) {
      fillRegion(wingL, 'wl', wingR ? 40 : 50, 12)
      placeWingLOfficeCluster(scene, out, hashToken, wingL, salt, !!wingR)
    }
    if (wingR) {
      fillRegion(wingR, 'wr', 40, 12)
      placeWingRUtilityCluster(scene, out, hashToken, wingR, salt)
    }
    return
  }

  // --- Single-rectangle fallback (no L-shaped footprint) ---
  const innerTop = y + bannerH + 6
  const innerBottom = y + height - 10
  const innerH = Math.max(28, innerBottom - innerTop)

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
    const bandH = innerBottom - innerTop

    // Back → fore: dense fields first, then strips, themed zones, laser, then console pits on top.
    placeDenseAssetField(scene, out, hashToken, zSalt, zleft, zw, innerTop, innerBottom)
    placeEdgeStrip(scene, out, hashToken, zSalt, zleft, zw, innerTop, innerBottom)
    // NEW: themed zone overlay
    if (zw > 50 && bandH > 36) {
      placeThemedRegion(scene, out, hashToken, `${zSalt}|zone`, zleft, innerTop, zw, bandH)
    }
    if (zw > 140) {
      placeLaserAccent(scene, out, hashToken, zSalt, zleft, zw, innerTop, innerH)
    }
    placeConsolePits(scene, out, hashToken, zSalt, zleft, zw, innerTop, innerH)
  }
}
