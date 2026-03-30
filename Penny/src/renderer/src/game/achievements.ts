/**
 * achievements.ts — Badge/achievement system for the PenPal office game.
 *
 * AchievementManager is a singleton that tracks office stats, unlocks badges,
 * and emits NOTIFICATION events via EventBus so toasts surface in the HUD.
 * State persists to localStorage under the key `penpal:achievements`.
 *
 * Usage (from OfficeScene or any module):
 *   import { achievements } from './achievements'
 *   achievements.trackAgentCount(rooms.size)
 *   achievements.trackTaskCompleted(durationMs)
 */

import { EventBus, EVENTS } from './events'
import { ICON_FRAMES } from './office-asset-keys'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Achievement {
  id: string
  title: string
  description: string
  icon: string
  iconFrame: number
  unlocked: boolean
  unlockedAt?: number
}

// Persisted shape written to localStorage
interface AchievementStore {
  unlocked: string[]          // achievement ids
  totalTasks: number
}

// ---------------------------------------------------------------------------
// Achievement definitions
// ---------------------------------------------------------------------------

const ACHIEVEMENT_DEFS: Omit<Achievement, 'unlocked' | 'unlockedAt'>[] = [
  // Milestone
  { id: 'first_agent',      title: 'First Hire',       description: 'First agent joined the office',          icon: '👋', iconFrame: ICON_FRAMES.ACHIEVEMENT_BADGE },
  { id: 'full_house',       title: 'Full House',        description: '8+ agents working simultaneously',       icon: '🏢', iconFrame: ICON_FRAMES.MEDAL_GOLD_BLUE },
  { id: 'night_owl',        title: 'Night Owl',         description: 'Agents working past midnight',           icon: '🦉', iconFrame: ICON_FRAMES.STAR_BLUE },
  { id: 'early_bird',       title: 'Early Bird',        description: 'Agents working before 6am',              icon: '🐦', iconFrame: ICON_FRAMES.STAR_YELLOW },

  // Productivity
  { id: 'first_task',       title: 'Getting Started',   description: 'First task completed',                   icon: '✅', iconFrame: ICON_FRAMES.CHECKMARK },
  { id: 'ten_tasks',        title: 'On A Roll',          description: '10 tasks completed in one session',      icon: '🔥', iconFrame: ICON_FRAMES.STAR_RED },
  { id: 'hundred_tasks',    title: 'Task Machine',       description: '100 total tasks completed',              icon: '⚡', iconFrame: ICON_FRAMES.MEDAL_GOLD },

  // Fun
  { id: 'coffee_break',     title: 'Coffee Culture',    description: 'Agent visited the cafe',                 icon: '☕', iconFrame: ICON_FRAMES.STAR_GREEN },
  { id: 'blocked_resolved', title: 'Unblocked',         description: 'Resolved a blocked agent',               icon: '🔓', iconFrame: ICON_FRAMES.CIRCLE_GREEN },
  { id: 'rank_up',          title: 'Promotion',         description: 'An agent ranked up',                     icon: '⭐', iconFrame: ICON_FRAMES.MEDAL_GOLD_PURPLE },
  { id: 'marathon',         title: 'Marathon',          description: 'An agent worked for 2+ hours straight',  icon: '🏃', iconFrame: ICON_FRAMES.MEDAL_BRONZE },
  { id: 'team_player',      title: 'Team Player',       description: '3+ agents in the same room',             icon: '🤝', iconFrame: ICON_FRAMES.MEDAL_SILVER },
  { id: 'speed_demon',      title: 'Speed Demon',       description: 'Task completed in under 30 seconds',     icon: '💨', iconFrame: ICON_FRAMES.STAR_RED },
]

// Lookup map built once at module load
const ACHIEVEMENT_MAP = new Map(ACHIEVEMENT_DEFS.map(a => [a.id, a]))

// ---------------------------------------------------------------------------
// AchievementManager
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'penpal:achievements'

export class AchievementManager {
  private _unlocked = new Set<string>()
  private _stats = {
    totalTasks: 0,
    sessionTasks: 0,
    maxConcurrentAgents: 0,
  }

  constructor() {
    this.load()
  }

  // -------------------------------------------------------------------------
  // Core unlock logic
  // -------------------------------------------------------------------------

  /**
   * Attempt to unlock an achievement by id.
   * Returns true if this call caused the unlock (i.e., was not already unlocked).
   * Emits a NOTIFICATION event on first unlock.
   */
  tryUnlock(id: string): boolean {
    if (this._unlocked.has(id)) return false

    const def = ACHIEVEMENT_MAP.get(id)
    if (!def) return false

    this._unlocked.add(id)
    this.save()

    EventBus.emit(
      EVENTS.NOTIFICATION,
      `${def.icon} Achievement unlocked: ${def.title} — ${def.description}`,
      'info' as const,
    )
    EventBus.emit(EVENTS.ACHIEVEMENT_UNLOCKED, id, def.title, def.iconFrame)
    return true
  }

  // -------------------------------------------------------------------------
  // Stat tracking — call these from OfficeScene / modules
  // -------------------------------------------------------------------------

  /** Call whenever the total concurrent agent count changes. */
  trackAgentCount(count: number): void {
    if (count > this._stats.maxConcurrentAgents) {
      this._stats.maxConcurrentAgents = count
    }

    if (count >= 1) this.tryUnlock('first_agent')
    if (count >= 8) this.tryUnlock('full_house')
    if (count >= 3) this.tryUnlock('team_player')
  }

  /**
   * Call when an agent transitions from working → idle (task complete).
   * @param durationMs  Optional wall-clock time the agent spent on this task.
   */
  trackTaskCompleted(durationMs?: number): void {
    this._stats.totalTasks++
    this._stats.sessionTasks++

    this.tryUnlock('first_task')
    if (this._stats.sessionTasks >= 10)  this.tryUnlock('ten_tasks')
    if (this._stats.totalTasks >= 100)   this.tryUnlock('hundred_tasks')

    if (durationMs !== undefined) {
      if (durationMs < 30_000)           this.tryUnlock('speed_demon')
      if (durationMs >= 2 * 60 * 60_000) this.tryUnlock('marathon')
    }

    // Check clock-based achievements (hour of current local time)
    const hour = new Date().getHours()
    if (hour >= 0 && hour < 2)  this.tryUnlock('night_owl')
    if (hour >= 4 && hour < 6)  this.tryUnlock('early_bird')
  }

  /** Call when any agent enters the cafe (onCoffeeRun = true). */
  trackCoffeeVisit(): void {
    this.tryUnlock('coffee_break')
  }

  /** Call when a previously-blocked agent transitions out of blocked state. */
  trackBlockResolved(): void {
    this.tryUnlock('blocked_resolved')
  }

  /** Call when an agent's XP level increases. */
  trackRankUp(): void {
    this.tryUnlock('rank_up')
  }

  // -------------------------------------------------------------------------
  // Persistence
  // -------------------------------------------------------------------------

  save(): void {
    const store: AchievementStore = {
      unlocked: [...this._unlocked],
      totalTasks: this._stats.totalTasks,
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
    } catch {
      // localStorage may be unavailable in some sandboxed contexts — silently ignore
    }
  }

  load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const store = JSON.parse(raw) as Partial<AchievementStore>

      if (Array.isArray(store.unlocked)) {
        for (const id of store.unlocked) {
          if (ACHIEVEMENT_MAP.has(id)) this._unlocked.add(id)
        }
      }
      if (typeof store.totalTasks === 'number') {
        this._stats.totalTasks = store.totalTasks
      }
    } catch {
      // Corrupt data — start fresh
    }
  }

  // -------------------------------------------------------------------------
  // Query helpers
  // -------------------------------------------------------------------------

  /** Returns all achievements with current unlock state merged in. */
  getAll(): Achievement[] {
    return ACHIEVEMENT_DEFS.map(def => ({
      ...def,
      unlocked: this._unlocked.has(def.id),
    }))
  }

  /** Returns only unlocked achievements. */
  getUnlocked(): Achievement[] {
    return this.getAll().filter(a => a.unlocked)
  }

  /** Returns { unlocked, total } progress counts. */
  getProgress(): { unlocked: number; total: number } {
    return {
      unlocked: this._unlocked.size,
      total: ACHIEVEMENT_MAP.size,
    }
  }

  /** Returns the current session task count (resets on manager construction). */
  getSessionTasks(): number {
    return this._stats.sessionTasks
  }

  /** Lifetime completed task count (persisted) — for incremental achievement progress. */
  getTotalTasks(): number {
    return this._stats.totalTasks
  }

  /** Returns the peak concurrent agent count seen this session. */
  getMaxConcurrentAgents(): number {
    return this._stats.maxConcurrentAgents
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

export const achievements = new AchievementManager()
