import Phaser from 'phaser'
import { BaseScene } from './base-scene'
import { EventBus, EVENTS, type SeasonEndedEventPayload, type SeasonStartedEventPayload } from './events'
import { SCENE_KEYS, SPRITESHEET_KEYS, TOAST_ICON_FRAMES, ICON_FRAMES, IMAGE_KEYS } from './office-asset-keys'
import { activeTheme } from './office-theme'
import { ActivityFeed } from './activity-feed'
import type { AgentState } from '../types'
import { scaledFontSize } from './office-constants'

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

type ToastLevel = 'info' | 'warn' | 'error'

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

const TOAST_BG: Record<ToastLevel, number>   = { info: 0x1e40af, warn: 0x78350f, error: 0x7f1d1d }
const TOAST_DOT: Record<ToastLevel, number>  = { info: 0x3b82f6, warn: 0xfbbf24, error: 0xef4444 }

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
        y: 16 + i * (TOAST_H + TOAST_MARGIN),
        duration: 200,
        ease: 'Power2',
      })
    })

    const slotIndex = this.activeToasts.length
    const startX    = this.scale.width - TOAST_W - 16
    const slotY     = 16 + slotIndex * (TOAST_H + TOAST_MARGIN)

    const bg = this.add.graphics()
    bg.fillStyle(TOAST_BG[level], 0.92)
    bg.fillRoundedRect(0, 0, TOAST_W, TOAST_H, 6)

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

    // Auto-dismiss: slide back out and fade
    this.time.delayedCall(duration, () => {
      this.tweens.add({
        targets: toast,
        x: startX + TOAST_SLIDE_PX,
        alpha: 0,
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
        y: 16 + i * (TOAST_H + TOAST_MARGIN),
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

    this.activityFeed?.destroy()
  }
}
