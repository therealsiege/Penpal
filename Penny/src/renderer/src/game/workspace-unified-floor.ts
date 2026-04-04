// ---------------------------------------------------------------------------
// WorkspaceUnifiedFloor — Lab-themed hex tile floor for the ENTIRE facility.
// Draws one big autotiled lab (walls + hex floor + corners) around all rooms.
// ---------------------------------------------------------------------------

import Phaser from 'phaser'
import { SPRITESHEET_KEYS, LAB_TILESET_FRAMES, LAB_IMAGE_KEYS } from './office-asset-keys'
import { LAB_TILE_SIZE } from './office-constants'

// ---------------------------------------------------------------------------
// Host interface
// ---------------------------------------------------------------------------

export interface UnifiedFloorHostScene {
  getLastLodLevel(): number
}

/** World-space room floor footprints (e.g. from labRoomFloorWorldRect) for corridor strips between zones. */
export interface UnifiedFloorDrawOpts {
  roomFloorRects?: Array<{ x: number; y: number; width: number; height: number }>
}

function verticalCorridorGaps(
  roomFloors: Array<{ x: number; y: number; width: number; height: number }>,
): Array<{ minX: number; maxX: number }> {
  if (roomFloors.length < 2) return []
  const sorted = [...roomFloors].sort((a, b) => a.x - b.x)
  const gaps: Array<{ minX: number; maxX: number }> = []
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i]
    const b = sorted[i + 1]
    const aRight = a.x + a.width
    const bLeft = b.x
    if (bLeft > aRight + 4) gaps.push({ minX: aRight, maxX: bLeft })
  }
  return gaps
}

function columnSpansCorridorGap(
  cellLeft: number,
  cellRight: number,
  gaps: Array<{ minX: number; maxX: number }>,
  minOverlap: number,
): boolean {
  for (const g of gaps) {
    const lo = Math.max(cellLeft, g.minX)
    const hi = Math.min(cellRight, g.maxX)
    if (hi - lo >= minOverlap) return true
  }
  return false
}

// ---------------------------------------------------------------------------
// WorkspaceUnifiedFloor
// ---------------------------------------------------------------------------

export class WorkspaceUnifiedFloor {
  private scene: Phaser.Scene
  private host: UnifiedFloorHostScene

  // Managed sprites — cleaned up on each redraw or destroy
  private floorTiles: Phaser.GameObjects.Sprite[] = []
  private hazardGraphics: Phaser.GameObjects.Graphics | null = null
  private glowGraphics: Phaser.GameObjects.Graphics | null = null

  constructor(scene: Phaser.Scene, host: UnifiedFloorHostScene) {
    this.scene = scene
    this.host = host
  }

  // -------------------------------------------------------------------------
  // drawFloor — render full autotiled lab for the entire facility bounding box
  // -------------------------------------------------------------------------

  drawFloor(
    x: number,
    y: number,
    width: number,
    height: number,
    _teamColor: number,
    opts?: UnifiedFloorDrawOpts,
  ): void {
    this.cleanup()

    if (!this.scene.textures.exists(LAB_IMAGE_KEYS.HEX_FLOOR_A)) return

    // ── Full autotiled hex floor with walls + corners ──
    const tileScale = 0.85
    const effectiveSize = LAB_TILE_SIZE * tileScale  // ~109px cells
    const cols = Math.max(4, Math.floor(width / effectiveSize))
    const rows = Math.max(4, Math.floor(height / effectiveSize))

    // Center the grid
    const gridW = cols * effectiveSize
    const gridH = rows * effectiveSize
    const offsetX = Math.round(x + (width - gridW) / 2)
    const offsetY = Math.round(y + (height - gridH) / 2)

    const gapBands = opts?.roomFloorRects ? verticalCorridorGaps(opts.roomFloorRects) : []

    const hash = Math.abs(Math.floor(x * 7 + y * 13)) | 0

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const isTop = row === 0
        const isBottom = row === rows - 1
        const isLeft = col === 0
        const isRight = col === cols - 1

        const cellLeft = offsetX + col * effectiveSize
        const cellRight = cellLeft + effectiveSize
        const isCorridorCol =
          gapBands.length > 0 &&
          !isLeft &&
          !isRight &&
          columnSpansCorridorGap(cellLeft, cellRight, gapBands, 8)

        let imageKey: string

        // ── Corners ──
        if (isTop && isLeft)          imageKey = LAB_IMAGE_KEYS.CORNER_TL
        else if (isTop && isRight)    imageKey = LAB_IMAGE_KEYS.CORNER_TR
        else if (isBottom && isLeft)  imageKey = LAB_IMAGE_KEYS.CORNER_BL
        else if (isBottom && isRight) imageKey = LAB_IMAGE_KEYS.CORNER_BR
        // ── Inter-zone corridor columns ──
        else if (isCorridorCol && isTop)    imageKey = LAB_IMAGE_KEYS.WALL_TOP
        else if (isCorridorCol && isBottom) imageKey = LAB_IMAGE_KEYS.WALL_BOTTOM
        else if (isCorridorCol) {
          const floorVariant = (hash * 3 + row * 11 + col * 17) % 10
          imageKey = floorVariant < 2 ? LAB_IMAGE_KEYS.HEX_FLOOR_B : LAB_IMAGE_KEYS.HEX_FLOOR_A
        }
        // ── Edges ──
        else if (isTop)    imageKey = LAB_IMAGE_KEYS.WALL_TOP
        else if (isBottom) imageKey = LAB_IMAGE_KEYS.WALL_BOTTOM
        else if (isLeft)   imageKey = LAB_IMAGE_KEYS.WALL_LEFT
        else if (isRight)  imageKey = LAB_IMAGE_KEYS.WALL_RIGHT
        // ── Interior hex floor ──
        else {
          const floorVariant = (hash * 3 + row * 11 + col * 17) % 10
          imageKey = floorVariant < 2 ? LAB_IMAGE_KEYS.HEX_FLOOR_B : LAB_IMAGE_KEYS.HEX_FLOOR_A
        }

        const tx = offsetX + col * effectiveSize + effectiveSize / 2
        const ty = offsetY + row * effectiveSize + effectiveSize / 2

        const tile = this.scene.add.image(tx, ty, imageKey)
          .setScale(tileScale)
          .setAlpha(1)
          .setDepth(-3)
        this.floorTiles.push(tile)
      }
    }

    // ── Subtle floor ambience — few soft pools (was overcrowded vs room props)
    this.glowGraphics = this.scene.add.graphics().setDepth(-2.5)
    const gg = this.glowGraphics
    const glowCount = Math.min(4, Math.max(2, Math.floor((cols * rows) / 45)))
    for (let i = 0; i < glowCount; i++) {
      const seed = (hash + i * 31) | 0
      const gc = 2 + (seed % Math.max(1, cols - 4))
      const gr = 2 + ((seed * 7) % Math.max(1, rows - 4))
      const gx = offsetX + gc * effectiveSize + effectiveSize / 2
      const gy = offsetY + gr * effectiveSize + effectiveSize / 2

      gg.fillStyle(0x38bdf8, 0.09)
      gg.fillCircle(gx, gy, 42)
      gg.fillStyle(0x22d3ee, 0.14)
      gg.fillCircle(gx, gy, 24)
      gg.fillStyle(0x7dd3fc, 0.2)
      gg.fillCircle(gx, gy, 11)
    }

    // ── Hazard tape along inner perimeter + laser door openings ──
    if (!this.hazardGraphics) {
      this.hazardGraphics = this.scene.add.graphics().setDepth(-2.9)
    }
    const hg = this.hazardGraphics
    hg.clear()

    const YELLOW = 0xfbbf24
    const DARK = 0x1a1a2e
    const SEG = 10
    const TAPE_W = 8
    // Subdued vs outer tile hazard — reads as trim, not a second heavy border.
    const AY = 0.44
    const AD = 0.33

    // Laser door config — deterministic positions via hash
    const DOOR_GAP = 50  // px gap for laser door opening
    const LASER_COLOR = 0xff3333
    const LASER_ALPHA = 0.70
    const EMITTER_R = 3

    // Compute door positions for each wall
    const doorSpacing = Math.max(3, Math.floor(cols / 4))
    const topDoors = new Set<number>()
    const bottomDoors = new Set<number>()
    const leftDoors = new Set<number>()
    const rightDoors = new Set<number>()
    for (let d = 0; d < 3; d++) {
      const tc = 2 + ((hash + d * 7) % Math.max(1, cols - 4))
      topDoors.add(tc)
      const bc = 2 + ((hash + d * 11 + 3) % Math.max(1, cols - 4))
      bottomDoors.add(bc)
    }
    for (let d = 0; d < 2; d++) {
      const lr = 2 + ((hash + d * 13) % Math.max(1, rows - 4))
      leftDoors.add(lr)
      const rr = 2 + ((hash + d * 17 + 5) % Math.max(1, rows - 4))
      rightDoors.add(rr)
    }

    // Helper: draw alternating hazard tape segment
    const drawTapeH = (sx: number, ex: number, ty: number) => {
      let pos = sx
      let isY = true
      while (pos < ex) {
        const len = Math.min(SEG, ex - pos)
        hg.fillStyle(isY ? YELLOW : DARK, isY ? AY : AD)
        hg.fillRect(pos, ty, len, TAPE_W)
        pos += SEG
        isY = !isY
      }
    }

    const drawTapeV = (tx: number, sy: number, ey: number) => {
      let pos = sy
      let isY = true
      while (pos < ey) {
        const len = Math.min(SEG, ey - pos)
        hg.fillStyle(isY ? YELLOW : DARK, isY ? AY : AD)
        hg.fillRect(tx, pos, TAPE_W, len)
        pos += SEG
        isY = !isY
      }
    }

    // Top inner wall — hazard tape at row 1 bottom edge
    const topTapeY = offsetY + effectiveSize - TAPE_W / 2
    {
      let sx = offsetX + effectiveSize
      const ex = offsetX + (cols - 1) * effectiveSize
      // Draw tape with gaps for doors
      for (let c = 1; c < cols - 1; c++) {
        const cellX = offsetX + c * effectiveSize
        if (topDoors.has(c)) {
          // Draw tape up to door, skip gap, draw laser line
          drawTapeH(sx, cellX, topTapeY)
          const doorEnd = cellX + DOOR_GAP
          // Laser line across opening
          hg.lineStyle(2, LASER_COLOR, LASER_ALPHA)
          hg.lineBetween(cellX, topTapeY + TAPE_W / 2, Math.min(doorEnd, ex), topTapeY + TAPE_W / 2)
          // Emitter dots
          hg.fillStyle(LASER_COLOR, 0.85)
          hg.fillCircle(cellX, topTapeY + TAPE_W / 2, EMITTER_R)
          hg.fillCircle(Math.min(doorEnd, ex), topTapeY + TAPE_W / 2, EMITTER_R)
          sx = doorEnd
        }
      }
      drawTapeH(sx, ex, topTapeY)
    }

    // Bottom inner wall — hazard tape at row rows-2 top edge
    const botTapeY = offsetY + (rows - 2) * effectiveSize
    {
      let sx = offsetX + effectiveSize
      const ex = offsetX + (cols - 1) * effectiveSize
      for (let c = 1; c < cols - 1; c++) {
        const cellX = offsetX + c * effectiveSize
        if (bottomDoors.has(c)) {
          drawTapeH(sx, cellX, botTapeY)
          const doorEnd = cellX + DOOR_GAP
          hg.lineStyle(2, LASER_COLOR, LASER_ALPHA)
          hg.lineBetween(cellX, botTapeY + TAPE_W / 2, Math.min(doorEnd, ex), botTapeY + TAPE_W / 2)
          hg.fillStyle(LASER_COLOR, 0.85)
          hg.fillCircle(cellX, botTapeY + TAPE_W / 2, EMITTER_R)
          hg.fillCircle(Math.min(doorEnd, ex), botTapeY + TAPE_W / 2, EMITTER_R)
          sx = doorEnd
        }
      }
      drawTapeH(sx, ex, botTapeY)
    }

    // Left inner wall — hazard tape at col 1 right edge
    const leftTapeX = offsetX + effectiveSize - TAPE_W / 2
    {
      let sy = offsetY + effectiveSize
      const ey = offsetY + (rows - 1) * effectiveSize
      for (let r = 1; r < rows - 1; r++) {
        const cellY = offsetY + r * effectiveSize
        if (leftDoors.has(r)) {
          drawTapeV(leftTapeX, sy, cellY)
          const doorEnd = cellY + DOOR_GAP
          hg.lineStyle(2, LASER_COLOR, LASER_ALPHA)
          hg.lineBetween(leftTapeX + TAPE_W / 2, cellY, leftTapeX + TAPE_W / 2, Math.min(doorEnd, ey))
          hg.fillStyle(LASER_COLOR, 0.85)
          hg.fillCircle(leftTapeX + TAPE_W / 2, cellY, EMITTER_R)
          hg.fillCircle(leftTapeX + TAPE_W / 2, Math.min(doorEnd, ey), EMITTER_R)
          sy = doorEnd
        }
      }
      drawTapeV(leftTapeX, sy, ey)
    }

    // Right inner wall — hazard tape at col cols-2 left edge
    const rightTapeX = offsetX + (cols - 2) * effectiveSize
    {
      let sy = offsetY + effectiveSize
      const ey = offsetY + (rows - 1) * effectiveSize
      for (let r = 1; r < rows - 1; r++) {
        const cellY = offsetY + r * effectiveSize
        if (rightDoors.has(r)) {
          drawTapeV(rightTapeX, sy, cellY)
          const doorEnd = cellY + DOOR_GAP
          hg.lineStyle(2, LASER_COLOR, LASER_ALPHA)
          hg.lineBetween(rightTapeX + TAPE_W / 2, cellY, rightTapeX + TAPE_W / 2, Math.min(doorEnd, ey))
          hg.fillStyle(LASER_COLOR, 0.85)
          hg.fillCircle(rightTapeX + TAPE_W / 2, cellY, EMITTER_R)
          hg.fillCircle(rightTapeX + TAPE_W / 2, Math.min(doorEnd, ey), EMITTER_R)
          sy = doorEnd
        }
      }
      drawTapeV(rightTapeX, sy, ey)
    }
  }

  // -------------------------------------------------------------------------
  // LOD visibility
  // -------------------------------------------------------------------------

  applyLod(lodLevel: number): void {
    const visible = lodLevel >= 2
    for (const tile of this.floorTiles) tile.setVisible(visible)
    if (this.hazardGraphics) this.hazardGraphics.setVisible(visible)
    if (this.glowGraphics) this.glowGraphics.setVisible(visible)
  }

  // -------------------------------------------------------------------------
  // Cleanup
  // -------------------------------------------------------------------------

  cleanup(): void {
    for (const tile of this.floorTiles) tile.destroy()
    this.floorTiles = []
    if (this.hazardGraphics) { this.hazardGraphics.destroy(); this.hazardGraphics = null }
    if (this.glowGraphics) { this.glowGraphics.destroy(); this.glowGraphics = null }
  }

  destroy(): void {
    this.cleanup()
  }
}
