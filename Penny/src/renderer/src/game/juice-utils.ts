// ---------------------------------------------------------------------------
// juice-utils.ts
// Pure utility functions for Phaser 3 game-feel / polish animations.
// No state, no class. Each function returns the Tween (or chain) so callers
// can cancel or await completion via onComplete.
// ---------------------------------------------------------------------------

import * as Phaser from 'phaser'

// ---------------------------------------------------------------------------
// Option types
// ---------------------------------------------------------------------------

export interface FlashOpts {
  /** Tint color applied during the flash. Default 0xffffff (white). */
  tint?: number
  /** Duration of each on→off cycle in ms. Default 120. */
  duration?: number
  /** Number of flash cycles. Default 3. */
  repeat?: number
  /** Called when the final cycle completes. */
  onComplete?: () => void
}

export interface ShakeOpts {
  /** Max pixel offset per axis. Default 4. */
  intensity?: number
  /** Total shake duration in ms. Default 280. */
  duration?: number
  /** Called when the shake finishes. */
  onComplete?: () => void
}

export interface PulseOpts {
  /** Peak scale multiplier. Default 1.18. */
  scale?: number
  /** Duration of grow + shrink in ms. Default 220. */
  duration?: number
  /** Easing for the grow phase. Default 'Back.easeOut'. */
  ease?: string
  /** Called when the pulse completes. */
  onComplete?: () => void
}

export interface FadeInUpOpts {
  /** Distance in px to slide up from. Default 18. */
  offset?: number
  /** Animation duration in ms. Default 240. */
  duration?: number
  /** Easing. Default 'Power2'. */
  ease?: string
  /** Called when fully visible. */
  onComplete?: () => void
}

export interface FadeOutDownOpts {
  /** Distance in px to slide down to. Default 18. */
  offset?: number
  /** Animation duration in ms. Default 200. */
  duration?: number
  /** Easing. Default 'Power2'. */
  ease?: string
  /** Called when fully hidden. */
  onComplete?: () => void
}

export interface BounceOpts {
  /** Peak height in px above origin. Default 14. */
  height?: number
  /** Full bounce duration in ms. Default 420. */
  duration?: number
  /** Number of bounces. Default 1. */
  repeat?: number
  /** Called when animation ends. */
  onComplete?: () => void
}

export interface TypewriterOpts {
  /** Ms per character. Default 40. */
  speed?: number
  /** Called when all characters are shown. */
  onComplete?: () => void
}

export interface GlowOpts {
  /** Tint color for the bright state. Default 0xffeebb. */
  color?: number
  /** Minimum alpha during pulse. Default 0.55. */
  minAlpha?: number
  /** Maximum alpha during pulse. Default 1.0. */
  maxAlpha?: number
  /** Duration of one glow cycle in ms. Default 900. */
  duration?: number
  /** -1 = loop forever. Default -1. */
  repeat?: number
}

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

type TweenTarget = Phaser.GameObjects.GameObject & {
  x?: number; y?: number; scaleX?: number; scaleY?: number; alpha?: number
}

/** Sprites/Images expose setTintFill; Text, Rectangle, etc. often only have setTint. */
function applyFlashTint(obj: unknown, color: number): void {
  const o = obj as { setTintFill?: (c: number) => void; setTint?: (c: number) => void }
  if (typeof o.setTintFill === 'function') o.setTintFill(color)
  else if (typeof o.setTint === 'function') o.setTint(color)
}

function clearFlashTint(obj: unknown): void {
  const o = obj as { clearTint?: () => void }
  if (typeof o.clearTint === 'function') o.clearTint()
}

// ---------------------------------------------------------------------------
// 1. flash — white-tint hit feedback
// ---------------------------------------------------------------------------

export function flash(
  gameObject: Phaser.GameObjects.Components.Tint & Phaser.GameObjects.Components.Alpha & TweenTarget,
  scene: Phaser.Scene,
  opts: FlashOpts = {},
): Phaser.Tweens.Tween {
  const { tint = 0xffffff, duration = 120, repeat = 3, onComplete } = opts
  let cycles = 0
  const total = repeat

  return scene.tweens.addCounter({
    from: 0,
    to: 1,
    duration,
    yoyo: true,
    repeat: total - 1,
    onYoyo: () => {
      applyFlashTint(gameObject, tint)
      ;(gameObject as unknown as Phaser.GameObjects.Components.Alpha).setAlpha(0.72)
    },
    onRepeat: () => {
      clearFlashTint(gameObject)
      ;(gameObject as unknown as Phaser.GameObjects.Components.Alpha).setAlpha(1)
      cycles++
    },
    onComplete: () => {
      clearFlashTint(gameObject)
      ;(gameObject as unknown as Phaser.GameObjects.Components.Alpha).setAlpha(1)
      cycles++
      onComplete?.()
    },
  })
}

// ---------------------------------------------------------------------------
// 2. shake — positional jitter
// ---------------------------------------------------------------------------

export function shake(
  gameObject: TweenTarget,
  scene: Phaser.Scene,
  opts: ShakeOpts = {},
): Phaser.Tweens.Tween {
  const { intensity = 4, duration = 280, onComplete } = opts
  const originX = (gameObject as { x: number }).x
  const originY = (gameObject as { y: number }).y
  const steps = Math.floor(duration / 28)

  return scene.tweens.addCounter({
    from: 0,
    to: steps,
    duration,
    ease: 'Linear',
    onUpdate: (tween) => {
      const progress = tween.getValue() ?? 0
      const decay = 1 - progress / steps
      const dx = (Math.random() * 2 - 1) * intensity * decay
      const dy = (Math.random() * 2 - 1) * intensity * decay
      ;(gameObject as { x: number }).x = originX + dx
      ;(gameObject as { y: number }).y = originY + dy
    },
    onComplete: () => {
      ;(gameObject as { x: number }).x = originX
      ;(gameObject as { y: number }).y = originY
      onComplete?.()
    },
  })
}

// ---------------------------------------------------------------------------
// 3. pulse — scale grow-then-shrink
// ---------------------------------------------------------------------------

export function pulse(
  gameObject: TweenTarget,
  scene: Phaser.Scene,
  opts: PulseOpts = {},
): Phaser.Tweens.Tween {
  const { scale = 1.18, duration = 220, ease = 'Back.easeOut', onComplete } = opts
  const half = duration / 2
  const origScaleX = (gameObject as { scaleX: number }).scaleX ?? 1
  const origScaleY = (gameObject as { scaleY: number }).scaleY ?? 1
  const peakX = origScaleX * scale
  const peakY = origScaleY * scale

  return scene.tweens.add({
    targets: gameObject,
    scaleX: peakX,
    scaleY: peakY,
    duration: half,
    ease,
    yoyo: true,
    onComplete: () => {
      ;(gameObject as { scaleX: number }).scaleX = origScaleX
      ;(gameObject as { scaleY: number }).scaleY = origScaleY
      onComplete?.()
    },
  })
}

// ---------------------------------------------------------------------------
// 4. fadeInUp — entrance slide + fade
// ---------------------------------------------------------------------------

export function fadeInUp(
  gameObject: TweenTarget,
  scene: Phaser.Scene,
  opts: FadeInUpOpts = {},
): Phaser.Tweens.Tween {
  const { offset = 18, duration = 240, ease = 'Power2', onComplete } = opts
  const targetY = (gameObject as { y: number }).y
  ;(gameObject as { alpha: number }).alpha = 0
  ;(gameObject as { y: number }).y = targetY + offset

  return scene.tweens.add({
    targets: gameObject,
    alpha: 1,
    y: targetY,
    duration,
    ease,
    onComplete: () => onComplete?.(),
  })
}

// ---------------------------------------------------------------------------
// 5. fadeOutDown — exit slide + fade
// ---------------------------------------------------------------------------

export function fadeOutDown(
  gameObject: TweenTarget,
  scene: Phaser.Scene,
  opts: FadeOutDownOpts = {},
): Phaser.Tweens.Tween {
  const { offset = 18, duration = 200, ease = 'Power2', onComplete } = opts
  const targetY = (gameObject as { y: number }).y + offset

  return scene.tweens.add({
    targets: gameObject,
    alpha: 0,
    y: targetY,
    duration,
    ease,
    onComplete: () => onComplete?.(),
  })
}

// ---------------------------------------------------------------------------
// 6. bounce — elastic up-and-back
// ---------------------------------------------------------------------------

export function bounce(
  gameObject: TweenTarget,
  scene: Phaser.Scene,
  opts: BounceOpts = {},
): Phaser.Tweens.Tween {
  const { height = 14, duration = 420, repeat = 1, onComplete } = opts
  const originY = (gameObject as { y: number }).y

  return scene.tweens.add({
    targets: gameObject,
    y: originY - height,
    duration: duration / 2,
    ease: 'Sine.easeOut',
    yoyo: true,
    repeat: repeat - 1,
    onComplete: () => {
      ;(gameObject as { y: number }).y = originY
      onComplete?.()
    },
  })
}

// ---------------------------------------------------------------------------
// 7. typewriter — animate text character by character
// ---------------------------------------------------------------------------

export function typewriter(
  textObject: Phaser.GameObjects.Text,
  text: string,
  scene: Phaser.Scene,
  opts: TypewriterOpts = {},
): Phaser.Tweens.Tween {
  const { speed = 40, onComplete } = opts
  textObject.setText('')
  let shown = 0

  return scene.tweens.addCounter({
    from: 0,
    to: text.length,
    duration: text.length * speed,
    ease: 'Linear',
    onUpdate: (tween) => {
      const next = Math.floor(tween.getValue() ?? 0)
      if (next > shown) {
        shown = next
        textObject.setText(text.slice(0, shown))
      }
    },
    onComplete: () => {
      textObject.setText(text)
      onComplete?.()
    },
  })
}

// ---------------------------------------------------------------------------
// 8. glow — pulsing alpha + tint cycle
// ---------------------------------------------------------------------------

export function glow(
  gameObject: Phaser.GameObjects.Components.Tint & Phaser.GameObjects.Components.Alpha & TweenTarget,
  scene: Phaser.Scene,
  opts: GlowOpts = {},
): Phaser.Tweens.Tween {
  const { color = 0xffeebb, minAlpha = 0.55, maxAlpha = 1.0, duration = 900, repeat = -1 } = opts
  ;(gameObject as unknown as Phaser.GameObjects.Components.Tint).setTint(color)

  return scene.tweens.add({
    targets: gameObject,
    alpha: { from: maxAlpha, to: minAlpha },
    duration,
    ease: 'Sine.easeInOut',
    yoyo: true,
    repeat,
  })
}
