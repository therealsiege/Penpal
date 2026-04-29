/**
 * pod-reflection.ts — MRAP reflection loop for pod analytics.
 *
 * After each pod completes, reflect on what happened: efficiency,
 * bottlenecks, and recommendations. Aggregates fleet-wide analytics.
 *
 * Inspired by DAA's MRAP loop (Monitor→Reason→Act→Reflect→Adapt).
 */

import type { PodWorkflow } from './pods'

// ── Types ───────────────────────────────────────────────────────────────────

export type Efficiency = 'excellent' | 'good' | 'slow' | 'struggled'
export type Bottleneck = 'solver' | 'reviewer' | 'executor' | 'rebase' | 'none'

export interface ReflectionReport {
  podId: string
  task: string
  passedFirstTry: boolean
  totalDurationMs: number
  iterations: number
  selfFixes: number
  reviewerVerdict: string
  executorPassed: boolean
  rebaseConflict: boolean
  filesModified: number
  efficiency: Efficiency
  bottleneck: Bottleneck
  recommendation: string
}

export interface FleetAnalytics {
  totalPods: number
  passRate: number
  avgIterations: number
  avgDurationMs: number
  topBottleneck: Bottleneck
  efficiencyBreakdown: Record<Efficiency, number>
}

// ── Reflection ──────────────────────────────────────────────────────────────

function classifyEfficiency(wf: PodWorkflow): Efficiency {
  const durationMin = (Date.now() - wf.createdAt) / 60_000

  if (wf.status === 'failed') return 'struggled'
  if (wf.iteration === 1 && wf.selfFixAttempts === 0 && durationMin < 10) return 'excellent'
  if (wf.iteration === 1 && durationMin < 20) return 'good'
  if (wf.iteration <= 2 && durationMin < 30) return 'good'
  if (wf.iteration >= 3 || durationMin > 30) return 'slow'
  return 'good'
}

function detectBottleneck(wf: PodWorkflow): Bottleneck {
  if (wf.rebaseConflict) return 'rebase'

  // Check stage history for longest stage
  const history = wf.stageHistory
  if (history.length < 2) return 'none'

  let longestStage: Bottleneck = 'none'
  let longestMs = 0

  for (let i = 0; i < history.length - 1; i++) {
    const duration = history[i + 1].enteredAt - history[i].enteredAt
    const stage = history[i].stage

    let mapped: Bottleneck = 'none'
    if (stage === 'solving') mapped = 'solver'
    else if (stage === 'reviewing') mapped = 'reviewer'
    else if (stage === 'executing' || stage === 'self-fixing') mapped = 'executor'

    if (mapped !== 'none' && duration > longestMs) {
      longestMs = duration
      longestStage = mapped
    }
  }

  return longestStage
}

function generateRecommendation(wf: PodWorkflow, efficiency: Efficiency, bottleneck: Bottleneck): string {
  if (efficiency === 'excellent') return 'No changes needed — clean execution'

  const recs: string[] = []

  if (bottleneck === 'solver' && wf.iteration > 1) {
    recs.push('Solver needed multiple iterations — consider providing more context or splitting task')
  }
  if (bottleneck === 'executor' && wf.selfFixAttempts > 0) {
    recs.push('Executor self-fixed — test expectations may need clarification in task description')
  }
  if (bottleneck === 'reviewer' && wf.critique?.verdict === 'request-changes') {
    recs.push('Reviewer requested changes — task description may be ambiguous')
  }
  if (bottleneck === 'rebase') {
    recs.push('Rebase conflict — consider sequencing dependent tasks or using merge queue')
  }
  if (efficiency === 'struggled') {
    recs.push('Task may be too large — consider splitting into smaller pods')
  }

  return recs.length > 0 ? recs.join('; ') : 'Monitor for patterns'
}

/**
 * Generate a reflection report for a completed pod.
 */
export function reflectOnPod(wf: PodWorkflow): ReflectionReport {
  const efficiency = classifyEfficiency(wf)
  const bottleneck = detectBottleneck(wf)

  return {
    podId: wf.id,
    task: wf.task.slice(0, 100),
    passedFirstTry: wf.iteration === 1 && wf.selfFixAttempts === 0 && wf.lastExecutorPassed === true,
    totalDurationMs: Date.now() - wf.createdAt,
    iterations: wf.iteration,
    selfFixes: wf.selfFixAttempts,
    reviewerVerdict: wf.critique?.verdict || 'unknown',
    executorPassed: wf.lastExecutorPassed ?? false,
    rebaseConflict: wf.rebaseConflict ?? false,
    filesModified: wf.artifacts.filter(a => a.stage === 'solve').length,
    efficiency,
    bottleneck,
    recommendation: generateRecommendation(wf, efficiency, bottleneck),
  }
}

// ── Fleet Analytics ─────────────────────────────────────────────────────────

/**
 * Aggregate analytics across recent pods.
 */
export function getFleetAnalytics(workflows: PodWorkflow[], lookbackHours = 48): FleetAnalytics {
  const cutoff = Date.now() - lookbackHours * 3600_000
  const recent = workflows.filter(w =>
    w.updatedAt > cutoff && (w.status === 'complete' || w.status === 'failed')
  )

  if (recent.length === 0) {
    return {
      totalPods: 0,
      passRate: 0,
      avgIterations: 0,
      avgDurationMs: 0,
      topBottleneck: 'none',
      efficiencyBreakdown: { excellent: 0, good: 0, slow: 0, struggled: 0 },
    }
  }

  const passed = recent.filter(w => w.status === 'complete')
  const passRate = passed.length / recent.length

  const avgIterations = recent.reduce((s, w) => s + w.iteration, 0) / recent.length
  const avgDurationMs = recent.reduce((s, w) => s + (w.updatedAt - w.createdAt), 0) / recent.length

  // Count bottlenecks
  const bottleneckCounts: Record<Bottleneck, number> = { solver: 0, reviewer: 0, executor: 0, rebase: 0, none: 0 }
  const efficiencyBreakdown: Record<Efficiency, number> = { excellent: 0, good: 0, slow: 0, struggled: 0 }

  for (const wf of recent) {
    const bn = detectBottleneck(wf)
    bottleneckCounts[bn]++
    const eff = classifyEfficiency(wf)
    efficiencyBreakdown[eff]++
  }

  const topBottleneck = (Object.entries(bottleneckCounts) as [Bottleneck, number][])
    .filter(([k]) => k !== 'none')
    .sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'none'

  return {
    totalPods: recent.length,
    passRate,
    avgIterations,
    avgDurationMs,
    topBottleneck,
    efficiencyBreakdown,
  }
}
