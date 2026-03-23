import Phaser from 'phaser'
import { lerpColor } from './office-theme'

// ---------------------------------------------------------------------------
// OfficeAtmosphere
// Owns all atmosphere state: day/night cycle, sky gradient, shadows,
// window glint, starfield, clouds, wall clock, ceiling lights, exterior lights.
// ---------------------------------------------------------------------------

export interface AtmosphereCallbacks {
  /** Called when day/night phase changes — lets OfficeScene update rain/snow state */
  onPhaseChange(phase: 'morning' | 'day' | 'evening' | 'night', animate: boolean, rainDropPool: Phaser.GameObjects.Line[], snowPool: Phaser.GameObjects.Arc[], viewWidth: number, viewHeight: number): void
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

  // Day/night cycle
  private dayNightOverlay: Phaser.GameObjects.Rectangle | null = null
  private skyGradient: Phaser.GameObjects.Graphics | null = null
  private dayNightTimer: Phaser.Time.TimerEvent | null = null
  currentTimePhase: 'morning' | 'day' | 'evening' | 'night' = 'day'
  shadowAngle = 0
  private lastShadowUpdateAt = 0

  // Window glint
  windowGlintGfx: Phaser.GameObjects.Graphics | null = null
  windowPositions: { x: number; y: number; w: number; h: number }[] = []
  windowTintColor = 0x7dd3fc
  windowTintAlpha = 0.16
  private lastGlintAt = 0
  private glintActiveWindow = -1
  private glintStartTime = 0
  private readonly GLINT_INTERVAL = 3000
  private readonly GLINT_DURATION = 600

  // Starfield
  private starPool: Phaser.GameObjects.Arc[] = []
  private lastTwinkleAt = 0

  // Cloud layer
  private cloudPool: Phaser.GameObjects.Graphics[] = []
  private cloudTimer: Phaser.Time.TimerEvent | null = null

  // Wall clock
  wallClockContainer: Phaser.GameObjects.Container | null = null
  clockHourHand: Phaser.GameObjects.Graphics | null = null
  clockMinuteHand: Phaser.GameObjects.Graphics | null = null
  clockSecondHand: Phaser.GameObjects.Graphics | null = null
  private lastClockTick = 0
  private lastChimeHour = -1
  private chimeRipplePool: Phaser.GameObjects.Arc[] = []

  // Ceiling lights
  ceilingLights: Phaser.GameObjects.Container[] = []
  private lastLightCheckAt = 0
  private lightActivityMode: 'active' | 'idle' = 'idle'

  // Exterior lights
  exteriorLights: Phaser.GameObjects.Container | null = null

  // World dimensions (needed for cloud wrapping)
  private worldWidth = 2400
  private worldHeight = 1200

  constructor(scene: Phaser.Scene, callbacks: AtmosphereCallbacks) {
    this.scene = scene
    this.callbacks = callbacks
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
    this.skyGradient = skyGradient
    this.windowGlintGfx = windowGlintGfx
    this.worldWidth = worldWidth
    this.worldHeight = worldHeight

    this.initStarfield()
    this.initCloudLayer()
    this.initChimeRipplePool()

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
  }

  // ---------------------------------------------------------------------------
  // Update — called from OfficeScene.update()
  // ---------------------------------------------------------------------------

  tick(time: number, rainActive: boolean, snowActive: boolean): void {
    if (rainActive) { /* tickRain lives in OfficeScene (particles module) */ }
    if (snowActive) { /* tickSnow lives in OfficeScene (particles module) */ }
    this.tickWindowGlint(time)
    if (this.starPool.length > 0 && time - this.lastTwinkleAt >= 500) {
      this.lastTwinkleAt = time
      this.tickStarfieldTwinkle()
    }
    this.tickClouds()
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
  // Destroy
  // ---------------------------------------------------------------------------

  destroy(): void {
    this.dayNightTimer?.destroy()
    this.dayNightTimer = null
    this.dayNightOverlay?.destroy()
    this.dayNightOverlay = null
    this.skyGradient?.destroy()
    this.skyGradient = null

    for (const s of this.starPool) { this.scene.tweens.killTweensOf(s); s.destroy() }
    this.starPool = []
    this.cloudTimer?.destroy()
    this.cloudTimer = null
    for (const c of this.cloudPool) { this.scene.tweens.killTweensOf(c); c.destroy() }
    this.cloudPool = []

    for (const c of this.chimeRipplePool) { this.scene.tweens.killTweensOf(c); c.destroy() }
    this.chimeRipplePool = []

    this.destroyCeilingLights()

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
    this.drawSkyGradient(phase)

    // Update window tint based on time of day and force a redraw
    if (phase === 'morning') {
      this.windowTintColor = 0xfde68a
      this.windowTintAlpha = 0.08
    } else if (phase === 'day') {
      this.windowTintColor = 0x7dd3fc
      this.windowTintAlpha = 0.16
    } else if (phase === 'evening') {
      this.windowTintColor = 0xfbbf24
      this.windowTintAlpha = 0.06
    } else {
      // night: interior glow suggesting lights inside
      this.windowTintColor = 0xfef3c7
      this.windowTintAlpha = 0.12
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

    this.callbacks.getCamera().setBackgroundColor(bgColor)

    if (animate) {
      this.scene.tweens.killTweensOf(overlay)
      overlay.setFillStyle(color)
      this.scene.tweens.add({ targets: overlay, alpha, duration: 3000, ease: 'Sine.easeInOut' })
    } else {
      overlay.setFillStyle(color)
      overlay.setAlpha(alpha)
    }

    // Starfield alpha — more visible at night, barely perceptible during the day
    for (const star of this.starPool) {
      const baseAlpha = star.getData('baseAlpha') as number
      let targetAlpha: number
      if (phase === 'night') {
        targetAlpha = baseAlpha * 1.5
      } else if (phase === 'day') {
        targetAlpha = baseAlpha * 0.5
      } else {
        // morning / evening — base alpha
        targetAlpha = baseAlpha
      }
      if (animate) {
        this.scene.tweens.killTweensOf(star)
        this.scene.tweens.add({ targets: star, alpha: targetAlpha, duration: 3000, ease: 'Sine.easeInOut' })
      } else {
        star.setAlpha(targetAlpha)
      }
    }

    // Cloud layer — redraw each cloud Graphics with phase-appropriate color and alpha
    for (const cloud of this.cloudPool) {
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
      this.redrawCloud(cloud, targetColor)
    }

    // Delegate rain/snow updates to OfficeScene via callback
    this.callbacks.onPhaseChange(phase, animate, [], [], 0, 0)

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
  }

  // ---------------------------------------------------------------------------
  // Sky gradient (day/night background layer, depth -11)
  // ---------------------------------------------------------------------------

  drawSkyGradient(phase: string): void {
    const g = this.skyGradient
    if (!g) return
    g.clear()
    const W = 8000
    const H = 8000
    const STRIPS = 200
    const stripH = H / STRIPS
    let topColor: number
    let midColor: number | null
    let midT: number
    let bottomColor: number
    if (phase === 'morning') {
      topColor = 0x1e1b4b
      midColor = 0xf97316
      midT = 0.55
      bottomColor = 0xfde68a
    } else if (phase === 'day') {
      topColor = 0x0c4a6e
      midColor = null
      midT = 0.5
      bottomColor = 0x7dd3fc
    } else if (phase === 'evening') {
      topColor = 0x1e1b4b
      midColor = 0x9333ea
      midT = 0.5
      bottomColor = 0xf97316
    } else {
      topColor = 0x030712
      midColor = null
      midT = 0.5
      bottomColor = 0x111827
    }
    const ALPHA = 0.18
    for (let i = 0; i < STRIPS; i++) {
      const t = i / (STRIPS - 1)
      let c: number
      if (midColor !== null) {
        c =
          t < midT
            ? lerpColor(topColor, midColor, t / midT)
            : lerpColor(midColor, bottomColor, (t - midT) / (1 - midT))
      } else {
        c = lerpColor(topColor, bottomColor, t)
      }
      g.fillStyle(c, ALPHA)
      g.fillRect(0, i * stripH, W, stripH + 1)
    }
  }

  // ---------------------------------------------------------------------------
  // Dynamic shadows (day/night light source movement)
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
  // Window glint
  // ---------------------------------------------------------------------------

  tickWindowGlint(time: number): void {
    const gfx = this.windowGlintGfx
    if (!gfx || this.windowPositions.length === 0) return

    // Start a new glint sweep every GLINT_INTERVAL ms
    if (this.glintActiveWindow === -1 && time - this.lastGlintAt >= this.GLINT_INTERVAL) {
      this.glintActiveWindow = Math.floor(Math.random() * this.windowPositions.length)
      this.glintStartTime = time
      this.lastGlintAt = time
    }

    gfx.clear()
    if (this.glintActiveWindow === -1) return

    const win = this.windowPositions[this.glintActiveWindow]
    if (!win) { this.glintActiveWindow = -1; return }
    const elapsed = time - this.glintStartTime
    const t = Math.min(elapsed / this.GLINT_DURATION, 1)

    if (t >= 1) {
      this.glintActiveWindow = -1
      return
    }

    // Thin vertical bar sweeping left to right across the window
    const barW = 3
    const barX = win.x + t * (win.w - barW)
    gfx.fillStyle(0xffffff, 0.15)
    gfx.fillRect(barX, win.y, barW, win.h)
  }

  // ---------------------------------------------------------------------------
  // Starfield
  // ---------------------------------------------------------------------------

  private initStarfield(): void {
    // Star color palette — mostly white, occasional cool blue or warm yellow
    const palette = [
      { color: 0xffffff, weight: 6 },
      { color: 0x93c5fd, weight: 2 },
      { color: 0xfef3c7, weight: 2 },
    ]
    const totalWeight = palette.reduce((s, e) => s + e.weight, 0)

    const count = 50 + Math.floor(Math.random() * 31) // 50-80 stars
    for (let i = 0; i < count; i++) {
      const x = Math.random() * 4000
      const y = Math.random() * 3000
      const radius = 0.5 + Math.random() * 1.0 // 0.5-1.5px
      const baseAlpha = 0.03 + Math.random() * 0.05 // 0.03-0.08

      // Weighted random color pick
      let roll = Math.random() * totalWeight
      let chosenColor = 0xffffff
      for (const entry of palette) {
        roll -= entry.weight
        if (roll <= 0) { chosenColor = entry.color; break }
      }

      const star = this.scene.add.circle(x, y, radius, chosenColor, baseAlpha)
      star.setDepth(-10)
      star.setData('baseAlpha', baseAlpha)
      this.starPool.push(star)
    }
  }

  private tickStarfieldTwinkle(): void {
    if (this.starPool.length === 0) return
    const count = 3 + Math.floor(Math.random() * 3) // 3-5 stars per tick
    for (let i = 0; i < count; i++) {
      const star = this.starPool[Math.floor(Math.random() * this.starPool.length)]
      const baseAlpha = star.getData('baseAlpha') as number
      const currentAlpha = star.alpha

      // Peak is 2x the star's current alpha ceiling (respects day/night scaling)
      const peakAlpha = Math.min(currentAlpha * 2.5, 0.35)
      this.scene.tweens.killTweensOf(star)
      this.scene.tweens.add({
        targets: star,
        alpha: peakAlpha,
        duration: 700,
        ease: 'Sine.easeIn',
        yoyo: true,
        hold: 100,
        onComplete: () => {
          // Settle back to the phase-adjusted base alpha
          const phaseMultiplier =
            this.currentTimePhase === 'night' ? 1.5 :
            this.currentTimePhase === 'day'   ? 0.5 : 1.0
          this.scene.tweens.add({
            targets: star,
            alpha: baseAlpha * phaseMultiplier,
            duration: 800,
            ease: 'Sine.easeOut',
          })
        },
      })
    }
  }

  // ---------------------------------------------------------------------------
  // Cloud layer
  // ---------------------------------------------------------------------------

  private initCloudLayer(): void {
    const CLOUD_COUNT = 5 // 4-6 clouds
    const CLOUD_COLOR = 0x94a3b8

    for (let i = 0; i < CLOUD_COUNT; i++) {
      const gfx = this.scene.add.graphics()
      gfx.setDepth(-9) // above stars (-10), below building elements

      // Scatter across sky area: wider than the world, y stays in upper 40% of world
      const x = Math.random() * 4200 - 100
      const y = Math.random() * (this.worldHeight * 0.4)

      // Each cloud has 2-3 overlapping blobs
      const blobCount = 2 + Math.floor(Math.random() * 2)
      const baseAlpha = 0.02 + Math.random() * 0.02 // 0.02-0.04

      gfx.setPosition(x, y)
      gfx.setAlpha(baseAlpha)
      gfx.setData('baseAlpha', baseAlpha)
      gfx.setData('blobCount', blobCount)
      gfx.setData('currentColor', CLOUD_COLOR)

      this.redrawCloud(gfx, CLOUD_COLOR)
      this.cloudPool.push(gfx)
    }
  }

  private redrawCloud(gfx: Phaser.GameObjects.Graphics, color: number): void {
    const blobCount = gfx.getData('blobCount') as number
    gfx.clear()

    // Draw 2-3 overlapping ellipses to form a soft hazy shape
    for (let b = 0; b < blobCount; b++) {
      const offsetX = (b - (blobCount - 1) / 2) * 45
      const offsetY = Math.sin(b * 1.4) * 12
      const w = 60 + Math.random() * 60  // 60-120px wide
      const h = w * (0.35 + Math.random() * 0.2) // roughly 35-55% of width tall

      gfx.fillStyle(color, 1)
      gfx.fillEllipse(offsetX, offsetY, w, h)
    }
  }

  private tickClouds(): void {
    if (this.cloudPool.length === 0) return
    const drift = 0.02
    const rightEdge = this.worldWidth + 300
    const leftWrap = -300

    for (const cloud of this.cloudPool) {
      cloud.x += drift
      if (cloud.x > rightEdge) {
        // Wrap back to the left with a slight y jitter for variety
        cloud.x = leftWrap
        cloud.y = Math.random() * (this.worldHeight * 0.4)
      }
    }
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
      this.triggerChimeRipple()
      const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
      this.callbacks.showToast(`${displayHour}:00`, 'info')
    }
  }

  private initChimeRipplePool(): void {
    for (let i = 0; i < 3; i++) {
      const circle = this.scene.add
        .circle(0, 0, 1, 0xfbbf24, 0)
        .setDepth(-0.4)
        .setVisible(false)
      circle.setData('busy', false)
      this.chimeRipplePool.push(circle)
    }
  }

  private triggerChimeRipple(): void {
    if (!this.wallClockContainer) return

    // Resolve clock world position from its container
    const wx = this.wallClockContainer.x
    const wy = this.wallClockContainer.y

    const delays = [0, 200, 400]
    for (let i = 0; i < this.chimeRipplePool.length; i++) {
      const circle = this.chimeRipplePool[i]
      if (circle.getData('busy')) continue
      circle.setPosition(wx, wy)
      circle.setRadius(4)
      circle.setFillStyle(0xfbbf24, 0.3)
      circle.setScale(1)
      circle.setAlpha(0.3)
      circle.setVisible(true)
      circle.setData('busy', true)

      this.scene.time.delayedCall(delays[i], () => {
        this.scene.tweens.add({
          targets: circle,
          scaleX: 10,
          scaleY: 10,
          alpha: 0,
          duration: 1000,
          ease: 'Sine.easeOut',
          onComplete: () => {
            circle.setVisible(false)
            circle.setScale(1)
            circle.setAlpha(0.3)
            circle.setData('busy', false)
          },
        })
      })
    }
  }

  // ---------------------------------------------------------------------------
  // Ceiling lights
  // ---------------------------------------------------------------------------

  tickCeilingLightActivity(
    time: number,
    rooms: Map<string, { workstations: Map<string, { state: { sessionMode: string; needsInteraction: boolean } | null }> }>,
  ): void {
    if (this.ceilingLights.length === 0 || time - this.lastLightCheckAt < 5000) return
    this.lastLightCheckAt = time
    let activeCount = 0
    for (const room of rooms.values()) {
      for (const ws of room.workstations.values()) {
        if (ws.state && (ws.state.sessionMode === 'working' || ws.state.sessionMode === 'plan') && !ws.state.needsInteraction) {
          activeCount++
        }
      }
    }
    const nextMode: 'active' | 'idle' = activeCount > 0 ? 'active' : 'idle'
    if (nextMode === this.lightActivityMode) return
    this.lightActivityMode = nextMode
    const lo = nextMode === 'active' ? 0.2 : 0.1
    const hi = nextMode === 'active' ? 0.35 : 0.2
    for (const lightContainer of this.ceilingLights) {
      const children = lightContainer.getAll()
      const innerCore = children[2] as Phaser.GameObjects.Arc | undefined
      if (innerCore) {
        this.scene.tweens.killTweensOf(innerCore)
        this.scene.tweens.add({ targets: innerCore, alpha: { from: lo, to: hi }, duration: 2000 + Math.random() * 2000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: Math.random() * 800 })
      }
    }
  }

  destroyCeilingLights(): void {
    for (const c of this.ceilingLights) {
      for (const child of c.getAll()) {
        this.scene.tweens.killTweensOf(child)
      }
      c.destroy(true)
    }
    this.ceilingLights = []
  }
}
