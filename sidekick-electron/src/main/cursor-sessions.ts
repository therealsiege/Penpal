import fs from 'fs'
import path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import os from 'os'
import type { SessionMode, InteractionType, SubAgentInvocation } from './sessions'

const execAsync = promisify(exec)

const CURSOR_PROJECTS_DIR = path.join(os.homedir(), '.cursor', 'projects')

export interface CursorAgentSession {
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
  source: 'cursor'
  cursorProject: string
}

// ── Process Discovery ──────────────────────────────────────────────────────

interface AgentProcess {
  pid: number
  tty: string
  cpu: string
  memoryMB: number
  cwd: string
}

async function findCursorAgentProcesses(): Promise<AgentProcess[]> {
  const agents: AgentProcess[] = []
  try {
    const { stdout } = await execAsync(
      `ps -eo pid,tty,%cpu,rss,command 2>/dev/null | grep 'cursor-agent' | grep -v grep | grep -v 'worker-server'`,
    )
    
    for (const line of stdout.trim().split('\n')) {
      if (!line.trim()) continue
      const parts = line.trim().split(/\s+/)
      const pid = parseInt(parts[0], 10)
      const tty = parts[1] || ''
      const cpu = `${parseFloat(parts[2] || '0').toFixed(1)}%`
      const memoryMB = Math.round(parseInt(parts[3] || '0', 10) / 1024)
      if (isNaN(pid) || pid <= 0) continue

      let cwd = ''
      try {
        const { stdout: lsofOut } = await execAsync(
          `lsof -p ${pid} -Fn 2>/dev/null | head -3`,
        )
        const lines = lsofOut.trim().split('\n')
        for (const l of lines) {
          if (l.startsWith('n/') && !l.includes('cursor-agent')) {
            cwd = l.slice(1)
            break
          }
        }
      } catch { /* skip */ }

      agents.push({ pid, tty, cpu, memoryMB, cwd })
    }
  } catch (err) {
    
  }
  return agents
}

// ── Project Mapping ────────────────────────────────────────────────────────

function cwdToProjectDir(cwd: string): string | null {
  const normalizedCwd = cwd.replace(/\//g, '-').replace(/^-/, '')
  try {
    const dirs = fs.readdirSync(CURSOR_PROJECTS_DIR)
    for (const dir of dirs) {
      const decodedPath = '/' + dir.replace(/-/g, '/')
      if (decodedPath === cwd) return dir
    }
    // Fuzzy match: the dir name encodes the path with hyphens
    for (const dir of dirs) {
      if (normalizedCwd.endsWith(dir) || dir.endsWith(normalizedCwd)) return dir
    }
    // Check if any project dir's decoded path is a prefix or matches
    for (const dir of dirs) {
      const parts = dir.split('-')
      const reconstructed = '/' + parts.join('/')
      if (reconstructed === cwd) return dir
    }
  } catch { /* */ }
  return null
}

function findProjectDirByCwd(cwd: string): string | null {
  try {
    const dirs = fs.readdirSync(CURSOR_PROJECTS_DIR)
    for (const dir of dirs) {
      const decoded = '/' + dir.replace(/-/g, '/')
      if (decoded === cwd) return dir
    }
  } catch { /* */ }
  return null
}

// ── Transcript Reading ─────────────────────────────────────────────────────

interface TranscriptData {
  sessionId: string
  lastUserMessage: string
  lastAssistantBlurb: string
  startedAt: number
  waitingForInput: boolean
  sessionMode: SessionMode
  interactionType: InteractionType
}

function getLatestTranscript(projectDir: string): TranscriptData | null {
  const transcriptsDir = path.join(CURSOR_PROJECTS_DIR, projectDir, 'agent-transcripts')
  if (!fs.existsSync(transcriptsDir)) return null

  try {
    const sessionDirs = fs.readdirSync(transcriptsDir)
    if (sessionDirs.length === 0) return null

    // Find the most recently modified transcript
    let latest: { dir: string; mtime: number } | null = null
    for (const dir of sessionDirs) {
      const jsonlPath = path.join(transcriptsDir, dir, `${dir}.jsonl`)
      if (!fs.existsSync(jsonlPath)) continue
      const stat = fs.statSync(jsonlPath)
      if (!latest || stat.mtimeMs > latest.mtime) {
        latest = { dir, mtime: stat.mtimeMs }
      }
    }

    if (!latest) return null

    const jsonlPath = path.join(transcriptsDir, latest.dir, `${latest.dir}.jsonl`)
    const content = fs.readFileSync(jsonlPath, 'utf-8')
    const lines = content.trim().split('\n')

    let lastUserMessage = ''
    let lastAssistantBlurb = ''
    let firstTimestamp = Date.now()

    // Extract first timestamp
    for (const line of lines.slice(0, 5)) {
      try {
        const entry = JSON.parse(line)
        if (entry.timestamp) {
          firstTimestamp = typeof entry.timestamp === 'string'
            ? new Date(entry.timestamp).getTime()
            : entry.timestamp
          break
        }
      } catch { /* skip */ }
    }

    // Walk backwards for last user message
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const entry = JSON.parse(lines[i])
        if (entry.role !== 'user') continue
        const msg = entry.message
        const c = typeof msg === 'object' ? msg.content : msg
        let text = ''
        if (typeof c === 'string') {
          text = c
        } else if (Array.isArray(c)) {
          text = c.filter((b: { type?: string }) => b.type === 'text')
            .map((b: { text?: string }) => b.text || '').join(' ')
        }
        text = text.replace(/<[^>]+>/g, '').trim()
        if (text.length > 2) {
          lastUserMessage = text.slice(0, 200)
          break
        }
      } catch { /* skip */ }
    }

    // Walk backwards for last assistant blurb
    for (let i = lines.length - 1; i >= Math.max(0, lines.length - 20); i--) {
      try {
        const entry = JSON.parse(lines[i])
        if (entry.role !== 'assistant') continue
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
        if (text.length > 2) {
          lastAssistantBlurb = text.split('\n')[0].slice(0, 80)
          break
        }
      } catch { /* skip */ }
    }

    // Determine session state from last entry
    let waitingForInput = false
    let sessionMode: SessionMode = 'idle'
    let interactionType: InteractionType = 'none'

    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const entry = JSON.parse(lines[i])
        if (entry.role === 'assistant') {
          const msg = entry.message
          const blocks = typeof msg === 'object' ? msg.content : null
          if (Array.isArray(blocks)) {
            const toolUses = blocks.filter((b: { type?: string }) => b.type === 'tool_use')
            if (toolUses.length > 0) {
              waitingForInput = true
              sessionMode = 'waiting'
              interactionType = 'tool-approval'
            } else {
              waitingForInput = true
              sessionMode = 'waiting'
              interactionType = 'idle-prompt'
            }
          } else {
            waitingForInput = true
            sessionMode = 'waiting'
            interactionType = 'idle-prompt'
          }
          break
        }
        if (entry.role === 'user') {
          sessionMode = 'working'
          break
        }
      } catch { /* skip */ }
    }

    // Use file mtime as proxy for startedAt if no timestamp found
    const stat = fs.statSync(jsonlPath)
    const startedAt = firstTimestamp || stat.birthtimeMs || stat.mtimeMs

    return {
      sessionId: latest.dir,
      lastUserMessage,
      lastAssistantBlurb,
      startedAt,
      waitingForInput,
      sessionMode,
      interactionType,
    }
  } catch {
    return null
  }
}

// ── Uptime Formatting ──────────────────────────────────────────────────────

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

// ── Public API ─────────────────────────────────────────────────────────────

export async function getCursorAgentSessions(): Promise<CursorAgentSession[]> {
  const agents = await findCursorAgentProcesses()
  
  if (agents.length === 0) return []

  const sessions: CursorAgentSession[] = []

  for (const agent of agents) {
    const projectDir = findProjectDirByCwd(agent.cwd)
    const projectName = agent.cwd.split('/').pop() || 'unknown'

    let transcript: TranscriptData | null = null
    if (projectDir) {
      transcript = getLatestTranscript(projectDir)
    }

    sessions.push({
      pid: agent.pid,
      sessionId: transcript?.sessionId || `cursor-${agent.pid}`,
      project: projectName,
      cwd: agent.cwd,
      startedAt: transcript?.startedAt || Date.now(),
      uptime: formatUptime(transcript?.startedAt || Date.now()),
      cpu: agent.cpu,
      memoryMB: agent.memoryMB,
      alive: true,
      lastUserMessage: transcript?.lastUserMessage || '',
      lastAssistantBlurb: transcript?.lastAssistantBlurb || '',
      tty: agent.tty,
      terminalName: '',
      waitingForInput: transcript?.waitingForInput || false,
      sessionMode: transcript?.sessionMode || 'idle',
      interactionType: transcript?.interactionType || 'none',
      subAgentInvocations: [],
      source: 'cursor',
      cursorProject: projectDir || '',
    })
  }

  return sessions
}

export async function focusCursorIDE(): Promise<{ success: boolean; error?: string }> {
  try {
    await execAsync('open -a "Cursor"')
    return { success: true }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

export function getCursorTranscriptConversation(
  sessionId: string,
  limit = 50,
): { role: 'user' | 'assistant'; text: string }[] {
  try {
    const dirs = fs.readdirSync(CURSOR_PROJECTS_DIR)
    for (const dir of dirs) {
      const jsonlPath = path.join(
        CURSOR_PROJECTS_DIR, dir, 'agent-transcripts', sessionId, `${sessionId}.jsonl`,
      )
      if (!fs.existsSync(jsonlPath)) continue

      const content = fs.readFileSync(jsonlPath, 'utf-8')
      const lines = content.trim().split('\n')
      const messages: { role: 'user' | 'assistant'; text: string }[] = []

      for (const line of lines) {
        try {
          const entry = JSON.parse(line)
          if (entry.role !== 'user' && entry.role !== 'assistant') continue
          const msg = entry.message
          const c = typeof msg === 'object' ? msg.content : msg
          let text = ''
          if (typeof c === 'string') {
            text = c
          } else if (Array.isArray(c)) {
            const parts: string[] = []
            for (const block of c) {
              if (block.type === 'text' && typeof block.text === 'string') {
                parts.push(block.text)
              } else if (block.type === 'tool_use') {
                parts.push(`[tool: ${block.name || 'unknown'}]`)
              }
            }
            text = parts.join('\n')
          }
          text = text.replace(/<[^>]+>/g, '').trim()
          if (text.length > 1) {
            messages.push({ role: entry.role, text })
          }
        } catch { /* skip */ }
      }

      return messages.slice(-limit)
    }
  } catch { /* */ }
  return []
}
