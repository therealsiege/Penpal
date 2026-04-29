/**
 * animated-bar.ts
 *
 * Reusable animated progress bar backed by Phaser.GameObjects.Graphics.
 * Renders a background track + filled layer, tweens fill width on update.
 * Resolution-aware: pass resolution: 2 for Retina displays.
 *
 * When `useSliderSprites` is true, the bar renders using SLIDER_TRACK and
 * SLIDER_FILL image sprites (from IMAGE_KEYS) instead of Graphics rectangles.
 * The sprites are scaled to match the configured width/height.
 *
 * Usage:
 *   const bar = new AnimatedBar({ scene, x, y, width: 80, height: 6,
 *                                  fillColor: 0x3b82f6, backgroundColor: 0x141a22 })
 *   bar.setPercent(0.72)          // animated
 *   bar.setPercent(0.5, false)    // instant
 *
 *   // Sprite mode:
 *   const spriteBar = new AnimatedBar({ scene, x, y, width: 96, height: 16,
 *                                       fillColor: 0, backgroundColor: 0,
 *                                       useSliderSprites: true })
 */

import { IMAGE_KEYS } from './office-asset-keys'

export interface BarConfig {
  scene: Phaser.Scene
  x: number
  y: number
  width: number
  height: number
  fillColor: number
  backgroundColor: number
  borderColor?: number
  borderWidth?: number
  ease?: string
  duration?: number
  /** Pass 2 for Retina / HiDPI displays. Default 1. */
  resolution?: number
  /**
   * When true, renders using SLIDER_TRACK / SLIDER_FILL sprites instead of
   * Graphics rectangles. The sprites are scaled to match width/height.
   * fillColor and backgroundColor are ignored in this mode.
   */
  useSliderSprites?: boolean
}

export class AnimatedBar {
  private readonly _scene: Phaser.Scene
  private readonly _cfg: Required<Omit<BarConfig, 'scene'>>

  /** Graphics object that owns both layers (used in Graphics mode). */
  private readonly _gfx: Phaser.GameObjects.Graphics

  /** Current fill width in logical pixels (tracks the tween target). */
  private _fillWidth: number

  /** Active tween — killed before each new one to prevent stacking. */
  private _tween: Phaser.Tweens.Tween | undefined

  /** Logical fill percentage [0, 1]. */
  private _percent: number

  // --- Sprite mode fields ---
  private _trackSprite: Phaser.GameObjects.Image | null = null
  private _fillSprite: Phaser.GameObjects.Image | null = null
  /** Container holding sprite-mode elements (null when using Graphics mode). */
  private _spriteContainer: Phaser.GameObjects.Container | null = null

  constructor(config: BarConfig) {
    this._scene = config.scene

    // Apply defaults
    this._cfg = {
      x: config.x,
      y: config.y,
      width: config.width,
      height: config.height,
      fillColor: config.fillColor,
      backgroundColor: config.backgroundColor,
      borderColor: config.borderColor ?? -1,
      borderWidth: config.borderWidth ?? 1,
      ease: config.ease ?? 'Sine.easeOut',
      duration: config.duration ?? 400,
      resolution: config.resolution ?? 1,
      useSliderSprites: config.useSliderSprites ?? false,
    }

    this._percent = 0
    this._fillWidth = 0

    this._gfx = this._scene.add.graphics()
    this._gfx.setPosition(config.x, config.y)

    if (this._cfg.useSliderSprites && this._scene.textures.exists(IMAGE_KEYS.SLIDER_TRACK)) {
      this._initSliderSprites()
      // Hide the Graphics object — sprites handle rendering
      this._gfx.setVisible(false)
    }

    this._redraw()
  }

  /**
   * Creates sprite-based track + fill images, scaled to match the configured
   * width and height. The fill sprite uses cropRect for width animation.
   */
  private _initSliderSprites(): void {
    const { x, y, width, height } = this._cfg

    this._spriteContainer = this._scene.add.container(x, y)

    // Track sprite — full width background
    this._trackSprite = this._scene.add.image(0, 0, IMAGE_KEYS.SLIDER_TRACK)
      .setOrigin(0, 0)
      .setDisplaySize(width, height)
    this._spriteContainer.add(this._trackSprite)

    // Fill sprite — width controlled by crop rect
    this._fillSprite = this._scene.add.image(0, 0, IMAGE_KEYS.SLIDER_FILL)
      .setOrigin(0, 0)
      .setDisplaySize(width, height)
    this._spriteContainer.add(this._fillSprite)

    // Start with zero fill
    this._updateFillSpriteCrop()
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /** The current target percentage [0, 1]. */
  get percent(): number {
    return this._percent
  }

  /** The underlying Graphics object. Add to a Container with container.add(bar.graphics). */
  get graphics(): Phaser.GameObjects.Graphics {
    return this._gfx
  }

  /**
   * The sprite container (available only in slider-sprite mode).
   * Add to a parent Container with container.add(bar.spriteContainer!).
   */
  get spriteContainer(): Phaser.GameObjects.Container | null {
    return this._spriteContainer
  }

  /**
   * Set the fill level.
   * @param pct - Target percentage in [0, 1].
   * @param animate - Whether to tween to the new value. Defaults to true.
   */
  setPercent(pct: number, animate = true): void {
    const clamped = Math.min(1, Math.max(0, pct))
    this._percent = clamped
    const targetWidth = Math.floor(this._cfg.width * clamped)

    if (!animate) {
      this._killTween()
      this._fillWidth = targetWidth
      this._redraw()
      return
    }

    this._killTween()
    const proxy = { w: this._fillWidth }
    this._tween = this._scene.tweens.add({
      targets: proxy,
      w: targetWidth,
      duration: this._cfg.duration,
      ease: this._cfg.ease,
      onUpdate: () => {
        this._fillWidth = Math.round(proxy.w)
        this._redraw()
      },
      onComplete: () => {
        this._fillWidth = targetWidth
        this._redraw()
        this._tween = undefined
      },
    })
  }

  /** Jump to the current target immediately, cancelling any active tween. */
  skipAnimation(): void {
    this._killTween()
    this._fillWidth = Math.floor(this._cfg.width * this._percent)
    this._redraw()
  }

  setPosition(x: number, y: number): void {
    this._cfg.x = x
    this._cfg.y = y
    this._gfx.setPosition(x, y)
    this._spriteContainer?.setPosition(x, y)
  }

  setVisible(visible: boolean): void {
    if (this._spriteContainer) {
      this._spriteContainer.setVisible(visible)
    } else {
      this._gfx.setVisible(visible)
    }
  }

  /** Hot-swap fill color without changing the current percentage. */
  setFillColor(color: number): void {
    this._cfg.fillColor = color
    this._redraw()
  }

  destroy(): void {
    this._killTween()
    this._gfx.destroy()
    if (this._spriteContainer) {
      this._spriteContainer.destroy(true)
      this._spriteContainer = null
      this._trackSprite = null
      this._fillSprite = null
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private _killTween(): void {
    if (this._tween) {
      this._tween.destroy()
      this._tween = undefined
    }
  }

  /**
   * Updates the fill sprite crop rect to show only the filled portion.
   * Uses Phaser's setCrop which works in texture-space pixels.
   */
  private _updateFillSpriteCrop(): void {
    if (!this._fillSprite) return
    const tex = this._fillSprite.texture.getSourceImage()
    const texW = (tex as HTMLImageElement).width || 96
    const texH = (tex as HTMLImageElement).height || 16
    // Map logical fill width to texture-space width
    const cropW = this._cfg.width > 0
      ? Math.round((this._fillWidth / this._cfg.width) * texW)
      : 0
    this._fillSprite.setCrop(0, 0, cropW, texH)
  }

  /**
   * Clears and redraws both layers onto the single Graphics object.
   * Origin is the top-left corner of the bar (0, 0) in local space.
   * The Graphics object is positioned at (cfg.x, cfg.y) in world space.
   *
   * In sprite mode, updates the fill sprite crop instead.
   */
  private _redraw(): void {
    // Sprite mode — update crop rect only
    if (this._spriteContainer) {
      this._updateFillSpriteCrop()
      return
    }

    const { width, height, backgroundColor, fillColor, borderColor, borderWidth } = this._cfg
    const gfx = this._gfx
    gfx.clear()

    // Optional border — drawn first so fill sits on top
    if (borderColor !== -1 && borderWidth > 0) {
      gfx.lineStyle(borderWidth, borderColor, 1)
      gfx.strokeRect(-borderWidth / 2, -borderWidth / 2, width + borderWidth, height + borderWidth)
    }

    // Background track
    gfx.fillStyle(backgroundColor, 1)
    gfx.fillRect(0, 0, width, height)

    // Fill layer — only draw when non-zero to avoid a 1px artifact
    if (this._fillWidth > 0) {
      gfx.fillStyle(fillColor, 1)
      gfx.fillRect(0, 0, this._fillWidth, height)
    }
  }
}
