/**
 * Linear Issue Poller — watches for `agent-ready` labeled Linear issues,
 * dispatches them to the 3-agent pod pipeline, and tracks progress.
 *
 * Mirrors the github-issues.ts / github-pipeline.ts pattern:
 *   1. Poll Linear GraphQL API every 60s for issues with the trigger label
 *   2. For each new issue: create worktree, spawn pod, post comment, transition state
 *   3. Drive pipeline every 15s: detect pod completion, push branch + create PR,
 *      post comment with PR URL, transition state to "In Review"
 */
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { atomicWrite } from './atomic-store'
import { createPod, getPodStatus } from './pods'
import { getDataDir } from './data-paths'

// ── Constants ───────────────────────────────────────────────────────────────

const LINEAR_API_URL = 'https://api.linear.app/graphql'
const POLL_INTERVAL_MS = 60 * 1000 // 1 minute
const PIPELINE_INTERVAL_MS = 15 * 1000 // drive pipeline every 15s
const MAX_CONCURRENT = 10
const DATA_DIR = getDataDir()

const TEAMS_PATH = path.join(DATA_DIR, 'linear-teams.json')
const SEEN_PATH = path.join(DATA_DIR, 'linear-issues-seen.json')
const PIPELINE_PATH = path.join(DATA_DIR, 'linear-pipeline.json')

// ── Types ───────────────────────────────────────────────────────────────────

export interface LinearTeamConfig {
  /** Linear team UUID — resolved from teamKey on first add */
  teamId: string
  /** Linear team key (e.g. "META", "SCRUB") */
  teamKey: string
  /** Trigger label name. Default: "agent-ready" */
  label: string
  /** Local clone path for git operations */
  localPath: string
  /** Optional runtime profile override (e.g. 'economic', 'sonnet', 'max') */
  runtimeProfile?: string
}

export interface LinearIssueCard {
  source: 'linear'
  issueId: string
  issueNumber: number
  identifier: string
  repo: string
  title: string
  taskId: string
  taskStatus: string
  taskStage: string | null
  priority: string
  assignedAgent: string | null
  podAgents?: { role: 'solver' | 'reviewer' | 'executor'; agentId: string; active: boolean }[]
  ingestedAt: number
  url: string
  podWorkflowId?: string
}

interface LinearPipelineEntry {
  issueId: string
  identifier: string
  issueNumber: number
  teamKey: string
  title: string
  body: string
  priority: string
  url: string
  stage: 'executing' | 'done' | 'failed'
  ingestedAt: number
  updatedAt: number
  podWorkflowId?: string
  branch?: string
  worktreePath?: string
  retryCount?: number
}

interface LinearGraphQLState {
  id: string
  name: string
}

interface LinearGraphQLTeam {
  id: string
  key: string
  name: string
}

interface LinearGraphQLIssue {
  id: string
  identifier: string
  number: number
  title: string
  description: string | null
  priority: number
  url: string
  state: { name: string }
  team: LinearGraphQLTeam
}

// ── Persistence ─────────────────────────────────────────────────────────────

let teams: LinearTeamConfig[] = []
let seenIssueIds: string[] = []
let pipeline: LinearPipelineEntry[] = []

function loadTeams(): void {
  try {
    if (fs.existsSync(TEAMS_PATH)) {
      const raw = JSON.parse(fs.readFileSync(TEAMS_PATH, 'utf-8'))
      if (Array.isArray(raw)) {
        teams = raw.map((t: Partial<LinearTeamConfig>): LinearTeamConfig => ({
          teamId: typeof t.teamId === 'string' ? t.teamId : '',
          teamKey: typeof t.teamKey === 'string' ? t.teamKey : '',
          label: typeof t.label === 'string' ? t.label : 'agent-ready',
          localPath: resolveHome(typeof t.localPath === 'string' ? t.localPath : ''),
          runtimeProfile: typeof t.runtimeProfile === 'string' ? t.runtimeProfile : undefined,
        })).filter(t => t.teamId && t.teamKey && t.localPath)
      }
    }
  } catch (err) {
    console.error('[linear-poller] Failed to load teams:', err)
    teams = []
  }
}

function saveTeams(): void {
  try {
    atomicWrite(TEAMS_PATH, teams)
  } catch (err) {
    console.error('[linear-poller] Failed to save teams:', err)
  }
}

function loadSeen(): void {
  try {
    if (fs.existsSync(SEEN_PATH)) {
      const raw = JSON.parse(fs.readFileSync(SEEN_PATH, 'utf-8'))
      if (Array.isArray(raw)) {
        seenIssueIds = raw.filter((s): s is string => typeof s === 'string')
      }
    }
  } catch {
    seenIssueIds = []
  }
}

function saveSeen(): void {
  try {
    atomicWrite(SEEN_PATH, seenIssueIds)
  } catch (err) {
    console.error('[linear-poller] Failed to save seen issues:', err)
  }
}

function loadPipeline(): void {
  try {
    if (fs.existsSync(PIPELINE_PATH)) {
      const raw = JSON.parse(fs.readFileSync(PIPELINE_PATH, 'utf-8'))
      if (Array.isArray(raw)) {
        pipeline = raw as LinearPipelineEntry[]
      }
    }
  } catch {
    pipeline = []
  }
}

function savePipeline(): void {
  try {
    atomicWrite(PIPELINE_PATH, pipeline)
  } catch (err) {
    console.error('[linear-poller] Failed to save pipeline:', err)
  }
}

function resolveHome(p: string): string {
  if (!p) return p
  if (p.startsWith('~/') || p === '~') return path.join(os.homedir(), p.slice(2))
  return p
}

// Eagerly load on module init so cards are available before poller starts.
loadTeams()
loadSeen()
loadPipeline()

// ── Linear GraphQL helper ───────────────────────────────────────────────────

interface LinearGraphQLResponse<T> {
  data?: T
  errors?: { message: string }[]
}

async function linearQuery<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const apiKey = process.env.LINEAR_API_KEY
  if (!apiKey) {
    throw new Error('LINEAR_API_KEY not set')
  }
  const res = await fetch(LINEAR_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ query, variables: variables ?? {} }),
    signal: AbortSignal.timeout(20_000),
  })
  if (!res.ok) {
    throw new Error(`Linear API ${res.status}: ${res.statusText}`)
  }
  const json = await res.json() as LinearGraphQLResponse<T>
  if (json.errors && json.errors.length > 0) {
    throw new Error(`Linear API error: ${json.errors.map(e => e.message).join('; ')}`)
  }
  if (!json.data) {
    throw new Error('Linear API returned no data')
  }
  return json.data
}

// ── Linear API operations ───────────────────────────────────────────────────

const QUERY_GET_TEAM = `
  query GetTeam($key: String!) {
    teams(filter: { key: { eq: $key } }) {
      nodes { id key name }
    }
  }
`

const QUERY_GET_AGENT_READY_ISSUES = `
  query GetAgentReadyIssues($teamId: String!, $labelName: String!) {
    issues(filter: {
      team: { id: { eq: $teamId } }
      labels: { name: { eq: $labelName } }
      state: { type: { nin: ["completed", "cancelled"] } }
    }) {
      nodes {
        id
        identifier
        number
        title
        description
        priority
        url
        state { name }
        team { id key name }
      }
    }
  }
`

const QUERY_GET_STATE_ID = `
  query GetState($teamId: String!, $stateName: String!) {
    workflowStates(filter: { team: { id: { eq: $teamId } }, name: { eq: $stateName } }) {
      nodes { id }
    }
  }
`

const MUTATION_UPDATE_STATE = `
  mutation UpdateIssueState($issueId: String!, $stateId: String!) {
    issueUpdate(id: $issueId, input: { stateId: $stateId }) {
      success
    }
  }
`

const MUTATION_CREATE_COMMENT = `
  mutation CreateComment($issueId: String!, $body: String!) {
    commentCreate(input: { issueId: $issueId, body: $body }) {
      success
    }
  }
`

async function resolveTeamId(teamKey: string): Promise<LinearGraphQLTeam | null> {
  try {
    const data = await linearQuery<{ teams: { nodes: LinearGraphQLTeam[] } }>(
      QUERY_GET_TEAM,
      { key: teamKey },
    )
    return data.teams.nodes[0] ?? null
  } catch (err) {
    console.error('[linear-poller] resolveTeamId failed:', (err as Error).message)
    return null
  }
}

async function getTeamIssues(teamId: string, label: string): Promise<LinearGraphQLIssue[]> {
  try {
    const data = await linearQuery<{ issues: { nodes: LinearGraphQLIssue[] } }>(
      QUERY_GET_AGENT_READY_ISSUES,
      { teamId, labelName: label },
    )
    return data.issues.nodes
  } catch (err) {
    console.error('[linear-poller] getTeamIssues failed:', (err as Error).message)
    return []
  }
}

async function resolveStateId(teamId: string, stateName: string): Promise<string | null> {
  try {
    const data = await linearQuery<{ workflowStates: { nodes: LinearGraphQLState[] } }>(
      QUERY_GET_STATE_ID,
      { teamId, stateName },
    )
    return data.workflowStates.nodes[0]?.id ?? null
  } catch (err) {
    console.error(`[linear-poller] resolveStateId(${stateName}) failed:`, (err as Error).message)
    return null
  }
}

async function updateIssueState(issueId: string, teamId: string, stateName: string): Promise<boolean> {
  try {
    const stateId = await resolveStateId(teamId, stateName)
    if (!stateId) {
      console.warn(`[linear-poller] No state "${stateName}" found for team ${teamId}`)
      return false
    }
    const data = await linearQuery<{ issueUpdate: { success: boolean } }>(
      MUTATION_UPDATE_STATE,
      { issueId, stateId },
    )
    return data.issueUpdate.success
  } catch (err) {
    console.error(`[linear-poller] updateIssueState(${issueId}, ${stateName}) failed:`, (err as Error).message)
    return false
  }
}

async function postComment(issueId: string, body: string): Promise<boolean> {
  try {
    const data = await linearQuery<{ commentCreate: { success: boolean } }>(
      MUTATION_CREATE_COMMENT,
      { issueId, body },
    )
    return data.commentCreate.success
  } catch (err) {
    console.error(`[linear-poller] postComment(${issueId}) failed:`, (err as Error).message)
    return false
  }
}

// ── Git helpers (execSync, mirror github-pipeline.ts behavior) ─────────────

function isGitRepo(p: string): boolean {
  try {
    return fs.existsSync(path.join(p, '.git'))
  } catch {
    return false
  }
}

function resolveBaseBranch(repoPath: string): string {
  try {
    const out = execSync('git symbolic-ref refs/remotes/origin/HEAD', {
      cwd: repoPath, stdio: 'pipe', encoding: 'utf-8', timeout: 10_000,
    })
    return String(out).trim().replace(/^refs\/remotes\/origin\//, '') || 'main'
  } catch {
    return 'main'
  }
}

interface WorktreeResult {
  branch: string
  worktreePath: string | null
}

/**
 * Try to create an isolated git worktree. Falls back to using `localPath` directly
 * if worktree creation fails.
 */
function createWorktreeOrFallback(localPath: string, identifier: string, slug: string): WorktreeResult {
  const branch = `linear-${identifier.toLowerCase()}-${slug}`
  if (!isGitRepo(localPath)) {
    console.warn(`[linear-poller] ${localPath} is not a git repo — using as-is, no branch will be created`)
    return { branch, worktreePath: null }
  }

  const safeSlug = slug.replace(/[^a-z0-9-]/gi, '-').slice(0, 40).replace(/-$/, '') || 'issue'
  const worktreesRoot = path.join(localPath, '.penny-worktrees')
  const worktreePath = path.join(worktreesRoot, `${identifier.toLowerCase()}-${safeSlug}`)

  try {
    fs.mkdirSync(worktreesRoot, { recursive: true })

    // Best-effort fetch
    try {
      execSync('git fetch origin --prune', {
        cwd: localPath, stdio: 'pipe', encoding: 'utf-8', timeout: 60_000,
      })
    } catch (err) {
      console.warn('[linear-poller] git fetch failed (continuing):', (err as Error).message)
    }

    const baseBranch = resolveBaseBranch(localPath)

    // Clean up any pre-existing worktree at this path
    if (fs.existsSync(worktreePath)) {
      try {
        execSync(`git worktree remove "${worktreePath}" --force`, {
          cwd: localPath, stdio: 'pipe', timeout: 30_000,
        })
      } catch {
        try { fs.rmSync(worktreePath, { recursive: true, force: true }) } catch { /* ignore */ }
      }
    }

    // Prune stale entries and delete branch if it lingered
    try { execSync('git worktree prune', { cwd: localPath, stdio: 'pipe', timeout: 10_000 }) } catch { /* ignore */ }
    try { execSync(`git branch -D ${branch}`, { cwd: localPath, stdio: 'pipe', timeout: 10_000 }) } catch { /* ignore */ }
    try { execSync(`git push origin --delete ${branch}`, { cwd: localPath, stdio: 'pipe', timeout: 15_000 }) } catch { /* ignore */ }

    execSync(`git worktree add --force -b ${branch} "${worktreePath}" origin/${baseBranch}`, {
      cwd: localPath, stdio: 'pipe', timeout: 60_000,
    })

    console.log(`[linear-poller] Worktree ${worktreePath} branch ${branch}`)
    return { branch, worktreePath }
  } catch (err) {
    console.error(`[linear-poller] Worktree creation failed for ${identifier}:`, (err as Error).message)
    return { branch, worktreePath: null }
  }
}

function cleanupWorktree(localPath: string, worktreePath: string | undefined): void {
  if (!worktreePath) return
  try {
    execSync(`git worktree remove "${worktreePath}" --force`, {
      cwd: localPath, stdio: 'pipe', timeout: 30_000,
    })
  } catch (err) {
    console.warn(`[linear-poller] cleanupWorktree failed for ${worktreePath}:`, (err as Error).message)
  }
}

interface PrPushResult {
  ok: boolean
  prUrl?: string
  error?: string
}

function pushBranchAndCreatePR(
  cwd: string,
  branch: string,
  identifier: string,
  title: string,
  url: string,
): PrPushResult {
  try {
    // Stage + commit any uncommitted work
    execSync('git add -A', { cwd, stdio: 'pipe', timeout: 15_000 })
    let status = ''
    try {
      status = String(execSync('git status --porcelain', { cwd, stdio: 'pipe', encoding: 'utf-8', timeout: 10_000 })).trim()
    } catch { /* ignore */ }
    if (status) {
      const commitMsg = `${title}\n\nLinear: ${identifier}\n\nCo-Authored-By: Penny Pod <noreply@penny.dev>`
      try {
        execSync(`git commit -m ${JSON.stringify(commitMsg)}`, { cwd, stdio: 'pipe', timeout: 15_000 })
      } catch (err) {
        console.warn(`[linear-poller] git commit failed:`, (err as Error).message)
      }
    }

    const baseBranch = resolveBaseBranch(cwd)
    let ahead = 0
    try {
      const out = execSync(`git rev-list --count origin/${baseBranch}..HEAD`, {
        cwd, stdio: 'pipe', encoding: 'utf-8', timeout: 10_000,
      })
      ahead = parseInt(String(out).trim(), 10) || 0
    } catch { /* ignore */ }

    if (ahead === 0) {
      return { ok: false, error: 'No commits to push' }
    }

    execSync(`git push -u origin ${branch}`, { cwd, stdio: 'pipe', timeout: 60_000 })

    const prTitle = `[${identifier}] ${title}`
    const prBody = `Closes Linear: ${url}\n\nAutomated implementation by Penny pod (solver + reviewer + executor).`
    const out = execSync(
      `gh pr create --base ${baseBranch} --head ${branch} --title ${JSON.stringify(prTitle)} --body ${JSON.stringify(prBody)}`,
      { cwd, stdio: 'pipe', encoding: 'utf-8', timeout: 30_000 },
    )
    const stdout = String(out).trim()
    const match = stdout.match(/https?:\/\/\S+/)
    return { ok: true, prUrl: match ? match[0] : undefined }
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
}

// ── Pod helpers ─────────────────────────────────────────────────────────────

function getActivePodCount(): number {
  return pipeline.filter(e => e.stage === 'executing').length
}

function buildPrompt(identifier: string, title: string, body: string): string {
  return `[${identifier}] ${title}\n\n${body || '(no description)'}\n\nThis is a Linear issue. Write code to implement this.`
}

// ── Poll loop ───────────────────────────────────────────────────────────────

let pollTimer: ReturnType<typeof setInterval> | null = null
let pipelineTimer: ReturnType<typeof setInterval> | null = null
let isRunning = false
let isPolling = false

async function pollOnce(): Promise<{ enqueued: number }> {
  if (!process.env.LINEAR_API_KEY) {
    return { enqueued: 0 }
  }

  loadTeams()
  loadSeen()
  loadPipeline()

  console.log(`[linear] Poll started (${teams.length} teams)`)

  let enqueued = 0
  for (const team of teams) {
    const issues = await getTeamIssues(team.teamId, team.label)
    if (issues.length === 0) continue

    console.log(`[linear-poller] ${team.teamKey}: ${issues.length} agent-ready issues`)

    for (const issue of issues) {
      // Cap concurrency
      if (getActivePodCount() >= MAX_CONCURRENT) {
        console.log(`[linear-poller] Concurrency cap (${MAX_CONCURRENT}) reached — deferring remaining issues`)
        break
      }

      // Skip if already seen
      if (seenIssueIds.includes(issue.id)) continue

      // Skip if already in active pipeline
      const existing = pipeline.find(p => p.issueId === issue.id)
      if (existing && existing.stage === 'executing') continue

      const slug = issue.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40).replace(/-$/, '') || 'issue'

      console.log(`[linear] Dispatching pod for ${issue.identifier}: "${issue.title}" (team: ${team.teamKey})`)

      const wt = createWorktreeOrFallback(team.localPath, issue.identifier, slug)
      const podCwd = wt.worktreePath ?? team.localPath

      const prompt = buildPrompt(issue.identifier, issue.title, issue.description ?? '')

      let podWorkflowId: string | undefined
      try {
        const wf = createPod(prompt, {
          name: issue.identifier,
          cwd: podCwd,
          issueNumber: issue.number,
          issueRepo: team.teamKey,
          runtimeProfile: team.runtimeProfile,
        })
        podWorkflowId = wf.id
        console.log(`[linear] Pod created ${podWorkflowId} for ${issue.identifier}`)
      } catch (err) {
        console.error(`[linear-poller] createPod failed for ${issue.identifier}:`, (err as Error).message)
        // Cleanup worktree on failure
        cleanupWorktree(team.localPath, wt.worktreePath ?? undefined)
        continue
      }

      const entry: LinearPipelineEntry = {
        issueId: issue.id,
        identifier: issue.identifier,
        issueNumber: issue.number,
        teamKey: team.teamKey,
        title: issue.title,
        body: issue.description ?? '',
        priority: priorityToString(issue.priority),
        url: issue.url,
        stage: 'executing',
        ingestedAt: Date.now(),
        updatedAt: Date.now(),
        podWorkflowId,
        branch: wt.branch,
        worktreePath: wt.worktreePath ?? undefined,
        retryCount: 0,
      }

      // Replace any old entry for the same issue
      pipeline = pipeline.filter(p => p.issueId !== issue.id)
      pipeline.push(entry)

      // Best-effort post comment + state transition
      await postComment(issue.id, '🤖 Agent dispatched. Working on it...').catch(() => false)
      await updateIssueState(issue.id, team.teamId, 'In Progress').catch(() => false)

      // Mark as seen
      if (!seenIssueIds.includes(issue.id)) {
        seenIssueIds.push(issue.id)
      }

      enqueued++
    }
  }

  if (enqueued > 0) {
    saveSeen()
    savePipeline()
  }
  return { enqueued }
}

function priorityToString(priority: number): string {
  // Linear priority: 0 = no priority, 1 = urgent, 2 = high, 3 = medium, 4 = low
  switch (priority) {
    case 1: return 'critical'
    case 2: return 'high'
    case 3: return 'normal'
    case 4: return 'low'
    default: return 'normal'
  }
}

// ── Pipeline driver ─────────────────────────────────────────────────────────

async function drivePipeline(): Promise<void> {
  if (!process.env.LINEAR_API_KEY) return

  let changed = false
  for (const entry of pipeline) {
    if (entry.stage !== 'executing') continue
    if (!entry.podWorkflowId) continue

    const team = teams.find(t => t.teamKey === entry.teamKey)
    if (!team) continue

    const pod = getPodStatus(entry.podWorkflowId)
    if (!pod) continue

    if (pod.status === 'complete') {
      console.log(`[linear] Pod ${entry.podWorkflowId} complete for ${entry.identifier} — pushing PR`)
      const cwd = entry.worktreePath ?? team.localPath
      let prUrl: string | undefined
      let prError: string | undefined
      if (entry.branch && isGitRepo(cwd)) {
        const result = pushBranchAndCreatePR(cwd, entry.branch, entry.identifier, entry.title, entry.url)
        if (result.ok) {
          prUrl = result.prUrl
          if (prUrl) console.log(`[linear] PR created: ${prUrl} for ${entry.identifier}`)
        } else {
          prError = result.error
        }
      }

      // Cleanup worktree
      cleanupWorktree(team.localPath, entry.worktreePath)

      const commentBody = prUrl
        ? `✅ **Implementation complete**\n\nPull request: ${prUrl}`
        : prError
          ? `✅ **Implementation complete**\n\nNo PR was created: ${prError}`
          : `✅ **Implementation complete**\n\nNo PR was created.`
      await postComment(entry.issueId, commentBody).catch(() => false)
      await updateIssueState(entry.issueId, team.teamId, 'In Review').catch(() => false)
      console.log(`[linear] ${entry.identifier} → In Review`)

      entry.stage = 'done'
      entry.updatedAt = Date.now()
      entry.worktreePath = undefined
      changed = true
    } else if (pod.status === 'failed') {
      const errorMsg = pod.error || 'Pod failed without error message'
      console.log(`[linear] Pod ${entry.podWorkflowId} failed for ${entry.identifier}: ${errorMsg}`)
      cleanupWorktree(team.localPath, entry.worktreePath)
      await postComment(
        entry.issueId,
        `❌ **Pod failed**\n\n\`\`\`\n${errorMsg.slice(0, 1000)}\n\`\`\`\n\nTo retry, remove and re-add the \`agent-ready\` label.`,
      ).catch(() => false)

      entry.stage = 'failed'
      entry.updatedAt = Date.now()
      entry.worktreePath = undefined
      changed = true
    }
  }

  if (changed) savePipeline()
}

// ── Lifecycle ───────────────────────────────────────────────────────────────

let activePoll: Promise<{ enqueued: number }> | null = null
let activeDrive: Promise<void> | null = null

async function executePoll(): Promise<{ enqueued: number }> {
  if (activePoll) return activePoll
  isPolling = true
  activePoll = pollOnce()
    .catch(err => {
      console.error('[linear-poller] pollOnce error:', err)
      return { enqueued: 0 }
    })
    .finally(() => {
      isPolling = false
      activePoll = null
    }) as Promise<{ enqueued: number }>
  return activePoll
}

export function startLinearPoller(): void {
  if (isRunning) return
  if (!process.env.LINEAR_API_KEY) {
    console.warn('[linear-poller] LINEAR_API_KEY not set — poller disabled')
    return
  }

  loadTeams()
  loadSeen()
  loadPipeline()

  isRunning = true
  console.log(`[linear-poller] Starting (${POLL_INTERVAL_MS / 1000}s) for ${teams.length} team(s)`)

  // First poll on a short delay so the app has time to initialize
  setTimeout(() => { executePoll().catch(console.error) }, 10_000)

  pollTimer = setInterval(() => { executePoll().catch(console.error) }, POLL_INTERVAL_MS)
  pipelineTimer = setInterval(() => {
    if (activeDrive) return
    activeDrive = drivePipeline().finally(() => { activeDrive = null })
    activeDrive.catch(console.error)
  }, PIPELINE_INTERVAL_MS)
}

export function stopLinearPoller(): void {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
  if (pipelineTimer) { clearInterval(pipelineTimer); pipelineTimer = null }
  isRunning = false
  console.log('[linear-poller] Stopped')
}

export async function pollLinearNow(): Promise<{ enqueued: number }> {
  if (!process.env.LINEAR_API_KEY) {
    return { enqueued: 0 }
  }
  return executePoll()
}

export function getLinearPollerStatus(): { running: boolean; polling: boolean } {
  return { running: isRunning, polling: isPolling }
}

// ── Cards (kanban view) ─────────────────────────────────────────────────────

export async function getLinearIssueCards(): Promise<LinearIssueCard[]> {
  const cards: LinearIssueCard[] = []
  for (const entry of pipeline) {
    let activeAgent: string | null = null
    let podAgents: LinearIssueCard['podAgents']
    let taskStage: string | null = entry.stage

    if (entry.podWorkflowId) {
      const pod = getPodStatus(entry.podWorkflowId)
      if (pod) {
        const isSolving = pod.status === 'solving' || pod.status === 'feedback'
        const isReviewing = pod.status === 'reviewing'
        const isTesting = pod.status === 'executing' || pod.status === 'self-fixing'
        if (isSolving) activeAgent = pod.solver.agentId
        else if (isReviewing) activeAgent = pod.reviewer.agentId
        else if (isTesting) activeAgent = pod.executor.agentId
        else activeAgent = pod.solver.agentId
        podAgents = [
          { role: 'solver', agentId: pod.solver.agentId, active: isSolving },
          { role: 'reviewer', agentId: pod.reviewer.agentId, active: isReviewing },
          { role: 'executor', agentId: pod.executor.agentId, active: isTesting },
        ]
        taskStage = pod.status
      }
    }

    let taskStatus: string
    if (entry.stage === 'done') taskStatus = 'completed'
    else if (entry.stage === 'failed') taskStatus = 'failed'
    else taskStatus = 'active'

    cards.push({
      source: 'linear',
      issueId: entry.issueId,
      issueNumber: entry.issueNumber,
      identifier: entry.identifier,
      repo: entry.teamKey,
      title: entry.title,
      taskId: `linear-${entry.issueId}`,
      taskStatus,
      taskStage,
      priority: entry.priority,
      assignedAgent: activeAgent,
      podAgents,
      ingestedAt: entry.ingestedAt,
      url: entry.url,
      podWorkflowId: entry.podWorkflowId,
    })
  }
  return cards
}

// ── Team management ─────────────────────────────────────────────────────────

export async function addLinearTeam(
  teamKey: string,
  localPath: string,
  label?: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!teamKey || typeof teamKey !== 'string' || !teamKey.trim()) {
    return { ok: false, error: 'teamKey must be a non-empty string' }
  }
  if (!localPath || typeof localPath !== 'string' || !localPath.trim()) {
    return { ok: false, error: 'localPath must be a non-empty string' }
  }

  const cleanKey = teamKey.trim().toUpperCase()
  if (teams.find(t => t.teamKey === cleanKey)) {
    return { ok: false, error: `Team ${cleanKey} already configured` }
  }

  if (!process.env.LINEAR_API_KEY) {
    return { ok: false, error: 'LINEAR_API_KEY not set' }
  }

  const team = await resolveTeamId(cleanKey)
  if (!team) {
    return { ok: false, error: `Team "${cleanKey}" not found in Linear` }
  }

  teams.push({
    teamId: team.id,
    teamKey: team.key,
    label: label && label.trim() ? label.trim() : 'agent-ready',
    localPath: resolveHome(localPath),
  })
  saveTeams()
  console.log(`[linear-poller] Added team ${team.key} (${team.id})`)
  return { ok: true }
}

export async function removeLinearTeam(teamKey: string): Promise<{ ok: boolean }> {
  const cleanKey = (teamKey || '').trim().toUpperCase()
  const before = teams.length
  teams = teams.filter(t => t.teamKey !== cleanKey)
  if (teams.length !== before) {
    saveTeams()
    console.log(`[linear-poller] Removed team ${cleanKey}`)
  }
  return { ok: true }
}

export function getLinearTeams(): LinearTeamConfig[] {
  return teams.map(t => ({ ...t }))
}
