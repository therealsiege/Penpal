/**
 * MCP tools: pods:create, pods:list, pods:status (canonical)
 * Aliases: pod:create, pod:list, pod:status — same handlers for backward compatibility.
 */

import {
  createPod,
  listPods,
  getPodStatus,
  getPodPresets,
  type PodWorkflow,
  type PodStatus,
} from '../../main/pods.js'
import { podQualityCollector } from '../../main/evals/collectors/pod-quality.js'
import { toolRegistry } from '../tools.js'
import { wrapResponse, type ContextEngineeredResponse } from '../response.js'

// ── Phase copy (context-engineered) ─────────────────────────────────────────

const PHASE_DESCRIPTIONS: Record<PodStatus, string> = {
  pending: 'Workflow is queued; the solver will start shortly.',
  solving: 'Solver is producing a solution (including any candidate/self-eval passes).',
  reviewing: 'Reviewer is drafting an independent test plan from the task spec.',
  executing: 'Executor is verifying the implementation against the test plan.',
  'self-fixing': 'Executor-driven self-fix pass after test failures.',
  feedback: 'Solver is addressing executor or reviewer feedback before another pass.',
  complete: 'Workflow finished successfully.',
  failed: 'Workflow stopped with an error or exhausted iterations.',
  paused: 'Workflow is paused; resume to continue.',
}

const ACTIVE_STATUSES: PodStatus[] = [
  'pending',
  'solving',
  'reviewing',
  'executing',
  'self-fixing',
  'feedback',
  'paused',
]

function isActiveStatus(status: PodStatus): boolean {
  return ACTIVE_STATUSES.includes(status)
}

function bucketPod(status: PodStatus): 'active' | 'complete' | 'failed' {
  if (status === 'complete') return 'complete'
  if (status === 'failed') return 'failed'
  return 'active'
}

function presetSuggestionsLines(): string[] {
  return getPodPresets().map((p) => `${p.id} — ${p.description}`)
}

function validPresetIds(): string[] {
  return getPodPresets().map((p) => p.id)
}

function buildCompletionHints(wf: PodWorkflow): {
  historical_avg_completion_ms: number
  estimated_remaining_note: string
} {
  const report = podQualityCollector.report()
  const avgMs = report.avgCompletionTime_ms
  const presetKey = wf.presetId && wf.presetId !== 'default' ? wf.presetId : ''
  const presetStats = presetKey ? report.byPreset[presetKey] : undefined

  let note: string
  if (report.totalPods === 0) {
    note = 'No historical pod completions yet; estimates unavailable.'
  } else {
    const avgMin = Math.round(avgMs / 60_000)
    const iterHint =
      presetStats && presetStats.total > 0
        ? ` This preset averaged ~${presetStats.avgIterations.toFixed(1)} iteration(s) over ${presetStats.total} run(s).`
        : ''
    note = `Across ${report.totalPods} recorded pod(s), mean completion time was ~${avgMin} min.${iterHint}`
  }

  return { historical_avg_completion_ms: avgMs, estimated_remaining_note: note }
}

// ── Handlers ─────────────────────────────────────────────────────────────────

export type PodsListFilter = 'active' | 'complete' | 'failed'

export async function handlePodsList(params: {
  status?: PodsListFilter
}): Promise<ContextEngineeredResponse<PodWorkflow[]>> {
  const all = listPods()
  const counts = {
    total: all.length,
    active: all.filter((p) => bucketPod(p.status) === 'active').length,
    complete: all.filter((p) => p.status === 'complete').length,
    failed: all.filter((p) => p.status === 'failed').length,
  }

  let filtered = all
  let filterApplied: PodsListFilter | null = null
  if (params.status === 'active') {
    filtered = all.filter((p) => isActiveStatus(p.status))
    filterApplied = 'active'
  } else if (params.status === 'complete') {
    filtered = all.filter((p) => p.status === 'complete')
    filterApplied = 'complete'
  } else if (params.status === 'failed') {
    filtered = all.filter((p) => p.status === 'failed')
    filterApplied = 'failed'
  }

  const presetBreakdown: Record<string, number> = {}
  for (const p of filtered) {
    const key = p.presetId ?? 'default'
    presetBreakdown[key] = (presetBreakdown[key] ?? 0) + 1
  }

  const summary = filterApplied
    ? `${filtered.length} pod(s) (${filterApplied} filter of ${counts.total} total): ${counts.active} active, ${counts.complete} complete, ${counts.failed} failed.`
    : `${counts.total} pod(s): ${counts.active} active, ${counts.complete} complete, ${counts.failed} failed.`

  const suggestions: string[] = presetSuggestionsLines().slice(0, 4)
  if (counts.active > 0) {
    suggestions.unshift(
      `${counts.active} active pod(s) — use pods:status with a workflow ID for stage history and artifacts.`,
    )
  }
  const stalled = all.filter(
    (p) => isActiveStatus(p.status) && Date.now() - p.updatedAt > 30 * 60 * 1000,
  )
  if (stalled.length > 0) {
    suggestions.push(`${stalled.length} active pod(s) idle >30m since last update — check agents or cancel.`)
  }
  if (counts.total === 0) {
    suggestions.push('No pods yet — create one via pods:create.')
  }

  return wrapResponse(filtered, summary, suggestions, ['pods:create', 'pods:status', 'orchestrator:queue'], {
    filter_applied: filterApplied,
    counts: { ...counts, returned: filtered.length },
    preset_breakdown: presetBreakdown,
  })
}

export async function handlePodsStatus(params: {
  workflowId: string
}): Promise<ContextEngineeredResponse<PodWorkflow | null>> {
  const pod = getPodStatus(params.workflowId)

  if (!pod) {
    return wrapResponse(null, 'Pod not found.', ['Check pods:list for workflow IDs.'], ['pods:list', 'pods:create'])
  }

  const phaseDescription = PHASE_DESCRIPTIONS[pod.status]
  const ageMin = Math.round((Date.now() - pod.createdAt) / 60_000)
  const summary = `Pod "${pod.name}" — ${pod.status}, iteration ${pod.iteration}/${pod.maxIterations}, age ${ageMin} min. ${phaseDescription}`

  const suggestions: string[] = []
  if (pod.status === 'solving') suggestions.push('Solver is working — orchestrator:agent-health shows agent TTY health.')
  if (pod.status === 'reviewing') suggestions.push('Reviewer output should be independent of solver implementation details.')
  if (pod.status === 'executing') suggestions.push('Executor compares implementation to the reviewer test plan.')
  if (pod.status === 'self-fixing') suggestions.push('Self-fix stage: executor is driving targeted fixes.')
  if (pod.status === 'feedback') {
    suggestions.push(`Feedback loop: iteration ${pod.iteration}/${pod.maxIterations}.`)
  }
  if (pod.status === 'complete') suggestions.push('Pod complete — inspect artifacts and solver output in data.')
  if (pod.status === 'failed') suggestions.push(`Pod failed${pod.error ? `: ${pod.error}` : ''}.`)
  if (pod.status === 'paused') suggestions.push('Paused — use app controls to resume when ready.')

  const inProgress = isActiveStatus(pod.status)
  const completion = inProgress ? buildCompletionHints(pod) : null

  if (inProgress && completion) {
    suggestions.push(completion.estimated_remaining_note)
  }

  const meta: Record<string, unknown> = {
    phase_description: phaseDescription,
    stage_history_length: pod.stageHistory.length,
    next_tool: { name: 'pods:status', workflowId: pod.id },
  }

  if (completion) {
    meta.historical_avg_completion_ms = completion.historical_avg_completion_ms
    meta.estimated_remaining_note = completion.estimated_remaining_note
  }

  if (pod.phaseConfig) {
    meta.phase_config_summary = {
      candidates: pod.phaseConfig.candidates,
      maxSelfFixes: pod.phaseConfig.maxSelfFixes,
      selfEvaluation: pod.phaseConfig.selfEvaluation,
    }
  }

  return wrapResponse(pod, summary, suggestions, ['pods:list', 'orchestrator:agent-health'], meta)
}

export interface PodsCreateParams {
  task: string
  preset?: string
  cwd?: string
  priority?: string
}

export async function handlePodsCreate(
  params: PodsCreateParams,
): Promise<ContextEngineeredResponse<PodWorkflow | null>> {
  const task = params.task?.trim() ?? ''
  if (!task) {
    return wrapResponse(
      null,
      'Task is required.',
      ['Provide a non-empty task string.', ...presetSuggestionsLines()],
      ['pods:list'],
      { valid_presets: validPresetIds() },
    )
  }

  if (params.preset !== undefined && params.preset !== '') {
    const ids = validPresetIds()
    if (!ids.includes(params.preset)) {
      return wrapResponse(
        null,
        `Unknown preset "${params.preset}". Valid preset ids: ${ids.join(', ')}.`,
        ['Pick a preset from valid_presets in _meta, or omit preset for the default team.', ...presetSuggestionsLines()],
        ['pods:list'],
        { valid_presets: ids },
      )
    }
  }

  try {
    const wf = createPod(task, {
      presetId: params.preset || undefined,
      cwd: params.cwd,
      priority: params.priority,
    })

    const phaseSummary = wf.phaseConfig
      ? `Phase config: ${wf.phaseConfig.candidates} solver candidate(s), up to ${wf.phaseConfig.maxSelfFixes} self-fix(es).`
      : 'Phase config: (default)'

    const summary =
      wf.status === 'failed' && wf.error
        ? `Pod created but failed validation: ${wf.error}`
        : `Pod created (${wf.id}) — status ${wf.status}. ${phaseSummary}`

    const suggestions: string[] = [
      wf.status !== 'failed'
        ? 'Workflow is starting — use pods:list to see all pods.'
        : 'Pod record created but did not start (see error on workflow).',
      `Track progress: pods:status with workflowId "${wf.id}".`,
      `Choose presets from _meta.preset_suggestions (${validPresetIds().length} ids from agent-types.yaml).`,
    ]

    return wrapResponse(wf, summary, suggestions, ['pods:status', 'pods:list', 'orchestrator:agent-health'], {
      phase_info: {
        current_status: wf.status,
        expected_next: wf.status === 'pending' ? 'solving' : wf.status,
        phase_config: wf.phaseConfig,
      },
      preset_suggestions: getPodPresets().map((p) => ({ id: p.id, description: p.description })),
      valid_presets: validPresetIds(),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return wrapResponse(
      null,
      `Pod creation failed: ${message}`,
      ['Fix the error above.', ...presetSuggestionsLines()],
      ['pods:list', 'orchestrator:agent-health'],
      { valid_presets: validPresetIds() },
    )
  }
}

// ── MCP registration ─────────────────────────────────────────────────────────

const listInputSchema = {
  type: 'object',
  properties: {
    status: {
      type: 'string',
      enum: ['active', 'complete', 'failed'],
      description: 'Optional filter: active (in-flight), complete, or failed',
    },
  },
  additionalProperties: false,
} as const

const statusInputSchema = {
  type: 'object',
  properties: {
    workflowId: { type: 'string', description: 'Pod workflow id (e.g. pod-1730000000-1)' },
  },
  required: ['workflowId'],
  additionalProperties: false,
} as const

const createInputSchema = {
  type: 'object',
  properties: {
    task: { type: 'string', description: 'Task description for the Solver/Reviewer/Executor pod' },
    preset: {
      type: 'string',
      description: 'Preset id from agent-types.yaml pod_presets (omit for default solver/reviewer/executor)',
    },
    cwd: { type: 'string', description: 'Working directory (defaults from solver agent config)' },
    priority: {
      type: 'string',
      enum: ['critical', 'high', 'normal', 'low'],
      description: 'Affects phase config (candidates / self-fix limits)',
    },
  },
  required: ['task'],
  additionalProperties: false,
} as const

toolRegistry.register({
  name: 'pods:list',
  description:
    'List pod workflows with optional status filter (active, complete, failed). Includes counts, preset breakdown, and phase reference in _meta.',
  inputSchema: { ...listInputSchema },
  handler: async (p) => handlePodsList(p as { status?: PodsListFilter }),
})

toolRegistry.register({
  name: 'pod:list',
  description: 'Alias for pods:list — same handler and schema (optional status filter).',
  inputSchema: { ...listInputSchema },
  handler: async (p) => handlePodsList(p as { status?: PodsListFilter }),
})

toolRegistry.register({
  name: 'pods:status',
  description:
    'Detailed pod workflow: status, stageHistory, artifacts, roles, critique, solverCandidates, phase description, and historical completion hints in _meta.',
  inputSchema: { ...statusInputSchema },
  handler: async (p) => handlePodsStatus(p as { workflowId: string }),
})

toolRegistry.register({
  name: 'pod:status',
  description: 'Alias for pods:status.',
  inputSchema: { ...statusInputSchema },
  handler: async (p) => handlePodsStatus(p as { workflowId: string }),
})

toolRegistry.register({
  name: 'pods:create',
  description:
    'Create a Solver/Reviewer/Executor pod via main pod engine. Preset must match agent-types.yaml pod_presets. Returns full PodWorkflow + preset suggestions in _meta.',
  inputSchema: { ...createInputSchema },
  handler: async (p) => handlePodsCreate(p as unknown as PodsCreateParams),
})

toolRegistry.register({
  name: 'pod:create',
  description: 'Alias for pods:create.',
  inputSchema: { ...createInputSchema },
  handler: async (p) => handlePodsCreate(p as unknown as PodsCreateParams),
})
