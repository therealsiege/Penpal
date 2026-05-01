/**
 * dispatch-loop — Timer-based dispatch, stage runner, health monitor
 *
 * Contains ALL side effects: setInterval timers, subprocess spawns via
 * sessions/agents, and process management. Imports task state from
 * dispatch-queue.ts.
 */

import {
  getTasksInternal,
  saveTasks,
  orchestratorEvents,
  calculateTaskXP,
  awardXP,
  awardCredits,
  getModelProvider,
  PRIORITY_ORDER,
  PRIORITY_CREDITS,
  type Task,
  type TaskStage,
  type ModelProvider,
  type StageResultProvider,
  type AgentHealthStatus,
} from './dispatch-queue'
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
import { resolveProjectPath, pathsReferToSameRepo } from './project-paths'

// ── Constants ───────────────────────────────────────────────────────────────

const DISPATCH_INTERVAL = 10_000   // 10s
const HEALTH_INTERVAL = 30_000     // 30s
const STUCK_THRESHOLD_MS = 30 * 60_000  // 30 min
const MEMORY_WARNING_MB = 2048

// ── State ───────────────────────────────────────────────────────────────────

let dispatchTimer: ReturnType<typeof setInterval> | null = null
let healthTimer: ReturnType<typeof setInterval> | null = null

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
  const provider = task.provider ?? getModelProvider()

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

// ── Agent Selection Algorithm ───────────────────────────────────────────────

export interface ScoredAgent {
  config: AgentConfig
  session?: ClaudeSession
  score: number
}

function scoreAgent(task: Task, config: AgentConfig, session: ClaudeSession | undefined): number {
  const tasks = getTasksInternal()
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

export async function dispatchLoop(): Promise<void> {
  const tasks = getTasksInternal()
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

export function handleStageFailure(task: Task, stage: TaskStage, error: string): void {
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

export async function dispatchTask(task: Task, agent: ScoredAgent): Promise<void> {
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
  const tasks = getTasksInternal()
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
  const tasks = getTasksInternal()
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
  const tasks = getTasksInternal()
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

// ── Start / Stop ────────────────────────────────────────────────────────────

export function startOrchestrator(): void {
  if (dispatchTimer) return
  console.log('[orchestrator] Starting dispatch loop (10s) and health monitor (30s)')
  dispatchTimer = setInterval(() => { dispatchLoop().catch(console.error) }, DISPATCH_INTERVAL)
  healthTimer = setInterval(() => { healthMonitorLoop().catch(console.error) }, HEALTH_INTERVAL)

  // Start GitHub issue poller alongside the dispatch loop
  import('./github-issues').then(m => m.startGithubIssuePoller()).catch(console.error)
  if (process.env.LINEAR_API_KEY) {
    import('./linear-poller').then(m => m.startLinearPoller()).catch(console.error)
  }
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

  // Stop issue pollers
  import('./github-issues').then(m => m.stopGithubIssuePoller()).catch(console.error)
  import('./linear-poller').then(m => m.stopLinearPoller()).catch(console.error)

  console.log('[orchestrator] Stopped')
}

/**
 * Reset ALL module-level state for test isolation.
 * Call in afterEach() to prevent cross-test leaks.
 */
export function _resetForTest(): void {
  stopOrchestrator()
  activeDispatches.clear()
}
