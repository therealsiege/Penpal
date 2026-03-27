import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockEvalTaskResult } from '../../helpers/factories'

const readFileSync = vi.fn()
const existsSync = vi.fn()

vi.mock('fs', () => ({
  default: {
    readFileSync,
    existsSync,
  },
}))

import { getEvalReportAll, getEvalReportAgent, getEvalStats, type EvalTaskResult } from '../../../src/main/evals'

describe('evals', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('report-all returns expected eval report shape', () => {
    const now = Date.now()
    const fixtures: EvalTaskResult[] = [
      createMockEvalTaskResult({ taskId: 'a-1', agentId: 'agent-a', agentName: 'Agent A', success: true, durationMs: 1_000, timestamp: now - 1000 }),
      createMockEvalTaskResult({ taskId: 'a-2', agentId: 'agent-a', agentName: 'Agent A', success: false, durationMs: 2_000, timestamp: now - 900 }),
      createMockEvalTaskResult({ taskId: 'b-1', agentId: 'agent-b', agentName: 'Agent B', success: true, durationMs: 3_000, timestamp: now - 800 }),
    ]

    existsSync.mockReturnValue(true)
    readFileSync.mockReturnValue(JSON.stringify(fixtures))

    const reports = getEvalReportAll()
    expect(reports).toHaveLength(2)
    expect(reports[0]).toMatchObject({
      agentId: 'agent-a',
      agentName: 'Agent A',
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
    const fixtures: EvalTaskResult[] = [
      createMockEvalTaskResult({ taskId: 'x-1', agentId: 'agent-x', agentName: 'Agent X', success: true, timestamp: now - 1000 }),
      createMockEvalTaskResult({ taskId: 'x-2', agentId: 'agent-x', agentName: 'Agent X', success: true, timestamp: now - 900 }),
    ]

    existsSync.mockReturnValue(true)
    readFileSync.mockReturnValue(JSON.stringify(fixtures))

    const known = getEvalReportAgent('agent-x')
    expect(known).toMatchObject({
      agentId: 'agent-x',
      agentName: 'Agent X',
      totalTasks: 2,
      successRate: 1,
    })

    const unknown = getEvalReportAgent('missing-agent')
    expect(unknown).toBeNull()
  })

  it('stats returns expected numeric fields', () => {
    const now = Date.now()
    const fixtures: EvalTaskResult[] = [
      createMockEvalTaskResult({ taskId: 's-1', success: true, timestamp: now - 1000 }),
      createMockEvalTaskResult({ taskId: 's-2', success: false, timestamp: now - 900 }),
      createMockEvalTaskResult({ taskId: 's-3', success: true, timestamp: now - 800 }),
    ]

    existsSync.mockReturnValue(true)
    readFileSync.mockReturnValue(JSON.stringify(fixtures))

    const stats = getEvalStats()
    expect(stats.totalTasks).toBe(3)
    expect(stats.overallSuccessRate).toBeCloseTo(2 / 3)
    expect(typeof stats.experimentVelocity).toBe('number')
    expect(typeof stats.weekStart).toBe('string')
  })
})
