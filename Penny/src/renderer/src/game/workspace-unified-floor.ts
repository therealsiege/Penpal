// ---------------------------------------------------------------------------
// WorkspaceUnifiedFloor — Lab-themed hex tile floor for team area backgrounds
// Replaces procedural floor rendering with LAB_MAIN_TILESET sprite tiles.
// Retains hazard stripe perimeter and mako glow pool accents.
// ---------------------------------------------------------------------------

import Phaser from 'phaser'
import { SPRITESHEET_KEYS, LAB_TILESET_FRAMES, LAB_PROP_FRAMES } from './office-asset-keys'
import { LAB_TILE_SIZE } from './office-constants'
import { activeTheme } from './office-theme'

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
  // drawFloor — render hex tile floor for a team area bounding box
  // -------------------------------------------------------------------------

  drawFloor(
    x: number,
    y: number,
    width: number,
    height: number,
    teamColor: number,
  ): void {
    this.cleanup()

    const hasLabTileset = this.scene.textures.exists(SPRITESHEET_KEYS.LAB_MAIN_TILESET)
    if (!hasLabTileset) return

    const tileScale = 0.30
    const effectiveSize = LAB_TILE_SIZE * tileScale
    const cols = Math.ceil(width / effectiveSize)
    const rows = Math.ceil(height / effectiveSize)

    // Tile hex floor sprites across the team area
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const frame = (row + col) % 2 === 0
          ? LAB_TILESET_FRAMES.HEX_FLOOR_A
          : LAB_TILESET_FRAMES.HEX_FLOOR_B
        const tx = x + col * effectiveSize + effectiveSize / 2
        const ty = y + row * effectiveSize + effectiveSize / 2
        if (tx - effectiveSize / 2 > x + width || ty - effectiveSize / 2 > y + height) continue

        const tile = this.scene.add.sprite(tx, ty, SPRITESHEET_KEYS.LAB_MAIN_TILESET, frame)
          .setScale(tileScale)
          .setAlpha(0.18)
          .setDepth(-3)
        this.floorTiles.push(tile)
      }
    }

    // Hazard stripe perimeter — yellow/black chevrons along edges
    this.hazardGraphics = this.scene.add.graphics().setDepth(-2.8)
    const g = this.hazardGraphics
    const chevronW = 12
    const chevronH = 6
    const yellow = 0xd4a017
    const black = activeTheme.bg
    const hazardAlpha = 0.18

    // Top edge
    for (let hx = x + 4; hx < x + width - 4; hx += chevronW * 2) {
      g.fillStyle(yellow, hazardAlpha)
      g.fillRect(hx, y + 2, chevronW, chevronH)
      g.fillStyle(black, hazardAlpha)
      g.fillRect(hx + chevronW, y + 2, chevronW, chevronH)
    }
    // Bottom edge
    for (let hx = x + 4; hx < x + width - 4; hx += chevronW * 2) {
      g.fillStyle(yellow, hazardAlpha)
      g.fillRect(hx, y + height - chevronH - 2, chevronW, chevronH)
      g.fillStyle(black, hazardAlpha)
      g.fillRect(hx + chevronW, y + height - chevronH - 2, chevronW, chevronH)
    }
    // Left edge
    for (let hy = y + 12; hy < y + height - 12; hy += chevronW * 2) {
      g.fillStyle(yellow, hazardAlpha)
      g.fillRect(x + 2, hy, chevronH, chevronW)
      g.fillStyle(black, hazardAlpha)
      g.fillRect(x + 2, hy + chevronW, chevronH, chevronW)
    }
    // Right edge
    for (let hy = y + 12; hy < y + height - 12; hy += chevronW * 2) {
      g.fillStyle(yellow, hazardAlpha)
      g.fillRect(x + width - chevronH - 2, hy, chevronH, chevronW)
      g.fillStyle(black, hazardAlpha)
      g.fillRect(x + width - chevronH - 2, hy + chevronW, chevronH, chevronW)
    }

    // Cyan/mako glow pools — subtle colored areas near team zone center
    this.glowGraphics = this.scene.add.graphics().setDepth(-2.9)
    const gg = this.glowGraphics
    const cx = x + width / 2
    const cy = y + height / 2
    gg.fillStyle(teamColor, 0.04)
    gg.fillCircle(cx, cy, Math.min(width, height) * 0.3)
    gg.fillStyle(0x00e5ff, 0.025)
    gg.fillCircle(cx - width * 0.2, cy + height * 0.15, 30)
    gg.fillCircle(cx + width * 0.25, cy - height * 0.1, 25)
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
