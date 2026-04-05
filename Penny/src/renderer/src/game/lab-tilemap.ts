// ---------------------------------------------------------------------------
// lab-tilemap.ts
// Single-building tilemap renderer. One big lab facility with outer walls,
// hex floor interior, and interior divider walls with openings between rooms.
// Replaces per-room wall tiles + unified floor.
// ---------------------------------------------------------------------------

import Phaser from 'phaser'
import { LAB_IMAGE_KEYS, SPRITESHEET_KEYS, PIPE_FRAMES } from './office-asset-keys'
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
/** Opening width in cells for interior dividers */
const OPENING_WIDTH = 4

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

    // ── 5. Interior dividers between rooms ──
    this.addInteriorDividers(grid, rooms, originX, originY, cols, rows)

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

    // ── 7. Hazard tape along interior dividers ──
    this.drawHazardTape(grid, originX, originY, cols, rows)

    // ── 8. Floor glow lights ──
    this.drawFloorGlows(grid, originX, originY, cols, rows, hash)

    // ── 9. Corridor pipe runs ──
    this.drawCorridorPipes(grid, rooms, originX, originY, cols, rows)

    // ── 10. Outer wall pipe runs — prominent pipes along the building perimeter ──
    this.drawOuterPipes(grid, originX, originY, cols, rows, hash)

    // ── 11. Room props — wall-lining furniture, corner equipment, floor accents ──
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
    rows: number,
  ): void {
    if (rooms.length < 2) return

    // Convert room bounds to grid coordinates
    const roomCells = rooms.map(r => ({
      c0: Math.floor((r.x - r.width / 2 - originX) / CELL),
      r0: Math.floor((r.y - r.height / 2 - originY) / CELL),
      c1: Math.ceil((r.x + r.width / 2 - originX) / CELL),
      r1: Math.ceil((r.y + r.height / 2 - originY) / CELL),
      cx: Math.floor((r.x - originX) / CELL),
      cy: Math.floor((r.y - originY) / CELL),
    }))

    // Find pairs of rooms that are horizontally adjacent (side by side)
    for (let i = 0; i < roomCells.length; i++) {
      for (let j = i + 1; j < roomCells.length; j++) {
        const a = roomCells[i]
        const b = roomCells[j]

        // Check vertical overlap (they share rows)
        const overlapR0 = Math.max(a.r0, b.r0)
        const overlapR1 = Math.min(a.r1, b.r1)
        if (overlapR1 <= overlapR0) continue // no vertical overlap

        // Check if horizontally adjacent (gap between them)
        const leftRoom = a.c1 < b.c0 ? a : b.c1 < a.c0 ? b : null
        const rightRoom = leftRoom === a ? b : a
        if (!leftRoom) continue // overlapping, not adjacent

        const gapC0 = leftRoom.c1
        const gapC1 = rightRoom.c0
        if (gapC1 - gapC0 > 6) continue // too far apart

        // Draw vertical divider — 2 columns thick at the midpoint
        const divCMid = Math.floor((gapC0 + gapC1) / 2)
        const divCols = [divCMid, divCMid + 1].filter(c => c >= 0 && c < cols)
        if (divCols.length === 0) continue

        // Opening in the middle
        const midR = Math.floor((overlapR0 + overlapR1) / 2)
        const openR0 = midR - Math.floor(OPENING_WIDTH / 2)
        const openR1 = openR0 + OPENING_WIDTH

        for (let r = overlapR0; r < overlapR1; r++) {
          if (r >= openR0 && r < openR1) continue // opening
          for (const divC of divCols) {
            if (r >= 0 && r < rows) {
              grid[r][divC] = WALL
            }
          }
        }
      }
    }

    // Find pairs that are vertically adjacent (stacked)
    for (let i = 0; i < roomCells.length; i++) {
      for (let j = i + 1; j < roomCells.length; j++) {
        const a = roomCells[i]
        const b = roomCells[j]

        // Check horizontal overlap
        const overlapC0 = Math.max(a.c0, b.c0)
        const overlapC1 = Math.min(a.c1, b.c1)
        if (overlapC1 <= overlapC0) continue

        // Check if vertically adjacent
        const topRoom = a.r1 < b.r0 ? a : b.r1 < a.r0 ? b : null
        const bottomRoom = topRoom === a ? b : a
        if (!topRoom) continue

        const gapR0 = topRoom.r1
        const gapR1 = bottomRoom.r0
        if (gapR1 - gapR0 > 6) continue

        // Draw horizontal divider — 2 rows thick at the midpoint
        const divRMid = Math.floor((gapR0 + gapR1) / 2)
        const divRows = [divRMid, divRMid + 1].filter(r => r >= 0 && r < rows)
        if (divRows.length === 0) continue

        const midC = Math.floor((overlapC0 + overlapC1) / 2)
        const openC0 = midC - Math.floor(OPENING_WIDTH / 2)
        const openC1 = openC0 + OPENING_WIDTH

        for (let c = overlapC0; c < overlapC1; c++) {
          if (c >= openC0 && c < openC1) continue
          for (const divR of divRows) {
            if (c >= 0 && c < cols) {
              grid[divR][c] = WALL
            }
          }
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // Autotile — select wall tile based on floor neighbors
  // -------------------------------------------------------------------------

  private autotileWall(grid: CellGrid, r: number, c: number, rows: number, cols: number): string {
    const f = (dr: number, dc: number) =>
      r + dr >= 0 && r + dr < rows && c + dc >= 0 && c + dc < cols &&
      grid[r + dr][c + dc] === FLOOR

    const n = f(-1, 0)
    const s = f(1, 0)
    const w = f(0, -1)
    const e = f(0, 1)

    // Outer corners — floor on two adjacent sides (convex)
    if (s && e && !n && !w) return LAB_IMAGE_KEYS.CORNER_TL
    if (s && w && !n && !e) return LAB_IMAGE_KEYS.CORNER_TR
    if (n && e && !s && !w) return LAB_IMAGE_KEYS.CORNER_BL
    if (n && w && !s && !e) return LAB_IMAGE_KEYS.CORNER_BR

    // Edges — floor on one side
    if (s && !n && !w && !e) return LAB_IMAGE_KEYS.WALL_TOP
    if (n && !s && !w && !e) return LAB_IMAGE_KEYS.WALL_BOTTOM
    if (e && !n && !s && !w) return LAB_IMAGE_KEYS.WALL_LEFT
    if (w && !n && !s && !e) return LAB_IMAGE_KEYS.WALL_RIGHT

    // Interior divider walls — floor on opposite sides
    if (n && s) return LAB_IMAGE_KEYS.WALL_LEFT   // vertical divider
    if (e && w) return LAB_IMAGE_KEYS.WALL_TOP     // horizontal divider

    // T-junctions — floor on 3 sides
    if (n && s && e) return LAB_IMAGE_KEYS.WALL_LEFT
    if (n && s && w) return LAB_IMAGE_KEYS.WALL_RIGHT
    if (e && w && s) return LAB_IMAGE_KEYS.WALL_TOP
    if (e && w && n) return LAB_IMAGE_KEYS.WALL_BOTTOM

    // Floor on all 4 sides — shouldn't happen often
    if (n && s && e && w) return LAB_IMAGE_KEYS.HEX_FLOOR_A

    // Fallback — outer fill for isolated wall cells
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
  // Floor glow lights — cyan pools scattered on the floor
  // -------------------------------------------------------------------------

  private drawFloorGlows(
    grid: CellGrid,
    originX: number,
    originY: number,
    cols: number,
    rows: number,
    hash: number,
  ): void {
    const glowG = this.scene.add.graphics().setDepth(-2.8)
    this.tiles.push(glowG as unknown as Phaser.GameObjects.Image)

    // Place a few glow pools at deterministic floor positions
    const count = Math.min(8, Math.max(3, Math.floor((cols * rows) / 80)))
    for (let i = 0; i < count; i++) {
      const seed = (hash + i * 37) | 0
      const gc = 3 + (Math.abs(seed) % Math.max(1, cols - 6))
      const gr = 3 + (Math.abs(seed * 7) % Math.max(1, rows - 6))
      if (gr >= rows || gc >= cols || grid[gr][gc] !== FLOOR) continue

      const gx = originX + gc * CELL + CELL / 2
      const gy = originY + gr * CELL + CELL / 2

      glowG.fillStyle(0x38bdf8, 0.08)
      glowG.fillCircle(gx, gy, 30)
      glowG.fillStyle(0x22d3ee, 0.14)
      glowG.fillCircle(gx, gy, 16)
      glowG.fillStyle(0x7dd3fc, 0.22)
      glowG.fillCircle(gx, gy, 7)
    }
  }

  // -------------------------------------------------------------------------
  // Corridor pipe runs — pipes placed on floor cells between rooms
  // -------------------------------------------------------------------------

  private drawCorridorPipes(
    grid: CellGrid,
    rooms: FacilityRoom[],
    originX: number,
    originY: number,
    cols: number,
    rows: number,
  ): void {
    if (rooms.length < 2) return
    if (!this.scene.textures.exists(SPRITESHEET_KEYS.LAB_PIPES)) return

    const PIPE_SCALE = 0.25
    const PIPE_ALPHA = 0.8
    const PIPE_DEPTH = -2.5

    // Convert room bounds to grid coordinates
    const roomCells = rooms.map(r => ({
      c0: Math.floor((r.x - r.width / 2 - originX) / CELL),
      r0: Math.floor((r.y - r.height / 2 - originY) / CELL),
      c1: Math.ceil((r.x + r.width / 2 - originX) / CELL),
      r1: Math.ceil((r.y + r.height / 2 - originY) / CELL),
    }))

    // Helper: check if a grid cell is inside any room boundary
    const isInsideRoom = (gr: number, gc: number): boolean => {
      for (const rc of roomCells) {
        if (gr >= rc.r0 && gr < rc.r1 && gc >= rc.c0 && gc < rc.c1) return true
      }
      return false
    }

    // Helper: place a single pipe sprite
    const placePipe = (gr: number, gc: number, frame: number): void => {
      const wx = originX + gc * CELL + CELL / 2
      const wy = originY + gr * CELL + CELL / 2
      const spr = this.scene.add.sprite(wx, wy, SPRITESHEET_KEYS.LAB_PIPES, frame)
        .setScale(PIPE_SCALE)
        .setAlpha(PIPE_ALPHA)
        .setDepth(PIPE_DEPTH)
      this.pipeSprites.push(spr)
    }

    // ── Horizontal pipe runs between side-by-side rooms ──
    for (let i = 0; i < roomCells.length; i++) {
      for (let j = i + 1; j < roomCells.length; j++) {
        const a = roomCells[i]
        const b = roomCells[j]

        // Vertical overlap check
        const overlapR0 = Math.max(a.r0, b.r0)
        const overlapR1 = Math.min(a.r1, b.r1)
        if (overlapR1 <= overlapR0) continue

        // Determine left/right
        const leftRoom = a.c1 <= b.c0 ? a : b.c1 <= a.c0 ? b : null
        const rightRoom = leftRoom === a ? b : a
        if (!leftRoom) continue

        const gapC0 = leftRoom.c1
        const gapC1 = rightRoom.c0
        if (gapC1 - gapC0 > 8) continue // too far apart

        // Pick a row in the overlap region for the pipe run (offset from center
        // so we don't overlap with the door opening which is at the midpoint)
        const midR = Math.floor((overlapR0 + overlapR1) / 2)
        // Place pipe run 2 rows above the door opening center, or fall back near top
        const pipeRow = Math.max(overlapR0 + 1, midR - Math.floor(OPENING_WIDTH / 2) - 2)
        if (pipeRow < 0 || pipeRow >= rows) continue

        // Collect corridor columns for this run (floor cells not inside rooms)
        const runCols: number[] = []
        for (let c = gapC0; c < gapC1; c++) {
          if (c >= 0 && c < cols && grid[pipeRow][c] === FLOOR && !isInsideRoom(pipeRow, c)) {
            runCols.push(c)
          }
        }
        if (runCols.length === 0) continue

        // Place horizontal pipe sprites along the run
        for (let idx = 0; idx < runCols.length; idx++) {
          const c = runCols[idx]
          let frame: number
          if (idx === 0) {
            // Start cap / corner
            frame = PIPE_FRAMES.CORNER_TL
          } else if (idx === runCols.length - 1) {
            // End cap / corner
            frame = PIPE_FRAMES.CORNER_BR
          } else {
            frame = PIPE_FRAMES.HORIZ_TOP
          }
          placePipe(pipeRow, c, frame)
        }

        // Place valve at midpoint of the run
        if (runCols.length >= 3) {
          const midIdx = Math.floor(runCols.length / 2)
          const valveC = runCols[midIdx]
          const vwx = originX + valveC * CELL + CELL / 2
          const vwy = originY + pipeRow * CELL + CELL / 2
          const valve = this.scene.add.sprite(vwx, vwy, SPRITESHEET_KEYS.LAB_PIPES, PIPE_FRAMES.VALVE)
            .setScale(PIPE_SCALE)
            .setAlpha(PIPE_ALPHA)
            .setDepth(PIPE_DEPTH + 0.01) // slightly above pipes
          this.pipeSprites.push(valve)
        }
      }
    }

    // ── Vertical pipe runs between stacked rooms ──
    for (let i = 0; i < roomCells.length; i++) {
      for (let j = i + 1; j < roomCells.length; j++) {
        const a = roomCells[i]
        const b = roomCells[j]

        // Horizontal overlap check
        const overlapC0 = Math.max(a.c0, b.c0)
        const overlapC1 = Math.min(a.c1, b.c1)
        if (overlapC1 <= overlapC0) continue

        // Determine top/bottom
        const topRoom = a.r1 <= b.r0 ? a : b.r1 <= a.r0 ? b : null
        const bottomRoom = topRoom === a ? b : a
        if (!topRoom) continue

        const gapR0 = topRoom.r1
        const gapR1 = bottomRoom.r0
        if (gapR1 - gapR0 > 8) continue // too far apart

        // Pick a column for the pipe run (offset from door opening center)
        const midC = Math.floor((overlapC0 + overlapC1) / 2)
        const pipeCol = Math.max(overlapC0 + 1, midC - Math.floor(OPENING_WIDTH / 2) - 2)
        if (pipeCol < 0 || pipeCol >= cols) continue

        // Collect corridor rows for this run
        const runRows: number[] = []
        for (let r = gapR0; r < gapR1; r++) {
          if (r >= 0 && r < rows && grid[r][pipeCol] === FLOOR && !isInsideRoom(r, pipeCol)) {
            runRows.push(r)
          }
        }
        if (runRows.length === 0) continue

        // Place vertical pipe sprites along the run
        for (let idx = 0; idx < runRows.length; idx++) {
          const r = runRows[idx]
          let frame: number
          if (idx === 0) {
            // Start cap / corner
            frame = PIPE_FRAMES.CORNER_TL
          } else if (idx === runRows.length - 1) {
            // End cap / corner
            frame = PIPE_FRAMES.CORNER_BR
          } else {
            frame = PIPE_FRAMES.VERT_LEFT
          }
          placePipe(r, pipeCol, frame)
        }

        // Place valve at midpoint of the run
        if (runRows.length >= 3) {
          const midIdx = Math.floor(runRows.length / 2)
          const valveR = runRows[midIdx]
          const vwx = originX + pipeCol * CELL + CELL / 2
          const vwy = originY + valveR * CELL + CELL / 2
          const valve = this.scene.add.sprite(vwx, vwy, SPRITESHEET_KEYS.LAB_PIPES, PIPE_FRAMES.VALVE)
            .setScale(PIPE_SCALE)
            .setAlpha(PIPE_ALPHA)
            .setDepth(PIPE_DEPTH + 0.01)
          this.pipeSprites.push(valve)
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // Outer wall pipes — prominent pipe runs along building perimeter
  // -------------------------------------------------------------------------

  private drawOuterPipes(
    grid: CellGrid,
    originX: number,
    originY: number,
    cols: number,
    rows: number,
    hash: number,
  ): void {
    if (!this.scene.textures.exists(SPRITESHEET_KEYS.LAB_PIPES)) return

    const SCALE = 0.35
    const ALPHA = 0.88
    const DEPTH = -2.6

    const place = (r: number, c: number, frame: number) => {
      const wx = originX + c * CELL + CELL / 2
      const wy = originY + r * CELL + CELL / 2
      const spr = this.scene.add.sprite(wx, wy, SPRITESHEET_KEYS.LAB_PIPES, frame)
        .setScale(SCALE).setAlpha(ALPHA).setDepth(DEPTH)
      this.pipeSprites.push(spr)
    }

    // Find inner edge of the top wall (first floor row)
    let topFloorRow = -1, botFloorRow = -1
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (grid[r][c] === FLOOR) { topFloorRow = r; break }
      }
      if (topFloorRow >= 0) break
    }
    for (let r = rows - 1; r >= 0; r--) {
      for (let c = 0; c < cols; c++) {
        if (grid[r][c] === FLOOR) { botFloorRow = r; break }
      }
      if (botFloorRow >= 0) break
    }
    if (topFloorRow < 0 || botFloorRow < 0) return

    // Top wall pipe — horizontal run just inside the top wall
    const pipeR = topFloorRow
    let leftC = cols, rightC = 0
    for (let c = 0; c < cols; c++) {
      if (grid[pipeR][c] === FLOOR) { leftC = Math.min(leftC, c); rightC = Math.max(rightC, c) }
    }

    if (rightC - leftC > 2) {
      place(pipeR, leftC, PIPE_FRAMES.CORNER_TL)
      for (let c = leftC + 1; c < rightC; c++) {
        if (grid[pipeR][c] !== FLOOR) continue
        const frame = ((hash + c) % 6 === 0) ? PIPE_FRAMES.HORIZ_ARROW : PIPE_FRAMES.HORIZ_TOP
        place(pipeR, c, frame)
      }
      place(pipeR, rightC, PIPE_FRAMES.CORNER_TR)
      // Valve near midpoint
      const mid = Math.floor((leftC + rightC) / 2)
      if (grid[pipeR][mid] === FLOOR) {
        place(pipeR, mid, PIPE_FRAMES.VALVE)
      }
    }

    // Bottom wall pipe
    const botPipeR = botFloorRow
    let bLeftC = cols, bRightC = 0
    for (let c = 0; c < cols; c++) {
      if (grid[botPipeR][c] === FLOOR) { bLeftC = Math.min(bLeftC, c); bRightC = Math.max(bRightC, c) }
    }

    if (bRightC - bLeftC > 2) {
      place(botPipeR, bLeftC, PIPE_FRAMES.CORNER_BL)
      for (let c = bLeftC + 1; c < bRightC; c++) {
        if (grid[botPipeR][c] !== FLOOR) continue
        place(botPipeR, c, PIPE_FRAMES.HORIZ_TOP)
      }
      place(botPipeR, bRightC, PIPE_FRAMES.CORNER_BR)
    }

    // Left wall pipe — vertical run just inside the left wall
    let leftFloorCol = -1
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        if (grid[r][c] === FLOOR) { leftFloorCol = c; break }
      }
      if (leftFloorCol >= 0) break
    }
    if (leftFloorCol >= 0) {
      let lTopR = rows, lBotR = 0
      for (let r = 0; r < rows; r++) {
        if (grid[r][leftFloorCol] === FLOOR) { lTopR = Math.min(lTopR, r); lBotR = Math.max(lBotR, r) }
      }
      if (lBotR - lTopR > 2) {
        place(lTopR, leftFloorCol, PIPE_FRAMES.CORNER_TL)
        for (let r = lTopR + 1; r < lBotR; r++) {
          if (grid[r][leftFloorCol] !== FLOOR) continue
          place(r, leftFloorCol, PIPE_FRAMES.VERT_LEFT)
        }
        place(lBotR, leftFloorCol, PIPE_FRAMES.CORNER_BL)
        const midR = Math.floor((lTopR + lBotR) / 2)
        if (grid[midR][leftFloorCol] === FLOOR) place(midR, leftFloorCol, PIPE_FRAMES.VALVE)
      }
    }

    // Right wall pipe — vertical run just inside the right wall
    let rightFloorCol = -1
    for (let c = cols - 1; c >= 0; c--) {
      for (let r = 0; r < rows; r++) {
        if (grid[r][c] === FLOOR) { rightFloorCol = c; break }
      }
      if (rightFloorCol >= 0) break
    }
    if (rightFloorCol >= 0) {
      let rTopR = rows, rBotR = 0
      for (let r = 0; r < rows; r++) {
        if (grid[r][rightFloorCol] === FLOOR) { rTopR = Math.min(rTopR, r); rBotR = Math.max(rBotR, r) }
      }
      if (rBotR - rTopR > 2) {
        place(rTopR, rightFloorCol, PIPE_FRAMES.CORNER_TR)
        for (let r = rTopR + 1; r < rBotR; r++) {
          if (grid[r][rightFloorCol] !== FLOOR) continue
          place(r, rightFloorCol, PIPE_FRAMES.VERT_RIGHT)
        }
        place(rBotR, rightFloorCol, PIPE_FRAMES.CORNER_BR)
        const midR = Math.floor((rTopR + rBotR) / 2)
        if (grid[midR][rightFloorCol] === FLOOR) place(midR, rightFloorCol, PIPE_FRAMES.VALVE)
      }
    }
  }

  // -------------------------------------------------------------------------
  // Room decoration — wall-lining props, corner equipment, floor accents
  // -------------------------------------------------------------------------

  private decorateRooms(
    rooms: FacilityRoom[],
    _grid: CellGrid,
    _originX: number,
    _originY: number,
    _cols: number,
    _rows: number,
    hash: number,
  ): void {
    if (!this.scene.textures.exists(SPRITESHEET_KEYS.LAB_PROPS)) return

    // ── Desk positions for collision avoidance ──
    const DESK_CLEAR = 55
    const allDesks: { x: number; y: number }[] = []
    for (const r of rooms) {
      if (!r.deskPositions) continue
      for (const d of r.deskPositions) allDesks.push({ x: r.x + d.x, y: r.y + d.y })
    }
    const nearDesk = (wx: number, wy: number) =>
      allDesks.some(d => Math.abs(d.x - wx) < DESK_CLEAR && Math.abs(d.y - wy) < DESK_CLEAR)

    // Place a prop sprite scaled to a target display width
    const prop = (wx: number, wy: number, frame: string, displayW: number, alpha = 0.9, depth = -2) => {
      if (nearDesk(wx, wy)) return
      const spr = this.scene.add.sprite(wx, wy, SPRITESHEET_KEYS.LAB_PROPS, frame)
      spr.setScale(displayW / (spr.width || 100)).setAlpha(alpha).setDepth(depth)
      this.pipeSprites.push(spr)
    }

    // Cyan glow pool
    const glow = (wx: number, wy: number) => {
      const g = this.scene.add.graphics().setDepth(-2.7)
      g.fillStyle(0x22d3ee, 0.06); g.fillCircle(wx, wy, 28)
      g.fillStyle(0x22d3ee, 0.14); g.fillCircle(wx, wy, 14)
      g.fillStyle(0x7dd3fc, 0.28); g.fillCircle(wx, wy, 6)
      this.pipeSprites.push(g as unknown as Phaser.GameObjects.Sprite)
    }

    // =====================================================================
    // Per-room: deliberate wall-lining with composed console stations
    // =====================================================================

    for (let ri = 0; ri < rooms.length; ri++) {
      const room = rooms[ri]
      const rh = Math.abs(hash + ri * 97) | 0
      const L = room.x - room.width / 2
      const T = room.y - room.height / 2
      const R = room.x + room.width / 2
      const B = room.y + room.height / 2

      // ── TOP WALL: composed console stations ──
      {
        const stationW = 110
        const n = Math.max(1, Math.floor((room.width - 60) / stationW))
        const spacing = (room.width - 60) / n
        const screens = ['console_screen_wave_01', 'console_screen_lines_02', 'console_screen_wave_03', 'console_screen_lines_04']
        const controls = ['dial', 'numb_pad', 'console_led_on', 'joystick', 'stop_button']

        for (let i = 0; i < n; i++) {
          const cx = L + 30 + spacing * (i + 0.5)
          const cy = T + 22
          const isLong = i % 2 === 0
          prop(cx, cy, isLong ? 'blank_console_long' : 'blank_console_short', isLong ? 105 : 70, 0.92, -2.2)
          prop(cx, cy - 3, screens[(rh + i) % screens.length], isLong ? 28 : 22, 0.85, -2.1)
          if (isLong) {
            prop(cx - 24, cy + 8, controls[(rh + i) % controls.length], 14, 0.75, -2.1)
            prop(cx + 24, cy + 8, controls[(rh + i + 2) % controls.length], 14, 0.75, -2.1)
          }
        }
      }

      // ── BOTTOM WALL: equipment row (above header bar) ──
      {
        const botEquip = ['power_cell', 'chest_closed', 'unit_example_02', 'cable_cover']
        const n = Math.max(1, Math.floor((room.width - 60) / 100))
        const spacing = (room.width - 60) / n
        for (let i = 0; i < n; i++) {
          const cx = L + 30 + spacing * (i + 0.5)
          prop(cx, B - 30, botEquip[(rh + i) % botEquip.length], 60, 0.8, -2.2)
        }
      }

      // ── LEFT WALL: large equipment ──
      {
        const equip = ['generator', 'large_tank', 'pod', 'shelf', 'fan_unit_housing']
        const n = room.height > 200 ? 2 : 1
        const spacing = (room.height - 100) / n
        for (let i = 0; i < n; i++) {
          prop(L + 26, T + 60 + spacing * (i + 0.5), equip[(rh + i * 3) % equip.length], 65, 0.9, -2)
        }
      }

      // ── RIGHT WALL: large equipment ──
      {
        const equip = ['unit_large', 'console_example_corner', 'large_tank', 'generator', 'pod']
        const n = room.height > 200 ? 2 : 1
        const spacing = (room.height - 100) / n
        for (let i = 0; i < n; i++) {
          prop(R - 26, T + 60 + spacing * (i + 0.5), equip[(rh + i * 5 + 1) % equip.length], 65, 0.9, -2)
        }
      }

      // ── CORNERS: large centerpieces ──
      {
        const cp = ['lab_machine_01', 'dome', 'unit_example_03', 'unit_square']
        prop(L + 40, T + 40, cp[rh % cp.length], 75, 0.88, -1.9)
        prop(R - 40, T + 40, cp[(rh + 1) % cp.length], 70, 0.88, -1.9)
      }

      // ── FLOOR: 1 warning sign + 3 glow lights (left, center, right) ──
      {
        const signs = ['warning_biological', 'warning_power', 'warning_death']
        prop(L + 55, B - 38, signs[rh % signs.length], 26, 0.65, -2.5)
        glow(room.x - room.width * 0.25, room.y)
        glow(room.x, room.y - room.height * 0.1)
        glow(room.x + room.width * 0.25, room.y)
      }

      // ── PIPE RUN along top wall (behind consoles) ──
      if (this.scene.textures.exists(SPRITESHEET_KEYS.LAB_PIPES)) {
        const py = T + 6
        const x0 = L + 30, x1 = R - 30
        const step = 30, PS = 0.18, PD = -2.4

        this.pipeSprites.push(this.scene.add.sprite(x0, py, SPRITESHEET_KEYS.LAB_PIPES, PIPE_FRAMES.CORNER_TL).setScale(PS).setAlpha(0.7).setDepth(PD))
        for (let px = x0 + step; px < x1 - step; px += step) {
          const f = ((rh + Math.round(px)) % 8 === 0) ? PIPE_FRAMES.HORIZ_ARROW : PIPE_FRAMES.HORIZ_TOP
          this.pipeSprites.push(this.scene.add.sprite(px, py, SPRITESHEET_KEYS.LAB_PIPES, f).setScale(PS).setAlpha(0.7).setDepth(PD))
        }
        this.pipeSprites.push(this.scene.add.sprite(x1, py, SPRITESHEET_KEYS.LAB_PIPES, PIPE_FRAMES.CORNER_TR).setScale(PS).setAlpha(0.7).setDepth(PD))
        this.pipeSprites.push(this.scene.add.sprite((x0 + x1) / 2, py, SPRITESHEET_KEYS.LAB_PIPES, PIPE_FRAMES.VALVE).setScale(PS * 0.85).setAlpha(0.75).setDepth(PD + 0.01))
      }
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
