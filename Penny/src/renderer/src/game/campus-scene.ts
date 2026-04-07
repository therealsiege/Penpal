import { BaseScene } from './base-scene'
import { EventBus, EVENTS } from './events'
import { SCENE_KEYS, SPRITESHEET_KEYS } from './office-asset-keys'
import { scaledFontSize } from './office-constants'

// ---------------------------------------------------------------------------
// CampusScene — world map with location markers
// ---------------------------------------------------------------------------
// Shows the GDS world map as a full-viewport backdrop. Clickable marker pins
// on the map navigate into specific scenes (e.g., the Nashville lab).
// ---------------------------------------------------------------------------

// Marker position in GDS scene space (3840×2160) — Nashville, TN
const MARKER_GDS_X = 771
const MARKER_GDS_Y = 878
const MARKER_GDS_W = 86
const MARKER_GDS_H = 119

export class CampusScene extends BaseScene {
  private agentCount = 0
  private podCount = 0
  private marker: Phaser.GameObjects.Container | null = null
  private mapImage: Phaser.GameObjects.Image | null = null

  constructor() {
    super({ key: SCENE_KEYS.CAMPUS })
  }

  onPreload(): void {
    // All assets loaded by BootScene
  }

  onCreate(): void {
    const cam = this.cameras.main
    const { width: camW, height: camH } = cam

    // Fade in from black
    cam.fadeIn(300, 0, 0, 0)

    // ── World map backdrop — fill viewport ──
    if (this.textures.exists(SPRITESHEET_KEYS.GDS_WORLDMAP)) {
      const img = this.add.image(camW / 2, camH / 2, SPRITESHEET_KEYS.GDS_WORLDMAP)
      img.setOrigin(0.5, 0.5)
      // Scale to cover viewport
      const scaleX = camW / 3840
      const scaleY = camH / 2160
      const scale = Math.max(scaleX, scaleY)
      img.setScale(scale)
      this.mapImage = img

      // ── Nashville marker pin ──
      const originX = camW / 2 - (3840 * scale) / 2
      const originY = camH / 2 - (2160 * scale) / 2
      const markerCX = originX + (MARKER_GDS_X + MARKER_GDS_W / 2) * scale
      const markerCY = originY + (MARKER_GDS_Y + MARKER_GDS_H / 2) * scale
      const markerScale = scale * 1.2

      this.createMarker(markerCX, markerCY, markerScale, 'Nashville, TN', () => this.enterLab())
    } else {
      // Fallback: simple text buttons
      this.add.text(camW / 2, camH / 2, 'Enter Lab', {
        fontSize: scaledFontSize(24),
        fontFamily: 'monospace',
        color: '#22d3ee',
        resolution: 2,
      }).setOrigin(0.5).setInteractive({ useHandCursor: true })
        .on('pointerup', () => this.enterLab())
    }

    // Listen for count updates from OfficeScene / IPC
    EventBus.on(EVENTS.CAMPUS_COUNTS_UPDATED, this.onCountsUpdated)
    EventBus.on(EVENTS.NAVIGATE_CAMPUS, this.onNavigateCampus)

    this.events.on('shutdown', () => {
      EventBus.off(EVENTS.CAMPUS_COUNTS_UPDATED, this.onCountsUpdated)
      EventBus.off(EVENTS.NAVIGATE_CAMPUS, this.onNavigateCampus)
    })
  }

  onUpdate(): void {
    // No per-frame logic needed
  }

  // -------------------------------------------------------------------------
  // Marker builder
  // -------------------------------------------------------------------------

  private createMarker(
    cx: number,
    cy: number,
    scale: number,
    label: string,
    onPress: () => void,
  ): void {
    const container = this.add.container(cx, cy)

    // Pin body — teardrop shape using graphics
    const g = this.add.graphics()
    g.fillStyle(0xdc2626, 1) // red
    g.fillCircle(0, -12 * scale, 14 * scale)
    // Pin point
    g.fillTriangle(
      -8 * scale, -6 * scale,
      8 * scale, -6 * scale,
      0, 12 * scale,
    )
    // Inner white dot
    g.fillStyle(0xffffff, 0.9)
    g.fillCircle(0, -12 * scale, 5 * scale)
    container.add(g)

    // Label below pin
    const labelText = this.add.text(0, 18 * scale, label, {
      fontSize: scaledFontSize(11),
      fontFamily: "'Monogram', system-ui, monospace",
      color: '#ffffff',
      backgroundColor: 'rgba(15,23,42,0.8)',
      padding: { x: 6, y: 3 },
      resolution: 2,
    }).setOrigin(0.5, 0)
    container.add(labelText)

    // Agent count badge
    const countText = this.add.text(0, 18 * scale + labelText.height + 4, `${this.agentCount} agents`, {
      fontSize: scaledFontSize(9),
      fontFamily: 'system-ui, monospace',
      color: '#94a3b8',
      resolution: 2,
    }).setOrigin(0.5, 0)
    container.add(countText)

    // Hit area — covers the pin + label
    const hitW = Math.max(60 * scale, labelText.width + 20)
    const hitH = 50 * scale + labelText.height
    const hit = this.add.rectangle(0, 0, hitW, hitH, 0x000000, 0)
      .setInteractive({ useHandCursor: true })
    container.add(hit)

    // Idle bob animation
    this.tweens.add({
      targets: container,
      y: cy - 4,
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })

    // Hover
    hit.on('pointerover', () => {
      this.tweens.add({
        targets: container,
        scaleX: 1.15,
        scaleY: 1.15,
        duration: 120,
        ease: 'Back.easeOut',
      })
      g.clear()
      g.fillStyle(0xef4444, 1) // brighter red
      g.fillCircle(0, -12 * scale, 14 * scale)
      g.fillTriangle(-8 * scale, -6 * scale, 8 * scale, -6 * scale, 0, 12 * scale)
      g.fillStyle(0xffffff, 1)
      g.fillCircle(0, -12 * scale, 5 * scale)
    })

    hit.on('pointerout', () => {
      this.tweens.add({
        targets: container,
        scaleX: 1,
        scaleY: 1,
        duration: 120,
        ease: 'Power1',
      })
      g.clear()
      g.fillStyle(0xdc2626, 1)
      g.fillCircle(0, -12 * scale, 14 * scale)
      g.fillTriangle(-8 * scale, -6 * scale, 8 * scale, -6 * scale, 0, 12 * scale)
      g.fillStyle(0xffffff, 0.9)
      g.fillCircle(0, -12 * scale, 5 * scale)
    })

    hit.on('pointerup', () => {
      this.cameras.main.flash(150)
      onPress()
    })

    this.marker = container

    // Store countText ref so we can update it
    EventBus.on(EVENTS.CAMPUS_COUNTS_UPDATED, (agents: number) => {
      if (countText?.active) countText.setText(`${agents} agents`)
    })
  }

  // -------------------------------------------------------------------------
  // Navigation
  // -------------------------------------------------------------------------

  private enterLab(): void {
    // Launch OfficeScene if it hasn't been created yet, otherwise wake it
    if (this.scene.isSleeping(SCENE_KEYS.OFFICE)) {
      this.scene.wake(SCENE_KEYS.OFFICE)
    } else if (!this.scene.isActive(SCENE_KEYS.OFFICE)) {
      this.scene.launch(SCENE_KEYS.OFFICE)
    }
    // Sleep campus after office is up
    this.scene.sleep(SCENE_KEYS.CAMPUS)
  }

  // -------------------------------------------------------------------------
  // EventBus handlers
  // -------------------------------------------------------------------------

  private onCountsUpdated = (agents: number, pods: number): void => {
    this.agentCount = agents
    this.podCount = pods
  }

  private onNavigateCampus = (): void => {
    if (this.scene.isSleeping(SCENE_KEYS.CAMPUS)) {
      this.scene.wake(SCENE_KEYS.CAMPUS)
    }
  }
}
