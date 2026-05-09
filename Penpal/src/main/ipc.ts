import { ipcMain, shell, dialog, BrowserWindow } from 'electron'
import { EventEmitter } from 'events'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { checkHealth } from './health'
import { startSlackBridge, stopSlackBridge, isSlackBridgeRunning, getFleetStatus } from './slack-bridge'
import { getJobStatuses, getJobHistory, forceRunJob } from './scheduler-bridge'
import {
  getClaudeSessions,
  getSessionConversation,
  sendToSession,
  focusSession,
  focusByName,
  createNewSession,
  createAgentSession,
  broadcastToSessions,
  getOpenClawInfo,
  getITermStatus,
} from './sessions'
import {
  getCursorAgentSessions,
  getCursorTranscriptConversation,
  focusCursorIDE,
} from './cursor-sessions'
import { getOpencodeSessions } from './opencode-sessions'
import {
  getAgentConfigs,
  getAgentConfig,
  loadAgentSessionMap,
  removeAgentSession,
  type AgentConfig,
  type AgentState,
} from './agents'
import {
  createPod,
  listPods,
  getPodStatus,
  pausePod,
  resumePod,
  cancelPod,
  getPodPresets,
  overridePod,
  getAllProfiles,
  saveProfile,
  deleteProfile,
  setDefaultProfile,
  getPodLogs,
  type CreatePodOpts,
  type RuntimeProfile,
  type PodLogLine,
} from './pods'
import { getActiveEntries, getFilesInFlight } from './flight-board'
import { getSessionReplayRecorder } from './session-replay'
import {
  addScheduledTask,
  removeScheduledTask,
  toggleScheduledTask,
  getAutopilotStatus,
  startAutopilot,
  stopAutopilot,
  loadAutopilotConfig,
} from './autopilot'

function parsePodCreateOpts(opts: unknown): CreatePodOpts {
  const raw = opts && typeof opts === 'object' && !Array.isArray(opts) ? (opts as Record<string, unknown>) : {}
  const out: CreatePodOpts = {}

  if (typeof raw.name === 'string') out.name = raw.name
  if (typeof raw.cwd === 'string') out.cwd = raw.cwd
  if (typeof raw.maxIterations === 'number' && Number.isInteger(raw.maxIterations) && raw.maxIterations > 0) {
    out.maxIterations = raw.maxIterations
  }
  if (typeof raw.presetId === 'string') out.presetId = raw.presetId
  if (typeof raw.solverAgent === 'string') out.solverAgent = raw.solverAgent
  if (typeof raw.reviewerAgent === 'string') out.reviewerAgent = raw.reviewerAgent
  if (typeof raw.executorAgent === 'string') out.executorAgent = raw.executorAgent

  if (raw.priority !== undefined) {
    if (typeof raw.priority !== 'string') throw new Error('priority must be a string')
    out.priority = raw.priority
  }

  if (
    typeof raw.solverCandidates === 'number' &&
    Number.isInteger(raw.solverCandidates) &&
    raw.solverCandidates > 0
  ) {
    out.solverCandidates = raw.solverCandidates
  }
  if (
    typeof raw.maxSelfFixes === 'number' &&
    Number.isInteger(raw.maxSelfFixes) &&
    raw.maxSelfFixes >= 0
  ) {
    out.maxSelfFixes = raw.maxSelfFixes
  }

  if (typeof raw.runtimeProfile === 'string') out.runtimeProfile = raw.runtimeProfile

  return out
}
import {
  enqueueTask,
  getTaskQueue,
  cancelTask,
  retryTask,
  getAgentHealthStatuses,
  shutdownAgent,
  getOrchestratorStats,
  getAllAgentXP,
  setModelProvider,
  getModelProvider,
  type AgentXP,
  type ModelProvider,
} from './orchestrator'
import { checkOllamaAvailable } from './ollama-client'
import { resolveProjectPath } from './project-paths'
import {
  getGithubIssuePollerStatus,
  pollGithubIssuesNow,
  getSeenIssues,
  getGithubIssueCards,
  addWatchedRepo,
  removeWatchedRepo,
  getWatchedRepos,
} from './github-issues'
import { getPipelineIssues, requestPipelineRetry, sweepMergedPRs } from './github-pipeline'
import { getWebhookStatus } from './webhook-server'
import { getEvalReportAll, getEvalReportAgent, getEvalStats } from './evals'
import { taskOutcomeCollector } from './evals/collectors/task-outcomes'
import { podQualityCollector } from './evals/collectors/pod-quality'
import { podComboCollector } from './evals/collectors/pod-combos'
import { podEvents } from './pods'
import { evalHarness } from './evals/harness'
import { generateWeeklyDigest } from './evals/reports/weekly-digest'
import { contextMonitor } from './evals/collectors/context-usage'
import { spotCheckQueue } from './evals/judges/human-judge'
import { getSystemPaths } from './paths'
import {
  getConfigSnapshot,
  addProjectMcpServer,
  removeProjectMcpServer,
  addProfileMcpServer,
  removeProfileMcpServer,
  updateAgentTools,
} from './config-reader'
import {
  loadGovernanceConfig,
  saveGovernanceConfig,
  type GovernanceConfig,
} from './pod-governance'
import type { PreferenceStore } from './preferences'
import { contextResponse } from './context-response'
import { getDataDir } from './data-paths'
import { reasoningBank } from './reasoning-bank'

export const ipcEvents = new EventEmitter()

const DATA_DIR = getDataDir()
const DPO_PAIRS_FILENAME = 'dpo-pairs.jsonl'

function resolveDataExportPath(fileName: string): string {
  const dataDir = path.resolve(DATA_DIR)
  const safeName = path.basename(fileName)
  if (safeName !== fileName) {
    throw new Error(`Invalid export filename: ${fileName}`)
  }
  if (path.extname(safeName).toLowerCase() !== '.jsonl') {
    throw new Error('DPO export file must use .jsonl extension')
  }
  const outPath = path.resolve(dataDir, safeName)
  const relative = path.relative(dataDir, outPath)
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Invalid export path outside data directory: ${outPath}`)
  }
  return outPath
}

function ageBucket(ms: number | null): string {
  if (ms === null || ms <= 0) return 'none'
  const minutes = Math.floor(ms / 60000)
  if (minutes < 15) return '<15m'
  if (minutes < 60) return '15-60m'
  if (minutes < 240) return '1-4h'
  return '>4h'
}


function wrapHandler<T>(fn: (...args: unknown[]) => Promise<T> | T) {
  return async (_event: Electron.IpcMainInvokeEvent, ...args: unknown[]) => {
    try {
      return await fn(...args)
    } catch (err) {
      return { error: (err as Error).message }
    }
  }
}

export function registerIpcHandlers() {
  ipcMain.handle('health:check', wrapHandler(() => checkHealth()))
  ipcMain.handle('scheduler:status', wrapHandler(() => getJobStatuses()))
  ipcMain.handle('scheduler:history', wrapHandler((jobName?: unknown) =>
    getJobHistory(typeof jobName === 'string' ? jobName : undefined),
  ))
  ipcMain.handle('scheduler:run', wrapHandler((jobName: unknown) => {
    if (typeof jobName !== 'string') throw new Error('jobName must be a string')
    return forceRunJob(jobName)
  }))
  // Context-engineered IPC handlers (issue #11): return ContextEngineeredResponse from main;
  // preload unwrap() strips to `.data` for window.api so React keeps legacy shapes — use *Rich APIs for the full envelope.
  ipcMain.handle('sessions:list', wrapHandler(async () => {
    const [claudeSessions, cursorSessions] = await Promise.all([
      getClaudeSessions(),
      getCursorAgentSessions().catch(() => []),
    ])
    const tagged = claudeSessions.map(s => ({ ...s, source: 'claude' as const }))
    const merged = [...tagged, ...cursorSessions]

    const claudeCount = tagged.length
    const cursorCount = cursorSessions.length
    const activeCount = merged.filter(s => parseFloat((s as { cpu?: string }).cpu || '0') >= 1).length
    const idleCount = merged.length - activeCount
    const waitingForInput = merged.filter(s => (s as { waitingForInput?: boolean }).waitingForInput).map(s => (s as { tty?: string }).tty).filter(Boolean)
    const interactionTypes: Record<string, number> = {}
    for (const s of merged) {
      const iType = (s as { interactionType?: string }).interactionType ?? 'none'
      interactionTypes[iType] = (interactionTypes[iType] || 0) + 1
    }

    const summary = `${merged.length} sessions (${claudeCount} claude, ${cursorCount} cursor) with ${activeCount} active, ${idleCount} idle, and ${waitingForInput.length} waiting for input.`
    const suggestions: string[] = []
    if (waitingForInput.length > 0) suggestions.push(`${waitingForInput.length} session(s) waiting for input — approve via sessions:approve.`)
    if ((interactionTypes['tool-approval'] || 0) > 0) suggestions.push(`${interactionTypes['tool-approval']} approval prompt(s) pending — clear approvals before assigning more work.`)
    if (idleCount > 0) suggestions.push(`${idleCount} idle session(s) — assign work via orchestrator:enqueue.`)
    if (merged.length === 0) suggestions.push('No active sessions — launch agents via agents:launch.')

    return contextResponse(merged, summary, suggestions,
      ['sessions:send', 'sessions:approve', 'agents:statuses', 'orchestrator:queue'],
      { bySource: { claude: claudeCount, cursor: cursorCount }, byActivity: { active: activeCount, idle: idleCount }, interactionTypes, waitingForInput },
    )
  }))
  ipcMain.handle('sessions:conversation', wrapHandler((sessionId: unknown, source?: unknown) => {
    if (typeof sessionId !== 'string') throw new Error('sessionId must be a string')
    if (source === 'cursor') return getCursorTranscriptConversation(sessionId)
    return getSessionConversation(sessionId)
  }))
  ipcMain.handle('sessions:send', wrapHandler((tty: unknown, message: unknown) => {
    if (typeof tty !== 'string' || typeof message !== 'string') throw new Error('tty and message must be strings')
    const result = sendToSession(tty, message)
    ipcEvents.emit('send', { tty, message })
    return result
  }))
  ipcMain.handle('sessions:focus', wrapHandler((tty: unknown) => {
    if (typeof tty !== 'string') throw new Error('tty must be a string')
    return focusSession(tty)
  }))
  ipcMain.handle('sessions:focus-by-name', wrapHandler((name: unknown, cwd?: unknown) => {
    if (typeof name !== 'string') throw new Error('name must be a string')
    return focusByName(name, typeof cwd === 'string' ? cwd : undefined)
  }))
  ipcMain.handle('sessions:create', wrapHandler((cwd: unknown) => {
    if (typeof cwd !== 'string') throw new Error('cwd must be a string')
    return createNewSession(cwd)
  }))
  ipcMain.handle('sessions:broadcast', wrapHandler((message: unknown) => {
    if (typeof message !== 'string') throw new Error('message must be a string')
    return broadcastToSessions(message)
  }))
  // ── Agent Handlers ──────────────────────────────────────────────────────

  ipcMain.handle('agents:list', wrapHandler(() => getAgentConfigs()))

  ipcMain.handle('agents:statuses', wrapHandler(async () => {
    const configs = getAgentConfigs()
    const [sessions, cursorSessions] = await Promise.all([
      getClaudeSessions(),
      getCursorAgentSessions().catch(() => []),
    ])
    const savedMap = loadAgentSessionMap()
    const matchedPids = new Set<number>()
    const agentStates: AgentState[] = []

    // Batch OpenClaw detection for all sessions
    const openclawInfos = await Promise.all(
      sessions.map(s => getOpenClawInfo(s.pid)),
    )
    const openclawByPid = new Map<number, typeof openclawInfos[0]>()
    sessions.forEach((s, i) => openclawByPid.set(s.pid, openclawInfos[i]))

    // Match predefined agents to running sessions — only include if matched
    for (const config of configs) {
      const matched = sessions.find(s => {
        const saved = savedMap[config.id]
        if (saved && saved.pid > 0) {
          return s.pid === saved.pid
        }
        if (config.defaultRepos.length > 0) {
          return config.defaultRepos.some(repo => s.cwd === repo) &&
            !configs.some(other => other.id !== config.id &&
              other.defaultRepos.includes(s.cwd))
        }
        return false
      })

      if (matched) {
        matchedPids.add(matched.pid)
        const cpuVal = parseFloat(matched.cpu || '0')
        const iType = matched.interactionType ?? 'none'
        const needsInteraction = cpuVal < 1 &&
          (iType === 'tool-approval' || iType === 'question' || iType === 'accept-edits')
        const oc = openclawByPid.get(matched.pid)
        agentStates.push({
          config,
          status: (cpuVal >= 1 ? 'active' : 'idle') as AgentState['status'],
          needsInteraction,
          sessionMode: matched.sessionMode,
          interactionType: iType,
          sessionId: matched.sessionId,
          pid: matched.pid,
          tty: matched.tty,
          cpu: matched.cpu,
          memoryMB: matched.memoryMB,
          uptime: matched.uptime,
          lastUserMessage: matched.lastUserMessage,
          lastAssistantBlurb: matched.lastAssistantBlurb,
          cwd: matched.cwd,
          subAgentInvocations: matched.subAgentInvocations,
          openclaw: oc?.supervised ? oc : undefined,
          parseErrors: matched.parseErrors,
          lastError: matched.lastError,
          contextUtilization: matched.contextUtilization,
          contextRotDetected: matched.contextRotDetected,
        })
      }
    }

    // Surface unmatched running sessions as freelancers
    for (const session of sessions) {
      if (matchedPids.has(session.pid)) continue

      const projectName = session.project || session.cwd.split('/').pop() || 'unknown'
      const cpuVal = parseFloat(session.cpu || '0')
      const iType = session.interactionType ?? 'none'
      const oc = openclawByPid.get(session.pid)
      const freelancerConfig: AgentConfig = {
        id: `session-${session.pid}`,
        name: session.terminalName || projectName,
        systemPrompt: '',
        model: 'unknown',
        mcpProfile: '',
        skills: [],
        allowedTools: [],
        subAgents: {},
        defaultRepos: [session.cwd],
        avatar: 'fullstack',
        desk: { row: 0, col: 0 },
        autonomy: 'unknown',
      }

      agentStates.push({
        config: freelancerConfig,
        status: (cpuVal >= 1 ? 'active' : 'idle') as AgentState['status'],
        needsInteraction: cpuVal < 1 &&
          (iType === 'tool-approval' || iType === 'question' || iType === 'accept-edits'),
        sessionMode: session.sessionMode,
        interactionType: iType,
        sessionId: session.sessionId,
        pid: session.pid,
        tty: session.tty,
        cpu: session.cpu,
        memoryMB: session.memoryMB,
        uptime: session.uptime,
        lastUserMessage: session.lastUserMessage,
        lastAssistantBlurb: session.lastAssistantBlurb,
        cwd: session.cwd,
        subAgentInvocations: session.subAgentInvocations,
        openclaw: oc?.supervised ? oc : undefined,
        parseErrors: session.parseErrors,
        lastError: session.lastError,
        contextUtilization: session.contextUtilization,
        contextRotDetected: session.contextRotDetected,
      })
    }

    // Surface Cursor agent sessions as freelancers
    for (const cs of cursorSessions) {
      const projectName = cs.project || cs.cwd.split('/').pop() || 'unknown'
      const cpuVal = parseFloat(cs.cpu || '0')
      const iType = cs.interactionType ?? 'none'
      const cursorConfig: AgentConfig = {
        id: `cursor-${cs.pid}`,
        name: `Cursor: ${projectName}`,
        title: `Cursor Agent`,
        podRole: 'solver',
        systemPrompt: '',
        model: 'cursor-agent',
        mcpProfile: '',
        skills: [],
        allowedTools: [],
        subAgents: {},
        defaultRepos: [cs.cwd],
        avatar: 'cursor',
        desk: { row: 0, col: 0 },
        autonomy: 'unknown',
      }

      agentStates.push({
        config: cursorConfig,
        status: (cpuVal >= 1 ? 'active' : 'idle') as AgentState['status'],
        needsInteraction: cpuVal < 1 &&
          (iType === 'tool-approval' || iType === 'question' || iType === 'accept-edits'),
        sessionMode: cs.sessionMode,
        interactionType: iType,
        sessionId: cs.sessionId,
        pid: cs.pid,
        tty: cs.tty,
        cpu: cs.cpu,
        memoryMB: cs.memoryMB,
        uptime: cs.uptime,
        lastUserMessage: cs.lastUserMessage,
        lastAssistantBlurb: cs.lastAssistantBlurb,
        cwd: cs.cwd,
        subAgentInvocations: [],
      })
    }

    // ── Build sub-agents from active invocations ──
    // Async sub-agents (run_in_background: true) do NOT get their own session files
    // in ~/.claude/sessions/. They run as background tasks within the parent process,
    // streaming progress into the parent's JSONL as type:"progress"/agent_progress
    // entries. Completion arrives via queue-operation or task-notification XML.
    //
    // We synthesize virtual AgentState objects directly from the active invocations
    // rather than trying to timestamp-match against non-existent child session files.

    for (const parent of agentStates) {
      const invocations = parent.subAgentInvocations
      if (!invocations || invocations.length === 0) continue

      const activeInvocations = invocations.filter(inv => inv.status === 'active')
      if (activeInvocations.length === 0) continue

      const children: AgentState[] = activeInvocations.map((inv, idx) => {
        const subId = `subagent-${parent.config.id}-${idx}`
        const subName = inv.description.length > 30
          ? inv.description.slice(0, 29) + '..'
          : inv.description
        const subConfig: AgentConfig = {
          id: subId,
          name: subName,
          systemPrompt: '',
          model: 'unknown',
          mcpProfile: '',
          skills: [],
          allowedTools: [],
          subAgents: {},
          defaultRepos: parent.config.defaultRepos,
          avatar: parent.config.avatar,
          desk: parent.config.desk,
          autonomy: 'unknown',
        }
        return {
          config: subConfig,
          status: 'active' as AgentState['status'],
          needsInteraction: false,
          sessionMode: 'working' as const,
          cwd: parent.cwd,
          isSubAgent: true,
          parentAgentId: parent.config.id,
        }
      })

      if (children.length > 0) {
        parent.subAgents = children
      }
    }

    // ── Surface active orchestrator tasks as synthetic agents ──
    // Headless tasks spawned by runAgentHeadless() don't create session files,
    // so they're invisible to getClaudeSessions(). Synthesize AgentState entries
    // so they appear in the office scene.
    const visibleAgentIds = new Set(agentStates.map(a => a.config.id))
    const activeTasks = getTaskQueue().filter(
      t => t.status === 'active' && t.currentStage && t.currentStage !== 'queued' && t.currentStage !== 'done',
    )
    for (const task of activeTasks) {
      // Skip if the assigned agent already has a visible session
      if (task.assignedAgent && visibleAgentIds.has(task.assignedAgent)) continue

      const taskName = task.title.length > 30 ? task.title.slice(0, 29) + '..' : task.title
      const taskStage = task.currentStage as 'planning' | 'executing' | 'validating'
      const taskConfig: AgentConfig = {
        id: `orch-task-${task.id}`,
        name: taskName,
        title: `Task: ${taskStage}`,
        podRole: 'executor',
        systemPrompt: '',
        model: 'orchestrator-task',
        mcpProfile: '',
        skills: task.requiredSkills || [],
        allowedTools: [],
        subAgents: {},
        defaultRepos: task.project ? [resolveProjectPath(task.project)] : [],
        avatar: 'orchestrator',
        desk: { row: 0, col: 0 },
        autonomy: 'headless',
      }
      agentStates.push({
        config: taskConfig,
        status: 'active',
        needsInteraction: false,
        sessionMode: taskStage === 'planning' ? 'plan' : 'working',
        cwd: task.project ? resolveProjectPath(task.project) : undefined,
        isOrchestratorTask: true,
        taskStage,
        taskTitle: task.title,
      })
    }

    // ── Surface active pod pipeline issues as synthetic agents ──
    const pipelineIssues = getPipelineIssues().filter(
      p => p.stage === 'executing',
    )
    for (const pi of pipelineIssues) {
      const piName = pi.title.length > 25 ? pi.title.slice(0, 24) + '..' : pi.title
      const podStage = pi.lastPodStatus || 'executing'
      const piConfig: AgentConfig = {
        id: `pipeline-${pi.repo.replace('/', '-')}-${pi.number}`,
        name: piName,
        title: `Pod (${podStage})`,
        podRole: 'solver',
        systemPrompt: '',
        model: 'orchestrator-task',
        mcpProfile: '',
        skills: [],
        allowedTools: [],
        subAgents: {},
        defaultRepos: [],
        avatar: 'orchestrator',
        desk: { row: 0, col: 0 },
        autonomy: 'headless',
      }
      agentStates.push({
        config: piConfig,
        status: 'active',
        needsInteraction: false,
        sessionMode: 'working',
        cwd: undefined,
        isOrchestratorTask: true,
        taskStage: 'executing',
        taskTitle: `[${pi.repo.split('/')[1]}#${pi.number}] ${pi.title}`,
      })
    }

    // No sub-agents to remove from top-level (they are synthetic, not real sessions)
    const topLevel = agentStates

    // Context-engineer the response
    const activeCount = topLevel.filter(a => a.status === 'active').length
    const idleCount = topLevel.filter(a => a.status === 'idle').length
    const blockedIds = topLevel.filter(a => a.needsInteraction).map(a => a.config.id)
    const idleIds = topLevel.filter(a => a.status === 'idle').map(a => a.config.id)
    const totalMemoryMB = topLevel.reduce((sum, a) => sum + (a.memoryMB ?? 0), 0)

    const summary = `${topLevel.length} agents: ${activeCount} busy, ${idleCount} idle, and ${blockedIds.length} blocked waiting for input.`

    const suggestions: string[] = []
    if (blockedIds.length > 0) suggestions.push(`${blockedIds.length} agent(s) need approval — use sessions:approve to unblock.`)
    if (idleCount > 0 && blockedIds.length === 0) suggestions.push(`${idleCount} idle agent(s) available — assign tasks via orchestrator:enqueue.`)
    if (idleCount > 0 && blockedIds.length > 0) suggestions.push(`Resolve blocked agents first, then use ${idleCount} idle agent(s) for queued work.`)
    if (activeCount === topLevel.length && topLevel.length > 0) suggestions.push('All agents busy — monitor via orchestrator:agent-health.')

    return contextResponse(topLevel, summary, suggestions,
      ['orchestrator:queue', 'orchestrator:agent-health', 'pod:list', 'sessions:approve'],
      { breakdown: { busy: activeCount, idle: idleCount, blocked: blockedIds.length }, idle: idleIds, blocked: blockedIds, activeCount, totalMemoryMB },
    )
  }))

  ipcMain.handle('agents:launch', wrapHandler((agentId: unknown, cwd: unknown) => {
    if (typeof agentId !== 'string') throw new Error('agentId must be a string')
    if (typeof cwd !== 'string') throw new Error('cwd must be a string')
    return createAgentSession(agentId, cwd)
  }))

  ipcMain.handle('sessions:approve', wrapHandler(async (tty: unknown, choice: unknown) => {
    if (typeof tty !== 'string') throw new Error('tty must be a string')
    if (typeof choice !== 'string') throw new Error('choice must be a string')
    const allowed = ['1', '2', '3', 'y', 'n', 'yes', 'no']
    if (!allowed.includes(choice.toLowerCase())) throw new Error('Invalid approval choice')
    const result = sendToSession(tty, choice)
    ipcEvents.emit('approve', { tty, choice: choice.toLowerCase() })
    return result
  }))

  ipcMain.handle('sessions:approve-all', wrapHandler(async (choice: unknown) => {
    if (typeof choice !== 'string') throw new Error('choice must be a string')
    const allowed = ['1', '2', '3']
    if (!allowed.includes(choice)) throw new Error('Invalid approval choice')
    const sessions = await getClaudeSessions()
    const waiting = sessions.filter(s => s.waitingForInput && s.tty)
    let sent = 0, failed = 0
    for (const s of waiting) {
      try {
        await sendToSession(s.tty, choice)
        sent++
      } catch { failed++ }
    }
    return { sent, failed }
  }))

  ipcMain.handle('shell:open-url', wrapHandler(async (url: unknown) => {
    if (typeof url !== 'string') throw new Error('url must be a string')
    if (!url.startsWith('https://')) throw new Error('Only https URLs are allowed')
    await shell.openExternal(url)
    return { success: true }
  }))

  ipcMain.handle('shell:open-downloads', wrapHandler(async () => {
    const downloadsPath = path.join(os.homedir(), 'Downloads')
    await shell.openPath(downloadsPath)
    return { success: true }
  }))

  ipcMain.handle('dialog:open-directory', wrapHandler(async () => {
    const win = BrowserWindow.getFocusedWindow()
    const result = await dialog.showOpenDialog(win!, {
      properties: ['openDirectory'],
      title: 'Select Working Directory',
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  }))
  ipcMain.handle('system:paths', wrapHandler(() => getSystemPaths()))

  ipcMain.handle('agents:focus', wrapHandler(async (agentId: unknown) => {
    if (typeof agentId !== 'string') throw new Error('agentId must be a string')
    const configs = getAgentConfigs()
    const sessions = await getClaudeSessions()
    const savedMap = loadAgentSessionMap()
    const config = configs.find(c => c.id === agentId)
    if (!config) throw new Error(`Unknown agent: ${agentId}`)

    const saved = savedMap[agentId]
    const matched = sessions.find(s => {
      if (saved && saved.pid > 0) return s.pid === saved.pid
      if (config.defaultRepos.length > 0) {
        return config.defaultRepos.some(repo => s.cwd === repo)
      }
      return false
    })

    if (matched?.tty) {
      const result = await focusSession(matched.tty)
      if (result.success) return result
      // TTY match failed — fall back to name-based search
      console.log(`[agents:focus] TTY focus failed for ${agentId}, trying name fallback`)
      return focusByName(config.name, matched.cwd)
    }
    return { success: false, error: 'No active session for this agent' }
  }))

  // ── Cursor Agent Handlers ────────────────────────────────────────────
  ipcMain.handle('cursor:focus', wrapHandler(() => focusCursorIDE()))

  // ── Pod Workflow Handlers ──────────────────────────────────────────
  ipcMain.handle('pod:create', wrapHandler((task: unknown, opts: unknown) => {
    if (typeof task !== 'string') throw new Error('task must be a string')
    return createPod(task, parsePodCreateOpts(opts))
  }))

  ipcMain.handle('pod:list', wrapHandler(async () => {
    const pods = await listPods()

    const byPhase: Record<string, number> = {}
    for (const p of pods) {
      byPhase[p.status] = (byPhase[p.status] || 0) + 1
    }
    const phaseStr = Object.entries(byPhase).map(([s, n]) => `${n} ${s}`).join(', ')
    const avgIterations = pods.length > 0 ? +(pods.reduce((sum, p) => sum + p.iteration, 0) / pods.length).toFixed(1) : 0
    const estimatedRemainingMinutes = Math.max(0, Math.round((pods.filter(p => !['complete', 'failed', 'cancelled'].includes(p.status)).length * 12) + (avgIterations * 3)))
    const summary = `${pods.length} pod(s)${phaseStr ? `: ${phaseStr}` : ''}, rough completion estimate ~${estimatedRemainingMinutes}m remaining.`

    const suggestions: string[] = []
    const feedbackPods = pods.filter(p => p.status === 'feedback')
    if (feedbackPods.length > 0) suggestions.push(`${feedbackPods.length} pod(s) in feedback loop — check iteration progress via pod:status.`)
    const failedPods = pods.filter(p => p.status === 'failed')
    if (failedPods.length > 0) suggestions.push(`${failedPods.length} failed pod(s) — retry or cancel.`)
    if (pods.length === 0) suggestions.push('No active pods — create one via pod:create.')
    const activePods = pods.filter(p => ['solving', 'reviewing', 'executing', 'self-fixing'].includes(p.status))
    if (activePods.length > 0) suggestions.push('Monitor active pods via pod:status for detailed progress.')

    return contextResponse(pods, summary, suggestions,
      ['pod:create', 'pod:status', 'pod:cancel', 'agents:statuses'],
      { byPhase, avgIterations, totalPods: pods.length, estimatedRemainingMinutes },
    )
  }))

  ipcMain.handle('pod:status', wrapHandler(async (workflowId: unknown) => {
    if (typeof workflowId !== 'string') throw new Error('workflowId must be a string')
    const pod = await getPodStatus(workflowId)

    if (!pod) {
      return contextResponse(null, 'Pod not found.', ['Check pod:list for active pods.'],
        ['pod:list', 'pod:create'])
    }

    const elapsedTotal = Date.now() - pod.createdAt
    const currentStageEntry = pod.stageHistory.length > 0 ? pod.stageHistory[pod.stageHistory.length - 1] : null
    const timeInPhase = currentStageEntry ? Date.now() - currentStageEntry.enteredAt : 0
    const timeInPhaseMin = Math.round(timeInPhase / 60000)
    const elapsedMin = Math.round(elapsedTotal / 60000)

    const critiqueInfo = pod.critique
      ? ` — ${pod.critique.verdict} (${pod.critique.issues.length} issue${pod.critique.issues.length !== 1 ? 's' : ''}, confidence ${(pod.critique.confidence * 100).toFixed(0)}%)`
      : ''
    const summary = `Pod '${pod.name}': ${pod.status} (iteration ${pod.iteration}/${pod.maxIterations}), in phase for ${timeInPhaseMin}m, total ${elapsedMin}m.${critiqueInfo}`

    const suggestions: string[] = []
    if (pod.status === 'solving') suggestions.push('Solver working — check back or view artifacts.')
    if (pod.status === 'reviewing') suggestions.push('Reviewer evaluating — expect structured critique soon.')
    if (pod.status === 'executing') suggestions.push('Tests running — results expected shortly.')
    if (pod.status === 'feedback') {
      const verdictHint = pod.critique?.verdict === 'request-changes' ? ' (reviewer requested changes)' : ''
      suggestions.push(`Iteration ${pod.iteration}/${pod.maxIterations} — solver addressing reviewer feedback${verdictHint}.`)
    }
    if (pod.status === 'paused') suggestions.push('Pod is paused — resume via pod:resume.')
    if (pod.status === 'complete') suggestions.push('Pod complete — review artifacts and results.')
    if (pod.status === 'failed') suggestions.push(`Pod failed${pod.error ? `: ${pod.error}` : ''} — retry or cancel.`)

    if (pod.maxIterations > 0 && pod.iteration >= pod.maxIterations - 1 && !['complete', 'failed', 'cancelled'].includes(pod.status)) {
      suggestions.push('Pod is near max iterations — decide whether to tighten scope or intervene manually.')
    }
    const estimatedCompletionMinutes = ['complete', 'failed', 'cancelled'].includes(pod.status)
      ? 0
      : Math.max(2, Math.round(((pod.maxIterations - pod.iteration + 1) * 6) + (timeInPhaseMin > 20 ? 6 : 0)))

    return contextResponse(pod, summary, suggestions,
      ['pod:pause', 'pod:resume', 'pod:cancel', 'pod:list', 'agents:statuses'],
      {
        timeInPhaseMs: timeInPhase,
        elapsedTotalMs: elapsedTotal,
        iteration: pod.iteration,
        maxIterations: pod.maxIterations,
        estimatedCompletionMinutes,
        iterationPressure: pod.maxIterations > 0 ? +(pod.iteration / pod.maxIterations).toFixed(2) : 0,
      },
    )
  }))

  ipcMain.handle('pod:pause', wrapHandler((workflowId: unknown) => {
    if (typeof workflowId !== 'string') throw new Error('workflowId must be a string')
    return pausePod(workflowId)
  }))

  ipcMain.handle('pod:resume', wrapHandler((workflowId: unknown) => {
    if (typeof workflowId !== 'string') throw new Error('workflowId must be a string')
    return resumePod(workflowId)
  }))

  ipcMain.handle('pod:cancel', wrapHandler((workflowId: unknown) => {
    if (typeof workflowId !== 'string') throw new Error('workflowId must be a string')
    return cancelPod(workflowId)
  }))

  ipcMain.handle('pod:retry', wrapHandler((podId: unknown) => {
    if (typeof podId !== 'string' || !podId) throw new Error('podId must be a non-empty string')
    return requestPipelineRetry(podId)
  }))

  ipcMain.handle('pipeline:sweep-merged', wrapHandler(async () => {
    const repos = getWatchedRepos().map(r => ({ owner: r.owner, repo: r.repo, localPath: r.localPath }))
    return sweepMergedPRs(repos)
  }))

  // Retry a failed issue: reset labels to agent-ready so pipeline re-ingests it
  ipcMain.handle('pod:retry-issue', wrapHandler(async (repo: unknown, issueNumber: unknown) => {
    if (typeof repo !== 'string' || !/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repo)) {
      throw new Error('Invalid repo format — expected owner/repo')
    }
    if (typeof issueNumber !== 'number' && typeof issueNumber !== 'string') throw new Error('issueNumber required')
    const num = String(issueNumber)
    const { proxyExecFile } = await import('./spawn-proxy')
    // Remove failure/executing labels
    for (const label of ['agent-failed', 'agent-executing', 'agent-working', 'agent-done']) {
      await proxyExecFile('gh', ['issue', 'edit', num, '--repo', repo, '--remove-label', label], { timeout: 10_000 }).catch(() => {})
    }
    // Add agent-ready to re-enter pipeline
    await proxyExecFile('gh', ['issue', 'edit', num, '--repo', repo, '--add-label', 'agent-ready'], { timeout: 10_000 })
    // Clear from pipeline state so it gets re-ingested
    const { clearPipelineIssue } = await import('./github-pipeline')
    clearPipelineIssue(repo, Number(num))
    return { retried: true }
  }))

  // Merge a PR via gh CLI (used by Results panel merge-all)
  ipcMain.handle('pod:merge-pr', wrapHandler(async (prNumber: unknown, repo: unknown) => {
    if (typeof prNumber !== 'string' && typeof prNumber !== 'number') throw new Error('prNumber required')
    if (typeof repo !== 'string') throw new Error('repo required')
    const { proxyExecFile } = await import('./spawn-proxy')
    await proxyExecFile('gh', ['pr', 'merge', String(prNumber), '--repo', repo, '--squash', '--admin'], { timeout: 30_000 })
    return { merged: true }
  }))

  // Fetch a PR's changed files + patches + meta (used by Results panel "View Diff")
  ipcMain.handle('pod:get-pr-diff', wrapHandler(async (params: unknown) => {
    if (!params || typeof params !== 'object') throw new Error('params object required')
    const { owner, repo, prNumber } = params as { owner?: unknown; repo?: unknown; prNumber?: unknown }
    if (typeof owner !== 'string' || !/^[a-zA-Z0-9_.-]+$/.test(owner)) throw new Error('invalid owner')
    if (typeof repo !== 'string' || !/^[a-zA-Z0-9_.-]+$/.test(repo)) throw new Error('invalid repo')
    const numStr = typeof prNumber === 'number' ? String(prNumber) : (typeof prNumber === 'string' ? prNumber : '')
    if (!/^\d+$/.test(numStr)) throw new Error('invalid prNumber')

    const token = process.env.GITHUB_PERSONAL_ACCESS_TOKEN
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'Penpal',
    }
    if (token) headers.Authorization = `token ${token}`

    // Fetch PR meta (title, state, merged) and files (patches) in parallel
    const base = `https://api.github.com/repos/${owner}/${repo}/pulls/${numStr}`
    const [metaRes, filesRes] = await Promise.all([
      fetch(base, { headers, signal: AbortSignal.timeout(15_000) }),
      fetch(`${base}/files?per_page=100`, { headers, signal: AbortSignal.timeout(15_000) }),
    ])

    if (!metaRes.ok) throw new Error(`GitHub API ${metaRes.status} (meta): ${metaRes.statusText}`)
    if (!filesRes.ok) throw new Error(`GitHub API ${filesRes.status} (files): ${filesRes.statusText}`)

    const meta = await metaRes.json() as {
      title?: string
      state?: string
      merged?: boolean
      additions?: number
      deletions?: number
      changed_files?: number
      html_url?: string
    }
    const files = await filesRes.json() as Array<{
      filename: string
      status: string
      additions: number
      deletions: number
      changes: number
      patch?: string
    }>

    return {
      title: meta.title || '',
      state: meta.merged ? 'merged' : (meta.state || 'open'),
      merged: !!meta.merged,
      htmlUrl: meta.html_url || '',
      additions: meta.additions ?? files.reduce((s, f) => s + (f.additions || 0), 0),
      deletions: meta.deletions ?? files.reduce((s, f) => s + (f.deletions || 0), 0),
      changedFiles: meta.changed_files ?? files.length,
      files: files.map(f => ({
        filename: f.filename,
        status: f.status,
        additions: f.additions,
        deletions: f.deletions,
        changes: f.changes,
        patch: f.patch || '',
      })),
    }
  }))

  ipcMain.handle('pod:override', wrapHandler((workflowId: unknown, phase: unknown, override: unknown) => {
    if (typeof workflowId !== 'string') throw new Error('workflowId must be a string')
    if (typeof phase !== 'string' || !['plan', 'execute', 'validate'].includes(phase)) throw new Error('invalid phase')
    if (typeof override !== 'object' || override === null) throw new Error('override must be object')
    const ok = overridePod(workflowId, phase as 'plan' | 'execute' | 'validate', override as { model?: string; timeoutMultiplier?: number })
    return { success: ok }
  }))

  ipcMain.handle('pod:presets', wrapHandler(() => getPodPresets()))

  // ── Pod Profiles ──────────────────────────────────────────────────────────
  ipcMain.handle('pod:profiles', wrapHandler(() => getAllProfiles()))
  ipcMain.handle('pod:save-profile', wrapHandler((name: unknown, profile: unknown) => {
    if (typeof name !== 'string') throw new Error('name must be a string')
    saveProfile(name, profile as RuntimeProfile)
    return { success: true }
  }))
  ipcMain.handle('pod:delete-profile', wrapHandler((name: unknown) => {
    if (typeof name !== 'string') throw new Error('name must be a string')
    return { success: deleteProfile(name) }
  }))
  ipcMain.handle('pod:set-default-profile', wrapHandler((name: unknown) => {
    if (typeof name !== 'string') throw new Error('name must be a string')
    setDefaultProfile(name)
    return { success: true }
  }))

  // ── Flight Board ──────────────────────────────────────────────────────────
  ipcMain.handle('flight-board:list', wrapHandler(() => getActiveEntries()))
  ipcMain.handle('flight-board:files-in-flight', wrapHandler(() =>
    Object.fromEntries(getFilesInFlight()),
  ))

  // ── Slack Bridge ──────────────────────────────────────────────────────
  ipcMain.handle('slack:status', wrapHandler(() => ({
    running: isSlackBridgeRunning(),
    configured: !!(process.env.SLACK_BOT_TOKEN && process.env.SLACK_APP_TOKEN),
  })))
  ipcMain.handle('slack:start', wrapHandler(() => startSlackBridge()))
  ipcMain.handle('slack:stop', wrapHandler(() => stopSlackBridge()))

  // ── Fleet heartbeat
  ipcMain.handle('fleet:status', wrapHandler(() => {
    const running = isSlackBridgeRunning()
    if (!running) return { instances: [], channelName: '', lastPollAt: null, debug: 'slack-bridge-not-running' }
    const status = getFleetStatus()
    return { ...status, debug: `ok-${status.instances.length}-instances` }
  }))

  // ── iTerm2 / Session Health ──────────────────────────────────────────────
  ipcMain.handle('sessions:iterm-status', wrapHandler(() => getITermStatus()))

  // ── Opencode Sessions ──────────────────────────────────────────────────────
  ipcMain.handle('opencode:sessions', wrapHandler(async () => {
    const sessions = await getOpencodeSessions()
    if (sessions.length > 0) console.log('[opencode] sessions:', sessions.map(s => ({ runtime: s.runtime, project: s.project, pid: s.pid, tty: s.tty })))
    return sessions
  }))
  ipcMain.handle('orchestrator:queue', wrapHandler(async () => {
    const [tasks, healthStatuses] = await Promise.all([
      getTaskQueue(),
      getAgentHealthStatuses().catch(() => []),
    ])

    const byPriority: Record<string, number> = { critical: 0, high: 0, normal: 0, low: 0 }
    const byStatus: Record<string, number> = {}
    for (const t of tasks) {
      byPriority[t.priority] = (byPriority[t.priority] || 0) + 1
      byStatus[t.status] = (byStatus[t.status] || 0) + 1
    }
    const idleAgents = healthStatuses.filter(h => h.activeTasks === 0 && h.alive).length
    const idleAgentIds = healthStatuses.filter(h => h.activeTasks === 0 && h.alive).map(h => h.agentId)
    const failedCount = byStatus['failed'] || 0

    const priorityStr = Object.entries(byPriority).filter(([, n]) => n > 0).map(([p, n]) => `${n} ${p}`).join(', ')
    const summary = `${tasks.length} task(s)${priorityStr ? ` (${priorityStr})` : ''} with ${idleAgents} idle agent(s) available.`

    const suggestions: string[] = []
    if ((byPriority['critical'] || 0) > 0 && idleAgents > 0) suggestions.push('Critical tasks queued with idle agents — assign via pod:create.')
    if (failedCount > 0) suggestions.push(`${failedCount} failed task(s) — retry via orchestrator:retry-task.`)
    if (tasks.length === 0) suggestions.push('Queue clear — enqueue new work via orchestrator:enqueue.')
    if (idleAgents === 0 && tasks.length > 0) suggestions.push('No idle agents — monitor via orchestrator:agent-health.')
    if ((byPriority['critical'] || 0) > 0 && idleAgents === 0) suggestions.push('Critical backlog with no idle agents — pause low-priority work or launch capacity.')

    const oldestQueued = tasks.filter(t => t.status === 'queued').sort((a, b) => a.createdAt - b.createdAt)[0]
    const oldestQueuedAge = oldestQueued ? Date.now() - oldestQueued.createdAt : null

    return contextResponse(tasks, summary, suggestions,
      ['orchestrator:enqueue', 'orchestrator:retry-task', 'agents:statuses', 'pod:create'],
      { byPriority, byStatus, idleAgents, idleAgentIds, oldestQueuedAgeMs: oldestQueuedAge, oldestQueuedAgeBucket: ageBucket(oldestQueuedAge) },
    )
  }))
  ipcMain.handle('project:resolve-path', wrapHandler((raw: unknown) => {
    if (typeof raw !== 'string') throw new Error('path must be a string')
    return { resolved: resolveProjectPath(raw) }
  }))
  ipcMain.handle('orchestrator:enqueue', wrapHandler((
    title: unknown, description: unknown, project: unknown, priority: unknown, provider?: unknown,
  ) => {
    if (typeof title !== 'string') throw new Error('title must be a string')
    if (typeof description !== 'string') throw new Error('description must be a string')
    if (typeof project !== 'string') throw new Error('project must be a string')
    return enqueueTask({
      title,
      description,
      project,
      priority: (typeof priority === 'string' ? priority : 'normal') as 'critical' | 'high' | 'normal' | 'low',
      source: 'dashboard',
      provider: (provider === 'claude' || provider === 'ollama') ? provider as ModelProvider : undefined,
    })
  }))
  ipcMain.handle('orchestrator:cancel-task', wrapHandler((taskId: unknown) => {
    if (typeof taskId !== 'string') throw new Error('taskId must be a string')
    return cancelTask(taskId)
  }))
  ipcMain.handle('orchestrator:retry-task', wrapHandler((taskId: unknown) => {
    if (typeof taskId !== 'string') throw new Error('taskId must be a string')
    return retryTask(taskId)
  }))
  ipcMain.handle('orchestrator:agent-health', wrapHandler(async () => {
    const statuses = await getAgentHealthStatuses()

    const healthy = statuses.filter(s => s.status === 'healthy').map(s => s.agentId)
    const warnings = statuses.filter(s => s.status === 'warning').map(s => ({ agentId: s.agentId, reasons: s.warnings }))
    const dead = statuses.filter(s => s.status === 'dead').map(s => s.agentId)

    const summary = `${statuses.length} agent(s): ${healthy.length} healthy, ${warnings.length} warning, ${dead.length} dead.`

    const suggestions: string[] = []
    const recommendations: Array<{ priority: 'high' | 'medium'; agentId: string; action: string; reason: string }> = []
    for (const d of dead.slice(0, 3)) {
      const name = statuses.find(s => s.agentId === d)?.name || d
      suggestions.push(`${name} is dead — restart via orchestrator:shutdown-agent then agents:launch.`)
      recommendations.push({ priority: 'high', agentId: d, action: 'restart', reason: 'agent process is dead' })
    }
    for (const w of warnings.slice(0, 3)) {
      const name = statuses.find(s => s.agentId === w.agentId)?.name || w.agentId
      suggestions.push(`${name} has warnings: ${w.reasons.join(', ')} — consider restarting.`)
      recommendations.push({ priority: 'medium', agentId: w.agentId, action: 'investigate', reason: w.reasons.join(', ') })
    }
    if (dead.length === 0 && warnings.length === 0) suggestions.push('All agents healthy — no action needed.')

    return contextResponse(statuses, summary, suggestions,
      ['orchestrator:shutdown-agent', 'agents:launch', 'agents:statuses', 'orchestrator:queue'],
      { healthy, warnings, dead, recommendations },
    )
  }))
  ipcMain.handle('orchestrator:shutdown-agent', wrapHandler((agentId: unknown) => {
    if (typeof agentId !== 'string') throw new Error('agentId must be a string')
    return shutdownAgent(agentId)
  }))
  ipcMain.handle('orchestrator:stats', wrapHandler(() => getOrchestratorStats()))
  ipcMain.handle('orchestrator:xp', wrapHandler(() => getAllAgentXP()))
  ipcMain.handle('orchestrator:set-provider', wrapHandler((provider: unknown) => {
    if (provider !== 'claude' && provider !== 'ollama') throw new Error('provider must be "claude" or "ollama"')
    setModelProvider(provider as ModelProvider)
    return { provider: getModelProvider() }
  }))
  ipcMain.handle('orchestrator:get-provider', wrapHandler(async () => {
    return { provider: getModelProvider(), ollamaAvailable: await checkOllamaAvailable() }
  }))

  // ── Eval Dashboard (`eval-results.json`) ───────────────────────────────
  // report-all / report-agent: plain payloads for tables (no contextResponse).
  // stats: context-engineered; preload unwraps to EvalStats for the panel.
  ipcMain.handle('evals:report-all', wrapHandler(() => getEvalReportAll()))
  ipcMain.handle('evals:report-agent', wrapHandler((agentId: unknown) => {
    if (typeof agentId !== 'string') throw new Error('agentId must be a string')
    return getEvalReportAgent(agentId)
  }))
  ipcMain.handle('evals:stats', wrapHandler(() => {
    const stats = getEvalStats()
    const summary = `${stats.totalTasks} total tasks, ${(stats.overallSuccessRate * 100).toFixed(0)}% success rate, ${stats.experimentVelocity} this week.`

    const suggestions: string[] = []
    if (stats.overallSuccessRate < 0.7 && stats.totalTasks >= 5) {
      suggestions.push('Success rate below 70% — consider spot-checking recent outputs via evals:spot-check-queue.')
    }
    if (stats.experimentVelocity === 0) suggestions.push('No tasks this week — assign work via orchestrator:enqueue.')
    if (stats.totalTasks === 0) suggestions.push('No eval data yet — task outcomes will be recorded automatically.')

    return contextResponse(stats, summary, suggestions,
      ['evals:report-all', 'evals:spot-check-queue', 'evals:harness-report-all'],
    )
  }))

  // ── Eval Harness (JSONL-backed) ────────────────────────────────────────
  taskOutcomeCollector.start()
  ipcMain.handle('evals:harness-report-agent', wrapHandler((agentId: unknown, since?: unknown) => {
    if (typeof agentId !== 'string') throw new Error('agentId must be a string')
    return evalHarness.reportByAgent(agentId, since ? new Date(since as string) : undefined)
  }))
  ipcMain.handle('evals:harness-report-all', wrapHandler((since?: unknown) =>
    evalHarness.reportAll(since ? new Date(since as string) : undefined),
  ))
  ipcMain.handle('evals:weekly-digest', wrapHandler((weekOverride?: unknown) =>
    generateWeeklyDigest({ weekOf: weekOverride ? new Date(weekOverride as string) : undefined }),
  ))

  // ── Pod Quality Metrics ────────────────────────────────────────────────
  ipcMain.handle('evals:pod-quality', wrapHandler((since?: unknown) =>
    podQualityCollector.report(since ? new Date(since as string) : undefined),
  ))

  // ── Pod Combo Analytics ─────────────────────────────────────────────────
  ipcMain.handle('evals:pod-combos', wrapHandler((opts?: unknown) => {
    const o = (opts && typeof opts === 'object') ? opts as Record<string, unknown> : {}
    return podComboCollector.report({
      since: typeof o.since === 'string' ? new Date(o.since) : undefined,
      until: typeof o.until === 'string' ? new Date(o.until) : undefined,
      presetId: typeof o.presetId === 'string' ? o.presetId : undefined,
      agentId: typeof o.agentId === 'string' ? o.agentId : undefined,
    })
  }))

  // ── Context Health ──────────────────────────────────────────────────────
  ipcMain.handle('evals:context-health', wrapHandler(() => contextMonitor.checkAll()))
  ipcMain.handle('evals:context-health-agent', wrapHandler((agentId: unknown) => {
    if (typeof agentId !== 'string') throw new Error('agentId must be a string')
    return contextMonitor.check(agentId)
  }))

  // ── Spot-Check Queue (Human Judge) ────────────────────────────────────────
  ipcMain.handle('evals:spot-check-queue', wrapHandler(() => spotCheckQueue.getPending()))
  ipcMain.handle('evals:spot-check-sample', wrapHandler((count: unknown) => {
    if (typeof count !== 'number' || !Number.isFinite(count)) throw new Error('count must be a finite number')
    return spotCheckQueue.sample(count)
  }))
  ipcMain.handle('evals:spot-check-review', wrapHandler((id: unknown, verdict: unknown, notes?: unknown) => {
    if (typeof id !== 'string') throw new Error('id must be a string')
    if (verdict !== 'pass' && verdict !== 'fail' && verdict !== 'partial') {
      throw new Error('verdict must be pass, fail, or partial')
    }
    return spotCheckQueue.review(id, verdict, typeof notes === 'string' ? notes : undefined)
  }))
  ipcMain.handle('evals:spot-check-agreement', wrapHandler(() => spotCheckQueue.agreement()))

  // ── GitHub issue poller ──────────────────────────────────────────────────
  ipcMain.handle('github:status', wrapHandler(() => getGithubIssuePollerStatus()))
  ipcMain.handle('github:poll-now', wrapHandler(() => pollGithubIssuesNow()))
  ipcMain.handle('github:seen', wrapHandler(() => getSeenIssues()))
  ipcMain.handle('github:cards', wrapHandler(() => getGithubIssueCards()))
  ipcMain.handle('github:add-repo', wrapHandler((owner: unknown, repo: unknown, localPath: unknown) => {
    if (typeof owner !== 'string' || typeof repo !== 'string' || typeof localPath !== 'string') {
      throw new Error('owner, repo, and localPath must be strings')
    }
    addWatchedRepo(owner, repo, localPath)
    return { ok: true }
  }))
  ipcMain.handle('github:remove-repo', wrapHandler((owner: unknown, repo: unknown) => {
    if (typeof owner !== 'string' || typeof repo !== 'string') {
      throw new Error('owner and repo must be strings')
    }
    removeWatchedRepo(owner, repo)
    return { ok: true }
  }))
  ipcMain.handle('github:list-repos', wrapHandler(() => getWatchedRepos()))

  // ── Webhook server (instant GitHub issue dispatch) ───────────────────────
  ipcMain.handle('webhook:status', wrapHandler(() => getWebhookStatus()))

  // ── Linear issue poller ──────────────────────────────────────────────────
  ipcMain.handle('linear:status', wrapHandler(() => {
    const { getLinearPollerStatus } = require('./linear-poller') as typeof import('./linear-poller')
    return getLinearPollerStatus()
  }))
  ipcMain.handle('linear:poll-now', wrapHandler(async () => {
    const { pollLinearNow } = require('./linear-poller') as typeof import('./linear-poller')
    return pollLinearNow()
  }))
  ipcMain.handle('linear:cards', wrapHandler(async () => {
    const { getLinearIssueCards } = require('./linear-poller') as typeof import('./linear-poller')
    return getLinearIssueCards()
  }))
  ipcMain.handle('linear:add-team', wrapHandler(async (teamKey: unknown, localPath: unknown, label: unknown) => {
    if (typeof teamKey !== 'string' || typeof localPath !== 'string') throw new Error('teamKey and localPath must be strings')
    const { addLinearTeam } = require('./linear-poller') as typeof import('./linear-poller')
    return addLinearTeam(teamKey, localPath, typeof label === 'string' ? label : undefined)
  }))
  ipcMain.handle('linear:remove-team', wrapHandler(async (teamKey: unknown) => {
    if (typeof teamKey !== 'string') throw new Error('teamKey must be a string')
    const { removeLinearTeam } = require('./linear-poller') as typeof import('./linear-poller')
    return removeLinearTeam(teamKey)
  }))
  ipcMain.handle('linear:list-teams', wrapHandler(() => {
    const { getLinearTeams } = require('./linear-poller') as typeof import('./linear-poller')
    return getLinearTeams()
  }))

  // ── Config Snapshot + Editing ───────────────────────────────────────
  ipcMain.handle('config:snapshot', wrapHandler(() => getConfigSnapshot()))

  ipcMain.handle('config:add-project-mcp', wrapHandler((server: unknown) => {
    const s = server as { name: string; command: string; args: string[]; env?: Record<string, string>; cwd?: string }
    if (!s?.name || !s?.command) throw new Error('name and command are required')
    return addProjectMcpServer(s)
  }))

  ipcMain.handle('config:remove-project-mcp', wrapHandler((name: unknown) => {
    if (typeof name !== 'string') throw new Error('name must be a string')
    return removeProjectMcpServer(name)
  }))

  ipcMain.handle('config:add-profile-mcp', wrapHandler((profile: unknown, server: unknown) => {
    if (typeof profile !== 'string') throw new Error('profile must be a string')
    const s = server as { name: string; command: string; args: string[]; env?: Record<string, string>; cwd?: string }
    if (!s?.name || !s?.command) throw new Error('name and command are required')
    return addProfileMcpServer(profile, s)
  }))

  ipcMain.handle('config:remove-profile-mcp', wrapHandler((profile: unknown, serverName: unknown) => {
    if (typeof profile !== 'string' || typeof serverName !== 'string') throw new Error('profile and serverName must be strings')
    return removeProfileMcpServer(profile, serverName)
  }))

  ipcMain.handle('config:update-agent-tools', wrapHandler((agentId: unknown, tools: unknown) => {
    if (typeof agentId !== 'string') throw new Error('agentId must be a string')
    if (!Array.isArray(tools)) throw new Error('tools must be an array')
    return updateAgentTools(agentId, tools as string[])
  }))

  ipcMain.handle('governance:get', wrapHandler(() => loadGovernanceConfig()))

  ipcMain.handle('governance:set', wrapHandler((partial: unknown) => {
    if (!partial || typeof partial !== 'object' || Array.isArray(partial)) {
      throw new Error('governance config must be an object')
    }
    const obj = partial as Record<string, unknown>
    const next: Partial<GovernanceConfig> = {}
    if (obj.maxConcurrentPods !== undefined) {
      if (typeof obj.maxConcurrentPods !== 'number') throw new Error('maxConcurrentPods must be a number')
      next.maxConcurrentPods = obj.maxConcurrentPods
    }
    if (obj.maxPodRetries !== undefined) {
      if (typeof obj.maxPodRetries !== 'number') throw new Error('maxPodRetries must be a number')
      next.maxPodRetries = obj.maxPodRetries
    }
    if (obj.rules !== undefined) {
      if (!Array.isArray(obj.rules)) throw new Error('rules must be an array')
      next.rules = obj.rules as GovernanceConfig['rules']
    }
    return saveGovernanceConfig(next)
  }))

  // ── Session Replay ────────────────────────────────────────────────────
  {
    const replay = getSessionReplayRecorder(DATA_DIR)

    // Wire up agent state polling: reuse the agents:statuses logic inline
    replay.setAgentStatesFn(async () => {
      const configs = getAgentConfigs()
      const [sessions] = await Promise.all([
        getClaudeSessions(),
        getCursorAgentSessions().catch(() => []),
      ])
      const savedMap = loadAgentSessionMap()
      const states: AgentState[] = []
      for (const config of configs) {
        const matched = sessions.find(s => {
          const saved = savedMap[config.id]
          if (saved && saved.pid > 0) return s.pid === saved.pid
          if (config.defaultRepos.length > 0) {
            return config.defaultRepos.some(repo => s.cwd === repo) &&
              !configs.some(other => other.id !== config.id && other.defaultRepos.includes(s.cwd))
          }
          return false
        })
        if (matched) {
          const cpuVal = parseFloat(matched.cpu || '0')
          states.push({
            config,
            status: (cpuVal >= 1 ? 'active' : 'idle') as AgentState['status'],
            needsInteraction: matched.waitingForInput,
            sessionMode: matched.sessionMode,
            sessionId: matched.sessionId,
            pid: matched.pid,
            tty: matched.tty,
            cpu: matched.cpu,
            memoryMB: matched.memoryMB,
            cwd: matched.cwd,
            contextUtilization: matched.contextUtilization,
            contextRotDetected: matched.contextRotDetected,
          })
        }
      }
      return states
    })

    ipcMain.handle('replay:status', wrapHandler(() => replay.getStatus()))
    ipcMain.handle('replay:start', wrapHandler((label?: unknown) => {
      const id = replay.startRecording(typeof label === 'string' ? label : undefined)
      return { id }
    }))
    ipcMain.handle('replay:stop', wrapHandler(() => replay.stopRecording()))
    ipcMain.handle('replay:list', wrapHandler(() => replay.listRecordings()))
    ipcMain.handle('replay:get', wrapHandler((id: unknown) => {
      if (typeof id !== 'string') throw new Error('id must be a string')
      const rec = replay.getRecording(id)
      if (!rec) throw new Error(`Recording not found: ${id}`)
      return rec
    }))
    ipcMain.handle('replay:delete', wrapHandler((id: unknown) => {
      if (typeof id !== 'string') throw new Error('id must be a string')
      const ok = replay.deleteRecording(id)
      return { ok }
    }))
  }

  // ── Autopilot (scheduled recurring tasks) ──────────────────────────────
  ipcMain.handle('autopilot:status', wrapHandler(() => getAutopilotStatus()))

  ipcMain.handle('autopilot:list', wrapHandler(() => {
    const config = loadAutopilotConfig()
    return { enabled: config.enabled, schedules: config.schedules }
  }))

  ipcMain.handle('autopilot:add', wrapHandler((opts: unknown) => {
    const o = (opts && typeof opts === 'object' && !Array.isArray(opts))
      ? opts as Record<string, unknown>
      : {}
    if (typeof o.title !== 'string' || !o.title.trim()) throw new Error('title must be a non-empty string')
    if (typeof o.description !== 'string') throw new Error('description must be a string')
    if (typeof o.project !== 'string' || !o.project.trim()) throw new Error('project must be a non-empty string')
    if (typeof o.cronExpression !== 'string' || !o.cronExpression.trim()) {
      throw new Error('cronExpression must be a non-empty string (daily, hourly, weekly, or "M H * * *")')
    }
    return addScheduledTask({
      title: o.title,
      description: o.description,
      project: o.project,
      cronExpression: o.cronExpression,
    })
  }))

  ipcMain.handle('autopilot:remove', wrapHandler((taskId: unknown) => {
    if (typeof taskId !== 'string') throw new Error('taskId must be a string')
    return { removed: removeScheduledTask(taskId) }
  }))

  ipcMain.handle('autopilot:toggle', wrapHandler((taskId: unknown, enabled: unknown) => {
    if (typeof taskId !== 'string') throw new Error('taskId must be a string')
    if (typeof enabled !== 'boolean') throw new Error('enabled must be a boolean')
    return { toggled: toggleScheduledTask(taskId, enabled) }
  }))

  ipcMain.handle('autopilot:start', wrapHandler(() => {
    startAutopilot()
    return getAutopilotStatus()
  }))

  ipcMain.handle('autopilot:stop', wrapHandler(() => {
    stopAutopilot()
    return getAutopilotStatus()
  }))

  ipcMain.handle('reasoning:list', wrapHandler(() =>
    reasoningBank.getAll().sort((a, b) => b.timestamp - a.timestamp),
  ))

  ipcMain.handle('reasoning:delete', wrapHandler((id: unknown) => {
    if (typeof id !== 'string') throw new Error('id must be a string')
    const before = reasoningBank.size()
    reasoningBank.delete(id)
    return { ok: reasoningBank.size() < before }
  }))

  ipcMain.handle('reasoning:clear', wrapHandler(() => {
    const count = reasoningBank.size()
    reasoningBank.clear()
    return { cleared: count }
  }))
}

export function registerPreferenceIpc(store: PreferenceStore) {
  const runDpoPairExport = async (): Promise<{ count: number; path: string }> => {
    const { PairGenerator } = await import('./preferences/pairs')
    const generator = new PairGenerator(store)
    const dataDir = path.resolve(DATA_DIR)
    const outPath = resolveDataExportPath(DPO_PAIRS_FILENAME)

    await fs.promises.mkdir(dataDir, { recursive: true })
    const dataDirStat = await fs.promises.stat(dataDir)
    if (!dataDirStat.isDirectory()) {
      throw new Error(`Data path is not a directory: ${dataDir}`)
    }
    await fs.promises.access(dataDir, fs.constants.W_OK)

    let generatedCount = 0
    try {
      for await (const _pair of generator.generate()) {
        generatedCount++
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      throw new Error(`Failed to generate DPO pairs from preferences: ${message}`)
    }
    if (!Number.isInteger(generatedCount) || generatedCount < 0) {
      throw new Error(`Invalid DPO pair count generated: ${generatedCount}`)
    }

    try {
      const count = await generator.export(outPath, 'jsonl')
      if (!Number.isInteger(count) || count < 0) {
        throw new Error(`Invalid DPO pair export count: ${count}`)
      }
      return { count, path: outPath }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      throw new Error(`Failed to export DPO pairs to ${outPath}: ${message}`)
    }
  }

  ipcMain.handle('preferences:stats', wrapHandler(() => store.stats()))
  ipcMain.handle('preferences:count', wrapHandler(() => store.count()))
  ipcMain.handle('preferences:query', wrapHandler(async (filter?: unknown) => {
    const f = (filter ?? {}) as { agentId?: string; signal?: string; since?: string }
    const events: import('./preferences/types').PreferenceEvent[] = []
    for await (const event of store.query({
      agentId: f.agentId,
      signal: f.signal,
      since: f.since ? new Date(f.since) : undefined,
    })) {
      events.push(event)
      if (events.length >= 500) break // safety cap
    }
    return events
  }))
  ipcMain.handle('preferences:generate-pairs', wrapHandler(runDpoPairExport))
  ipcMain.handle('evals:generate-dpo-pairs', wrapHandler(runDpoPairExport))

  // ── Onboarding ──────────────────────────────────────────────────────────────
  ipcMain.handle('onboarding:status', wrapHandler(() => {
    const { getOnboardingStatus } = require('./onboarding') as typeof import('./onboarding')
    return getOnboardingStatus()
  }))

  ipcMain.handle('onboarding:save', wrapHandler(async (payload: unknown) => {
    const { saveOnboarding } = require('./onboarding') as typeof import('./onboarding')
    return saveOnboarding(payload as import('./onboarding').OnboardingSavePayload)
  }))

  ipcMain.handle('onboarding:skip', wrapHandler(async () => {
    const { skipOnboarding } = require('./onboarding') as typeof import('./onboarding')
    await skipOnboarding()
    return { ok: true }
  }))

  // ── Pod Stage Change Forwarding ──────────────────────────────────────────
  // Forward pod status-change events to the renderer for spectator mode
  podEvents.on('status-change', (wf: { id: string; status: string; solver: { agentId: string }; reviewer: { agentId: string }; executor: { agentId: string }; iteration: number }) => {
    const payload = {
      podId: wf.id,
      status: wf.status,
      solverId: wf.solver.agentId,
      reviewerId: wf.reviewer.agentId,
      executorId: wf.executor.agentId,
      iteration: wf.iteration,
    }
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('pod:stage-changed', payload)
    }
  })

  // ── Pod Log Streaming ────────────────────────────────────────────────────
  // Subscribers map: podId → set of webContents.id values for windows that
  // want live log updates. Also store '*' for "all pods" subscriptions.
  const podLogSubscribers = new Map<string, Set<number>>()

  function addLogSubscriber(podId: string, webContentsId: number): void {
    let set = podLogSubscribers.get(podId)
    if (!set) {
      set = new Set()
      podLogSubscribers.set(podId, set)
    }
    set.add(webContentsId)
  }

  function removeLogSubscriber(podId: string, webContentsId: number): void {
    const set = podLogSubscribers.get(podId)
    if (!set) return
    set.delete(webContentsId)
    if (set.size === 0) podLogSubscribers.delete(podId)
  }

  function removeAllSubscriptionsFor(webContentsId: number): void {
    for (const [podId, set] of podLogSubscribers) {
      set.delete(webContentsId)
      if (set.size === 0) podLogSubscribers.delete(podId)
    }
  }

  // Fan out log events to subscribed windows.
  podEvents.on('log', (entry: PodLogLine) => {
    const subs = podLogSubscribers.get(entry.podId)
    if (!subs || subs.size === 0) return
    for (const win of BrowserWindow.getAllWindows()) {
      if (win.isDestroyed()) continue
      if (!subs.has(win.webContents.id)) continue
      try { win.webContents.send('pod:log', entry) } catch { /* window gone */ }
    }
  })

  // Clean up subscriptions when a window goes away.
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.once('destroyed', () => removeAllSubscriptionsFor(win.webContents.id))
  }

  // Track webContents that have already had a destroy listener attached so we
  // don't accumulate duplicates as the renderer subscribes to multiple pods.
  const trackedWebContents = new Set<number>()
  function trackWebContents(wc: Electron.WebContents): void {
    if (trackedWebContents.has(wc.id)) return
    trackedWebContents.add(wc.id)
    wc.once('destroyed', () => {
      removeAllSubscriptionsFor(wc.id)
      trackedWebContents.delete(wc.id)
    })
  }

  ipcMain.handle('pod:subscribe-logs', async (event: Electron.IpcMainInvokeEvent, podId: unknown) => {
    try {
      if (typeof podId !== 'string' || !podId) throw new Error('podId must be a non-empty string')
      const wc = event.sender
      addLogSubscriber(podId, wc.id)
      trackWebContents(wc)
      // Return the buffered backlog so the renderer can replay before live events arrive.
      return { backlog: getPodLogs(podId) }
    } catch (err) {
      return { error: (err as Error).message }
    }
  })

  ipcMain.handle('pod:unsubscribe-logs', async (event: Electron.IpcMainInvokeEvent, podId: unknown) => {
    try {
      if (typeof podId !== 'string' || !podId) throw new Error('podId must be a non-empty string')
      removeLogSubscriber(podId, event.sender.id)
      return { ok: true }
    } catch (err) {
      return { error: (err as Error).message }
    }
  })

  ipcMain.handle('pod:get-logs', wrapHandler(async (...args: unknown[]) => {
    const podId = args[0]
    if (typeof podId !== 'string' || !podId) throw new Error('podId must be a non-empty string')
    return { backlog: getPodLogs(podId) }
  }))
}
