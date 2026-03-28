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
  type AgentHealthStatus,
  type OrchestratorStats,
} from '../../main/orchestrator.js'
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
}): Promise<ContextEngineeredResponse<{
  tasks: Task[]
  stats: OrchestratorStats
  idle_agents: Array<Pick<AgentHealthStatus, 'agentId' | 'name' | 'status' | 'activeTasks'>>
}>> {
  const validStatuses = ['queued', 'assigned', 'active', 'completed', 'failed', 'cancelled']
  let tasks = getTaskQueue()
  const statusFilter = validStatuses.includes(params.status ?? '') ? params.status : undefined
  if (statusFilter) {
    tasks = tasks.filter(t => t.status === statusFilter)
  }

  const stats = getOrchestratorStats()
  const healthStatuses = await getAgentHealthStatuses()
  const idleAgents = healthStatuses.filter(a => a.alive && a.activeTasks === 0)
  const idleAgentContext = idleAgents.map(a => ({
    agentId: a.agentId,
    name: a.name,
    status: a.status,
    activeTasks: a.activeTasks,
  }))
  const criticalQueued = tasks.filter(t => t.status === 'queued' && t.priority === 'critical')

  const suggestions: string[] = []
  if (criticalQueued.length > 0 && idleAgents.length > 0) {
    suggestions.push(
      `${criticalQueued.length} critical task(s) queued with ${idleAgents.length} idle agent(s) — assign via pods:create`,
    )
  }
  if (stats.failedToday > 0) {
    suggestions.push(`${stats.failedToday} task(s) failed today — review with orchestrator:queue status=failed`)
  }
  if (suggestions.length === 0) {
    suggestions.push('Queue is healthy, no action needed')
  }

  const parts: string[] = []
  if (statusFilter) {
    parts.push(`${tasks.length} ${statusFilter} task(s)`)
  } else if (params.status) {
    parts.push(`${tasks.length} task(s)`)
    suggestions.push(`Ignored unsupported status "${params.status}" — use orchestrator:queue without filter or a valid status`)
  } else {
    parts.push(`${tasks.length} task(s): ${stats.queueDepth} queued, ${stats.activeTasks} active`)
  }
  parts.push(`${idleAgents.length} agent(s) idle`)

  return wrapResponse(
    { tasks, stats, idle_agents: idleAgentContext },
    parts.join('. ') + '.',
    suggestions,
    ['orchestrator:enqueue', 'orchestrator:agent-health', 'pods:create'],
  )
}

export async function handleAgentHealth(): Promise<
  ContextEngineeredResponse<{ agents: AgentHealthStatus[] }>
> {
  const agents = await getAgentHealthStatuses()
  const stats = getOrchestratorStats()

  const healthy = agents.filter(a => a.status === 'healthy').length
  const warning = agents.filter(a => a.status === 'warning').length
  const dead = agents.filter(a => a.status === 'dead').length
  const idle = agents.filter(a => a.alive && a.activeTasks === 0).length

  const suggestions: string[] = []

  const deadAgents = agents.filter(a => a.status === 'dead')
  if (deadAgents.length > 0) {
    suggestions.push(
      `${deadAgents.length} dead agent(s): ${deadAgents.map(a => a.name).join(', ')} — restart via agent session creation`,
    )
  }

  const warningAgents = agents.filter(a => a.status === 'warning')
  for (const a of warningAgents) {
    if (a.warnings.length > 0) {
      suggestions.push(`Check ${a.name} — ${a.warnings[0]}`)
    }
  }

  if (idle > 0 && stats.queueDepth > 0) {
    suggestions.push(
      `${idle} idle agent(s) with ${stats.queueDepth} queued task(s) — assign via orchestrator:enqueue + pods:create`,
    )
  }

  if (suggestions.length === 0) {
    suggestions.push('All agents healthy, no action needed')
  }

  const summary = `${agents.length} agent(s): ${healthy} healthy, ${warning} warning, ${dead} dead. ${idle} idle.`

  return wrapResponse(
    { agents },
    summary,
    suggestions,
    ['orchestrator:queue', 'orchestrator:enqueue', 'pods:create'],
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
        enum: ['queued', 'assigned', 'active', 'completed', 'failed', 'cancelled'],
        description: 'Filter by status: queued, assigned, active, completed, failed, cancelled',
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
