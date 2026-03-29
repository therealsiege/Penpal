// @vitest-environment jsdom
// Time: fake timers for leaderboard MVP (stable ISO week / calendar window) and season expiry;
// Date.now() advanced where needed for unique quest ids / no_failure day boundaries.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('phaser', () => ({
  default: { Math: {}, GameObjects: {} },
  Math: {},
  GameObjects: {},
}))

vi.mock('../../../src/renderer/src/game/events', async importOriginal => {
  const mod = await importOriginal<typeof import('../../../src/renderer/src/game/events')>()
  return {
    ...mod,
    EventBus: {
      ...mod.EventBus,
      emit: vi.fn(),
    },
  }
})

import type { Season, SeasonHistory } from '../../../src/renderer/src/game/seasons'
import { CreditManager } from '../../../src/renderer/src/game/credits'
import { LeaderboardManager } from '../../../src/renderer/src/game/leaderboard'
import { inferDifficulty, QuestSystem } from '../../../src/renderer/src/game/quest-system'
import { SeasonManager } from '../../../src/renderer/src/game/seasons'

const KEYS = {
  quests: 'penpal:quests',
  leaderboard: 'penpal:leaderboard',
  seasons: 'penpal:seasons',
  credits: 'penpal:credits',
} as const

function seasonShell(overrides: Partial<Season> & { challenges: Season['challenges'] }): Season {
  const now = Date.now()
  return {
    id: 'season-test',
    name: 'Test Season',
    theme: 'test',
    accentColor: 0x111111,
    accentColorCSS: '#111111',
    startDate: now - 86400000,
    endDate: now + 86400000 * 29,
    durationDays: 30,
    score: 0,
    completed: false,
    ...overrides,
  }
}

function writeSeasonsState(payload: {
  currentSeason: Season | null
  history?: SeasonHistory[]
  noFailureDays?: number
  lastFailureDate?: string | null
}): void {
  localStorage.setItem(
    KEYS.seasons,
    JSON.stringify({
      currentSeason: payload.currentSeason,
      history: payload.history ?? [],
      noFailureDays: payload.noFailureDays ?? 0,
      lastFailureDate: payload.lastFailureDate ?? null,
    }),
  )
}

describe('inferDifficulty', () => {
  it('returns legendary for very long tasks (>30 min)', () => {
    expect(inferDifficulty({ estimatedDurationMin: 31 })).toBe('legendary')
  })

  it('returns legendary for 3+ agent pods', () => {
    expect(inferDifficulty({ isPod: true, agentCount: 3 })).toBe('legendary')
  })

  it('returns epic for 2-agent pods', () => {
    expect(inferDifficulty({ isPod: true, agentCount: 2 })).toBe('epic')
  })

  it('returns epic for critical priority', () => {
    expect(inferDifficulty({ priority: 'critical' })).toBe('epic')
  })

  it('returns hard for high priority', () => {
    expect(inferDifficulty({ priority: 'high' })).toBe('hard')
  })

  it('returns trivial for low priority', () => {
    expect(inferDifficulty({ priority: 'low' })).toBe('trivial')
  })

  it('returns normal by default', () => {
    expect(inferDifficulty({})).toBe('normal')
  })
})

describe('QuestSystem', () => {
  beforeEach(() => {
    localStorage.removeItem(KEYS.quests)
  })

  const rewards: Record<
    string,
    { xp: number; credits: number }
  > = {
    trivial: { xp: 100, credits: 50 },
    normal: { xp: 150, credits: 75 },
    hard: { xp: 200, credits: 100 },
    epic: { xp: 300, credits: 150 },
    legendary: { xp: 500, credits: 250 },
  }

  it('startQuest infers difficulty and sets xp/credit rewards from multipliers', () => {
    const qs = new QuestSystem()
    const cases: { opts: Parameters<QuestSystem['startQuest']>[0]; difficulty: keyof typeof rewards }[] = [
      { opts: { title: 't', agentId: 'a', priority: 'low' }, difficulty: 'trivial' },
      { opts: { title: 'n', agentId: 'a' }, difficulty: 'normal' },
      { opts: { title: 'h', agentId: 'a', priority: 'high' }, difficulty: 'hard' },
      { opts: { title: 'e', agentId: 'a', priority: 'critical' }, difficulty: 'epic' },
      { opts: { title: 'l', agentId: 'a', isPod: true, agentCount: 3 }, difficulty: 'legendary' },
    ]
    for (const { opts, difficulty } of cases) {
      const q = qs.startQuest(opts)
      expect(q.difficulty).toBe(difficulty)
      expect(q.xpReward).toBe(rewards[difficulty].xp)
      expect(q.creditReward).toBe(rewards[difficulty].credits)
      qs.completeQuest(q.id)
    }
  })

  it('completeQuest returns xp/credits, removes from active, logs completed', () => {
    const qs = new QuestSystem()
    const q = qs.startQuest({ title: 'Do thing', agentId: 'agent-1', priority: 'high' })
    const result = qs.completeQuest(q.id)
    expect(result).toEqual({ xp: q.xpReward, credits: q.creditReward })
    expect(qs.getActiveQuests()).toHaveLength(0)
    const done = qs.getCompletedQuests()
    expect(done[0]?.status).toBe('completed')
    expect(done[0]?.id).toBe(q.id)
  })

  it('failQuest marks failed, moves to log, does not grant xp via completeQuest', () => {
    const qs = new QuestSystem()
    const q = qs.startQuest({ title: 'Risky', agentId: 'a2' })
    qs.failQuest(q.id)
    expect(qs.getActiveQuests()).toHaveLength(0)
    const done = qs.getCompletedQuests()
    expect(done[0]?.status).toBe('failed')
    expect(qs.completeQuest(q.id)).toBeNull()
  })

  it('caps completed log at 50 entries (drops oldest)', () => {
    localStorage.removeItem(KEYS.quests)
    const qs = new QuestSystem()
    const ids: string[] = []
    for (let i = 0; i < 51; i++) {
      const q = qs.startQuest({ title: `q${i}`, agentId: 'x' })
      ids.push(q.id)
      qs.completeQuest(q.id)
    }
    const log = qs.getCompletedQuests()
    expect(log).toHaveLength(50)
    expect(log.some(q => q.id === ids[0])).toBe(false)
    expect(log[0]?.title).toBe('q50')
  })
})

describe('LeaderboardManager', () => {
  beforeEach(() => {
    localStorage.removeItem(KEYS.leaderboard)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('recordXP produces rankings sorted by seasonXP descending with ranks 1..n', () => {
    const lb = new LeaderboardManager()
    lb.recordXP('c', 'C', 10, 1, 'Intern')
    lb.recordXP('a', 'A', 100, 2, 'Dev')
    lb.recordXP('b', 'B', 50, 1, 'Intern')
    const r = lb.getRankings()
    expect(r.map(x => x.agentId)).toEqual(['a', 'b', 'c'])
    expect(r.map(x => x.rank)).toEqual([1, 2, 3])
    expect(r[0]?.seasonXP).toBe(100)
  })

  it('getWeeklyMVP returns top performer for current ISO week (fake clock)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 2, 15, 12, 0, 0))
    const lb = new LeaderboardManager()
    lb.recordXP('slow', 'Slow', 10, 1, 'Intern')
    lb.recordXP('star', 'Star', 80, 2, 'Dev')
    const mvp = lb.getWeeklyMVP()
    expect(mvp).not.toBeNull()
    expect(mvp!.agentId).toBe('star')
    expect(mvp!.weekXP).toBe(80)
    expect(mvp!.weekEnd).toBeGreaterThan(mvp!.weekStart)
  })

  it('getRivalries includes pairs within 5% XP and excludes wider gaps', () => {
    const lb = new LeaderboardManager()
    lb.recordXP('p1', 'One', 100, 1, 'Intern')
    lb.recordXP('p2', 'Two', 97, 1, 'Intern')
    lb.recordXP('p3', 'Three', 80, 1, 'Intern')
    const riv = lb.getRivalries()
    expect(lb.hasRivalry('p1', 'p2')).toBe(true)
    expect(riv.some(r => r.percentDiff <= 0.05 && ((r.agent1Id === 'p1' && r.agent2Id === 'p2') || (r.agent1Id === 'p2' && r.agent2Id === 'p1')))).toBe(true)
    expect(lb.hasRivalry('p1', 'p3')).toBe(false)
  })

  it('resetSeason clears rankings, rivalries, and weekly MVP', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 2, 10, 10, 0, 0))
    const lb = new LeaderboardManager()
    lb.recordXP('x', 'X', 40, 1, 'Intern')
    expect(lb.getRankings().length).toBeGreaterThan(0)
    expect(lb.getWeeklyMVP()).not.toBeNull()
    lb.resetSeason()
    expect(lb.getRankings()).toHaveLength(0)
    expect(lb.getRivalries()).toHaveLength(0)
    expect(lb.getWeeklyMVP()).toBeNull()
  })
})

describe('SeasonManager', () => {
  beforeEach(() => {
    localStorage.removeItem(KEYS.seasons)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it.each([
    [0, 'Neon Sprint', 'neon'],
    [1, 'Deep Focus', 'focus'],
    [2, 'Ship It', 'ship'],
    [3, 'Blitz Mode', 'blitz'],
  ] as const)('startNewSeason picks template %i (%s)', (idx, name, theme) => {
    writeSeasonsState({ currentSeason: null })
    vi.spyOn(Math, 'random').mockReturnValue((idx + 0.1) / 4)
    const sm = new SeasonManager()
    sm.endSeason()
    const s = sm.startNewSeason()
    expect(s.name).toBe(name)
    expect(s.theme).toBe(theme)
  })

  it('auto-starts from template when storage empty (_ensureActiveSeason)', () => {
    localStorage.removeItem(KEYS.seasons)
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const sm = new SeasonManager()
    const cur = sm.getCurrentSeason()
    expect(cur).not.toBeNull()
    expect(cur!.name).toBe('Neon Sprint')
  })

  it('expires past endDate and rotates on getCurrentSeason', () => {
    const pastEnd = Date.now() - 86400000
    const pastStart = pastEnd - 86400000 * 5
    writeSeasonsState({
      currentSeason: seasonShell({
        id: 'season-old',
        endDate: pastEnd,
        startDate: pastStart,
        challenges: [
          {
            id: 'ch-0',
            description: 'x',
            target: 99,
            current: 0,
            completed: false,
            type: 'tasks_completed',
          },
        ],
      }),
    })
    vi.spyOn(Math, 'random').mockReturnValue(0.55)
    const sm = new SeasonManager()
    const next = sm.getCurrentSeason()
    expect(next).not.toBeNull()
    expect(next!.endDate).toBeGreaterThan(Date.now())
    expect(next!.id).not.toBe('season-old')
    const hist = sm.getHistory()
    expect(hist.length).toBeGreaterThanOrEqual(1)
    expect(hist[0]?.seasonId).toBe('season-old')
  })

  it('trackTaskCompleted adds +10 score and completes tasks_completed challenge', () => {
    writeSeasonsState({
      currentSeason: seasonShell({
        challenges: [
          {
            id: 't1',
            description: 'one task',
            target: 1,
            current: 0,
            completed: false,
            type: 'tasks_completed',
          },
        ],
      }),
    })
    const sm = new SeasonManager()
    sm.trackTaskCompleted(0)
    const s = sm.getCurrentSeason()!
    expect(s.score).toBe(10 + 100)
    const ch = s.challenges.find(c => c.type === 'tasks_completed')
    expect(ch?.completed).toBe(true)
  })

  it('trackAgentLevel adds +50 score and advances agents_at_level', () => {
    writeSeasonsState({
      currentSeason: seasonShell({
        challenges: [
          {
            id: 'a1',
            description: 'agents',
            target: 2,
            current: 0,
            completed: false,
            type: 'agents_at_level',
          },
        ],
      }),
    })
    const sm = new SeasonManager()
    sm.trackAgentLevel(5)
    expect(sm.getCurrentSeason()!.score).toBe(50)
    sm.trackAgentLevel(5)
    const s = sm.getCurrentSeason()!
    expect(s.score).toBe(100 + 100)
    expect(s.challenges[0]?.completed).toBe(true)
  })

  it('trackTaskCompleted updates streak challenge to max streak', () => {
    writeSeasonsState({
      currentSeason: seasonShell({
        challenges: [
          {
            id: 's1',
            description: 'streak',
            target: 3,
            current: 0,
            completed: false,
            type: 'streak',
          },
        ],
      }),
    })
    const sm = new SeasonManager()
    sm.trackTaskCompleted(2)
    expect(sm.getCurrentSeason()!.challenges[0]?.current).toBe(2)
    sm.trackTaskCompleted(4)
    const ch = sm.getCurrentSeason()!.challenges[0]
    expect(ch?.current).toBe(4)
    expect(ch?.completed).toBe(true)
  })

  it('trackQuestDifficulty counts hard/epic/legendary for quest_difficulty', () => {
    writeSeasonsState({
      currentSeason: seasonShell({
        challenges: [
          {
            id: 'q1',
            description: 'hard+',
            target: 2,
            current: 0,
            completed: false,
            type: 'quest_difficulty',
          },
        ],
      }),
    })
    const sm = new SeasonManager()
    sm.trackQuestDifficulty('easy')
    expect(sm.getCurrentSeason()!.challenges[0]?.current).toBe(0)
    sm.trackQuestDifficulty('hard')
    sm.trackQuestDifficulty('legendary')
    const ch = sm.getCurrentSeason()!.challenges[0]
    expect(ch?.current).toBe(2)
    expect(ch?.completed).toBe(true)
  })

  it('trackCreditsEarned completes credits_earned challenge', () => {
    writeSeasonsState({
      currentSeason: seasonShell({
        challenges: [
          {
            id: 'cr',
            description: 'earn',
            target: 100,
            current: 0,
            completed: false,
            type: 'credits_earned',
          },
        ],
      }),
    })
    const sm = new SeasonManager()
    sm.trackCreditsEarned(40)
    sm.trackCreditsEarned(60)
    expect(sm.getCurrentSeason()!.challenges[0]?.completed).toBe(true)
  })

  it('trackMVPWin completes mvp_weeks challenge', () => {
    writeSeasonsState({
      currentSeason: seasonShell({
        challenges: [
          {
            id: 'm1',
            description: 'mvp',
            target: 2,
            current: 0,
            completed: false,
            type: 'mvp_weeks',
          },
        ],
      }),
    })
    const sm = new SeasonManager()
    sm.trackMVPWin()
    sm.trackMVPWin()
    expect(sm.getCurrentSeason()!.challenges[0]?.completed).toBe(true)
  })

  it('trackTaskFailed resets no_failures progress; trackNoFailureDay advances it', () => {
    writeSeasonsState({
      currentSeason: seasonShell({
        challenges: [
          {
            id: 'nf',
            description: 'no fail',
            target: 2,
            current: 0,
            completed: false,
            type: 'no_failures',
          },
        ],
      }),
    })
    const sm = new SeasonManager()
    sm.trackNoFailureDay()
    sm.trackNoFailureDay()
    expect(sm.getCurrentSeason()!.challenges[0]?.completed).toBe(true)

    localStorage.removeItem(KEYS.seasons)
    writeSeasonsState({
      currentSeason: seasonShell({
        challenges: [
          {
            id: 'nf2',
            description: 'no fail',
            target: 2,
            current: 0,
            completed: false,
            type: 'no_failures',
          },
        ],
      }),
    })
    const sm2 = new SeasonManager()
    sm2.trackNoFailureDay()
    expect(sm2.getCurrentSeason()!.challenges[0]?.current).toBe(1)
    sm2.trackTaskFailed()
    expect(sm2.getCurrentSeason()!.challenges[0]?.current).toBe(0)
  })

})

describe('CreditManager', () => {
  beforeEach(() => {
    localStorage.removeItem(KEYS.credits)
  })

  it('earn increases balance and totalEarned', () => {
    const cm = new CreditManager()
    cm.earn(120)
    expect(cm.getBalance()).toBe(120)
    expect(cm.getTotalEarned()).toBe(120)
  })

  it('purchase deducts balance, records spend and ownership; rejects unknown, broke, duplicate', () => {
    const cm = new CreditManager()
    expect(cm.purchase('not_a_real_item')).toBe(false)
    cm.earn(40)
    expect(cm.purchase('desk_blue')).toBe(false)
    cm.earn(200)
    expect(cm.purchase('desk_blue')).toBe(true)
    expect(cm.getBalance()).toBe(190)
    expect(cm.getAccount().totalSpent).toBe(50)
    expect(cm.isOwned('desk_blue')).toBe(true)
    expect(cm.purchase('desk_blue')).toBe(false)
  })

  it('equip / getEquipped round-trip for purchased catalog item', () => {
    const cm = new CreditManager()
    cm.earn(500)
    expect(cm.purchase('name_cyan')).toBe(true)
    expect(cm.equip('agent-z', 'name_cyan')).toBe(true)
    const equipped = cm.getEquipped('agent-z', 'name_color')
    expect(equipped?.id).toBe('name_cyan')
  })

  it('getCatalog items are valid shop entries', () => {
    const cm = new CreditManager()
    const catalog = cm.getCatalog()
    const categories = new Set(['room_theme', 'desk_color', 'particle_effect', 'name_color'])
    const ids = new Set<string>()
    for (const item of catalog) {
      expect(item.id.length).toBeGreaterThan(0)
      expect(ids.has(item.id)).toBe(false)
      ids.add(item.id)
      expect(item.price).toBeGreaterThan(0)
      expect(categories.has(item.category)).toBe(true)
      expect(item.name.length).toBeGreaterThan(0)
      expect(item.value.length).toBeGreaterThan(0)
      expect(typeof item.previewFrame).toBe('number')
      expect(item.description.length).toBeGreaterThan(0)
    }
  })
})
