import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getEvalReportAll, getEvalReportAgent, getEvalStats, type EvalTaskResult } from '../../../src/main/evals'

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

describe('evals (eval-results.json)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('report-all aggregates by agent', () => {
    const t = Date.now()
    const rows: EvalTaskResult[] = [
      { taskId: 'a-1', agentId: 'agent-a', agentName: 'Agent A', success: true, durationMs: 1_000, timestamp: t - 1000 },
      { taskId: 'a-2', agentId: 'agent-a', agentName: 'Agent A', success: false, durationMs: 2_000, timestamp: t - 900 },
      { taskId: 'b-1', agentId: 'agent-b', agentName: 'Agent B', success: true, durationMs: 3_000, timestamp: t - 800 },
    ]
    existsSync.mockReturnValue(true)
    readFileSync.mockReturnValue(JSON.stringify(rows))

    const reports = getEvalReportAll()
    expect(reports).toHaveLength(2)
    const agentA = reports.find((r) => r.agentId === 'agent-a')
    expect(agentA).toMatchObject({
      agentId: 'agent-a',
      agentName: 'Agent A',
      totalTasks: 2,
      successCount: 1,
      successRate: 0.5,
    })
    expect(Array.isArray(agentA?.recentOutcomes)).toBe(true)
    expect(typeof agentA?.streak).toBe('number')
  })

  it('report-agent returns null for unknown agent', () => {
    existsSync.mockReturnValue(true)
    readFileSync.mockReturnValue(
      JSON.stringify([
        { taskId: 'x-1', agentId: 'agent-x', agentName: 'X', success: true, durationMs: 100, timestamp: Date.now() },
      ] satisfies EvalTaskResult[]),
    )
    expect(getEvalReportAgent('agent-x')).not.toBeNull()
    expect(getEvalReportAgent('missing')).toBeNull()
  })

  it('stats counts tasks and weekly velocity', () => {
    const now = Date.now()
    const rows: EvalTaskResult[] = [
      { taskId: 's-1', agentId: 'a1', agentName: 'A', success: true, durationMs: 100, timestamp: now },
      { taskId: 's-2', agentId: 'a2', agentName: 'B', success: false, durationMs: 100, timestamp: now },
      { taskId: 's-3', agentId: 'a3', agentName: 'C', success: true, durationMs: 100, timestamp: now },
    ]
    existsSync.mockReturnValue(true)
    readFileSync.mockReturnValue(JSON.stringify(rows))

    const stats = getEvalStats()
    expect(stats.totalTasks).toBe(3)
    expect(stats.overallSuccessRate).toBeCloseTo(2 / 3)
    expect(stats.experimentVelocity).toBe(3)
    expect(typeof stats.weekStart).toBe('string')
  })
})
