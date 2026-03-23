import type { AgentState } from '../types'

type EventCallback = (...args: unknown[]) => void

class GameEventBus {
  private listeners = new Map<string, Set<EventCallback>>()

  on(event: string, callback: EventCallback): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(callback)
  }

  off(event: string, callback: EventCallback): void {
    this.listeners.get(event)?.delete(callback)
  }

  emit(event: string, ...args: unknown[]): void {
    this.listeners.get(event)?.forEach(cb => cb(...args))
  }

  removeAll(): void {
    this.listeners.clear()
  }
}

export const EventBus = new GameEventBus()

export const EVENTS = {
  /** Fired when an agent sprite is single-clicked. Payload: (agentId: string, state: AgentState) */
  AGENT_CLICKED: 'agent:clicked',
  /** Fired when an agent sprite is double-clicked. Payload: (agentId: string, state: AgentState) */
  AGENT_DOUBLE_CLICKED: 'agent:doubleClicked',
  /** Fired when an agent sprite is right-clicked. Payload: (agentId: string, state: AgentState) */
  AGENT_RIGHT_CLICKED: 'agent:rightClicked',
  /** Fired when the active agent selection is cleared. No payload. */
  AGENT_DESELECTED: 'agent:deselected',
  /** Fired when an agent is dragged to a different room. Payload: (agentId: string, roomId: string) */
  AGENT_DRAGGED_TO_ROOM: 'agent:draggedToRoom',
  /** Fired when the "Add Worker" button or tile is clicked. No payload. */
  ADD_WORKER_CLICKED: 'addWorker:clicked',
  /** Fired when an empty desk is clicked. Payload: (deskId: string) */
  DESK_CLICKED: 'desk:clicked',
  /** Fired to show a broadcast message in the scene. Payload: (message: string) */
  BROADCAST: 'broadcast',
  /** Fired when a GitHub issue card is clicked. Payload: (url: string, issueNumber: number, repo: string) */
  GITHUB_ISSUE_CLICKED: 'github:issueClicked',
} as const

/**
 * Maps each EVENTS key to the argument tuple emitted and received for that event.
 *
 * Usage reference (not enforced at runtime — the EventBus stays loosely typed
 * to keep the implementation simple):
 *
 *   EventBus.emit(EVENTS.AGENT_CLICKED, agentId, state)
 *   EventBus.on(EVENTS.AGENT_CLICKED, (_id, state) => { ... })
 */
export interface EventPayloadMap {
  /** (agentId: string, state: AgentState) */
  [EVENTS.AGENT_CLICKED]: [agentId: string, state: AgentState]
  /** (agentId: string, state: AgentState) */
  [EVENTS.AGENT_DOUBLE_CLICKED]: [agentId: string, state: AgentState]
  /** (agentId: string, state: AgentState) */
  [EVENTS.AGENT_RIGHT_CLICKED]: [agentId: string, state: AgentState]
  /** No payload */
  [EVENTS.AGENT_DESELECTED]: []
  /** (agentId: string, roomId: string) */
  [EVENTS.AGENT_DRAGGED_TO_ROOM]: [agentId: string, roomId: string]
  /** No payload */
  [EVENTS.ADD_WORKER_CLICKED]: []
  /** (deskId: string) */
  [EVENTS.DESK_CLICKED]: [deskId: string]
  /** (message: string) */
  [EVENTS.BROADCAST]: [message: string]
  /** (url: string, issueNumber: number, repo: string) */
  [EVENTS.GITHUB_ISSUE_CLICKED]: [url: string, issueNumber: number, repo: string]
}
