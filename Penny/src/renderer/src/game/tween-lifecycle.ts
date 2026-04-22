// ---------------------------------------------------------------------------
// tween-lifecycle.ts
// TweenBag — lightweight lifecycle manager for Phaser tweens and timer events.
//
// Usage:
//   const bag = new TweenBag()
//   ws.bounceTween = bag.add('bounce', scene.tweens.add({ ... }))
//   ws.lookAroundTimer = bag.add('lookAround', scene.time.addEvent({ ... }))
//   // Later, on mode transition:
//   bag.killAll()   // destroys every registered tween/timer in one call
//
// Design notes:
//   - `add(key, item)` auto-kills any previously registered item at the same key
//     before registering the new one, preventing double-running tweens.
//   - `killAll()` is idempotent: Phaser tweens/timers ignore destroy() after
//     they have already been destroyed.
//   - The bag does NOT own the game objects targeted by tweens; callers are
//     still responsible for destroying sprites/graphics referenced in tween
//     targets (e.g. taskReviewRing, soundWaveSpeaker).
// ---------------------------------------------------------------------------

/** Minimal interface satisfied by both Phaser.Tweens.Tween and Phaser.Time.TimerEvent. */
type Killable = { destroy(): void }

export class TweenBag {
  private readonly entries = new Map<string, Killable>()

  /**
   * Register `item` under `key`. If a previous item was registered at the same
   * key it is destroyed first (safe, since Phaser destroy() is idempotent).
   * Returns the item so callers can assign it and register in one expression:
   *   ws.bounceTween = ws.tweenBag.add('bounce', scene.tweens.add({ ... }))
   */
  add<T extends Killable>(key: string, item: T): T {
    this.entries.get(key)?.destroy()
    this.entries.set(key, item)
    return item
  }

  /** Destroy and remove the item at `key`. No-op when the key is absent. */
  kill(key: string): void {
    const item = this.entries.get(key)
    if (!item) return
    item.destroy()
    this.entries.delete(key)
  }

  /**
   * Destroy every registered item and clear the bag.
   * This is the primary entry point used by WorkstationAnimator's mode-transition
   * teardown to replace ~30 individual `if (ws.xxxTween) { ws.xxxTween.destroy() }`
   * lines with a single call.
   */
  killAll(): void {
    for (const item of this.entries.values()) {
      item.destroy()
    }
    this.entries.clear()
  }

  /** True when an item is currently registered under `key`. */
  has(key: string): boolean {
    return this.entries.has(key)
  }

  /**
   * Retrieve the current item for `key`, or `undefined` if absent.
   * Cast to the concrete type at the call site:
   *   const t = ws.tweenBag.get<Phaser.Time.TimerEvent>('lookAround')
   */
  get<T extends Killable = Killable>(key: string): T | undefined {
    return this.entries.get(key) as T | undefined
  }

  /** Number of currently registered entries (useful for tests). */
  get size(): number {
    return this.entries.size
  }
}
