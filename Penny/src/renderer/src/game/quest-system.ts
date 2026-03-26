// ---------------------------------------------------------------------------
// quest-system.ts
// Quest auto-wrapper — wraps orchestrator tasks and pod workflows into quests
// with difficulty inference, XP/credit multipliers, and a quest log.
// ---------------------------------------------------------------------------

import { EventBus, EVENTS } from './events'
import { ICON_FRAMES } from './office-asset-keys'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type QuestDifficulty = 'trivial' | 'normal' | 'hard' | 'epic' | 'legendary'

export type QuestStatus = 'active' | 'completed' | 'failed'

export interface Quest {
  id: string
  title: string
  agentId: string
  difficulty: QuestDifficulty
  status: QuestStatus
  xpReward: number
  creditReward: number
  startedAt: number
  completedAt?: number
  durationMs?: number
  // Source metadata
  taskId?: string
  podWorkflowId?: string
  priority?: string
  agentCount?: number
}

// ---------------------------------------------------------------------------
// Difficulty config
// ---------------------------------------------------------------------------

const DIFFICULTY_CONFIG: Record<QuestDifficulty, {
  xpMultiplier: number
  creditMultiplier: number
  color: number
  label: string
  icon: string
  spriteFrame: number
}> = {
  trivial:   { xpMultiplier: 1,   creditMultiplier: 1,   color: 0x6b7280, label: 'Trivial',   icon: '\u25CB',       spriteFrame: ICON_FRAMES.STAR_GREY },
  normal:    { xpMultiplier: 1.5, creditMultiplier: 1.5, color: 0x3b82f6, label: 'Normal',    icon: '\u25CF',       spriteFrame: ICON_FRAMES.STAR_BLUE },
  hard:      { xpMultiplier: 2,   creditMultiplier: 2,   color: 0xa855f7, label: 'Hard',      icon: '\u2605',       spriteFrame: ICON_FRAMES.STAR_GREEN },
  epic:      { xpMultiplier: 3,   creditMultiplier: 3,   color: 0xf59e0b, label: 'Epic',      icon: '\u2B50',       spriteFrame: ICON_FRAMES.STAR_YELLOW },
  legendary: { xpMultiplier: 5,   creditMultiplier: 5,   color: 0xef4444, label: 'Legendary', icon: '\uD83D\uDD25', spriteFrame: ICON_FRAMES.STAR_RED },
}

const BASE_XP = 100
const BASE_CREDITS = 50
const MAX_LOG_SIZE = 50

// ---------------------------------------------------------------------------
// Difficulty inference
// ---------------------------------------------------------------------------

export function inferDifficulty(opts: {
  priority?: string
  agentCount?: number
  isPod?: boolean
  estimatedDurationMin?: number
}): QuestDifficulty {
  const { priority, agentCount = 1, isPod = false, estimatedDurationMin = 0 } = opts

  // Legendary: cross-repo pods or very long tasks
  if (estimatedDurationMin > 30 || (isPod && agentCount >= 3)) return 'legendary'

  // Epic: critical priority or multi-agent pods
  if (priority === 'critical' || (isPod && agentCount >= 2)) return 'epic'

  // Hard: high priority or multi-file indicators
  if (priority === 'high') return 'hard'

  // Trivial: low priority single agent
  if (priority === 'low') return 'trivial'

  return 'normal'
}

// ---------------------------------------------------------------------------
// QuestSystem
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'penpal:quests'

export class QuestSystem {
  private _activeQuests = new Map<string, Quest>()
  private _completedQuests: Quest[] = []
  private _questCounter = 0

  constructor() {
    this.load()
  }

  // -------------------------------------------------------------------------
  // Quest lifecycle
  // -------------------------------------------------------------------------

  /** Wrap an orchestrator task or pod workflow into a quest. Returns the quest. */
  startQuest(opts: {
    title: string
    agentId: string
    taskId?: string
    podWorkflowId?: string
    priority?: string
    agentCount?: number
    isPod?: boolean
    estimatedDurationMin?: number
  }): Quest {
    const difficulty = inferDifficulty(opts)
    const config = DIFFICULTY_CONFIG[difficulty]

    const quest: Quest = {
      id: `quest-${Date.now()}-${++this._questCounter}`,
      title: opts.title,
      agentId: opts.agentId,
      difficulty,
      status: 'active',
      xpReward: Math.round(BASE_XP * config.xpMultiplier),
      creditReward: Math.round(BASE_CREDITS * config.creditMultiplier),
      startedAt: Date.now(),
      taskId: opts.taskId,
      podWorkflowId: opts.podWorkflowId,
      priority: opts.priority,
      agentCount: opts.agentCount,
    }

    this._activeQuests.set(quest.id, quest)
    this.save()

    EventBus.emit(EVENTS.NOTIFICATION, `Quest started: ${quest.title} [${config.label}]`, 'info')
    EventBus.emit(EVENTS.QUEST_STARTED, quest.id, quest.agentId, quest.difficulty)

    return quest
  }

  /** Mark a quest as completed. Returns earned credits. */
  completeQuest(questId: string): { xp: number; credits: number } | null {
    const quest = this._activeQuests.get(questId)
    if (!quest) return null

    quest.status = 'completed'
    quest.completedAt = Date.now()
    quest.durationMs = quest.completedAt - quest.startedAt

    this._activeQuests.delete(questId)
    this._completedQuests.unshift(quest)
    if (this._completedQuests.length > MAX_LOG_SIZE) this._completedQuests.pop()
    this.save()

    const config = DIFFICULTY_CONFIG[quest.difficulty]
    EventBus.emit(
      EVENTS.NOTIFICATION,
      `Quest complete! ${config.icon} +${quest.xpReward} XP, +${quest.creditReward} credits`,
      'info',
    )

    return { xp: quest.xpReward, credits: quest.creditReward }
  }

  /** Mark a quest as failed. */
  failQuest(questId: string): void {
    const quest = this._activeQuests.get(questId)
    if (!quest) return

    quest.status = 'failed'
    quest.completedAt = Date.now()
    quest.durationMs = quest.completedAt - quest.startedAt

    this._activeQuests.delete(questId)
    this._completedQuests.unshift(quest)
    if (this._completedQuests.length > MAX_LOG_SIZE) this._completedQuests.pop()
    this.save()

    EventBus.emit(EVENTS.QUEST_FAILED, quest.id, quest.agentId)
  }

  /** Find active quest by task ID. */
  findByTaskId(taskId: string): Quest | undefined {
    for (const q of this._activeQuests.values()) {
      if (q.taskId === taskId) return q
    }
    return undefined
  }

  /** Find active quest by pod workflow ID. */
  findByPodId(podWorkflowId: string): Quest | undefined {
    for (const q of this._activeQuests.values()) {
      if (q.podWorkflowId === podWorkflowId) return q
    }
    return undefined
  }

  // -------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------

  getActiveQuests(): Quest[] {
    return Array.from(this._activeQuests.values())
  }

  getCompletedQuests(): Quest[] {
    return [...this._completedQuests]
  }

  getActiveCount(): number {
    return this._activeQuests.size
  }

  getAgentActiveQuests(agentId: string): Quest[] {
    return this.getActiveQuests().filter(q => q.agentId === agentId)
  }

  // -------------------------------------------------------------------------
  // Difficulty config access (for rendering)
  // -------------------------------------------------------------------------

  static getDifficultyConfig(d: QuestDifficulty) {
    return DIFFICULTY_CONFIG[d]
  }

  static getDifficultyColor(d: QuestDifficulty): number {
    return DIFFICULTY_CONFIG[d].color
  }

  static getDifficultyIcon(d: QuestDifficulty): string {
    return DIFFICULTY_CONFIG[d].icon
  }

  // -------------------------------------------------------------------------
  // Persistence
  // -------------------------------------------------------------------------

  private save(): void {
    try {
      const data = {
        active: Array.from(this._activeQuests.values()),
        completed: this._completedQuests,
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch { /* noop */ }
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const data = JSON.parse(raw) as { active?: Quest[]; completed?: Quest[] }

      if (Array.isArray(data.active)) {
        for (const q of data.active) this._activeQuests.set(q.id, q)
      }
      if (Array.isArray(data.completed)) {
        this._completedQuests = data.completed.slice(0, MAX_LOG_SIZE)
      }
    } catch { /* corrupt — start fresh */ }
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const questSystem = new QuestSystem()
