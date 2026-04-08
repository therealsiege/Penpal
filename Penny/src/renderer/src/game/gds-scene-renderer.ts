// gds-scene-renderer.ts
// Renders a GDS-exported scene as a single backdrop image.
// Unoccupied desk positions are masked by overlaying floor tiles from the
// sprite atlas on top of the backdrop at each empty desk location.

import Phaser from 'phaser'
import { GDS_SCENE_WIDTH, GDS_SCENE_HEIGHT, CHAR_SCALE, scaledFontSize } from './office-constants'
import { ANIM_KEYS, GDS_SCENE_KEYS } from './office-asset-keys'
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

export interface LabMapProp {
  id: string
  type: 'rotating-knob' | 'blink-led' | 'pulse-glow' | 'console-flash'
  gdsX: number
  gdsY: number
  // rotating-knob
  speed?: number
  radius?: number
  // blink-led
  color?: string
  interval?: number
  // pulse-glow
  minAlpha?: number
  maxAlpha?: number
  period?: number
}

// ---------------------------------------------------------------------------
// Lab-map types (loaded from lab-map.json at runtime)
// ---------------------------------------------------------------------------

export interface LabMapRoom {
  id: string
  gdsX: number
  gdsY: number
  width: number
  height: number
}

export interface LabMapDoor {
  id: string
  type: 'laser' | 'sliding'
  gdsX: number
  gdsY: number
  width: number
  height: number
  color?: string     // hex string e.g. "0xc084fc"
  glowColor?: string // hex string e.g. "0xa855f7"
  proximityPx?: number
}

export interface LabMapJson {
  version: number
  rooms?: LabMapRoom[]
  desks?: { gdsX: number; gdsY: number }[]
  doors?: LabMapDoor[]
}

function loadLabMap(scene: Phaser.Scene, key: string): LabMapJson {
  const data = scene.cache.json.get(key) as LabMapJson | undefined
  if (!data?.doors) return { version: 0, rooms: [], desks: [], doors: [] }
  return { rooms: [], desks: [], doors: [], ...data }
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
// Ambient prop definitions in GDS scene space (3840×2160)
// ---------------------------------------------------------------------------

const GDS_PROP_DEFS: LabMapProp[] = [
  { id: 'console-knob-1',  type: 'rotating-knob', gdsX: 1200, gdsY: 500,  speed: 0.5, radius: 6 },
  { id: 'console-knob-2',  type: 'rotating-knob', gdsX: 1550, gdsY: 920,  speed: 0.8, radius: 5 },
  { id: 'rack-led-1',      type: 'blink-led',     gdsX: 2400, gdsY: 300,  color: 'green', interval: 1200 },
  { id: 'rack-led-2',      type: 'blink-led',     gdsX: 2400, gdsY: 380,  color: 'amber', interval: 900 },
  { id: 'reactor-core',    type: 'pulse-glow',    gdsX: 1920, gdsY: 1080, radius: 18, color: 'cyan', minAlpha: 0.15, maxAlpha: 0.55, period: 2200 },
  { id: 'console-flash-1', type: 'console-flash', gdsX: 1478, gdsY: 918,  radius: 12 },
]

const PROP_COLOR_MAP: Record<string, number> = {
  green: 0x22c55e,
  amber: 0xf59e0b,
  red:   0xef4444,
  cyan:  0x00e5ff,
  blue:  0x3b82f6,
}

function propColor(name: string | undefined): number {
  return (name && PROP_COLOR_MAP[name]) ?? 0x22c55e
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SCENE_DEPTH = -3

// ---------------------------------------------------------------------------
// GdsSceneRenderer
// ---------------------------------------------------------------------------

interface PropOverlayEntry {
  id: string
  type: string
  gfx: Phaser.GameObjects.Graphics
  worldX: number
  worldY: number
  // rotating-knob
  angle: number
  speed: number
  radius: number
  // pulse-glow maxAlpha (may be adjusted by ceiling intensity)
  baseMaxAlpha: number
  pulseTween: Phaser.Tweens.Tween | null
  // blink-led
  blinkTimer: Phaser.Time.TimerEvent | null
  ledOn: boolean
  ledColor: number
}

export class GdsSceneRenderer {
  private scene: Phaser.Scene
  private backdrop: Phaser.GameObjects.Image | null = null
  private rendered = false

  private scale = 1
  private originX = 0
  private originY = 0

  private labMap: LabMapJson = { version: 0, rooms: [], desks: [], doors: [] }
  private laserDoors: Array<{
    id: string
    graphics: Phaser.GameObjects.Graphics
    worldX: number
    worldY: number
    worldW: number
    worldH: number
    color: number
    glowColor: number
    proximityPx: number
    open: boolean
  }> = []
  private propOverlays: PropOverlayEntry[] = []

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
    this.placeLaserDoors(GDS_SCENE_KEYS.LAB_MAP)
    this.placePropOverlays()
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
  // Laser doors — data-driven from lab-map.json
  // -------------------------------------------------------------------------

  private placeLaserDoors(labMapKey: string): void {
    // Destroy existing
    for (const d of this.laserDoors) d.graphics.destroy()
    this.laserDoors = []

    this.labMap = loadLabMap(this.scene, labMapKey)
    const doors = (this.labMap.doors ?? []).filter(d => d.type === 'laser')

    for (const d of doors) {
      const wx = this.originX + d.gdsX * this.scale
      const wy = this.originY + d.gdsY * this.scale
      const ww = d.width * this.scale
      const wh = d.height * this.scale

      const color = parseInt((d.color ?? '0xc084fc').replace(/^0x/i, ''), 16)
      const glowColor = parseInt((d.glowColor ?? '0xa855f7').replace(/^0x/i, ''), 16)
      const proximityPx = d.proximityPx ?? 50

      const g = this.scene.add.graphics()
      g.setDepth(1)
      // Main beam fill
      g.fillStyle(color, 0.55)
      g.fillRect(wx, wy, ww, wh)
      // Glow border
      g.lineStyle(2, glowColor, 0.8)
      g.strokeRect(wx, wy, ww, wh)
      // Emitter dots at corners
      const dotR = 4
      g.fillStyle(glowColor, 0.9)
      g.fillCircle(wx, wy, dotR)
      g.fillCircle(wx + ww, wy, dotR)
      g.fillCircle(wx, wy + wh, dotR)
      g.fillCircle(wx + ww, wy + wh, dotR)

      this.laserDoors.push({ id: d.id, graphics: g, worldX: wx, worldY: wy, worldW: ww, worldH: wh, color, glowColor, proximityPx, open: false })
    }
  }

  updateLaserDoors(agentWorldPositions: { x: number; y: number }[]): void {
    for (const door of this.laserDoors) {
      const doorCX = door.worldX + door.worldW / 2
      const doorCY = door.worldY + door.worldH / 2
      const threshold = door.proximityPx
      const threshold2 = threshold * threshold
      const anyClose = agentWorldPositions.some(p => {
        const dx = p.x - doorCX
        const dy = p.y - doorCY
        return dx * dx + dy * dy < threshold2
      })
      if (anyClose !== door.open) {
        door.open = anyClose
        door.graphics.setVisible(!anyClose)
      }
    }
  }

  // -------------------------------------------------------------------------
  // Prop overlays — ambient animated graphics layered over the GDS backdrop
  // -------------------------------------------------------------------------

  private placePropOverlays(): void {
    this.cleanupPropOverlays()

    for (const def of GDS_PROP_DEFS) {
      const wx = this.originX + def.gdsX * this.scale
      const wy = this.originY + def.gdsY * this.scale
      const r  = (def.radius ?? 6) * this.scale
      const gfx = this.scene.add.graphics().setDepth(SCENE_DEPTH + 1)

      const entry: PropOverlayEntry = {
        id: def.id,
        type: def.type,
        gfx,
        worldX: wx,
        worldY: wy,
        angle: 0,
        speed: def.speed ?? 0.5,
        radius: r,
        baseMaxAlpha: def.maxAlpha ?? 0.55,
        pulseTween: null,
        blinkTimer: null,
        ledOn: true,
        ledColor: propColor(def.color),
      }

      if (def.type === 'rotating-knob') {
        this.drawKnob(gfx, wx, wy, r, 0)

      } else if (def.type === 'blink-led') {
        const col = propColor(def.color)
        gfx.fillStyle(col, 1.0)
        gfx.fillCircle(wx, wy, r)
        const interval = def.interval ?? 1200
        entry.blinkTimer = this.scene.time.addEvent({
          delay: interval,
          loop: true,
          callback: () => {
            entry.ledOn = !entry.ledOn
            const targetAlpha = entry.ledOn ? 1.0 : 0.2
            this.scene.tweens.add({
              targets: gfx,
              alpha: targetAlpha,
              duration: 100,
              ease: 'Linear',
            })
          },
        })

      } else if (def.type === 'pulse-glow') {
        const col = propColor(def.color)
        const minA = def.minAlpha ?? 0.15
        const maxA = def.maxAlpha ?? 0.55
        gfx.fillStyle(col, maxA)
        gfx.fillCircle(wx, wy, r)
        gfx.setAlpha(minA)
        entry.pulseTween = this.scene.tweens.add({
          targets: gfx,
          alpha: { from: minA, to: maxA },
          duration: (def.period ?? 2200) / 2,
          ease: 'Sine.easeInOut',
          yoyo: true,
          repeat: -1,
        })

      } else if (def.type === 'console-flash') {
        const col = propColor(def.color)
        gfx.fillStyle(col, 0.9)
        gfx.fillCircle(wx, wy, r)
        gfx.setAlpha(0)
      }

      this.propOverlays.push(entry)
    }
  }

  private drawKnob(gfx: Phaser.GameObjects.Graphics, cx: number, cy: number, r: number, angle: number): void {
    gfx.clear()
    gfx.lineStyle(Math.max(1, r * 0.3), activeTheme.accentText ? 0x94a3b8 : 0x94a3b8, 0.6)
    gfx.strokeCircle(cx, cy, r)
    const ex = cx + Math.cos(angle) * r * 0.8
    const ey = cy + Math.sin(angle) * r * 0.8
    gfx.lineStyle(Math.max(1, r * 0.25), 0x00e5ff, 0.85)
    gfx.lineBetween(cx, cy, ex, ey)
  }

  /** Called each frame from the update loop to advance rotating knobs. */
  updatePropOverlays(delta: number): void {
    for (const p of this.propOverlays) {
      if (p.type === 'rotating-knob') {
        p.angle += p.speed * delta * 0.001  // speed = radians per second
        this.drawKnob(p.gfx, p.worldX, p.worldY, p.radius, p.angle)
      }
    }
  }

  /** Flash the nearest console-flash prop within `radiusWorld` of the given world position. */
  flashConsoleProp(worldX: number, worldY: number, radiusWorld = 80): void {
    let nearest: PropOverlayEntry | null = null
    let bestDist = radiusWorld * radiusWorld
    for (const p of this.propOverlays) {
      if (p.type !== 'console-flash') continue
      const dx = p.worldX - worldX
      const dy = p.worldY - worldY
      const dist2 = dx * dx + dy * dy
      if (dist2 < bestDist) { bestDist = dist2; nearest = p }
    }
    if (!nearest) return
    const gfx = nearest.gfx
    gfx.setAlpha(0)
    this.scene.tweens.add({
      targets: gfx,
      alpha: { from: 0, to: 0.9 },
      duration: 80,
      ease: 'Linear',
      yoyo: false,
      onComplete: () => {
        this.scene.tweens.add({
          targets: gfx,
          alpha: 0,
          duration: 220,
          ease: 'Cubic.easeOut',
        })
      },
    })
  }

  /**
   * Adjust ceiling / pulse-glow intensity based on time-of-day.
   * @param t  0–1 where 0 = night (dim) and 1 = midday (bright)
   */
  setCeilingLightIntensity(t: number): void {
    for (const p of this.propOverlays) {
      if (p.type !== 'pulse-glow' || !p.pulseTween) continue
      const newMax = p.baseMaxAlpha * (0.4 + 0.6 * t)
      // Update the tween end value — restart for clean transition
      p.pulseTween.stop()
      const gfx = p.gfx
      const minA = p.baseMaxAlpha * 0.3 * (0.4 + 0.6 * t)
      p.pulseTween = this.scene.tweens.add({
        targets: gfx,
        alpha: { from: minA, to: newMax },
        duration: 1100,
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: -1,
      })
    }
  }

  // ── Test helpers ──

  /** Number of active prop overlay entries (for tests). */
  getPropOverlayCount(): number { return this.propOverlays.length }

  /** Snapshot of a prop overlay by id (for tests). Returns null if not found. */
  getPropById(id: string): { angle: number; alpha: number } | null {
    const p = this.propOverlays.find(e => e.id === id)
    if (!p) return null
    return { angle: p.angle, alpha: p.gfx.alpha }
  }

  private cleanupPropOverlays(): void {
    for (const p of this.propOverlays) {
      if (p.pulseTween) { p.pulseTween.stop(); p.pulseTween = null }
      if (p.blinkTimer) { p.blinkTimer.destroy(); p.blinkTimer = null }
      p.gfx.destroy()
    }
    this.propOverlays = []
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
    const visible = lodLevel >= 1
    for (const d of this.laserDoors) {
      if (!d.open) d.graphics.setVisible(visible)
    }
  }

  // -------------------------------------------------------------------------
  // Cleanup / destroy
  // -------------------------------------------------------------------------

  cleanup(): void {
    if (this.backdrop) { this.backdrop.destroy(); this.backdrop = null }
    for (const c of this.baristaContainers) c.destroy(true)
    this.baristaContainers = []
    for (const d of this.laserDoors) {
      if ('graphics' in d) (d as { graphics: Phaser.GameObjects.Graphics }).graphics.destroy()
      if ('gfx' in d) (d as { gfx: Phaser.GameObjects.Graphics }).gfx.destroy()
    }
    this.laserDoors = []
    this.cleanupPropOverlays()
    this.rendered = false
  }

  destroy(): void { this.cleanup() }
  isRendered(): boolean { return this.rendered }
}
