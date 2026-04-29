import Phaser from 'phaser'
import { EventBus, EVENTS } from './events'
import { activeTheme } from './office-theme'
import type { OfficeTheme } from './office-theme'

// ---------------------------------------------------------------------------
// BaseScene
// ---------------------------------------------------------------------------
// Abstract base class for all PenPal Phaser scenes. Provides:
//   - Structured lifecycle hooks (onPreload / onCreate / onUpdate)
//   - Input lock/unlock with EventBus signalling
//   - Convenient theme accessor
//   - Prefixed console logging
// ---------------------------------------------------------------------------

export abstract class BaseScene extends Phaser.Scene {
  protected _inputLocked = false

  // ---------------------------------------------------------------------------
  // Abstract lifecycle hooks — subclasses must implement all three
  // ---------------------------------------------------------------------------

  abstract onPreload(): void
  abstract onCreate(): void
  abstract onUpdate(time: number, delta: number): void

  // ---------------------------------------------------------------------------
  // Standard Phaser lifecycle — delegates to the abstract hooks above
  // ---------------------------------------------------------------------------

  preload(): void {
    this.onPreload()
  }

  create(): void {
    this.onCreate()
  }

  update(time: number, delta: number): void {
    this.onUpdate(time, delta)
  }

  // ---------------------------------------------------------------------------
  // Input locking
  // ---------------------------------------------------------------------------

  lockInput(): void {
    this._inputLocked = true
    EventBus.emit(EVENTS.INPUT_LOCKED)
  }

  unlockInput(): void {
    this._inputLocked = false
    EventBus.emit(EVENTS.INPUT_UNLOCKED)
  }

  get inputLocked(): boolean {
    return this._inputLocked
  }

  // ---------------------------------------------------------------------------
  // Shared utilities
  // ---------------------------------------------------------------------------

  /** Returns the currently active color theme. */
  protected get theme(): OfficeTheme {
    return activeTheme
  }

  /** Prefixed console log for easier scene-level debugging. */
  protected log(msg: string): void {
    console.log(`[${this.scene.key}] ${msg}`)
  }
}
