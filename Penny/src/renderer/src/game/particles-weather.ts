import Phaser from 'phaser'
import { SPRITESHEET_KEYS, EFFECT_ANIM_KEYS } from './office-asset-keys'

// ---------------------------------------------------------------------------
// WeatherParticles — rain and snow screen-space overlay pools
// Extracted from OfficeParticles (office-particles.ts)
// ---------------------------------------------------------------------------

export class WeatherParticles {
  private scene: Phaser.Scene

  private rainDropPool: Phaser.GameObjects.Line[] = []
  private rainActive = false

  private snowPool: Phaser.GameObjects.Arc[] = []
  private snowActive = false

  // Lightning flash timing
  private lastLightningAt = 0
  private lightningInterval = 8000 + Math.random() * 12000 // 8-20s between strikes

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  // ---------------------------------------------------------------------------
  // Initialisation
  // ---------------------------------------------------------------------------

  init(viewWidth: number, viewHeight: number): void {
    this.initRainPool(viewWidth, viewHeight)
    this.initSnowPool(viewWidth, viewHeight)
  }

  // ---------------------------------------------------------------------------
  // Rain pool (screen-space)
  // ---------------------------------------------------------------------------

  private initRainPool(viewWidth: number, viewHeight: number): void {
    const RAIN_COUNT = 40
    for (let i = 0; i < RAIN_COUNT; i++) {
      const len = 8 + Math.random() * 6
      const alpha = 0.15 + Math.random() * 0.10
      const speed = 3 + Math.random() * 2
      const x = Math.random() * viewWidth
      const y = Math.random() * viewHeight
      const drop = this.scene.add.line(0, 0, x, y, x + 1, y + len, 0x60a5fa, alpha)
      drop.setOrigin(0, 0)
      drop.setLineWidth(1)
      drop.setDepth(9990)
      drop.setScrollFactor(0)
      drop.setVisible(false)
      drop.setData('speed', speed)
      this.rainDropPool.push(drop)
    }
  }

  tickRain(viewWidth: number, viewHeight: number): void {
    for (const drop of this.rainDropPool) {
      if (!drop.visible) continue
      const speed = drop.getData('speed') as number
      drop.x += 1
      drop.y += speed
      const y1 = drop.geom.y1
      if (drop.y + y1 > viewHeight + 16) {
        drop.x = Math.random() * viewWidth
        drop.y = -16 - Math.random() * 80
      }
    }

    // Occasional lightning flash during rain
    if (this.rainActive) {
      const now = this.scene.time.now
      if (now - this.lastLightningAt > this.lightningInterval) {
        this.lastLightningAt = now
        this.lightningInterval = 8000 + Math.random() * 12000
        this.triggerLightningFlash(viewWidth, viewHeight)
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Lightning flash — screen flash VFX during rainstorms
  // ---------------------------------------------------------------------------

  private triggerLightningFlash(viewWidth: number, viewHeight: number): void {
    const cam = this.scene.cameras.main

    // White screen flash overlay
    const flash = this.scene.add.graphics()
      .setScrollFactor(0)
      .setDepth(9999)
    flash.fillStyle(0xffffff, 0.08)
    flash.fillRect(0, 0, cam.width, cam.height)
    flash.setAlpha(1)

    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 120,
      ease: 'Power2',
      delay: 30,
      onComplete: () => flash.destroy(),
    })

    // Flash VFX sprite at a random screen position (upper half)
    if (this.scene.anims.exists(EFFECT_ANIM_KEYS.FLASH)) {
      const flashX = cam.width * (0.2 + Math.random() * 0.6)
      const flashY = cam.height * (0.1 + Math.random() * 0.3)
      const flashSprite = this.scene.add.sprite(flashX, flashY, SPRITESHEET_KEYS.EFFECTS_FLASH)
        .setScrollFactor(0)
        .setDepth(9998)
        .setScale(0.4 + Math.random() * 0.1)
        .setAlpha(0.15)
        .setTint(0xc0d8ff)
        .setBlendMode(Phaser.BlendModes.ADD)
      flashSprite.play(EFFECT_ANIM_KEYS.FLASH)
      flashSprite.once('animationcomplete', () => flashSprite.destroy())
    }

    // Double-strike: 30% chance of a second flash shortly after
    if (Math.random() < 0.3) {
      this.scene.time.delayedCall(100 + Math.random() * 80, () => {
        const flash2 = this.scene.add.graphics()
          .setScrollFactor(0)
          .setDepth(9999)
        flash2.fillStyle(0xffffff, 0.05)
        flash2.fillRect(0, 0, cam.width, cam.height)
        this.scene.tweens.add({
          targets: flash2,
          alpha: 0,
          duration: 80,
          ease: 'Power2',
          onComplete: () => flash2.destroy(),
        })
      })
    }
  }

  // ---------------------------------------------------------------------------
  // Snow pool (screen-space)
  // ---------------------------------------------------------------------------

  private initSnowPool(viewWidth: number, viewHeight: number): void {
    const SNOW_COUNT = 30
    for (let i = 0; i < SNOW_COUNT; i++) {
      const radius = 1 + Math.random() * 1.5
      const alpha = 0.2 + Math.random() * 0.2
      const flake = this.scene.add.circle(Math.random() * viewWidth, Math.random() * viewHeight, radius, 0xffffff, alpha)
      flake.setScrollFactor(0)
      flake.setDepth(9989)
      flake.setVisible(false)
      flake.setData('speed', 1 + Math.random())
      this.snowPool.push(flake)
    }
  }

  tickSnow(time: number, viewWidth: number, viewHeight: number): void {
    for (let i = 0; i < this.snowPool.length; i++) {
      const flake = this.snowPool[i]
      if (!flake.visible) continue
      const speed = flake.getData('speed') as number
      flake.y += speed
      flake.x += Math.sin(time * 0.001 + i) * 0.5
      if (flake.y > viewHeight + 4) {
        flake.x = Math.random() * viewWidth
        flake.y = -4 - Math.random() * 40
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Weather control (called from applyDayNightPhase in OfficeScene)
  // ---------------------------------------------------------------------------

  setWeather(phase: 'morning' | 'day' | 'evening' | 'night', viewWidth: number, viewHeight: number): void {
    const shouldRain = phase === 'night'
    if (shouldRain !== this.rainActive) {
      this.rainActive = shouldRain
      for (const drop of this.rainDropPool) {
        if (shouldRain) {
          drop.x = Math.random() * viewWidth
          drop.y = -16 - Math.random() * viewHeight
          drop.setVisible(true)
        } else {
          drop.setVisible(false)
        }
      }
    }

    const shouldSnow = phase === 'morning'
    if (shouldSnow !== this.snowActive) {
      this.snowActive = shouldSnow
      for (const flake of this.snowPool) {
        if (shouldSnow) {
          flake.x = Math.random() * viewWidth
          flake.y = Math.random() * viewHeight
          flake.setVisible(true)
        } else {
          flake.setVisible(false)
        }
      }
    }
  }

  isRainActive(): boolean { return this.rainActive }
  isSnowActive(): boolean { return this.snowActive }

  // ---------------------------------------------------------------------------
  // Destroy / cleanup
  // ---------------------------------------------------------------------------

  destroy(): void {
    for (const d of this.rainDropPool) d.destroy()
    this.rainDropPool = []
    this.rainActive = false

    for (const f of this.snowPool) f.destroy()
    this.snowPool = []
    this.snowActive = false
  }
}
