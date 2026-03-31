/**
 * GitHub Issue Poller — watches for `agent-ready` labeled issues,
 * enqueues them into Penny's orchestrator (headless agent via PENNY_TASK_RUNNER),
 * and tracks progress through the pipeline.
 *
 * Label lifecycle (Penny owns this, GA workflows are disabled):
 *   agent-ready  →  agent-working  →  pr-ready | agent-failed
 *
 * On pickup: removes `agent-ready`, adds `agent-working`, posts comment.
 * On completion/failure: orchestrator events update labels via callbacks.
 */

import { execFile } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'
import os from 'os'

const execFileAsync = promisify(execFile)
import { enqueueTask, getTaskQueue, getTask, type TaskPriority } from './orchestrator'
import { ingestIssue, drivePipeline, initPipeline, getPipelineIssues } from './github-pipeline'
import { atomicWrite } from './atomic-store'
import { getAtlasRoot } from './project-paths'

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
    localPath: getAtlasRoot(),
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
  /** When set, agent cwd + push/PR use this path (`git worktree add` checkout) */
  worktreePath?: string
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
    atomicWrite(SEEN_PATH, trackedIssues)
  } catch (err) {
    console.error('[github-issues] Failed to save tracked issues:', err)
  }
}

// ── Label definitions ─────────────────────────────────────────────────────

const REQUIRED_LABELS = [
  { name: 'agent-ready',     color: '8e3e85', description: 'Issue ready for agent pickup' },
  { name: 'agent-planning',  color: 'a855f7', description: 'Planner agent is designing the approach' },
  { name: 'agent-question',  color: 'fbbf24', description: 'Agent has a question — answer on the issue' },
  { name: 'agent-executing', color: '3b82f6', description: 'Executor agent is implementing' },
  { name: 'agent-working',   color: '3130c0', description: 'Agent is actively working on this (legacy)' },
  { name: 'agent-done',      color: '0beb24', description: 'Agent completed the work' },
  { name: 'agent-failed',    color: '3c303e', description: 'Agent failed to complete the work' },
  { name: 'pr-ready',        color: '0beb24', description: 'PR has been created for review' },
]

/** Ensure all required labels exist in a repo. Silently skips existing ones. */
async function ensureLabels(owner: string, repo: string): Promise<void> {
  await Promise.allSettled(
    REQUIRED_LABELS.map(async (label) => {
      try {
        await execFileAsync('gh', [
          'label', 'create', label.name,
          '--color', label.color,
          '--description', label.description,
          '--repo', `${owner}/${repo}`,
        ], { encoding: 'utf-8', timeout: 15_000 })
        console.log(`[github-issues] Created label "${label.name}" in ${owner}/${repo}`)
      } catch {
        // Label already exists — expected, ignore
      }
    }),
  )
}

// ── Git branch helpers ────────────────────────────────────────────────────

/**
 * Isolated checkout via `git worktree add` so concurrent issues do not share one working tree.
 * Set `PENNY_GITHUB_USE_WORKTREE=1` to enable.
 */
async function createIssueWorktree(
  mainRepoPath: string,
  issueNumber: number,
  slug: string,
): Promise<{ branch: string; worktreePath: string } | null> {
  const branch = `issue-${issueNumber}-${slug}`
  const safeSlug = slug.replace(/[^a-z0-9-]/gi, '-').slice(0, 40).replace(/-$/, '') || 'issue'
  const worktreesRoot = path.join(mainRepoPath, '.penny-worktrees')
  const worktreePath = path.join(worktreesRoot, `${issueNumber}-${safeSlug}`)

  try {
    fs.mkdirSync(worktreesRoot, { recursive: true })
    await execFileAsync('git', ['fetch', 'origin', 'main'], {
      cwd: mainRepoPath, encoding: 'utf-8', timeout: 30_000,
    }).catch(() => execFileAsync('git', ['fetch', 'origin', 'master'], {
      cwd: mainRepoPath, encoding: 'utf-8', timeout: 30_000,
    }).catch(() => {}))
    let baseBranch = 'main'
    try {
      const { stdout } = await execFileAsync('git', ['symbolic-ref', 'refs/remotes/origin/HEAD'], {
        cwd: mainRepoPath, encoding: 'utf-8', timeout: 10_000,
      })
      baseBranch = stdout.trim().replace('refs/remotes/origin/', '')
    } catch { /* */ }

    if (fs.existsSync(path.join(worktreePath, '.git'))) {
      await execFileAsync('git', ['worktree', 'remove', worktreePath, '--force'], {
        cwd: mainRepoPath, encoding: 'utf-8', timeout: 30_000,
      })
    }

    await execFileAsync('git', ['worktree', 'add', worktreePath, '-b', branch, `origin/${baseBranch}`], {
      cwd: mainRepoPath, encoding: 'utf-8', timeout: 60_000,
    })
    console.log(`[github-issues] Worktree ${worktreePath} branch ${branch}`)
    return { branch, worktreePath }
  } catch (err) {
    console.error(`[github-issues] Failed to create worktree at ${worktreePath}:`, err)
    return null
  }
}

async function createIssueBranch(localPath: string, issueNumber: number, slug: string): Promise<string | null> {
  const branch = `issue-${issueNumber}-${slug}`
  try {
    await execFileAsync('git', ['fetch', 'origin', 'main'], {
      cwd: localPath, encoding: 'utf-8', timeout: 30_000,
    }).catch(() => execFileAsync('git', ['fetch', 'origin', 'master'], {
      cwd: localPath, encoding: 'utf-8', timeout: 30_000,
    }).catch(() => {}))
    let baseBranch = 'main'
    try {
      const { stdout } = await execFileAsync('git', ['symbolic-ref', 'refs/remotes/origin/HEAD'], {
        cwd: localPath, encoding: 'utf-8', timeout: 10_000,
      })
      baseBranch = stdout.trim().replace('refs/remotes/origin/', '')
    } catch { /* default to main */ }

    await execFileAsync('git', ['checkout', '-b', branch, `origin/${baseBranch}`], {
      cwd: localPath, encoding: 'utf-8', timeout: 15_000,
    })
    console.log(`[github-issues] Created branch ${branch} in ${localPath}`)
    return branch
  } catch (err) {
    console.error(`[github-issues] Failed to create branch ${branch}:`, err)
    return null
  }
}

async function pushBranchAndCreatePR(
  config: RepoConfig,
  localPath: string,
  branch: string,
  issueNumber: number,
  title: string,
): Promise<boolean> {
  try {
    await execFileAsync('git', ['add', '-A'], { cwd: localPath, encoding: 'utf-8', timeout: 15_000 })
    const { stdout: status } = await execFileAsync('git', ['status', '--porcelain'], {
      cwd: localPath, encoding: 'utf-8', timeout: 10_000,
    })
    if (!status.trim()) {
      console.log(`[github-issues] No changes to commit on branch ${branch}`)
      return false
    }

    const commitMsg = `${title}\n\nCloses #${issueNumber}\n\nCo-Authored-By: Penny Orchestrator <noreply@penny.dev>`
    await execFileAsync('git', ['commit', '-m', commitMsg], {
      cwd: localPath, encoding: 'utf-8', timeout: 15_000,
    })
    await execFileAsync('git', ['push', '-u', 'origin', branch], {
      cwd: localPath, encoding: 'utf-8', timeout: 60_000,
    })

    const prBody = `Closes #${issueNumber}\n\nAutomated implementation by Penny orchestrator.`
    await execFileAsync('gh', [
      'pr', 'create',
      '--repo', `${config.owner}/${config.repo}`,
      '--head', branch,
      '--title', title,
      '--body', prBody,
    ], { cwd: localPath, encoding: 'utf-8', timeout: 30_000 })

    console.log(`[github-issues] Created PR for branch ${branch}`)
    return true
  } catch (err) {
    console.error(`[github-issues] Failed to push/PR for ${branch}:`, err)
    return false
  }
}

async function cleanupBranch(localPath: string): Promise<void> {
  await execFileAsync('git', ['checkout', 'main'], {
    cwd: localPath, encoding: 'utf-8', timeout: 15_000,
  }).catch(() => execFileAsync('git', ['checkout', 'master'], {
    cwd: localPath, encoding: 'utf-8', timeout: 15_000,
  }).catch(() => {}))
}

/** After PR push or failure: remove worktree or checkout main on primary clone */
async function cleanupAfterGithubTask(config: RepoConfig, tracked: TrackedIssue): Promise<void> {
  if (tracked.worktreePath) {
    try {
      await execFileAsync('git', ['worktree', 'remove', tracked.worktreePath, '--force'], {
        cwd: config.localPath, encoding: 'utf-8', timeout: 30_000,
      })
      console.log(`[github-issues] Removed worktree ${tracked.worktreePath}`)
    } catch (err) {
      console.error(`[github-issues] worktree remove failed for ${tracked.worktreePath}:`, err)
    }
    return
  }
  await cleanupBranch(config.localPath)
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

async function fetchAgentReadyIssues(config: RepoConfig): Promise<GHIssue[]> {
  try {
    const { stdout } = await execFileAsync('gh', [
      'issue', 'list',
      '--repo', `${config.owner}/${config.repo}`,
      '--label', config.label,
      '--state', 'open',
      '--json', 'number,title,body,labels,assignees,url',
      '--limit', '20',
    ], { encoding: 'utf-8', timeout: 30_000 })
    return JSON.parse(stdout)
  } catch (err) {
    console.error(`[github-issues] Failed to fetch issues from ${config.owner}/${config.repo}:`, err)
    return []
  }
}

async function swapLabel(config: RepoConfig, issueNumber: number): Promise<void> {
  try {
    await execFileAsync('gh', [
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

async function setLabel(config: RepoConfig, issueNumber: number, removeLabels: string[], addLabel: string): Promise<void> {
  try {
    const args = ['issue', 'edit', String(issueNumber), '--repo', `${config.owner}/${config.repo}`]
    for (const l of removeLabels) args.push('--remove-label', l)
    args.push('--add-label', addLabel)
    await execFileAsync('gh', args, { encoding: 'utf-8', timeout: 15_000 })
  } catch (err) {
    console.error(`[github-issues] Failed to set label ${addLabel} on #${issueNumber}:`, err)
  }
}

async function addComment(config: RepoConfig, issueNumber: number, body: string): Promise<void> {
  try {
    await execFileAsync('gh', [
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
    const issues = await fetchAgentReadyIssues(config)
    if (issues.length > 0) {
      console.log(`[github-issues] Found ${issues.length} agent-ready issues in ${repoKey}`)
    }

    for (const issue of issues) {
      // Already in pipeline? Skip unless terminal
      const pipelineIssues = getPipelineIssues()
      const inPipeline = pipelineIssues.find(p => p.repo === repoKey && p.number === issue.number)
      if (inPipeline && inPipeline.stage !== 'done' && inPipeline.stage !== 'failed') continue

      // Also check legacy tracked issues
      const existing = trackedIssues.find(t => t.repo === repoKey && t.number === issue.number)
      if (existing) {
        if (existing.stage !== 'done' && existing.stage !== 'failed') continue
        trackedIssues = trackedIssues.filter(t => !(t.repo === repoKey && t.number === issue.number))
      }

      // Route to 2-agent pipeline
      await ingestIssue(
        { owner: config.owner, repo: config.repo, localPath: config.localPath },
        { number: issue.number, title: issue.title, body: issue.body, labels: issue.labels },
      )

      enqueued++
    }
  }

  return enqueued
}

// ── Task sync loop — update labels based on orchestrator task status ─────────

async function syncTaskStatuses(): Promise<void> {
  let changed = false
  const labelOps: Promise<void>[] = []

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

      if (newStage === 'done') {
        const doneOp = (async () => {
          let prCreated = false
          const gitCwd = tracked.worktreePath ?? config.localPath
          if (tracked.branch && gitCwd) {
            prCreated = await pushBranchAndCreatePR(
              config, gitCwd, tracked.branch, tracked.number,
              `[${config.repo}#${tracked.number}] ${tracked.title}`,
            )
            await cleanupAfterGithubTask(config, tracked)
          }
          const doneLabel = prCreated ? 'pr-ready' : 'agent-done'
          const prNote = prCreated ? '\nA pull request has been created for review.' : ''
          await Promise.allSettled([
            setLabel(config, tracked.number, ['agent-working'], doneLabel),
            addComment(config, tracked.number,
              `✅ **Task completed**\n\nThe agent finished working on this issue.\nTask ID: \`${tracked.taskId}\`${prNote}`,
            ),
          ])
        })()
        labelOps.push(doneOp)
        tracked.labelSynced = true
      } else if (newStage === 'failed') {
        const failOp = (async () => {
          if (config.localPath) await cleanupAfterGithubTask(config, tracked)
          await Promise.allSettled([
            setLabel(config, tracked.number, ['agent-working'], 'agent-failed'),
            addComment(config, tracked.number,
              `❌ **Task failed**\n\nThe agent encountered an error.\nTask ID: \`${tracked.taskId}\`\n\nTo retry, remove \`agent-failed\` and add \`agent-ready\` again.`,
            ),
          ])
        })()
        labelOps.push(failOp)
        tracked.labelSynced = true
      }
    }
  }

  if (labelOps.length > 0) await Promise.allSettled(labelOps)
  if (changed) saveTracked()
}

// ── Lifecycle ───────────────────────────────────────────────────────────────

let pollTimer: ReturnType<typeof setInterval> | null = null
let syncTimer: ReturnType<typeof setInterval> | null = null

export function startGithubIssuePoller(): void {
  if (pollTimer) return
  loadTracked()
  initPipeline()
  // Self-heal: consolidate any duplicate entries from re-queued issues
  consolidateTrackedIssues()
  console.log(`[github-issues] Starting poller (${POLL_INTERVAL / 1000}s) for ${REPOS.map(r => `${r.owner}/${r.repo}`).join(', ')}`)

  // Ensure labels exist in all watched repos (fire-and-forget)
  for (const config of REPOS) {
    ensureLabels(config.owner, config.repo).catch(console.error)
  }

  // Initial poll on startup (delayed 5s)
  setTimeout(() => { pollOnce().catch(console.error) }, 5_000)

  pollTimer = setInterval(() => { pollOnce().catch(console.error) }, POLL_INTERVAL)

  // Task status → label sync loop + 2-agent pipeline driver
  const repoConfigs = REPOS.map(r => ({ owner: r.owner, repo: r.repo, localPath: r.localPath }))
  syncTimer = setInterval(() => {
    syncTaskStatuses().catch(console.error)
    drivePipeline(repoConfigs).catch(console.error)
  }, TASK_SYNC_INTERVAL)
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
  const cards: GitHubIssueCard[] = []

  // Legacy tracked issues
  for (const tracked of trackedIssues) {
    const task = taskMap.get(tracked.taskId)
    cards.push({
      issueNumber: tracked.number, repo: tracked.repo, title: tracked.title,
      taskId: tracked.taskId, taskStatus: task?.status || tracked.stage,
      taskStage: task?.currentStage || tracked.stage, priority: task?.priority || tracked.priority,
      assignedAgent: task?.assignedAgent || null, ingestedAt: tracked.ingestedAt,
      url: `https://github.com/${tracked.repo}/issues/${tracked.number}`,
    })
  }

  // 2-agent pipeline issues (getPipelineIssues imported at top level)
  for (const pi of getPipelineIssues()) {
    cards.push({
      issueNumber: pi.number, repo: pi.repo, title: pi.title,
      taskId: `pipeline-${pi.repo}-${pi.number}`,
      taskStatus: pi.stage === 'done' ? 'completed' : pi.stage === 'failed' ? 'failed' : 'active',
      taskStage: pi.stage, priority: pi.priority,
      assignedAgent: pi.plannerRunning ? 'issue-planner' : pi.executorRunning ? 'executor' : null,
      ingestedAt: pi.ingestedAt, url: `https://github.com/${pi.repo}/issues/${pi.number}`,
    })
  }

  // Orchestrator tasks not already shown
  const seen = new Set(cards.map(c => c.taskId))
  for (const task of queue) {
    if (seen.has(task.id)) continue
    // Try to extract issue number from title like "[sidekick#53]" or "[repo#123]"
    const issueMatch = task.title.match(/\[(?:[^\]]*?)#(\d+)\]/)
    const extractedNumber = issueMatch ? parseInt(issueMatch[1], 10) : 0
    // Build URL if we can extract repo + number from title
    const repoMatch = task.title.match(/\[([^\]#]+)#(\d+)\]/)
    const extractedUrl = repoMatch
      ? `https://github.com/therealsiege/${repoMatch[1]}/issues/${repoMatch[2]}`
      : ''
    cards.push({
      issueNumber: extractedNumber, repo: task.source || 'orchestrator', title: task.title,
      taskId: task.id, taskStatus: task.status, taskStage: task.currentStage || null,
      priority: task.priority, assignedAgent: task.assignedAgent || null,
      ingestedAt: task.createdAt, url: extractedUrl,
    })
  }

  return cards
}

// ── Repo management (persisted) ────────────────────────────────────────────

const REPOS_PATH = path.join(DATA_DIR, 'github-watched-repos.json')

function resolveHome(p: string): string {
  if (p.startsWith('~/') || p === '~') return path.join(os.homedir(), p.slice(2))
  return p
}

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
              localPath: resolveHome(r.localPath || ''),
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
  // Create labels if they don't exist (fire-and-forget)
  ensureLabels(owner, repo).catch(console.error)
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
