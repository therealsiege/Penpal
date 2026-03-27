// ---------------------------------------------------------------------------
// celebrations.ts
// CelebrationManager — rank-up, task-complete, milestone, error, and
// achievement effects.
//
// All effects use Phaser Graphics/Text + tweens + VFX sprites.
// Particles are pre-allocated Arc GameObjects recycled via getData('busy').
// ---------------------------------------------------------------------------

import Phaser from 'phaser'
import { SPRITESHEET_KEYS, EFFECT_ANIM_KEYS, ICON_FRAMES, LEGO_SPECIAL_FRAMES, DIFFICULTY_STAR_FRAME } from './office-asset-keys'
import type { QuestDifficulty } from './quest-system'
import { soundEngine } from './sound-engine'

// Pool sizes
const BURST_POOL_SIZE = 48   // shared by rankUp + milestone burst layers
const CONFETTI_POOL_SIZE = 40
const SPARKLE_POOL_SIZE = 16 // small task-complete sparkles

// Confetti palette
const CONFETTI_COLORS = [
  0xf59e0b, 0xef4444, 0x10b981, 0x3b82f6, 0xa855f7, 0xf43f5e, 0xfbbf24, 0x06b6d4,
]

// Difficulty color mapping for quest reward effects
const DIFFICULTY_COLORS: Record<string, number> = {
  trivial:   0x6b7280,
  normal:    0x3b82f6,
  hard:      0xa855f7,
  epic:      0xf59e0b,
  legendary: 0xef4444,
}

// ---------------------------------------------------------------------------
// CelebrationManager
// ---------------------------------------------------------------------------

export class CelebrationManager {
  private _scene: Phaser.Scene

  // Burst particle pool (Arc circles, ADD blend)
  private _burstPool: Phaser.GameObjects.Arc[] = []

  // Confetti pool (Graphics rectangles)
  private _confettiPool: Phaser.GameObjects.Graphics[] = []

  // Small sparkle pool for taskComplete
  private _sparklePool: Phaser.GameObjects.Arc[] = []

  constructor(scene: Phaser.Scene) {
    this._scene = scene
    this._initBurstPool()
    this._initConfettiPool()
    this._initSparklePool()
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Full rank-up celebration at a workstation world position.
   * 1. Colored particle burst radiating outward
   * 2. Rising "PROMOTED!" headline text
   * 3. Expanding ring that grows and fades
   * 4. Brief screen flash overlay
   * 5. Secondary rank name text, delayed 400 ms
   */
  rankUp(x: number, y: number, agentName: string, newRank: string, rankColor: number): void {
    soundEngine.levelUp()
    // 1. Burst of 10 particles in a full circle
    this._particleBurst(x, y, 10, rankColor, 52)

    // 2. Rising headline text
    this._risingText(x, y - 18, `PROMOTED!`, {
      fontSize: '13px',
      fontFamily: 'monospace',
      color: '#' + rankColor.toString(16).padStart(6, '0'),
      stroke: '#000000',
      strokeThickness: 3,
      resolution: 2,
    })

    // 3. Expanding ring
    this._expandingRing(x, y, rankColor)

    // 4. Subtle screen flash (screen-space, scrollFactor 0)
    this._screenFlash(rankColor)

    // 5. Rank name label — delayed 400 ms
    this._scene.time.delayedCall(400, () => {
      this._risingText(x, y - 10, newRank, {
        fontSize: '10px',
        fontFamily: 'monospace',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 2,
        resolution: 2,
      })
    })

    // 6. Agent name label — subtle, delayed 200 ms
    this._scene.time.delayedCall(200, () => {
      this._risingText(x, y + 8, agentName, {
        fontSize: '9px',
        fontFamily: 'monospace',
        color: '#aaaaaa',
        stroke: '#000000',
        strokeThickness: 2,
        resolution: 2,
      })
    })
  }

  /**
   * Small celebration for a completed task.
   * 1. Green checkmark pop-up with pulse
   * 2. 3-4 tiny sparkle particles
   */
  taskComplete(x: number, y: number): void {
    soundEngine.click()
    // 1. Checkmark sprite
    const check = this._scene.add.sprite(x, y - 14, SPRITESHEET_KEYS.GAME_ICONS, ICON_FRAMES.CHECKMARK)
      .setScale(0.4).setOrigin(0.5).setAlpha(0).setDepth(600).setTint(0x34d399)

    this._scene.tweens.add({
      targets: check,
      alpha: 1,
      scaleX: 1.3,
      scaleY: 1.3,
      y: y - 24,
      duration: 180,
      ease: 'Back.easeOut',
      onComplete: () => {
        this._scene.tweens.add({
          targets: check,
          alpha: 0,
          scaleX: 0.8,
          scaleY: 0.8,
          y: y - 34,
          duration: 260,
          ease: 'Power2',
          delay: 300,
          onComplete: () => check.destroy(),
        })
      },
    })

    // 2. White puff VFX sprite
    if (this._scene.anims.exists(EFFECT_ANIM_KEYS.PUFF)) {
      const puff = this._scene.add.sprite(x, y - 14, SPRITESHEET_KEYS.EFFECTS_PUFF)
        .setDepth(600)
        .setScale(0.16)
        .setAlpha(0.6)
        .setBlendMode(Phaser.BlendModes.ADD)
      puff.play(EFFECT_ANIM_KEYS.PUFF)
      puff.once('animationcomplete', () => puff.destroy())
    }

    // 3. Tiny sparkle burst (3-4 particles)
    const count = 3 + Math.floor(Math.random() * 2)
    for (let i = 0; i < count; i++) {
      const p = this._sparklePool.find(c => !c.getData('busy'))
      if (!p) continue
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4
      const dist = 10 + Math.random() * 12
      p.setPosition(x, y - 14)
      p.setFillStyle(0x34d399)
      p.setRadius(1.2 + Math.random())
      p.setAlpha(0.9).setVisible(true).setData('busy', true)
      this._scene.tweens.add({
        targets: p,
        x: x + Math.cos(angle) * dist,
        y: (y - 14) + Math.sin(angle) * dist,
        alpha: 0,
        duration: 380 + Math.random() * 120,
        ease: 'Power2',
        onComplete: () => { p.setVisible(false).setData('busy', false) },
      })
    }
  }

  /**
   * Milestone celebration (100 tasks, streaks, etc.).
   * 1. Gold particle burst (larger than rankUp) + Explosion VFX
   * 2. Banner text that slides in from the right
   * 3. Confetti — small colored rectangles that fall with gravity
   */
  milestone(x: number, y: number, text: string): void {
    // Screen shake on milestones
    this._scene.cameras.main.shake(100, 0.003)
    soundEngine.levelUp()

    // 1. Gold burst — more particles, larger radius
    this._particleBurst(x, y, 16, 0xfbbf24, 72)
    // Inner warm burst layer
    this._scene.time.delayedCall(80, () => this._particleBurst(x, y, 8, 0xf59e0b, 36))

    // Explosion VFX at the center of the burst
    if (this._scene.anims.exists(EFFECT_ANIM_KEYS.EXPLOSION)) {
      const explosion = this._scene.add.sprite(x, y, SPRITESHEET_KEYS.EFFECTS_EXPLOSION)
        .setDepth(601)
        .setScale(0.32)
        .setAlpha(0.7)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(0xfbbf24)
      explosion.play(EFFECT_ANIM_KEYS.EXPLOSION)
      explosion.once('animationcomplete', () => explosion.destroy())
    }

    // 2. Banner text slides in from the right
    const cam = this._scene.cameras.main
    const screenX = cam.width - 20
    const screenY = 60
    const banner = this._scene.add.text(screenX + 200, screenY, text, {
      fontSize: '14px',
      fontFamily: 'monospace',
      color: '#fbbf24',
      stroke: '#000000',
      strokeThickness: 3,
      backgroundColor: '#00000088',
      padding: { x: 10, y: 5 },
      resolution: 2,
    }).setOrigin(1, 0.5).setScrollFactor(0).setDepth(9998).setAlpha(0)

    this._scene.tweens.add({
      targets: banner,
      x: screenX,
      alpha: 1,
      duration: 340,
      ease: 'Back.easeOut',
      onComplete: () => {
        this._scene.tweens.add({
          targets: banner,
          alpha: 0,
          x: screenX + 60,
          duration: 300,
          ease: 'Power2',
          delay: 2000,
          onComplete: () => banner.destroy(),
        })
      },
    })

    // 3. Confetti burst
    this._confetti(x, y, 22)
  }

  /**
   * Error/failure effect — black smoke puff + red cross icon.
   * Use for failed quests, agent errors, blocked state.
   */
  error(x: number, y: number): void {
    // Subtle screen shake on errors
    this._scene.cameras.main.shake(60, 0.002)
    soundEngine.error()

    // Black smoke VFX
    if (this._scene.anims.exists(EFFECT_ANIM_KEYS.SMOKE)) {
      const smoke = this._scene.add.sprite(x, y - 10, SPRITESHEET_KEYS.EFFECTS_SMOKE)
        .setDepth(600)
        .setScale(0.20)
        .setAlpha(0.7)
      smoke.play(EFFECT_ANIM_KEYS.SMOKE)
      smoke.once('animationcomplete', () => smoke.destroy())
    }

    // Red cross icon rising up
    const cross = this._scene.add.sprite(x, y - 14, SPRITESHEET_KEYS.GAME_ICONS, ICON_FRAMES.CROSS_RED)
      .setScale(0.32).setOrigin(0.5).setAlpha(0).setDepth(601)

    this._scene.tweens.add({
      targets: cross,
      alpha: 1,
      scaleX: 0.44,
      scaleY: 0.44,
      y: y - 28,
      duration: 200,
      ease: 'Back.easeOut',
      onComplete: () => {
        this._scene.tweens.add({
          targets: cross,
          alpha: 0,
          y: y - 40,
          duration: 400,
          ease: 'Power2',
          delay: 500,
          onComplete: () => cross.destroy(),
        })
      },
    })
  }

  /**
   * Achievement unlock visual — badge sprite + rising title text.
   * Called via ACHIEVEMENT_UNLOCKED event from the AchievementManager.
   */
  achievementUnlocked(x: number, y: number, title: string, iconFrame: number): void {
    // Badge sprite popup
    const badge = this._scene.add.sprite(x, y - 20, SPRITESHEET_KEYS.GAME_ICONS, iconFrame)
      .setScale(0).setOrigin(0.5).setAlpha(0).setDepth(602)

    this._scene.tweens.add({
      targets: badge,
      alpha: 1,
      scaleX: 0.65,
      scaleY: 0.65,
      duration: 300,
      ease: 'Back.easeOut',
      onComplete: () => {
        this._scene.tweens.add({
          targets: badge,
          alpha: 0,
          scaleX: 0.6,
          scaleY: 0.6,
          y: y - 50,
          duration: 500,
          ease: 'Power2',
          delay: 1200,
          onComplete: () => badge.destroy(),
        })
      },
    })

    // Rising title text
    this._scene.time.delayedCall(150, () => {
      this._risingText(x, y - 8, title, {
        fontSize: '10px',
        fontFamily: 'monospace',
        color: '#fbbf24',
        stroke: '#000000',
        strokeThickness: 2,
        resolution: 2,
      })
    })

    // Small sparkle burst
    this._particleBurst(x, y - 20, 6, 0xfbbf24, 28)
  }

  /**
   * Season end ceremony — dramatic full-screen celebration.
   * 1. Full-screen gold flash (300ms, longer than rank-up)
   * 2. Explosion VFX at screen center
   * 3. Massive confetti burst (30+ pieces) falling from the top
   * 4. "SEASON COMPLETE!" banner slides in from left
   * 5. Season name + score text, delayed 500ms
   * 6. Second confetti wave at 1.5s
   */
  seasonEnd(seasonName: string, score: number): void {
    soundEngine.achievement()
    const cam = this._scene.cameras.main
    const cx = cam.width / 2
    const cy = cam.height / 2

    // 1. Gold screen flash — longer, more intense
    const flash = this._scene.add.graphics()
      .setScrollFactor(0)
      .setDepth(9999)
    flash.fillStyle(0xfbbf24, 0.18)
    flash.fillRect(0, 0, cam.width, cam.height)
    flash.setAlpha(1)

    this._scene.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 300,
      ease: 'Power2',
      delay: 60,
      onComplete: () => flash.destroy(),
    })

    // Flash VFX sprite
    if (this._scene.anims.exists(EFFECT_ANIM_KEYS.FLASH)) {
      const flashSprite = this._scene.add.sprite(cx, cy, SPRITESHEET_KEYS.EFFECTS_FLASH)
        .setScrollFactor(0)
        .setDepth(9998)
        .setScale(1.5)
        .setAlpha(0.5)
        .setTint(0xfbbf24)
        .setBlendMode(Phaser.BlendModes.ADD)
      flashSprite.play(EFFECT_ANIM_KEYS.FLASH)
      flashSprite.once('animationcomplete', () => flashSprite.destroy())
    }

    // 2. Explosion VFX at screen center
    if (this._scene.anims.exists(EFFECT_ANIM_KEYS.EXPLOSION)) {
      const explosion = this._scene.add.sprite(cx, cy, SPRITESHEET_KEYS.EFFECTS_EXPLOSION)
        .setScrollFactor(0)
        .setDepth(9998)
        .setScale(0.7)
        .setAlpha(0.5)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(0xfbbf24)
      explosion.play(EFFECT_ANIM_KEYS.EXPLOSION)
      explosion.once('animationcomplete', () => explosion.destroy())
    }

    // 3. Massive confetti burst from top of screen
    this._screenConfetti(32)

    // 4. "SEASON COMPLETE!" banner slides in from the left
    const banner = this._scene.add.text(-300, cam.height * 0.35, 'SEASON COMPLETE!', {
      fontSize: '22px',
      fontFamily: 'monospace',
      color: '#fbbf24',
      stroke: '#000000',
      strokeThickness: 4,
      backgroundColor: '#00000099',
      padding: { x: 16, y: 8 },
      resolution: 2,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(10000).setAlpha(0)

    this._scene.tweens.add({
      targets: banner,
      x: cx,
      alpha: 1,
      duration: 400,
      ease: 'Back.easeOut',
      onComplete: () => {
        this._scene.tweens.add({
          targets: banner,
          alpha: 0,
          y: banner.y - 20,
          duration: 400,
          ease: 'Power2',
          delay: 3000,
          onComplete: () => banner.destroy(),
        })
      },
    })

    // 5. Season name + score — delayed 500ms
    this._scene.time.delayedCall(500, () => {
      const subtitle = this._scene.add.text(cx, cam.height * 0.35 + 36, `${seasonName}  |  Score: ${score}`, {
        fontSize: '13px',
        fontFamily: 'monospace',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 3,
        backgroundColor: '#00000077',
        padding: { x: 10, y: 4 },
        resolution: 2,
      }).setOrigin(0.5).setScrollFactor(0).setDepth(10000).setAlpha(0)

      this._scene.tweens.add({
        targets: subtitle,
        alpha: 1,
        duration: 300,
        ease: 'Power2',
        onComplete: () => {
          this._scene.tweens.add({
            targets: subtitle,
            alpha: 0,
            y: subtitle.y - 10,
            duration: 400,
            ease: 'Power2',
            delay: 2800,
            onComplete: () => subtitle.destroy(),
          })
        },
      })
    })

    // 6. Second confetti wave at 1.5s
    this._scene.time.delayedCall(1500, () => {
      this._screenConfetti(30)
    })
  }

  /**
   * Season start announcement — subtle but noticeable.
   * 1. Blue/purple screen flash
   * 2. "NEW SEASON: {name}" banner slides in
   * 3. Small sparkle burst at screen center
   * 4. Puff VFX at screen center
   */
  seasonStart(seasonName: string): void {
    const cam = this._scene.cameras.main
    const cx = cam.width / 2
    const cy = cam.height / 2

    // 1. Blue/purple screen flash
    const flash = this._scene.add.graphics()
      .setScrollFactor(0)
      .setDepth(9999)
    flash.fillStyle(0xa855f7, 0.12)
    flash.fillRect(0, 0, cam.width, cam.height)
    flash.setAlpha(1)

    this._scene.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 200,
      ease: 'Power2',
      delay: 40,
      onComplete: () => flash.destroy(),
    })

    // 2. Banner slides in from left
    const banner = this._scene.add.text(-300, cam.height * 0.38, `NEW SEASON: ${seasonName}`, {
      fontSize: '16px',
      fontFamily: 'monospace',
      color: '#a855f7',
      stroke: '#000000',
      strokeThickness: 3,
      backgroundColor: '#00000088',
      padding: { x: 12, y: 6 },
      resolution: 2,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(10000).setAlpha(0)

    this._scene.tweens.add({
      targets: banner,
      x: cx,
      alpha: 1,
      duration: 380,
      ease: 'Back.easeOut',
      onComplete: () => {
        this._scene.tweens.add({
          targets: banner,
          alpha: 0,
          y: banner.y - 14,
          duration: 350,
          ease: 'Power2',
          delay: 2200,
          onComplete: () => banner.destroy(),
        })
      },
    })

    // 3. Small sparkle burst at screen center (world coords from camera center)
    const worldX = cam.scrollX + cx
    const worldY = cam.scrollY + cy
    this._particleBurst(worldX, worldY, 8, 0xa855f7, 40)

    // 4. Puff VFX at screen center
    if (this._scene.anims.exists(EFFECT_ANIM_KEYS.PUFF)) {
      const puff = this._scene.add.sprite(cx, cy, SPRITESHEET_KEYS.EFFECTS_PUFF)
        .setScrollFactor(0)
        .setDepth(9998)
        .setScale(0.35)
        .setAlpha(0.5)
        .setBlendMode(Phaser.BlendModes.ADD)
      puff.play(EFFECT_ANIM_KEYS.PUFF)
      puff.once('animationcomplete', () => puff.destroy())
    }
  }

  /**
   * Challenge completed mini-celebration.
   * 1. Checkmark sprite popup at screen center
   * 2. Rising text with challenge description
   * 3. Small green particle burst
   */
  challengeCompleted(description: string): void {
    const cam = this._scene.cameras.main
    const cx = cam.width / 2
    const cy = cam.height * 0.45

    // 1. Checkmark icon popup
    const check = this._scene.add.sprite(cx, cy, SPRITESHEET_KEYS.GAME_ICONS, ICON_FRAMES.CHECKMARK)
      .setScrollFactor(0)
      .setScale(0)
      .setOrigin(0.5)
      .setAlpha(0)
      .setDepth(10000)
      .setTint(0x34d399)

    this._scene.tweens.add({
      targets: check,
      alpha: 1,
      scaleX: 1.2,
      scaleY: 1.2,
      duration: 250,
      ease: 'Back.easeOut',
      onComplete: () => {
        this._scene.tweens.add({
          targets: check,
          alpha: 0,
          scaleX: 0.6,
          scaleY: 0.6,
          y: cy - 30,
          duration: 400,
          ease: 'Power2',
          delay: 800,
          onComplete: () => check.destroy(),
        })
      },
    })

    // 2. Rising text with challenge description
    this._scene.time.delayedCall(100, () => {
      const label = this._scene.add.text(cx, cy + 22, description, {
        fontSize: '11px',
        fontFamily: 'monospace',
        color: '#34d399',
        stroke: '#000000',
        strokeThickness: 2,
        backgroundColor: '#00000077',
        padding: { x: 8, y: 3 },
        resolution: 2,
      }).setOrigin(0.5).setScrollFactor(0).setDepth(10000).setAlpha(0)

      this._scene.tweens.add({
        targets: label,
        alpha: 1,
        y: cy + 16,
        duration: 200,
        ease: 'Power2',
        onComplete: () => {
          this._scene.tweens.add({
            targets: label,
            alpha: 0,
            y: cy + 6,
            duration: 350,
            ease: 'Power1',
            delay: 1200,
            onComplete: () => label.destroy(),
          })
        },
      })
    })

    // 3. Small green particle burst (world coords)
    const worldX = cam.scrollX + cx
    const worldY = cam.scrollY + cy
    this._particleBurst(worldX, worldY, 6, 0x34d399, 30)
  }

  /**
   * Purchase celebration — coin bounce + small confetti + rising item name.
   * Triggered when a cosmetic item is bought from the shop.
   */
  purchase(x: number, y: number, itemName: string): void {
    // 1. Coin sprite bouncing upward (use STAR_YELLOW as coin stand-in)
    const hasIcons = this._scene.textures.exists(SPRITESHEET_KEYS.GAME_ICONS)
    if (hasIcons) {
      const coin = this._scene.add.sprite(x, y, SPRITESHEET_KEYS.GAME_ICONS, ICON_FRAMES.STAR_YELLOW)
        .setScale(0.5).setOrigin(0.5).setAlpha(0).setDepth(602)

      this._scene.tweens.add({
        targets: coin,
        alpha: 1,
        scaleX: 0.7,
        scaleY: 0.7,
        y: y - 30,
        duration: 250,
        ease: 'Back.easeOut',
        onComplete: () => {
          // Settle then fade
          this._scene.tweens.add({
            targets: coin,
            y: y - 22,
            duration: 140,
            ease: 'Bounce.easeOut',
            onComplete: () => {
              this._scene.tweens.add({
                targets: coin,
                alpha: 0,
                y: y - 50,
                scaleX: 0.3,
                scaleY: 0.3,
                duration: 300,
                ease: 'Power2',
                delay: 200,
                onComplete: () => coin.destroy(),
              })
            },
          })
        },
      })
    }

    // 2. Small confetti burst (5 pieces)
    this._confetti(x, y - 14, 5)

    // 3. Rising text showing the item name
    this._risingText(x, y - 8, itemName, {
      fontSize: '9px',
      fontFamily: 'monospace',
      color: '#fbbf24',
      stroke: '#000000',
      strokeThickness: 2,
      resolution: 2,
    })
  }

  /**
   * Quest-complete celebration — difficulty-colored star burst + expanding ring.
   * Smaller than rank-up; color matches quest difficulty tier.
   * 1. Difficulty star sprite pop-up with scale bounce
   * 2. Small expanding ring in difficulty color
   * 3. Particle burst in difficulty color (6 particles)
   */
  questComplete(x: number, y: number, difficulty: QuestDifficulty): void {
    const diffColor = DIFFICULTY_COLORS[difficulty] ?? 0x3b82f6

    // 1. Difficulty star sprite
    const starFrame = DIFFICULTY_STAR_FRAME[difficulty] ?? ICON_FRAMES.STAR_GREY
    const star = this._scene.add.sprite(x, y - 16, SPRITESHEET_KEYS.GAME_ICONS, starFrame)
      .setScale(0).setOrigin(0.5).setAlpha(0).setDepth(601)

    this._scene.tweens.add({
      targets: star,
      alpha: 1,
      scaleX: 0.7,
      scaleY: 0.7,
      y: y - 28,
      duration: 220,
      ease: 'Back.easeOut',
      onComplete: () => {
        this._scene.tweens.add({
          targets: star,
          alpha: 0,
          scaleX: 0.4,
          scaleY: 0.4,
          y: y - 44,
          duration: 400,
          ease: 'Power2',
          delay: 400,
          onComplete: () => star.destroy(),
        })
      },
    })

    // 2. Small expanding ring in difficulty color (smaller radius than rank-up)
    this._expandingRing(x, y - 16, diffColor)

    // 3. Particle burst
    this._particleBurst(x, y - 16, 6, diffColor, 28)
  }

  /**
   * Quest completion reward popup with Lego special item sprites.
   * 1. Coin sprite pops up with scale bounce, floats upward, fades
   * 2. For epic+ quests, also shows the EXPLOSIVE crate sprite
   * 3. Rising "+{xpAmount} XP" and "+{creditAmount}c" text below the sprite
   * 4. Small particle burst in the quest difficulty color
   */
  questReward(
    x: number,
    y: number,
    difficulty: QuestDifficulty,
    xpAmount: number,
    creditAmount: number,
  ): void {
    const diffColor = DIFFICULTY_COLORS[difficulty] ?? 0x3b82f6
    const diffHex = '#' + diffColor.toString(16).padStart(6, '0')

    // 1. Coin sprite — pop up with bounce, float upward, fade out
    const coin = this._scene.add.sprite(
      x, y - 16,
      SPRITESHEET_KEYS.LEGO_SPECIALS,
      LEGO_SPECIAL_FRAMES.COIN,
    ).setScale(0).setOrigin(0.5).setAlpha(0).setDepth(602)

    this._scene.tweens.add({
      targets: coin,
      alpha: 1,
      scaleX: 0.78,
      scaleY: 0.78,
      y: y - 28,
      duration: 250,
      ease: 'Back.easeOut',
      onComplete: () => {
        // Settle to normal scale then drift up and fade
        this._scene.tweens.add({
          targets: coin,
          scaleX: 0.6,
          scaleY: 0.6,
          duration: 120,
          ease: 'Sine.easeOut',
          onComplete: () => {
            this._scene.tweens.add({
              targets: coin,
              alpha: 0,
              y: y - 56,
              duration: 600,
              ease: 'Power2',
              delay: 400,
              onComplete: () => coin.destroy(),
            })
          },
        })
      },
    })

    // 2. Epic/legendary: also show explosive crate sprite offset to the right
    if (difficulty === 'epic' || difficulty === 'legendary') {
      const crate = this._scene.add.sprite(
        x + 14, y - 12,
        SPRITESHEET_KEYS.LEGO_SPECIALS,
        LEGO_SPECIAL_FRAMES.EXPLOSIVE,
      ).setScale(0).setOrigin(0.5).setAlpha(0).setDepth(602)

      this._scene.tweens.add({
        targets: crate,
        alpha: 0.9,
        scaleX: 0.65,
        scaleY: 0.65,
        y: y - 24,
        duration: 300,
        ease: 'Back.easeOut',
        delay: 100,
        onComplete: () => {
          this._scene.tweens.add({
            targets: crate,
            alpha: 0,
            y: y - 50,
            scaleX: 0.3,
            scaleY: 0.3,
            duration: 500,
            ease: 'Power2',
            delay: 500,
            onComplete: () => crate.destroy(),
          })
        },
      })
    }

    // 3. Rising XP text
    this._scene.time.delayedCall(120, () => {
      this._risingText(x, y - 6, `+${xpAmount} XP`, {
        fontSize: '10px',
        fontFamily: 'monospace',
        color: diffHex,
        stroke: '#000000',
        strokeThickness: 2,
        resolution: 2,
      })
    })

    // Rising credits text — offset below XP text, slightly delayed
    this._scene.time.delayedCall(250, () => {
      this._risingText(x, y + 4, `+${creditAmount}c`, {
        fontSize: '9px',
        fontFamily: 'monospace',
        color: '#fbbf24',
        stroke: '#000000',
        strokeThickness: 2,
        resolution: 2,
      })
    })

    // 4. Particle burst in difficulty color
    this._particleBurst(x, y - 16, 6, diffColor, 32)
  }

  /**
   * Brief gold sparkle burst on a workstation when the user approves a tool call.
   * 8-12 particles radiate outward with upward drift, shrink and fade over 500ms.
   */
  approveSparkle(x: number, y: number): void {
    soundEngine.click()
    const count = 8 + Math.floor(Math.random() * 5) // 8-12
    for (let i = 0; i < count; i++) {
      const p = this._sparklePool.find(c => !c.getData('busy'))
      if (!p) continue
      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.5
      const dist = 12 + Math.random() * 16
      p.setPosition(x, y - 14)
      p.setFillStyle(0xfbbf24) // gold/yellow
      p.setRadius(1.2 + Math.random() * 1.2)
      p.setAlpha(0.9).setScale(1).setVisible(true).setData('busy', true)
      this._scene.tweens.add({
        targets: p,
        x: x + Math.cos(angle) * dist,
        y: (y - 14) + Math.sin(angle) * dist - 8, // slight upward drift
        alpha: 0,
        scaleX: 0,
        scaleY: 0,
        duration: 400 + Math.random() * 150,
        ease: 'Power2',
        onComplete: () => { p.setVisible(false).setData('busy', false) },
      })
    }
  }

  /**
   * Simple XP gain floating number with a Grade A sprite accent.
   * Shows a small GRADE_A sprite at the origin and a rising "+{amount}" text.
   * Subtle upward drift over 1.2 seconds, fading out.
   */
  xpGain(x: number, y: number, amount: number, color: number = 0x34d399): void {
    const hexColor = '#' + color.toString(16).padStart(6, '0')

    // Grade A sprite — small accent at the origin
    const badge = this._scene.add.sprite(
      x - 12, y - 14,
      SPRITESHEET_KEYS.LEGO_SPECIALS,
      LEGO_SPECIAL_FRAMES.GRADE_A,
    ).setScale(0.3).setOrigin(0.5).setAlpha(0).setDepth(601)

    this._scene.tweens.add({
      targets: badge,
      alpha: 0.8,
      scaleX: 0.3,
      scaleY: 0.3,
      duration: 180,
      ease: 'Back.easeOut',
      onComplete: () => {
        this._scene.tweens.add({
          targets: badge,
          alpha: 0,
          y: y - 40,
          duration: 1000,
          ease: 'Power1',
          delay: 200,
          onComplete: () => badge.destroy(),
        })
      },
    })

    // Rising "+amount" text
    const txt = this._scene.add.text(x, y - 14, `+${amount}`, {
      fontSize: '10px',
      fontFamily: 'monospace',
      color: hexColor,
      stroke: '#000000',
      strokeThickness: 2,
      resolution: 2,
    }).setOrigin(0.5).setAlpha(0).setDepth(601)

    this._scene.tweens.add({
      targets: txt,
      alpha: 1,
      y: y - 22,
      duration: 200,
      ease: 'Power2',
      onComplete: () => {
        this._scene.tweens.add({
          targets: txt,
          alpha: 0,
          y: y - 48,
          duration: 1000,
          ease: 'Power1',
          delay: 200,
          onComplete: () => txt.destroy(),
        })
      },
    })
  }

  /**
   * Release all pooled objects. Call when the scene shuts down.
   */
  destroy(): void {
    for (const p of this._burstPool) { this._scene.tweens.killTweensOf(p); p.destroy() }
    this._burstPool = []
    for (const g of this._confettiPool) { this._scene.tweens.killTweensOf(g); g.destroy() }
    this._confettiPool = []
    for (const s of this._sparklePool) { this._scene.tweens.killTweensOf(s); s.destroy() }
    this._sparklePool = []
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Spawn N confetti pieces from the top of the screen, falling down.
   * Screen-space (scrollFactor 0 graphics are world-positioned but this
   * uses the existing pool which is world-space — we convert).
   */
  private _screenConfetti(count: number): void {
    const cam = this._scene.cameras.main
    // Spawn confetti across the top of the viewport, in world coords
    const topY = cam.scrollY - 10
    const leftX = cam.scrollX
    const width = cam.width

    let spawned = 0
    for (const g of this._confettiPool) {
      if (spawned >= count) break
      if (g.getData('busy')) continue
      const color = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)]
      const w = 3 + Math.random() * 5
      const h = 2 + Math.random() * 3
      g.clear()
      g.fillStyle(color, 1)
      g.fillRect(-w / 2, -h / 2, w, h)
      const startX = leftX + Math.random() * width
      g.setPosition(startX, topY - Math.random() * 40)
      g.setAngle(Math.random() * 360)
      g.setAlpha(1).setVisible(true).setData('busy', true)

      const driftX = (Math.random() - 0.5) * 120
      const fallY = cam.height + 40 + Math.random() * 80
      const spinEnd = g.angle + (Math.random() - 0.5) * 720
      const dur = 1400 + Math.random() * 800

      this._scene.tweens.add({
        targets: g,
        x: g.x + driftX,
        y: g.y + fallY,
        angle: spinEnd,
        alpha: 0,
        duration: dur,
        ease: 'Power1',
        onComplete: () => { g.setVisible(false).setData('busy', false) },
      })
      spawned++
    }
  }

  /** Spawn N confetti rectangles from (x, y) that fall with gravity + random drift. */
  private _confetti(x: number, y: number, count: number): void {
    let spawned = 0
    for (const g of this._confettiPool) {
      if (spawned >= count) break
      if (g.getData('busy')) continue
      const color = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)]
      const w = 3 + Math.random() * 4
      const h = 2 + Math.random() * 3
      g.clear()
      g.fillStyle(color, 1)
      g.fillRect(-w / 2, -h / 2, w, h)
      g.setPosition(x + (Math.random() - 0.5) * 30, y - 10)
      g.setAngle(Math.random() * 360)
      g.setAlpha(1).setVisible(true).setData('busy', true)

      const driftX = (Math.random() - 0.5) * 80
      const fallY = 90 + Math.random() * 60
      const spinEnd = g.angle + (Math.random() - 0.5) * 720
      const dur = 900 + Math.random() * 600

      this._scene.tweens.add({
        targets: g,
        x: g.x + driftX,
        y: g.y + fallY,
        angle: spinEnd,
        alpha: 0,
        duration: dur,
        ease: 'Power1',
        onComplete: () => { g.setVisible(false).setData('busy', false) },
      })
      spawned++
    }
  }

  /**
   * Burst N circles radiating outward from (x, y) in a uniform circle.
   * Uses the pre-allocated burst pool.
   */
  private _particleBurst(x: number, y: number, count: number, color: number, radius: number): void {
    let spawned = 0
    for (const p of this._burstPool) {
      if (spawned >= count) break
      if (p.getData('busy')) continue
      const angle = (spawned / count) * Math.PI * 2
      const jitter = (Math.random() - 0.5) * 0.35
      const finalAngle = angle + jitter
      const dist = radius * (0.7 + Math.random() * 0.6)
      const r = 1.5 + Math.random() * 2.5
      p.setPosition(x, y)
      p.setFillStyle(color)
      p.setRadius(r)
      p.setAlpha(1).setVisible(true).setData('busy', true)

      this._scene.tweens.add({
        targets: p,
        x: x + Math.cos(finalAngle) * dist,
        y: y + Math.sin(finalAngle) * dist,
        alpha: 0,
        scaleX: 0.3,
        scaleY: 0.3,
        duration: 480 + Math.random() * 200,
        ease: 'Power2',
        onComplete: () => { p.setVisible(false).setData('busy', false) },
      })
      spawned++
    }
  }

  /**
   * Create a text object at (x, y) that floats upward and fades out,
   * then destroys itself. Not pooled — these are short-lived.
   */
  private _risingText(
    x: number,
    y: number,
    text: string,
    style: Partial<Phaser.Types.GameObjects.Text.TextStyle>,
  ): void {
    const obj = this._scene.add.text(x, y, text, {
      ...style,
    } as Phaser.Types.GameObjects.Text.TextStyle)
      .setOrigin(0.5)
      .setAlpha(0)
      .setDepth(600)

    const targetY = y - 42
    this._scene.tweens.add({
      targets: obj,
      alpha: 1,
      y: y - 10,
      duration: 200,
      ease: 'Power2',
      onComplete: () => {
        this._scene.tweens.add({
          targets: obj,
          alpha: 0,
          y: targetY,
          duration: 500,
          ease: 'Power1',
          delay: 600,
          onComplete: () => obj.destroy(),
        })
      },
    })
  }

  /** Expanding ring — a Graphics circle that grows from center and fades. */
  private _expandingRing(x: number, y: number, color: number): void {
    const gfx = this._scene.add.graphics().setDepth(598)
    let progress = 0

    this._scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 520,
      ease: 'Power2',
      onUpdate: (tween) => {
        progress = tween.getValue() ?? 0
        const currentRadius = 6 + progress * 52
        const alpha = (1 - progress) * 0.85
        gfx.clear()
        gfx.lineStyle(2.5 * (1 - progress * 0.6), color, alpha)
        gfx.strokeCircle(x, y, currentRadius)
      },
      onComplete: () => gfx.destroy(),
    })
  }

  /**
   * Very brief screen-space flash overlay. Uses the Flash VFX sprite if loaded,
   * with a subtle graphics overlay as supplement.
   */
  private _screenFlash(color: number): void {
    const cam = this._scene.cameras.main

    // Graphics overlay (keeps the color tint)
    const flash = this._scene.add.graphics()
      .setScrollFactor(0)
      .setDepth(9999)
    flash.fillStyle(color, 0.10)
    flash.fillRect(0, 0, cam.width, cam.height)
    flash.setAlpha(1)

    this._scene.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 160,
      ease: 'Power2',
      delay: 50,
      onComplete: () => flash.destroy(),
    })

    // Sprite flash VFX at screen center
    if (this._scene.anims.exists(EFFECT_ANIM_KEYS.FLASH)) {
      const flashSprite = this._scene.add.sprite(cam.width / 2, cam.height / 2, SPRITESHEET_KEYS.EFFECTS_FLASH)
        .setScrollFactor(0)
        .setDepth(9998)
        .setScale(1.5)
        .setAlpha(0.35)
        .setTint(color)
        .setBlendMode(Phaser.BlendModes.ADD)
      flashSprite.play(EFFECT_ANIM_KEYS.FLASH)
      flashSprite.once('animationcomplete', () => flashSprite.destroy())
    }
  }

  // ---------------------------------------------------------------------------
  // Pool initialization
  // ---------------------------------------------------------------------------

  private _initBurstPool(): void {
    for (let i = 0; i < BURST_POOL_SIZE; i++) {
      const p = this._scene.add.circle(0, 0, 2, 0xffffff, 1)
        .setDepth(599)
        .setVisible(false)
        .setBlendMode(Phaser.BlendModes.ADD)
      p.setData('busy', false)
      this._burstPool.push(p)
    }
  }

  private _initConfettiPool(): void {
    for (let i = 0; i < CONFETTI_POOL_SIZE; i++) {
      const g = this._scene.add.graphics()
        .setDepth(597)
        .setVisible(false)
      g.setData('busy', false)
      this._confettiPool.push(g)
    }
  }

  private _initSparklePool(): void {
    for (let i = 0; i < SPARKLE_POOL_SIZE; i++) {
      const p = this._scene.add.circle(0, 0, 1.5, 0x34d399, 1)
        .setDepth(601)
        .setVisible(false)
        .setBlendMode(Phaser.BlendModes.ADD)
      p.setData('busy', false)
      this._sparklePool.push(p)
    }
  }
}
