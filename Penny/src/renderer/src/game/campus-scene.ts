import { BaseScene } from './base-scene'
import { EventBus, EVENTS } from './events'
import { SCENE_KEYS, SPRITESHEET_KEYS } from './office-asset-keys'
import { scaledFontSize } from './office-constants'

// ---------------------------------------------------------------------------
// CampusScene — world map with location markers
// ---------------------------------------------------------------------------
// Shows a world map backdrop. Local instance gets a red marker pin.
// Fleet instances from other machines appear as additional pins (blue-tinted).
// ---------------------------------------------------------------------------

// Default marker position in map space (3840×2160) — Nashville, TN
const DEFAULT_MAP_X = 771
const DEFAULT_MAP_Y = 878

interface FleetPin {
  instanceId: string
  container: Phaser.GameObjects.Container
  countText: Phaser.GameObjects.Text
  labelText: Phaser.GameObjects.Text
  pinSprite: Phaser.GameObjects.Image
  healthDot: Phaser.GameObjects.Graphics
}

export class CampusScene extends BaseScene {
  private agentCount = 0
  private podCount = 0
  private localMarker: Phaser.GameObjects.Container | null = null
  private localCountText: Phaser.GameObjects.Text | null = null
  private mapImage: Phaser.GameObjects.Image | null = null
  private mapScale = 1
  private mapOriginX = 0
  private mapOriginY = 0
  private fleetPins: FleetPin[] = []

  constructor() {
    super({ key: SCENE_KEYS.CAMPUS })
  }

  onPreload(): void { /* loaded by BootScene */ }

  onCreate(): void {
    const cam = this.cameras.main
    const { width: camW, height: camH } = cam

    cam.fadeIn(300, 0, 0, 0)

    // ── World map backdrop ──
    if (this.textures.exists(SPRITESHEET_KEYS.GDS_WORLDMAP)) {
      const img = this.add.image(camW / 2, camH / 2, SPRITESHEET_KEYS.GDS_WORLDMAP)
      img.setOrigin(0.5, 0.5)
      const scaleX = camW / 3840
      const scaleY = camH / 2160
      const scale = Math.max(scaleX, scaleY)
      img.setScale(scale)
      this.mapImage = img
      this.mapScale = scale
      this.mapOriginX = camW / 2 - (3840 * scale) / 2
      this.mapOriginY = camH / 2 - (2160 * scale) / 2

      // ── Local marker pin (Nashville) ──
      this.createLocalMarker(DEFAULT_MAP_X, DEFAULT_MAP_Y, 'Nashville, TN')
    } else {
      this.add.text(camW / 2, camH / 2, 'Enter Lab', {
        fontSize: scaledFontSize(24), fontFamily: 'monospace', color: '#22d3ee', resolution: 2,
      }).setOrigin(0.5).setInteractive({ useHandCursor: true })
        .on('pointerup', () => this.enterLab())
    }

    EventBus.on(EVENTS.CAMPUS_COUNTS_UPDATED, this.onCountsUpdated)
    EventBus.on(EVENTS.NAVIGATE_CAMPUS, this.onNavigateCampus)
    EventBus.on(EVENTS.FLEET_UPDATED, this.onFleetUpdated)

    this.events.on('shutdown', () => {
      EventBus.off(EVENTS.CAMPUS_COUNTS_UPDATED, this.onCountsUpdated)
      EventBus.off(EVENTS.NAVIGATE_CAMPUS, this.onNavigateCampus)
      EventBus.off(EVENTS.FLEET_UPDATED, this.onFleetUpdated)
    })
  }

  onUpdate(): void { /* no per-frame logic */ }

  // ── Map coordinate helpers ──

  private mapToScreen(gdsX: number, gdsY: number): { x: number; y: number } {
    return {
      x: this.mapOriginX + gdsX * this.mapScale,
      y: this.mapOriginY + gdsY * this.mapScale,
    }
  }

  // ── Local marker (red marker sprite) ──

  private createLocalMarker(gdsX: number, gdsY: number, label: string): void {
    const { x: cx, y: cy } = this.mapToScreen(gdsX, gdsY)
    const pinScale = this.mapScale * 0.6
    const container = this.add.container(cx, cy)

    // Use the marker sprite (red teardrop, 86x119)
    const useMarkerSprite = this.textures.exists(SPRITESHEET_KEYS.MAP_MARKER)
    if (useMarkerSprite) {
      const pin = this.add.image(0, 0, SPRITESHEET_KEYS.MAP_MARKER)
      pin.setOrigin(0.5, 1) // anchor at bottom center (the point)
      pin.setScale(pinScale)
      container.add(pin)
    } else {
      // Fallback: programmatic pin
      const g = this.add.graphics()
      g.fillStyle(0xdc2626, 1)
      g.fillCircle(0, -12 * pinScale, 14 * pinScale)
      g.fillTriangle(-8 * pinScale, -6 * pinScale, 8 * pinScale, -6 * pinScale, 0, 12 * pinScale)
      g.fillStyle(0xffffff, 0.9)
      g.fillCircle(0, -12 * pinScale, 5 * pinScale)
      container.add(g)
    }

    // Label
    const labelText = this.add.text(0, 8, label, {
      fontSize: scaledFontSize(12),
      fontFamily: "'Monogram', system-ui, monospace",
      color: '#ffffff',
      backgroundColor: 'rgba(15,23,42,0.85)',
      padding: { x: 8, y: 4 },
      resolution: 2,
    }).setOrigin(0.5, 0)
    container.add(labelText)

    // Agent count
    const countText = this.add.text(0, 8 + labelText.height + 4, `${this.agentCount} agents`, {
      fontSize: scaledFontSize(10),
      fontFamily: 'system-ui, monospace',
      color: '#94a3b8',
      resolution: 2,
    }).setOrigin(0.5, 0)
    container.add(countText)
    this.localCountText = countText

    // Hit area
    const hitW = Math.max(80, labelText.width + 24)
    const hitH = 100 * pinScale + labelText.height + 20
    const hit = this.add.rectangle(0, -30 * pinScale, hitW, hitH, 0x000000, 0)
      .setInteractive({ useHandCursor: true })
    container.add(hit)

    // Idle bob
    this.tweens.add({
      targets: container, y: cy - 4, duration: 1200,
      yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    })

    // Hover
    hit.on('pointerover', () => {
      this.tweens.add({ targets: container, scaleX: 1.12, scaleY: 1.12, duration: 120, ease: 'Back.easeOut' })
    })
    hit.on('pointerout', () => {
      this.tweens.add({ targets: container, scaleX: 1, scaleY: 1, duration: 120, ease: 'Power1' })
    })
    hit.on('pointerup', () => {
      this.cameras.main.flash(150)
      this.enterLab()
    })

    this.localMarker = container

    // Keep count text updated
    EventBus.on(EVENTS.CAMPUS_COUNTS_UPDATED, (agents: number) => {
      if (countText?.active) countText.setText(`${agents} agents`)
    })
  }

  // ── Fleet pins (remote instances) ──

  private onFleetUpdated = (instances: {
    instanceId: string; hostname: string; stale: boolean; health: string
    sessions: { total: number; active: number }; pods: { active: number }
    repos: string[]; isSelf: boolean; mapX?: number; mapY?: number
  }[]): void => {
    const remote = instances.filter(i => !i.isSelf)
    const remoteIds = new Set(remote.map(i => i.instanceId))

    // Remove gone instances
    for (let idx = this.fleetPins.length - 1; idx >= 0; idx--) {
      if (!remoteIds.has(this.fleetPins[idx].instanceId)) {
        this.fleetPins[idx].container.destroy()
        this.fleetPins.splice(idx, 1)
      }
    }

    // Update or create
    for (let i = 0; i < remote.length; i++) {
      const inst = remote[i]
      const existing = this.fleetPins.find(p => p.instanceId === inst.instanceId)
      if (existing) {
        this.updateFleetPin(existing, inst)
      } else {
        const pin = this.createFleetPin(inst, i)
        if (pin) this.fleetPins.push(pin)
      }
    }
  }

  private createFleetPin(inst: {
    instanceId: string; hostname: string; stale: boolean; health: string
    sessions: { total: number; active: number }; pods: { active: number }
    repos: string[]; mapX?: number; mapY?: number
  }, index: number): FleetPin | null {
    // Position: use mapX/mapY if provided, otherwise offset from Nashville
    const gdsX = inst.mapX ?? (DEFAULT_MAP_X + 250 + index * 180)
    const gdsY = inst.mapY ?? DEFAULT_MAP_Y
    const { x: cx, y: cy } = this.mapToScreen(gdsX, gdsY)
    const pinScale = this.mapScale * 0.55

    const container = this.add.container(cx, cy)

    // Use pin sprite (lollipop style), tinted blue for remote
    const usePinSprite = this.textures.exists(SPRITESHEET_KEYS.MAP_PIN)
    let pinSprite: Phaser.GameObjects.Image
    if (usePinSprite) {
      pinSprite = this.add.image(0, 0, SPRITESHEET_KEYS.MAP_PIN)
      pinSprite.setOrigin(0.5, 1)
      pinSprite.setScale(pinScale)
      if (!inst.stale) pinSprite.setTint(0x60a5fa) // blue tint for remote
      else pinSprite.setTint(0x6b7280) // gray for stale
    } else {
      // Fallback
      pinSprite = this.add.image(0, 0, '__DEFAULT') // won't render but keeps types happy
      const g = this.add.graphics()
      const color = inst.stale ? 0x6b7280 : 0x3b82f6
      g.fillStyle(color, 1)
      g.fillCircle(0, -12 * pinScale, 14 * pinScale)
      g.fillTriangle(-8 * pinScale, -6 * pinScale, 8 * pinScale, -6 * pinScale, 0, 12 * pinScale)
      g.fillStyle(0xffffff, 0.9)
      g.fillCircle(0, -12 * pinScale, 5 * pinScale)
      container.add(g)
    }
    container.add(pinSprite)

    // Health dot
    const healthDot = this.add.graphics()
    this.drawHealthDot(healthDot, pinScale, inst)
    container.add(healthDot)

    // Label
    const labelText = this.add.text(0, 8, inst.hostname, {
      fontSize: scaledFontSize(11),
      fontFamily: "'Monogram', system-ui, monospace",
      color: inst.stale ? '#6b7280' : '#ffffff',
      backgroundColor: 'rgba(15,23,42,0.85)',
      padding: { x: 8, y: 4 },
      resolution: 2,
    }).setOrigin(0.5, 0)
    container.add(labelText)

    // Count
    const countStr = `${inst.sessions.total} agents` + (inst.pods.active > 0 ? ` \u00b7 ${inst.pods.active} pods` : '')
    const countText = this.add.text(0, 8 + labelText.height + 4, countStr, {
      fontSize: scaledFontSize(9),
      fontFamily: 'system-ui, monospace',
      color: inst.stale ? '#4b5563' : '#94a3b8',
      resolution: 2,
    }).setOrigin(0.5, 0)
    container.add(countText)

    if (inst.stale) container.setAlpha(0.5)

    // Idle bob — offset phase
    this.tweens.add({
      targets: container, y: cy - 3, duration: 1400,
      yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 300 + index * 200,
    })

    return { instanceId: inst.instanceId, container, countText, labelText, pinSprite, healthDot }
  }

  private updateFleetPin(pin: FleetPin, inst: {
    stale: boolean; health: string; sessions: { total: number; active: number }; pods: { active: number }
  }): void {
    const countStr = `${inst.sessions.total} agents` + (inst.pods.active > 0 ? ` \u00b7 ${inst.pods.active} pods` : '')
    pin.countText.setText(countStr)

    // Update health dot
    pin.healthDot.clear()
    this.drawHealthDot(pin.healthDot, this.mapScale * 0.55, inst)

    // Update tint + alpha
    pin.pinSprite.setTint(inst.stale ? 0x6b7280 : 0x60a5fa)
    pin.container.setAlpha(inst.stale ? 0.5 : 1)
    pin.labelText.setColor(inst.stale ? '#6b7280' : '#ffffff')
    pin.countText.setColor(inst.stale ? '#4b5563' : '#94a3b8')
  }

  private drawHealthDot(g: Phaser.GameObjects.Graphics, pinScale: number, inst: { stale: boolean; health: string }): void {
    const color = inst.stale ? 0x6b7280 : inst.health === 'healthy' ? 0x22c55e : inst.health === 'degraded' ? 0xf59e0b : 0xef4444
    g.fillStyle(color, 1)
    g.fillCircle(18 * pinScale, -60 * pinScale, 5 * pinScale)
    // White border ring
    g.lineStyle(1.5 * pinScale, 0xffffff, 0.8)
    g.strokeCircle(18 * pinScale, -60 * pinScale, 5 * pinScale)
  }

  // ── Navigation ──

  private enterLab(): void {
    if (this.scene.isSleeping(SCENE_KEYS.OFFICE)) {
      this.scene.wake(SCENE_KEYS.OFFICE)
    } else if (!this.scene.isActive(SCENE_KEYS.OFFICE)) {
      this.scene.launch(SCENE_KEYS.OFFICE)
    }
    this.scene.sleep(SCENE_KEYS.CAMPUS)
  }

  // ── EventBus handlers ──

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
