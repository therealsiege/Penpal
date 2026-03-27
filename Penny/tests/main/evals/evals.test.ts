import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getEvalReportAll, getEvalReportAgent, getEvalStats } from '../../../src/main/evals'
import type { TaskOutcome } from '../../../src/main/evals/harness'

const readFileSync = vi.fn()
const existsSync = vi.fn()

vi.mock('fs', () => ({
  default: {
    readFileSync,
    existsSync,
  },
}))

function makeOutcome(overrides: Partial<TaskOutcome> = {}): TaskOutcome {
  const now = new Date().toISOString()
  return {
    taskId: 'task-1',
    agentId: 'agent-a',
    status: 'completed',
    priority: 'normal',
    startedAt: now,
    completedAt: now,
    retryCount: 0,
    duration_ms: 1_000,
    ...overrides,
  }
}

function toJsonl(outcomes: TaskOutcome[]): string {
  return outcomes.map((o) => JSON.stringify(o)).join('\n') + '\n'
}

describe('evals', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('report-all returns expected eval report shape', () => {
    const now = Date.now()
    const fixtures: TaskOutcome[] = [
      makeOutcome({ taskId: 'a-1', agentId: 'agent-a', status: 'completed', duration_ms: 1_000, completedAt: new Date(now - 1000).toISOString() }),
      makeOutcome({ taskId: 'a-2', agentId: 'agent-a', status: 'failed', duration_ms: 2_000, completedAt: new Date(now - 900).toISOString() }),
      makeOutcome({ taskId: 'b-1', agentId: 'agent-b', status: 'completed', duration_ms: 3_000, completedAt: new Date(now - 800).toISOString() }),
    ]

    existsSync.mockReturnValue(true)
    readFileSync.mockReturnValue(toJsonl(fixtures))

    const reports = getEvalReportAll()
    expect(reports).toHaveLength(2)
    expect(reports[0]).toMatchObject({
      agentId: 'agent-a',
      agentName: 'agent-a',
      totalTasks: 2,
      successCount: 1,
      successRate: 0.5,
      avgDurationMs: 1500,
      trend: 'flat',
    })
    expect(Array.isArray(reports[0].recentOutcomes)).toBe(true)
    expect(typeof reports[0].streak).toBe('number')
  })

  it('report-agent returns null for unknown agent and object for known agent', () => {
    const now = Date.now()
    const fixtures: TaskOutcome[] = [
      makeOutcome({ taskId: 'x-1', agentId: 'agent-x', status: 'completed', completedAt: new Date(now - 1000).toISOString() }),
      makeOutcome({ taskId: 'x-2', agentId: 'agent-x', status: 'completed', completedAt: new Date(now - 900).toISOString() }),
    ]

    existsSync.mockReturnValue(true)
    readFileSync.mockReturnValue(toJsonl(fixtures))

    const known = getEvalReportAgent('agent-x')
    expect(known).toMatchObject({
      agentId: 'agent-x',
      agentName: 'agent-x',
      totalTasks: 2,
      successRate: 1,
    })

    const unknown = getEvalReportAgent('missing-agent')
    expect(unknown).toBeNull()
  })

  it('stats returns expected numeric fields', () => {
    const now = new Date()
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - now.getDay())
    weekStart.setHours(0, 0, 0, 0)
    const fixtures: TaskOutcome[] = [
      makeOutcome({ taskId: 's-1', status: 'completed', completedAt: new Date(weekStart.getTime() - 1000).toISOString() }),
      makeOutcome({ taskId: 's-2', status: 'failed', completedAt: new Date(weekStart.getTime() + 1000).toISOString() }),
      makeOutcome({ taskId: 's-3', status: 'completed', completedAt: new Date(weekStart.getTime() + 2000).toISOString() }),
    ]

    existsSync.mockReturnValue(true)
    readFileSync.mockReturnValue(toJsonl(fixtures))

    const stats = getEvalStats()
    expect(stats.totalTasks).toBe(3)
    expect(stats.overallSuccessRate).toBeCloseTo(2 / 3)
    expect(stats.experimentVelocity).toBe(2)
    expect(typeof stats.weekStart).toBe('string')
  })
})
