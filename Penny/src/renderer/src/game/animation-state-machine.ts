// ---------------------------------------------------------------------------
// animation-state-machine.ts
// Reusable sprite animation state machine — no Phaser dependency.
//
// Manages frame-based animation states and timed transitions between them.
// Replaces ad-hoc tween sequencing with a declarative, data-driven approach.
//
// Usage:
//   const asm = new AnimationStateMachine(DEFAULT_STATES, DEFAULT_TRANSITIONS)
//   asm.onStateChange((from, to) => console.log(`${from} → ${to}`))
//
//   // In update loop:
//   asm.update(dt)
//   sprite.setFrame(asm.getCurrentFrame())
//
//   // Trigger transitions:
//   asm.transitionTo(WALK_DOWN)   // returns false if no valid transition
//   asm.forceState(IDLE_DOWN)     // immediate, no easing
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Default state name constants
// ---------------------------------------------------------------------------

export const IDLE_DOWN       = 'idle_down'
export const IDLE_UP         = 'idle_up'
export const IDLE_LEFT       = 'idle_left'
export const IDLE_RIGHT      = 'idle_right'

export const WALK_DOWN       = 'walk_down'
export const WALK_UP         = 'walk_up'
export const WALK_LEFT       = 'walk_left'
export const WALK_RIGHT      = 'walk_right'

export const TYPING          = 'typing'
export const SITTING         = 'sitting'
export const TALKING         = 'talking'
export const CELEBRATING     = 'celebrating'
export const DRINKING        = 'drinking'

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

/** Configuration for a single animation state. */
export interface AnimationStateConfig {
  /** Unique name identifying this state. Use the exported constants. */
  name: string
  /** Ordered list of sprite frame indices to cycle through. */
  frames: number[]
  /** Frames per second. */
  frameRate: number
  /** Whether the animation loops. If false, holds on the last frame. */
  loop: boolean
  /** Called once when a non-looping animation reaches its last frame. */
  onComplete?: () => void
}

/** Defines a valid transition between two states. */
export interface AnimationTransition {
  /** Source state name (must match an AnimationStateConfig.name). */
  from: string
  /** Target state name (must match an AnimationStateConfig.name). */
  to: string
  /** Blend/cross-fade duration in milliseconds. */
  duration: number
  /** Easing label (informational; consumers may use this for tween config). */
  easing: string
}

// ---------------------------------------------------------------------------
// Default state configurations
// Sprite layout (17 frames per row per the CLAUDE.md):
//   Frames 0-3  → 4 idle rotations  (down, up, left, right)
//   Frames 4-15 → 12 walk frames    (3 frames × 4 directions)
//   Frame  16   → sit
// ---------------------------------------------------------------------------

export const DEFAULT_STATES: AnimationStateConfig[] = [
  // Idle rotations — single frames, looping (breath animation handled externally)
  { name: IDLE_DOWN,  frames: [0],          frameRate: 1,  loop: true  },
  { name: IDLE_UP,    frames: [1],          frameRate: 1,  loop: true  },
  { name: IDLE_LEFT,  frames: [2],          frameRate: 1,  loop: true  },
  { name: IDLE_RIGHT, frames: [3],          frameRate: 1,  loop: true  },

  // Walk cycles — 3 frames per direction at 8 fps
  { name: WALK_DOWN,  frames: [4,  5,  6],  frameRate: 8,  loop: true  },
  { name: WALK_UP,    frames: [7,  8,  9],  frameRate: 8,  loop: true  },
  { name: WALK_LEFT,  frames: [10, 11, 12], frameRate: 8,  loop: true  },
  { name: WALK_RIGHT, frames: [13, 14, 15], frameRate: 8,  loop: true  },

  // Desk activities — reuse sit frame; typing uses a faster tick
  { name: SITTING,    frames: [16],         frameRate: 1,  loop: true  },
  { name: TYPING,     frames: [16],         frameRate: 6,  loop: true  },

  // Social / expressive — map to available frames; consumers can override
  { name: TALKING,    frames: [0, 1],       frameRate: 4,  loop: true  },
  { name: CELEBRATING,frames: [4, 5, 6, 7], frameRate: 10, loop: false },
  { name: DRINKING,   frames: [16],         frameRate: 1,  loop: false },
]

// ---------------------------------------------------------------------------
// Default transitions
// ---------------------------------------------------------------------------

const EASE_LINEAR    = 'Linear'
const EASE_QUAD_OUT  = 'Quad.easeOut'
const EASE_QUAD_IN   = 'Quad.easeIn'

export const DEFAULT_TRANSITIONS: AnimationTransition[] = [
  // Idle ↔ walk (all directions)
  { from: IDLE_DOWN,  to: WALK_DOWN,  duration: 80,  easing: EASE_LINEAR    },
  { from: IDLE_DOWN,  to: WALK_UP,    duration: 80,  easing: EASE_LINEAR    },
  { from: IDLE_DOWN,  to: WALK_LEFT,  duration: 80,  easing: EASE_LINEAR    },
  { from: IDLE_DOWN,  to: WALK_RIGHT, duration: 80,  easing: EASE_LINEAR    },
  { from: IDLE_UP,    to: WALK_DOWN,  duration: 80,  easing: EASE_LINEAR    },
  { from: IDLE_UP,    to: WALK_UP,    duration: 80,  easing: EASE_LINEAR    },
  { from: IDLE_UP,    to: WALK_LEFT,  duration: 80,  easing: EASE_LINEAR    },
  { from: IDLE_UP,    to: WALK_RIGHT, duration: 80,  easing: EASE_LINEAR    },
  { from: IDLE_LEFT,  to: WALK_DOWN,  duration: 80,  easing: EASE_LINEAR    },
  { from: IDLE_LEFT,  to: WALK_UP,    duration: 80,  easing: EASE_LINEAR    },
  { from: IDLE_LEFT,  to: WALK_LEFT,  duration: 80,  easing: EASE_LINEAR    },
  { from: IDLE_LEFT,  to: WALK_RIGHT, duration: 80,  easing: EASE_LINEAR    },
  { from: IDLE_RIGHT, to: WALK_DOWN,  duration: 80,  easing: EASE_LINEAR    },
  { from: IDLE_RIGHT, to: WALK_UP,    duration: 80,  easing: EASE_LINEAR    },
  { from: IDLE_RIGHT, to: WALK_LEFT,  duration: 80,  easing: EASE_LINEAR    },
  { from: IDLE_RIGHT, to: WALK_RIGHT, duration: 80,  easing: EASE_LINEAR    },

  // Walk → idle (decelerate)
  { from: WALK_DOWN,  to: IDLE_DOWN,  duration: 100, easing: EASE_QUAD_OUT  },
  { from: WALK_UP,    to: IDLE_UP,    duration: 100, easing: EASE_QUAD_OUT  },
  { from: WALK_LEFT,  to: IDLE_LEFT,  duration: 100, easing: EASE_QUAD_OUT  },
  { from: WALK_RIGHT, to: IDLE_RIGHT, duration: 100, easing: EASE_QUAD_OUT  },

  // Walk direction changes (any walk → any walk)
  { from: WALK_DOWN,  to: WALK_UP,    duration: 60,  easing: EASE_LINEAR    },
  { from: WALK_DOWN,  to: WALK_LEFT,  duration: 60,  easing: EASE_LINEAR    },
  { from: WALK_DOWN,  to: WALK_RIGHT, duration: 60,  easing: EASE_LINEAR    },
  { from: WALK_UP,    to: WALK_DOWN,  duration: 60,  easing: EASE_LINEAR    },
  { from: WALK_UP,    to: WALK_LEFT,  duration: 60,  easing: EASE_LINEAR    },
  { from: WALK_UP,    to: WALK_RIGHT, duration: 60,  easing: EASE_LINEAR    },
  { from: WALK_LEFT,  to: WALK_DOWN,  duration: 60,  easing: EASE_LINEAR    },
  { from: WALK_LEFT,  to: WALK_UP,    duration: 60,  easing: EASE_LINEAR    },
  { from: WALK_LEFT,  to: WALK_RIGHT, duration: 60,  easing: EASE_LINEAR    },
  { from: WALK_RIGHT, to: WALK_DOWN,  duration: 60,  easing: EASE_LINEAR    },
  { from: WALK_RIGHT, to: WALK_UP,    duration: 60,  easing: EASE_LINEAR    },
  { from: WALK_RIGHT, to: WALK_LEFT,  duration: 60,  easing: EASE_LINEAR    },

  // Idle → desk activities
  { from: IDLE_DOWN,  to: TYPING,     duration: 120, easing: EASE_QUAD_IN   },
  { from: IDLE_UP,    to: TYPING,     duration: 120, easing: EASE_QUAD_IN   },
  { from: IDLE_LEFT,  to: TYPING,     duration: 120, easing: EASE_QUAD_IN   },
  { from: IDLE_RIGHT, to: TYPING,     duration: 120, easing: EASE_QUAD_IN   },
  { from: IDLE_DOWN,  to: SITTING,    duration: 150, easing: EASE_QUAD_IN   },
  { from: IDLE_UP,    to: SITTING,    duration: 150, easing: EASE_QUAD_IN   },
  { from: IDLE_LEFT,  to: SITTING,    duration: 150, easing: EASE_QUAD_IN   },
  { from: IDLE_RIGHT, to: SITTING,    duration: 150, easing: EASE_QUAD_IN   },

  // Desk activities → idle
  { from: TYPING,     to: IDLE_DOWN,  duration: 100, easing: EASE_QUAD_OUT  },
  { from: TYPING,     to: IDLE_UP,    duration: 100, easing: EASE_QUAD_OUT  },
  { from: TYPING,     to: IDLE_LEFT,  duration: 100, easing: EASE_QUAD_OUT  },
  { from: TYPING,     to: IDLE_RIGHT, duration: 100, easing: EASE_QUAD_OUT  },
  { from: SITTING,    to: IDLE_DOWN,  duration: 100, easing: EASE_QUAD_OUT  },
  { from: SITTING,    to: IDLE_UP,    duration: 100, easing: EASE_QUAD_OUT  },
  { from: SITTING,    to: IDLE_LEFT,  duration: 100, easing: EASE_QUAD_OUT  },
  { from: SITTING,    to: IDLE_RIGHT, duration: 100, easing: EASE_QUAD_OUT  },

  // Typing ↔ talking / drinking
  { from: TYPING,     to: TALKING,    duration: 100, easing: EASE_LINEAR    },
  { from: TALKING,    to: TYPING,     duration: 100, easing: EASE_LINEAR    },
  { from: TYPING,     to: DRINKING,   duration: 80,  easing: EASE_LINEAR    },
  { from: DRINKING,   to: TYPING,     duration: 80,  easing: EASE_LINEAR    },
  { from: SITTING,    to: DRINKING,   duration: 80,  easing: EASE_LINEAR    },
  { from: DRINKING,   to: SITTING,    duration: 80,  easing: EASE_LINEAR    },

  // Any idle → talking
  { from: IDLE_DOWN,  to: TALKING,    duration: 80,  easing: EASE_LINEAR    },
  { from: IDLE_UP,    to: TALKING,    duration: 80,  easing: EASE_LINEAR    },
  { from: IDLE_LEFT,  to: TALKING,    duration: 80,  easing: EASE_LINEAR    },
  { from: IDLE_RIGHT, to: TALKING,    duration: 80,  easing: EASE_LINEAR    },
  { from: TALKING,    to: IDLE_DOWN,  duration: 80,  easing: EASE_QUAD_OUT  },
  { from: TALKING,    to: IDLE_UP,    duration: 80,  easing: EASE_QUAD_OUT  },
  { from: TALKING,    to: IDLE_LEFT,  duration: 80,  easing: EASE_QUAD_OUT  },
  { from: TALKING,    to: IDLE_RIGHT, duration: 80,  easing: EASE_QUAD_OUT  },

  // Any → celebrating (burst from any state)
  { from: IDLE_DOWN,  to: CELEBRATING, duration: 60, easing: EASE_QUAD_IN  },
  { from: IDLE_UP,    to: CELEBRATING, duration: 60, easing: EASE_QUAD_IN  },
  { from: IDLE_LEFT,  to: CELEBRATING, duration: 60, easing: EASE_QUAD_IN  },
  { from: IDLE_RIGHT, to: CELEBRATING, duration: 60, easing: EASE_QUAD_IN  },
  { from: TYPING,     to: CELEBRATING, duration: 60, easing: EASE_QUAD_IN  },
  { from: SITTING,    to: CELEBRATING, duration: 60, easing: EASE_QUAD_IN  },
  { from: TALKING,    to: CELEBRATING, duration: 60, easing: EASE_QUAD_IN  },

  // Celebrating → idle (wind-down)
  { from: CELEBRATING, to: IDLE_DOWN,  duration: 200, easing: EASE_QUAD_OUT },
  { from: CELEBRATING, to: IDLE_UP,    duration: 200, easing: EASE_QUAD_OUT },
  { from: CELEBRATING, to: IDLE_LEFT,  duration: 200, easing: EASE_QUAD_OUT },
  { from: CELEBRATING, to: IDLE_RIGHT, duration: 200, easing: EASE_QUAD_OUT },
]

// ---------------------------------------------------------------------------
// AnimationStateMachine
// ---------------------------------------------------------------------------

export class AnimationStateMachine {
  // Active state name (read-only from outside via getter)
  #currentState: string

  // Lookup maps built from constructor args
  #states: Map<string, AnimationStateConfig>
  // transition key: `${from}→${to}` → AnimationTransition
  #transitions: Map<string, AnimationTransition>

  // Per-state frame timing
  #frameElapsedMs: number    // time spent on the current frame
  #frameIndex: number        // index into AnimationStateConfig.frames[]
  #animComplete: boolean     // true when a non-looping anim has finished

  // Active transition tracking
  #transitioning: boolean
  #transitionElapsedMs: number
  #activeTransition: AnimationTransition | null
  #pendingState: string | null

  // Subscriber callbacks
  #stateChangeCallbacks: Array<(from: string, to: string) => void>

  constructor(
    states: AnimationStateConfig[],
    transitions: AnimationTransition[],
  ) {
    this.#states = new Map(states.map(s => [s.name, s]))
    this.#transitions = new Map(
      transitions.map(t => [`${t.from}→${t.to}`, t]),
    )

    // Seed with first state (or idle_down if available)
    const initial = states[0]
    if (!initial) throw new Error('[AnimationStateMachine] no states provided')
    this.#currentState = initial.name

    this.#frameElapsedMs  = 0
    this.#frameIndex      = 0
    this.#animComplete    = false
    this.#transitioning   = false
    this.#transitionElapsedMs = 0
    this.#activeTransition = null
    this.#pendingState    = null
    this.#stateChangeCallbacks = []
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /** The name of the currently active state (read-only). */
  get currentState(): string {
    return this.#currentState
  }

  /**
   * Request a transition to `stateName`.
   * Returns `false` if no valid transition exists from the current state.
   * While transitioning, subsequent calls queue the last requested target.
   */
  transitionTo(stateName: string): boolean {
    if (!this.#states.has(stateName)) {
      console.warn(`[ASM] unknown state "${stateName}"`)
      return false
    }

    // Already there and not mid-transition → no-op
    if (this.#currentState === stateName && !this.#transitioning) return true

    const key = `${this.#currentState}→${stateName}`
    const t = this.#transitions.get(key)
    if (!t) return false

    if (this.#transitioning) {
      // Queue the latest intent; older intermediate targets are discarded
      this.#pendingState = stateName
      return true
    }

    this.#beginTransition(t, stateName)
    return true
  }

  /**
   * Immediately switch to `stateName` without any transition, regardless of
   * whether a valid AnimationTransition exists.
   */
  forceState(stateName: string): void {
    if (!this.#states.has(stateName)) {
      console.warn(`[ASM] unknown state "${stateName}"`)
      return
    }
    const prev = this.#currentState
    this.#applyState(stateName)
    if (prev !== stateName) this.#notifyChange(prev, stateName)
  }

  /**
   * Advance frame timing by `dt` milliseconds.
   * Call every game tick (Phaser update passes dt in ms).
   */
  update(dt: number): void {
    // Advance transition timer
    if (this.#transitioning && this.#activeTransition) {
      this.#transitionElapsedMs += dt
      if (this.#transitionElapsedMs >= this.#activeTransition.duration) {
        this.#completeTransition()
      }
      // During transition we still advance frame timing for the current state
    }

    // Advance frame timing for the active state
    const cfg = this.#states.get(this.#currentState)
    if (!cfg || this.#animComplete) return

    const frameDurationMs = cfg.frameRate > 0 ? 1000 / cfg.frameRate : Infinity
    this.#frameElapsedMs += dt

    while (this.#frameElapsedMs >= frameDurationMs) {
      this.#frameElapsedMs -= frameDurationMs
      this.#frameIndex++

      if (this.#frameIndex >= cfg.frames.length) {
        if (cfg.loop) {
          this.#frameIndex = 0
        } else {
          // Non-looping: hold last frame, fire callback once
          this.#frameIndex = cfg.frames.length - 1
          this.#animComplete = true
          cfg.onComplete?.()
          break
        }
      }
    }
  }

  /**
   * Returns the sprite frame index for the current animation position.
   * Wire this to `sprite.setFrame(asm.getCurrentFrame())` each tick.
   */
  getCurrentFrame(): number {
    const cfg = this.#states.get(this.#currentState)
    if (!cfg || cfg.frames.length === 0) return 0
    const idx = Math.min(this.#frameIndex, cfg.frames.length - 1)
    return cfg.frames[idx]
  }

  /** True while a timed transition is in progress. */
  isTransitioning(): boolean {
    return this.#transitioning
  }

  /**
   * Register a callback invoked whenever the active state changes.
   * Multiple listeners are supported.
   */
  onStateChange(callback: (from: string, to: string) => void): void {
    this.#stateChangeCallbacks.push(callback)
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  #beginTransition(t: AnimationTransition, targetState: string): void {
    this.#transitioning       = true
    this.#transitionElapsedMs = 0
    this.#activeTransition    = t
    this.#pendingState        = null
    // Notify listeners immediately so consumers can start visual blending
    this.#notifyChange(this.#currentState, targetState)
  }

  #completeTransition(): void {
    const target = this.#activeTransition!.to
    this.#transitioning       = false
    this.#transitionElapsedMs = 0
    this.#activeTransition    = null
    this.#applyState(target)

    // Drain pending request
    if (this.#pendingState) {
      const next = this.#pendingState
      this.#pendingState = null
      this.transitionTo(next)
    }
  }

  #applyState(stateName: string): void {
    this.#currentState   = stateName
    this.#frameIndex     = 0
    this.#frameElapsedMs = 0
    this.#animComplete   = false
  }

  #notifyChange(from: string, to: string): void {
    for (const cb of this.#stateChangeCallbacks) {
      cb(from, to)
    }
  }
}
