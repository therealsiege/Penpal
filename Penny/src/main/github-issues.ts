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

import { execSync } from 'child_process'
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
}

let trackedIssues: TrackedIssue[] = []

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
    const raw = execSync(
      `gh issue list --repo ${config.owner}/${config.repo} ` +
      `--label "${config.label}" --state open ` +
      `--json number,title,body,labels,assignees,url --limit 20`,
      { encoding: 'utf-8', timeout: 30_000 },
    )
    return JSON.parse(raw)
  } catch (err) {
    console.error(`[github-issues] Failed to fetch issues from ${config.owner}/${config.repo}:`, err)
    return []
  }
}

function swapLabel(config: RepoConfig, issueNumber: number): void {
  try {
    execSync(
      `gh issue edit ${issueNumber} --repo ${config.owner}/${config.repo} ` +
      `--remove-label "${config.label}" --add-label "${config.workingLabel}"`,
      { encoding: 'utf-8', timeout: 15_000 },
    )
    console.log(`[github-issues] Swapped labels on ${config.owner}/${config.repo}#${issueNumber}`)
  } catch (err) {
    console.error(`[github-issues] Failed to swap labels on #${issueNumber}:`, err)
  }
}

function setLabel(config: RepoConfig, issueNumber: number, removeLabels: string[], addLabel: string): void {
  try {
    const removeParts = removeLabels.map(l => `--remove-label "${l}"`).join(' ')
    execSync(
      `gh issue edit ${issueNumber} --repo ${config.owner}/${config.repo} ` +
      `${removeParts} --add-label "${addLabel}"`,
      { encoding: 'utf-8', timeout: 15_000 },
    )
  } catch (err) {
    console.error(`[github-issues] Failed to set label ${addLabel} on #${issueNumber}:`, err)
  }
}

function addComment(config: RepoConfig, issueNumber: number, body: string): void {
  try {
    execSync(
      `gh issue comment ${issueNumber} --repo ${config.owner}/${config.repo} --body ${JSON.stringify(body)}`,
      { encoding: 'utf-8', timeout: 15_000 },
    )
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
      // Already tracked?
      if (trackedIssues.some(t => t.repo === repoKey && t.number === issue.number)) continue

      // Build task description
      const description = [
        `GitHub Issue: ${repoKey}#${issue.number}`,
        `URL: https://github.com/${repoKey}/issues/${issue.number}`,
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
      })
      saveTracked()

      // Swap label: agent-ready → agent-working
      swapLabel(config, issue.number)

      // Comment on the issue
      addComment(config, issue.number,
        `🤖 **Picked up by Penny orchestrator**\n\nTask ID: \`${task.id}\`\nPriority: ${task.priority}\nSkills: ${task.requiredSkills.join(', ')}\n\nA local claude-code session will be spooled up to work on this.`,
      )

      enqueued++
      console.log(`[github-issues] Enqueued #${issue.number}: "${issue.title}" as ${task.id}`)
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
        setLabel(config, tracked.number, ['agent-working'], 'pr-ready')
        addComment(config, tracked.number,
          `✅ **Task completed**\n\nThe agent finished working on this issue.\nTask ID: \`${tracked.taskId}\``,
        )
        tracked.labelSynced = true
      } else if (newStage === 'failed') {
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
  console.log(`[github-issues] Starting poller (${POLL_INTERVAL / 1000}s) for ${REPOS.map(r => `${r.owner}/${r.repo}`).join(', ')}`)

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

/** Add a repo to watch at runtime. */
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
  console.log(`[github-issues] Now watching ${owner}/${repo}`)
}
