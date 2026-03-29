// ---------------------------------------------------------------------------
// seasons.ts
// Seasonal arc system — monthly seasons with themes, challenges, scoring,
// and history. Runs in the renderer process with localStorage persistence.
// ---------------------------------------------------------------------------

import {
  EventBus,
  EVENTS,
  type SeasonEndedEventPayload,
  type SeasonStartedEventPayload,
} from './events'
import { leaderboardManager } from './leaderboard'

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
  | 'tasks_completed'
  | 'agents_at_level'
  | 'streak'
  | 'no_failures'
  | 'quest_difficulty'
  | 'credits_earned'
  | 'mvp_weeks'

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
  questsCompletedThisSeason: number
  completed: boolean
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

const STORAGE_KEY = 'penpal:seasons'
const DEFAULT_DURATION_DAYS = 30

export class SeasonManager {
  private _currentSeason: Season | null = null
  private _history: SeasonHistory[] = []
  private _noFailureDays = 0
  private _lastFailureDate: string | null = null
  private _rolloverPending = false
  private _endedSeasonDisplay: Season | null = null

  constructor() {
    this.load()
    this._ensureActiveSeason()
  }

  getCurrentSeason(): Season | null {
    this._checkSeasonExpiry()
    if (this._rolloverPending && this._endedSeasonDisplay) {
      return this._endedSeasonDisplay
    }
    return this._currentSeason
  }

  isAwaitingSeasonRollover(): boolean {
    return this._rolloverPending
  }

  getSeasonTimeRemainingLabel(): string {
    if (this._rolloverPending) return 'Ending…'
    if (!this._currentSeason) return ''
    const ms = Math.max(0, this._currentSeason.endDate - Date.now())
    const days = Math.floor(ms / 86400000)
    if (days >= 1) return `${days}d left`
    const hours = Math.max(1, Math.ceil(ms / 3600000))
    return `${hours}h left`
  }

  startNewSeason(templateIndex?: number): Season {
    if (this._rolloverPending) {
      return this.finishSeasonRollover(templateIndex)
    }
    if (this._currentSeason && !this._currentSeason.completed) {
      this.endSeason({ emitEvent: false, holdForCeremony: false })
    }
    return this._activateNewSeason(templateIndex, { skipIntroCelebration: false })
  }

  finishSeasonRollover(templateIndex?: number): Season {
    if (!this._rolloverPending) {
      return this.getCurrentSeason() ?? this.startNewSeason(templateIndex)
    }
    this._rolloverPending = false
    this._endedSeasonDisplay = null
    return this._activateNewSeason(templateIndex, { skipIntroCelebration: true })
  }

  endSeason(opts?: { emitEvent?: boolean; holdForCeremony?: boolean }): SeasonHistory | null {
    const emitEvent = opts?.emitEvent !== false
    const holdForCeremony = opts?.holdForCeremony === true

    if (!this._currentSeason) return null

    this._currentSeason.completed = true
    const s = this._currentSeason

    const rankings = leaderboardManager.getRankings()
    const totalSeasonXP = rankings.reduce((acc, e) => acc + e.seasonXP, 0)
    const questsDone = s.questsCompletedThisSeason ?? 0
    const summaryLine = `${s.name} Season Complete — ${questsDone} quests, ${totalSeasonXP} XP`

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

    const endedPayload: SeasonEndedEventPayload = {
      seasonId: s.id,
      seasonName: s.name,
      theme: s.theme,
      accentColor: s.accentColor,
      score: s.score,
      questsCompletedThisSeason: questsDone,
      totalSeasonXP,
      summaryLine,
    }

    if (holdForCeremony) {
      this._endedSeasonDisplay = this._cloneSeasonSnapshot(s)
      this._rolloverPending = true
    }

    this._currentSeason = null
    this.save()

    if (emitEvent) {
      EventBus.emit(
        EVENTS.NOTIFICATION,
        `Season "${s.name}" ended! Score: ${s.score}`,
        'info',
      )
      EventBus.emit(EVENTS.SEASON_ENDED, endedPayload)
    }

    return history
  }

  trackQuestCompleted(): void {
    if (!this._currentSeason) return
    this._currentSeason.questsCompletedThisSeason =
      (this._currentSeason.questsCompletedThisSeason ?? 0) + 1
    this.save()
  }

  private _cloneSeasonSnapshot(season: Season): Season {
    return {
      ...season,
      challenges: season.challenges.map(c => ({ ...c })),
    }
  }

  private _activateNewSeason(
    templateIndex: number | undefined,
    started: { skipIntroCelebration: boolean },
  ): Season {
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
      questsCompletedThisSeason: 0,
      completed: false,
      rewardDescription: template.rewardDescription,
    }

    this._currentSeason = season
    this._noFailureDays = 0
    this._lastFailureDate = null
    this.save()

    const startedPayload: SeasonStartedEventPayload = {
      seasonId: season.id,
      seasonName: season.name,
      theme: season.theme,
      accentColor: season.accentColor,
      challenges: season.challenges.map(ch => ({
        description: ch.description,
        completed: ch.completed,
      })),
      skipIntroCelebration: started.skipIntroCelebration,
    }

    EventBus.emit(
      EVENTS.NOTIFICATION,
      `New season started: ${season.name}!`,
      'info',
    )

    EventBus.emit(EVENTS.SEASON_STARTED, startedPayload)

    return season
  }

  trackTaskCompleted(streak: number): void {
    if (!this._currentSeason) return

    this._currentSeason.score += 10
    this._updateChallenge('tasks_completed', 1)

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

  trackTaskFailed(): void {
    if (!this._currentSeason) return

    const today = new Date().toISOString().slice(0, 10)
    this._lastFailureDate = today
    this._noFailureDays = 0

    for (const ch of this._currentSeason.challenges) {
      if (ch.type === 'no_failures' && !ch.completed) {
        ch.current = 0
      }
    }

    this.save()
  }

  trackNoFailureDay(): void {
    if (!this._currentSeason) return

    const today = new Date().toISOString().slice(0, 10)
    if (this._lastFailureDate === today) return

    this._noFailureDays++
    this._updateChallenge('no_failures', 0, this._noFailureDays)
    this.save()
  }

  trackAgentLevel(_level: number): void {
    if (!this._currentSeason) return
    this._currentSeason.score += 50
    this._updateChallenge('agents_at_level', 1)
    this.save()
  }

  trackQuestDifficulty(difficulty: string): void {
    if (!this._currentSeason) return

    const isHardPlus = difficulty === 'hard' || difficulty === 'epic' || difficulty === 'legendary'
    if (isHardPlus) {
      this._updateChallenge('quest_difficulty', 1)
    }

    this.save()
  }

  trackCreditsEarned(amount: number): void {
    if (!this._currentSeason) return
    this._updateChallenge('credits_earned', amount)
    this.save()
  }

  trackMVPWin(): void {
    if (!this._currentSeason) return
    this._updateChallenge('mvp_weeks', 1)
    this.save()
  }

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

  private _ensureActiveSeason(): void {
    if (this._rolloverPending) return
    if (!this._currentSeason || this._currentSeason.completed) {
      this.startNewSeason()
    }
  }

  private _checkSeasonExpiry(): void {
    if (this._currentSeason && Date.now() > this._currentSeason.endDate) {
      this.endSeason({ emitEvent: true, holdForCeremony: true })
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

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        currentSeason: this._currentSeason,
        history: this._history,
        noFailureDays: this._noFailureDays,
        lastFailureDate: this._lastFailureDate,
        rolloverPending: this._rolloverPending,
        endedSeasonDisplay: this._endedSeasonDisplay,
      }))
    } catch { /* noop */ }
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const data = JSON.parse(raw)
      if (data.currentSeason) {
        const cs = data.currentSeason as Season
        if (typeof cs.questsCompletedThisSeason !== 'number') cs.questsCompletedThisSeason = 0
        this._currentSeason = cs
      }
      if (Array.isArray(data.history)) this._history = data.history
      if (typeof data.noFailureDays === 'number') this._noFailureDays = data.noFailureDays
      if (data.lastFailureDate) this._lastFailureDate = data.lastFailureDate
      if (data.rolloverPending === true) this._rolloverPending = true
      if (data.endedSeasonDisplay) {
        const es = data.endedSeasonDisplay as Season
        if (typeof es.questsCompletedThisSeason !== 'number') es.questsCompletedThisSeason = 0
        this._endedSeasonDisplay = es
      }
    } catch { /* corrupt — start fresh */ }
  }
}

export const seasonManager = new SeasonManager()
