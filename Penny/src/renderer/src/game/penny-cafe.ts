import Phaser from 'phaser'
import { ANIM_KEYS, SPRITESHEET_KEYS, ITEM_FRAMES, ICON_FRAMES, EFFECT_ANIM_KEYS } from './office-asset-keys'
import { CHAR_SCALE as DUDER_SCALE } from './office-constants'
import { CHAR_SCALE } from './office-constants'
import { activeTheme } from './office-theme'
import { CafeCoffeeRunManager } from './cafe-coffee-run'
import type { CoffeeRunHost } from './cafe-coffee-run'
import { CafeChatManager } from './cafe-chat'
import type { ChatHost } from './cafe-chat'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CAFE_W = 340
const CAFE_H = 180
const COUNTER_W = 16
const BEHIND_W = 68
const STOOL_GAP = 48
const NUM_STOOLS = 6
const TOTAL_STOOLS_W = (NUM_STOOLS - 1) * STOOL_GAP
const STOOL_START_X = (CAFE_W - TOTAL_STOOLS_W) / 2

// ---------------------------------------------------------------------------
// Interface the host scene must satisfy
// ---------------------------------------------------------------------------

export interface CafeHostScene extends Phaser.Scene {
  rooms: Map<string, CafeRoom>
  spawnEmojiReaction(worldX: number, worldY: number, emoji: string): void
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

  /** Convert a stool index to world-space X. Satisfies CoffeeRunHost + ChatHost. */
  stoolWorldX(stoolIdx: number): number {
    return (this.worldX - CAFE_W / 2) + STOOL_START_X + stoolIdx * STOOL_GAP
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

    // ── Barista workspace (top) — dark gunmetal ──
    g.fillStyle(0x1a2030, 0.9)
    g.fillRoundedRect(0, 0, CAFE_W, BEHIND_W, { tl: 6, tr: 6, bl: 0, br: 0 })
    g.fillStyle(0x0d1117, 0.6)
    g.fillRect(6, 6, CAFE_W - 12, BEHIND_W - 12)

    // ── Header sign ──
    g.fillStyle(0x0a0f1a, 0.9)
    g.fillRoundedRect(6, 2, CAFE_W - 12, 24, { tl: 4, tr: 4, bl: 0, br: 0 })
    g.lineStyle(2, 0x00ff88, 0.5)
    g.lineBetween(6, 26, CAFE_W - 6, 26)
    const signText = scene.add.text(CAFE_W / 2, 14, 'PENPAL CAFE', {
      fontSize: '14px', fontFamily: 'system-ui, sans-serif', fontStyle: 'bold',
      color: '#00ff88', resolution: 2,
    }).setOrigin(0.5)
    container.add(signText)

    // ── Equipment (espresso machines + menu board) ──
    const eqY = 30
    const machinePositions = [30, 110]
    for (const mx of machinePositions) {
      g.fillStyle(0x334155, 0.7)
      g.fillRoundedRect(mx, eqY, 20, 22, 3)
      // Power indicator — red dot sprite instead of fillCircle
      const indicator = scene.add.sprite(mx + 10, eqY + 5, SPRITESHEET_KEYS.GAME_ICONS, ICON_FRAMES.CIRCLE_RED)
        .setScale(0.18).setAlpha(0.6).setOrigin(0.5)
      container.add(indicator)
    }
    // Menu board
    g.fillStyle(0x0d1117, 0.85)
    g.fillRoundedRect(200, eqY, 60, 28, 2)
    g.lineStyle(1, 0x00e5ff, 0.4)
    g.strokeRoundedRect(200, eqY, 60, 28, 2)
    // Menu items — small item sprites instead of placeholder lines
    const menuItems = [ITEM_FRAMES.COFFEE_CUP, ITEM_FRAMES.DONUT, ITEM_FRAMES.PIZZA]
    for (let ml = 0; ml < 3; ml++) {
      const itemSprite = scene.add.sprite(210, eqY + 8 + ml * 8, SPRITESHEET_KEYS.GAME_ITEMS, menuItems[ml])
        .setScale(0.28).setAlpha(0.55).setOrigin(0.5)
      container.add(itemSprite)
      // Price placeholder line
      g.fillStyle(0x00ff88, 0.12)
      g.fillRect(220, eqY + 4 + ml * 8, 34, 2)
    }

    // ── Counter bar ──
    const counterY = BEHIND_W
    g.fillStyle(0x2a3040, 0.9)
    g.fillRoundedRect(8, counterY, CAFE_W - 16, COUNTER_W, 3)
    g.fillStyle(0x00e5ff, 0.15)
    g.fillRect(10, counterY + 2, CAFE_W - 20, 4)

    // ── Customer area (bottom) ──
    const customerTopY = counterY + COUNTER_W
    const customerH = CAFE_H - BEHIND_W - COUNTER_W
    g.fillStyle(0x1a2030, 0.55)
    g.fillRoundedRect(0, customerTopY, CAFE_W, customerH, { tl: 0, tr: 0, bl: 6, br: 6 })

    // ── Baristas ──
    const baristaWorkY = BEHIND_W - 14
    const baristaConfigs = [
      { homeX: 80, charIdx: 1, name: 'Latte Larry' },
      { homeX: 250, charIdx: 0, name: 'Mocha Maya' },
    ]

    this.baristaHomeX.length = 0
    this.baristas.length = 0
    for (const cfg of baristaConfigs) {
      const walkKey = cfg.charIdx === 1 ? ANIM_KEYS.WALK_2 : ANIM_KEYS.WALK_1
      const bc = scene.add.container(cfg.homeX, baristaWorkY)
      container.add(bc)

      const bSprite = scene.add.sprite(0, 0, walkKey, 0)
        .setScale(CHAR_SCALE).setOrigin(0.5, 1)
      bc.add(bSprite)

      const apron = scene.add.rectangle(0, -8, 14, 12, 0x059669, 0.35)
      bc.add(apron)

      const tag = scene.add.text(0, 6, cfg.name, {
        fontSize: '10px', fontFamily: 'system-ui, sans-serif', color: activeTheme.accentText,
        backgroundColor: activeTheme.nameBg, padding: { x: 4, y: 2 }, resolution: 2,
      }).setOrigin(0.5, 0)
      bc.add(tag)

      this.baristas.push(bc)
      this.baristaHomeX.push(cfg.homeX)

      scene.tweens.add({ targets: bc, angle: { from: -3, to: 3 }, duration: 700 + Math.random() * 300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: Math.random() * 500 })
      scene.tweens.add({ targets: bSprite, y: -2, scaleY: CHAR_SCALE * 0.97, duration: 450 + Math.random() * 200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: Math.random() * 400 })
      scene.tweens.add({ targets: bc, x: cfg.homeX + 10, duration: 1600 + Math.random() * 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: Math.random() * 800 })
    }

    // ── Stools — centered below counter ──
    const stoolY = counterY + COUNTER_W + 16
    for (let si = 0; si < NUM_STOOLS; si++) {
      const sx = STOOL_START_X + si * STOOL_GAP
      g.lineStyle(1.5, 0x4a5a6c, 0.55)
      g.lineBetween(sx - 6, stoolY + 16, sx - 2, stoolY + 4)
      g.lineBetween(sx + 6, stoolY + 16, sx + 2, stoolY + 4)
      g.lineBetween(sx - 4, stoolY + 14, sx - 1, stoolY + 4)
      g.lineBetween(sx + 4, stoolY + 14, sx + 1, stoolY + 4)
      g.lineStyle(1.5, 0x5a6a7c, 0.45)
      g.lineBetween(sx - 5, stoolY + 12, sx + 5, stoolY + 12)
      g.fillStyle(0x7a8a9c, 0.8)
      g.fillRect(sx - 1, stoolY + 2, 2, 10)
      g.fillStyle(0x1e293b, 0.95)
      g.fillEllipse(sx, stoolY, 16, 8)
      g.fillStyle(0x334155, 0.7)
      g.fillEllipse(sx, stoolY - 1, 12, 5)
      g.lineStyle(0.5, 0x475569, 0.3)
      g.lineBetween(sx - 4, stoolY, sx + 4, stoolY)
    }

    // ── Coffee cups on counter — sprite decor ──
    const cupPositions = [60, 140, 190, 260]
    for (const cupX of cupPositions) {
      const cupSprite = scene.add.sprite(cupX, counterY + 6, SPRITESHEET_KEYS.GAME_ITEMS, ITEM_FRAMES.COFFEE_CUP)
        .setScale(0.35).setAlpha(0.85).setOrigin(0.5)
      container.add(cupSprite)
    }

    this.worldY = cy + stoolY

    // ── Duder NPC barista helpers — static sprite characters in the behind-counter area ──
    const duderConfigs = [
      { key: SPRITESHEET_KEYS.DUDER_1, x: 170, y: baristaWorkY - 4, flipX: false },
      { key: SPRITESHEET_KEYS.DUDER_2, x: 300, y: baristaWorkY - 4, flipX: true },
    ]
    for (const cfg of duderConfigs) {
      if (!scene.textures.exists(cfg.key)) continue
      const duder = scene.add.sprite(cfg.x, cfg.y, cfg.key, 0)
        .setScale(DUDER_SCALE * 0.85)
        .setOrigin(0.5, 1)
        .setAlpha(0.7)
        .setFlipX(cfg.flipX)
      container.add(duder)
      // Idle sway tween — gentle left-right lean
      scene.tweens.add({
        targets: duder,
        angle: { from: -2, to: 2 },
        duration: 1200 + Math.random() * 600,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: Math.random() * 800,
      })
    }

    // ── Animated steam — puff VFX sprites ──
    this.steamTimer = scene.time.addEvent({
      delay: 1800, loop: true,
      callback: () => {
        if (!this.container?.active) return
        const mx = machinePositions[Math.floor(Math.random() * machinePositions.length)]
        const puffKey = EFFECT_ANIM_KEYS.PUFF
        const hasPuffAnim = scene.anims.exists(puffKey)
        for (let si = 0; si < 2; si++) {
          const px = mx + 10 + (si - 0.5) * 4
          if (hasPuffAnim) {
            const puff = scene.add.sprite(px, eqY - 2, SPRITESHEET_KEYS.EFFECTS_PUFF, 0)
              .setScale(0.12).setAlpha(0.3).setOrigin(0.5).setTint(0x00e5ff)
            container.add(puff)
            puff.play(puffKey)
            scene.tweens.add({
              targets: puff,
              y: eqY - 16 - Math.random() * 8,
              x: px + (Math.random() - 0.5) * 6,
              alpha: 0, scale: 0.06,
              duration: 900 + Math.random() * 400, delay: si * 120, ease: 'Sine.easeOut',
              onComplete: () => { puff.destroy() },
            })
          } else {
            // Fallback: use a circle-dot icon sprite instead of Graphics circle
            const dot = scene.add.sprite(px, eqY - 2, SPRITESHEET_KEYS.GAME_ICONS, ICON_FRAMES.CIRCLE_BLUE)
              .setScale(0.1).setAlpha(0.22).setOrigin(0.5)
            container.add(dot)
            scene.tweens.add({
              targets: dot,
              y: eqY - 16 - Math.random() * 8,
              x: px + (Math.random() - 0.5) * 6,
              alpha: 0, scale: 0.04,
              duration: 900 + Math.random() * 400, delay: si * 120, ease: 'Sine.easeOut',
              onComplete: () => { dot.destroy() },
            })
          }
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
    if (this.visitorTimer) { this.visitorTimer.destroy(); this.visitorTimer = null }
    if (this.steamTimer) { this.steamTimer.destroy(); this.steamTimer = null }
    if (this.container) {
      this.scene.tweens.killTweensOf(this.container)
      this.container.destroy(true)
      this.container = null
    }
  }
}
