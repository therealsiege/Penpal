/**
 * Unit tests for SpotCheckQueue (human judge)
 *
 * Run with: npx tsx src/main/evals/__tests__/human-judge.test.ts
 */

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'fs'
import path from 'path'
import os from 'os'
import type { Task } from '../../orchestrator'
import { SpotCheckQueue, type SpotCheck } from '../judges/human-judge'

function makeTmpPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spot-check-test-'))
  return path.join(dir, 'spot-checks.json')
}

function makeSpotCheck(overrides: Partial<SpotCheck> = {}): SpotCheck {
  return {
    id: `sc-${Math.random().toString(36).slice(2, 8)}`,
    taskId: `task-${Math.random().toString(36).slice(2, 8)}`,
    agentId: 'agent-a',
    taskDescription: 'Test task description',
    agentOutput: 'Task completed successfully',
    automatedScore: 1.0,
    sampledAt: new Date().toISOString(),
    ...overrides,
  }
}

function seedQueue(filePath: string, checks: SpotCheck[]): void {
  fs.writeFileSync(filePath, JSON.stringify(checks, null, 2), 'utf-8')
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: `task-${Math.random().toString(36).slice(2, 8)}`,
    title: 'Test task title',
    description: 'Test task description',
    project: '/tmp/project',
    priority: 'normal',
    status: 'completed',
    requiredSkills: [],
    source: 'dashboard',
    createdAt: Date.now() - 10_000,
    completedAt: Date.now() - 5_000,
    retryCount: 0,
    maxRetries: 1,
    result: 'Agent output',
    ...overrides,
  }
}

describe('SpotCheckQueue', () => {
  let tmpPath: string
  let queue: SpotCheckQueue

  before(() => {
    tmpPath = makeTmpPath()
    queue = new SpotCheckQueue(tmpPath)
  })

  after(() => {
    try {
      fs.rmSync(path.dirname(tmpPath), { recursive: true, force: true })
    } catch { /* ignore */ }
  })

  it('should return empty pending list when no checks exist', async () => {
    const pending = await queue.getPending()
    assert.equal(pending.length, 0)
  })

  it('should return all seeded checks as pending', async () => {
    const checks = [makeSpotCheck(), makeSpotCheck(), makeSpotCheck()]
    seedQueue(tmpPath, checks)
    const q = new SpotCheckQueue(tmpPath)
    const pending = await q.getPending()
    assert.equal(pending.length, 3)
    // All should be unique by id
    const ids = new Set(pending.map(p => p.id))
    assert.equal(ids.size, 3)
  })

  it('should update spot check with review verdict and notes', async () => {
    const p = makeTmpPath()
    const checks = [makeSpotCheck({ id: 'review-test-1' }), makeSpotCheck({ id: 'review-test-2' })]
    seedQueue(p, checks)
    const q = new SpotCheckQueue(p)

    await q.review('review-test-1', 'pass', 'Looks good')

    // Reload from disk
    const q2 = new SpotCheckQueue(p)
    const all = await q2.getQueue()
    const reviewed = all.find(sc => sc.id === 'review-test-1')
    assert.ok(reviewed)
    assert.equal(reviewed.humanVerdict, 'pass')
    assert.equal(reviewed.humanNotes, 'Looks good')
    assert.ok(reviewed.reviewedAt)

    // Other check should remain unreviewed
    const other = all.find(sc => sc.id === 'review-test-2')
    assert.ok(other)
    assert.equal(other.humanVerdict, undefined)

    fs.rmSync(path.dirname(p), { recursive: true, force: true })
  })

  it('sampling returns requested unique count and excludes already sampled tasks', async () => {
    const now = Date.now()
    const p = makeTmpPath()
    const alreadySampledTaskId = 'task-already-sampled'
    seedQueue(p, [makeSpotCheck({ taskId: alreadySampledTaskId })])

    const tasks: Task[] = [
      makeTask({ id: alreadySampledTaskId, completedAt: now - 60_000 }),
      makeTask({ id: 'task-a', completedAt: now - 70_000 }),
      makeTask({ id: 'task-b', completedAt: now - 80_000 }),
      makeTask({ id: 'task-c', completedAt: now - 90_000 }),
      makeTask({ id: 'task-old', completedAt: now - (8 * 24 * 60 * 60 * 1000) }),
      makeTask({ id: 'task-queued', status: 'queued', completedAt: undefined }),
    ]

    const q = new SpotCheckQueue({
      filePath: p,
      taskProvider: () => tasks,
      now: () => now,
    })

    const sampled = await q.sample(3)
    assert.equal(sampled.length, 3)
    const sampledTaskIds = sampled.map(s => s.taskId)
    assert.equal(new Set(sampledTaskIds).size, 3, 'sampled tasks must be unique')
    assert.ok(!sampledTaskIds.includes(alreadySampledTaskId), 'must exclude already-sampled task')
    assert.ok(!sampledTaskIds.includes('task-old'), 'must exclude stale task outside recency window')
    assert.ok(!sampledTaskIds.includes('task-queued'), 'must exclude non-completed task status')

    const persisted = await q.getQueue()
    assert.equal(persisted.length, 4) // existing + 3 new

    fs.rmSync(path.dirname(p), { recursive: true, force: true })
  })

  it('sampling with non-positive count returns empty and does not persist', async () => {
    const p = makeTmpPath()
    const q = new SpotCheckQueue({
      filePath: p,
      taskProvider: () => [makeTask({ id: 'task-x' })],
    })

    const sampled = await q.sample(0)
    assert.deepEqual(sampled, [])
    assert.deepEqual(await q.getQueue(), [])

    fs.rmSync(path.dirname(p), { recursive: true, force: true })
  })

  it('should filter reviewed checks out of pending', async () => {
    const p = makeTmpPath()
    const checks = [
      makeSpotCheck({ id: 'pending-1' }),
      makeSpotCheck({ id: 'pending-2' }),
      makeSpotCheck({ id: 'pending-3' }),
    ]
    seedQueue(p, checks)
    const q = new SpotCheckQueue(p)

    await q.review('pending-1', 'fail')
    const pending = await q.getPending()
    assert.equal(pending.length, 2)
    assert.ok(!pending.find(sc => sc.id === 'pending-1'))

    fs.rmSync(path.dirname(p), { recursive: true, force: true })
  })

  it('should throw when reviewing non-existent spot check', async () => {
    const p = makeTmpPath()
    seedQueue(p, [])
    const q = new SpotCheckQueue(p)

    await assert.rejects(
      () => q.review('nonexistent', 'pass'),
      { message: 'Spot check nonexistent not found' },
    )

    fs.rmSync(path.dirname(p), { recursive: true, force: true })
  })

  it('should calculate agreement correctly', async () => {
    const p = makeTmpPath()
    const checks: SpotCheck[] = [
      // Automated pass (1.0), human pass => agree
      makeSpotCheck({ id: 'ag-1', automatedScore: 1.0, humanVerdict: 'pass', reviewedAt: new Date().toISOString() }),
      // Automated pass (1.0), human fail => disagree
      makeSpotCheck({ id: 'ag-2', automatedScore: 1.0, humanVerdict: 'fail', reviewedAt: new Date().toISOString() }),
      // Automated fail (0.0), human fail => agree
      makeSpotCheck({ id: 'ag-3', automatedScore: 0.0, humanVerdict: 'fail', reviewedAt: new Date().toISOString() }),
      // Automated fail (0.0), human partial => disagree (partial counts as pass-ish)
      makeSpotCheck({ id: 'ag-4', automatedScore: 0.0, humanVerdict: 'partial', reviewedAt: new Date().toISOString() }),
      // Not reviewed yet — should be excluded
      makeSpotCheck({ id: 'ag-5', automatedScore: 1.0 }),
    ]
    seedQueue(p, checks)
    const q = new SpotCheckQueue(p)

    const agreement = await q.agreement()
    assert.equal(agreement.total, 4)
    assert.equal(agreement.agreed, 2) // ag-1 and ag-3 agree
    assert.equal(agreement.rate, 0.5)

    fs.rmSync(path.dirname(p), { recursive: true, force: true })
  })

  it('agreement uses threshold and treats partial as pass for comparison', async () => {
    const p = makeTmpPath()
    const reviewedAt = new Date().toISOString()
    const checks: SpotCheck[] = [
      makeSpotCheck({ id: 'thr-1', automatedScore: 0.6, humanVerdict: 'pass', reviewedAt }), // agree
      makeSpotCheck({ id: 'thr-2', automatedScore: 0.4, humanVerdict: 'partial', reviewedAt }), // disagree
      makeSpotCheck({ id: 'thr-3', automatedScore: 0.4, humanVerdict: 'fail', reviewedAt }), // agree
    ]
    seedQueue(p, checks)
    const q = new SpotCheckQueue({ filePath: p, automatedPassThreshold: 0.5 })

    const agreement = await q.agreement()
    assert.deepEqual(agreement, { total: 3, agreed: 2, rate: 2 / 3 })

    fs.rmSync(path.dirname(p), { recursive: true, force: true })
  })

  it('should return zero agreement when no items reviewed', async () => {
    const p = makeTmpPath()
    const checks = [makeSpotCheck(), makeSpotCheck()]
    seedQueue(p, checks)
    const q = new SpotCheckQueue(p)

    const agreement = await q.agreement()
    assert.deepEqual(agreement, { total: 0, agreed: 0, rate: 0 })

    fs.rmSync(path.dirname(p), { recursive: true, force: true })
  })

  it('should handle empty file gracefully', async () => {
    const p = makeTmpPath()
    const q = new SpotCheckQueue(p)
    const all = await q.getQueue()
    assert.deepEqual(all, [])
    const pending = await q.getPending()
    assert.deepEqual(pending, [])
    const agreement = await q.agreement()
    assert.deepEqual(agreement, { total: 0, agreed: 0, rate: 0 })

    fs.rmSync(path.dirname(p), { recursive: true, force: true })
  })

  it('should persist review to disk and survive reload', async () => {
    const p = makeTmpPath()
    seedQueue(p, [makeSpotCheck({ id: 'persist-1', automatedScore: 1.0 })])
    const q1 = new SpotCheckQueue(p)
    await q1.review('persist-1', 'partial', 'Needs improvement')

    // Fresh instance from same file
    const q2 = new SpotCheckQueue(p)
    const all = await q2.getQueue()
    assert.equal(all.length, 1)
    assert.equal(all[0].humanVerdict, 'partial')
    assert.equal(all[0].humanNotes, 'Needs improvement')

    fs.rmSync(path.dirname(p), { recursive: true, force: true })
  })
})
