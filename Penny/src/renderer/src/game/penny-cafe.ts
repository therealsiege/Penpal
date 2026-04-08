import Phaser from 'phaser'
import { ANIM_KEYS, SPRITESHEET_KEYS, ITEM_FRAMES, ICON_FRAMES, EFFECT_ANIM_KEYS, LAB_IMAGE_KEYS } from './office-asset-keys'
import { LAB_PROP_FRAMES } from './lab-prop-frames.generated'
import { CHAR_SCALE as DUDER_SCALE, CHAR_SCALE, scaledFontSize } from './office-constants'
import { activeTheme } from './office-theme'
import { CafeCoffeeRunManager } from './cafe-coffee-run'
import type { CoffeeRunHost } from './cafe-coffee-run'
import { CafeChatManager } from './cafe-chat'
import type { ChatHost } from './cafe-chat'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CAFE_W = 340
const CAFE_H = 240
const STOOL_GAP = 48
const NUM_STOOLS = 6
const TOTAL_STOOLS_W = (NUM_STOOLS - 1) * STOOL_GAP
const STOOL_START_X = (CAFE_W - TOTAL_STOOLS_W) / 2

/** Uniform sprite scale — matches lab tilemap tiles (128px source → 48px) */
const S = 0.375

// Simple 3-row layout: back counter → barista walk zone → stools
const COUNTER_Y = 40       // back counter with equipment
const BARISTA_Y = 120      // baristas walk here
const STOOL_Y = 190        // customer stools

// ---------------------------------------------------------------------------
// Interface the host scene must satisfy
// ---------------------------------------------------------------------------

export interface CafeHostScene extends Phaser.Scene {
  rooms: Map<string, CafeRoom>
  spawnEmojiReaction(worldX: number, worldY: number, emoji: string): void
  getNavMesh(): import('./nav-mesh').NavMesh
}

export interface CafeRoom {
  cwd: string
  x: number
  y: number
  width: number
  height: number
  doorSide: 'top' | 'bottom'
  workstations: Map<string, CafeWorkstation>
}

export interface CafeWorkstation {
  container: Phaser.GameObjects.Container
  sprite: Phaser.GameObjects.Sprite
  state: import('../types').AgentState | null
  walkBreakTween?: Phaser.Tweens.Tween
}

// ---------------------------------------------------------------------------
// Visitor and chat session types — exported so sub-modules can import them
// ---------------------------------------------------------------------------

export interface CafeVisitor {
  agentId: string
  stoolIdx: number
  walker: Phaser.GameObjects.Sprite
  shadow: Phaser.GameObjects.Ellipse
  cup: Phaser.GameObjects.Arc | Phaser.GameObjects.Sprite | null
  sipTimer: Phaser.Time.TimerEvent | null
  chatPartner: string | null
  /** Trigger walk-back to desk (set by coffee run manager once seated) */
  triggerReturn?: () => void
}

export interface ChatSession {
  agentA: string
  agentB: string
  bubbleA: Phaser.GameObjects.Container | null
  bubbleB: Phaser.GameObjects.Container | null
  turnTimer: Phaser.Time.TimerEvent
  emojiTimer: Phaser.Time.TimerEvent
  leanTimer: Phaser.Time.TimerEvent
}

// ---------------------------------------------------------------------------
// PennyCafe — visual construction + public API orchestrator
// ---------------------------------------------------------------------------

export class PennyCafe implements CoffeeRunHost, ChatHost {
  private scene: CafeHostScene
  container: Phaser.GameObjects.Container | null = null
  /** Public so CafeCoffeeRunManager can animate them. */
  readonly baristas: Phaser.GameObjects.Container[] = []
  /** Public so CafeCoffeeRunManager can look up home positions. */
  readonly baristaHomeX: number[] = []
  /** Barista occupancy — true while a barista is actively serving a patron. */
  readonly baristasBusy: boolean[] = []
  private visitorTimer: Phaser.Time.TimerEvent | null = null
  private steamTimer: Phaser.Time.TimerEvent | null = null

  /** Occupied stool indices. Exposed to satisfy CoffeeRunHost. */
  readonly stoolOccupied = new Set<number>()
  /** Seated visitor state. Exposed to satisfy CoffeeRunHost + ChatHost. */
  readonly seatedVisitors = new Map<string, CafeVisitor>()

  worldX = 0
  worldY = 0

  private coffeeRunManager: CafeCoffeeRunManager
  private chatManager: CafeChatManager

  /** Delegated to CafeCoffeeRunManager — kept for external callers that check `.coffeeRunners`. */
  get coffeeRunners(): Map<string, () => void> {
    return this.coffeeRunManager.coffeeRunners
  }

  constructor(scene: CafeHostScene) {
    this.scene = scene
    this.coffeeRunManager = new CafeCoffeeRunManager(scene, this)
    this.chatManager = new CafeChatManager(scene, this)
  }

  // ── Public API ──────────────────────────────────────────────────────────

  get width(): number { return CAFE_W }
  get height(): number { return CAFE_H }

  /**
   * World-space Y where patrons stand to order (the serving counter side).
   * Local Y = BARISTA_Y(120) + 40 = 160 — just in front of the desk_top_long divider.
   * Satisfies CoffeeRunHost.
   */
  get counterWorldY(): number {
    return this.container ? this.container.y + 160 : this.worldY - 30
  }

  /** Convert a stool index to world-space X. Satisfies CoffeeRunHost + ChatHost. */
  stoolWorldX(stoolIdx: number): number {
    return (this.worldX - CAFE_W / 2) + STOOL_START_X + stoolIdx * STOOL_GAP
  }

  /** Expose the coffee run manager for testing. */
  getCoffeeRunManager(): CafeCoffeeRunManager {
    return this.coffeeRunManager
  }

  /** Attempt to start a chat for a newly seated agent. Satisfies CoffeeRunHost. */
  tryStartChat(agentId: string): void {
    this.chatManager.tryStartChat(agentId)
  }

  /** Build (or rebuild) the cafe visual at the given position. */
  build(cx: number, cy: number): void {
    this.destroyVisuals()

    const scene = this.scene
    const containerX = cx - CAFE_W / 2
    const container = scene.add.container(containerX, cy).setDepth(2)
    this.worldX = containerX + CAFE_W / 2
    this.container = container
    const g = scene.add.graphics()
    container.add(g)

    const hasLP = scene.textures.exists(SPRITESHEET_KEYS.LAB_PROPS)
    const LP = SPRITESHEET_KEYS.LAB_PROPS
    const spr = (x: number, y: number, frame: string, alpha = 0.90) => {
      const s = scene.add.sprite(x, y, LP, frame).setScale(S).setAlpha(alpha).setOrigin(0.5)
      container.add(s)
      return s
    }

    // ── Laser entrance — south edge ──
    g.lineStyle(2, 0xff3333, 0.70)
    g.lineBetween(0, CAFE_H - 2, CAFE_W, CAFE_H - 2)
    g.fillStyle(0xff3333, 0.85)
    g.fillCircle(0, CAFE_H - 2, 4)
    g.fillCircle(CAFE_W, CAFE_H - 2, 4)

    // ── Sign ──
    g.fillStyle(0x0f172a, 0.85)
    g.fillRoundedRect(8, 2, CAFE_W - 16, 22, 3)
    container.add(scene.add.text(CAFE_W / 2, 13, 'PENPAL CAFE', {
      fontSize: scaledFontSize(14), fontFamily: 'system-ui, sans-serif', fontStyle: 'bold',
      color: '#22d3ee', resolution: 2,
    }).setOrigin(0.5))

    // ── Back counter — console bar with a few pieces of equipment ──
    if (hasLP) {
      // Counter surface — two long consoles
      spr(CAFE_W * 0.3, COUNTER_Y, 'blank_console_long')
      spr(CAFE_W * 0.7, COUNTER_Y, 'blank_console_long')

      // Equipment on counter — spaced out, not cluttered
      spr(CAFE_W * 0.15, COUNTER_Y, 'generator')          // espresso machine stand-in
      spr(CAFE_W * 0.40, COUNTER_Y - 4, 'dome', 0.85)     // brew chamber
      spr(CAFE_W * 0.60, COUNTER_Y, 'scale')               // coffee scale
      spr(CAFE_W * 0.85, COUNTER_Y, 'unit_example_04')     // grinder

      // Cups on counter
      spr(CAFE_W * 0.25, COUNTER_Y + 2, 'cup', 0.80)
      spr(CAFE_W * 0.50, COUNTER_Y + 2, 'cup', 0.80)
      spr(CAFE_W * 0.75, COUNTER_Y + 2, 'cup', 0.80)
    }

    // ── Serving counter — desk_top_long as the divider ──
    if (hasLP) {
      spr(CAFE_W * 0.3, COUNTER_Y + 50, 'desk_top_long')
      spr(CAFE_W * 0.7, COUNTER_Y + 50, 'desk_top_long')
    }

    // ── Baristas — walk between back counter and serving counter ──
    this.baristaHomeX.length = 0
    this.baristas.length = 0
    this.baristasBusy.length = 0
    for (const cfg of [
      { homeX: CAFE_W * 0.35, charIdx: 1, name: 'Latte Larry' },
      { homeX: CAFE_W * 0.65, charIdx: 0, name: 'Mocha Maya' },
    ]) {
      const walkKey = cfg.charIdx === 1 ? ANIM_KEYS.WALK_2 : ANIM_KEYS.WALK_1
      const bc = scene.add.container(cfg.homeX, BARISTA_Y)
      container.add(bc)
      bc.add(scene.add.sprite(0, 0, walkKey, 0).setScale(CHAR_SCALE).setOrigin(0.5, 1))
      bc.add(scene.add.rectangle(0, -8, 14, 12, 0x059669, 0.35))
      bc.add(scene.add.text(0, 6, cfg.name, {
        fontSize: scaledFontSize(10), fontFamily: 'system-ui, sans-serif', color: activeTheme.accentText,
        backgroundColor: activeTheme.nameBg, padding: { x: 4, y: 2 }, resolution: 2,
      }).setOrigin(0.5, 0))
      this.baristas.push(bc)
      this.baristaHomeX.push(cfg.homeX)
      this.baristasBusy.push(false)
      scene.tweens.add({ targets: bc, angle: { from: -3, to: 3 }, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: Math.random() * 500 })
      scene.tweens.add({ targets: bc, x: cfg.homeX + 12, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: Math.random() * 800 })
    }

    // ── Stools ──
    if (hasLP) {
      for (let si = 0; si < NUM_STOOLS; si++) {
        const sx = STOOL_START_X + si * STOOL_GAP
        container.add(scene.add.sprite(sx, STOOL_Y, LP, 'stool').setScale(S).setAlpha(0.85).setOrigin(0.5))
      }
    } else {
      for (let si = 0; si < NUM_STOOLS; si++) {
        g.fillStyle(0x1e293b, 0.95)
        g.fillEllipse(STOOL_START_X + si * STOOL_GAP, STOOL_Y, 16, 8)
      }
    }

    this.worldY = cy + STOOL_Y

    // ── Steam — from the generator/dome area ──
    this.steamTimer = scene.time.addEvent({
      delay: 2200, loop: true,
      callback: () => {
        if (!this.container?.active) return
        const mx = CAFE_W * (0.15 + Math.random() * 0.7)
        const puffKey = EFFECT_ANIM_KEYS.PUFF
        if (scene.anims.exists(puffKey)) {
          const puff = scene.add.sprite(mx, COUNTER_Y - 10, SPRITESHEET_KEYS.EFFECTS_PUFF, 0)
            .setScale(0.12).setAlpha(0.25).setOrigin(0.5).setTint(0x00e5ff)
          container.add(puff)
          puff.play(puffKey)
          scene.tweens.add({ targets: puff, y: COUNTER_Y - 30, alpha: 0, scale: 0.06, duration: 1000, ease: 'Sine.easeOut', onComplete: () => { puff.destroy() } })
        }
      },
    })
  }

  /** Start the periodic coffee run timer. */
  startCoffeeRunTimer(): void {
    this.coffeeRunManager.startCoffeeRunTimer()
  }

  /** Returns bounds for nav mesh integration. */
  getBounds(): { x: number; y: number; w: number; h: number } | null {
    if (!this.container) return null
    return { x: this.container.x, y: this.container.y, w: CAFE_W, h: CAFE_H }
  }

  /** Check if an agent is on a coffee run. */
  isOnCoffeeRun(agentId: string): boolean {
    return this.coffeeRunManager.coffeeRunners.has(agentId)
  }

  /** Cancel a coffee run — trigger walk back to desk. */
  cancelCoffeeRun(agentId: string): void {
    this.coffeeRunManager.cancelCoffeeRun(agentId)
  }

  /** Pause cafe timers (scene sleep). */
  pause(): void {
    if (this.visitorTimer) this.visitorTimer.paused = true
    if (this.steamTimer) this.steamTimer.paused = true
    this.coffeeRunManager.pause()
  }

  /** Resume cafe timers (scene wake). */
  resume(): void {
    if (this.visitorTimer) this.visitorTimer.paused = false
    if (this.steamTimer) this.steamTimer.paused = false
    this.coffeeRunManager.resume()
  }

  /** Destroy everything. */
  destroy(): void {
    this.coffeeRunManager.destroy()
    this.chatManager.destroyAll()
    this.seatedVisitors.clear()
    this.stoolOccupied.clear()
    this.destroyVisuals()
  }

  // ── Private ─────────────────────────────────────────────────────────────

  private destroyVisuals(): void {
    this.baristas.length = 0
    this.baristaHomeX.length = 0
    this.baristasBusy.length = 0
    if (this.visitorTimer) { this.visitorTimer.destroy(); this.visitorTimer = null }
    if (this.steamTimer) { this.steamTimer.destroy(); this.steamTimer = null }
    if (this.container) {
      this.scene.tweens.killTweensOf(this.container)
      this.container.destroy(true)
      this.container = null
    }
  }
}
