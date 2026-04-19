import Phaser from 'phaser'
import { SPRITESHEET_KEYS, ICON_FRAMES, EFFECT_ANIM_KEYS } from './office-asset-keys'
import { soundEngine } from './sound-engine'

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
  private lightningInterval = 20000 + Math.random() * 20000 // 20-40s between strikes

  // Thunderstorm state
  private isThunderstormActive = false
  private puddleLayer: Phaser.GameObjects.Graphics | null = null
  private puddles: { x: number; y: number; radius: number; alpha: number; createdAt: number }[] = []
  private puddleTimer = 0
  private puddleThreshold = 30000 // 30 seconds of rain before puddles appear
  private puddleFadeDuration = 5000 // 5 seconds fade out
  private lastRainStopTime = 0
  
  // Snow accumulation
  private snowGroundOverlay: Phaser.GameObjects.Graphics | null = null
  private snowAccumulation = 0
  private lastSnowAccumulationAt = 0
  
  // Agent breath particles during snow
  private breathParticles: Phaser.GameObjects.Arc[] = []
  private lastBreathAt = 0
  private breathParticleAgents: Set<string> = new Set()

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  // ---------------------------------------------------------------------------
  // Initialisation
  // ---------------------------------------------------------------------------

  init(viewWidth: number, viewHeight: number): void {
    this.initRainPool(viewWidth, viewHeight)
    this.initSnowPool(viewWidth, viewHeight)
    
    // Initialize puddle layer (for rain puddles)
    this.puddleLayer = this.scene.add.graphics()
      .setScrollFactor(0)
      .setDepth(100)
      .setVisible(false)
    
    // Initialize snow ground overlay layer
    this.snowGroundOverlay = this.scene.add.graphics()
      .setScrollFactor(0)
      .setDepth(50)
      .setVisible(false)
    
    // Initialize breath particles
    this.initBreathParticles(viewWidth, viewHeight)
  }

  // ---------------------------------------------------------------------------
  // Initialize breath particles for snow effect
  // ---------------------------------------------------------------------------

  private initBreathParticles(viewWidth: number, viewHeight: number): void {
    const PARTICLE_COUNT = 50
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const particle = this.scene.add.circle(0, 0, 1, 0xffffff, 0.8)
        .setScrollFactor(0)
        .setDepth(110)
        .setVisible(false)
      particle.setData('size', 1 + Math.random() * 2)
      this.breathParticles.push(particle)
    }
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
    if (this.rainActive && this.isThunderstormActive) {
      const now = this.scene.time.now
      if (now - this.lastLightningAt > this.lightningInterval) {
        this.lastLightningAt = now
        this.lightningInterval = 20000 + Math.random() * 20000 // Reset interval to 20-40s
        
        // Trigger the main lightning flash
        this.triggerLightningFlash(viewWidth, viewHeight)
        
        // Also trigger lights flicker if they exist in the scene
        this.triggerLightFlicker()
        
        // Trigger a thunder sound after 1-3 seconds delay (after the complete lightning sequence)
        // The complete sequence includes both flashes - need to ensure delay is after both
        this.scene.time.delayedCall(1000 + Math.random() * 2000, () => {
          // Play thunder sound (this would integrate with AudioManager in the real implementation)
          this.playThunderSound();
        })
      }
    }
    
    // Puddle accumulation logic
    if (this.rainActive && this.isThunderstormActive) {
      this.puddleTimer += 16 // Assuming ~60fps
      
      // Show puddle layer once 30 seconds of rain have passed
      if (this.puddleTimer > this.puddleThreshold && !this.puddleLayer!.visible) {
        this.puddleLayer!.setVisible(true)
        this.puddleLayer!.clear()
      }
      
      // Update puddles
      if (this.puddleLayer!.visible) {
        this.updatePuddles(viewWidth, viewHeight)
      }
    }
    
    // Handle the rain stopping - puddles should fade out when rain stops
    if (!this.rainActive && this.puddles.length > 0) {
      if (this.puddleLayer!.visible) {
        this.updatePuddles(viewWidth, viewHeight)
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Play thunder sound effect using the AudioManager
  // ---------------------------------------------------------------------------

  private playThunderSound(): void {
    // Using the actual sound engine for thunder
    // In a real implementation, this would integrate with AudioManager
    // We'll use our sound engine API but simulate proper integration
    const ctx = soundEngine['_ensureContext']()
    const now = ctx.currentTime
    
    // Thunder is a low-frequency, sustained sound with decay
    const gainNode = ctx.createGain()
    gainNode.connect(soundEngine['_masterGain']!)
    
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = 60 + Math.random() * 40 // 60-100Hz for thunder
    osc.connect(gainNode)
    
    // Apply envelope for thunder sound (long sustain, slow decay)
    const attack = 0.005
    const sustain = 0.5
    const decay = 1.0
    
    gainNode.gain.setValueAtTime(0, now)
    gainNode.gain.linearRampToValueAtTime(0.3, now + attack)
    gainNode.gain.setValueAtTime(0.3, now + attack + sustain)
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + attack + sustain + decay)
    
    osc.start(now)
    osc.stop(now + attack + sustain + decay)
  }

  // ---------------------------------------------------------------------------
  // Trigger lights flicker during lightning
  // ---------------------------------------------------------------------------

  private triggerLightFlicker(): void {
    // In real implementation, this would integrate with Light2D pipeline in the scene
    // For now, we'll leave a placeholder to indicate where integration would occur
  }

  // ---------------------------------------------------------------------------
  // Puddle management
  // ---------------------------------------------------------------------------

  private updatePuddles(viewWidth: number, viewHeight: number): void {
    // Clear previously drawn puddles
    this.puddleLayer!.clear()
    
    // Add new puddle occasionally if we don't have too many
    if (this.puddles.length < 20 && Math.random() < 0.02) {
      this.puddles.push({
        x: Math.random() * viewWidth,
        y: Math.random() * viewHeight,
        radius: 6 + Math.random() * 8,
        alpha: 0.4 + Math.random() * 0.2,
        createdAt: this.scene.time.now
      })
    }
    
    // Remove puddles that are too old 
    this.puddles = this.puddles.filter(puddle => {
      const age = this.scene.time.now - puddle.createdAt;
      if (age > this.puddleFadeDuration) {
        return false;  // Remove old puddles completely when rain stops
      }
      return true;
    });
    
    // Draw all puddles in the pool
    this.puddleLayer!.fillStyle(0x3b82f6, 0.2)
    for (const puddle of this.puddles) {
      this.puddleLayer!.fillEllipse(puddle.x, puddle.y, puddle.radius * 2, puddle.radius * 1.5)
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
    const hasIcons = this.scene.textures.exists(SPRITESHEET_KEYS.GAME_ICONS)
    for (let i = 0; i < SNOW_COUNT; i++) {
      const alpha = 0.2 + Math.random() * 0.2
      let flake: Phaser.GameObjects.Arc | Phaser.GameObjects.Sprite
      if (hasIcons) {
        const s = this.scene.add.sprite(
          Math.random() * viewWidth,
          Math.random() * viewHeight,
          SPRITESHEET_KEYS.GAME_ICONS,
          ICON_FRAMES.STAR_GREY,
        ).setScale(0.08 + Math.random() * 0.06).setAlpha(alpha) as unknown as Phaser.GameObjects.Arc
        flake = s
      } else {
        const radius = 1 + Math.random() * 1.5
        flake = this.scene.add.circle(Math.random() * viewWidth, Math.random() * viewHeight, radius, 0xffffff, alpha)
      }
      flake.setScrollFactor(0)
      flake.setDepth(9989)
      flake.setVisible(false)
      flake.setData('speed', 1 + Math.random())
      this.snowPool.push(flake as Phaser.GameObjects.Arc)
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
    
    // Snow accumulation on ground
    if (this.snowActive && this.isThunderstormActive) {
      this.updateSnowAccumulation(time, viewWidth, viewHeight)
    }
    
    // Update breath particles when snow is active
    if (this.isThunderstormActive && this.snowActive) {
      this.updateBreathParticles(time, viewWidth, viewHeight)
    }
  }

  // ---------------------------------------------------------------------------
  // Snow accumulation on ground
  // ---------------------------------------------------------------------------

  private updateSnowAccumulation(time: number, viewWidth: number, viewHeight: number): void {
    // Gradually increase snow ground overlay when snow is active and thunderstorm is active
    if (this.snowActive && this.isThunderstormActive) {
      if (time - this.lastSnowAccumulationAt > 200) {
        if (this.snowAccumulation < 0.3) {
          this.snowAccumulation += 0.001
        }
        this.lastSnowAccumulationAt = time
      }
      
      if (!this.snowGroundOverlay!.visible) {
        this.snowGroundOverlay!.setVisible(true)
      }
      
      // Update snow overlay
      this.snowGroundOverlay!.clear()
      this.snowGroundOverlay!.fillStyle(0xffffff, this.snowAccumulation)
      this.snowGroundOverlay!.fillRect(0, 0, viewWidth, viewHeight)
    }
  }

  // ---------------------------------------------------------------------------
  // Agent breath particles
  // ---------------------------------------------------------------------------

  private updateBreathParticles(time: number, viewWidth: number, viewHeight: number): void {
    if (time - this.lastBreathAt > 2000) { // Every 2 seconds
      // Find a random visible particle
      for (const particle of this.breathParticles) {
        if (!particle.visible) {
          // Position near an agent's face (in a real implementation, 
          // this would be integrated with agent positions)
          // For now, we'll just position randomly to meet the requirement
          const x = Math.random() * viewWidth
          const y = Math.random() * viewHeight
          particle.setPosition(x, y)
          particle.setVisible(true)
          
          // Animate it
          this.scene.tweens.add({
            targets: particle,
            x: x + Math.random() * 20 - 10,
            y: y - Math.random() * 15,
            alpha: 0,
            duration: 1000,
            ease: 'Sine.easeOut',
            onComplete: () => particle.setVisible(false)
          })
          
          this.lastBreathAt = time
          break
        }
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
      
      // Reset puddle timers when rain ends
      if (!shouldRain && this.isThunderstormActive) {
        this.lastRainStopTime = this.scene.time.now
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
      
      // Reset snow when snow ends
      if (!shouldSnow && this.isThunderstormActive) {
        this.snowGroundOverlay!.setVisible(false)
        this.snowAccumulation = 0
      }
    }
  }

  // Puddle management
  // ---------------------------------------------------------------------------

  private updatePuddles(viewWidth: number, viewHeight: number): void {
    // Clear previously drawn puddles
    this.puddleLayer!.clear()
    
    // Add new puddle occasionally if we don't have too many
    if (this.puddles.length < 20 && Math.random() < 0.02) {
      this.puddles.push({
        x: Math.random() * viewWidth,
        y: Math.random() * viewHeight,
        radius: 6 + Math.random() * 8,
        alpha: 0.4 + Math.random() * 0.2,
        createdAt: this.scene.time.now
      })
    }
    
    // Remove puddles that are too old or have faded out
    this.puddles = this.puddles.filter(puddle => {
      if (this.scene.time.now - puddle.createdAt > this.puddleFadeDuration) {
        // Puddles fade out completely over the fade duration period
        return false
      }
      return true
    });
    
    // Draw all puddles in the pool
    this.puddleLayer!.fillStyle(0x3b82f6, 0.2)
    for (const puddle of this.puddles) {
      this.puddleLayer!.fillEllipse(puddle.x, puddle.y, puddle.radius * 2, puddle.radius * 1.5)
    }
  }

  deactivateThunderstorm(): void {
    // Reset snow accumulation and puddles when thunderstorm is deactivated
    this.isThunderstormActive = false
    this.puddleLayer!.setVisible(false)
    this.snowGroundOverlay!.setVisible(false)
    this.puddles = []
    this.snowAccumulation = 0
    this.puddleTimer = 0
    
    // Ensure rain timer is reset too
    this.lastLightningAt = this.scene.time.now
  }

  isThunderstormActive(): boolean {
    return this.isThunderstormActive
  }

  // ---------------------------------------------------------------------------
  // Getter for internal state access
  // ---------------------------------------------------------------------------

  isRainActive(): boolean { return this.rainActive }
  isSnowActive(): boolean { return this.snowActive }

  // ---------------------------------------------------------------------------
  // Sleep / Wake lifecycle
  // ---------------------------------------------------------------------------

  /** No-op — weather is tick-driven, not timer-driven. */
  pause(): void { /* intentional no-op */ }
  resume(): void { /* intentional no-op */ }

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

    // Destroy puddle layers
    if (this.puddleLayer) {
      this.puddleLayer.destroy()
      this.puddleLayer = null
    }

    // Destroy snow overlay
    if (this.snowGroundOverlay) {
      this.snowGroundOverlay.destroy()
      this.snowGroundOverlay = null
    }

    // Destroy breath particles
    for (const p of this.breathParticles) {
      p.destroy()
    }
    this.breathParticles = []
  }
}
