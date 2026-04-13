/**
 * 3-Agent GitHub Issue Pipeline (Pod-based)
 *
 * Drives GitHub issues through the full Solver → Reviewer → Executor pod workflow:
 *   agent-ready → agent-executing (pod running) → pr-ready | agent-failed
 *
 * On pickup: creates a worktree, spawns a pod (3 headless agents), and tracks status.
 * On completion: pushes the branch, creates the PR, and labels the issue.
 */

import { execFile } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'
import os from 'os'

const execFileAsync = promisify(execFile)
import { createPod, getPodStatus, type PodWorkflow } from './pods'
import { atomicWrite } from './atomic-store'
import { postPipelineNotification, dmOwner } from './slack-bridge'

// ── Types ────────────────────────────────────────────────────────────────────

export type PipelineStage = 'executing' | 'done' | 'failed'

export interface PipelineIssue {
  number: number
  repo: string       // "owner/repo"
  title: string
  body: string
  stage: PipelineStage
  priority: string
  ingestedAt: number
  updatedAt: number
  branch?: string
  worktreePath?: string
  branchCreationError?: string
  lastError?: string
  runtimeProfile?: string
  podWorkflowId?: string
  /** Last pod status we saw — used to detect transitions for comments. */
  lastPodStatus?: string
}

interface RepoConfig {
  owner: string
  repo: string
  localPath: string
}

interface GHIssue {
  number: number
  title: string
  body: string
  labels: { name: string }[]
}

// ── Label helpers ────────────────────────────────────────────────────────────

async function setLabel(config: RepoConfig, issueNumber: number, removeLabels: string[], addLabel: string): Promise<void> {
  try {
    const args = ['issue', 'edit', String(issueNumber), '--repo', `${config.owner}/${config.repo}`]
    for (const l of removeLabels) args.push('--remove-label', l)
    args.push('--add-label', addLabel)
    await execFileAsync('gh', args, { encoding: 'utf-8', timeout: 15_000 })
  } catch (err) {
    console.error(`[github-pipeline] Failed to set label ${addLabel} on #${issueNumber}:`, err)
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
    console.error(`[github-pipeline] Failed to comment on #${issueNumber}:`, err)
  }
}

// ── Git helpers ──────────────────────────────────────────────────────────────

function expandHome(p: string): string {
  if (p.startsWith('~/') || p === '~') return path.join(os.homedir(), p.slice(2))
  return p
}

function formatGitError(err: unknown): string {
  if (err && typeof err === 'object') {
    const e = err as { message?: string; stderr?: string; stdout?: string }
    return [e.stderr?.trim(), e.stdout?.trim(), e.message?.trim()].filter(Boolean).join('\n') || String(err)
  }
  return String(err)
}

async function remoteTrackingBranchExists(repoPath: string, branch: string): Promise<boolean> {
  try {
    await execFileAsync('git', ['rev-parse', '--verify', `refs/remotes/origin/${branch}`], {
      cwd: repoPath, encoding: 'utf-8', timeout: 5_000,
    })
    return true
  } catch {
    return false
  }
}

async function resolveRemoteDefaultBranch(repoPath: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync('git', ['symbolic-ref', 'refs/remotes/origin/HEAD'], {
      cwd: repoPath, encoding: 'utf-8', timeout: 10_000,
    })
    const name = stdout.trim().replace(/^refs\/remotes\/origin\//, '')
    if (name && await remoteTrackingBranchExists(repoPath, name)) return name
  } catch { /* ignore */ }

  try {
    const { stdout } = await execFileAsync('git', ['ls-remote', '--symref', 'origin', 'HEAD'], {
      cwd: repoPath, encoding: 'utf-8', timeout: 15_000,
    })
    const m = stdout.match(/ref:\s+refs\/heads\/(\S+)/)
    if (m?.[1] && await remoteTrackingBranchExists(repoPath, m[1])) return m[1]
  } catch { /* ignore */ }

  try {
    const { stdout } = await execFileAsync('git', ['remote', 'show', 'origin'], {
      cwd: repoPath, encoding: 'utf-8', timeout: 15_000,
    })
    const m = stdout.match(/HEAD branch:\s*(\S+)/)
    if (m?.[1] && await remoteTrackingBranchExists(repoPath, m[1])) return m[1]
  } catch { /* ignore */ }

  for (const b of ['main', 'master', 'dev', 'develop']) {
    if (await remoteTrackingBranchExists(repoPath, b)) return b
  }
  return 'main'
}

async function fetchOriginOrFail(repoPath: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await execFileAsync('git', ['fetch', 'origin', '--prune'], {
      cwd: repoPath, encoding: 'utf-8', timeout: 120_000,
    })
    return { ok: true }
  } catch (err) {
    return { ok: false, error: formatGitError(err) }
  }
}

async function ensureOriginRemoteRef(
  repoPath: string,
  baseBranch: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ref = `refs/remotes/origin/${baseBranch}`
  try {
    await execFileAsync('git', ['rev-parse', '--verify', ref], {
      cwd: repoPath, encoding: 'utf-8', timeout: 5_000,
    })
    return { ok: true }
  } catch {
    try {
      await execFileAsync('git', ['fetch', 'origin', baseBranch], {
        cwd: repoPath, encoding: 'utf-8', timeout: 120_000,
      })
      await execFileAsync('git', ['rev-parse', '--verify', ref], {
        cwd: repoPath, encoding: 'utf-8', timeout: 5_000,
      })
      return { ok: true }
    } catch (err) {
      return { ok: false, error: formatGitError(err) }
    }
  }
}

type IssueWorktreeOk = { ok: true; branch: string; worktreePath: string }
type IssueWorktreeFail = { ok: false; error: string }

async function createIssueWorktree(
  mainRepoPath: string,
  issueNumber: number,
  slug: string,
): Promise<IssueWorktreeOk | IssueWorktreeFail> {
  mainRepoPath = expandHome(mainRepoPath)
  const branch = `issue-${issueNumber}-${slug}`
  const safeSlug = slug.replace(/[^a-z0-9-]/gi, '-').slice(0, 40).replace(/-$/, '') || 'issue'
  const worktreesRoot = path.join(mainRepoPath, '.penny-worktrees')
  const worktreePath = path.join(worktreesRoot, `${issueNumber}-${safeSlug}`)

  try {
    if (!fs.existsSync(path.join(mainRepoPath, '.git'))) {
      return {
        ok: false,
        error: `Not a git repository (missing .git): ${mainRepoPath}. Fix REPOS localPath in github-issues config.`,
      }
    }
    fs.mkdirSync(worktreesRoot, { recursive: true })
    const fetchOk = await fetchOriginOrFail(mainRepoPath)
    if (!fetchOk.ok) {
      return {
        ok: false,
        error:
          `git fetch origin failed:\n${fetchOk.error}\n\n` +
          `Tip: ensure this clone can reach the remote (VPN, SSH key, or HTTPS credentials). ` +
          `Run \`git fetch origin\` in ${mainRepoPath} from a terminal to verify.`,
      }
    }

    const baseBranch = await resolveRemoteDefaultBranch(mainRepoPath)
    console.log(`[github-pipeline] Resolved default base branch: ${baseBranch} (repo: ${mainRepoPath})`)

    const refOk = await ensureOriginRemoteRef(mainRepoPath, baseBranch)
    if (!refOk.ok) {
      return {
        ok: false,
        error:
          `Missing remote ref origin/${baseBranch}:\n${refOk.error}\n\n` +
          `Tip: confirm the default branch name and that you can fetch it (\`git ls-remote origin\`).`,
      }
    }

    if (fs.existsSync(worktreePath)) {
      if (fs.existsSync(path.join(worktreePath, '.git'))) {
        await execFileAsync('git', ['worktree', 'remove', worktreePath, '--force'], {
          cwd: mainRepoPath, encoding: 'utf-8', timeout: 30_000,
        }).catch(() => {})
      } else {
        fs.rmSync(worktreePath, { recursive: true, force: true })
      }
    }

    await execFileAsync('git', ['branch', '-D', branch], {
      cwd: mainRepoPath, encoding: 'utf-8', timeout: 10_000,
    }).catch(() => { /* branch didn't exist — fine */ })

    await execFileAsync('git', ['worktree', 'add', '--force', '-b', branch, worktreePath, `origin/${baseBranch}`], {
      cwd: mainRepoPath, encoding: 'utf-8', timeout: 60_000,
    })
    console.log(`[github-pipeline] Worktree ${worktreePath} branch ${branch}`)
    return { ok: true, branch, worktreePath }
  } catch (err) {
    const msg = formatGitError(err)
    console.error(`[github-pipeline] Failed to create worktree at ${worktreePath}:`, msg)
    return { ok: false, error: msg }
  }
}

type IssueBranchOk = { ok: true; branch: string }
type IssueBranchFail = { ok: false; error: string }

async function createIssueBranch(localPath: string, issueNumber: number, slug: string): Promise<IssueBranchOk | IssueBranchFail> {
  localPath = expandHome(localPath)
  const branch = `issue-${issueNumber}-${slug}`
  try {
    if (!fs.existsSync(path.join(localPath, '.git'))) {
      return {
        ok: false,
        error: `Not a git repository (missing .git): ${localPath}. Fix REPOS localPath in github-issues config.`,
      }
    }
    const fetchOk = await fetchOriginOrFail(localPath)
    if (!fetchOk.ok) {
      return {
        ok: false,
        error:
          `git fetch origin failed:\n${fetchOk.error}\n\n` +
          `Tip: ensure this clone can reach the remote (VPN, SSH key, or HTTPS credentials). ` +
          `Run \`git fetch origin\` in ${localPath} from a terminal to verify.`,
      }
    }

    const baseBranch = await resolveRemoteDefaultBranch(localPath)
    console.log(`[github-pipeline] Resolved default base branch: ${baseBranch} (repo: ${localPath})`)

    const refOk = await ensureOriginRemoteRef(localPath, baseBranch)
    if (!refOk.ok) {
      return {
        ok: false,
        error:
          `Missing remote ref origin/${baseBranch}:\n${refOk.error}\n\n` +
          `Tip: confirm the default branch name and that you can fetch it (\`git ls-remote origin\`).`,
      }
    }

    await execFileAsync('git', ['branch', '-D', branch], {
      cwd: localPath, encoding: 'utf-8', timeout: 10_000,
    }).catch(() => { /* branch didn't exist — fine */ })

    await execFileAsync('git', ['checkout', '-B', branch, `origin/${baseBranch}`], {
      cwd: localPath, encoding: 'utf-8', timeout: 15_000,
    })
    return { ok: true, branch }
  } catch (err) {
    const msg = formatGitError(err)
    console.error(`[github-pipeline] Failed to create branch ${branch} in ${localPath}:`, msg)
    return { ok: false, error: msg }
  }
}

async function pushBranchAndCreatePR(
  config: RepoConfig,
  localPath: string,
  branch: string,
  issueNumber: number,
  title: string,
): Promise<boolean> {
  localPath = expandHome(localPath)
  console.log(`[github-pipeline] pushBranchAndCreatePR: cwd=${localPath}, branch=${branch}`)
  try {
    // Stage any uncommitted changes left by solver/executor
    await execFileAsync('git', ['add', '-A'], { cwd: localPath, encoding: 'utf-8', timeout: 15_000 })
    const { stdout: status } = await execFileAsync('git', ['status', '--porcelain'], {
      cwd: localPath, encoding: 'utf-8', timeout: 10_000,
    })
    if (status.trim()) {
      console.log(`[github-pipeline] Found uncommitted changes:\n${status.trim()}`)
      const commitMsg = `${title}\n\nCloses #${issueNumber}\n\nCo-Authored-By: Penny Pod <noreply@penny.dev>`
      await execFileAsync('git', ['commit', '-m', commitMsg], {
        cwd: localPath, encoding: 'utf-8', timeout: 15_000,
      })
    } else {
      console.log(`[github-pipeline] No uncommitted changes in ${localPath}`)
    }

    const baseBranch = await resolveRemoteDefaultBranch(localPath)
    const { stdout: revList } = await execFileAsync('git', ['rev-list', '--count', `origin/${baseBranch}..HEAD`], {
      cwd: localPath, encoding: 'utf-8', timeout: 10_000,
    })
    const ahead = parseInt(revList.trim(), 10)
    console.log(`[github-pipeline] ${branch} is ${ahead} commits ahead of origin/${baseBranch}`)
    if (ahead === 0) {
      console.log(`[github-pipeline] Nothing to push for ${branch}`)
      return false
    }

    await execFileAsync('git', ['push', '-u', 'origin', branch], {
      cwd: localPath, encoding: 'utf-8', timeout: 60_000,
    })
    console.log(`[github-pipeline] Pushed ${branch} to origin`)
    const prBody = `Closes #${issueNumber}\n\nAutomated implementation by Penny pod (solver + reviewer + executor).`
    await execFileAsync('gh', [
      'pr', 'create',
      '--repo', `${config.owner}/${config.repo}`,
      '--head', branch,
      '--base', baseBranch,
      '--title', title,
      '--body', prBody,
    ], { cwd: localPath, encoding: 'utf-8', timeout: 30_000 })
    console.log(`[github-pipeline] PR created for ${branch}`)
    return true
  } catch (err) {
    console.error(`[github-pipeline] Failed to push/PR for ${branch}:`, formatGitError(err))
    return false
  }
}

async function cleanupWorktree(mainRepoPath: string, worktreePath: string): Promise<void> {
  mainRepoPath = expandHome(mainRepoPath)
  try {
    await execFileAsync('git', ['worktree', 'remove', worktreePath, '--force'], {
      cwd: mainRepoPath, encoding: 'utf-8', timeout: 30_000,
    })
  } catch { /* best effort */ }
}

// ── Preset derivation from labels ──────────────────────────────────────────

function derivePresetFromLabels(labels: { name: string }[]): string {
  const names = labels.map(l => l.name.toLowerCase())
  if (names.includes('frontend') || names.includes('ui')) return 'frontend-feature'
  if (names.includes('backend') || names.includes('api')) return 'backend-feature'
  return 'full-stack'
}

function deriveRuntimeProfile(labels: { name: string }[]): string | undefined {
  const names = labels.map(l => l.name.toLowerCase())
  if (names.includes('economic')) return 'economic'
  if (names.includes('max')) return 'max'
  if (names.includes('sonnet')) return 'sonnet'
  return undefined
}

// ── Pipeline state ──────────────────────────────────────────────────────────

export interface PipelineState {
  issues: PipelineIssue[]
}

const DATA_DIR = path.resolve(__dirname, '..', '..', 'data')
const STATE_PATH = path.join(DATA_DIR, 'github-pipeline.json')

let state: PipelineState = { issues: [] }

function loadState(): void {
  try {
    if (fs.existsSync(STATE_PATH)) {
      state = JSON.parse(fs.readFileSync(STATE_PATH, 'utf-8'))
    }
  } catch { state = { issues: [] } }
}

function saveState(): void {
  try {
    atomicWrite(STATE_PATH, state)
  } catch (err) {
    console.error('[github-pipeline] Failed to save state:', err)
  }
}

// ── Ingest ──────────────────────────────────────────────────────────────────

/** Build the task prompt for the pod solver from the GitHub issue. */
function buildPodTask(repoKey: string, issue: GHIssue, branch?: string): string {
  const lines = [
    `Implement GitHub issue ${repoKey}#${issue.number}: ${issue.title}`,
    '',
    issue.body || '(no description)',
  ]
  if (branch) {
    lines.push('', `You are on branch \`${branch}\`. Commit all work to this branch.`)
  }
  lines.push(
    '',
    'Commit your changes with a descriptive message referencing the issue number.',
    'Do NOT push or create PRs — that will be handled automatically.',
  )
  return lines.join('\n')
}

/** Ingest a new issue into the 3-agent pod pipeline. Called from github-issues.ts pollOnce(). */
export async function ingestIssue(config: RepoConfig, issue: GHIssue): Promise<PipelineIssue> {
  const repoKey = `${config.owner}/${config.repo}`

  // Check for existing entry
  const existing = state.issues.find(i => i.repo === repoKey && i.number === issue.number)
  if (existing && existing.stage !== 'done' && existing.stage !== 'failed') {
    return existing
  }

  const runtimeProfile = deriveRuntimeProfile(issue.labels)
  const presetId = derivePresetFromLabels(issue.labels)

  const entry: PipelineIssue = {
    number: issue.number,
    repo: repoKey,
    title: issue.title,
    body: issue.body || '',
    stage: 'executing',
    priority: 'normal',
    runtimeProfile,
    ingestedAt: Date.now(),
    updatedAt: Date.now(),
  }

  // Remove stale entry if re-ingesting
  state.issues = state.issues.filter(i => !(i.repo === repoKey && i.number === issue.number))
  state.issues.push(entry)

  // Create worktree/branch first
  const slug = issue.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40).replace(/-$/, '')
  const resolvedPath = expandHome(config.localPath)
  console.log(`[github-pipeline] Creating worktree for #${issue.number} in ${resolvedPath}`)

  const wt = await createIssueWorktree(resolvedPath, issue.number, slug)
  if (wt.ok) {
    entry.branch = wt.branch
    entry.worktreePath = wt.worktreePath
    console.log(`[github-pipeline] Worktree created: ${wt.branch} at ${wt.worktreePath}`)
  } else {
    const br = await createIssueBranch(resolvedPath, issue.number, slug)
    if (br.ok) {
      entry.branch = br.branch
      console.log(`[github-pipeline] Branch created: ${br.branch}`)
    } else {
      entry.branchCreationError = `Worktree failed:\n${wt.error}\n\nFallback branch failed:\n${br.error}`
      console.error(`[github-pipeline] Branch creation failed for #${issue.number}:`, entry.branchCreationError)
    }
  }

  // If no branch, fail immediately
  if (!entry.branch) {
    entry.stage = 'failed'
    entry.lastError = 'Branch creation failed'
    saveState()
    const gitDetail = entry.branchCreationError
      ? `\n\n<details><summary>Git error</summary>\n\n\`\`\`\n${entry.branchCreationError.slice(0, 3500)}\n\`\`\`\n\n</details>`
      : ''
    await Promise.allSettled([
      setLabel(config, issue.number, ['agent-ready'], 'agent-failed'),
      addComment(config, issue.number, `No branch was created — cannot proceed.${gitDetail}\n\nTo retry, remove \`agent-failed\` and add \`agent-ready\`.`),
    ])
    return entry
  }

  // Create the 3-agent pod
  const podCwd = entry.worktreePath || resolvedPath
  const task = buildPodTask(repoKey, issue, entry.branch)
  try {
    const wf = createPod(task, {
      name: `${repoKey}#${issue.number}`,
      cwd: podCwd,
      presetId,
      runtimeProfile,
      priority: entry.priority,
      issueNumber: issue.number,
      issueRepo: repoKey,
    })
    entry.podWorkflowId = wf.id
    entry.lastPodStatus = wf.status
    console.log(`[github-pipeline] Pod ${wf.id} created for #${issue.number} (preset=${presetId}, solver=${wf.solver.agentId}, reviewer=${wf.reviewer.agentId}, executor=${wf.executor.agentId})`)
  } catch (err) {
    entry.stage = 'failed'
    entry.lastError = `Pod creation failed: ${(err as Error).message}`
    saveState()
    await Promise.allSettled([
      setLabel(config, issue.number, ['agent-ready'], 'agent-failed'),
      addComment(config, issue.number, `Pod creation failed: ${(err as Error).message}\n\nTo retry, remove \`agent-failed\` and add \`agent-ready\`.`),
    ])
    return entry
  }

  // Update labels and comment
  await Promise.allSettled([
    setLabel(config, issue.number, ['agent-ready'], 'agent-executing'),
    addComment(config, issue.number,
      `**Picked up by Penny** (3-agent pod: solver + reviewer + executor)${runtimeProfile ? `\nRuntime: **${runtimeProfile}**` : ''}\nPreset: **${presetId}**\nPod: \`${entry.podWorkflowId}\``,
    ),
  ])

  saveState()
  console.log(`[github-pipeline] Ingested ${repoKey}#${issue.number}: "${issue.title}"`)
  return entry
}

// ── Pipeline driver ─────────────────────────────────────────────────────────

/** Map pod status to a human-readable stage name for comments. */
function podStageLabel(status: string): string {
  switch (status) {
    case 'solving': return 'Solver implementing'
    case 'reviewing': return 'Reviewer evaluating'
    case 'executing': return 'Executor testing'
    case 'self-fixing': return 'Executor self-fixing'
    case 'feedback': return 'Feedback loop (solver re-iterating)'
    default: return status
  }
}

/** Drive all active pipeline issues. Called every 15s. */
export async function drivePipeline(repos: RepoConfig[]): Promise<void> {
  for (const tracked of state.issues) {
    if (tracked.stage === 'done' || tracked.stage === 'failed') continue
    if (!tracked.podWorkflowId) continue

    const config = repos.find(r => `${r.owner}/${r.repo}` === tracked.repo)
    if (!config) continue

    const pod = getPodStatus(tracked.podWorkflowId)
    if (!pod) continue

    // Post a comment when the pod transitions between major stages
    if (tracked.lastPodStatus !== pod.status) {
      const prev = tracked.lastPodStatus
      tracked.lastPodStatus = pod.status
      tracked.updatedAt = Date.now()

      if (pod.status !== 'complete' && pod.status !== 'failed' && pod.status !== 'pending') {
        // Only comment on major transitions to avoid noise
        if (prev !== pod.status) {
          await addComment(config, tracked.number,
            `**${podStageLabel(pod.status)}** (iteration ${pod.iteration}/${pod.maxIterations})`,
          )
        }
      }
    }

    // ── Pod complete: push + PR ──
    if (pod.status === 'complete') {
      const gitCwd = tracked.worktreePath ?? expandHome(config.localPath)
      const prCreated = await pushBranchAndCreatePR(
        config, gitCwd, tracked.branch!, tracked.number,
        `[${tracked.repo.split('/')[1]}#${tracked.number}] ${tracked.title}`,
      )
      if (tracked.worktreePath) await cleanupWorktree(config.localPath, tracked.worktreePath)

      tracked.stage = 'done'
      tracked.updatedAt = Date.now()
      const doneLabel = prCreated ? 'pr-ready' : 'agent-done'
      await Promise.allSettled([
        setLabel(config, tracked.number, ['agent-executing'], doneLabel),
        addComment(config, tracked.number,
          `**Implementation complete** (${pod.iteration} iteration${pod.iteration > 1 ? 's' : ''})${prCreated ? '\nA pull request has been created for review.' : ''}`,
        ),
        postPipelineNotification(
          `:white_check_mark: *${tracked.repo}#${tracked.number}* done (pod ${pod.id})${prCreated ? ' — PR created' : ''}\n<https://github.com/${tracked.repo}/issues/${tracked.number}|View issue>`,
          ':white_check_mark:',
        ),
      ])
      saveState()
    }

    // ── Pod failed ──
    if (pod.status === 'failed') {
      if (tracked.worktreePath) await cleanupWorktree(config.localPath, tracked.worktreePath)

      tracked.stage = 'failed'
      tracked.lastError = pod.error || 'Pod failed without error message'
      tracked.updatedAt = Date.now()
      const errorBody = pod.error
        ? `\`\`\`\n${pod.error.slice(0, 1000)}\n\`\`\``
        : ''
      await Promise.allSettled([
        setLabel(config, tracked.number, ['agent-executing'], 'agent-failed'),
        addComment(config, tracked.number,
          `**Pod failed** (${pod.iteration}/${pod.maxIterations} iterations)\n\n${errorBody}\n\nTo retry, remove \`agent-failed\` and add \`agent-ready\`.`,
        ),
        postPipelineNotification(
          `:x: *${tracked.repo}#${tracked.number}* pod failed\n<https://github.com/${tracked.repo}/issues/${tracked.number}|View issue>`,
          ':x:',
        ),
        dmOwner(
          `:x: *${tracked.repo}#${tracked.number}* pod failed: ${(pod.error || '').slice(0, 200)}\n<https://github.com/${tracked.repo}/issues/${tracked.number}|View issue>`,
          ':x:',
        ),
      ])
      saveState()
    }
  }
}

/** Get pipeline issues for dashboard/IPC visibility. */
export function getPipelineIssues(): PipelineIssue[] {
  return state.issues
}

/** Initialize — load persisted state and migrate old 2-agent entries. */
export function initPipeline(): void {
  loadState()

  // Migrate stale entries from the old 2-agent pipeline.
  // Old stages 'planning' and 'awaiting-answer' no longer exist — clear them so the
  // issues can be re-picked-up via `agent-ready` label on next poll cycle.
  let migrated = 0
  state.issues = state.issues.filter(issue => {
    const stage = issue.stage as string
    if (stage === 'planning' || stage === 'awaiting-answer') {
      console.log(`[github-pipeline] Dropping stale ${stage} entry for ${issue.repo}#${issue.number}`)
      migrated++
      return false
    }
    return true
  })
  if (migrated > 0) {
    saveState()
    console.log(`[github-pipeline] Migrated ${migrated} stale entries (removed)`)
  }

  console.log(`[github-pipeline] Loaded ${state.issues.length} pipeline issues`)
}
