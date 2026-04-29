// ---------------------------------------------------------------------------
// lab-tilemap.ts
// Room rendering using the full lab kit: NineSlice room backgrounds (fill+top),
// smooth floor panels, detailed pipe runs, floor glows, wall decorations,
// and dense room props.
// ---------------------------------------------------------------------------

import Phaser from 'phaser'
import { LAB_IMAGE_KEYS, SPRITESHEET_KEYS } from './office-asset-keys'
import { LAB_TILE_SIZE } from './office-constants'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TILE_SCALE = 0.375
const CELL = LAB_TILE_SIZE * TILE_SCALE  // 48px

// NineSlice source — large room in tileset_fill.png (top-left)
const TILESET_FILL = 'lab-tileset-fill'
const TILESET_TOP = 'lab-tileset-top'
const SMOOTH_KEY = 'lab-smooth-tileset'
const PIPE_KEY = 'lab-pipe-tileset'
const ROOM_FRAME = 'room-bg'
const ROOM_TOP_FRAME = 'room-top'
const ROOM_SRC = { x: 6, y: 6, w: 450, h: 390 }
const BORDER = 45          // source px for NineSlice corner/edge
const WALL_SCALE = 0.45    // scale NineSlice so borders are ~20px display (45*0.45≈20)
const WALL_PAD = 12        // extra world-px around room for the visible wall

// Smooth tileset frames (896×896 source)
const SMOOTH_FRAMES = {
  LARGE_PANEL:  { name: 'sm-large',  x: 18, y: 18,  w: 396, h: 336 },
  FOUR_BOLT:    { name: 'sm-4bolt',  x: 530, y: 530, w: 256, h: 256 },
  SMALL_PANEL:  { name: 'sm-small',  x: 180, y: 498, w: 195, h: 210 },
  HORIZ_BAR:    { name: 'sm-hbar',   x: 18, y: 378,  w: 310, h: 78 },
}

// Pipe tileset frames (896×640 source) — key individual pieces
const PIPE_FRAMES = {
  H_STRAIGHT:   { name: 'pt-h',     x: 370, y: 5,   w: 175, h: 64 },
  V_STRAIGHT:   { name: 'pt-v',     x: 500, y: 90,  w: 64, h: 175 },
  CORNER_TL:    { name: 'pt-ctl',   x: 5, y: 5,     w: 128, h: 128 },
  CORNER_TR:    { name: 'pt-ctr',   x: 242, y: 5,   w: 128, h: 128 },
  CORNER_BL:    { name: 'pt-cbl',   x: 5, y: 210,   w: 128, h: 128 },
  CORNER_BR:    { name: 'pt-cbr',   x: 135, y: 210,  w: 128, h: 128 },
  T_DOWN:       { name: 'pt-td',    x: 580, y: 5,   w: 128, h: 128 },
  T_RIGHT:      { name: 'pt-tr',    x: 710, y: 5,   w: 128, h: 128 },
  CROSS:        { name: 'pt-cross', x: 135, y: 100,  w: 100, h: 100 },
  VALVE:        { name: 'pt-valve', x: 370, y: 200,  w: 100, h: 100 },
  CAP:          { name: 'pt-cap',   x: 5, y: 350,    w: 64, h: 50 },
  COUPLING:     { name: 'pt-coup',  x: 100, y: 350,  w: 80, h: 70 },
  BROKEN:       { name: 'pt-broken', x: 5, y: 470,   w: 200, h: 64 },
}

// Hazard tape for interior dividers
const TAPE_SEG = 8
const TAPE_YELLOW = 0xfbbf24
const TAPE_DARK = 0x1a1a2e

// ---------------------------------------------------------------------------
// Room rect
// ---------------------------------------------------------------------------

export interface FacilityRoom {
  x: number; y: number; width: number; height: number
  cwd: string
  deskPositions?: { x: number; y: number }[]
}

// ---------------------------------------------------------------------------
// LabTilemap
// ---------------------------------------------------------------------------

export class LabTilemap {
  private scene: Phaser.Scene
  private objects: Phaser.GameObjects.GameObject[] = []
  private lastRenderKey = ''
  private framesAdded = false

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  // -------------------------------------------------------------------------
  // render
  // -------------------------------------------------------------------------

  render(rooms: FacilityRoom[]): void {
    const key = rooms.map(r => `${r.cwd}:${r.x|0},${r.y|0},${r.width|0},${r.height|0}`).join('|')
    if (key === this.lastRenderKey && this.objects.length > 0) return
    this.lastRenderKey = key
    this.cleanup()
    if (rooms.length === 0) return
    this.ensureFrames()

    const hash = Math.abs(Math.floor(rooms[0].x * 7 + rooms[0].y * 13)) | 0

    // Layer 1: Room backgrounds (NineSlice fill + top)
    this.placeRoomBackgrounds(rooms)
    // Layer 2: Smooth floor panels inside rooms
    this.placeSmoothPanels(rooms, hash)
    // Layer 3: Interior dividers between rooms
    this.drawInteriorDividers(rooms)
    // Layer 4: Floor glow lights
    this.drawFloorGlows(rooms)
    // Layer 5: Exterior pipe runs (detailed tileset pipes)
    this.drawExteriorPipes(rooms)
    // Layer 6: Room props — dense equipment placement
    this.decorateRooms(rooms, hash)
    // Layer 7: Wall-mounted decorations
    this.decorateWalls(rooms, hash)
  }

  // -------------------------------------------------------------------------
  // Frame registration
  // -------------------------------------------------------------------------

  private ensureFrames(): void {
    if (this.framesAdded) return
    this.framesAdded = true

    // Room background frames
    for (const [key, frame] of [[TILESET_FILL, ROOM_FRAME], [TILESET_TOP, ROOM_TOP_FRAME]] as const) {
      if (this.scene.textures.exists(key)) {
        const tex = this.scene.textures.get(key)
        if (!tex.has(frame)) tex.add(frame, 0, ROOM_SRC.x, ROOM_SRC.y, ROOM_SRC.w, ROOM_SRC.h)
      }
    }

    // Smooth tileset frames
    if (this.scene.textures.exists(SMOOTH_KEY)) {
      const tex = this.scene.textures.get(SMOOTH_KEY)
      for (const f of Object.values(SMOOTH_FRAMES)) {
        if (!tex.has(f.name)) tex.add(f.name, 0, f.x, f.y, f.w, f.h)
      }
    }

    // Pipe tileset frames
    if (this.scene.textures.exists(PIPE_KEY)) {
      const tex = this.scene.textures.get(PIPE_KEY)
      for (const f of Object.values(PIPE_FRAMES)) {
        if (!tex.has(f.name)) tex.add(f.name, 0, f.x, f.y, f.w, f.h)
      }
    }
  }

  // -------------------------------------------------------------------------
  // Room backgrounds — NineSlice fill + top overlay
  // -------------------------------------------------------------------------

  private placeRoomBackgrounds(rooms: FacilityRoom[]): void {
    const hasFill = this.scene.textures.exists(TILESET_FILL)
    const hasTop = this.scene.textures.exists(TILESET_TOP)
    if (!hasFill && !hasTop) return

    for (const room of rooms) {
      // Logical NineSlice size (before scaling) — divide by WALL_SCALE
      // so that after scaling, the display size = room + wallPad
      const displayW = room.width + WALL_PAD * 2
      const displayH = room.height + WALL_PAD * 2
      const logicalW = displayW / WALL_SCALE
      const logicalH = displayH / WALL_SCALE

      if (hasFill) {
        const ns = this.scene.add.nineslice(
          room.x, room.y, TILESET_FILL, ROOM_FRAME,
          logicalW, logicalH, BORDER, BORDER, BORDER, BORDER,
        ).setOrigin(0.5).setScale(WALL_SCALE).setDepth(-3)
        this.objects.push(ns)
      }

      if (hasTop) {
        const nsTop = this.scene.add.nineslice(
          room.x, room.y, TILESET_TOP, ROOM_TOP_FRAME,
          logicalW, logicalH, BORDER, BORDER, BORDER, BORDER,
        ).setOrigin(0.5).setScale(WALL_SCALE).setDepth(-2.9).setAlpha(0.85)
        this.objects.push(nsTop)
      }
    }
  }

  // -------------------------------------------------------------------------
  // Smooth floor panels — accent zones inside rooms
  // -------------------------------------------------------------------------

  private placeSmoothPanels(rooms: FacilityRoom[], hash: number): void {
    if (!this.scene.textures.exists(SMOOTH_KEY)) return

    const panelChoices = [
      SMOOTH_FRAMES.LARGE_PANEL,
      SMOOTH_FRAMES.FOUR_BOLT,
      SMOOTH_FRAMES.SMALL_PANEL,
    ]

    for (let ri = 0; ri < rooms.length; ri++) {
      const room = rooms[ri]
      const panel = panelChoices[ri % panelChoices.length]

      // Scale panel to fit ~60% of room interior
      const targetW = room.width * 0.55
      const targetH = room.height * 0.45
      const scaleX = targetW / panel.w
      const scaleY = targetH / panel.h
      const s = Math.min(scaleX, scaleY, 0.45) // cap to avoid oversized

      const spr = this.scene.add.sprite(room.x, room.y + 10, SMOOTH_KEY, panel.name)
        .setScale(s).setAlpha(0.18).setDepth(-2.85)
      this.objects.push(spr)

      // Horizontal bar accent near bottom of room
      if (room.width > 200) {
        const bar = this.scene.add.sprite(room.x, room.y + room.height * 0.35, SMOOTH_KEY, SMOOTH_FRAMES.HORIZ_BAR.name)
          .setScale(s * 0.8).setAlpha(0.12).setDepth(-2.85)
        this.objects.push(bar)
      }
    }
  }

  // -------------------------------------------------------------------------
  // Interior dividers
  // -------------------------------------------------------------------------

  private drawInteriorDividers(rooms: FacilityRoom[]): void {
    if (rooms.length < 2) return

    const g = this.scene.add.graphics().setDepth(-2.4)
    this.objects.push(g)

    const WALL_COLOR = 0x1a2744, WALL_W = 16, DOOR_GAP = 48, TAPE_W = 5
    const rowGroups = this.groupRoomsByRow(rooms)

    // Vertical dividers
    for (const row of rowGroups) {
      for (let i = 0; i < row.length - 1; i++) {
        const a = row[i], b = row[i + 1]
        const divX = (a.x + a.width / 2 + b.x - b.width / 2) / 2
        const topY = Math.min(a.y - a.height / 2, b.y - b.height / 2) - WALL_PAD
        const botY = Math.max(a.y + a.height / 2, b.y + b.height / 2) + WALL_PAD
        const midY = (topY + botY) / 2

        for (const [sy, sh] of [[topY, midY - DOOR_GAP / 2 - topY], [midY + DOOR_GAP / 2, botY - midY - DOOR_GAP / 2]]) {
          if (sh > 0) {
            g.fillStyle(WALL_COLOR, 1)
            g.fillRect(divX - WALL_W / 2, sy, WALL_W, sh)
            this.drawTape(g, divX - WALL_W / 2, sy, TAPE_W, sh, false)
            this.drawTape(g, divX + WALL_W / 2 - TAPE_W, sy, TAPE_W, sh, false)
          }
        }
      }
    }

    // Horizontal dividers
    for (let gi = 0; gi < rowGroups.length - 1; gi++) {
      const topRow = rowGroups[gi], botRow = rowGroups[gi + 1]
      let topEdge = -Infinity, botEdge = Infinity
      for (const r of topRow) topEdge = Math.max(topEdge, r.y + r.height / 2)
      for (const r of botRow) botEdge = Math.min(botEdge, r.y - r.height / 2)
      const divY = (topEdge + botEdge) / 2

      let leftX = Infinity, rightX = -Infinity
      for (const r of [...topRow, ...botRow]) {
        leftX = Math.min(leftX, r.x - r.width / 2); rightX = Math.max(rightX, r.x + r.width / 2)
      }
      leftX -= WALL_PAD; rightX += WALL_PAD
      const midX = (leftX + rightX) / 2

      for (const [sx, sw] of [[leftX, midX - DOOR_GAP / 2 - leftX], [midX + DOOR_GAP / 2, rightX - midX - DOOR_GAP / 2]]) {
        if (sw > 0) {
          g.fillStyle(WALL_COLOR, 1)
          g.fillRect(sx, divY - WALL_W / 2, sw, WALL_W)
          this.drawTape(g, sx, divY - WALL_W / 2, sw, TAPE_W, true)
          this.drawTape(g, sx, divY + WALL_W / 2 - TAPE_W, sw, TAPE_W, true)
        }
      }
    }
  }

  private drawTape(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, horiz: boolean): void {
    const len = horiz ? w : h
    let pos = 0, yellow = true
    while (pos < len) {
      const seg = Math.min(TAPE_SEG, len - pos)
      g.fillStyle(yellow ? TAPE_YELLOW : TAPE_DARK, yellow ? 0.75 : 0.55)
      if (horiz) g.fillRect(x + pos, y, seg, h); else g.fillRect(x, y + pos, w, seg)
      pos += TAPE_SEG; yellow = !yellow
    }
  }

  // -------------------------------------------------------------------------
  // Floor glow lights
  // -------------------------------------------------------------------------

  private drawFloorGlows(rooms: FacilityRoom[]): void {
    const g = this.scene.add.graphics().setDepth(-2.8)
    this.objects.push(g)

    const glow = (x: number, y: number, s = 1.0) => {
      g.fillStyle(0x38bdf8, 0.12 * s); g.fillCircle(x, y, 32 * s)
      g.fillStyle(0x22d3ee, 0.25 * s); g.fillCircle(x, y, 16 * s)
      g.fillStyle(0x7dd3fc, 0.40 * s); g.fillCircle(x, y, 6 * s)
    }

    for (const room of rooms) {
      const L = room.x - room.width / 2, T = room.y - room.height / 2
      const R = room.x + room.width / 2, B = room.y + room.height / 2
      const i = 35
      glow(L + i, T + i, 0.8); glow(R - i, T + i, 0.8)
      glow(L + i, B - i, 0.8); glow(R - i, B - i, 0.8)
      if (room.width > 200) { glow(room.x, T + i, 0.9); glow(room.x, B - i, 0.9) }
    }
  }

  // -------------------------------------------------------------------------
  // Exterior pipes — detailed tileset pieces
  // -------------------------------------------------------------------------

  private drawExteriorPipes(rooms: FacilityRoom[]): void {
    if (rooms.length === 0) return
    const hasPipeTileset = this.scene.textures.exists(PIPE_KEY)

    // Facility bounding box
    let fMinX = Infinity, fMinY = Infinity, fMaxX = -Infinity, fMaxY = -Infinity
    for (const r of rooms) {
      fMinX = Math.min(fMinX, r.x - r.width / 2 - WALL_PAD)
      fMinY = Math.min(fMinY, r.y - r.height / 2 - WALL_PAD)
      fMaxX = Math.max(fMaxX, r.x + r.width / 2 + WALL_PAD)
      fMaxY = Math.max(fMaxY, r.y + r.height / 2 + WALL_PAD)
    }

    const off = CELL * 0.6
    const topY = fMinY - off, botY = fMaxY + off
    const leftX = fMinX - off, rightX = fMaxX + off
    const S = 0.28 // pipe display scale — proportional to room size

    if (hasPipeTileset) {
      // Use detailed pipe tileset pieces
      const place = (x: number, y: number, frame: string, angle = 0, alpha = 0.75) => {
        const spr = this.scene.add.sprite(x, y, PIPE_KEY, frame)
          .setScale(S).setAlpha(alpha).setDepth(-3.5).setAngle(angle)
        this.objects.push(spr)
      }

      const spacing = CELL * 1.1
      const hStart = leftX + CELL * 1.2, hEnd = rightX - CELL * 1.2
      const numH = Math.max(0, Math.floor((hEnd - hStart) / spacing))

      // Top + bottom horizontal runs
      for (let i = 0; i < numH; i++) {
        const px = hStart + i * spacing
        place(px, topY, PIPE_FRAMES.H_STRAIGHT.name)
        place(px, botY, PIPE_FRAMES.H_STRAIGHT.name)
      }

      // Corners
      place(hStart - CELL * 0.6, topY, PIPE_FRAMES.CORNER_TL.name)
      place(hEnd + CELL * 0.6, topY, PIPE_FRAMES.CORNER_TR.name)
      place(hStart - CELL * 0.6, botY, PIPE_FRAMES.CORNER_BL.name)
      place(hEnd + CELL * 0.6, botY, PIPE_FRAMES.CORNER_BR.name)

      // Left + right vertical runs
      const vStart = topY + CELL * 0.7, vEnd = botY - CELL * 0.7
      const numV = Math.max(0, Math.floor((vEnd - vStart) / spacing))
      for (let i = 0; i < numV; i++) {
        const py = vStart + i * spacing
        place(leftX, py, PIPE_FRAMES.V_STRAIGHT.name)
        place(rightX, py, PIPE_FRAMES.V_STRAIGHT.name)
      }

      // T-junctions at room boundaries along top pipe
      if (numH > 3) {
        place(hStart + Math.floor(numH * 0.33) * spacing, topY, PIPE_FRAMES.T_DOWN.name)
        place(hStart + Math.floor(numH * 0.66) * spacing, topY, PIPE_FRAMES.T_DOWN.name)
      }

      // Valves
      if (numH > 2) place(hStart + Math.floor(numH * 0.5) * spacing, botY, PIPE_FRAMES.VALVE.name)
      if (numV > 2) place(leftX, vStart + Math.floor(numV * 0.5) * spacing, PIPE_FRAMES.VALVE.name)

      // Broken pipe accent on right side
      if (numV > 3) {
        place(rightX, vEnd - spacing, PIPE_FRAMES.BROKEN.name, 90, 0.55)
      }

      // Couplings between pipes
      if (numV > 1) {
        place(rightX, vStart + spacing * 0.5, PIPE_FRAMES.COUPLING.name, 90, 0.65)
      }

    } else {
      // Fallback to individual pipe images
      const place = (x: number, y: number, imgKey: string) => {
        const spr = this.scene.add.image(x, y, imgKey)
          .setScale(TILE_SCALE * 0.9).setAlpha(0.65).setDepth(-3.5)
        this.objects.push(spr)
      }
      const spacing = CELL * 0.9
      const hStart = leftX + CELL, hEnd = rightX - CELL
      const numH = Math.max(0, Math.floor((hEnd - hStart) / spacing))
      for (let i = 0; i < numH; i++) {
        place(hStart + i * spacing, topY, LAB_IMAGE_KEYS.PIPE_H)
        place(hStart + i * spacing, botY, LAB_IMAGE_KEYS.PIPE_H)
      }
      place(hStart - CELL * 0.4, topY, LAB_IMAGE_KEYS.PIPE_CORNER_TL)
      place(hEnd + CELL * 0.4, topY, LAB_IMAGE_KEYS.PIPE_CORNER_TR)
      place(hStart - CELL * 0.4, botY, LAB_IMAGE_KEYS.PIPE_CORNER_BL)
      place(hEnd + CELL * 0.4, botY, LAB_IMAGE_KEYS.PIPE_CORNER_BR)
      const vStart = topY + CELL * 0.5, vEnd = botY - CELL * 0.5
      const numV = Math.max(0, Math.floor((vEnd - vStart) / spacing))
      for (let i = 0; i < numV; i++) {
        place(leftX, vStart + i * spacing, LAB_IMAGE_KEYS.PIPE_V)
        place(rightX, vStart + i * spacing, LAB_IMAGE_KEYS.PIPE_V)
      }
    }
  }

  // -------------------------------------------------------------------------
  // Room props — dense equipment from 135+ lab prop frames
  // -------------------------------------------------------------------------

  private decorateRooms(rooms: FacilityRoom[], hash: number): void {
    if (!this.scene.textures.exists(SPRITESHEET_KEYS.LAB_PROPS)) return
    const LP = SPRITESHEET_KEYS.LAB_PROPS

    // Desk collision avoidance
    const DESK_CLEAR = 70
    const allDesks: { x: number; y: number }[] = []
    for (const r of rooms) {
      if (!r.deskPositions) continue
      for (const d of r.deskPositions) allDesks.push({ x: r.x + d.x, y: r.y + d.y })
    }
    const nearDesk = (wx: number, wy: number) =>
      allDesks.some(d => Math.abs(d.x - wx) < DESK_CLEAR && Math.abs(d.y - wy) < DESK_CLEAR)

    const place = (wx: number, wy: number, frame: string, alpha = 0.88, depth = -2, angle = 0): Phaser.GameObjects.Sprite | null => {
      if (nearDesk(wx, wy)) return null
      const spr = this.scene.add.sprite(wx, wy, LP, frame)
        .setScale(TILE_SCALE).setAlpha(alpha).setDepth(depth).setAngle(angle)
      this.objects.push(spr)
      return spr
    }

    // Room theme kits — each defines corner anchors and equipment
    const themes = [
      { tl: 'generator', tr: 'large_tank', console: 'blank_console_long', screen: 'console_screen_wave_01',
        bl: 'cable_cover', br: 'power_cell', mid: 'free_standing_screen', extra: ['gas_valve_on', 'switch_up'] },
      { tl: 'pod', tr: 'lab_machine_01', console: 'blank_console_long', screen: 'console_screen_lines_02',
        bl: 'unit_small', br: 'block_01', mid: 'dome', extra: ['circular_sink', 'beaker'] },
      { tl: 'console_example_corner', tr: 'unit_example_03', console: 'console_example_long', screen: 'console_screen_wave_03',
        bl: 'cable_cover_with_ramp', br: 'block_05', mid: 'unit_large', extra: ['gas_valve_off', 'test_tube_holder'] },
      { tl: 'unit_example_01', tr: 'unit_example_04', console: 'console_example_long', screen: 'console_screen_lines_04',
        bl: 'octogon_plate', br: 'block_03', mid: 'unit_example_02', extra: ['petri_dish', 'small_apparatus'] },
    ]

    // Small scatter items for floor edges
    const scatterItems = [
      'beaker', 'conical_beaker', 'test_tube_holder', 'petri_dish', 'small_apparatus',
      'tablet', 'cup', 'clipboard', 'pencil', 'desk_draw', 'tube',
    ]

    for (let ri = 0; ri < rooms.length; ri++) {
      const room = rooms[ri], t = themes[ri % themes.length]
      const L = room.x - room.width / 2, T = room.y - room.height / 2
      const R = room.x + room.width / 2, B = room.y + room.height / 2

      // Top-left corner — large equipment
      const tlSpr = place(L + 30, T + 45, t.tl, 0.88, -2.2, 270)
      if (tlSpr) tlSpr.setOrigin(0, 0)

      // Top-right corner — large equipment
      const trSpr = place(R - 6, T - 30, t.tr, 0.88, -2.2)
      if (trSpr) trSpr.setOrigin(1, 0)

      // Top wall center — console + screen
      const consoleSpr = place(room.x, T + 10, t.console, 0.85, -2.3)
      if (consoleSpr) {
        consoleSpr.setOrigin(0.5, 0)
        const scr = place(room.x, T + 22, t.screen, 0.80, -2.15)
        if (scr) scr.setOrigin(0.5, 0)
      }

      // Bottom-left corner
      place(L + 35, B - 20, t.bl, 0.75, -2.3)
      // Bottom-right corner
      place(R - 35, B - 20, t.br, 0.75, -2.3)

      // Mid-room feature (if space allows)
      if (room.width > 200 && room.height > 150) {
        place(R - 55, room.y - 15, t.mid, 0.70, -2.2)
      }

      // Extra equipment along walls
      if (t.extra.length >= 2) {
        place(L + 20, room.y - 20, t.extra[0], 0.65, -2.1)
        place(R - 20, room.y + 20, t.extra[1], 0.65, -2.1)
      }

      // Scatter items along walls — 4-6 small props
      const seed = (hash + ri * 37) >>> 0
      for (let si = 0; si < 5; si++) {
        const item = scatterItems[(seed + si * 7) % scatterItems.length]
        const t2 = si / 5
        let sx: number, sy: number
        if (si < 2) { sx = L + 15 + si * 20; sy = T + room.height * (0.3 + si * 0.15) }
        else if (si < 4) { sx = R - 15 - (si - 2) * 20; sy = T + room.height * (0.35 + (si - 2) * 0.15) }
        else { sx = room.x + (t2 - 0.5) * room.width * 0.3; sy = B - 12 }
        place(sx, sy, item, 0.55, -2.05)
      }

      // Cable covers along floor edges
      if (ri % 2 === 0) {
        place(L + room.width * 0.3, B - 8, 'cable_piece_01', 0.45, -2.8)
      } else {
        place(R - room.width * 0.3, T + 8, 'cable_piece_03', 0.45, -2.8)
      }

      // Sliding door at room entrance
      place(room.x, B + WALL_PAD * 0.5, 'sliding_door', 0.60, -2.5)
    }
  }

  // -------------------------------------------------------------------------
  // Wall decorations — vents, panels, warning signs, lights
  // -------------------------------------------------------------------------

  private decorateWalls(rooms: FacilityRoom[], hash: number): void {
    if (!this.scene.textures.exists(SPRITESHEET_KEYS.LAB_PROPS)) return
    const LP = SPRITESHEET_KEYS.LAB_PROPS

    const topFrames = ['vent_slats', 'small_rectangle_panel', 'octagonal_panel', 'warning_stripes', 'narrow_skylight']
    const sideFrames = ['vent', 'sunken_vent', 'rectangle_panel', 'sunken_cell', 'circular_panel']
    const warnFrames = ['warning_biological', 'warning_power', 'warning_death', 'warning_warning']

    const place = (x: number, y: number, frame: string, scale: number, angle = 0, alpha = 0.75) => {
      const spr = this.scene.add.sprite(x, y, LP, frame)
        .setScale(TILE_SCALE * scale).setAlpha(alpha).setDepth(-2.1).setAngle(angle)
      this.objects.push(spr)
    }

    for (let ri = 0; ri < rooms.length; ri++) {
      const room = rooms[ri]
      const L = room.x - room.width / 2, T = room.y - room.height / 2
      const R = room.x + room.width / 2, B = room.y + room.height / 2
      const seed = hash + ri * 37

      // Top wall — 2-3 decorations
      place(L + room.width * 0.2, T + 6, topFrames[seed % topFrames.length], 0.6)
      place(R - room.width * 0.2, T + 6, topFrames[(seed + 2) % topFrames.length], 0.6)
      if (room.width > 300) place(room.x, T + 6, topFrames[(seed + 4) % topFrames.length], 0.5)

      // Left wall — 2 decorations
      place(L + 8, room.y - room.height * 0.15, sideFrames[(seed + 1) % sideFrames.length], 0.55, 90)
      place(L + 8, room.y + room.height * 0.2, sideFrames[(seed + 3) % sideFrames.length], 0.45, 90)

      // Right wall — 2 decorations
      place(R - 8, room.y - room.height * 0.2, sideFrames[(seed + 5) % sideFrames.length], 0.55, -90)
      place(R - 8, room.y + room.height * 0.15, sideFrames[(seed + 4) % sideFrames.length], 0.45, -90)

      // Bottom wall — warning signs + wall light
      place(R - 40, B - 8, warnFrames[(seed + 2) % warnFrames.length], 0.5, 0, 0.80)
      place(L + 40, B - 8, 'wall_light', 0.4, 0, 0.65)

      // LED indicators near top corners (like the example's red/green lights)
      place(L + 15, T + 15, 'led_on', 0.25, 0, 0.70)
      place(R - 15, T + 15, 'led_on', 0.25, 0, 0.70)
    }
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private groupRoomsByRow(rooms: FacilityRoom[]): FacilityRoom[][] {
    const sorted = [...rooms].sort((a, b) => a.y - b.y)
    const groups: FacilityRoom[][] = []
    for (const r of sorted) {
      const last = groups[groups.length - 1]
      if (last && Math.abs(last[0].y - r.y) < r.height * 0.5) last.push(r)
      else groups.push([r])
    }
    for (const row of groups) row.sort((a, b) => a.x - b.x)
    return groups
  }

  applyLod(lodLevel: number): void {
    const visible = lodLevel >= 2
    for (const o of this.objects) (o as Phaser.GameObjects.Components.Visible).setVisible(visible)
  }

  cleanup(): void {
    for (const o of this.objects) o.destroy()
    this.objects = []
  }

  destroy(): void {
    this.cleanup()
  }
}
