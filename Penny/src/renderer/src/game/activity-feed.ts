// ---------------------------------------------------------------------------
// activity-feed.ts
// Scrolling notification feed in the bottom-left of the game HUD.
// Shows recent events with sprite icons from the game-icons spritesheet.
// ---------------------------------------------------------------------------

import Phaser from 'phaser'
import { SPRITESHEET_KEYS, ICON_FRAMES } from './office-asset-keys'

// ---------------------------------------------------------------------------
// Feed entry type mapping — event kind to icon frame
// ---------------------------------------------------------------------------

export const FEED_ICONS: Record<string, number> = {
  task_complete:     ICON_FRAMES.CHECKMARK,
  task_start:        ICON_FRAMES.PLAY_DARK,
  rank_up:           ICON_FRAMES.ARROW_UP_DARK,
  quest_complete:    ICON_FRAMES.STAR_YELLOW,
  agent_joined:      ICON_FRAMES.CIRCLE_GREEN,
  agent_left:        ICON_FRAMES.CIRCLE_GREY,
  blocked:           ICON_FRAMES.CIRCLE_YELLOW,
  unblocked:         ICON_FRAMES.CHECKMARK,
  achievement:       ICON_FRAMES.ACHIEVEMENT_BADGE,
  season_challenge:  ICON_FRAMES.MEDAL_GOLD,
  quest_failed:      ICON_FRAMES.CROSS_RED,
  credits_earned:    ICON_FRAMES.STAR_BLUE,
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FLUSH_INTERVAL = 300
const MAX_VISIBLE = 5
const ENTRY_H     = 20
const ENTRY_GAP   = 2
const SLIDE_IN_MS = 280
const FADE_OUT_MS = 400
const TTL_MS      = 8000
const PANEL_X     = 12
const PANEL_Y_OFFSET = 60  // distance from bottom of viewport
const SLIDE_FROM_X = -200  // entries slide in from off-screen left
const ICON_SCALE  = 0.32

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface FeedSlot {
  container: Phaser.GameObjects.Container
  icon: Phaser.GameObjects.Sprite
  label: Phaser.GameObjects.Text
  busy: boolean
  timer: Phaser.Time.TimerEvent | null
}

// ---------------------------------------------------------------------------
// ActivityFeed
// ---------------------------------------------------------------------------

export class ActivityFeed {
  private scene: Phaser.Scene
  private root: Phaser.GameObjects.Container
  private slots: FeedSlot[] = []
  private queue: { kind: string; text: string }[] = []
  private flushTimer: Phaser.Time.TimerEvent | null = null

  constructor(scene: Phaser.Scene) {
    this.scene = scene

    // Root container — screen-space, bottom-left
    const y = scene.scale.height - PANEL_Y_OFFSET - MAX_VISIBLE * (ENTRY_H + ENTRY_GAP)
    this.root = scene.add.container(PANEL_X, y)
      .setScrollFactor(0)
      .setDepth(9997)

    // Pre-allocate slots
    for (let i = 0; i < MAX_VISIBLE; i++) {
      const slotY = i * (ENTRY_H + ENTRY_GAP)
      const icon = scene.add.sprite(8, slotY + ENTRY_H / 2, SPRITESHEET_KEYS.GAME_ICONS, ICON_FRAMES.CIRCLE_GREY)
        .setScale(ICON_SCALE)
        .setOrigin(0.5)
      const label = scene.add.text(20, slotY + 2, '', {
        fontSize: '9px',
        fontFamily: 'system-ui, monospace',
        color: '#b0bec5',
        resolution: 2,
      })
      const container = scene.add.container(SLIDE_FROM_X, 0, [icon, label])
        .setAlpha(0)
      this.root.add(container)

      this.slots.push({ container, icon, label, busy: false, timer: null })
    }
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Push a new entry into the activity feed.
   * @param kind - One of the keys in FEED_ICONS (e.g. 'task_complete')
   * @param text - Short description text
   */
  push(kind: string, text: string): void {
    // Coalesce consecutive duplicates
    const last = this.queue[this.queue.length - 1]
    if (last && last.kind === kind && last.text === text) return

    this.queue.push({ kind, text })
    this._flush()
  }

  /** Reposition root when viewport resizes. */
  resize(width: number, height: number): void {
    void width
    const y = height - PANEL_Y_OFFSET - MAX_VISIBLE * (ENTRY_H + ENTRY_GAP)
    this.root.setPosition(PANEL_X, y)
  }

  /** Clean up all slots and the root container. */
  destroy(): void {
    if (this.flushTimer) {
      this.flushTimer.destroy()
      this.flushTimer = null
    }
    for (const slot of this.slots) {
      if (slot.timer) slot.timer.destroy()
    }
    this.root.destroy()
    this.slots = []
    this.queue = []
  }

  // -------------------------------------------------------------------------
  // Private
  // -------------------------------------------------------------------------

  private _flush(): void {
    // If a scheduled flush is already pending, let it fire naturally
    if (this.flushTimer) return

    if (this.queue.length === 0) return

    const entry = this.queue.shift()!
    this._addEntry(entry.kind, entry.text)

    if (this.queue.length > 0) {
      this.flushTimer = this.scene.time.delayedCall(FLUSH_INTERVAL, () => {
        this.flushTimer = null
        this._flush()
      })
    }
  }

  private _addEntry(kind: string, text: string): void {
    // Shift existing busy entries upward by one row to make room at the bottom
    const busySlots = this.slots.filter(s => s.busy)

    // If all slots are full, recycle the topmost (oldest)
    if (busySlots.length >= MAX_VISIBLE) {
      const oldest = busySlots[0]
      this._recycleSlot(oldest)
    }

    // Move all busy entries up by one position
    const activeBusy = this.slots.filter(s => s.busy)
    for (let i = 0; i < activeBusy.length; i++) {
      const targetY = i * (ENTRY_H + ENTRY_GAP)
      this.scene.tweens.add({
        targets: activeBusy[i].container,
        y: targetY,
        duration: 160,
        ease: 'Power2',
      })
    }

    // Find a free slot
    const freeSlot = this.slots.find(s => !s.busy)
    if (!freeSlot) return // should not happen

    // Configure the slot
    const iconFrame = FEED_ICONS[kind] ?? ICON_FRAMES.CIRCLE_BLUE
    freeSlot.icon.setFrame(iconFrame)
    freeSlot.label.setText(text)
    freeSlot.busy = true

    // Position at the bottom row and slide in from left
    const bottomY = activeBusy.length * (ENTRY_H + ENTRY_GAP)
    freeSlot.container.setPosition(SLIDE_FROM_X, bottomY).setAlpha(0)

    // Slide in
    this.scene.tweens.add({
      targets: freeSlot.container,
      x: 0,
      alpha: 1,
      duration: SLIDE_IN_MS,
      ease: 'Back.easeOut',
    })

    // Schedule fade-out after TTL
    freeSlot.timer = this.scene.time.delayedCall(TTL_MS, () => {
      this._fadeOut(freeSlot)
    })
  }

  private _fadeOut(slot: FeedSlot): void {
    if (!slot.busy) return
    this.scene.tweens.add({
      targets: slot.container,
      alpha: 0,
      x: SLIDE_FROM_X,
      y: `+=${ENTRY_H * 0.6}`,
      duration: FADE_OUT_MS,
      ease: 'Power2',
      onComplete: () => {
        this._recycleSlot(slot)
        this._compactSlots()
      },
    })
  }

  private _recycleSlot(slot: FeedSlot): void {
    slot.busy = false
    slot.container.setAlpha(0).setX(SLIDE_FROM_X)
    if (slot.timer) {
      slot.timer.destroy()
      slot.timer = null
    }
    this.scene.tweens.killTweensOf(slot.container)
  }

  /** Re-stack busy slots so there are no vertical gaps. */
  private _compactSlots(): void {
    const active = this.slots.filter(s => s.busy)
    for (let i = 0; i < active.length; i++) {
      const targetY = i * (ENTRY_H + ENTRY_GAP)
      this.scene.tweens.add({
        targets: active[i].container,
        y: targetY,
        duration: 160,
        ease: 'Power2',
      })
    }
  }
}
