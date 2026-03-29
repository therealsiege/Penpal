import { afterEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { orchestratorEvents } from '../../orchestrator'
import { evalHarness } from '../harness'
import { taskOutcomeCollector } from '../collectors/task-outcomes'

function makeTmpPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'task-outcomes-test-'))
  return path.join(dir, 'eval-outcomes.jsonl')
}

function waitForWrites(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 25))
}

const cleanupDirs: string[] = []

afterEach(() => {
  while (cleanupDirs.length > 0) {
    const dir = cleanupDirs.pop()
    if (dir) fs.rmSync(dir, { recursive: true, force: true })
  }
})

describe('TaskOutcomeCollector', { concurrency: 1 }, () => {
  it('records completed and failed outcomes from orchestrator events', async () => {
    const outcomesPath = makeTmpPath()
    cleanupDirs.push(path.dirname(outcomesPath))
    const harnessInternal = evalHarness as unknown as { outcomesPath: string }
    const previousPath = harnessInternal.outcomesPath
    harnessInternal.outcomesPath = outcomesPath

    taskOutcomeCollector.start()
    taskOutcomeCollector.start() // should not double-subscribe

    orchestratorEvents.emit('task-completed', {
      taskId: 'task-complete',
      agentId: 'agent-1',
      priority: 'high',
      durationMs: 4500,
      completedAt: Date.now(),
    })
    orchestratorEvents.emit('task-failed', {
      taskId: 'task-fail',
      agentId: 'agent-2',
      priority: 'critical',
      durationMs: 2500,
      completedAt: Date.now(),
    })

    await waitForWrites()
    taskOutcomeCollector.stop()

    const raw = fs.readFileSync(outcomesPath, 'utf-8')
    const lines = raw.split('\n').filter(Boolean).map(line => JSON.parse(line))
    assert.equal(lines.length, 2)

    const completed = lines.find(l => l.taskId === 'task-complete')
    const failed = lines.find(l => l.taskId === 'task-fail')

    assert.equal(completed.status, 'completed')
    assert.equal(completed.priority, 'high')
    assert.equal(completed.retryCount, 2)
    assert.equal(completed.duration_ms, 4500)

    assert.equal(failed.status, 'failed')
    assert.equal(failed.priority, 'critical')
    assert.equal(failed.duration_ms, 2500)

    harnessInternal.outcomesPath = previousPath
  })

  it('falls back to task data when event payload is partial', async () => {
    const outcomesPath = makeTmpPath()
    cleanupDirs.push(path.dirname(outcomesPath))
    const harnessInternal = evalHarness as unknown as { outcomesPath: string }
    const previousPath = harnessInternal.outcomesPath
    harnessInternal.outcomesPath = outcomesPath

    taskOutcomeCollector.start()
    orchestratorEvents.emit('task-failed', {
      taskId: 'fallback-task',
      agentId: 'agent-fallback',
      completedAt: Date.now(),
    })
    await waitForWrites()
    taskOutcomeCollector.stop()

    const raw = fs.readFileSync(outcomesPath, 'utf-8')
    const [line] = raw.split('\n').filter(Boolean)
    const parsed = JSON.parse(line)

    assert.equal(parsed.priority, 'normal')
    assert.equal(parsed.retryCount, 0)
    assert.ok(parsed.duration_ms >= 0)

    harnessInternal.outcomesPath = previousPath
  })
})
