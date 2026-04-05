import Phaser from 'phaser'
import { ANIM_KEYS, SPRITESHEET_KEYS, ITEM_FRAMES, ICON_FRAMES, EFFECT_ANIM_KEYS, LAB_IMAGE_KEYS } from './office-asset-keys'
import { LAB_PROP_FRAMES } from './lab-prop-frames.generated'
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

const CAFE_W = 400
const CAFE_H = 260
const COUNTER_W = 16
const BEHIND_W = 140
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

    // The cafe is an open zone inside the facility — no walls, no floor tiles.
    // The building's unified tilemap + autotiled walls already contain it.
    // South side is completely open (connection to the lab).
    // We only draw: laser entrance line, interior divider, props, characters.

    const hasLP = scene.textures.exists(SPRITESHEET_KEYS.LAB_PROPS)
    const machinePositions = [50, CAFE_W / 2] // steam source X positions

    // ── Laser entrance — horizontal beam across south edge ──
    const laserY = CAFE_H - 2
    g.lineStyle(2, 0xff3333, 0.70)
    g.lineBetween(0, laserY, CAFE_W, laserY)
    g.fillStyle(0xff3333, 0.85)
    g.fillCircle(0, laserY, 4)
    g.fillCircle(CAFE_W, laserY, 4)

    // ── Sign — top of cafe area ──
    g.fillStyle(0x0f172a, 0.85)
    g.fillRoundedRect(8, 2, CAFE_W - 16, 22, 3)
    container.add(scene.add.text(CAFE_W / 2, 13, 'PENPAL CAFE', {
      fontSize: '14px', fontFamily: 'system-ui, sans-serif', fontStyle: 'bold',
      color: '#22d3ee', resolution: 2,
    }).setOrigin(0.5))

    // ── Brewing area props — back wall, room-scale sizes ──
    const brewY = 28

    if (hasLP) {
      // Back wall workbench
      container.add(scene.add.sprite(CAFE_W / 2, brewY + 4, SPRITESHEET_KEYS.LAB_PROPS, LAB_PROP_FRAMES.DESK_TOP_LONG)
        .setScale(0.35).setAlpha(0.88).setOrigin(0.5))

      // Wall lights
      for (const wx of [20, CAFE_W - 20]) {
        const light = scene.add.sprite(wx, 10, SPRITESHEET_KEYS.LAB_PROPS, LAB_PROP_FRAMES.WALL_LIGHT)
          .setScale(0.30).setAlpha(0.75).setOrigin(0.5)
        container.add(light)
        scene.tweens.add({
          targets: light, alpha: { from: 0.65, to: 0.90 },
          duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        })
      }

      // Generator — left (0.45)
      container.add(scene.add.sprite(40, brewY + 34, SPRITESHEET_KEYS.LAB_PROPS, LAB_PROP_FRAMES.GENERATOR)
        .setScale(0.45).setAlpha(0.90).setOrigin(0.5))

      // Power cell — next to generator (0.30)
      const cell = scene.add.sprite(100, brewY + 30, SPRITESHEET_KEYS.LAB_PROPS, LAB_PROP_FRAMES.POWER_CELL)
        .setScale(0.30).setAlpha(0.82).setOrigin(0.5)
      container.add(cell)
      scene.tweens.add({ targets: cell, scaleX: { from: 0.28, to: 0.32 }, scaleY: { from: 0.28, to: 0.32 }, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })

      // Pod — center brew chamber (0.36)
      container.add(scene.add.sprite(CAFE_W / 2, brewY + 40, SPRITESHEET_KEYS.LAB_PROPS, LAB_PROP_FRAMES.POD)
        .setScale(0.36).setAlpha(0.88).setOrigin(0.5))

      // Scale — right of pod (0.28)
      container.add(scene.add.sprite(CAFE_W / 2 + 65, brewY + 32, SPRITESHEET_KEYS.LAB_PROPS, LAB_PROP_FRAMES.SCALE)
        .setScale(0.28).setAlpha(0.82).setOrigin(0.5))

      // Control unit — right station (0.38)
      container.add(scene.add.sprite(CAFE_W - 40, brewY + 36, SPRITESHEET_KEYS.LAB_PROPS, LAB_PROP_FRAMES.UNIT_EXAMPLE_04)
        .setScale(0.38).setAlpha(0.85).setOrigin(0.5))

      // Lab cups on bench
      for (const lx of [CAFE_W * 0.35, CAFE_W * 0.55, CAFE_W * 0.78]) {
        container.add(scene.add.sprite(lx, brewY + 8, SPRITESHEET_KEYS.LAB_PROPS, LAB_PROP_FRAMES.CUP)
          .setScale(0.22).setAlpha(0.75).setOrigin(0.5))
      }

      // Consoles + screens — flanking
      for (const sx of [30, CAFE_W - 30]) {
        container.add(scene.add.sprite(sx, brewY + 62, SPRITESHEET_KEYS.LAB_PROPS, 'blank_console_short')
          .setScale(0.35).setAlpha(0.88).setOrigin(0.5))
        container.add(scene.add.sprite(sx, brewY + 54, SPRITESHEET_KEYS.LAB_PROPS, 'console_screen_wave_01')
          .setScale(0.30).setAlpha(0.85).setOrigin(0.5))
      }
    }

    // ── Espresso bar / counter — desk_top_long as divider ──
    const counterY = BEHIND_W
    if (hasLP) {
      container.add(scene.add.sprite(CAFE_W / 2, counterY + 8, SPRITESHEET_KEYS.LAB_PROPS, LAB_PROP_FRAMES.DESK_TOP_LONG)
        .setScale(0.35).setAlpha(0.90).setOrigin(0.5))
    } else {
      g.fillStyle(0x1a3a52, 0.9)
      g.fillRoundedRect(8, counterY, CAFE_W - 16, COUNTER_W, 3)
    }
    g.fillStyle(0x22d3ee, 0.25)
    g.fillRect(10, counterY + 12, CAFE_W - 20, 2)

    // Menu board
    const menuX = CAFE_W / 2 - 30
    const menuY = brewY + 54
    g.fillStyle(0x0f172a, 0.9)
    g.fillRoundedRect(menuX, menuY, 60, 28, 2)
    g.lineStyle(1, 0x22d3ee, 0.4)
    g.strokeRoundedRect(menuX, menuY, 60, 28, 2)
    const menuItems = [ITEM_FRAMES.COFFEE_CUP, ITEM_FRAMES.DONUT, ITEM_FRAMES.PIZZA]
    for (let ml = 0; ml < 3; ml++) {
      container.add(scene.add.sprite(menuX + 10, menuY + 8 + ml * 8, SPRITESHEET_KEYS.GAME_ITEMS, menuItems[ml])
        .setScale(0.28).setAlpha(0.55).setOrigin(0.5))
      g.fillStyle(0x22d3ee, 0.12)
      g.fillRect(menuX + 20, menuY + 4 + ml * 8, 34, 2)
    }

    // Coffee cups on bar
    for (const cupX of [30, CAFE_W * 0.35, CAFE_W * 0.65, CAFE_W - 30]) {
      container.add(scene.add.sprite(cupX, counterY + 4, SPRITESHEET_KEYS.GAME_ITEMS, ITEM_FRAMES.COFFEE_CUP)
        .setScale(0.35).setAlpha(0.85).setOrigin(0.5))
    }

    // ── Baristas — between equipment and counter ──
    const baristaWorkY = counterY - 14
    const baristaConfigs = [
      { homeX: CAFE_W * 0.3, charIdx: 1, name: 'Latte Larry' },
      { homeX: CAFE_W * 0.7, charIdx: 0, name: 'Mocha Maya' },
    ]

    this.baristaHomeX.length = 0
    this.baristas.length = 0
    for (const cfg of baristaConfigs) {
      const walkKey = cfg.charIdx === 1 ? ANIM_KEYS.WALK_2 : ANIM_KEYS.WALK_1
      const bc = scene.add.container(cfg.homeX, baristaWorkY)
      container.add(bc)
      bc.add(scene.add.sprite(0, 0, walkKey, 0).setScale(CHAR_SCALE).setOrigin(0.5, 1))
      bc.add(scene.add.rectangle(0, -8, 14, 12, 0x059669, 0.35))
      bc.add(scene.add.text(0, 6, cfg.name, {
        fontSize: '10px', fontFamily: 'system-ui, sans-serif', color: activeTheme.accentText,
        backgroundColor: activeTheme.nameBg, padding: { x: 4, y: 2 }, resolution: 2,
      }).setOrigin(0.5, 0))
      this.baristas.push(bc)
      this.baristaHomeX.push(cfg.homeX)
      scene.tweens.add({ targets: bc, angle: { from: -3, to: 3 }, duration: 700 + Math.random() * 300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: Math.random() * 500 })
      scene.tweens.add({ targets: bc, x: cfg.homeX + 10, duration: 1600 + Math.random() * 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: Math.random() * 800 })
    }

    // ── Stools — customer seating ──
    const stoolY = counterY + COUNTER_W + 16
    if (hasLP) {
      for (let si = 0; si < NUM_STOOLS; si++) {
        const sx = STOOL_START_X + si * STOOL_GAP
        container.add(scene.add.sprite(sx, stoolY + 6, SPRITESHEET_KEYS.LAB_PROPS, 'stool')
          .setScale(0.22).setAlpha(0.85).setOrigin(0.5))
      }
    } else {
      for (let si = 0; si < NUM_STOOLS; si++) {
        const sx = STOOL_START_X + si * STOOL_GAP
        g.fillStyle(0x1e293b, 0.95)
        g.fillEllipse(sx, stoolY, 16, 8)
      }
    }

    this.worldY = cy + stoolY

    // ── Duder NPC helpers ──
    for (const cfg of [
      { key: SPRITESHEET_KEYS.DUDER_1, x: CAFE_W / 2, y: baristaWorkY - 20, flipX: false },
      { key: SPRITESHEET_KEYS.DUDER_2, x: CAFE_W - 50, y: baristaWorkY - 20, flipX: true },
    ]) {
      if (!scene.textures.exists(cfg.key)) continue
      const duder = scene.add.sprite(cfg.x, cfg.y, cfg.key, 0)
        .setScale(DUDER_SCALE * 0.85).setOrigin(0.5, 1).setAlpha(0.7).setFlipX(cfg.flipX)
      container.add(duder)
      scene.tweens.add({ targets: duder, angle: { from: -2, to: 2 }, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
    }

    // ── Steam VFX ──
    const steamSourceY = brewY + 26
    this.steamTimer = scene.time.addEvent({
      delay: 1800, loop: true,
      callback: () => {
        if (!this.container?.active) return
        const mx = machinePositions[Math.floor(Math.random() * machinePositions.length)]
        const puffKey = EFFECT_ANIM_KEYS.PUFF
        const hasPuffAnim = scene.anims.exists(puffKey)
        for (let si = 0; si < 2; si++) {
          const px = mx + 10 + (si - 0.5) * 6
          if (hasPuffAnim) {
            const puff = scene.add.sprite(px, steamSourceY, SPRITESHEET_KEYS.EFFECTS_PUFF, 0)
              .setScale(0.12).setAlpha(0.3).setOrigin(0.5).setTint(0x00e5ff)
            container.add(puff)
            puff.play(puffKey)
            scene.tweens.add({ targets: puff, y: steamSourceY - 24, x: px + (Math.random() - 0.5) * 10, alpha: 0, scale: 0.06, duration: 900 + Math.random() * 400, delay: si * 120, ease: 'Sine.easeOut', onComplete: () => { puff.destroy() } })
          } else {
            const dot = scene.add.sprite(px, steamSourceY, SPRITESHEET_KEYS.GAME_ICONS, ICON_FRAMES.CIRCLE_BLUE)
              .setScale(0.1).setAlpha(0.22).setOrigin(0.5)
            container.add(dot)
            scene.tweens.add({ targets: dot, y: steamSourceY - 24, x: px + (Math.random() - 0.5) * 10, alpha: 0, scale: 0.04, duration: 900 + Math.random() * 400, delay: si * 120, ease: 'Sine.easeOut', onComplete: () => { dot.destroy() } })
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
    if (this.visitorTimer) { this.visitorTimer.destroy(); this.visitorTimer = null }
    if (this.steamTimer) { this.steamTimer.destroy(); this.steamTimer = null }
    if (this.container) {
      this.scene.tweens.killTweensOf(this.container)
      this.container.destroy(true)
      this.container = null
    }
  }
}
