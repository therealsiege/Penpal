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
  AGENT_CLICKED: 'agent:clicked',
  ADD_WORKER_CLICKED: 'addWorker:clicked',
  DESK_CLICKED: 'desk:clicked',
} as const
