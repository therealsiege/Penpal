// ---------------------------------------------------------------------------
// season-hud.ts
// Season HUD overlay — displays season name, progress bar, challenge
// checklist, credits counter, and active quest count in the game scene.
// ---------------------------------------------------------------------------

import Phaser from 'phaser'
import { questSystem } from './quest-system'
import { creditManager, type CosmeticItem } from './credits'
import { leaderboardManager } from './leaderboard'
import { seasonManager, type SeasonChallenge } from './seasons'
import { SPRITESHEET_KEYS, ICON_FRAMES, IMAGE_KEYS, MEDAL_HD_FRAMES } from './office-asset-keys'
import { activeTheme } from './office-theme'

// ---------------------------------------------------------------------------
// SeasonHUD
// ---------------------------------------------------------------------------

export class SeasonHUD {
  private scene: Phaser.Scene

  // Main HUD strip (top-right, screen-space)
  private hudContainer: Phaser.GameObjects.Container | null = null
  private seasonNameText: Phaser.GameObjects.Text | null = null
  private creditsText: Phaser.GameObjects.Text | null = null
  private questCountText: Phaser.GameObjects.Text | null = null
  private progressBar: Phaser.GameObjects.Graphics | null = null
  private progressTrack: Phaser.GameObjects.Image | null = null
  private progressFill: Phaser.GameObjects.Image | null = null
  private progressText: Phaser.GameObjects.Text | null = null

  // Leaderboard overlay (toggle with L key)
  private leaderboardContainer: Phaser.GameObjects.Container | null = null
  leaderboardVisible = false

  // Track previous leaderboard agent IDs for new-entry highlight detection
  private _prevLeaderboardAgentIds: Set<string> = new Set()

  // Challenge checklist overlay
  private challengeContainer: Phaser.GameObjects.Container | null = null
  challengeVisible = false

  // Shop overlay (toggle with B key)
  private shopContainer: Phaser.GameObjects.Container | null = null
  shopVisible = false
  private shopScrollOffset = 0

  private viewWidth = 800
  private viewHeight = 600

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  // -------------------------------------------------------------------------
  // Init — called once after scene create
  // -------------------------------------------------------------------------

  init(viewWidth: number, viewHeight: number): void {
    this.viewWidth = viewWidth
    this.viewHeight = viewHeight
    this._createHUD()
  }

  setViewSize(w: number, h: number): void {
    this.viewWidth = w
    this.viewHeight = h
    this._repositionHUD()
  }

  // -------------------------------------------------------------------------
  // Update — called periodically from main scene update loop
  // -------------------------------------------------------------------------

  update(): void {
    if (!this.hudContainer) return

    // Credits
    if (this.creditsText) {
      this.creditsText.setText(`\u00A4 ${creditManager.getBalance()}`)
    }

    // Active quests
    if (this.questCountText) {
      const count = questSystem.getActiveCount()
      this.questCountText.setText(`Q: ${count}`)
    }

    // Season progress
    const season = seasonManager.getCurrentSeason()
    if (season && this.progressBar && this.progressText && this.seasonNameText) {
      this.seasonNameText.setText(season.name)
      const completed = season.challenges.filter(c => c.completed).length
      const total = season.challenges.length
      const pct = total > 0 ? completed / total : 0

      // Update progress bar — sprite slider or Graphics fallback
      if (this.progressFill) {
        // Crop the fill sprite to show percentage
        const fullW = this.progressFill.width
        const cropW = Math.max(4, Math.floor(fullW * pct))
        this.progressFill.setCrop(0, 0, cropW, this.progressFill.height)
        this.progressFill.setTint(season.accentColor)
      } else {
        this.progressBar.clear()
        // Track
        this.progressBar.fillStyle(activeTheme.roomFloor, 0.8)
        this.progressBar.fillRoundedRect(0, 0, 80, 6, 3)
        // Fill
        if (pct > 0) {
          this.progressBar.fillStyle(season.accentColor, 0.9)
          this.progressBar.fillRoundedRect(0, 0, Math.max(6, 80 * pct), 6, 3)
        }
      }
      this.progressText.setText(`${completed}/${total}`)
    }

    // Update leaderboard if visible
    if (this.leaderboardVisible && this.leaderboardContainer) {
      this._refreshLeaderboard()
    }
  }

  // -------------------------------------------------------------------------
  // Leaderboard toggle (L key)
  // -------------------------------------------------------------------------

  toggleLeaderboard(): void {
    this.leaderboardVisible = !this.leaderboardVisible
    if (this.leaderboardVisible) {
      this._showLeaderboard()
    } else {
      this._hideLeaderboard()
    }
  }

  // -------------------------------------------------------------------------
  // Challenge list toggle (C key)
  // -------------------------------------------------------------------------

  toggleChallenges(): void {
    this.challengeVisible = !this.challengeVisible
    if (this.challengeVisible) {
      this._showChallenges()
    } else {
      this._hideChallenges()
    }
  }

  // -------------------------------------------------------------------------
  // Shop toggle (B key)
  // -------------------------------------------------------------------------

  toggleShop(): void {
    this.shopVisible = !this.shopVisible
    if (this.shopVisible) {
      this._showShop()
    } else {
      this._hideShop()
    }
  }

  // -------------------------------------------------------------------------
  // Cleanup
  // -------------------------------------------------------------------------

  destroy(): void {
    this.hudContainer?.destroy()
    this.leaderboardContainer?.destroy()
    this.challengeContainer?.destroy()
    this.shopContainer?.destroy()
  }

  // -------------------------------------------------------------------------
  // Private — HUD creation
  // -------------------------------------------------------------------------

  private _createHUD(): void {
    const x = this.viewWidth - 10
    const y = 10

    this.hudContainer = this.scene.add.container(x, y)
      .setScrollFactor(0)
      .setDepth(9998)

    // Season name
    this.seasonNameText = this.scene.add.text(0, 0, '', {
      fontSize: '9px', fontFamily: 'system-ui, monospace', color: '#c8d0e0',
      resolution: 2,
    }).setOrigin(1, 0)
    this.hudContainer.add(this.seasonNameText)

    // Progress bar — slider sprites with Graphics fallback
    const hasSliderAssets = this.scene.textures.exists(IMAGE_KEYS.SLIDER_TRACK)
    if (hasSliderAssets) {
      this.progressTrack = this.scene.add.image(-40, 17, IMAGE_KEYS.SLIDER_TRACK)
        .setOrigin(0.5).setScale(0.85, 0.4).setAlpha(0.8)
      this.hudContainer.add(this.progressTrack)
      this.progressFill = this.scene.add.image(-40, 17, IMAGE_KEYS.SLIDER_FILL)
        .setOrigin(0.5).setScale(0.85, 0.4).setAlpha(0.9)
      this.hudContainer.add(this.progressFill)
    }
    this.progressBar = this.scene.add.graphics()
    this.progressBar.setPosition(-80, 14)
    if (hasSliderAssets) this.progressBar.setVisible(false)
    this.hudContainer.add(this.progressBar)

    this.progressText = this.scene.add.text(0, 13, '', {
      fontSize: '6px', fontFamily: 'system-ui, monospace', color: '#5a6a7a',
      resolution: 2,
    }).setOrigin(1, 0)
    this.hudContainer.add(this.progressText)

    // Credits counter
    this.creditsText = this.scene.add.text(0, 24, '', {
      fontSize: '8px', fontFamily: 'system-ui, monospace', color: '#fbbf24',
      resolution: 2,
    }).setOrigin(1, 0)
    this.hudContainer.add(this.creditsText)

    // Active quest count
    this.questCountText = this.scene.add.text(-60, 24, '', {
      fontSize: '8px', fontFamily: 'system-ui, monospace', color: '#3b82f6',
      resolution: 2,
    }).setOrigin(1, 0)
    this.hudContainer.add(this.questCountText)
  }

  private _repositionHUD(): void {
    if (this.hudContainer) {
      this.hudContainer.setPosition(this.viewWidth - 10, 10)
    }
  }

  // -------------------------------------------------------------------------
  // Private — Leaderboard overlay
  // -------------------------------------------------------------------------

  private _showLeaderboard(): void {
    if (this.leaderboardContainer) this.leaderboardContainer.destroy()

    const rankings = leaderboardManager.getRankings().slice(0, 10)
    const rowH = 26
    const panelH = 30 + Math.max(rankings.length, 1) * rowH + 6
    const panelW = 210

    const x = this.viewWidth - panelW - 10
    const y = 50
    this.leaderboardContainer = this.scene.add.container(x, y)
      .setScrollFactor(0)
      .setDepth(9999)
      .setAlpha(0)

    // Background — sized dynamically
    const bg = this.scene.add.graphics()
    bg.fillStyle(activeTheme.bg, 0.92)
    bg.fillRoundedRect(0, 0, panelW, panelH, 6)
    bg.lineStyle(1, activeTheme.panelStroke, 0.8)
    bg.strokeRoundedRect(0, 0, panelW, panelH, 6)
    this.leaderboardContainer.add(bg)

    // Title
    const title = this.scene.add.text(panelW / 2, 10, 'LEADERBOARD', {
      fontSize: '10px', fontFamily: 'system-ui, monospace', color: '#fbbf24',
      resolution: 2,
    }).setOrigin(0.5, 0)
    this.leaderboardContainer.add(title)

    // Divider between title and content — sprite if available, else Graphics line
    if (this.scene.textures.exists(IMAGE_KEYS.DIVIDER)) {
      const div = this.scene.add.image(panelW / 2, 24, IMAGE_KEYS.DIVIDER)
        .setDisplaySize(panelW - 20, 4).setAlpha(0.5)
      this.leaderboardContainer.add(div)
    } else {
      const divGfx = this.scene.add.graphics()
      divGfx.lineStyle(1, activeTheme.panelStroke, 0.6)
      divGfx.lineBetween(10, 24, panelW - 10, 24)
      this.leaderboardContainer.add(divGfx)
    }

    this._refreshLeaderboard()

    // Fade in
    this.scene.tweens.add({
      targets: this.leaderboardContainer, alpha: 1, duration: 180, ease: 'Power2',
    })
  }

  private _refreshLeaderboard(): void {
    if (!this.leaderboardContainer) return

    // Remove old entries (keep bg + title + divider = first 3 children)
    while (this.leaderboardContainer.length > 3) {
      const child = this.leaderboardContainer.getAt(this.leaderboardContainer.length - 1) as Phaser.GameObjects.GameObject
      this.leaderboardContainer.remove(child)
      child.destroy()
    }

    const rankings = leaderboardManager.getRankings().slice(0, 10)
    const mvp = leaderboardManager.getWeeklyMVP()
    const rowH = 26
    const panelW = 210

    // Build current agent ID set for new-entry detection
    const currentAgentIds = new Set(rankings.map(e => e.agentId))

    rankings.forEach((entry, i) => {
      const isMVP = mvp?.agentId === entry.agentId
      const color = entry.rank <= 3 ? '#fbbf24' : '#8a96a4'
      const rowY = 28 + i * rowH

      // New entry highlight — gold flash for agents not in previous snapshot
      const isNewEntry = this._prevLeaderboardAgentIds.size > 0 &&
        !this._prevLeaderboardAgentIds.has(entry.agentId)
      if (isNewEntry) {
        const rowBg = this.scene.add.rectangle(panelW / 2, rowY + 8, panelW - 8, rowH - 2, 0xfbbf24, 0)
        this.leaderboardContainer!.add(rowBg)
        this.scene.tweens.add({
          targets: rowBg,
          alpha: { from: 0.15, to: 0 },
          duration: 800,
          ease: 'Power2',
          onComplete: () => rowBg.destroy(),
        })
      }

      // Medal sprite for top 3, text number for the rest
      if (entry.rank >= 1 && entry.rank <= 3) {
        const hasHDMedals = this.scene.textures.exists(SPRITESHEET_KEYS.MEDALS_HD)
        let medalSprite: Phaser.GameObjects.Sprite
        if (hasHDMedals) {
          const hdFrame = entry.rank === 1 ? MEDAL_HD_FRAMES.GOLD_STAR
            : entry.rank === 2 ? MEDAL_HD_FRAMES.SILVER_FLORAL : MEDAL_HD_FRAMES.BRONZE_FLORAL
          medalSprite = this.scene.add.sprite(16, rowY + 6, SPRITESHEET_KEYS.MEDALS_HD, hdFrame)
            .setScale(0.18).setOrigin(0.5)
        } else {
          const medalFrame = entry.rank === 1 ? ICON_FRAMES.MEDAL_GOLD
            : entry.rank === 2 ? ICON_FRAMES.MEDAL_SILVER : ICON_FRAMES.MEDAL_BRONZE
          medalSprite = this.scene.add.sprite(16, rowY + 6, SPRITESHEET_KEYS.GAME_ICONS, medalFrame)
            .setScale(0.32).setOrigin(0.5)
        }
        this.leaderboardContainer!.add(medalSprite)

        // Medal pulse animation — staggered by rank
        const baseScale = hasHDMedals ? 0.18 : 0.32
        const pulseScale = hasHDMedals ? 0.24 : 0.42
        this.scene.tweens.add({
          targets: medalSprite,
          scaleX: pulseScale, scaleY: pulseScale,
          duration: 300,
          yoyo: true,
          delay: entry.rank * 100,
          ease: 'Sine.easeInOut',
        })
      } else {
        const rankNum = this.scene.add.text(8, rowY, `${entry.rank}.`, {
          fontSize: '7px', fontFamily: 'system-ui, monospace', color: '#5a6a7a',
          resolution: 2,
        })
        this.leaderboardContainer!.add(rankNum)
      }

      // Agent name + MVP tag
      const mvpTag = isMVP ? ' MVP' : ''
      const nameLabel = this.scene.add.text(28, rowY, `${entry.agentName}${mvpTag}`, {
        fontSize: '8px', fontFamily: 'system-ui, monospace', color,
        resolution: 2,
      })
      this.leaderboardContainer!.add(nameLabel)

      // MVP crown icon — subtle bobbing animation
      if (isMVP) {
        const hasHD = this.scene.textures.exists(SPRITESHEET_KEYS.MEDALS_HD)
        const mvpIcon = hasHD
          ? this.scene.add.sprite(panelW - 20, rowY + 6, SPRITESHEET_KEYS.MEDALS_HD, MEDAL_HD_FRAMES.GOLD_STAR).setScale(0.16)
          : this.scene.add.sprite(panelW - 20, rowY + 6, SPRITESHEET_KEYS.GAME_ICONS, ICON_FRAMES.MEDAL_GOLD).setScale(0.28)
        this.leaderboardContainer!.add(mvpIcon)
        this.scene.tweens.add({
          targets: mvpIcon,
          y: rowY + 4,
          duration: 1500,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        })
      }

      // Stats line: XP | tasks | rank title
      const statsColor = entry.rank <= 3 ? '#7a8494' : '#4a5464'
      const tasksLabel = entry.tasksCompleted === 1 ? '1 task' : `${entry.tasksCompleted} tasks`
      const streakSuffix = entry.currentStreak >= 3 ? ` | x${entry.currentStreak}` : ''
      const statsLine = this.scene.add.text(28, rowY + 11, `${entry.seasonXP} XP | ${tasksLabel} | ${entry.rankTitle}${streakSuffix}`, {
        fontSize: '6px', fontFamily: 'system-ui, monospace', color: statsColor,
        resolution: 2,
      })
      this.leaderboardContainer!.add(statsLine)
    })

    if (rankings.length === 0) {
      const empty = this.scene.add.text(105, 40, 'No agents ranked yet', {
        fontSize: '8px', fontFamily: 'system-ui, monospace', color: '#4a5464',
        resolution: 2,
      }).setOrigin(0.5, 0)
      this.leaderboardContainer!.add(empty)
    }

    // Update previous snapshot for next refresh cycle
    this._prevLeaderboardAgentIds = currentAgentIds
  }

  private _hideLeaderboard(): void {
    if (!this.leaderboardContainer) return
    this.scene.tweens.add({
      targets: this.leaderboardContainer, alpha: 0, duration: 140, ease: 'Power2',
      onComplete: () => {
        this.leaderboardContainer?.destroy()
        this.leaderboardContainer = null
      },
    })
  }

  // -------------------------------------------------------------------------
  // Private — Challenge checklist overlay
  // -------------------------------------------------------------------------

  private _showChallenges(): void {
    if (this.challengeContainer) this.challengeContainer.destroy()

    const season = seasonManager.getCurrentSeason()
    if (!season) return

    const x = this.viewWidth - 220
    const y = 50
    const rowH = 22
    const panelH = 30 + season.challenges.length * rowH + 10

    this.challengeContainer = this.scene.add.container(x, y)
      .setScrollFactor(0)
      .setDepth(9999)
      .setAlpha(0)

    const bg = this.scene.add.graphics()
    bg.fillStyle(activeTheme.bg, 0.92)
    bg.fillRoundedRect(0, 0, 210, panelH, 6)
    bg.lineStyle(1, activeTheme.panelStroke, 0.8)
    bg.strokeRoundedRect(0, 0, 210, panelH, 6)
    this.challengeContainer.add(bg)

    const title = this.scene.add.text(105, 8, `${season.name} Challenges`, {
      fontSize: '9px', fontFamily: 'system-ui, monospace', color: '#c8d0e0',
      resolution: 2,
    }).setOrigin(0.5, 0)
    this.challengeContainer.add(title)

    // Divider between title and challenge list — sprite if available, else Graphics line
    if (this.scene.textures.exists(IMAGE_KEYS.DIVIDER)) {
      const div = this.scene.add.image(105, 22, IMAGE_KEYS.DIVIDER)
        .setDisplaySize(190, 4).setAlpha(0.5)
      this.challengeContainer.add(div)
    } else {
      const divGfx = this.scene.add.graphics()
      divGfx.lineStyle(1, activeTheme.panelStroke, 0.6)
      divGfx.lineBetween(10, 22, 200, 22)
      this.challengeContainer.add(divGfx)
    }

    season.challenges.forEach((ch, i) => {
      const color = ch.completed ? '#34d399' : '#8a96a4'
      const progress = ch.target > 1 ? ` (${Math.min(ch.current, ch.target)}/${ch.target})` : ''
      const rowY = 26 + i * rowH

      // Sprite checkmark or square instead of emoji
      const iconFrame = ch.completed ? ICON_FRAMES.CHECKMARK : ICON_FRAMES.SQUARE_OUTLINE
      const icon = this.scene.add.sprite(18, rowY + 5, SPRITESHEET_KEYS.GAME_ICONS, iconFrame)
        .setScale(0.30).setOrigin(0.5)
      this.challengeContainer!.add(icon)

      // Scale-pop animation for completed challenge checkmarks
      if (ch.completed) {
        this.scene.tweens.add({
          targets: icon,
          scaleX: 0.5, scaleY: 0.5,
          duration: 200,
          yoyo: true,
          delay: i * 50,
          ease: 'Back.easeOut',
        })
      }

      const row = this.scene.add.text(28, rowY, `${ch.description}${progress}`, {
        fontSize: '7px', fontFamily: 'system-ui, monospace', color,
        resolution: 2, wordWrap: { width: 172 },
      })
      this.challengeContainer!.add(row)

      // Progress bar — visual fill bar below the challenge description
      if (ch.target > 1) {
        const barW = 160
        const barH = 3
        const barX = 28
        const barY = rowY + 12
        const pct = Math.min(1, ch.current / ch.target)
        const barGfx = this.scene.add.graphics()
        // Track
        barGfx.fillStyle(activeTheme.roomFloor, 0.5)
        barGfx.fillRoundedRect(barX, barY, barW, barH, 1)
        // Fill
        if (pct > 0) {
          const fillColor = ch.completed ? 0x34d399 : season.accentColor
          barGfx.fillStyle(fillColor, 0.8)
          barGfx.fillRoundedRect(barX, barY, Math.max(3, barW * pct), barH, 1)
        }
        this.challengeContainer!.add(barGfx)
      }
    })

    this.scene.tweens.add({
      targets: this.challengeContainer, alpha: 1, duration: 180, ease: 'Power2',
    })
  }

  private _hideChallenges(): void {
    if (!this.challengeContainer) return
    this.scene.tweens.add({
      targets: this.challengeContainer, alpha: 0, duration: 140, ease: 'Power2',
      onComplete: () => {
        this.challengeContainer?.destroy()
        this.challengeContainer = null
      },
    })
  }

  // -------------------------------------------------------------------------
  // Private — Shop overlay
  // -------------------------------------------------------------------------

  private _showShop(): void {
    if (this.shopContainer) this.shopContainer.destroy()
    this.shopScrollOffset = 0

    const catalog = creditManager.getCatalog()
    const maxVisible = 6
    const visibleItems = catalog.slice(0, maxVisible)
    const rowH = 28
    const panelW = 230
    const panelH = 36 + visibleItems.length * rowH + 10

    const x = this.viewWidth - panelW - 10
    const y = 50
    this.shopContainer = this.scene.add.container(x, y)
      .setScrollFactor(0)
      .setDepth(9999)
      .setAlpha(0)

    // Background
    const bg = this.scene.add.graphics()
    bg.fillStyle(activeTheme.bg, 0.92)
    bg.fillRoundedRect(0, 0, panelW, panelH, 6)
    bg.lineStyle(1, activeTheme.panelStroke, 0.8)
    bg.strokeRoundedRect(0, 0, panelW, panelH, 6)
    this.shopContainer.add(bg)

    // Title with balance
    const balance = creditManager.getBalance()
    const title = this.scene.add.text(panelW / 2, 10, `SHOP  \u00A4${balance}`, {
      fontSize: '10px', fontFamily: 'system-ui, monospace', color: '#fbbf24',
      resolution: 2,
    }).setOrigin(0.5, 0)
    this.shopContainer.add(title)

    // Divider
    if (this.scene.textures.exists(IMAGE_KEYS.DIVIDER)) {
      const div = this.scene.add.image(panelW / 2, 24, IMAGE_KEYS.DIVIDER)
        .setDisplaySize(panelW - 20, 4).setAlpha(0.5)
      this.shopContainer.add(div)
    } else {
      const divGfx = this.scene.add.graphics()
      divGfx.lineStyle(1, activeTheme.panelStroke, 0.6)
      divGfx.lineBetween(10, 24, panelW - 10, 24)
      this.shopContainer.add(divGfx)
    }

    this._renderShopItems(visibleItems, rowH, panelW)

    // Fade in
    this.scene.tweens.add({
      targets: this.shopContainer, alpha: 1, duration: 180, ease: 'Power2',
    })
  }

  private _renderShopItems(items: readonly CosmeticItem[], rowH: number, panelW: number): void {
    if (!this.shopContainer) return

    // Remove old item entries (keep bg + title + divider = first 3 children)
    while (this.shopContainer.length > 3) {
      const child = this.shopContainer.getAt(this.shopContainer.length - 1) as Phaser.GameObjects.GameObject
      this.shopContainer.remove(child)
      child.destroy()
    }

    const hasIcons = this.scene.textures.exists(SPRITESHEET_KEYS.GAME_ICONS)

    items.forEach((item, i) => {
      const rowY = 30 + i * rowH
      const owned = creditManager.isOwned(item.id)
      const canAfford = creditManager.canAfford(item.id)

      // Preview sprite
      if (hasIcons) {
        const preview = this.scene.add.sprite(18, rowY + 8, SPRITESHEET_KEYS.GAME_ICONS, item.previewFrame)
          .setScale(0.38).setOrigin(0.5)
        if (item.previewTint !== undefined) {
          preview.setTint(item.previewTint)
        }
        if (owned) preview.setAlpha(0.5)
        this.shopContainer!.add(preview)
      }

      // Item name
      const nameColor = owned ? '#4a5464' : canAfford ? '#c8d0e0' : '#6a7484'
      const nameText = this.scene.add.text(32, rowY, item.name, {
        fontSize: '8px', fontFamily: 'system-ui, monospace', color: nameColor,
        resolution: 2,
      })
      this.shopContainer!.add(nameText)

      // Description line
      const descColor = owned ? '#3a4454' : '#5a6a7a'
      const descText = this.scene.add.text(32, rowY + 11, item.description, {
        fontSize: '6px', fontFamily: 'system-ui, monospace', color: descColor,
        resolution: 2,
      })
      this.shopContainer!.add(descText)

      // Price / owned badge (right-aligned)
      if (owned) {
        const ownedLabel = this.scene.add.text(panelW - 10, rowY + 4, 'OWNED', {
          fontSize: '7px', fontFamily: 'system-ui, monospace', color: '#34d399',
          resolution: 2,
        }).setOrigin(1, 0)
        this.shopContainer!.add(ownedLabel)
      } else {
        const priceColor = canAfford ? '#fbbf24' : '#ef4444'
        const priceLabel = this.scene.add.text(panelW - 10, rowY + 4, `\u00A4${item.price}`, {
          fontSize: '8px', fontFamily: 'system-ui, monospace', color: priceColor,
          resolution: 2,
        }).setOrigin(1, 0)
        this.shopContainer!.add(priceLabel)
      }
    })

    // Scroll hint if catalog is larger than visible
    const catalog = creditManager.getCatalog()
    if (catalog.length > items.length) {
      const hintY = 30 + items.length * rowH
      const hint = this.scene.add.text(panelW / 2, hintY, `${catalog.length - items.length} more...`, {
        fontSize: '6px', fontFamily: 'system-ui, monospace', color: '#4a5464',
        resolution: 2,
      }).setOrigin(0.5, 0)
      this.shopContainer!.add(hint)
    }
  }

  private _hideShop(): void {
    if (!this.shopContainer) return
    this.scene.tweens.add({
      targets: this.shopContainer, alpha: 0, duration: 140, ease: 'Power2',
      onComplete: () => {
        this.shopContainer?.destroy()
        this.shopContainer = null
      },
    })
  }
}
