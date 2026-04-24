/**
 * PodComboCollector — Tracks agent combination performance across pod runs
 *
 * Records per-workflow events enriched with agent IDs per role (solver,
 * reviewer, executor) and per-stage timing computed from stageHistory.
 * Reports surface combo leaderboards, per-agent role stats, and stage
 * timing breakdowns to answer "which agent combos work best?"
 */

import fs from 'fs'
import path from 'path'

// ── Types ───────────────────────────────────────────────────────────────────

export interface StageDurations {
  solving_ms: number
  reviewing_ms: number
  executing_ms: number
  selfFixing_ms: number
  feedback_ms: number
}

export interface PodComboEvent {
  podId: string
  presetId: string
  status: 'complete' | 'failed'
  solverId: string
  reviewerId: string
  executorId: string
  comboKey: string
  stageDurations: StageDurations
  iterations: number
  firstPassAccepted: boolean
  executorPassed: boolean
  selfFixed: boolean
  completionTime_ms: number
  timestamp: number
}

export interface ComboStats {
  comboKey: string
  solverId: string
  reviewerId: string
  executorId: string
  totalRuns: number
  completed: number
  successRate: number
  avgIterations: number
  avgCompletionTime_ms: number
  firstPassRate: number
  executorPassRate: number
  selfFixRate: number
  avgStageDurations: Omit<StageDurations, 'feedback_ms'>
}

export interface RoleStats {
  runs: number
  successRate: number
  avgDuration_ms: number
}

export interface AgentRoleStats {
  agentId: string
  asSolver: RoleStats
  asReviewer: RoleStats & { firstPassRate: number }
  asExecutor: RoleStats & { passRate: number; selfFixRate: number }
}

export interface PodComboReport {
  period: { from: string; to: string }
  totalPods: number
  topCombos: ComboStats[]
  agentRoleStats: AgentRoleStats[]
  stageTimingOverall: {
    avgSolving_ms: number
    avgReviewing_ms: number
    avgExecuting_ms: number
    avgSelfFixing_ms: number
  }
  byPreset: Record<string, ComboStats[]>
}

export interface ComboReportOpts {
  since?: Date
  until?: Date
  presetId?: string
  agentId?: string
}

// ── Helpers ─────────────────────────────────────────────────────────────────

export function makeComboKey(solverId: string, reviewerId: string, executorId: string): string {
  return `${solverId}|${reviewerId}|${executorId}`
}

const STAGE_BUCKET: Record<string, keyof StageDurations> = {
  solving: 'solving_ms',
  reviewing: 'reviewing_ms',
  executing: 'executing_ms',
  'self-fixing': 'selfFixing_ms',
  feedback: 'feedback_ms',
}

export function computeStageDurations(
  stageHistory: Array<{ stage: string; enteredAt: number }>,
): StageDurations {
  const durations: StageDurations = {
    solving_ms: 0,
    reviewing_ms: 0,
    executing_ms: 0,
    selfFixing_ms: 0,
    feedback_ms: 0,
  }
  for (let i = 0; i < stageHistory.length - 1; i++) {
    const bucket = STAGE_BUCKET[stageHistory[i].stage]
    if (bucket) {
      durations[bucket] += stageHistory[i + 1].enteredAt - stageHistory[i].enteredAt
    }
  }
  return durations
}

// ── Collector ───────────────────────────────────────────────────────────────

export class PodComboCollector {
  private filePath: string

  constructor(filePath?: string) {
    const dataDir = filePath
      ? path.dirname(filePath)
      : path.resolve(__dirname, '..', '..', '..', '..', 'data')
    this.filePath = filePath ?? path.join(dataDir, 'eval-pod-combos.jsonl')

    const dir = path.dirname(this.filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
  }

  record(event: PodComboEvent): void {
    const line = JSON.stringify(event) + '\n'
    fs.appendFileSync(this.filePath, line, 'utf-8')
  }

  report(opts?: ComboReportOpts): PodComboReport {
    const events = this.loadEvents()
    const sinceMs = opts?.since ? opts.since.getTime() : 0
    const untilMs = opts?.until ? opts.until.getTime() : Number.POSITIVE_INFINITY

    const filtered = events.filter(e => {
      if (sinceMs > 0 && e.timestamp < sinceMs) return false
      if (untilMs !== Number.POSITIVE_INFINITY && e.timestamp > untilMs) return false
      if (opts?.presetId && e.presetId !== opts.presetId) return false
      if (opts?.agentId) {
        const id = opts.agentId
        if (e.solverId !== id && e.reviewerId !== id && e.executorId !== id) return false
      }
      return true
    })

    return this.buildReport(filtered)
  }

  // ── Internal helpers ────────────────────────────────────────────────────

  private loadEvents(): PodComboEvent[] {
    try {
      if (!fs.existsSync(this.filePath)) return []
      const raw = fs.readFileSync(this.filePath, 'utf-8')
      return raw
        .split('\n')
        .filter(line => line.trim().length > 0)
        .flatMap((line) => {
          try {
            return [JSON.parse(line) as PodComboEvent]
          } catch {
            return []
          }
        })
    } catch {
      return []
    }
  }

  private buildReport(events: PodComboEvent[]): PodComboReport {
    if (events.length === 0) {
      return {
        period: { from: '', to: '' },
        totalPods: 0,
        topCombos: [],
        agentRoleStats: [],
        stageTimingOverall: { avgSolving_ms: 0, avgReviewing_ms: 0, avgExecuting_ms: 0, avgSelfFixing_ms: 0 },
        byPreset: {},
      }
    }

    const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp)
    const period = {
      from: new Date(sorted[0].timestamp).toISOString(),
      to: new Date(sorted[sorted.length - 1].timestamp).toISOString(),
    }

    // Group by combo
    const comboMap = new Map<string, PodComboEvent[]>()
    for (const e of sorted) {
      const arr = comboMap.get(e.comboKey) ?? []
      arr.push(e)
      comboMap.set(e.comboKey, arr)
    }

    const topCombos = this.buildComboStats(comboMap)

    // Per-preset breakdown
    const presetMap = new Map<string, Map<string, PodComboEvent[]>>()
    for (const e of sorted) {
      if (!presetMap.has(e.presetId)) presetMap.set(e.presetId, new Map())
      const inner = presetMap.get(e.presetId)!
      const arr = inner.get(e.comboKey) ?? []
      arr.push(e)
      inner.set(e.comboKey, arr)
    }
    const byPreset: Record<string, ComboStats[]> = {}
    for (const [preset, innerMap] of presetMap) {
      byPreset[preset] = this.buildComboStats(innerMap)
    }

    // Agent role stats
    const agentRoleStats = this.buildAgentRoleStats(sorted)

    // Overall stage timing
    const stageTimingOverall = {
      avgSolving_ms: sorted.reduce((s, e) => s + e.stageDurations.solving_ms, 0) / sorted.length,
      avgReviewing_ms: sorted.reduce((s, e) => s + e.stageDurations.reviewing_ms, 0) / sorted.length,
      avgExecuting_ms: sorted.reduce((s, e) => s + e.stageDurations.executing_ms, 0) / sorted.length,
      avgSelfFixing_ms: sorted.reduce((s, e) => s + e.stageDurations.selfFixing_ms, 0) / sorted.length,
    }

    return { period, totalPods: sorted.length, topCombos, agentRoleStats, stageTimingOverall, byPreset }
  }

  private buildComboStats(comboMap: Map<string, PodComboEvent[]>): ComboStats[] {
    const stats: ComboStats[] = []

    for (const [key, events] of comboMap) {
      const total = events.length
      const completed = events.filter(e => e.status === 'complete')
      const [solverId, reviewerId, executorId] = key.split('|')

      const neededRework = events.filter(e => e.iterations > 1 || e.selfFixed)

      stats.push({
        comboKey: key,
        solverId,
        reviewerId,
        executorId,
        totalRuns: total,
        completed: completed.length,
        successRate: completed.length / total,
        avgIterations: events.reduce((s, e) => s + e.iterations, 0) / total,
        avgCompletionTime_ms: events.reduce((s, e) => s + e.completionTime_ms, 0) / total,
        firstPassRate: completed.length > 0
          ? completed.filter(e => e.firstPassAccepted).length / completed.length
          : 0,
        executorPassRate: events.filter(e => e.executorPassed).length / total,
        selfFixRate: neededRework.length > 0
          ? neededRework.filter(e => e.selfFixed).length / neededRework.length
          : 0,
        avgStageDurations: {
          solving_ms: events.reduce((s, e) => s + e.stageDurations.solving_ms, 0) / total,
          reviewing_ms: events.reduce((s, e) => s + e.stageDurations.reviewing_ms, 0) / total,
          executing_ms: events.reduce((s, e) => s + e.stageDurations.executing_ms, 0) / total,
          selfFixing_ms: events.reduce((s, e) => s + e.stageDurations.selfFixing_ms, 0) / total,
        },
      })
    }

    // Sort: successRate desc, then avgCompletionTime asc
    stats.sort((a, b) => b.successRate - a.successRate || a.avgCompletionTime_ms - b.avgCompletionTime_ms)
    return stats
  }

  private buildAgentRoleStats(events: PodComboEvent[]): AgentRoleStats[] {
    const agentIds = new Set<string>()
    for (const e of events) {
      agentIds.add(e.solverId)
      agentIds.add(e.reviewerId)
      agentIds.add(e.executorId)
    }

    const stats: AgentRoleStats[] = []
    for (const agentId of agentIds) {
      const asSolver = events.filter(e => e.solverId === agentId)
      const asReviewer = events.filter(e => e.reviewerId === agentId)
      const asExecutor = events.filter(e => e.executorId === agentId)

      const solverCompleted = asSolver.filter(e => e.status === 'complete')
      const reviewerCompleted = asReviewer.filter(e => e.status === 'complete')
      const executorCompleted = asExecutor.filter(e => e.status === 'complete')
      const executorRework = asExecutor.filter(e => e.iterations > 1 || e.selfFixed)

      stats.push({
        agentId,
        asSolver: {
          runs: asSolver.length,
          successRate: asSolver.length > 0 ? solverCompleted.length / asSolver.length : 0,
          avgDuration_ms: asSolver.length > 0
            ? asSolver.reduce((s, e) => s + e.stageDurations.solving_ms, 0) / asSolver.length
            : 0,
        },
        asReviewer: {
          runs: asReviewer.length,
          successRate: asReviewer.length > 0 ? reviewerCompleted.length / asReviewer.length : 0,
          firstPassRate: reviewerCompleted.length > 0
            ? reviewerCompleted.filter(e => e.firstPassAccepted).length / reviewerCompleted.length
            : 0,
          avgDuration_ms: asReviewer.length > 0
            ? asReviewer.reduce((s, e) => s + e.stageDurations.reviewing_ms, 0) / asReviewer.length
            : 0,
        },
        asExecutor: {
          runs: asExecutor.length,
          successRate: asExecutor.length > 0 ? executorCompleted.length / asExecutor.length : 0,
          passRate: asExecutor.length > 0
            ? asExecutor.filter(e => e.executorPassed).length / asExecutor.length
            : 0,
          selfFixRate: executorRework.length > 0
            ? executorRework.filter(e => e.selfFixed).length / executorRework.length
            : 0,
          avgDuration_ms: asExecutor.length > 0
            ? asExecutor.reduce((s, e) => s + e.stageDurations.executing_ms, 0) / asExecutor.length
            : 0,
        },
      })
    }

    return stats
  }

  /**
   * Suggest the best-performing agent combo with at least `minRuns` completed runs.
   * Optionally filter by preset. Returns null if no combo qualifies.
   */
  suggestBestCombo(opts?: { presetId?: string; minRuns?: number }): ComboStats | null {
    const minRuns = opts?.minRuns ?? 3
    const report = this.report(opts?.presetId ? { presetId: opts.presetId } : undefined)

    const qualified = report.topCombos.filter(c => c.totalRuns >= minRuns)
    if (qualified.length === 0) return null

    // topCombos is already sorted by successRate desc, avgCompletionTime asc
    return qualified[0]
  }
}

// ── Singleton ───────────────────────────────────────────────────────────────

export const podComboCollector = new PodComboCollector()
