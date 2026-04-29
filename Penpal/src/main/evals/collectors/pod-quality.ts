/**
 * PodQualityCollector — Tracks pod workflow quality metrics
 *
 * Records per-workflow outcomes to a JSONL file and computes aggregated
 * metrics: reviewer first-pass acceptance, executor test pass rate,
 * self-fix rate, completion time, and per-preset breakdowns.
 *
 * Denominators (do not change without updating PR/issue #24 docs):
 * - reviewerFirstPassRate: completed pods only; fraction where first (and only) review
 *   was approve | approve-with-notes (see pods.ts finalizePodQuality).
 * - executorPassRate: all terminal pods; executorPassed false if execute never ran or failed.
 * - selfFixRate: pods with iterations > 1 only; fraction that still completed (proxy until #15
 *   exposes explicit self-fix events).
 */

import fs from 'fs'
import path from 'path'
import { getDataDir } from '../../data-paths'

// ── Types ───────────────────────────────────────────────────────────────────

export interface PodQualityEvent {
  podId: string
  presetId: string
  status: 'complete' | 'failed'
  iterations: number
  firstPassAccepted: boolean
  executorPassed: boolean
  selfFixed: boolean
  completionTime_ms: number
  timestamp: number
}

export interface PodQualityReport {
  period: { from: string; to: string }
  totalPods: number
  completionRate: number
  avgIterations: number
  reviewerFirstPassRate: number
  executorPassRate: number
  selfFixRate: number
  avgCompletionTime_ms: number
  byPreset: Record<string, {
    total: number
    completed: number
    avgIterations: number
  }>
}

// ── Collector ───────────────────────────────────────────────────────────────

export class PodQualityCollector {
  private filePath: string

  constructor(filePath?: string) {
    const dataDir = filePath
      ? path.dirname(filePath)
      : getDataDir()
    this.filePath = filePath ?? path.join(dataDir, 'eval-pod-quality.jsonl')

    const dir = path.dirname(this.filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
  }

  record(event: PodQualityEvent): void {
    const line = JSON.stringify(event) + '\n'
    fs.appendFileSync(this.filePath, line, 'utf-8')
  }

  report(since?: Date, until?: Date): PodQualityReport {
    const events = this.loadEvents()
    const sinceMs = since ? since.getTime() : 0
    const untilMs = until ? until.getTime() : Number.POSITIVE_INFINITY

    const filtered = events.filter(e => {
      if (sinceMs > 0 && e.timestamp < sinceMs) return false
      if (untilMs !== Number.POSITIVE_INFINITY && e.timestamp > untilMs) return false
      return true
    })

    return this.buildReport(filtered)
  }

  // ── Internal helpers ────────────────────────────────────────────────────

  private loadEvents(): PodQualityEvent[] {
    try {
      if (!fs.existsSync(this.filePath)) return []
      const raw = fs.readFileSync(this.filePath, 'utf-8')
      return raw
        .split('\n')
        .filter(line => line.trim().length > 0)
        .flatMap((line) => {
          try {
            return [JSON.parse(line) as PodQualityEvent]
          } catch {
            return []
          }
        })
    } catch {
      return []
    }
  }

  private buildReport(events: PodQualityEvent[]): PodQualityReport {
    if (events.length === 0) {
      return {
        period: { from: '', to: '' },
        totalPods: 0,
        completionRate: 0,
        avgIterations: 0,
        reviewerFirstPassRate: 0,
        executorPassRate: 0,
        selfFixRate: 0,
        avgCompletionTime_ms: 0,
        byPreset: {},
      }
    }

    const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp)
    const totalPods = sorted.length
    const completed = sorted.filter(e => e.status === 'complete')
    const completionRate = completed.length / totalPods

    const avgIterations = sorted.reduce((sum, e) => sum + e.iterations, 0) / totalPods

    // First-pass rate: of completed pods, how many passed on iteration 1
    const reviewerFirstPassRate = completed.length > 0
      ? completed.filter(e => e.firstPassAccepted).length / completed.length
      : 0

    const executorPassRate = sorted.filter(e => e.executorPassed).length / totalPods

    // Self-fix rate: of pods that needed rework (extra solver iterations or executor self-fix),
    // how many recovered via executor self-fix (selfFixed) vs solver-only paths.
    const neededRework = sorted.filter(e => e.iterations > 1 || e.selfFixed)
    const selfFixRate = neededRework.length > 0
      ? neededRework.filter(e => e.selfFixed).length / neededRework.length
      : 0

    const avgCompletionTime_ms = sorted.reduce((sum, e) => sum + e.completionTime_ms, 0) / totalPods

    // Per-preset breakdown
    const byPreset: Record<string, { total: number; completed: number; avgIterations: number }> = {}
    for (const e of sorted) {
      if (!byPreset[e.presetId]) {
        byPreset[e.presetId] = { total: 0, completed: 0, avgIterations: 0 }
      }
      byPreset[e.presetId].total++
      if (e.status === 'complete') byPreset[e.presetId].completed++
    }
    // Compute avgIterations per preset
    for (const preset of Object.keys(byPreset)) {
      const presetEvents = sorted.filter(e => e.presetId === preset)
      byPreset[preset].avgIterations =
        presetEvents.reduce((sum, e) => sum + e.iterations, 0) / presetEvents.length
    }

    const period = {
      from: new Date(sorted[0].timestamp).toISOString(),
      to: new Date(sorted[sorted.length - 1].timestamp).toISOString(),
    }

    return {
      period,
      totalPods,
      completionRate,
      avgIterations,
      reviewerFirstPassRate,
      executorPassRate,
      selfFixRate,
      avgCompletionTime_ms,
      byPreset,
    }
  }
}

// ── Singleton ───────────────────────────────────────────────────────────────

export const podQualityCollector = new PodQualityCollector()
