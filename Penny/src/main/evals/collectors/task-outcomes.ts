/**
 * TaskOutcomeCollector — Hooks into orchestrator events to record task outcomes
 */

import { orchestratorEvents, getTask } from '../../orchestrator'
import { evalHarness, type TaskOutcome } from '../harness'

export class TaskOutcomeCollector {
  private onCompleted: (data: { taskId: string; agentId: string; priority: string; durationMs: number }) => void
  private onFailed: (data: { taskId: string; agentId: string }) => void

  constructor() {
    this.onCompleted = (data) => {
      const task = getTask(data.taskId)
      const now = new Date().toISOString()

      const outcome: TaskOutcome = {
        taskId: data.taskId,
        agentId: data.agentId,
        status: 'completed',
        priority: (data.priority ?? task?.priority ?? 'normal') as TaskOutcome['priority'],
        startedAt: task?.assignedAt ? new Date(task.assignedAt).toISOString() : now,
        completedAt: task?.completedAt ? new Date(task.completedAt).toISOString() : now,
        retryCount: task?.retryCount ?? 0,
        duration_ms: data.durationMs ?? 0,
      }

      evalHarness.record(outcome).catch(err =>
        console.error('[eval-collector] Failed to record completed outcome:', err),
      )
    }

    this.onFailed = (data) => {
      const task = getTask(data.taskId)
      const now = new Date().toISOString()
      const startedAt = task?.assignedAt ? new Date(task.assignedAt).toISOString() : now
      const completedAt = task?.completedAt ? new Date(task.completedAt).toISOString() : now
      const duration_ms = task?.assignedAt && task?.completedAt
        ? task.completedAt - task.assignedAt
        : 0

      const outcome: TaskOutcome = {
        taskId: data.taskId,
        agentId: data.agentId,
        status: 'failed',
        priority: (task?.priority ?? 'normal') as TaskOutcome['priority'],
        startedAt,
        completedAt,
        retryCount: task?.retryCount ?? 0,
        duration_ms,
      }

      evalHarness.record(outcome).catch(err =>
        console.error('[eval-collector] Failed to record failed outcome:', err),
      )
    }
  }

  start(): void {
    orchestratorEvents.on('task-completed', this.onCompleted)
    orchestratorEvents.on('task-failed', this.onFailed)
    console.log('[eval-collector] TaskOutcomeCollector started')
  }

  stop(): void {
    orchestratorEvents.off('task-completed', this.onCompleted)
    orchestratorEvents.off('task-failed', this.onFailed)
    console.log('[eval-collector] TaskOutcomeCollector stopped')
  }
}

export const taskOutcomeCollector = new TaskOutcomeCollector()
