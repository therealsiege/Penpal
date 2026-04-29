// @vitest-environment jsdom

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

import { QuestSystem, type QuestStats } from '../../../src/renderer/src/game/quest-system'

const KEYS = {
  quests: 'penpal:quests',
} as const

describe('QuestSystem.getQuestStats', () => {
  beforeEach(() => {
    localStorage.removeItem(KEYS.quests)
  })

  afterEach(() => {
    localStorage.removeItem(KEYS.quests)
  })

  it('returns zeroed stats when no quests exist', () => {
    const qs = new QuestSystem()
    const stats = qs.getQuestStats()
    expect(stats.totalCompleted).toBe(0)
    expect(stats.xpEarnedToday).toBe(0)
    expect(stats.averageDifficulty).toBe(0)
    expect(stats.longestStreak).toBe(0)
  })

  it('counts only completed quests (not failed)', () => {
    const qs = new QuestSystem()
    const q1 = qs.startQuest({ title: 'A', agentId: 'a1' })
    const q2 = qs.startQuest({ title: 'B', agentId: 'a2' })
    const q3 = qs.startQuest({ title: 'C', agentId: 'a3' })
    qs.completeQuest(q1.id)
    qs.failQuest(q2.id)
    qs.completeQuest(q3.id)

    const stats = qs.getQuestStats()
    expect(stats.totalCompleted).toBe(2)
  })

  it('sums XP earned today for completed quests', () => {
    const qs = new QuestSystem()
    // Both quests completed "now" — within today
    const q1 = qs.startQuest({ title: 'X', agentId: 'a1' })        // normal: 150 XP
    const q2 = qs.startQuest({ title: 'Y', agentId: 'a2', priority: 'high' }) // hard: 200 XP
    qs.completeQuest(q1.id)
    qs.completeQuest(q2.id)

    const stats = qs.getQuestStats()
    expect(stats.xpEarnedToday).toBe(150 + 200)
  })

  it('computes average difficulty correctly', () => {
    const qs = new QuestSystem()
    // normal=2, hard=3 → average = 2.5
    const q1 = qs.startQuest({ title: 'N', agentId: 'a1' })                    // normal
    const q2 = qs.startQuest({ title: 'H', agentId: 'a2', priority: 'high' })   // hard
    qs.completeQuest(q1.id)
    qs.completeQuest(q2.id)

    const stats = qs.getQuestStats()
    expect(stats.averageDifficulty).toBe(2.5)
  })

  it('computes longest streak (ignoring failures)', () => {
    const qs = new QuestSystem()
    // Pattern: complete, complete, fail, complete, complete, complete
    // Longest streak = 3 (the last three)
    const quests = Array.from({ length: 6 }, (_, i) =>
      qs.startQuest({ title: `Q${i}`, agentId: `a${i}` }),
    )
    qs.completeQuest(quests[0].id)
    qs.completeQuest(quests[1].id)
    qs.failQuest(quests[2].id)
    qs.completeQuest(quests[3].id)
    qs.completeQuest(quests[4].id)
    qs.completeQuest(quests[5].id)

    const stats = qs.getQuestStats()
    expect(stats.longestStreak).toBe(3)
  })

  it('streak of all completed quests', () => {
    const qs = new QuestSystem()
    for (let i = 0; i < 5; i++) {
      const q = qs.startQuest({ title: `Q${i}`, agentId: `a${i}` })
      qs.completeQuest(q.id)
    }
    expect(qs.getQuestStats().longestStreak).toBe(5)
  })

  it('streak is 0 when all quests failed', () => {
    const qs = new QuestSystem()
    for (let i = 0; i < 3; i++) {
      const q = qs.startQuest({ title: `Q${i}`, agentId: `a${i}` })
      qs.failQuest(q.id)
    }
    expect(qs.getQuestStats().longestStreak).toBe(0)
  })

  it('excludes yesterday XP from xpEarnedToday', () => {
    // Seed localStorage with a quest that completed yesterday
    const yesterday = Date.now() - 86400_000 * 2
    const oldQuestData = {
      active: [],
      completed: [{
        id: 'old-quest',
        title: 'Old',
        agentId: 'a',
        difficulty: 'normal',
        status: 'completed',
        xpReward: 150,
        creditReward: 75,
        startedAt: yesterday - 1000,
        completedAt: yesterday,
        durationMs: 1000,
      }],
    }
    localStorage.setItem(KEYS.quests, JSON.stringify(oldQuestData))
    const qs = new QuestSystem()

    // Complete a new quest today
    const q = qs.startQuest({ title: 'Today', agentId: 'a1' })
    qs.completeQuest(q.id)

    const stats = qs.getQuestStats()
    expect(stats.totalCompleted).toBe(2)
    // Only today's quest XP
    expect(stats.xpEarnedToday).toBe(150)
  })
})

describe('QuestPanel (integration shape)', () => {
  it('QuestPanel module exports the class', async () => {
    // Verify the module is importable (no syntax/import errors)
    const mod = await import('../../../src/renderer/src/game/quest-panel')
    expect(mod.QuestPanel).toBeDefined()
    expect(typeof mod.QuestPanel).toBe('function')
  })
})
