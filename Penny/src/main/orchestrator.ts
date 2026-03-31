/**
 * Orchestrator — Task queue, dispatch loop, agent selection, health monitor
 *
 * Central task queue with priority routing, agent health monitoring, and
 * lifecycle management. Tasks can arrive from the dashboard, Slack (!task),
 * or the API.
 */

import { EventEmitter } from 'events'
import fs from 'fs'
import path from 'path'
import { atomicWrite } from './atomic-store'
import {
  getClaudeSessions,
  sendToSession,
  runAgentHeadless,
  analyzeSession,
  type ClaudeSession,
} from './sessions'
import {
  getAgentConfigs,
  getAgentConfig,
  getTaskRunnerKind,
  loadAgentSessionMap,
  removeAgentSession,
  type AgentConfig,
} from './agents'
import { checkOllamaAvailable, runOllama } from './ollama-client'
import {
  migratePersistedProject,
  normalizeEnqueueProject,
  resolveProjectPath,
  pathsReferToSameRepo,
} from './project-paths'

// ── Types ───────────────────────────────────────────────────────────────────

export type TaskPriority = 'critical' | 'high' | 'normal' | 'low'
export type TaskStatus = 'queued' | 'assigned' | 'active' | 'completed' | 'failed' | 'cancelled'
export type TaskSource = 'slack' | 'dashboard' | 'api' | 'github'
export type TaskStage = 'queued' | 'planning' | 'executing' | 'validating' | 'done'
export type ModelProvider = 'claude' | 'ollama'

export type StageResultProvider = ModelProvider | 'opencode' | 'cursor-agent'

export interface StageResult {
  stage: TaskStage
  success: boolean
  output: string
  durationMs: number
  provider: StageResultProvider
  startedAt: number
  completedAt: number
}

export interface Task {
  id: string
  title: string
  description: string
  project: string
  priority: TaskPriority
  status: TaskStatus
  requiredSkills: string[]
  preferredAgent?: string
  assignedAgent?: string
  assignedSessionId?: string
  source: TaskSource
  slackChannelId?: string
  slackThreadTs?: string
  createdAt: number
  assignedAt?: number
  completedAt?: number
  result?: string
  error?: string
  retryCount: number
  maxRetries: number
  // 3-stage pipeline fields (optional for backward compat)
  currentStage?: TaskStage
  stageResults?: StageResult[]
  planOutput?: string
  validateOutput?: string
  provider?: ModelProvider
}

export interface AgentHealthStatus {
  agentId: string
  name: string
  alive: boolean
  pid?: number
  memoryMB?: number
  cpu?: string
  uptime?: string
  activeTasks: number
  status: 'healthy' | 'warning' | 'dead'
  warnings: string[]
}

export interface OrchestratorStats {
  queueDepth: number
  activeTasks: number
  completedToday: number
  failedToday: number
  totalProcessed: number
}

// ── Persistence ─────────────────────────────────────────────────────────────

const DATA_DIR = path.resolve(__dirname, '..', '..', 'data')
const PERSIST_PATH = path.join(DATA_DIR, 'task-queue.json')

function loadTasks(): Task[] {
  try {
    if (fs.existsSync(PERSIST_PATH)) {
      const raw = JSON.parse(fs.readFileSync(PERSIST_PATH, 'utf-8')) as Task[]
      if (!Array.isArray(raw)) return []
      for (const t of raw) {
        if (t && typeof t.project === 'string') {
          t.project = migratePersistedProject(t.project)
        }
      }
      return raw
    }
  } catch (err) {
    console.error('[orchestrator] Failed to load tasks:', err)
  }
  return []
}

function saveTasks(): void {
  try {
    atomicWrite(PERSIST_PATH, tasks)
  } catch (err) {
    console.error('[orchestrator] Failed to save tasks:', err)
  }
}

// ── XP System ────────────────────────────────────────────────────────────────

export interface AgentXP {
  totalXP: number
  level: number
  rank: string
  tasksCompleted: number
  tasksFailed: number
  currentStreak: number
}

const XP_PERSIST_PATH = path.join(DATA_DIR, 'agent-xp.json')

const XP_RANKS = [
  { level: 1,  title: 'Intern',        minXP: 0 },
  { level: 2,  title: 'Junior',        minXP: 500 },
  { level: 3,  title: 'Associate',    minXP: 1500 },
  { level: 4,  title: 'Agent',         minXP: 3500 },
  { level: 5,  title: 'Senior',        minXP: 7000 },
  { level: 6,  title: 'Lead',          minXP: 12000 },
  { level: 7,  title: 'Expert',        minXP: 20000 },
  { level: 8,  title: 'Master',        minXP: 35000 },
  { level: 9,  title: 'Grandmaster',    minXP: 55000 },
  { level: 10, title: 'Legend',        minXP: 85000 },
]

const PRIORITY_XP = { critical: 300, high: 150, normal: 100, low: 50 }

function loadAgentXP(): Record<string, AgentXP> {
  try {
    if (fs.existsSync(XP_PERSIST_PATH)) {
      return JSON.parse(fs.readFileSync(XP_PERSIST_PATH, 'utf-8'))
    }
  } catch (err) {
    console.error('[orchestrator] Failed to load XP:', err)
  }
  return {}
}

function saveAgentXP(xpData: Record<string, AgentXP>): void {
  try {
    atomicWrite(XP_PERSIST_PATH, xpData)
  } catch (err) {
    console.error('[orchestrator] Failed to save XP:', err)
  }
}

function getRankForXP(xp: number): { level: number; title: string } {
  for (let i = XP_RANKS.length - 1; i >= 0; i--) {
    if (xp >= XP_RANKS[i].minXP) {
      return { level: XP_RANKS[i].level, title: XP_RANKS[i].title }
    }
  }
  return { level: 1, title: 'Intern' }
}

function calculateTaskXP(task: Task): number {
  const baseXP = task.status === 'completed' ? PRIORITY_XP[task.priority] : -25
  return baseXP
}

const agentXPData = loadAgentXP()

function awardXP(agentId: string, xp: number, taskStatus: 'completed' | 'failed'): AgentXP {
  let data = agentXPData[agentId]
  if (!data) {
    data = { totalXP: 0, level: 1, rank: 'Intern', tasksCompleted: 0, tasksFailed: 0, currentStreak: 0 }
  }

  if (taskStatus === 'completed') {
    data.tasksCompleted++
    data.currentStreak++
    data.totalXP = Math.max(0, data.totalXP + xp)
  } else {
    data.tasksFailed++
    data.currentStreak = 0
    data.totalXP = Math.max(0, data.totalXP + xp)
  }

  const rank = getRankForXP(data.totalXP)
  data.level = rank.level
  data.rank = rank.title

  agentXPData[agentId] = data
  saveAgentXP(agentXPData)

  return data
}

export function getAgentXP(agentId: string): AgentXP | null {
  return agentXPData[agentId] || null
}

export function getAllAgentXP(): Record<string, AgentXP> {
  return { ...agentXPData }
}

// ── Credits (cosmetic economy, tracked alongside XP) ────────────────────────

const CREDIT_PERSIST_PATH = path.join(DATA_DIR, 'agent-credits.json')

interface CreditData {
  balance: number
  totalEarned: number
}

function loadCredits(): Record<string, CreditData> {
  try {
    if (fs.existsSync(CREDIT_PERSIST_PATH)) {
      return JSON.parse(fs.readFileSync(CREDIT_PERSIST_PATH, 'utf-8'))
    }
  } catch (err) {
    console.error('[orchestrator] Failed to load credits:', err)
  }
  return {}
}

const creditData = loadCredits()

function saveCredits(): void {
  try {
    atomicWrite(CREDIT_PERSIST_PATH, creditData)
  } catch (err) {
    console.error('[orchestrator] Failed to save credits:', err)
  }
}

const PRIORITY_CREDITS: Record<string, number> = { critical: 150, high: 75, normal: 50, low: 25 }

function awardCredits(agentId: string, credits: number): CreditData {
  let data = creditData[agentId]
  if (!data) data = { balance: 0, totalEarned: 0 }
  data.balance += credits
  data.totalEarned += credits
  creditData[agentId] = data
  saveCredits()
  return data
}

export function getAgentCredits(agentId: string): CreditData | null {
  return creditData[agentId] || null
}

export function getAllAgentCredits(): Record<string, CreditData> {
  return { ...creditData }
}

// ── State ───────────────────────────────────────────────────────────────────

const tasks: Task[] = []
let dispatchTimer: ReturnType<typeof setInterval> | null = null
let healthTimer: ReturnType<typeof setInterval> | null = null

export const orchestratorEvents = new EventEmitter()

const DISPATCH_INTERVAL = 10_000   // 10s
const HEALTH_INTERVAL = 30_000     // 30s
const STUCK_THRESHOLD_MS = 30 * 60_000  // 30 min
const MEMORY_WARNING_MB = 2048

const PRIORITY_ORDER: Record<TaskPriority, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
}

// ── Model Provider ──────────────────────────────────────────────────────────

let currentProvider: ModelProvider = 'claude'

export function setModelProvider(p: ModelProvider): void {
  currentProvider = p
  console.log(`[orchestrator] Model provider set to: ${p}`)
}

export function getModelProvider(): ModelProvider {
  return currentProvider
}

// ── Stage Prompt Builders ───────────────────────────────────────────────────

/** Branch name Penny / github-issues put in the task description (if any). */
function extractGithubBranchFromDescription(description: string): string | null {
  const m = description.match(/You are on branch `([^`]+)`/)
  return m?.[1] ?? null
}

function taskWorkDir(task: Task): string {
  return resolveProjectPath(task.project)
}

/** Strong git + cwd instructions for GitHub-ingested tasks (plan + execute). */
function githubWorkflowForAgent(task: Task): string {
  if (task.source !== 'github') return ''
  const branch = extractGithubBranchFromDescription(task.description)
  const cwd = taskWorkDir(task)
  return [
    '--- GITHUB REPOSITORY (CRITICAL) ---',
    `Use this directory as cwd for every shell command, read, and edit:`,
    `  ${cwd}`,
    '',
    'Before editing, run and respect: `pwd`, `git rev-parse --show-toplevel`, `git branch --show-current`, `git status`.',
    branch
      ? `You must work on branch \`${branch}\`. If HEAD is wrong, run \`git checkout ${branch}\` first.`
      : 'Stay on the branch Penny created for this issue (see task description).',
    '',
    'Make real file changes in that repo, then commit with `git add` and `git commit` (logical commits).',
    'Do NOT `git push`, do NOT run `gh pr create`, and do NOT open a pull request yourself — Penny pushes and opens the PR after you pass validation.',
    'If the repo path is wrong or git errors block you, say so clearly in your summary.',
    '--- END GITHUB ---',
    '',
  ].join('\n')
}

function githubValidateContext(task: Task): string {
  if (task.source !== 'github') return ''
  return [
    '--- CONTEXT (GitHub task) ---',
    `Target repo path: ${taskWorkDir(task)}`,
    'The executor should have committed locally; Penny will push/PR — you only PASS/FAIL the work.',
    '---',
    '',
  ].join('\n')
}

function buildPlanPrompt(task: Task): string {
  return [
    githubWorkflowForAgent(task),
    'You are a planning agent. Your job is to produce a detailed, numbered plan for the following task.',
    'Do NOT implement anything. Do NOT write code. Only output the plan.',
    '',
    `Task: ${task.title}`,
    `Description: ${task.description}`,
    `Project (cwd): ${taskWorkDir(task)}`,
    `Priority: ${task.priority}`,
    '',
    'Output a numbered step-by-step plan. Be specific about which files to touch and what changes to make.',
    'If this is a GitHub task, the plan must include verifying cwd/branch and using git commits in that repo.',
  ].join('\n')
}

function buildExecutePrompt(task: Task, plan: string): string {
  return [
    githubWorkflowForAgent(task),
    'You are an execution agent. Implement the following plan exactly. Do not deviate.',
    '',
    `Task: ${task.title}`,
    `Description: ${task.description}`,
    `Project (cwd): ${taskWorkDir(task)}`,
    '',
    '--- PLAN ---',
    plan,
    '--- END PLAN ---',
    '',
    'Implement each step. When done, summarize what you changed and confirm `git status` is clean or list remaining uncommitted files.',
  ].join('\n')
}

function buildValidatePrompt(task: Task, plan: string, execOutput: string): string {
  return [
    githubValidateContext(task),
    'You are a validation agent. Review whether the execution output satisfies the original task and plan.',
    'Do NOT make any changes. This is a read-only review.',
    '',
    `Task: ${task.title}`,
    `Description: ${task.description}`,
    '',
    '--- PLAN ---',
    plan,
    '--- END PLAN ---',
    '',
    '--- EXECUTION OUTPUT ---',
    execOutput.slice(0, 4000),
    '--- END EXECUTION OUTPUT ---',
    '',
    'Evaluate completeness and correctness. End your response with exactly PASS or FAIL on its own line.',
  ].join('\n')
}

// ── Stage Runner ────────────────────────────────────────────────────────────

async function runStage(
  task: Task,
  agentId: string,
  stage: TaskStage,
  prompt: string,
): Promise<{ success: boolean; output: string; durationMs: number; provider: StageResultProvider }> {
  const provider = task.provider ?? currentProvider

  // Ollama handles plan & validate only; execution uses PENNY_TASK_RUNNER (claude / opencode / cursor-agent)
  if (provider === 'ollama' && (stage === 'planning' || stage === 'validating')) {
    const result = await runOllama(prompt, { timeoutMs: 300_000 })
    return { success: result.success, output: result.output, durationMs: result.durationMs, provider: 'ollama' }
  }

  const phase =
    stage === 'planning' ? 'planning' : stage === 'executing' ? 'executing' : 'validating'
  const result = await runAgentHeadless(agentId, taskWorkDir(task), prompt, {
    permissionMode: stage === 'validating' ? 'plan' : undefined,
    timeoutMs: 1_800_000,
    phase,
  })
  const runner = getTaskRunnerKind()
  const headlessProvider: StageResultProvider =
    runner === 'opencode' ? 'opencode' : runner === 'cursor-agent' ? 'cursor-agent' : 'claude'
  return { success: result.success, output: result.output, durationMs: result.durationMs, provider: headlessProvider }
}

// ── Init ────────────────────────────────────────────────────────────────────

function init(): void {
  const loaded = loadTasks()
  tasks.length = 0
  tasks.push(...loaded)
  console.log(`[orchestrator] Loaded ${tasks.length} tasks from disk`)
}

init()

// ── Task Queue API ──────────────────────────────────────────────────────────

let taskCounter = 0

export function enqueueTask(opts: {
  title: string
  description: string
  project: string
  priority?: TaskPriority
  requiredSkills?: string[]
  preferredAgent?: string
  source: TaskSource
  slackChannelId?: string
  slackThreadTs?: string
  maxRetries?: number
  provider?: ModelProvider
}): Task {
  taskCounter += 1
  const task: Task = {
    id: `task-${Date.now()}-${taskCounter}`,
    title: opts.title,
    description: opts.description,
    project: normalizeEnqueueProject(opts.project),
    priority: opts.priority || 'normal',
    status: 'queued',
    requiredSkills: opts.requiredSkills || [],
    preferredAgent: opts.preferredAgent,
    source: opts.source,
    slackChannelId: opts.slackChannelId,
    slackThreadTs: opts.slackThreadTs,
    createdAt: Date.now(),
    retryCount: 0,
    maxRetries: opts.maxRetries ?? 1,
    currentStage: 'queued',
    stageResults: [],
    provider: opts.provider ?? currentProvider,
  }

  tasks.push(task)
  saveTasks()
  orchestratorEvents.emit('task-created', task)
  console.log(`[orchestrator] Enqueued task ${task.id}: "${task.title}" (${task.priority})`)
  return task
}

export function getTaskQueue(): Task[] {
  return [...tasks].sort((a, b) => b.createdAt - a.createdAt)
}

export function getTask(taskId: string): Task | undefined {
  return tasks.find(t => t.id === taskId)
}

export function cancelTask(taskId: string): boolean {
  const task = tasks.find(t => t.id === taskId)
  if (!task || task.status === 'completed' || task.status === 'cancelled') return false
  task.status = 'cancelled'
  task.completedAt = Date.now()
  saveTasks()
  orchestratorEvents.emit('task-updated', task)
  return true
}

export function retryTask(taskId: string): boolean {
  const task = tasks.find(t => t.id === taskId)
  if (!task || task.status !== 'failed') return false
  task.status = 'queued'
  task.assignedAgent = undefined
  task.assignedSessionId = undefined
  task.assignedAt = undefined
  task.completedAt = undefined
  task.error = undefined
  task.result = undefined
  task.retryCount += 1
  saveTasks()
  orchestratorEvents.emit('task-updated', task)
  return true
}

export function pruneTaskQueue(): { removed: number; kept: number } {
  const before = tasks.length
  const activeStatuses = new Set(['queued', 'assigned', 'active'])
  // Keep active tasks + the 20 most recent terminal tasks for history
  const active = tasks.filter(t => activeStatuses.has(t.status))
  const terminal = tasks
    .filter(t => !activeStatuses.has(t.status))
    .sort((a, b) => (b.completedAt ?? b.createdAt) - (a.completedAt ?? a.createdAt))
    .slice(0, 20)
  tasks.length = 0
  tasks.push(...active, ...terminal)
  saveTasks()
  return { removed: before - tasks.length, kept: tasks.length }
}

// ── Agent Selection Algorithm ───────────────────────────────────────────────

interface ScoredAgent {
  config: AgentConfig
  session?: ClaudeSession
  score: number
}

function scoreAgent(task: Task, config: AgentConfig, session: ClaudeSession | undefined): number {
  let score = 0

  // Skill match: 0-100 points
  if (task.requiredSkills.length > 0 && config.skills.length > 0) {
    const matched = task.requiredSkills.filter(s =>
      config.skills.some(cs => cs.toLowerCase().includes(s.toLowerCase())),
    ).length
    score += Math.round((matched / task.requiredSkills.length) * 100)
  } else if (task.requiredSkills.length === 0) {
    // No required skills — any agent is a match
    score += 50
  }

  // Project affinity: +50 if agent has this project in defaultRepos
  const taskCwd = resolveProjectPath(task.project)
  if (config.defaultRepos.some(repo => pathsReferToSameRepo(repo, taskCwd))) {
    score += 50
  }

  // Preferred agent: +100
  if (task.preferredAgent && config.id === task.preferredAgent) {
    score += 100
  }

  // Already idle: +30 (no launch cost)
  if (session && session.interactionType === 'idle-prompt') {
    score += 30
  }

  // Load penalty: -20 per active task already assigned
  const activeTasks = tasks.filter(
    t => t.assignedAgent === config.id && (t.status === 'assigned' || t.status === 'active'),
  ).length
  score -= activeTasks * 20

  return score
}

async function selectAgent(task: Task): Promise<ScoredAgent | null> {
  const configs = getAgentConfigs()
  const sessions = await getClaudeSessions()
  const savedMap = loadAgentSessionMap()

  const candidates: ScoredAgent[] = []

  for (const config of configs) {
    // Find matching session for this agent
    const saved = savedMap[config.id]
    const session = sessions.find(s => {
      if (saved && saved.pid > 0) return s.pid === saved.pid
      if (config.defaultRepos.length > 0) {
        return config.defaultRepos.some(repo => s.cwd === repo)
      }
      return false
    })

    // Agent is available if: no session (can launch), or session is idle
    const hasActiveSession = !!session
    const isIdle = session?.interactionType === 'idle-prompt'
    const isAvailable = !hasActiveSession || isIdle

    if (!isAvailable) continue

    const score = scoreAgent(task, config, session)
    candidates.push({ config, session, score })
  }

  if (candidates.length === 0) return null

  // Sort by score descending
  candidates.sort((a, b) => b.score - a.score)
  return candidates[0]
}

// ── Dispatch Loop ───────────────────────────────────────────────────────────

const activeDispatches = new Set<string>()

async function dispatchLoop(): Promise<void> {
  const queued = tasks
    .filter(t => t.status === 'queued')
    .sort((a, b) => {
      const pDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
      if (pDiff !== 0) return pDiff
      return a.createdAt - b.createdAt
    })

  for (const task of queued) {
    if (activeDispatches.has(task.id)) continue

    try {
      const agent = await selectAgent(task)
      if (!agent) continue

      // Fire and forget — headless agent runs in background
      activeDispatches.add(task.id)
      dispatchTask(task, agent)
        .catch(err => console.error(`[orchestrator] Dispatch error for task ${task.id}:`, err))
        .finally(() => activeDispatches.delete(task.id))
    } catch (err) {
      console.error(`[orchestrator] Dispatch error for task ${task.id}:`, err)
    }
  }
}

function handleStageFailure(task: Task, stage: TaskStage, error: string): void {
  if (task.retryCount < task.maxRetries) {
    task.status = 'queued'
    task.currentStage = 'queued'
    task.assignedAgent = undefined
    task.assignedAt = undefined
    task.retryCount += 1
    task.error = `${stage} failed: ${error} — re-queuing`
    console.log(`[orchestrator] Task ${task.id} failed at ${stage}, re-queuing (attempt ${task.retryCount})`)
  } else {
    task.status = 'failed'
    task.error = `${stage} failed: ${error}`
    task.completedAt = Date.now()
    const durationMs = task.assignedAt ? Math.max(0, task.completedAt - task.assignedAt) : 0
    console.log(`[orchestrator] Task ${task.id} failed permanently at ${stage}: ${task.error}`)

    if (task.assignedAgent) {
      const newXP = awardXP(task.assignedAgent, -25, 'failed')
      orchestratorEvents.emit('xp-awarded', { agentId: task.assignedAgent, xp: newXP })
      orchestratorEvents.emit('task-failed', {
        taskId: task.id,
        agentId: task.assignedAgent,
        priority: task.priority,
        durationMs,
        completedAt: task.completedAt,
      })
    }
  }
}

async function dispatchTask(task: Task, agent: ScoredAgent): Promise<void> {
  task.status = 'assigned'
  task.assignedAgent = agent.config.id
  task.assignedAt = Date.now()
  task.stageResults = task.stageResults ?? []
  saveTasks()
  orchestratorEvents.emit('task-updated', task)
  console.log(`[orchestrator] Dispatching task ${task.id} to ${agent.config.name} (3-stage pipeline)`)

  task.status = 'active'
  saveTasks()
  orchestratorEvents.emit('task-updated', task)
  orchestratorEvents.emit('task-dispatched', { taskId: task.id, agentId: agent.config.id, title: task.title, priority: task.priority })

  // ── Stage 1: Planning ──
  task.currentStage = 'planning'
  saveTasks()
  orchestratorEvents.emit('task-updated', task)
  console.log(`[orchestrator] Task ${task.id} — stage: planning`)

  const planStart = Date.now()
  const planResult = await runStage(task, agent.config.id, 'planning', buildPlanPrompt(task))
  task.stageResults!.push({
    stage: 'planning',
    success: planResult.success,
    output: planResult.output.slice(0, 4000),
    durationMs: planResult.durationMs,
    provider: planResult.provider,
    startedAt: planStart,
    completedAt: Date.now(),
  })

  if (!planResult.success) {
    handleStageFailure(task, 'planning', planResult.output || 'Plan generation failed')
    saveTasks()
    orchestratorEvents.emit('task-updated', task)
    return
  }

  task.planOutput = planResult.output
  saveTasks()
  orchestratorEvents.emit('task-updated', task)

  // Check for cancellation between stages
  if (task.status === 'cancelled') return

  // ── Stage 2: Executing (headless runner from PENNY_TASK_RUNNER) ──
  task.currentStage = 'executing'
  saveTasks()
  orchestratorEvents.emit('task-updated', task)
  console.log(`[orchestrator] Task ${task.id} — stage: executing`)

  const execStart = Date.now()
  const execResult = await runStage(task, agent.config.id, 'executing', buildExecutePrompt(task, task.planOutput!))
  task.stageResults!.push({
    stage: 'executing',
    success: execResult.success,
    output: execResult.output.slice(0, 4000),
    durationMs: execResult.durationMs,
    provider: execResult.provider,
    startedAt: execStart,
    completedAt: Date.now(),
  })

  if (!execResult.success) {
    handleStageFailure(task, 'executing', execResult.output || 'Execution failed')
    saveTasks()
    orchestratorEvents.emit('task-updated', task)
    return
  }

  saveTasks()
  orchestratorEvents.emit('task-updated', task)

  if (task.status === 'cancelled') return

  // ── Stage 3: Validating ──
  task.currentStage = 'validating'
  saveTasks()
  orchestratorEvents.emit('task-updated', task)
  console.log(`[orchestrator] Task ${task.id} — stage: validating`)

  const valStart = Date.now()
  const valResult = await runStage(
    task,
    agent.config.id,
    'validating',
    buildValidatePrompt(task, task.planOutput!, execResult.output),
  )
  task.stageResults!.push({
    stage: 'validating',
    success: valResult.success,
    output: valResult.output.slice(0, 4000),
    durationMs: valResult.durationMs,
    provider: valResult.provider,
    startedAt: valStart,
    completedAt: Date.now(),
  })

  task.validateOutput = valResult.output

  // Check for PASS/FAIL in validation output.
  // The validator may output "PASS", "**PASS**", "passes", "Result: PASS", etc.
  // Fail only if there's an explicit FAIL signal; otherwise trust exit code + content.
  const output = valResult.output.toLowerCase()
  const hasExplicitFail = /\bfail\b/.test(output) && !/\bno\s+fail/.test(output)
  const hasExplicitPass = /\bpass\b/.test(output)
  const passed = valResult.success && (hasExplicitPass || !hasExplicitFail)

  if (passed) {
    task.status = 'completed'
    task.currentStage = 'done'
    task.completedAt = Date.now()
    task.result = execResult.output.slice(0, 2000)
    const totalDuration = task.stageResults!.reduce((sum, s) => sum + s.durationMs, 0)
    console.log(`[orchestrator] Task ${task.id} completed (${Math.round(totalDuration / 1000)}s total)`)

    if (task.assignedAgent) {
      const xpEarned = calculateTaskXP(task)
      const newXP = awardXP(task.assignedAgent, xpEarned, 'completed')
      const creditsEarned = PRIORITY_CREDITS[task.priority] ?? 50
      const newCredits = awardCredits(task.assignedAgent, creditsEarned)
      orchestratorEvents.emit('xp-awarded', { agentId: task.assignedAgent, xp: newXP, credits: newCredits })
      orchestratorEvents.emit('task-completed', {
        taskId: task.id,
        agentId: task.assignedAgent,
        priority: task.priority,
        durationMs: totalDuration,
        completedAt: task.completedAt,
      })
    }
  } else {
    handleStageFailure(task, 'validating', valResult.output ? 'Validation returned FAIL' : 'Validation failed')
  }

  saveTasks()
  orchestratorEvents.emit('task-updated', task)
}

async function monitorActiveTasks(): Promise<void> {
  const activeTasks = tasks.filter(t => t.status === 'active')

  for (const task of activeTasks) {
    if (!task.assignedSessionId) continue

    try {
      const analysis = analyzeSession(task.assignedSessionId)

      // Agent completed the task (idle at prompt)
      // Skip if task was assigned less than 15s ago — agent may not have started yet
      const activeFor = task.assignedAt ? Date.now() - task.assignedAt : 0
      if (activeFor > 15_000 && (analysis.mode === 'idle' || analysis.interactionType === 'idle-prompt')) {
        task.status = 'completed'
        task.completedAt = Date.now()
        task.result = 'Task completed'
        const durationMs = task.assignedAt ? Math.max(0, task.completedAt - task.assignedAt) : 0
        
        // Award XP for completed task
        if (task.assignedAgent) {
          const xpEarned = calculateTaskXP(task)
          const newXP = awardXP(task.assignedAgent, xpEarned, 'completed')
          orchestratorEvents.emit('xp-awarded', { agentId: task.assignedAgent, xp: newXP })
          orchestratorEvents.emit('task-completed', {
            taskId: task.id,
            agentId: task.assignedAgent,
            priority: task.priority,
            durationMs,
            completedAt: task.completedAt,
          })
        }
        
        saveTasks()
        orchestratorEvents.emit('task-updated', task)
        console.log(`[orchestrator] Task ${task.id} completed`)
        continue
      }

      // Check if agent process is dead
      if (task.assignedAgent) {
        const savedMap = loadAgentSessionMap()
        const saved = savedMap[task.assignedAgent]
        if (saved && saved.pid > 0 && !isProcessAlive(saved.pid)) {
          console.log(`[orchestrator] Agent ${task.assignedAgent} process dead for task ${task.id}`)
          removeAgentSession(task.assignedAgent)

          if (task.retryCount < task.maxRetries) {
            task.status = 'queued'
            task.assignedAgent = undefined
            task.assignedSessionId = undefined
            task.assignedAt = undefined
            task.retryCount += 1
            task.error = 'Agent process died — re-queuing'
            saveTasks()
            orchestratorEvents.emit('task-updated', task)
          } else {
            task.status = 'failed'
            task.error = 'Agent process died and max retries exhausted'
            task.completedAt = Date.now()
            const failedAgentId = task.assignedAgent
            const durationMs = task.assignedAt ? Math.max(0, task.completedAt - task.assignedAt) : 0
            
            // Award XP penalty for failed task
            if (failedAgentId) {
              const newXP = awardXP(failedAgentId, -25, 'failed')
              orchestratorEvents.emit('xp-awarded', { agentId: failedAgentId, xp: newXP })
              orchestratorEvents.emit('task-failed', {
                taskId: task.id,
                agentId: failedAgentId,
                priority: task.priority,
                durationMs,
                completedAt: task.completedAt,
              })
            }
            
            saveTasks()
            orchestratorEvents.emit('task-updated', task)
          }
          continue
        }
      }

      // Stuck detection: active for 30+ min with tool-approval for extended time
      if (task.assignedAt) {
        const activeMs = Date.now() - task.assignedAt
        if (activeMs > STUCK_THRESHOLD_MS && analysis.interactionType === 'tool-approval') {
          orchestratorEvents.emit('task-warning', {
            task,
            warning: `Task stuck for ${Math.round(activeMs / 60_000)}min waiting for tool approval`,
          })
        }
      }
    } catch (err) {
      console.error(`[orchestrator] Monitor error for task ${task.id}:`, err)
    }
  }
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

// ── Health Monitor ──────────────────────────────────────────────────────────

export async function getAgentHealthStatuses(): Promise<AgentHealthStatus[]> {
  const configs = getAgentConfigs()
  const sessions = await getClaudeSessions()
  const savedMap = loadAgentSessionMap()
  const results: AgentHealthStatus[] = []

  for (const config of configs) {
    const saved = savedMap[config.id]
    const session = sessions.find(s => {
      if (saved && saved.pid > 0) return s.pid === saved.pid
      if (config.defaultRepos.length > 0) {
        return config.defaultRepos.some(repo => s.cwd === repo)
      }
      return false
    })

    const activeTasks = tasks.filter(
      t => t.assignedAgent === config.id && (t.status === 'assigned' || t.status === 'active'),
    ).length

    const warnings: string[] = []
    let alive = false
    let status: AgentHealthStatus['status'] = 'dead'

    if (session) {
      alive = true
      status = 'healthy'

      if (session.memoryMB && session.memoryMB > MEMORY_WARNING_MB) {
        warnings.push(`High memory usage: ${session.memoryMB}MB`)
        status = 'warning'
      }

      // Check for stuck tool approval
      const analysis = analyzeSession(session.sessionId)
      if (analysis.interactionType === 'tool-approval') {
        warnings.push('Waiting for tool approval')
        status = 'warning'
      }
    } else if (saved && saved.pid > 0) {
      // Has a saved session but no live process
      alive = isProcessAlive(saved.pid)
      if (!alive) {
        status = 'dead'
        warnings.push('Process not found — session stale')
      }
    }

    results.push({
      agentId: config.id,
      name: config.name,
      alive,
      pid: session?.pid || saved?.pid,
      memoryMB: session?.memoryMB,
      cpu: session?.cpu,
      uptime: session?.uptime,
      activeTasks,
      status,
      warnings,
    })
  }

  return results
}

async function healthMonitorLoop(): Promise<void> {
  const configs = getAgentConfigs()
  const savedMap = loadAgentSessionMap()
  let dirty = false

  // Dead agent detection + cleanup for agents with NO active tasks
  // (agents with active tasks are handled by monitorActiveTasks in the dispatch loop)
  for (const config of configs) {
    const saved = savedMap[config.id]
    if (!saved || saved.pid <= 0) continue

    if (!isProcessAlive(saved.pid)) {
      const hasActiveTasks = tasks.some(
        t => t.assignedAgent === config.id && (t.status === 'assigned' || t.status === 'active'),
      )
      // Skip if dispatch loop's monitorActiveTasks will handle this agent
      if (hasActiveTasks) continue

      console.log(`[orchestrator] Dead agent detected (no active tasks): ${config.id} (pid ${saved.pid})`)
      removeAgentSession(config.id)
      dirty = true
    }
  }

  if (dirty) saveTasks()
}

// ── Graceful Agent Shutdown ─────────────────────────────────────────────────

export async function shutdownAgent(agentId: string): Promise<{ success: boolean; error?: string }> {
  const sessions = await getClaudeSessions()
  const savedMap = loadAgentSessionMap()
  const saved = savedMap[agentId]

  const session = sessions.find(s => {
    if (saved && saved.pid > 0) return s.pid === saved.pid
    const config = getAgentConfig(agentId)
    if (config?.defaultRepos.length) {
      return config.defaultRepos.some(repo => s.cwd === repo)
    }
    return false
  })

  if (!session) {
    return { success: false, error: 'No active session found' }
  }

  // Send /exit command
  if (session.tty) {
    await sendToSession(session.tty, '/exit')
  }

  // Wait up to 15s for graceful shutdown
  for (let i = 0; i < 5; i++) {
    await new Promise(r => setTimeout(r, 3000))
    if (!isProcessAlive(session.pid)) {
      removeAgentSession(agentId)
      return { success: true }
    }
  }

  // Force kill
  try {
    process.kill(session.pid, 'SIGTERM')
    await new Promise(r => setTimeout(r, 2000))
    removeAgentSession(agentId)
    return { success: true }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

// ── Stats ───────────────────────────────────────────────────────────────────

export function getOrchestratorStats(): OrchestratorStats {
  const todayStart = new Date().setHours(0, 0, 0, 0)

  return {
    queueDepth: tasks.filter(t => t.status === 'queued').length,
    activeTasks: tasks.filter(t => t.status === 'assigned' || t.status === 'active').length,
    completedToday: tasks.filter(
      t => t.status === 'completed' && t.completedAt && t.completedAt >= todayStart,
    ).length,
    failedToday: tasks.filter(
      t => t.status === 'failed' && t.completedAt && t.completedAt >= todayStart,
    ).length,
    totalProcessed: tasks.filter(
      t => t.status === 'completed' || t.status === 'failed' || t.status === 'cancelled',
    ).length,
  }
}

// ── Start / Stop ────────────────────────────────────────────────────────────

export function startOrchestrator(): void {
  if (dispatchTimer) return
  console.log('[orchestrator] Starting dispatch loop (10s) and health monitor (30s)')
  dispatchTimer = setInterval(() => { dispatchLoop().catch(console.error) }, DISPATCH_INTERVAL)
  healthTimer = setInterval(() => { healthMonitorLoop().catch(console.error) }, HEALTH_INTERVAL)

  // Start GitHub issue poller alongside the dispatch loop
  import('./github-issues').then(m => m.startGithubIssuePoller()).catch(console.error)
}

export function stopOrchestrator(): void {
  if (dispatchTimer) {
    clearInterval(dispatchTimer)
    dispatchTimer = null
  }
  if (healthTimer) {
    clearInterval(healthTimer)
    healthTimer = null
  }

  // Stop GitHub issue poller
  import('./github-issues').then(m => m.stopGithubIssuePoller()).catch(console.error)

  console.log('[orchestrator] Stopped')
}
