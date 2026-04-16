// ---------------------------------------------------------------------------
// camera-cinematics.ts
// Scripted camera sequences: panTo, zoomTo, panAndZoom, shake, flash, sequence.
// Manual input is suppressed while a cinematic is playing; bounds-elastic bounce
// (10px overshoot → 200ms spring-back) is applied on bound hits.
// ---------------------------------------------------------------------------

import Phaser from 'phaser'
import { ZOOM_MIN, ZOOM_MAX } from './office-constants'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CameraStepEase = string  // e.g. 'Sine.easeInOut', 'Power2'

export interface CameraStep {
  /** World-space pan target. Omit to pan-in-place (zoom only). */
  x?: number
  y?: number
  /** Zoom level. Omit to keep current zoom. */
  zoom?: number
  /** Duration in ms. */
  duration: number
  ease?: CameraStepEase
  /** Optional delay before this step begins (ms). */
  delay?: number
}

export interface CinematicHostScene {
  /** Called before any cinematic to suppress manual drag/zoom. */
  lockCinematicInput(): void
  /** Called after cinematic ends (or is cancelled) to restore input. */
  unlockCinematicInput(): void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Clamp a world-space scroll position against camera bounds. */
function clampScroll(
  tx: number,
  ty: number,
  cam: Phaser.Cameras.Scene2D.Camera,
  zoom: number,
): { x: number; y: number } {
  const bounds = cam.getBounds()
  const vw = cam.width / zoom
  const vh = cam.height / zoom
  const sx = Phaser.Math.Clamp(tx, bounds.x, Math.max(bounds.x, bounds.right - vw))
  const sy = Phaser.Math.Clamp(ty, bounds.y, Math.max(bounds.y, bounds.bottom - vh))
  return { x: sx, y: sy }
}

/** Convert a world-space center target to scroll-space. */
function worldToScroll(
  worldX: number,
  worldY: number,
  cam: Phaser.Cameras.Scene2D.Camera,
  zoom: number,
): { x: number; y: number } {
  return {
    x: worldX - cam.width / (2 * zoom),
    y: worldY - cam.height / (2 * zoom),
  }
}

// ---------------------------------------------------------------------------
// CameraCinematic
// ---------------------------------------------------------------------------

export class CameraCinematic {
  private scene: Phaser.Scene
  private host: CinematicHostScene

  private _playing = false
  private _activeTweens: Phaser.Tweens.Tween[] = []
  private _flashRect: Phaser.GameObjects.Rectangle | null = null

  // State saved before cinematic begins — restored smoothly on cancel/complete.
  private _savedFollowTarget: { x: number; y: number } | null = null
  private _savedTargetZoom = 1

  constructor(scene: Phaser.Scene, host: CinematicHostScene) {
    this.scene = scene
    this.host = host
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  isPlaying(): boolean {
    return this._playing
  }

  /** Abort any running cinematic and return camera to idle (no follow). */
  cancel(): void {
    this._stopAllTweens()
    this._playing = false
    this.host.unlockCinematicInput()
  }

  /**
   * Smooth pan to (worldX, worldY).
   * Respects camera bounds with elastic bounce on edges.
   */
  panTo(worldX: number, worldY: number, duration: number, ease = 'Sine.easeInOut'): Promise<void> {
    return new Promise(resolve => {
      this._beginCinematic()
      const cam = this.scene.cameras.main
      const z = cam.zoom
      const raw = worldToScroll(worldX, worldY, cam, z)
      const clamped = clampScroll(raw.x, raw.y, cam, z)
      const hitBoundX = Math.abs(raw.x - clamped.x) > 0.5
      const hitBoundY = Math.abs(raw.y - clamped.y) > 0.5

      if (hitBoundX || hitBoundY) {
        this._elasticPan(clamped.x, clamped.y, raw.x, raw.y, duration, ease, () => {
          this._endCinematic()
          resolve()
        })
      } else {
        const tween = this.scene.tweens.add({
          targets: cam,
          scrollX: clamped.x,
          scrollY: clamped.y,
          duration,
          ease,
          onComplete: () => {
            this._removeTween(tween)
            this._endCinematic()
            resolve()
          },
        })
        this._activeTweens.push(tween)
      }
    })
  }

  /**
   * Smooth zoom to target level.
   */
  zoomTo(level: number, duration: number, ease = 'Sine.easeInOut'): Promise<void> {
    return new Promise(resolve => {
      this._beginCinematic()
      const cam = this.scene.cameras.main
      const target = Phaser.Math.Clamp(level, ZOOM_MIN, ZOOM_MAX)
      const proxy = { zoom: cam.zoom }
      const tween = this.scene.tweens.add({
        targets: proxy,
        zoom: target,
        duration,
        ease,
        onUpdate: () => cam.setZoom(proxy.zoom),
        onComplete: () => {
          cam.setZoom(target)
          this._removeTween(tween)
          this._endCinematic()
          resolve()
        },
      })
      this._activeTweens.push(tween)
    })
  }

  /**
   * Pan and zoom simultaneously.
   */
  panAndZoom(
    worldX: number,
    worldY: number,
    zoom: number,
    duration: number,
    ease = 'Sine.easeInOut',
  ): Promise<void> {
    return new Promise(resolve => {
      this._beginCinematic()
      const cam = this.scene.cameras.main
      const targetZoom = Phaser.Math.Clamp(zoom, ZOOM_MIN, ZOOM_MAX)
      const raw = worldToScroll(worldX, worldY, cam, targetZoom)
      const clamped = clampScroll(raw.x, raw.y, cam, targetZoom)

      const proxy = { zoom: cam.zoom, scrollX: cam.scrollX, scrollY: cam.scrollY }
      const tween = this.scene.tweens.add({
        targets: proxy,
        zoom: targetZoom,
        scrollX: clamped.x,
        scrollY: clamped.y,
        duration,
        ease,
        onUpdate: () => {
          cam.setZoom(proxy.zoom)
          cam.setScroll(proxy.scrollX, proxy.scrollY)
        },
        onComplete: () => {
          cam.setZoom(targetZoom)
          cam.setScroll(clamped.x, clamped.y)
          this._removeTween(tween)
          this._endCinematic()
          resolve()
        },
      })
      this._activeTweens.push(tween)
    })
  }

  /**
   * Directional shake.
   * @param direction  'both' | 'horizontal' | 'vertical' — default 'both'
   */
  shake(duration = 300, intensity = 0.003, direction: 'both' | 'horizontal' | 'vertical' = 'both'): void {
    const cam = this.scene.cameras.main
    const ix = direction === 'vertical' ? 0 : intensity
    const iy = direction === 'horizontal' ? 0 : intensity
    cam.shake(duration, [ix, iy])
  }

  /**
   * Full-screen flash overlay.
   * @param color    0xRRGGBB hex color
   * @param duration total duration in ms (fade-in + hold + fade-out)
   * @param alpha    peak alpha (default 0.6)
   */
  flash(color: number, duration = 300, alpha = 0.6): void {
    if (!this._flashRect) {
      this._flashRect = this.scene.add
        .rectangle(0, 0, 8000, 8000, color, 0)
        .setOrigin(0.5, 0.5)
        .setDepth(9998)
        .setScrollFactor(0)
    } else {
      this._flashRect.setFillStyle(color)
      this._flashRect.setAlpha(0)
      this._flashRect.setVisible(true)
    }

    const half = Math.max(40, Math.floor(duration / 2))
    const tween = this.scene.tweens.add({
      targets: this._flashRect,
      alpha,
      duration: half,
      ease: 'Sine.easeOut',
      yoyo: true,
      onComplete: () => {
        this._flashRect?.setAlpha(0)
        this._removeTween(tween)
      },
    })
    this._activeTweens.push(tween)
  }

  /**
   * Chain multiple camera steps in sequence.
   * Each step can pan, zoom, or both.
   */
  async sequence(steps: CameraStep[]): Promise<void> {
    this._beginCinematic()
    try {
      for (const step of steps) {
        if (step.delay && step.delay > 0) {
          await this._delay(step.delay)
        }
        const hasPan = step.x != null && step.y != null
        const hasZoom = step.zoom != null
        if (hasPan && hasZoom) {
          await this._sequenceStep_panAndZoom(step.x!, step.y!, step.zoom!, step.duration, step.ease)
        } else if (hasPan) {
          await this._sequenceStep_pan(step.x!, step.y!, step.duration, step.ease)
        } else if (hasZoom) {
          await this._sequenceStep_zoom(step.zoom!, step.duration, step.ease)
        }
      }
    } finally {
      this._endCinematic()
    }
  }

  // ---------------------------------------------------------------------------
  // Private — sequence step helpers (no lock/unlock, _playing already set)
  // ---------------------------------------------------------------------------

  private _sequenceStep_pan(worldX: number, worldY: number, duration: number, ease = 'Sine.easeInOut'): Promise<void> {
    return new Promise(resolve => {
      const cam = this.scene.cameras.main
      const z = cam.zoom
      const raw = worldToScroll(worldX, worldY, cam, z)
      const clamped = clampScroll(raw.x, raw.y, cam, z)
      const hitBound = Math.abs(raw.x - clamped.x) > 0.5 || Math.abs(raw.y - clamped.y) > 0.5
      if (hitBound) {
        this._elasticPan(clamped.x, clamped.y, raw.x, raw.y, duration, ease, resolve)
      } else {
        const tween = this.scene.tweens.add({
          targets: cam,
          scrollX: clamped.x,
          scrollY: clamped.y,
          duration,
          ease,
          onComplete: () => { this._removeTween(tween); resolve() },
        })
        this._activeTweens.push(tween)
      }
    })
  }

  private _sequenceStep_zoom(zoom: number, duration: number, ease = 'Sine.easeInOut'): Promise<void> {
    return new Promise(resolve => {
      const cam = this.scene.cameras.main
      const target = Phaser.Math.Clamp(zoom, ZOOM_MIN, ZOOM_MAX)
      const proxy = { zoom: cam.zoom }
      const tween = this.scene.tweens.add({
        targets: proxy,
        zoom: target,
        duration,
        ease,
        onUpdate: () => cam.setZoom(proxy.zoom),
        onComplete: () => { cam.setZoom(target); this._removeTween(tween); resolve() },
      })
      this._activeTweens.push(tween)
    })
  }

  private _sequenceStep_panAndZoom(worldX: number, worldY: number, zoom: number, duration: number, ease = 'Sine.easeInOut'): Promise<void> {
    return new Promise(resolve => {
      const cam = this.scene.cameras.main
      const targetZoom = Phaser.Math.Clamp(zoom, ZOOM_MIN, ZOOM_MAX)
      const raw = worldToScroll(worldX, worldY, cam, targetZoom)
      const clamped = clampScroll(raw.x, raw.y, cam, targetZoom)
      const proxy = { zoom: cam.zoom, scrollX: cam.scrollX, scrollY: cam.scrollY }
      const tween = this.scene.tweens.add({
        targets: proxy,
        zoom: targetZoom,
        scrollX: clamped.x,
        scrollY: clamped.y,
        duration,
        ease,
        onUpdate: () => { cam.setZoom(proxy.zoom); cam.setScroll(proxy.scrollX, proxy.scrollY) },
        onComplete: () => {
          cam.setZoom(targetZoom)
          cam.setScroll(clamped.x, clamped.y)
          this._removeTween(tween)
          resolve()
        },
      })
      this._activeTweens.push(tween)
    })
  }

  // ---------------------------------------------------------------------------
  // Private — elastic bounce on bounds
  // ---------------------------------------------------------------------------

  /**
   * Animate to `clampedX/Y`, then overshoot 10px back toward center,
   * then spring to exact clamped position in 200ms.
   */
  private _elasticPan(
    clampedX: number,
    clampedY: number,
    rawX: number,
    rawY: number,
    duration: number,
    ease: string,
    onDone: () => void,
  ): void {
    const cam = this.scene.cameras.main
    // Overshoot direction: push slightly away from the wall
    const OVERSHOOT = 10
    const ox = rawX < clampedX ? clampedX + OVERSHOOT : (rawX > clampedX + 0.5 ? clampedX - OVERSHOOT : clampedX)
    const oy = rawY < clampedY ? clampedY + OVERSHOOT : (rawY > clampedY + 0.5 ? clampedY - OVERSHOOT : clampedY)

    const t1 = this.scene.tweens.add({
      targets: cam,
      scrollX: ox,
      scrollY: oy,
      duration,
      ease,
      onComplete: () => {
        this._removeTween(t1)
        // Spring back to exact clamped position
        const t2 = this.scene.tweens.add({
          targets: cam,
          scrollX: clampedX,
          scrollY: clampedY,
          duration: 200,
          ease: 'Back.easeOut',
          onComplete: () => {
            this._removeTween(t2)
            onDone()
          },
        })
        this._activeTweens.push(t2)
      },
    })
    this._activeTweens.push(t1)
  }

  // ---------------------------------------------------------------------------
  // Private — lifecycle helpers
  // ---------------------------------------------------------------------------

  private _beginCinematic(): void {
    if (!this._playing) {
      this._playing = true
      this.host.lockCinematicInput()
    }
  }

  private _endCinematic(): void {
    this._playing = false
    this.host.unlockCinematicInput()
  }

  private _stopAllTweens(): void {
    for (const t of this._activeTweens) {
      if (t && t.isPlaying()) t.stop()
    }
    this._activeTweens = []
  }

  private _removeTween(tween: Phaser.Tweens.Tween): void {
    const idx = this._activeTweens.indexOf(tween)
    if (idx !== -1) this._activeTweens.splice(idx, 1)
  }

  private _delay(ms: number): Promise<void> {
    return new Promise(resolve => this.scene.time.delayedCall(ms, resolve))
  }
}
