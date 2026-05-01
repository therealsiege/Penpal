/**
 * Unit tests for workspace-isolation.ts
 *
 * Verifies isolated git worktree creation, fallback behaviour for non-git
 * repos, workspace tracking (list/get), and cleanup.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const fsMocks = vi.hoisted(() => ({
  existsSync: vi.fn(() => false),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
  rmSync: vi.fn(),
}))

const cpMocks = vi.hoisted(() => ({
  execFileSync: vi.fn(),
}))

// ── Module mocks (must be before importing the module under test) ────────────

vi.mock('fs', () => ({
  default: { ...fsMocks },
  ...fsMocks,
}))

vi.mock('child_process', () => ({
  execFileSync: cpMocks.execFileSync,
}))

vi.mock('../data-paths', () => ({
  getDataDir: vi.fn(() => '/tmp/penpal-test-data'),
}))

// ── Import module under test ─────────────────────────────────────────────────

import {
  createIsolatedWorkspace,
  cleanupWorkspace,
  getWorkspace,
  listWorkspaces,
  _resetForTest,
} from '../workspace-isolation'

// ── Test suites ──────────────────────────────────────────────────────────────

describe('workspace-isolation', () => {
  beforeEach(() => {
    _resetForTest()
    vi.clearAllMocks()
  })

  afterEach(() => {
    _resetForTest()
  })

  // ── createIsolatedWorkspace ──────────────────────────────────────────────

  describe('createIsolatedWorkspace', () => {
    it('creates an isolated worktree for a git repo', () => {
      // git rev-parse succeeds (it is a git repo), git worktree add succeeds
      cpMocks.execFileSync.mockImplementation((cmd: string, args: string[]) => {
        if (args[0] === 'rev-parse') return Buffer.from('true\n')
        if (args[0] === 'worktree') return Buffer.from('')
        return Buffer.from('')
      })

      const info = createIsolatedWorkspace('/projects/my-app', 'task-42')

      expect(info.isolated).toBe(true)
      expect(info.taskId).toBe('task-42')
      expect(info.projectPath).toBe('/projects/my-app')
      expect(info.branch).toBe('penpal/task-task-42')
      expect(info.worktreePath).toContain('/tmp/penpal-test-data/workspaces/task-42')
      expect(info.createdAt).toBeTruthy()

      // Verify git worktree add was called
      expect(cpMocks.execFileSync).toHaveBeenCalledWith(
        'git',
        ['worktree', 'add', '-b', 'penpal/task-task-42', expect.stringContaining('workspaces/task-42')],
        expect.objectContaining({ cwd: '/projects/my-app' }),
      )

      // Verify metadata file was written
      expect(fsMocks.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('.penpal-workspace.json'),
        expect.stringContaining('"taskId"'),
      )

      // Verify mkdirSync was called for the workspaces root
      expect(fsMocks.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('workspaces'),
        { recursive: true },
      )
    })

    it('falls back to shared dir for non-git repos', () => {
      // git rev-parse throws — not a git repo
      cpMocks.execFileSync.mockImplementation((_cmd: string, args: string[]) => {
        if (args[0] === 'rev-parse') {
          throw new Error('fatal: not a git repository')
        }
        return Buffer.from('')
      })

      const info = createIsolatedWorkspace('/projects/plain-folder', 'task-99')

      expect(info.isolated).toBe(false)
      expect(info.worktreePath).toBe('/projects/plain-folder')
      expect(info.taskId).toBe('task-99')
      expect(info.branch).toBe('penpal/task-task-99')

      // git worktree add should NOT have been called
      const worktreeCalls = cpMocks.execFileSync.mock.calls.filter(
        (call: unknown[]) => (call[1] as string[])[0] === 'worktree',
      )
      expect(worktreeCalls).toHaveLength(0)
    })

    it('falls back when git worktree add fails', () => {
      cpMocks.execFileSync.mockImplementation((_cmd: string, args: string[]) => {
        if (args[0] === 'rev-parse') return Buffer.from('true\n')
        if (args[0] === 'worktree') throw new Error('worktree add failed')
        return Buffer.from('')
      })

      const info = createIsolatedWorkspace('/projects/my-app', 'task-fail')

      expect(info.isolated).toBe(false)
      expect(info.worktreePath).toBe('/projects/my-app')
    })

    it('uses a custom branch when specified', () => {
      cpMocks.execFileSync.mockImplementation(() => Buffer.from(''))

      const info = createIsolatedWorkspace('/projects/my-app', 'task-branch', 'feature/custom')

      expect(info.branch).toBe('feature/custom')
    })
  })

  // ── Workspace tracking ───────────────────────────────────────────────────

  describe('workspace tracking', () => {
    it('tracks active workspaces via listWorkspaces and getWorkspace', () => {
      // Make both non-git so we get quick fallback entries
      cpMocks.execFileSync.mockImplementation(() => {
        throw new Error('not a git repo')
      })

      createIsolatedWorkspace('/a', 'task-1')
      createIsolatedWorkspace('/b', 'task-2')

      const list = listWorkspaces()
      expect(list).toHaveLength(2)
      expect(list.map((w) => w.taskId).sort()).toEqual(['task-1', 'task-2'])

      const ws = getWorkspace('task-1')
      expect(ws).toBeDefined()
      expect(ws!.taskId).toBe('task-1')
      expect(ws!.projectPath).toBe('/a')

      expect(getWorkspace('task-unknown')).toBeUndefined()
    })
  })

  // ── cleanupWorkspace ─────────────────────────────────────────────────────

  describe('cleanupWorkspace', () => {
    it('cleans up an isolated workspace', () => {
      // Create an isolated workspace first
      cpMocks.execFileSync.mockImplementation(() => Buffer.from(''))

      createIsolatedWorkspace('/projects/my-app', 'task-clean')
      expect(getWorkspace('task-clean')).toBeDefined()

      // Reset mock to track cleanup calls
      cpMocks.execFileSync.mockClear()
      cpMocks.execFileSync.mockImplementation(() => Buffer.from(''))

      const result = cleanupWorkspace('task-clean')

      expect(result).toBe(true)
      expect(getWorkspace('task-clean')).toBeUndefined()

      // Should have called git worktree remove
      expect(cpMocks.execFileSync).toHaveBeenCalledWith(
        'git',
        ['worktree', 'remove', '--force', expect.stringContaining('workspaces/task-clean')],
        expect.objectContaining({ cwd: '/projects/my-app' }),
      )
    })

    it('cleans up a non-isolated workspace without git worktree remove', () => {
      cpMocks.execFileSync.mockImplementation(() => {
        throw new Error('not a git repo')
      })

      createIsolatedWorkspace('/plain', 'task-plain')
      cpMocks.execFileSync.mockClear()

      const result = cleanupWorkspace('task-plain')
      expect(result).toBe(true)
      expect(getWorkspace('task-plain')).toBeUndefined()

      // git worktree remove should NOT be called for non-isolated workspaces
      expect(cpMocks.execFileSync).not.toHaveBeenCalled()
    })

    it('returns false when cleaning up an unknown task', () => {
      const result = cleanupWorkspace('task-nonexistent')
      expect(result).toBe(false)
    })

    it('falls back to rmSync when git worktree remove fails', () => {
      cpMocks.execFileSync.mockImplementation(() => Buffer.from(''))

      createIsolatedWorkspace('/projects/my-app', 'task-rm')
      cpMocks.execFileSync.mockClear()
      cpMocks.execFileSync.mockImplementation(() => {
        throw new Error('worktree remove failed')
      })

      const result = cleanupWorkspace('task-rm')
      expect(result).toBe(true)

      // rmSync should be called as fallback
      expect(fsMocks.rmSync).toHaveBeenCalledWith(
        expect.stringContaining('workspaces/task-rm'),
        { recursive: true, force: true },
      )
    })
  })
})
