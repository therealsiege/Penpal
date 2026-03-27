import { afterEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { orchestratorEvents } from '../../orchestrator'
import { evalHarness } from '../harness'
import { taskOutcomeCollector } from '../collectors/task-outcomes'
import type { TaskOutcome } from '../harness'

function makeTmpPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'task-outcomes-test-'))
  return path.join(dir, 'eval-outcomes.jsonl')
}

function readJsonl(outcomesPath: string): TaskOutcome[] {
  if (!fs.existsSync(outcomesPath)) return []
  return fs.readFileSync(outcomesPath, 'utf-8')
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as TaskOutcome)
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
    const completedTaskId = `collector-complete-${Date.now()}`
    const failedTaskId = `collector-fail-${Date.now()}`
    cleanupDirs.push(path.dirname(outcomesPath))
    const harnessInternal = evalHarness as unknown as { outcomesPath: string }
    const previousPath = harnessInternal.outcomesPath
    harnessInternal.outcomesPath = outcomesPath

    taskOutcomeCollector.start()
    taskOutcomeCollector.start() // idempotent
    orchestratorEvents.emit('task-completed', {
      taskId: completedTaskId,
      agentId: 'agent-1',
      priority: 'high',
      durationMs: 4500,
      completedAt: Date.now(),
    })
    orchestratorEvents.emit('task-failed', {
      taskId: failedTaskId,
      agentId: 'agent-2',
      priority: 'critical',
      durationMs: 2500,
      completedAt: Date.now(),
    })
    await waitForWrites()
    taskOutcomeCollector.stop()

    const lines = readJsonl(outcomesPath)
    assert.equal(lines.length, 2)

    const completed = lines.find(l => l.taskId === completedTaskId)
    const failed = lines.find(l => l.taskId === failedTaskId)
    assert.ok(completed)
    assert.ok(failed)
    assert.equal(completed.status, 'completed')
    assert.equal(completed.priority, 'high')
    assert.equal(completed.retryCount, 0)
    assert.equal(completed.duration_ms, 4500)
    assert.equal(failed.status, 'failed')
    assert.equal(failed.priority, 'critical')
    assert.equal(failed.retryCount, 0)
    assert.equal(failed.duration_ms, 2500)

    harnessInternal.outcomesPath = previousPath
  })

  it('falls back to task data when event payload is partial', async () => {
    const outcomesPath = makeTmpPath()
    const harnessInternal = evalHarness as unknown as { outcomesPath: string }
    const previousPath = harnessInternal.outcomesPath
    harnessInternal.outcomesPath = outcomesPath
    cleanupDirs.push(path.dirname(outcomesPath))
    taskOutcomeCollector.start()
    orchestratorEvents.emit('task-failed', { taskId: 'fallback-task', agentId: 'agent-fallback' })
    await waitForWrites()
    taskOutcomeCollector.stop()

    const [parsed] = readJsonl(outcomesPath)
    assert.equal(parsed.priority, 'normal')
    assert.equal(parsed.retryCount, 0)
    assert.ok(parsed.duration_ms >= 0)

    harnessInternal.outcomesPath = previousPath
  })
})
