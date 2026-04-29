/**
 * Unit tests for EvalHarness
 *
 * Run with: npx tsx src/main/evals/__tests__/harness.test.ts
 */

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { EvalHarness, type TaskOutcome } from '../harness'

function makeTmpPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eval-harness-test-'))
  return path.join(dir, 'eval-outcomes.jsonl')
}

function makeOutcome(overrides: Partial<TaskOutcome> = {}): TaskOutcome {
  return {
    taskId: `task-${Math.random().toString(36).slice(2, 8)}`,
    agentId: 'agent-a',
    status: 'completed',
    priority: 'normal',
    startedAt: new Date(Date.now() - 60_000).toISOString(),
    completedAt: new Date().toISOString(),
    retryCount: 0,
    duration_ms: 5000,
    ...overrides,
  }
}

describe('EvalHarness', () => {
  let tmpPath: string
  let harness: EvalHarness

  before(() => {
    tmpPath = makeTmpPath()
    harness = new EvalHarness(tmpPath)
  })

  after(() => {
    try {
      fs.rmSync(path.dirname(tmpPath), { recursive: true, force: true })
    } catch { /* ignore */ }
  })

  it('should handle empty/missing file gracefully', async () => {
    const emptyPath = makeTmpPath()
    const h = new EvalHarness(emptyPath)
    const report = await h.reportByAgent('nonexistent')
    assert.equal(report.totalTasks, 0)
    assert.equal(report.successRate, 0)
    assert.equal(report.avgDuration_ms, 0)
    assert.equal(report.currentStreak, 0)
    assert.equal(report.longestStreak, 0)
    assert.deepEqual(report.byPriority, {})
    fs.rmSync(path.dirname(emptyPath), { recursive: true, force: true })
  })

  it('should record and retrieve 50 mixed outcomes', async () => {
    const agents = ['agent-x', 'agent-y', 'agent-z']
    const priorities: TaskOutcome['priority'][] = ['critical', 'high', 'normal', 'low']
    const outcomes: TaskOutcome[] = []

    for (let i = 0; i < 50; i++) {
      const o = makeOutcome({
        agentId: agents[i % 3],
        status: i < 40 ? 'completed' : 'failed',
        priority: priorities[i % 4],
        completedAt: new Date(Date.now() + i * 1000).toISOString(),
        duration_ms: 1000 + i * 100,
      })
      outcomes.push(o)
      await harness.record(o)
    }

    const reports = await harness.reportAll()
    const totalAcrossReports = reports.reduce((sum, r) => sum + r.totalTasks, 0)
    assert.equal(totalAcrossReports, 50)
    assert.equal(reports.length, 3, 'Should have 3 agent reports')
  })

  it('should calculate success rate correctly (8/10 = 0.8)', async () => {
    const h2Path = makeTmpPath()
    const h2 = new EvalHarness(h2Path)

    for (let i = 0; i < 10; i++) {
      await h2.record(makeOutcome({
        agentId: 'rate-agent',
        status: i < 8 ? 'completed' : 'failed',
        completedAt: new Date(Date.now() + i * 1000).toISOString(),
      }))
    }

    const report = await h2.reportByAgent('rate-agent')
    assert.equal(report.totalTasks, 10)
    assert.equal(report.successRate, 0.8)
    fs.rmSync(path.dirname(h2Path), { recursive: true, force: true })
  })

  it('should track streaks across success/failure transitions', async () => {
    const h3Path = makeTmpPath()
    const h3 = new EvalHarness(h3Path)

    // Agent B: 3 completed, 1 failed, 5 completed
    // currentStreak = 5, longestStreak = 5
    const seqB: ('completed' | 'failed')[] = [
      'completed', 'completed', 'completed',
      'failed',
      'completed', 'completed', 'completed', 'completed', 'completed',
    ]
    for (let i = 0; i < seqB.length; i++) {
      await h3.record(makeOutcome({
        agentId: 'streak-b',
        status: seqB[i],
        completedAt: new Date(Date.now() + i * 1000).toISOString(),
      }))
    }

    const reportB = await h3.reportByAgent('streak-b')
    assert.equal(reportB.currentStreak, 5)
    assert.equal(reportB.longestStreak, 5)

    // Agent C: 5 completed, 1 failed, 3 completed
    // currentStreak = 3, longestStreak = 5
    const seqC: ('completed' | 'failed')[] = [
      'completed', 'completed', 'completed', 'completed', 'completed',
      'failed',
      'completed', 'completed', 'completed',
    ]
    for (let i = 0; i < seqC.length; i++) {
      await h3.record(makeOutcome({
        agentId: 'streak-c',
        status: seqC[i],
        completedAt: new Date(Date.now() + i * 1000).toISOString(),
      }))
    }

    const reportC = await h3.reportByAgent('streak-c')
    assert.equal(reportC.currentStreak, 3)
    assert.equal(reportC.longestStreak, 5)

    fs.rmSync(path.dirname(h3Path), { recursive: true, force: true })
  })

  it('should compute priority breakdown accurately', async () => {
    const h4Path = makeTmpPath()
    const h4 = new EvalHarness(h4Path)

    // 3 critical (2 pass), 2 high (1 pass), 1 normal (0 pass), 4 low (4 pass)
    const data: { priority: TaskOutcome['priority']; status: TaskOutcome['status'] }[] = [
      { priority: 'critical', status: 'completed' },
      { priority: 'critical', status: 'completed' },
      { priority: 'critical', status: 'failed' },
      { priority: 'high', status: 'completed' },
      { priority: 'high', status: 'failed' },
      { priority: 'normal', status: 'failed' },
      { priority: 'low', status: 'completed' },
      { priority: 'low', status: 'completed' },
      { priority: 'low', status: 'completed' },
      { priority: 'low', status: 'completed' },
    ]

    for (let i = 0; i < data.length; i++) {
      await h4.record(makeOutcome({
        agentId: 'prio-agent',
        priority: data[i].priority,
        status: data[i].status,
        completedAt: new Date(Date.now() + i * 1000).toISOString(),
      }))
    }

    const report = await h4.reportByAgent('prio-agent')
    assert.deepEqual(report.byPriority.critical, { total: 3, passed: 2 })
    assert.deepEqual(report.byPriority.high, { total: 2, passed: 1 })
    assert.deepEqual(report.byPriority.normal, { total: 1, passed: 0 })
    assert.deepEqual(report.byPriority.low, { total: 4, passed: 4 })

    fs.rmSync(path.dirname(h4Path), { recursive: true, force: true })
  })

  it('should sort reportAll by success rate descending with stable tie-breaks', async () => {
    const h5Path = makeTmpPath()
    const h5 = new EvalHarness(h5Path)

    // Agent with 100% success
    for (let i = 0; i < 5; i++) {
      await h5.record(makeOutcome({ agentId: 'perfect', status: 'completed' }))
    }
    // Agent with 50% success
    for (let i = 0; i < 4; i++) {
      await h5.record(makeOutcome({ agentId: 'half', status: i < 2 ? 'completed' : 'failed' }))
    }
    // Agent with 0% success
    for (let i = 0; i < 3; i++) {
      await h5.record(makeOutcome({ agentId: 'zero', status: 'failed' }))
    }

    // Another 50% agent with fewer tasks; should sort after `half`
    for (let i = 0; i < 2; i++) {
      await h5.record(makeOutcome({
        agentId: 'half-small',
        status: i < 1 ? 'completed' : 'failed',
      }))
    }
    // Same 50% and same task count as `half`; alphabetical tie-break.
    for (let i = 0; i < 4; i++) {
      await h5.record(makeOutcome({
        agentId: 'half-zulu',
        status: i < 2 ? 'completed' : 'failed',
      }))
    }

    const reports = await h5.reportAll()
    assert.equal(reports[0].agentId, 'perfect')
    assert.equal(reports[0].successRate, 1)
    assert.equal(reports[1].agentId, 'half')
    assert.equal(reports[1].successRate, 0.5)
    assert.equal(reports[2].agentId, 'half-zulu')
    assert.equal(reports[2].successRate, 0.5)
    assert.equal(reports[3].agentId, 'half-small')
    assert.equal(reports[3].successRate, 0.5)
    assert.equal(reports[4].agentId, 'zero')
    assert.equal(reports[4].successRate, 0)

    fs.rmSync(path.dirname(h5Path), { recursive: true, force: true })
  })

  it('should filter by since date', async () => {
    const h6Path = makeTmpPath()
    const h6 = new EvalHarness(h6Path)

    const oldDate = new Date('2025-01-01T00:00:00Z')
    const newDate = new Date('2026-03-01T00:00:00Z')

    await h6.record(makeOutcome({ agentId: 'time-agent', completedAt: oldDate.toISOString() }))
    await h6.record(makeOutcome({ agentId: 'time-agent', completedAt: newDate.toISOString() }))

    const allReport = await h6.reportByAgent('time-agent')
    assert.equal(allReport.totalTasks, 2)

    const filteredReport = await h6.reportByAgent('time-agent', new Date('2026-01-01'))
    assert.equal(filteredReport.totalTasks, 1)

    fs.rmSync(path.dirname(h6Path), { recursive: true, force: true })
  })

  it('should persist outcomes as JSONL (one JSON object per line)', async () => {
    const h7Path = makeTmpPath()
    const h7 = new EvalHarness(h7Path)

    await h7.record(makeOutcome({ agentId: 'jsonl-test', taskId: 'task-1' }))
    await h7.record(makeOutcome({ agentId: 'jsonl-test', taskId: 'task-2' }))

    const raw = fs.readFileSync(h7Path, 'utf-8')
    const lines = raw.split('\n').filter(l => l.trim().length > 0)
    assert.equal(lines.length, 2)

    // Each line should be valid JSON
    for (const line of lines) {
      const parsed = JSON.parse(line)
      assert.equal(typeof parsed.taskId, 'string')
      assert.equal(parsed.agentId, 'jsonl-test')
    }

    fs.rmSync(path.dirname(h7Path), { recursive: true, force: true })
  })

  it('experimentVelocity should return 0 (placeholder)', async () => {
    const velocity = await harness.experimentVelocity()
    assert.equal(velocity, 0)
  })
})
