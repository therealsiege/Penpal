/**
 * autopilot — Scheduled recurring task system
 *
 * Inspired by Multica's autonomous operation mode. Allows users to define
 * recurring tasks that auto-enqueue on a cron-like schedule.
 *
 * ZERO side effects at import time. All filesystem access is lazy.
 */

import fs from 'fs'
import path from 'path'
import { getDataDir } from './data-paths'
import { enqueueTask } from './dispatch-queue'

// ── Types ───────────────────────────────────────────────────────────────────

export interface ScheduledTask {
  id: string
  title: string
  description: string
  project: string
  cronExpression: string // simplified: 'daily', 'hourly', 'weekly', or cron-like '0 9 * * *'
  enabled: boolean
  lastRunAt: string | null
  nextRunAt: string | null
  createdAt: string
}

export interface AutopilotConfig {
  enabled: boolean
  checkInterval: number // ms, default 60_000 (1 min)
  schedules: ScheduledTask[]
}

// ── Constants ───────────────────────────────────────────────────────────────

const CONFIG_FILENAME = 'autopilot.json'
const DEFAULT_CHECK_INTERVAL = 60_000

// ── Lazy State ──────────────────────────────────────────────────────────────

let _config: AutopilotConfig | null = null
let _timer: ReturnType<typeof setInterval> | null = null

// ── Helpers ─────────────────────────────────────────────────────────────────

function configPath(): string {
  return path.join(getDataDir(), CONFIG_FILENAME)
}

function defaultConfig(): AutopilotConfig {
  return {
    enabled: false,
    checkInterval: DEFAULT_CHECK_INTERVAL,
    schedules: [],
  }
}

function generateId(): string {
  return `sched-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Calculate the next run time for a given cron expression relative to `from`.
 *
 * Supported expressions:
 *   'hourly'  → next hour boundary
 *   'daily'   → next midnight
 *   'weekly'  → next Monday midnight
 *   '0 H * * *' → next occurrence of hour H (daily-at-hour)
 */
export function calculateNextRun(cronExpression: string, from: Date): string {
  const expr = cronExpression.trim().toLowerCase()

  if (expr === 'hourly') {
    const next = new Date(from)
    next.setUTCMinutes(0, 0, 0)
    next.setUTCHours(next.getUTCHours() + 1)
    return next.toISOString()
  }

  if (expr === 'daily') {
    const next = new Date(from)
    next.setUTCHours(0, 0, 0, 0)
    next.setUTCDate(next.getUTCDate() + 1)
    return next.toISOString()
  }

  if (expr === 'weekly') {
    const next = new Date(from)
    next.setUTCHours(0, 0, 0, 0)
    // Move forward to next Monday
    const dayOfWeek = next.getUTCDay() // 0=Sun, 1=Mon, ...
    const daysUntilMonday = dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 7 : 8 - dayOfWeek
    next.setUTCDate(next.getUTCDate() + daysUntilMonday)
    return next.toISOString()
  }

  // Cron-like: parse '0 H * * *' → daily at hour H (UTC)
  const parts = expr.split(/\s+/)
  if (parts.length === 5) {
    const hour = parseInt(parts[1], 10)
    if (!isNaN(hour) && hour >= 0 && hour <= 23) {
      const next = new Date(from)
      next.setUTCMinutes(0, 0, 0)
      if (from.getUTCHours() >= hour) {
        // Already past this hour today → next day
        next.setUTCDate(next.getUTCDate() + 1)
      }
      next.setUTCHours(hour, 0, 0, 0)
      return next.toISOString()
    }
  }

  // Fallback: treat unknown expressions as daily
  const fallback = new Date(from)
  fallback.setUTCHours(0, 0, 0, 0)
  fallback.setUTCDate(fallback.getUTCDate() + 1)
  return fallback.toISOString()
}

// ── Config Persistence ──────────────────────────────────────────────────────

export function loadAutopilotConfig(): AutopilotConfig {
  if (_config) return _config

  try {
    const fp = configPath()
    if (fs.existsSync(fp)) {
      const raw = fs.readFileSync(fp, 'utf-8')
      _config = JSON.parse(raw) as AutopilotConfig
      return _config
    }
  } catch (err) {
    console.error('[autopilot] Failed to load config:', err)
  }

  _config = defaultConfig()
  return _config
}

export function saveAutopilotConfig(config: AutopilotConfig): void {
  _config = config
  try {
    const fp = configPath()
    fs.writeFileSync(fp, JSON.stringify(config, null, 2), 'utf-8')
  } catch (err) {
    console.error('[autopilot] Failed to save config:', err)
  }
}

// ── Schedule Management ─────────────────────────────────────────────────────

export function addScheduledTask(opts: {
  title: string
  description: string
  project: string
  cronExpression: string
}): ScheduledTask {
  const config = loadAutopilotConfig()
  const now = new Date()

  const task: ScheduledTask = {
    id: generateId(),
    title: opts.title,
    description: opts.description,
    project: opts.project,
    cronExpression: opts.cronExpression,
    enabled: true,
    lastRunAt: null,
    nextRunAt: calculateNextRun(opts.cronExpression, now),
    createdAt: now.toISOString(),
  }

  config.schedules.push(task)
  saveAutopilotConfig(config)

  console.log(`[autopilot] Added scheduled task ${task.id}: "${task.title}" (${task.cronExpression})`)
  return task
}

export function removeScheduledTask(taskId: string): boolean {
  const config = loadAutopilotConfig()
  const idx = config.schedules.findIndex((s) => s.id === taskId)
  if (idx === -1) return false

  config.schedules.splice(idx, 1)
  saveAutopilotConfig(config)
  console.log(`[autopilot] Removed scheduled task ${taskId}`)
  return true
}

export function toggleScheduledTask(taskId: string, enabled: boolean): boolean {
  const config = loadAutopilotConfig()
  const task = config.schedules.find((s) => s.id === taskId)
  if (!task) return false

  task.enabled = enabled
  saveAutopilotConfig(config)
  console.log(`[autopilot] Toggled task ${taskId} → enabled=${enabled}`)
  return true
}

// ── Scheduler Engine ────────────────────────────────────────────────────────

export function checkAndEnqueue(): number {
  const config = loadAutopilotConfig()
  if (!config.enabled) return 0

  const now = new Date()
  let enqueued = 0

  for (const schedule of config.schedules) {
    if (!schedule.enabled) continue
    if (!schedule.nextRunAt) continue

    const nextRun = new Date(schedule.nextRunAt)
    if (now >= nextRun) {
      // Enqueue the task
      enqueueTask({
        title: schedule.title,
        description: schedule.description,
        project: schedule.project,
        source: 'api',
      })

      // Update schedule times
      schedule.lastRunAt = now.toISOString()
      schedule.nextRunAt = calculateNextRun(schedule.cronExpression, now)
      enqueued++

      console.log(`[autopilot] Enqueued "${schedule.title}" — next run: ${schedule.nextRunAt}`)
    }
  }

  if (enqueued > 0) {
    saveAutopilotConfig(config)
  }

  return enqueued
}

// ── Autopilot Lifecycle ─────────────────────────────────────────────────────

export function startAutopilot(): void {
  const config = loadAutopilotConfig()
  config.enabled = true
  saveAutopilotConfig(config)

  if (_timer) clearInterval(_timer)
  _timer = setInterval(() => {
    checkAndEnqueue()
  }, config.checkInterval)

  console.log(`[autopilot] Started (check every ${config.checkInterval}ms)`)
}

export function stopAutopilot(): void {
  if (_timer) {
    clearInterval(_timer)
    _timer = null
  }

  const config = loadAutopilotConfig()
  config.enabled = false
  saveAutopilotConfig(config)

  console.log('[autopilot] Stopped')
}

export function getAutopilotStatus(): {
  enabled: boolean
  scheduledTasks: ScheduledTask[]
  nextCheck: string | null
} {
  const config = loadAutopilotConfig()

  // Find the earliest nextRunAt among enabled schedules
  let nextCheck: string | null = null
  for (const s of config.schedules) {
    if (s.enabled && s.nextRunAt) {
      if (!nextCheck || s.nextRunAt < nextCheck) {
        nextCheck = s.nextRunAt
      }
    }
  }

  return {
    enabled: config.enabled,
    scheduledTasks: config.schedules,
    nextCheck,
  }
}

// ── Test Reset ──────────────────────────────────────────────────────────────

/** Reset all lazy state — for tests only. */
export function _resetForTest(): void {
  if (_timer) {
    clearInterval(_timer)
    _timer = null
  }
  _config = null
}
