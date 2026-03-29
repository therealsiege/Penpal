/**
 * TaskOutcomeCollector — Hooks into orchestrator events to record task outcomes
 */

import type { EventEmitter } from 'events'
import { orchestratorEvents, getTask, type Task } from '../../orchestrator'
import { evalHarness, type EvalHarness, type TaskOutcome } from '../harness'

type TaskCompletedEvent = {
  taskId: string
  agentId: string
  priority?: string
  durationMs?: number
  completedAt?: number
}

type TaskFailedEvent = {
  taskId: string
  agentId: string
  priority?: string
  durationMs?: number
  completedAt?: number
}

interface CollectorDeps {
  events: EventEmitter
  getTask: (taskId: string) => Task | undefined
  harness: Pick<EvalHarness, 'record'>
}

const VALID_PRIORITIES = new Set<TaskOutcome['priority']>(['critical', 'high', 'normal', 'low'])

function toPriority(value: string | undefined, fallback: TaskOutcome['priority']): TaskOutcome['priority'] {
  if (value && VALID_PRIORITIES.has(value as TaskOutcome['priority'])) {
    return value as TaskOutcome['priority']
  }
  return fallback
}

export class TaskOutcomeCollector {
  private readonly deps: CollectorDeps
  private readonly onCompleted: (data: TaskCompletedEvent) => void
  private readonly onFailed: (data: TaskFailedEvent) => void
  private started = false

  constructor(deps?: Partial<CollectorDeps>) {
    this.deps = {
      events: deps?.events ?? orchestratorEvents,
      getTask: deps?.getTask ?? getTask,
      harness: deps?.harness ?? evalHarness,
    }

    this.onCompleted = (data) => {
      if (!data?.taskId || !data.agentId) return
      const task = this.deps.getTask(data.taskId)
      const now = new Date().toISOString()
      const startedAtMs = task?.assignedAt ?? Date.now()
      const completedAtMs = task?.completedAt ?? data.completedAt ?? Date.now()
      const computedDurationMs = Math.max(0, completedAtMs - startedAtMs)
      const duration_ms = Math.max(0, data.durationMs ?? computedDurationMs)

      const taskType = task?.requiredSkills?.[0]
      const outcome: TaskOutcome = {
        taskId: data.taskId,
        agentId: data.agentId,
        status: 'completed',
        priority: toPriority(data.priority ?? task?.priority, 'normal'),
        startedAt: task?.assignedAt ? new Date(task.assignedAt).toISOString() : now,
        completedAt: new Date(completedAtMs).toISOString(),
        retryCount: task?.retryCount ?? 0,
        duration_ms,
        ...(taskType ? { taskType } : {}),
      }

      this.deps.harness.record(outcome).catch(err =>
        console.error('[eval-collector] Failed to record completed outcome:', err),
      )
    }

    this.onFailed = (data) => {
      if (!data?.taskId || !data.agentId) return
      const task = this.deps.getTask(data.taskId)
      const now = new Date().toISOString()
      const startedAtMs = task?.assignedAt ?? Date.now()
      const completedAtMs = task?.completedAt ?? data.completedAt ?? Date.now()
      const computedDurationMs = Math.max(0, completedAtMs - startedAtMs)
      const duration_ms = Math.max(0, data.durationMs ?? computedDurationMs)

      const taskType = task?.requiredSkills?.[0]
      const outcome: TaskOutcome = {
        taskId: data.taskId,
        agentId: data.agentId,
        status: 'failed',
        priority: toPriority(data.priority ?? task?.priority, 'normal'),
        startedAt: task?.assignedAt ? new Date(task.assignedAt).toISOString() : now,
        completedAt: new Date(completedAtMs).toISOString(),
        retryCount: task?.retryCount ?? 0,
        duration_ms,
        ...(taskType ? { taskType } : {}),
      }

      this.deps.harness.record(outcome).catch(err =>
        console.error('[eval-collector] Failed to record failed outcome:', err),
      )
    }
  }

  start(): void {
    if (this.started) return
    this.started = true
    this.deps.events.on('task-completed', this.onCompleted)
    this.deps.events.on('task-failed', this.onFailed)
    console.log('[eval-collector] TaskOutcomeCollector started')
  }

  stop(): void {
    if (!this.started) return
    this.started = false
    this.deps.events.off('task-completed', this.onCompleted)
    this.deps.events.off('task-failed', this.onFailed)
    console.log('[eval-collector] TaskOutcomeCollector stopped')
  }
}

export const taskOutcomeCollector = new TaskOutcomeCollector()
