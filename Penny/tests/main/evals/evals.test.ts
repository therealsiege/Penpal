import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { TaskOutcome } from '../../../src/main/evals/harness'
import { getEvalReportAll, getEvalReportAgent, getEvalStats, EVAL_OUTCOMES_FILE } from '../../../src/main/evals'

const { readFileSync, existsSync } = vi.hoisted(() => ({
  readFileSync: vi.fn(),
  existsSync: vi.fn(),
}))

vi.mock('fs', () => ({
  default: {
    readFileSync,
    existsSync,
  },
  readFileSync,
  existsSync,
}))

function outcome(overrides: Partial<TaskOutcome> & Pick<TaskOutcome, 'taskId' | 'agentId' | 'status'>): TaskOutcome {
  const now = new Date().toISOString()
  return {
    priority: 'normal',
    startedAt: now,
    completedAt: now,
    retryCount: 0,
    duration_ms: 1000,
    ...overrides,
  }
}

function asJsonl(rows: TaskOutcome[]): string {
  return rows.map((r) => JSON.stringify(r)).join('\n')
}

describe('evals (eval-outcomes.jsonl)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('report-all aggregates by agent', () => {
    const t = Date.now()
    const lines = asJsonl([
      outcome({
        taskId: 'a-1',
        agentId: 'agent-a',
        status: 'completed',
        duration_ms: 1_000,
        completedAt: new Date(t - 1000).toISOString(),
      }),
      outcome({
        taskId: 'a-2',
        agentId: 'agent-a',
        status: 'failed',
        duration_ms: 2_000,
        completedAt: new Date(t - 900).toISOString(),
      }),
      outcome({
        taskId: 'b-1',
        agentId: 'agent-b',
        status: 'completed',
        duration_ms: 3_000,
        completedAt: new Date(t - 800).toISOString(),
      }),
    ])
    existsSync.mockImplementation((p: string) => p === EVAL_OUTCOMES_FILE)
    readFileSync.mockReturnValue(lines)

    const reports = getEvalReportAll()
    expect(reports).toHaveLength(2)
    const agentA = reports.find((r) => r.agentId === 'agent-a')
    expect(agentA).toMatchObject({
      agentId: 'agent-a',
      agentName: 'agent-a',
      totalTasks: 2,
      successCount: 1,
      successRate: 0.5,
      avgDurationMs: 1500,
      trend: 'flat',
    })
  })

  it('report-agent returns null for unknown agent and object for known agent', () => {
    const t = Date.now()
    const lines = asJsonl([
      outcome({
        taskId: 'x-1',
        agentId: 'agent-x',
        status: 'completed',
        completedAt: new Date(t - 1000).toISOString(),
      }),
      outcome({
        taskId: 'x-2',
        agentId: 'agent-x',
        status: 'completed',
        completedAt: new Date(t - 900).toISOString(),
      }),
    ])
    existsSync.mockImplementation((p: string) => p === EVAL_OUTCOMES_FILE)
    readFileSync.mockReturnValue(lines)

    const known = getEvalReportAgent('agent-x')
    expect(known).toMatchObject({
      agentId: 'agent-x',
      agentName: 'agent-x',
      totalTasks: 2,
      successRate: 1,
    })

    expect(getEvalReportAgent('missing-agent')).toBeNull()
  })

  it('stats returns expected numeric fields', () => {
    const now = new Date()
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - now.getDay())
    weekStart.setHours(0, 0, 0, 0)

    const lines = asJsonl([
      outcome({
        taskId: 's-1',
        agentId: 'a1',
        status: 'completed',
        completedAt: new Date(weekStart.getTime() - 1000).toISOString(),
      }),
      outcome({
        taskId: 's-2',
        agentId: 'a2',
        status: 'failed',
        completedAt: new Date(weekStart.getTime() + 1000).toISOString(),
      }),
      outcome({
        taskId: 's-3',
        agentId: 'a3',
        status: 'completed',
        completedAt: new Date(weekStart.getTime() + 2000).toISOString(),
      }),
    ])
    existsSync.mockImplementation((p: string) => p === EVAL_OUTCOMES_FILE)
    readFileSync.mockReturnValue(lines)

    const stats = getEvalStats()
    expect(stats.totalTasks).toBe(3)
    expect(stats.overallSuccessRate).toBeCloseTo(2 / 3)
    expect(stats.experimentVelocity).toBe(2)
    expect(typeof stats.weekStart).toBe('string')
  })
})
