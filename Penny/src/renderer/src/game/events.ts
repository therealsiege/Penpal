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

export interface SeasonCeremonyRankingRow {
  rank: number
  agentId: string
  agentName: string
  seasonXP: number
  tasksCompleted: number
}

export interface SeasonIntroChallengeRow {
  description: string
  completed: boolean
}

export interface SeasonEndedEventPayload {
  seasonId: string
  seasonName: string
  theme: string
  accentColor: number
  score: number
  questsCompletedThisSeason: number
  totalSeasonXP: number
  summaryLine: string
}

export interface SeasonStartedEventPayload {
  seasonId: string
  seasonName: string
  theme: string
  accentColor: number
  challenges: SeasonIntroChallengeRow[]
  skipIntroCelebration?: boolean
}

export const EVENTS = {
  // --- Agent interaction ---
  /** Fired when the player interacts with an agent (E key near workstation). Payload: (agentId: string, state: AgentState) */
  AGENT_INTERACT: 'agent:interact',
  /** Fired when an agent sprite is single-clicked. Payload: (agentId: string, state: AgentState) */
  AGENT_CLICKED: 'agent:clicked',
  /** Fired when an agent sprite is double-clicked. Payload: (agentId: string, state: AgentState) */
  AGENT_DOUBLE_CLICKED: 'agent:doubleClicked',
  /** Fired when a pod agent desk is clicked — opens detail modal instead of terminal. Payload: (agentId: string, state: AgentState) */
  POD_AGENT_CLICKED: 'agent:podClicked',
  /** Fired when an agent sprite is right-clicked. Payload: (agentId: string, state: AgentState) */
  AGENT_RIGHT_CLICKED: 'agent:rightClicked',
  /** Fired when the active agent selection is cleared. No payload. */
  AGENT_DESELECTED: 'agent:deselected',
  /** Fired when an agent is dragged to a different room. Payload: (agentId: string, roomId: string) */
  AGENT_DRAGGED_TO_ROOM: 'agent:draggedToRoom',
  /** Fired when an agent transitions to a new state. Payload: (agentId: string, newState: AgentState, prevState: AgentState) */
  AGENT_STATE_CHANGED: 'agent:stateChanged',
  /** Fired immediately when the user approves a tool call / accepts output. Payload: (agentId: string, tty: string) */
  AGENT_APPROVED: 'agent:approved',
  /** Fired when a new agent is added to the scene. Payload: (agentId: string, state: AgentState) */
  AGENT_ARRIVED: 'agent:arrived',
  /** Fired when an agent is removed from the scene. Payload: (agentId: string) */
  AGENT_DEPARTED: 'agent:departed',
  /** Fired when the keyboard-selected agent changes. Payload: (agentId: string | null) */
  SELECTION_CHANGED: 'selection:changed',

  // --- Room ---
  /** Fired when the camera focus enters a room. Payload: (roomId: string) */
  ROOM_ENTERED: 'room:entered',
  /** Fired when the camera focus leaves a room. Payload: (roomId: string) */
  ROOM_EXITED: 'room:exited',

  // --- Input ---
  /** Fired when all game input is locked (e.g. during modal). No payload. */
  INPUT_LOCKED: 'input:locked',
  /** Fired when game input is re-enabled. No payload. */
  INPUT_UNLOCKED: 'input:unlocked',

  // --- UI / HUD ---
  /** Fired when an XP or progress bar value changes. Payload: (barId: string, value: number, max: number) */
  BAR_UPDATED: 'bar:updated',
  /** Generic notification for toast/feed display. Payload: (message: string, level: 'info' | 'warn' | 'error') */
  NOTIFICATION: 'notification',
  /** Fired when the "Add Worker" button or tile is clicked. No payload. */
  ADD_WORKER_CLICKED: 'addWorker:clicked',
  /** Fired when an empty desk or room header is clicked. Payload: (deskId: string, worldX: number, worldY: number) */
  DESK_CLICKED: 'desk:clicked',
  /** Fired to show a broadcast message in the scene. Payload: (message: string) */
  BROADCAST: 'broadcast',

  // --- Workstation lifecycle ---
  /** Fired when a workstation is created for an agent. Payload: (agentId: string, deskId: string) */
  WORKSTATION_CREATED: 'workstation:created',
  /** Fired when a workstation is destroyed. Payload: (agentId: string) */
  WORKSTATION_DESTROYED: 'workstation:destroyed',

  // --- Theme ---
  /** Fired when the active color theme changes. Payload: (themeName: string) */
  THEME_CHANGED: 'theme:changed',

  // --- External ---
  /** Fired when a GitHub issue card is clicked. Payload: (url: string, issueNumber: number, repo: string) */
  GITHUB_ISSUE_CLICKED: 'github:issueClicked',

  // --- Game Systems ---
  /** Fired when a quest starts. Payload: (questId: string, agentId: string, difficulty: string) */
  QUEST_STARTED: 'quest:started',
  /** Fired when a quest completes. Payload: (questId: string, agentId: string, xpReward: number, creditReward: number, difficulty: string) */
  QUEST_COMPLETED: 'quest:completed',
  /** Fired when a quest fails. Payload: (questId: string, agentId: string) */
  QUEST_FAILED: 'quest:failed',
  /** Fired when credits are earned. Payload: (amount: number, newBalance: number) */
  CREDITS_EARNED: 'credits:earned',
  /** Fired when leaderboard rankings change. No payload. */
  LEADERBOARD_UPDATED: 'leaderboard:updated',
  /** Fired when a season challenge completes. Payload: (challengeId: string, description: string) */
  CHALLENGE_COMPLETED: 'challenge:completed',
  /** Fired when a season ends. Payload: `SeasonEndedEventPayload` */
  SEASON_ENDED: 'season:ended',
  /** Fired when a new season starts. Payload: `SeasonStartedEventPayload` */
  SEASON_STARTED: 'season:started',
  /** Fired when an achievement is unlocked. Payload: (achievementId: string, title: string, iconFrame: number) */
  ACHIEVEMENT_UNLOCKED: 'achievement:unlocked',

  // --- Navigation ---
  /** Fired to navigate to the campus overview scene. No payload. */
  NAVIGATE_CAMPUS: 'navigate-campus',
  /** Fired to navigate into a specific building. Payload: (building: 'office' | 'pod-foundry') */
  NAVIGATE_BUILDING: 'navigate-building',
  /** Fired when agent/pod counts update for campus display. Payload: (agents: number, pods: number) */
  CAMPUS_COUNTS_UPDATED: 'campus-counts-updated',
  /** Fired when fleet heartbeat data updates. Payload: (instances: FleetInstance[]) */
  FLEET_UPDATED: 'fleet-updated',
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
  // --- Agent interaction ---
  /** (agentId: string, state: AgentState) */
  [EVENTS.AGENT_INTERACT]: [agentId: string, state: AgentState]
  /** (agentId: string, state: AgentState) */
  [EVENTS.AGENT_CLICKED]: [agentId: string, state: AgentState]
  /** (agentId: string, state: AgentState) */
  [EVENTS.POD_AGENT_CLICKED]: [agentId: string, state: AgentState]
  /** (agentId: string, state: AgentState) */
  [EVENTS.AGENT_DOUBLE_CLICKED]: [agentId: string, state: AgentState]
  /** (agentId: string, state: AgentState) */
  [EVENTS.AGENT_RIGHT_CLICKED]: [agentId: string, state: AgentState]
  /** No payload */
  [EVENTS.AGENT_DESELECTED]: []
  /** (agentId: string, roomId: string) */
  [EVENTS.AGENT_DRAGGED_TO_ROOM]: [agentId: string, roomId: string]
  /** (agentId: string, newState: AgentState, prevState: AgentState) */
  [EVENTS.AGENT_STATE_CHANGED]: [agentId: string, newState: AgentState, prevState: AgentState]
  /** (agentId: string, tty: string) */
  [EVENTS.AGENT_APPROVED]: [agentId: string, tty: string]
  /** (agentId: string, state: AgentState) */
  [EVENTS.AGENT_ARRIVED]: [agentId: string, state: AgentState]
  /** (agentId: string) */
  [EVENTS.AGENT_DEPARTED]: [agentId: string]
  /** (agentId: string | null) */
  [EVENTS.SELECTION_CHANGED]: [agentId: string | null]

  // --- Room ---
  /** (roomId: string) */
  [EVENTS.ROOM_ENTERED]: [roomId: string]
  /** (roomId: string) */
  [EVENTS.ROOM_EXITED]: [roomId: string]

  // --- Input ---
  /** No payload */
  [EVENTS.INPUT_LOCKED]: []
  /** No payload */
  [EVENTS.INPUT_UNLOCKED]: []

  // --- UI / HUD ---
  /** (barId: string, value: number, max: number) */
  [EVENTS.BAR_UPDATED]: [barId: string, value: number, max: number]
  /** (message: string, level: 'info' | 'warn' | 'error') */
  [EVENTS.NOTIFICATION]: [message: string, level: 'info' | 'warn' | 'error']
  /** No payload */
  [EVENTS.ADD_WORKER_CLICKED]: []
  /** (deskId: string, worldX: number, worldY: number) */
  [EVENTS.DESK_CLICKED]: [deskId: string, worldX: number, worldY: number]
  /** (message: string) */
  [EVENTS.BROADCAST]: [message: string]

  // --- Workstation lifecycle ---
  /** (agentId: string, deskId: string) */
  [EVENTS.WORKSTATION_CREATED]: [agentId: string, deskId: string]
  /** (agentId: string) */
  [EVENTS.WORKSTATION_DESTROYED]: [agentId: string]

  // --- Theme ---
  /** (themeName: string) */
  [EVENTS.THEME_CHANGED]: [themeName: string]

  // --- External ---
  /** (url: string, issueNumber: number, repo: string) */
  [EVENTS.GITHUB_ISSUE_CLICKED]: [url: string, issueNumber: number, repo: string]

  // --- Game Systems ---
  [EVENTS.QUEST_STARTED]: [questId: string, agentId: string, difficulty: string]
  [EVENTS.QUEST_COMPLETED]: [questId: string, agentId: string, xpReward: number, creditReward: number, difficulty: string]
  [EVENTS.QUEST_FAILED]: [questId: string, agentId: string]
  [EVENTS.CREDITS_EARNED]: [amount: number, newBalance: number]
  [EVENTS.LEADERBOARD_UPDATED]: []
  [EVENTS.CHALLENGE_COMPLETED]: [challengeId: string, description: string]
  [EVENTS.SEASON_ENDED]: [payload: SeasonEndedEventPayload]
  [EVENTS.SEASON_STARTED]: [payload: SeasonStartedEventPayload]
  [EVENTS.ACHIEVEMENT_UNLOCKED]: [achievementId: string, title: string, iconFrame: number]

  // --- Navigation ---
  [EVENTS.NAVIGATE_CAMPUS]: []
  [EVENTS.NAVIGATE_BUILDING]: [building: 'office' | 'pod-foundry']
  [EVENTS.CAMPUS_COUNTS_UPDATED]: [agents: number, pods: number]
  [EVENTS.FLEET_UPDATED]: [instances: { instanceId: string; hostname: string; user?: string; stale: boolean; health: string; sessions: { total: number; active: number }; pods: { active: number }; repos: string[]; isSelf: boolean; lat?: number; lon?: number; city?: string }[]]
}
