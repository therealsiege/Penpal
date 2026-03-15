import fs from 'fs'
import path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import { app } from 'electron'

const execAsync = promisify(exec)

const SIDEKICK_GRAPH = path.resolve(app.getAppPath(), '..', 'sidekick-graph')
const SCHEDULE_PATH = path.join(SIDEKICK_GRAPH, 'schedule.yaml')
const STATE_PATH = path.join(SIDEKICK_GRAPH, 'data', 'scheduler-state.json')

// ── Types ───────────────────────────────────────────────────────────────────

interface JobDefinition {
  description: string
  command: string
  cron: string
  timeout: number
  enabled: boolean
  depends_on?: string[]
}

interface JobRun {
  job: string
  started_at: string
  finished_at: string
  duration_ms: number
  exit_code: number | null
  success: boolean
  stdout_tail: string
  stderr_tail: string
}

interface SchedulerState {
  last_run: Record<string, string>
  history: JobRun[]
}

export interface JobStatus {
  name: string
  description: string
  cron: string
  enabled: boolean
  last_run: string | null
  last_success: boolean | null
  next_run: string
  depends_on: string[]
}

// ── Minimal YAML Parser ────────────────────────────────────────────────────

function parseScheduleYaml(text: string): Record<string, JobDefinition> {
  const jobs: Record<string, JobDefinition> = {}
  let currentJob: string | null = null
  let currentDef: Partial<JobDefinition> = {}
  let inDependsOn = false
  const dependsList: string[] = []

  for (const rawLine of text.split('\n')) {
    const line = rawLine.replace(/#.*$/, '')
    if (!line.trim()) continue

    if (line.match(/^jobs:\s*$/)) continue

    const jobMatch = line.match(/^  ([a-z0-9_-]+):\s*$/)
    if (jobMatch) {
      if (currentJob && currentDef.command) {
        if (dependsList.length > 0) currentDef.depends_on = [...dependsList]
        jobs[currentJob] = currentDef as JobDefinition
      }
      currentJob = jobMatch[1]
      currentDef = { enabled: true, timeout: 120 }
      inDependsOn = false
      dependsList.length = 0
      continue
    }

    const propMatch = line.match(/^\s{4}([a-z_]+):\s*(.+)$/)
    if (propMatch && currentJob) {
      inDependsOn = false
      const [, key, rawVal] = propMatch
      const val = rawVal.replace(/^["']|["']$/g, '').trim()
      switch (key) {
        case 'description': currentDef.description = val; break
        case 'command': currentDef.command = val; break
        case 'cron': currentDef.cron = val; break
        case 'timeout': currentDef.timeout = parseInt(val, 10); break
        case 'enabled': currentDef.enabled = val === 'true'; break
        case 'depends_on': inDependsOn = true; break
      }
      continue
    }

    if (line.match(/^\s{4}depends_on:\s*$/) && currentJob) {
      inDependsOn = true
      continue
    }

    const listMatch = line.match(/^\s{6}-\s*(.+)$/)
    if (listMatch && inDependsOn) {
      dependsList.push(listMatch[1].trim())
      continue
    }
  }

  if (currentJob && currentDef.command) {
    if (dependsList.length > 0) currentDef.depends_on = [...dependsList]
    jobs[currentJob] = currentDef as JobDefinition
  }

  return jobs
}

// ── Cron Matching ──────────────────────────────────────────────────────────

function parseField(field: string, min: number, max: number): number[] {
  const values = new Set<number>()
  for (const part of field.split(',')) {
    if (part === '*') {
      for (let i = min; i <= max; i++) values.add(i)
    } else if (part.includes('/')) {
      const [range, stepStr] = part.split('/')
      const step = parseInt(stepStr, 10)
      let start = min, end = max
      if (range !== '*') {
        if (range.includes('-')) {
          [start, end] = range.split('-').map(Number)
        } else {
          start = parseInt(range, 10)
        }
      }
      for (let i = start; i <= end; i += step) values.add(i)
    } else if (part.includes('-')) {
      const [start, end] = part.split('-').map(Number)
      for (let i = start; i <= end; i++) values.add(i)
    } else {
      values.add(parseInt(part, 10))
    }
  }
  return [...values]
}

function cronMatches(expr: string, date: Date): boolean {
  const parts = expr.trim().split(/\s+/)
  if (parts.length !== 5) return false
  const minute = parseField(parts[0], 0, 59)
  const hour = parseField(parts[1], 0, 23)
  const dom = parseField(parts[2], 1, 31)
  const month = parseField(parts[3], 1, 12)
  const dow = parseField(parts[4], 0, 6)
  return (
    minute.includes(date.getMinutes()) &&
    hour.includes(date.getHours()) &&
    dom.includes(date.getDate()) &&
    month.includes(date.getMonth() + 1) &&
    dow.includes(date.getDay())
  )
}

function nextCronMatch(expr: string, after: Date): Date {
  const candidate = new Date(after)
  candidate.setSeconds(0, 0)
  candidate.setMinutes(candidate.getMinutes() + 1)
  const limit = 366 * 24 * 60
  for (let i = 0; i < limit; i++) {
    if (cronMatches(expr, candidate)) return candidate
    candidate.setMinutes(candidate.getMinutes() + 1)
  }
  throw new Error(`No cron match within 366 days`)
}

// ── State & Schedule ───────────────────────────────────────────────────────

function loadState(): SchedulerState {
  try {
    if (fs.existsSync(STATE_PATH)) {
      return JSON.parse(fs.readFileSync(STATE_PATH, 'utf-8'))
    }
  } catch { /* start fresh */ }
  return { last_run: {}, history: [] }
}

function loadJobs(): Record<string, JobDefinition> {
  if (!fs.existsSync(SCHEDULE_PATH)) return {}
  return parseScheduleYaml(fs.readFileSync(SCHEDULE_PATH, 'utf-8'))
}

// ── Public API ─────────────────────────────────────────────────────────────

export function getJobStatuses(): JobStatus[] {
  const jobs = loadJobs()
  const state = loadState()
  const now = new Date()

  return Object.entries(jobs).map(([name, job]) => {
    const lastRunTime = state.last_run[name] || null
    const lastResult = state.history.filter(h => h.job === name).pop()

    let nextRun: string
    try {
      nextRun = nextCronMatch(job.cron, now).toISOString()
    } catch {
      nextRun = 'unknown'
    }

    return {
      name,
      description: job.description,
      cron: job.cron,
      enabled: job.enabled,
      last_run: lastRunTime,
      last_success: lastResult?.success ?? null,
      next_run: nextRun,
      depends_on: job.depends_on || [],
    }
  })
}

export function getJobHistory(jobName?: string, limit = 20): JobRun[] {
  const state = loadState()
  const runs = jobName
    ? state.history.filter(h => h.job === jobName)
    : state.history
  return runs.slice(-limit)
}

export async function forceRunJob(jobName: string): Promise<JobRun> {
  const jobs = loadJobs()
  if (!jobs[jobName]) throw new Error(`Unknown job: ${jobName}`)

  const startedAt = new Date().toISOString()
  const start = Date.now()

  try {
    const { stdout, stderr } = await execAsync(
      `./node_modules/.bin/tsx src/scheduler/runner.ts --run --job ${jobName}`,
      { cwd: SIDEKICK_GRAPH, timeout: 600000, maxBuffer: 10 * 1024 * 1024 },
    )
    return {
      job: jobName,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      duration_ms: Date.now() - start,
      exit_code: 0,
      success: true,
      stdout_tail: stdout.split('\n').slice(-30).join('\n').trim(),
      stderr_tail: stderr.split('\n').slice(-10).join('\n').trim(),
    }
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; code?: number }
    return {
      job: jobName,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      duration_ms: Date.now() - start,
      exit_code: e.code ?? 1,
      success: false,
      stdout_tail: (e.stdout || '').split('\n').slice(-30).join('\n').trim(),
      stderr_tail: (e.stderr || '').split('\n').slice(-10).join('\n').trim(),
    }
  }
}
