// ---------------------------------------------------------------------------
// seasons.ts
// Seasonal arc system — monthly seasons with themes, challenges, scoring,
// and history. Runs in the renderer process with localStorage persistence.
// ---------------------------------------------------------------------------

import { EventBus, EVENTS } from './events'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SeasonChallenge {
  id: string
  description: string
  target: number
  current: number
  completed: boolean
  type: ChallengeType
}

export type ChallengeType =
  | 'tasks_completed'        // Complete N tasks total
  | 'agents_at_level'        // N agents reach level X
  | 'streak'                 // Maintain N-day streak without failures
  | 'no_failures'            // No failed tasks for N days
  | 'quest_difficulty'       // Complete N quests of a given difficulty
  | 'credits_earned'         // Earn N credits
  | 'mvp_weeks'              // Win MVP N weeks

export interface Season {
  id: string
  name: string
  theme: string
  accentColor: number
  accentColorCSS: string
  startDate: number
  endDate: number
  durationDays: number
  challenges: SeasonChallenge[]
  score: number
  completed: boolean
  // Cosmetic reward for completing the season
  rewardItemId?: string
  rewardDescription?: string
}

export interface SeasonHistory {
  seasonId: string
  name: string
  theme: string
  score: number
  challengesCompleted: number
  challengesTotal: number
  earnedReward?: string
  startDate: number
  endDate: number
}

// ---------------------------------------------------------------------------
// Season templates
// ---------------------------------------------------------------------------

const SEASON_TEMPLATES = [
  {
    name: 'Neon Sprint',
    theme: 'neon',
    accentColor: 0x00e5ff,
    accentColorCSS: '#00e5ff',
    challenges: [
      { type: 'tasks_completed' as ChallengeType, description: 'Complete 50 tasks', target: 50 },
      { type: 'agents_at_level' as ChallengeType, description: '3 agents reach Level 5', target: 3 },
      { type: 'streak' as ChallengeType, description: 'Maintain a 5-task streak', target: 5 },
      { type: 'quest_difficulty' as ChallengeType, description: 'Complete 5 Hard+ quests', target: 5 },
      { type: 'credits_earned' as ChallengeType, description: 'Earn 500 credits', target: 500 },
    ],
    rewardDescription: 'Neon desk trophy',
  },
  {
    name: 'Deep Focus',
    theme: 'focus',
    accentColor: 0xa855f7,
    accentColorCSS: '#a855f7',
    challenges: [
      { type: 'tasks_completed' as ChallengeType, description: 'Complete 75 tasks', target: 75 },
      { type: 'no_failures' as ChallengeType, description: 'No failures for 3 days', target: 3 },
      { type: 'agents_at_level' as ChallengeType, description: '2 agents reach Level 7', target: 2 },
      { type: 'streak' as ChallengeType, description: 'Maintain a 10-task streak', target: 10 },
      { type: 'quest_difficulty' as ChallengeType, description: 'Complete 3 Epic quests', target: 3 },
      { type: 'credits_earned' as ChallengeType, description: 'Earn 1000 credits', target: 1000 },
    ],
    rewardDescription: 'Crystal desk ornament',
  },
  {
    name: 'Ship It',
    theme: 'ship',
    accentColor: 0x34d399,
    accentColorCSS: '#34d399',
    challenges: [
      { type: 'tasks_completed' as ChallengeType, description: 'Complete 100 tasks', target: 100 },
      { type: 'agents_at_level' as ChallengeType, description: '5 agents reach Level 4', target: 5 },
      { type: 'mvp_weeks' as ChallengeType, description: 'Win MVP 2 weeks', target: 2 },
      { type: 'quest_difficulty' as ChallengeType, description: 'Complete 1 Legendary quest', target: 1 },
      { type: 'no_failures' as ChallengeType, description: 'No failures for 5 days', target: 5 },
    ],
    rewardDescription: 'Gold ship-in-bottle desk piece',
  },
  {
    name: 'Blitz Mode',
    theme: 'blitz',
    accentColor: 0xf59e0b,
    accentColorCSS: '#f59e0b',
    challenges: [
      { type: 'tasks_completed' as ChallengeType, description: 'Complete 60 tasks', target: 60 },
      { type: 'streak' as ChallengeType, description: 'Maintain a 15-task streak', target: 15 },
      { type: 'quest_difficulty' as ChallengeType, description: 'Complete 10 Hard+ quests', target: 10 },
      { type: 'credits_earned' as ChallengeType, description: 'Earn 750 credits', target: 750 },
      { type: 'agents_at_level' as ChallengeType, description: '1 agent reaches Level 8', target: 1 },
      { type: 'mvp_weeks' as ChallengeType, description: 'Win MVP 3 weeks', target: 3 },
    ],
    rewardDescription: 'Lightning bolt desk trophy',
  },
]

// ---------------------------------------------------------------------------
// SeasonManager
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'penpal:seasons'
const DEFAULT_DURATION_DAYS = 30

export class SeasonManager {
  private _currentSeason: Season | null = null
  private _history: SeasonHistory[] = []
  private _noFailureDays = 0
  private _lastFailureDate: string | null = null

  constructor() {
    this.load()
    this._ensureActiveSeason()
  }

  // -------------------------------------------------------------------------
  // Season lifecycle
  // -------------------------------------------------------------------------

  /** Get the current active season (creates one if none exists). */
  getCurrentSeason(): Season | null {
    this._checkSeasonExpiry()
    return this._currentSeason
  }

  /** Start a new season. If one is active, it ends first. */
  startNewSeason(templateIndex?: number): Season {
    if (this._currentSeason && !this._currentSeason.completed) {
      this.endSeason()
    }

    const idx = templateIndex ?? Math.floor(Math.random() * SEASON_TEMPLATES.length)
    const template = SEASON_TEMPLATES[idx % SEASON_TEMPLATES.length]
    const now = Date.now()

    const season: Season = {
      id: `season-${now}`,
      name: template.name,
      theme: template.theme,
      accentColor: template.accentColor,
      accentColorCSS: template.accentColorCSS,
      startDate: now,
      endDate: now + DEFAULT_DURATION_DAYS * 24 * 60 * 60 * 1000,
      durationDays: DEFAULT_DURATION_DAYS,
      challenges: template.challenges.map((c, i) => ({
        id: `ch-${i}`,
        description: c.description,
        target: c.target,
        current: 0,
        completed: false,
        type: c.type,
      })),
      score: 0,
      completed: false,
      rewardDescription: template.rewardDescription,
    }

    this._currentSeason = season
    this._noFailureDays = 0
    this._lastFailureDate = null
    this.save()

    EventBus.emit(
      EVENTS.NOTIFICATION,
      `New season started: ${season.name}!`,
      'info',
    )

    EventBus.emit(EVENTS.SEASON_STARTED, season.id, season.name)

    return season
  }

  /** End the current season and archive it. */
  endSeason(): SeasonHistory | null {
    if (!this._currentSeason) return null

    this._currentSeason.completed = true
    const s = this._currentSeason

    const history: SeasonHistory = {
      seasonId: s.id,
      name: s.name,
      theme: s.theme,
      score: s.score,
      challengesCompleted: s.challenges.filter(c => c.completed).length,
      challengesTotal: s.challenges.length,
      earnedReward: s.rewardDescription,
      startDate: s.startDate,
      endDate: Date.now(),
    }

    this._history.unshift(history)
    this._currentSeason = null
    this.save()

    EventBus.emit(
      EVENTS.NOTIFICATION,
      `Season "${s.name}" ended! Score: ${s.score}`,
      'info',
    )

    EventBus.emit(EVENTS.SEASON_ENDED, s.id, s.name, s.score)

    return history
  }

  // -------------------------------------------------------------------------
  // Challenge tracking
  // -------------------------------------------------------------------------

  /** Track a task completion. */
  trackTaskCompleted(streak: number): void {
    if (!this._currentSeason) return

    this._currentSeason.score += 10
    this._updateChallenge('tasks_completed', 1)

    // Streak challenges
    for (const ch of this._currentSeason.challenges) {
      if (ch.type === 'streak' && !ch.completed) {
        ch.current = Math.max(ch.current, streak)
        if (ch.current >= ch.target) {
          ch.completed = true
          this._onChallengeComplete(ch)
        }
      }
    }

    this.save()
  }

  /** Track a task failure. */
  trackTaskFailed(): void {
    if (!this._currentSeason) return

    const today = new Date().toISOString().slice(0, 10)
    this._lastFailureDate = today
    this._noFailureDays = 0

    // Reset no_failures challenges
    for (const ch of this._currentSeason.challenges) {
      if (ch.type === 'no_failures' && !ch.completed) {
        ch.current = 0
      }
    }

    this.save()
  }

  /** Track a day passing without failures (call once per day). */
  trackNoFailureDay(): void {
    if (!this._currentSeason) return

    const today = new Date().toISOString().slice(0, 10)
    if (this._lastFailureDate === today) return

    this._noFailureDays++
    this._updateChallenge('no_failures', 0, this._noFailureDays)
    this.save()
  }

  /** Track agent level ups. */
  trackAgentLevel(level: number): void {
    if (!this._currentSeason) return
    this._currentSeason.score += 50

    // Count how many agents are at or above the target level
    // (caller should pass the count, but for simplicity we just increment)
    this._updateChallenge('agents_at_level', 1)
    this.save()
  }

  /** Track quest completion by difficulty. */
  trackQuestDifficulty(difficulty: string): void {
    if (!this._currentSeason) return

    const isHardPlus = difficulty === 'hard' || difficulty === 'epic' || difficulty === 'legendary'
    if (isHardPlus) {
      this._updateChallenge('quest_difficulty', 1)
    }

    this.save()
  }

  /** Track credits earned. */
  trackCreditsEarned(amount: number): void {
    if (!this._currentSeason) return
    this._updateChallenge('credits_earned', amount)
    this.save()
  }

  /** Track MVP win. */
  trackMVPWin(): void {
    if (!this._currentSeason) return
    this._updateChallenge('mvp_weeks', 1)
    this.save()
  }

  // -------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------

  getHistory(): readonly SeasonHistory[] {
    return this._history
  }

  getSeasonProgress(): { completed: number; total: number; pct: number } {
    if (!this._currentSeason) return { completed: 0, total: 0, pct: 0 }
    const completed = this._currentSeason.challenges.filter(c => c.completed).length
    const total = this._currentSeason.challenges.length
    return { completed, total, pct: total > 0 ? completed / total : 0 }
  }

  getDaysRemaining(): number {
    if (!this._currentSeason) return 0
    return Math.max(0, Math.ceil((this._currentSeason.endDate - Date.now()) / 86400000))
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private _ensureActiveSeason(): void {
    if (!this._currentSeason || this._currentSeason.completed) {
      this.startNewSeason()
    }
  }

  private _checkSeasonExpiry(): void {
    if (this._currentSeason && Date.now() > this._currentSeason.endDate) {
      this.endSeason()
      this.startNewSeason()
    }
  }

  private _updateChallenge(type: ChallengeType, increment: number, setValue?: number): void {
    if (!this._currentSeason) return

    for (const ch of this._currentSeason.challenges) {
      if (ch.type === type && !ch.completed) {
        if (setValue !== undefined) {
          ch.current = setValue
        } else {
          ch.current += increment
        }
        if (ch.current >= ch.target) {
          ch.completed = true
          this._onChallengeComplete(ch)
        }
      }
    }
  }

  private _onChallengeComplete(ch: SeasonChallenge): void {
    if (!this._currentSeason) return
    this._currentSeason.score += 100

    EventBus.emit(
      EVENTS.NOTIFICATION,
      `Challenge complete: ${ch.description}!`,
      'info',
    )

    EventBus.emit(EVENTS.CHALLENGE_COMPLETED, ch.id, ch.description)
  }

  // -------------------------------------------------------------------------
  // Persistence
  // -------------------------------------------------------------------------

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        currentSeason: this._currentSeason,
        history: this._history,
        noFailureDays: this._noFailureDays,
        lastFailureDate: this._lastFailureDate,
      }))
    } catch { /* noop */ }
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const data = JSON.parse(raw)
      if (data.currentSeason) this._currentSeason = data.currentSeason
      if (Array.isArray(data.history)) this._history = data.history
      if (typeof data.noFailureDays === 'number') this._noFailureDays = data.noFailureDays
      if (data.lastFailureDate) this._lastFailureDate = data.lastFailureDate
    } catch { /* corrupt — start fresh */ }
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const seasonManager = new SeasonManager()
