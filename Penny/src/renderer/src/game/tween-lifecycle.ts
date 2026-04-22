// ---------------------------------------------------------------------------
// tween-lifecycle.ts
// TweenBag — managed lifecycle container for Phaser tweens and timer events.
//
// Replaces the 30+ per-property tween fields on WorkstationSprite with a
// single keyed map.  Calling clearAll() destroys every registered tween/timer
// and fires optional reset callbacks in one call, replacing the 55-line manual
// teardown block in workstation-animation.ts.
// ---------------------------------------------------------------------------

import Phaser from 'phaser'

type TweenHandle = Phaser.Tweens.Tween | Phaser.Time.TimerEvent

interface TweenEntry {
  handle: TweenHandle
  reset?: () => void
}

export class TweenBag {
  private entries = new Map<string, TweenEntry>()

  /**
   * Register a tween under key.  If a tween/timer already exists under that
   * key, it is destroyed (and its reset callback called) before the new one
   * is stored.
   */
  add(key: string, tween: Phaser.Tweens.Tween, reset?: () => void): void {
    this._destroyEntry(this.entries.get(key))
    this.entries.set(key, { handle: tween, reset })
  }

  /**
   * Register a timer event under key.  Same auto-destroy semantics as add().
   */
  addTimer(key: string, timer: Phaser.Time.TimerEvent, reset?: () => void): void {
    this._destroyEntry(this.entries.get(key))
    this.entries.set(key, { handle: timer, reset })
  }

  /**
   * Destroy and remove the tween/timer registered under key (no-op if absent).
   */
  remove(key: string): void {
    const entry = this.entries.get(key)
    if (!entry) return
    this._destroyEntry(entry)
    this.entries.delete(key)
  }

  /**
   * Destroy every registered tween/timer and fire all reset callbacks.
   * The internal map is cleared afterward.
   */
  clearAll(): void {
    for (const entry of this.entries.values()) {
      this._destroyEntry(entry)
    }
    this.entries.clear()
  }

  /** Returns true if a tween/timer is currently registered under key. */
  has(key: string): boolean {
    return this.entries.has(key)
  }

  /**
   * Returns the Tween registered under key, or undefined if the key is absent
   * or holds a TimerEvent.  Use this when you need to call tween-specific
   * methods such as pause(), resume(), or isPlaying().
   */
  get(key: string): Phaser.Tweens.Tween | undefined {
    const entry = this.entries.get(key)
    if (!entry) return undefined
    if (entry.handle instanceof Phaser.Time.TimerEvent) return undefined
    return entry.handle as Phaser.Tweens.Tween
  }

  /**
   * Set the paused state of the timer registered under key.
   * No-op if the key is absent or holds a Tween instead of a TimerEvent.
   */
  setTimerPaused(key: string, paused: boolean): void {
    const entry = this.entries.get(key)
    if (!entry) return
    if (!(entry.handle instanceof Phaser.Time.TimerEvent)) return
    entry.handle.paused = paused
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private _destroyEntry(entry: TweenEntry | undefined): void {
    if (!entry) return
    try { entry.handle.destroy() } catch { /* already destroyed */ }
    entry.reset?.()
  }
}
