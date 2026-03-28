/**
 * Eval dashboard aggregates from `Penny/data/eval-results.json`: a JSON array of {@link EvalTaskResult}.
 * (Distinct from JSONL harness reports under `evals:harness-*` IPC.)
 */
import fs from 'fs'
import path from 'path'
import type { TaskOutcome } from './evals/harness'

const DATA_DIR = path.resolve(__dirname, '..', '..', 'data')
const OUTCOMES_FILE = path.join(DATA_DIR, 'eval-outcomes.jsonl')

export interface EvalTaskResult {
  taskId: string
  agentId: string
  agentName: string
  success: boolean
  durationMs: number
  timestamp: number
  questDifficulty?: string
}

export interface EvalAgentReport {
  agentId: string
  agentName: string
  totalTasks: number
  successCount: number
  successRate: number
  avgDurationMs: number
  streak: number
  recentOutcomes: boolean[]
  trend: 'up' | 'down' | 'flat'
}

export interface EvalStats {
  totalTasks: number
  overallSuccessRate: number
  experimentVelocity: number
  weekStart: string
}

function readResults(): EvalTaskResult[] {
  try {
    if (!fs.existsSync(OUTCOMES_FILE)) return []
    const raw = fs.readFileSync(OUTCOMES_FILE, 'utf-8')
    const rawOutcomes = raw
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as TaskOutcome)
    return rawOutcomes.map((outcome) => ({
      taskId: outcome.taskId,
      agentId: outcome.agentId,
      agentName: outcome.agentId,
      success: outcome.status === 'completed',
      durationMs: outcome.duration_ms,
      timestamp: new Date(outcome.completedAt).getTime(),
      questDifficulty: outcome.priority,
    }))
  } catch {
    return []
  }
}

function computeStreak(results: EvalTaskResult[]): number {
  if (results.length === 0) return 0
  const sorted = [...results].sort((a, b) => b.timestamp - a.timestamp)
  const first = sorted[0].success
  let count = 0
  for (const r of sorted) {
    if (r.success === first) count++
    else break
  }
  return first ? count : -count
}

function computeTrend(results: EvalTaskResult[]): 'up' | 'down' | 'flat' {
  if (results.length < 10) return 'flat'
  const sorted = [...results].sort((a, b) => b.timestamp - a.timestamp)
  const recent = sorted.slice(0, 10)
  const previous = sorted.slice(10, 20)
  if (previous.length === 0) return 'flat'
  const recentRate = recent.filter(r => r.success).length / recent.length
  const previousRate = previous.filter(r => r.success).length / previous.length
  const diff = recentRate - previousRate
  if (diff >= 0.05) return 'up'
  if (diff <= -0.05) return 'down'
  return 'flat'
}

function buildAgentReport(agentId: string, agentName: string, results: EvalTaskResult[]): EvalAgentReport {
  const sorted = [...results].sort((a, b) => b.timestamp - a.timestamp)
  const totalTasks = results.length
  const successCount = results.filter(r => r.success).length
  const successRate = totalTasks > 0 ? successCount / totalTasks : 0
  const avgDurationMs = totalTasks > 0
    ? results.reduce((sum, r) => sum + r.durationMs, 0) / totalTasks
    : 0
  const streak = computeStreak(results)
  const recentOutcomes = sorted.slice(0, 20).map(r => r.success)
  const trend = computeTrend(results)

  return {
    agentId,
    agentName,
    totalTasks,
    successCount,
    successRate,
    avgDurationMs,
    streak,
    recentOutcomes,
    trend,
  }
}

export function getEvalReportAll(): EvalAgentReport[] {
  const results = readResults()
  const byAgent = new Map<string, EvalTaskResult[]>()
  for (const r of results) {
    const existing = byAgent.get(r.agentId) || []
    existing.push(r)
    byAgent.set(r.agentId, existing)
  }
  const reports: EvalAgentReport[] = []
  for (const [agentId, agentResults] of byAgent) {
    const name = agentResults[0]?.agentName || agentId
    reports.push(buildAgentReport(agentId, name, agentResults))
  }
  return reports.sort((a, b) => b.totalTasks - a.totalTasks)
}

export function getEvalReportAgent(agentId: string): EvalAgentReport | null {
  const results = readResults().filter(r => r.agentId === agentId)
  if (results.length === 0) return null
  const name = results[0].agentName || agentId
  return buildAgentReport(agentId, name, results)
}

export function getEvalStats(): EvalStats {
  const results = readResults()
  const totalTasks = results.length
  const overallSuccessRate = totalTasks > 0
    ? results.filter(r => r.success).length / totalTasks
    : 0

  const now = new Date()
  const dayOfWeek = now.getDay()
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - dayOfWeek)
  weekStart.setHours(0, 0, 0, 0)
  const weekStartTs = weekStart.getTime()
  const experimentVelocity = results.filter(r => r.timestamp >= weekStartTs).length

  return {
    totalTasks,
    overallSuccessRate,
    experimentVelocity,
    weekStart: weekStart.toISOString().split('T')[0],
  }
}

// Exported for tests.
export const EVAL_OUTCOMES_FILE = OUTCOMES_FILE
