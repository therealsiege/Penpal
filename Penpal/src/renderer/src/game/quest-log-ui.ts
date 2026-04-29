// ---------------------------------------------------------------------------
// quest-log-ui.ts
// Quest Log overlay panel — shows active pod workflow quests and completed
// quests. Toggled with the J key or Escape. Anchored to the right side of
// the screen (350px wide, full viewport height). Follows the SeasonHUD /
// QuestPanel screen-space overlay pattern.
// ---------------------------------------------------------------------------

import Phaser from 'phaser'
import { EventBus, EVENTS } from './events'
import { activeTheme } from './office-theme'
import { scaledFontSize } from './office-constants'

// ---------------------------------------------------------------------------
// QuestState — pod workflow representation
// ---------------------------------------------------------------------------

export type QuestPhase = 'planning' | 'executing' | 'validating' | 'done' | 'failed'

export interface QuestState {
  id: string
  /** Issue title or quest name */
  title: string
  /** Persona name of the assigned agent */
  agent: string
  phase: QuestPhase
  /** ms since epoch when the quest started */
  startedAt: number
}

// ---------------------------------------------------------------------------
// Phase display config
// ---------------------------------------------------------------------------

const PHASE_CONFIG: Record<QuestPhase, { label: string; color: number; hex: string }> = {
  planning:   { label: 'Planning',   color: 0xf59e0b, hex: '#f59e0b' },
  executing:  { label: 'Executing',  color: 0x3b82f6, hex: '#3b82f6' },
  validating: { label: 'Validating', color: 0x8b5cf6, hex: '#8b5cf6' },
  done:       { label: 'Done',       color: 0x34d399, hex: '#34d399' },
  failed:     { label: 'Failed',     color: 0xef4444, hex: '#ef4444' },
}

const PANEL_WIDTH = 350
const ROW_H = 52
const HEADER_H = 48
const SECTION_LABEL_H = 24
const PADDING = 12
const DOT_RADIUS = 5

// ---------------------------------------------------------------------------
// QuestLogUI
// ---------------------------------------------------------------------------

export class QuestLogUI {
  private scene: Phaser.Scene
  private container: Phaser.GameObjects.Container | null = null
  private _visible = false
  private viewWidth = 800
  private viewHeight = 600

  /** All quests currently tracked — replaced on each update() call */
  private _quests: QuestState[] = []

  /** Auto-synthesized entries from EventBus quest events (fallback when no pod data arrives) */
  private _synthesized = new Map<string, QuestState>()

  // EventBus listener refs kept for cleanup
  private _onQuestStarted: (...args: unknown[]) => void
  private _onQuestCompleted: (...args: unknown[]) => void
  private _onQuestFailed: (...args: unknown[]) => void

  constructor(scene: Phaser.Scene) {
    this.scene = scene

    // -----------------------------------------------------------------------
    // EventBus listeners — auto-populate from quest-system events
    // -----------------------------------------------------------------------

    this._onQuestStarted = (questId: unknown, agentId: unknown) => {
      const id = String(questId)
      if (!this._synthesized.has(id)) {
        this._synthesized.set(id, {
          id,
          title: `Quest ${id.slice(-6)}`,
          agent: String(agentId),
          phase: 'executing',
          startedAt: Date.now(),
        })
        if (this._visible) this._rebuildContent()
      }
    }

    this._onQuestCompleted = (questId: unknown) => {
      const id = String(questId)
      const existing = this._synthesized.get(id)
      if (existing) {
        this._synthesized.set(id, { ...existing, phase: 'done' })
        if (this._visible) this._rebuildContent()
      }
    }

    this._onQuestFailed = (questId: unknown) => {
      const id = String(questId)
      const existing = this._synthesized.get(id)
      if (existing) {
        this._synthesized.set(id, { ...existing, phase: 'failed' })
        if (this._visible) this._rebuildContent()
      }
    }

    EventBus.on(EVENTS.QUEST_STARTED, this._onQuestStarted)
    EventBus.on(EVENTS.QUEST_COMPLETED, this._onQuestCompleted)
    EventBus.on(EVENTS.QUEST_FAILED, this._onQuestFailed)
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
    if (this.container && this._visible) {
      this.container.setPosition(w - PANEL_WIDTH, 0)
    }
  }

  // -------------------------------------------------------------------------
  // Toggle
  // -------------------------------------------------------------------------

  toggle(): void {
    this._visible = !this._visible
    if (this._visible) {
      this._show()
    } else {
      this._hide()
    }
  }

  hide(): void {
    if (!this._visible) return
    this._visible = false
    this._hide()
  }

  // -------------------------------------------------------------------------
  // Public data feed — called by OfficeScene with pod workflow data
  // -------------------------------------------------------------------------

  /**
   * Refresh the quest log with new pod workflow data.
   * Pass an empty array to just redraw elapsed times without replacing quest data.
   */
  update(quests: QuestState[]): void {
    if (quests.length > 0) this._quests = quests
    if (this._visible) this._rebuildContent()
  }

  // -------------------------------------------------------------------------
  // Visibility accessor
  // -------------------------------------------------------------------------

  isVisible(): boolean {
    return this._visible
  }

  // -------------------------------------------------------------------------
  // Cleanup
  // -------------------------------------------------------------------------

  destroy(): void {
    EventBus.off(EVENTS.QUEST_STARTED, this._onQuestStarted)
    EventBus.off(EVENTS.QUEST_COMPLETED, this._onQuestCompleted)
    EventBus.off(EVENTS.QUEST_FAILED, this._onQuestFailed)
    this.container?.destroy()
    this.container = null
    this._visible = false
  }

  // -------------------------------------------------------------------------
  // Private — show / hide
  // -------------------------------------------------------------------------

  private _show(): void {
    if (this.container) this.container.destroy()

    this.container = this.scene.add
      .container(this.viewWidth - PANEL_WIDTH, 0)
      .setScrollFactor(0)
      .setDepth(9600)
      .setAlpha(0)

    this._rebuildContent()

    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      duration: 180,
      ease: 'Power2',
    })
  }

  private _hide(): void {
    if (!this.container) return
    const target = this.container
    this.scene.tweens.add({
      targets: target,
      alpha: 0,
      duration: 140,
      ease: 'Power2',
      onComplete: () => {
        target.destroy()
        if (this.container === target) this.container = null
      },
    })
  }

  // -------------------------------------------------------------------------
  // Private — rebuild panel content
  // -------------------------------------------------------------------------

  private _rebuildContent(): void {
    if (!this.container) return
    this.container.removeAll(true)

    const h = this.viewHeight

    // ── Background panel ──
    const bg = this.scene.add.graphics()
    bg.fillStyle(activeTheme.bg, 0.94)
    bg.fillRect(0, 0, PANEL_WIDTH, h)
    bg.lineStyle(1, activeTheme.panelStroke, 0.7)
    bg.lineBetween(0, 0, 0, h)
    this.container.add(bg)

    // Merge external quests + synthesized fallback entries
    const merged = this._mergedQuests()
    const active = merged.filter(q => q.phase !== 'done' && q.phase !== 'failed')
    const completed = merged.filter(q => q.phase === 'done' || q.phase === 'failed')

    let curY = PADDING

    // ── Header ──
    const totalCount = active.length + completed.length
    const headerText = this.scene.add.text(PADDING, curY, 'QUEST LOG', {
      fontSize: scaledFontSize(11),
      fontFamily: 'system-ui, monospace',
      color: '#fbbf24',
      resolution: 2,
    })
    this.container.add(headerText)

    const countText = this.scene.add.text(PANEL_WIDTH - PADDING, curY, `${totalCount}`, {
      fontSize: scaledFontSize(11),
      fontFamily: 'system-ui, monospace',
      color: '#5a6a7a',
      resolution: 2,
    }).setOrigin(1, 0)
    this.container.add(countText)
    curY += HEADER_H

    // Divider
    const divGfx = this.scene.add.graphics()
    divGfx.lineStyle(1, activeTheme.panelStroke, 0.5)
    divGfx.lineBetween(PADDING, curY - 6, PANEL_WIDTH - PADDING, curY - 6)
    this.container.add(divGfx)

    // ── Active section ──
    const activeLbl = this.scene.add.text(PADDING, curY, `ACTIVE  ${active.length}`, {
      fontSize: scaledFontSize(7),
      fontFamily: 'system-ui, monospace',
      color: '#8a96a4',
      resolution: 2,
    })
    this.container.add(activeLbl)
    curY += SECTION_LABEL_H

    if (active.length === 0) {
      const empty = this.scene.add.text(PANEL_WIDTH / 2, curY, 'No active quests', {
        fontSize: scaledFontSize(8),
        fontFamily: 'system-ui, monospace',
        color: '#4a5464',
        resolution: 2,
      }).setOrigin(0.5, 0)
      this.container.add(empty)
      curY += ROW_H
    } else {
      for (const quest of active) {
        this._renderRow(quest, curY)
        curY += ROW_H
      }
    }

    curY += 8

    // Divider
    const div2 = this.scene.add.graphics()
    div2.lineStyle(1, activeTheme.panelStroke, 0.4)
    div2.lineBetween(PADDING, curY, PANEL_WIDTH - PADDING, curY)
    this.container.add(div2)
    curY += 8

    // ── Completed section ──
    const compLbl = this.scene.add.text(PADDING, curY, `COMPLETED  ${completed.length}`, {
      fontSize: scaledFontSize(7),
      fontFamily: 'system-ui, monospace',
      color: '#8a96a4',
      resolution: 2,
    })
    this.container.add(compLbl)
    curY += SECTION_LABEL_H

    if (completed.length === 0) {
      const empty2 = this.scene.add.text(PANEL_WIDTH / 2, curY, 'None yet', {
        fontSize: scaledFontSize(8),
        fontFamily: 'system-ui, monospace',
        color: '#4a5464',
        resolution: 2,
      }).setOrigin(0.5, 0)
      this.container.add(empty2)
    } else {
      for (const quest of completed.slice(0, 8)) {
        this._renderRow(quest, curY)
        curY += ROW_H
        if (curY + ROW_H > h - PADDING) break
      }
    }

    // ── Footer hint ──
    const hint = this.scene.add.text(PANEL_WIDTH / 2, h - PADDING - 14, 'J or Esc to close', {
      fontSize: scaledFontSize(6),
      fontFamily: 'system-ui, monospace',
      color: '#3a4454',
      resolution: 2,
    }).setOrigin(0.5, 1)
    this.container.add(hint)
  }

  // -------------------------------------------------------------------------
  // Private — single quest row
  // -------------------------------------------------------------------------

  private _renderRow(quest: QuestState, y: number): void {
    if (!this.container) return

    const cfg = PHASE_CONFIG[quest.phase]

    // Status dot
    const dot = this.scene.add.graphics()
    dot.fillStyle(cfg.color, 1)
    dot.fillCircle(PADDING + DOT_RADIUS, y + ROW_H / 2, DOT_RADIUS)
    this.container.add(dot)

    const textX = PADDING + DOT_RADIUS * 2 + 8

    // Quest title (truncated to fit panel)
    const maxTitleChars = 26
    const titleStr = quest.title.length > maxTitleChars
      ? quest.title.slice(0, maxTitleChars) + '..'
      : quest.title
    const titleObj = this.scene.add.text(textX, y + 6, titleStr, {
      fontSize: scaledFontSize(8),
      fontFamily: 'system-ui, monospace',
      color: quest.phase === 'failed' ? '#7a4444' : '#c8d0e0',
      resolution: 2,
    })
    this.container.add(titleObj)

    // Agent name
    const agentStr = quest.agent.length > 20
      ? quest.agent.slice(0, 20) + '..'
      : quest.agent
    const agentObj = this.scene.add.text(textX, y + 22, agentStr, {
      fontSize: scaledFontSize(7),
      fontFamily: 'system-ui, monospace',
      color: '#5a6a7a',
      resolution: 2,
    })
    this.container.add(agentObj)

    // Phase label (right-aligned)
    const phaseObj = this.scene.add.text(PANEL_WIDTH - PADDING, y + 8, cfg.label, {
      fontSize: scaledFontSize(7),
      fontFamily: 'system-ui, monospace',
      color: cfg.hex,
      resolution: 2,
    }).setOrigin(1, 0)
    this.container.add(phaseObj)

    // Elapsed time (right-aligned, below phase label)
    const elapsed = this._formatElapsed(Date.now() - quest.startedAt)
    const elapsedObj = this.scene.add.text(PANEL_WIDTH - PADDING, y + 22, elapsed, {
      fontSize: scaledFontSize(7),
      fontFamily: 'system-ui, monospace',
      color: '#4a5464',
      resolution: 2,
    }).setOrigin(1, 0)
    this.container.add(elapsedObj)

    // Row separator
    const sep = this.scene.add.graphics()
    sep.lineStyle(1, activeTheme.panelStroke, 0.25)
    sep.lineBetween(PADDING, y + ROW_H - 1, PANEL_WIDTH - PADDING, y + ROW_H - 1)
    this.container.add(sep)
  }

  // -------------------------------------------------------------------------
  // Private — merge external + synthesized quest lists
  // -------------------------------------------------------------------------

  private _mergedQuests(): QuestState[] {
    // External quests (from update() calls) take priority by id
    const byId = new Map<string, QuestState>()
    for (const q of this._quests) byId.set(q.id, q)
    // Fill in synthesized entries that aren't overridden by external data
    for (const [id, q] of this._synthesized) {
      if (!byId.has(id)) byId.set(id, q)
    }
    return Array.from(byId.values()).sort((a, b) => b.startedAt - a.startedAt)
  }

  // -------------------------------------------------------------------------
  // Private — format elapsed duration
  // -------------------------------------------------------------------------

  private _formatElapsed(ms: number): string {
    const totalSec = Math.floor(ms / 1000)
    const min = Math.floor(totalSec / 60)
    const sec = totalSec % 60
    return `${min}:${sec.toString().padStart(2, '0')}`
  }
}
