import Phaser from 'phaser'

// ---------------------------------------------------------------------------
// WeatherSystem — full weather states with parallax depth, transitions,
// ground effects, and auto-cycle. Created and owned by OfficeAtmosphere.
// ---------------------------------------------------------------------------

export type WeatherType = 'clear' | 'overcast' | 'rain' | 'snow' | 'fog'

// Config per parallax layer
interface LayerCfg {
  count: number
  depth: number
  sizeMin: number
  sizeMax: number
  speedMin: number
  speedMax: number
  baseAlpha: number
}

// Far → mid → near
const RAIN_CFG: LayerCfg[] = [
  { count: 20, depth: 9984, sizeMin: 4,  sizeMax: 6,  speedMin: 2, speedMax: 4,  baseAlpha: 0.3 },
  { count: 25, depth: 9986, sizeMin: 6,  sizeMax: 9,  speedMin: 4, speedMax: 7,  baseAlpha: 0.6 },
  { count: 15, depth: 9988, sizeMin: 9,  sizeMax: 14, speedMin: 7, speedMax: 11, baseAlpha: 0.8 },
]

const SNOW_CFG: LayerCfg[] = [
  { count: 15, depth: 9984, sizeMin: 0.8, sizeMax: 1.2, speedMin: 0.5, speedMax: 1.0, baseAlpha: 0.3 },
  { count: 15, depth: 9986, sizeMin: 1.2, sizeMax: 1.8, speedMin: 1.0, speedMax: 2.0, baseAlpha: 0.6 },
  { count: 10, depth: 9988, sizeMin: 1.8, sizeMax: 2.5, speedMin: 2.0, speedMax: 3.5, baseAlpha: 0.8 },
]

interface RainDrop {
  line: Phaser.GameObjects.Line
  speed: number
  baseAlpha: number
}

interface SnowFlake {
  arc: Phaser.GameObjects.Arc
  speed: number
  swayPhase: number
  baseAlpha: number
}

interface RainLayer {
  drops: RainDrop[]
  cfg: LayerCfg
}

interface SnowLayer {
  flakes: SnowFlake[]
  cfg: LayerCfg
}

const TRANSITION_DURATION_DEFAULT = 5000  // ms
const AUTO_CYCLE_MIN_MS = 10 * 60_000    // 10 minutes
const AUTO_CYCLE_MAX_MS = 20 * 60_000    // 20 minutes

const ALL_WEATHER_TYPES: WeatherType[] = ['clear', 'overcast', 'rain', 'snow', 'fog']

// ---------------------------------------------------------------------------
// WeatherSystem
// ---------------------------------------------------------------------------

export class WeatherSystem {
  private scene: Phaser.Scene
  private viewWidth = 800
  private viewHeight = 600

  // Current displayed weather (what we're transitioning FROM)
  private currentWeather: WeatherType = 'clear'
  // Target weather (what we're transitioning TO)
  private targetWeather: WeatherType = 'clear'
  // Transition alpha multipliers [0,1] per category
  // We fade the target IN while the current fades OUT
  private transitionRate = 0  // alpha units per ms
  // Current alpha multipliers [0,1] for each weather overlay
  private overcastAlpha = 0     // target: 0.12 when overcast
  private fogAlpha = 0          // target: 0.35 when fog
  private fogFarAlpha = 0       // secondary far-plane fog strip
  // Rain and snow parallax alpha multipliers [far, mid, near]
  private rainAlpha = [0, 0, 0]
  private snowAlpha = [0, 0, 0]
  // Rain target alphas when fully active
  private readonly rainTargetAlpha = [0.3, 0.6, 0.8]
  private readonly snowTargetAlpha = [0.3, 0.6, 0.8]

  // Ambient light multiplier exposed to atmosphere
  private ambientMultiplier = 1.0
  private ambientTarget = 1.0

  // Particle pools
  private rainLayers: RainLayer[] = []
  private snowLayers: SnowLayer[] = []

  // Splash pool (rain ground impact)
  private splashPool: Phaser.GameObjects.Arc[] = []
  private lastSplashAt = 0

  // Puddle pool shown after 30s of rain
  private puddles: Phaser.GameObjects.Ellipse[] = []
  private rainStartTime = 0
  private puddlesActive = false

  // Overlays
  private overcastOverlay: Phaser.GameObjects.Rectangle | null = null
  private fogOverlay: Phaser.GameObjects.Graphics | null = null

  // Lightning
  private lastLightningAt = 0
  private nextLightningInterval = 0

  // Auto-cycle
  private autoCycleTimer: Phaser.Time.TimerEvent | null = null

  // Sleeping
  private sleeping = false

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.scheduleNextLightning()
  }

  // ---------------------------------------------------------------------------
  // Initialisation
  // ---------------------------------------------------------------------------

  init(viewWidth: number, viewHeight: number): void {
    this.viewWidth = viewWidth
    this.viewHeight = viewHeight

    this.initOvercastOverlay()
    this.initFogOverlay()
    this.initRainLayers()
    this.initSnowLayers()
    this.initSplashPool()
    this.initPuddles()
    this.scheduleNextAutoCycle()
  }

  updateViewSize(viewWidth: number, viewHeight: number): void {
    this.viewWidth = viewWidth
    this.viewHeight = viewHeight
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /** Transition to a new weather state over `transition` ms (default 5000). */
  setWeather(type: WeatherType, transition = TRANSITION_DURATION_DEFAULT): void {
    if (type === this.targetWeather) return
    this.targetWeather = type
    this.transitionRate = 1 / Math.max(transition, 100)

    // Track ambient multiplier target
    this.ambientTarget = type === 'overcast' ? 0.85 : 1.0

    // Start tracking rain timer
    if (type === 'rain') {
      this.rainStartTime = this.scene.time.now
      this.puddlesActive = false
    } else if (this.currentWeather === 'rain') {
      // Rain turning off — hide puddles
      this.hidePuddles()
    }
  }

  /** Ambient light multiplier: 0.85 when overcast, 1.0 otherwise. Lerps smoothly. */
  getAmbientMultiplier(): number {
    return this.ambientMultiplier
  }

  getCurrentWeather(): WeatherType { return this.currentWeather }
  getTargetWeather(): WeatherType { return this.targetWeather }

  /** Whether rain particles are meaningfully active (for lightning, splash, etc.). */
  isRainActive(): boolean { return this.rainAlpha[1] > 0.05 }
  isSnowActive(): boolean { return this.snowAlpha[1] > 0.05 }

  // ---------------------------------------------------------------------------
  // Per-frame update — call from OfficeAtmosphere.tick()
  // ---------------------------------------------------------------------------

  update(dt: number): void {
    if (this.sleeping) return
    const now = this.scene.time.now

    this.stepAlphas(dt)
    this.tickPrecip(now)
    this.tickSplash(now)
    this.tickPuddles(now)
    this.tickLightning(now)
    this.tickFogBreath(now)
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  pause(): void {
    this.sleeping = true
    if (this.autoCycleTimer) this.autoCycleTimer.paused = true
  }

  resume(): void {
    this.sleeping = false
    if (this.autoCycleTimer) this.autoCycleTimer.paused = false
  }

  destroy(): void {
    this.autoCycleTimer?.destroy()
    this.autoCycleTimer = null

    for (const layer of this.rainLayers) {
      for (const d of layer.drops) d.line.destroy()
    }
    this.rainLayers = []

    for (const layer of this.snowLayers) {
      for (const f of layer.flakes) f.arc.destroy()
    }
    this.snowLayers = []

    for (const s of this.splashPool) s.destroy()
    this.splashPool = []

    for (const p of this.puddles) p.destroy()
    this.puddles = []

    this.overcastOverlay?.destroy()
    this.overcastOverlay = null
    this.fogOverlay?.destroy()
    this.fogOverlay = null
  }

  // ---------------------------------------------------------------------------
  // Init helpers
  // ---------------------------------------------------------------------------

  private initOvercastOverlay(): void {
    const W = this.scene.cameras.main.width || this.viewWidth
    const H = this.scene.cameras.main.height || this.viewHeight
    this.overcastOverlay = this.scene.add.rectangle(W / 2, H / 2, W, H, 0x7090aa, 0)
      .setScrollFactor(0)
      .setDepth(9983)
      .setAlpha(0)
  }

  private initFogOverlay(): void {
    const W = this.scene.cameras.main.width || this.viewWidth
    const H = this.scene.cameras.main.height || this.viewHeight
    const gfx = this.scene.add.graphics()
      .setScrollFactor(0)
      .setDepth(9982)

    // Ground-hugging fog: strong near bottom, tapers upward
    const STRIPS = 60
    const stripH = H / STRIPS
    const fogStart = 0.55  // fog starts 55% down
    for (let i = 0; i < STRIPS; i++) {
      const t = i / (STRIPS - 1)
      let a = 0
      if (t > fogStart) {
        a = Math.pow((t - fogStart) / (1 - fogStart), 1.5) * 0.9
      }
      gfx.fillStyle(0xdde8f0, a)
      gfx.fillRect(0, i * stripH, W, stripH + 1)
    }
    gfx.setAlpha(0)
    this.fogOverlay = gfx
  }

  private initRainLayers(): void {
    for (const cfg of RAIN_CFG) {
      const drops: RainDrop[] = []
      for (let i = 0; i < cfg.count; i++) {
        const len = cfg.sizeMin + Math.random() * (cfg.sizeMax - cfg.sizeMin)
        const x = Math.random() * this.viewWidth
        const y = Math.random() * this.viewHeight
        const line = this.scene.add.line(0, 0, x, y, x + 1, y + len, 0x93c5fd, 1)
        line.setOrigin(0, 0)
        line.setLineWidth(1)
        line.setDepth(cfg.depth)
        line.setScrollFactor(0)
        line.setVisible(false)
        line.setAlpha(0)
        drops.push({
          line,
          speed: cfg.speedMin + Math.random() * (cfg.speedMax - cfg.speedMin),
          baseAlpha: cfg.baseAlpha,
        })
      }
      this.rainLayers.push({ drops, cfg })
    }
  }

  private initSnowLayers(): void {
    for (const cfg of SNOW_CFG) {
      const flakes: SnowFlake[] = []
      for (let i = 0; i < cfg.count; i++) {
        const r = cfg.sizeMin + Math.random() * (cfg.sizeMax - cfg.sizeMin)
        const arc = this.scene.add.circle(
          Math.random() * this.viewWidth,
          Math.random() * this.viewHeight,
          r, 0xddeeff, 1,
        )
        arc.setDepth(cfg.depth)
        arc.setScrollFactor(0)
        arc.setVisible(false)
        arc.setAlpha(0)
        flakes.push({
          arc,
          speed: cfg.speedMin + Math.random() * (cfg.speedMax - cfg.speedMin),
          swayPhase: Math.random() * Math.PI * 2,
          baseAlpha: cfg.baseAlpha,
        })
      }
      this.snowLayers.push({ flakes, cfg })
    }
  }

  private initSplashPool(): void {
    for (let i = 0; i < 12; i++) {
      const c = this.scene.add.circle(0, 0, 2, 0x93c5fd, 0.4)
        .setScrollFactor(0)
        .setDepth(9989)
        .setVisible(false)
        .setAlpha(0)
        .setData('busy', false)
      this.splashPool.push(c)
    }
  }

  private initPuddles(): void {
    // Small ellipses along the "ground" (lower 20% of view)
    const groundY = this.viewHeight * 0.8
    for (let i = 0; i < 6; i++) {
      const e = this.scene.add.ellipse(
        (0.1 + (i / 6) * 0.8) * this.viewWidth,
        groundY + Math.random() * (this.viewHeight * 0.15),
        24 + Math.random() * 20,
        5 + Math.random() * 3,
        0x7bb8d4, 0.12,
      )
      e.setScrollFactor(0).setDepth(9981).setAlpha(0)
      this.puddles.push(e)
    }
  }

  // ---------------------------------------------------------------------------
  // Alpha stepping — moves current alphas toward targets
  // ---------------------------------------------------------------------------

  private stepAlphas(dt: number): void {
    const rate = this.transitionRate * dt

    // Weather-specific targets
    const wantOvercast = this.targetWeather === 'overcast' ? 0.12 : 0
    const wantFog = this.targetWeather === 'fog' ? 1.0 : 0
    const wantRain = this.targetWeather === 'rain'
    const wantSnow = this.targetWeather === 'snow'

    this.overcastAlpha = stepToward(this.overcastAlpha, wantOvercast, rate)
    this.fogAlpha = stepToward(this.fogAlpha, wantFog, rate)
    this.ambientMultiplier = stepToward(this.ambientMultiplier, this.ambientTarget, rate * 0.5)

    for (let i = 0; i < 3; i++) {
      this.rainAlpha[i] = stepToward(this.rainAlpha[i], wantRain ? this.rainTargetAlpha[i] : 0, rate)
      this.snowAlpha[i] = stepToward(this.snowAlpha[i], wantSnow ? this.snowTargetAlpha[i] : 0, rate)
    }

    // Update visuals
    if (this.overcastOverlay) this.overcastOverlay.setAlpha(this.overcastAlpha)
    if (this.fogOverlay) this.fogOverlay.setAlpha(this.fogAlpha)

    // Update currentWeather label once transition is done
    const allDone = this.overcastAlpha === wantOvercast
      && this.fogAlpha === wantFog
      && this.rainAlpha.every((a, i) => a === (wantRain ? this.rainTargetAlpha[i] : 0))
      && this.snowAlpha.every((a, i) => a === (wantSnow ? this.snowTargetAlpha[i] : 0))
    if (allDone) this.currentWeather = this.targetWeather
  }

  // ---------------------------------------------------------------------------
  // Precipitation tick
  // ---------------------------------------------------------------------------

  private tickPrecip(now: number): void {
    const W = this.viewWidth
    const H = this.viewHeight

    for (let li = 0; li < 3; li++) {
      // Rain
      const ra = this.rainAlpha[li]
      if (ra > 0.001) {
        const layer = this.rainLayers[li]
        for (const d of layer.drops) {
          if (!d.line.visible) { d.line.setVisible(true); d.line.setAlpha(0) }
          d.line.x += 1  // slight horizontal angle
          d.line.y += d.speed
          d.line.setAlpha(ra)
          const y1 = d.line.geom.y1
          if (d.line.y + y1 > H + 16) {
            d.line.x = Math.random() * W
            d.line.y = -16 - Math.random() * 60
          }
        }
      } else {
        for (const d of this.rainLayers[li].drops) {
          if (d.line.visible) d.line.setVisible(false)
        }
      }

      // Snow
      const sa = this.snowAlpha[li]
      if (sa > 0.001) {
        const layer = this.snowLayers[li]
        for (let fi = 0; fi < layer.flakes.length; fi++) {
          const f = layer.flakes[fi]
          if (!f.arc.visible) { f.arc.setVisible(true); f.arc.setAlpha(0) }
          f.arc.y += f.speed
          f.arc.x += Math.sin(now * 0.001 + fi * 0.7 + f.swayPhase) * 0.4
          f.arc.setAlpha(sa)
          if (f.arc.y > H + 4) {
            f.arc.x = Math.random() * W
            f.arc.y = -4 - Math.random() * 40
          }
        }
      } else {
        for (const f of this.snowLayers[li].flakes) {
          if (f.arc.visible) f.arc.setVisible(false)
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Rain splashes (ground impacts, lower 15% of viewport)
  // ---------------------------------------------------------------------------

  private tickSplash(now: number): void {
    if (!this.isRainActive()) return
    const rate = 80 + Math.random() * 120  // spawn every 80-200ms
    if (now - this.lastSplashAt < rate) return
    this.lastSplashAt = now

    const free = this.splashPool.find(c => !c.getData('busy'))
    if (!free) return

    const groundBand = this.viewHeight * 0.15
    const x = Math.random() * this.viewWidth
    const y = this.viewHeight * 0.85 + Math.random() * groundBand

    free.setPosition(x, y)
    free.setRadius(1)
    free.setAlpha(0.5)
    free.setVisible(true)
    free.setData('busy', true)

    this.scene.tweens.add({
      targets: free,
      scaleX: 3 + Math.random() * 2,
      scaleY: 0.5,
      alpha: 0,
      duration: 200 + Math.random() * 150,
      ease: 'Sine.easeOut',
      onComplete: () => {
        free.setVisible(false).setScale(1).setData('busy', false)
      },
    })
  }

  // ---------------------------------------------------------------------------
  // Puddle reflections (appear after 30s of rain)
  // ---------------------------------------------------------------------------

  private tickPuddles(now: number): void {
    if (!this.isRainActive()) return
    if (this.puddlesActive) {
      // Shimmer: subtle alpha pulse
      const shimmer = 0.1 + Math.sin(now * 0.002) * 0.04
      for (const p of this.puddles) {
        if (p.alpha > 0) p.setAlpha(shimmer)
      }
      return
    }
    const elapsed = now - this.rainStartTime
    if (elapsed < 30_000) return

    this.puddlesActive = true
    for (const p of this.puddles) {
      this.scene.tweens.add({ targets: p, alpha: 0.1, duration: 3000, ease: 'Sine.easeIn' })
    }
  }

  private hidePuddles(): void {
    this.puddlesActive = false
    for (const p of this.puddles) {
      this.scene.tweens.killTweensOf(p)
      this.scene.tweens.add({ targets: p, alpha: 0, duration: 2000, ease: 'Sine.easeOut' })
    }
  }

  // ---------------------------------------------------------------------------
  // Lightning (only during rain)
  // ---------------------------------------------------------------------------

  private scheduleNextLightning(): void {
    this.nextLightningInterval = 8000 + Math.random() * 12000
  }

  private tickLightning(now: number): void {
    if (!this.isRainActive()) return
    if (now - this.lastLightningAt < this.nextLightningInterval) return
    this.lastLightningAt = now
    this.scheduleNextLightning()
    this.triggerLightningFlash()
  }

  private triggerLightningFlash(): void {
    const cam = this.scene.cameras.main
    const flash = this.scene.add.graphics().setScrollFactor(0).setDepth(9999)
    flash.fillStyle(0xddeeff, 0.08)
    flash.fillRect(0, 0, cam.width, cam.height)
    this.scene.tweens.add({
      targets: flash, alpha: 0, duration: 120, ease: 'Power2', delay: 30,
      onComplete: () => flash.destroy(),
    })
    // 25% chance double-strike
    if (Math.random() < 0.25) {
      this.scene.time.delayedCall(100 + Math.random() * 80, () => {
        const f2 = this.scene.add.graphics().setScrollFactor(0).setDepth(9999)
        f2.fillStyle(0xddeeff, 0.04)
        f2.fillRect(0, 0, cam.width, cam.height)
        this.scene.tweens.add({ targets: f2, alpha: 0, duration: 80, ease: 'Power2', onComplete: () => f2.destroy() })
      })
    }
  }

  // ---------------------------------------------------------------------------
  // Fog breath (subtle screen puffs during fog)
  // ---------------------------------------------------------------------------

  private lastBreathAt = 0

  private tickFogBreath(now: number): void {
    if (this.fogAlpha < 0.1) return
    if (now - this.lastBreathAt < 3000 + Math.random() * 2000) return
    this.lastBreathAt = now
    this.spawnBreathPuff()
  }

  private spawnBreathPuff(): void {
    const W = this.viewWidth
    const H = this.viewHeight
    const puff = this.scene.add.circle(
      W * (0.2 + Math.random() * 0.6),
      H * (0.4 + Math.random() * 0.4),
      8 + Math.random() * 6, 0xfafcff, 0.12,
    ).setScrollFactor(0).setDepth(9985)

    this.scene.tweens.add({
      targets: puff,
      scaleX: 2.5, scaleY: 2.5,
      alpha: 0,
      duration: 1500,
      ease: 'Sine.easeOut',
      onComplete: () => puff.destroy(),
    })
  }

  // ---------------------------------------------------------------------------
  // Auto-cycle
  // ---------------------------------------------------------------------------

  private scheduleNextAutoCycle(): void {
    const delay = AUTO_CYCLE_MIN_MS + Math.random() * (AUTO_CYCLE_MAX_MS - AUTO_CYCLE_MIN_MS)
    this.autoCycleTimer = this.scene.time.addEvent({
      delay,
      callback: () => this.doAutoCycle(),
    })
  }

  private doAutoCycle(): void {
    // Pick a random weather type different from current target
    const candidates = ALL_WEATHER_TYPES.filter(t => t !== this.targetWeather)
    const next = candidates[Math.floor(Math.random() * candidates.length)]
    this.setWeather(next, TRANSITION_DURATION_DEFAULT)
    this.scheduleNextAutoCycle()
  }
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

/** Move `current` toward `target` by at most `step`, clamping at target. */
function stepToward(current: number, target: number, step: number): number {
  if (step <= 0) return current
  const diff = target - current
  if (Math.abs(diff) <= step) return target
  return current + Math.sign(diff) * step
}
