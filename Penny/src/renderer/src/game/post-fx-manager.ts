// ---------------------------------------------------------------------------
// post-fx-manager.ts
// PostFXManager — event-triggered camera post-processing effects.
//
// Two effects, both gated to 'high' quality:
//   - Chromatic aberration (barrel distortion) on screen shake
//   - Focus blur (gaussian blur) on cinematic zoom transitions
//
// Both are applied to the main camera's postFX pipeline and cleaned up
// automatically when their tween completes.
// ---------------------------------------------------------------------------

import Phaser from 'phaser'

export type PostFXQuality = 'low' | 'medium' | 'high'

// ---------------------------------------------------------------------------
// PostFXManager
// ---------------------------------------------------------------------------

export class PostFXManager {
  private _scene: Phaser.Scene
  private _quality: PostFXQuality

  private _barrelFx: Phaser.FX.Barrel | null = null
  private _blurFx: Phaser.FX.Blur | null = null
  private _chromaticTween: Phaser.Tweens.Tween | null = null
  private _blurTween: Phaser.Tweens.Tween | null = null

  constructor(scene: Phaser.Scene, quality: PostFXQuality = 'high') {
    this._scene = scene
    this._quality = quality
  }

  setQuality(q: PostFXQuality): void {
    this._quality = q
  }

  getQuality(): PostFXQuality {
    return this._quality
  }

  // ---------------------------------------------------------------------------
  // Chromatic aberration — synced with screen shake
  // ---------------------------------------------------------------------------

  /**
   * Brief barrel-distortion flare simulating chromatic aberration.
   * Tweens distortion amount from 0 → peak → 0 over `durationMs` (default 150ms).
   * Only fires at 'high' quality.
   */
  flashChromaticAberration(durationMs = 150): void {
    if (this._quality !== 'high') return

    // Cancel any in-progress chromatic tween and remove the effect cleanly
    this._stopChromatic()

    const cam = this._scene.cameras.main
    this._barrelFx = cam.postFX.addBarrel(0)
    const fx = this._barrelFx
    const half = Math.max(20, Math.floor(durationMs / 2))

    this._chromaticTween = this._scene.tweens.addCounter({
      from: 0,
      to: 0.07,
      duration: half,
      ease: 'Sine.easeOut',
      yoyo: true,
      onUpdate: (tween) => {
        if (fx) fx.amount = tween.getValue() as number
      },
      onComplete: () => {
        this._chromaticTween = null
        if (this._barrelFx) {
          cam.postFX.remove(this._barrelFx)
          this._barrelFx = null
        }
      },
    })
  }

  // ---------------------------------------------------------------------------
  // Focus blur — synced with cinematic zoom transitions
  // ---------------------------------------------------------------------------

  /**
   * Brief gaussian blur flare simulating a camera lens focus pull.
   * Strength tweens 0 → peak → 0 over `totalDurationMs` (default 300ms).
   * Only fires at 'high' quality.
   */
  flashFocusBlur(totalDurationMs = 300): void {
    if (this._quality !== 'high') return

    // Cancel any in-progress blur tween and remove the effect cleanly
    this._stopBlur()

    const cam = this._scene.cameras.main
    // quality 0 = low (fast, 1 pass), direction x/y 2,2 = slight radial spread, strength starts at 0
    this._blurFx = cam.postFX.addBlur(0, 2, 2, 0)
    const fx = this._blurFx
    const half = Math.max(30, Math.floor(totalDurationMs / 2))

    this._blurTween = this._scene.tweens.addCounter({
      from: 0,
      to: 1.5,
      duration: half,
      ease: 'Sine.easeOut',
      yoyo: true,
      onUpdate: (tween) => {
        if (fx) fx.strength = tween.getValue() as number
      },
      onComplete: () => {
        this._blurTween = null
        if (this._blurFx) {
          cam.postFX.remove(this._blurFx)
          this._blurFx = null
        }
      },
    })
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  destroy(): void {
    this._stopChromatic()
    this._stopBlur()
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private _stopChromatic(): void {
    if (this._chromaticTween) {
      this._chromaticTween.stop()
      this._chromaticTween = null
    }
    if (this._barrelFx) {
      this._scene.cameras.main.postFX.remove(this._barrelFx)
      this._barrelFx = null
    }
  }

  private _stopBlur(): void {
    if (this._blurTween) {
      this._blurTween.stop()
      this._blurTween = null
    }
    if (this._blurFx) {
      this._scene.cameras.main.postFX.remove(this._blurFx)
      this._blurFx = null
    }
  }
}
