// Generic queue-based finite state machine — no Phaser dependency.
// Suitable for any game object or entity that needs state management.

export interface State {
  name: string
  onEnter?: (...args: unknown[]) => void
  onUpdate?: (dt: number) => void
  onExit?: () => void
}

interface QueuedTransition {
  name: string
  args: unknown[]
}

let instanceCounter = 0

export class StateMachine {
  readonly #id: string
  #states: Map<string, State>
  #currentState: State | undefined
  #isChangingState: boolean
  #queue: QueuedTransition[]

  constructor(id?: string) {
    this.#id = id ?? `sm-${++instanceCounter}`
    this.#states = new Map()
    this.#currentState = undefined
    this.#isChangingState = false
    this.#queue = []
  }

  get currentState(): State | undefined {
    return this.#currentState
  }

  get currentStateName(): string | undefined {
    return this.#currentState?.name
  }

  addState(state: State): this {
    this.#states.set(state.name, state)
    return this
  }

  setState(name: string, ...args: unknown[]): void {
    if (!this.#states.has(name)) {
      console.warn(`[StateMachine:${this.#id}] unknown state "${name}"`)
      return
    }

    // Re-entering the same state is a no-op unless there is a queued transition
    // already in flight, in which case treat it as a new intent.
    if (this.#isCurrentState(name) && this.#queue.length === 0) {
      return
    }

    if (this.#isChangingState) {
      this.#queue.push({ name, args })
      return
    }

    this.#transition(name, args)
  }

  update(dt: number): void {
    // Drain exactly one queued transition per tick so callers get
    // at least one update() pass in the new state before the next change.
    const next = this.#queue.shift()
    if (next !== undefined) {
      this.#transition(next.name, next.args)
    }

    this.#currentState?.onUpdate?.(dt)
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  #transition(name: string, args: unknown[]): void {
    this.#isChangingState = true

    this.#currentState?.onExit?.()

    this.#currentState = this.#states.get(name) as State

    if (this.#currentState.onEnter) {
      this.#currentState.onEnter(...args)
    }

    this.#isChangingState = false
  }

  #isCurrentState(name: string): boolean {
    return this.#currentState?.name === name
  }
}
