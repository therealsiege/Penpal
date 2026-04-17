// ---------------------------------------------------------------------------
// animation-controller.ts
// AnimationController — wraps AnimationStateMachine and drives Phaser sprite frames.
// One controller per entity (player + each agent).
//
// Usage:
//   const asm = new AnimationStateMachine()
//     .addState({ name: 'idle-down', frames: [0], frameRate: 8, loop: true })
//     .addState({ name: 'walk-down', frames: [1, 2, 3], frameRate: 8, loop: true })
//   const ctrl = new AnimationController(sprite, asm)
//   ctrl.forcePlay('idle-down')
//
//   // In update loop:
//   ctrl.update(delta)
//
//   // Direction changes automatically remap the current motion type:
//   ctrl.setDirection('left')  // idle-down → idle-left, walk-down → walk-left
// ---------------------------------------------------------------------------

import Phaser from 'phaser'
import { AnimationStateMachine } from './animation-state-machine'

export type Direction = 'up' | 'down' | 'left' | 'right'

/**
 * AnimationController drives a Phaser Sprite's frame from an AnimationStateMachine.
 *
 * State naming convention (used by setDirection):
 *   "<motion>-<direction>"  e.g. "idle-down", "walk-left", "run-up"
 * If the current state does not contain a '-' separator, setDirection plays
 * "<currentState>-<direction>" directly as a new state name.
 */
export class AnimationController {
  private readonly sprite: Phaser.GameObjects.Sprite
  private readonly asm: AnimationStateMachine
  private direction: Direction = 'down'

  constructor(sprite: Phaser.GameObjects.Sprite, asm: AnimationStateMachine) {
    this.sprite = sprite
    this.asm = asm
  }

  // -------------------------------------------------------------------------
  // Per-frame update
  // -------------------------------------------------------------------------

  /**
   * Advance the state machine by dt milliseconds and apply the resulting
   * frame index to the sprite.
   *
   * @param dt - Delta time in milliseconds (Phaser passes ms by default).
   */
  update(dt: number): void {
    this.asm.update(dt)
    this.sprite.setFrame(this.asm.getCurrentFrame())
  }

  // -------------------------------------------------------------------------
  // State transitions
  // -------------------------------------------------------------------------

  /**
   * Queued transition — applied at the start of the next update() tick.
   * No-op if the state is already active.
   */
  play(stateName: string): void {
    this.asm.play(stateName)
  }

  /**
   * Immediate transition — resets to frame 0 of the target state right now,
   * without waiting for the current frame cycle to complete.
   */
  forcePlay(stateName: string): void {
    this.asm.forcePlay(stateName)
  }

  /** Current animation state name (delegates to the state machine). */
  getCurrentState(): string {
    return this.asm.getCurrentState()
  }

  // -------------------------------------------------------------------------
  // Direction
  // -------------------------------------------------------------------------

  /**
   * Switch to the given direction while keeping the current motion type.
   *
   * The current state name is split on the last '-' to extract the motion
   * prefix (e.g. "idle", "walk", "run").  The new state name becomes
   * "<motion>-<dir>".  If that state is not registered, the call is silently
   * ignored so missing directional variants never crash.
   *
   * Examples:
   *   "idle-down"  + setDirection('left')  → plays "idle-left"
   *   "walk-right" + setDirection('up')    → plays "walk-up"
   *   "sit"        + setDirection('right') → plays "sit-right" (if registered)
   */
  setDirection(dir: Direction): void {
    this.direction = dir

    const current = this.asm.getCurrentState()
    const dashIdx = current.lastIndexOf('-')
    const motion = dashIdx !== -1 ? current.slice(0, dashIdx) : current
    const targetState = `${motion}-${dir}`

    if (this.asm.hasState(targetState)) {
      this.asm.play(targetState)
    }
  }

  /** The last direction set via setDirection (default: 'down'). */
  getDirection(): Direction {
    return this.direction
  }
}
