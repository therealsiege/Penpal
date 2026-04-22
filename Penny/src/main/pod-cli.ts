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
import { execSync, execFileSync } from 'child_process'
import fs from 'fs'

// Load .env before anything reads process.env
const __dir = typeof __dirname !== 'undefined' ? __dirname : dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dir, '../../.env') })

import { createPod, getPodStatus, type CreatePodOpts } from './pods'
import { buildScopedContext, formatScopedContext } from './pod-context'
import { MergeQueue } from './merge-queue'

interface CliArgs {
  task: string
  preset?: string
  cwd?: string
  priority?: string
  candidates?: number
  maxSelfFixes?: number
  cleanup?: boolean
  mergeQueue?: boolean
  mergeNext?: boolean
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2)
  let task = ''
  let preset: string | undefined
  let cwd: string | undefined
  let priority: string | undefined
  let candidates: number | undefined
  let maxSelfFixes: number | undefined
  let cleanup = false
  let mergeQueue = false
  let mergeNext = false

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
      case '--cleanup':
        cleanup = true
        break
      case '--merge-queue':
        mergeQueue = true
        break
      case '--merge-next':
        mergeNext = true
        break
    }
  }

  if (!cleanup && !mergeQueue && !mergeNext && !task) {
    console.error('Error: --task is required (or use --cleanup, --merge-queue, --merge-next)')
    process.exit(1)
  }

  return { task, preset, cwd, priority, candidates, maxSelfFixes, cleanup, mergeQueue, mergeNext }
}

/**
 * Prune stale git worktrees and remove .penny-worktrees/ dirs older than 48 hours.
 */
function cleanupWorktrees(repoCwd: string): void {
  const gitOpts = { cwd: repoCwd, encoding: 'utf-8' as const, stdio: 'pipe' as const, timeout: 30_000 }
  const worktreesRoot = join(repoCwd, '.penny-worktrees')
  const maxAgeMs = 48 * 60 * 60 * 1000

  // Prune deleted worktrees from git's tracking
  try {
    execSync('git worktree prune', gitOpts)
    console.error('[pod-cli] git worktree prune complete')
  } catch (err) {
    console.error('[pod-cli] git worktree prune failed:', (err as Error).message)
  }

  // Remove stale worktree directories
  if (!fs.existsSync(worktreesRoot)) {
    console.error('[pod-cli] No .penny-worktrees/ directory found — nothing to clean')
    return
  }

  const now = Date.now()
  let removed = 0
  let skipped = 0

  for (const entry of fs.readdirSync(worktreesRoot)) {
    const fullPath = join(worktreesRoot, entry)
    try {
      const stat = fs.statSync(fullPath)
      const ageMs = now - stat.mtimeMs
      if (stat.isDirectory() && ageMs > maxAgeMs) {
        try { execSync(`git worktree remove ${fullPath} --force`, gitOpts) } catch { /* already pruned */ }
        if (fs.existsSync(fullPath)) fs.rmSync(fullPath, { recursive: true, force: true })
        console.error(`[pod-cli] Removed stale worktree: ${entry} (${Math.round(ageMs / 3600000)}h old)`)
        removed++
      } else {
        skipped++
      }
    } catch (err) {
      console.error(`[pod-cli] Could not stat ${entry}:`, (err as Error).message)
    }
  }

  console.error(`[pod-cli] Cleanup done — removed ${removed}, skipped ${skipped} (under 48h)`)
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

    // If local main is ahead of origin, push it first so the worktree starts from current code
    try {
      const localAhead = parseInt(
        execSync(`git rev-list --count origin/${baseBranch}..${baseBranch}`, gitOpts).toString().trim(),
        10,
      )
      if (localAhead > 0) {
        console.error(`[pod-cli] Local ${baseBranch} is ${localAhead} commits ahead — pushing to origin`)
        execSync(`git push origin ${baseBranch}`, { ...gitOpts, timeout: 60_000 })
      }
    } catch { /* non-fatal — proceed with fetch */ }

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
      execFileSync('git', ['commit', '-m', task.slice(0, 72)], gitOpts)
    }

    // Resolve base branch
    let baseBranch = 'main'
    try {
      const ref = execSync('git symbolic-ref refs/remotes/origin/HEAD', gitOpts).toString().trim()
      baseBranch = ref.replace(/^refs\/remotes\/origin\//, '')
    } catch { /* default to main */ }

    // Fetch latest and rebase onto it before pushing
    execSync(`git fetch origin ${baseBranch}`, { ...gitOpts, timeout: 60_000 })
    try {
      execSync(`git rebase origin/${baseBranch}`, gitOpts)
      console.error(`[pod-cli] Rebased onto origin/${baseBranch}`)
    } catch {
      try { execSync('git rebase --abort', gitOpts) } catch { /* */ }
      console.error('[pod-cli] Rebase conflict — skipping PR, needs manual resolution')
      return
    }

    // Check if there's anything to push
    const ahead = parseInt(
      execSync(`git rev-list --count origin/${baseBranch}..HEAD`, { ...gitOpts, timeout: 10_000 }).toString().trim(),
      10,
    )
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

/**
 * Build and inject scoped context into the worktree's CLAUDE.md.
 * Only includes CLAUDE.md sections relevant to the task, file-specific
 * git history, and active pod branches. Much smaller than full injection.
 */
function injectScopedContext(worktreePath: string, repoCwd: string, task: string): void {
  const claudeMdPaths = [
    join(worktreePath, 'CLAUDE.md'),
    join(worktreePath, 'agents', 'CLAUDE.md'),
    join(worktreePath, 'Penny', 'CLAUDE.md'),
    join(worktreePath, 'Penny', 'agents', 'CLAUDE.md'),
  ]

  const claudeMd = claudeMdPaths.find(p => fs.existsSync(p))
  if (!claudeMd) {
    console.error('[pod-cli] No CLAUDE.md found in worktree — skipping context injection')
    return
  }

  try {
    const originalSize = fs.statSync(claudeMd).size
    const ctx = buildScopedContext(task, repoCwd, claudeMd)
    const scoped = formatScopedContext(ctx, task)

    // Replace worktree CLAUDE.md with scoped version (much smaller)
    fs.writeFileSync(claudeMd, scoped)

    const fileCount = ctx.relevantFiles.length
    console.error(`[pod-cli] Scoped context: ${fileCount} relevant files, ${scoped.length} chars (was ${originalSize} bytes)`)
  } catch (err) {
    console.error('[pod-cli] Scoped context injection failed (non-fatal):', (err as Error).message)
  }
}

async function main(): Promise<void> {
  const { task, preset, cwd, priority, candidates, maxSelfFixes, cleanup, mergeQueue, mergeNext } = parseArgs()
  const repoCwd = cwd || process.cwd()

  // Handle --cleanup before anything else
  if (cleanup) {
    cleanupWorktrees(repoCwd)
    process.exit(0)
  }

  // Handle merge queue commands
  if (mergeQueue || mergeNext) {
    const queue = new MergeQueue(repoCwd)
    if (mergeNext) {
      const result = queue.processNext()
      if (!result) {
        console.log('[merge-queue] Queue empty')
        process.exit(0)
      }
      console.log(JSON.stringify(result, null, 2))
      process.exit(result.status === 'merged' ? 0 : 1)
    } else {
      const results = queue.processAll()
      const failed = results.filter(r => r.status === 'failed').length
      process.exit(failed > 0 ? 1 : 0)
    }
    return
  }

  // Extract a slug from the task for branch naming
  const issueMatch = task.match(/#(\d+)/)
  const titleMatch = task.match(/:\s*(.{1,50})/)
  const slug = issueMatch
    ? `${issueMatch[1]}-${(titleMatch?.[1] || 'task').replace(/[^a-z0-9]+/gi, '-').slice(0, 40)}`
    : (titleMatch?.[1] || 'task').replace(/[^a-z0-9]+/gi, '-').slice(0, 50)

  // Create worktree for isolation
  const wt = createWorktree(repoCwd, slug)
  const podCwd = wt?.worktreePath ?? repoCwd

  // Inject scoped context into worktree CLAUDE.md — only relevant sections
  if (wt) {
    injectScopedContext(wt.worktreePath, repoCwd, task)
  }

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
