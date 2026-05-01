/**
 * Workspace GC — 3-tier garbage collection for task workspaces
 *
 * Inspired by Multica's 3-tier GC strategy:
 *   Tier 1 — Completed task cleanup (finished tasks older than TTL)
 *   Tier 2 — Orphan cleanup (directories on disk not tracked in memory)
 *   Tier 3 — Artifact cleanup (node_modules, .next, etc. in stale worktrees)
 */

import path from 'path'
import fs from 'fs'
import { execFileSync } from 'child_process'
import { listWorkspaces, cleanupWorkspace } from './workspace-isolation'
import { getTaskQueue } from './dispatch-queue'
import { getDataDir } from './data-paths'

// ── Types ────────────────────────────────────────────────────────────────────

export interface GCConfig {
  completedTaskTTL: number  // ms, default 1h
  orphanTTL: number         // ms, default 24h
  artifactTTL: number       // ms, default 6h
  interval: number          // ms, default 5min
}

interface GCCounts {
  completed: number
  orphans: number
  artifacts: number
}

// ── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: GCConfig = {
  completedTaskTTL: 60 * 60 * 1000,       // 1 hour
  orphanTTL: 24 * 60 * 60 * 1000,         // 24 hours
  artifactTTL: 6 * 60 * 60 * 1000,        // 6 hours
  interval: 5 * 60 * 1000,                // 5 minutes
}

const ARTIFACT_DIRS = ['node_modules', '.next', '.turbo', 'dist', 'out', '.vite']

// ── Module state ─────────────────────────────────────────────────────────────

let config: GCConfig = { ...DEFAULT_CONFIG }
let gcTimer: ReturnType<typeof setInterval> | null = null
let totalCompleted = 0
let totalOrphans = 0
let totalArtifacts = 0
let lastRun: string | null = null

// ── Tier 1: Completed task cleanup ───────────────────────────────────────────

function runTier1(): number {
  let cleaned = 0
  const now = Date.now()
  const workspaces = listWorkspaces()
  const tasks = getTaskQueue()

  // Build a task status lookup by id
  const taskStatusMap = new Map<string, string>()
  for (const task of tasks) {
    taskStatusMap.set(task.id, task.status)
  }

  const terminalStatuses = new Set(['completed', 'failed', 'cancelled'])

  for (const ws of workspaces) {
    if (!ws.isolated) continue

    const status = taskStatusMap.get(ws.taskId)
    if (!status || !terminalStatuses.has(status)) continue

    const age = now - new Date(ws.createdAt).getTime()
    if (age > config.completedTaskTTL) {
      if (cleanupWorkspace(ws.taskId)) {
        cleaned++
      }
    }
  }

  return cleaned
}

// ── Tier 2: Orphan cleanup ───────────────────────────────────────────────────

function runTier2(): number {
  let cleaned = 0
  const now = Date.now()
  const workspacesDir = path.join(getDataDir(), 'workspaces')

  // Get set of actively tracked workspace directory names
  const workspaces = listWorkspaces()
  const trackedDirs = new Set<string>()
  for (const ws of workspaces) {
    trackedDirs.add(path.basename(ws.worktreePath))
  }

  let entries: string[]
  try {
    entries = fs.readdirSync(workspacesDir)
  } catch {
    // Directory doesn't exist — nothing to clean
    return 0
  }

  for (const entry of entries) {
    if (trackedDirs.has(entry)) continue

    const fullPath = path.join(workspacesDir, entry)

    // Check age via mtime or metadata file
    let age: number
    try {
      const metadataPath = path.join(fullPath, '.penpal-workspace.json')
      if (fs.existsSync(metadataPath)) {
        const meta = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'))
        age = now - new Date(meta.createdAt).getTime()
      } else {
        const stat = fs.statSync(fullPath)
        age = now - stat.mtimeMs
      }
    } catch {
      // Can't determine age, skip
      continue
    }

    if (age > config.orphanTTL) {
      try {
        execFileSync('git', ['worktree', 'remove', '--force', fullPath], {
          stdio: 'pipe',
        })
      } catch {
        // git worktree remove failed, try manual removal
        try {
          fs.rmSync(fullPath, { recursive: true, force: true })
        } catch {
          // Best effort
        }
      }
      cleaned++
    }
  }

  return cleaned
}

// ── Tier 3: Artifact cleanup ─────────────────────────────────────────────────

function runTier3(): number {
  let cleaned = 0
  const now = Date.now()
  const workspaces = listWorkspaces()

  for (const ws of workspaces) {
    if (!ws.isolated) continue

    const age = now - new Date(ws.createdAt).getTime()
    if (age <= config.artifactTTL) continue

    for (const artifactDir of ARTIFACT_DIRS) {
      const artifactPath = path.join(ws.worktreePath, artifactDir)
      try {
        if (fs.existsSync(artifactPath)) {
          fs.rmSync(artifactPath, { recursive: true, force: true })
          cleaned++
        }
      } catch {
        // Best effort — directory may be locked or already gone
      }
    }
  }

  return cleaned
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Run a single GC pass across all three tiers.
 */
export function runGC(): GCCounts {
  const completed = runTier1()
  const orphans = runTier2()
  const artifacts = runTier3()

  totalCompleted += completed
  totalOrphans += orphans
  totalArtifacts += artifacts
  lastRun = new Date().toISOString()

  return { completed, orphans, artifacts }
}

/**
 * Start the periodic GC timer.
 */
export function startGC(overrides?: Partial<GCConfig>): void {
  if (gcTimer) {
    clearInterval(gcTimer)
  }

  if (overrides) {
    config = { ...DEFAULT_CONFIG, ...overrides }
  }

  gcTimer = setInterval(() => {
    runGC()
  }, config.interval)
}

/**
 * Stop the periodic GC timer.
 */
export function stopGC(): void {
  if (gcTimer) {
    clearInterval(gcTimer)
    gcTimer = null
  }
}

/**
 * Get cumulative GC statistics.
 */
export function getGCStats(): {
  completed: number
  orphans: number
  artifacts: number
  lastRun: string | null
  config: GCConfig
} {
  return {
    completed: totalCompleted,
    orphans: totalOrphans,
    artifacts: totalArtifacts,
    lastRun,
    config: { ...config },
  }
}

/**
 * Reset module state — for testing only.
 */
export function _resetForTest(): void {
  stopGC()
  config = { ...DEFAULT_CONFIG }
  totalCompleted = 0
  totalOrphans = 0
  totalArtifacts = 0
  lastRun = null
}
