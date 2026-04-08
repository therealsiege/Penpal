/**
 * 2-Agent GitHub Issue Pipeline
 *
 * Drives GitHub issues through a planner→executor→validator flow:
 *   agent-ready → agent-planning → [agent-question]* → agent-executing → agent-validating → pr-ready | agent-failed
 *
 * The planner agent explores the codebase and designs an implementation plan.
 * The executor agent implements the plan in an isolated worktree, writes tests, and commits.
 * The validator agent runs tests and captures Playwright screenshots for visual verification.
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
import { postPipelineNotification, dmOwner } from './slack-bridge'

// ── Types ────────────────────────────────────────────────────────────────────

export type PipelineStage = 'planning' | 'awaiting-answer' | 'executing' | 'validating' | 'done' | 'failed'

export interface PipelineIssue {
  number: number
  repo: string       // "owner/repo"
  title: string
  body: string
  stage: PipelineStage
  priority: string
  size: TShirtSize
  ingestedAt: number
  updatedAt: number
  branch?: string
  worktreePath?: string
  /** Set when worktree + fallback branch creation both fail (shown on "no branch" issue comment). */
  branchCreationError?: string
  plannerOutput?: string
  questionComment?: string
  questionPostedAt?: number
  executorAttempts: number
  lastError?: string
  validatorOutput?: string
  // Guards against concurrent runs
  plannerRunning: boolean
  executorRunning: boolean
  validatorRunning: boolean
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

// ── T-shirt sizing ──────────────────────────────────────────────────────────

export type TShirtSize = 'S' | 'M' | 'L' | 'XL'

interface SizeProfile {
  plannerModel: string
  executorModel: string
  plannerTimeoutMs: number
  executorTimeoutMs: number
  maxAttempts: number
}

const SIZE_PROFILES: Record<TShirtSize, SizeProfile> = {
  S: {
    plannerModel: 'haiku',
    executorModel: 'sonnet',
    plannerTimeoutMs: 300_000,   // 5 min
    executorTimeoutMs: 300_000,  // 5 min
    maxAttempts: 2,
  },
  M: {
    plannerModel: 'sonnet',
    executorModel: 'sonnet',
    plannerTimeoutMs: 600_000,   // 10 min
    executorTimeoutMs: 600_000,  // 10 min
    maxAttempts: 3,
  },
  L: {
    plannerModel: 'sonnet',
    executorModel: 'opus',
    plannerTimeoutMs: 900_000,   // 15 min
    executorTimeoutMs: 900_000,  // 15 min
    maxAttempts: 3,
  },
  XL: {
    plannerModel: 'opus',
    executorModel: 'opus',
    plannerTimeoutMs: 900_000,   // 15 min
    executorTimeoutMs: 900_000,  // 15 min
    maxAttempts: 3,
  },
}

const DEFAULT_SIZE: TShirtSize = 'M'

function detectTShirtSize(labels: { name: string }[]): TShirtSize {
  for (const l of labels) {
    const m = l.name.match(/^size[:\/]?\s*(XL|L|M|S)$/i)
    if (m) return m[1].toUpperCase() as TShirtSize
  }
  return DEFAULT_SIZE
}

function getSizeProfile(size: TShirtSize): SizeProfile {
  return SIZE_PROFILES[size] ?? SIZE_PROFILES[DEFAULT_SIZE]
}

// ── Constants ────────────────────────────────────────────────────────────────

const QUESTION_TIMEOUT_MS = 7 * 24 * 60 * 60 * 1000 // 7 days
const VALIDATOR_TIMEOUT_MS = 1_200_000 // 20 min
const MAX_EXECUTOR_ATTEMPTS = 3
const SCREENSHOT_DIR = '.playwright-screenshots'

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

/** stderr/stdout from failed git child processes (execFile puts stderr on the error object). */
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

/**
 * Resolve origin's default branch. Prefer Git's own pointers (origin/HEAD, ls-remote),
 * then try common branch names. Stale clones may lack refs/remotes/origin/HEAD.
 */
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

/** Update remote refs; failures must not be swallowed (stale/missing refs cause "no branch"). */
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

/** Ensure refs/remotes/origin/<branch> exists after fetch (required for worktree add / checkout). */
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

    // Delete stale branch from previous failed attempts
    await execFileAsync('git', ['branch', '-D', branch], {
      cwd: mainRepoPath, encoding: 'utf-8', timeout: 10_000,
    }).catch(() => { /* branch didn't exist — fine */ })

    // --force: checkout branch even if already checked out in another worktree
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

    // Delete stale branch from previous failed attempts
    await execFileAsync('git', ['branch', '-D', branch], {
      cwd: localPath, encoding: 'utf-8', timeout: 10_000,
    }).catch(() => { /* branch didn't exist — fine */ })

    // -B: create or reset issue branch to match remote base (handles leftover local branch)
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
  try {
    // Commit any uncommitted changes left by the executor
    await execFileAsync('git', ['add', '-A'], { cwd: localPath, encoding: 'utf-8', timeout: 15_000 })
    const { stdout: status } = await execFileAsync('git', ['status', '--porcelain'], {
      cwd: localPath, encoding: 'utf-8', timeout: 10_000,
    })
    if (status.trim()) {
      const commitMsg = `${title}\n\nCloses #${issueNumber}\n\nCo-Authored-By: Penny Orchestrator <noreply@penny.dev>`
      await execFileAsync('git', ['commit', '-m', commitMsg], {
        cwd: localPath, encoding: 'utf-8', timeout: 15_000,
      })
    }

    // Check if the branch has any commits ahead of origin (executor may have committed already)
    const baseBranch = await resolveRemoteDefaultBranch(localPath)
    const { stdout: revList } = await execFileAsync('git', ['rev-list', '--count', `origin/${baseBranch}..HEAD`], {
      cwd: localPath, encoding: 'utf-8', timeout: 10_000,
    })
    if (parseInt(revList.trim(), 10) === 0) {
      console.log(`[github-pipeline] No commits ahead of origin/${baseBranch} for ${branch} — nothing to push`)
      return false
    }

    await execFileAsync('git', ['push', '-u', 'origin', branch], {
      cwd: localPath, encoding: 'utf-8', timeout: 60_000,
    })
    const prBody = `Closes #${issueNumber}\n\nAutomated implementation by Penny orchestrator (2-agent pipeline).`
    await execFileAsync('gh', [
      'pr', 'create',
      '--repo', `${config.owner}/${config.repo}`,
      '--head', branch,
      '--base', baseBranch,
      '--title', title,
      '--body', prBody,
    ], { cwd: localPath, encoding: 'utf-8', timeout: 30_000 })
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

// ── Prompt builders ──────────────────────────────────────────────────────────

function buildPlannerPrompt(issue: GHIssue, repoKey: string, answerContext?: string): string {
  const parts = [
    `Plan the implementation for ${repoKey}#${issue.number}: ${issue.title}`,
    '',
    issue.body || '(no description)',
    '',
    'Output a numbered plan with exact file paths and changes. Be concise — the executor agent implements from your plan.',
    'Only output QUESTION: if you genuinely cannot proceed without an answer (e.g. ambiguous requirements, missing context about business logic).',
    'Do NOT ask about tests, tooling, or things you can discover by reading the code. Just plan the fix.',
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
  const profile = getSizeProfile(tracked.size)

  console.log(`[github-pipeline] Running planner for ${repoKey}#${tracked.number} (size=${tracked.size}, model=${profile.plannerModel})`)
  const result = await runAgentHeadless('issue-planner', config.localPath, prompt, {
    timeoutMs: profile.plannerTimeoutMs,
    phase: 'planning',
    modelOverride: profile.plannerModel,
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
  const profile = getSizeProfile(tracked.size)
  const maxAttempts = profile.maxAttempts

  console.log(`[github-pipeline] Running executor for ${repoKey}#${tracked.number} (size=${tracked.size}, model=${profile.executorModel}, attempt ${tracked.executorAttempts + 1}/${maxAttempts})`)
  const result = await runAgentHeadless('electron-dev', agentCwd, prompt, {
    timeoutMs: profile.executorTimeoutMs,
    phase: 'executing',
    modelOverride: profile.executorModel,
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

// ── Validator prompt builder ─────────────────────────────────────────────────

export function buildValidatorPrompt(issue: PipelineIssue, repoKey: string): string {
  return [
    `You are validating the implementation for GitHub issue ${repoKey}#${issue.number}: ${issue.title}`,
    '',
    '## Implementation Plan (for context)',
    '',
    issue.plannerOutput?.slice(0, 2000) || '(no plan available)',
    '',
    '## Your Tasks',
    '',
    '1. Run the project\'s existing test suite (`npm test` or the appropriate command).',
    '2. If a dev server can be started (`npm run dev`), start it and use Playwright to navigate',
    '   the application and capture screenshots of key UI areas affected by this change.',
    `3. Save all screenshots to \`${SCREENSHOT_DIR}/\` in the current working directory.`,
    '   Use descriptive filenames (e.g., `dashboard-overview.png`, `settings-panel.png`).',
    '4. Report your findings in this exact format:',
    '',
    '```',
    'VALIDATION_RESULT: PASS or FAIL',
    'TEST_SUMMARY: <one-line summary of test results>',
    'SCREENSHOTS: <comma-separated list of screenshot filenames, or "none">',
    'DETAILS: <brief description of what was validated>',
    '```',
    '',
    'If tests fail or you find issues, report FAIL with details about what broke.',
    'Do NOT fix any code — only report findings.',
  ].join('\n')
}

// ── Validator runner ─────────────────────────────────────────────────────────

async function runValidatorAgent(
  config: RepoConfig,
  tracked: PipelineIssue,
): Promise<'pass' | 'fail'> {
  const repoKey = `${config.owner}/${config.repo}`
  const agentCwd = tracked.worktreePath || config.localPath
  const prompt = buildValidatorPrompt(tracked, repoKey)

  console.log(`[github-pipeline] Running validator for ${repoKey}#${tracked.number}`)
  const result = await runAgentHeadless('issue-validator', agentCwd, prompt, {
    timeoutMs: VALIDATOR_TIMEOUT_MS,
    phase: 'validating',
  })

  if (!result.success) {
    const errorDetail = [result.error, result.output?.slice(-500)].filter(Boolean).join('\n\n')
    tracked.lastError = errorDetail || 'Validator exited with error'
    console.error(`[github-pipeline] Validator failed for #${tracked.number}:`, errorDetail)
    return 'fail'
  }

  tracked.validatorOutput = result.output.trim()

  // Parse structured result
  const resultMatch = tracked.validatorOutput.match(/VALIDATION_RESULT:\s*(PASS|FAIL)/i)
  if (resultMatch && resultMatch[1].toUpperCase() === 'PASS') {
    return 'pass'
  }

  tracked.lastError = tracked.validatorOutput.slice(-500)
  return 'fail'
}

// ── Screenshot collection & PR comment ──────────────────────────────────────

export async function collectScreenshots(worktreePath: string): Promise<string[]> {
  const screenshotDir = path.join(worktreePath, SCREENSHOT_DIR)
  if (!fs.existsSync(screenshotDir)) return []
  try {
    const files = fs.readdirSync(screenshotDir)
    return files.filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f))
  } catch {
    return []
  }
}

export async function uploadScreenshotsToPR(
  config: RepoConfig,
  branch: string,
  worktreePath: string,
  issueNumber: number,
): Promise<string> {
  const screenshots = await collectScreenshots(worktreePath)
  if (screenshots.length === 0) return ''

  const screenshotDir = path.join(worktreePath, SCREENSHOT_DIR)

  // Commit screenshots to the branch so they're accessible via raw GitHub URLs
  try {
    await execFileAsync('git', ['add', SCREENSHOT_DIR], {
      cwd: worktreePath, encoding: 'utf-8', timeout: 15_000,
    })
    const { stdout: status } = await execFileAsync('git', ['status', '--porcelain', SCREENSHOT_DIR], {
      cwd: worktreePath, encoding: 'utf-8', timeout: 10_000,
    })
    if (status.trim()) {
      await execFileAsync('git', ['commit', '-m', 'chore: add validation screenshots'], {
        cwd: worktreePath, encoding: 'utf-8', timeout: 15_000,
      })
      await execFileAsync('git', ['push', 'origin', branch], {
        cwd: worktreePath, encoding: 'utf-8', timeout: 60_000,
      })
    }
  } catch (err) {
    console.error('[github-pipeline] Failed to push screenshots:', err)
    // Fall back to base64 inline images
    return buildBase64ScreenshotComment(screenshotDir, screenshots)
  }

  // Build markdown with GitHub raw URLs
  const lines = ['### Validation Screenshots', '']
  for (const file of screenshots) {
    const rawUrl = `https://raw.githubusercontent.com/${config.owner}/${config.repo}/${branch}/${SCREENSHOT_DIR}/${file}`
    const label = file.replace(/\.(png|jpg|jpeg|webp)$/i, '').replace(/[-_]/g, ' ')
    lines.push(`**${label}**`, `![${label}](${rawUrl})`, '')
  }
  return lines.join('\n')
}

function buildBase64ScreenshotComment(dir: string, files: string[]): string {
  const lines = ['### Validation Screenshots', '']
  for (const file of files.slice(0, 5)) { // Limit to 5 to avoid comment size limits
    try {
      const data = fs.readFileSync(path.join(dir, file))
      const ext = path.extname(file).slice(1).toLowerCase()
      const mime = ext === 'jpg' ? 'jpeg' : ext
      const b64 = data.toString('base64')
      const label = file.replace(/\.(png|jpg|jpeg|webp)$/i, '').replace(/[-_]/g, ' ')
      lines.push(`**${label}**`, `![${label}](data:image/${mime};base64,${b64})`, '')
    } catch { /* skip unreadable files */ }
  }
  return lines.join('\n')
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
      // Backfill size for issues created before t-shirt sizing
      for (const issue of state.issues) {
        if (!issue.size) issue.size = DEFAULT_SIZE
      }
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

  const size = detectTShirtSize(issue.labels)
  const profile = getSizeProfile(size)

  const entry: PipelineIssue = {
    number: issue.number,
    repo: repoKey,
    title: issue.title,
    body: issue.body || '',
    stage: 'planning',
    priority: 'normal',
    size,
    ingestedAt: Date.now(),
    updatedAt: Date.now(),
    executorAttempts: 0,
    plannerRunning: false,
    executorRunning: false,
    validatorRunning: false,
  }

  // Remove stale entry if re-ingesting
  state.issues = state.issues.filter(i => !(i.repo === repoKey && i.number === issue.number))
  state.issues.push(entry)

  // Swap label (non-blocking, concurrent)
  await Promise.allSettled([
    setLabel(config, issue.number, ['agent-ready'], 'agent-planning'),
    addComment(config, issue.number,
      `🤖 **Picked up by Penny** (2-agent pipeline, size **${size}**)\n\nPlanner: \`${profile.plannerModel}\` · Executor: \`${profile.executorModel}\`\n\nPlanner agent is designing the approach...`,
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
          if (wt.ok) {
            tracked.branch = wt.branch
            tracked.worktreePath = wt.worktreePath
            tracked.branchCreationError = undefined
            console.log(`[github-pipeline] Worktree created: ${wt.branch} at ${wt.worktreePath}`)
          } else {
            const br = await createIssueBranch(resolvedPath, tracked.number, slug)
            if (br.ok) {
              tracked.branch = br.branch
              tracked.branchCreationError = undefined
              console.log(`[github-pipeline] Branch created: ${br.branch}`)
            } else {
              tracked.branch = undefined
              tracked.branchCreationError = `Worktree failed:\n${wt.error}\n\nFallback branch failed:\n${br.error}`
              console.error(`[github-pipeline] Branch creation failed for #${tracked.number}:`, tracked.branchCreationError)
            }
          }
        } else if (result === 'question') {
          tracked.stage = 'awaiting-answer'
          tracked.questionPostedAt = Date.now()
          tracked.updatedAt = Date.now()
          const repoKey = `${config.owner}/${config.repo}`
          await Promise.allSettled([
            setLabel(config, tracked.number, ['agent-planning'], 'agent-question'),
            addComment(config, tracked.number,
              `❓ **Agent question:**\n\n${tracked.questionComment}\n\n_Remove the \`agent-question\` label when you've answered to resume planning._`,
            ),
            dmOwner(
              `:question: *${repoKey}#${tracked.number}* needs your input:\n>${tracked.questionComment}\n\n<https://github.com/${repoKey}/issues/${tracked.number}|Answer on GitHub>`,
              ':question:',
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
            postPipelineNotification(
              `:x: *${config.owner}/${config.repo}#${tracked.number}* planning failed\n<https://github.com/${config.owner}/${config.repo}/issues/${tracked.number}|View issue>`,
              ':x:',
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
        const gitDetail = tracked.branchCreationError
          ? `\n\n<details><summary>Git error (from Penny)</summary>\n\n\`\`\`\n${tracked.branchCreationError.slice(0, 3500)}\n\`\`\`\n\n</details>\n\n_Check the Electron **main process** console for \`[github-pipeline]\` / \`git\` lines if this persists._`
          : ''
        await Promise.allSettled([
          setLabel(config, tracked.number, ['agent-executing'], 'agent-failed'),
          addComment(config, tracked.number, `❌ **Executor failed** — no branch was created.${gitDetail}`),
        ])
        saveState()
        continue
      }

      tracked.executorRunning = true
      saveState()

      try {
        const result = await runExecutorAgent(config, tracked)

        if (result === 'done') {
          // Transition to validation stage instead of done
          tracked.stage = 'validating'
          tracked.updatedAt = Date.now()
          await Promise.allSettled([
            setLabel(config, tracked.number, ['agent-executing'], 'agent-validating'),
            addComment(config, tracked.number,
              '🔍 **Executor complete** — running validation agent (tests + screenshots)...',
            ),
            postPipelineNotification(
              `:white_check_mark: *${tracked.repo}#${tracked.number}* done (size ${tracked.size})${prCreated ? ' — PR created' : ''}\n<https://github.com/${tracked.repo}/issues/${tracked.number}|View issue>`,
              ':white_check_mark:',
            ),
          ])
        } else if (tracked.executorAttempts < getSizeProfile(tracked.size).maxAttempts) {
          console.log(`[github-pipeline] Executor retry for #${tracked.number} (${tracked.executorAttempts}/${getSizeProfile(tracked.size).maxAttempts})`)
        } else {
          if (tracked.worktreePath) await cleanupWorktree(config.localPath, tracked.worktreePath)
          tracked.stage = 'failed'
          tracked.updatedAt = Date.now()
          const execErrorBody = tracked.lastError
            ? `\`\`\`\n${tracked.lastError.slice(0, 1000)}\n\`\`\``
            : ''
          const maxAtt = getSizeProfile(tracked.size).maxAttempts
          await Promise.allSettled([
            setLabel(config, tracked.number, ['agent-executing'], 'agent-failed'),
            addComment(config, tracked.number,
              `❌ **Executor failed** after ${maxAtt} attempts.\n\n${execErrorBody}\n\nTo retry, remove \`agent-failed\` and add \`agent-ready\`.`,
            ),
            postPipelineNotification(
              `:x: *${tracked.repo}#${tracked.number}* failed after ${maxAtt} attempts (size ${tracked.size})\n<https://github.com/${tracked.repo}/issues/${tracked.number}|View issue>`,
              ':x:',
            ),
            dmOwner(
              `:x: *${tracked.repo}#${tracked.number}* executor failed after ${maxAtt} attempts (size ${tracked.size})\n<https://github.com/${tracked.repo}/issues/${tracked.number}|View issue>`,
              ':x:',
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

    // ── Validating ──
    if (tracked.stage === 'validating' && !tracked.validatorRunning) {
      tracked.validatorRunning = true
      saveState()

      try {
        const result = await runValidatorAgent(config, tracked)
        const gitCwd = tracked.worktreePath ?? config.localPath

        // Upload screenshots to PR regardless of pass/fail
        let screenshotMarkdown = ''
        if (tracked.branch && tracked.worktreePath) {
          screenshotMarkdown = await uploadScreenshotsToPR(
            config, tracked.branch, tracked.worktreePath, tracked.number,
          )
        }

        if (result === 'pass') {
          // Push branch and create PR
          const prCreated = await pushBranchAndCreatePR(
            config, gitCwd, tracked.branch!, tracked.number,
            `[${tracked.repo.split('/')[1]}#${tracked.number}] ${tracked.title}`,
          )
          if (tracked.worktreePath) await cleanupWorktree(config.localPath, tracked.worktreePath)

          tracked.stage = 'done'
          tracked.updatedAt = Date.now()

          const validationSummary = tracked.validatorOutput?.match(/TEST_SUMMARY:\s*(.+)/)?.[1] || 'All checks passed'
          const doneLabel = prCreated ? 'pr-ready' : 'agent-done'
          const commentParts = [
            `✅ **Implementation complete — validation passed**`,
            `\n**Test summary:** ${validationSummary}`,
            prCreated ? '\nA pull request has been created for review.' : '',
            screenshotMarkdown ? `\n${screenshotMarkdown}` : '',
          ]
          await Promise.allSettled([
            setLabel(config, tracked.number, ['agent-validating'], doneLabel),
            addComment(config, tracked.number, commentParts.filter(Boolean).join('\n')),
          ])
        } else {
          if (tracked.worktreePath) await cleanupWorktree(config.localPath, tracked.worktreePath)
          tracked.stage = 'failed'
          tracked.updatedAt = Date.now()
          const validationError = tracked.lastError
            ? `\`\`\`\n${tracked.lastError.slice(0, 1000)}\n\`\`\``
            : ''
          const commentParts = [
            `❌ **Validation failed**`,
            validationError,
            screenshotMarkdown ? `\n${screenshotMarkdown}` : '',
            '\nTo retry, remove `agent-failed` and add `agent-ready`.',
          ]
          await Promise.allSettled([
            setLabel(config, tracked.number, ['agent-validating'], 'agent-failed'),
            addComment(config, tracked.number, commentParts.filter(Boolean).join('\n')),
          ])
        }
      } catch (err) {
        console.error(`[github-pipeline] Validator error for #${tracked.number}:`, err)
      } finally {
        tracked.validatorRunning = false
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
    if (issue.validatorRunning) { issue.validatorRunning = false; reset++ }
  }
  if (reset > 0) {
    saveState()
    console.log(`[github-pipeline] Reset ${reset} stale running flag(s)`)
  }
  console.log(`[github-pipeline] Loaded ${state.issues.length} pipeline issues`)
}
