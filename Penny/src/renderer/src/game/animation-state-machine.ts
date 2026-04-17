// ---------------------------------------------------------------------------
// animation-state-machine.ts
// Frame-based animation state machine — no Phaser dependency.
// Manages named animation states (frame arrays + frame rate), advances the
// current frame on update(), and supports both queued and immediate transitions.
// ---------------------------------------------------------------------------

export interface AnimationState {
  /** Unique name for this animation state (e.g. "idle-down", "walk-left"). */
  name: string
  /** Ordered list of spritesheet frame indices for this animation. */
  frames: number[]
  /** Playback speed in frames-per-second. */
  frameRate: number
  /** Whether the animation loops. Non-looping animations freeze on the last frame. */
  loop: boolean
}

export class AnimationStateMachine {
  private readonly states = new Map<string, AnimationState>()
  private current: AnimationState | null = null
  private frameIndex = 0
  private elapsed = 0          // ms since last frame advance
  private pending: string | null = null  // queued transition

  // -------------------------------------------------------------------------
  // Registration
  // -------------------------------------------------------------------------

  /** Register an animation state. Chainable. */
  addState(state: AnimationState): this {
    this.states.set(state.name, state)
    return this
  }

  // -------------------------------------------------------------------------
  // Transitions
  // -------------------------------------------------------------------------

  /**
   * Queued transition — takes effect at the start of the next update().
   * If the requested state is already active, this is a no-op.
   */
  play(stateName: string): void {
    if (!this.states.has(stateName)) {
      console.warn(`[AnimationStateMachine] unknown state "${stateName}"`)
      return
    }
    if (this.current?.name === stateName) return
    this.pending = stateName
  }

  /**
   * Immediate transition — resets frame index and elapsed timer right now.
   * Does NOT wait for the current frame to finish.
   */
  forcePlay(stateName: string): void {
    const state = this.states.get(stateName)
    if (!state) {
      console.warn(`[AnimationStateMachine] unknown state "${stateName}"`)
      return
    }
    this.pending = null
    this._enter(state)
  }

  // -------------------------------------------------------------------------
  // Update
  // -------------------------------------------------------------------------

  /**
   * Advance the animation by dt milliseconds.
   * Call once per game update tick.
   */
  update(dt: number): void {
    // Drain pending transition at the top of each tick
    if (this.pending !== null) {
      const next = this.states.get(this.pending)
      this.pending = null
      if (next) this._enter(next)
    }

    if (!this.current || this.current.frames.length === 0) return

    const frameDuration = 1000 / this.current.frameRate
    this.elapsed += dt

    while (this.elapsed >= frameDuration) {
      this.elapsed -= frameDuration

      const isLast = this.frameIndex >= this.current.frames.length - 1
      if (isLast) {
        if (this.current.loop) {
          this.frameIndex = 0
        }
        // Non-looping: freeze on last frame
      } else {
        this.frameIndex++
      }
    }
  }

  // -------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------

  /** Current animation state name, or empty string if none is set. */
  getCurrentState(): string {
    return this.current?.name ?? ''
  }

  /**
   * Current spritesheet frame index.
   * Returns 0 if no state has been set yet.
   */
  getCurrentFrame(): number {
    if (!this.current || this.current.frames.length === 0) return 0
    return this.current.frames[this.frameIndex]
  }

  /** True if a state with this name has been registered. */
  hasState(stateName: string): boolean {
    return this.states.has(stateName)
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private _enter(state: AnimationState): void {
    this.current = state
    this.frameIndex = 0
    this.elapsed = 0
  }
}
