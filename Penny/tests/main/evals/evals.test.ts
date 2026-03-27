<<<<<<< issue-3-create-basic-eval-harness-with-task-pass
import { describe, it, expect } from 'vitest'

describe('evals', () => {
  it('smoke test', () => {
    expect(true).toBe(true)
=======
import fs from 'fs'
import fsp from 'fs/promises'
import path from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  EVAL_OUTCOMES_FILE,
  getEvalReportAgent,
  getEvalReportAll,
  getEvalStats,
} from '../../../src/main/evals'
import type { TaskOutcome } from '../../../src/main/evals/harness'

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

async function writeOutcomes(outcomes: TaskOutcome[]): Promise<void> {
  const content = outcomes.map((o) => JSON.stringify(o)).join('\n')
  await fsp.mkdir(path.dirname(EVAL_OUTCOMES_FILE), { recursive: true })
  await fsp.writeFile(EVAL_OUTCOMES_FILE, content.length > 0 ? `${content}\n` : '', 'utf-8')
}

describe('evals', () => {
  let previous: string | null = null

  beforeEach(async () => {
    if (fs.existsSync(EVAL_OUTCOMES_FILE)) {
      previous = await fsp.readFile(EVAL_OUTCOMES_FILE, 'utf-8')
    } else {
      previous = null
    }
    await writeOutcomes([])
  })

  afterEach(async () => {
    if (previous === null) {
      await fsp.rm(EVAL_OUTCOMES_FILE, { force: true })
    } else {
      await fsp.writeFile(EVAL_OUTCOMES_FILE, previous, 'utf-8')
    }
  })

  it('report-all returns expected eval report shape', async () => {
    const now = Date.now()
    await writeOutcomes([
      makeOutcome({ taskId: 'a-1', agentId: 'agent-a', status: 'completed', duration_ms: 1_000, completedAt: new Date(now - 1000).toISOString() }),
      makeOutcome({ taskId: 'a-2', agentId: 'agent-a', status: 'failed', duration_ms: 2_000, completedAt: new Date(now - 900).toISOString() }),
      makeOutcome({ taskId: 'b-1', agentId: 'agent-b', status: 'completed', duration_ms: 3_000, completedAt: new Date(now - 800).toISOString() }),
    ])

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
  })

  it('report-agent returns null for unknown agent and object for known agent', async () => {
    const now = Date.now()
    await writeOutcomes([
      makeOutcome({ taskId: 'x-1', agentId: 'agent-x', status: 'completed', completedAt: new Date(now - 1000).toISOString() }),
      makeOutcome({ taskId: 'x-2', agentId: 'agent-x', status: 'completed', completedAt: new Date(now - 900).toISOString() }),
    ])

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

  it('stats returns expected numeric fields', async () => {
    const now = new Date()
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - now.getDay())
    weekStart.setHours(0, 0, 0, 0)

    await writeOutcomes([
      makeOutcome({ taskId: 's-1', status: 'completed', completedAt: new Date(weekStart.getTime() - 1000).toISOString() }),
      makeOutcome({ taskId: 's-2', status: 'failed', completedAt: new Date(weekStart.getTime() + 1000).toISOString() }),
      makeOutcome({ taskId: 's-3', status: 'completed', completedAt: new Date(weekStart.getTime() + 2000).toISOString() }),
    ])

    const stats = getEvalStats()
    expect(stats.totalTasks).toBe(3)
    expect(stats.overallSuccessRate).toBeCloseTo(2 / 3)
    expect(stats.experimentVelocity).toBe(2)
>>>>>>> local
  })
})
