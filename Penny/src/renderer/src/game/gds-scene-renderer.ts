// gds-scene-renderer.ts
// Renders a GDS-exported scene as a single backdrop image.
// Unoccupied desk positions are masked by overlaying floor tiles from the
// sprite atlas on top of the backdrop at each empty desk location.

import Phaser from 'phaser'
import { GDS_SCENE_WIDTH, GDS_SCENE_HEIGHT, CHAR_SCALE, scaledFontSize } from './office-constants'
import { ANIM_KEYS, SPRITESHEET_KEYS, GDS_SCENE_KEYS } from './office-asset-keys'
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
// Lab map — loaded from lab-map.json at runtime
// sitFrame: 0=south/facing viewer, 1=screen-right, 2=north/back, 3=screen-left
// ---------------------------------------------------------------------------

export interface LabMapDesk {
  id: string
  label: string
  room: string
  gdsX: number
  gdsY: number
  sitFrame: number
  flipX: boolean
  angle: number
  assignTo?: string | null
  walkTrack?: { points: { x: number; y: number }[]; loop?: boolean } | null
  animations?: { idle?: string; working?: string; break?: string }
  notes?: string
}

export interface LabMapRoom {
  id: string
  label: string
  bounds?: { x: number; y: number; w: number; h: number }
}

export interface LabMapJson {
  scene?: { width: number; height: number; backdrop: string; stoolYNudge?: number }
  rooms?: LabMapRoom[]
  desks?: LabMapDesk[]
  cafeSttools?: { id: string; gdsX: number; gdsY: number }[]
  walkableTiles?: { x: number; y: number; w: number; h: number }[]
}

function loadLabMap(scene: Phaser.Scene): LabMapJson {
  const data = scene.cache.json.get(GDS_SCENE_KEYS.LAB_MAP) as LabMapJson | undefined
  if (data?.desks) return data
  console.warn('[GDS] lab-map.json not found in cache')
  return { desks: [], cafeSttools: [] }
}

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
  private labMap: LabMapJson = { desks: [], cafeSttools: [] }

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
    this.labMap = loadLabMap(this.scene)

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
      const containerScale = this.scale * 1.5  // match workstation duder size (gdsScale * 1.5)

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
    const desks = this.labMap.desks ?? []
    return desks.map(d => ({
      x: this.originX + d.gdsX * this.scale,
      y: this.originY + d.gdsY * this.scale,
      flipX: d.flipX,
      sitFrame: d.sitFrame,
      angle: d.angle,
    }))
  }

  getDeskSlotCount(): number { return (this.labMap.desks ?? []).length }

  getDeskByLabel(label: string): LabMapDesk | undefined {
    return (this.labMap.desks ?? []).find(d => d.label === label || d.id === label)
  }

  getDeskAt(index: number): LabMapDesk | undefined { return this.labMap.desks?.[index] }

  getLabMap(): LabMapJson { return this.labMap }

  assignSlot(agentId: string): GdsDeskSlot | null {
    if (!this.rendered) return null
    const existing = this.assignedSlots.get(agentId)
    if (existing !== undefined) return this.getDeskSlots()[existing] ?? null

    const desks = this.labMap.desks ?? []
    const usedIndices = new Set(this.assignedSlots.values())
    for (let i = 0; i < desks.length; i++) {
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
    this.rendered = false
  }

  destroy(): void { this.cleanup() }
  isRendered(): boolean { return this.rendered }
}
