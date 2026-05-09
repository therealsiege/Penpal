/**
 * Workspace GC — 3-tier garbage collection for task workspaces
 *
 * Inspired by Multica's 3-tier GC strategy:
 *   Tier 1 — Completed task cleanup (finished tasks older than TTL)
 *   Tier 2 — Orphan cleanup (directories on disk not tracked in memory)
 *   Tier 3 — Artifact cleanup (node_modules, .next, etc. in stale worktrees)
 *
 * All subprocess calls are routed through `proxyExecFile` so the main
 * thread never blocks (Electron 33 / macOS Tahoe spawn-proxy pattern).
 */

import path from 'path'
import fs from 'fs'
import { listWorkspaces, cleanupWorkspace } from './workspace-isolation'
import { getTaskQueue, type TaskStatus } from './dispatch-queue'
import { getDataDir } from './data-paths'
import { proxyExecFile } from './spawn-proxy'
import { getPipelineWorktreePaths } from './github-pipeline'

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

/**
 * Tasks in any of these statuses are still "live" — their workspace must
 * NOT be touched by the GC, even for artifact pruning.
 */
const LIVE_STATUSES: ReadonlySet<TaskStatus> = new Set<TaskStatus>([
  'queued',    // pending pickup
  'assigned',  // claimed but not yet executing
  'active',    // currently running
])

const TERMINAL_STATUSES: ReadonlySet<TaskStatus> = new Set<TaskStatus>([
  'completed',
  'failed',
  'cancelled',
])

// ── Module state ─────────────────────────────────────────────────────────────

let config: GCConfig = { ...DEFAULT_CONFIG }
let gcTimer: ReturnType<typeof setInterval> | null = null
let totalCompleted = 0
let totalOrphans = 0
let totalArtifacts = 0
let lastRun: string | null = null
let inFlight: Promise<GCCounts> | null = null

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Best-effort wrapper around cleanupWorkspace — never throws so a single
 * stuck workspace can't take down the entire GC pass.
 */
function safeCleanup(taskId: string): boolean {
  try {
    return cleanupWorkspace(taskId)
  } catch (err) {
    console.warn(`[workspace-gc] cleanupWorkspace(${taskId}) threw — continuing`, err)
    return false
  }
}

/** Build an O(1) lookup of taskId → status from the queue snapshot. */
function buildTaskStatusMap(): Map<string, TaskStatus> {
  const map = new Map<string, TaskStatus>()
  for (const task of getTaskQueue()) {
    map.set(task.id, task.status)
  }
  return map
}

// ── Tier 1: Completed task cleanup ───────────────────────────────────────────

async function runTier1(): Promise<number> {
  let cleaned = 0
  const now = Date.now()
  const workspaces = listWorkspaces()
  const taskStatusMap = buildTaskStatusMap()
  const pipelineOwnedPaths = getPipelineWorktreePaths()

  for (const ws of workspaces) {
    if (!ws.isolated) continue

    const status = taskStatusMap.get(ws.taskId)

    // Hard safety: never touch a live task's workspace.
    if (status && LIVE_STATUSES.has(status)) continue

    // Only clean workspaces whose task is in a terminal state. Workspaces
    // with no matching task are handled by Tier 2 (orphan cleanup) so we
    // don't accidentally race the dispatcher between enqueue and claim.
    if (!status || !TERMINAL_STATUSES.has(status)) continue

    if (pipelineOwnedPaths.has(ws.worktreePath)) continue

    const age = now - new Date(ws.createdAt).getTime()
    if (age > config.completedTaskTTL) {
      if (safeCleanup(ws.taskId)) {
        cleaned++
      }
    }
  }

  return cleaned
}

// ── Tier 2: Orphan cleanup ───────────────────────────────────────────────────

async function runTier2(): Promise<number> {
  let cleaned = 0
  const now = Date.now()
  const workspacesDir = path.join(getDataDir(), 'workspaces')

  // Get the set of actively tracked workspace directory names so we don't
  // remove a worktree that workspace-isolation still believes it owns.
  const trackedDirs = new Set<string>()
  for (const ws of listWorkspaces()) {
    trackedDirs.add(path.basename(ws.worktreePath))
  }

  let entries: string[]
  try {
    entries = fs.readdirSync(workspacesDir)
  } catch {
    // Directory doesn't exist yet — nothing to clean.
    return 0
  }

  for (const entry of entries) {
    if (trackedDirs.has(entry)) continue

    const fullPath = path.join(workspacesDir, entry)

    // Resolve the orphan's age. Prefer the persisted metadata file written
    // by createIsolatedWorkspace; fall back to the directory's mtime.
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
      // Can't determine age — skip rather than guess.
      continue
    }

    if (age <= config.orphanTTL) continue

    // Try the proper git path first; fall back to rmSync if the worktree
    // is corrupt, was never tracked by git, or git itself is unavailable.
    let removed = false
    try {
      await proxyExecFile(
        'git',
        ['worktree', 'remove', '--force', fullPath],
        { timeout: 30_000 },
      )
      removed = true
    } catch {
      try {
        fs.rmSync(fullPath, { recursive: true, force: true })
        removed = true
      } catch {
        // Best effort — skip and try again next pass.
      }
    }

    if (removed) cleaned++
  }

  return cleaned
}

// ── Tier 3: Artifact cleanup ─────────────────────────────────────────────────

async function runTier3(): Promise<number> {
  let cleaned = 0
  const now = Date.now()
  const workspaces = listWorkspaces()
  const taskStatusMap = buildTaskStatusMap()

  for (const ws of workspaces) {
    if (!ws.isolated) continue

    // Never strip artifacts out from under a live task — node_modules
    // rebuilds are slow and they may have an in-flight build relying on
    // .next/.turbo caches.
    const status = taskStatusMap.get(ws.taskId)
    if (status && LIVE_STATUSES.has(status)) continue

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
        // Best effort — directory may be locked or already gone.
      }
    }
  }

  return cleaned
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Run a single GC pass across all three tiers.
 *
 * Concurrent calls are coalesced — if a pass is already in flight, the
 * second caller awaits the same promise.
 */
export function runGC(): Promise<GCCounts> {
  if (inFlight) return inFlight

  inFlight = (async () => {
    try {
      const completed = await runTier1()
      const orphans = await runTier2()
      const artifacts = await runTier3()

      totalCompleted += completed
      totalOrphans += orphans
      totalArtifacts += artifacts
      lastRun = new Date().toISOString()

      return { completed, orphans, artifacts }
    } finally {
      inFlight = null
    }
  })()

  return inFlight
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
    // We intentionally don't await — the timer fires-and-forgets and
    // runGC() coalesces overlapping passes.
    runGC().catch(err => {
      console.error('[workspace-gc] pass failed:', err)
    })
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
  inFlight = null
}
