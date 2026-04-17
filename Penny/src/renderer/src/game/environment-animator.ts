// environment-animator.ts
// EnvironmentAnimator — vent steam particles and plant foliage sway
// for lab rooms (Living Lab 2b: #240).
//
// Usage:
//   const animator = new EnvironmentAnimator(scene)
//   animator.registerVent(worldX, worldY)          // 1-2 particles/s, rise + fade
//   animator.registerPlant(sprite, delayMs?)       // ±3° sway, pivot at base
//   animator.destroy()                             // on scene shutdown

import Phaser from 'phaser'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STEAM_POOL_SIZE = 48

// ---------------------------------------------------------------------------
// EnvironmentAnimator
// ---------------------------------------------------------------------------

export class EnvironmentAnimator {
  private scene: Phaser.Scene

  /** Pre-allocated white circle pool for vent steam particles. */
  private steamPool: Phaser.GameObjects.Arc[] = []

  /** Repeating timers — one per registered vent. */
  private ventTimers: Phaser.Time.TimerEvent[] = []

  /** Active plant sway tweens — one per registered plant. */
  private plantTweens: Phaser.Tweens.Tween[] = []

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this._initSteamPool()
  }

  // ---------------------------------------------------------------------------
  // Steam particle pool — white circles, depth 1 (above floor, below workstations)
  // ---------------------------------------------------------------------------

  private _initSteamPool(): void {
    for (let i = 0; i < STEAM_POOL_SIZE; i++) {
      const p = this.scene.add
        .circle(0, 0, 3.5, 0xffffff, 0)
        .setDepth(1)
        .setVisible(false)
      p.setData('busy', false)
      this.steamPool.push(p)
    }
  }

  // ---------------------------------------------------------------------------
  // Vent registration
  //   • 1-2 particles per second, rising slowly (ΔY ≈ -15 over lifetime)
  //   • Alpha: start 0.3, fade to 0 over ~2 seconds
  //   • Slight horizontal drift (ΔX: ±5)
  //   • Scale: start 0.3, grow to 0.6 over lifetime
  // ---------------------------------------------------------------------------

  registerVent(worldX: number, worldY: number): void {
    // Stagger first fire so multiple vents in a room don't pulse in unison.
    const initialDelay = Math.random() * 800

    const spawnBatch = () => {
      const count = Math.random() < 0.4 ? 2 : 1
      for (let i = 0; i < count; i++) {
        const p = this.steamPool.find(c => !c.getData('busy'))
        if (!p) continue

        const xOff = (Math.random() - 0.5) * 8
        const driftX = (Math.random() - 0.5) * 10          // final horizontal offset
        const riseY  = 25 + Math.random() * 15             // total rise distance
        const duration = 1800 + Math.random() * 400

        p.setPosition(worldX + xOff, worldY)
        p.setRadius(3 + Math.random() * 2)
        p.setAlpha(0.3)
        p.setScale(0.3)
        p.setVisible(true)
        p.setData('busy', true)

        this.scene.tweens.add({
          targets: p,
          y: worldY - riseY,
          x: worldX + xOff + driftX,
          alpha: 0,
          scaleX: 0.6,
          scaleY: 0.6,
          duration,
          delay: i * 350,
          ease: 'Sine.easeOut',
          onComplete: () => {
            p.setVisible(false)
            p.setScale(0.3)
            p.setData('busy', false)
          },
        })
      }
    }

    this.scene.time.delayedCall(initialDelay, () => {
      spawnBatch()
      const timer = this.scene.time.addEvent({
        delay: 800,
        callback: spawnBatch,
        loop: true,
      })
      this.ventTimers.push(timer)
    })
  }

  // ---------------------------------------------------------------------------
  // Plant registration
  //   • Pivot at base of sprite (setOrigin 0.5, 1) for top-heavy pendulum sway
  //   • ±3° rotation, 3-4 second full cycle, Sine.easeInOut
  //   • delayMs staggers multiple plants so they don't sway in unison
  // ---------------------------------------------------------------------------

  registerPlant(sprite: Phaser.GameObjects.Sprite, delayMs = 0): void {
    // Move rotation pivot to bottom-center of the sprite.
    sprite.setOrigin(0.5, 1)

    const amplitude = 3                                   // degrees
    const duration  = 3000 + Math.random() * 1000        // 3-4 s per half-cycle

    const tween = this.scene.tweens.add({
      targets: sprite,
      angle: { from: -amplitude, to: amplitude },
      duration,
      delay: delayMs,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    })
    this.plantTweens.push(tween)
  }

  // ---------------------------------------------------------------------------
  // Lifecycle — call on scene destroy / room teardown
  // ---------------------------------------------------------------------------

  destroy(): void {
    for (const t of this.ventTimers) t.destroy()
    this.ventTimers = []

    for (const t of this.plantTweens) { t.stop(); t.destroy() }
    this.plantTweens = []

    for (const p of this.steamPool) {
      this.scene.tweens.killTweensOf(p)
      p.destroy()
    }
    this.steamPool = []
  }
}
