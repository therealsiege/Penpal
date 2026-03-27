/**
 * GitHub Issue Poller — watches for `agent-ready` labeled issues,
 * enqueues them into Penny's orchestrator (which spools up local claude-code
 * sessions), and tracks progress through the pipeline.
 *
 * Label lifecycle (Penny owns this, GA workflows are disabled):
 *   agent-ready  →  agent-working  →  pr-ready | agent-failed
 *
 * On pickup: removes `agent-ready`, adds `agent-working`, posts comment.
 * On completion/failure: orchestrator events update labels via callbacks.
 */

import { execSync, execFileSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { enqueueTask, getTaskQueue, getTask, type TaskPriority } from './orchestrator'

// ── Config ──────────────────────────────────────────────────────────────────

interface RepoConfig {
  owner: string
  repo: string
  label: string
  workingLabel: string
  /** Local clone path for agent cwd */
  localPath: string
  /** Default project name for task routing */
  project: string
}

const REPOS: RepoConfig[] = [
  {
    owner: 'graphiteatlas',
    repo: 'atlas',
    label: 'agent-ready',
    workingLabel: 'agent-working',
    localPath: path.resolve(process.env.HOME || '~', 'ComSci', 'Workspace', 'graphiteatlas', 'atlas'),
    project: 'atlas',
  },
]

const POLL_INTERVAL = 60 * 1000 // 1 minute
const TASK_SYNC_INTERVAL = 15 * 1000 // sync task status → labels every 15s
const DATA_DIR = path.resolve(__dirname, '..', '..', 'data')
const SEEN_PATH = path.join(DATA_DIR, 'github-issues-seen.json')

// ── Persistence ─────────────────────────────────────────────────────────────

interface TrackedIssue {
  number: number
  repo: string       // "owner/repo"
  taskId: string
  title: string
  stage: string       // queued | planning | executing | done | failed
  priority: string
  ingestedAt: number
  updatedAt: number
  labelSynced: boolean // true once final label (pr-ready/agent-failed) has been applied
  branch?: string     // git branch created for this issue
}

let trackedIssues: TrackedIssue[] = []
// Eagerly load tracked issues so cards are available before poller starts
try {
  if (fs.existsSync(SEEN_PATH)) {
    const _raw = JSON.parse(fs.readFileSync(SEEN_PATH, 'utf-8'))
    if (Array.isArray(_raw)) trackedIssues = _raw
  }
} catch { /* will be loaded again when poller starts */ }

function loadTracked(): void {
  try {
    if (fs.existsSync(SEEN_PATH)) {
      const raw = JSON.parse(fs.readFileSync(SEEN_PATH, 'utf-8'))
      if (Array.isArray(raw) && raw.length > 0) {
        // Migrate from old format if needed
        if ('taskId' in raw[0] && !('stage' in raw[0])) {
          trackedIssues = raw.map((old: { number: number; repo: string; taskId: string; ingestedAt: number }) => ({
            number: old.number,
            repo: old.repo,
            taskId: old.taskId,
            title: `Issue #${old.number}`,
            stage: 'executing',
            priority: 'normal',
            ingestedAt: old.ingestedAt,
            updatedAt: old.ingestedAt,
            labelSynced: false,
          }))
          saveTracked()
        } else {
          trackedIssues = raw
        }
      }
    }
  } catch {
    trackedIssues = []
  }
}

function saveTracked(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
    fs.writeFileSync(SEEN_PATH, JSON.stringify(trackedIssues, null, 2))
  } catch (err) {
    console.error('[github-issues] Failed to save tracked issues:', err)
  }
}

// ── Label definitions ─────────────────────────────────────────────────────

const REQUIRED_LABELS = [
  { name: 'agent-ready',   color: '8e3e85', description: 'Issue ready for agent pickup' },
  { name: 'agent-working', color: '3130c0', description: 'Agent is actively working on this' },
  { name: 'agent-done',    color: '0beb24', description: 'Agent completed the work' },
  { name: 'agent-failed',  color: '3c303e', description: 'Agent failed to complete the work' },
  { name: 'pr-ready',      color: '0beb24', description: 'PR has been created for review' },
]

/** Ensure all required labels exist in a repo. Silently skips existing ones. */
function ensureLabels(owner: string, repo: string): void {
  for (const label of REQUIRED_LABELS) {
    try {
      execFileSync('gh', [
        'label', 'create', label.name,
        '--color', label.color,
        '--description', label.description,
        '--repo', `${owner}/${repo}`,
      ], { encoding: 'utf-8', timeout: 15_000, stdio: 'pipe' })
      console.log(`[github-issues] Created label "${label.name}" in ${owner}/${repo}`)
    } catch {
      // Label already exists — expected, ignore
    }
  }
}

// ── Git branch helpers ────────────────────────────────────────────────────

function createIssueBranch(localPath: string, issueNumber: number, slug: string): string | null {
  const branch = `issue-${issueNumber}-${slug}`
  try {
    // Fetch latest main, create branch from it
    execSync('git fetch origin main 2>/dev/null || git fetch origin master 2>/dev/null || true', {
      cwd: localPath, encoding: 'utf-8', timeout: 30_000, stdio: 'pipe',
    })
    // Detect default branch
    let baseBranch = 'main'
    try {
      baseBranch = execSync('git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null || echo refs/remotes/origin/main', {
        cwd: localPath, encoding: 'utf-8', timeout: 10_000, stdio: 'pipe',
      }).trim().replace('refs/remotes/origin/', '')
    } catch { /* default to main */ }

    execSync(`git checkout -b "${branch}" "origin/${baseBranch}"`, {
      cwd: localPath, encoding: 'utf-8', timeout: 15_000, stdio: 'pipe',
    })
    console.log(`[github-issues] Created branch ${branch} in ${localPath}`)
    return branch
  } catch (err) {
    console.error(`[github-issues] Failed to create branch ${branch}:`, err)
    return null
  }
}

function pushBranchAndCreatePR(
  config: RepoConfig,
  localPath: string,
  branch: string,
  issueNumber: number,
  title: string,
): boolean {
  try {
    // Stage all changes, commit, push
    execSync('git add -A', { cwd: localPath, encoding: 'utf-8', timeout: 15_000, stdio: 'pipe' })

    // Check if there are changes to commit
    const status = execSync('git status --porcelain', { cwd: localPath, encoding: 'utf-8', timeout: 10_000, stdio: 'pipe' }).trim()
    if (!status) {
      console.log(`[github-issues] No changes to commit on branch ${branch}`)
      return false
    }

    const commitMsg = `${title}\n\nCloses #${issueNumber}\n\nCo-Authored-By: Penny Orchestrator <noreply@penny.dev>`
    execFileSync('git', ['commit', '-m', commitMsg], {
      cwd: localPath, encoding: 'utf-8', timeout: 15_000, stdio: 'pipe',
    })

    execFileSync('git', ['push', '-u', 'origin', branch], {
      cwd: localPath, encoding: 'utf-8', timeout: 60_000, stdio: 'pipe',
    })

    // Create PR
    const prBody = `Closes #${issueNumber}\n\nAutomated implementation by Penny orchestrator.`
    execFileSync('gh', [
      'pr', 'create',
      '--repo', `${config.owner}/${config.repo}`,
      '--head', branch,
      '--title', title,
      '--body', prBody,
    ], { cwd: localPath, encoding: 'utf-8', timeout: 30_000, stdio: 'pipe' })

    console.log(`[github-issues] Created PR for branch ${branch}`)
    return true
  } catch (err) {
    console.error(`[github-issues] Failed to push/PR for ${branch}:`, err)
    return false
  }
}

function cleanupBranch(localPath: string): void {
  try {
    // Go back to main/master so we don't leave the repo on a stale branch
    execSync('git checkout main 2>/dev/null || git checkout master 2>/dev/null || true', {
      cwd: localPath, encoding: 'utf-8', timeout: 15_000, stdio: 'pipe',
    })
  } catch { /* best effort */ }
}

// ── GitHub CLI helpers ──────────────────────────────────────────────────────

interface GHIssue {
  number: number
  title: string
  body: string
  labels: { name: string }[]
  assignees: { login: string }[]
  url: string
}

function fetchAgentReadyIssues(config: RepoConfig): GHIssue[] {
  try {
    const raw = execFileSync('gh', [
      'issue', 'list',
      '--repo', `${config.owner}/${config.repo}`,
      '--label', config.label,
      '--state', 'open',
      '--json', 'number,title,body,labels,assignees,url',
      '--limit', '20',
    ], { encoding: 'utf-8', timeout: 30_000 })
    return JSON.parse(raw)
  } catch (err) {
    console.error(`[github-issues] Failed to fetch issues from ${config.owner}/${config.repo}:`, err)
    return []
  }
}

function swapLabel(config: RepoConfig, issueNumber: number): void {
  try {
    execFileSync('gh', [
      'issue', 'edit', String(issueNumber),
      '--repo', `${config.owner}/${config.repo}`,
      '--remove-label', config.label,
      '--add-label', config.workingLabel,
    ], { encoding: 'utf-8', timeout: 15_000 })
    console.log(`[github-issues] Swapped labels on ${config.owner}/${config.repo}#${issueNumber}`)
  } catch (err) {
    console.error(`[github-issues] Failed to swap labels on #${issueNumber}:`, err)
  }
}

function setLabel(config: RepoConfig, issueNumber: number, removeLabels: string[], addLabel: string): void {
  try {
    const args = ['issue', 'edit', String(issueNumber), '--repo', `${config.owner}/${config.repo}`]
    for (const l of removeLabels) args.push('--remove-label', l)
    args.push('--add-label', addLabel)
    execFileSync('gh', args, { encoding: 'utf-8', timeout: 15_000 })
  } catch (err) {
    console.error(`[github-issues] Failed to set label ${addLabel} on #${issueNumber}:`, err)
  }
}

function addComment(config: RepoConfig, issueNumber: number, body: string): void {
  try {
    execFileSync('gh', [
      'issue', 'comment', String(issueNumber),
      '--repo', `${config.owner}/${config.repo}`,
      '--body', body,
    ], { encoding: 'utf-8', timeout: 15_000 })
  } catch (err) {
    console.error(`[github-issues] Failed to comment on #${issueNumber}:`, err)
  }
}

// ── Priority / skill mapping ────────────────────────────────────────────────

function derivePriority(issue: GHIssue): TaskPriority {
  const labels = issue.labels.map(l => l.name.toLowerCase())
  if (labels.includes('critical')) return 'critical'
  if (labels.includes('high-priority')) return 'high'
  if (labels.includes('low-priority')) return 'low'
  return 'normal'
}

function deriveSkills(issue: GHIssue): string[] {
  const labels = issue.labels.map(l => l.name.toLowerCase())
  const skills: string[] = []
  if (labels.includes('frontend') || labels.includes('ui')) skills.push('react', 'typescript')
  if (labels.includes('api') || labels.includes('backend')) skills.push('node', 'typescript')
  if (labels.includes('bug')) skills.push('debugging')
  if (labels.includes('performance')) skills.push('performance')
  if (labels.includes('security')) skills.push('security')
  if (skills.length === 0) skills.push('typescript')
  return skills
}

// ── Poll loop — discover + enqueue ──────────────────────────────────────────

async function pollOnce(): Promise<number> {
  let enqueued = 0

  for (const config of REPOS) {
    const repoKey = `${config.owner}/${config.repo}`
    const issues = fetchAgentReadyIssues(config)
    if (issues.length > 0) {
      console.log(`[github-issues] Found ${issues.length} agent-ready issues in ${repoKey}`)
    }

    for (const issue of issues) {
      // Already tracked? Allow re-queue if previous attempt is terminal (done/failed)
      const existing = trackedIssues.find(t => t.repo === repoKey && t.number === issue.number)
      if (existing) {
        if (existing.stage !== 'done' && existing.stage !== 'failed') continue
        // Remove stale entry so we can re-enqueue fresh
        trackedIssues = trackedIssues.filter(t => !(t.repo === repoKey && t.number === issue.number))
        console.log(`[github-issues] Re-queuing #${issue.number} (previous: ${existing.stage})`)
      }

      // Create isolated branch for this issue
      const slug = issue.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40).replace(/-$/, '')
      const branch = config.localPath
        ? createIssueBranch(config.localPath, issue.number, slug)
        : null

      // Build task description with branch context
      const branchNote = branch
        ? `\n\n**IMPORTANT**: You are on branch \`${branch}\`. Commit your work to this branch. Do NOT push or create PRs — that will be handled automatically.`
        : ''

      const description = [
        `GitHub Issue: ${repoKey}#${issue.number}`,
        `URL: https://github.com/${repoKey}/issues/${issue.number}`,
        branchNote,
        '',
        issue.body || '(no description)',
      ].join('\n')

      const task = enqueueTask({
        title: `[${config.repo}#${issue.number}] ${issue.title}`,
        description,
        project: config.localPath,
        priority: derivePriority(issue),
        requiredSkills: deriveSkills(issue),
        source: 'github',
      })

      trackedIssues.push({
        number: issue.number,
        repo: repoKey,
        taskId: task.id,
        title: issue.title,
        stage: 'queued',
        priority: task.priority,
        ingestedAt: Date.now(),
        updatedAt: Date.now(),
        labelSynced: false,
        branch: branch ?? undefined,
      })
      saveTracked()

      // Swap label: agent-ready → agent-working
      swapLabel(config, issue.number)

      // Comment on the issue
      const branchMsg = branch ? `\nBranch: \`${branch}\`` : ''
      addComment(config, issue.number,
        `🤖 **Picked up by Penny orchestrator**\n\nTask ID: \`${task.id}\`\nPriority: ${task.priority}\nSkills: ${task.requiredSkills.join(', ')}${branchMsg}\n\nA local claude-code session will be spooled up to work on this.`,
      )

      enqueued++
      console.log(`[github-issues] Enqueued #${issue.number}: "${issue.title}" as ${task.id} (branch: ${branch || 'none'})`)
    }
  }

  return enqueued
}

// ── Task sync loop — update labels based on orchestrator task status ─────────

function syncTaskStatuses(): void {
  let changed = false

  for (const tracked of trackedIssues) {
    if (tracked.labelSynced) continue

    const task = getTask(tracked.taskId)
    if (!task) continue

    const config = REPOS.find(r => `${r.owner}/${r.repo}` === tracked.repo)
    if (!config) continue

    let newStage = tracked.stage

    // Map orchestrator task status → our stage
    if (task.status === 'queued') newStage = 'queued'
    else if (task.status === 'assigned' || task.status === 'active') {
      newStage = task.currentStage === 'planning' ? 'planning' : 'executing'
    }
    else if (task.status === 'completed') newStage = 'done'
    else if (task.status === 'failed' || task.status === 'cancelled') newStage = 'failed'

    if (newStage !== tracked.stage) {
      tracked.stage = newStage
      tracked.updatedAt = Date.now()
      changed = true

      // Sync terminal labels back to GitHub
      if (newStage === 'done') {
        // Push branch and create PR if we have a branch
        let prCreated = false
        if (tracked.branch && config.localPath) {
          prCreated = pushBranchAndCreatePR(
            config, config.localPath, tracked.branch, tracked.number,
            `[${config.repo}#${tracked.number}] ${tracked.title}`,
          )
          cleanupBranch(config.localPath)
        }

        const doneLabel = prCreated ? 'pr-ready' : 'agent-done'
        setLabel(config, tracked.number, ['agent-working'], doneLabel)
        const prNote = prCreated ? '\nA pull request has been created for review.' : ''
        addComment(config, tracked.number,
          `✅ **Task completed**\n\nThe agent finished working on this issue.\nTask ID: \`${tracked.taskId}\`${prNote}`,
        )
        tracked.labelSynced = true
      } else if (newStage === 'failed') {
        // Cleanup branch on failure
        if (config.localPath) cleanupBranch(config.localPath)

        setLabel(config, tracked.number, ['agent-working'], 'agent-failed')
        addComment(config, tracked.number,
          `❌ **Task failed**\n\nThe agent encountered an error.\nTask ID: \`${tracked.taskId}\`\n\nTo retry, remove \`agent-failed\` and add \`agent-ready\` again.`,
        )
        tracked.labelSynced = true
      }
    }
  }

  if (changed) saveTracked()
}

// ── Lifecycle ───────────────────────────────────────────────────────────────

let pollTimer: ReturnType<typeof setInterval> | null = null
let syncTimer: ReturnType<typeof setInterval> | null = null

export function startGithubIssuePoller(): void {
  if (pollTimer) return
  loadTracked()
  // Self-heal: consolidate any duplicate entries from re-queued issues
  consolidateTrackedIssues()
  console.log(`[github-issues] Starting poller (${POLL_INTERVAL / 1000}s) for ${REPOS.map(r => `${r.owner}/${r.repo}`).join(', ')}`)

  // Ensure labels exist in all watched repos (async, best-effort)
  for (const config of REPOS) {
    ensureLabels(config.owner, config.repo)
  }

  // Initial poll on startup (delayed 5s)
  setTimeout(() => { pollOnce().catch(console.error) }, 5_000)

  pollTimer = setInterval(() => { pollOnce().catch(console.error) }, POLL_INTERVAL)

  // Task status → label sync loop
  syncTimer = setInterval(() => syncTaskStatuses(), TASK_SYNC_INTERVAL)
}

export function stopGithubIssuePoller(): void {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
  if (syncTimer) { clearInterval(syncTimer); syncTimer = null }
  console.log('[github-issues] Stopped')
}

/** Force a poll right now (used from dashboard). */
export async function pollGithubIssuesNow(): Promise<{ enqueued: number }> {
  return { enqueued: await pollOnce() }
}

/** Consolidate tracked issues — remove duplicates, keep most recent entry per issue. */
export function consolidateTrackedIssues(): { removed: number } {
  const seen = new Map<string, TrackedIssue>()
  let removed = 0

  // Walk in order, keeping the latest entry per repo+number
  for (const t of trackedIssues) {
    const key = `${t.repo}#${t.number}`
    const existing = seen.get(key)
    if (existing) {
      // Keep whichever is more recent
      if (t.updatedAt > existing.updatedAt) {
        seen.set(key, t)
      }
      removed++
    } else {
      seen.set(key, t)
    }
  }

  if (removed > 0) {
    trackedIssues = Array.from(seen.values())
    saveTracked()
    console.log(`[github-issues] Consolidated: removed ${removed} duplicate entries`)
  }

  return { removed }
}

/** Get status for the dashboard. */
export function getGithubIssuePollerStatus(): {
  running: boolean
  repos: string[]
  seenCount: number
  lastPoll: number | null
  pollIntervalMs: number
} {
  return {
    running: pollTimer !== null,
    repos: REPOS.map(r => `${r.owner}/${r.repo}`),
    seenCount: trackedIssues.length,
    lastPoll: trackedIssues.length > 0
      ? Math.max(...trackedIssues.map(s => s.updatedAt))
      : null,
    pollIntervalMs: POLL_INTERVAL,
  }
}

/** Get all tracked issues for visibility. */
export function getSeenIssues(): { number: number; repo: string; taskId: string; ingestedAt: number }[] {
  return trackedIssues.map(t => ({
    number: t.number,
    repo: t.repo,
    taskId: t.taskId,
    ingestedAt: t.ingestedAt,
  }))
}

/** GitHub issue card for the kanban view. */
export interface GitHubIssueCard {
  issueNumber: number
  repo: string
  title: string
  taskId: string
  taskStatus: string
  taskStage: string | null
  priority: string
  assignedAgent: string | null
  ingestedAt: number
  url: string
}

/** Get kanban-ready cards enriched with live orchestrator task status. */
export function getGithubIssueCards(): GitHubIssueCard[] {
  const queue = getTaskQueue()
  const taskMap = new Map(queue.map(t => [t.id, t]))

  return trackedIssues.map(tracked => {
    const task = taskMap.get(tracked.taskId)
    return {
      issueNumber: tracked.number,
      repo: tracked.repo,
      title: tracked.title,
      taskId: tracked.taskId,
      taskStatus: task?.status || tracked.stage,
      taskStage: task?.currentStage || tracked.stage,
      priority: task?.priority || tracked.priority,
      assignedAgent: task?.assignedAgent || null,
      ingestedAt: tracked.ingestedAt,
      url: `https://github.com/${tracked.repo}/issues/${tracked.number}`,
    }
  })
}

// ── Repo management (persisted) ────────────────────────────────────────────

const REPOS_PATH = path.join(DATA_DIR, 'github-watched-repos.json')

function loadPersistedRepos(): void {
  try {
    if (fs.existsSync(REPOS_PATH)) {
      const data = JSON.parse(fs.readFileSync(REPOS_PATH, 'utf-8'))
      if (Array.isArray(data)) {
        for (const r of data) {
          if (r.owner && r.repo && !REPOS.find(e => e.owner === r.owner && e.repo === r.repo)) {
            REPOS.push({
              owner: r.owner,
              repo: r.repo,
              label: r.label || 'agent-ready',
              workingLabel: r.workingLabel || 'agent-working',
              localPath: r.localPath || '',
              project: r.project || r.repo,
            })
          }
        }
      }
    }
  } catch { /* ignore */ }
}

function savePersistedRepos(): void {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true })
    fs.writeFileSync(REPOS_PATH, JSON.stringify(REPOS.map(r => ({
      owner: r.owner, repo: r.repo, label: r.label,
      workingLabel: r.workingLabel, localPath: r.localPath, project: r.project,
    })), null, 2))
  } catch { /* ignore */ }
}

// Load persisted repos on module init
loadPersistedRepos()

/** Add a repo to watch. Persisted to disk. Ensures labels exist. */
export function addWatchedRepo(owner: string, repo: string, localPath: string): void {
  const existing = REPOS.find(r => r.owner === owner && r.repo === repo)
  if (existing) return
  REPOS.push({
    owner,
    repo,
    label: 'agent-ready',
    workingLabel: 'agent-working',
    localPath,
    project: repo,
  })
  savePersistedRepos()
  // Create labels if they don't exist
  ensureLabels(owner, repo)
  console.log(`[github-issues] Now watching ${owner}/${repo}`)
}

/** Remove a repo from the watch list. */
export function removeWatchedRepo(owner: string, repo: string): void {
  const idx = REPOS.findIndex(r => r.owner === owner && r.repo === repo)
  if (idx === -1) return
  REPOS.splice(idx, 1)
  savePersistedRepos()
  console.log(`[github-issues] Stopped watching ${owner}/${repo}`)
}

/** List all watched repos. */
export function getWatchedRepos(): { owner: string; repo: string; localPath: string }[] {
  return REPOS.map(r => ({ owner: r.owner, repo: r.repo, localPath: r.localPath }))
}
