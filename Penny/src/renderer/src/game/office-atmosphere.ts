import Phaser from 'phaser'
import { AtmosphereSky } from './atmosphere-sky'
import { AtmosphereLighting } from './atmosphere-lighting'

// ---------------------------------------------------------------------------
// OfficeAtmosphere
// Orchestrates day/night cycle, wall clock, shadows, and delegates sky/lighting
// effects to AtmosphereSky and AtmosphereLighting.
// ---------------------------------------------------------------------------

export interface AtmosphereCallbacks {
  /** Called when day/night phase changes — lets OfficeScene update rain/snow state */
  onPhaseChange(phase: 'morning' | 'day' | 'evening' | 'night', animate: boolean, rainDropPool: Phaser.GameObjects.Line[], snowPool: Phaser.GameObjects.Arc[], viewWidth: number, viewHeight: number): void
  /** Called when the time-of-day phase changes — lets PostFXManager update vignette/bloom/color grading */
  onPostFXPhaseChange?(phase: 'morning' | 'day' | 'evening' | 'night', animate: boolean): void
  /** Called when atmosphere needs to invalidate the office background cache */
  invalidateOfficeBgCache(): void
  /** Called to show a toast notification */
  showToast(message: string, type: 'info' | 'warn' | 'error'): void
  /** Provides the main camera for background color updates */
  getCamera(): Phaser.Cameras.Scene2D.Camera
}

export interface ShadowParams {
  rooms: Map<string, { workstations: Map<string, { shadow?: Phaser.GameObjects.Ellipse }> }>
}

export class OfficeAtmosphere {
  private scene: Phaser.Scene
  private callbacks: AtmosphereCallbacks

  // Sub-modules
  private sky: AtmosphereSky
  private lighting: AtmosphereLighting

  // Day/night cycle
  private dayNightOverlay: Phaser.GameObjects.Rectangle | null = null
  private dayNightTimer: Phaser.Time.TimerEvent | null = null
  currentTimePhase: 'morning' | 'day' | 'evening' | 'night' = 'day'
  shadowAngle = 0
  private lastShadowUpdateAt = 0

  // Window glint — gfx + positions owned here, timing lives in AtmosphereLighting
  windowGlintGfx: Phaser.GameObjects.Graphics | null = null
  windowPositions: { x: number; y: number; w: number; h: number }[] = []
  windowTintColor = 0x7dd3fc
  windowTintAlpha = 0.16

  // Wall clock
  wallClockContainer: Phaser.GameObjects.Container | null = null
  clockHourHand: Phaser.GameObjects.Graphics | null = null
  clockMinuteHand: Phaser.GameObjects.Graphics | null = null
  clockSecondHand: Phaser.GameObjects.Graphics | null = null
  private lastClockTick = 0
  private lastChimeHour = -1

  // Ceiling lights
  ceilingLights: Phaser.GameObjects.Container[] = []

  // Exterior lights
  exteriorLights: Phaser.GameObjects.Container | null = null

  // World dimensions
  private worldWidth = 2400
  private worldHeight = 1200

  constructor(scene: Phaser.Scene, callbacks: AtmosphereCallbacks) {
    this.scene = scene
    this.callbacks = callbacks
    this.sky = new AtmosphereSky(scene)
    this.lighting = new AtmosphereLighting(scene)
  }

  // ---------------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------------

  init(
    dayNightOverlay: Phaser.GameObjects.Rectangle,
    skyGradient: Phaser.GameObjects.Graphics,
    windowGlintGfx: Phaser.GameObjects.Graphics,
    worldWidth: number,
    worldHeight: number,
    vignetteFx: Phaser.FX.Vignette | null,
  ): void {
    this.dayNightOverlay = dayNightOverlay
    this.windowGlintGfx = windowGlintGfx
    this.worldWidth = worldWidth
    this.worldHeight = worldHeight

    this.sky.init(skyGradient, worldWidth, worldHeight)
    this.lighting.initChimeRipplePool()

    this.applyDayNightCycle(false)

    void vignetteFx // vignette stays in OfficeScene — nothing extra needed here

    this.dayNightTimer = this.scene.time.addEvent({
      delay: 60_000,
      callback: () => this.applyDayNightCycle(true),
      loop: true,
    })
  }

  updateWorldSize(w: number, h: number): void {
    this.worldWidth = w
    this.worldHeight = h
    this.sky.updateWorldSize(w, h)
  }

  // ---------------------------------------------------------------------------
  // Tick — called from OfficeScene.update()
  // ---------------------------------------------------------------------------

  tick(time: number, rainActive: boolean, snowActive: boolean): void {
    if (rainActive) { /* tickRain lives in OfficeScene (particles module) */ }
    if (snowActive) { /* tickSnow lives in OfficeScene (particles module) */ }
    this.lighting.tickWindowGlint(time, this.windowGlintGfx, this.windowPositions)
    this.sky.tick(time)
    if (this.wallClockContainer && time - this.lastClockTick >= 1000) {
      this.lastClockTick = time
      this.tickWallClock()
    }
    if (time - this.lastShadowUpdateAt >= 5000) {
      this.lastShadowUpdateAt = time
      // Shadow updates require room data — triggered via callback from OfficeScene.update()
    }
  }

  // ---------------------------------------------------------------------------
  // Sleep / Wake lifecycle
  // ---------------------------------------------------------------------------

  pause(): void {
    if (this.dayNightTimer) this.dayNightTimer.paused = true
    this.scene.tweens.pauseAll()
  }

  resume(): void {
    if (this.dayNightTimer) this.dayNightTimer.paused = false
    this.scene.tweens.resumeAll()
    // Re-sync day/night to wall-clock time so the office sky isn't frozen at the pre-sleep moment
    this.applyDayNightCycle(false)
  }

  // ---------------------------------------------------------------------------
  // Destroy
  // ---------------------------------------------------------------------------

  destroy(): void {
    this.dayNightTimer?.destroy()
    this.dayNightTimer = null
    this.dayNightOverlay?.destroy()
    this.dayNightOverlay = null

    this.sky.destroy()

    this.lighting.destroyCeilingLights(this.ceilingLights)
    this.ceilingLights = []
    this.lighting.destroy()

    if (this.exteriorLights) {
      this.scene.tweens.killTweensOf(this.exteriorLights)
      this.exteriorLights.destroy()
      this.exteriorLights = null
    }

    this.wallClockContainer?.destroy()
    this.wallClockContainer = null
    this.clockHourHand = null
    this.clockMinuteHand = null
    this.clockSecondHand = null

    this.windowGlintGfx?.destroy()
    this.windowGlintGfx = null
    this.windowPositions = []
  }

  // ---------------------------------------------------------------------------
  // Day/night cycle
  // ---------------------------------------------------------------------------

  getTimePhase(): {
    phase: 'morning' | 'day' | 'evening' | 'night'
    color: number
    alpha: number
    bgColor: number
    glowMultiplier: number
  } {
    const hour = new Date().getHours()
    if (hour >= 6 && hour < 10) {
      return { phase: 'morning', color: 0xffa500, alpha: 0.06, bgColor: 0x151a24, glowMultiplier: 1.0 }
    } else if (hour >= 10 && hour < 17) {
      return { phase: 'day', color: 0x000000, alpha: 0.0, bgColor: 0x111827, glowMultiplier: 1.0 }
    } else if (hour >= 17 && hour < 20) {
      return { phase: 'evening', color: 0xff6a00, alpha: 0.08, bgColor: 0x14161f, glowMultiplier: 1.2 }
    } else {
      return { phase: 'night', color: 0x1a3a6a, alpha: 0.14, bgColor: 0x0a0e18, glowMultiplier: 1.6 }
    }
  }

  applyDayNightCycle(animate: boolean): void {
    const { phase, color, alpha, bgColor } = this.getTimePhase()
    if (phase === this.currentTimePhase && animate) return
    this.currentTimePhase = phase

    // Draw sky gradient for new phase
    this.sky.drawSkyGradient(phase)

    // Update window tint based on time of day and force a redraw
    if (phase === 'morning') {
      this.windowTintColor = 0x93c5fd
      this.windowTintAlpha = 0.08
    } else if (phase === 'day') {
      this.windowTintColor = 0x7dd3fc
      this.windowTintAlpha = 0.16
    } else if (phase === 'evening') {
      this.windowTintColor = 0x7dd3fc
      this.windowTintAlpha = 0.06
    } else {
      // night: cool interior glow
      this.windowTintColor = 0x93c5fd
      this.windowTintAlpha = 0.10
    }
    this.callbacks.invalidateOfficeBgCache()

    // Set shadow angle based on simulated sun position for this phase
    if (phase === 'morning') {
      this.shadowAngle = -0.3   // light from the right, shadows lean left
    } else if (phase === 'day') {
      this.shadowAngle = 0      // overhead light, shadows fall straight down
    } else if (phase === 'evening') {
      this.shadowAngle = 0.3    // light from the left, shadows lean right
    } else {
      this.shadowAngle = 0      // night: ambient ceiling light, no directional bias
    }

    const overlay = this.dayNightOverlay
    if (!overlay) return

    // Don't set camera bg — canvas transparent for HTML bg bleed-through

    if (animate) {
      this.scene.tweens.killTweensOf(overlay)
      overlay.setFillStyle(color)
      this.scene.tweens.add({ targets: overlay, alpha, duration: 3000, ease: 'Sine.easeInOut' })
    } else {
      overlay.setFillStyle(color)
      overlay.setAlpha(alpha)
    }

    // Starfield alpha — more visible at night, barely perceptible during the day
    let phaseMultiplier: number
    if (phase === 'night') {
      phaseMultiplier = 1.5
    } else if (phase === 'day') {
      phaseMultiplier = 0.5
    } else {
      phaseMultiplier = 1.0
    }
    this.sky.setStarPhaseMultiplier(phaseMultiplier)
    for (const star of this.sky.stars) {
      const baseAlpha = star.getData('baseAlpha') as number
      const targetAlpha = baseAlpha * phaseMultiplier
      if (animate) {
        this.scene.tweens.killTweensOf(star)
        this.scene.tweens.add({ targets: star, alpha: targetAlpha, duration: 3000, ease: 'Sine.easeInOut' })
      } else {
        star.setAlpha(targetAlpha)
      }
    }

    // Cloud layer — redraw each cloud Graphics with phase-appropriate color and alpha
    for (const cloud of this.sky.clouds) {
      const baseAlpha = cloud.getData('baseAlpha') as number
      let targetAlpha: number
      let targetColor: number
      if (phase === 'night') {
        targetAlpha = baseAlpha * 1.3
        targetColor = 0x475569
      } else if (phase === 'morning') {
        targetAlpha = baseAlpha
        targetColor = 0xcbd5e1
      } else {
        // day / evening
        targetAlpha = baseAlpha
        targetColor = 0x94a3b8
      }
      cloud.setData('currentColor', targetColor)
      if (animate) {
        this.scene.tweens.killTweensOf(cloud)
        this.scene.tweens.add({ targets: cloud, alpha: targetAlpha, duration: 3000, ease: 'Sine.easeInOut' })
      } else {
        cloud.setAlpha(targetAlpha)
      }
      // Redraw the cloud shape with the new color
      this.sky.redrawCloud(cloud, targetColor)
    }

    // Dawn/dusk transition flash — brief warm/cool color overlay
    if (animate) {
      const flashColor = (phase === 'morning') ? 0xffa500 : (phase === 'evening') ? 0xff6a00 : (phase === 'night') ? 0x1a3a6a : 0
      if (flashColor !== 0) {
        const cam = this.callbacks.getCamera()
        const flashGfx = this.scene.add.graphics().setScrollFactor(0).setDepth(9997)
        flashGfx.fillStyle(flashColor, 0.12)
        flashGfx.fillRect(0, 0, cam.width, cam.height)
        flashGfx.setAlpha(1)
        this.scene.tweens.add({
          targets: flashGfx,
          alpha: 0,
          duration: 600,
          ease: 'Power2',
          delay: 100,
          onComplete: () => flashGfx.destroy(),
        })
      }
    }

    // Delegate rain/snow updates to OfficeScene via callback
    this.callbacks.onPhaseChange(phase, animate, [], [], 0, 0)

    // Delegate postFX (vignette/bloom/color-grade) updates
    this.callbacks.onPostFXPhaseChange?.(phase, animate)

    // Exterior lights — tween container alpha so all child fixtures change together.
    if (this.exteriorLights) {
      const extAlphaMap: Record<string, number> = {
        morning: 0.02,
        day: 0.0,
        evening: 0.06,
        night: 0.12,
      }
      const extTarget = extAlphaMap[phase] ?? 0.0
      if (animate) {
        this.scene.tweens.killTweensOf(this.exteriorLights)
        this.scene.tweens.add({
          targets: this.exteriorLights,
          alpha: extTarget,
          duration: 500,
          ease: 'Sine.easeInOut',
        })
      } else {
        this.exteriorLights.setAlpha(extTarget)
      }
    }

    // Ambient haze — phase-dependent intensity
    const hazeOverlay = this.sky.haze
    if (hazeOverlay) {
      const hazeScaleMap: Record<string, number> = {
        morning: 0.6,
        day: 0.5,
        evening: 0.8,
        night: 1.2,
      }
      const targetScale = hazeScaleMap[phase] ?? 0.5
      this.sky.hazeAlphaScale = targetScale
      if (animate) {
        this.scene.tweens.killTweensOf(hazeOverlay)
        this.scene.tweens.add({
          targets: hazeOverlay,
          alpha: targetScale,
          duration: 2000,
          ease: 'Sine.easeInOut',
        })
      } else {
        hazeOverlay.setAlpha(targetScale)
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Sky gradient — delegate to AtmosphereSky
  // ---------------------------------------------------------------------------

  drawSkyGradient(phase: string): void {
    this.sky.drawSkyGradient(phase)
  }

  // ---------------------------------------------------------------------------
  // Dynamic shadows
  // ---------------------------------------------------------------------------

  updateShadows(rooms: Map<string, { workstations: Map<string, { shadow?: Phaser.GameObjects.Ellipse }> }>): void {
    const phase = this.currentTimePhase
    let shadowAlpha: number
    let shadowWidth: number

    if (phase === 'morning') {
      shadowAlpha = 0.15
      shadowWidth = 20
    } else if (phase === 'day') {
      shadowAlpha = 0.25
      shadowWidth = 22
    } else if (phase === 'evening') {
      shadowAlpha = 0.15
      shadowWidth = 20
    } else {
      // night: dim ambient, tighter ellipse
      shadowAlpha = 0.08
      shadowWidth = 15
    }

    const xOffset = this.shadowAngle * 8

    for (const room of rooms.values()) {
      for (const ws of room.workstations.values()) {
        if (!ws.shadow) continue
        ws.shadow.x = xOffset
        ws.shadow.setAlpha(shadowAlpha)
        ws.shadow.width = shadowWidth
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Window glint — delegate to AtmosphereLighting
  // ---------------------------------------------------------------------------

  tickWindowGlint(time: number): void {
    this.lighting.tickWindowGlint(time, this.windowGlintGfx, this.windowPositions)
  }

  // ---------------------------------------------------------------------------
  // Wall clock
  // ---------------------------------------------------------------------------

  tickWallClock(): void {
    const hourHand = this.clockHourHand
    const minuteHand = this.clockMinuteHand
    const secondHand = this.clockSecondHand
    if (!hourHand || !minuteHand || !secondHand) return

    const now = new Date()
    const h = now.getHours() % 12
    const m = now.getMinutes()
    const s = now.getSeconds()

    const secAngle   = Phaser.Math.DegToRad((s / 60) * 360 - 90)
    const minAngle   = Phaser.Math.DegToRad((m / 60) * 360 + (s / 60) * 6 - 90)
    const hourAngle  = Phaser.Math.DegToRad((h / 12) * 360 + (m / 60) * 30 - 90)

    secondHand.clear()
    secondHand.lineStyle(0.5, 0xef4444, 1)
    secondHand.lineBetween(0, 0, Math.cos(secAngle) * 10, Math.sin(secAngle) * 10)

    minuteHand.clear()
    minuteHand.lineStyle(1, 0xcbd5e1, 1)
    minuteHand.lineBetween(0, 0, Math.cos(minAngle) * 9, Math.sin(minAngle) * 9)

    hourHand.clear()
    hourHand.lineStyle(1.5, 0xe2e8f0, 1)
    hourHand.lineBetween(0, 0, Math.cos(hourAngle) * 6, Math.sin(hourAngle) * 6)

    // Clock chime on the hour
    const hour = now.getHours()
    if (hour !== this.lastChimeHour && m === 0 && s < 2) {
      this.lastChimeHour = hour
      if (this.wallClockContainer) {
        this.lighting.triggerChimeRipple(this.wallClockContainer.x, this.wallClockContainer.y)
      }
      const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
      this.callbacks.showToast(`${displayHour}:00`, 'info')
    }
  }

  // ---------------------------------------------------------------------------
  // Ceiling lights — delegate to AtmosphereLighting
  // ---------------------------------------------------------------------------

  tickCeilingLightActivity(
    time: number,
    rooms: Map<string, { workstations: Map<string, { state: { sessionMode?: string; needsInteraction?: boolean } | null }> }>,
  ): void {
    this.lighting.tickCeilingLightActivity(time, this.ceilingLights, rooms)
  }

  destroyCeilingLights(): void {
    this.lighting.destroyCeilingLights(this.ceilingLights)
    this.ceilingLights = []
  }
}
