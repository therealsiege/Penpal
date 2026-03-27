/**
 * Weekly Eval Digest — auto-generates a markdown report summarizing
 * agent quality metrics, preference signals, and pod quality.
 */

import fs from 'fs'
import path from 'path'
import type { TaskOutcome } from '../harness'
import { PreferenceStore } from '../../preferences/store'
import type { PreferenceEvent } from '../../preferences/types'

// ── Types ────────────────────────────────────────────────────────────────────

export interface DigestOptions {
  outcomesPath?: string
  preferencesDir?: string
  podsPath?: string
  outputDir?: string
  weekOf?: Date
}

interface WeekBounds {
  start: Date
  end: Date
  weekLabel: string
}

interface AgentWeekStats {
  agentId: string
  tasks: number
  successes: number
  successRate: number
  streak: number
}

interface PodSummary {
  total: number
  completed: number
  failed: number
  firstPass: number
  iterated: number
}

interface PreferenceSummary {
  total: number
  approve: number
  reject: number
  edit: number
  complete: number
  fail: number
}

export interface WeeklyDigestResult {
  markdown: string
  filePath: string
}

// ── Week helpers ─────────────────────────────────────────────────────────────

function getISOWeekBounds(date: Date): WeekBounds {
  const d = new Date(date)
  const day = d.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day // Monday = start of week
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + diff))
  start.setUTCHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 6)
  end.setUTCHours(23, 59, 59, 999)

  // ISO week number
  const jan4 = new Date(Date.UTC(start.getUTCFullYear(), 0, 4))
  const startOfYear = new Date(jan4)
  const dayOfYear = startOfYear.getUTCDay()
  startOfYear.setUTCDate(startOfYear.getUTCDate() - (dayOfYear === 0 ? 6 : dayOfYear - 1))
  const weekNum = Math.ceil(((start.getTime() - startOfYear.getTime()) / 86400000 + 1) / 7)
  const weekLabel = `${start.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`

  return { start, end, weekLabel }
}

function inRange(ts: string | number, start: Date, end: Date): boolean {
  const t = typeof ts === 'number' ? ts : new Date(ts).getTime()
  return t >= start.getTime() && t <= end.getTime()
}

// ── Data loaders ─────────────────────────────────────────────────────────────

function loadOutcomes(filePath: string): TaskOutcome[] {
  try {
    if (!fs.existsSync(filePath)) return []
    const raw = fs.readFileSync(filePath, 'utf-8')
    return raw
      .split('\n')
      .filter(line => line.trim().length > 0)
      .map(line => JSON.parse(line) as TaskOutcome)
  } catch {
    return []
  }
}

function filterOutcomes(outcomes: TaskOutcome[], start: Date, end: Date): TaskOutcome[] {
  return outcomes.filter(o => inRange(o.completedAt, start, end))
}

function computeAgentStats(outcomes: TaskOutcome[]): AgentWeekStats[] {
  const byAgent = new Map<string, TaskOutcome[]>()
  for (const o of outcomes) {
    const list = byAgent.get(o.agentId) ?? []
    list.push(o)
    byAgent.set(o.agentId, list)
  }

  const stats: AgentWeekStats[] = []
  for (const [agentId, agentOutcomes] of byAgent) {
    const sorted = [...agentOutcomes].sort(
      (a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime(),
    )
    const tasks = sorted.length
    const successes = sorted.filter(o => o.status === 'completed').length
    const successRate = tasks > 0 ? successes / tasks : 0

    // Current streak (consecutive successes from end)
    let streak = 0
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (sorted[i].status === 'completed') streak++
      else break
    }

    stats.push({ agentId, tasks, successes, successRate, streak })
  }

  return stats.sort((a, b) => b.successRate - a.successRate)
}

interface PodWorkflowRecord {
  id: string
  status: string
  iteration: number
  createdAt: number
}

function loadPods(filePath: string, start: Date, end: Date): PodSummary {
  const summary: PodSummary = { total: 0, completed: 0, failed: 0, firstPass: 0, iterated: 0 }
  try {
    if (!fs.existsSync(filePath)) return summary
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    const pods: PodWorkflowRecord[] = Array.isArray(raw) ? raw : []
    const filtered = pods.filter(p => inRange(p.createdAt, start, end))

    summary.total = filtered.length
    for (const p of filtered) {
      if (p.status === 'complete') {
        summary.completed++
        if (p.iteration <= 1) summary.firstPass++
        else summary.iterated++
      } else if (p.status === 'failed') {
        summary.failed++
      }
    }
  } catch { /* graceful degradation */ }
  return summary
}

async function loadPreferences(
  dataDir: string,
  start: Date,
  end: Date,
): Promise<PreferenceSummary> {
  const result: PreferenceSummary = { total: 0, approve: 0, reject: 0, edit: 0, complete: 0, fail: 0 }
  try {
    const store = new PreferenceStore(dataDir)
    for await (const event of store.query({ since: start })) {
      const ts = typeof event.timestamp === 'string'
        ? new Date(event.timestamp).getTime()
        : event.timestamp
      if (ts > end.getTime()) continue
      result.total++
      if (event.signal in result) {
        result[event.signal as keyof Omit<PreferenceSummary, 'total'>]++
      }
    }
  } catch { /* graceful degradation */ }
  return result
}

// ── Recommendations ──────────────────────────────────────────────────────────

function generateRecommendations(
  current: AgentWeekStats[],
  prior: AgentWeekStats[],
): string[] {
  const priorMap = new Map(prior.map(a => [a.agentId, a]))
  const recs: string[] = []

  for (const agent of current) {
    if (agent.successRate > 0.9 && agent.streak >= 5) {
      recs.push(`${agent.agentId} ready for increased autonomy (${pct(agent.successRate)} success, ${agent.streak}-task streak)`)
    } else if (agent.successRate < 0.6 && agent.tasks >= 3) {
      recs.push(`${agent.agentId} struggling (${pct(agent.successRate)} success) — consider retraining`)
    }
  }

  // Check for agents that went inactive
  for (const prev of prior) {
    if (!current.find(c => c.agentId === prev.agentId)) {
      recs.push(`${prev.agentId} inactive this week (had ${prev.tasks} tasks last week)`)
    }
  }

  return recs
}

// ── Formatting helpers ───────────────────────────────────────────────────────

function pct(rate: number): string {
  return `${Math.round(rate * 100)}%`
}

function trend(current: number, prior: number): string {
  const delta = Math.round((current - prior) * 100)
  if (delta > 0) return `+${delta}%`
  if (delta < 0) return `${delta}%`
  return '='
}

// ── Main generator ───────────────────────────────────────────────────────────

export async function generateWeeklyDigest(opts: DigestOptions = {}): Promise<WeeklyDigestResult> {
  const dataDir = path.resolve(__dirname, '..', '..', '..', 'data')
  const outcomesPath = opts.outcomesPath ?? path.join(dataDir, 'eval-outcomes.jsonl')
  const preferencesDir = opts.preferencesDir ?? dataDir
  const podsPath = opts.podsPath ?? path.join(dataDir, 'pod-workflows.json')

  const now = opts.weekOf ?? new Date()
  const thisWeek = getISOWeekBounds(now)
  const priorWeekDate = new Date(thisWeek.start)
  priorWeekDate.setUTCDate(priorWeekDate.getUTCDate() - 1)
  const priorWeek = getISOWeekBounds(priorWeekDate)

  // Load all outcomes and filter by week
  const allOutcomes = loadOutcomes(outcomesPath)
  const thisWeekOutcomes = filterOutcomes(allOutcomes, thisWeek.start, thisWeek.end)
  const priorWeekOutcomes = filterOutcomes(allOutcomes, priorWeek.start, priorWeek.end)

  const currentStats = computeAgentStats(thisWeekOutcomes)
  const priorStats = computeAgentStats(priorWeekOutcomes)
  const priorMap = new Map(priorStats.map(a => [a.agentId, a]))

  // Totals
  const totalTasks = thisWeekOutcomes.length
  const totalSuccess = thisWeekOutcomes.filter(o => o.status === 'completed').length
  const successRate = totalTasks > 0 ? totalSuccess / totalTasks : 0
  const priorTotal = priorWeekOutcomes.length
  const priorSuccess = priorWeekOutcomes.filter(o => o.status === 'completed').length
  const priorSuccessRate = priorTotal > 0 ? priorSuccess / priorTotal : 0

  // Preferences
  const prefs = await loadPreferences(preferencesDir, thisWeek.start, thisWeek.end)

  // Pods
  const pods = loadPods(podsPath, thisWeek.start, thisWeek.end)

  // Recommendations
  const recs = generateRecommendations(currentStats, priorStats)

  // ── Render markdown ──────────────────────────────────────────────────────

  const lines: string[] = []
  lines.push(`# Penny Weekly Eval Digest — ${thisWeek.weekLabel}`)
  lines.push('')

  // Summary
  lines.push('## Summary')
  const successTrend = priorTotal > 0
    ? `, ${trend(successRate, priorSuccessRate)} from ${pct(priorSuccessRate)}`
    : ''
  lines.push(`- ${totalTasks} tasks completed (${pct(successRate)} success rate${successTrend})`)
  lines.push(`- ${prefs.total} preference signals captured (${prefs.approve} approvals, ${prefs.reject} rejections)`)

  if (pods.total > 0) {
    const podParts = [`${pods.completed} completed`]
    if (pods.firstPass > 0) podParts.push(`${pods.firstPass} first-pass`)
    if (pods.iterated > 0) podParts.push(`${pods.iterated} with iteration`)
    if (pods.failed > 0) podParts.push(`${pods.failed} failed`)
    lines.push(`- ${pods.total} pod workflows (${podParts.join(', ')})`)
  } else {
    lines.push('- 0 pod workflows this week')
  }
  lines.push('')

  // Agent Rankings
  lines.push('## Agent Rankings')
  if (currentStats.length > 0) {
    lines.push('| Agent | Tasks | Success | Streak | Trend |')
    lines.push('|-------|-------|---------|--------|-------|')
    for (const agent of currentStats) {
      const prior = priorMap.get(agent.agentId)
      const t = prior ? trend(agent.successRate, prior.successRate) : 'new'
      lines.push(`| ${agent.agentId} | ${agent.tasks} | ${pct(agent.successRate)} | ${agent.streak} | ${t} |`)
    }
  } else {
    lines.push('No agent activity this week.')
  }
  lines.push('')

  // Pod Quality
  lines.push('## Pod Quality')
  if (pods.total > 0) {
    lines.push(`- Total: ${pods.total} | Completed: ${pods.completed} | Failed: ${pods.failed}`)
    lines.push(`- First-pass success: ${pods.firstPass} | Required iteration: ${pods.iterated}`)
  } else {
    lines.push('No pod workflows this week.')
  }
  lines.push('')

  // Experiments
  lines.push('## Experiments This Week')
  lines.push('No experiment changes tracked yet.')
  lines.push('')

  // Recommendations
  lines.push('## Recommendations')
  if (recs.length > 0) {
    for (const rec of recs) {
      lines.push(`- ${rec}`)
    }
  } else {
    lines.push('No specific recommendations this week.')
  }
  lines.push('')

  const markdown = lines.join('\n')

  // Write to vault
  const defaultOutputDir = path.resolve(__dirname, '..', '..', '..', '..', '..', 'Ventures', '1Putt', 'Weekly Digests')
  const outputDir = opts.outputDir ?? defaultOutputDir
  fs.mkdirSync(outputDir, { recursive: true })
  const fileName = `Eval Digest — ${thisWeek.weekLabel}.md`
  const filePath = path.join(outputDir, fileName)
  fs.writeFileSync(filePath, markdown, 'utf-8')

  return { markdown, filePath }
}
