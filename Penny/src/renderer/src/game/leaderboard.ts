// ---------------------------------------------------------------------------
// leaderboard.ts
// Competitive leaderboard — ranks agents by season XP, tracks weekly MVP,
// detects rivalries between agents within 5% XP of each other.
// ---------------------------------------------------------------------------

import { EventBus, EVENTS } from './events'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LeaderboardEntry {
  agentId: string
  agentName: string
  rank: number
  seasonXP: number
  tasksCompleted: number
  currentStreak: number
  fastestTaskMs: number
  level: number
  rankTitle: string
}

export interface WeeklyMVP {
  agentId: string
  agentName: string
  weekXP: number
  weekStart: number
  weekEnd: number
}

export interface Rivalry {
  agent1Id: string
  agent2Id: string
  agent1Name: string
  agent2Name: string
  xpDiff: number
  percentDiff: number
}

// ---------------------------------------------------------------------------
// LeaderboardManager
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'penpal:leaderboard'
const RIVALRY_THRESHOLD = 0.05 // 5%

export class LeaderboardManager {
  // Per-agent season stats
  private _seasonStats = new Map<string, {
    agentName: string
    seasonXP: number
    tasksCompleted: number
    currentStreak: number
    fastestTaskMs: number
    weeklyXP: Map<string, number> // weekKey -> xp
    level: number
    rankTitle: string
  }>()

  private _weeklyMVP: WeeklyMVP | null = null
  private _rivalries: Rivalry[] = []

  constructor() {
    this.load()
  }

  // -------------------------------------------------------------------------
  // Stat tracking
  // -------------------------------------------------------------------------

  /** Record XP earned by an agent this season. */
  recordXP(agentId: string, agentName: string, xp: number, level: number, rankTitle: string): void {
    let stats = this._seasonStats.get(agentId)
    if (!stats) {
      stats = {
        agentName,
        seasonXP: 0,
        tasksCompleted: 0,
        currentStreak: 0,
        fastestTaskMs: Infinity,
        weeklyXP: new Map(),
        level,
        rankTitle,
      }
      this._seasonStats.set(agentId, stats)
    }

    stats.seasonXP += xp
    stats.level = level
    stats.rankTitle = rankTitle
    stats.agentName = agentName

    // Track weekly
    const weekKey = this._currentWeekKey()
    stats.weeklyXP.set(weekKey, (stats.weeklyXP.get(weekKey) ?? 0) + xp)

    this.save()
    this._computeRivalries()
  }

  /** Record a completed task for an agent. */
  recordTaskComplete(agentId: string, agentName: string, durationMs: number, streak: number): void {
    let stats = this._seasonStats.get(agentId)
    if (!stats) {
      stats = {
        agentName,
        seasonXP: 0,
        tasksCompleted: 0,
        currentStreak: 0,
        fastestTaskMs: Infinity,
        weeklyXP: new Map(),
        level: 1,
        rankTitle: 'Intern',
      }
      this._seasonStats.set(agentId, stats)
    }

    stats.tasksCompleted++
    stats.currentStreak = streak
    stats.agentName = agentName
    if (durationMs > 0 && durationMs < stats.fastestTaskMs) {
      stats.fastestTaskMs = durationMs
    }

    this.save()
  }

  /** Reset season stats (called at season end). */
  resetSeason(): void {
    this._seasonStats.clear()
    this._weeklyMVP = null
    this._rivalries = []
    this.save()
  }

  // -------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------

  getRankingsSnapshot(limit = 12): LeaderboardEntry[] {
    return this.getRankings().slice(0, Math.max(0, limit))
  }

  getSeasonMVP(): LeaderboardEntry | null {
    const entries = this.getRankings()
    return entries.length > 0 ? entries[0] : null
  }

  /** Get sorted leaderboard entries. */
  getRankings(): LeaderboardEntry[] {
    const entries: LeaderboardEntry[] = []
    for (const [agentId, stats] of this._seasonStats) {
      entries.push({
        agentId,
        agentName: stats.agentName,
        rank: 0,
        seasonXP: stats.seasonXP,
        tasksCompleted: stats.tasksCompleted,
        currentStreak: stats.currentStreak,
        fastestTaskMs: stats.fastestTaskMs,
        level: stats.level,
        rankTitle: stats.rankTitle,
      })
    }

    entries.sort((a, b) => b.seasonXP - a.seasonXP)
    entries.forEach((e, i) => { e.rank = i + 1 })
    return entries
  }

  /** Compute and return the weekly MVP. */
  getWeeklyMVP(): WeeklyMVP | null {
    const weekKey = this._currentWeekKey()
    let bestId = ''
    let bestName = ''
    let bestXP = 0

    for (const [agentId, stats] of this._seasonStats) {
      const weekXP = stats.weeklyXP.get(weekKey) ?? 0
      if (weekXP > bestXP) {
        bestXP = weekXP
        bestId = agentId
        bestName = stats.agentName
      }
    }

    if (!bestId || bestXP === 0) return null

    const now = new Date()
    const dayOfWeek = now.getDay()
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - dayOfWeek)
    weekStart.setHours(0, 0, 0, 0)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 7)

    this._weeklyMVP = {
      agentId: bestId,
      agentName: bestName,
      weekXP: bestXP,
      weekStart: weekStart.getTime(),
      weekEnd: weekEnd.getTime(),
    }
    return this._weeklyMVP
  }

  /** Get detected rivalries (agents within 5% XP of each other). */
  getRivalries(): Rivalry[] {
    return this._rivalries
  }

  /** Check if a specific agent is the weekly MVP. */
  isMVP(agentId: string): boolean {
    const mvp = this.getWeeklyMVP()
    return mvp?.agentId === agentId
  }

  /** Check if two agents have a rivalry. */
  hasRivalry(agent1Id: string, agent2Id: string): boolean {
    return this._rivalries.some(
      r => (r.agent1Id === agent1Id && r.agent2Id === agent2Id) ||
           (r.agent1Id === agent2Id && r.agent2Id === agent1Id),
    )
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private _currentWeekKey(): string {
    const now = new Date()
    const year = now.getFullYear()
    const jan1 = new Date(year, 0, 1)
    const days = Math.floor((now.getTime() - jan1.getTime()) / 86400000)
    const week = Math.ceil((days + jan1.getDay() + 1) / 7)
    return `${year}-W${String(week).padStart(2, '0')}`
  }

  private _computeRivalries(): void {
    const entries = this.getRankings()
    this._rivalries = []

    for (let i = 0; i < entries.length - 1; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const a = entries[i]
        const b = entries[j]
        if (a.seasonXP === 0 && b.seasonXP === 0) continue
        const max = Math.max(a.seasonXP, b.seasonXP)
        if (max === 0) continue
        const diff = Math.abs(a.seasonXP - b.seasonXP)
        const pct = diff / max
        if (pct <= RIVALRY_THRESHOLD) {
          this._rivalries.push({
            agent1Id: a.agentId,
            agent2Id: b.agentId,
            agent1Name: a.agentName,
            agent2Name: b.agentName,
            xpDiff: diff,
            percentDiff: pct,
          })
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // Persistence
  // -------------------------------------------------------------------------

  private save(): void {
    try {
      const data: Record<string, unknown> = {}
      for (const [agentId, stats] of this._seasonStats) {
        data[agentId] = {
          ...stats,
          weeklyXP: Object.fromEntries(stats.weeklyXP),
        }
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch { /* noop */ }
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const data = JSON.parse(raw)
      for (const [agentId, stats] of Object.entries(data)) {
        const s = stats as Record<string, unknown>
        this._seasonStats.set(agentId, {
          agentName: (s.agentName as string) ?? agentId,
          seasonXP: (s.seasonXP as number) ?? 0,
          tasksCompleted: (s.tasksCompleted as number) ?? 0,
          currentStreak: (s.currentStreak as number) ?? 0,
          fastestTaskMs: (s.fastestTaskMs as number) ?? Infinity,
          weeklyXP: new Map(Object.entries((s.weeklyXP as Record<string, number>) ?? {})),
          level: (s.level as number) ?? 1,
          rankTitle: (s.rankTitle as string) ?? 'Intern',
        })
      }
      this._computeRivalries()
    } catch { /* corrupt — start fresh */ }
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const leaderboardManager = new LeaderboardManager()
