import { afterEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'events'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { EvalHarness, type TaskOutcome } from '../harness'
import { TaskOutcomeCollector } from '../collectors/task-outcomes'
import type { Task } from '../../orchestrator'

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

const cleanupDirs: string[] = []

afterEach(() => {
  while (cleanupDirs.length > 0) {
    const dir = cleanupDirs.pop()
    if (dir) fs.rmSync(dir, { recursive: true, force: true })
  }
})

describe('TaskOutcomeCollector', () => {
  it('records one JSONL line for completion and failure with mapped fields', async () => {
    const outcomesPath = makeTmpPath()
    cleanupDirs.push(path.dirname(outcomesPath))
    const harness = new EvalHarness(outcomesPath)
    const events = new EventEmitter()

    const startedAt = Date.now() - 12_000
    const completedAt = Date.now()
    const task: Task = {
      id: 'task-1',
      title: 'demo',
      description: 'demo',
      project: '/tmp',
      priority: 'high',
      status: 'failed',
      requiredSkills: [],
      source: 'dashboard',
      createdAt: startedAt - 1000,
      assignedAt: startedAt,
      completedAt,
      retryCount: 2,
      maxRetries: 3,
    }

    const collector = new TaskOutcomeCollector({
      events,
      harness,
      getTask: () => task,
    })

    collector.start()
    events.emit('task-completed', {
      taskId: 'task-1',
      agentId: 'agent-a',
      priority: 'critical',
      durationMs: 11_000,
      completedAt,
    })
    events.emit('task-failed', {
      taskId: 'task-1',
      agentId: 'agent-a',
      durationMs: 10_500,
      completedAt,
    })
    collector.stop()

    const rows = readJsonl(outcomesPath)
    assert.equal(rows.length, 2)
    assert.equal(rows[0].status, 'completed')
    assert.equal(rows[0].priority, 'critical')
    assert.equal(rows[0].retryCount, 2)
    assert.equal(rows[0].duration_ms, 11_000)
    assert.equal(rows[1].status, 'failed')
    assert.equal(rows[1].priority, 'high')
    assert.equal(rows[1].retryCount, 2)
    assert.equal(rows[1].duration_ms, 10_500)
  })

  it('start() is idempotent and stop() unsubscribes listeners', async () => {
    const outcomesPath = makeTmpPath()
    cleanupDirs.push(path.dirname(outcomesPath))
    const harness = new EvalHarness(outcomesPath)
    const events = new EventEmitter()

    const task: Task = {
      id: 'task-2',
      title: 'demo',
      description: 'demo',
      project: '/tmp',
      priority: 'normal',
      status: 'completed',
      requiredSkills: [],
      source: 'dashboard',
      createdAt: Date.now() - 5000,
      assignedAt: Date.now() - 4000,
      completedAt: Date.now(),
      retryCount: 0,
      maxRetries: 1,
    }

    const collector = new TaskOutcomeCollector({
      events,
      harness,
      getTask: () => task,
    })

    collector.start()
    collector.start()
    events.emit('task-completed', {
      taskId: 'task-2',
      agentId: 'agent-b',
      priority: 'normal',
      durationMs: 2500,
    })
    collector.stop()
    events.emit('task-completed', {
      taskId: 'task-2',
      agentId: 'agent-b',
      priority: 'normal',
      durationMs: 2500,
    })

    const rows = readJsonl(outcomesPath)
    assert.equal(rows.length, 1)
    assert.equal(rows[0].taskId, 'task-2')
  })
})
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { EventEmitter } from 'events'
import { TaskOutcomeCollector } from '../collectors/task-outcomes'

function makeTmpPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'task-outcomes-test-'))
  return path.join(dir, 'eval-outcomes.jsonl')
}

function waitForWrites(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 25))
}

describe('TaskOutcomeCollector', () => {
  it('records completed and failed outcomes from orchestrator events', async () => {
    const outcomesPath = makeTmpPath()
    const harness = {
      async record(outcome: unknown): Promise<void> {
        fs.appendFileSync(outcomesPath, `${JSON.stringify(outcome)}\n`, 'utf-8')
      },
    }
    const events = new EventEmitter()

    const collector = new TaskOutcomeCollector({
      events,
      harness,
      getTask: (taskId) => {
        if (taskId === 'task-complete') {
          return {
            id: taskId,
            title: 'Completed task',
            description: '',
            project: '/tmp',
            priority: 'high',
            status: 'completed',
            requiredSkills: [],
            source: 'dashboard',
            createdAt: Date.now() - 8_000,
            assignedAt: Date.now() - 6_000,
            completedAt: Date.now() - 1_000,
            retryCount: 2,
            maxRetries: 3,
          }
        }

        if (taskId === 'task-fail') {
          return {
            id: taskId,
            title: 'Failed task',
            description: '',
            project: '/tmp',
            priority: 'critical',
            status: 'failed',
            requiredSkills: [],
            source: 'dashboard',
            createdAt: Date.now() - 8_000,
            assignedAt: Date.now() - 5_000,
            completedAt: Date.now() - 500,
            retryCount: 1,
            maxRetries: 1,
          }
        }

        return undefined
      },
    })

    collector.start()
    collector.start() // should not double-subscribe

    events.emit('task-completed', {
      taskId: 'task-complete',
      agentId: 'agent-1',
      priority: 'high',
      durationMs: 4500,
    })
    events.emit('task-failed', {
      taskId: 'task-fail',
      agentId: 'agent-2',
      priority: 'critical',
      durationMs: 2500,
    })

    await waitForWrites()
    collector.stop()

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
    assert.equal(failed.retryCount, 1)
    assert.equal(failed.duration_ms, 2500)

    fs.rmSync(path.dirname(outcomesPath), { recursive: true, force: true })
  })

  it('falls back to task data when event payload is partial', async () => {
    const outcomesPath = makeTmpPath()
    const harness = {
      async record(outcome: unknown): Promise<void> {
        fs.appendFileSync(outcomesPath, `${JSON.stringify(outcome)}\n`, 'utf-8')
      },
    }
    const events = new EventEmitter()

    const collector = new TaskOutcomeCollector({
      events,
      harness,
      getTask: () => ({
        id: 'fallback-task',
        title: 'Fallback task',
        description: '',
        project: '/tmp',
        priority: 'low',
        status: 'failed',
        requiredSkills: [],
        source: 'dashboard',
        createdAt: Date.now() - 8_000,
        assignedAt: Date.now() - 5_000,
        completedAt: Date.now() - 2_000,
        retryCount: 3,
        maxRetries: 5,
      }),
    })

    collector.start()
    events.emit('task-failed', { taskId: 'fallback-task', agentId: 'agent-fallback' })
    await waitForWrites()
    collector.stop()

    const raw = fs.readFileSync(outcomesPath, 'utf-8')
    const [line] = raw.split('\n').filter(Boolean)
    const parsed = JSON.parse(line)

    assert.equal(parsed.priority, 'low')
    assert.equal(parsed.retryCount, 3)
    assert.ok(parsed.duration_ms >= 0)

    fs.rmSync(path.dirname(outcomesPath), { recursive: true, force: true })
  })
})
