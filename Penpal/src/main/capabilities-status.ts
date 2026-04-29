/**
 * Aggregates subsystem health for `capabilities:status` (issues #54 / #55).
 */

import fs from 'fs'
import { getGraphStatsWithFreshness } from './graph'
import { getEvalStats } from './evals'
import { getTaskQueue } from './orchestrator'
import { listPods } from './pods'
import { spotCheckQueue } from './evals/judges/human-judge'
import { DOCS_ROOT } from './paths'

export interface CapabilitiesStatusResult {
  updatedAt: string
  overall: 'ok' | 'degraded' | 'unknown'
  items: Record<string, string>
  /** Issue #54 — graph + orchestrator only (subset of `items`). */
  facets: {
    graph_orchestrator: Record<string, string>
    /** Issue #55 — evals + vault + spot_check (subset of `items`). */
    evals_vault: Record<string, string>
  }
}

function rollupOverall(items: Record<string, string>): 'ok' | 'degraded' | 'unknown' {
  const vals = Object.values(items)
  if (vals.length === 0) return 'unknown'
  const bad = vals.filter(
    v =>
      v.startsWith('unavailable') ||
      v === 'unknown' ||
      v.startsWith('degraded'),
  ).length
  if (bad === 0) return 'ok'
  if (bad === vals.length) return 'unknown'
  return 'degraded'
}

async function lineGraph(): Promise<string> {
  try {
    const stats = await getGraphStatsWithFreshness()
    const n = stats.totalNodes ?? 0
    const f = stats.freshness?.status ?? 'unknown'
    return n > 0 ? `ok (${n} nodes, ${f})` : `ok (empty, ${f})`
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return `unavailable (${msg.slice(0, 80)})`
  }
}

function lineOrchestrator(): string {
  try {
    const q = getTaskQueue()
    const queued = q.filter(t => t.status === 'queued').length
    const active = q.filter(t => t.status === 'active' || t.status === 'assigned').length
    return `ok (${queued} queued, ${active} active)`
  } catch {
    return 'unknown'
  }
}

function lineEvals(): string {
  try {
    const s = getEvalStats()
    const pct = Math.round((s.overallSuccessRate ?? 0) * 100)
    return `ok (${s.totalTasks} tasks, ${pct}% success)`
  } catch {
    return 'unknown'
  }
}

function lineVault(): string {
  try {
    if (!fs.existsSync(DOCS_ROOT)) return 'degraded (no vault root)'
    const st = fs.statSync(DOCS_ROOT)
    if (!st.isDirectory()) return 'degraded (vault path not a directory)'
    return 'ok'
  } catch {
    return 'unknown'
  }
}

function linePods(): string {
  try {
    const pods = listPods()
    const active = pods.filter(p => !['complete', 'failed'].includes(p.status)).length
    return `ok (${active} active / ${pods.length} total)`
  } catch {
    return 'unknown'
  }
}

async function lineSpotCheck(): Promise<string> {
  try {
    const pending = await spotCheckQueue.getPending()
    return pending.length > 0 ? `ok (${pending.length} pending review)` : 'ok (queue empty)'
  } catch {
    return 'unknown'
  }
}

async function lineMcp(): Promise<string> {
  try {
    const { buildToolCatalog } = await import('../mcp/server')
    const n = buildToolCatalog().length
    return n > 0 ? `ok (${n} tools)` : 'degraded (no tools)'
  } catch {
    return 'unknown'
  }
}

export async function computeCapabilitiesStatus(): Promise<CapabilitiesStatusResult> {
  const updatedAt = new Date().toISOString()

  const [graph, orchestrator, evals, vault, pods, spot_check, mcp] = await Promise.all([
    lineGraph(),
    Promise.resolve(lineOrchestrator()),
    Promise.resolve(lineEvals()),
    Promise.resolve(lineVault()),
    Promise.resolve(linePods()),
    lineSpotCheck(),
    lineMcp(),
  ])

  const items: Record<string, string> = {
    graph,
    orchestrator,
    evals,
    vault,
    pods,
    spot_check,
    mcp,
  }

  const facets = {
    graph_orchestrator: { graph, orchestrator },
    evals_vault: { evals, vault, spot_check },
  }

  const overall = rollupOverall(items)

  return { updatedAt, overall, items, facets }
}
