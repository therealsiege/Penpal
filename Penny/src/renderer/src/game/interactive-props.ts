// ---------------------------------------------------------------------------
// interactive-props.ts
// Clickable office props with idle animations and click reactions.
// Hybrid rendering: Graphics primitives for structural elements + GAME_ITEMS
// spritesheet sprites for recognizable item details (coffee cups, books, etc.)
// Midgar industrial palette: steel grays, mako green, cyan, gold.
// ---------------------------------------------------------------------------

import Phaser from 'phaser'
import { shake, pulse, bounce } from './juice-utils'
import { EventBus, EVENTS } from './events'
import { activeTheme } from './office-theme'
import { SPRITESHEET_KEYS, ITEM_FRAMES, ICON_FRAMES } from './office-asset-keys'
import { scaledFontSize } from './office-constants'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type PropType =
  | 'plant'
  | 'printer'
  | 'whiteboard'
  | 'coffee-machine'
  | 'arcade'
  | 'fish-tank'
  | 'vending-machine'
  | 'server-rack'
  | 'mako-lamp'
  | 'lava-lamp'
  | 'trophy-shelf'

export interface PropConfig {
  type: PropType
  x: number
  y: number
  /** World depth. Defaults to 10 (above bg, below agents). */
  depth?: number
}

// ---------------------------------------------------------------------------
// InteractiveProp
// ---------------------------------------------------------------------------

class InteractiveProp {
  readonly type: PropType
  private scene: Phaser.Scene
  readonly container: Phaser.GameObjects.Container
  private hitZone: Phaser.GameObjects.Rectangle
  private idleTween: Phaser.Tweens.Tween | null = null
  private idleTweens: Phaser.Tweens.Tween[] = []
  private reacting = false

  // Per-prop mutable state
  private whiteboardIndex = 0
  private whiteboardDisplay: Phaser.GameObjects.Text | null = null
  /** Orange glow graphics for printer — activated during reactPrinter */
  private printerGlow: Phaser.GameObjects.Graphics | null = null

  constructor(scene: Phaser.Scene, config: PropConfig) {
    this.scene = scene
    this.type = config.type
    const depth = config.depth ?? 10
    this.container = scene.add.container(config.x, config.y).setDepth(depth)

    // Build visual + record any animated sub-parts
    this.buildProp()

    // Invisible hit area over the prop — sized per type
    const [hw, hh] = this.hitSize()
    this.hitZone = scene.add.rectangle(config.x, config.y, hw, hh, 0x000000, 0)
      .setInteractive({ useHandCursor: true })
      .setDepth(depth + 1)

    this.hitZone.on('pointerdown', () => this.onClick())
    this.hitZone.on('pointerover', () => this.onHover(true))
    this.hitZone.on('pointerout',  () => this.onHover(false))

    this.startIdleAnimation()
  }

  // -------------------------------------------------------------------------
  // Build — draw the prop using Graphics primitives
  // -------------------------------------------------------------------------

  private buildProp(): void {
    switch (this.type) {
      case 'plant':            this.buildPlant();          break
      case 'printer':          this.buildPrinter();        break
      case 'whiteboard':       this.buildWhiteboard();     break
      case 'coffee-machine':   this.buildCoffeeMachine();  break
      case 'arcade':           this.buildArcade();         break
      case 'fish-tank':        this.buildFishTank();       break
      case 'vending-machine':  this.buildVendingMachine(); break
      case 'server-rack':      this.buildServerRack();     break
      case 'mako-lamp':        this.buildMakoLamp();       break
      case 'lava-lamp':        this.buildLavaLamp();       break
      case 'trophy-shelf':     this.buildTrophyShelf();    break
    }
  }

  private buildPlant(): void {
    const g = this.scene.add.graphics()
    // Pot
    g.fillStyle(0x7c4a1e, 1);  g.fillRect(-10, 4, 20, 14)
    g.fillStyle(0xa0622a, 1);  g.fillRect(-12, 2, 24, 4)
    // Soil
    g.fillStyle(0x3a2010, 1);  g.fillRect(-9, 4, 18, 4)
    // Stems
    g.lineStyle(2, 0x2d7a2d, 1)
    g.lineBetween(0, 4, -8, -10); g.lineBetween(0, 4, 0, -14); g.lineBetween(0, 4, 8, -10)
    // Leaves — green circle sprites scaled to elliptical look
    this.container.add(g)
    const leafData = [
      { x: -10, y: -11, sx: 0.44, sy: 0.28 },
      { x: 0,   y: -17, sx: 0.38, sy: 0.25 },
      { x: 10,  y: -11, sx: 0.44, sy: 0.28 },
    ]
    leafData.forEach((l, i) => {
      const leaf = this.tryIconSprite(ICON_FRAMES.CIRCLE_GREEN, l.x, l.y, 1)
      if (leaf) {
        leaf.setScale(l.sx, l.sy)
        // Alternate tint for depth variation
        if (i === 1) leaf.setTint(0x27ae60)
        this.container.add(leaf)
      }
    })
    // Leaf highlight sprite
    const highlight = this.tryIconSprite(ICON_FRAMES.CIRCLE_GREEN, -9, -13, 0.18, 0.5)
    if (highlight) {
      highlight.setTint(0x55dd66)
      this.container.add(highlight)
    }
  }

  private buildPrinter(): void {
    // Orange glow — inactive (alpha 0) until printer is activated via reactPrinter
    const printerGlow = this.scene.add.graphics()
    printerGlow.fillStyle(0xfb923c, 0.07)
    printerGlow.fillCircle(0, 0, 28)
    printerGlow.fillStyle(0xfb923c, 0.13)
    printerGlow.fillCircle(0, 0, 15)
    printerGlow.setAlpha(0)
    this.container.addAt(printerGlow, 0)  // behind all printer graphics
    this.printerGlow = printerGlow

    const g = this.scene.add.graphics()
    // Body — dark steel
    g.fillStyle(activeTheme.wall, 1); g.fillRect(-22, -10, 44, 20)
    g.fillStyle(activeTheme.deskBody, 1); g.fillRect(-22, -10, 44, 4)
    // Paper slot
    g.fillStyle(activeTheme.bg, 1); g.fillRect(-14, -7, 28, 3)
    // Status LED — mako green (icon sprite)
    const printerLed = this.tryIconSprite(ICON_FRAMES.CIRCLE_GREEN, 16, -6, 0.12)
    if (printerLed) this.container.add(printerLed)
    // Front lip
    g.fillStyle(activeTheme.wallInner, 1); g.fillRect(-18, 9, 36, 4)
    // Logo mark
    g.fillStyle(activeTheme.deskTop, 1); g.fillRect(-4, -4, 8, 6)
    // Mako-green edge glow line
    g.lineStyle(1, 0x00ff88, 0.3); g.lineBetween(-22, 10, 22, 10)
    this.container.add(g)
  }

  private buildWhiteboard(): void {
    const g = this.scene.add.graphics()
    // Frame — dark steel
    g.fillStyle(activeTheme.wall, 1); g.fillRect(-38, -28, 76, 56)
    // Board surface — dark holographic display
    g.fillStyle(activeTheme.headerBg, 1); g.fillRect(-34, -24, 68, 46)
    // Faint grid lines in mako green
    g.lineStyle(1, 0x00ff88, 0.06)
    for (let gy = -20; gy <= 18; gy += 8) {
      g.lineBetween(-34, gy, 34, gy)
    }
    for (let gx = -30; gx <= 30; gx += 10) {
      g.lineBetween(gx, -24, gx, 22)
    }
    // Marker tray
    g.fillStyle(activeTheme.wallInner, 1); g.fillRect(-34, 22, 68, 4)
    this.container.add(g)
    // Data indicator dots: green, blue, yellow icon sprites
    const dotFrames = [ICON_FRAMES.CIRCLE_GREEN, ICON_FRAMES.CIRCLE_BLUE, ICON_FRAMES.CIRCLE_YELLOW]
    dotFrames.forEach((frame, i) => {
      const dot = this.tryIconSprite(frame, -24 + i * 10, 24, 0.1)
      if (dot) this.container.add(dot)
    })

    // Terminal text drawn on top of board
    const eqs = ['SECTOR 7 SCAN', 'O(n log n)', '∑ xᵢ / n', 'λ f.(λ x.f(x x))', 'MAKO LVL OK']
    this.whiteboardDisplay = this.scene.add.text(-30, -20, eqs[0], {
      fontSize: scaledFontSize(7), color: '#00ff88', fontFamily: 'monospace', resolution: 2,
    }).setDepth(this.container.depth + 0.5)
    this.whiteboardDisplay.setPosition(
      this.container.x - 30,
      this.container.y - 20
    )
  }

  private buildCoffeeMachine(): void {
    const g = this.scene.add.graphics()
    // Body
    g.fillStyle(0x1e293b, 1); g.fillRect(-16, -22, 32, 38)
    g.fillStyle(0x334155, 1); g.fillRect(-14, -20, 28, 6)
    // Display panel
    g.fillStyle(0x0ea5e9, 0.7); g.fillRect(-10, -18, 20, 4)
    // Spout
    g.fillStyle(0x475569, 1); g.fillRect(-3, 4, 6, 8)
    // Buttons — icon sprites (green main, grey others)
    const btnFrames = [ICON_FRAMES.CIRCLE_GREEN, ICON_FRAMES.CIRCLE_GREY, ICON_FRAMES.CIRCLE_GREY]
    const btnXs = [-6, 0, 6]
    btnFrames.forEach((frame, i) => {
      const btn = this.tryIconSprite(frame, btnXs[i], -10, 0.12)
      if (btn) this.container.add(btn)
    })
    // Mako-green glow line on body
    g.lineStyle(1, 0x00ff88, 0.25); g.lineBetween(-16, 0, 16, 0)
    this.container.add(g)
    // Coffee cup sprite from GAME_ITEMS sheet (replaces old Graphics rectangle cup)
    const cup = this.tryItemSprite(ITEM_FRAMES.COFFEE_CUP, 0, 10, 0.5)
    if (cup) this.container.add(cup)
  }

  private buildArcade(): void {
    const g = this.scene.add.graphics()
    // Cabinet body — dark
    g.fillStyle(0x1a1a2e, 1); g.fillRect(-20, -44, 40, 64)
    // Screen bezel
    g.fillStyle(0x0f0f1a, 1); g.fillRect(-16, -40, 32, 26)
    // Screen surface
    g.fillStyle(0x000814, 1); g.fillRect(-14, -38, 28, 22)
    // Scanline tint — mako green (not magenta)
    g.fillStyle(0x00ff88, 0.1); g.fillRect(-14, -38, 28, 22)
    // Label area — dark steel
    g.fillStyle(activeTheme.wall, 0.8); g.fillRect(-14, -12, 28, 6)
    // Joystick — gold star sprite for the knob
    g.fillStyle(0x334155, 1); g.fillRect(-14, 4, 10, 10)
    const joystick = this.tryIconSprite(ICON_FRAMES.STAR_YELLOW, -8, 8, 0.10)
    if (joystick) this.container.add(joystick)
    // Buttons — tiny star sprites for arcade "pixel" look
    for (let i = 0; i < 4; i++) {
      const arcBtn = this.tryIconSprite(ICON_FRAMES.STAR_GREY, 4 + i * 7, 8, 0.10)
      if (arcBtn) this.container.add(arcBtn)
    }
    // Coin slot
    g.fillStyle(activeTheme.shadowDark, 1); g.fillRect(-8, 18, 16, 2)
    this.container.add(g)

    // Screen text — mako green
    const ic = this.scene.add.text(
      this.container.x - 11,
      this.container.y - 11,
      'INSERT COIN',
      { fontSize: scaledFontSize(4), color: '#00ff88', fontFamily: 'monospace', resolution: 2 }
    ).setDepth(this.container.depth + 0.5)
    void ic
  }

  private buildFishTank(): void {
    const g = this.scene.add.graphics()
    // Tank border — dark steel
    g.lineStyle(2, activeTheme.wall, 0.9); g.strokeRect(-30, -20, 60, 40)
    // Water — dark blue
    g.fillStyle(0x082f49, 0.85); g.fillRect(-28, -18, 56, 36)
    // Water surface glow
    g.fillStyle(0x00ff88, 0.06); g.fillRect(-28, -18, 56, 8)
    // Gravel
    g.fillStyle(0x78716c, 1); g.fillRect(-28, 16, 56, 4)
    // Bubbles — mako green icon sprites
    ;[-18, -8, 4, 16, 24].forEach((bx) => {
      const bubble = this.tryIconSprite(ICON_FRAMES.CIRCLE_GREEN, bx, -10, 0.06, 0.5)
      if (bubble) this.container.add(bubble)
    })
    // Fish — mako green specimen
    g.fillStyle(0x00ff88, 1)
    g.fillTriangle(-12, -4,  -4, -8,  -4, 0)
    g.fillTriangle(-14, -4, -18, -7, -18, -1)
    // Second fish — cyan specimen
    g.fillStyle(0x00e5ff, 1)
    g.fillTriangle(10, 2, 18, -2, 18, 6)
    g.fillTriangle(8,  2,  4, -1,  4,  5)
    this.container.add(g)
  }

  private buildVendingMachine(): void {
    const g = this.scene.add.graphics()
    // Body — dark steel
    g.fillStyle(activeTheme.deskBody, 1); g.fillRect(-22, -44, 44, 68)
    // Glass panel
    g.fillStyle(0x082f49, 0.9); g.fillRect(-18, -40, 36, 36)
    // Coin slot
    g.fillStyle(activeTheme.shadowDark, 1); g.fillRect(-4, 0, 8, 2)
    // Display — cyan
    g.fillStyle(activeTheme.monitorGlowActive, 0.7); g.fillRect(-14, 4, 28, 8)
    // Dispense tray
    g.fillStyle(activeTheme.shadowDark, 1); g.fillRect(-18, 16, 36, 6)
    g.fillStyle(activeTheme.wall, 1); g.fillRect(-16, 18, 32, 3)
    this.container.add(g)
    // Product rows — use GAME_ITEMS sprites instead of plain colored rectangles
    const shelfItems = [
      ITEM_FRAMES.BEER, ITEM_FRAMES.COFFEE_CUP, ITEM_FRAMES.DONUT,
      ITEM_FRAMES.PIZZA, ITEM_FRAMES.BEER, ITEM_FRAMES.COFFEE_CUP,
    ]
    for (let i = 0; i < shelfItems.length; i++) {
      const row = Math.floor(i / 3)
      const col = i % 3
      const sx = -12 + col * 12
      const sy = -34 + row * 14
      const spr = this.tryItemSprite(shelfItems[i], sx, sy, 0.3)
      if (spr) this.container.add(spr)
    }
  }

  private buildServerRack(): void {
    const g = this.scene.add.graphics()
    // Cabinet body — dark steel
    g.fillStyle(activeTheme.deskBody, 1); g.fillRect(-18, -28, 36, 56)
    // Cabinet border
    g.lineStyle(1, activeTheme.wall, 0.6); g.strokeRect(-18, -28, 36, 56)
    // 3 rack units
    const ledFrames = [ICON_FRAMES.CIRCLE_GREEN, ICON_FRAMES.CIRCLE_BLUE, ICON_FRAMES.CIRCLE_YELLOW]
    for (let i = 0; i < 3; i++) {
      const uy = -22 + i * 16
      g.fillStyle(activeTheme.wall, 1); g.fillRect(-14, uy, 28, 12)
      // LED row: green, cyan, gold icon sprites
      ledFrames.forEach((frame, j) => {
        const led = this.tryIconSprite(frame, -8 + j * 8, uy + 6, 0.08, 0.9)
        if (led) this.container.add(led)
      })
    }
    // Ventilation slits at bottom
    for (let s = 0; s < 4; s++) {
      g.fillStyle(activeTheme.bg, 0.6); g.fillRect(-12 + s * 7, 24, 5, 1)
    }
    // Cable bundle
    g.lineStyle(2, activeTheme.wallInner, 0.5)
    g.lineBetween(-4, 28, -4, 32)
    g.lineBetween(0, 28, 0, 34)
    g.lineBetween(4, 28, 4, 31)
    this.container.add(g)

    // Subtle green point light — server status LEDs scatter soft green onto floor
    const rackGlow = this.scene.add.graphics()
    rackGlow.fillStyle(0x00ff88, 0.06)
    rackGlow.fillCircle(0, 0, 30)
    rackGlow.fillStyle(0x00ff88, 0.10)
    rackGlow.fillCircle(0, 0, 18)
    rackGlow.fillStyle(0x22c55e, 0.14)
    rackGlow.fillCircle(0, 0, 8)
    this.container.addAt(rackGlow, 0)  // behind rack graphics
    this.scene.tweens.add({
      targets: rackGlow,
      alpha: { from: 0.55, to: 1.0 },
      duration: 1600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
      delay: Math.random() * 600,
    })
  }

  private buildMakoLamp(): void {
    const g = this.scene.add.graphics()
    // Weighted base
    g.fillStyle(activeTheme.wall, 1); g.fillRect(-8, 10, 16, 5)
    // Steel arm
    g.lineStyle(2, activeTheme.wallInner, 1)
    g.lineBetween(0, 10, -4, -4)
    g.lineBetween(-4, -4, 2, -12)
    // Lamp head housing
    g.fillStyle(activeTheme.wall, 1); g.fillRect(-6, -16, 16, 6)
    // Mako-green bulb glow — icon sprite core + Graphics outer halo
    g.fillStyle(0x00ff88, 0.2); g.fillCircle(2, -10, 9)
    this.container.add(g)
    const bulb = this.tryIconSprite(ICON_FRAMES.CIRCLE_GREEN, 2, -10, 0.22, 0.7)
    if (bulb) this.container.add(bulb)
  }

  private buildLavaLamp(): void {
    const g = this.scene.add.graphics()
    // Base
    g.fillStyle(activeTheme.wall, 1); g.fillRect(-7, 14, 14, 6)
    // Cap
    g.fillStyle(activeTheme.wall, 1); g.fillRect(-5, -20, 10, 4)
    // Cylindrical body
    g.fillStyle(activeTheme.deskBody, 1); g.fillRect(-6, -16, 12, 30)
    // Inner liquid background
    g.fillStyle(activeTheme.bg, 0.6); g.fillRect(-5, -15, 10, 28)
    this.container.add(g)
    // Mako green blobs — icon sprites (will be animated via container tween)
    const blobData = [
      { x: 0, y: -6, scale: 0.14, alpha: 0.8 },
      { x: -1, y: 4, scale: 0.18, alpha: 0.6 },
      { x: 1, y: 12, scale: 0.12, alpha: 0.7 },
    ]
    blobData.forEach((b) => {
      const blob = this.tryIconSprite(ICON_FRAMES.CIRCLE_GREEN, b.x, b.y, b.scale, b.alpha)
      if (blob) this.container.add(blob)
    })
  }

  private buildTrophyShelf(): void {
    const g = this.scene.add.graphics()
    // Shelf — dark steel
    g.fillStyle(activeTheme.deskBody, 1); g.fillRect(-24, -4, 48, 6)
    g.fillStyle(activeTheme.wall, 1); g.fillRect(-24, 2, 48, 3)
    // Faint shimmer base
    g.fillStyle(0xd4a017, 0.15); g.fillRect(-24, -16, 48, 14)
    this.container.add(g)
    // Trophy items from GAME_ITEMS (camera, book, headphones as collectibles)
    const trophyItems = [ITEM_FRAMES.CAMERA, ITEM_FRAMES.BOOK, ITEM_FRAMES.HEADPHONES]
    trophyItems.forEach((frame, i) => {
      const spr = this.tryItemSprite(frame, -16 + i * 16, -10, 0.45)
      if (spr) this.container.add(spr)
    })
  }

  // -------------------------------------------------------------------------
  // Idle animations — subtle looping tweens
  // -------------------------------------------------------------------------

  private startIdleAnimation(): void {
    switch (this.type) {
      case 'plant':
        this.idleTween = this.scene.tweens.add({
          targets: this.container, angle: { from: -1.5, to: 1.5 },
          duration: 2400, ease: 'Sine.easeInOut', yoyo: true, repeat: -1,
        })
        break
      case 'fish-tank':
        this.idleTween = this.scene.tweens.add({
          targets: this.container, x: this.container.x + 1,
          duration: 1800, ease: 'Sine.easeInOut', yoyo: true, repeat: -1,
        })
        break
      case 'arcade':
        this.idleTween = this.scene.tweens.add({
          targets: this.container, alpha: { from: 1, to: 0.88 },
          duration: 1200, ease: 'Sine.easeInOut', yoyo: true, repeat: -1,
        })
        break
      case 'coffee-machine':
        this.idleTween = this.scene.tweens.add({
          targets: this.container, alpha: { from: 1, to: 0.93 },
          duration: 2000, ease: 'Sine.easeInOut', yoyo: true, repeat: -1,
        })
        break
      case 'server-rack':
        // LEDs blink in sequence — staggered alpha pulses
        this.idleTween = this.scene.tweens.add({
          targets: this.container, alpha: { from: 1, to: 0.92 },
          duration: 800, ease: 'Sine.easeInOut', yoyo: true, repeat: -1,
        })
        break
      case 'mako-lamp':
        // Gentle pulse on the green glow
        this.idleTween = this.scene.tweens.add({
          targets: this.container, alpha: { from: 0.85, to: 1 },
          duration: 1600, ease: 'Sine.easeInOut', yoyo: true, repeat: -1,
        })
        break
      case 'lava-lamp':
        // Blobs drift — gentle sway
        this.idleTween = this.scene.tweens.add({
          targets: this.container, y: this.container.y + 1,
          duration: 2200, ease: 'Sine.easeInOut', yoyo: true, repeat: -1,
        })
        break
      case 'trophy-shelf':
        // Faint gold shimmer
        this.idleTween = this.scene.tweens.add({
          targets: this.container, alpha: { from: 0.95, to: 1 },
          duration: 2000, ease: 'Sine.easeInOut', yoyo: true, repeat: -1,
        })
        break
      default:
        break
    }
  }

  // -------------------------------------------------------------------------
  // Click reactions
  // -------------------------------------------------------------------------

  private onClick(): void {
    if (this.reacting) return
    this.reacting = true
    EventBus.emit(EVENTS.NOTIFICATION, `${this.type} activated!`, 'info')

    switch (this.type) {
      case 'plant':           this.reactPlant();          break
      case 'printer':         this.reactPrinter();        break
      case 'whiteboard':      this.reactWhiteboard();     break
      case 'coffee-machine':  this.reactCoffeeMachine();  break
      case 'arcade':          this.reactArcade();         break
      case 'fish-tank':       this.reactFishTank();       break
      case 'vending-machine': this.reactVendingMachine(); break
      case 'server-rack':     this.reactServerRack();     break
      case 'mako-lamp':       this.reactMakoLamp();       break
      case 'lava-lamp':       this.reactLavaLamp();       break
      case 'trophy-shelf':    this.reactTrophyShelf();    break
    }
  }

  private onHover(over: boolean): void {
    this.scene.tweens.add({
      targets: this.container,
      scaleX: over ? 1.06 : 1,
      scaleY: over ? 1.06 : 1,
      duration: 120,
      ease: 'Power2',
    })
  }

  private done(): void { this.reacting = false }

  private reactPlant(): void {
    shake(this.container as unknown as Parameters<typeof shake>[0], this.scene, {
      intensity: 5, duration: 340,
      onComplete: () => {
        this.spawnLeafParticle()
        this.done()
      },
    })
  }

  private reactPrinter(): void {
    // Flash orange accent glow when printing
    if (this.printerGlow) {
      const glow = this.printerGlow
      this.scene.tweens.add({
        targets: glow,
        alpha: { from: 0, to: 1.0 },
        duration: 120,
        ease: 'Power2',
        onComplete: () => {
          this.scene.tweens.add({
            targets: glow,
            alpha: 0,
            duration: 900,
            delay: 250,
            ease: 'Sine.easeOut',
          })
        },
      })
    }

    const paper = this.scene.add.rectangle(
      this.container.x, this.container.y - 10, 20, 2, 0xf8fafc
    ).setDepth(this.container.depth + 1)
    this.scene.tweens.add({
      targets: paper, y: this.container.y - 22,
      duration: 380, ease: 'Power1',
      onComplete: () => {
        this.scene.tweens.add({
          targets: paper, alpha: 0, duration: 600, delay: 300,
          onComplete: () => { paper.destroy(); this.done() },
        })
      },
    })
    shake(this.container as unknown as Parameters<typeof shake>[0], this.scene, { intensity: 2, duration: 280 })
  }

  private reactWhiteboard(): void {
    const eqs = ['SECTOR 7 SCAN', 'O(n log n)', '∑ xᵢ / n', 'λ f.(λ x.f(x x))', 'MAKO LVL OK', 'E = mc²', 'F = ma']
    this.whiteboardIndex = (this.whiteboardIndex + 1) % eqs.length
    if (this.whiteboardDisplay) {
      this.whiteboardDisplay.setText(eqs[this.whiteboardIndex])
      pulse(this.whiteboardDisplay as unknown as Parameters<typeof pulse>[0], this.scene, {
        scale: 1.1, duration: 180,
        onComplete: () => this.done(),
      })
    } else {
      this.done()
    }
  }

  private reactCoffeeMachine(): void {
    for (let i = 0; i < 4; i++) {
      const sx = this.container.x + Phaser.Math.Between(-4, 4)
      const sy = this.container.y + 4
      const steam = this.scene.add.graphics().setDepth(this.container.depth + 1)
      steam.fillStyle(0xe2e8f0, 0.55); steam.fillCircle(0, 0, 4 + i)
      steam.setPosition(sx, sy)
      this.scene.tweens.add({
        targets: steam, y: sy - 20 - i * 6, alpha: 0,
        duration: 600 + i * 120, delay: i * 80, ease: 'Power2',
        onComplete: () => steam.destroy(),
      })
    }
    bounce(this.container as unknown as Parameters<typeof bounce>[0], this.scene, {
      height: 4, duration: 300,
      onComplete: () => this.done(),
    })
  }

  private reactArcade(): void {
    const flashColors = [0x00ff88, 0x00e5ff, 0xd4a017, 0x00ff88]
    let step = 0
    const flashTimer = this.scene.time.addEvent({
      delay: 80, repeat: 7,
      callback: () => {
        this.container.setAlpha(step % 2 === 0 ? 0.6 : 1)
        this.container.list.forEach((child) => {
          if (child instanceof Phaser.GameObjects.Sprite) {
            child.setTint(flashColors[step % flashColors.length])
          }
        })
        step++
        if (step >= 8) {
          this.container.setAlpha(1)
          this.container.list.forEach((child) => {
            if (child instanceof Phaser.GameObjects.Sprite) child.clearTint()
          })
          flashTimer.destroy()
          this.done()
        }
      },
    })
  }

  private reactFishTank(): void {
    // Burst of mako-green bubble particles
    for (let i = 0; i < 6; i++) {
      const bx = this.container.x + Phaser.Math.Between(-22, 22)
      const by = this.container.y + Phaser.Math.Between(-10, 8)
      const bubble = this.scene.add.graphics().setDepth(this.container.depth + 1)
      bubble.lineStyle(1, 0x00ff88, 0.7); bubble.strokeCircle(0, 0, 2 + i * 0.4)
      bubble.setPosition(bx, by)
      this.scene.tweens.add({
        targets: bubble, y: by - 18 - i * 4, alpha: 0,
        duration: 500 + i * 100, delay: i * 60, ease: 'Power1',
        onComplete: () => bubble.destroy(),
      })
    }
    if (this.idleTween) {
      this.idleTween.timeScale = 4
      this.scene.time.delayedCall(800, () => {
        if (this.idleTween) this.idleTween.timeScale = 1
        this.done()
      })
    } else {
      this.done()
    }
  }

  private reactVendingMachine(): void {
    // Drop a random item sprite from the GAME_ITEMS sheet
    const dropFrames = [ITEM_FRAMES.PIZZA, ITEM_FRAMES.BEER, ITEM_FRAMES.DONUT, ITEM_FRAMES.COFFEE_CUP]
    const frame = dropFrames[Phaser.Math.Between(0, dropFrames.length - 1)]
    const hasSheet = this.scene.textures.exists(SPRITESHEET_KEYS.GAME_ITEMS)
    const item: Phaser.GameObjects.GameObject & { setDepth(d: number): any; destroy(): void } = hasSheet
      ? this.scene.add.sprite(this.container.x, this.container.y - 20, SPRITESHEET_KEYS.GAME_ITEMS, frame)
          .setScale(0.5).setDepth(this.container.depth + 1)
      : this.scene.add.rectangle(this.container.x, this.container.y - 20, 9, 7, 0x00ff88)
          .setDepth(this.container.depth + 1) as any
    this.scene.tweens.add({
      targets: item, y: this.container.y + 18,
      duration: 280, ease: 'Bounce.easeOut',
      onComplete: () => {
        shake(this.container as unknown as Parameters<typeof shake>[0], this.scene, { intensity: 3, duration: 200 })
        this.scene.tweens.add({
          targets: item, alpha: 0, duration: 500, delay: 400,
          onComplete: () => { item.destroy(); this.done() },
        })
      },
    })
  }

  private reactServerRack(): void {
    // All LEDs flash rapidly — "REBOOT" text appears
    const rebootText = this.scene.add.text(
      this.container.x, this.container.y - 32, 'REBOOT',
      { fontSize: scaledFontSize(6), color: '#00ff88', fontFamily: 'monospace', resolution: 2 }
    ).setOrigin(0.5).setDepth(this.container.depth + 1)

    let step = 0
    const flashTimer = this.scene.time.addEvent({
      delay: 50, repeat: 11,
      callback: () => {
        this.container.setAlpha(step % 2 === 0 ? 0.5 : 1)
        step++
        if (step >= 12) {
          this.container.setAlpha(1)
          flashTimer.destroy()
          this.scene.tweens.add({
            targets: rebootText, alpha: 0, duration: 400, delay: 200,
            onComplete: () => { rebootText.destroy(); this.done() },
          })
        }
      },
    })
  }

  private reactMakoLamp(): void {
    // Flickers rapidly then stabilizes brighter + green particle burst
    let step = 0
    const flickerTimer = this.scene.time.addEvent({
      delay: 40, repeat: 9,
      callback: () => {
        this.container.setAlpha(step % 2 === 0 ? 0.4 : 1)
        step++
        if (step >= 10) {
          this.container.setAlpha(1)
          flickerTimer.destroy()
          // Green particle burst
          for (let i = 0; i < 5; i++) {
            const px = this.container.x + Phaser.Math.Between(-8, 8)
            const py = this.container.y - 12
            const p = this.scene.add.graphics().setDepth(this.container.depth + 1)
            p.fillStyle(0x00ff88, 0.7); p.fillCircle(0, 0, 1.5)
            p.setPosition(px, py)
            this.scene.tweens.add({
              targets: p,
              x: px + Phaser.Math.Between(-14, 14),
              y: py + Phaser.Math.Between(-18, -6),
              alpha: 0,
              duration: 400 + i * 60,
              delay: i * 30,
              onComplete: () => p.destroy(),
            })
          }
          this.scene.time.delayedCall(400, () => this.done())
        }
      },
    })
  }

  private reactLavaLamp(): void {
    // Speed up + flash cyan briefly then settle back to green
    let step = 0
    const flashTimer = this.scene.time.addEvent({
      delay: 60, repeat: 9,
      callback: () => {
        // Tint cyan — Sprites support tint, Graphics use alpha flash
        this.container.list.forEach((child) => {
          if (child instanceof Phaser.GameObjects.Sprite) {
            child.setTint(step % 2 === 0 ? 0x00e5ff : 0xffffff)
          }
        })
        this.container.setAlpha(step % 2 === 0 ? 0.7 : 1)
        step++
        if (step >= 10) {
          this.container.setAlpha(1)
          this.container.list.forEach((child) => {
            if (child instanceof Phaser.GameObjects.Sprite) child.clearTint()
          })
          flashTimer.destroy()
          this.done()
        }
      },
    })
    // Speed up idle temporarily
    if (this.idleTween) {
      this.idleTween.timeScale = 5
      this.scene.time.delayedCall(700, () => {
        if (this.idleTween) this.idleTween.timeScale = 1
      })
    }
  }

  private reactTrophyShelf(): void {
    // Trophies pulse gold
    pulse(this.container as unknown as Parameters<typeof pulse>[0], this.scene, {
      scale: 1.1, duration: 200,
      onComplete: () => {
        EventBus.emit(EVENTS.NOTIFICATION, 'Achievement unlocked!', 'info')
        this.done()
      },
    })
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /**
   * Try to create a sprite from the GAME_ITEMS spritesheet. Returns the sprite
   * positioned at (x, y) relative to the container, or null if the texture
   * has not been loaded yet (graceful fallback — Graphics props still render).
   */
  private tryItemSprite(
    frame: number, x: number, y: number, scale = 1
  ): Phaser.GameObjects.Sprite | null {
    if (!this.scene.textures.exists(SPRITESHEET_KEYS.GAME_ITEMS)) return null
    return this.scene.add.sprite(x, y, SPRITESHEET_KEYS.GAME_ITEMS, frame)
      .setScale(scale)
  }

  /**
   * Try to create a sprite from the GAME_ICONS spritesheet. Returns the sprite
   * positioned at (x, y) relative to the container, or null if the texture
   * has not been loaded yet.
   */
  private tryIconSprite(
    frame: number, x: number, y: number, scale = 1, alpha = 1
  ): Phaser.GameObjects.Sprite | null {
    if (!this.scene.textures.exists(SPRITESHEET_KEYS.GAME_ICONS)) return null
    return this.scene.add.sprite(x, y, SPRITESHEET_KEYS.GAME_ICONS, frame)
      .setScale(scale).setAlpha(alpha)
  }

  private spawnLeafParticle(): void {
    const leaf = this.scene.add.graphics().setDepth(this.container.depth + 1)
    leaf.fillStyle(0x2ecc40, 0.9); leaf.fillEllipse(0, 0, 8, 5)
    leaf.setPosition(this.container.x + Phaser.Math.Between(-6, 6), this.container.y - 16)
    this.scene.tweens.add({
      targets: leaf,
      x: leaf.x + Phaser.Math.Between(-20, 20),
      y: leaf.y + 30,
      angle: Phaser.Math.Between(-120, 120),
      alpha: 0,
      duration: 700,
      ease: 'Power2',
      onComplete: () => leaf.destroy(),
    })
  }

  private hitSize(): [number, number] {
    const sizes: Record<PropType, [number, number]> = {
      'plant':           [30, 36],
      'printer':         [44, 24],
      'whiteboard':      [76, 60],
      'coffee-machine':  [36, 44],
      'arcade':          [44, 92],
      'fish-tank':       [64, 44],
      'vending-machine': [48, 76],
      'server-rack':     [36, 56],
      'mako-lamp':       [24, 30],
      'lava-lamp':       [18, 40],
      'trophy-shelf':    [48, 32],
    }
    return sizes[this.type]
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  destroy(): void {
    this.idleTween?.destroy()
    this.idleTweens.forEach(t => t.destroy())
    this.hitZone.destroy()
    this.container.destroy()
    this.whiteboardDisplay?.destroy()
    this.printerGlow?.destroy()
    this.printerGlow = null
  }
}

// ---------------------------------------------------------------------------
// InteractivePropsManager
// ---------------------------------------------------------------------------

export class InteractivePropsManager {
  private scene: Phaser.Scene
  private props: Map<string, InteractiveProp> = new Map()
  private counter = 0

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  /** Create a clickable interactive prop and return it. */
  addProp(config: PropConfig): InteractiveProp {
    const id = `prop-${config.type}-${this.counter++}`
    const prop = new InteractiveProp(this.scene, config)
    this.props.set(id, prop)
    return prop
  }

  /** Check if any props have been placed. */
  hasProps(): boolean { return this.props.size > 0 }

  /** Destroy all managed props. */
  destroyAll(): void {
    this.props.forEach((p) => p.destroy())
    this.props.clear()
  }
}
