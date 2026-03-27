// ---------------------------------------------------------------------------
// path-walker.ts
// Reusable walk utility — tweens a sprite along NavMesh waypoints with
// directional walk animation frames and shadow tracking.
// ---------------------------------------------------------------------------

import Phaser from 'phaser'
import type { NavPoint } from './nav-mesh'
import { SPRITESHEET_KEYS, ICON_FRAMES } from './office-asset-keys'

const DEFAULT_WALK_SPEED = 55 // px/sec
const WALK_CYCLE_MS = 200
const DUST_STEP_INTERVAL = 3 // spawn dust every N walk cycles
const TRAIL_STEP_INTERVAL = 2 // spawn breadcrumb dot every N walk cycles

export class PathWalker {
  private scene: Phaser.Scene
  private sprite: Phaser.GameObjects.Sprite
  private shadow: Phaser.GameObjects.Ellipse | null
  private sheetKey: string
  private speed: number

  private waypoints: NavPoint[] = []
  private pointIdx = 0
  private walkCycleTimer: Phaser.Time.TimerEvent | null = null
  private moveTween: Phaser.Tweens.Tween | null = null
  private shadowTween: Phaser.Tweens.Tween | null = null
  private onCompleteCb: (() => void) | null = null
  private destroyed = false
  private walking = false
  private dustStepCounter = 0
  private trailDots: Phaser.GameObjects.Sprite[] = []

  constructor(
    scene: Phaser.Scene,
    sprite: Phaser.GameObjects.Sprite,
    shadow: Phaser.GameObjects.Ellipse | null,
    sheetKey: string,
    speed = DEFAULT_WALK_SPEED,
  ) {
    this.scene = scene
    this.sprite = sprite
    this.shadow = shadow
    this.sheetKey = sheetKey
    this.speed = speed
  }

  startPath(waypoints: NavPoint[], onComplete: () => void): void {
    if (this.destroyed || waypoints.length === 0) { onComplete(); return }
    this.cancel()
    this.waypoints = waypoints
    this.pointIdx = 0
    this.onCompleteCb = onComplete
    this.walking = true
    this.stepNext()
  }

  cancel(): { x: number; y: number } {
    const pos = { x: this.sprite.x, y: this.sprite.y }
    this.walking = false
    if (this.walkCycleTimer) { this.walkCycleTimer.destroy(); this.walkCycleTimer = null }
    if (this.moveTween) { this.moveTween.destroy(); this.moveTween = null }
    if (this.shadowTween) { this.shadowTween.destroy(); this.shadowTween = null }
    this.onCompleteCb = null
    this.waypoints = []
    // Clean up trail dots
    for (const dot of this.trailDots) {
      this.scene.tweens.killTweensOf(dot)
      dot.destroy()
    }
    this.trailDots = []
    return pos
  }

  isWalking(): boolean {
    return this.walking
  }

  destroy(): void {
    this.cancel()
    this.destroyed = true
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  private stepNext(): void {
    if (this.destroyed || !this.sprite.active) {
      this.walking = false
      return
    }
    if (this.pointIdx >= this.waypoints.length) {
      this.walking = false
      const cb = this.onCompleteCb
      this.onCompleteCb = null
      if (cb) cb()
      return
    }

    const target = this.waypoints[this.pointIdx++]
    const dx = target.x - this.sprite.x
    const dy = target.y - this.sprite.y
    const dist = Math.hypot(dx, dy)
    if (dist < 2) { this.stepNext(); return }

    // Pick direction frame: 0=down, 3=right, 6=up, 9=left
    const startFrame = PathWalker.directionFrame(dx, dy)
    this.sprite.setTexture(this.sheetKey, startFrame)
    this.sprite.setFlipX(false)

    const dur = Math.max(200, (dist / this.speed) * 1000)
    let cycleIdx = 0
    this.walkCycleTimer = this.scene.time.addEvent({
      delay: WALK_CYCLE_MS, loop: true,
      callback: () => {
        if (!this.sprite.active) { this.walkCycleTimer?.destroy(); return }
        cycleIdx = cycleIdx === 0 ? 1 : 0
        this.sprite.setFrame(startFrame + 1 + cycleIdx)
        this.sprite.setAngle(cycleIdx === 0 ? -3 : 3)
        // Footstep dust puffs every few steps
        this.dustStepCounter++
        if (this.dustStepCounter % DUST_STEP_INTERVAL === 0) {
          this.spawnDustPuff()
        }
        // Breadcrumb trail dots
        if (this.dustStepCounter % TRAIL_STEP_INTERVAL === 0) {
          this.spawnTrailDot()
        }
      },
    })

    this.moveTween = this.scene.tweens.add({
      targets: this.sprite,
      x: target.x, y: target.y,
      duration: dur, ease: 'Linear',
      onComplete: () => {
        if (this.walkCycleTimer) { this.walkCycleTimer.destroy(); this.walkCycleTimer = null }
        this.moveTween = null
        this.stepNext()
      },
    })

    if (this.shadow) {
      this.shadowTween = this.scene.tweens.add({
        targets: this.shadow,
        x: target.x, y: target.y + 2,
        duration: dur, ease: 'Linear',
      })
    }
  }

  /** Spawn a tiny dust puff sprite at the walker's feet. */
  private spawnDustPuff(): void {
    if (!this.sprite.active) return
    const hasIcons = this.scene.textures.exists(SPRITESHEET_KEYS.GAME_ICONS)
    if (!hasIcons) return
    const dust = this.scene.add.sprite(
      this.sprite.x + (Math.random() - 0.5) * 4,
      this.sprite.y,
      SPRITESHEET_KEYS.GAME_ICONS,
      ICON_FRAMES.CIRCLE_GREY,
    ).setScale(0.06 + Math.random() * 0.04).setAlpha(0.3).setDepth(this.sprite.depth - 1)
    this.scene.tweens.add({
      targets: dust,
      alpha: 0,
      scaleX: 0.14,
      scaleY: 0.14,
      y: dust.y - 3,
      duration: 300 + Math.random() * 150,
      ease: 'Power2',
      onComplete: () => dust.destroy(),
    })
  }

  /** Spawn a breadcrumb trail dot that fades out after a short delay. */
  private spawnTrailDot(): void {
    if (!this.sprite.active) return
    const hasIcons = this.scene.textures.exists(SPRITESHEET_KEYS.GAME_ICONS)
    if (!hasIcons) return
    const dot = this.scene.add.sprite(
      this.sprite.x,
      this.sprite.y,
      SPRITESHEET_KEYS.GAME_ICONS,
      ICON_FRAMES.CIRCLE_GREY,
    ).setScale(0.05).setAlpha(0.25).setDepth(this.sprite.depth - 2)
    this.trailDots.push(dot)
    this.scene.tweens.add({
      targets: dot,
      alpha: 0,
      delay: 500,
      duration: 2000,
      ease: 'Power2',
      onComplete: () => {
        dot.destroy()
        const idx = this.trailDots.indexOf(dot)
        if (idx !== -1) this.trailDots.splice(idx, 1)
      },
    })
  }

  /** Map dx/dy to walk spritesheet base frame: 0=down, 3=right, 6=up, 9=left */
  static directionFrame(dx: number, dy: number): number {
    const adx = Math.abs(dx), ady = Math.abs(dy)
    if (adx > ady * 1.5) {
      return dx > 0 ? 3 : 9
    } else if (ady > adx * 1.5) {
      return dy > 0 ? 0 : 6
    } else {
      if (adx > ady) return dx > 0 ? 3 : 9
      return dy > 0 ? 0 : 6
    }
  }
}
