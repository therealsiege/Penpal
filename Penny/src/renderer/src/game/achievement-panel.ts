// ---------------------------------------------------------------------------
// achievement-panel.ts — Achievement grid overlay (hotkey A). Locked rows are
// greyed; incremental tasks show a simple progress bar (ten_tasks, hundred_tasks).
// ---------------------------------------------------------------------------

import Phaser from 'phaser'
import { achievements } from './achievements'
import type { Achievement } from './achievements'
import { IMAGE_KEYS } from './office-asset-keys'
import { activeTheme } from './office-theme'

const SECTIONS: { title: string; ids: string[] }[] = [
  { title: 'Milestones', ids: ['first_agent', 'full_house', 'night_owl', 'early_bird'] },
  { title: 'Productivity', ids: ['first_task', 'ten_tasks', 'hundred_tasks', 'speed_demon', 'marathon'] },
  { title: 'Social & fun', ids: ['coffee_break', 'blocked_resolved', 'rank_up', 'team_player'] },
]

export class AchievementPanel {
  private scene: Phaser.Scene
  private container: Phaser.GameObjects.Container | null = null
  private viewWidth = 800
  private viewHeight = 600
  isVisible = false

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  init(viewWidth: number, viewHeight: number): void {
    this.viewWidth = viewWidth
    this.viewHeight = viewHeight
  }

  setViewSize(w: number, h: number): void {
    this.viewWidth = w
    this.viewHeight = h
    if (this.container && this.isVisible) {
      this.container.setPosition(w / 2, h / 2)
    }
  }

  toggle(): void {
    this.isVisible = !this.isVisible
    if (this.isVisible) this._show()
    else this._hide()
  }

  /** Idempotent hide (e.g. ESC). */
  hide(): void {
    if (!this.isVisible) return
    this.isVisible = false
    this._hide()
  }

  update(): void {
    if (!this.isVisible || !this.container) return
    this._rebuildContent()
  }

  destroy(): void {
    this.container?.destroy()
    this.container = null
    this.isVisible = false
  }

  private _byId(): Map<string, Achievement> {
    const m = new Map<string, Achievement>()
    for (const a of achievements.getAll()) m.set(a.id, a)
    return m
  }

  private _progressLine(id: string): string | null {
    if (id === 'ten_tasks') {
      const n = achievements.getSessionTasks()
      return `${Math.min(n, 10)}/10 session tasks`
    }
    if (id === 'hundred_tasks') {
      const n = achievements.getTotalTasks()
      return `${Math.min(n, 100)}/100 lifetime tasks`
    }
    return null
  }

  private _progressRatio(id: string): number {
    if (id === 'ten_tasks') return Math.min(1, achievements.getSessionTasks() / 10)
    if (id === 'hundred_tasks') return Math.min(1, achievements.getTotalTasks() / 100)
    return 0
  }

  private _show(): void {
    if (this.container) this.container.destroy()
    this.container = this.scene.add.container(this.viewWidth / 2, this.viewHeight / 2)
      .setScrollFactor(0)
      .setDepth(10_000)
      .setAlpha(0)

    this._rebuildContent()

    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      duration: 160,
      ease: 'Power2',
    })
  }

  private _hide(): void {
    if (!this.container) return
    const c = this.container
    this.scene.tweens.add({
      targets: c,
      alpha: 0,
      duration: 120,
      ease: 'Power2',
      onComplete: () => {
        c.destroy()
        if (this.container === c) this.container = null
      },
    })
  }

  private _rebuildContent(): void {
    if (!this.container) return
    this.container.removeAll(true)

    const byId = this._byId()
    const panelW = Math.min(440, this.viewWidth - 32)
    const barH = 6
    const sectionGap = 8

    const measureH = (): number => {
      let h = 52
      for (const sec of SECTIONS) {
        h += 18
        for (const id of sec.ids) {
          if (!byId.has(id)) continue
          h += 20 + 12
          if (id === 'ten_tasks' || id === 'hundred_tasks') h += barH + 12
        }
        h += sectionGap
      }
      return h + 28
    }

    const panelH = measureH()
    const halfW = panelW / 2
    const halfH = panelH / 2

    const bg = this.scene.add.graphics()
    bg.fillStyle(activeTheme.bg, 0.94)
    bg.fillRoundedRect(-halfW, -halfH, panelW, panelH, 10)
    bg.lineStyle(2, 0xfbbf24, 0.55)
    bg.strokeRoundedRect(-halfW, -halfH, panelW, panelH, 10)
    this.container.add(bg)

    const title = this.scene.add.text(0, -halfH + 18, 'ACHIEVEMENTS', {
      fontSize: '13px',
      fontFamily: 'system-ui, monospace',
      color: '#fbbf24',
      resolution: 2,
    }).setOrigin(0.5, 0.5)
    this.container.add(title)

    if (this.scene.textures.exists(IMAGE_KEYS.DIVIDER)) {
      const div = this.scene.add.image(0, -halfH + 36, IMAGE_KEYS.DIVIDER)
        .setDisplaySize(panelW - 32, 4)
        .setAlpha(0.45)
      this.container.add(div)
    }

    let y = -halfH + 52
    const left = -halfW + 16
    const prog = achievements.getProgress()

    for (const sec of SECTIONS) {
      const secTitle = this.scene.add.text(left, y, sec.title.toUpperCase(), {
        fontSize: '9px',
        fontFamily: 'system-ui, monospace',
        color: '#94a3b8',
        resolution: 2,
      }).setOrigin(0, 0.5)
      this.container.add(secTitle)
      y += 18

      for (const id of sec.ids) {
        const a = byId.get(id)
        if (!a) continue
        const unlocked = a.unlocked
        const alpha = unlocked ? 1 : 0.4
        const nameColor = unlocked ? activeTheme.tooltipText : '#64748b'

        const row = this.scene.add.text(left, y, `${a.icon}  ${a.title}`, {
          fontSize: '11px',
          fontFamily: 'system-ui, monospace',
          color: nameColor,
          resolution: 2,
        }).setOrigin(0, 0.5).setAlpha(alpha)
        this.container.add(row)

        const mark = this.scene.add.text(halfW - 16, y, unlocked ? '✓' : '—', {
          fontSize: '10px',
          fontFamily: 'system-ui, monospace',
          color: unlocked ? '#22c55e' : '#475569',
          resolution: 2,
        }).setOrigin(1, 0.5).setAlpha(unlocked ? 1 : 0.5)
        this.container.add(mark)
        y += 14

        const sub = this.scene.add.text(left, y, a.description, {
          fontSize: '9px',
          fontFamily: 'system-ui, monospace',
          color: '#64748b',
          resolution: 2,
        }).setOrigin(0, 0.5).setAlpha(0.9 * alpha)
        this.container.add(sub)
        y += 16

        const pl = this._progressLine(id)
        if (pl) {
          const ratio = this._progressRatio(id)
          const barW = panelW - 32
          const track = this.scene.add.graphics()
          track.fillStyle(0x334155, 0.9)
          track.fillRoundedRect(left, y - barH / 2, barW, barH, 3)
          const fill = this.scene.add.graphics()
          fill.fillStyle(unlocked ? 0x22c55e : 0x3b82f6, 0.85)
          fill.fillRoundedRect(left, y - barH / 2, Math.max(2, barW * ratio), barH, 3)
          this.container.add(track)
          this.container.add(fill)
          const pt = this.scene.add.text(left + barW / 2, y + 12, pl, {
            fontSize: '8px',
            fontFamily: 'system-ui, monospace',
            color: '#94a3b8',
            resolution: 2,
          }).setOrigin(0.5, 0.5)
          this.container.add(pt)
          y += barH + 14
        }
      }
      y += sectionGap
    }

    const foot = this.scene.add.text(
      0,
      halfH - 14,
      `${prog.unlocked}/${prog.total} unlocked   ·   A close   ·   Esc`,
      {
        fontSize: '9px',
        fontFamily: 'system-ui, monospace',
        color: '#64748b',
        resolution: 2,
      },
    ).setOrigin(0.5, 0.5)
    this.container.add(foot)
  }
}
