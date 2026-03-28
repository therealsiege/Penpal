import { describe, it, expect } from 'vitest'
import { contextResponse, type ContextEngineeredResponse } from './context-response'

// ── Helper: validate the ContextEngineeredResponse shape ────────────────────
function assertShape<T>(r: ContextEngineeredResponse<T>) {
  expect(r).toHaveProperty('data')
  expect(r).toHaveProperty('summary')
  expect(r).toHaveProperty('suggestions')
  expect(r).toHaveProperty('related_tools')
  expect(typeof r.summary).toBe('string')
  expect(Array.isArray(r.suggestions)).toBe(true)
  expect(Array.isArray(r.related_tools)).toBe(true)
  // summary should be a single sentence (no newlines)
  expect(r.summary).not.toContain('\n')
  if (r.context !== undefined) {
    expect(r.context).toEqual(expect.any(Object))
  }
}

// ── contextResponse helper ──────────────────────────────────────────────────
describe('contextResponse helper', () => {
  it('produces a valid shape with all fields', () => {
    const r = contextResponse([1, 2], 'Two items.', ['Do X'], ['tool:a'], { count: 2 })
    assertShape(r)
    expect(r.data).toEqual([1, 2])
    expect(r.context).toEqual({ count: 2 })
  })

  it('omits context when not provided', () => {
    const r = contextResponse('hello', 'A string.', [], [])
    assertShape(r)
    expect(r.context).toBeUndefined()
  })
})

// ── Simulated handler logic tests ───────────────────────────────────────────
// These test the context-engineering logic in isolation, without Electron IPC.

describe('agents:statuses context logic', () => {
  function buildAgentsResponse(agents: { status: string; needsInteraction: boolean; id: string; memoryMB: number }[]) {
    const activeCount = agents.filter(a => a.status === 'active').length
    const idleCount = agents.filter(a => a.status === 'idle').length
    const blockedIds = agents.filter(a => a.needsInteraction).map(a => a.id)
    const idleIds = agents.filter(a => a.status === 'idle').map(a => a.id)
    const totalMemoryMB = agents.reduce((sum, a) => sum + a.memoryMB, 0)

    const summary = `${agents.length} agents: ${activeCount} active, ${idleCount} idle, ${blockedIds.length} blocked.`
    const suggestions: string[] = []
    if (blockedIds.length > 0) suggestions.push(`${blockedIds.length} agent(s) need approval — use sessions:approve to unblock.`)
    if (idleCount > 0) suggestions.push(`${idleCount} idle agent(s) available — assign tasks via orchestrator:enqueue.`)
    if (activeCount === agents.length && agents.length > 0) suggestions.push('All agents busy — monitor via orchestrator:agent-health.')

    return contextResponse(agents, summary, suggestions,
      ['orchestrator:queue', 'orchestrator:agent-health', 'pod:list', 'sessions:approve'],
      { breakdown: { busy: activeCount, idle: idleCount, blocked: blockedIds.length }, idle: idleIds, blocked: blockedIds, activeCount, totalMemoryMB },
    )
  }

  it('returns valid shape', () => {
    const r = buildAgentsResponse([
      { status: 'active', needsInteraction: false, id: 'a1', memoryMB: 100 },
    ])
    assertShape(r)
  })

  it('suggests approval when agents are blocked', () => {
    const r = buildAgentsResponse([
      { status: 'idle', needsInteraction: true, id: 'a1', memoryMB: 50 },
    ])
    expect(r.suggestions.some(s => s.includes('approval'))).toBe(true)
  })

  it('suggests assigning work when agents are idle', () => {
    const r = buildAgentsResponse([
      { status: 'idle', needsInteraction: false, id: 'a1', memoryMB: 50 },
      { status: 'idle', needsInteraction: false, id: 'a2', memoryMB: 50 },
    ])
    expect(r.suggestions.some(s => s.includes('idle'))).toBe(true)
  })

  it('suggests monitoring when all agents are active', () => {
    const r = buildAgentsResponse([
      { status: 'active', needsInteraction: false, id: 'a1', memoryMB: 100 },
      { status: 'active', needsInteraction: false, id: 'a2', memoryMB: 100 },
    ])
    expect(r.suggestions.some(s => s.includes('All agents busy'))).toBe(true)
  })
})

describe('orchestrator:queue context logic', () => {
  function buildQueueResponse(tasks: { priority: string; status: string; createdAt: number }[], idleAgents: number) {
    const byPriority: Record<string, number> = { critical: 0, high: 0, normal: 0, low: 0 }
    const byStatus: Record<string, number> = {}
    for (const t of tasks) {
      byPriority[t.priority] = (byPriority[t.priority] || 0) + 1
      byStatus[t.status] = (byStatus[t.status] || 0) + 1
    }
    const failedCount = byStatus['failed'] || 0

    const priorityStr = Object.entries(byPriority).filter(([, n]) => n > 0).map(([p, n]) => `${n} ${p}`).join(', ')
    const summary = `${tasks.length} task(s)${priorityStr ? `: ${priorityStr}` : ''}. ${idleAgents} agent(s) idle.`

    const suggestions: string[] = []
    if ((byPriority['critical'] || 0) > 0 && idleAgents > 0) suggestions.push('Critical tasks queued with idle agents — assign via pod:create.')
    if (failedCount > 0) suggestions.push(`${failedCount} failed task(s) — retry via orchestrator:retry-task.`)
    if (tasks.length === 0) suggestions.push('Queue clear — enqueue new work via orchestrator:enqueue.')
    if (idleAgents === 0 && tasks.length > 0) suggestions.push('No idle agents — monitor via orchestrator:agent-health.')

    return contextResponse(tasks, summary, suggestions,
      ['orchestrator:enqueue', 'orchestrator:retry-task', 'agents:statuses', 'pod:create'],
      { byPriority, byStatus, idleAgents },
    )
  }

  it('returns valid shape', () => {
    const r = buildQueueResponse([], 0)
    assertShape(r)
  })

  it('suggests retry when tasks are failed', () => {
    const r = buildQueueResponse([
      { priority: 'normal', status: 'failed', createdAt: Date.now() },
    ], 1)
    expect(r.suggestions.some(s => s.includes('retry'))).toBe(true)
  })

  it('suggests assigning critical tasks when idle agents exist', () => {
    const r = buildQueueResponse([
      { priority: 'critical', status: 'queued', createdAt: Date.now() },
    ], 2)
    expect(r.suggestions.some(s => s.includes('Critical'))).toBe(true)
  })

  it('suggests enqueue when queue is empty', () => {
    const r = buildQueueResponse([], 3)
    expect(r.suggestions.some(s => s.includes('Queue clear'))).toBe(true)
  })
})

describe('orchestrator:agent-health context logic', () => {
  function buildHealthResponse(statuses: { agentId: string; name: string; status: string; warnings: string[] }[]) {
    const healthy = statuses.filter(s => s.status === 'healthy').map(s => s.agentId)
    const warnings = statuses.filter(s => s.status === 'warning').map(s => ({ agentId: s.agentId, reasons: s.warnings }))
    const dead = statuses.filter(s => s.status === 'dead').map(s => s.agentId)

    const summary = `${statuses.length} agent(s): ${healthy.length} healthy, ${warnings.length} warning, ${dead.length} dead.`

    const suggestions: string[] = []
    for (const d of dead.slice(0, 3)) {
      const name = statuses.find(s => s.agentId === d)?.name || d
      suggestions.push(`${name} is dead — restart via orchestrator:shutdown-agent then agents:launch.`)
    }
    for (const w of warnings.slice(0, 3)) {
      const name = statuses.find(s => s.agentId === w.agentId)?.name || w.agentId
      suggestions.push(`${name} has warnings: ${w.reasons.join(', ')} — consider restarting.`)
    }
    if (dead.length === 0 && warnings.length === 0) suggestions.push('All agents healthy — no action needed.')

    return contextResponse(statuses, summary, suggestions,
      ['orchestrator:shutdown-agent', 'agents:launch', 'agents:statuses', 'orchestrator:queue'],
      { healthy, warnings, dead },
    )
  }

  it('returns valid shape', () => {
    const r = buildHealthResponse([])
    assertShape(r)
  })

  it('suggests restart when agents are dead', () => {
    const r = buildHealthResponse([
      { agentId: 'a1', name: 'Marcus', status: 'dead', warnings: [] },
    ])
    expect(r.suggestions.some(s => s.includes('restart'))).toBe(true)
  })

  it('reports all healthy when no issues', () => {
    const r = buildHealthResponse([
      { agentId: 'a1', name: 'Marcus', status: 'healthy', warnings: [] },
      { agentId: 'a2', name: 'Lena', status: 'healthy', warnings: [] },
    ])
    expect(r.suggestions.some(s => s.includes('All agents healthy'))).toBe(true)
  })
})

describe('pod:status context logic', () => {
  function buildPodStatusResponse(pod: { name: string; status: string; iteration: number; maxIterations: number; createdAt: number; error?: string; stageHistory: { stage: string; enteredAt: number }[] } | null) {
    if (!pod) {
      return contextResponse(null, 'Pod not found.', ['Check pod:list for active pods.'],
        ['pod:list', 'pod:create'])
    }

    const elapsedTotal = Date.now() - pod.createdAt
    const currentStageEntry = pod.stageHistory.length > 0 ? pod.stageHistory[pod.stageHistory.length - 1] : null
    const timeInPhase = currentStageEntry ? Date.now() - currentStageEntry.enteredAt : 0
    const timeInPhaseMin = Math.round(timeInPhase / 60000)
    const elapsedMin = Math.round(elapsedTotal / 60000)

    const summary = `Pod '${pod.name}': ${pod.status} (iteration ${pod.iteration}/${pod.maxIterations}), in phase for ${timeInPhaseMin}m, total ${elapsedMin}m.`

    const suggestions: string[] = []
    if (pod.status === 'paused') suggestions.push('Pod is paused — resume via pod:resume.')
    if (pod.status === 'feedback') suggestions.push(`Iteration ${pod.iteration}/${pod.maxIterations} — solver addressing reviewer feedback.`)

    return contextResponse(pod, summary, suggestions,
      ['pod:pause', 'pod:resume', 'pod:cancel', 'pod:list', 'agents:statuses'],
      { timeInPhaseMs: timeInPhase, elapsedTotalMs: elapsedTotal },
    )
  }

  it('returns valid shape for null pod', () => {
    const r = buildPodStatusResponse(null)
    assertShape(r)
    expect(r.data).toBeNull()
  })

  it('suggests resume for paused pods', () => {
    const r = buildPodStatusResponse({
      name: 'Test Pod', status: 'paused', iteration: 1, maxIterations: 3,
      createdAt: Date.now() - 60000, stageHistory: [{ stage: 'paused', enteredAt: Date.now() - 30000 }],
    })
    expect(r.suggestions.some(s => s.includes('resume'))).toBe(true)
  })

  it('shows feedback iteration info', () => {
    const r = buildPodStatusResponse({
      name: 'Test Pod', status: 'feedback', iteration: 2, maxIterations: 3,
      createdAt: Date.now() - 120000, stageHistory: [{ stage: 'feedback', enteredAt: Date.now() - 10000 }],
    })
    expect(r.suggestions.some(s => s.includes('Iteration 2/3'))).toBe(true)
  })
})

describe('vault:search context logic', () => {
  function buildVaultSearchResponse(results: { path: string; line: number; text: string }[], query: string) {
    const folders = [...new Set(results.map(r => r.path.includes('/') ? r.path.split('/').slice(0, -1).join('/') : '(root)'))]
    const fileCount = new Set(results.map(r => r.path)).size

    const summary = `Found ${results.length} result(s) for '${query}' across ${fileCount} file(s) in ${folders.length} folder(s).`
    const suggestions: string[] = []
    if (folders.length > 1) suggestions.push(`Results span ${folders.slice(0, 3).join(', ')} — narrow with glob parameter.`)
    suggestions.push('Read specific files via vault:read for full content.')

    return contextResponse(results, summary, suggestions,
      ['vault:read', 'vault:backlinks', 'vault:tags', 'vault:files-by-tag'],
      { folders, matchCount: results.length, fileCount, query },
    )
  }

  it('returns valid shape', () => {
    const r = buildVaultSearchResponse([], 'test')
    assertShape(r)
  })

  it('includes folder span info when results across multiple folders', () => {
    const r = buildVaultSearchResponse([
      { path: 'Sales/lead1.md', line: 1, text: 'match' },
      { path: 'Product/spec.md', line: 5, text: 'match' },
    ], 'test')
    expect(r.suggestions.some(s => s.includes('Results span'))).toBe(true)
  })
})

// ── Backward compatibility: unwrap helper ───────────────────────────────────
describe('preload unwrap backward compat', () => {
  // Simulates the unwrap function from preload
  const unwrap = <T>(result: T): T =>
    (result && typeof result === 'object' && 'data' in result && 'summary' in result)
      ? (result as { data: T }).data
      : result

  it('unwraps a ContextEngineeredResponse to its data field', () => {
    const wrapped = contextResponse([1, 2, 3], 'Three items.', [], [])
    const unwrapped = unwrap(wrapped)
    expect(unwrapped).toEqual([1, 2, 3])
  })

  it('passes through non-wrapped values', () => {
    const raw = [1, 2, 3]
    expect(unwrap(raw)).toEqual([1, 2, 3])
  })

  it('passes through null', () => {
    expect(unwrap(null)).toBeNull()
  })
})
