/**
 * EvalHarness — Task outcome tracking and agent performance reporting
 *
 * Records task pass/fail outcomes to a JSONL file and computes per-agent
 * metrics: success rate, avg duration, streaks, priority breakdown.
 */

import fs from 'fs'
import path from 'path'

// ── Types ───────────────────────────────────────────────────────────────────

export interface TaskOutcome {
  taskId: string
  agentId: string
  status: 'completed' | 'failed'
  priority: 'critical' | 'high' | 'normal' | 'low'
  startedAt: string
  completedAt: string
  retryCount: number
  duration_ms: number
  /** Primary skill from the task, when available (e.g. first entry in requiredSkills). */
  taskType?: string
}

export interface AgentEvalReport {
  agentId: string
  period: { from: string; to: string }
  totalTasks: number
  successRate: number          // 0-1
  avgDuration_ms: number
  byPriority: Record<string, { total: number; passed: number }>
  currentStreak: number        // consecutive successes from the end
  longestStreak: number
}

// ── EvalHarness ─────────────────────────────────────────────────────────────

export class EvalHarness {
  private outcomesPath: string

  constructor(outcomesPath?: string) {
    const dataDir = outcomesPath
      ? path.dirname(outcomesPath)
      : path.resolve(__dirname, '..', '..', '..', 'data')
    this.outcomesPath = outcomesPath ?? path.join(dataDir, 'eval-outcomes.jsonl')

    // Ensure data directory exists
    const dir = path.dirname(this.outcomesPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
  }

  async record(outcome: TaskOutcome): Promise<void> {
    const line = JSON.stringify(outcome) + '\n'
    fs.appendFileSync(this.outcomesPath, line, 'utf-8')
  }

  async reportByAgent(agentId: string, since?: Date): Promise<AgentEvalReport> {
    const allOutcomes = this.loadOutcomes()
    const sinceMs = since ? since.getTime() : 0

    const outcomes = allOutcomes.filter(o => {
      if (o.agentId !== agentId) return false
      if (sinceMs > 0 && new Date(o.completedAt).getTime() < sinceMs) return false
      return true
    })

    return this.buildReport(agentId, outcomes)
  }

  async reportAll(since?: Date): Promise<AgentEvalReport[]> {
    const allOutcomes = this.loadOutcomes()
    const sinceMs = since ? since.getTime() : 0

    const filtered = sinceMs > 0
      ? allOutcomes.filter(o => new Date(o.completedAt).getTime() >= sinceMs)
      : allOutcomes

    // Group by agent
    const agentIds = [...new Set(filtered.map(o => o.agentId))]
    const reports = agentIds.map(id => {
      const agentOutcomes = filtered.filter(o => o.agentId === id)
      return this.buildReport(id, agentOutcomes)
    })

    // Sort by success rate desc, then volume desc, then agent id asc for stable output.
    return reports.sort((a, b) => {
      if (b.successRate !== a.successRate) return b.successRate - a.successRate
      if (b.totalTasks !== a.totalTasks) return b.totalTasks - a.totalTasks
      return a.agentId.localeCompare(b.agentId)
    })
  }

  async experimentVelocity(_since?: Date): Promise<number> {
    // TODO: Track config changes per week once config change events are available
    return 0
  }

  // ── Internal helpers ────────────────────────────────────────────────────

  private loadOutcomes(): TaskOutcome[] {
    try {
      if (!fs.existsSync(this.outcomesPath)) return []
      const raw = fs.readFileSync(this.outcomesPath, 'utf-8')
      return raw
        .split('\n')
        .filter(line => line.trim().length > 0)
        .flatMap((line) => {
          try {
            return [JSON.parse(line) as TaskOutcome]
          } catch {
            // Ignore malformed rows so one bad line doesn't block reporting.
            return []
          }
        })
    } catch {
      return []
    }
  }

  private buildReport(agentId: string, outcomes: TaskOutcome[]): AgentEvalReport {
    if (outcomes.length === 0) {
      return {
        agentId,
        period: { from: '', to: '' },
        totalTasks: 0,
        successRate: 0,
        avgDuration_ms: 0,
        byPriority: {},
        currentStreak: 0,
        longestStreak: 0,
      }
    }

    // Sort chronologically for streak calculation
    const sorted = [...outcomes].sort(
      (a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime(),
    )

    const totalTasks = sorted.length
    const passed = sorted.filter(o => o.status === 'completed').length
    const successRate = passed / totalTasks
    const avgDuration_ms = sorted.reduce((sum, o) => sum + o.duration_ms, 0) / totalTasks

    // Priority breakdown
    const byPriority: Record<string, { total: number; passed: number }> = {}
    for (const o of sorted) {
      if (!byPriority[o.priority]) {
        byPriority[o.priority] = { total: 0, passed: 0 }
      }
      byPriority[o.priority].total++
      if (o.status === 'completed') byPriority[o.priority].passed++
    }

    // Streak calculation
    let currentStreak = 0
    let longestStreak = 0
    let streak = 0

    for (const o of sorted) {
      if (o.status === 'completed') {
        streak++
        if (streak > longestStreak) longestStreak = streak
      } else {
        streak = 0
      }
    }
    currentStreak = streak // streak at the end of the sorted list

    const period = {
      from: sorted[0].completedAt,
      to: sorted[sorted.length - 1].completedAt,
    }

    return {
      agentId,
      period,
      totalTasks,
      successRate,
      avgDuration_ms,
      byPriority,
      currentStreak,
      longestStreak,
    }
  }
}

// ── Singleton ───────────────────────────────────────────────────────────────

export const evalHarness = new EvalHarness()
