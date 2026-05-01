# Multica-Inspired Improvements — Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Apply 5 operational robustness improvements inspired by Multica's architecture to Penpal's dispatch system: workspace isolation, garbage collection, heartbeat-based health, pull-model task claiming, and autopilot scheduling.

**Architecture:** Each improvement is a standalone module with its own tests. Changes are additive — no existing behavior is removed, just enhanced. The dispatch-loop and pods are updated to use the new modules.

**Tech Stack:** TypeScript, Node.js, Vitest, git worktree, existing Penpal modules.

---

## Phase 1: Workspace Isolation (git worktree per task)

### Task 1: Create workspace-isolation module

**Objective:** Create a module that manages isolated git worktrees per task/pod, eliminating file conflicts between concurrent agents.

**Files:**
- Create: `src/main/workspace-isolation.ts`

**Step 1: Write the module**

```typescript
/**
 * workspace-isolation.ts — Isolated git worktree per task/pod.
 *
 * Inspired by Multica's per-task workspace directory isolation.
 * Instead of all agents sharing the same project directory (requiring
 * flight-board conflict detection), each task gets its own git worktree.
 *
 * Flow:
 *   1. createIsolatedWorkspace(projectPath, taskId, branch?) → worktreePath
 *   2. Agent works in worktreePath (isolated copy, shared git objects)
 *   3. cleanupWorkspace(worktreePath) removes worktree after completion
 *
 * Falls back gracefully: if git worktree fails (not a git repo, etc.),
 * returns the original project path (existing behavior).
 */

import { execFileSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { getDataDir } from './data-paths'

export interface WorkspaceInfo {
  worktreePath: string
  branch: string
  taskId: string
  projectPath: string
  createdAt: string
  isolated: boolean  // false if fallback to shared dir
}

// Module state
const activeWorkspaces = new Map<string, WorkspaceInfo>()

function getWorkspacesRoot(): string {
  const root = path.join(getDataDir(), 'workspaces')
  fs.mkdirSync(root, { recursive: true })
  return root
}

function isGitRepo(dir: string): boolean {
  try {
    execFileSync('git', ['rev-parse', '--is-inside-work-tree'], {
      cwd: dir, encoding: 'utf-8', timeout: 5000,
    })
    return true
  } catch { return false }
}

/**
 * Create an isolated git worktree for a task.
 * Returns the worktree path on success, or the original path on failure.
 */
export function createIsolatedWorkspace(
  projectPath: string,
  taskId: string,
  branch?: string,
): WorkspaceInfo {
  const sanitizedId = taskId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64)
  const worktreeDir = path.join(getWorkspacesRoot(), sanitizedId)

  if (!isGitRepo(projectPath)) {
    console.warn(`[workspace] ${projectPath} is not a git repo, using shared dir`)
    const info: WorkspaceInfo = {
      worktreePath: projectPath,
      branch: '',
      taskId,
      projectPath,
      createdAt: new Date().toISOString(),
      isolated: false,
    }
    activeWorkspaces.set(taskId, info)
    return info
  }

  try {
    // Clean up stale worktree at same path if it exists
    if (fs.existsSync(worktreeDir)) {
      try { execFileSync('git', ['worktree', 'remove', '--force', worktreeDir], { cwd: projectPath, timeout: 10000 }) } catch { /* ok */ }
      fs.rmSync(worktreeDir, { recursive: true, force: true })
    }

    const branchName = branch || `penpal/task-${sanitizedId}`

    // Create branch from HEAD if it doesn't exist
    try {
      execFileSync('git', ['branch', branchName], { cwd: projectPath, encoding: 'utf-8', timeout: 5000 })
    } catch {
      // Branch already exists — that's fine
    }

    // Create worktree
    execFileSync('git', ['worktree', 'add', worktreeDir, branchName], {
      cwd: projectPath, encoding: 'utf-8', timeout: 30000,
    })

    const info: WorkspaceInfo = {
      worktreePath: worktreeDir,
      branch: branchName,
      taskId,
      projectPath,
      createdAt: new Date().toISOString(),
      isolated: true,
    }
    activeWorkspaces.set(taskId, info)

    // Write metadata for GC
    fs.writeFileSync(
      path.join(worktreeDir, '.penpal-workspace.json'),
      JSON.stringify(info, null, 2),
    )

    console.log(`[workspace] Created isolated worktree for ${taskId}: ${worktreeDir}`)
    return info
  } catch (err) {
    console.error(`[workspace] Failed to create worktree, falling back to shared dir:`, err)
    const info: WorkspaceInfo = {
      worktreePath: projectPath,
      branch: '',
      taskId,
      projectPath,
      createdAt: new Date().toISOString(),
      isolated: false,
    }
    activeWorkspaces.set(taskId, info)
    return info
  }
}

/** Remove a worktree after task completion. */
export function cleanupWorkspace(taskId: string): boolean {
  const info = activeWorkspaces.get(taskId)
  if (!info) return false

  activeWorkspaces.delete(taskId)

  if (!info.isolated) return true  // nothing to clean up

  try {
    execFileSync('git', ['worktree', 'remove', '--force', info.worktreePath], {
      cwd: info.projectPath, encoding: 'utf-8', timeout: 15000,
    })
    console.log(`[workspace] Removed worktree for ${taskId}`)
  } catch (err) {
    console.warn(`[workspace] git worktree remove failed, removing dir directly:`, err)
    try { fs.rmSync(info.worktreePath, { recursive: true, force: true }) } catch { /* best effort */ }
  }

  return true
}

/** Get workspace info for a task. */
export function getWorkspace(taskId: string): WorkspaceInfo | undefined {
  return activeWorkspaces.get(taskId)
}

/** List all active workspaces. */
export function listWorkspaces(): WorkspaceInfo[] {
  return Array.from(activeWorkspaces.values())
}

/** Reset all state (for tests). */
export function _resetForTest(): void {
  activeWorkspaces.clear()
}
```

**Step 2: Commit**

```bash
git add src/main/workspace-isolation.ts
git commit -m "feat: add workspace-isolation module for per-task git worktrees"
```

---

### Task 2: Write tests for workspace-isolation

**Objective:** Test workspace creation, cleanup, and fallback behavior.

**Files:**
- Create: `src/main/__tests__/workspace-isolation.test.ts`

**Step 1: Write tests**

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock child_process and fs before import
vi.mock('child_process', () => ({
  execFileSync: vi.fn(),
}))

vi.mock('./data-paths', () => ({
  getDataDir: () => '/tmp/penpal-test-data',
}))

import { execFileSync } from 'child_process'
import {
  createIsolatedWorkspace,
  cleanupWorkspace,
  getWorkspace,
  listWorkspaces,
  _resetForTest,
} from '../workspace-isolation'

const mockExecFileSync = vi.mocked(execFileSync)

describe('workspace-isolation', () => {
  beforeEach(() => {
    _resetForTest()
    vi.clearAllMocks()
  })

  afterEach(() => {
    _resetForTest()
  })

  it('creates an isolated worktree for a git repo', () => {
    // isGitRepo check
    mockExecFileSync.mockImplementation((cmd, args) => {
      if (args?.includes('--is-inside-work-tree')) return 'true\n' as any
      return '' as any
    })

    const info = createIsolatedWorkspace('/home/user/project', 'task-123')

    expect(info.taskId).toBe('task-123')
    expect(info.isolated).toBe(true)
    expect(info.worktreePath).toContain('task-123')
    expect(info.projectPath).toBe('/home/user/project')
  })

  it('falls back to shared dir for non-git repos', () => {
    mockExecFileSync.mockImplementation(() => { throw new Error('not a git repo') })

    const info = createIsolatedWorkspace('/home/user/non-git', 'task-456')

    expect(info.isolated).toBe(false)
    expect(info.worktreePath).toBe('/home/user/non-git')
  })

  it('tracks active workspaces', () => {
    mockExecFileSync.mockImplementation(() => { throw new Error('not git') })

    createIsolatedWorkspace('/path', 'task-a')
    createIsolatedWorkspace('/path', 'task-b')

    expect(listWorkspaces()).toHaveLength(2)
    expect(getWorkspace('task-a')).toBeDefined()
  })

  it('cleans up workspace on completion', () => {
    mockExecFileSync.mockImplementation(() => { throw new Error('not git') })
    createIsolatedWorkspace('/path', 'task-x')

    expect(cleanupWorkspace('task-x')).toBe(true)
    expect(getWorkspace('task-x')).toBeUndefined()
    expect(listWorkspaces()).toHaveLength(0)
  })

  it('returns false when cleaning up unknown task', () => {
    expect(cleanupWorkspace('nonexistent')).toBe(false)
  })
})
```

**Step 2: Run tests**

```bash
cd ~/sidekick/Penpal && timeout 30 npx vitest run src/main/__tests__/workspace-isolation.test.ts --reporter=verbose 2>&1
```
Expected: all tests pass.

**Step 3: Commit**

```bash
git add src/main/__tests__/workspace-isolation.test.ts
git commit -m "test: workspace-isolation module"
```

---

## Phase 2: Garbage Collection

### Task 3: Create workspace-gc module

**Objective:** Automatically clean up completed/stale task workspaces on a timer, inspired by Multica's 3-tier GC.

**Files:**
- Create: `src/main/workspace-gc.ts`

**Step 1: Write the module**

```typescript
/**
 * workspace-gc.ts — Garbage collection for task workspaces.
 *
 * Inspired by Multica's 3-tier GC:
 *   Tier 1: Completed task cleanup — remove worktrees for done/failed tasks (default: 1h)
 *   Tier 2: Orphan cleanup — remove workspace dirs without matching active task (default: 24h)
 *   Tier 3: Artifact cleanup — remove node_modules/.next/.turbo from stale worktrees (default: 6h)
 *
 * Runs on a timer (default: every 5 minutes).
 */

import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import { getDataDir } from './data-paths'
import { listWorkspaces, cleanupWorkspace, type WorkspaceInfo } from './workspace-isolation'
import { getTaskQueue, type Task } from './dispatch-queue'

// ── Config ──────────────────────────────────────────────────────────────

export interface GCConfig {
  completedTaskTTL: number    // ms before removing completed task worktrees (default: 1h)
  orphanTTL: number           // ms before removing orphan dirs (default: 24h)
  artifactTTL: number         // ms before removing build artifacts (default: 6h)
  interval: number            // ms between GC runs (default: 5min)
}

const DEFAULT_CONFIG: GCConfig = {
  completedTaskTTL: 60 * 60_000,        // 1 hour
  orphanTTL: 24 * 60 * 60_000,          // 24 hours
  artifactTTL: 6 * 60 * 60_000,         // 6 hours
  interval: 5 * 60_000,                  // 5 minutes
}

const ARTIFACT_DIRS = ['node_modules', '.next', '.turbo', 'dist', 'out', '.vite']

// ── State ───────────────────────────────────────────────────────────────

let gcTimer: ReturnType<typeof setInterval> | null = null
let config: GCConfig = { ...DEFAULT_CONFIG }
let lastGCRun: string | null = null
let gcStats = { completed: 0, orphans: 0, artifacts: 0 }

// ── GC Logic ────────────────────────────────────────────────────────────

/** Tier 1: Remove worktrees for completed/failed/cancelled tasks. */
function gcCompletedTasks(): number {
  const tasks = getTaskQueue()
  const doneStatuses = new Set(['completed', 'failed', 'cancelled'])
  const workspaces = listWorkspaces()
  let removed = 0
  const now = Date.now()

  for (const ws of workspaces) {
    if (!ws.isolated) continue

    const task = tasks.find(t => t.id === ws.taskId)
    if (!task) continue
    if (!doneStatuses.has(task.status)) continue

    const age = now - new Date(ws.createdAt).getTime()
    if (age < config.completedTaskTTL) continue

    if (cleanupWorkspace(ws.taskId)) {
      removed++
      console.log(`[gc] Removed completed task workspace: ${ws.taskId} (age: ${Math.round(age / 60000)}m)`)
    }
  }

  return removed
}

/** Tier 2: Remove orphan workspace dirs with no matching active workspace. */
function gcOrphans(): number {
  const workspacesRoot = path.join(getDataDir(), 'workspaces')
  if (!fs.existsSync(workspacesRoot)) return 0

  const activeIds = new Set(listWorkspaces().map(w => w.taskId))
  let removed = 0
  const now = Date.now()

  for (const entry of fs.readdirSync(workspacesRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const dirPath = path.join(workspacesRoot, entry.name)

    // Skip if tracked as active
    if (activeIds.has(entry.name)) continue

    // Check metadata file for creation time
    const metaPath = path.join(dirPath, '.penpal-workspace.json')
    let createdAt: number = 0
    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
      createdAt = new Date(meta.createdAt).getTime()
    } catch {
      // No metadata — use dir mtime
      try { createdAt = fs.statSync(dirPath).mtimeMs } catch { continue }
    }

    const age = now - createdAt
    if (age < config.orphanTTL) continue

    try {
      // Try git worktree remove first
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8').toString())
      if (meta.projectPath) {
        execFileSync('git', ['worktree', 'remove', '--force', dirPath], {
          cwd: meta.projectPath, timeout: 10000,
        })
      }
    } catch { /* fall through to rmSync */ }

    try {
      fs.rmSync(dirPath, { recursive: true, force: true })
      removed++
      console.log(`[gc] Removed orphan workspace: ${entry.name} (age: ${Math.round(age / 3600000)}h)`)
    } catch (err) {
      console.warn(`[gc] Failed to remove orphan ${entry.name}:`, err)
    }
  }

  return removed
}

/** Tier 3: Remove build artifacts from stale (but still tracked) worktrees. */
function gcArtifacts(): number {
  const workspaces = listWorkspaces()
  let removed = 0
  const now = Date.now()

  for (const ws of workspaces) {
    if (!ws.isolated) continue

    const age = now - new Date(ws.createdAt).getTime()
    if (age < config.artifactTTL) continue

    for (const artifactDir of ARTIFACT_DIRS) {
      const artifactPath = path.join(ws.worktreePath, artifactDir)
      if (fs.existsSync(artifactPath)) {
        try {
          fs.rmSync(artifactPath, { recursive: true, force: true })
          removed++
          console.log(`[gc] Removed artifact ${artifactDir} from ${ws.taskId}`)
        } catch { /* best effort */ }
      }
    }
  }

  return removed
}

/** Run all GC tiers. */
export function runGC(): { completed: number; orphans: number; artifacts: number } {
  const completed = gcCompletedTasks()
  const orphans = gcOrphans()
  const artifacts = gcArtifacts()

  lastGCRun = new Date().toISOString()
  gcStats = { completed: gcStats.completed + completed, orphans: gcStats.orphans + orphans, artifacts: gcStats.artifacts + artifacts }

  if (completed + orphans + artifacts > 0) {
    console.log(`[gc] Cleaned up: ${completed} completed, ${orphans} orphans, ${artifacts} artifacts`)
  }

  return { completed, orphans, artifacts }
}

/** Start the GC timer. */
export function startGC(overrides?: Partial<GCConfig>): void {
  if (gcTimer) return
  config = { ...DEFAULT_CONFIG, ...overrides }

  gcTimer = setInterval(() => {
    try { runGC() } catch (err) { console.error('[gc] GC cycle failed:', err) }
  }, config.interval)

  console.log(`[gc] Started (interval: ${config.interval / 1000}s)`)
}

/** Stop the GC timer. */
export function stopGC(): void {
  if (gcTimer) {
    clearInterval(gcTimer)
    gcTimer = null
  }
}

/** Get GC stats. */
export function getGCStats() {
  return { ...gcStats, lastRun: lastGCRun, config }
}

/** Reset for tests. */
export function _resetForTest(): void {
  stopGC()
  config = { ...DEFAULT_CONFIG }
  lastGCRun = null
  gcStats = { completed: 0, orphans: 0, artifacts: 0 }
}
```

**Step 2: Commit**

```bash
git add src/main/workspace-gc.ts
git commit -m "feat: add workspace-gc module with 3-tier garbage collection"
```

---

### Task 4: Write tests for workspace-gc

**Objective:** Test GC tiers with mocked filesystem and task queue.

**Files:**
- Create: `src/main/__tests__/workspace-gc.test.ts`

**Step 1: Write tests**

Tests should mock `dispatch-queue`, `workspace-isolation`, `data-paths`, `child_process`, and `fs`.
Test each tier independently: completed task TTL, orphan detection, artifact cleanup.
Use `vi.useFakeTimers()` for the interval timer.

**Step 2: Run and verify**

```bash
cd ~/sidekick/Penpal && timeout 30 npx vitest run src/main/__tests__/workspace-gc.test.ts --reporter=verbose
```

**Step 3: Commit**

```bash
git add src/main/__tests__/workspace-gc.test.ts
git commit -m "test: workspace-gc module"
```

---

## Phase 3: Pull-Model Task Claiming

### Task 5: Add task claiming to dispatch-queue

**Objective:** Replace push-model (dispatch loop assigns tasks) with pull-model (agents claim next available task). If agent crashes mid-claim, task stays queued.

**Files:**
- Modify: `src/main/dispatch-queue.ts` (add `claimTask` and `releaseTask`)

**Step 1: Add claim functions**

Add to `dispatch-queue.ts`:

```typescript
/**
 * Claim the next available task for an agent.
 * Pull model: agent requests work instead of being assigned.
 * If agent crashes before completing, task auto-releases via health monitor.
 */
export function claimTask(agentId: string, agentSkills: string[] = []): Task | null {
  const tasks = getTasksInternal()
  const queued = tasks
    .filter(t => t.status === 'queued')
    .sort((a, b) => (PRIORITY_ORDER[b.priority] ?? 0) - (PRIORITY_ORDER[a.priority] ?? 0))

  for (const task of queued) {
    // Check skill match
    if (task.requiredSkills.length > 0) {
      const hasSkills = task.requiredSkills.every(s => agentSkills.includes(s))
      if (!hasSkills) continue
    }

    // Check preferred agent
    if (task.preferredAgent && task.preferredAgent !== agentId) continue

    // Claim it
    task.status = 'assigned'
    task.assignedAgent = agentId
    saveTasks()
    orchestratorEvents.emit('task-dispatched', task)
    return task
  }

  return null
}

/**
 * Release a claimed task back to the queue.
 * Used when an agent crashes or times out before starting work.
 */
export function releaseTask(taskId: string): boolean {
  const tasks = getTasksInternal()
  const task = tasks.find(t => t.id === taskId)
  if (!task || task.status !== 'assigned') return false

  task.status = 'queued'
  task.assignedAgent = undefined
  task.assignedSessionId = undefined
  saveTasks()
  orchestratorEvents.emit('task-updated', task)
  return true
}
```

**Step 2: Commit**

```bash
git add src/main/dispatch-queue.ts
git commit -m "feat: add claimTask/releaseTask pull-model to dispatch-queue"
```

---

### Task 6: Update dispatch-loop to use claim model

**Objective:** Modify `dispatchLoop` to use `claimTask` instead of directly assigning. Add release-on-stuck to `healthMonitorLoop`.

**Files:**
- Modify: `src/main/dispatch-loop.ts`

**Step 1: Update dispatchLoop**

In `dispatchLoop()`, replace the current "find queued task → selectAgent → assign" logic with:
1. Get available agents (idle or no session)
2. For each available agent, call `claimTask(agentId, agentSkills)`
3. If claim succeeds, dispatch the task

**Step 2: Update healthMonitorLoop**

When an agent with an assigned task is detected as dead:
- Call `releaseTask(task.id)` instead of just marking as failed
- This lets another agent pick it up

**Step 3: Commit**

```bash
git add src/main/dispatch-loop.ts
git commit -m "refactor: dispatch-loop uses pull-model claimTask"
```

---

## Phase 4: Heartbeat-Based Health Detection

### Task 7: Add agent heartbeat tracking to dispatch-loop

**Objective:** Replace the reactive "poll ps every 30s" with proactive heartbeat tracking. Agents report heartbeats; absence = dead.

**Files:**
- Modify: `src/main/dispatch-loop.ts` (add heartbeat tracking alongside existing health monitor)

**Step 1: Add heartbeat state and functions**

```typescript
// ── Heartbeat Tracking ──────────────────────────────────────────────────

const HEARTBEAT_INTERVAL = 15_000      // agents should heartbeat every 15s
const HEARTBEAT_TIMEOUT = 45_000       // 3 missed heartbeats = dead

const agentHeartbeats = new Map<string, { lastSeen: number; taskId?: string }>()

/** Record a heartbeat from an agent. Called by agent process management. */
export function recordHeartbeat(agentId: string, taskId?: string): void {
  agentHeartbeats.set(agentId, { lastSeen: Date.now(), taskId })
}

/** Check which agents have missed their heartbeat. */
export function getStaleAgents(): string[] {
  const now = Date.now()
  const stale: string[] = []
  for (const [agentId, hb] of agentHeartbeats) {
    if (now - hb.lastSeen > HEARTBEAT_TIMEOUT) {
      stale.push(agentId)
    }
  }
  return stale
}
```

**Step 2: Integrate into healthMonitorLoop**

In the existing `healthMonitorLoop`, add:
```typescript
// Check for stale heartbeats
const staleAgents = getStaleAgents()
for (const agentId of staleAgents) {
  const hb = agentHeartbeats.get(agentId)
  if (hb?.taskId) {
    console.warn(`[health] Agent ${agentId} missed heartbeat, releasing task ${hb.taskId}`)
    releaseTask(hb.taskId)
  }
  agentHeartbeats.delete(agentId)
}
```

**Step 3: Commit**

```bash
git add src/main/dispatch-loop.ts
git commit -m "feat: heartbeat-based agent health detection"
```

---

## Phase 5: Autopilot Scheduling

### Task 8: Create autopilot module

**Objective:** Add cron-like scheduled task creation, inspired by Multica's autopilots. Enables recurring workflows (nightly test runs, weekly dependency updates).

**Files:**
- Create: `src/main/autopilot.ts`

**Step 1: Write the module**

```typescript
/**
 * autopilot.ts — Scheduled task creation (cron-like).
 *
 * Inspired by Multica's autopilot system. Define recurring workflows
 * that automatically enqueue tasks on a schedule.
 *
 * Schedules are stored as JSON in the data directory.
 * Uses a simple interval-based scheduler (not full cron parsing).
 */

import fs from 'fs'
import path from 'path'
import { getDataDir } from './data-paths'
import { enqueueTask, type TaskPriority, type TaskSource } from './dispatch-queue'

export interface AutopilotSchedule {
  id: string
  name: string
  description: string
  enabled: boolean
  intervalMs: number       // repeat interval in ms
  taskTemplate: {
    title: string
    description: string
    project: string
    priority: TaskPriority
    requiredSkills: string[]
    preferredAgent?: string
    source: TaskSource
  }
  lastRunAt: string | null
  nextRunAt: string
  runCount: number
  createdAt: string
}

// ── State ───────────────────────────────────────────────────────────────

let schedules: AutopilotSchedule[] = []
let schedulerTimer: ReturnType<typeof setInterval> | null = null
let loaded = false

const SCHEDULER_TICK = 30_000  // check every 30s

function schedulesPath(): string {
  return path.join(getDataDir(), 'autopilot-schedules.json')
}

function loadSchedules(): void {
  if (loaded) return
  try {
    const raw = fs.readFileSync(schedulesPath(), 'utf-8')
    schedules = JSON.parse(raw)
  } catch {
    schedules = []
  }
  loaded = true
}

function saveSchedules(): void {
  fs.writeFileSync(schedulesPath(), JSON.stringify(schedules, null, 2))
}

// ── CRUD ────────────────────────────────────────────────────────────────

export function createAutopilot(opts: Omit<AutopilotSchedule, 'id' | 'lastRunAt' | 'nextRunAt' | 'runCount' | 'createdAt'>): AutopilotSchedule {
  loadSchedules()
  const now = new Date()
  const schedule: AutopilotSchedule = {
    ...opts,
    id: `ap-${Date.now().toString(36)}`,
    lastRunAt: null,
    nextRunAt: new Date(now.getTime() + opts.intervalMs).toISOString(),
    runCount: 0,
    createdAt: now.toISOString(),
  }
  schedules.push(schedule)
  saveSchedules()
  return schedule
}

export function listAutopilots(): AutopilotSchedule[] {
  loadSchedules()
  return [...schedules]
}

export function getAutopilot(id: string): AutopilotSchedule | undefined {
  loadSchedules()
  return schedules.find(s => s.id === id)
}

export function updateAutopilot(id: string, updates: Partial<Pick<AutopilotSchedule, 'name' | 'description' | 'enabled' | 'intervalMs' | 'taskTemplate'>>): boolean {
  loadSchedules()
  const schedule = schedules.find(s => s.id === id)
  if (!schedule) return false
  Object.assign(schedule, updates)
  saveSchedules()
  return true
}

export function deleteAutopilot(id: string): boolean {
  loadSchedules()
  const idx = schedules.findIndex(s => s.id === id)
  if (idx === -1) return false
  schedules.splice(idx, 1)
  saveSchedules()
  return true
}

// ── Scheduler ───────────────────────────────────────────────────────────

function tick(): void {
  loadSchedules()
  const now = Date.now()

  for (const schedule of schedules) {
    if (!schedule.enabled) continue

    const nextRun = new Date(schedule.nextRunAt).getTime()
    if (now < nextRun) continue

    // Time to run
    try {
      const t = schedule.taskTemplate
      enqueueTask({
        title: `[Autopilot] ${t.title}`,
        description: `${t.description}\n\n---\nAutopilot: ${schedule.name} (run #${schedule.runCount + 1})`,
        project: t.project,
        priority: t.priority,
        requiredSkills: t.requiredSkills,
        preferredAgent: t.preferredAgent,
        source: t.source,
      })

      schedule.lastRunAt = new Date(now).toISOString()
      schedule.nextRunAt = new Date(now + schedule.intervalMs).toISOString()
      schedule.runCount++
      console.log(`[autopilot] Triggered "${schedule.name}" (run #${schedule.runCount})`)
    } catch (err) {
      console.error(`[autopilot] Failed to trigger "${schedule.name}":`, err)
    }
  }

  saveSchedules()
}

export function startAutopilotScheduler(): void {
  if (schedulerTimer) return
  schedulerTimer = setInterval(() => {
    try { tick() } catch (err) { console.error('[autopilot] Tick failed:', err) }
  }, SCHEDULER_TICK)
  console.log('[autopilot] Scheduler started')
}

export function stopAutopilotScheduler(): void {
  if (schedulerTimer) {
    clearInterval(schedulerTimer)
    schedulerTimer = null
  }
}

export function _resetForTest(): void {
  stopAutopilotScheduler()
  schedules = []
  loaded = false
}
```

**Step 2: Commit**

```bash
git add src/main/autopilot.ts
git commit -m "feat: add autopilot module for scheduled task creation"
```

---

### Task 9: Write tests for autopilot

**Objective:** Test CRUD operations and scheduler tick behavior.

**Files:**
- Create: `src/main/__tests__/autopilot.test.ts`

**Step 1: Write tests**

Mock `data-paths`, `dispatch-queue`, and `fs`. Test:
- Create/list/update/delete autopilots
- Scheduler tick enqueues task when schedule is due
- Disabled schedules are skipped
- Run count increments

**Step 2: Run and verify**

```bash
cd ~/sidekick/Penpal && timeout 30 npx vitest run src/main/__tests__/autopilot.test.ts --reporter=verbose
```

**Step 3: Commit**

```bash
git add src/main/__tests__/autopilot.test.ts
git commit -m "test: autopilot module"
```

---

## Phase 6: Integration

### Task 10: Wire new modules into orchestrator startup

**Objective:** Start GC and autopilot scheduler alongside the existing dispatch loop. Pass workspace isolation to pod creation.

**Files:**
- Modify: `src/main/orchestrator.ts`
- Modify: `src/main/dispatch-loop.ts` (import and start GC + autopilot in `startOrchestrator`)

**Step 1: Update startOrchestrator**

In `startOrchestrator()` add:
```typescript
import { startGC } from './workspace-gc'
import { startAutopilotScheduler } from './autopilot'

// In startOrchestrator():
startGC()
startAutopilotScheduler()
```

**Step 2: Update stopOrchestrator (if it exists, or add one)**

```typescript
import { stopGC } from './workspace-gc'
import { stopAutopilotScheduler } from './autopilot'

export function stopOrchestrator(): void {
  stopDispatchLoop()
  stopHealthMonitor()
  stopGC()
  stopAutopilotScheduler()
}
```

**Step 3: Update orchestrator.ts barrel export**

```typescript
export * from './dispatch-queue'
export * from './dispatch-loop'
export * from './workspace-isolation'
export * from './workspace-gc'
export * from './autopilot'
```

**Step 4: Commit**

```bash
git add src/main/orchestrator.ts src/main/dispatch-loop.ts
git commit -m "feat: wire workspace-gc + autopilot into orchestrator startup"
```

---

### Task 11: Add workspace isolation to pod creation

**Objective:** When creating a pod, optionally use an isolated worktree instead of the shared project directory.

**Files:**
- Modify: `src/main/pods.ts` (in `createPod`, call `createIsolatedWorkspace` and use the returned path as the pod's `cwd`)

**Step 1: Update createPod**

Add import:
```typescript
import { createIsolatedWorkspace, cleanupWorkspace } from './workspace-isolation'
```

In `createPod`, after resolving the `cwd`:
```typescript
// If isolation is enabled (default for git repos), create isolated worktree
const useIsolation = opts.isolateWorkspace !== false
if (useIsolation) {
  const ws = createIsolatedWorkspace(cwd, pod.id, pod.branch)
  pod.cwd = ws.worktreePath
  pod.isolated = ws.isolated
}
```

In `completePodWithPR`, after PR creation:
```typescript
// Clean up isolated workspace after PR
cleanupWorkspace(pod.id)
```

**Step 2: Commit**

```bash
git add src/main/pods.ts
git commit -m "feat: pods use isolated worktrees by default"
```

---

### Task 12: Run full test suite and fix any breakage

**Objective:** Ensure all existing and new tests pass.

**Files:**
- Various (fix any broken imports/tests)

**Step 1: Run tests**

```bash
cd ~/sidekick/Penpal && timeout 120 npx vitest run --reporter=verbose 2>&1 | tail -50
```

**Step 2: Fix any failures, commit**

```bash
git add -A
git commit -m "fix: test suite green after multica-inspired improvements"
```

---

## Summary

| Phase | Module | What it does | Multica inspiration |
|-------|--------|-------------|-------------------|
| 1 | workspace-isolation.ts | Per-task git worktrees | ~/multica_workspaces/<id>/ |
| 2 | workspace-gc.ts | 3-tier cleanup (completed/orphan/artifact) | GC with configurable TTLs |
| 3 | dispatch-queue.ts (claimTask) | Pull-model task claiming | Daemon polls + claims |
| 4 | dispatch-loop.ts (heartbeat) | Proactive heartbeat-based health | 15s heartbeat, offline detection |
| 5 | autopilot.ts | Scheduled recurring tasks | Autopilots with cron triggers |
| 6 | Integration | Wire into startup, pods use isolation | Unified startup lifecycle |
