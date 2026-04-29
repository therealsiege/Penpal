// ---------------------------------------------------------------------------
// quest-panel.ts
// Quest Log panel overlay — displays active quests, completed history,
// and aggregate stats. Toggled with the Q key. Follows the SeasonHUD
// overlay pattern (screen-space, setScrollFactor(0), fade in/out).
// ---------------------------------------------------------------------------

import Phaser from 'phaser'
import { questSystem, QuestSystem } from './quest-system'
import type { Quest, QuestDifficulty } from './quest-system'
import { SPRITESHEET_KEYS, ICON_FRAMES, IMAGE_KEYS, DIFFICULTY_STAR_FRAME } from './office-asset-keys'
import { activeTheme } from './office-theme'
import { scaledFontSize } from './office-constants'

// ---------------------------------------------------------------------------
// QuestPanel
// ---------------------------------------------------------------------------

export class QuestPanel {
  private scene: Phaser.Scene
  private container: Phaser.GameObjects.Container | null = null
  private viewWidth = 800
  private viewHeight = 600
  isVisible = false

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  // -------------------------------------------------------------------------
  // Init / resize
  // -------------------------------------------------------------------------

  init(viewWidth: number, viewHeight: number): void {
    this.viewWidth = viewWidth
    this.viewHeight = viewHeight
  }

  setViewSize(w: number, h: number): void {
    this.viewWidth = w
    this.viewHeight = h
    if (this.container && this.isVisible) {
      this.container.setPosition(10, h - 10)
    }
  }

  // -------------------------------------------------------------------------
  // Toggle
  // -------------------------------------------------------------------------

  toggleQuestLog(): void {
    this.isVisible = !this.isVisible
    if (this.isVisible) {
      this._show()
    } else {
      this._hide()
    }
  }

  // -------------------------------------------------------------------------
  // Update — refresh active quest elapsed times
  // -------------------------------------------------------------------------

  update(): void {
    if (!this.isVisible || !this.container) return
    // Rebuild content to refresh elapsed times
    this._rebuildContent()
  }

  // -------------------------------------------------------------------------
  // Star-fly target position
  // -------------------------------------------------------------------------

  getPanelScreenPosition(): { x: number; y: number } {
    if (!this.container) return { x: 130, y: this.viewHeight - 100 }
    return { x: 130, y: this.container.y - 60 }
  }

  // -------------------------------------------------------------------------
  // Cleanup
  // -------------------------------------------------------------------------

  destroy(): void {
    this.container?.destroy()
    this.container = null
    this.isVisible = false
  }

  // -------------------------------------------------------------------------
  // Private — show / hide
  // -------------------------------------------------------------------------

  private _show(): void {
    if (this.container) this.container.destroy()

    this.container = this.scene.add.container(10, this.viewHeight - 10)
      .setScrollFactor(0)
      .setDepth(9999)
      .setAlpha(0)

    this._rebuildContent()

    this.scene.tweens.add({
      targets: this.container, alpha: 1, duration: 180, ease: 'Power2',
    })
  }

  private _hide(): void {
    if (!this.container) return
    this.scene.tweens.add({
      targets: this.container, alpha: 0, duration: 140, ease: 'Power2',
      onComplete: () => {
        this.container?.destroy()
        this.container = null
      },
    })
  }

  // -------------------------------------------------------------------------
  // Private — rebuild panel content
  // -------------------------------------------------------------------------

  private _rebuildContent(): void {
    if (!this.container) return

    // Remove all existing children
    this.container.removeAll(true)

    const panelW = 240
    const activeQuests = questSystem.getActiveQuests().slice(0, 5)
    const completedQuests = questSystem.getCompletedQuests().slice(0, 5)
    const stats = questSystem.getQuestStats()

    const rowH = 18
    const sectionGap = 6
    const titleH = 24
    const dividerH = 8

    // Calculate panel height
    const activeRows = Math.max(1, activeQuests.length)
    const historyRows = Math.max(1, completedQuests.length)
    const statsH = 20
    const panelH = titleH + dividerH
      + activeRows * rowH + sectionGap
      + 14 // "HISTORY" label
      + historyRows * rowH + sectionGap
      + statsH + 8

    // Background — origin bottom-left so panel grows upward
    const bg = this.scene.add.graphics()
    bg.fillStyle(activeTheme.bg, 0.92)
    bg.fillRoundedRect(0, -panelH, panelW, panelH, 6)
    bg.lineStyle(1, activeTheme.panelStroke, 0.8)
    bg.strokeRoundedRect(0, -panelH, panelW, panelH, 6)
    this.container.add(bg)

    let curY = -panelH + 10

    // Title
    const title = this.scene.add.text(panelW / 2, curY, 'QUEST LOG', {
      fontSize: scaledFontSize(10), fontFamily: 'system-ui, monospace', color: '#fbbf24',
      resolution: 2,
    }).setOrigin(0.5, 0)
    this.container.add(title)
    curY += titleH

    // Divider
    if (this.scene.textures.exists(IMAGE_KEYS.DIVIDER)) {
      const div = this.scene.add.image(panelW / 2, curY - 4, IMAGE_KEYS.DIVIDER)
        .setDisplaySize(panelW - 20, 4).setAlpha(0.5)
      this.container.add(div)
    } else {
      const divGfx = this.scene.add.graphics()
      divGfx.lineStyle(1, activeTheme.panelStroke, 0.6)
      divGfx.lineBetween(10, curY - 4, panelW - 10, curY - 4)
      this.container.add(divGfx)
    }

    // ── Active quests section ──
    if (activeQuests.length === 0) {
      const empty = this.scene.add.text(panelW / 2, curY, 'No active quests', {
        fontSize: scaledFontSize(7), fontFamily: 'system-ui, monospace', color: '#4a5464',
        resolution: 2,
      }).setOrigin(0.5, 0)
      this.container.add(empty)
      curY += rowH
    } else {
      const now = Date.now()
      for (const quest of activeQuests) {
        this._renderActiveRow(quest, curY, panelW, now)
        curY += rowH
      }
    }
    curY += sectionGap

    // ── History section header ──
    const histLabel = this.scene.add.text(10, curY, 'HISTORY', {
      fontSize: scaledFontSize(7), fontFamily: 'system-ui, monospace', color: '#5a6a7a',
      resolution: 2,
    })
    this.container.add(histLabel)
    curY += 14

    // ── Completed quests section ──
    if (completedQuests.length === 0) {
      const empty = this.scene.add.text(panelW / 2, curY, 'No completed quests', {
        fontSize: scaledFontSize(7), fontFamily: 'system-ui, monospace', color: '#4a5464',
        resolution: 2,
      }).setOrigin(0.5, 0)
      this.container.add(empty)
      curY += rowH
    } else {
      for (const quest of completedQuests) {
        this._renderHistoryRow(quest, curY, panelW)
        curY += rowH
      }
    }
    curY += sectionGap

    // ── Stats footer ──
    const avgStr = stats.averageDifficulty > 0 ? stats.averageDifficulty.toFixed(1) : '0'
    const statsText = this.scene.add.text(panelW / 2, curY,
      `${stats.totalCompleted} done | avg ${avgStr} diff | x${stats.longestStreak} streak`, {
        fontSize: scaledFontSize(7), fontFamily: 'system-ui, monospace', color: '#5a6a7a',
        resolution: 2,
      }).setOrigin(0.5, 0)
    this.container.add(statsText)

    if (stats.xpEarnedToday > 0) {
      const todayText = this.scene.add.text(panelW / 2, curY + 10,
        `Today: +${stats.xpEarnedToday} XP`, {
          fontSize: scaledFontSize(6), fontFamily: 'system-ui, monospace', color: '#3b82f6',
          resolution: 2,
        }).setOrigin(0.5, 0)
      this.container.add(todayText)
    }
  }

  // -------------------------------------------------------------------------
  // Private — row renderers
  // -------------------------------------------------------------------------

  private _renderActiveRow(quest: Quest, y: number, panelW: number, now: number): void {
    if (!this.container) return

    // Difficulty star icon
    const starFrame = DIFFICULTY_STAR_FRAME[quest.difficulty] ?? ICON_FRAMES.STAR_GREY
    if (this.scene.textures.exists(SPRITESHEET_KEYS.GAME_ICONS)) {
      const star = this.scene.add.sprite(14, y + 6, SPRITESHEET_KEYS.GAME_ICONS, starFrame)
        .setScale(0.28).setOrigin(0.5)
      this.container.add(star)
    }

    // Agent ID (truncated)
    const agentLabel = quest.agentId.length > 12
      ? quest.agentId.slice(0, 12) + '..'
      : quest.agentId
    const nameText = this.scene.add.text(26, y, agentLabel, {
      fontSize: scaledFontSize(7), fontFamily: 'system-ui, monospace', color: '#c8d0e0',
      resolution: 2,
    })
    this.container.add(nameText)

    // Elapsed time
    const elapsedMs = now - quest.startedAt
    const elapsed = this._formatDuration(elapsedMs)
    const elapsedText = this.scene.add.text(panelW - 60, y, elapsed, {
      fontSize: scaledFontSize(7), fontFamily: 'system-ui, monospace', color: '#5a6a7a',
      resolution: 2,
    })
    this.container.add(elapsedText)

    // XP reward
    const diffColor = '#' + (QuestSystem.getDifficultyColor(quest.difficulty)).toString(16).padStart(6, '0')
    const xpText = this.scene.add.text(panelW - 10, y, `+${quest.xpReward}`, {
      fontSize: scaledFontSize(7), fontFamily: 'system-ui, monospace', color: diffColor,
      resolution: 2,
    }).setOrigin(1, 0)
    this.container.add(xpText)
  }

  private _renderHistoryRow(quest: Quest, y: number, panelW: number): void {
    if (!this.container) return

    // Status icon (check or X)
    const isCompleted = quest.status === 'completed'
    const iconFrame = isCompleted ? ICON_FRAMES.CHECKMARK : ICON_FRAMES.CIRCLE_GREY
    if (this.scene.textures.exists(SPRITESHEET_KEYS.GAME_ICONS)) {
      const icon = this.scene.add.sprite(14, y + 6, SPRITESHEET_KEYS.GAME_ICONS, iconFrame)
        .setScale(0.26).setOrigin(0.5)
      if (!isCompleted) icon.setTint(0xef4444)
      this.container.add(icon)
    }

    // Quest title (truncated)
    const titleLabel = quest.title.length > 18
      ? quest.title.slice(0, 18) + '..'
      : quest.title
    const color = isCompleted ? '#8a96a4' : '#6a4444'
    const titleText = this.scene.add.text(26, y, titleLabel, {
      fontSize: scaledFontSize(7), fontFamily: 'system-ui, monospace', color,
      resolution: 2,
    })
    this.container.add(titleText)

    // Duration
    if (quest.durationMs) {
      const dur = this._formatDuration(quest.durationMs)
      const durText = this.scene.add.text(panelW - 60, y, dur, {
        fontSize: scaledFontSize(6), fontFamily: 'system-ui, monospace', color: '#4a5464',
        resolution: 2,
      })
      this.container.add(durText)
    }

    // XP earned
    if (isCompleted) {
      const xpText = this.scene.add.text(panelW - 10, y, `+${quest.xpReward}`, {
        fontSize: scaledFontSize(7), fontFamily: 'system-ui, monospace', color: '#34d399',
        resolution: 2,
      }).setOrigin(1, 0)
      this.container.add(xpText)
    }
  }

  // -------------------------------------------------------------------------
  // Private — helpers
  // -------------------------------------------------------------------------

  private _formatDuration(ms: number): string {
    const totalSec = Math.floor(ms / 1000)
    const min = Math.floor(totalSec / 60)
    const sec = totalSec % 60
    return `${min}:${sec.toString().padStart(2, '0')}`
  }
}
