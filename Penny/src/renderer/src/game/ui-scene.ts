import Phaser from 'phaser'
import { BaseScene } from './base-scene'
import { EventBus, EVENTS, type SeasonEndedEventPayload, type SeasonStartedEventPayload } from './events'
import { SCENE_KEYS, SPRITESHEET_KEYS, TOAST_ICON_FRAMES, ICON_FRAMES, IMAGE_KEYS } from './office-asset-keys'
import { activeTheme } from './office-theme'
import { ActivityFeed } from './activity-feed'
import type { AgentState } from '../types'
import { scaledFontSize } from './office-constants'
import { creditManager } from './credits'

// ---------------------------------------------------------------------------
// UIScene — screen-space HUD overlay, runs parallel to OfficeScene
// ---------------------------------------------------------------------------
// Launch from OfficeScene.create() via:
//   this.scene.launch(SCENE_KEYS.UI_SCENE)
//
// All game objects use setScrollFactor(0) — this scene owns no world-space
// objects. OfficeScene retains world-space rendering; UIScene owns everything
// drawn relative to the viewport.
// ---------------------------------------------------------------------------

type ToastLevel = 'info' | 'warn' | 'error' | 'success'

interface ActiveToast {
  container: Phaser.GameObjects.Container
  startX: number
}

const TOAST_W        = 220
const TOAST_H        = 28
const TOAST_MARGIN   = 8
const TOAST_SLIDE_PX = 200
const TOAST_MAX      = 4
const TOAST_TTL_MS   = 3500

const TOAST_BG: Record<ToastLevel, number>   = { info: 0x1e40af, warn: 0x78350f, error: 0x7f1d1d, success: 0x065f46 }
const TOAST_DOT: Record<ToastLevel, number>  = { info: 0x3b82f6, warn: 0xfbbf24, error: 0xef4444, success: 0x34d399 }
const TOAST_BORDER: Record<ToastLevel, number> = { info: 0x3b82f6, warn: 0xfbbf24, error: 0xef4444, success: 0x34d399 }

const STATUS_BAR_H  = 32
const STATUS_TOAST_OFFSET = STATUS_BAR_H + 4  // toasts appear below the status bar
const ENERGY_BAR_W  = 60

const INFO_BAR_H = 28
const HELP_W     = 280
const HELP_H     = 310

const SHORTCUTS: [string, string][] = [
  ['TAB',     'Cycle agents'],
  ['ENTER',   'Open agent'],
  ['ESC',     'Deselect'],
  ['F',       'Zoom to fit'],
  ['R',       'Reset camera'],
  ['SPACE',   'Auto-pan'],
  ['+  /  -', 'Zoom in / out'],
  ['1 - 9',   'Jump to agent'],
  ['H  /  ?', 'This help'],
  ['`',       'Debug overlay'],
]

export class UIScene extends BaseScene {
  // Toast stack
  private toastRoot!: Phaser.GameObjects.Container
  private activeToasts: ActiveToast[] = []

  // Selected-agent info bar (bottom)
  private infoBar!: Phaser.GameObjects.Container
  private infoBarBg!: Phaser.GameObjects.Rectangle
  private infoBarText!: Phaser.GameObjects.Text
  private infoBarStatus!: Phaser.GameObjects.Text

  // Help overlay
  private helpOverlay: Phaser.GameObjects.Container | null = null
  private _helpVisible = false

  // Activity feed (bottom-left scrolling log)
  private activityFeed!: ActivityFeed

  // Status bar (top of viewport)
  private statusBar!: Phaser.GameObjects.Container
  private _statusEnergyFill!: Phaser.GameObjects.Rectangle
  private _statusEnergyIcon!: Phaser.GameObjects.Sprite
  private _statusPodsText!: Phaser.GameObjects.Text
  private _statusPodsIcon!: Phaser.GameObjects.Sprite
  private _statusCreditsText!: Phaser.GameObjects.Text
  private _statusTimeText!: Phaser.GameObjects.Text
  private _statusWeatherIcon!: Phaser.GameObjects.Sprite
  private _statusWeatherText!: Phaser.GameObjects.Text
  private _statusTimeTimer: Phaser.Time.TimerEvent | null = null

  // Status bar state
  private _agentStatusMap = new Map<string, string>() // agentId → AgentStatus
  private _creditsBalance = 0
  private _podCount = 0

  // Bound EventBus handlers — captured for off() cleanup
  private readonly _onNotification = (msg: string, level: ToastLevel) => this.showToast(msg, level)
  private readonly _onStateChanged = (_id: string, next: AgentState) => {
    if (next.needsInteraction) {
      this.showToast(`${next.config?.name ?? 'Agent'} needs input`, 'warn')
    }
  }
  private readonly _onSelectionChanged = (agentId: string | null) => {
    if (agentId == null) {
      this.hideAgentInfo()
    }
  }

  // Activity feed event handlers
  private readonly _onAgentArrived = (_id: string, state: AgentState) => {
    this.activityFeed?.push('agent_joined', `${state.config?.name ?? 'Agent'} joined`)
  }
  private readonly _onAgentDeparted = (agentId: string) => {
    this.activityFeed?.push('agent_left', `${agentId.slice(0, 8)} left`)
  }
  private readonly _onQuestCompleted = (_qid: string, _aid: string, xp: number, credits: number) => {
    this.activityFeed?.push('quest_complete', `Quest done: +${xp}XP +${credits}cr`)
  }
  private readonly _onQuestStarted = (_qid: string, _aid: string, difficulty: string) => {
    this.activityFeed?.push('task_start', `Quest started (${difficulty})`)
  }
  private readonly _onQuestFailed = (_qid: string, agentId: string) => {
    this.activityFeed?.push('quest_failed', `Quest failed: ${agentId.slice(0, 8)}`)
  }
  private readonly _onAchievementUnlocked = (_id: string, title: string) => {
    this.activityFeed?.push('achievement', `Achievement: ${title}`)
  }
  private readonly _onChallengeCompleted = (_id: string, desc: string) => {
    this.activityFeed?.push('season_challenge', `Challenge: ${desc}`)
  }
  private readonly _onCreditsEarned = (amount: number) => {
    this.activityFeed?.push('credits_earned', `+${amount} credits`)
  }
  private readonly _onSeasonEnded = (payload: SeasonEndedEventPayload) => {
    this.activityFeed?.push(
      'season_challenge',
      `Season "${payload.seasonName}" ended! ${payload.summaryLine}`,
    )
  }
  private readonly _onSeasonStarted = (payload: SeasonStartedEventPayload) => {
    this.activityFeed?.push('task_start', `New season: ${payload.seasonName}`)
  }

  // Status bar handlers
  private readonly _onStatusAgentArrived = (agentId: string, state: AgentState) => {
    this._agentStatusMap.set(agentId, state.status)
    this._refreshEnergy()
  }
  private readonly _onStatusAgentDeparted = (agentId: string) => {
    this._agentStatusMap.delete(agentId)
    this._refreshEnergy()
  }
  private readonly _onStatusAgentChanged = (agentId: string, next: AgentState) => {
    this._agentStatusMap.set(agentId, next.status)
    this._refreshEnergy()
  }
  private readonly _onStatusCreditsEarned = (_amount: number, newBalance: number) => {
    this._creditsBalance = newBalance
    if (this._statusCreditsText) this._statusCreditsText.setText(String(newBalance))
  }
  private readonly _onStatusCampusCounts = (_agents: number, pods: number) => {
    this._podCount = pods
    if (this._statusPodsText) this._statusPodsText.setText(String(pods))
  }

  constructor() {
    super({ key: SCENE_KEYS.UI_SCENE })
  }

  // ---------------------------------------------------------------------------
  // BaseScene hooks
  // ---------------------------------------------------------------------------

  onPreload(): void { /* no assets — all procedural */ }

  onCreate(): void {
    // Toast root — all toasts are children of this container
    this.toastRoot = this.add.container(0, 0).setDepth(9998).setScrollFactor(0)

    // Status bar — top-of-screen RPG metric strip
    this._buildStatusBar()

    // Info bar — hidden until an agent is selected
    this._buildInfoBar()

    // Activity feed — scrolling event log in bottom-left
    this.activityFeed = new ActivityFeed(this)

    // EventBus listeners
    EventBus.on(EVENTS.NOTIFICATION,     this._onNotification as Parameters<typeof EventBus.on>[1])
    EventBus.on(EVENTS.AGENT_STATE_CHANGED, this._onStateChanged as Parameters<typeof EventBus.on>[1])
    EventBus.on(EVENTS.SELECTION_CHANGED,   this._onSelectionChanged as Parameters<typeof EventBus.on>[1])

    // Activity feed event listeners
    EventBus.on(EVENTS.AGENT_ARRIVED,        this._onAgentArrived as Parameters<typeof EventBus.on>[1])
    EventBus.on(EVENTS.AGENT_DEPARTED,       this._onAgentDeparted as Parameters<typeof EventBus.on>[1])
    EventBus.on(EVENTS.QUEST_COMPLETED,      this._onQuestCompleted as Parameters<typeof EventBus.on>[1])
    EventBus.on(EVENTS.QUEST_STARTED,        this._onQuestStarted as Parameters<typeof EventBus.on>[1])
    EventBus.on(EVENTS.QUEST_FAILED,         this._onQuestFailed as Parameters<typeof EventBus.on>[1])
    EventBus.on(EVENTS.ACHIEVEMENT_UNLOCKED, this._onAchievementUnlocked as Parameters<typeof EventBus.on>[1])
    EventBus.on(EVENTS.CHALLENGE_COMPLETED,  this._onChallengeCompleted as Parameters<typeof EventBus.on>[1])
    EventBus.on(EVENTS.CREDITS_EARNED,       this._onCreditsEarned as Parameters<typeof EventBus.on>[1])
    EventBus.on(EVENTS.SEASON_ENDED,         this._onSeasonEnded as Parameters<typeof EventBus.on>[1])
    EventBus.on(EVENTS.SEASON_STARTED,       this._onSeasonStarted as Parameters<typeof EventBus.on>[1])

    // Status bar event listeners
    EventBus.on(EVENTS.AGENT_ARRIVED,         this._onStatusAgentArrived as Parameters<typeof EventBus.on>[1])
    EventBus.on(EVENTS.AGENT_DEPARTED,        this._onStatusAgentDeparted as Parameters<typeof EventBus.on>[1])
    EventBus.on(EVENTS.AGENT_STATE_CHANGED,   this._onStatusAgentChanged as Parameters<typeof EventBus.on>[1])
    EventBus.on(EVENTS.CREDITS_EARNED,        this._onStatusCreditsEarned as Parameters<typeof EventBus.on>[1])
    EventBus.on(EVENTS.CAMPUS_COUNTS_UPDATED, this._onStatusCampusCounts as Parameters<typeof EventBus.on>[1])

    // Reposition feed on viewport resize
    this.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
      const uiCam = this.cameras.main
      uiCam.setViewport(0, 0, gameSize.width, gameSize.height)
      uiCam.setSize(gameSize.width, gameSize.height)
      this.activityFeed?.resize(gameSize.width, gameSize.height)
    })

    // Tear down on scene shutdown (handles scene restart / destroy)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this._teardown, this)
  }

  onUpdate(_time: number, _delta: number): void { /* stateless tick */ }

  // ---------------------------------------------------------------------------
  // Toast notifications
  // ---------------------------------------------------------------------------

  showToast(message: string, level: ToastLevel = 'info', duration = TOAST_TTL_MS): void {
    // Evict oldest if at capacity
    while (this.activeToasts.length >= TOAST_MAX) {
      this.activeToasts.shift()?.container.destroy()
    }

    // Slide existing toasts up to make room for the arriving slot
    this.activeToasts.forEach((t, i) => {
      this.tweens.add({
        targets: t.container,
        y: STATUS_TOAST_OFFSET + i * (TOAST_H + TOAST_MARGIN),
        duration: 200,
        ease: 'Power2',
      })
    })

    const slotIndex = this.activeToasts.length
    const startX    = this.scale.width - TOAST_W - 16
    const slotY     = STATUS_TOAST_OFFSET + slotIndex * (TOAST_H + TOAST_MARGIN)

    const bg = this.add.graphics()
    bg.fillStyle(TOAST_BG[level], 0.92)
    bg.fillRoundedRect(0, 0, TOAST_W, TOAST_H, 6)
    bg.lineStyle(1.5, TOAST_BORDER[level], 0.7)
    bg.strokeRoundedRect(0, 0, TOAST_W, TOAST_H, 6)

    // Sprite icon from game-icons sheet — map 'warn' -> 'warning' for TOAST_ICON_FRAMES lookup
    const frameLookup = level === 'warn' ? 'warning' : level
    const iconFrame = TOAST_ICON_FRAMES[frameLookup] ?? ICON_FRAMES.CIRCLE_BLUE
    const dot = this.add.sprite(16, TOAST_H / 2, SPRITESHEET_KEYS.GAME_ICONS, iconFrame)
      .setScale(0.3).setOrigin(0.5)

    const label = this.add.text(26, 6, message, {
      fontSize: scaledFontSize(11), fontFamily: 'monospace', color: activeTheme.headerText,
      wordWrap: { width: TOAST_W - 34 }, resolution: 2,
    })

    // Countdown progress bar at the bottom of the toast
    const iconColor = TOAST_DOT[level]
    const bar = this.add.rectangle(0, TOAST_H - 1, TOAST_W, 1.5, iconColor, 0.4)
      .setOrigin(0, 0.5)

    const toast = this.add.container(startX + TOAST_SLIDE_PX, slotY, [bg, dot, label, bar])
    toast.setAlpha(0).setScrollFactor(0).setDepth(9998)
    this.toastRoot.add(toast)

    this.tweens.add({
      targets: bar,
      width: 0,
      duration,
      ease: 'Linear',
    })

    const entry: ActiveToast = { container: toast, startX }
    this.activeToasts.push(entry)

    // Slide in from the right with a slight overshoot
    this.tweens.add({ targets: toast, x: startX, alpha: 1, duration: 300, ease: 'Back.easeOut' })

    // Icon entrance pulse after slide-in completes
    this.tweens.add({
      targets: dot,
      scaleX: 0.42,
      scaleY: 0.42,
      duration: 150,
      yoyo: true,
      delay: 300,
      ease: 'Back.easeOut',
    })

    // Auto-dismiss: shrink + slide back out and fade
    this.time.delayedCall(duration, () => {
      this.tweens.add({
        targets: toast,
        x: startX + TOAST_SLIDE_PX,
        alpha: 0,
        scaleX: 0.85,
        scaleY: 0.85,
        duration: 250,
        ease: 'Power2',
        onComplete: () => {
          const idx = this.activeToasts.indexOf(entry)
          if (idx >= 0) this.activeToasts.splice(idx, 1)
          toast.destroy()
          this._reflowToasts()
        },
      })
    })
  }

  private _reflowToasts(): void {
    this.activeToasts.forEach((t, i) => {
      this.tweens.add({
        targets: t.container,
        y: STATUS_TOAST_OFFSET + i * (TOAST_H + TOAST_MARGIN),
        duration: 200,
        ease: 'Back.easeOut',
      })
    })
  }

  // ---------------------------------------------------------------------------
  // Agent info bar (bottom of viewport)
  // ---------------------------------------------------------------------------

  showAgentInfo(agentId: string, name: string, status: string): void {
    void agentId // reserved for future drill-down
    const vw = this.scale.width
    const vy = this.scale.height

    this.infoBar.setY(vy - INFO_BAR_H).setVisible(true)
    this.infoBarBg.setSize(vw, INFO_BAR_H)
    this.infoBarText.setText(name).setX(12)
    this.infoBarStatus.setText(status).setX(vw - 12)

    this.tweens.killTweensOf(this.infoBar)
    this.infoBar.setAlpha(0)
    this.tweens.add({ targets: this.infoBar, alpha: 1, duration: 180, ease: 'Quad.easeOut' })
  }

  hideAgentInfo(): void {
    if (!this.infoBar.visible) return
    this.tweens.add({
      targets: this.infoBar,
      alpha: 0,
      duration: 140,
      ease: 'Quad.easeIn',
      onComplete: () => this.infoBar.setVisible(false),
    })
  }

  private _buildInfoBar(): void {
    const vw = this.scale.width
    const vy = this.scale.height

    this.infoBarBg = this.add.rectangle(0, 0, vw, INFO_BAR_H, activeTheme.panelBg, 0.9).setOrigin(0, 0)
    const sep = this.add.rectangle(0, 0, vw, 1, activeTheme.separator, 1).setOrigin(0, 0)

    const ts = { fontFamily: 'monospace', fontSize: scaledFontSize(10), fontStyle: 'bold', color: '#f1f5f9', resolution: 2 }
    this.infoBarText   = this.add.text(12,      INFO_BAR_H / 2, '', ts).setOrigin(0, 0.5)
    this.infoBarStatus = this.add.text(vw - 12, INFO_BAR_H / 2, '', { ...ts, color: '#34d399' }).setOrigin(1, 0.5)

    this.infoBar = this.add.container(0, vy - INFO_BAR_H, [this.infoBarBg, sep, this.infoBarText, this.infoBarStatus])
    this.infoBar.setDepth(9995).setScrollFactor(0).setVisible(false)
  }

  // ---------------------------------------------------------------------------
  // Keyboard shortcuts help overlay
  // ---------------------------------------------------------------------------

  get helpVisible(): boolean { return this._helpVisible }

  showHelp(): void {
    if (this.helpOverlay) return
    this._helpVisible = true

    const { width: vw, height: vh } = this.scale
    const cx = vw / 2
    const cy = vh / 2

    const backdrop = this.add.rectangle(cx, cy, vw, vh, 0x000000, 0.7).setScrollFactor(0)

    const panelGfx = this.add.graphics()
    panelGfx.fillStyle(activeTheme.panelBg, 1)
    panelGfx.fillRoundedRect(cx - HELP_W / 2, cy - HELP_H / 2, HELP_W, HELP_H, 10)
    panelGfx.lineStyle(1, activeTheme.panelStroke, 1)
    panelGfx.strokeRoundedRect(cx - HELP_W / 2, cy - HELP_H / 2, HELP_W, HELP_H, 10)

    const title = this.add.text(cx, cy - HELP_H / 2 + 18, 'Keyboard Shortcuts', {
      fontSize: scaledFontSize(12), fontStyle: 'bold', color: '#f1f5f9', fontFamily: 'monospace', resolution: 2,
    }).setOrigin(0.5, 0).setScrollFactor(0)

    const divGfx = this.add.graphics()
    divGfx.lineStyle(1, activeTheme.panelStroke, 0.6)
    divGfx.lineBetween(cx - HELP_W / 2 + 16, cy - HELP_H / 2 + 36, cx + HELP_W / 2 - 16, cy - HELP_H / 2 + 36)

    const rowH   = 22
    const startY = cy - HELP_H / 2 + 46
    const keyX   = cx - HELP_W / 2 + 20
    const descX  = cx - HELP_W / 2 + 110
    const rows: Phaser.GameObjects.Text[] = []

    for (let i = 0; i < SHORTCUTS.length; i++) {
      const [key, desc] = SHORTCUTS[i]
      const rowY = startY + i * rowH
      rows.push(
        this.add.text(keyX,  rowY, key,  { fontSize: scaledFontSize(10), color: '#5a6a7a', fontFamily: 'monospace', fontStyle: 'bold', resolution: 2 }).setScrollFactor(0),
        this.add.text(descX, rowY, desc, { fontSize: scaledFontSize(10), color: activeTheme.subtleText, fontFamily: 'monospace', resolution: 2 }).setScrollFactor(0),
      )
    }

    // Divider sprite above dismiss hint (if loaded), else Graphics fallback
    let hintDivider: Phaser.GameObjects.GameObject
    if (this.textures.exists(IMAGE_KEYS.DIVIDER)) {
      hintDivider = this.add.image(cx, cy + HELP_H / 2 - 28, IMAGE_KEYS.DIVIDER)
        .setDisplaySize(HELP_W - 32, 4).setAlpha(0.5).setScrollFactor(0)
    } else {
      const hd = this.add.graphics()
      hd.lineStyle(1, activeTheme.panelStroke, 0.4)
      hd.lineBetween(cx - HELP_W / 2 + 16, cy + HELP_H / 2 - 28, cx + HELP_W / 2 - 16, cy + HELP_H / 2 - 28)
      hintDivider = hd
    }

    // Button sprite accent next to dismiss hint
    const hintBtn = this.add.sprite(cx - 80, cy + HELP_H / 2 - 12, SPRITESHEET_KEYS.GAME_ICONS, ICON_FRAMES.BUTTON_ROUND)
      .setScale(0.35).setOrigin(0.5, 0.5).setAlpha(0.6).setScrollFactor(0)

    const hint = this.add.text(cx - 66, cy + HELP_H / 2 - 12, 'Press H or ESC to dismiss', {
      fontSize: scaledFontSize(9), color: '#3a4858', fontFamily: 'monospace', resolution: 2,
    }).setOrigin(0, 0.5).setScrollFactor(0)

    this.helpOverlay = this.add.container(0, 0, [backdrop, panelGfx, title, divGfx, ...rows, hintDivider, hintBtn, hint])
    this.helpOverlay.setDepth(9999).setScrollFactor(0).setAlpha(0)

    this.tweens.add({ targets: this.helpOverlay, alpha: 1, duration: 200, ease: 'Quad.easeOut' })
  }

  hideHelp(): void {
    if (!this.helpOverlay) return
    this._helpVisible = false
    const overlay = this.helpOverlay
    this.helpOverlay = null
    this.tweens.add({
      targets: overlay,
      alpha: 0,
      duration: 150,
      ease: 'Quad.easeIn',
      onComplete: () => { try { overlay.destroy() } catch { /* already gone */ } },
    })
  }

  // ---------------------------------------------------------------------------
  // Status bar
  // ---------------------------------------------------------------------------

  private _buildStatusBar(): void {
    const vw = this.scale.width
    const cy = STATUS_BAR_H / 2
    this._creditsBalance = creditManager.getBalance()

    // Background — extra wide so it always covers screen
    const bg = this.add.graphics()
    bg.fillStyle(activeTheme.panelBg, 0.95)
    bg.fillRect(0, 0, Math.max(vw, 4000), STATUS_BAR_H)
    bg.lineStyle(1, activeTheme.separator, 0.5)
    bg.lineBetween(0, STATUS_BAR_H - 0.5, Math.max(vw, 4000), STATUS_BAR_H - 0.5)

    // ── Energy section ──────────────────────────────────────────────────────
    this._statusEnergyIcon = this.add.sprite(10, cy, SPRITESHEET_KEYS.GAME_ICONS, ICON_FRAMES.CIRCLE_GREEN)
      .setScale(0.35).setOrigin(0.5)

    const energyLabel = this.add.text(22, cy, 'ENERGY', {
      fontSize: scaledFontSize(8), fontFamily: 'monospace', color: activeTheme.subtleText, resolution: 2,
    }).setOrigin(0, 0.5)

    const energyBarX = 74
    const energyBarBg = this.add.rectangle(energyBarX, cy, ENERGY_BAR_W, 6, 0x1e293b, 1).setOrigin(0, 0.5)
    this._statusEnergyFill = this.add.rectangle(energyBarX, cy, ENERGY_BAR_W, 6, 0x34d399, 1).setOrigin(0, 0.5)
    this._applyEnergyBar(0) // start at zero

    const sep1 = this.add.graphics()
    sep1.lineStyle(1, activeTheme.separator, 0.45)
    sep1.lineBetween(148, 6, 148, STATUS_BAR_H - 6)

    // ── Pods section ────────────────────────────────────────────────────────
    this._statusPodsIcon = this.add.sprite(158, cy, SPRITESHEET_KEYS.GAME_ICONS, ICON_FRAMES.REPEAT_DARK)
      .setScale(0.35).setOrigin(0.5)
    this.tweens.add({
      targets: this._statusPodsIcon,
      angle: 360,
      duration: 2400,
      repeat: -1,
      ease: 'Linear',
    })

    const podsLabel = this.add.text(172, cy, 'PODS', {
      fontSize: scaledFontSize(8), fontFamily: 'monospace', color: activeTheme.subtleText, resolution: 2,
    }).setOrigin(0, 0.5)

    this._statusPodsText = this.add.text(202, cy, String(this._podCount), {
      fontSize: scaledFontSize(10), fontFamily: 'monospace', fontStyle: 'bold',
      color: activeTheme.headerText, resolution: 2,
    }).setOrigin(0, 0.5)

    const sep2 = this.add.graphics()
    sep2.lineStyle(1, activeTheme.separator, 0.45)
    sep2.lineBetween(228, 6, 228, STATUS_BAR_H - 6)

    // ── Credits section ─────────────────────────────────────────────────────
    const credIcon = this.add.sprite(238, cy, SPRITESHEET_KEYS.GAME_ICONS, ICON_FRAMES.MEDAL_GOLD)
      .setScale(0.35).setOrigin(0.5)

    const credLabel = this.add.text(252, cy, 'CR', {
      fontSize: scaledFontSize(8), fontFamily: 'monospace', color: activeTheme.subtleText, resolution: 2,
    }).setOrigin(0, 0.5)

    this._statusCreditsText = this.add.text(268, cy, String(this._creditsBalance), {
      fontSize: scaledFontSize(10), fontFamily: 'monospace', fontStyle: 'bold',
      color: '#fbbf24', resolution: 2,
    }).setOrigin(0, 0.5)

    const sep3 = this.add.graphics()
    sep3.lineStyle(1, activeTheme.separator, 0.45)
    sep3.lineBetween(318, 6, 318, STATUS_BAR_H - 6)

    // ── Time section (centered) ─────────────────────────────────────────────
    this._statusTimeText = this.add.text(vw / 2, cy, this._getTimeStr(), {
      fontSize: scaledFontSize(10), fontFamily: 'monospace', fontStyle: 'bold',
      color: activeTheme.headerText, resolution: 2,
    }).setOrigin(0.5)

    const sep4 = this.add.graphics()
    sep4.lineStyle(1, activeTheme.separator, 0.45)
    sep4.lineBetween(vw - 112, 6, vw - 112, STATUS_BAR_H - 6)

    // ── Weather section (right-anchored) ────────────────────────────────────
    this._statusWeatherIcon = this.add.sprite(vw - 100, cy, SPRITESHEET_KEYS.GAME_ICONS, this._getWeatherFrame())
      .setScale(0.35).setOrigin(0.5)

    this._statusWeatherText = this.add.text(vw - 88, cy, this._getWeatherLabel(), {
      fontSize: scaledFontSize(9), fontFamily: 'monospace', color: activeTheme.subtleText, resolution: 2,
    }).setOrigin(0, 0.5)

    // ── Assemble container (starts above screen, slides down) ───────────────
    this.statusBar = this.add.container(0, -STATUS_BAR_H, [
      bg,
      this._statusEnergyIcon, energyLabel, energyBarBg, this._statusEnergyFill,
      sep1,
      this._statusPodsIcon, podsLabel, this._statusPodsText,
      sep2,
      credIcon, credLabel, this._statusCreditsText,
      sep3,
      this._statusTimeText,
      sep4,
      this._statusWeatherIcon, this._statusWeatherText,
    ])
    this.statusBar.setDepth(9996).setScrollFactor(0)

    // Slide in from top (300ms, Back.easeOut)
    this.tweens.add({
      targets: this.statusBar,
      y: 0,
      duration: 300,
      ease: 'Back.easeOut',
      delay: 100,
    })

    // Refresh time & weather every 60s
    this._statusTimeTimer = this.time.addEvent({
      delay: 60_000,
      callback: this._refreshTimeWeather,
      callbackScope: this,
      loop: true,
    })
  }

  private _getTimeStr(): string {
    const now = new Date()
    const h = now.getHours()
    const m = now.getMinutes().toString().padStart(2, '0')
    const ampm = h >= 12 ? 'PM' : 'AM'
    const h12 = (h % 12) || 12
    return `${h12}:${m} ${ampm}`
  }

  private _getTimePhase(): 'morning' | 'day' | 'evening' | 'night' {
    const h = new Date().getHours()
    if (h >= 6 && h < 10) return 'morning'
    if (h >= 10 && h < 17) return 'day'
    if (h >= 17 && h < 20) return 'evening'
    return 'night'
  }

  private _getWeatherFrame(): number {
    const phase = this._getTimePhase()
    if (phase === 'morning') return ICON_FRAMES.STAR_GREY
    if (phase === 'evening') return ICON_FRAMES.STAR_RED
    if (phase === 'night')   return ICON_FRAMES.CIRCLE_BLUE
    return ICON_FRAMES.STAR_YELLOW // 'day'
  }

  private _getWeatherLabel(): string {
    const phase = this._getTimePhase()
    if (phase === 'morning') return 'MIST'
    if (phase === 'evening') return 'DUSK'
    if (phase === 'night')   return 'RAIN'
    return 'CLEAR' // 'day'
  }

  private _refreshTimeWeather(): void {
    this._statusTimeText?.setText(this._getTimeStr())
    this._statusWeatherIcon?.setFrame(this._getWeatherFrame())
    this._statusWeatherText?.setText(this._getWeatherLabel())
  }

  private _refreshEnergy(): void {
    const total = this._agentStatusMap.size
    if (total === 0) { this._applyEnergyBar(0); return }
    const active = [...this._agentStatusMap.values()].filter(s => s === 'active').length
    this._applyEnergyBar(active / total)
  }

  private _applyEnergyBar(ratio: number): void {
    if (!this._statusEnergyFill) return
    const w = Math.max(2, Math.round(ratio * ENERGY_BAR_W))
    this._statusEnergyFill.setSize(w, 6)
    const color = ratio > 0.6 ? 0x34d399 : ratio > 0.3 ? 0xfbbf24 : 0xef4444
    this._statusEnergyFill.setFillStyle(color)
    const frame = ratio > 0.6 ? ICON_FRAMES.CIRCLE_GREEN : ratio > 0.3 ? ICON_FRAMES.CIRCLE_YELLOW : ICON_FRAMES.CIRCLE_RED
    this._statusEnergyIcon?.setFrame(frame)
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  private _teardown(): void {
    EventBus.off(EVENTS.NOTIFICATION,        this._onNotification as Parameters<typeof EventBus.off>[1])
    EventBus.off(EVENTS.AGENT_STATE_CHANGED, this._onStateChanged as Parameters<typeof EventBus.off>[1])
    EventBus.off(EVENTS.SELECTION_CHANGED,   this._onSelectionChanged as Parameters<typeof EventBus.off>[1])

    // Activity feed event cleanup
    EventBus.off(EVENTS.AGENT_ARRIVED,        this._onAgentArrived as Parameters<typeof EventBus.off>[1])
    EventBus.off(EVENTS.AGENT_DEPARTED,       this._onAgentDeparted as Parameters<typeof EventBus.off>[1])
    EventBus.off(EVENTS.QUEST_COMPLETED,      this._onQuestCompleted as Parameters<typeof EventBus.off>[1])
    EventBus.off(EVENTS.QUEST_STARTED,        this._onQuestStarted as Parameters<typeof EventBus.off>[1])
    EventBus.off(EVENTS.QUEST_FAILED,         this._onQuestFailed as Parameters<typeof EventBus.off>[1])
    EventBus.off(EVENTS.ACHIEVEMENT_UNLOCKED, this._onAchievementUnlocked as Parameters<typeof EventBus.off>[1])
    EventBus.off(EVENTS.CHALLENGE_COMPLETED,  this._onChallengeCompleted as Parameters<typeof EventBus.off>[1])
    EventBus.off(EVENTS.CREDITS_EARNED,       this._onCreditsEarned as Parameters<typeof EventBus.off>[1])
    EventBus.off(EVENTS.SEASON_ENDED,         this._onSeasonEnded as Parameters<typeof EventBus.off>[1])
    EventBus.off(EVENTS.SEASON_STARTED,       this._onSeasonStarted as Parameters<typeof EventBus.off>[1])

    // Status bar event cleanup
    EventBus.off(EVENTS.AGENT_ARRIVED,         this._onStatusAgentArrived as Parameters<typeof EventBus.off>[1])
    EventBus.off(EVENTS.AGENT_DEPARTED,        this._onStatusAgentDeparted as Parameters<typeof EventBus.off>[1])
    EventBus.off(EVENTS.AGENT_STATE_CHANGED,   this._onStatusAgentChanged as Parameters<typeof EventBus.off>[1])
    EventBus.off(EVENTS.CREDITS_EARNED,        this._onStatusCreditsEarned as Parameters<typeof EventBus.off>[1])
    EventBus.off(EVENTS.CAMPUS_COUNTS_UPDATED, this._onStatusCampusCounts as Parameters<typeof EventBus.off>[1])
    this._statusTimeTimer?.destroy()
    this._statusTimeTimer = null

    this.activityFeed?.destroy()
  }
}
