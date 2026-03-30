/**
 * 2-Agent GitHub Issue Pipeline
 *
 * Drives GitHub issues through a planner→executor flow:
 *   agent-ready → agent-planning → [agent-question]* → agent-executing → pr-ready | agent-failed
 *
 * The planner agent explores the codebase and designs an implementation plan.
 * The executor agent implements the plan in an isolated worktree, writes tests, and commits.
 * The system pushes the branch and creates the PR.
 */

import { execFile } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'
import os from 'os'

const execFileAsync = promisify(execFile)
import { runAgentHeadless } from './sessions'
import { atomicWrite } from './atomic-store'

// ── Types ────────────────────────────────────────────────────────────────────

export type PipelineStage = 'planning' | 'awaiting-answer' | 'executing' | 'done' | 'failed'

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
  plannerOutput?: string
  questionComment?: string
  questionPostedAt?: number
  executorAttempts: number
  lastError?: string
  // Guards against concurrent runs
  plannerRunning: boolean
  executorRunning: boolean
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

// ── Constants ────────────────────────────────────────────────────────────────

const QUESTION_TIMEOUT_MS = 7 * 24 * 60 * 60 * 1000 // 7 days
const PLANNER_TIMEOUT_MS = 900_000  // 15 min
const EXECUTOR_TIMEOUT_MS = 1_800_000 // 30 min
const MAX_EXECUTOR_ATTEMPTS = 3

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

async function hasLabel(config: RepoConfig, issueNumber: number, label: string): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync('gh', [
      'issue', 'view', String(issueNumber),
      '--repo', `${config.owner}/${config.repo}`,
      '--json', 'labels',
    ], { encoding: 'utf-8', timeout: 15_000 })
    const data = JSON.parse(stdout) as { labels: { name: string }[] }
    return data.labels.some(l => l.name === label)
  } catch {
    return true // assume still present on error
  }
}

async function fetchIssueComments(config: RepoConfig, issueNumber: number, limit = 5): Promise<string> {
  try {
    const { stdout } = await execFileAsync('gh', [
      'issue', 'view', String(issueNumber),
      '--repo', `${config.owner}/${config.repo}`,
      '--json', 'comments',
    ], { encoding: 'utf-8', timeout: 15_000 })
    const data = JSON.parse(stdout) as { comments: { body: string; author: { login: string }; createdAt: string }[] }
    return data.comments
      .slice(-limit)
      .map(c => `**${c.author.login}** (${c.createdAt}):\n${c.body}`)
      .join('\n\n---\n\n')
  } catch {
    return '(could not fetch comments)'
  }
}

// ── Git helpers ──────────────────────────────────────────────────────────────

function expandHome(p: string): string {
  if (p.startsWith('~/') || p === '~') return path.join(os.homedir(), p.slice(2))
  return p
}

async function createIssueWorktree(
  mainRepoPath: string,
  issueNumber: number,
  slug: string,
): Promise<{ branch: string; worktreePath: string } | null> {
  mainRepoPath = expandHome(mainRepoPath)
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
    } catch { /* default to main */ }

    if (fs.existsSync(path.join(worktreePath, '.git'))) {
      await execFileAsync('git', ['worktree', 'remove', worktreePath, '--force'], {
        cwd: mainRepoPath, encoding: 'utf-8', timeout: 30_000,
      })
    }

    // Delete stale branch from previous failed attempts
    await execFileAsync('git', ['branch', '-D', branch], {
      cwd: mainRepoPath, encoding: 'utf-8', timeout: 10_000,
    }).catch(() => { /* branch didn't exist — fine */ })

    await execFileAsync('git', ['worktree', 'add', worktreePath, '-b', branch, `origin/${baseBranch}`], {
      cwd: mainRepoPath, encoding: 'utf-8', timeout: 60_000,
    })
    console.log(`[github-pipeline] Worktree ${worktreePath} branch ${branch}`)
    return { branch, worktreePath }
  } catch (err) {
    console.error(`[github-pipeline] Failed to create worktree:`, err)
    return null
  }
}

async function createIssueBranch(localPath: string, issueNumber: number, slug: string): Promise<string | null> {
  localPath = expandHome(localPath)
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
    } catch { /* */ }

    // Delete stale branch from previous failed attempts
    await execFileAsync('git', ['branch', '-D', branch], {
      cwd: localPath, encoding: 'utf-8', timeout: 10_000,
    }).catch(() => { /* branch didn't exist — fine */ })

    await execFileAsync('git', ['checkout', '-b', branch, `origin/${baseBranch}`], {
      cwd: localPath, encoding: 'utf-8', timeout: 15_000,
    })
    return branch
  } catch (err) {
    console.error(`[github-pipeline] Failed to create branch ${branch}:`, err)
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
  localPath = expandHome(localPath)
  try {
    await execFileAsync('git', ['add', '-A'], { cwd: localPath, encoding: 'utf-8', timeout: 15_000 })
    const { stdout: status } = await execFileAsync('git', ['status', '--porcelain'], {
      cwd: localPath, encoding: 'utf-8', timeout: 10_000,
    })
    if (!status.trim()) return false

    const commitMsg = `${title}\n\nCloses #${issueNumber}\n\nCo-Authored-By: Penny Orchestrator <noreply@penny.dev>`
    await execFileAsync('git', ['commit', '-m', commitMsg], {
      cwd: localPath, encoding: 'utf-8', timeout: 15_000,
    })
    await execFileAsync('git', ['push', '-u', 'origin', branch], {
      cwd: localPath, encoding: 'utf-8', timeout: 60_000,
    })
    const prBody = `Closes #${issueNumber}\n\nAutomated implementation by Penny orchestrator (2-agent pipeline).`
    await execFileAsync('gh', [
      'pr', 'create',
      '--repo', `${config.owner}/${config.repo}`,
      '--head', branch,
      '--title', title,
      '--body', prBody,
    ], { cwd: localPath, encoding: 'utf-8', timeout: 30_000 })
    return true
  } catch (err) {
    console.error(`[github-pipeline] Failed to push/PR for ${branch}:`, err)
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

// ── Prompt builders ──────────────────────────────────────────────────────────

function buildPlannerPrompt(issue: GHIssue, repoKey: string, answerContext?: string): string {
  const parts = [
    `Plan the implementation for ${repoKey}#${issue.number}: ${issue.title}`,
    '',
    issue.body || '(no description)',
    '',
    'Output a numbered plan with exact file paths and changes. Be concise — the executor agent implements from your plan.',
    'If unclear, output QUESTION: followed by your question.',
  ]
  if (answerContext) {
    parts.push('', '## Previous Question Context', '', answerContext)
  }
  return parts.join('\n')
}

function buildExecutorPrompt(issue: PipelineIssue, repoKey: string): string {
  return [
    `You are implementing GitHub issue ${repoKey}#${issue.number}.`,
    `You are on branch \`${issue.branch}\`. Commit all work to this branch.`,
    '',
    '## Implementation Plan',
    '',
    issue.plannerOutput || '(no plan provided)',
    '',
    '## Instructions',
    '',
    '1. Implement the changes described in the plan above.',
    '2. Write tests to validate your work. Use the project\'s existing test framework.',
    '   If Playwright is available, write an e2e test. Otherwise use the project\'s unit test setup.',
    '3. Run the tests and fix any failures.',
    '4. Commit your changes with a descriptive message referencing the issue number.',
    '5. Do NOT push or create PRs — that will be handled automatically.',
    issue.lastError
      ? `\n## Previous Attempt Failed\n\nError from last attempt:\n${issue.lastError}\n\nFix the issues and try again.`
      : '',
  ].join('\n')
}

// ── Agent runners ────────────────────────────────────────────────────────────

async function runPlannerAgent(
  config: RepoConfig,
  tracked: PipelineIssue,
  issue: GHIssue,
  answerContext?: string,
): Promise<'done' | 'question' | 'failed'> {
  const repoKey = `${config.owner}/${config.repo}`
  const prompt = buildPlannerPrompt(issue, repoKey, answerContext)

  console.log(`[github-pipeline] Running planner for ${repoKey}#${tracked.number}`)
  const result = await runAgentHeadless('issue-planner', config.localPath, prompt, {
    timeoutMs: PLANNER_TIMEOUT_MS,
  })

  if (!result.success) {
    const errorDetail = [result.error, result.output?.slice(-300)].filter(Boolean).join('\n\n')
    tracked.lastError = errorDetail || 'Planner exited with error'
    console.error(`[github-pipeline] Planner failed for #${tracked.number}:`, errorDetail)
    return 'failed'
  }

  const output = result.output.trim()
  if (!output) {
    tracked.lastError = 'Planner produced empty output'
    console.error(`[github-pipeline] Planner empty output for #${tracked.number}`)
    return 'failed'
  }

  // Check for question
  const questionMatch = output.match(/^QUESTION:\s*(.+)$/m)
  if (questionMatch) {
    tracked.questionComment = questionMatch[1].trim()
    return 'question'
  }

  // Save plan
  tracked.plannerOutput = output
  try {
    const pennyDir = path.join(config.localPath, '.penny')
    if (!fs.existsSync(pennyDir)) fs.mkdirSync(pennyDir, { recursive: true })
    fs.writeFileSync(path.join(pennyDir, `plan-${tracked.number}.md`), output)
  } catch { /* best effort */ }

  return 'done'
}

async function runExecutorAgent(
  config: RepoConfig,
  tracked: PipelineIssue,
): Promise<'done' | 'failed'> {
  const repoKey = `${config.owner}/${config.repo}`
  const agentCwd = tracked.worktreePath || config.localPath
  const prompt = buildExecutorPrompt(tracked, repoKey)

  console.log(`[github-pipeline] Running executor for ${repoKey}#${tracked.number} (attempt ${tracked.executorAttempts + 1}/${MAX_EXECUTOR_ATTEMPTS})`)
  const result = await runAgentHeadless('electron-dev', agentCwd, prompt, {
    timeoutMs: EXECUTOR_TIMEOUT_MS,
  })

  if (!result.success) {
    const errorDetail = [result.error, result.output?.slice(-500)].filter(Boolean).join('\n\n')
    tracked.lastError = errorDetail || 'Executor exited with error'
    tracked.executorAttempts += 1
    console.error(`[github-pipeline] Executor failed for #${tracked.number} (attempt ${tracked.executorAttempts}):`, errorDetail)
    return 'failed'
  }

  return 'done'
}

// ── Pipeline driver ──────────────────────────────────────────────────────────

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

/** Ingest a new issue into the 2-agent pipeline. Called from github-issues.ts pollOnce(). */
export async function ingestIssue(config: RepoConfig, issue: GHIssue): Promise<PipelineIssue> {
  const repoKey = `${config.owner}/${config.repo}`

  // Check for existing entry
  const existing = state.issues.find(i => i.repo === repoKey && i.number === issue.number)
  if (existing && existing.stage !== 'done' && existing.stage !== 'failed') {
    return existing // already in pipeline
  }

  const entry: PipelineIssue = {
    number: issue.number,
    repo: repoKey,
    title: issue.title,
    body: issue.body || '',
    stage: 'planning',
    priority: 'normal',
    ingestedAt: Date.now(),
    updatedAt: Date.now(),
    executorAttempts: 0,
    plannerRunning: false,
    executorRunning: false,
  }

  // Remove stale entry if re-ingesting
  state.issues = state.issues.filter(i => !(i.repo === repoKey && i.number === issue.number))
  state.issues.push(entry)

  // Swap label (non-blocking, concurrent)
  await Promise.allSettled([
    setLabel(config, issue.number, ['agent-ready'], 'agent-planning'),
    addComment(config, issue.number,
      '🤖 **Picked up by Penny** (2-agent pipeline)\n\nPlanner agent is designing the approach...',
    ),
  ])

  saveState()
  console.log(`[github-pipeline] Ingested ${repoKey}#${issue.number}: "${issue.title}"`)
  return entry
}

/** Drive all active pipeline issues. Called every 15s. */
export async function drivePipeline(repos: RepoConfig[]): Promise<void> {
  for (const tracked of state.issues) {
    if (tracked.stage === 'done' || tracked.stage === 'failed') continue

    const config = repos.find(r => `${r.owner}/${r.repo}` === tracked.repo)
    if (!config) continue

    // ── Planning ──
    if (tracked.stage === 'planning' && !tracked.plannerRunning) {
      tracked.plannerRunning = true
      saveState()

      const ghIssue: GHIssue = {
        number: tracked.number,
        title: tracked.title,
        body: tracked.body,
        labels: [],
      }

      try {
        const answerCtx = tracked.questionComment?.startsWith('**') ? tracked.questionComment : undefined
        const result = await runPlannerAgent(config, tracked, ghIssue, answerCtx)

        if (result === 'done') {
          tracked.stage = 'executing'
          tracked.updatedAt = Date.now()
          await Promise.allSettled([
            setLabel(config, tracked.number, ['agent-planning'], 'agent-executing'),
            addComment(config, tracked.number,
              `📋 **Plan complete** — handing off to executor.\n\n<details><summary>Plan</summary>\n\n${tracked.plannerOutput?.slice(0, 3000) ?? ''}\n\n</details>`,
            ),
          ])

          // Create branch/worktree now
          const slug = tracked.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40).replace(/-$/, '')
          const resolvedPath = expandHome(config.localPath)
          console.log(`[github-pipeline] Creating branch for #${tracked.number} in ${resolvedPath} (raw: ${config.localPath})`)
          const wt = await createIssueWorktree(resolvedPath, tracked.number, slug)
          if (wt) {
            tracked.branch = wt.branch
            tracked.worktreePath = wt.worktreePath
            console.log(`[github-pipeline] Worktree created: ${wt.branch} at ${wt.worktreePath}`)
          } else {
            const branch = await createIssueBranch(resolvedPath, tracked.number, slug)
            tracked.branch = branch ?? undefined
            console.log(`[github-pipeline] Branch created: ${branch ?? 'FAILED'}`)
          }
        } else if (result === 'question') {
          tracked.stage = 'awaiting-answer'
          tracked.questionPostedAt = Date.now()
          tracked.updatedAt = Date.now()
          await Promise.allSettled([
            setLabel(config, tracked.number, ['agent-planning'], 'agent-question'),
            addComment(config, tracked.number,
              `❓ **Agent question:**\n\n${tracked.questionComment}\n\n_Remove the \`agent-question\` label when you've answered to resume planning._`,
            ),
          ])
        } else {
          tracked.stage = 'failed'
          tracked.updatedAt = Date.now()
          const errorBody = tracked.lastError
            ? `\`\`\`\n${tracked.lastError.slice(0, 1000)}\n\`\`\``
            : 'Unknown error'
          await Promise.allSettled([
            setLabel(config, tracked.number, ['agent-planning'], 'agent-failed'),
            addComment(config, tracked.number,
              `❌ **Planning failed**\n\n${errorBody}\n\nTo retry, remove \`agent-failed\` and add \`agent-ready\`.`,
            ),
          ])
        }
      } catch (err) {
        console.error(`[github-pipeline] Planner error for #${tracked.number}:`, err)
      } finally {
        tracked.plannerRunning = false
        saveState()
      }
    }

    // ── Awaiting answer ──
    if (tracked.stage === 'awaiting-answer') {
      if (tracked.questionPostedAt && Date.now() - tracked.questionPostedAt > QUESTION_TIMEOUT_MS) {
        tracked.stage = 'failed'
        tracked.updatedAt = Date.now()
        await Promise.allSettled([
          setLabel(config, tracked.number, ['agent-question'], 'agent-failed'),
          addComment(config, tracked.number, '⏰ **Question timed out** (7 days). To retry, remove `agent-failed` and add `agent-ready`.'),
        ])
        saveState()
        continue
      }

      if (!(await hasLabel(config, tracked.number, 'agent-question'))) {
        tracked.questionComment = await fetchIssueComments(config, tracked.number)
        tracked.stage = 'planning'
        tracked.updatedAt = Date.now()
        await setLabel(config, tracked.number, [], 'agent-planning')
        saveState()
      }
    }

    // ── Executing ──
    if (tracked.stage === 'executing' && !tracked.executorRunning) {
      if (!tracked.branch) {
        tracked.stage = 'failed'
        tracked.updatedAt = Date.now()
        await Promise.allSettled([
          setLabel(config, tracked.number, ['agent-executing'], 'agent-failed'),
          addComment(config, tracked.number, '❌ **Executor failed** — no branch was created.'),
        ])
        saveState()
        continue
      }

      tracked.executorRunning = true
      saveState()

      try {
        const result = await runExecutorAgent(config, tracked)

        if (result === 'done') {
          const gitCwd = tracked.worktreePath ?? config.localPath
          const prCreated = await pushBranchAndCreatePR(
            config, gitCwd, tracked.branch, tracked.number,
            `[${tracked.repo.split('/')[1]}#${tracked.number}] ${tracked.title}`,
          )
          if (tracked.worktreePath) await cleanupWorktree(config.localPath, tracked.worktreePath)

          tracked.stage = 'done'
          tracked.updatedAt = Date.now()
          const doneLabel = prCreated ? 'pr-ready' : 'agent-done'
          await Promise.allSettled([
            setLabel(config, tracked.number, ['agent-executing'], doneLabel),
            addComment(config, tracked.number,
              `✅ **Implementation complete**${prCreated ? '\nA pull request has been created for review.' : ''}`,
            ),
          ])
        } else if (tracked.executorAttempts < MAX_EXECUTOR_ATTEMPTS) {
          console.log(`[github-pipeline] Executor retry for #${tracked.number} (${tracked.executorAttempts}/${MAX_EXECUTOR_ATTEMPTS})`)
        } else {
          if (tracked.worktreePath) await cleanupWorktree(config.localPath, tracked.worktreePath)
          tracked.stage = 'failed'
          tracked.updatedAt = Date.now()
          const execErrorBody = tracked.lastError
            ? `\`\`\`\n${tracked.lastError.slice(0, 1000)}\n\`\`\``
            : ''
          await Promise.allSettled([
            setLabel(config, tracked.number, ['agent-executing'], 'agent-failed'),
            addComment(config, tracked.number,
              `❌ **Executor failed** after ${MAX_EXECUTOR_ATTEMPTS} attempts.\n\n${execErrorBody}\n\nTo retry, remove \`agent-failed\` and add \`agent-ready\`.`,
            ),
          ])
        }
      } catch (err) {
        console.error(`[github-pipeline] Executor error for #${tracked.number}:`, err)
      } finally {
        tracked.executorRunning = false
        saveState()
      }
    }
  }
}

/** Get pipeline issues for dashboard/IPC visibility. */
export function getPipelineIssues(): PipelineIssue[] {
  return state.issues
}

/** Initialize — load persisted state and reset stale running flags. */
export function initPipeline(): void {
  loadState()
  // On startup, no agents are actually running — clear stale flags from previous process
  let reset = 0
  for (const issue of state.issues) {
    if (issue.plannerRunning) { issue.plannerRunning = false; reset++ }
    if (issue.executorRunning) { issue.executorRunning = false; reset++ }
  }
  if (reset > 0) {
    saveState()
    console.log(`[github-pipeline] Reset ${reset} stale running flag(s)`)
  }
  console.log(`[github-pipeline] Loaded ${state.issues.length} pipeline issues`)
}
