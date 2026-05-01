/**
 * dispatch-queue — Pure task state, queue operations, XP, credits
 *
 * ZERO side effects at import time. All filesystem access is lazy
 * (first call to a getter triggers the load). This makes the module
 * safe to import in tests without triggering timers, subprocesses, or
 * filesystem I/O.
 */

import { EventEmitter } from 'events'
import fs from 'fs'
import path from 'path'
import { atomicWrite } from './atomic-store'
import { getDataDir } from './data-paths'
import {
  migratePersistedProject,
  normalizeEnqueueProject,
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

// ── XP Types ────────────────────────────────────────────────────────────────

export interface AgentXP {
  totalXP: number
  level: number
  rank: string
  tasksCompleted: number
  tasksFailed: number
  currentStreak: number
}

interface CreditData {
  balance: number
  totalEarned: number
}

// ── Events ──────────────────────────────────────────────────────────────────

export const orchestratorEvents = new EventEmitter()

// ── Constants ───────────────────────────────────────────────────────────────

export const PRIORITY_ORDER: Record<TaskPriority, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
}

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
export const PRIORITY_CREDITS: Record<string, number> = { critical: 150, high: 75, normal: 50, low: 25 }

// ── Lazy Data Dir ───────────────────────────────────────────────────────────

let _dataDir: string | null = null

function lazyDataDir(): string {
  if (!_dataDir) _dataDir = getDataDir()
  return _dataDir
}

// ── Lazy Task Persistence ───────────────────────────────────────────────────

let _tasks: Task[] | null = null
let _tasksLoaded = false

function loadTasks(): Task[] {
  const persistPath = path.join(lazyDataDir(), 'task-queue.json')
  try {
    if (fs.existsSync(persistPath)) {
      const raw = JSON.parse(fs.readFileSync(persistPath, 'utf-8')) as Task[]
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

/** Internal access to the tasks array — loads from disk on first call. */
export function getTasksInternal(): Task[] {
  if (!_tasksLoaded) {
    const loaded = loadTasks()
    _tasks = loaded
    _tasksLoaded = true
    console.log(`[orchestrator] Loaded ${loaded.length} tasks from disk`)
  }
  return _tasks!
}

export function saveTasks(): void {
  const persistPath = path.join(lazyDataDir(), 'task-queue.json')
  try {
    atomicWrite(persistPath, getTasksInternal())
  } catch (err) {
    console.error('[orchestrator] Failed to save tasks:', err)
  }
}

// ── Lazy XP Persistence ─────────────────────────────────────────────────────

let _agentXPData: Record<string, AgentXP> | null = null

function loadAgentXP(): Record<string, AgentXP> {
  const xpPath = path.join(lazyDataDir(), 'agent-xp.json')
  try {
    if (fs.existsSync(xpPath)) {
      return JSON.parse(fs.readFileSync(xpPath, 'utf-8'))
    }
  } catch (err) {
    console.error('[orchestrator] Failed to load XP:', err)
  }
  return {}
}

function getXpData(): Record<string, AgentXP> {
  if (!_agentXPData) _agentXPData = loadAgentXP()
  return _agentXPData
}

function saveAgentXP(xpData: Record<string, AgentXP>): void {
  const xpPath = path.join(lazyDataDir(), 'agent-xp.json')
  try {
    atomicWrite(xpPath, xpData)
  } catch (err) {
    console.error('[orchestrator] Failed to save XP:', err)
  }
}

// ── Lazy Credits Persistence ────────────────────────────────────────────────

let _creditData: Record<string, CreditData> | null = null

function loadCredits(): Record<string, CreditData> {
  const creditPath = path.join(lazyDataDir(), 'agent-credits.json')
  try {
    if (fs.existsSync(creditPath)) {
      return JSON.parse(fs.readFileSync(creditPath, 'utf-8'))
    }
  } catch (err) {
    console.error('[orchestrator] Failed to load credits:', err)
  }
  return {}
}

function getCreditData(): Record<string, CreditData> {
  if (!_creditData) _creditData = loadCredits()
  return _creditData
}

function saveCredits(): void {
  const creditPath = path.join(lazyDataDir(), 'agent-credits.json')
  try {
    atomicWrite(creditPath, getCreditData())
  } catch (err) {
    console.error('[orchestrator] Failed to save credits:', err)
  }
}

// ── XP System ───────────────────────────────────────────────────────────────

function getRankForXP(xp: number): { level: number; title: string } {
  for (let i = XP_RANKS.length - 1; i >= 0; i--) {
    if (xp >= XP_RANKS[i].minXP) {
      return { level: XP_RANKS[i].level, title: XP_RANKS[i].title }
    }
  }
  return { level: 1, title: 'Intern' }
}

export function calculateTaskXP(task: Task): number {
  const baseXP = task.status === 'completed' ? PRIORITY_XP[task.priority] : -25
  return baseXP
}

export function awardXP(agentId: string, xp: number, taskStatus: 'completed' | 'failed'): AgentXP {
  const xpData = getXpData()
  let data = xpData[agentId]
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

  xpData[agentId] = data
  saveAgentXP(xpData)

  return data
}

export function getAgentXP(agentId: string): AgentXP | null {
  return getXpData()[agentId] || null
}

export function getAllAgentXP(): Record<string, AgentXP> {
  return { ...getXpData() }
}

// ── Credits System ──────────────────────────────────────────────────────────

export function awardCredits(agentId: string, credits: number): CreditData {
  const cd = getCreditData()
  let data = cd[agentId]
  if (!data) data = { balance: 0, totalEarned: 0 }
  data.balance += credits
  data.totalEarned += credits
  cd[agentId] = data
  saveCredits()
  return data
}

export function getAgentCredits(agentId: string): CreditData | null {
  return getCreditData()[agentId] || null
}

export function getAllAgentCredits(): Record<string, CreditData> {
  return { ...getCreditData() }
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
  const tasks = getTasksInternal()
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
  return [...getTasksInternal()].sort((a, b) => b.createdAt - a.createdAt)
}

export function getTask(taskId: string): Task | undefined {
  return getTasksInternal().find(t => t.id === taskId)
}

export function cancelTask(taskId: string): boolean {
  const tasks = getTasksInternal()
  const task = tasks.find(t => t.id === taskId)
  if (!task || task.status === 'completed' || task.status === 'cancelled') return false
  task.status = 'cancelled'
  task.completedAt = Date.now()
  saveTasks()
  orchestratorEvents.emit('task-updated', task)
  return true
}

export function retryTask(taskId: string): boolean {
  const tasks = getTasksInternal()
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
  const tasks = getTasksInternal()
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

// ── Stats ───────────────────────────────────────────────────────────────────

export function getOrchestratorStats(): OrchestratorStats {
  const tasks = getTasksInternal()
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

// ── Pull-Model Claim API ─────────────────────────────────────────────────────

export function claimTask(agentId: string, taskId: string): Task | null {
  const task = getTasksInternal().find(t => t.id === taskId)
  if (!task || task.status !== 'queued') return null
  task.status = 'assigned'
  task.assignedAgent = agentId
  task.assignedAt = Date.now()
  saveTasks()
  orchestratorEvents.emit('task-claimed', task)
  return task
}

export function releaseTask(taskId: string, reason?: string): boolean {
  const task = getTasksInternal().find(t => t.id === taskId)
  if (!task) return false
  if (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') return false
  task.status = 'queued'
  task.assignedAgent = undefined
  task.assignedSessionId = undefined
  task.assignedAt = undefined
  if (reason) task.error = reason
  saveTasks()
  orchestratorEvents.emit('task-released', task)
  return true
}

export function claimNextTask(
  agentId: string,
  filter?: { project?: string; priority?: TaskPriority },
): Task | null {
  let queued = getTasksInternal()
    .filter(t => t.status === 'queued')

  if (filter?.project) {
    queued = queued.filter(t => t.project === filter.project)
  }

  if (filter?.priority) {
    const maxOrder = PRIORITY_ORDER[filter.priority]
    queued = queued.filter(t => PRIORITY_ORDER[t.priority] <= maxOrder)
  }

  // Sort by priority (critical first), then by createdAt (oldest first)
  queued.sort((a, b) => {
    const pDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
    if (pDiff !== 0) return pDiff
    return a.createdAt - b.createdAt
  })

  if (queued.length === 0) return null
  return claimTask(agentId, queued[0].id)
}

// ── Test Reset ──────────────────────────────────────────────────────────────

/** Reset all lazy state — for tests only. */
export function resetForTest(): void {
  if (_tasks) _tasks.length = 0
  _tasks = null
  _tasksLoaded = false
  _agentXPData = null
  _creditData = null
  _dataDir = null
  taskCounter = 0
  currentProvider = 'claude'
  orchestratorEvents.removeAllListeners()
}
