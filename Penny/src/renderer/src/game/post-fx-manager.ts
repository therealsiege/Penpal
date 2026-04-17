import Phaser from 'phaser'

// ---------------------------------------------------------------------------
// PostFXManager
// Manages camera-level postFX: vignette, bloom, and time-of-day color grading.
// Quality levels: off | low | high — persisted to localStorage.
// Press P to cycle quality levels.
// ---------------------------------------------------------------------------

export type QualityLevel = 'off' | 'low' | 'high'
export type TimePhase = 'morning' | 'day' | 'evening' | 'night'

const STORAGE_KEY = 'penny-postfx-quality'
const QUALITY_LEVELS: QualityLevel[] = ['off', 'low', 'high']

// Vignette parameters per phase
const VIGNETTE: Record<TimePhase, { radius: number; strength: number }> = {
  morning: { radius: 0.9, strength: 0.2 },
  day:     { radius: 0.9, strength: 0.2 },
  evening: { radius: 0.9, strength: 0.2 },
  night:   { radius: 0.8, strength: 0.4 },
}

// Bloom strength base and night multiplier
const BLOOM_BASE    = 0.4
const BLOOM_NIGHT   = BLOOM_BASE * 1.3
const BLOOM_BLUR    = 6
const BLOOM_STEPS   = 4

// Color matrix: warm morning (subtle amber)
// Row-major 4×5 (RGBA + offset): [R→R, G→R, B→R, A→R, offset, R→G, ...]
const WARM_MORNING: number[] = [
  1.06, 0, 0, 0, 0,
  0, 0.97, 0, 0, 0,
  0, 0, 0.92, 0, 0,
  0, 0, 0,    1, 0,
]

// Color matrix: warm evening (golden hour, stronger)
const WARM_EVENING: number[] = [
  1.10, 0, 0, 0, 0,
  0, 0.93, 0, 0, 0,
  0, 0, 0.85, 0, 0,
  0, 0, 0,    1, 0,
]

export class PostFXManager {
  private scene:   Phaser.Scene
  private camera:  Phaser.Cameras.Scene2D.Camera
  private quality: QualityLevel
  private phase:   TimePhase = 'day'

  private vignette:    Phaser.FX.Vignette | null    = null
  private bloom:       Phaser.FX.Bloom | null        = null
  private colorMatrix: Phaser.FX.ColorMatrix | null  = null

  private colorGradeTimer: Phaser.Time.TimerEvent | null = null

  constructor(scene: Phaser.Scene) {
    this.scene  = scene
    this.camera = scene.cameras.main

    const saved = localStorage.getItem(STORAGE_KEY) as QualityLevel | null
    this.quality = QUALITY_LEVELS.includes(saved as QualityLevel) ? (saved as QualityLevel) : 'high'

    this.applyEffects()
    this.startColorGradeTimer()
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /** Called by OfficeAtmosphere (via callback) when the time-of-day phase changes. */
  onPhaseChange(phase: TimePhase, animate: boolean): void {
    this.phase = phase

    // Vignette — tween or snap
    if (this.vignette) {
      const p = VIGNETTE[phase]
      if (animate) {
        this.scene.tweens.killTweensOf(this.vignette)
        this.scene.tweens.add({
          targets:  this.vignette,
          radius:   p.radius,
          strength: p.strength,
          duration: 3000,
          ease:     'Sine.easeInOut',
        })
      } else {
        this.vignette.radius   = p.radius
        this.vignette.strength = p.strength
      }
    }

    // Bloom — tween strength
    if (this.bloom) {
      const strength = phase === 'night' ? BLOOM_NIGHT : BLOOM_BASE
      if (animate) {
        this.scene.tweens.killTweensOf(this.bloom)
        this.scene.tweens.add({
          targets:  this.bloom,
          strength,
          duration: 3000,
          ease:     'Sine.easeInOut',
        })
      } else {
        this.bloom.strength = strength
      }
    }

    // Color grading — immediate (matrix swap, no GPU tween)
    this.applyColorGrade()
  }

  /** Cycle through off → low → high → off. Returns the new level. */
  cycleQuality(): QualityLevel {
    const idx  = QUALITY_LEVELS.indexOf(this.quality)
    const next = QUALITY_LEVELS[(idx + 1) % QUALITY_LEVELS.length]
    this.setQuality(next)
    return next
  }

  setQuality(level: QualityLevel): void {
    this.quality = level
    localStorage.setItem(STORAGE_KEY, level)
    this.applyEffects()
  }

  getQuality(): QualityLevel {
    return this.quality
  }

  destroy(): void {
    this.colorGradeTimer?.destroy()
    this.colorGradeTimer = null
    this.removeAll()
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private applyEffects(): void {
    this.removeAll()
    if (this.quality === 'off') return

    const p = VIGNETTE[this.phase]
    this.vignette = this.camera.postFX.addVignette(0.5, 0.5, p.radius, p.strength)
    if (this.quality !== 'high') return

    const bloomStrength = this.phase === 'night' ? BLOOM_NIGHT : BLOOM_BASE
    this.bloom = this.camera.postFX.addBloom(0xffffff, 1, 1, BLOOM_BLUR, bloomStrength, BLOOM_STEPS)

    this.colorMatrix = this.camera.postFX.addColorMatrix()
    this.applyColorGrade()
  }

  private removeAll(): void {
    if (this.vignette)    { this.camera.postFX.remove(this.vignette);    this.vignette = null }
    if (this.bloom)       { this.camera.postFX.remove(this.bloom);       this.bloom = null }
    if (this.colorMatrix) { this.camera.postFX.remove(this.colorMatrix); this.colorMatrix = null }
  }

  private applyColorGrade(): void {
    const cm = this.colorMatrix
    if (!cm) return

    cm.reset()
    switch (this.phase) {
      case 'morning':
        cm.multiply(WARM_MORNING)
        break
      case 'evening':
        cm.multiply(WARM_EVENING)
        break
      case 'night':
        cm.night(0.15)
        cm.saturate(-0.15, true)
        break
      default:
        // day: neutral — reset is sufficient
        break
    }
  }

  /** Re-applies color grading every 30s so it stays in sync with the current phase. */
  private startColorGradeTimer(): void {
    this.colorGradeTimer = this.scene.time.addEvent({
      delay:    30_000,
      callback: () => this.applyColorGrade(),
      loop:     true,
    })
  }
}
