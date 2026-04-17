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

// ---------------------------------------------------------------------------
// Prop overlays — animated ambient equipment
// ---------------------------------------------------------------------------

export type LabMapPropType = 'rotating-knob' | 'blink-led' | 'pulse-glow' | 'ceiling-light' | 'steam-vent'

export interface LabMapProp {
  id: string
  type: LabMapPropType
  gdsX: number
  gdsY: number
  /** rotating-knob: rotations/second (default 0.5) */
  speed?: number
  /** LED/glow color: green | amber | red | blue | white | cyan */
  color?: string
  /** blink-led: ms between state changes (default 1200) */
  interval?: number
  /** Prop radius in GDS space (default 10) */
  radius?: number
  /** pulse-glow: max alpha 0–1 (default 0.65) */
  intensity?: number
  /** Desk id this prop is linked to for task-complete flash */
  nearDesk?: string
  notes?: string
}

export interface LabMapJson {
  scene?: { width: number; height: number; backdrop: string; stoolYNudge?: number }
  rooms?: LabMapRoom[]
  desks?: LabMapDesk[]
  cafeSttools?: { id: string; gdsX: number; gdsY: number }[]
  walkableTiles?: { x: number; y: number; w: number; h: number }[]
  props?: LabMapProp[]
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
// LED color palette
// ---------------------------------------------------------------------------

const LED_COLORS: Record<string, number> = {
  green:  0x22dd44,
  amber:  0xffaa00,
  red:    0xff3333,
  blue:   0x4488ff,
  white:  0xeeeeff,
  cyan:   0x00eeff,
}

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
    this.placeProps()
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
      const containerScale = this.scale * 1.5  // match workstation duder size

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
  // Prop overlays — ambient equipment animations
  // -------------------------------------------------------------------------

  /** All prop game objects — destroyed on cleanup */
  private propOverlays: Phaser.GameObjects.GameObject[] = []
  /** Steam vent containers — toggled by setSteamActive */
  private steamContainers: Phaser.GameObjects.Container[] = []
  /** Ceiling light overlays — alpha adjusted by setAtmosphereLevel */
  private ceilingLightOverlays: Phaser.GameObjects.Rectangle[] = []
  /** Prop lookup by id — for flash targeting */
  private propById = new Map<string, Phaser.GameObjects.GameObject[]>()

  private placeProps(): void {
    for (const go of this.propOverlays) { if (go.active) go.destroy() }
    this.propOverlays = []
    this.steamContainers = []
    this.ceilingLightOverlays = []
    this.propById.clear()

    const props = this.labMap.props ?? []
    for (const prop of props) {
      const wx = this.originX + prop.gdsX * this.scale
      const wy = this.originY + prop.gdsY * this.scale
      switch (prop.type) {
        case 'rotating-knob':  this.createKnob(wx, wy, prop);  break
        case 'blink-led':      this.createLed(wx, wy, prop);   break
        case 'pulse-glow':     this.createPulseGlow(wx, wy, prop); break
        case 'ceiling-light':  this.createCeilingLight(wx, wy, prop); break
        case 'steam-vent':     this.createSteamVent(wx, wy, prop); break
      }
    }
  }

  private registerProp(id: string, go: Phaser.GameObjects.GameObject): void {
    const list = this.propById.get(id) ?? []
    list.push(go)
    this.propById.set(id, list)
    this.propOverlays.push(go)
  }

  // Rotating knob — continuous rotation tween
  private createKnob(wx: number, wy: number, prop: LabMapProp): void {
    const r = (prop.radius ?? 10) * this.scale
    const g = this.scene.add.graphics()
    g.x = wx
    g.y = wy
    g.setDepth(SCENE_DEPTH + 2)

    // Knob body
    g.fillStyle(0x3a3a4a, 1)
    g.fillCircle(0, 0, r)
    // Knob face
    g.fillStyle(0x606070, 1)
    g.fillCircle(0, 0, r * 0.72)
    // Indicator mark
    const markColor = LED_COLORS[prop.color ?? 'amber'] ?? 0xffaa00
    g.fillStyle(markColor, 0.9)
    g.fillRect(-1.5, -r * 0.78, 3, r * 0.45)

    const speed = prop.speed ?? 0.5
    const duration = Math.round((1 / speed) * 4000)
    this.scene.tweens.add({
      targets: g,
      angle: 360,
      duration,
      repeat: -1,
      ease: 'Linear',
    })

    this.registerProp(prop.id, g)
  }

  // Blinking LED — irregular on/off via recursive time events
  private createLed(wx: number, wy: number, prop: LabMapProp): void {
    const r = (prop.radius ?? 5) * this.scale
    const color = LED_COLORS[prop.color ?? 'green'] ?? 0x22dd44
    const arc = this.scene.add.arc(wx, wy, r, 0, 360, false, color, 0.85)
    arc.setDepth(SCENE_DEPTH + 2)

    // Small glow halo
    const halo = this.scene.add.arc(wx, wy, r * 2.2, 0, 360, false, color, 0.18)
    halo.setDepth(SCENE_DEPTH + 1)

    const baseInterval = prop.interval ?? 1200
    const blink = (target: Phaser.GameObjects.Arc, haloTarget: Phaser.GameObjects.Arc) => {
      if (!target.active) return
      const isOn = target.alpha > 0.4
      const delay = isOn
        ? baseInterval + (Math.random() - 0.5) * (baseInterval * 0.4)
        : 80 + Math.random() * 120

      this.scene.time.delayedCall(delay, () => {
        if (!target.active) return
        target.setAlpha(isOn ? 0.1 : 0.85)
        haloTarget.setAlpha(isOn ? 0.04 : 0.18)
        blink(target, haloTarget)
      })
    }

    // Stagger initial state randomly
    this.scene.time.delayedCall(Math.random() * baseInterval, () => blink(arc, halo))

    this.registerProp(prop.id, arc)
    this.registerProp(prop.id, halo)
  }

  // Pulsing glow — sine-wave alpha on concentric rings
  private createPulseGlow(wx: number, wy: number, prop: LabMapProp): void {
    const r = (prop.radius ?? 20) * this.scale
    const intensity = prop.intensity ?? 0.65
    const colorKey = prop.color ?? 'cyan'
    const color = LED_COLORS[colorKey] ?? 0x00eeff

    // Outer halo
    const outer = this.scene.add.arc(wx, wy, r * 2.8, 0, 360, false, color, 0)
    outer.setDepth(SCENE_DEPTH + 1)
    // Mid ring
    const mid = this.scene.add.arc(wx, wy, r * 1.7, 0, 360, false, color, 0)
    mid.setDepth(SCENE_DEPTH + 1)
    // Core
    const core = this.scene.add.arc(wx, wy, r, 0, 360, false, color, 0)
    core.setDepth(SCENE_DEPTH + 2)

    const dur = 2200

    this.scene.tweens.add({
      targets: outer,
      alpha: { from: 0, to: intensity * 0.22 },
      duration: dur,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
      delay: 0,
    })
    this.scene.tweens.add({
      targets: mid,
      alpha: { from: 0, to: intensity * 0.45 },
      duration: dur,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
      delay: 200,
    })
    this.scene.tweens.add({
      targets: core,
      alpha: { from: intensity * 0.3, to: intensity },
      duration: dur,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
      delay: 400,
    })

    this.registerProp(prop.id, outer)
    this.registerProp(prop.id, mid)
    this.registerProp(prop.id, core)
  }

  // Ceiling light — subtle ambient flicker, controllable alpha
  private createCeilingLight(wx: number, wy: number, prop: LabMapProp): void {
    const r = (prop.radius ?? 28) * this.scale
    const rect = this.scene.add.rectangle(wx, wy, r * 2.6, r * 3.5, 0xfffff0, 0.07)
    rect.setDepth(SCENE_DEPTH + 1)

    this.scene.tweens.add({
      targets: rect,
      alpha: { from: 0.05, to: 0.11 },
      duration: 3500 + Math.random() * 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
      delay: Math.random() * 1500,
    })

    this.ceilingLightOverlays.push(rect)
    this.registerProp(prop.id, rect)
  }

  // Steam vent — upward-moving puffs activated on demand
  private createSteamVent(wx: number, wy: number, prop: LabMapProp): void {
    const container = this.scene.add.container(wx, wy)
    container.setDepth(SCENE_DEPTH + 3)
    container.setVisible(false)

    const puffRadius = (prop.radius ?? 8) * this.scale
    const PUFFS = 4

    const animatePuff = (puff: Phaser.GameObjects.Arc, delayMs: number) => {
      this.scene.time.delayedCall(delayMs, () => {
        if (!puff.active || !container.active || !container.visible) return
        puff.setAlpha(0)
        puff.y = 0
        puff.x = (Math.random() - 0.5) * puffRadius * 2
        this.scene.tweens.add({
          targets: puff,
          y: -(28 + Math.random() * 18) * this.scale,
          alpha: [
            { value: 0.55, duration: 400, ease: 'Sine.easeOut' },
            { value: 0, duration: 600, ease: 'Sine.easeIn' },
          ],
          duration: 1000,
          onComplete: () => {
            animatePuff(puff, 200 + Math.random() * 700)
          },
        })
      })
    }

    for (let i = 0; i < PUFFS; i++) {
      const puff = this.scene.add.arc(
        (Math.random() - 0.5) * puffRadius * 2,
        0,
        puffRadius * (0.6 + Math.random() * 0.4),
        0, 360, false,
        0xbbddff, 0
      )
      container.add(puff)
      // Stagger puff start times
      animatePuff(puff, i * 280 + Math.random() * 200)
    }

    this.steamContainers.push(container)
    this.propOverlays.push(container)
  }

  // -------------------------------------------------------------------------
  // Event-driven prop API
  // -------------------------------------------------------------------------

  /**
   * Flash all console knobs and LEDs linked to the given desk.
   * Pass no deskId to flash all console props globally.
   */
  flashConsoles(nearDeskId?: string): void {
    const props = this.labMap.props ?? []
    for (const prop of props) {
      if (prop.type !== 'rotating-knob' && prop.type !== 'blink-led') continue
      if (nearDeskId && prop.nearDesk && prop.nearDesk !== nearDeskId) continue

      const targets = this.propById.get(prop.id) ?? []
      for (const go of targets) {
        if (!go.active) continue
        this.scene.tweens.add({
          targets: go,
          alpha: 1,
          duration: 60,
          yoyo: true,
          ease: 'Quad.easeOut',
        })
      }
    }
  }

  /**
   * Show or hide steam vent puffs.
   * Call with true when multiple agents are working.
   */
  setSteamActive(active: boolean): void {
    for (const c of this.steamContainers) {
      if (!c.active) continue
      c.setVisible(active)
    }
  }

  /**
   * Adjust ceiling light intensity based on atmosphere level.
   * @param level 0 = night (dim), 1 = day (bright)
   */
  setAtmosphereLevel(level: number): void {
    const clampedLevel = Math.max(0, Math.min(1, level))
    const minAlpha = 0.02
    const maxAlpha = 0.12
    const targetAlpha = minAlpha + (maxAlpha - minAlpha) * clampedLevel
    for (const rect of this.ceilingLightOverlays) {
      if (!rect.active) continue
      // Nudge the tween range — stop existing tweens first
      this.scene.tweens.killTweensOf(rect)
      const band = 0.03
      this.scene.tweens.add({
        targets: rect,
        alpha: { from: Math.max(0, targetAlpha - band), to: targetAlpha + band },
        duration: 4000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: Math.random() * 1000,
      })
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
    // Hide prop overlays at very low LOD (L1 overview)
    const propsVisible = lodLevel >= 2
    for (const go of this.propOverlays) {
      if (go.active) (go as any).setVisible(propsVisible)
    }
  }

  // -------------------------------------------------------------------------
  // Cleanup / destroy
  // -------------------------------------------------------------------------

  cleanup(): void {
    if (this.backdrop) { this.backdrop.destroy(); this.backdrop = null }
    for (const c of this.baristaContainers) c.destroy(true)
    this.baristaContainers = []
    for (const go of this.propOverlays) { if (go.active) go.destroy() }
    this.propOverlays = []
    this.steamContainers = []
    this.ceilingLightOverlays = []
    this.propById.clear()
    this.rendered = false
  }

  destroy(): void { this.cleanup() }
  isRendered(): boolean { return this.rendered }
}
