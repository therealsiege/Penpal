// RPG Layer 0b: GameEngine class with state management and events
// Single source of truth for game state — Phaser scenes read/write through this

import type {
  AgentGameState,
  GameState,
  PlayerState,
  QuestState,
  WorldState,
} from './game-state'

type EventHandler = (...args: unknown[]) => void

export class GameEngine {
  private _state: GameState
  private _handlers: Map<string, Set<EventHandler>> = new Map()

  constructor() {
    this._state = this.createInitialState()
  }

  get state(): GameState {
    return this._state
  }

  createInitialState(): GameState {
    return {
      world: {
        currentScene: 'office',
        time: {
          hour: 9,
          minute: 0,
          dayPhase: 'morning',
          season: 'spring',
        },
        weather: 'clear',
      },
      player: {
        position: { x: 400, y: 300, scene: 'office' },
        direction: 'down',
        inventory: [],
        equipped: [],
        stats: { xp: 0, level: 1, credits: 0 },
      },
      agents: {},
      rooms: {},
      quests: {},
      ui: {
        questLogOpen: false,
        inventoryOpen: false,
        dialogActive: false,
        notifications: [],
      },
    }
  }

  // --- Event emitter ---

  on(event: string, handler: EventHandler): void {
    if (!this._handlers.has(event)) {
      this._handlers.set(event, new Set())
    }
    this._handlers.get(event)!.add(handler)
  }

  off(event: string, handler: EventHandler): void {
    this._handlers.get(event)?.delete(handler)
  }

  emit(event: string, ...args: unknown[]): void {
    this._handlers.get(event)?.forEach((h) => h(...args))
  }

  // --- Tick ---

  tick(dt: number): void {
    const world = this._state.world
    const minutesPerSecond = 1 // 1 real second = 1 game minute
    const elapsed = (dt / 1000) * minutesPerSecond

    let totalMinutes = world.time.hour * 60 + world.time.minute + elapsed
    totalMinutes = totalMinutes % (24 * 60)

    const hour = Math.floor(totalMinutes / 60)
    const minute = Math.floor(totalMinutes % 60)

    const dayPhase = getDayPhase(hour)

    this._state = {
      ...this._state,
      world: { ...world, time: { ...world.time, hour, minute, dayPhase } },
    }

    this.emit('state-changed', this._state)
  }

  // --- Player ---

  movePlayer(dx: number, dy: number): void {
    const prev = this._state.player.position
    this._state = {
      ...this._state,
      player: {
        ...this._state.player,
        position: { ...prev, x: prev.x + dx, y: prev.y + dy },
      },
    }
    this.emit('player-moved', this._state.player.position)
    this.emit('state-changed', this._state)
  }

  setPlayerDirection(dir: PlayerState['direction']): void {
    this._state = {
      ...this._state,
      player: { ...this._state.player, direction: dir },
    }
    this.emit('state-changed', this._state)
  }

  // --- Agents ---

  updateAgentState(agentId: string, update: Partial<AgentGameState>): void {
    const existing = this._state.agents[agentId]
    this._state = {
      ...this._state,
      agents: {
        ...this._state.agents,
        [agentId]: existing ? { ...existing, ...update } : (update as AgentGameState),
      },
    }
    this.emit('state-changed', this._state)
  }

  // --- Quests ---

  startQuest(questId: string, issueNumber: number): void {
    this._state = {
      ...this._state,
      quests: {
        ...this._state.quests,
        [questId]: {
          status: 'active',
          issueNumber,
          podId: null,
          rewards: { xp: 100, credits: 50 },
        } satisfies QuestState,
      },
    }
    this.emit('quest-started', questId, issueNumber)
    this.emit('state-changed', this._state)
  }

  completeQuest(questId: string): void {
    this._updateQuestStatus(questId, 'complete')
    this.emit('quest-completed', questId)
    this.emit('state-changed', this._state)
  }

  failQuest(questId: string): void {
    this._updateQuestStatus(questId, 'failed')
    this.emit('state-changed', this._state)
  }

  private _updateQuestStatus(questId: string, status: QuestState['status']): void {
    const quest = this._state.quests[questId]
    if (!quest) return
    this._state = {
      ...this._state,
      quests: {
        ...this._state.quests,
        [questId]: { ...quest, status },
      },
    }
  }
}

// --- Helpers ---

function getDayPhase(hour: number): WorldState['time']['dayPhase'] {
  if (hour >= 5 && hour < 8) return 'dawn'
  if (hour >= 8 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 17) return 'afternoon'
  if (hour >= 17 && hour < 21) return 'evening'
  return 'night'
}

export const gameEngine = new GameEngine()
