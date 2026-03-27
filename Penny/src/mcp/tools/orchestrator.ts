/**
 * MCP tools: orchestrator:enqueue, orchestrator:queue, orchestrator:agent-health
 *
 * Exposes orchestrator capabilities so agents can dispatch tasks,
 * check the queue, and monitor agent health.
 */

import { toolRegistry } from '../tools.js'
import {
  enqueueTask,
  getTaskQueue,
  getAgentHealthStatuses,
  getOrchestratorStats,
  type Task,
  type TaskPriority,
  type TaskStatus,
  type AgentHealthStatus,
  type OrchestratorStats,
} from '../../main/orchestrator.js'

const TASK_STATUSES: TaskStatus[] = [
  'queued',
  'assigned',
  'active',
  'completed',
  'failed',
  'cancelled',
]
import { wrapResponse, type ContextEngineeredResponse } from '../response.js'

// ── Exported handler functions (testable without MCP transport) ─────────────

export async function handleEnqueue(params: {
  title: string
  description: string
  project?: string
  priority?: string
}): Promise<ContextEngineeredResponse<Task>> {
  const validPriorities = ['critical', 'high', 'normal', 'low']
  const priority = (validPriorities.includes(params.priority ?? '')
    ? params.priority
    : 'normal') as TaskPriority

  const task = enqueueTask({
    title: params.title,
    description: params.description,
    project: params.project || '~/sidekick',
    priority,
    source: 'api',
  })

  const queue = getTaskQueue()
  const queuedAhead = queue.filter(t => t.status === 'queued' && t.id !== task.id).length
  const healthStatuses = await getAgentHealthStatuses()
  const idleAgents = healthStatuses.filter(a => a.alive && a.activeTasks === 0)

  const suggestions: string[] = []
  if (idleAgents.length > 0) {
    suggestions.push(`${idleAgents.length} idle agent(s) available — use pods:create to assign a team`)
  }
  if (queuedAhead > 0) {
    suggestions.push(`${queuedAhead} task(s) ahead in queue — use orchestrator:queue to check position`)
  }
  if (priority === 'critical') {
    suggestions.push('Critical task — consider assigning immediately via pods:create')
  }
  if (suggestions.length === 0) {
    suggestions.push('Task enqueued. Use orchestrator:queue to monitor progress')
  }

  const summary = `Task "${task.title}" enqueued with ${task.priority} priority.${queuedAhead > 0 ? ` ${queuedAhead} task(s) ahead in queue.` : ''}`

  return wrapResponse(task, summary, suggestions, [
    'orchestrator:queue',
    'orchestrator:agent-health',
    'pods:create',
  ])
}

export async function handleQueue(params: {
  status?: string
}): Promise<ContextEngineeredResponse<{ tasks: Task[]; stats: OrchestratorStats }>> {
  const allTasks = getTaskQueue()
  const filterStatus =
    params.status && TASK_STATUSES.includes(params.status as TaskStatus)
      ? (params.status as TaskStatus)
      : undefined

  const tasks = filterStatus ? allTasks.filter(t => t.status === filterStatus) : allTasks

  const stats = getOrchestratorStats()
  const healthStatuses = await getAgentHealthStatuses()
  const idleAgents = healthStatuses.filter(a => a.alive && a.activeTasks === 0)
  const idleCount = idleAgents.length

  const criticalQueued = allTasks.filter(t => t.status === 'queued' && t.priority === 'critical')
  const failedInQueue = allTasks.filter(t => t.status === 'failed').length

  const suggestions: string[] = []
  if (criticalQueued.length > 0 && idleCount > 0) {
    suggestions.push(
      `${criticalQueued.length} critical task(s) queued with ${idleCount} idle agent(s) — assign via pods:create`,
    )
  }
  if (criticalQueued.length > 0 && idleCount === 0) {
    suggestions.push(
      'Critical backlog with no idle agents — pause low-priority work or launch capacity.',
    )
  }
  if (failedInQueue > 0) {
    suggestions.push(`${failedInQueue} failed task(s) — retry via orchestrator:retry-task.`)
  }
  if (stats.failedToday > 0 && failedInQueue === 0) {
    suggestions.push(`${stats.failedToday} task(s) failed today — review with orchestrator:queue status=failed`)
  }
  if (allTasks.length === 0) {
    suggestions.push('Queue clear — enqueue new work via orchestrator:enqueue.')
  }
  if (idleCount === 0 && allTasks.length > 0) {
    suggestions.push('No idle agents — monitor via orchestrator:agent-health.')
  }
  if (suggestions.length === 0) {
    suggestions.push('Queue is healthy, no action needed')
  }

  const parts: string[] = []
  if (filterStatus) {
    parts.push(`${tasks.length} ${filterStatus} task(s) (${allTasks.length} total)`)
  } else {
    parts.push(`${tasks.length} task(s): ${stats.queueDepth} queued, ${stats.activeTasks} active`)
  }
  parts.push(`${idleCount} agent(s) idle`)

  const related: string[] = ['orchestrator:enqueue', 'orchestrator:agent-health', 'pods:create']
  if (failedInQueue > 0) related.push('orchestrator:retry-task')
  related.push('orchestrator:queue')

  return wrapResponse(
    { tasks, stats },
    parts.join('. ') + '.',
    suggestions,
    related,
    {
      byStatus: Object.fromEntries(
        [...new Set(allTasks.map(t => t.status))].map(s => [
          s,
          allTasks.filter(t => t.status === s).length,
        ]),
      ),
      idleAgentCount: idleCount,
      filteredBy: filterStatus ?? null,
    },
  )
}

export async function handleAgentHealth(): Promise<
  ContextEngineeredResponse<{ agents: AgentHealthStatus[] }>
> {
  const agents = await getAgentHealthStatuses()
  const stats = getOrchestratorStats()

  const healthyIds = agents.filter(a => a.status === 'healthy').map(a => a.agentId)
  const warningEntries = agents
    .filter(a => a.status === 'warning')
    .map(a => ({ agentId: a.agentId, reasons: a.warnings }))
  const deadIds = agents.filter(a => a.status === 'dead').map(a => a.agentId)

  const healthy = healthyIds.length
  const warning = warningEntries.length
  const dead = deadIds.length
  const idle = agents.filter(a => a.alive && a.activeTasks === 0).length

  const suggestions: string[] = []
  const recommendations: Array<{
    priority: 'high' | 'medium'
    agentId: string
    action: string
    reason: string
  }> = []

  for (const d of deadIds.slice(0, 3)) {
    const name = agents.find(s => s.agentId === d)?.name || d
    suggestions.push(`${name} is dead — restart via orchestrator:shutdown-agent then agents:launch.`)
    recommendations.push({ priority: 'high', agentId: d, action: 'restart', reason: 'agent process is dead' })
  }
  for (const w of warningEntries.slice(0, 3)) {
    const name = agents.find(s => s.agentId === w.agentId)?.name || w.agentId
    const reasonStr = w.reasons.join(', ')
    suggestions.push(`${name} has warnings: ${reasonStr} — consider restarting.`)
    recommendations.push({
      priority: 'medium',
      agentId: w.agentId,
      action: 'investigate',
      reason: reasonStr,
    })
  }

  if (idle > 0 && stats.queueDepth > 0) {
    suggestions.push(
      `${idle} idle agent(s) with ${stats.queueDepth} queued task(s) — assign via orchestrator:enqueue + pods:create`,
    )
  }

  if (suggestions.length === 0) {
    suggestions.push('All agents healthy — no action needed.')
  }

  const summary = `${agents.length} agent(s): ${healthy} healthy, ${warning} warning, ${dead} dead. ${idle} idle.`

  const related = ['orchestrator:queue', 'orchestrator:enqueue', 'pods:create', 'agents:statuses']
  if (dead > 0) {
    related.push('orchestrator:shutdown-agent', 'agents:launch')
  }

  return wrapResponse(
    { agents },
    summary,
    suggestions,
    related,
    {
      healthy: healthyIds,
      warnings: warningEntries,
      dead: deadIds,
      recommendations,
    },
  )
}

// ── MCP Tool Registration ───────────────────────────────────────────────────

toolRegistry.register({
  name: 'orchestrator:enqueue',
  description:
    'Enqueue a new task into the orchestrator task queue. Returns the created task with context-aware suggestions for next actions.',
  inputSchema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Task title' },
      description: { type: 'string', description: 'Task description' },
      project: { type: 'string', description: 'Project path (defaults to ~/sidekick)' },
      priority: {
        type: 'string',
        enum: ['critical', 'high', 'normal', 'low'],
        description: 'Task priority (defaults to normal)',
      },
    },
    required: ['title', 'description'],
    additionalProperties: false,
  },
  handler: async (params) => {
    return handleEnqueue(params as { title: string; description: string; project?: string; priority?: string })
  },
})

toolRegistry.register({
  name: 'orchestrator:queue',
  description:
    'Get the current task queue with optional status filter. Returns tasks, summary stats, and context-aware suggestions.',
  inputSchema: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        enum: [...TASK_STATUSES],
        description: 'Filter by task status (omit for all tasks)',
      },
    },
    additionalProperties: false,
  },
  handler: async (params) => {
    return handleQueue(params as { status?: string })
  },
})

toolRegistry.register({
  name: 'orchestrator:agent-health',
  description:
    'Get health status for all known agents. Returns health data with context-aware recommendations.',
  inputSchema: {
    type: 'object',
    properties: {},
    additionalProperties: false,
  },
  handler: async () => {
    return handleAgentHealth()
  },
})
