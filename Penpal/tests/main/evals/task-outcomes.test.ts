import { describe, it, expect, vi } from 'vitest'
import { EventEmitter } from 'events'
import { TaskOutcomeCollector } from '../../../src/main/evals/collectors/task-outcomes'
import type { Task } from '../../../src/main/orchestrator'

function flushMicrotasks(): Promise<void> {
  return new Promise(resolve => {
    setImmediate(resolve)
  })
}

function minimalTask(overrides: Partial<Task> = {}): Task {
  const assignedAt = Date.now() - 12_000
  const completedAt = Date.now()
  return {
    id: 'task-1',
    title: 't',
    description: 'd',
    project: 'p',
    priority: 'high',
    status: 'completed',
    requiredSkills: ['typescript'],
    source: 'dashboard',
    createdAt: assignedAt - 1000,
    assignedAt,
    completedAt,
    retryCount: 2,
    maxRetries: 3,
    ...overrides,
  } as Task
}

describe('TaskOutcomeCollector', () => {
  it('records completed outcome with priority, duration, retry, taskType from task', async () => {
    const events = new EventEmitter()
    const record = vi.fn(async () => {})
    const task = minimalTask()
    const getTask = vi.fn(() => task)
    const collector = new TaskOutcomeCollector({ events, getTask, harness: { record } })
    collector.start()

    events.emit('task-completed', {
      taskId: 'task-1',
      agentId: 'agent-fullstack',
      priority: 'high',
      durationMs: 999,
      completedAt: task.completedAt,
    })

    await flushMicrotasks()

    expect(getTask).toHaveBeenCalledWith('task-1')
    expect(record).toHaveBeenCalledTimes(1)
    const outcome = record.mock.calls[0][0] as {
      taskId: string
      agentId: string
      status: string
      priority: string
      taskType?: string
      retryCount: number
      duration_ms: number
    }
    expect(outcome.taskId).toBe('task-1')
    expect(outcome.agentId).toBe('agent-fullstack')
    expect(outcome.status).toBe('completed')
    expect(outcome.priority).toBe('high')
    expect(outcome.taskType).toBe('typescript')
    expect(outcome.retryCount).toBe(2)
    expect(outcome.duration_ms).toBe(999)

    collector.stop()
  })

  it('records failed outcome and falls back when task missing', async () => {
    const events = new EventEmitter()
    const record = vi.fn(async () => {})
    const getTask = vi.fn(() => undefined)
    const collector = new TaskOutcomeCollector({ events, getTask, harness: { record } })
    collector.start()

    events.emit('task-failed', {
      taskId: 'task-x',
      agentId: 'agent-b',
      priority: 'critical',
      durationMs: 50,
    })

    await flushMicrotasks()

    expect(record).toHaveBeenCalledTimes(1)
    const outcome = record.mock.calls[0][0] as { status: string; priority: string; taskType?: string }
    expect(outcome.status).toBe('failed')
    expect(outcome.priority).toBe('critical')
    expect(outcome.taskType).toBeUndefined()

    collector.stop()
  })

  it('does not record when taskId or agentId is missing', async () => {
    const events = new EventEmitter()
    const record = vi.fn(async () => {})
    const collector = new TaskOutcomeCollector({
      events,
      getTask: () => undefined,
      harness: { record },
    })
    collector.start()

    events.emit('task-completed', { agentId: 'a' } as { taskId?: string; agentId: string })
    events.emit('task-completed', { taskId: 't' } as { taskId: string; agentId?: string })
    events.emit('task-failed', { agentId: 'a' } as { taskId?: string; agentId: string })

    await flushMicrotasks()
    expect(record).not.toHaveBeenCalled()
    collector.stop()
  })

  it('start() is idempotent', () => {
    const events = new EventEmitter()
    const record = vi.fn(async () => {})
    const c = new TaskOutcomeCollector({
      events,
      getTask: () => undefined,
      harness: { record },
    })
    c.start()
    c.start()
    events.emit('task-completed', { taskId: 't', agentId: 'a' })
    // eslint-disable-next-line @typescript-eslint/no-floating-promises -- sync check
    void flushMicrotasks()
    expect(record).toHaveBeenCalledTimes(1)
    c.stop()
  })
})
