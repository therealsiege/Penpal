/**
 * Integration-style tests for workspace-gc — validates the three GC tiers
 * end-to-end against mocked listWorkspaces() / getTaskQueue() / proxyExecFile().
 *
 * Specifically asserts the behaviours the README "Workspace GC" wave-9 entry
 * called out as un-validated:
 *   1. A completed task older than TTL gets cleaned (Tier 1).
 *   2. An active/running task is NOT cleaned (Tier 1 + Tier 3 safety).
 *   3. An orphaned worktree (on disk but no task) gets cleaned after the
 *      orphan TTL (Tier 2).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const fsMocks = vi.hoisted(() => ({
  existsSync: vi.fn(() => false),
  readdirSync: vi.fn(() => [] as string[]),
  readFileSync: vi.fn(() => '{}'),
  statSync: vi.fn(() => ({ mtimeMs: 0 })),
  rmSync: vi.fn(),
  mkdirSync: vi.fn(),
}))

const spawnProxyMocks = vi.hoisted(() => ({
  proxyExecFile: vi.fn(async () => ({ stdout: '', stderr: '' })),
}))

const isolationMocks = vi.hoisted(() => ({
  listWorkspaces: vi.fn(() => [] as Array<Record<string, unknown>>),
  cleanupWorkspace: vi.fn(() => true),
}))

const dispatchMocks = vi.hoisted(() => ({
  getTaskQueue: vi.fn(() => [] as Array<Record<string, unknown>>),
}))

// ── Module mocks (must be set up before importing the module under test) ────

vi.mock('fs', () => ({
  default: { ...fsMocks },
  ...fsMocks,
}))

vi.mock('../../src/main/spawn-proxy', () => ({
  proxyExecFile: spawnProxyMocks.proxyExecFile,
}))

vi.mock('../../src/main/data-paths', () => ({
  getDataDir: vi.fn(() => '/tmp/penpal-test-data'),
}))

vi.mock('../../src/main/workspace-isolation', () => ({
  listWorkspaces: isolationMocks.listWorkspaces,
  cleanupWorkspace: isolationMocks.cleanupWorkspace,
}))

vi.mock('../../src/main/dispatch-queue', () => ({
  getTaskQueue: dispatchMocks.getTaskQueue,
}))

// ── Module under test ────────────────────────────────────────────────────────

import { runGC, _resetForTest } from '../../src/main/workspace-gc'

// ── Helpers ──────────────────────────────────────────────────────────────────

const HOUR = 60 * 60 * 1000

function workspaceFixture(overrides: {
  taskId: string
  isolated?: boolean
  ageMs?: number
  worktreePath?: string
}) {
  const { taskId, isolated = true, ageMs = 2 * HOUR, worktreePath } = overrides
  return {
    worktreePath: worktreePath ?? `/tmp/penpal-test-data/workspaces/${taskId}`,
    branch: `penpal/task-${taskId}`,
    taskId,
    projectPath: '/projects/test',
    createdAt: new Date(Date.now() - ageMs).toISOString(),
    isolated,
  }
}

function taskFixture(overrides: { id: string; status: string }) {
  return {
    id: overrides.id,
    title: 'Test task',
    description: 'Test',
    project: '/projects/test',
    priority: 'normal' as const,
    status: overrides.status,
    requiredSkills: [] as string[],
    source: 'dashboard' as const,
    createdAt: Date.now(),
    retryCount: 0,
    maxRetries: 1,
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('workspace-gc (integration)', () => {
  beforeEach(() => {
    _resetForTest()
    vi.clearAllMocks()
    // Reset default behaviours so a leaky mock from a prior test can't bleed
    fsMocks.existsSync.mockReturnValue(false)
    fsMocks.readdirSync.mockReturnValue([])
    spawnProxyMocks.proxyExecFile.mockResolvedValue({ stdout: '', stderr: '' })
    isolationMocks.cleanupWorkspace.mockReturnValue(true)
  })

  afterEach(() => {
    _resetForTest()
  })

  it('cleans a completed task workspace older than the completedTaskTTL', async () => {
    // 2h old completed task — beyond the default 1h TTL
    const ws = workspaceFixture({ taskId: 'task-done', ageMs: 2 * HOUR })
    isolationMocks.listWorkspaces.mockReturnValue([ws])
    dispatchMocks.getTaskQueue.mockReturnValue([
      taskFixture({ id: 'task-done', status: 'completed' }),
    ])

    const result = await runGC()

    expect(result.completed).toBe(1)
    expect(isolationMocks.cleanupWorkspace).toHaveBeenCalledWith('task-done')
  })

  it('does NOT clean a running/active task even if older than TTL', async () => {
    // 8h old workspace — would be eligible by age, but task is still active
    const ws = workspaceFixture({ taskId: 'task-running', ageMs: 8 * HOUR })
    isolationMocks.listWorkspaces.mockReturnValue([ws])
    dispatchMocks.getTaskQueue.mockReturnValue([
      taskFixture({ id: 'task-running', status: 'active' }),
    ])
    // Pretend node_modules is on disk so Tier 3 *would* nuke it if not for
    // the live-task safety check.
    fsMocks.existsSync.mockReturnValue(true)

    const result = await runGC()

    expect(result.completed).toBe(0)
    expect(result.artifacts).toBe(0)
    expect(isolationMocks.cleanupWorkspace).not.toHaveBeenCalled()
    expect(fsMocks.rmSync).not.toHaveBeenCalled()
  })

  it('does NOT clean a queued (pending) task workspace', async () => {
    const ws = workspaceFixture({ taskId: 'task-pending', ageMs: 8 * HOUR })
    isolationMocks.listWorkspaces.mockReturnValue([ws])
    dispatchMocks.getTaskQueue.mockReturnValue([
      taskFixture({ id: 'task-pending', status: 'queued' }),
    ])

    const result = await runGC()

    expect(result.completed).toBe(0)
    expect(isolationMocks.cleanupWorkspace).not.toHaveBeenCalled()
  })

  it('cleans an orphaned worktree on disk after the orphan TTL', async () => {
    // No tracked workspaces in memory…
    isolationMocks.listWorkspaces.mockReturnValue([])
    dispatchMocks.getTaskQueue.mockReturnValue([])

    // …but a stale directory exists on disk that's 48h old (default TTL is 24h)
    fsMocks.readdirSync.mockReturnValue(['orphan-task-xyz'])
    fsMocks.existsSync.mockReturnValue(false) // no metadata file → fall back to mtime
    fsMocks.statSync.mockReturnValue({
      mtimeMs: Date.now() - 48 * HOUR,
    } as ReturnType<typeof fsMocks.statSync>)

    const result = await runGC()

    expect(result.orphans).toBe(1)
    expect(spawnProxyMocks.proxyExecFile).toHaveBeenCalledWith(
      'git',
      ['worktree', 'remove', '--force', '/tmp/penpal-test-data/workspaces/orphan-task-xyz'],
      expect.objectContaining({ timeout: expect.any(Number) }),
    )
  })

  it('does NOT clean an orphan that is younger than the orphan TTL', async () => {
    isolationMocks.listWorkspaces.mockReturnValue([])
    dispatchMocks.getTaskQueue.mockReturnValue([])
    fsMocks.readdirSync.mockReturnValue(['fresh-orphan'])
    fsMocks.existsSync.mockReturnValue(false)
    // 1h old — well within the 24h orphan TTL
    fsMocks.statSync.mockReturnValue({
      mtimeMs: Date.now() - 1 * HOUR,
    } as ReturnType<typeof fsMocks.statSync>)

    const result = await runGC()

    expect(result.orphans).toBe(0)
    expect(spawnProxyMocks.proxyExecFile).not.toHaveBeenCalled()
  })

  it('uses async proxyExecFile and never blocks on execFileSync', async () => {
    // Smoke check: no synchronous child_process import is reachable here.
    // We trigger the orphan path and confirm the async proxy is what runs.
    isolationMocks.listWorkspaces.mockReturnValue([])
    dispatchMocks.getTaskQueue.mockReturnValue([])
    fsMocks.readdirSync.mockReturnValue(['stale'])
    fsMocks.existsSync.mockReturnValue(false)
    fsMocks.statSync.mockReturnValue({
      mtimeMs: Date.now() - 72 * HOUR,
    } as ReturnType<typeof fsMocks.statSync>)

    let resolved = false
    spawnProxyMocks.proxyExecFile.mockImplementation(async () => {
      // Simulate async work — runGC must await this
      await new Promise(r => setTimeout(r, 0))
      resolved = true
      return { stdout: '', stderr: '' }
    })

    await runGC()

    expect(resolved).toBe(true)
    expect(spawnProxyMocks.proxyExecFile).toHaveBeenCalledTimes(1)
  })
})
