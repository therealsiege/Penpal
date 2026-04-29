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

    const hash = Math.abs(Math.floor(x * 7 + y * 13)) | 0

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const isTop = row === 0
        const isBottom = row === rows - 1
        const isLeft = col === 0
        const isRight = col === cols - 1

        // Unified floor draws ONLY floor tiles — individual rooms draw their own walls.
        // Perimeter gets a subtle outer-fill (dark void) tile; everything else is hex floor.
        const isEdge = isTop || isBottom || isLeft || isRight
        let imageKey: string

        if (isEdge) {
          // Dark void tile on facility perimeter — rooms' own walls provide the visual boundary
          imageKey = LAB_IMAGE_KEYS.OUTER_FILL
        } else {
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

    // No hazard tape on unified floor — per-room walls provide the visual boundary.
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
