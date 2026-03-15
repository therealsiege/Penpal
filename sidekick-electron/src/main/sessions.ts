import fs from 'fs'
import path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import os from 'os'

const execAsync = promisify(exec)

const CLAUDE_SESSIONS_DIR = path.join(os.homedir(), '.claude', 'sessions')
const CLAUDE_PROJECTS_DIR = path.join(os.homedir(), '.claude', 'projects')

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
}

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

function getLastUserMessage(sessionId: string): string {
  try {
    // Search for the JSONL file across all project dirs
    const projectDirs = fs.readdirSync(CLAUDE_PROJECTS_DIR)
    for (const dir of projectDirs) {
      const jsonlPath = path.join(CLAUDE_PROJECTS_DIR, dir, `${sessionId}.jsonl`)
      if (!fs.existsSync(jsonlPath)) continue

      const content = fs.readFileSync(jsonlPath, 'utf-8')
      const lines = content.trim().split('\n')

      // Walk backwards to find last user text message
      for (let i = lines.length - 1; i >= 0; i--) {
        try {
          const entry = JSON.parse(lines[i])
          if (entry.type !== 'user') continue

          const msg = entry.message
          if (!msg) continue

          const content = typeof msg === 'object' ? msg.content : msg
          if (typeof content === 'string' && content.trim().length > 2) {
            const text = content.trim()
            if (text.startsWith('<')) continue // skip XML system messages
            return text.slice(0, 200)
          }
        } catch { /* skip malformed lines */ }
      }
    }
  } catch { /* no JSONL found */ }
  return ''
}

export async function getClaudeSessions(): Promise<ClaudeSession[]> {
  if (!fs.existsSync(CLAUDE_SESSIONS_DIR)) return []

  const sessionFiles = fs.readdirSync(CLAUDE_SESSIONS_DIR).filter(f => f.endsWith('.json'))
  const sessions: ClaudeSession[] = []

  for (const file of sessionFiles) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(CLAUDE_SESSIONS_DIR, file), 'utf-8'))
      const pid = data.pid as number
      const alive = await isProcessAlive(pid)

      if (!alive) continue // skip dead sessions

      const stats = await getProcessStats(pid)
      const lastUserMessage = getLastUserMessage(data.sessionId)

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
      })
    } catch { /* skip bad files */ }
  }

  // Sort by memory usage descending (most active first)
  sessions.sort((a, b) => b.memoryMB - a.memoryMB)
  return sessions
}
