// ---------------------------------------------------------------------------
// WorkspaceUnifiedFloor — Lab-themed hex tile floor for the ENTIRE facility.
// Draws one big autotiled lab (walls + hex floor + corners) around all rooms.
// ---------------------------------------------------------------------------

import Phaser from 'phaser'
import { SPRITESHEET_KEYS, LAB_TILESET_FRAMES, PIPE_FRAMES } from './office-asset-keys'
import { LAB_TILE_SIZE } from './office-constants'

// ---------------------------------------------------------------------------
// Host interface
// ---------------------------------------------------------------------------

export interface UnifiedFloorHostScene {
  getLastLodLevel(): number
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
  ): void {
    this.cleanup()

    const hasLabTileset = this.scene.textures.exists(SPRITESHEET_KEYS.LAB_MAIN_TILESET)
    if (!hasLabTileset) return

    // ── Full autotiled hex floor with walls + corners ──
    const tileScale = 0.50
    const effectiveSize = LAB_TILE_SIZE * tileScale  // 64px cells
    const cols = Math.max(4, Math.floor(width / effectiveSize))
    const rows = Math.max(4, Math.floor(height / effectiveSize))

    // Center the grid
    const gridW = cols * effectiveSize
    const gridH = rows * effectiveSize
    const offsetX = x + (width - gridW) / 2
    const offsetY = y + (height - gridH) / 2

    // Simple hash for variety
    const hash = Math.abs(Math.floor(x * 7 + y * 13)) | 0

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const isTop = row === 0
        const isBottom = row === rows - 1
        const isLeft = col === 0
        const isRight = col === cols - 1

        let frame: number

        // ── Corners — thick variants for the facility walls ──
        if (isTop && isLeft)          frame = LAB_TILESET_FRAMES.CORNER_TL_THICK
        else if (isTop && isRight)    frame = LAB_TILESET_FRAMES.CORNER_TR_THICK
        else if (isBottom && isLeft)  frame = LAB_TILESET_FRAMES.CORNER_BL_THICK
        else if (isBottom && isRight) frame = LAB_TILESET_FRAMES.CORNER_BR_THICK
        // ── Edges — thick walls for the outer facility boundary ──
        else if (isTop) {
          const accent = (hash + col * 5) % 6
          frame = accent < 2 ? LAB_TILESET_FRAMES.WALL_TOP_THICK : LAB_TILESET_FRAMES.WALL_TOP
        }
        else if (isBottom) {
          const accent = (hash + col * 3) % 8
          if (accent === 0) frame = LAB_TILESET_FRAMES.WALL_BOTTOM_WINDOW_A
          else if (accent === 1) frame = LAB_TILESET_FRAMES.WALL_BOTTOM_THICK
          else frame = LAB_TILESET_FRAMES.WALL_BOTTOM
        }
        else if (isLeft)   frame = LAB_TILESET_FRAMES.WALL_LEFT
        else if (isRight)  frame = LAB_TILESET_FRAMES.WALL_RIGHT
        // ── Interior hex floor with variety ──
        else {
          const cellHash = (hash + row * 7 + col * 13) % 25
          if (cellHash === 0 && row > 2 && col > 2 && row < rows - 3 && col < cols - 3) {
            frame = LAB_TILESET_FRAMES.FLOOR_FEATURE
          } else {
            const floorVariant = (hash * 3 + row * 11 + col * 17) % 20
            if (floorVariant === 0)       frame = LAB_TILESET_FRAMES.HEX_FLOOR_B
            else if (floorVariant === 1)  frame = LAB_TILESET_FRAMES.HEX_FLOOR_C
            else if (floorVariant === 2)  frame = LAB_TILESET_FRAMES.HEX_FLOOR_D
            else if (floorVariant === 3)  frame = LAB_TILESET_FRAMES.HEX_FLOOR_B
            else                          frame = LAB_TILESET_FRAMES.HEX_FLOOR_A
          }
        }

        // ── Dense console equipment along inner wall edges ──
        // ~67% of inner wall cells get equipment (mod 3 instead of 5)
        if (!isTop && !isBottom && !isLeft && !isRight) {
          const isNearTop = row === 1
          const isNearBottom = row === rows - 2
          const isNearLeft = col === 1
          const isNearRight = col === cols - 2
          const cc = (hash + row * 3 + col * 7) % 3

          if (isNearTop && cc === 0)        frame = LAB_TILESET_FRAMES.CONSOLE_TOP
          else if (isNearTop && cc === 1)   frame = LAB_TILESET_FRAMES.CONSOLE_SMALL
          else if (isNearBottom && cc === 0) frame = LAB_TILESET_FRAMES.CONSOLE_BOT_RIGHT
          else if (isNearBottom && cc === 1) frame = LAB_TILESET_FRAMES.CONSOLE_BOT_LEFT
          else if (isNearLeft && cc === 0)   frame = LAB_TILESET_FRAMES.CONSOLE_LEFT
          else if (isNearLeft && cc === 1)   frame = LAB_TILESET_FRAMES.CONSOLE_LEFT_B
          else if (isNearRight && cc === 0)  frame = LAB_TILESET_FRAMES.CONSOLE_RIGHT
          else if (isNearRight && cc === 1)  frame = LAB_TILESET_FRAMES.CONSOLE_RIGHT_B
        }

        const tx = offsetX + col * effectiveSize + effectiveSize / 2
        const ty = offsetY + row * effectiveSize + effectiveSize / 2

        const tile = this.scene.add.sprite(tx, ty, SPRITESHEET_KEYS.LAB_MAIN_TILESET, frame)
          .setScale(tileScale)
          .setAlpha(0.92)
          .setDepth(-3)
        this.floorTiles.push(tile)
      }
    }

    // ── Exterior pipe runs along facility walls ──
    if (this.scene.textures.exists(SPRITESHEET_KEYS.LAB_PIPES)) {
      const pipeScale = 0.40
      const pipeAlpha = 0.88
      const pipeDepth = -2.5
      const pipeTint = 0x3b82f6  // blue tint matching corridors
      const pipeStep = effectiveSize * 0.7

      // Top exterior pipe run (horizontal, above facility)
      const topPipeY = y - 10
      for (let px = x + effectiveSize; px < x + width - effectiveSize; px += pipeStep) {
        const frame = ((px / pipeStep | 0) % 5 === 0) ? PIPE_FRAMES.HORIZ_ARROW : PIPE_FRAMES.HORIZ_TOP
        const pipe = this.scene.add.sprite(px, topPipeY, SPRITESHEET_KEYS.LAB_PIPES, frame)
          .setScale(pipeScale).setAlpha(pipeAlpha).setDepth(pipeDepth).setTint(pipeTint)
        this.floorTiles.push(pipe)
      }
      // Top pipe corners
      const topLeftCorner = this.scene.add.sprite(x + effectiveSize * 0.5, topPipeY, SPRITESHEET_KEYS.LAB_PIPES, PIPE_FRAMES.CORNER_TL)
        .setScale(pipeScale).setAlpha(pipeAlpha).setDepth(pipeDepth).setTint(pipeTint)
      this.floorTiles.push(topLeftCorner)
      const topRightCorner = this.scene.add.sprite(x + width - effectiveSize * 0.5, topPipeY, SPRITESHEET_KEYS.LAB_PIPES, PIPE_FRAMES.CORNER_TR)
        .setScale(pipeScale).setAlpha(pipeAlpha).setDepth(pipeDepth).setTint(pipeTint)
      this.floorTiles.push(topRightCorner)
      // Valve on top pipe
      const topValve = this.scene.add.sprite(x + width * 0.4, topPipeY, SPRITESHEET_KEYS.LAB_PIPES, PIPE_FRAMES.VALVE)
        .setScale(pipeScale * 0.9).setAlpha(pipeAlpha * 0.95).setDepth(pipeDepth + 0.1).setTint(0x44aaff)
      this.floorTiles.push(topValve)

      // Right exterior pipe run (vertical, right of facility)
      const rightPipeX = x + width + 10
      for (let py = y + effectiveSize; py < y + height - effectiveSize; py += pipeStep) {
        const frame = ((py / pipeStep | 0) % 6 === 0) ? PIPE_FRAMES.VERT_ARROW : PIPE_FRAMES.VERT_RIGHT
        const pipe = this.scene.add.sprite(rightPipeX, py, SPRITESHEET_KEYS.LAB_PIPES, frame)
          .setScale(pipeScale).setAlpha(pipeAlpha).setDepth(pipeDepth).setTint(pipeTint)
        this.floorTiles.push(pipe)
      }
      // T-connector on right pipe
      const rightT = this.scene.add.sprite(rightPipeX, y + height * 0.5, SPRITESHEET_KEYS.LAB_PIPES, PIPE_FRAMES.T_LEFT)
        .setScale(pipeScale).setAlpha(pipeAlpha).setDepth(pipeDepth).setTint(pipeTint)
      this.floorTiles.push(rightT)
      // Coupling on right pipe
      const rightCoupling = this.scene.add.sprite(rightPipeX, y + height * 0.3, SPRITESHEET_KEYS.LAB_PIPES, PIPE_FRAMES.COUPLING_VERT)
        .setScale(pipeScale * 0.85).setAlpha(pipeAlpha * 0.9).setDepth(pipeDepth + 0.1).setTint(pipeTint)
      this.floorTiles.push(rightCoupling)

      // Bottom exterior pipe run (horizontal, below facility)
      const botPipeY = y + height + 10
      for (let px = x + effectiveSize; px < x + width - effectiveSize; px += pipeStep) {
        const frame = ((px / pipeStep | 0) % 4 === 0) ? PIPE_FRAMES.HORIZ_ARROW : PIPE_FRAMES.HORIZ_TOP
        const pipe = this.scene.add.sprite(px, botPipeY, SPRITESHEET_KEYS.LAB_PIPES, frame)
          .setScale(pipeScale).setAlpha(pipeAlpha).setDepth(pipeDepth).setTint(pipeTint)
        this.floorTiles.push(pipe)
      }
      // Bottom corners
      const botRightCorner = this.scene.add.sprite(x + width - effectiveSize * 0.5, botPipeY, SPRITESHEET_KEYS.LAB_PIPES, PIPE_FRAMES.CORNER_BR)
        .setScale(pipeScale).setAlpha(pipeAlpha).setDepth(pipeDepth).setTint(pipeTint)
      this.floorTiles.push(botRightCorner)
      const botLeftCorner = this.scene.add.sprite(x + effectiveSize * 0.5, botPipeY, SPRITESHEET_KEYS.LAB_PIPES, PIPE_FRAMES.CORNER_BL)
        .setScale(pipeScale).setAlpha(pipeAlpha).setDepth(pipeDepth).setTint(pipeTint)
      this.floorTiles.push(botLeftCorner)
      // Valve on bottom pipe
      const botValve = this.scene.add.sprite(x + width * 0.6, botPipeY, SPRITESHEET_KEYS.LAB_PIPES, PIPE_FRAMES.VALVE)
        .setScale(pipeScale * 0.9).setAlpha(pipeAlpha * 0.95).setDepth(pipeDepth + 0.1).setTint(0x44aaff)
      this.floorTiles.push(botValve)

      // Left exterior pipe run (vertical, left of facility) — full length
      const leftPipeX = x - 10
      for (let py = y + effectiveSize; py < y + height - effectiveSize; py += pipeStep) {
        const frame = ((py / pipeStep | 0) % 5 === 0) ? PIPE_FRAMES.VERT_ARROW : PIPE_FRAMES.VERT_LEFT
        const pipe = this.scene.add.sprite(leftPipeX, py, SPRITESHEET_KEYS.LAB_PIPES, frame)
          .setScale(pipeScale).setAlpha(pipeAlpha).setDepth(pipeDepth).setTint(pipeTint)
        this.floorTiles.push(pipe)
      }
      // Cap on left pipe
      const leftCap = this.scene.add.sprite(leftPipeX, y + effectiveSize * 0.5, SPRITESHEET_KEYS.LAB_PIPES, PIPE_FRAMES.CAP_TOP)
        .setScale(pipeScale).setAlpha(pipeAlpha).setDepth(pipeDepth).setTint(pipeTint)
      this.floorTiles.push(leftCap)
      // T-connector on left pipe
      const leftT = this.scene.add.sprite(leftPipeX, y + height * 0.5, SPRITESHEET_KEYS.LAB_PIPES, PIPE_FRAMES.T_RIGHT)
        .setScale(pipeScale).setAlpha(pipeAlpha).setDepth(pipeDepth).setTint(pipeTint)
      this.floorTiles.push(leftT)
    }

    // ── Cyan glow pools scattered across the facility — bright like reference ──
    this.glowGraphics = this.scene.add.graphics().setDepth(-2.5)
    const gg = this.glowGraphics
    const glowCount = Math.max(6, Math.floor((cols * rows) / 12))
    for (let i = 0; i < glowCount; i++) {
      const seed = (hash + i * 31) | 0
      const gc = 2 + (seed % Math.max(1, cols - 4))
      const gr = 2 + ((seed * 7) % Math.max(1, rows - 4))
      const gx = offsetX + gc * effectiveSize + effectiveSize / 2
      const gy = offsetY + gr * effectiveSize + effectiveSize / 2

      gg.fillStyle(0x00e5ff, 0.15)
      gg.fillCircle(gx, gy, 32)
      gg.fillStyle(0x00e5ff, 0.35)
      gg.fillCircle(gx, gy, 18)
      gg.fillStyle(0x00e5ff, 0.60)
      gg.fillCircle(gx, gy, 9)
      gg.fillStyle(0xffffff, 0.30)
      gg.fillCircle(gx, gy, 4)
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
    const AY = 0.80  // yellow alpha
    const AD = 0.60  // dark alpha

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
