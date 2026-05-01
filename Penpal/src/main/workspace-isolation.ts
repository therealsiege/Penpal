/**
 * Workspace Isolation — per-task git worktrees
 *
 * Creates isolated git worktrees so concurrent agents working on the same repo
 * never collide on working-tree files. Inspired by Multica's per-task workspace
 * directory isolation.
 *
 * When the project is a git repo, a worktree is created under
 * `~/.penpal/data/workspaces/<sanitized-taskId>`. If git worktree creation
 * fails (or the project isn't a git repo) we fall back gracefully to the
 * original project path with `isolated: false`.
 */

import path from 'path'
import fs from 'fs'
import { execFileSync } from 'child_process'
import { getDataDir } from './data-paths'

// ── Types ────────────────────────────────────────────────────────────────────

export interface WorkspaceInfo {
  worktreePath: string
  branch: string
  taskId: string
  projectPath: string
  createdAt: string
  isolated: boolean // false if fallback to shared dir
}

// ── Module state ─────────────────────────────────────────────────────────────

const activeWorkspaces = new Map<string, WorkspaceInfo>()

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Sanitize a taskId into a safe directory name. */
function sanitizeTaskId(taskId: string): string {
  return taskId.replace(/[^a-zA-Z0-9_-]/g, '_')
}

/** Return the workspaces root under the data directory. */
function workspacesRoot(): string {
  return path.join(getDataDir(), 'workspaces')
}

/** Check if a directory is inside a git repo. */
function isGitRepo(dir: string): boolean {
  try {
    execFileSync('git', ['rev-parse', '--is-inside-work-tree'], {
      cwd: dir,
      stdio: 'pipe',
    })
    return true
  } catch {
    return false
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Create an isolated workspace (git worktree) for a task.
 *
 * If the projectPath is a git repo, creates a worktree at
 * `<dataDir>/workspaces/<sanitized-taskId>` on branch
 * `penpal/task-<taskId>` (or the specified branch).
 *
 * Falls back to the original projectPath if worktree creation fails.
 */
export function createIsolatedWorkspace(
  projectPath: string,
  taskId: string,
  branch?: string,
): WorkspaceInfo {
  const branchName = branch ?? `penpal/task-${taskId}`
  const sanitized = sanitizeTaskId(taskId)
  const worktreeDir = path.join(workspacesRoot(), sanitized)

  // If not a git repo, fall back immediately
  if (!isGitRepo(projectPath)) {
    const info: WorkspaceInfo = {
      worktreePath: projectPath,
      branch: branchName,
      taskId,
      projectPath,
      createdAt: new Date().toISOString(),
      isolated: false,
    }
    activeWorkspaces.set(taskId, info)
    return info
  }

  try {
    // Ensure parent directory exists
    fs.mkdirSync(workspacesRoot(), { recursive: true })

    // Create the git worktree with a new branch
    execFileSync('git', ['worktree', 'add', '-b', branchName, worktreeDir], {
      cwd: projectPath,
      stdio: 'pipe',
    })

    // Write metadata file
    const metadata = {
      taskId,
      branch: branchName,
      projectPath,
      createdAt: new Date().toISOString(),
    }
    fs.writeFileSync(
      path.join(worktreeDir, '.penpal-workspace.json'),
      JSON.stringify(metadata, null, 2),
    )

    const info: WorkspaceInfo = {
      worktreePath: worktreeDir,
      branch: branchName,
      taskId,
      projectPath,
      createdAt: metadata.createdAt,
      isolated: true,
    }
    activeWorkspaces.set(taskId, info)
    return info
  } catch {
    // Fallback: use the original project path
    const info: WorkspaceInfo = {
      worktreePath: projectPath,
      branch: branchName,
      taskId,
      projectPath,
      createdAt: new Date().toISOString(),
      isolated: false,
    }
    activeWorkspaces.set(taskId, info)
    return info
  }
}

/**
 * Remove an isolated workspace (git worktree) for a task.
 * Returns true if the workspace was tracked and cleaned up, false otherwise.
 */
export function cleanupWorkspace(taskId: string): boolean {
  const info = activeWorkspaces.get(taskId)
  if (!info) return false

  activeWorkspaces.delete(taskId)

  // Only attempt cleanup if it was actually isolated
  if (!info.isolated) return true

  try {
    execFileSync('git', ['worktree', 'remove', '--force', info.worktreePath], {
      cwd: info.projectPath,
      stdio: 'pipe',
    })
  } catch {
    // Fallback: remove the directory manually
    try {
      fs.rmSync(info.worktreePath, { recursive: true, force: true })
    } catch {
      // Best effort — directory may already be gone
    }
  }

  return true
}

/** Retrieve workspace info for a specific task. */
export function getWorkspace(taskId: string): WorkspaceInfo | undefined {
  return activeWorkspaces.get(taskId)
}

/** List all active workspaces. */
export function listWorkspaces(): WorkspaceInfo[] {
  return Array.from(activeWorkspaces.values())
}

/** Reset module state — for testing only. */
export function _resetForTest(): void {
  activeWorkspaces.clear()
}
