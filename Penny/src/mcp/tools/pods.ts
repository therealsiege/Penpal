/**
 * MCP tools: pod:create, pod:list, pod:status
 *
 * Exposes pod workflow capabilities so agents can create,
 * monitor, and inspect Solver/Reviewer/Executor workflows.
 */

import fs from 'fs'
import path from 'path'
import { execFile } from 'child_process'
import { toolRegistry } from '../tools.js'
import { wrapResponse, type ContextEngineeredResponse } from '../response.js'

// ── Data file paths ──────────────────────────────────────────────────────────

const DATA_DIR = path.resolve(__dirname, '..', '..', 'data')
const WORKFLOWS_PATH = path.join(DATA_DIR, 'pod-workflows.json')

interface PodWorkflowRecord {
  id: string
  name: string
  status: string
  task: string
  cwd: string
  solver: { agentId: string; status: string; output?: string }
  reviewer: { agentId: string; status: string; output?: string }
  executor: { agentId: string; status: string; output?: string }
  iteration: number
  maxIterations: number
  priority: string
  createdAt: number
  updatedAt: number
  error?: string
  stageHistory: { stage: string; enteredAt: number }[]
  presetId?: string
  critique?: {
    verdict: string
    confidence: number
    summary: string
    issues: { severity: string; location: string; description: string; suggestion: string }[]
  }
}

function loadWorkflows(): PodWorkflowRecord[] {
  try {
    if (!fs.existsSync(WORKFLOWS_PATH)) return []
    return JSON.parse(fs.readFileSync(WORKFLOWS_PATH, 'utf-8')) as PodWorkflowRecord[]
  } catch {
    return []
  }
}

// ── Exported handler functions ───────────────────────────────────────────────

export async function handlePodList(): Promise<ContextEngineeredResponse<PodWorkflowRecord[]>> {
  const pods = loadWorkflows()

  const active = pods.filter(p => ['solving', 'reviewing', 'executing', 'feedback'].includes(p.status))
  const completed = pods.filter(p => p.status === 'complete').length
  const failed = pods.filter(p => p.status === 'failed').length

  const summary = `${pods.length} pod(s): ${active.length} active, ${completed} completed, ${failed} failed.`

  const suggestions: string[] = []
  if (active.length > 0) {
    suggestions.push(`${active.length} active pod(s) — use pod:status with a workflow ID for details.`)
  }
  const stalled = active.filter(p => Date.now() - p.updatedAt > 30 * 60 * 1000)
  if (stalled.length > 0) {
    suggestions.push(`${stalled.length} pod(s) stalled (>30min since update) — consider cancelling.`)
  }
  if (pods.length === 0) {
    suggestions.push('No pods yet — create one via pod:create.')
  }

  return wrapResponse(pods, summary, suggestions, [
    'pod:create',
    'pod:status',
    'orchestrator:queue',
  ])
}

export async function handlePodStatus(params: {
  workflowId: string
}): Promise<ContextEngineeredResponse<PodWorkflowRecord | null>> {
  const pods = loadWorkflows()
  const pod = pods.find(p => p.id === params.workflowId) ?? null

  if (!pod) {
    return wrapResponse(null, 'Pod not found.', ['Check pod:list for available pods.'], ['pod:list'])
  }

  const ageMin = Math.round((Date.now() - pod.createdAt) / 60_000)
  const summary = `Pod "${pod.name}" — ${pod.status}, iteration ${pod.iteration}/${pod.maxIterations}, age ${ageMin}min.`

  const suggestions: string[] = []
  if (pod.status === 'solving') suggestions.push('Solver is working — check back later or view orchestrator:agent-health.')
  if (pod.status === 'reviewing') suggestions.push('Reviewer designing test plan — output will be independent of solver code.')
  if (pod.status === 'executing') suggestions.push('Executor verifying implementation against test plan.')
  if (pod.status === 'feedback') suggestions.push(`Iteration ${pod.iteration}/${pod.maxIterations} — solver addressing executor feedback.`)
  if (pod.status === 'complete') suggestions.push('Pod complete — review final output.')
  if (pod.status === 'failed') suggestions.push(`Pod failed${pod.error ? `: ${pod.error}` : ''}.`)
  if (pod.status === 'paused') suggestions.push('Pod is paused — resume when ready.')

  return wrapResponse(pod, summary, suggestions, ['pod:list', 'orchestrator:agent-health'])
}

export async function handlePodCreate(params: {
  task: string
  preset?: string
  cwd?: string
  priority?: string
}): Promise<ContextEngineeredResponse<{ success: boolean; output: string }>> {
  return new Promise((resolve) => {
    const cliPath = path.resolve(__dirname, '..', '..', 'main', 'pod-cli.ts')
    const args = ['--import', 'tsx', cliPath, '--task', params.task]
    if (params.preset) args.push('--preset', params.preset)
    if (params.cwd) args.push('--cwd', params.cwd)
    if (params.priority) args.push('--priority', params.priority)

    execFile('node', args, { timeout: 30_000 }, (error, stdout, stderr) => {
      const success = !error
      const output = (stdout || stderr || error?.message || '').trim()

      const summary = success
        ? `Pod created successfully.`
        : `Pod creation failed: ${output.slice(0, 200)}`

      const suggestions = success
        ? ['Use pod:list to see the new pod.', 'Use pod:status to track progress.']
        : ['Check the error and retry.', 'Use orchestrator:agent-health to verify agents are available.']

      resolve(wrapResponse({ success, output }, summary, suggestions, ['pod:list', 'pod:status']))
    })
  })
}

// ── MCP Tool Registration ───────────────────────────────────────────────────

toolRegistry.register({
  name: 'pod:list',
  description: 'List all pod workflows with status summaries. Returns active, completed, and failed pods.',
  inputSchema: {
    type: 'object',
    properties: {},
    additionalProperties: false,
  },
  handler: async () => handlePodList(),
})

toolRegistry.register({
  name: 'pod:status',
  description: 'Get detailed status of a specific pod workflow by ID.',
  inputSchema: {
    type: 'object',
    properties: {
      workflowId: { type: 'string', description: 'The pod workflow ID (e.g., pod-1234567890-1)' },
    },
    required: ['workflowId'],
    additionalProperties: false,
  },
  handler: async (params) => handlePodStatus(params as { workflowId: string }),
})

toolRegistry.register({
  name: 'pod:create',
  description: 'Create a new Solver/Reviewer/Executor pod workflow for a task.',
  inputSchema: {
    type: 'object',
    properties: {
      task: { type: 'string', description: 'Task description for the pod to work on' },
      preset: { type: 'string', description: 'Pod preset ID (frontend-feature, backend-feature, full-stack, content-pipeline)' },
      cwd: { type: 'string', description: 'Working directory for the pod (defaults to ~/sidekick)' },
      priority: { type: 'string', enum: ['critical', 'high', 'normal', 'low'], description: 'Task priority (affects compute allocation)' },
    },
    required: ['task'],
    additionalProperties: false,
  },
  handler: async (params) => handlePodCreate(params as { task: string; preset?: string; cwd?: string; priority?: string }),
})
