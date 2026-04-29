// ---------------------------------------------------------------------------
// bestiary-panel.ts
// Full-screen bestiary card overlay for an agent. Displays realm, stat bars,
// weapon, powers, signature move, and lore.
//
// Key binding: OfficeScene registers 'keydown-B' and calls toggle(agentConfig).
// BestiaryPanel itself is stateless with respect to keyboard input.
//
// Usage (in OfficeScene):
//   this.bestiaryPanel = new BestiaryPanel(this)
//   // In keyboard setup block:
//   this.input.keyboard.on('keydown-B', (e: KeyboardEvent) => {
//     if (shouldIgnoreKeyboardShortcuts(e)) return
//     e.preventDefault()
//     const agent = this.getSelectedAgentConfig()
//     if (agent) this.bestiaryPanel.toggle(agent)
//   })
// ---------------------------------------------------------------------------

import Phaser from 'phaser'
import type { AgentConfig, AgentBestiary, AgentStats } from '../types'
import { activeTheme } from './office-theme'
import { scaledFontSize } from './office-constants'

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

const PANEL_W   = 380
const PANEL_H   = 520
const PANEL_R   = 12   // corner radius
const PX        = 20   // horizontal padding inside panel
const ROW_H     = 18   // standard row height
const BAR_H     = 5    // stat bar height
const DEPTH     = 9999

const STAT_LABELS: Array<[keyof AgentStats, string, string]> = [
  ['speed',      'SPD', '#60a5fa'],
  ['precision',  'PRE', '#f472b6'],
  ['creativity', 'CRE', '#fb923c'],
  ['depth',      'DEP', '#a78bfa'],
  ['teamwork',   'TMW', '#34d399'],
]

// ---------------------------------------------------------------------------
// BestiaryPanel
// ---------------------------------------------------------------------------

export class BestiaryPanel {
  private scene: Phaser.Scene
  private container: Phaser.GameObjects.Container | null = null
  private isVisible = false

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  show(agentConfig: AgentConfig): void {
    this.hide()

    const bestiary = agentConfig.bestiary
    if (!bestiary) return

    const { width, height } = this.scene.scale
    const cx = width / 2
    const cy = height / 2

    const container = this.scene.add.container(0, 0)
    container.setDepth(DEPTH)
    container.setScrollFactor(0)

    // Backdrop — full-viewport dim
    const backdrop = this.scene.add
      .rectangle(cx, cy, width, height, 0x000000, 0.72)
      .setScrollFactor(0)
    container.add(backdrop)

    // Panel background
    const panelX = cx - PANEL_W / 2
    const panelY = cy - PANEL_H / 2

    const primaryHex   = bestiary.colors?.primary ?? '#60a5fa'
    const primaryInt   = parseInt(primaryHex.replace('#', ''), 16)

    const panelGfx = this.scene.add.graphics()
    panelGfx.setScrollFactor(0)
    // Shadow layer
    panelGfx.fillStyle(0x000000, 0.4)
    panelGfx.fillRoundedRect(panelX + 4, panelY + 4, PANEL_W, PANEL_H, PANEL_R)
    // Main background
    panelGfx.fillStyle(activeTheme.panelBg, 1)
    panelGfx.fillRoundedRect(panelX, panelY, PANEL_W, PANEL_H, PANEL_R)
    // Color-themed border using agent's colors.primary
    panelGfx.lineStyle(2, primaryInt, 0.85)
    panelGfx.strokeRoundedRect(panelX, panelY, PANEL_W, PANEL_H, PANEL_R)
    container.add(panelGfx)

    let ty = panelY + 18

    // ── Header: name + realm ────────────────────────────────────────────────

    // Agent name
    container.add(
      this.scene.add
        .text(cx, ty, agentConfig.name, {
          fontSize: scaledFontSize(14),
          fontStyle: 'bold',
          color: primaryHex,
          fontFamily: 'system-ui, monospace',
          resolution: 2,
        })
        .setOrigin(0.5, 0)
        .setScrollFactor(0)
    )
    ty += 20

    // Title + realm on one row
    const titleLine = [agentConfig.title, bestiary.realm].filter(Boolean).join('  ·  ')
    container.add(
      this.scene.add
        .text(cx, ty, titleLine, {
          fontSize: scaledFontSize(9),
          color: activeTheme.subtleText,
          fontFamily: 'system-ui, monospace',
          fontStyle: 'italic',
          resolution: 2,
        })
        .setOrigin(0.5, 0)
        .setScrollFactor(0)
    )
    ty += 16

    // Titles badge row (first 2)
    if (bestiary.titles && bestiary.titles.length > 0) {
      const shown = bestiary.titles.slice(0, 2).join('  ·  ')
      container.add(
        this.scene.add
          .text(cx, ty, shown, {
            fontSize: scaledFontSize(8),
            color: primaryHex,
            fontFamily: 'system-ui, monospace',
            resolution: 2,
          })
          .setOrigin(0.5, 0)
          .setScrollFactor(0)
      )
      ty += 14
    }

    ty += 4
    container.add(this._divider(panelX + PX, ty, PANEL_W - PX * 2))
    ty += 8

    // ── Stat bars ───────────────────────────────────────────────────────────

    const stats = bestiary.stats
    const labelX = panelX + PX
    const barX   = labelX + 30
    const barW   = PANEL_W - PX * 2 - 30 - 22  // room for value number on right
    const valX   = panelX + PANEL_W - PX

    for (const [key, label, colorHex] of STAT_LABELS) {
      const val      = (stats[key] as number) ?? 0
      const colorInt = parseInt(colorHex.replace('#', ''), 16)
      const barYOff  = ROW_H / 2 - BAR_H / 2

      // Stat label
      container.add(
        this.scene.add
          .text(labelX, ty + 1, label, {
            fontSize: scaledFontSize(7),
            color: '#5a6a7a',
            fontFamily: 'system-ui, monospace',
            fontStyle: 'bold',
            resolution: 2,
          })
          .setScrollFactor(0)
      )

      // Track background
      const trackGfx = this.scene.add.graphics()
      trackGfx.setScrollFactor(0)
      trackGfx.fillStyle(activeTheme.panelStroke ?? 0x1e293b, 0.5)
      trackGfx.fillRoundedRect(barX, ty + barYOff, barW, BAR_H, 2)
      container.add(trackGfx)

      // Fill
      const fillW = Math.max(4, Math.round(barW * val / 10))
      const fillGfx = this.scene.add.graphics()
      fillGfx.setScrollFactor(0)
      fillGfx.fillStyle(colorInt, 0.85)
      fillGfx.fillRoundedRect(barX, ty + barYOff, fillW, BAR_H, 2)
      container.add(fillGfx)

      // Value number
      container.add(
        this.scene.add
          .text(valX, ty + 1, String(val), {
            fontSize: scaledFontSize(7),
            color: colorHex,
            fontFamily: 'system-ui, monospace',
            fontStyle: 'bold',
            resolution: 2,
          })
          .setOrigin(1, 0)
          .setScrollFactor(0)
      )

      ty += ROW_H
    }

    ty += 4
    container.add(this._divider(panelX + PX, ty, PANEL_W - PX * 2))
    ty += 8

    // ── Weapon ──────────────────────────────────────────────────────────────

    if (bestiary.weapon) {
      container.add(
        this.scene.add
          .text(labelX, ty, `Weapon: ${bestiary.weapon.name}`, {
            fontSize: scaledFontSize(9),
            fontStyle: 'bold',
            color: activeTheme.tooltipText ?? '#e2e8f0',
            fontFamily: 'system-ui, sans-serif',
            resolution: 2,
          })
          .setScrollFactor(0)
      )
      ty += 14
      container.add(
        this.scene.add
          .text(labelX, ty, bestiary.weapon.coding_analog, {
            fontSize: scaledFontSize(8),
            color: activeTheme.subtleText,
            fontFamily: 'system-ui, monospace',
            fontStyle: 'italic',
            wordWrap: { width: PANEL_W - PX * 2 },
            resolution: 2,
          })
          .setScrollFactor(0)
      )
      ty += 16
    }

    // ── Powers (first 3) ────────────────────────────────────────────────────

    const powers = (bestiary.powers ?? []).slice(0, 3)
    if (powers.length > 0) {
      container.add(
        this.scene.add
          .text(labelX, ty, 'Powers', {
            fontSize: scaledFontSize(8),
            fontStyle: 'bold',
            color: activeTheme.accentText ?? '#00e5ff',
            fontFamily: 'system-ui, monospace',
            resolution: 2,
          })
          .setScrollFactor(0)
      )
      ty += 14

      for (const power of powers) {
        container.add(
          this.scene.add
            .text(labelX, ty, `• ${power.name}`, {
              fontSize: scaledFontSize(8),
              fontStyle: 'bold',
              color: activeTheme.tooltipText ?? '#e2e8f0',
              fontFamily: 'system-ui, sans-serif',
              resolution: 2,
            })
            .setScrollFactor(0)
        )
        ty += 12
        container.add(
          this.scene.add
            .text(labelX + 8, ty, power.coding_analog, {
              fontSize: scaledFontSize(7),
              color: activeTheme.subtleText,
              fontFamily: 'system-ui, monospace',
              fontStyle: 'italic',
              wordWrap: { width: PANEL_W - PX * 2 - 8 },
              resolution: 2,
            })
            .setScrollFactor(0)
        )
        ty += 13
      }
    }

    // ── Signature move ──────────────────────────────────────────────────────

    if (bestiary.signature_move) {
      ty += 2
      container.add(this._divider(panelX + PX, ty, PANEL_W - PX * 2))
      ty += 7

      container.add(
        this.scene.add
          .text(labelX, ty, `\u26A1 ${bestiary.signature_move.name}`, {
            fontSize: scaledFontSize(9),
            fontStyle: 'bold italic',
            color: primaryHex,
            fontFamily: 'system-ui, sans-serif',
            resolution: 2,
          })
          .setScrollFactor(0)
      )
      ty += 15

      container.add(
        this.scene.add
          .text(labelX, ty, bestiary.signature_move.description, {
            fontSize: scaledFontSize(8),
            color: activeTheme.subtleText,
            fontFamily: 'system-ui, sans-serif',
            fontStyle: 'italic',
            wordWrap: { width: PANEL_W - PX * 2 },
            resolution: 2,
          })
          .setScrollFactor(0)
      )
      ty += 16
    }

    // ── Rival / ally ────────────────────────────────────────────────────────

    const hasRival = bestiary.rival != null
    const hasAlly  = bestiary.ally  != null

    if (hasRival || hasAlly) {
      ty += 2
      container.add(this._divider(panelX + PX, ty, PANEL_W - PX * 2))
      ty += 7

      if (hasRival) {
        container.add(
          this.scene.add
            .text(labelX, ty, `Rival: ${bestiary.rival}`, {
              fontSize: scaledFontSize(8),
              color: '#f87171',
              fontFamily: 'system-ui, monospace',
              resolution: 2,
            })
            .setScrollFactor(0)
        )
        ty += 13
      }

      if (hasAlly) {
        container.add(
          this.scene.add
            .text(labelX, ty, `Ally: ${bestiary.ally}`, {
              fontSize: scaledFontSize(8),
              color: '#34d399',
              fontFamily: 'system-ui, monospace',
              resolution: 2,
            })
            .setScrollFactor(0)
        )
        ty += 13
      }
    }

    // ── Lore paragraph ──────────────────────────────────────────────────────

    const loreMaxY = panelY + PANEL_H - 32
    if (ty < loreMaxY && bestiary.lore) {
      ty += 2
      container.add(this._divider(panelX + PX, ty, PANEL_W - PX * 2))
      ty += 7

      container.add(
        this.scene.add
          .text(labelX, ty, bestiary.lore, {
            fontSize: scaledFontSize(8),
            color: activeTheme.subtleText,
            fontFamily: 'system-ui, sans-serif',
            fontStyle: 'italic',
            wordWrap: { width: PANEL_W - PX * 2 },
            resolution: 2,
          })
          .setScrollFactor(0)
      )
    }

    // ── Dismiss hint ────────────────────────────────────────────────────────

    container.add(
      this.scene.add
        .text(cx, panelY + PANEL_H - 14, 'Press B to close', {
          fontSize: scaledFontSize(7),
          color: '#3a4858',
          fontFamily: 'system-ui, monospace',
          resolution: 2,
        })
        .setOrigin(0.5, 0)
        .setScrollFactor(0)
    )

    // Fade in
    container.setAlpha(0)
    this.scene.tweens.add({
      targets: container,
      alpha: 1,
      duration: 180,
      ease: 'Quad.easeOut',
    })

    this.container   = container
    this.isVisible   = true
  }

  hide(): void {
    if (!this.container) return
    const c = this.container
    this.container  = null
    this.isVisible  = false
    this.scene.tweens.add({
      targets: c,
      alpha: 0,
      duration: 120,
      ease: 'Quad.easeIn',
      onComplete: () => c.destroy(),
    })
  }

  toggle(agentConfig: AgentConfig): void {
    if (this.isVisible) {
      this.hide()
    } else {
      this.show(agentConfig)
    }
  }

  /** No-op — panel is static, no per-frame updates needed. */
  update(): void { /* intentionally empty */ }

  destroy(): void {
    this.container?.destroy()
    this.container = null
    this.isVisible = false
  }

  get visible(): boolean {
    return this.isVisible
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private _divider(x: number, y: number, width: number): Phaser.GameObjects.Graphics {
    const g = this.scene.add.graphics()
    g.setScrollFactor(0)
    g.lineStyle(1, activeTheme.panelStroke, 0.5)
    g.lineBetween(x, y, x + width, y)
    return g
  }
}
