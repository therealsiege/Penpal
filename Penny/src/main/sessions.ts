import fs from 'fs'
import path from 'path'
import { exec, execFileSync, spawn } from 'child_process'
import { proxySpawn } from './spawn-proxy'
import { promisify } from 'util'
import os from 'os'
import {
  buildAgentCliArgs,
  buildAgentHeadlessInvocation,
  getHeadlessBackendChain,
  getTaskRunnerKind,
  headlessFailureShouldFallback,
  saveAgentSession,
  type BuildCliOpts,
  type HeadlessBackend,
  type HeadlessInvocation,
  type HeadlessPhase,
} from './agents'
import { runOllama } from './ollama-client'

const execAsync = promisify(exec)

const CLAUDE_SESSIONS_DIR = path.join(os.homedir(), '.claude', 'sessions')
const CLAUDE_PROJECTS_DIR = path.join(os.homedir(), '.claude', 'projects')

// ── Command Resolution ─────────────────────────────────────────────────────
// Electron launched from Finder/Dock inherits a minimal PATH from launchd,
// which may not include /opt/homebrew/bin, ~/.local/bin, or ~/.nvm paths.
// We probe well-known locations so `spawn('claude', ...)` doesn't ENOENT.

const EXTRA_BIN_DIRS = [
  '/opt/homebrew/bin',
  '/usr/local/bin',
  path.join(os.homedir(), '.local', 'bin'),
  path.join(os.homedir(), '.nvm', 'versions', 'node', process.versions?.node ?? '', 'bin'),
]

const commandPathCache = new Map<string, string>()

function resolveCommandPath(command: string): string {
  // Already absolute or relative path
  if (command.includes('/')) return command

  const cached = commandPathCache.get(command)
  if (cached) return cached

  // Check current PATH dirs first, then well-known extras (no subprocess spawn)
  const pathDirs = (process.env.PATH || '').split(':')
  const allDirs = [...pathDirs, ...EXTRA_BIN_DIRS]

  for (const dir of allDirs) {
    if (!dir) continue
    const candidate = path.join(dir, command)
    try {
      if (fs.existsSync(candidate)) {
        commandPathCache.set(command, candidate)
        return candidate
      }
    } catch { /* skip */ }
  }

  // Fall back to bare command (let spawn try PATH)
  return command
}

// ── iTerm2 Circuit Breaker ──────────────────────────────────────────────────
let itermConsecutiveTimeouts = 0
let itermBackoffUntil = 0
let itermLastSuccessfulResult = new Map<string, string>()

// ── OpenClaw Detection Cache ────────────────────────────────────────────────
export interface OpenClawInfo {
  supervised: boolean
  runtime?: 'openclaw' | 'nemoclaw'
  sessionId?: string
  agentId?: string
  sandboxed?: boolean
}
const openclawCache = new Map<number, { info: OpenClawInfo; checkedAt: number }>()
const OPENCLAW_CACHE_TTL = 60_000 // Re-check every 60s

// ── Session Crash Tracking ──────────────────────────────────────────────────
/** PIDs seen in the previous poll cycle — used to detect crashed sessions */
let previousSessionPids = new Set<number>()
/** Recently crashed sessions — kept for 10s so UI can show "crashed" badge */
const crashedSessions = new Map<string, { session: ClaudeSession; crashedAt: number }>()

function resolveUserPath(inputPath: string): string {
  const raw = (inputPath || '').trim()
  if (!raw) return raw

  const home = os.homedir()
  if (raw === '~') return home
  if (raw.startsWith('~/')) return path.join(home, raw.slice(2))
  if (raw === '$HOME') return home
  if (raw.startsWith('$HOME/')) return path.join(home, raw.slice('$HOME/'.length))

  return raw
}

// ── Types ───────────────────────────────────────────────────────────────────

export interface ClaudeSession {
  pid: number
  sessionId: string
  project: string
  cwd: string
  startedAt: number
  uptime: string
  cpu: string
  memoryMB: number
  alive: boolean
  lastUserMessage: string
  lastAssistantBlurb: string
  tty: string
  terminalName: string
  waitingForInput: boolean
  sessionMode: SessionMode
  interactionType: InteractionType
  subAgentInvocations: SubAgentInvocation[]
  parseErrors: number
  lastError: string | null
  contextUtilization: number | undefined
  contextRotDetected: boolean
}

export interface ConversationMessage {
  role: 'user' | 'assistant'
  text: string
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatUptime(startedAt: number): string {
  const diff = Date.now() - startedAt
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  const remainMins = mins % 60
  if (hours < 24) return `${hours}h ${remainMins}m`
  const days = Math.floor(hours / 24)
  return `${days}d ${hours % 24}h`
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

// ── Process-based session discovery ─────────────────────────────────────────

function normalizeTty(tty: string): string {
  if (!tty || tty === '??') return ''
  return tty.replace(/^\/dev\//, '')
}

function isClaudeSessionProcess(command: string): boolean {
  if (!command) return false
  const lower = command.toLowerCase()

  // Reject VSCode extension helper processes
  if (lower.includes('code helper') && lower.includes('claude')) return false

  // Reject MCP server processes
  if (lower.includes('start-mcp-server')) return false
  if (lower.includes('mcp serve')) return false
  if (lower.includes('mcp-server')) return false

  // Look for claude or claude-composer as the main executable
  const tokens = command.trim().split(/\s+/)
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    // Skip runtime prefixes (node, env, etc.)
    if (token === 'node' || token.endsWith('/node') || token === 'env' || token.endsWith('/env')) continue
    if (token.startsWith('-')) continue // node flags like --max-old-space-size

    const base = (token.split('/').pop() || '').replace(/\.(js|mjs|cjs|ts)$/, '')
    if (base === 'claude' || base === 'claude-composer') {
      return true
    }
    // First real token wasn't claude — stop looking
    break
  }

  return false
}

interface ClaudeProcess {
  pid: number
  ppid: number
  tty: string
  cpu: string
  memoryMB: number
  startedAt: number
  command: string
}

async function getWorkingDirectory(pid: number): Promise<string> {
  try {
    const { stdout } = await execAsync(
      `lsof -a -p ${pid} -d cwd -Fn 2>/dev/null`,
    )
    const cwdLine = stdout
      .trim()
      .split('\n')
      .find(line => line.startsWith('n'))
    return cwdLine?.slice(1).trim() || os.homedir()
  } catch {
    return os.homedir()
  }
}

function parseElapsedTimeToStart(etime: string): number {
  // etime format: [[dd-]hh:]mm:ss
  let days = 0
  let hours = 0
  let mins = 0
  let secs = 0

  const trimmed = etime.trim()
  if (!trimmed) return Date.now()

  const daySplit = trimmed.split('-')
  const timePart = daySplit.length > 1 ? daySplit[daySplit.length - 1] : daySplit[0]
  if (daySplit.length > 1) days = parseInt(daySplit[0] || '0', 10) || 0

  const parts = timePart.split(':').map(n => parseInt(n, 10) || 0)
  if (parts.length === 3) {
    hours = parts[0]
    mins = parts[1]
    secs = parts[2]
  } else if (parts.length === 2) {
    mins = parts[0]
    secs = parts[1]
  } else if (parts.length === 1) {
    secs = parts[0]
  }

  const elapsedSec = days * 86400 + hours * 3600 + mins * 60 + secs
  return Date.now() - elapsedSec * 1000
}

async function findClaudeProcesses(): Promise<{ pid: number; tty: string; cpu: string; memoryMB: number; startedAt: number; cwd: string }[]> {
  try {
    const { stdout } = await execAsync(
      'ps -ww -eo pid=,ppid=,tty=,%cpu=,rss=,etime=,command= 2>/dev/null',
    )

    const matched: ClaudeProcess[] = []
    for (const rawLine of stdout.split('\n')) {
      const line = rawLine.trim()
      if (!line) continue

      const match = line.match(/^(\d+)\s+(\d+)\s+(\S+)\s+(\S+)\s+(\d+)\s+(\S+)\s+(.+)$/)
      if (!match) continue

      const pid = parseInt(match[1], 10)
      if (!Number.isFinite(pid) || pid <= 0) continue

      const command = match[7]
      if (!isClaudeSessionProcess(command)) continue

      const cpuVal = parseFloat(match[4] || '0')
      const memoryKB = parseInt(match[5] || '0', 10)

      matched.push({
        pid,
        ppid: parseInt(match[2], 10),
        tty: normalizeTty(match[3]),
        cpu: `${(Number.isFinite(cpuVal) ? cpuVal : 0).toFixed(1)}%`,
        memoryMB: Math.round((Number.isFinite(memoryKB) ? memoryKB : 0) / 1024),
        startedAt: parseElapsedTimeToStart(match[6]),
        command,
      })
    }

    // Deduplicate parent/child pairs — keep the child (actual TUI), not the launcher.
    // A "parent" is any matched process whose PID is another matched process's PPID.
    const pidSet = new Set(matched.map(p => p.pid))
    const isParent = new Set<number>()
    for (const p of matched) {
      if (pidSet.has(p.ppid) && p.ppid !== p.pid) {
        isParent.add(p.ppid)
      }
    }
    const children = matched.filter(p => !isParent.has(p.pid))

    // Resolve CWDs in parallel
    const cwdResults = await Promise.all(children.map(p => getWorkingDirectory(p.pid)))

    const withCwd = children.map((p, i) => ({
      pid: p.pid,
      tty: p.tty,
      cpu: p.cpu,
      memoryMB: p.memoryMB,
      startedAt: p.startedAt,
      cwd: cwdResults[i],
    }))

    // Deduplicate by CWD — keep highest memory process
    const byCwd = new Map<string, typeof withCwd[0]>()
    for (const proc of withCwd) {
      const existing = byCwd.get(proc.cwd)
      if (!existing || proc.memoryMB > existing.memoryMB) {
        byCwd.set(proc.cwd, proc)
      }
    }

    return Array.from(byCwd.values())
  } catch {
    return []
  }
}

function cwdToProjectDir(cwd: string): string | null {
  try {
    // Claude encodes paths by replacing / with -
    // e.g., /Users/cj/SideKick → -Users-cj-SideKick
    const encoded = cwd.replace(/\//g, '-')
    const dirs = fs.readdirSync(CLAUDE_PROJECTS_DIR)

    // Exact match first
    if (dirs.includes(encoded)) return encoded

    // Also try with leading dash stripped
    const withoutLeading = encoded.replace(/^-/, '')
    if (dirs.includes(withoutLeading)) return withoutLeading

    // Fuzzy: check if decoded dir matches CWD
    for (const dir of dirs) {
      const decoded = '/' + dir.replace(/-/g, '/')
      if (decoded === cwd) return dir
    }
  } catch { /* */ }
  return null
}

function findActiveSessionId(projectDir: string): { sessionId: string; jsonlPath: string } | null {
  const dirPath = path.join(CLAUDE_PROJECTS_DIR, projectDir)
  try {
    const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.jsonl'))
    if (files.length === 0) return null

    let latest: { file: string; mtime: number } | null = null
    for (const file of files) {
      const filePath = path.join(dirPath, file)
      const stat = fs.statSync(filePath)
      if (!latest || stat.mtimeMs > latest.mtime) {
        latest = { file, mtime: stat.mtimeMs }
      }
    }

    if (!latest) return null
    const sessionId = latest.file.replace(/\.jsonl$/, '')
    return { sessionId, jsonlPath: path.join(dirPath, latest.file) }
  } catch {
    return null
  }
}

async function getProcessStats(pid: number): Promise<{ cpu: string; memoryMB: number; tty: string }> {
  try {
    const { stdout } = await execAsync(
      `ps -o %cpu=,%mem=,rss=,tty= -p ${pid} 2>/dev/null`,
    )
    const parts = stdout.trim().split(/\s+/)
    const cpu = `${parseFloat(parts[0] || '0').toFixed(1)}%`
    const memoryMB = Math.round(parseInt(parts[2] || '0', 10) / 1024)

    // Claude allocates its own PTY for its TUI, so the process tty differs
    // from the iTerm2 session tty. Walk up the parent chain to find the
    // shell's tty, which is the one iTerm2 knows about.
    let tty = parts[3] || ''
    try {
      const { stdout: chain } = await execAsync(
        `ps -o pid=,ppid=,tty= -p ${pid} 2>/dev/null`,
      )
      let ppid = parseInt(chain.trim().split(/\s+/)[1] || '0', 10)
      for (let depth = 0; depth < 6 && ppid > 1; depth++) {
        const { stdout: parentInfo } = await execAsync(
          `ps -o ppid=,tty= -p ${ppid} 2>/dev/null`,
        )
        const pParts = parentInfo.trim().split(/\s+/)
        const parentTty = pParts[1] || ''
        if (parentTty && parentTty !== '??' && parentTty !== tty) {
          tty = parentTty
          break
        }
        ppid = parseInt(pParts[0] || '0', 10)
      }
    } catch { /* keep original tty */ }

    return { cpu, memoryMB, tty }
  } catch {
    return { cpu: '0%', memoryMB: 0, tty: '' }
  }
}

function findJsonlPath(sessionId: string): string | null {
  try {
    const projectDirs = fs.readdirSync(CLAUDE_PROJECTS_DIR)
    for (const dir of projectDirs) {
      const jsonlPath = path.join(CLAUDE_PROJECTS_DIR, dir, `${sessionId}.jsonl`)
      if (fs.existsSync(jsonlPath)) return jsonlPath
    }
  } catch { /* */ }
  return null
}

// ── OpenClaw Process Detection ──────────────────────────────────────────────

async function detectOpenClaw(pid: number): Promise<OpenClawInfo> {
  const cached = openclawCache.get(pid)
  if (cached && Date.now() - cached.checkedAt < OPENCLAW_CACHE_TTL) {
    return cached.info
  }

  const noSupervision: OpenClawInfo = { supervised: false }

  try {
    // Strategy 1: Check parent process command for OpenClaw/NemoClaw
    const { stdout: ppidStr } = await execAsync(`ps -o ppid= -p ${pid} 2>/dev/null`)
    const ppid = parseInt(ppidStr.trim(), 10)
    if (ppid > 1) {
      const { stdout: parentCmd } = await execAsync(
        `ps -o command= -p ${ppid} 2>/dev/null`,
      )
      const cmd = parentCmd.trim().toLowerCase()
      if (cmd.includes('nemoclaw')) {
        const info: OpenClawInfo = { supervised: true, runtime: 'nemoclaw', sandboxed: true }
        openclawCache.set(pid, { info, checkedAt: Date.now() })
        return info
      }
      if (cmd.includes('openclaw') || cmd.includes('claw')) {
        const info: OpenClawInfo = { supervised: true, runtime: 'openclaw' }
        openclawCache.set(pid, { info, checkedAt: Date.now() })
        return info
      }
    }

    // Strategy 2: Check environment variables via ps eww
    const { stdout: envStr } = await execAsync(
      `ps eww -o command= -p ${pid} 2>/dev/null`,
    )
    const envLine = envStr.trim()
    if (envLine.includes('OPENCLAW_SESSION_ID=') || envLine.includes('ACP_AGENT_ID=')) {
      const sessionIdMatch = envLine.match(/OPENCLAW_SESSION_ID=(\S+)/)
      const agentIdMatch = envLine.match(/ACP_AGENT_ID=(\S+)/)
      const isSandboxed = envLine.includes('NEMOCLAW_SANDBOX=')
      const info: OpenClawInfo = {
        supervised: true,
        runtime: isSandboxed ? 'nemoclaw' : 'openclaw',
        sessionId: sessionIdMatch?.[1],
        agentId: agentIdMatch?.[1],
        sandboxed: isSandboxed,
      }
      openclawCache.set(pid, { info, checkedAt: Date.now() })
      return info
    }
  } catch { /* detection failed — assume not supervised */ }

  openclawCache.set(pid, { info: noSupervision, checkedAt: Date.now() })
  return noSupervision
}

// ── Shared JSONL reading ────────────────────────────────────────────────────
// Read the JSONL file once and extract all needed data from the parsed lines.
// This eliminates the 3x redundant file reads per session per tick.

interface SessionData {
  lastUserMessage: string
  lastAssistantBlurb: string
  analysis: SessionAnalysis
  parseErrors: number
  lastError: string | null
  contextUtilization: number | undefined
  contextRotDetected: boolean
}

function readSessionData(sessionId: string): SessionData {
  const jsonlPath = findJsonlPath(sessionId)
  if (!jsonlPath) {
    return {
      lastUserMessage: '',
      lastAssistantBlurb: '',
      analysis: { waitingForInput: false, mode: 'idle', interactionType: 'none', subAgentInvocations: [] },
      parseErrors: 0,
      lastError: null,
      contextUtilization: undefined,
      contextRotDetected: false,
    }
  }

  let lines: string[]
  let parseErrors = 0
  let lastError: string | null = null
  try {
    const content = fs.readFileSync(jsonlPath, 'utf-8')
    const rawLines = content.trim().split('\n')

    // Filter out lines that fail to parse — track errors
    lines = []
    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i]
      if (!line.trim()) continue
      try {
        JSON.parse(line) // validate
        lines.push(line)
      } catch (e) {
        // Skip the last line if it fails (likely half-written)
        if (i === rawLines.length - 1) {
          // Truncated mid-write — skip silently
        } else {
          parseErrors++
          lastError = `Line ${i + 1}: ${(e as Error).message}`
        }
      }
    }
  } catch (e) {
    return {
      lastUserMessage: '',
      lastAssistantBlurb: '',
      analysis: { waitingForInput: false, mode: 'error', interactionType: 'none', subAgentInvocations: [] },
      parseErrors: 1,
      lastError: (e as Error).message,
      contextUtilization: undefined,
      contextRotDetected: false,
    }
  }

  const analysis = analyzeLines(lines)
  // If there are parse errors and the mode would otherwise be idle, flag as error
  if (parseErrors > 0 && analysis.mode === 'idle') {
    analysis.mode = 'error'
  }

  // Estimate context utilization from total character count in JSONL lines.
  // Claude's context window is ~200K tokens; rough heuristic: 4 chars ~ 1 token.
  const CONTEXT_WINDOW_TOKENS = 200_000
  let totalChars = 0
  for (const line of lines) totalChars += line.length
  const estimatedTokens = totalChars / 4
  const contextUtilization = Math.min(1, estimatedTokens / CONTEXT_WINDOW_TOKENS)
  // Compressing mode is a strong signal of very high utilization
  const isCompressing = analysis.mode === 'compressing'
  const contextRotDetected = isCompressing || contextUtilization >= 0.85

  return {
    lastUserMessage: extractLastUserMessage(lines),
    lastAssistantBlurb: extractLastAssistantBlurb(lines),
    analysis,
    parseErrors,
    lastError,
    contextUtilization: isCompressing ? 0.95 : contextUtilization,
    contextRotDetected,
  }
}

function extractLastUserMessage(lines: string[]): string {
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const entry = JSON.parse(lines[i])
      if (entry.type !== 'user') continue
      const msg = entry.message
      if (!msg) continue
      const c = typeof msg === 'object' ? msg.content : msg
      if (typeof c === 'string' && c.trim().length > 2 && !c.trim().startsWith('<')) {
        return c.trim().slice(0, 200)
      }
    } catch { /* skip */ }
  }
  return ''
}

function extractLastAssistantBlurb(lines: string[]): string {
  // Walk backwards to find the last assistant text
  for (let i = lines.length - 1; i >= Math.max(0, lines.length - 20); i--) {
    try {
      const entry = JSON.parse(lines[i])
      if (entry.type !== 'assistant') continue
      const msg = entry.message
      const c = typeof msg === 'object' ? msg.content : msg
      let text = ''
      if (typeof c === 'string') {
        text = c
      } else if (Array.isArray(c)) {
        text = c.filter((b: { type?: string }) => b.type === 'text')
          .map((b: { text?: string }) => b.text || '').join(' ')
      }
      text = text.trim()
      if (text.length < 2) continue
      // Return the first line, truncated
      const firstLine = text.split('\n')[0].slice(0, 80)
      return firstLine
    } catch { /* skip */ }
  }
  return ''
}

export type SessionMode = 'working' | 'plan' | 'accept-edits' | 'waiting' | 'idle' | 'compressing' | 'error' | 'disconnected' | 'crashed'

// Finer-grained classification of WHY the session needs interaction (or doesn't)
export type InteractionType =
  | 'tool-approval'  // Last assistant block has pending tool_use (stop_reason=tool_use, no result yet)
  | 'question'       // Last assistant block used AskUserQuestion tool
  | 'accept-edits'   // File edits pending accept/reject
  | 'idle-prompt'    // Assistant finished naturally (end_turn), waiting for next user instruction
  | 'none'           // Actively working or truly idle with no pending interaction

export interface SubAgentInvocation {
  description: string
  timestamp: number
  status: 'active' | 'completed'
}

interface SessionAnalysis {
  waitingForInput: boolean
  mode: SessionMode
  interactionType: InteractionType
  subAgentInvocations: SubAgentInvocation[]
}

// Public wrapper that reads the file (for external callers like pods.ts)
export function analyzeSession(sessionId: string): SessionAnalysis {
  const jsonlPath = findJsonlPath(sessionId)
  if (!jsonlPath) return { waitingForInput: false, mode: 'idle', interactionType: 'none', subAgentInvocations: [] }
  try {
    const content = fs.readFileSync(jsonlPath, 'utf-8')
    const lines = content.trim().split('\n')
    return analyzeLines(lines)
  } catch {
    return { waitingForInput: false, mode: 'idle', interactionType: 'none', subAgentInvocations: [] }
  }
}

// Core analysis logic operating on pre-read lines
function analyzeLines(lines: string[]): SessionAnalysis {
  let inPlanMode = false

  // Track sub-agent invocations: map from tool_use_id to invocation info
  const agentInvocations = new Map<string, SubAgentInvocation>()

  // Scan ALL lines for plan mode state (not just last 50 — long sessions can
  // push the toggle beyond that window)
  for (let i = 0; i < lines.length; i++) {
    try {
      const entry = JSON.parse(lines[i])
      if (entry.type === 'assistant') {
        const msg = entry.message
        const blocks = typeof msg === 'object' ? msg.content : null
        if (!Array.isArray(blocks)) continue
        for (const b of blocks) {
          if (b.type === 'tool_use' && b.name === 'EnterPlanMode') inPlanMode = true
          if (b.type === 'tool_use' && b.name === 'ExitPlanMode') inPlanMode = false
          // Also track Agent invocations in the same pass
          if (b.type === 'tool_use' && b.name === 'Agent') {
            const toolUseId = b.id || `agent-${i}`
            const input = b.input || {}
            const description = input.description
              ? String(input.description).slice(0, 100)
              : input.prompt
                ? String(input.prompt).slice(0, 80)
                : 'Sub-agent'
            const ts = entry.timestamp
              ? (typeof entry.timestamp === 'string' ? new Date(entry.timestamp).getTime() : entry.timestamp)
              : 0
            agentInvocations.set(toolUseId, {
              description,
              timestamp: ts,
              status: 'active',
            })
          }
        }
      }
      // Check for tool_result entries that complete Agent invocations.
      if (entry.type === 'user') {
        const msg = entry.message
        const c = typeof msg === 'object' ? msg.content : null
        if (Array.isArray(c)) {
          for (const b of c) {
            if (b.type === 'tool_result' && b.tool_use_id && agentInvocations.has(b.tool_use_id)) {
              const resultText = Array.isArray(b.content)
                ? b.content.filter((r: { type?: string }) => r.type === 'text').map((r: { text?: string }) => r.text || '').join('')
                : (typeof b.content === 'string' ? b.content : '')
              if (!resultText.includes('Async agent launched successfully')) {
                agentInvocations.get(b.tool_use_id)!.status = 'completed'
              }
            }
          }
        }
        // Also detect completion via XML task-notification in user message content
        const msgContent = typeof msg === 'object' ? msg.content : msg
        const rawText = typeof msgContent === 'string' ? msgContent : ''
        if (rawText.includes('<task-notification>') && rawText.includes('<status>completed</status>')) {
          const toolUseIdMatch = rawText.match(/<tool-use-id>([^<]+)<\/tool-use-id>/)
          if (toolUseIdMatch) {
            const tid = toolUseIdMatch[1].trim()
            if (agentInvocations.has(tid)) {
              agentInvocations.get(tid)!.status = 'completed'
            }
          }
        }
      }
      // Detect completion via queue-operation enqueue with task-notification content
      if (entry.type === 'queue-operation' && entry.operation === 'enqueue' && typeof entry.content === 'string') {
        const qContent = entry.content
        if (qContent.includes('<task-notification>') && qContent.includes('<status>completed</status>')) {
          const toolUseIdMatch = qContent.match(/<tool-use-id>([^<]+)<\/tool-use-id>/)
          if (toolUseIdMatch) {
            const tid = toolUseIdMatch[1].trim()
            if (agentInvocations.has(tid)) {
              agentInvocations.get(tid)!.status = 'completed'
            }
          }
        }
      }
    } catch { /* skip */ }
  }

  const subAgentInvocations = [...agentInvocations.values()]

  // Check if session just compressed (last user message is a continuation summary)
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const entry = JSON.parse(lines[i])
      if (entry.type === 'user') {
        const msg = entry.message
        const content = typeof msg === 'object' ? msg.content : msg
        const text = typeof content === 'string' ? content : Array.isArray(content)
          ? content.filter((b: { type?: string }) => b.type === 'text').map((b: { text?: string }) => b.text || '').join('')
          : ''
        if (text.includes('continued from a previous conversation that ran out of context')) {
          return { waitingForInput: false, mode: 'compressing', interactionType: 'none', subAgentInvocations }
        }
        break
      }
      if (entry.type === 'assistant') break
    } catch { /* skip */ }
  }

  // ── Walk backwards to find the last meaningful message ───────────────────
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const entry = JSON.parse(lines[i])

      // Skip non-conversational entries
      if (entry.type === 'system' || entry.type === 'queue-operation' ||
          entry.type === 'file-history-snapshot' || entry.type === 'debug') continue

      if (entry.type === 'assistant') {
        const msg = entry.message
        const stopReason: string = (typeof msg === 'object' ? msg.stop_reason : null) || ''
        const blocks = typeof msg === 'object' ? msg.content : null

        if (Array.isArray(blocks)) {
          const toolUses = blocks.filter((b: { type?: string }) => b.type === 'tool_use')

          if (toolUses.length > 0) {
            const toolUseIds = new Set(toolUses.map((b: { id?: string }) => b.id).filter(Boolean))
            let toolsAlreadyResolved = false

            // Look ahead for a user entry that contains tool_results for ALL these ids
            for (let j = i + 1; j < lines.length; j++) {
              try {
                const nextEntry = JSON.parse(lines[j])
                if (nextEntry.type === 'assistant') break // another assistant turn started
                if (nextEntry.type === 'user') {
                  const nextMsg = nextEntry.message
                  const nextC = typeof nextMsg === 'object' ? nextMsg.content : null
                  if (Array.isArray(nextC)) {
                    const resolvedIds = new Set(
                      nextC
                        .filter((b: { type?: string; tool_use_id?: string }) =>
                          b.type === 'tool_result' && b.tool_use_id && toolUseIds.has(b.tool_use_id))
                        .map((b: { tool_use_id?: string }) => b.tool_use_id),
                    )
                    if (resolvedIds.size === toolUseIds.size) {
                      toolsAlreadyResolved = true
                    }
                  }
                  break
                }
              } catch { /* skip */ }
            }

            if (!toolsAlreadyResolved) {
              // Tool uses are pending — determine what kind
              const toolNames = toolUses.map((b: { name?: string }) => b.name || '')

              if (toolNames.includes('AskUserQuestion')) {
                return { waitingForInput: true, mode: 'waiting', interactionType: 'question', subAgentInvocations }
              }

              const isEdit = toolNames.some((n: string) =>
                ['Edit', 'Write', 'Replace', 'MultiEdit', 'NotebookEdit',
                  'replace_symbol_body', 'insert_after_symbol', 'insert_before_symbol',
                ].includes(n))
              if (isEdit) {
                return { waitingForInput: true, mode: 'accept-edits', interactionType: 'accept-edits', subAgentInvocations }
              }

              if (inPlanMode) {
                return { waitingForInput: true, mode: 'plan', interactionType: 'tool-approval', subAgentInvocations }
              }

              return { waitingForInput: true, mode: 'waiting', interactionType: 'tool-approval', subAgentInvocations }
            }
          }

          if (stopReason === 'end_turn') {
            const c = typeof msg === 'object' ? msg.content : msg
            const text = typeof c === 'string' ? c : Array.isArray(c)
              ? c.filter((b: { type?: string }) => b.type === 'text').map((b: { text?: string }) => b.text || '').join('')
              : ''
            if (text.trim().length > 1) {
              return {
                waitingForInput: true,
                mode: inPlanMode ? 'plan' : 'waiting',
                interactionType: 'idle-prompt',
                subAgentInvocations,
              }
            }
          }

          // Fallback: text-only assistant message (no stop_reason in block)
          const c = typeof msg === 'object' ? msg.content : msg
          const text = typeof c === 'string' ? c : Array.isArray(c)
            ? c.filter((b: { type?: string }) => b.type === 'text').map((b: { text?: string }) => b.text || '').join('')
            : ''
          if (text.trim().length > 1) {
            return {
              waitingForInput: true,
              mode: inPlanMode ? 'plan' : 'waiting',
              interactionType: 'idle-prompt',
              subAgentInvocations,
            }
          }
        } else {
          const text = typeof msg === 'string' ? msg : ''
          if (text.trim().length > 1) {
            return {
              waitingForInput: true,
              mode: inPlanMode ? 'plan' : 'waiting',
              interactionType: stopReason === 'end_turn' ? 'idle-prompt' : 'none',
              subAgentInvocations,
            }
          }
        }
      }

      if (entry.type === 'user') {
        return { waitingForInput: false, mode: inPlanMode ? 'plan' : 'working', interactionType: 'none', subAgentInvocations }
      }
    } catch { /* skip */ }
  }

  return { waitingForInput: false, mode: 'idle', interactionType: 'none', subAgentInvocations: [] }
}

// ── iTerm2 Session Name ────────────────────────────────────────────────────

// Batch-fetch all iTerm2 session names in a single osascript call
// Circuit breaker: after 2 consecutive timeouts, skip for 30s and serve stale cache
async function getAllITermSessionNames(): Promise<Map<string, string>> {
  // Check circuit breaker
  if (itermConsecutiveTimeouts >= 2 && Date.now() < itermBackoffUntil) {
    console.log(`[iTerm2] Circuit breaker active — serving cached names (${itermLastSuccessfulResult.size} entries)`)
    return itermLastSuccessfulResult
  }

  const result = new Map<string, string>()
  try {
    // Use spawn instead of exec to ensure we can SIGKILL the child on timeout.
    // exec + timeout sends SIGTERM which osascript may ignore, leaking file descriptors.
    const stdout = await new Promise<string>((resolve, reject) => {
      let out = ''
      const child = spawn('osascript', ['-e', `
        set output to ""
        tell application "iTerm2"
          repeat with w in windows
            repeat with t in tabs of w
              repeat with s in sessions of t
                set output to output & (tty of s) & "|||" & (name of s) & "\n"
              end repeat
            end repeat
          end repeat
        end tell
        return output
      `], { stdio: ['ignore', 'pipe', 'ignore'] })
      child.stdout!.on('data', (d: Buffer) => { out += d.toString() })
      child.on('close', (code) => code === 0 ? resolve(out) : reject(new Error(`osascript exited ${code}`)))
      child.on('error', reject)
      const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('timeout')) }, 2000)
      child.on('close', () => clearTimeout(timer))
    })
    for (const line of stdout.trim().split('\n')) {
      const sep = line.indexOf('|||')
      if (sep === -1) continue
      const tty = line.slice(0, sep).replace('/dev/', '')
      const name = line.slice(sep + 3)
      if (tty && name) result.set(tty, name)
    }
    // Success — reset circuit breaker
    itermConsecutiveTimeouts = 0
    itermLastSuccessfulResult = result
  } catch {
    itermConsecutiveTimeouts++
    if (itermConsecutiveTimeouts >= 2) {
      itermBackoffUntil = Date.now() + 30_000
      console.warn(`[iTerm2] ${itermConsecutiveTimeouts} consecutive timeouts — backing off 30s`)
    }
    // Return last successful result during failures
    return itermLastSuccessfulResult
  }
  return result
}

// ── Get Sessions ────────────────────────────────────────────────────────────

async function getClaudeSessionsLegacy(): Promise<ClaudeSession[]> {
  if (!fs.existsSync(CLAUDE_SESSIONS_DIR)) return []

  const sessionFiles = fs.readdirSync(CLAUDE_SESSIONS_DIR).filter(f => f.endsWith('.json'))

  // Phase 1: Quick sync filter — only keep alive sessions
  const aliveSessions: { data: Record<string, unknown>; pid: number }[] = []
  for (const file of sessionFiles) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(CLAUDE_SESSIONS_DIR, file), 'utf-8'))
      const pid = data.pid as number
      if (isProcessAlive(pid)) {
        aliveSessions.push({ data, pid })
      }
    } catch { /* skip bad files */ }
  }

  // Phase 2: Parallel async work — process stats + iTerm names + OpenClaw detection
  const [statsResults, itermNames, openclawResults] = await Promise.all([
    Promise.all(aliveSessions.map(s => getProcessStats(s.pid))),
    getAllITermSessionNames(),
    Promise.all(aliveSessions.map(s => detectOpenClaw(s.pid))),
  ])

  // Phase 3: Sync JSONL reads + assembly
  const sessions: ClaudeSession[] = []
  const currentPids = new Set<number>()
  for (let i = 0; i < aliveSessions.length; i++) {
    const { data, pid } = aliveSessions[i]
    const stats = statsResults[i]
    const sessionData = readSessionData(data.sessionId as string)
    const terminalName = stats.tty ? (itermNames.get(stats.tty) || '') : ''
    currentPids.add(pid)

    // Stale TTY detection — validate tty device still exists
    let tty = stats.tty
    let sessionMode = sessionData.analysis.mode
    if (tty) {
      const ttyPath = tty.startsWith('/dev/') ? tty : `/dev/${tty}`
      if (!fs.existsSync(ttyPath)) {
        console.warn(`[sessions] Stale TTY detected: ${ttyPath} for pid ${pid}`)
        tty = '' // Clear stale tty
        sessionMode = 'disconnected'
        // Clear iTerm name cache for this tty
        itermLastSuccessfulResult.delete(stats.tty)
      }
    }

    sessions.push({
      pid,
      sessionId: data.sessionId as string,
      project: path.basename((data.cwd as string) || ''),
      cwd: (data.cwd as string) || '',
      startedAt: typeof data.startedAt === 'string' ? new Date(data.startedAt).getTime() : ((data.startedAt as number) || 0),
      uptime: formatUptime(typeof data.startedAt === 'string' ? new Date(data.startedAt).getTime() : ((data.startedAt as number) || Date.now())),
      cpu: stats.cpu,
      memoryMB: stats.memoryMB,
      alive: true,
      lastUserMessage: sessionData.lastUserMessage,
      lastAssistantBlurb: sessionData.lastAssistantBlurb,
      tty,
      terminalName,
      waitingForInput: sessionData.analysis.waitingForInput,
      sessionMode,
      interactionType: sessionData.analysis.interactionType,
      subAgentInvocations: sessionData.analysis.subAgentInvocations,
      parseErrors: sessionData.parseErrors,
      lastError: sessionData.lastError,
      contextUtilization: sessionData.contextUtilization,
      contextRotDetected: sessionData.contextRotDetected,
    })
  }

  // ── Crash detection — find sessions that disappeared since last poll ────
  const now = Date.now()
  for (const prevPid of previousSessionPids) {
    if (!currentPids.has(prevPid)) {
      // This PID was alive last poll but is gone now
      // Find its last known session data from crashedSessions or log it
      console.warn(`[sessions] Session pid=${prevPid} disappeared (crashed or ended)`)
    }
  }
  previousSessionPids = currentPids

  // Clean up expired crashed sessions (older than 10s)
  for (const [key, entry] of crashedSessions) {
    if (now - entry.crashedAt > 10_000) {
      crashedSessions.delete(key)
    }
  }

  // Clean up stale OpenClaw cache entries
  for (const [pid, entry] of openclawCache) {
    if (!currentPids.has(pid) && now - entry.checkedAt > OPENCLAW_CACHE_TTL * 2) {
      openclawCache.delete(pid)
    }
  }

  sessions.sort((a, b) => b.memoryMB - a.memoryMB)
  return sessions
}

/** Get OpenClaw info for a specific PID (used by IPC layer) */
export async function getOpenClawInfo(pid: number): Promise<OpenClawInfo> {
  return detectOpenClaw(pid)
}

/** Check iTerm2 circuit breaker status */
export function getITermStatus(): { healthy: boolean; consecutiveTimeouts: number; backoffUntil: number } {
  return {
    healthy: itermConsecutiveTimeouts < 2,
    consecutiveTimeouts: itermConsecutiveTimeouts,
    backoffUntil: itermBackoffUntil,
  }
}

export async function getClaudeSessions(): Promise<ClaudeSession[]> {
  // Legacy path: if ~/.claude/sessions/ has session files, use file-based discovery
  if (fs.existsSync(CLAUDE_SESSIONS_DIR)) {
    const legacySessions = await getClaudeSessionsLegacy()
    if (legacySessions.length > 0) return legacySessions
  }

  // Process-based discovery
  const processes = await findClaudeProcesses()
  if (processes.length === 0) return []

  // Batch: iTerm names + process stats in parallel
  const [itermNames, ...statsResults] = await Promise.all([
    getAllITermSessionNames(),
    ...processes.map(p => getProcessStats(p.pid)),
  ])

  const sessions: ClaudeSession[] = []
  for (let i = 0; i < processes.length; i++) {
    const proc = processes[i]
    const stats = statsResults[i]

    // Map CWD to project directory, then find active session transcript
    const projectDir = cwdToProjectDir(proc.cwd)
    const activeSession = projectDir ? findActiveSessionId(projectDir) : null
    const sessionId = activeSession?.sessionId || `proc-${proc.pid}`

    // Read session data from JSONL (reuses existing parsing)
    const sessionData = activeSession ? readSessionData(sessionId) : {
      lastUserMessage: '',
      lastAssistantBlurb: '',
      analysis: { waitingForInput: false, mode: 'idle' as SessionMode, interactionType: 'none' as InteractionType, subAgentInvocations: [] as SubAgentInvocation[] },
    }

    // Prefer parent-walked TTY from getProcessStats (resolves Claude's internal PTY
    // to the shell's TTY that iTerm2 knows about)
    const tty = stats.tty || proc.tty
    const terminalName = tty ? (itermNames.get(tty) || '') : ''

    sessions.push({
      pid: proc.pid,
      sessionId,
      project: path.basename(proc.cwd) || '',
      cwd: proc.cwd,
      startedAt: proc.startedAt,
      uptime: formatUptime(proc.startedAt),
      cpu: stats.cpu,
      memoryMB: stats.memoryMB || proc.memoryMB,
      alive: true,
      lastUserMessage: sessionData.lastUserMessage,
      lastAssistantBlurb: sessionData.lastAssistantBlurb,
      tty,
      terminalName,
      waitingForInput: sessionData.analysis.waitingForInput,
      sessionMode: sessionData.analysis.mode,
      interactionType: sessionData.analysis.interactionType,
      subAgentInvocations: sessionData.analysis.subAgentInvocations,
    })
  }

  sessions.sort((a, b) => b.memoryMB - a.memoryMB)
  return sessions
}

// ── Get Conversation ────────────────────────────────────────────────────────

function extractText(content: unknown): string {
  if (typeof content === 'string') return content

  if (Array.isArray(content)) {
    const texts: string[] = []
    for (const block of content) {
      if (typeof block === 'string') {
        texts.push(block)
      } else if (block && typeof block === 'object') {
        if (block.type === 'text' && typeof block.text === 'string') {
          texts.push(block.text)
        } else if (block.type === 'tool_use') {
          texts.push(`[tool: ${block.name || 'unknown'}]`)
        } else if (block.type === 'tool_result') {
          // skip tool results in display
        }
      }
    }
    return texts.join('\n')
  }

  return ''
}

export function getSessionConversation(sessionId: string, limit = 50): ConversationMessage[] {
  const jsonlPath = findJsonlPath(sessionId)
  if (!jsonlPath) return []

  const messages: ConversationMessage[] = []

  try {
    const content = fs.readFileSync(jsonlPath, 'utf-8')
    const lines = content.trim().split('\n')

    for (const line of lines) {
      try {
        const entry = JSON.parse(line)

        if (entry.type === 'user') {
          const msg = entry.message
          const c = typeof msg === 'object' ? msg.content : msg
          const text = extractText(c).trim()
          if (text && text.length > 1 && !text.startsWith('<task-notification') && !text.startsWith('<system-reminder')) {
            if (typeof c === 'string' || (Array.isArray(c) && c.some((b: { type?: string }) => b.type === 'text'))) {
              const cleanText = text.replace(/<[^>]+>/g, '').trim()
              if (cleanText.length > 1) {
                messages.push({ role: 'user', text: cleanText })
              }
            }
          }
        }

        if (entry.type === 'assistant') {
          const msg = entry.message
          const c = typeof msg === 'object' ? msg.content : msg
          const text = extractText(c).trim()
          if (text && text.length > 1) {
            messages.push({ role: 'assistant', text })
          }
        }
      } catch { /* skip */ }
    }
  } catch { /* */ }

  return messages.slice(-limit)
}

// ── Terminal Interaction ────────────────────────────────────────────────────

export async function sendToSession(tty: string, message: string): Promise<{ success: boolean; error?: string }> {
  if (!tty) {
    return { success: false, error: 'No tty provided' }
  }

  // Escape for AppleScript double-quoted string
  const escaped = message
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r/g, '')
    .replace(/\n/g, '\\n')

  console.log(`[sendToSession] tty=/dev/${tty} msg="${message.slice(0, 50)}"`)

  // Pipe AppleScript via stdin to avoid shell escaping issues with quotes
  const script = `
    tell application "iTerm2"
      repeat with w in windows
        repeat with t in tabs of w
          repeat with s in sessions of t
            if tty of s is "/dev/${tty}" then
              tell s to write text "${escaped}"
              return "sent"
            end if
          end repeat
        end repeat
      end repeat
      return "not_found"
    end tell
  `

  try {
    const result = await new Promise<string>((resolve, reject) => {
      const child = spawn('osascript', ['-'])
      let stdout = ''
      let stderr = ''
      child.stdout.on('data', (d: Buffer) => { stdout += d.toString() })
      child.stderr.on('data', (d: Buffer) => { stderr += d.toString() })
      child.on('close', (code: number) => {
        if (code !== 0) reject(new Error(stderr.trim() || `osascript exited ${code}`))
        else resolve(stdout.trim())
      })
      child.stdin.write(script)
      child.stdin.end()
    })

    console.log(`[sendToSession] result=${result}`)
    if (result === 'not_found') {
      return { success: false, error: `Session tty /dev/${tty} not found in iTerm2` }
    }
    return { success: true }
  } catch (err) {
    console.error(`[sendToSession] error:`, err)
    return { success: false, error: (err as Error).message }
  }
}

// Pipe AppleScript via stdin (safe from tty injection)
function runAppleScriptSafe(script: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('osascript', ['-'])
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (d: Buffer) => { stdout += d.toString() })
    child.stderr.on('data', (d: Buffer) => { stderr += d.toString() })
    child.on('close', (code: number) => {
      if (code !== 0) reject(new Error(stderr.trim() || `osascript exited ${code}`))
      else resolve(stdout.trim())
    })
    child.stdin.write(script)
    child.stdin.end()
  })
}

export async function focusSession(tty: string): Promise<{ success: boolean; error?: string }> {
  console.log(`[focusSession] searching for tty=/dev/${tty}`)
  try {
    const result = await runAppleScriptSafe(`
      tell application "iTerm2"
        activate
        repeat with w in windows
          repeat with t in tabs of w
            repeat with s in sessions of t
              if tty of s is "/dev/${tty}" then
                tell w
                  select t
                end tell
                tell t
                  select s
                end tell
                set index of w to 1
                return "focused"
              end if
            end repeat
          end repeat
        end repeat
        return "not_found"
      end tell
    `)
    console.log(`[focusSession] iTerm2 result=${result}`)
    if (result === 'not_found') {
      return { success: false, error: 'Session not found in iTerm2' }
    }
    // Best-effort AXRaise to ensure window comes to front on macOS Ventura+
    try {
      await runAppleScriptSafe(`
        tell application "System Events"
          tell process "iTerm2"
            set frontmost to true
            perform action "AXRaise" of window 1
          end tell
        end tell
      `)
    } catch { /* AXRaise is best-effort */ }
    return { success: true }
  } catch (err) {
    console.error(`[focusSession] error:`, err)
    return { success: false, error: (err as Error).message }
  }
}

export async function focusByName(name: string, cwd?: string): Promise<{ success: boolean; error?: string }> {
  const searchTerms = [name]
  if (cwd) searchTerms.push(path.basename(cwd))
  console.log(`[focusByName] searching for name containing: ${searchTerms.join(' or ')}`)

  // Build AppleScript that checks session name against search terms
  const conditions = searchTerms
    .map(term => {
      const escaped = term.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
      return `sessName contains "${escaped}"`
    })
    .join(' or ')

  try {
    const result = await runAppleScriptSafe(`
      tell application "iTerm2"
        activate
        repeat with w in windows
          repeat with t in tabs of w
            repeat with s in sessions of t
              set sessName to name of s
              if ${conditions} then
                tell w
                  select t
                end tell
                tell t
                  select s
                end tell
                set index of w to 1
                try
                  tell application "System Events"
                    tell process "iTerm2"
                      set frontmost to true
                      perform action "AXRaise" of window 1
                    end tell
                  end tell
                end try
                return "focused"
              end if
            end repeat
          end repeat
        end repeat
        return "not_found"
      end tell
    `)
    console.log(`[focusByName] result=${result}`)
    if (result === 'not_found') {
      return { success: false, error: `No iTerm2 session matching "${name}"` }
    }
    return { success: true }
  } catch (err) {
    console.error(`[focusByName] error:`, err)
    return { success: false, error: (err as Error).message }
  }
}

export async function broadcastToSessions(message: string): Promise<{ sent: number; failed: number }> {
  const sessions = await getClaudeSessions()
  let sent = 0
  let failed = 0

  for (const session of sessions) {
    if (!session.tty) { failed++; continue }
    const result = await sendToSession(session.tty, message)
    if (result.success) sent++
    else failed++
    // Small delay between sends to avoid overwhelming iTerm2
    await new Promise(r => setTimeout(r, 200))
  }

  return { sent, failed }
}

export async function createNewSession(cwd: string): Promise<{ success: boolean; error?: string }> {
  const resolvedCwd = resolveUserPath(cwd)
  if (!fs.existsSync(resolvedCwd)) {
    return { success: false, error: `Directory not found: ${cwd}` }
  }

  const escapedCwd = resolvedCwd.replace(/"/g, '\\"')

  try {
    await runAppleScriptSafe(`
      tell application "iTerm2"
        activate
        tell current window
          create tab with default profile
          tell current session
            write text "cd \\"${escapedCwd}\\" && claude-composer --yolo"
          end tell
        end tell
      end tell
    `)
    return { success: true }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

export async function createAgentSession(
  agentId: string,
  cwd: string,
  dispatch = false,
): Promise<{ success: boolean; error?: string }> {
  const resolvedCwd = resolveUserPath(cwd)
  if (!fs.existsSync(resolvedCwd)) {
    return { success: false, error: `Directory not found: ${cwd}` }
  }

  // Create a git worktree for isolation so multiple agents can work on the same repo
  let sessionCwd = resolvedCwd
  try {
    const isGitRepo = fs.existsSync(path.join(resolvedCwd, '.git'))
    if (isGitRepo) {
      const worktreesRoot = path.join(resolvedCwd, '.penny-worktrees')
      const ts = Date.now()
      const safeName = agentId.replace(/[^a-z0-9-]/gi, '-')
      const worktreePath = path.join(worktreesRoot, `${safeName}-${ts}`)
      const branch = `agent/${safeName}/${ts}`

      fs.mkdirSync(worktreesRoot, { recursive: true })
      // Fetch latest
      try {
        execFileSync('git', ['fetch', 'origin'], {
          cwd: resolvedCwd, encoding: 'utf-8', timeout: 30_000, stdio: 'pipe',
        })
      } catch { /* offline ok */ }

      let baseBranch = 'main'
      try {
        baseBranch = execFileSync('git', ['symbolic-ref', 'refs/remotes/origin/HEAD'], {
          cwd: resolvedCwd, encoding: 'utf-8', timeout: 10_000, stdio: 'pipe',
        }).trim().replace('refs/remotes/origin/', '')
      } catch { /* default main */ }

      execFileSync('git', ['worktree', 'add', worktreePath, '-b', branch, `origin/${baseBranch}`], {
        cwd: resolvedCwd, encoding: 'utf-8', timeout: 60_000, stdio: 'pipe',
      })
      sessionCwd = worktreePath
      console.log(`[sessions] Created worktree for ${agentId}: ${worktreePath} (branch ${branch})`)
    }
  } catch (err) {
    // Worktree creation failed — fall back to shared working tree
    console.warn(`[sessions] Worktree creation failed for ${agentId}, using shared cwd:`, err)
    sessionCwd = resolvedCwd
  }

  let cliArgs: string[]
  try {
    cliArgs = buildAgentCliArgs(agentId, sessionCwd, { dispatch })
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }

  // Write a launcher script to avoid shell/AppleScript escaping hell
  const tmpScript = path.join(os.tmpdir(), `agent-launch-${agentId}.sh`)
  const shellArgs = cliArgs.map(arg => `'${arg.replace(/'/g, "'\\''")}'`).join(' ')
  const scriptContent = `#!/bin/bash\ncd ${JSON.stringify(sessionCwd)} && claude ${shellArgs}\n`
  fs.writeFileSync(tmpScript, scriptContent, { mode: 0o755 })

  const escapedScript = tmpScript.replace(/"/g, '\\"')

  try {
    await runAppleScriptSafe(`
      tell application "iTerm2"
        activate
        tell current window
          create tab with default profile
          tell current session
            write text "${escapedScript}"
          end tell
        end tell
      end tell
    `)

    saveAgentSession(agentId, 'pending', 0, sessionCwd)
    return { success: true }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

// ── Headless agent execution ─────────────────────────────────────────────────

export interface HeadlessResult {
  success: boolean
  output: string
  error?: string
  durationMs: number
}

export interface RunHeadlessOptions {
  permissionMode?: string
  timeoutMs?: number
  /**
   * Selects backend chain from env (`PENNY_TASK_RUNNER_PLAN`, `_EXECUTE`, `_VALIDATE`, `_REVIEW`, comma-separated fallbacks).
   * Omit for legacy behavior: single `PENNY_TASK_RUNNER` with no automatic fallback.
   */
  phase?: HeadlessPhase
  /** Override the agent's default model (e.g. 'opus', 'sonnet', 'haiku'). */
  modelOverride?: string
}

function spawnHeadlessCli(invocation: HeadlessInvocation, timeoutMs: number): Promise<HeadlessResult> {
  const start = Date.now()

  return new Promise<HeadlessResult>((resolve) => {
    const resolvedCommand = resolveCommandPath(invocation.command)
    console.log(`[headless] spawn: ${resolvedCommand} ${invocation.args.slice(0, 3).join(' ')}... cwd=${invocation.cwd}`)

    const childEnv = { ...process.env }
    const currentPath = childEnv.PATH || ''
    const missingDirs = EXTRA_BIN_DIRS.filter(d => !currentPath.includes(d) && fs.existsSync(d))
    if (missingDirs.length > 0) {
      childEnv.PATH = [...missingDirs, currentPath].join(':')
    }
    // Enable forked subagents within spawned agent processes (Claude Code external build flag).
    // When a spawned agent uses the Agent tool internally, it will fork rather than cold-start.
    childEnv.CLAUDE_CODE_FORK_SUBAGENT = '1'

    // Use spawn proxy to avoid Electron EBADF — routes through clean Node worker
    const child = proxySpawn(resolvedCommand, invocation.args, {
      cwd: invocation.cwd,
      env: childEnv,
      timeout: timeoutMs + 10_000, // worker-side kill after timeout + buffer
    })

    let stdout = ''
    let stderr = ''
    let settled = false

    const settle = (result: HeadlessResult) => {
      if (settled) return
      settled = true
      resolve(result)
    }

    const timer = setTimeout(() => {
      child.kill('SIGTERM')
      setTimeout(() => {
        if (!settled) child.kill('SIGKILL')
      }, 5000)
      settle({
        success: false,
        output: stdout.trim(),
        error: `Timed out after ${Math.round(timeoutMs / 1000)}s`,
        durationMs: timeoutMs,
      })
    }, timeoutMs)

    child.stdout.on('data', (chunk: string | Buffer) => { stdout += typeof chunk === 'string' ? chunk : chunk.toString() })
    child.stderr.on('data', (chunk: string | Buffer) => { stderr += typeof chunk === 'string' ? chunk : chunk.toString() })

    child.on('error', (err) => {
      clearTimeout(timer)
      settle({ success: false, output: '', error: err.message, durationMs: Date.now() - start })
    })

    child.on('close', (code) => {
      clearTimeout(timer)
      const durationMs = Date.now() - start
      if (code !== 0) {
        console.error(`[headless] exit ${code} after ${Math.round(durationMs / 1000)}s. stderr: ${stderr.slice(-500)}`)
      } else if (!stdout.trim()) {
        console.warn(`[headless] exit 0 but empty stdout after ${Math.round(durationMs / 1000)}s. stderr: ${stderr.slice(-500)}`)
      }
      if (code === 0) {
        const output = stdout.trim() || stderr.trim()
        settle({ success: true, output, durationMs })
      } else {
        settle({ success: false, output: stdout.trim(), error: stderr || `Exit code ${code}`, durationMs })
      }
    })
  })
}

async function runSingleHeadlessBackend(
  backend: HeadlessBackend,
  agentId: string,
  cwd: string,
  prompt: string,
  opts: { permissionMode?: string; timeoutMs: number; modelOverride?: string; ollamaModel?: string },
): Promise<HeadlessResult> {
  if (backend === 'ollama') {
    const r = await runOllama(prompt, { timeoutMs: opts.timeoutMs, model: opts.ollamaModel })
    return {
      success: r.success,
      output: r.output,
      error: r.error,
      durationMs: r.durationMs,
    }
  }

  let invocation: HeadlessInvocation
  try {
    invocation = buildAgentHeadlessInvocation(agentId, cwd, prompt, {
      headless: true,
      permissionMode: opts.permissionMode,
      runner: backend,
      modelOverride: opts.modelOverride,
    })
  } catch (err) {
    return { success: false, output: '', error: (err as Error).message, durationMs: 0 }
  }

  return spawnHeadlessCli(invocation, opts.timeoutMs)
}

export async function runAgentHeadless(
  agentId: string,
  cwd: string,
  prompt: string,
  opts: RunHeadlessOptions = {},
): Promise<HeadlessResult> {
  const timeoutMs = opts.timeoutMs ?? 600_000

  // If modelOverride is ollama:*, route through OpenCode (which supports tools + file editing)
  // rather than the raw Ollama /api/generate endpoint (text-only)
  if (opts.modelOverride?.startsWith('ollama:')) {
    console.log(`[headless] ollama model via opencode: ${opts.modelOverride} (phase=${opts.phase ?? 'default'})`)
    return runSingleHeadlessBackend('opencode', agentId, cwd, prompt, {
      permissionMode: opts.permissionMode,
      timeoutMs,
      modelOverride: opts.modelOverride,
    })
  }

  const chain: HeadlessBackend[] = opts.phase
    ? getHeadlessBackendChain(opts.phase)
    : [getTaskRunnerKind()]

  let last: HeadlessResult = {
    success: false,
    output: '',
    error: 'No headless backends configured',
    durationMs: 0,
  }

  for (let i = 0; i < chain.length; i++) {
    const backend = chain[i]
    console.log(`[headless] backend ${i + 1}/${chain.length}: ${backend}${opts.phase ? ` (phase=${opts.phase})` : ''}`)
    last = await runSingleHeadlessBackend(backend, agentId, cwd, prompt, {
      permissionMode: opts.permissionMode,
      timeoutMs,
      modelOverride: opts.modelOverride,
    })

    if (last.success) return last

    const tryNext = i < chain.length - 1 && headlessFailureShouldFallback(last.error || '', last.output || '')
    if (tryNext) {
      console.warn(`[headless] ${backend} failed (${(last.error || '').slice(0, 120)}…); trying next backend`)
      continue
    }
    return last
  }

  return last
}

// ── Session Pruning ──────────────────────────────────────────────────────────

export interface PruneResult {
  killed: { pid: number; sessionId: string; uptime: string; mode: string }[]
  skipped: { pid: number; reason: string }[]
}

/**
 * Kill idle Claude sessions that have been running longer than `maxIdleMinutes`.
 * Skips sessions that are actively working (CPU >= 1%), waiting for input,
 * or whose PID matches the current process (self-protection).
 */
export async function pruneStaleSessions(maxIdleMinutes = 60): Promise<PruneResult> {
  const sessions = await getClaudeSessions()
  const result: PruneResult = { killed: [], skipped: [] }
  const selfPid = process.pid

  for (const s of sessions) {
    if (s.pid === selfPid) {
      result.skipped.push({ pid: s.pid, reason: 'self' })
      continue
    }
    if (parseFloat(s.cpu || '0') >= 1) {
      result.skipped.push({ pid: s.pid, reason: 'active (CPU >= 1%)' })
      continue
    }
    if (s.waitingForInput) {
      result.skipped.push({ pid: s.pid, reason: 'waiting for input' })
      continue
    }
    if (s.sessionMode !== 'idle') {
      result.skipped.push({ pid: s.pid, reason: `mode: ${s.sessionMode}` })
      continue
    }
    const ageMs = Date.now() - s.startedAt
    if (ageMs < maxIdleMinutes * 60_000) {
      result.skipped.push({ pid: s.pid, reason: `only ${Math.round(ageMs / 60_000)}m old` })
      continue
    }

    try {
      process.kill(s.pid, 'SIGTERM')
      result.killed.push({ pid: s.pid, sessionId: s.sessionId, uptime: s.uptime, mode: s.sessionMode })
    } catch {
      result.skipped.push({ pid: s.pid, reason: 'kill failed (already dead?)' })
    }
  }

  // Clean up session files for killed PIDs
  for (const k of result.killed) {
    const sessionFile = path.join(CLAUDE_SESSIONS_DIR, `${k.pid}.json`)
    try { fs.unlinkSync(sessionFile) } catch { /* already gone */ }
  }

  return result
}
