/**
 * Weekly Eval Digest — auto-generates a markdown report summarizing
 * agent quality metrics, preference signals, and pod quality.
 */

import fs from 'fs'
import path from 'path'
import type { TaskOutcome } from '../harness'
import { PreferenceStore } from '../../preferences/store'

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
  completed: number
  failed: number
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

function toTimeMs(ts: string | number): number | null {
  const parsed = typeof ts === 'number' ? ts : new Date(ts).getTime()
  return Number.isFinite(parsed) ? parsed : null
}

function inRange(ts: string | number, start: Date, end: Date): boolean {
  const value = toTimeMs(ts)
  if (value === null) return false
  return value >= start.getTime() && value <= end.getTime()
}

function getISOWeekBounds(date: Date): WeekBounds {
  const input = new Date(date.getTime())
  if (Number.isNaN(input.getTime())) {
    return getISOWeekBounds(new Date())
  }

  const day = input.getUTCDay() || 7
  const monday = new Date(input)
  monday.setUTCDate(input.getUTCDate() - day + 1)
  monday.setUTCHours(0, 0, 0, 0)

  const end = new Date(monday)
  end.setUTCDate(monday.getUTCDate() + 6)
  end.setUTCHours(23, 59, 59, 999)

  const thursday = new Date(monday)
  thursday.setUTCDate(monday.getUTCDate() + 3)
  const isoYear = thursday.getUTCFullYear()
  const jan4 = new Date(Date.UTC(isoYear, 0, 4))
  const jan4Day = jan4.getUTCDay() || 7
  const firstWeekMonday = new Date(jan4)
  firstWeekMonday.setUTCDate(jan4.getUTCDate() - jan4Day + 1)
  const weekNum = Math.floor((monday.getTime() - firstWeekMonday.getTime()) / (7 * 86400000)) + 1

  return {
    start: monday,
    end,
    weekLabel: `${isoYear}-W${String(weekNum).padStart(2, '0')}`,
  }
}

function getPriorWeek(bounds: WeekBounds): WeekBounds {
  const priorAnchor = new Date(bounds.start)
  priorAnchor.setUTCDate(bounds.start.getUTCDate() - 1)
  return getISOWeekBounds(priorAnchor)
}

function loadOutcomes(filePath: string): TaskOutcome[] {
  try {
    if (!fs.existsSync(filePath)) return []
    const raw = fs.readFileSync(filePath, 'utf-8')
    return raw
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .flatMap((line) => {
        try {
          return [JSON.parse(line) as TaskOutcome]
        } catch {
          return []
        }
      })
  } catch {
    return []
  }
}

function filterOutcomes(outcomes: TaskOutcome[], start: Date, end: Date): TaskOutcome[] {
  return outcomes.filter((o) => inRange(o.completedAt, start, end))
}

function computeAgentStats(outcomes: TaskOutcome[]): AgentWeekStats[] {
  const byAgent = new Map<string, TaskOutcome[]>()
  for (const outcome of outcomes) {
    if (!outcome.agentId) continue
    const list = byAgent.get(outcome.agentId) ?? []
    list.push(outcome)
    byAgent.set(outcome.agentId, list)
  }

  const stats: AgentWeekStats[] = []
  for (const [agentId, rows] of byAgent) {
    const sorted = [...rows].sort((a, b) => (toTimeMs(a.completedAt) ?? 0) - (toTimeMs(b.completedAt) ?? 0))
    const tasks = sorted.length
    const completed = sorted.filter((row) => row.status === 'completed').length
    const failed = sorted.filter((row) => row.status === 'failed').length
    const successRate = tasks > 0 ? completed / tasks : 0

    let streak = 0
    for (let i = sorted.length - 1; i >= 0; i -= 1) {
      if (sorted[i].status === 'completed') streak += 1
      else break
    }

    stats.push({ agentId, tasks, completed, failed, successRate, streak })
  }

  return stats.sort((a, b) => {
    if (b.successRate !== a.successRate) return b.successRate - a.successRate
    if (b.tasks !== a.tasks) return b.tasks - a.tasks
    return a.agentId.localeCompare(b.agentId)
  })
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
    const pods: PodWorkflowRecord[] = Array.isArray(raw)
      ? raw.filter((pod): pod is PodWorkflowRecord => (
        typeof pod?.id === 'string' &&
        typeof pod?.status === 'string' &&
        typeof pod?.iteration === 'number' &&
        typeof pod?.createdAt === 'number'
      ))
      : []

    for (const pod of pods) {
      if (!inRange(pod.createdAt, start, end)) continue
      summary.total += 1
      if (pod.status === 'complete') {
        summary.completed += 1
        if (pod.iteration <= 1) summary.firstPass += 1
        else summary.iterated += 1
      } else if (pod.status === 'failed') {
        summary.failed += 1
      }
    }
  } catch {
    return summary
  }
  return summary
}

async function loadPreferences(dataDir: string, start: Date, end: Date): Promise<PreferenceSummary> {
  const summary: PreferenceSummary = { total: 0, approve: 0, reject: 0, edit: 0, complete: 0, fail: 0 }
  try {
    const store = new PreferenceStore(dataDir)
    for await (const event of store.query({ since: start })) {
      const ts = toTimeMs(event.timestamp)
      if (ts === null || ts > end.getTime()) continue
      summary.total += 1
      if (event.signal in summary) {
        summary[event.signal as keyof Omit<PreferenceSummary, 'total'>] += 1
      }
    }
  } catch {
    return summary
  }
  return summary
}

function pct(rate: number): string {
  return `${Math.round(rate * 100)}%`
}

function trend(current: number, prior: number): string {
  const delta = Math.round((current - prior) * 100)
  if (delta > 0) return `+${delta}%`
  if (delta < 0) return `${delta}%`
  return '='
}

function generateRecommendations(current: AgentWeekStats[], prior: AgentWeekStats[]): string[] {
  const recs: string[] = []
  for (const agent of current) {
    if (agent.successRate > 0.9 && agent.streak >= 5) {
      recs.push(`${agent.agentId} ready for increased autonomy (${pct(agent.successRate)} success, ${agent.streak}-task streak)`)
    } else if (agent.successRate < 0.6 && agent.tasks >= 3) {
      recs.push(`${agent.agentId} struggling (${pct(agent.successRate)} success) — consider retraining`)
    }
  }

  for (const priorAgent of prior) {
    if (!current.find((agent) => agent.agentId === priorAgent.agentId)) {
      recs.push(`${priorAgent.agentId} inactive this week (had ${priorAgent.tasks} tasks last week)`)
    }
  }
  return recs
}

export async function generateWeeklyDigest(opts: DigestOptions = {}): Promise<WeeklyDigestResult> {
  const dataDir = path.resolve(__dirname, '..', '..', '..', 'data')
  const outcomesPath = opts.outcomesPath ?? path.join(dataDir, 'eval-outcomes.jsonl')
  const preferencesDir = opts.preferencesDir ?? dataDir
  const podsPath = opts.podsPath ?? path.join(dataDir, 'pod-workflows.json')

  const thisWeek = getISOWeekBounds(opts.weekOf && Number.isFinite(opts.weekOf.getTime()) ? opts.weekOf : new Date())
  const priorWeek = getPriorWeek(thisWeek)

  const allOutcomes = loadOutcomes(outcomesPath)
  const thisWeekOutcomes = filterOutcomes(allOutcomes, thisWeek.start, thisWeek.end)
  const priorWeekOutcomes = filterOutcomes(allOutcomes, priorWeek.start, priorWeek.end)
  const currentStats = computeAgentStats(thisWeekOutcomes)
  const priorStats = computeAgentStats(priorWeekOutcomes)
  const priorByAgent = new Map(priorStats.map((agent) => [agent.agentId, agent]))

  const totalTasks = thisWeekOutcomes.length
  const totalSuccess = thisWeekOutcomes.filter((outcome) => outcome.status === 'completed').length
  const totalFailed = thisWeekOutcomes.filter((outcome) => outcome.status === 'failed').length
  const successRate = totalTasks > 0 ? totalSuccess / totalTasks : 0
  const priorTotal = priorWeekOutcomes.length
  const priorSuccess = priorWeekOutcomes.filter((outcome) => outcome.status === 'completed').length
  const priorSuccessRate = priorTotal > 0 ? priorSuccess / priorTotal : 0

  const prefs = await loadPreferences(preferencesDir, thisWeek.start, thisWeek.end)
  const pods = loadPods(podsPath, thisWeek.start, thisWeek.end)
  const recs = generateRecommendations(currentStats, priorStats)

  const lines: string[] = []
  lines.push(`# Penny Weekly Eval Digest — ${thisWeek.weekLabel}`)
  lines.push('')
  lines.push('## Summary')
  const successTrend = priorTotal > 0 ? `, ${trend(successRate, priorSuccessRate)} from ${pct(priorSuccessRate)}` : ''
  lines.push(`- ${totalTasks} tasks completed (${pct(successRate)} success rate${successTrend}, ${totalFailed} failed)`)
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

  lines.push('## Agent Rankings')
  if (currentStats.length > 0) {
    lines.push('| Agent | Tasks | Success | Streak | Trend |')
    lines.push('|-------|-------|---------|--------|-------|')
    for (const agent of currentStats) {
      const previous = priorByAgent.get(agent.agentId)
      const agentTrend = previous ? trend(agent.successRate, previous.successRate) : 'new'
      lines.push(`| ${agent.agentId} | ${agent.tasks} | ${pct(agent.successRate)} | ${agent.streak} | ${agentTrend} |`)
    }
  } else {
    lines.push('No agent activity this week.')
  }
  lines.push('')

  lines.push('## Experiments This Week')
  lines.push('No experiment changes tracked yet.')
  lines.push('')

  lines.push('## Pod Quality')
  if (pods.total > 0) {
    lines.push(`- Total: ${pods.total} | Completed: ${pods.completed} | Failed: ${pods.failed}`)
    lines.push(`- First-pass completions: ${pods.firstPass} | Iterated completions: ${pods.iterated}`)
  } else {
    lines.push('No pod workflows this week.')
  }
  lines.push('')

  lines.push('## Recommendations')
  if (recs.length > 0) {
    for (const rec of recs) lines.push(`- ${rec}`)
  } else {
    lines.push('No specific recommendations this week.')
  }
  lines.push('')

  const markdown = lines.join('\n')
  const defaultOutputDir = path.resolve(__dirname, '..', '..', '..', '..', '..', 'Ventures', '1Putt', 'Weekly Digests')
  const outputDir = opts.outputDir ?? defaultOutputDir
  fs.mkdirSync(outputDir, { recursive: true })
  const filePath = path.join(outputDir, `Eval Digest — ${thisWeek.weekLabel}.md`)
  fs.writeFileSync(filePath, markdown, 'utf-8')
  return { markdown, filePath }
}
