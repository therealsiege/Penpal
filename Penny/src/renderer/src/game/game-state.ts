/**
 * game-state.ts
 *
 * Core game state data model — TypeScript interfaces only.
 * Foundation for separating game logic from Phaser rendering.
 * No implementations, no circular deps.
 *
 * Issue: therealsiege/Penpal#200 — RPG Layer 0a
 */

// ── Primitive helpers ──────────────────────────────────────────────────────────

export type DayPhase = 'dawn' | 'morning' | 'afternoon' | 'dusk' | 'night'
export type Season = 'spring' | 'summer' | 'autumn' | 'winter'
export type Weather = 'clear' | 'cloudy' | 'rain' | 'snow' | 'storm'
export type Direction = 'up' | 'down' | 'left' | 'right'
export type PropType = 'decorative' | 'interactive' | 'animated'
export type QuestStatus = 'available' | 'active' | 'complete' | 'failed'

// ── Sub-types ──────────────────────────────────────────────────────────────────

export interface Position2D {
  x: number
  y: number
}

export interface Position3D extends Position2D {
  scene: string
}

export interface TimeState {
  hour: number
  minute: number
  dayPhase: DayPhase
  season: Season
}

export interface PlayerStats {
  xp: number
  level: number
  credits: number
}

export interface AgentGameStats {
  xp: number
  level: number
  tasksCompleted: number
  tasksFailed: number
}

export interface RoomBounds {
  x: number
  y: number
  width: number
  height: number
}

export interface QuestRewards {
  xp: number
  credits: number
}

export interface DialogOption {
  id: string
  text: string
  nextDialogId?: string
}

export interface Notification {
  id: string
  message: string
  timestamp: number
}

// ── Core interfaces ────────────────────────────────────────────────────────────

export interface AnimationState {
  /** Current animation state name (e.g. 'idle-down', 'walk-left', 'sit') */
  current: string
  frame: number
  loop: boolean
  speed: number
}

export interface DialogState {
  speakerId: string
  text: string
  options: DialogOption[]
  portrait?: string
}

export interface Prop {
  id: string
  type: PropType
  position: Position2D
  sprite: string
  interactionRadius: number
}

export interface WorldState {
  currentScene: string
  time: TimeState
  weather: Weather
}

export interface PlayerState {
  position: Position3D
  direction: Direction
  inventory: string[]
  equipped: string[]
  stats: PlayerStats
}

export interface AgentGameState {
  agentId: string
  position: Position2D
  animation: AnimationState
  mood: string
  activity: string
  dialog?: DialogState
  stats: AgentGameStats
}

export interface RoomState {
  id: string
  bounds: RoomBounds
  agentIds: string[]
  props: Prop[]
  lighting: number
}

export interface QuestState {
  id: string
  status: QuestStatus
  issueNumber?: number
  podId?: string
  title: string
  description: string
  rewards: QuestRewards
  assignedAgentId?: string
  startedAt?: number
  completedAt?: number
}

export interface UIState {
  questLogOpen: boolean
  inventoryOpen: boolean
  dialogActive: boolean
  notifications: Notification[]
}

// ── Root state ─────────────────────────────────────────────────────────────────

export interface GameState {
  world: WorldState
  player: PlayerState
  agents: Record<string, AgentGameState>
  rooms: Record<string, RoomState>
  quests: Record<string, QuestState>
  ui: UIState
}
