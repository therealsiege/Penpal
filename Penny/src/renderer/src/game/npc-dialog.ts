// ---------------------------------------------------------------------------
// npc-dialog.ts
// NPC dialog panel — shown when the player interacts with an agent (E key).
// Displays agent persona info (name, title, catchphrase) and current task
// status. Rendered at the bottom of the screen in screen-space.
//
// Usage:
//   const dialog = new NpcDialogPanel(scene)
//   dialog.init(viewWidth, viewHeight)
//   // Panel auto-listens to EventBus AGENT_INTERACT event.
//   // Close via ESC (handled by OfficeScene) or clicking outside.
// ---------------------------------------------------------------------------

import Phaser from 'phaser'
import type { AgentState } from '../types'
import { EventBus, EVENTS } from './events'
import { activeTheme } from './office-theme'
import { scaledFontSize, CHAR_COLS, POSE_IDLE } from './office-constants'
import { SPRITESHEET_KEYS } from './office-asset-keys'
import { getAgentCharacterIndex } from './office-helpers'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PANEL_H = 200
const AVATAR_AREA_W = 120
const CONTENT_PAD_X = 16
const DEPTH = 9500

// ---------------------------------------------------------------------------
// NpcDialogPanel
// ---------------------------------------------------------------------------

export class NpcDialogPanel {
  private scene: Phaser.Scene
  private container: Phaser.GameObjects.Container | null = null
  private viewWidth = 800
  private viewHeight = 600
  private _visible = false
  private _currentState: AgentState | null = null
  private _agentInteractHandler: (...args: unknown[]) => void
  private _clickOutsideHandler: ((p: Phaser.Input.Pointer) => void) | null = null

  constructor(scene: Phaser.Scene) {
    this.scene = scene

    this._agentInteractHandler = (agentId: unknown, agentState: unknown) => {
      // Toggle: if already showing same agent, hide; otherwise show new one.
      if (this._visible && this._currentState?.config.id === (agentState as AgentState)?.config?.id) {
        this.hide()
      } else {
        this.show(agentId as string, agentState as AgentState)
      }
    }
    EventBus.on(EVENTS.AGENT_INTERACT, this._agentInteractHandler)
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
      this.container.setPosition(0, h - PANEL_H)
    }
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  show(agentId: string, agentState: AgentState): void {
    void agentId
    this._currentState = agentState
    this._visible = true
    this._buildPanel()
  }

  hide(): void {
    if (!this._visible) return
    this._visible = false
    this._destroyPanel()
  }

  isVisible(): boolean {
    return this._visible
  }

  destroy(): void {
    EventBus.off(EVENTS.AGENT_INTERACT, this._agentInteractHandler)
    this._cleanupClickOutside()
    this.container?.destroy()
    this.container = null
    this._visible = false
  }

  // -------------------------------------------------------------------------
  // Private — build panel
  // -------------------------------------------------------------------------

  private _buildPanel(): void {
    // Tear down any existing panel before rebuilding
    if (this.container) {
      this.container.destroy()
      this.container = null
    }
    this._cleanupClickOutside()

    const panelW = this.viewWidth
    const state = this._currentState

    this.container = this.scene.add
      .container(0, this.viewHeight - PANEL_H)
      .setScrollFactor(0)
      .setDepth(DEPTH)
      .setAlpha(0)

    // ── Background ──
    const bg = this.scene.add.graphics()
    bg.fillStyle(activeTheme.bg, 0.93)
    bg.fillRect(0, 0, panelW, PANEL_H)
    // Top border line
    bg.lineStyle(1, activeTheme.panelStroke, 0.9)
    bg.lineBetween(0, 0, panelW, 0)
    this.container.add(bg)

    if (state) {
      // ── Avatar ──
      this._renderAvatar(state)

      // ── Vertical divider ──
      const divGfx = this.scene.add.graphics()
      divGfx.lineStyle(1, activeTheme.panelStroke, 0.5)
      divGfx.lineBetween(AVATAR_AREA_W, 14, AVATAR_AREA_W, PANEL_H - 14)
      this.container.add(divGfx)

      // ── Content ──
      this._renderContent(state, panelW)
    }

    // ── Close hint ──
    const hint = this.scene.add
      .text(panelW - 10, PANEL_H - 14, 'ESC to close', {
        fontSize: scaledFontSize(7),
        fontFamily: 'system-ui, monospace',
        color: '#3a4454',
        resolution: 2,
      })
      .setOrigin(1, 0)
    this.container.add(hint)

    // ── Fade in ──
    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      duration: 180,
      ease: 'Power2',
    })

    // ── Click outside (above panel) dismisses it ──
    this._clickOutsideHandler = (p: Phaser.Input.Pointer) => {
      if (!this._visible) return
      if (p.y < this.viewHeight - PANEL_H) this.hide()
    }
    this.scene.input.on('pointerdown', this._clickOutsideHandler)
  }

  private _renderAvatar(state: AgentState): void {
    if (!this.container) return
    const cx = AVATAR_AREA_W / 2
    const cy = PANEL_H / 2

    const charIdx = getAgentCharacterIndex(state)
    const frame = charIdx * CHAR_COLS + POSE_IDLE

    if (this.scene.textures.exists(SPRITESHEET_KEYS.CHARACTERS)) {
      // Scale to fill the avatar column nicely (CHAR_FRAME_H = 512 at 0.32 ≈ 164px)
      const avatarSprite = this.scene.add
        .sprite(cx, cy, SPRITESHEET_KEYS.CHARACTERS, frame)
        .setScale(0.32)
        .setOrigin(0.5)
      this.container.add(avatarSprite)
    } else {
      // Fallback: solid circle
      const fallback = this.scene.add.graphics()
      fallback.fillStyle(activeTheme.accent ?? 0x3b82f6, 0.7)
      fallback.fillCircle(cx, cy, 38)
      this.container.add(fallback)
    }
  }

  private _renderContent(state: AgentState, panelW: number): void {
    if (!this.container) return

    const x = AVATAR_AREA_W + CONTENT_PAD_X
    let curY = 20

    // ── Name ──
    const nameText = this.scene.add.text(x, curY, state.config.name, {
      fontSize: scaledFontSize(12),
      fontFamily: 'system-ui, sans-serif',
      color: '#e2e8f0',
      fontStyle: 'bold',
      resolution: 2,
    })
    this.container.add(nameText)
    curY += 22

    // ── Title ──
    if (state.config.title) {
      const titleText = this.scene.add.text(x, curY, state.config.title, {
        fontSize: scaledFontSize(9),
        fontFamily: 'system-ui, sans-serif',
        color: '#64748b',
        resolution: 2,
      })
      this.container.add(titleText)
      curY += 18
    }

    // ── Catchphrase ──
    const catchphrase = state.config.persona?.catchphrase
    if (catchphrase) {
      const catchText = this.scene.add.text(x, curY, `"${catchphrase}"`, {
        fontSize: scaledFontSize(9),
        fontFamily: 'Georgia, serif',
        color: '#fbbf24',
        fontStyle: 'italic',
        resolution: 2,
      })
      this.container.add(catchText)
      curY += 20
    }

    // ── Section divider ──
    curY += 4
    const hDiv = this.scene.add.graphics()
    hDiv.lineStyle(1, activeTheme.panelStroke, 0.4)
    const divEnd = Math.min(panelW - 20, x + 480)
    hDiv.lineBetween(x, curY, divEnd, curY)
    this.container.add(hDiv)
    curY += 10

    // ── Activity label ──
    const activityLabel = this.scene.add.text(x, curY, 'STATUS', {
      fontSize: scaledFontSize(7),
      fontFamily: 'system-ui, monospace',
      color: '#3a4454',
      resolution: 2,
    })
    this.container.add(activityLabel)
    curY += 14

    // ── Activity text ──
    const activityStr = this._buildActivityString(state)
    const maxWrap = Math.min(600, panelW - x - 20)
    const activityText = this.scene.add.text(x, curY, activityStr, {
      fontSize: scaledFontSize(8),
      fontFamily: 'system-ui, monospace',
      color: '#94a3b8',
      resolution: 2,
      wordWrap: { width: maxWrap, useAdvancedWrap: false },
    })
    this.container.add(activityText)
  }

  // -------------------------------------------------------------------------
  // Private — helpers
  // -------------------------------------------------------------------------

  private _buildActivityString(state: AgentState): string {
    if (!state.sessionMode || state.sessionMode === 'idle' || state.sessionMode === 'disconnected') {
      return 'Idle'
    }
    if (state.lastAssistantBlurb) {
      const blurb = state.lastAssistantBlurb.replace(/\n/g, ' ').trim()
      return `Working on: ${blurb.slice(0, 100)}${blurb.length > 100 ? '…' : ''}`
    }
    const modeLabel: Record<string, string> = {
      working:      'Working…',
      plan:         'Planning…',
      'accept-edits': 'Reviewing edits…',
      waiting:      'Waiting for input…',
      compressing:  'Compressing context…',
      error:        'Error state',
      crashed:      'Crashed',
    }
    return modeLabel[state.sessionMode] ?? state.sessionMode
  }

  private _destroyPanel(): void {
    this._cleanupClickOutside()
    if (!this.container) return
    const c = this.container
    this.scene.tweens.add({
      targets: c,
      alpha: 0,
      duration: 140,
      ease: 'Power2',
      onComplete: () => {
        c.destroy()
        if (this.container === c) this.container = null
      },
    })
  }

  private _cleanupClickOutside(): void {
    if (this._clickOutsideHandler) {
      this.scene.input.off('pointerdown', this._clickOutsideHandler)
      this._clickOutsideHandler = null
    }
  }
}
