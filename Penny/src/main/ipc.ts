import { ipcMain, shell, dialog, BrowserWindow } from 'electron'
import { EventEmitter } from 'events'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { checkHealth } from './health'
import { startSlackBridge, stopSlackBridge, isSlackBridgeRunning } from './slack-bridge'
import { getJobStatuses, getJobHistory, forceRunJob } from './scheduler-bridge'
import {
  getPipelineSummary,
  getHotLeads,
  getTerritories,
  getNewLeads,
  getGraphStatsWithFreshness,
  searchLeads,
  getLeadDetail,
} from './graph'
import { suggestedActionsForStage } from './stage-suggestions'
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
  pruneStaleSessions,
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
  type CreatePodOpts,
} from './pods'

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

  return out
}
import {
  listVaultDir,
  readVaultFile,
  writeVaultFile,
  createVaultFile,
  createVaultFolder,
  renameVaultFile,
  deleteVaultFile,
  indexVault,
  searchVault,
  getVaultTags,
  getFilesByTag,
  getBacklinks,
} from './vault'
import { buildSearchIndex, searchIndexed } from './search-index'
import { getVaultGraph } from './vault-graph'
import {
  enqueueTask,
  getTaskQueue,
  cancelTask,
  retryTask,
  getAgentHealthStatuses,
  shutdownAgent,
  getOrchestratorStats,
  getAllAgentXP,
  getAllAgentCredits,
  setModelProvider,
  getModelProvider,
  pruneTaskQueue,
  type AgentXP,
  type ModelProvider,
} from './orchestrator'
import { checkOllamaAvailable } from './ollama-client'
import {
  getGithubIssuePollerStatus,
  pollGithubIssuesNow,
  getSeenIssues,
  getGithubIssueCards,
  addWatchedRepo,
  removeWatchedRepo,
  getWatchedRepos,
  consolidateTrackedIssues,
} from './github-issues'
import { getPipelineIssues } from './github-pipeline'
import {
  getVeritasStatus,
  startVeritasService,
  stopVeritasService,
  restartVeritasService,
  getVeritasLogs,
} from './veritas-service'
import { getEvalReportAll, getEvalReportAgent, getEvalStats } from './evals'
import { taskOutcomeCollector } from './evals/collectors/task-outcomes'
import { podQualityCollector } from './evals/collectors/pod-quality'
import { evalHarness } from './evals/harness'
import { generateWeeklyDigest } from './evals/reports/weekly-digest'
import { contextMonitor } from './evals/collectors/context-usage'
import { spotCheckQueue } from './evals/judges/human-judge'
import { listSoundboardClips } from './soundboard'
import {
  listVeritasTasks,
  getVeritasTaskCounts,
  createVeritasTask,
  updateVeritasTaskStatus,
  type VeritasTaskStatus,
} from './veritas-api'
import { DOCS_ROOT, getSystemPaths } from './paths'
import { registerDataScriptHandlers } from './data-scripts'
import {
  getConfigSnapshot,
  addProjectMcpServer,
  removeProjectMcpServer,
  addProfileMcpServer,
  removeProfileMcpServer,
  updateAgentTools,
} from './config-reader'
import type { PreferenceStore } from './preferences'
import { contextResponse } from './context-response'

export const ipcEvents = new EventEmitter()

const VAULT_ROOT = DOCS_ROOT
const BRIEFINGS_DIR = path.join(VAULT_ROOT, '1Putt', 'Daily Briefings')
const DATA_DIR = path.resolve(__dirname, '..', '..', 'data')

interface VaultFolder {
  name: string
  fileCount: number
  subfolders: string[]
}

function ageBucket(ms: number | null): string {
  if (ms === null || ms <= 0) return 'none'
  const minutes = Math.floor(ms / 60000)
  if (minutes < 15) return '<15m'
  if (minutes < 60) return '15-60m'
  if (minutes < 240) return '1-4h'
  return '>4h'
}

function scanVaultFolders(): VaultFolder[] {
  const folders: VaultFolder[] = []
  // Dynamically discover top-level folders in the vault
  let topDirs: string[] = []
  try {
    topDirs = fs.readdirSync(VAULT_ROOT, { withFileTypes: true })
      .filter(e => e.isDirectory() && !e.name.startsWith('.'))
      .map(e => e.name)
  } catch { /* vault root not found */ }

  for (const dir of topDirs) {
    const fullPath = path.join(VAULT_ROOT, dir)
    try {
      if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isDirectory()) continue
      const entries = fs.readdirSync(fullPath)
      const mdFiles = entries.filter(e => e.endsWith('.md'))
      const subdirs = entries.filter(e => {
        try { return fs.statSync(path.join(fullPath, e)).isDirectory() && !e.startsWith('.') }
        catch { return false }
      })
      folders.push({ name: dir, fileCount: mdFiles.length, subfolders: subdirs.slice(0, 6) })
    } catch { /* skip */ }
  }
  return folders
}

function getLatestBriefing(): { date: string; content: string } | null {
  try {
    if (!fs.existsSync(BRIEFINGS_DIR)) return null
    const files = fs.readdirSync(BRIEFINGS_DIR)
      .filter(f => f.endsWith('.md'))
      .sort()
      .reverse()
    if (files.length === 0) return null
    const latest = files[0]
    const content = fs.readFileSync(path.join(BRIEFINGS_DIR, latest), 'utf-8')
    return { date: latest.replace('.md', ''), content }
  } catch {
    return null
  }
}

function listBriefings(): string[] {
  try {
    if (!fs.existsSync(BRIEFINGS_DIR)) return []
    return fs.readdirSync(BRIEFINGS_DIR)
      .filter(f => f.endsWith('.md'))
      .sort()
      .reverse()
      .map(f => f.replace('.md', ''))
  } catch {
    return []
  }
}

function getBriefing(date: string): string | null {
  try {
    const filePath = path.join(BRIEFINGS_DIR, `${date}.md`)
    if (!fs.existsSync(filePath)) return null
    return fs.readFileSync(filePath, 'utf-8')
  } catch {
    return null
  }
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
  ipcMain.handle('pipeline:summary', wrapHandler(() => getPipelineSummary()))
  ipcMain.handle('pipeline:hot-leads', wrapHandler(() => getHotLeads()))
  ipcMain.handle('pipeline:territories', wrapHandler(() => getTerritories()))
  ipcMain.handle('pipeline:new-leads', wrapHandler(() => getNewLeads()))
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
  ipcMain.handle('graph:stats', wrapHandler(async () => {
    const stats = await getGraphStatsWithFreshness()
    const totalNodes = stats?.totalNodes ?? 0
    const totalRels = stats?.totalRelationships ?? 0
    const leadCount = stats?.nodesByLabel?.['Lead'] ?? 0

    const summary = `Graph: ${totalNodes} nodes, ${totalRels} relationships.${leadCount > 0 ? ` ${leadCount} leads indexed.` : ''} Freshness: ${stats.freshness.status}.`

    const suggestions: string[] = []
    if (totalNodes === 0) suggestions.push('Graph is empty — run ETL to populate data.')
    if (leadCount > 0) suggestions.push(`${leadCount} leads available — search via leads:search.`)
    if (totalNodes > 0 && leadCount === 0) suggestions.push('No lead nodes — run sales ingestion pipeline.')
    if (stats.freshness.status === 'stale') suggestions.push('Lead timestamps look stale — refresh ETL.')

    return contextResponse(stats, summary, suggestions,
      ['leads:search', 'leads:detail', 'pipeline:summary'],
      { totalNodes, totalRels, leadCount, freshness: stats.freshness },
    )
  }))
  const handleLeadsSearch = wrapHandler(async (query: unknown) => {
    if (typeof query !== 'string') throw new Error('query must be a string')
    const results = await searchLeads(query)

    const scores = results.map(r => r.score)
    const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0
    const topScore = scores.length > 0 ? Math.max(...scores) : 0
    const lowScoreCount = scores.filter(s => s < 40).length
    const mediumScoreCount = scores.filter(s => s >= 40 && s < 70).length
    const highScoreCount = scores.filter(s => s >= 70).length
    const stageDistribution: Record<string, number> = {}
    const armDistribution: Record<string, number> = {}
    for (const r of results) {
      stageDistribution[r.stage] = (stageDistribution[r.stage] || 0) + 1
      armDistribution[r.businessArm] = (armDistribution[r.businessArm] || 0) + 1
    }
    const topLead = results.length > 0 ? results.reduce((best, r) => r.score > best.score ? r : best) : null

    const stageStr = Object.entries(stageDistribution).map(([s, n]) => `${n} ${s}`).join(', ')
    const summary = `Found ${results.length} leads matching '${query}': avg score ${avgScore}${stageStr ? `, ${stageStr}` : ''}.`

    const suggestions: string[] = []
    if (topLead) suggestions.push(`Top lead: ${topLead.name} (score ${topLead.score}) — view details via leads:detail.`)
    const prospecting = stageDistribution['prospecting'] || 0
    if (highScoreCount > 0) suggestions.push(`${highScoreCount} high-scoring lead(s) are ready for immediate outreach.`)
    if (prospecting > 0) suggestions.push(`${prospecting} leads in prospecting — prioritize qualification workflows.`)
    if (lowScoreCount > 0 && results.length > 0) suggestions.push(`${lowScoreCount} low-score lead(s) may need enrichment before outreach.`)
    if (results.length === 0) suggestions.push('No results — try a broader query or check graph:stats for indexed data.')

    return contextResponse(results, summary, suggestions,
      ['leads:detail', 'graph:lead-detail', 'vault:search', 'orchestrator:enqueue'],
      {
        avgScore,
        topScore,
        scoreDistribution: { low: lowScoreCount, medium: mediumScoreCount, high: highScoreCount },
        stageDistribution,
        businessArmDistribution: armDistribution,
        topLead: topLead?.name ?? null,
        topLeadId: topLead?.leadId ?? null,
      },
    )
  })
  ipcMain.handle('leads:search', handleLeadsSearch)
  ipcMain.handle('graph:search-leads', handleLeadsSearch)

  const handleLeadDetail = wrapHandler(async (name: unknown) => {
    if (typeof name !== 'string') throw new Error('name must be a string')
    const detail = await getLeadDetail(name)

    if (!detail) {
      return contextResponse(null, 'Lead not found.', ['Search via leads:search to find available leads.'],
        ['leads:search', 'vault:search'])
    }

    const suggestions = [...suggestedActionsForStage(detail.stage)]

    const lastEvent = detail.events.length > 0 ? detail.events[detail.events.length - 1] : null
    const daysSinceLastEvent = lastEvent ? Math.floor((Date.now() - new Date(lastEvent.date).getTime()) / 86400000) : null
    if (daysSinceLastEvent !== null && daysSinceLastEvent > 14) {
      suggestions.push(`No activity in ${daysSinceLastEvent} days — consider follow-up.`)
    }

    const summary = `${detail.name} at ${detail.company} — score ${detail.score}, stage: ${detail.stage}, EHR: ${detail.ehr || 'unknown'}.`

    return contextResponse(detail, summary, suggestions,
      ['leads:search', 'graph:search-leads', 'vault:search', 'vault:read', 'orchestrator:enqueue'],
      {
        eventCount: detail.events.length,
        documentCount: detail.documents.length,
        stageHistory: detail.stageHistory,
        daysSinceLastEvent,
        suggestedStageActions: suggestedActionsForStage(detail.stage),
      },
    )
  })
  ipcMain.handle('leads:detail', handleLeadDetail)
  ipcMain.handle('graph:lead-detail', handleLeadDetail)
  ipcMain.handle('briefing:latest', wrapHandler(() => getLatestBriefing()))
  ipcMain.handle('briefing:list', wrapHandler(() => listBriefings()))
  ipcMain.handle('briefing:get', wrapHandler((date: unknown) => {
    if (typeof date !== 'string') throw new Error('date must be a string')
    return getBriefing(date)
  }))

  ipcMain.handle('vault:folders', wrapHandler(() => scanVaultFolders()))

  // ── Docs File Browser ────────────────────────────────────────────
  ipcMain.handle('ventures:list', wrapHandler((relativePath: unknown) => {
    const rel = typeof relativePath === 'string' ? relativePath : ''
    const fullPath = path.resolve(path.join(VAULT_ROOT, rel))
    if (!fullPath.startsWith(VAULT_ROOT)) throw new Error('Path traversal denied')
    if (!fs.existsSync(fullPath)) return []
    const entries = fs.readdirSync(fullPath, { withFileTypes: true })
    return entries
      .filter(e => !e.name.startsWith('.'))
      .map(e => ({
        name: e.name,
        isDirectory: e.isDirectory(),
        path: path.join(rel, e.name),
      }))
      .sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
        return a.name.localeCompare(b.name)
      })
  }))

  ipcMain.handle('ventures:read', wrapHandler((relativePath: unknown) => {
    if (typeof relativePath !== 'string') throw new Error('relativePath must be a string')
    const fullPath = path.resolve(path.join(VAULT_ROOT, relativePath))
    if (!fullPath.startsWith(VAULT_ROOT)) throw new Error('Path traversal denied')
    if (!fs.existsSync(fullPath)) return null
    return fs.readFileSync(fullPath, 'utf-8')
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
        defaultRepos: task.project ? [task.project] : [],
        avatar: 'orchestrator',
        desk: { row: 0, col: 0 },
        autonomy: 'headless',
      }
      agentStates.push({
        config: taskConfig,
        status: 'active',
        needsInteraction: false,
        sessionMode: taskStage === 'planning' ? 'plan' : 'working',
        cwd: task.project || undefined,
        isOrchestratorTask: true,
        taskStage,
        taskTitle: task.title,
      })
    }

    // ── Surface active 2-agent pipeline issues as synthetic agents ──
    const pipelineIssues = getPipelineIssues().filter(
      p => p.stage === 'planning' || p.stage === 'executing',
    )
    for (const pi of pipelineIssues) {
      const piName = pi.title.length > 25 ? pi.title.slice(0, 24) + '..' : pi.title
      const piStage = pi.stage === 'planning' ? 'planning' : 'executing'
      const piConfig: AgentConfig = {
        id: `pipeline-${pi.repo.replace('/', '-')}-${pi.number}`,
        name: piName,
        title: pi.stage === 'planning' ? 'Planner' : 'Executor',
        podRole: pi.stage === 'planning' ? 'reviewer' : 'executor',
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
        status: (pi.plannerRunning || pi.executorRunning) ? 'active' : 'idle',
        needsInteraction: false,
        sessionMode: piStage === 'planning' ? 'plan' : 'working',
        cwd: pi.repo.includes('/') ? undefined : undefined, // no cwd for pipeline agents
        isOrchestratorTask: true,
        taskStage: piStage as 'planning' | 'executing',
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
  ipcMain.handle('soundboard:list', wrapHandler(() => listSoundboardClips()))

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

  ipcMain.handle('pod:presets', wrapHandler(() => getPodPresets()))

  // ── Vault File Manager ───────────────────────────────────────────────────
  ipcMain.handle('vault:list', wrapHandler((relativePath: unknown) => {
    return listVaultDir(typeof relativePath === 'string' ? relativePath : '')
  }))

  ipcMain.handle('vault:read', wrapHandler(async (relativePath: unknown) => {
    if (typeof relativePath !== 'string') throw new Error('relativePath must be a string')
    const [fileContent, backlinks] = await Promise.all([
      readVaultFile(relativePath),
      getBacklinks(relativePath).catch(() => []),
    ])

    if (!fileContent) {
      return contextResponse(null, 'File not found.', ['Check path and try vault:list to browse available files.'],
        ['vault:list', 'vault:search'])
    }

    const folder = relativePath.includes('/') ? relativePath.split('/').slice(0, -1).join('/') : ''
    const fileName = relativePath.split('/').pop() || relativePath
    const sizeKB = (Buffer.byteLength(fileContent.content, 'utf-8') / 1024).toFixed(1)

    // Extract inline tags
    const tagMatches = fileContent.content.match(/#[a-zA-Z][\w/-]*/g) || []
    const tags = [...new Set(tagMatches)]

    // Count wikilinks
    const wikilinkMatches = fileContent.content.match(/\[\[[^\]]+\]\]/g) || []

    const summary = `Read '${fileName}' (${sizeKB}KB) with ${backlinks.length} backlink(s) and ${wikilinkMatches.length} inline link(s).`
    const suggestions: string[] = []
    if (backlinks.length > 0) suggestions.push(`${backlinks.length} file(s) link here — explore via vault:backlinks.`)
    if (folder) suggestions.push(`File is in ${folder} — list siblings via vault:list.`)
    if (wikilinkMatches.length > 0) suggestions.push(`Contains ${wikilinkMatches.length} wikilink(s) — follow references for related content.`)
    if (tags.length > 0) suggestions.push(`Tags present (${tags.slice(0, 3).join(', ')}) — pivot via vault:files-by-tag for related notes.`)

    return contextResponse(fileContent, summary, suggestions,
      ['vault:backlinks', 'vault:list', 'vault:search', 'vault:write'],
      {
        backlinks: backlinks.map(b => b.title),
        tags,
        folder,
        relatedFiles: backlinks.slice(0, 5).map(b => b.path),
        fileSizeBytes: Buffer.byteLength(fileContent.content, 'utf-8'),
        mtime: fileContent.mtime,
      },
    )
  }))

  ipcMain.handle('vault:write', wrapHandler((relativePath: unknown, content: unknown) => {
    if (typeof relativePath !== 'string') throw new Error('relativePath must be a string')
    if (typeof content !== 'string') throw new Error('content must be a string')
    return writeVaultFile(relativePath, content)
  }))

  ipcMain.handle('vault:search', wrapHandler(async (query: unknown, glob?: unknown, limit?: unknown) => {
    if (typeof query !== 'string') throw new Error('query must be a string')
    const results = await searchVault(
      query,
      typeof glob === 'string' ? glob : undefined,
      typeof limit === 'number' ? limit : undefined,
    )

    const folders = [...new Set(results.map(r => r.path.includes('/') ? r.path.split('/').slice(0, -1).join('/') : '(root)'))]
    const fileCount = new Set(results.map(r => r.path)).size
    const folderCounts: Record<string, number> = {}
    const tagCounts: Record<string, number> = {}
    for (const r of results) {
      const folder = r.path.includes('/') ? r.path.split('/').slice(0, -1).join('/') : '(root)'
      folderCounts[folder] = (folderCounts[folder] || 0) + 1
      const tags = (r.text.match(/#[a-zA-Z][\w/-]*/g) || []).slice(0, 4)
      for (const t of tags) tagCounts[t] = (tagCounts[t] || 0) + 1
    }
    const topFolders = Object.entries(folderCounts).sort((a, b) => b[1] - a[1]).slice(0, 3)
    const topTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 4)

    const summary = `Found ${results.length} result(s) for '${query}' across ${fileCount} file(s) in ${folders.length} folder(s).`
    const suggestions: string[] = []
    if (folders.length > 1) suggestions.push(`Results span ${folders.slice(0, 3).join(', ')}${folders.length > 3 ? ` and ${folders.length - 3} more` : ''} — narrow with glob parameter.`)
    if (topTags.length > 0) suggestions.push(`Top tags in matches: ${topTags.map(([t]) => t).join(', ')} — pivot using vault:files-by-tag.`)
    if (results.length >= (typeof limit === 'number' ? limit : 20)) suggestions.push('Result limit reached — use vault:search with higher limit or glob filter.')
    suggestions.push('Read specific files via vault:read for full content.')

    return contextResponse(results, summary, suggestions,
      ['vault:read', 'vault:backlinks', 'vault:tags', 'vault:files-by-tag'],
      { folders, topFolders, topTags, folderHierarchyDepth: Math.max(0, ...folders.map(f => f === '(root)' ? 0 : f.split('/').length)), matchCount: results.length, fileCount, query },
    )
  }))

  ipcMain.handle('vault:tags', wrapHandler(() => getVaultTags()))

  ipcMain.handle('vault:files-by-tag', wrapHandler((tag: unknown) => {
    if (typeof tag !== 'string') throw new Error('tag must be a string')
    return getFilesByTag(tag)
  }))

  ipcMain.handle('vault:backlinks', wrapHandler((relativePath: unknown) => {
    if (typeof relativePath !== 'string') throw new Error('relativePath must be a string')
    return getBacklinks(relativePath)
  }))

  ipcMain.handle('vault:create', wrapHandler((relativePath: unknown, content?: unknown) => {
    if (typeof relativePath !== 'string') throw new Error('relativePath must be a string')
    return createVaultFile(relativePath, typeof content === 'string' ? content : '')
  }))

  ipcMain.handle('vault:create-folder', wrapHandler((relativePath: unknown) => {
    if (typeof relativePath !== 'string') throw new Error('relativePath must be a string')
    return createVaultFolder(relativePath)
  }))

  ipcMain.handle('vault:rename', wrapHandler((oldPath: unknown, newPath: unknown) => {
    if (typeof oldPath !== 'string' || typeof newPath !== 'string') throw new Error('paths must be strings')
    return renameVaultFile(oldPath, newPath)
  }))

  ipcMain.handle('vault:delete', wrapHandler((relativePath: unknown) => {
    if (typeof relativePath !== 'string') throw new Error('relativePath must be a string')
    return deleteVaultFile(relativePath)
  }))

  ipcMain.handle('vault:index', wrapHandler(() => indexVault()))

  ipcMain.handle('vault:search-indexed', wrapHandler((query: unknown, limit?: unknown) => {
    if (typeof query !== 'string') throw new Error('query must be a string')
    return searchIndexed(query, typeof limit === 'number' ? limit : undefined)
  }))

  ipcMain.handle('vault:build-search-index', wrapHandler(() => buildSearchIndex()))

  ipcMain.handle('vault:graph-data', wrapHandler((scope?: unknown, centerPath?: unknown) => {
    return getVaultGraph(
      typeof scope === 'string' ? scope as 'full' | 'local' | 'tag' : 'full',
      typeof centerPath === 'string' ? centerPath : undefined,
    )
  }))

  // ── Slack Bridge ──────────────────────────────────────────────────────
  ipcMain.handle('slack:status', wrapHandler(() => ({
    running: isSlackBridgeRunning(),
    configured: !!(process.env.SLACK_BOT_TOKEN && process.env.SLACK_APP_TOKEN),
  })))
  ipcMain.handle('slack:start', wrapHandler(() => startSlackBridge()))
  ipcMain.handle('slack:stop', wrapHandler(() => stopSlackBridge()))

  // ── Capabilities (epic #50) ───────────────────────────────────────────
  // Stub until subsystems report in (#54/#55). `overall` becomes aggregated once `items` has keys.
  ipcMain.handle('capabilities:status', wrapHandler(() => ({
    updatedAt: new Date().toISOString(),
    overall: 'unknown',
    items: {} as Record<string, string>,
  })))

  // ── Veritas Control Plane ──────────────────────────────────────────────
  ipcMain.handle('veritas:status', wrapHandler(() => getVeritasStatus()))
  ipcMain.handle('veritas:start', wrapHandler(() => startVeritasService()))
  ipcMain.handle('veritas:stop', wrapHandler(() => stopVeritasService()))
  ipcMain.handle('veritas:restart', wrapHandler(() => restartVeritasService()))
  ipcMain.handle('veritas:logs', wrapHandler((tail: unknown) => {
    const num = typeof tail === 'number' ? tail : 120
    return getVeritasLogs(num)
  }))
  ipcMain.handle('veritas:open', wrapHandler(async () => {
    const status = await getVeritasStatus()
    await shell.openExternal(status.webUrl)
    return { success: true, url: status.webUrl }
  }))
  ipcMain.handle('veritas:tasks', wrapHandler((status: unknown) => {
    if (status !== undefined && typeof status !== 'string') {
      throw new Error('status must be a string when provided')
    }
    const parsedStatus = status as VeritasTaskStatus | undefined
    if (
      parsedStatus &&
      !['todo', 'in-progress', 'blocked', 'done'].includes(parsedStatus)
    ) {
      throw new Error('status must be one of: todo, in-progress, blocked, done')
    }
    return listVeritasTasks(parsedStatus)
  }))
  ipcMain.handle('veritas:task-counts', wrapHandler(() => getVeritasTaskCounts()))
  ipcMain.handle('veritas:create-task', wrapHandler((
    title: unknown,
    description: unknown,
    project: unknown,
    priority: unknown,
  ) => {
    if (typeof title !== 'string' || !title.trim()) {
      throw new Error('title must be a non-empty string')
    }
    if (description !== undefined && typeof description !== 'string') {
      throw new Error('description must be a string when provided')
    }
    if (project !== undefined && typeof project !== 'string') {
      throw new Error('project must be a string when provided')
    }
    if (
      priority !== undefined &&
      (typeof priority !== 'string' || !['low', 'medium', 'high'].includes(priority))
    ) {
      throw new Error('priority must be one of: low, medium, high')
    }
    return createVeritasTask({
      title: title.trim(),
      description: typeof description === 'string' ? description : '',
      project: typeof project === 'string' && project.trim() ? project.trim() : undefined,
      priority: (typeof priority === 'string' ? priority : 'medium') as 'low' | 'medium' | 'high',
    })
  }))
  ipcMain.handle('veritas:update-task-status', wrapHandler((taskId: unknown, status: unknown) => {
    if (typeof taskId !== 'string' || !taskId.trim()) {
      throw new Error('taskId must be a non-empty string')
    }
    if (
      typeof status !== 'string' ||
      !['todo', 'in-progress', 'blocked', 'done'].includes(status)
    ) {
      throw new Error('status must be one of: todo, in-progress, blocked, done')
    }
    return updateVeritasTaskStatus(taskId.trim(), status as VeritasTaskStatus)
  }))

  // ── iTerm2 / Session Health ──────────────────────────────────────────────
  ipcMain.handle('sessions:iterm-status', wrapHandler(() => getITermStatus()))

  ipcMain.handle('sessions:prune', wrapHandler(async (maxIdleMinutes?: unknown) => {
    const mins = typeof maxIdleMinutes === 'number' ? maxIdleMinutes : 60
    const result = await pruneStaleSessions(mins)
    const summary = result.killed.length > 0
      ? `Pruned ${result.killed.length} stale session(s): ${result.killed.map(k => `PID ${k.pid} (${k.uptime})`).join(', ')}`
      : `No stale sessions to prune (${result.skipped.length} checked, all active or recent).`
    console.log(`[sessions:prune] ${summary}`)
    return contextResponse(result, summary, [], ['sessions:list'])
  }))

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
  ipcMain.handle('orchestrator:credits', wrapHandler(() => getAllAgentCredits()))
  ipcMain.handle('orchestrator:prune', wrapHandler(() => {
    const result = pruneTaskQueue()
    const summary = `Pruned ${result.removed} terminal tasks, kept ${result.kept} (active + 20 most recent).`
    console.log(`[orchestrator:prune] ${summary}`)
    return contextResponse(result, summary, [], ['orchestrator:queue'])
  }))
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
  ipcMain.handle('github:consolidate', wrapHandler(() => consolidateTrackedIssues()))
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

  // ── Data Scripts ──────────────────────────────────────────────────────
  registerDataScriptHandlers()
}

export function registerPreferenceIpc(store: PreferenceStore) {
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
  ipcMain.handle('preferences:generate-pairs', wrapHandler(async () => {
    const { PairGenerator } = await import('./preferences/pairs')
    const generator = new PairGenerator(store)
    const dataDir = path.resolve(__dirname, '..', 'data')
    const outPath = path.join(dataDir, 'dpo-pairs.jsonl')
    const count = await generator.export(outPath, 'jsonl')
    return { count, path: outPath }
  }))
}
