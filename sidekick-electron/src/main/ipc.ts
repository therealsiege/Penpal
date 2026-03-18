import { ipcMain, shell, dialog, BrowserWindow } from 'electron'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { checkHealth } from './health'
import { startSlackBridge, stopSlackBridge, isSlackBridgeRunning } from './slack-bridge'
import { getJobStatuses, getJobHistory, forceRunJob } from './scheduler-bridge'
import { getPipelineSummary, getHotLeads, getTerritories, getNewLeads, getGraphStats, searchLeads, getLeadDetail } from './graph'
import {
  getClaudeSessions,
  getSessionConversation,
  sendToSession,
  focusSession,
  focusByName,
  createNewSession,
  createAgentSession,
  broadcastToSessions,
} from './sessions'
import {
  getCursorAgentSessions,
  getCursorTranscriptConversation,
  focusCursorIDE,
} from './cursor-sessions'
import {
  getAgentConfigs,
  getAgentConfig,
  loadAgentSessionMap,
  removeAgentSession,
  type AgentConfig,
  type AgentState,
} from './agents'
import {
  createTriplet,
  listTriplets,
  getTripletStatus,
  pauseTriplet,
  resumeTriplet,
  cancelTriplet,
  getTripletPresets,
} from './triplets'
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
} from './orchestrator'

const HOME = process.env.HOME || '/Users/fuzeelogik'
const VAULT_ROOT = path.join(HOME, 'sidekick', 'Ventures')
const BRIEFINGS_DIR = path.join(VAULT_ROOT, '1Putt', 'Daily Briefings')
const DATA_DIR = path.resolve(__dirname, '..', '..', 'data')

interface VaultFolder {
  name: string
  fileCount: number
  subfolders: string[]
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
  ipcMain.handle('sessions:list', wrapHandler(async () => {
    const [claudeSessions, cursorSessions] = await Promise.all([
      getClaudeSessions(),
      getCursorAgentSessions().catch(() => []),
    ])
    const tagged = claudeSessions.map(s => ({ ...s, source: 'claude' as const }))
    return [...tagged, ...cursorSessions]
  }))
  ipcMain.handle('sessions:conversation', wrapHandler((sessionId: unknown, source?: unknown) => {
    if (typeof sessionId !== 'string') throw new Error('sessionId must be a string')
    if (source === 'cursor') return getCursorTranscriptConversation(sessionId)
    return getSessionConversation(sessionId)
  }))
  ipcMain.handle('sessions:send', wrapHandler((tty: unknown, message: unknown) => {
    if (typeof tty !== 'string' || typeof message !== 'string') throw new Error('tty and message must be strings')
    return sendToSession(tty, message)
  }))
  ipcMain.handle('sessions:focus', wrapHandler((tty: unknown) => {
    if (typeof tty !== 'string') throw new Error('tty must be a string')
    return focusSession(tty)
  }))
  ipcMain.handle('sessions:create', wrapHandler((cwd: unknown) => {
    if (typeof cwd !== 'string') throw new Error('cwd must be a string')
    return createNewSession(cwd)
  }))
  ipcMain.handle('sessions:broadcast', wrapHandler((message: unknown) => {
    if (typeof message !== 'string') throw new Error('message must be a string')
    return broadcastToSessions(message)
  }))
  ipcMain.handle('graph:stats', wrapHandler(() => getGraphStats()))
  ipcMain.handle('leads:search', wrapHandler((query: unknown) => {
    if (typeof query !== 'string') throw new Error('query must be a string')
    return searchLeads(query)
  }))
  ipcMain.handle('leads:detail', wrapHandler((name: unknown) => {
    if (typeof name !== 'string') throw new Error('name must be a string')
    return getLeadDetail(name)
  }))
  ipcMain.handle('briefing:latest', wrapHandler(() => getLatestBriefing()))
  ipcMain.handle('briefing:list', wrapHandler(() => listBriefings()))
  ipcMain.handle('briefing:get', wrapHandler((date: unknown) => {
    if (typeof date !== 'string') throw new Error('date must be a string')
    return getBriefing(date)
  }))

  ipcMain.handle('vault:folders', wrapHandler(() => scanVaultFolders()))

  // ── Ventures File Browser ────────────────────────────────────────────
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

  ipcMain.handle('agents:statuses', wrapHandler(async (): Promise<AgentState[]> => {
    const configs = getAgentConfigs()
    const [sessions, cursorSessions] = await Promise.all([
      getClaudeSessions(),
      getCursorAgentSessions().catch(() => []),
    ])
    const savedMap = loadAgentSessionMap()
    const matchedPids = new Set<number>()
    const agentStates: AgentState[] = []

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
        })
      }
    }

    // Surface unmatched running sessions as freelancers
    for (const session of sessions) {
      if (matchedPids.has(session.pid)) continue

      const projectName = session.project || session.cwd.split('/').pop() || 'unknown'
      const cpuVal = parseFloat(session.cpu || '0')
      const iType = session.interactionType ?? 'none'
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
        tripletRole: 'solver',
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

    // No sub-agents to remove from top-level (they are synthetic, not real sessions)
    const topLevel = agentStates

    return topLevel
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
    return sendToSession(tty, choice)
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

  // ── Triplet Workflow Handlers ──────────────────────────────────────────
  ipcMain.handle('triplet:create', wrapHandler((task: unknown, opts: unknown) => {
    if (typeof task !== 'string') throw new Error('task must be a string')
    return createTriplet(task, (opts as Record<string, unknown>) || {})
  }))

  ipcMain.handle('triplet:list', wrapHandler(() => listTriplets()))

  ipcMain.handle('triplet:status', wrapHandler((workflowId: unknown) => {
    if (typeof workflowId !== 'string') throw new Error('workflowId must be a string')
    return getTripletStatus(workflowId)
  }))

  ipcMain.handle('triplet:pause', wrapHandler((workflowId: unknown) => {
    if (typeof workflowId !== 'string') throw new Error('workflowId must be a string')
    return pauseTriplet(workflowId)
  }))

  ipcMain.handle('triplet:resume', wrapHandler((workflowId: unknown) => {
    if (typeof workflowId !== 'string') throw new Error('workflowId must be a string')
    return resumeTriplet(workflowId)
  }))

  ipcMain.handle('triplet:cancel', wrapHandler((workflowId: unknown) => {
    if (typeof workflowId !== 'string') throw new Error('workflowId must be a string')
    return cancelTriplet(workflowId)
  }))

  ipcMain.handle('triplet:presets', wrapHandler(() => getTripletPresets()))

  // ── Vault File Manager ───────────────────────────────────────────────────
  ipcMain.handle('vault:list', wrapHandler((relativePath: unknown) => {
    return listVaultDir(typeof relativePath === 'string' ? relativePath : '')
  }))

  ipcMain.handle('vault:read', wrapHandler((relativePath: unknown) => {
    if (typeof relativePath !== 'string') throw new Error('relativePath must be a string')
    return readVaultFile(relativePath)
  }))

  ipcMain.handle('vault:write', wrapHandler((relativePath: unknown, content: unknown) => {
    if (typeof relativePath !== 'string') throw new Error('relativePath must be a string')
    if (typeof content !== 'string') throw new Error('content must be a string')
    return writeVaultFile(relativePath, content)
  }))

  ipcMain.handle('vault:search', wrapHandler((query: unknown, glob?: unknown, limit?: unknown) => {
    if (typeof query !== 'string') throw new Error('query must be a string')
    return searchVault(
      query,
      typeof glob === 'string' ? glob : undefined,
      typeof limit === 'number' ? limit : undefined,
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

  // ── Orchestrator ──────────────────────────────────────────────────────
  ipcMain.handle('orchestrator:queue', wrapHandler(() => getTaskQueue()))
  ipcMain.handle('orchestrator:enqueue', wrapHandler((
    title: unknown, description: unknown, project: unknown, priority: unknown,
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
  ipcMain.handle('orchestrator:agent-health', wrapHandler(() => getAgentHealthStatuses()))
  ipcMain.handle('orchestrator:shutdown-agent', wrapHandler((agentId: unknown) => {
    if (typeof agentId !== 'string') throw new Error('agentId must be a string')
    return shutdownAgent(agentId)
  }))
  ipcMain.handle('orchestrator:stats', wrapHandler(() => getOrchestratorStats()))
}
