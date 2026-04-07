// ---------------------------------------------------------------------------
// office-broadcast.ts
// PA system broadcast banner — marquee text + LED pulse on all room status LEDs.
// Triggered when the user broadcasts a message to all agents.
// ---------------------------------------------------------------------------

import Phaser from 'phaser'
import { ICON_FRAMES, EFFECT_ANIM_KEYS, SPRITESHEET_KEYS } from './office-asset-keys'
import type { Room } from './office-types'
import { scaledFontSize } from './office-constants'

export class OfficeBroadcast {
  private scene: Phaser.Scene

  private bannerContainer: Phaser.GameObjects.Container | null = null
  private bannerBg: Phaser.GameObjects.Rectangle | null = null
  private bannerText: Phaser.GameObjects.Text | null = null
  private scrollTween: Phaser.Tweens.Tween | null = null
  private fadeTimer: Phaser.Time.TimerEvent | null = null
  private ledTimer: Phaser.Time.TimerEvent | null = null

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  /**
   * Displays a marquee banner below the status bar and pulses all room LEDs
   * amber — triggered whenever the user broadcasts a message to all agents.
   */
  showBroadcastEffect(message: string, getRooms: () => Map<string, Room>): void {
    const viewW = this.scene.scale.width
    const BANNER_Y = 28
    const BANNER_H = 30
    const BANNER_COLOR = 0x0f172a
    const BANNER_ALPHA = 0.9
    const TEXT_COLOR = '#fbbf24'
    const DURATION_MS = 5000
    const FADE_MS = 400

    // Tear down any existing broadcast banner before creating a new one
    this._destroyBanner()

    // Container pinned to screen space (ignores camera scroll)
    this.bannerContainer = this.scene.add.container(0, BANNER_Y)
      .setDepth(9999)
      .setScrollFactor(0)

    // Dark background strip
    this.bannerBg = this.scene.add.rectangle(0, 0, viewW, BANNER_H, BANNER_COLOR, BANNER_ALPHA)
      .setOrigin(0, 0)
    this.bannerContainer.add(this.bannerBg)

    // Mako green accent line at the top edge of the banner
    const accentLine = this.scene.add.rectangle(0, 0, viewW, 2, 0x00ff88, 0.7).setOrigin(0, 0)
    this.bannerContainer.add(accentLine)

    // Subtle flash VFX at screen center when broadcast starts
    this._playBroadcastFlash(viewW)

    // Scrolling text — starts just off the right edge, scrolls to past the left edge
    const label = '\u{1F4E2}  BROADCAST:  ' + message
    this.bannerText = this.scene.add.text(viewW + 10, BANNER_H / 2, label, {
      fontSize: scaledFontSize(10),
      fontFamily: 'ui-monospace, monospace',
      color: TEXT_COLOR,
      resolution: 2,
    }).setOrigin(0, 0.5)
    this.bannerContainer.add(this.bannerText)

    // Marquee: scroll the text from right to left over the active duration
    const textW = this.bannerText.width
    this.scrollTween = this.scene.tweens.add({
      targets: this.bannerText,
      x: -(textW + 10),
      duration: DURATION_MS - FADE_MS,
      ease: 'Linear',
    })

    // Pulse all room status LEDs amber 3 times (6 timer ticks: on/off x3)
    let pulseCount = 0
    this.ledTimer = this.scene.time.addEvent({
      delay: 500,
      repeat: 5,
      callback: () => {
        pulseCount++
        const isOn = pulseCount % 2 === 1
        const rooms = getRooms()
        for (const room of rooms.values()) {
          if (isOn) {
            room.statusLed.setFrame(ICON_FRAMES.CIRCLE_YELLOW)
            room.statusLedGlow?.setFrame(ICON_FRAMES.CIRCLE_YELLOW)
            room.statusLedGlow?.setAlpha(0.4)
          } else {
            const restoreFrame =
              room.ledMode === 'active'  ? ICON_FRAMES.CIRCLE_GREEN :
              room.ledMode === 'waiting' ? ICON_FRAMES.CIRCLE_YELLOW : ICON_FRAMES.CIRCLE_GREY
            room.statusLed.setFrame(restoreFrame)
            room.statusLedGlow?.setFrame(restoreFrame)
            room.statusLedGlow?.setAlpha(0.25)
          }
        }
      },
    })

    // After the scroll completes, fade the banner out then destroy it
    this.fadeTimer = this.scene.time.delayedCall(DURATION_MS - FADE_MS, () => {
      if (!this.bannerContainer) return
      this.scene.tweens.add({
        targets: this.bannerContainer,
        alpha: 0,
        duration: FADE_MS,
        ease: 'Sine.easeIn',
        onComplete: () => this._destroyBanner(),
      })
    })
  }

  /**
   * Plays a subtle flash sprite at the screen center when a broadcast begins.
   * The flash auto-destroys after the animation completes.
   */
  private _playBroadcastFlash(viewW: number): void {
    const flashKey = SPRITESHEET_KEYS.EFFECTS_FLASH
    if (!this.scene.textures.exists(flashKey)) return

    const flash = this.scene.add.sprite(viewW / 2, this.scene.scale.height / 2, flashKey)
      .setScrollFactor(0)
      .setDepth(10000)
      .setScale(0.3)
      .setAlpha(0.1)

    if (this.scene.anims.exists(EFFECT_ANIM_KEYS.FLASH)) {
      flash.play(EFFECT_ANIM_KEYS.FLASH)
      flash.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => flash.destroy())
    } else {
      // No animation registered — just fade and destroy
      this.scene.tweens.add({
        targets: flash,
        alpha: 0,
        duration: 300,
        onComplete: () => flash.destroy(),
      })
    }
  }

  private _destroyBanner(): void {
    if (this.scrollTween)    { this.scrollTween.destroy();    this.scrollTween    = null }
    if (this.fadeTimer)      { this.fadeTimer.destroy();      this.fadeTimer       = null }
    if (this.ledTimer)       { this.ledTimer.destroy();       this.ledTimer        = null }
    if (this.bannerContainer) {
      this.scene.tweens.killTweensOf(this.bannerContainer)
      this.bannerContainer.destroy(true)
      this.bannerContainer = null
    }
    this.bannerBg   = null
    this.bannerText = null
  }

  destroy(): void {
    this._destroyBanner()
  }
}
