import Phaser from 'phaser'
import { lerpColor } from './office-theme'
import { SPRITESHEET_KEYS, ICON_FRAMES } from './office-asset-keys'

// ---------------------------------------------------------------------------
// AtmosphereSky
// Manages: sky gradient, starfield, cloud layer, ambient haze.
// Created by OfficeAtmosphere; receives worldWidth/worldHeight for wrapping.
// ---------------------------------------------------------------------------

export class AtmosphereSky {
  private scene: Phaser.Scene

  // Sky gradient (depth -11 background layer)
  private skyGradient: Phaser.GameObjects.Graphics | null = null

  // Starfield (Arc circles + occasional Sprite stars for the brightest ones)
  private starPool: (Phaser.GameObjects.Arc | Phaser.GameObjects.Sprite)[] = []
  private lastTwinkleAt = 0

  // Cloud layer
  private cloudPool: Phaser.GameObjects.Graphics[] = []

  // Ambient haze / fog layer
  private hazeOverlay: Phaser.GameObjects.Graphics | null = null
  hazeAlphaScale = 0.5
  private hazeBreathTime = 0

  // World dimensions (needed for cloud wrapping)
  private worldWidth = 2400
  private worldHeight = 1200

  // Exposed for OfficeAtmosphere.applyDayNightCycle()
  get stars(): (Phaser.GameObjects.Arc | Phaser.GameObjects.Sprite)[] { return this.starPool }
  get clouds(): Phaser.GameObjects.Graphics[] { return this.cloudPool }
  get haze(): Phaser.GameObjects.Graphics | null { return this.hazeOverlay }

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  // ---------------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------------

  init(
    skyGradient: Phaser.GameObjects.Graphics,
    worldWidth: number,
    worldHeight: number,
  ): void {
    this.skyGradient = skyGradient
    this.worldWidth = worldWidth
    this.worldHeight = worldHeight

    this.initStarfield()
    this.initCloudLayer()
    this.initHaze()
  }

  updateWorldSize(w: number, h: number): void {
    this.worldWidth = w
    this.worldHeight = h
  }

  // ---------------------------------------------------------------------------
  // Haze / fog overlay
  // ---------------------------------------------------------------------------

  private initHaze(): void {
    const W = 4000  // generous fixed size to cover any viewport
    const H = 4000
    const gfx = this.scene.add.graphics()
    gfx.setDepth(9996)       // just below day/night overlay (9997)
    gfx.setScrollFactor(0)

    // Vertical gradient: transparent at top, slightly foggy in the lower 40%
    const FOG_COLOR = 0x141a22
    const STRIPS = 100
    const stripH = H / STRIPS
    const fogStart = 0.6  // top 60% is clear, bottom 40% has fog

    for (let i = 0; i < STRIPS; i++) {
      const t = i / (STRIPS - 1)
      let alpha = 0
      if (t > fogStart) {
        // Ramp from 0 to 0.04 over the bottom 40%
        alpha = ((t - fogStart) / (1 - fogStart)) * 0.06
      }
      gfx.fillStyle(FOG_COLOR, alpha)
      gfx.fillRect(-W / 2, -H / 2 + i * stripH, W, stripH + 1)
    }

    gfx.setAlpha(this.hazeAlphaScale)
    this.hazeOverlay = gfx
  }

  // ---------------------------------------------------------------------------
  // Tick
  // ---------------------------------------------------------------------------

  tick(time: number): void {
    if (this.starPool.length > 0 && time - this.lastTwinkleAt >= 500) {
      this.lastTwinkleAt = time
      this.tickStarfieldTwinkle()
    }
    this.tickClouds()
    // Haze breathing: slow sine modulation (~8s period, amplitude 0.01)
    if (this.hazeOverlay) {
      this.hazeBreathTime = time
      const breath = Math.sin(time / 1000 * (Math.PI * 2 / 8)) * 0.015
      this.hazeOverlay.setAlpha(Math.max(0, this.hazeAlphaScale + breath))
    }
  }

  // ---------------------------------------------------------------------------
  // Destroy
  // ---------------------------------------------------------------------------

  destroy(): void {
    this.skyGradient?.destroy()
    this.skyGradient = null

    for (const s of this.starPool) { this.scene.tweens.killTweensOf(s); s.destroy() }
    this.starPool = []

    for (const c of this.cloudPool) { this.scene.tweens.killTweensOf(c); c.destroy() }
    this.cloudPool = []

    if (this.hazeOverlay) {
      this.scene.tweens.killTweensOf(this.hazeOverlay)
      this.hazeOverlay.destroy()
      this.hazeOverlay = null
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
    // Center the gradient around origin so it covers the viewport at any scroll/zoom.
    // With setScrollFactor(0), (0,0) is the camera center at zoom 1; at other zoom
    // levels the visible extent is W/zoom, so we draw from -W/2 to +W/2.
    const ox = -W / 2
    const oy = -H / 2
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
      g.fillRect(ox, oy + i * stripH, W, stripH + 1)
    }
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

    const hasIcons = this.scene.textures.exists(SPRITESHEET_KEYS.GAME_ICONS)

    const count = 50 + Math.floor(Math.random() * 31) // 50-80 stars
    // Track the brightest stars to replace a handful with star sprites
    const brightIndices = new Set<number>()
    if (hasIcons) {
      // Pre-select 8 random indices from the first `count` entries for sprite stars
      while (brightIndices.size < Math.min(8, count)) {
        brightIndices.add(Math.floor(Math.random() * count))
      }
    }

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

      if (brightIndices.has(i)) {
        // Replace brightest stars with tiny star sprites for a polished twinkle
        const starSprite = this.scene.add.sprite(x, y, SPRITESHEET_KEYS.GAME_ICONS, ICON_FRAMES.STAR_YELLOW)
          .setDepth(-10)
          .setScale(0.06) // ~2px star among 1-2px circle stars
          .setAlpha(baseAlpha)
          .setTint(chosenColor)
          .setBlendMode(Phaser.BlendModes.ADD)
        starSprite.setData('baseAlpha', baseAlpha)
        starSprite.setData('isStarSprite', true)
        this.starPool.push(starSprite)
      } else {
        const star = this.scene.add.circle(x, y, radius, chosenColor, baseAlpha)
        star.setDepth(-10)
        star.setData('baseAlpha', baseAlpha)
        star.setData('isStarSprite', false)
        this.starPool.push(star)
      }
    }
  }

  private tickStarfieldTwinkle(): void {
    if (this.starPool.length === 0) return
    const count = 3 + Math.floor(Math.random() * 3) // 3-5 stars per tick
    for (let i = 0; i < count; i++) {
      const star = this.starPool[Math.floor(Math.random() * this.starPool.length)]
      const baseAlpha = star.getData('baseAlpha') as number
      const currentAlpha = star.alpha
      const isSprite = star.getData('isStarSprite') as boolean

      // Peak is 2x the star's current alpha ceiling (respects day/night scaling)
      const peakAlpha = Math.min(currentAlpha * 2.5, 0.35)
      this.scene.tweens.killTweensOf(star)

      if (isSprite) {
        // Star sprites get a scale pulse alongside the alpha twinkle
        const baseScale = (star as Phaser.GameObjects.Sprite).scaleX
        this.scene.tweens.add({
          targets: star,
          alpha: peakAlpha,
          scaleX: baseScale * 1.3,
          scaleY: baseScale * 1.3,
          duration: 700,
          ease: 'Sine.easeIn',
          yoyo: true,
          hold: 100,
          onComplete: () => {
            const phaseMultiplier = star.getData('phaseMultiplier') as number ?? 1.0
            this.scene.tweens.add({
              targets: star,
              alpha: baseAlpha * phaseMultiplier,
              scaleX: baseScale,
              scaleY: baseScale,
              duration: 800,
              ease: 'Sine.easeOut',
            })
          },
        })
      } else {
        this.scene.tweens.add({
          targets: star,
          alpha: peakAlpha,
          duration: 700,
          ease: 'Sine.easeIn',
          yoyo: true,
          hold: 100,
          onComplete: () => {
            // Settle back to the phase-adjusted base alpha — read from stored data
            const phaseMultiplier = star.getData('phaseMultiplier') as number ?? 1.0
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
  }

  /** Update phase multiplier stored on each star so twinkle onComplete uses correct alpha. */
  setStarPhaseMultiplier(multiplier: number): void {
    for (const star of this.starPool) {
      star.setData('phaseMultiplier', multiplier)
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

  redrawCloud(gfx: Phaser.GameObjects.Graphics, color: number): void {
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
}
