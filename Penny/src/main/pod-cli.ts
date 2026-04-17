#!/usr/bin/env node
/**
 * Thin CLI wrapper around the pod creation logic.
 * Used by the MCP server (analytics/) to create pods without importing Electron.
 *
 * Usage:
 *   node --import tsx src/main/pod-cli.ts --task "Implement feature X" --preset frontend-feature --cwd /path/to/repo --priority high
 *
 * Outputs the created workflow JSON to stdout.
 * The workflow runs to completion before the process exits.
 */

import { config } from 'dotenv'
import { resolve, dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'
import fs from 'fs'

// Load .env before anything reads process.env
const __dir = typeof __dirname !== 'undefined' ? __dirname : dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dir, '../../.env') })

import { createPod, getPodStatus, type CreatePodOpts } from './pods'

function parseArgs(): { task: string; preset?: string; cwd?: string; priority?: string; candidates?: number; maxSelfFixes?: number } {
  const args = process.argv.slice(2)
  let task = ''
  let preset: string | undefined
  let cwd: string | undefined
  let priority: string | undefined
  let candidates: number | undefined
  let maxSelfFixes: number | undefined

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--task':
        task = args[++i] || ''
        break
      case '--preset':
        preset = args[++i]
        break
      case '--cwd':
        cwd = args[++i]
        break
      case '--priority':
        priority = args[++i]
        break
      case '--candidates':
        candidates = parseInt(args[++i] || '1', 10)
        break
      case '--max-self-fixes':
        maxSelfFixes = parseInt(args[++i] || '0', 10)
        break
    }
  }

  if (!task) {
    console.error('Error: --task is required')
    process.exit(1)
  }

  return { task, preset, cwd, priority, candidates, maxSelfFixes }
}

/**
 * Create a git worktree for the pod so it doesn't pollute the main working tree.
 * Returns the worktree path, or null if creation fails.
 */
function createWorktree(repoCwd: string, slug: string): { worktreePath: string; branch: string } | null {
  const safeName = slug
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 50)
    .replace(/-$/, '') || 'pod-task'

  const branch = `pod-${safeName}`
  const worktreesRoot = join(repoCwd, '.penny-worktrees')
  const worktreePath = join(worktreesRoot, safeName)

  try {
    fs.mkdirSync(worktreesRoot, { recursive: true })
    const gitOpts = { cwd: repoCwd, encoding: 'utf-8' as const, stdio: 'pipe' as const, timeout: 30_000 }

    // Resolve base branch
    let baseBranch = 'main'
    try {
      const ref = execSync('git symbolic-ref refs/remotes/origin/HEAD', gitOpts).toString().trim()
      baseBranch = ref.replace(/^refs\/remotes\/origin\//, '')
    } catch { /* default to main */ }

    // Fetch latest
    execSync(`git fetch origin ${baseBranch}`, { ...gitOpts, timeout: 60_000 })

    // Prune stale worktrees and clean up old branch if it exists
    try { execSync('git worktree prune', gitOpts) } catch { /* */ }
    try { execSync(`git branch -D ${branch}`, gitOpts) } catch { /* */ }

    // Remove stale worktree directory
    if (fs.existsSync(worktreePath)) {
      try { execSync(`git worktree remove ${worktreePath} --force`, gitOpts) } catch { /* */ }
      if (fs.existsSync(worktreePath)) fs.rmSync(worktreePath, { recursive: true, force: true })
    }

    execSync(`git worktree add --force -b ${branch} ${worktreePath} origin/${baseBranch}`, {
      ...gitOpts, timeout: 60_000,
    })

    console.error(`[pod-cli] Worktree: ${worktreePath} (branch: ${branch})`)
    return { worktreePath, branch }
  } catch (err) {
    console.error(`[pod-cli] Worktree creation failed, running on main working tree:`, (err as Error).message)
    return null
  }
}

/**
 * After pod completes, push branch and create PR.
 */
function pushAndCreatePR(worktreePath: string, branch: string, task: string): void {
  const gitOpts = { cwd: worktreePath, encoding: 'utf-8' as const, stdio: 'pipe' as const, timeout: 60_000 }
  try {
    // Stage any uncommitted changes
    execSync('git add -A', gitOpts)
    const status = execSync('git status --porcelain', gitOpts).toString().trim()
    if (status) {
      execSync(`git commit -m "${task.slice(0, 72).replace(/"/g, '\\"')}"`, gitOpts)
    }

    // Check if there's anything to push
    const ahead = parseInt(execSync('git rev-list --count origin/main..HEAD', { ...gitOpts, timeout: 10_000 }).toString().trim(), 10)
    if (ahead === 0) {
      console.error('[pod-cli] No commits to push')
      return
    }

    execSync(`git push -u origin ${branch}`, gitOpts)
    console.error(`[pod-cli] Pushed ${branch}`)

    const title = task.slice(0, 72)
    const body = `Automated implementation by pod-cli.\n\nTask: ${task.slice(0, 500)}`
    execSync(
      `gh pr create --title "${title.replace(/"/g, '\\"')}" --body "${body.replace(/"/g, '\\"')}"`,
      gitOpts,
    )
    console.error(`[pod-cli] PR created for ${branch}`)
  } catch (err) {
    console.error(`[pod-cli] Push/PR failed:`, (err as Error).message)
  }
}

async function main(): Promise<void> {
  const { task, preset, cwd, priority, candidates, maxSelfFixes } = parseArgs()
  const repoCwd = cwd || process.cwd()

  // Extract a slug from the task for branch naming
  const issueMatch = task.match(/#(\d+)/)
  const titleMatch = task.match(/:\s*(.{1,50})/)
  const slug = issueMatch
    ? `${issueMatch[1]}-${(titleMatch?.[1] || 'task').replace(/[^a-z0-9]+/gi, '-').slice(0, 40)}`
    : (titleMatch?.[1] || 'task').replace(/[^a-z0-9]+/gi, '-').slice(0, 50)

  // Create worktree for isolation
  const wt = createWorktree(repoCwd, slug)
  const podCwd = wt?.worktreePath ?? repoCwd

  const opts: CreatePodOpts = { cwd: podCwd }
  if (preset) opts.presetId = preset
  if (priority) opts.priority = priority
  if (candidates && candidates > 0) opts.solverCandidates = candidates
  if (maxSelfFixes != null) opts.maxSelfFixes = maxSelfFixes

  try {
    const workflow = createPod(task, opts)

    // Output the workflow state
    const output = {
      id: workflow.id,
      name: workflow.name,
      status: workflow.status,
      task: workflow.task,
      cwd: workflow.cwd,
      branch: wt?.branch,
      worktreePath: wt?.worktreePath,
      solver: { agentId: workflow.solver.agentId, status: workflow.solver.status },
      reviewer: { agentId: workflow.reviewer.agentId, status: workflow.reviewer.status },
      executor: { agentId: workflow.executor.agentId, status: workflow.executor.status },
      iteration: workflow.iteration,
      maxIterations: workflow.maxIterations,
      solverCandidateCount: workflow.solverCandidateCount,
      priority: workflow.priority,
      phaseConfig: workflow.phaseConfig,
      selfFixAttempts: workflow.selfFixAttempts,
      maxSelfFixes: workflow.maxSelfFixes,
      createdAt: workflow.createdAt,
      updatedAt: workflow.updatedAt,
    }

    console.log(JSON.stringify(output))

    // Wait for the full solver→reviewer→executor pipeline to complete.
    const poll = setInterval(() => {
      const current = getPodStatus(workflow.id)
      if (!current || current.status === 'complete' || current.status === 'failed') {
        clearInterval(poll)

        // On success, push and create PR if we have a worktree
        if (current?.status === 'complete' && wt) {
          pushAndCreatePR(wt.worktreePath, wt.branch, task)
        }

        process.exit(current?.status === 'complete' ? 0 : 1)
      }
    }, 5_000)
  } catch (err) {
    console.error(JSON.stringify({ error: (err as Error).message }))
    process.exit(1)
  }
}

main()
