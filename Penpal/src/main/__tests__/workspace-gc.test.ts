/**
 * Unit tests for workspace-gc.ts
 *
 * Verifies the 3-tier garbage collection: completed task cleanup,
 * orphan directory cleanup, and artifact directory cleanup.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const fsMocks = vi.hoisted(() => ({
  existsSync: vi.fn(() => false),
  readdirSync: vi.fn(() => []),
  readFileSync: vi.fn(() => '{}'),
  statSync: vi.fn(() => ({ mtimeMs: 0 })),
  rmSync: vi.fn(),
  mkdirSync: vi.fn(),
}))

const spawnProxyMocks = vi.hoisted(() => ({
  proxyExecFile: vi.fn(async () => ({ stdout: '', stderr: '' })),
}))

const isolationMocks = vi.hoisted(() => ({
  listWorkspaces: vi.fn(() => []),
  cleanupWorkspace: vi.fn(() => true),
}))

const dispatchMocks = vi.hoisted(() => ({
  getTaskQueue: vi.fn(() => []),
}))

// ── Module mocks (before importing module under test) ────────────────────────

vi.mock('fs', () => ({
  default: { ...fsMocks },
  ...fsMocks,
}))

vi.mock('../spawn-proxy', () => ({
  proxyExecFile: spawnProxyMocks.proxyExecFile,
}))

vi.mock('../data-paths', () => ({
  getDataDir: vi.fn(() => '/tmp/penpal-test-data'),
}))

vi.mock('../workspace-isolation', () => ({
  listWorkspaces: isolationMocks.listWorkspaces,
  cleanupWorkspace: isolationMocks.cleanupWorkspace,
}))

vi.mock('../dispatch-queue', () => ({
  getTaskQueue: dispatchMocks.getTaskQueue,
}))

// ── Import module under test ─────────────────────────────────────────────────

import {
  runGC,
  startGC,
  stopGC,
  getGCStats,
  _resetForTest,
} from '../workspace-gc'

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Create a workspace info object for testing. */
function makeWorkspace(overrides: {
  taskId: string
  isolated?: boolean
  createdAt?: string
  worktreePath?: string
}) {
  const taskId = overrides.taskId
  return {
    worktreePath: overrides.worktreePath ?? `/tmp/penpal-test-data/workspaces/${taskId}`,
    branch: `penpal/task-${taskId}`,
    taskId,
    projectPath: '/projects/test',
    createdAt: overrides.createdAt ?? new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2h ago
    isolated: overrides.isolated ?? true,
  }
}

/** Create a task object for testing. */
function makeTask(overrides: { id: string; status: string }) {
  return {
    id: overrides.id,
    title: 'Test task',
    description: 'Test',
    project: '/projects/test',
    priority: 'normal' as const,
    status: overrides.status,
    requiredSkills: [],
    source: 'dashboard' as const,
    createdAt: Date.now(),
    retryCount: 0,
    maxRetries: 1,
  }
}

// ── Test suites ──────────────────────────────────────────────────────────────

describe('workspace-gc', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    _resetForTest()
    vi.clearAllMocks()
  })

  afterEach(() => {
    _resetForTest()
    vi.useRealTimers()
  })

  // ── Tier 1: Completed task cleanup ──────────────────────────────────────

  describe('Tier 1 — completed task cleanup', () => {
    it('removes completed task workspace older than TTL', async () => {
      const ws = makeWorkspace({ taskId: 'task-old-done' })
      isolationMocks.listWorkspaces.mockReturnValue([ws])
      dispatchMocks.getTaskQueue.mockReturnValue([
        makeTask({ id: 'task-old-done', status: 'completed' }),
      ])
      isolationMocks.cleanupWorkspace.mockReturnValue(true)

      const result = await runGC()

      expect(result.completed).toBe(1)
      expect(isolationMocks.cleanupWorkspace).toHaveBeenCalledWith('task-old-done')
    })

    it('keeps active task workspace', async () => {
      const ws = makeWorkspace({ taskId: 'task-active' })
      isolationMocks.listWorkspaces.mockReturnValue([ws])
      dispatchMocks.getTaskQueue.mockReturnValue([
        makeTask({ id: 'task-active', status: 'active' }),
      ])

      const result = await runGC()

      expect(result.completed).toBe(0)
      expect(isolationMocks.cleanupWorkspace).not.toHaveBeenCalled()
    })

    it('keeps completed task workspace younger than TTL', async () => {
      // Created 5 minutes ago — within the default 1h TTL
      const ws = makeWorkspace({
        taskId: 'task-recent',
        createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      })
      isolationMocks.listWorkspaces.mockReturnValue([ws])
      dispatchMocks.getTaskQueue.mockReturnValue([
        makeTask({ id: 'task-recent', status: 'completed' }),
      ])

      const result = await runGC()

      expect(result.completed).toBe(0)
      expect(isolationMocks.cleanupWorkspace).not.toHaveBeenCalled()
    })
  })

  // ── Tier 2: Orphan cleanup ────────────────────────────────────────────────

  describe('Tier 2 — orphan cleanup', () => {
    it('removes orphan directory older than TTL', async () => {
      // No tracked workspaces — all dirs on disk are orphans
      isolationMocks.listWorkspaces.mockReturnValue([])
      dispatchMocks.getTaskQueue.mockReturnValue([])

      // Simulate a directory on disk
      fsMocks.readdirSync.mockReturnValue(['orphan-task-123'] as any)
      // No metadata file — use stat mtime
      fsMocks.existsSync.mockReturnValue(false)
      fsMocks.statSync.mockReturnValue({
        mtimeMs: Date.now() - 48 * 60 * 60 * 1000, // 48h ago
      } as any)

      const result = await runGC()

      expect(result.orphans).toBe(1)
      expect(spawnProxyMocks.proxyExecFile).toHaveBeenCalledWith(
        'git',
        ['worktree', 'remove', '--force', '/tmp/penpal-test-data/workspaces/orphan-task-123'],
        expect.objectContaining({ timeout: expect.any(Number) }),
      )
    })

    it('keeps directory that matches active workspace', async () => {
      const ws = makeWorkspace({ taskId: 'active-ws' })
      isolationMocks.listWorkspaces.mockReturnValue([ws])
      dispatchMocks.getTaskQueue.mockReturnValue([
        makeTask({ id: 'active-ws', status: 'active' }),
      ])

      // The directory on disk matches the tracked workspace
      fsMocks.readdirSync.mockReturnValue(['active-ws'] as any)

      const result = await runGC()

      expect(result.orphans).toBe(0)
      // proxyExecFile should NOT be called for tracked directories
      expect(spawnProxyMocks.proxyExecFile).not.toHaveBeenCalled()
    })
  })

  // ── Tier 3: Artifact cleanup ──────────────────────────────────────────────

  describe('Tier 3 — artifact cleanup', () => {
    it('removes artifact dirs from stale worktrees', async () => {
      // Workspace older than 6h artifact TTL (created 8h ago) and the
      // task is in a terminal state — Tier 3 only touches non-live tasks.
      const ws = makeWorkspace({
        taskId: 'task-stale',
        createdAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
      })
      isolationMocks.listWorkspaces.mockReturnValue([ws])
      dispatchMocks.getTaskQueue.mockReturnValue([
        makeTask({ id: 'task-stale', status: 'completed' }),
      ])
      // Tier 1 cleanup is mocked out to a no-op so it doesn't claim the
      // workspace before Tier 3 runs.
      isolationMocks.cleanupWorkspace.mockReturnValue(false)

      // Simulate that node_modules and .next exist
      fsMocks.existsSync.mockImplementation((p: string) => {
        if (typeof p === 'string' && (p.endsWith('node_modules') || p.endsWith('.next'))) {
          return true
        }
        return false
      })

      // For Tier 2 — readdirSync returns nothing (no orphans)
      fsMocks.readdirSync.mockReturnValue([] as any)

      const result = await runGC()

      expect(result.artifacts).toBe(2) // node_modules + .next
      expect(fsMocks.rmSync).toHaveBeenCalledWith(
        expect.stringContaining('node_modules'),
        { recursive: true, force: true },
      )
      expect(fsMocks.rmSync).toHaveBeenCalledWith(
        expect.stringContaining('.next'),
        { recursive: true, force: true },
      )
    })

    it('does NOT touch artifacts when task is still active', async () => {
      const ws = makeWorkspace({
        taskId: 'task-running',
        createdAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
      })
      isolationMocks.listWorkspaces.mockReturnValue([ws])
      dispatchMocks.getTaskQueue.mockReturnValue([
        makeTask({ id: 'task-running', status: 'active' }),
      ])
      fsMocks.existsSync.mockReturnValue(true)
      fsMocks.readdirSync.mockReturnValue([] as any)

      const result = await runGC()

      expect(result.artifacts).toBe(0)
      expect(fsMocks.rmSync).not.toHaveBeenCalled()
    })
  })

  // ── startGC / stopGC lifecycle ────────────────────────────────────────────

  describe('startGC / stopGC lifecycle', () => {
    it('runs GC on interval and stops cleanly', async () => {
      // Set up minimal mocks so runGC does nothing
      isolationMocks.listWorkspaces.mockReturnValue([])
      dispatchMocks.getTaskQueue.mockReturnValue([])
      fsMocks.readdirSync.mockReturnValue([] as any)

      startGC({ interval: 1000 })

      // Advance time by 3 intervals — flush async GC work between ticks.
      await vi.advanceTimersByTimeAsync(3000)

      const stats = getGCStats()
      expect(stats.lastRun).not.toBeNull()
      expect(stats.config.interval).toBe(1000)

      stopGC()

      // Clear call counts and advance more — should NOT run again
      vi.clearAllMocks()
      isolationMocks.listWorkspaces.mockReturnValue([])
      dispatchMocks.getTaskQueue.mockReturnValue([])
      fsMocks.readdirSync.mockReturnValue([] as any)
      await vi.advanceTimersByTimeAsync(3000)

      // listWorkspaces should not have been called after stop
      expect(isolationMocks.listWorkspaces).not.toHaveBeenCalled()
    })
  })

  // ── _resetForTest ─────────────────────────────────────────────────────────

  describe('_resetForTest', () => {
    it('clears all accumulated state', async () => {
      // Accumulate some stats
      isolationMocks.listWorkspaces.mockReturnValue([])
      dispatchMocks.getTaskQueue.mockReturnValue([])
      fsMocks.readdirSync.mockReturnValue([] as any)

      await runGC()
      const beforeReset = getGCStats()
      expect(beforeReset.lastRun).not.toBeNull()

      _resetForTest()

      const afterReset = getGCStats()
      expect(afterReset.completed).toBe(0)
      expect(afterReset.orphans).toBe(0)
      expect(afterReset.artifacts).toBe(0)
      expect(afterReset.lastRun).toBeNull()
      expect(afterReset.config.completedTaskTTL).toBe(60 * 60 * 1000)
    })
  })
})
