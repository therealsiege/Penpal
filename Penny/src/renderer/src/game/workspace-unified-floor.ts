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

        // ── Console equipment along inner wall edges (deterministic) ──
        if (!isTop && !isBottom && !isLeft && !isRight) {
          const isNearTop = row === 1
          const isNearBottom = row === rows - 2
          const isNearLeft = col === 1
          const isNearRight = col === cols - 2
          const consoleChance = (hash + row * 3 + col * 7) % 5

          if (isNearTop && consoleChance === 0)          frame = LAB_TILESET_FRAMES.CONSOLE_TOP
          else if (isNearTop && consoleChance === 4)     frame = LAB_TILESET_FRAMES.CONSOLE_BOT_LEFT
          else if (isNearBottom && consoleChance === 1)   frame = LAB_TILESET_FRAMES.CONSOLE_SMALL
          else if (isNearLeft && consoleChance === 2)     frame = LAB_TILESET_FRAMES.CONSOLE_LEFT
          else if (isNearLeft && consoleChance === 4)     frame = LAB_TILESET_FRAMES.CONSOLE_LEFT_B
          else if (isNearRight && consoleChance === 3)    frame = LAB_TILESET_FRAMES.CONSOLE_RIGHT
          else if (isNearRight && consoleChance === 4)    frame = LAB_TILESET_FRAMES.CONSOLE_RIGHT_B
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
      const pipeScale = 0.30
      const pipeAlpha = 0.80
      const pipeDepth = -2.8
      const pipeStep = effectiveSize * 0.8  // slightly less than tile size for overlap

      // Top exterior pipe run (horizontal, above facility)
      const topPipeY = y - 10
      for (let px = x + effectiveSize; px < x + width - effectiveSize; px += pipeStep) {
        const frame = ((px / pipeStep | 0) % 5 === 0) ? PIPE_FRAMES.HORIZ_ARROW : PIPE_FRAMES.HORIZ_TOP
        const pipe = this.scene.add.sprite(px, topPipeY, SPRITESHEET_KEYS.LAB_PIPES, frame)
          .setScale(pipeScale).setAlpha(pipeAlpha).setDepth(pipeDepth)
        this.floorTiles.push(pipe)
      }
      // Top pipe corners
      const topLeftCorner = this.scene.add.sprite(x + effectiveSize * 0.5, topPipeY, SPRITESHEET_KEYS.LAB_PIPES, PIPE_FRAMES.CORNER_TL)
        .setScale(pipeScale).setAlpha(pipeAlpha).setDepth(pipeDepth)
      this.floorTiles.push(topLeftCorner)
      const topRightCorner = this.scene.add.sprite(x + width - effectiveSize * 0.5, topPipeY, SPRITESHEET_KEYS.LAB_PIPES, PIPE_FRAMES.CORNER_TR)
        .setScale(pipeScale).setAlpha(pipeAlpha).setDepth(pipeDepth)
      this.floorTiles.push(topRightCorner)
      // Valve on top pipe
      const topValve = this.scene.add.sprite(x + width * 0.4, topPipeY, SPRITESHEET_KEYS.LAB_PIPES, PIPE_FRAMES.VALVE)
        .setScale(pipeScale * 0.9).setAlpha(pipeAlpha * 0.95).setDepth(pipeDepth + 0.1)
      this.floorTiles.push(topValve)

      // Right exterior pipe run (vertical, right of facility)
      const rightPipeX = x + width + 10
      for (let py = y + effectiveSize; py < y + height - effectiveSize; py += pipeStep) {
        const frame = ((py / pipeStep | 0) % 6 === 0) ? PIPE_FRAMES.VERT_ARROW : PIPE_FRAMES.VERT_RIGHT
        const pipe = this.scene.add.sprite(rightPipeX, py, SPRITESHEET_KEYS.LAB_PIPES, frame)
          .setScale(pipeScale).setAlpha(pipeAlpha).setDepth(pipeDepth)
        this.floorTiles.push(pipe)
      }
      // T-connector on right pipe
      const rightT = this.scene.add.sprite(rightPipeX, y + height * 0.5, SPRITESHEET_KEYS.LAB_PIPES, PIPE_FRAMES.T_LEFT)
        .setScale(pipeScale).setAlpha(pipeAlpha).setDepth(pipeDepth)
      this.floorTiles.push(rightT)
      // Coupling on right pipe
      const rightCoupling = this.scene.add.sprite(rightPipeX, y + height * 0.3, SPRITESHEET_KEYS.LAB_PIPES, PIPE_FRAMES.COUPLING_VERT)
        .setScale(pipeScale * 0.85).setAlpha(pipeAlpha * 0.9).setDepth(pipeDepth + 0.1)
      this.floorTiles.push(rightCoupling)

      // Bottom exterior pipe run (horizontal, below facility)
      const botPipeY = y + height + 10
      for (let px = x + effectiveSize; px < x + width - effectiveSize; px += pipeStep) {
        const frame = ((px / pipeStep | 0) % 4 === 0) ? PIPE_FRAMES.HORIZ_ARROW : PIPE_FRAMES.HORIZ_TOP
        const pipe = this.scene.add.sprite(px, botPipeY, SPRITESHEET_KEYS.LAB_PIPES, frame)
          .setScale(pipeScale).setAlpha(pipeAlpha).setDepth(pipeDepth)
        this.floorTiles.push(pipe)
      }
      // Bottom corners connecting to right pipe
      const botRightCorner = this.scene.add.sprite(x + width - effectiveSize * 0.5, botPipeY, SPRITESHEET_KEYS.LAB_PIPES, PIPE_FRAMES.CORNER_BR)
        .setScale(pipeScale).setAlpha(pipeAlpha).setDepth(pipeDepth)
      this.floorTiles.push(botRightCorner)
      const botLeftCorner = this.scene.add.sprite(x + effectiveSize * 0.5, botPipeY, SPRITESHEET_KEYS.LAB_PIPES, PIPE_FRAMES.CORNER_BL)
        .setScale(pipeScale).setAlpha(pipeAlpha).setDepth(pipeDepth)
      this.floorTiles.push(botLeftCorner)
      // Valve on bottom pipe
      const botValve = this.scene.add.sprite(x + width * 0.6, botPipeY, SPRITESHEET_KEYS.LAB_PIPES, PIPE_FRAMES.VALVE)
        .setScale(pipeScale * 0.9).setAlpha(pipeAlpha * 0.95).setDepth(pipeDepth + 0.1)
      this.floorTiles.push(botValve)

      // Left exterior pipe run (vertical, left of facility) — shorter run
      const leftPipeX = x - 10
      for (let py = y + effectiveSize * 2; py < y + height * 0.6; py += pipeStep) {
        const pipe = this.scene.add.sprite(leftPipeX, py, SPRITESHEET_KEYS.LAB_PIPES, PIPE_FRAMES.VERT_LEFT)
          .setScale(pipeScale).setAlpha(pipeAlpha).setDepth(pipeDepth)
        this.floorTiles.push(pipe)
      }
      // Cap on left pipe
      const leftCap = this.scene.add.sprite(leftPipeX, y + effectiveSize * 1.5, SPRITESHEET_KEYS.LAB_PIPES, PIPE_FRAMES.CAP_TOP)
        .setScale(pipeScale).setAlpha(pipeAlpha).setDepth(pipeDepth)
      this.floorTiles.push(leftCap)
    }

    // ── Cyan glow pools scattered across the facility ──
    this.glowGraphics = this.scene.add.graphics().setDepth(-2.8)
    const gg = this.glowGraphics
    const glowCount = Math.max(4, Math.floor((cols * rows) / 18))
    for (let i = 0; i < glowCount; i++) {
      const seed = (hash + i * 31) | 0
      const gc = 2 + (seed % Math.max(1, cols - 4))
      const gr = 2 + ((seed * 7) % Math.max(1, rows - 4))
      const gx = offsetX + gc * effectiveSize + effectiveSize / 2
      const gy = offsetY + gr * effectiveSize + effectiveSize / 2

      gg.fillStyle(0x00e5ff, 0.12)
      gg.fillCircle(gx, gy, 24)
      gg.fillStyle(0x00e5ff, 0.28)
      gg.fillCircle(gx, gy, 14)
      gg.fillStyle(0x00e5ff, 0.50)
      gg.fillCircle(gx, gy, 7)
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
