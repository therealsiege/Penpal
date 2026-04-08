// gds-scene-renderer.ts
// Renders a GDS-exported scene as a single backdrop image.
// Unoccupied desk positions are masked by overlaying floor tiles from the
// sprite atlas on top of the backdrop at each empty desk location.

import Phaser from 'phaser'
import { GDS_SCENE_WIDTH, GDS_SCENE_HEIGHT, CHAR_SCALE, scaledFontSize } from './office-constants'
import { ANIM_KEYS } from './office-asset-keys'
import { activeTheme } from './office-theme'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GdsDeskSlot {
  x: number
  y: number
  flipX: boolean
  sitFrame: number
  /** Stool rotation angle in degrees — rotate the character sprite to match */
  angle: number
}

export interface GdsSceneLayout {
  width: number
  height: number
  componentCount: number
  components: { frame: string; x: number; y: number; width: number; height: number; zOrder: number; rotationRadians: number; flipX: boolean; flipY: boolean; opacity: number }[]
}

// ---------------------------------------------------------------------------
// Desk slot positions in GDS scene space (3840×2160)
// Each entry is where a stool sits in the exported scene.
// ---------------------------------------------------------------------------

// Stool CENTER positions (from GDS scene export, computed as x+w/2, y+h/2)
// Y nudged +40 so character sprites (origin bottom-center) sit ON the stool
// flipX: true = face left (sprite mirrored), based on which side the desk is
const STOOL_Y_NUDGE = 40
// sitFrame: 0=south/facing viewer, 1=looking screen-right, 2=north/back, 3=looking screen-left
const GDS_STOOL_POSITIONS: { x: number; y: number; flipX: boolean; sitFrame: number; angle: number }[] = [
  { x: 1824, y: 254 + STOOL_Y_NUDGE, flipX: false, sitFrame: 3, angle: 0 },   // top room — desk is screen-left
  { x: 1478, y: 918 + STOOL_Y_NUDGE, flipX: false, sitFrame: 2, angle: 0 },   // mid console — desk is up/north
  { x: 877, y: 1281 + STOOL_Y_NUDGE, flipX: false, sitFrame: 3, angle: 0 },   // mid-left — desk is screen-left
  { x: 880, y: 1629 + STOOL_Y_NUDGE, flipX: false, sitFrame: 1, angle: 0 },   // bot-left corner 1 — desk is screen-right
  { x: 920, y: 1855 + STOOL_Y_NUDGE, flipX: false, sitFrame: 3, angle: 0 },   // bot-left corner 2 — desk is screen-left
  { x: 1629, y: 1614 + STOOL_Y_NUDGE, flipX: false, sitFrame: 1, angle: 0 },  // bot-center 1 — desk is screen-right
  { x: 2018, y: 1630 + STOOL_Y_NUDGE, flipX: false, sitFrame: 1, angle: 0 },  // bot-center 2 — desk is screen-right
  { x: 1559, y: 1849 + STOOL_Y_NUDGE, flipX: false, sitFrame: 0, angle: 0 },  // bot-center 3 — desk is south
  { x: 2632, y: 1590 + STOOL_Y_NUDGE, flipX: false, sitFrame: 1, angle: 0 },  // bot-right 1 — desk is screen-right
  { x: 2627, y: 1879 + STOOL_Y_NUDGE, flipX: false, sitFrame: 1, angle: 0 },  // bot-right 2 — desk is screen-right
]

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SCENE_DEPTH = -3

// ---------------------------------------------------------------------------
// GdsSceneRenderer
// ---------------------------------------------------------------------------

export class GdsSceneRenderer {
  private scene: Phaser.Scene
  private backdrop: Phaser.GameObjects.Image | null = null
  private rendered = false

  private scale = 1
  private originX = 0
  private originY = 0

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  // -------------------------------------------------------------------------
  // render — place the GDS scene image + mask unoccupied desks
  // -------------------------------------------------------------------------

  render(
    imageKey: string,
    worldCenterX: number,
    worldCenterY: number,
    targetWidth: number,
    targetHeight: number,
  ): void {
    this.cleanup()
    if (!this.scene.textures.exists(imageKey)) return

    const img = this.scene.add.image(worldCenterX, worldCenterY, imageKey)
    img.setOrigin(0.5, 0.5)
    img.setDepth(SCENE_DEPTH)

    // Scale to cover the target area
    const scaleX = targetWidth / GDS_SCENE_WIDTH
    const scaleY = targetHeight / GDS_SCENE_HEIGHT
    this.scale = Math.max(scaleX, scaleY)
    img.setScale(this.scale)

    this.originX = worldCenterX - (GDS_SCENE_WIDTH * this.scale) / 2
    this.originY = worldCenterY - (GDS_SCENE_HEIGHT * this.scale) / 2

    this.backdrop = img
    this.rendered = true

    this.placeBaristas()
  }

  // -------------------------------------------------------------------------
  // Baristas — placed in the GDS scene's cafe area (right-side room)
  // -------------------------------------------------------------------------

  private baristaContainers: Phaser.GameObjects.Container[] = []

  private placeBaristas(): void {
    for (const c of this.baristaContainers) c.destroy(true)
    this.baristaContainers = []

    // Cafe area in GDS scene coords — between the serving bars in the right room
    const BARISTAS = [
      { gdsX: 2580, gdsY: 800, charIdx: 1, name: 'Latte Larry' },
      { gdsX: 2580, gdsY: 1050, charIdx: 0, name: 'Mocha Maya' },
    ]

    for (const cfg of BARISTAS) {
      const wx = this.originX + cfg.gdsX * this.scale
      const wy = this.originY + cfg.gdsY * this.scale
      const containerScale = this.scale * 2.5  // tuned to match workstation duder size

      const bc = this.scene.add.container(wx, wy).setDepth(0).setScale(containerScale)

      const walkKey = cfg.charIdx === 1 ? ANIM_KEYS.WALK_2 : ANIM_KEYS.WALK_1
      bc.add(this.scene.add.sprite(0, 0, walkKey, 0)
        .setScale(CHAR_SCALE).setOrigin(0.5, 1))

      // Green apron indicator
      bc.add(this.scene.add.rectangle(0, -8, 14, 12, 0x059669, 0.35))

      bc.add(this.scene.add.text(0, 6, cfg.name, {
        fontSize: scaledFontSize(8),
        fontFamily: 'system-ui, sans-serif',
        color: activeTheme.accentText,
        backgroundColor: activeTheme.nameBg,
        padding: { x: 3, y: 1 },
        resolution: 2,
      }).setOrigin(0.5, 0))

      // Idle sway
      this.scene.tweens.add({
        targets: bc, angle: { from: -3, to: 3 },
        duration: 800, yoyo: true, repeat: -1,
        ease: 'Sine.easeInOut', delay: Math.random() * 500,
      })
      this.scene.tweens.add({
        targets: bc, x: wx + 8,
        duration: 1800, yoyo: true, repeat: -1,
        ease: 'Sine.easeInOut', delay: Math.random() * 800,
      })

      this.baristaContainers.push(bc)
    }
  }

  // -------------------------------------------------------------------------
  // Desk slot allocation
  // -------------------------------------------------------------------------

  private assignedSlots = new Map<string, number>()

  getDeskSlots(): GdsDeskSlot[] {
    if (!this.rendered) return []
    return GDS_STOOL_POSITIONS.map(s => ({
      x: this.originX + s.x * this.scale,
      y: this.originY + s.y * this.scale,
      flipX: s.flipX,
      sitFrame: s.sitFrame,
      angle: s.angle,
    }))
  }

  getDeskSlotCount(): number { return GDS_STOOL_POSITIONS.length }

  assignSlot(agentId: string): GdsDeskSlot | null {
    if (!this.rendered) return null
    const existing = this.assignedSlots.get(agentId)
    if (existing !== undefined) return this.getDeskSlots()[existing] ?? null

    const usedIndices = new Set(this.assignedSlots.values())
    for (let i = 0; i < GDS_STOOL_POSITIONS.length; i++) {
      if (!usedIndices.has(i)) {
        this.assignedSlots.set(agentId, i)
        return this.getDeskSlots()[i]
      }
    }
    return null
  }

  releaseSlot(agentId: string): void {
    this.assignedSlots.delete(agentId)
  }

  getSlotForAgent(agentId: string): GdsDeskSlot | null {
    if (!this.rendered) return null
    const idx = this.assignedSlots.get(agentId)
    if (idx === undefined) return null
    return this.getDeskSlots()[idx] ?? null
  }

  clearSlotAssignments(): void {
    this.assignedSlots.clear()
  }

  // -------------------------------------------------------------------------
  // Laser doors — proximity-triggered animated barriers
  // -------------------------------------------------------------------------

  // Door positions in GDS scene space (3840×2160)
  private static readonly LASER_DOOR_DEFS = [
    { gdsX: 1824, gdsY:  120, gdsW: 280, gdsH: 36 }, // top room entrance
    { gdsX: 1478, gdsY:  770, gdsW: 240, gdsH: 36 }, // mid console entrance
    { gdsX:  877, gdsY: 1190, gdsW: 220, gdsH: 36 }, // mid-left entrance
    { gdsX: 1680, gdsY: 1510, gdsW: 260, gdsH: 36 }, // bottom cluster entrance
    { gdsX: 2200, gdsY:  960, gdsW:  36, gdsH: 300 }, // cafe corridor gate
  ]

  private static readonly LASER_DOOR_ALPHA_INITIAL = 0.5
  private static readonly LASER_DOOR_ALPHA_OPEN    = 0
  private static readonly LASER_DOOR_ALPHA_CLOSED  = 1.0
  private static readonly LASER_DOOR_OPEN_MS       = 200
  private static readonly LASER_DOOR_CLOSE_MS      = 400

  private laserDoors: Array<{
    gfx: Phaser.GameObjects.Graphics
    open: boolean
    worldX: number
    worldY: number
    worldW: number
    worldH: number
    openTween: Phaser.Tweens.Tween | null
    closeTween: Phaser.Tweens.Tween | null
  }> = []

  private buildLaserDoors(): void {
    for (const d of this.laserDoors) d.gfx.destroy()
    this.laserDoors = []

    for (const def of GdsSceneRenderer.LASER_DOOR_DEFS) {
      const wx = this.originX + def.gdsX * this.scale
      const wy = this.originY + def.gdsY * this.scale
      const ww = def.gdsW * this.scale
      const wh = def.gdsH * this.scale

      const gfx = this.scene.add.graphics()
      gfx.setDepth(SCENE_DEPTH + 0.5)
      gfx.fillStyle(0x00ffff, 1)
      gfx.fillRect(-ww / 2, -wh / 2, ww, wh)
      gfx.setPosition(wx, wy)
      gfx.setAlpha(GdsSceneRenderer.LASER_DOOR_ALPHA_INITIAL)

      this.laserDoors.push({
        gfx,
        open: false,
        worldX: wx,
        worldY: wy,
        worldW: ww,
        worldH: wh,
        openTween: null,
        closeTween: null,
      })
    }
  }

  updateLaserDoors(positions: { x: number; y: number }[]): void {
    if (!this.rendered) return
    if (this.laserDoors.length === 0) this.buildLaserDoors()

    for (const door of this.laserDoors) {
      const nearbyCount = positions.filter(p => {
        const dx = Math.abs(p.x - door.worldX)
        const dy = Math.abs(p.y - door.worldY)
        return dx < door.worldW / 2 + 50 && dy < door.worldH / 2 + 50
      }).length

      const shouldOpen = nearbyCount > 0

      if (shouldOpen && !door.open) {
        door.open = true
        if (door.closeTween) { door.closeTween.stop(); door.closeTween = null }
        door.openTween = this.scene.tweens.add({
          targets: door.gfx,
          alpha: GdsSceneRenderer.LASER_DOOR_ALPHA_OPEN,
          duration: GdsSceneRenderer.LASER_DOOR_OPEN_MS,
          ease: 'Linear',
          onComplete: () => { door.openTween = null },
        })
      } else if (!shouldOpen && door.open) {
        door.open = false
        if (door.openTween) { door.openTween.stop(); door.openTween = null }
        door.closeTween = this.scene.tweens.add({
          targets: door.gfx,
          alpha: GdsSceneRenderer.LASER_DOOR_ALPHA_CLOSED,
          duration: GdsSceneRenderer.LASER_DOOR_CLOSE_MS,
          ease: 'Linear',
          onComplete: () => { door.closeTween = null },
        })
      }
    }
  }

  getLaserDoorStates(): { alpha: number; open: boolean; worldX: number; worldY: number; worldW: number; worldH: number }[] {
    return this.laserDoors.map(d => ({
      alpha: d.gfx.alpha,
      open: d.open,
      worldX: d.worldX,
      worldY: d.worldY,
      worldW: d.worldW,
      worldH: d.worldH,
    }))
  }

  // -------------------------------------------------------------------------
  // World bounds
  // -------------------------------------------------------------------------

  getWorldBounds(): { x: number; y: number; width: number; height: number } | null {
    if (!this.rendered) return null
    return {
      x: this.originX,
      y: this.originY,
      width: GDS_SCENE_WIDTH * this.scale,
      height: GDS_SCENE_HEIGHT * this.scale,
    }
  }

  getScale(): number { return this.scale }

  // -------------------------------------------------------------------------
  // LOD
  // -------------------------------------------------------------------------

  applyLod(lodLevel: number): void {
    if (this.backdrop) this.backdrop.setVisible(lodLevel >= 1)
  }

  // -------------------------------------------------------------------------
  // Cleanup / destroy
  // -------------------------------------------------------------------------

  cleanup(): void {
    if (this.backdrop) { this.backdrop.destroy(); this.backdrop = null }
    for (const c of this.baristaContainers) c.destroy(true)
    this.baristaContainers = []
    for (const d of this.laserDoors) d.gfx.destroy()
    this.laserDoors = []
    this.rendered = false
  }

  destroy(): void { this.cleanup() }
  isRendered(): boolean { return this.rendered }
}
