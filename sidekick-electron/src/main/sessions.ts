import fs from 'fs'
import path from 'path'
import { exec, spawn } from 'child_process'
import { promisify } from 'util'
import os from 'os'
import { buildAgentCliArgs, saveAgentSession } from './agents'

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
  lastAssistantBlurb: string
  tty: string
  terminalName: string
  waitingForInput: boolean
  sessionMode: SessionMode
  interactionType: InteractionType
  subAgentInvocations: SubAgentInvocation[]
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

// ── Shared JSONL reading ────────────────────────────────────────────────────
// Read the JSONL file once and extract all needed data from the parsed lines.
// This eliminates the 3x redundant file reads per session per tick.

interface SessionData {
  lastUserMessage: string
  lastAssistantBlurb: string
  analysis: SessionAnalysis
}

function readSessionData(sessionId: string): SessionData {
  const jsonlPath = findJsonlPath(sessionId)
  if (!jsonlPath) {
    return {
      lastUserMessage: '',
      lastAssistantBlurb: '',
      analysis: { waitingForInput: false, mode: 'idle', interactionType: 'none', subAgentInvocations: [] },
    }
  }

  let lines: string[]
  try {
    const content = fs.readFileSync(jsonlPath, 'utf-8')
    lines = content.trim().split('\n')
  } catch {
    return {
      lastUserMessage: '',
      lastAssistantBlurb: '',
      analysis: { waitingForInput: false, mode: 'idle', interactionType: 'none', subAgentInvocations: [] },
    }
  }

  return {
    lastUserMessage: extractLastUserMessage(lines),
    lastAssistantBlurb: extractLastAssistantBlurb(lines),
    analysis: analyzeLines(lines),
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

export type SessionMode = 'working' | 'plan' | 'accept-edits' | 'waiting' | 'idle' | 'compressing'

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

// Public wrapper that reads the file (for external callers like triplets.ts)
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
async function getAllITermSessionNames(): Promise<Map<string, string>> {
  const result = new Map<string, string>()
  try {
    const { stdout } = await execAsync(`osascript -e '
      set output to ""
      tell application "iTerm2"
        repeat with w in windows
          repeat with t in tabs of w
            repeat with s in sessions of t
              set output to output & (tty of s) & "|||" & (name of s) & "\\n"
            end repeat
          end repeat
        end repeat
      end tell
      return output
    '`, { timeout: 5000 })
    for (const line of stdout.trim().split('\n')) {
      const sep = line.indexOf('|||')
      if (sep === -1) continue
      const tty = line.slice(0, sep).replace('/dev/', '')
      const name = line.slice(sep + 3)
      if (tty && name) result.set(tty, name)
    }
  } catch { /* iTerm2 not running or not responding */ }
  return result
}

// ── Get Sessions ────────────────────────────────────────────────────────────

export async function getClaudeSessions(): Promise<ClaudeSession[]> {
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

  // Phase 2: Parallel async work — process stats + iTerm names
  const [statsResults, itermNames] = await Promise.all([
    Promise.all(aliveSessions.map(s => getProcessStats(s.pid))),
    getAllITermSessionNames(),
  ])

  // Phase 3: Sync JSONL reads + assembly
  const sessions: ClaudeSession[] = []
  for (let i = 0; i < aliveSessions.length; i++) {
    const { data, pid } = aliveSessions[i]
    const stats = statsResults[i]
    const sessionData = readSessionData(data.sessionId as string)
    const terminalName = stats.tty ? (itermNames.get(stats.tty) || '') : ''

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
      tty: stats.tty,
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
  if (!fs.existsSync(cwd)) {
    return { success: false, error: `Directory not found: ${cwd}` }
  }

  const escapedCwd = cwd.replace(/"/g, '\\"')

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
  if (!fs.existsSync(cwd)) {
    return { success: false, error: `Directory not found: ${cwd}` }
  }

  let cliArgs: string[]
  try {
    cliArgs = buildAgentCliArgs(agentId, cwd, dispatch)
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }

  // Write a launcher script to avoid shell/AppleScript escaping hell
  const tmpScript = path.join(os.tmpdir(), `agent-launch-${agentId}.sh`)
  const shellArgs = cliArgs.map(arg => `'${arg.replace(/'/g, "'\\''")}'`).join(' ')
  const scriptContent = `#!/bin/bash\ncd ${JSON.stringify(cwd)} && claude ${shellArgs}\n`
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

    saveAgentSession(agentId, 'pending', 0, cwd)
    return { success: true }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}
