import { BaseScene } from './base-scene'
import { EventBus, EVENTS } from './events'
import { SCENE_KEYS, SPRITESHEET_KEYS } from './office-asset-keys'
import { scaledFontSize } from './office-constants'

// ---------------------------------------------------------------------------
// CampusScene — North America map with fleet instance pins
// ---------------------------------------------------------------------------
// All Penpal instances (local + remote) are rendered as pins on the map.
// Location is determined by IP geolocation (lat/lon in heartbeat data).
// Single click: camera zooms to the pin. Double click: enters the lab.
// ---------------------------------------------------------------------------

// World map image dimensions
const MAP_W = 3840
const MAP_H = 2160

// Anchor point: Nashville's known pixel position on this illustrated map
// This was visually confirmed as correct in the original hardcoded version
const ANCHOR_LAT = 36.16
const ANCHOR_LON = -86.78
const ANCHOR_PX_X = 820   // pixel X in 3840-space where Nashville sits
const ANCHOR_PX_Y = 1020  // pixel Y in 3840-space where Nashville sits

// Approximate pixels-per-degree for this illustrated map
// Derived from map features: US spans ~25° lat over ~400px, ~55° lon over ~600px
const PX_PER_DEG_LON = 10.9  // ~600px / 55°
const PX_PER_DEG_LAT = 16.0  // ~400px / 25°

// Fallback: Nashville, TN
const FALLBACK_LAT = 36.16
const FALLBACK_LON = -86.78

interface FleetPinData {
  instanceId: string
  hostname: string
  user?: string
  stale: boolean
  health: string
  sessions: { total: number; active: number }
  pods: { active: number }
  repos: string[]
  isSelf: boolean
  lat?: number
  lon?: number
  city?: string
}

interface FleetPin {
  instanceId: string
  container: Phaser.GameObjects.Container
  labelText: Phaser.GameObjects.Text
  pinSprite: Phaser.GameObjects.Image
  healthDot: Phaser.GameObjects.Graphics
  screenX: number
  screenY: number
}

export class CampusScene extends BaseScene {
  private mapImage: Phaser.GameObjects.Image | null = null
  private mapScale = 1
  private mapOriginX = 0
  private mapOriginY = 0
  private fleetPins: FleetPin[] = []
  private lastFleetData: FleetPinData[] | null = null
  private localPinId = '__local__'

  constructor() {
    super({ key: SCENE_KEYS.CAMPUS })
  }

  onPreload(): void { /* loaded by BootScene */ }

  onCreate(): void {
    const cam = this.cameras.main
    const { width: camW, height: camH } = cam

    cam.fadeIn(300, 0, 0, 0)

    // ── Map backdrop ──
    if (this.textures.exists(SPRITESHEET_KEYS.GDS_WORLDMAP)) {
      const img = this.add.image(camW / 2, camH / 2, SPRITESHEET_KEYS.GDS_WORLDMAP)
      img.setOrigin(0.5, 0.5)
      const scaleX = camW / MAP_W
      const scaleY = camH / MAP_H
      const scale = Math.max(scaleX, scaleY)
      img.setScale(scale)
      this.mapImage = img
      this.mapScale = scale
      this.mapOriginX = camW / 2 - (MAP_W * scale) / 2
      this.mapOriginY = camH / 2 - (MAP_H * scale) / 2
      // Create a local "self" pin immediately so the user can always enter their lab
      this.createLocalPin()
    } else {
      this.add.text(camW / 2, camH / 2, 'Enter Lab', {
        fontSize: scaledFontSize(24), fontFamily: 'monospace', color: '#22d3ee', resolution: 2,
      }).setOrigin(0.5).setInteractive({ useHandCursor: true })
        .on('pointerup', () => this.enterLab())
    }

    EventBus.on(EVENTS.CAMPUS_COUNTS_UPDATED, this.onCountsUpdated)
    EventBus.on(EVENTS.NAVIGATE_CAMPUS, this.onNavigateCampus)
    EventBus.on(EVENTS.FLEET_UPDATED, this.onFleetUpdated)

    this.events.on('wake', () => {
      // Reset camera zoom when returning to campus
      this.cameras.main.setZoom(1)
      this.cameras.main.centerOn(this.cameras.main.width / 2, this.cameras.main.height / 2)
      if (this.lastFleetData) this.onFleetUpdated(this.lastFleetData)
    })

    this.events.on('shutdown', () => {
      EventBus.off(EVENTS.CAMPUS_COUNTS_UPDATED, this.onCountsUpdated)
      EventBus.off(EVENTS.NAVIGATE_CAMPUS, this.onNavigateCampus)
      EventBus.off(EVENTS.FLEET_UPDATED, this.onFleetUpdated)
    })
  }

  onUpdate(): void { /* no per-frame logic */ }

  // ── Coordinate conversion ──

  private latLonToScreen(lat: number, lon: number): { x: number; y: number } {
    // Anchor-relative: offset from Nashville's known pixel position
    const dLon = lon - ANCHOR_LON
    const dLat = lat - ANCHOR_LAT
    const mapX = ANCHOR_PX_X + dLon * PX_PER_DEG_LON
    const mapY = ANCHOR_PX_Y - dLat * PX_PER_DEG_LAT  // lat increases upward, Y increases downward
    return {
      x: this.mapOriginX + mapX * this.mapScale,
      y: this.mapOriginY + mapY * this.mapScale,
    }
  }

  // ── Local self pin (always present so user can enter their lab) ──

  private createLocalPin(): void {
    const { x: cx, y: cy } = this.latLonToScreen(FALLBACK_LAT, FALLBACK_LON)
    const pin = this.createPin({
      instanceId: this.localPinId,
      hostname: 'local',
      user: 'My Lab',
      stale: false,
      health: 'healthy',
      sessions: { total: 0, active: 0 },
      pods: { active: 0 },
      repos: [],
      isSelf: true,
    }, 0)
    if (pin) this.fleetPins.push(pin)
  }

  // ── Fleet pin management ──

  private onFleetUpdated = (instances: FleetPinData[]): void => {
    this.lastFleetData = instances

    // Update the local placeholder pin with real self data (don't destroy it)
    const selfData = instances.find(i => i.isSelf)
    const localPin = this.fleetPins.find(p => p.instanceId === this.localPinId)
    if (selfData && localPin) {
      this.updatePin(localPin, selfData)
      localPin.labelText.setText(selfData.user || selfData.hostname)
    }

    // Only process remote instances (skip self — local pin handles it)
    const remoteInstances = instances.filter(i => !i.isSelf)
    const remoteIds = new Set(remoteInstances.map(i => i.instanceId))

    // Remove gone remote pins (never remove the local pin)
    for (let idx = this.fleetPins.length - 1; idx >= 0; idx--) {
      const pin = this.fleetPins[idx]
      if (pin.instanceId === this.localPinId) continue
      if (!remoteIds.has(pin.instanceId)) {
        pin.container.destroy()
        this.fleetPins.splice(idx, 1)
      }
    }

    // Update or create remote pins
    for (let i = 0; i < remoteInstances.length; i++) {
      const inst = remoteInstances[i]
      const existing = this.fleetPins.find(p => p.instanceId === inst.instanceId)
      if (existing) {
        this.updatePin(existing, inst)
      } else {
        const pin = this.createPin(inst, i)
        if (pin) this.fleetPins.push(pin)
      }
    }
  }

  private createPin(inst: FleetPinData, index: number): FleetPin | null {
    const lat = inst.lat ?? FALLBACK_LAT
    const lon = inst.lon ?? FALLBACK_LON
    const { x: cx, y: cy } = this.latLonToScreen(lat, lon)

    // Slight offset so co-located pins are both clickable
    const sameSpot = this.fleetPins.filter(p =>
      Math.abs(p.screenX - cx) < 5 && Math.abs(p.screenY - cy) < 5
    ).length
    const finalX = cx + sameSpot * 18 * this.mapScale
    const finalY = cy

    const pinScale = this.mapScale * 0.5
    const container = this.add.container(finalX, finalY)

    // Pin sprite — same marker for all, tinted by role
    const spriteKey = SPRITESHEET_KEYS.MAP_MARKER
    let pinSprite: Phaser.GameObjects.Image

    if (this.textures.exists(spriteKey)) {
      pinSprite = this.add.image(0, 0, spriteKey)
      pinSprite.setOrigin(0.5, 1)
      pinSprite.setScale(pinScale)
      if (inst.stale) pinSprite.setTint(0x6b7280)
      else if (!inst.isSelf) pinSprite.setTint(0x60a5fa)
      // Self keeps the default red color (no tint)
    } else {
      pinSprite = this.add.image(0, 0, '__DEFAULT')
    }
    container.add(pinSprite)

    // Health dot
    const healthDot = this.add.graphics()
    this.drawHealthDot(healthDot, pinScale, inst)
    container.add(healthDot)

    // Label — home dir username (hidden by default, shown on hover)
    const labelStr = inst.user || inst.hostname
    const labelText = this.add.text(0, 8, labelStr, {
      fontSize: scaledFontSize(11),
      fontFamily: "'Monogram', system-ui, monospace",
      color: '#ffffff',
      backgroundColor: 'rgba(15,23,42,0.85)',
      padding: { x: 8, y: 4 },
      resolution: 2,
    }).setOrigin(0.5, 0).setAlpha(0)
    container.add(labelText)

    if (inst.stale) container.setAlpha(0.5)

    // Hit area
    const hitW = Math.max(80, 60 * pinScale)
    const hitH = 80 * pinScale
    const hit = this.add.rectangle(0, -30 * pinScale, hitW, hitH, 0x000000, 0)
      .setInteractive({ useHandCursor: true })
    container.add(hit)

    // Idle bob
    this.tweens.add({
      targets: container, y: finalY - 4, duration: 1200,
      yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: index * 200,
    })

    // Hover — scale up + show label
    hit.on('pointerover', () => {
      this.tweens.add({ targets: container, scaleX: 1.15, scaleY: 1.15, duration: 120, ease: 'Back.easeOut' })
      this.tweens.add({ targets: labelText, alpha: 1, duration: 150 })
    })
    hit.on('pointerout', () => {
      this.tweens.add({ targets: container, scaleX: 1, scaleY: 1, duration: 120, ease: 'Power1' })
      this.tweens.add({ targets: labelText, alpha: 0, duration: 150 })
    })

    // Click interactions — only self pin is fully interactive
    if (inst.isSelf) {
      // Self pin always on top so it's clickable even when overlapping remote pins
      container.setDepth(100)
      let lastClickTime = 0
      hit.on('pointerup', () => {
        const now = Date.now()
        if (now - lastClickTime < 400) {
          this.cameras.main.flash(150)
          this.enterLab()
        } else {
          this.zoomToPin(finalX, finalY)
        }
        lastClickTime = now
      })
    } else {
      // Remote pins — zoom only, no lab entry
      hit.on('pointerup', () => {
        this.zoomToPin(finalX, finalY)
      })
    }

    return {
      instanceId: inst.instanceId, container, labelText,
      pinSprite, healthDot, screenX: finalX, screenY: finalY,
    }
  }

  private updatePin(pin: FleetPin, inst: FleetPinData): void {
    pin.healthDot.clear()
    this.drawHealthDot(pin.healthDot, this.mapScale * 0.5, inst)

    if (inst.isSelf) {
      pin.pinSprite.clearTint()
      if (inst.stale) pin.pinSprite.setTint(0x6b7280)
    } else {
      pin.pinSprite.setTint(inst.stale ? 0x6b7280 : 0x60a5fa)
    }
    pin.container.setAlpha(inst.stale ? 0.5 : 1)
    pin.labelText.setColor(inst.stale ? '#6b7280' : '#ffffff')
  }

  private drawHealthDot(g: Phaser.GameObjects.Graphics, pinScale: number, inst: FleetPinData): void {
    const color = inst.stale ? 0x6b7280 : inst.health === 'healthy' ? 0x22c55e : inst.health === 'degraded' ? 0xf59e0b : 0xef4444
    g.fillStyle(color, 1)
    g.fillCircle(18 * pinScale, -60 * pinScale, 5 * pinScale)
    g.lineStyle(1.5 * pinScale, 0xffffff, 0.8)
    g.strokeCircle(18 * pinScale, -60 * pinScale, 5 * pinScale)
  }

  // ── Camera zoom ──

  private zoomToPin(x: number, y: number): void {
    const cam = this.cameras.main
    this.tweens.add({
      targets: cam,
      scrollX: x - cam.width / 2,
      scrollY: y - cam.height / 2,
      zoom: 2.5,
      duration: 600,
      ease: 'Power2',
    })
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

  private onCountsUpdated = (): void => { /* counts shown on pins via fleet data */ }

  private onNavigateCampus = (): void => {
    if (this.scene.isSleeping(SCENE_KEYS.CAMPUS)) {
      this.scene.wake(SCENE_KEYS.CAMPUS)
    }
  }
}
