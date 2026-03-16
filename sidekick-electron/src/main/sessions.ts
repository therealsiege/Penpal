import fs from 'fs'
import path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import os from 'os'

const execAsync = promisify(exec)

const CLAUDE_SESSIONS_DIR = path.join(os.homedir(), '.claude', 'sessions')
const CLAUDE_PROJECTS_DIR = path.join(os.homedir(), '.claude', 'projects')

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
  tty: string
  terminalName: string
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

async function isProcessAlive(pid: number): Promise<boolean> {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

async function getProcessStats(pid: number): Promise<{ cpu: string; memoryMB: number; tty: string }> {
  try {
    const { stdout } = await execAsync(
      `ps -o %cpu=,%mem=,rss=,tty= -p ${pid} 2>/dev/null`,
    )
    const parts = stdout.trim().split(/\s+/)
    return {
      cpu: `${parseFloat(parts[0] || '0').toFixed(1)}%`,
      memoryMB: Math.round(parseInt(parts[2] || '0', 10) / 1024),
      tty: parts[3] || '',
    }
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

function getLastUserMessage(sessionId: string): string {
  const jsonlPath = findJsonlPath(sessionId)
  if (!jsonlPath) return ''

  try {
    const content = fs.readFileSync(jsonlPath, 'utf-8')
    const lines = content.trim().split('\n')

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
  } catch { /* */ }
  return ''
}

// ── iTerm2 Session Name ────────────────────────────────────────────────────

async function getITermSessionName(tty: string): Promise<string> {
  try {
    const { stdout } = await execAsync(`osascript -e '
      tell application "iTerm2"
        repeat with w in windows
          repeat with t in tabs of w
            repeat with s in sessions of t
              if tty of s is "/dev/${tty}" then
                return name of s
              end if
            end repeat
          end repeat
        end repeat
        return ""
      end tell
    '`)
    return stdout.trim()
  } catch {
    return ''
  }
}

// ── Get Sessions ────────────────────────────────────────────────────────────

export async function getClaudeSessions(): Promise<ClaudeSession[]> {
  if (!fs.existsSync(CLAUDE_SESSIONS_DIR)) return []

  const sessionFiles = fs.readdirSync(CLAUDE_SESSIONS_DIR).filter(f => f.endsWith('.json'))
  const sessions: ClaudeSession[] = []

  for (const file of sessionFiles) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(CLAUDE_SESSIONS_DIR, file), 'utf-8'))
      const pid = data.pid as number
      const alive = await isProcessAlive(pid)

      if (!alive) continue

      const stats = await getProcessStats(pid)
      const lastUserMessage = getLastUserMessage(data.sessionId)
      const terminalName = stats.tty ? await getITermSessionName(stats.tty) : ''

      sessions.push({
        pid,
        sessionId: data.sessionId,
        project: path.basename(data.cwd || ''),
        cwd: data.cwd || '',
        startedAt: data.startedAt || 0,
        uptime: formatUptime(data.startedAt || Date.now()),
        cpu: stats.cpu,
        memoryMB: stats.memoryMB,
        alive,
        lastUserMessage,
        tty: stats.tty,
        terminalName,
      })
    } catch { /* skip bad files */ }
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
          // Skip empty, XML-only, and tool result messages
          if (text && text.length > 1 && !text.startsWith('<task-notification') && !text.startsWith('<system-reminder')) {
            // Filter out messages that are purely tool results
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
  // Escape single quotes and backslashes for AppleScript
  const escaped = message.replace(/\\/g, '\\\\').replace(/"/g, '\\"')

  try {
    await execAsync(`osascript -e '
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
    '`)
    return { success: true }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

export async function focusSession(tty: string): Promise<{ success: boolean; error?: string }> {
  try {
    await execAsync(`osascript -e '
      tell application "iTerm2"
        activate
        repeat with w in windows
          repeat with t in tabs of w
            repeat with s in sessions of t
              if tty of s is "/dev/${tty}" then
                select s
                tell t to select
                set index of w to 1
                return "focused"
              end if
            end repeat
          end repeat
        end repeat
        return "not_found"
      end tell
    '`)
    return { success: true }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

export async function createNewSession(cwd: string): Promise<{ success: boolean; error?: string }> {
  // Validate the directory exists
  if (!fs.existsSync(cwd)) {
    return { success: false, error: `Directory not found: ${cwd}` }
  }

  const escapedCwd = cwd.replace(/"/g, '\\"')

  try {
    await execAsync(`osascript -e '
      tell application "iTerm2"
        activate
        tell current window
          create tab with default profile
          tell current session
            write text "cd \\"${escapedCwd}\\" && claude-composer --yolo"
          end tell
        end tell
      end tell
    '`)
    return { success: true }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}
