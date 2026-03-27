import Phaser from 'phaser'
import type { Room, WorkstationSprite } from './office-types'
import { WORLD_MARGIN, LOD_L1_MAX, LOD_L2_MAX } from './office-constants'
import { SPRITESHEET_KEYS, EFFECT_ANIM_KEYS, ICON_FRAMES } from './office-asset-keys'
import { soundEngine } from './sound-engine'

// ---------------------------------------------------------------------------
// OfficeAmbient — ambient office-life activity effects
// Paper airplanes, coffee refills, phone rings, printer noise, door peeks.
// ---------------------------------------------------------------------------

type WsEntry = { ws: WorkstationSprite; room: Room }
type PickFn = (arr: WsEntry[]) => WsEntry

export class OfficeAmbient {
  private scene: Phaser.Scene
  private timer: Phaser.Time.TimerEvent | null = null
  private getRooms: (() => Map<string, Room>) | null = null
  private getWorldSize: (() => { worldWidth: number; worldHeight: number }) | null = null

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  start(
    getRooms: () => Map<string, Room>,
    getWorldSize: () => { worldWidth: number; worldHeight: number },
  ): void {
    this.getRooms = getRooms
    this.getWorldSize = getWorldSize
    this.scheduleNext()
  }

  destroy(): void {
    this.timer?.destroy()
    this.timer = null
  }

  // ---------------------------------------------------------------------------
  // Scheduling
  // ---------------------------------------------------------------------------

  private scheduleNext(): void {
    const delay = 8000 + Math.random() * 7000
    this.timer = this.scene.time.delayedCall(delay, () => {
      this.tick()
      this.scheduleNext()
    })
  }

  private tick(): void {
    const rooms = this.getRooms?.()
    if (!rooms) return
    if (this.scene.cameras.main.zoom <= LOD_L1_MAX) return
    if (rooms.size === 0) return

    const allWorkstations: WsEntry[] = []
    for (const room of rooms.values()) {
      for (const ws of room.workstations.values()) {
        allWorkstations.push({ ws, room })
      }
    }
    if (allWorkstations.length === 0) return

    const pick: PickFn = (arr) => arr[Math.floor(Math.random() * arr.length)]
    const allRooms = Array.from(rooms.values())

    const eventType = Math.floor(Math.random() * 5)

    switch (eventType) {
      case 0: this.ambientPaperAirplane(allWorkstations, pick); break
      case 1: this.ambientCoffeeRefill(allWorkstations, pick); break
      case 2: this.ambientPhoneRing(allWorkstations, pick); break
      case 3: this.ambientPrinterNoise(); break
      case 4: this.ambientDoorPeek(allRooms); break
    }
  }

  // ---------------------------------------------------------------------------
  // VFX helper — play a small sprite-based effect at a world position
  // ---------------------------------------------------------------------------

  private playVFX(
    x: number, y: number,
    animKey: string,
    sheetKey: string,
    scale: number = 0.12,
    alpha: number = 0.5,
  ): void {
    if (!this.scene.anims.exists(animKey)) return
    const vfx = this.scene.add.sprite(x, y, sheetKey, 0)
      .setScale(scale).setAlpha(alpha).setDepth(55)
    vfx.play(animKey)
    vfx.once('animationcomplete', () => {
      try { vfx.destroy() } catch { /* already gone */ }
    })
  }

  // ---------------------------------------------------------------------------
  // (a) Paper airplane — tiny triangle glides in a parabolic arc between two workstations
  // ---------------------------------------------------------------------------

  private ambientPaperAirplane(allWorkstations: WsEntry[], pick: PickFn): void {
    if (allWorkstations.length < 2) return
    const fromEntry = pick(allWorkstations)
    let toEntry = pick(allWorkstations)
    let attempts = 0
    while (toEntry.ws === fromEntry.ws && attempts++ < 6) {
      toEntry = pick(allWorkstations)
    }
    if (toEntry.ws === fromEntry.ws) return

    const fromX = fromEntry.room.x + fromEntry.ws.container.x
    const fromY = fromEntry.room.y + fromEntry.ws.container.y - 10
    const toX   = toEntry.room.x + toEntry.ws.container.x
    const toY   = toEntry.room.y + toEntry.ws.container.y - 10

    const plane = this.scene.add.graphics()
    plane.fillStyle(0xf8fafc, 0.2)
    plane.fillTriangle(0, -3, 5, 3, -5, 3)
    plane.setPosition(fromX, fromY)
    plane.setDepth(50)

    // Control point for the quadratic Bezier arc — raised above the midpoint
    const midX = (fromX + toX) / 2
    const midY = Math.min(fromY, toY) - 40 - Math.random() * 20

    this.scene.tweens.add({
      targets: plane,
      duration: 1500,
      ease: 'Sine.easeInOut',
      onUpdate: (tween: Phaser.Tweens.Tween) => {
        const t = tween.progress
        const inv = 1 - t
        plane.x = inv * inv * fromX + 2 * inv * t * midX + t * t * toX
        plane.y = inv * inv * fromY + 2 * inv * t * midY + t * t * toY
        if (t > 0.01) {
          const dx = 2 * inv * (midX - fromX) + 2 * t * (toX - midX)
          const dy = 2 * inv * (midY - fromY) + 2 * t * (toY - midY)
          plane.setRotation(Math.atan2(dy, dx) - Math.PI / 2)
        }
      },
      onComplete: () => {
        // Small puff when the airplane "lands"
        this.playVFX(plane.x, plane.y, EFFECT_ANIM_KEYS.PUFF, SPRITESHEET_KEYS.EFFECTS_PUFF, 0.10, 0.35)
        try { plane.destroy() } catch { /* already gone */ }
      },
    })
  }

  // ---------------------------------------------------------------------------
  // (b) Coffee refill — faster burst of steam puffs at a random idle desk
  // ---------------------------------------------------------------------------

  private ambientCoffeeRefill(allWorkstations: WsEntry[], pick: PickFn): void {
    const idleEntries = allWorkstations.filter(e => e.ws.lastAnimMode === 'idle' && e.ws.steamContainer)
    const pool = idleEntries.length > 0 ? idleEntries : allWorkstations
    const entry = pick(pool)
    const { ws, room } = entry
    if (!ws.steamContainer) return

    // Play coffee pour sound alongside the visual steam burst
    soundEngine.coffeePour()

    // Play a small steam puff VFX above the mug
    const vfxX = room.x + ws.container.x + ws.steamContainer.x
    const vfxY = room.y + ws.container.y + ws.steamContainer.y - 6
    this.playVFX(vfxX, vfxY, EFFECT_ANIM_KEYS.PUFF, SPRITESHEET_KEYS.EFFECTS_PUFF, 0.08, 0.3)

    const container = ws.steamContainer
    for (let i = 0; i < 3; i++) {
      const xOff = (i - 1) * 2.5 + (Math.random() - 0.5)
      const particle = this.scene.add.sprite(xOff, 0, SPRITESHEET_KEYS.GAME_ICONS, ICON_FRAMES.CIRCLE_GREY)
        .setScale(0.08).setAlpha(0.5).setTint(0xffffff)
      container.add(particle)
      this.scene.tweens.add({
        targets: particle,
        y: -10 - Math.random() * 5,
        alpha: 0,
        duration: 600,
        delay: i * 120,
        ease: 'Sine.easeOut',
        onComplete: () => {
          try { container.remove(particle, true) } catch { /* already gone */ }
        },
      })
    }
  }

  // ---------------------------------------------------------------------------
  // (c) Phone ring — rapid 3-blink animation on a random desk phone light
  // ---------------------------------------------------------------------------

  private ambientPhoneRing(allWorkstations: WsEntry[], pick: PickFn): void {
    const withPhone = allWorkstations.filter(e => e.ws.phoneLight)
    if (withPhone.length === 0) return
    const entry = pick(withPhone)
    const { ws, room } = entry
    const light = ws.phoneLight!
    const origAlpha = light.alpha
    const origColor = light.fillColor

    // Play notification sound alongside the visual blink
    soundEngine.notification()

    // Sprite flash overlay — CIRCLE_YELLOW pulses near the phone light (LOD 3 only)
    if (this.scene.cameras.main.zoom > LOD_L2_MAX) {
      // Phone light is at local (-18, WS_DESK_Y - 6) inside the ws container
      const flashX = room.x + ws.container.x - 18
      const flashY = room.y + ws.container.y + light.y
      const flash = this.scene.add.sprite(flashX, flashY, SPRITESHEET_KEYS.GAME_ICONS, ICON_FRAMES.CIRCLE_YELLOW)
        .setScale(0.08).setAlpha(0).setDepth(56)
      // Pulse in, hold, pulse out over the blink duration
      this.scene.tweens.add({
        targets: flash,
        alpha: { from: 0, to: 0.7 },
        scale: { from: 0.06, to: 0.14 },
        duration: 150,
        yoyo: true,
        repeat: 2,
        ease: 'Sine.easeInOut',
        onComplete: () => { try { flash.destroy() } catch { /* already gone */ } },
      })
    }

    let blinks = 0
    const doBlink = () => {
      if (blinks >= 6) {
        light.setAlpha(origAlpha)
        light.setFillStyle(origColor)
        return
      }
      const on = blinks % 2 === 0
      light.setAlpha(on ? 0.95 : 0.1)
      light.setFillStyle(on ? 0x60a5fa : origColor)
      blinks++
      this.scene.time.delayedCall(100, doBlink)
    }
    doBlink()
  }

  // ---------------------------------------------------------------------------
  // (d) Printer noise — a tiny paper strip slides out of the printer sprite location
  // ---------------------------------------------------------------------------

  private ambientPrinterNoise(): void {
    const worldSize = this.getWorldSize?.()
    if (!worldSize) return

    const { worldWidth, worldHeight } = worldSize
    const PAD    = 30
    const WALL_T = 5
    const bx = WORLD_MARGIN - PAD
    const by = WORLD_MARGIN - PAD
    const bw = worldWidth  - WORLD_MARGIN + PAD * 2
    const bh = worldHeight - WORLD_MARGIN + PAD * 2
    const fx = bx + WALL_T
    const fy = by + WALL_T
    const fw = bw - WALL_T * 2
    const fh = bh - WALL_T * 2

    if (fw <= 280 || fh <= 140) return

    const printerX = fx + fw - 22
    const printerY = fy + fh / 2

    const paper = this.scene.add.rectangle(printerX, printerY, 4, 1, 0xf8fafc)
    paper.setAlpha(0.6)
    paper.setDepth(10)

    // Small smoke puff as the printer "churns"
    this.playVFX(printerX, printerY - 4, EFFECT_ANIM_KEYS.SMOKE, SPRITESHEET_KEYS.EFFECTS_SMOKE, 0.10, 0.25)

    this.scene.tweens.add({
      targets: paper,
      x: printerX - 18,
      duration: 500,
      ease: 'Linear',
      onComplete: () => {
        this.scene.tweens.add({
          targets: paper,
          alpha: 0,
          duration: 300,
          onComplete: () => {
            try { paper.destroy() } catch { /* already gone */ }
          },
        })
      },
    })
  }

  // ---------------------------------------------------------------------------
  // (e) Door peek — briefly squish a random room door suggesting someone peeked in
  // ---------------------------------------------------------------------------

  private ambientDoorPeek(allRooms: Room[]): void {
    if (allRooms.length === 0) return
    const room = allRooms[Math.floor(Math.random() * allRooms.length)]
    const door = room.doorGraphics
    if (!door) return

    this.scene.tweens.add({
      targets: door,
      scaleX: 0.7,
      duration: 180,
      ease: 'Sine.easeIn',
      onComplete: () => {
        this.scene.tweens.add({
          targets: door,
          scaleX: 1,
          duration: 220,
          ease: 'Sine.easeOut',
        })
      },
    })
  }
}
