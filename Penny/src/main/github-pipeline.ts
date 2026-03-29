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

import { execFileSync } from 'child_process'
import fs from 'fs'
import path from 'path'
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
const PLANNER_TIMEOUT_MS = 600_000  // 10 min
const EXECUTOR_TIMEOUT_MS = 1_800_000 // 30 min
const MAX_EXECUTOR_ATTEMPTS = 3

// ── Label helpers ────────────────────────────────────────────────────────────

function setLabel(config: RepoConfig, issueNumber: number, removeLabels: string[], addLabel: string): void {
  try {
    const args = ['issue', 'edit', String(issueNumber), '--repo', `${config.owner}/${config.repo}`]
    for (const l of removeLabels) args.push('--remove-label', l)
    args.push('--add-label', addLabel)
    execFileSync('gh', args, { encoding: 'utf-8', timeout: 15_000 })
  } catch (err) {
    console.error(`[github-pipeline] Failed to set label ${addLabel} on #${issueNumber}:`, err)
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
    console.error(`[github-pipeline] Failed to comment on #${issueNumber}:`, err)
  }
}

function hasLabel(config: RepoConfig, issueNumber: number, label: string): boolean {
  try {
    const raw = execFileSync('gh', [
      'issue', 'view', String(issueNumber),
      '--repo', `${config.owner}/${config.repo}`,
      '--json', 'labels',
    ], { encoding: 'utf-8', timeout: 15_000 })
    const data = JSON.parse(raw) as { labels: { name: string }[] }
    return data.labels.some(l => l.name === label)
  } catch {
    return true // assume still present on error
  }
}

function fetchIssueComments(config: RepoConfig, issueNumber: number, limit = 5): string {
  try {
    const raw = execFileSync('gh', [
      'issue', 'view', String(issueNumber),
      '--repo', `${config.owner}/${config.repo}`,
      '--json', 'comments',
    ], { encoding: 'utf-8', timeout: 15_000 })
    const data = JSON.parse(raw) as { comments: { body: string; author: { login: string }; createdAt: string }[] }
    return data.comments
      .slice(-limit)
      .map(c => `**${c.author.login}** (${c.createdAt}):\n${c.body}`)
      .join('\n\n---\n\n')
  } catch {
    return '(could not fetch comments)'
  }
}

// ── Git helpers ──────────────────────────────────────────────────────────────

function createIssueWorktree(
  mainRepoPath: string,
  issueNumber: number,
  slug: string,
): { branch: string; worktreePath: string } | null {
  const branch = `issue-${issueNumber}-${slug}`
  const safeSlug = slug.replace(/[^a-z0-9-]/gi, '-').slice(0, 40).replace(/-$/, '') || 'issue'
  const worktreesRoot = path.join(mainRepoPath, '.penny-worktrees')
  const worktreePath = path.join(worktreesRoot, `${issueNumber}-${safeSlug}`)

  try {
    fs.mkdirSync(worktreesRoot, { recursive: true })
    execFileSync('git', ['fetch', 'origin', 'main'], {
      cwd: mainRepoPath, encoding: 'utf-8', timeout: 30_000, stdio: 'pipe',
    })
    let baseBranch = 'main'
    try {
      baseBranch = execFileSync('git', ['symbolic-ref', 'refs/remotes/origin/HEAD'], {
        cwd: mainRepoPath, encoding: 'utf-8', timeout: 10_000, stdio: 'pipe',
      }).trim().replace('refs/remotes/origin/', '')
    } catch { /* default to main */ }

    if (fs.existsSync(path.join(worktreePath, '.git'))) {
      execFileSync('git', ['worktree', 'remove', worktreePath, '--force'], {
        cwd: mainRepoPath, encoding: 'utf-8', timeout: 30_000, stdio: 'pipe',
      })
    }

    execFileSync('git', ['worktree', 'add', worktreePath, '-b', branch, `origin/${baseBranch}`], {
      cwd: mainRepoPath, encoding: 'utf-8', timeout: 60_000, stdio: 'pipe',
    })
    console.log(`[github-pipeline] Worktree ${worktreePath} branch ${branch}`)
    return { branch, worktreePath }
  } catch (err) {
    console.error(`[github-pipeline] Failed to create worktree:`, err)
    return null
  }
}

function createIssueBranch(localPath: string, issueNumber: number, slug: string): string | null {
  const branch = `issue-${issueNumber}-${slug}`
  try {
    execFileSync('git', ['fetch', 'origin', 'main'], {
      cwd: localPath, encoding: 'utf-8', timeout: 30_000, stdio: 'pipe',
    })
    let baseBranch = 'main'
    try {
      baseBranch = execFileSync('git', ['symbolic-ref', 'refs/remotes/origin/HEAD'], {
        cwd: localPath, encoding: 'utf-8', timeout: 10_000, stdio: 'pipe',
      }).trim().replace('refs/remotes/origin/', '')
    } catch { /* */ }

    execFileSync('git', ['checkout', '-b', branch, `origin/${baseBranch}`], {
      cwd: localPath, encoding: 'utf-8', timeout: 15_000, stdio: 'pipe',
    })
    return branch
  } catch (err) {
    console.error(`[github-pipeline] Failed to create branch ${branch}:`, err)
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
    execFileSync('git', ['add', '-A'], { cwd: localPath, encoding: 'utf-8', timeout: 15_000, stdio: 'pipe' })
    const status = execFileSync('git', ['status', '--porcelain'], {
      cwd: localPath, encoding: 'utf-8', timeout: 10_000, stdio: 'pipe',
    }).trim()
    if (!status) return false

    const commitMsg = `${title}\n\nCloses #${issueNumber}\n\nCo-Authored-By: Penny Orchestrator <noreply@penny.dev>`
    execFileSync('git', ['commit', '-m', commitMsg], {
      cwd: localPath, encoding: 'utf-8', timeout: 15_000, stdio: 'pipe',
    })
    execFileSync('git', ['push', '-u', 'origin', branch], {
      cwd: localPath, encoding: 'utf-8', timeout: 60_000, stdio: 'pipe',
    })
    const prBody = `Closes #${issueNumber}\n\nAutomated implementation by Penny orchestrator (2-agent pipeline).`
    execFileSync('gh', [
      'pr', 'create',
      '--repo', `${config.owner}/${config.repo}`,
      '--head', branch,
      '--title', title,
      '--body', prBody,
    ], { cwd: localPath, encoding: 'utf-8', timeout: 30_000, stdio: 'pipe' })
    return true
  } catch (err) {
    console.error(`[github-pipeline] Failed to push/PR for ${branch}:`, err)
    return false
  }
}

function cleanupWorktree(mainRepoPath: string, worktreePath: string): void {
  try {
    execFileSync('git', ['worktree', 'remove', worktreePath, '--force'], {
      cwd: mainRepoPath, encoding: 'utf-8', timeout: 30_000, stdio: 'pipe',
    })
  } catch { /* best effort */ }
}

// ── Prompt builders ──────────────────────────────────────────────────────────

function buildPlannerPrompt(issue: GHIssue, repoKey: string, answerContext?: string): string {
  const parts = [
    `You are planning the implementation for GitHub issue ${repoKey}#${issue.number}.`,
    '',
    `## Issue: ${issue.title}`,
    '',
    issue.body || '(no description)',
    '',
    '## Instructions',
    '',
    'Explore the codebase thoroughly, then produce a detailed, numbered implementation plan.',
    'Include specific file paths, function names, and the exact changes needed.',
    'The plan will be handed to a separate executor agent — be explicit enough that they can implement without guessing.',
    '',
    'If the issue is unclear or you need more information, output a single line starting with QUESTION: followed by your question.',
    'Otherwise, output your implementation plan.',
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
    permissionMode: 'plan',
    timeoutMs: PLANNER_TIMEOUT_MS,
  })

  if (!result.success) {
    tracked.lastError = result.error || 'Planner exited with error'
    return 'failed'
  }

  const output = result.output.trim()
  if (!output) {
    tracked.lastError = 'Planner produced empty output'
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
    tracked.lastError = result.error || result.output.slice(-500) || 'Executor exited with error'
    tracked.executorAttempts += 1
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
export function ingestIssue(config: RepoConfig, issue: GHIssue): PipelineIssue {
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

  // Swap label immediately
  setLabel(config, issue.number, ['agent-ready'], 'agent-planning')
  addComment(config, issue.number,
    '🤖 **Picked up by Penny** (2-agent pipeline)\n\nPlanner agent is designing the approach...',
  )

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
          setLabel(config, tracked.number, ['agent-planning'], 'agent-executing')
          addComment(config, tracked.number,
            `📋 **Plan complete** — handing off to executor.\n\n<details><summary>Plan</summary>\n\n${tracked.plannerOutput?.slice(0, 3000) ?? ''}\n\n</details>`,
          )

          // Create branch/worktree now
          const slug = tracked.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40).replace(/-$/, '')
          const wt = createIssueWorktree(config.localPath, tracked.number, slug)
          if (wt) {
            tracked.branch = wt.branch
            tracked.worktreePath = wt.worktreePath
          } else {
            tracked.branch = createIssueBranch(config.localPath, tracked.number, slug) ?? undefined
          }
        } else if (result === 'question') {
          tracked.stage = 'awaiting-answer'
          tracked.questionPostedAt = Date.now()
          tracked.updatedAt = Date.now()
          setLabel(config, tracked.number, ['agent-planning'], 'agent-question')
          addComment(config, tracked.number,
            `❓ **Agent question:**\n\n${tracked.questionComment}\n\n_Remove the \`agent-question\` label when you've answered to resume planning._`,
          )
        } else {
          tracked.stage = 'failed'
          tracked.updatedAt = Date.now()
          setLabel(config, tracked.number, ['agent-planning'], 'agent-failed')
          addComment(config, tracked.number,
            `❌ **Planning failed**\n\n${tracked.lastError ?? 'Unknown error'}\n\nTo retry, remove \`agent-failed\` and add \`agent-ready\`.`,
          )
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
        setLabel(config, tracked.number, ['agent-question'], 'agent-failed')
        addComment(config, tracked.number, '⏰ **Question timed out** (7 days). To retry, remove `agent-failed` and add `agent-ready`.')
        saveState()
        continue
      }

      if (!hasLabel(config, tracked.number, 'agent-question')) {
        tracked.questionComment = fetchIssueComments(config, tracked.number)
        tracked.stage = 'planning'
        tracked.updatedAt = Date.now()
        setLabel(config, tracked.number, [], 'agent-planning')
        saveState()
      }
    }

    // ── Executing ──
    if (tracked.stage === 'executing' && !tracked.executorRunning) {
      if (!tracked.branch) {
        tracked.stage = 'failed'
        tracked.updatedAt = Date.now()
        setLabel(config, tracked.number, ['agent-executing'], 'agent-failed')
        addComment(config, tracked.number, '❌ **Executor failed** — no branch was created.')
        saveState()
        continue
      }

      tracked.executorRunning = true
      saveState()

      try {
        const result = await runExecutorAgent(config, tracked)

        if (result === 'done') {
          const gitCwd = tracked.worktreePath ?? config.localPath
          const prCreated = pushBranchAndCreatePR(
            config, gitCwd, tracked.branch, tracked.number,
            `[${tracked.repo.split('/')[1]}#${tracked.number}] ${tracked.title}`,
          )
          if (tracked.worktreePath) cleanupWorktree(config.localPath, tracked.worktreePath)

          tracked.stage = 'done'
          tracked.updatedAt = Date.now()
          const doneLabel = prCreated ? 'pr-ready' : 'agent-done'
          setLabel(config, tracked.number, ['agent-executing'], doneLabel)
          addComment(config, tracked.number,
            `✅ **Implementation complete**${prCreated ? '\nA pull request has been created for review.' : ''}`,
          )
        } else if (tracked.executorAttempts < MAX_EXECUTOR_ATTEMPTS) {
          console.log(`[github-pipeline] Executor retry for #${tracked.number} (${tracked.executorAttempts}/${MAX_EXECUTOR_ATTEMPTS})`)
        } else {
          if (tracked.worktreePath) cleanupWorktree(config.localPath, tracked.worktreePath)
          tracked.stage = 'failed'
          tracked.updatedAt = Date.now()
          setLabel(config, tracked.number, ['agent-executing'], 'agent-failed')
          addComment(config, tracked.number,
            `❌ **Executor failed** after ${MAX_EXECUTOR_ATTEMPTS} attempts.\n\n${tracked.lastError ?? ''}\n\nTo retry, remove \`agent-failed\` and add \`agent-ready\`.`,
          )
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

/** Initialize — load persisted state. */
export function initPipeline(): void {
  loadState()
  console.log(`[github-pipeline] Loaded ${state.issues.length} pipeline issues`)
}
