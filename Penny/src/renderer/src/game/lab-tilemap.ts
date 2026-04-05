// ---------------------------------------------------------------------------
// lab-tilemap.ts
// Single-building tilemap renderer. One big lab facility with outer walls,
// hex floor interior, and interior divider walls with openings between rooms.
// Replaces per-room wall tiles + unified floor.
// ---------------------------------------------------------------------------

import Phaser from 'phaser'
import { LAB_IMAGE_KEYS, SPRITESHEET_KEYS } from './office-asset-keys'
import { LAB_TILE_SIZE } from './office-constants'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Tile display scale — 128px tiles → 48px on screen for good tile density */
const TILE_SCALE = 0.375
/** Effective cell size in world pixels */
const CELL = LAB_TILE_SIZE * TILE_SCALE  // 48px
/** Wall thickness in cells around the outer perimeter */
const WALL_THICK = 2
/** Margin cells outside the outer wall (void) */
const VOID_MARGIN = 0
/** Opening width in cells for interior dividers (doorway gap) */
const OPENING_WIDTH = 3
/** Interior divider wall thickness in cells */
const DIVIDER_THICK = 2

// ---------------------------------------------------------------------------
// Cell types
// ---------------------------------------------------------------------------

const VOID  = 0
const FLOOR = 1
const WALL  = 2

type CellGrid = Uint8Array[]

// ---------------------------------------------------------------------------
// Room rect — world-space bounding box (center + size)
// ---------------------------------------------------------------------------

export interface FacilityRoom {
  x: number       // center X in world space
  y: number       // center Y in world space
  width: number
  height: number
  cwd: string
  /** Desk center positions relative to room center (from computeRoomLayout) */
  deskPositions?: { x: number; y: number }[]
}

// ---------------------------------------------------------------------------
// LabTilemap
// ---------------------------------------------------------------------------

export class LabTilemap {
  private scene: Phaser.Scene
  private tiles: Phaser.GameObjects.Image[] = []
  private pipeSprites: Phaser.GameObjects.Sprite[] = []
  private decorGraphics: Phaser.GameObjects.Graphics | null = null

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  // -------------------------------------------------------------------------
  // render — build grid and place tiles for the entire facility
  // -------------------------------------------------------------------------

  render(rooms: FacilityRoom[]): void {
    this.cleanup()
    if (rooms.length === 0 || !this.scene.textures.exists(LAB_IMAGE_KEYS.HEX_FLOOR_A)) return

    // ── 1. Facility bounding box ──
    // Include extra room padding so agents near edges are well inside walls
    const ROOM_INSET = 30  // extra px inside each room edge
    let fMinX = Infinity, fMinY = Infinity, fMaxX = -Infinity, fMaxY = -Infinity
    for (const r of rooms) {
      fMinX = Math.min(fMinX, r.x - r.width / 2 - ROOM_INSET)
      fMinY = Math.min(fMinY, r.y - r.height / 2 - ROOM_INSET)
      fMaxX = Math.max(fMaxX, r.x + r.width / 2 + ROOM_INSET)
      fMaxY = Math.max(fMaxY, r.y + r.height / 2 + ROOM_INSET)
    }

    // Pad for outer wall thickness
    const pad = WALL_THICK * CELL
    const originX = fMinX - pad
    const originY = fMinY - pad
    const totalW = fMaxX - fMinX + pad * 2
    const totalH = fMaxY - fMinY + pad * 2
    const cols = Math.ceil(totalW / CELL)
    const rows = Math.ceil(totalH / CELL)

    // ── 2. Build grid — start all VOID ──
    const grid: CellGrid = Array.from({ length: rows }, () => new Uint8Array(cols))

    // ── 3. Mark building interior as FLOOR ──
    // The entire bounding box (minus outer wall margin) is floor.
    // This creates one big open building.
    const floorC0 = VOID_MARGIN + WALL_THICK
    const floorR0 = VOID_MARGIN + WALL_THICK
    const floorC1 = cols - VOID_MARGIN - WALL_THICK
    const floorR1 = rows - VOID_MARGIN - WALL_THICK
    for (let r = floorR0; r < floorR1; r++) {
      for (let c = floorC0; c < floorC1; c++) {
        grid[r][c] = FLOOR
      }
    }

    // ── 4. Mark outer walls ──
    // Wall = cells in the margin band that are adjacent to floor
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (grid[r][c] !== VOID) continue
        if (this.hasNeighbor(grid, r, c, rows, cols, FLOOR)) {
          grid[r][c] = WALL
        }
      }
    }

    // ── 5. Interior dividers — drawn as graphics after tiles (not tile-based) ──

    // ── 6. Render tiles ──
    const hash = Math.abs(Math.floor(originX * 7 + originY * 13)) | 0
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const type = grid[r][c]
        if (type === VOID) continue

        const wx = originX + c * CELL + CELL / 2
        const wy = originY + r * CELL + CELL / 2

        let imageKey: string
        if (type === FLOOR) {
          const v = (hash + r * 17 + c * 31) % 10
          imageKey = v < 2 ? LAB_IMAGE_KEYS.HEX_FLOOR_B : LAB_IMAGE_KEYS.HEX_FLOOR_A
        } else {
          imageKey = this.autotileWall(grid, r, c, rows, cols)
        }

        const tile = this.scene.add.image(wx, wy, imageKey)
          .setScale(TILE_SCALE)
          .setDepth(-3)
        this.tiles.push(tile)
      }
    }

    // ── 7. Hazard tape along outer wall-floor boundaries ──
    this.drawHazardTape(grid, originX, originY, cols, rows)

    // ── 8. Interior dividers — graphics walls matching outer wall style ──
    this.drawInteriorDividers(rooms)

    // ── 9. Floor glow lights (corridors only) ──
    this.drawFloorGlows(grid, originX, originY, cols, rows, hash, rooms)

    // ── 9. Room props — large wall-lining equipment, no scattered clutter ──
    this.decorateRooms(rooms, grid, originX, originY, cols, rows, hash)
  }

  // -------------------------------------------------------------------------
  // Interior dividers — wall strips between rooms with openings
  // -------------------------------------------------------------------------

  private addInteriorDividers(
    grid: CellGrid,
    rooms: FacilityRoom[],
    originX: number,
    originY: number,
    cols: number,
    numRows: number,
  ): void {
    if (rooms.length < 2) return

    // ── Group rooms into rows (rooms with similar Y centers) ──
    const sorted = [...rooms].sort((a, b) => a.y - b.y)
    const rowGroups: FacilityRoom[][] = []
    for (const r of sorted) {
      const lastRow = rowGroups[rowGroups.length - 1]
      if (lastRow && Math.abs(lastRow[0].y - r.y) < r.height * 0.5) {
        lastRow.push(r)
      } else {
        rowGroups.push([r])
      }
    }
    // Sort rooms within each row by X
    for (const row of rowGroups) row.sort((a, b) => a.x - b.x)

    // ── Vertical dividers between adjacent rooms in the same row ──
    for (const row of rowGroups) {
      for (let i = 0; i < row.length - 1; i++) {
        const a = row[i], b = row[i + 1]
        const aRight = a.x + a.width / 2
        const bLeft = b.x - b.width / 2

        // Divider X at midpoint between rooms — 2 columns
        const divWX = (aRight + bLeft) / 2
        const divC = Math.round((divWX - originX) / CELL)
        const divCols = [divC, divC + 1].filter(cc => cc >= 0 && cc < cols)
        if (divCols.length === 0) continue

        // Vertical span: union of both rooms' Y ranges
        const topY = Math.min(a.y - a.height / 2, b.y - b.height / 2)
        const botY = Math.max(a.y + a.height / 2, b.y + b.height / 2)
        const r0 = Math.max(0, Math.floor((topY - originY) / CELL))
        const r1 = Math.min(numRows, Math.ceil((botY - originY) / CELL))

        // Doorway opening in the middle
        const midR = Math.floor((r0 + r1) / 2)
        const openR0 = midR - Math.floor(OPENING_WIDTH / 2)
        const openR1 = openR0 + OPENING_WIDTH

        for (let r = r0; r < r1; r++) {
          if (r >= openR0 && r < openR1) continue
          for (const dc of divCols) grid[r][dc] = WALL
        }
      }
    }

    // ── Horizontal dividers between adjacent row groups ──
    for (let gi = 0; gi < rowGroups.length - 1; gi++) {
      const topRow = rowGroups[gi]
      const botRow = rowGroups[gi + 1]

      // Bottom edge of top row, top edge of bottom row
      let topEdge = -Infinity
      for (const r of topRow) topEdge = Math.max(topEdge, r.y + r.height / 2)
      let botEdge = Infinity
      for (const r of botRow) botEdge = Math.min(botEdge, r.y - r.height / 2)

      const divWY = (topEdge + botEdge) / 2
      const divR = Math.round((divWY - originY) / CELL)
      const divRows = [divR, divR + 1].filter(rr => rr >= 0 && rr < numRows)
      if (divRows.length === 0) continue

      // Horizontal span: full width of whichever row group is wider
      let leftX = Infinity, rightX = -Infinity
      for (const r of [...topRow, ...botRow]) {
        leftX = Math.min(leftX, r.x - r.width / 2)
        rightX = Math.max(rightX, r.x + r.width / 2)
      }
      const c0 = Math.max(0, Math.floor((leftX - originX) / CELL))
      const c1 = Math.min(cols, Math.ceil((rightX - originX) / CELL))

      // Doorway opening in the middle
      const midC = Math.floor((c0 + c1) / 2)
      const openC0 = midC - Math.floor(OPENING_WIDTH / 2)
      const openC1 = openC0 + OPENING_WIDTH

      for (let c = c0; c < c1; c++) {
        if (c >= openC0 && c < openC1) continue
        for (const dr of divRows) grid[dr][c] = WALL
      }
    }
  }

  // -------------------------------------------------------------------------
  // Interior dividers — thin graphics walls between adjacent rooms
  // -------------------------------------------------------------------------

  private drawInteriorDividers(rooms: FacilityRoom[]): void {
    if (rooms.length < 2) return

    const g = this.scene.add.graphics().setDepth(-2.4)
    this.tiles.push(g as unknown as Phaser.GameObjects.Image)

    const WALL_COLOR = 0x1a2744     // facility wall navy
    const WALL_W = 24               // match outer wall visual weight
    const DOOR_GAP = 48             // doorway opening (1 tile)
    const TAPE_W = 5                // hazard tape strip width

    // Group rooms into rows by similar Y center
    const sorted = [...rooms].sort((a, b) => a.y - b.y)
    const rowGroups: FacilityRoom[][] = []
    for (const r of sorted) {
      const lastRow = rowGroups[rowGroups.length - 1]
      if (lastRow && Math.abs(lastRow[0].y - r.y) < r.height * 0.5) {
        lastRow.push(r)
      } else {
        rowGroups.push([r])
      }
    }
    for (const row of rowGroups) row.sort((a, b) => a.x - b.x)

    // ── Vertical dividers between rooms in the same row ──
    for (const row of rowGroups) {
      for (let i = 0; i < row.length - 1; i++) {
        const a = row[i], b = row[i + 1]
        const divX = (a.x + a.width / 2 + b.x - b.width / 2) / 2

        const topY = Math.min(a.y - a.height / 2, b.y - b.height / 2)
        const botY = Math.max(a.y + a.height / 2, b.y + b.height / 2)
        const midY = (topY + botY) / 2
        const segTopH = midY - DOOR_GAP / 2 - topY
        const segBotH = botY - midY - DOOR_GAP / 2

        // Wall body
        g.fillStyle(WALL_COLOR, 1)
        if (segTopH > 0) g.fillRect(divX - WALL_W / 2, topY, WALL_W, segTopH)
        if (segBotH > 0) g.fillRect(divX - WALL_W / 2, midY + DOOR_GAP / 2, WALL_W, segBotH)

        // Hazard tape on both long edges
        if (segTopH > 0) {
          this.drawDividerTape(g, divX - WALL_W / 2, topY, TAPE_W, segTopH, false)
          this.drawDividerTape(g, divX + WALL_W / 2 - TAPE_W, topY, TAPE_W, segTopH, false)
        }
        if (segBotH > 0) {
          this.drawDividerTape(g, divX - WALL_W / 2, midY + DOOR_GAP / 2, TAPE_W, segBotH, false)
          this.drawDividerTape(g, divX + WALL_W / 2 - TAPE_W, midY + DOOR_GAP / 2, TAPE_W, segBotH, false)
        }
      }
    }

    // ── Horizontal dividers between row groups ──
    for (let gi = 0; gi < rowGroups.length - 1; gi++) {
      const topRow = rowGroups[gi]
      const botRow = rowGroups[gi + 1]

      let topEdge = -Infinity
      for (const r of topRow) topEdge = Math.max(topEdge, r.y + r.height / 2)
      let botEdge = Infinity
      for (const r of botRow) botEdge = Math.min(botEdge, r.y - r.height / 2)
      const divY = (topEdge + botEdge) / 2

      let leftX = Infinity, rightX = -Infinity
      for (const r of [...topRow, ...botRow]) {
        leftX = Math.min(leftX, r.x - r.width / 2)
        rightX = Math.max(rightX, r.x + r.width / 2)
      }
      const midX = (leftX + rightX) / 2
      const segLeftW = midX - DOOR_GAP / 2 - leftX
      const segRightW = rightX - midX - DOOR_GAP / 2

      // Wall body
      g.fillStyle(WALL_COLOR, 1)
      if (segLeftW > 0) g.fillRect(leftX, divY - WALL_W / 2, segLeftW, WALL_W)
      if (segRightW > 0) g.fillRect(midX + DOOR_GAP / 2, divY - WALL_W / 2, segRightW, WALL_W)

      // Hazard tape on both long edges
      if (segLeftW > 0) {
        this.drawDividerTape(g, leftX, divY - WALL_W / 2, segLeftW, TAPE_W, true)
        this.drawDividerTape(g, leftX, divY + WALL_W / 2 - TAPE_W, segLeftW, TAPE_W, true)
      }
      if (segRightW > 0) {
        this.drawDividerTape(g, midX + DOOR_GAP / 2, divY - WALL_W / 2, segRightW, TAPE_W, true)
        this.drawDividerTape(g, midX + DOOR_GAP / 2, divY + WALL_W / 2 - TAPE_W, segRightW, TAPE_W, true)
      }
    }
  }

  /** Draw alternating yellow/dark hazard tape segments on a divider edge */
  private drawDividerTape(
    g: Phaser.GameObjects.Graphics,
    x: number, y: number, w: number, h: number,
    horizontal: boolean,
  ): void {
    const SEG = 6
    const YELLOW = 0xfbbf24
    const DARK = 0x1a1a2e
    let pos = 0
    let isYellow = true
    const length = horizontal ? w : h
    while (pos < length) {
      const len = Math.min(SEG, length - pos)
      g.fillStyle(isYellow ? YELLOW : DARK, isYellow ? 0.5 : 0.35)
      if (horizontal) {
        g.fillRect(x + pos, y, len, h)
      } else {
        g.fillRect(x, y + pos, w, len)
      }
      pos += SEG
      isYellow = !isYellow
    }
  }

  // -------------------------------------------------------------------------
  // Autotile — select wall tile based on floor neighbors
  // -------------------------------------------------------------------------

  private autotileWall(grid: CellGrid, r: number, c: number, rows: number, cols: number): string {
    const isFloor = (dr: number, dc: number) =>
      r + dr >= 0 && r + dr < rows && c + dc >= 0 && c + dc < cols &&
      grid[r + dr][c + dc] === FLOOR

    const n = isFloor(-1, 0)
    const s = isFloor(1, 0)
    const w = isFloor(0, -1)
    const e = isFloor(0, 1)
    const cnt = +n + +s + +e + +w

    // Floor on all 4 cardinal sides — inner island or 4-way junction
    if (cnt === 4) return LAB_IMAGE_KEYS.FOUR_WAY

    // T-junctions — floor on 3 cardinal sides
    if (cnt === 3) {
      if (!n) return LAB_IMAGE_KEYS.T_TOP     // wall extends up, floor on S/E/W
      if (!s) return LAB_IMAGE_KEYS.T_BOTTOM  // wall extends down, floor on N/E/W
      if (!w) return LAB_IMAGE_KEYS.T_LEFT    // wall extends left, floor on N/S/E
      if (!e) return LAB_IMAGE_KEYS.T_RIGHT   // wall extends right, floor on N/S/W
    }

    // 2 cardinal floor neighbors
    if (cnt === 2) {
      // Adjacent pair → outer (convex) corner
      if (s && e) return LAB_IMAGE_KEYS.CORNER_TL
      if (s && w) return LAB_IMAGE_KEYS.CORNER_TR
      if (n && e) return LAB_IMAGE_KEYS.CORNER_BL
      if (n && w) return LAB_IMAGE_KEYS.CORNER_BR

      // Opposite pair → interior divider
      if (n && s) return LAB_IMAGE_KEYS.WALL_LEFT   // vertical divider strip
      if (e && w) return LAB_IMAGE_KEYS.WALL_TOP     // horizontal divider strip
    }

    // 1 cardinal floor neighbor — straight edge
    if (cnt === 1) {
      if (s) return LAB_IMAGE_KEYS.WALL_TOP
      if (n) return LAB_IMAGE_KEYS.WALL_BOTTOM
      if (e) return LAB_IMAGE_KEYS.WALL_LEFT
      if (w) return LAB_IMAGE_KEYS.WALL_RIGHT
    }

    // 0 cardinal floor neighbors — check diagonals for inner (concave) corners
    const ne = isFloor(-1, 1)
    const nw = isFloor(-1, -1)
    const se = isFloor(1, 1)
    const sw = isFloor(1, -1)

    if (se) return LAB_IMAGE_KEYS.INNER_TL  // floor at bottom-right → inner top-left corner
    if (sw) return LAB_IMAGE_KEYS.INNER_TR  // floor at bottom-left → inner top-right corner
    if (ne) return LAB_IMAGE_KEYS.INNER_BL  // floor at top-right → inner bottom-left corner
    if (nw) return LAB_IMAGE_KEYS.INNER_BR  // floor at top-left → inner bottom-right corner

    // Deep interior wall — no adjacent floor at all
    return LAB_IMAGE_KEYS.OUTER_FILL
  }

  // -------------------------------------------------------------------------
  // Hazard tape — yellow/dark stripes along interior wall boundaries
  // -------------------------------------------------------------------------

  private drawHazardTape(
    grid: CellGrid,
    originX: number,
    originY: number,
    cols: number,
    rows: number,
  ): void {
    if (!this.decorGraphics) {
      this.decorGraphics = this.scene.add.graphics().setDepth(-2.5)
    }
    const g = this.decorGraphics
    g.clear()

    const YELLOW = 0xfbbf24
    const DARK = 0x1a1a2e
    const SEG = 6
    const TAPE_W = 4
    const AY = 0.5
    const AD = 0.35

    // Draw hazard tape on ALL wall-floor boundaries — both outer perimeter and interior dividers.
    // This gives the reference image's look where every wall edge has safety striping.
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (grid[r][c] !== WALL) continue

        const wx = originX + c * CELL
        const wy = originY + r * CELL

        // Draw tape on each side that faces floor
        if (r + 1 < rows && grid[r + 1][c] === FLOOR)
          this.drawTapeH(g, wx, wy + CELL - TAPE_W / 2, CELL, TAPE_W, SEG, YELLOW, DARK, AY, AD)
        if (r > 0 && grid[r - 1][c] === FLOOR)
          this.drawTapeH(g, wx, wy - TAPE_W / 2, CELL, TAPE_W, SEG, YELLOW, DARK, AY, AD)
        if (c + 1 < cols && grid[r][c + 1] === FLOOR)
          this.drawTapeV(g, wx + CELL - TAPE_W / 2, wy, TAPE_W, CELL, SEG, YELLOW, DARK, AY, AD)
        if (c > 0 && grid[r][c - 1] === FLOOR)
          this.drawTapeV(g, wx - TAPE_W / 2, wy, TAPE_W, CELL, SEG, YELLOW, DARK, AY, AD)
      }
    }
  }

  private drawTapeH(
    g: Phaser.GameObjects.Graphics,
    x: number, y: number, length: number, width: number,
    seg: number, c1: number, c2: number, a1: number, a2: number,
  ): void {
    let pos = 0
    let yellow = true
    while (pos < length) {
      const len = Math.min(seg, length - pos)
      g.fillStyle(yellow ? c1 : c2, yellow ? a1 : a2)
      g.fillRect(x + pos, y, len, width)
      pos += seg
      yellow = !yellow
    }
  }

  private drawTapeV(
    g: Phaser.GameObjects.Graphics,
    x: number, y: number, width: number, length: number,
    seg: number, c1: number, c2: number, a1: number, a2: number,
  ): void {
    let pos = 0
    let yellow = true
    while (pos < length) {
      const len = Math.min(seg, length - pos)
      g.fillStyle(yellow ? c1 : c2, yellow ? a1 : a2)
      g.fillRect(x, y + pos, width, len)
      pos += seg
      yellow = !yellow
    }
  }

  // -------------------------------------------------------------------------
  // Floor glow lights — cyan pools in CORRIDORS between rooms only
  // -------------------------------------------------------------------------

  private drawFloorGlows(
    grid: CellGrid,
    originX: number,
    originY: number,
    cols: number,
    rows: number,
    hash: number,
    rooms?: FacilityRoom[],
  ): void {
    const glowG = this.scene.add.graphics().setDepth(-2.8)
    this.tiles.push(glowG as unknown as Phaser.GameObjects.Image)

    // Helper: is this world position inside any room?
    const insideRoom = (wx: number, wy: number): boolean => {
      if (!rooms) return false
      for (const r of rooms) {
        if (wx > r.x - r.width / 2 && wx < r.x + r.width / 2 &&
            wy > r.y - r.height / 2 && wy < r.y + r.height / 2) return true
      }
      return false
    }

    // Collect corridor floor cells (floor cells NOT inside any room)
    const corridorCells: { x: number; y: number }[] = []
    for (let r = 2; r < rows - 2; r++) {
      for (let c = 2; c < cols - 2; c++) {
        if (grid[r][c] !== FLOOR) continue
        const wx = originX + c * CELL + CELL / 2
        const wy = originY + r * CELL + CELL / 2
        if (!insideRoom(wx, wy)) corridorCells.push({ x: wx, y: wy })
      }
    }

    // Place glow lights evenly spaced in corridor cells
    const maxGlows = Math.min(6, Math.max(2, Math.floor(corridorCells.length / 3)))
    const step = Math.max(1, Math.floor(corridorCells.length / maxGlows))
    for (let i = 0; i < maxGlows && i * step < corridorCells.length; i++) {
      const cell = corridorCells[i * step]
      glowG.fillStyle(0x38bdf8, 0.10)
      glowG.fillCircle(cell.x, cell.y, 26)
      glowG.fillStyle(0x22d3ee, 0.18)
      glowG.fillCircle(cell.x, cell.y, 13)
      glowG.fillStyle(0x7dd3fc, 0.28)
      glowG.fillCircle(cell.x, cell.y, 5)
    }
  }

  // -------------------------------------------------------------------------
  // Room decoration — corner-based strategic placement
  // -------------------------------------------------------------------------

  private decorateRooms(
    rooms: FacilityRoom[],
    _grid: CellGrid,
    _originX: number,
    _originY: number,
    _cols: number,
    _rows: number,
    _hash: number,
  ): void {
    if (!this.scene.textures.exists(SPRITESHEET_KEYS.LAB_PROPS)) return

    // ── Desk positions for collision avoidance ──
    const DESK_CLEAR = 75  // generous clearance to prevent ANY desk overlap
    const allDesks: { x: number; y: number }[] = []
    for (const r of rooms) {
      if (!r.deskPositions) continue
      for (const d of r.deskPositions) allDesks.push({ x: r.x + d.x, y: r.y + d.y })
    }
    const nearDesk = (wx: number, wy: number) =>
      allDesks.some(d => Math.abs(d.x - wx) < DESK_CLEAR && Math.abs(d.y - wy) < DESK_CLEAR)

    // Place a prop sprite scaled to a target display height
    const placeProp = (wx: number, wy: number, frame: string, displayH: number, alpha = 0.90, depth = -2): Phaser.GameObjects.Sprite | null => {
      if (nearDesk(wx, wy)) return null
      const spr = this.scene.add.sprite(wx, wy, SPRITESHEET_KEYS.LAB_PROPS, frame)
      const s = displayH / (spr.height || 100)
      spr.setScale(s).setAlpha(alpha).setDepth(depth)
      this.pipeSprites.push(spr)
      return spr
    }

    // =====================================================================
    // 4 room themes — corner-first placement like the reference image
    // Each theme: corner anchors (top-left, top-right), top console, floor accent
    // =====================================================================

    interface CornerKit {
      cornerTL: [string, number]   // [frame, displayHeight] — top-left corner anchor
      cornerTR: [string, number]   // top-right corner anchor
      topConsole: string           // console spanning top wall between corners
      consoleScreen: string        // small screen overlay on the console
      floorAccent: string          // subtle bottom-wall floor item
    }

    const themes: CornerKit[] = [
      { // POWER ROOM
        cornerTL: ['generator', 75],
        cornerTR: ['large_tank', 70],
        topConsole: 'blank_console_long',
        consoleScreen: 'console_screen_wave_01',
        floorAccent: 'cable_cover',
      },
      { // RESEARCH LAB
        cornerTL: ['pod', 70],
        cornerTR: ['lab_machine_01', 75],
        topConsole: 'blank_console_long',
        consoleScreen: 'console_screen_lines_02',
        floorAccent: 'octogon_plate',
      },
      { // CONTROL ROOM
        cornerTL: ['console_example_corner', 75],
        cornerTR: ['console_example_corner', 75],
        topConsole: 'console_example_long',
        consoleScreen: 'console_screen_wave_03',
        floorAccent: 'cable_cover_with_ramp',
      },
      { // SERVER ROOM
        cornerTL: ['unit_example_01', 70],
        cornerTR: ['unit_example_04', 70],
        topConsole: 'console_example_long',
        consoleScreen: 'console_screen_lines_04',
        floorAccent: 'octogon_plate_small',
      },
    ]

    for (let ri = 0; ri < rooms.length; ri++) {
      const room = rooms[ri]
      const theme = themes[ri % themes.length]
      const L = room.x - room.width / 2
      const T = room.y - room.height / 2
      const R = room.x + room.width / 2
      const B = room.y + room.height / 2

      // ── TOP-LEFT CORNER: anchor equipment rotated 180° into the corner ──
      {
        const spr = placeProp(L + 30, T + 45, theme.cornerTL[0], theme.cornerTL[1], 0.88, -2.2)
        if (spr) { spr.setOrigin(0, 0).setAngle(270) }
      }

      // ── TOP-RIGHT CORNER: anchor equipment into the corner ──
      {
        const spr = placeProp(R - 6, T - 30, theme.cornerTR[0], theme.cornerTR[1], 0.88, -2.2)
        if (spr) spr.setOrigin(1, 0) // pin to top-right corner
      }

      // ── TOP WALL CENTER: console between the two corner pieces ──
      {
        const cx = room.x
        const cy = T + 10
        const spr = placeProp(cx, cy, theme.topConsole, 55, 0.85, -2.3)
        if (spr) {
          spr.setOrigin(0.5, 0)
          // Screen overlay on top of the console
          const screen = placeProp(cx, cy + 12, theme.consoleScreen, 16, 0.80, -2.15)
          if (screen) screen.setOrigin(0.5, 0)
        }
      }

      // Bottom corners — TODO: add desk-flanking corner consoles
    }
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private hasNeighbor(grid: CellGrid, r: number, c: number, rows: number, cols: number, type: number): boolean {
    if (r > 0 && grid[r - 1][c] === type) return true
    if (r < rows - 1 && grid[r + 1][c] === type) return true
    if (c > 0 && grid[r][c - 1] === type) return true
    if (c < cols - 1 && grid[r][c + 1] === type) return true
    // Diagonals for corner wall detection
    if (r > 0 && c > 0 && grid[r - 1][c - 1] === type) return true
    if (r > 0 && c < cols - 1 && grid[r - 1][c + 1] === type) return true
    if (r < rows - 1 && c > 0 && grid[r + 1][c - 1] === type) return true
    if (r < rows - 1 && c < cols - 1 && grid[r + 1][c + 1] === type) return true
    return false
  }

  // -------------------------------------------------------------------------
  // LOD
  // -------------------------------------------------------------------------

  applyLod(lodLevel: number): void {
    const visible = lodLevel >= 2
    for (const t of this.tiles) t.setVisible(visible)
    for (const s of this.pipeSprites) s.setVisible(visible)
    if (this.decorGraphics) this.decorGraphics.setVisible(visible)
  }

  // -------------------------------------------------------------------------
  // Cleanup
  // -------------------------------------------------------------------------

  cleanup(): void {
    for (const t of this.tiles) t.destroy()
    this.tiles = []
    for (const s of this.pipeSprites) s.destroy()
    this.pipeSprites = []
    if (this.decorGraphics) { this.decorGraphics.destroy(); this.decorGraphics = null }
  }

  destroy(): void {
    this.cleanup()
  }
}
