/**
 * ContextMonitor — Tracks agent context window utilization and detects context rot
 *
 * Context rot: performance degradation from irrelevant accumulated context.
 * Hamel Husain's research shows irrelevant information in long contexts is more
 * harmful than insufficient context.
 *
 * Signals:
 * - Token utilization pressure (estimated from JSONL character count)
 * - Retry rate trend (tool retries increasing over session lifetime)
 * - Success rate decline (task outcomes worsening within a session)
 */

import fs from 'fs'
import path from 'path'
import os from 'os'
import { evalHarness } from '../harness'

const CLAUDE_PROJECTS_DIR = path.join(os.homedir(), '.claude', 'projects')
const CLAUDE_SESSIONS_DIR = path.join(os.homedir(), '.claude', 'sessions')

// ── Types ───────────────────────────────────────────────────────────────────

export interface ContextHealth {
  agentId: string
  sessionId: string
  tokenCount: number
  contextWindowSize: number
  utilizationPct: number
  rotScore: number        // 0-1, higher = more rot detected
  recommendation: 'healthy' | 'warning' | 'compress' | 'restart'
}

// ── Constants ───────────────────────────────────────────────────────────────

const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
  'claude-opus-4-6': 200_000,
  'claude-sonnet-4-6': 200_000,
  'claude-haiku-4-5-20251001': 200_000,
  'claude-sonnet-4-5-20250514': 200_000,
}
const DEFAULT_CONTEXT_WINDOW = 200_000

// Rough chars-per-token estimate for English text
const CHARS_PER_TOKEN = 4

// ── Helpers ─────────────────────────────────────────────────────────────────

export function findJsonlPath(sessionId: string): string | null {
  try {
    const projectDirs = fs.readdirSync(CLAUDE_PROJECTS_DIR)
    for (const dir of projectDirs) {
      const jsonlPath = path.join(CLAUDE_PROJECTS_DIR, dir, `${sessionId}.jsonl`)
      if (fs.existsSync(jsonlPath)) return jsonlPath
    }
  } catch { /* */ }
  return null
}

interface SessionFileInfo {
  sessionId: string
  pid: number
  cwd: string
  startedAt: number
}

function getActiveSessionFiles(): SessionFileInfo[] {
  if (!fs.existsSync(CLAUDE_SESSIONS_DIR)) return []
  const results: SessionFileInfo[] = []
  try {
    const files = fs.readdirSync(CLAUDE_SESSIONS_DIR).filter(f => f.endsWith('.json'))
    for (const file of files) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(CLAUDE_SESSIONS_DIR, file), 'utf-8'))
        // Check if process is alive
        try { process.kill(data.pid, 0) } catch { continue }
        results.push({
          sessionId: data.sessionId as string,
          pid: data.pid as number,
          cwd: (data.cwd as string) || '',
          startedAt: typeof data.startedAt === 'string'
            ? new Date(data.startedAt).getTime()
            : (data.startedAt as number) || 0,
        })
      } catch { /* skip bad files */ }
    }
  } catch { /* */ }
  return results
}

// ── JSONL Analysis ──────────────────────────────────────────────────────────

interface JsonlAnalysis {
  totalChars: number
  retryRateFirstHalf: number
  retryRateSecondHalf: number
  toolCallCount: number
  toolErrorCount: number
}

function extractTextLength(content: unknown): number {
  if (typeof content === 'string') return content.length
  if (Array.isArray(content)) {
    let len = 0
    for (const block of content) {
      if (typeof block === 'string') {
        len += block.length
      } else if (block && typeof block === 'object') {
        if (block.type === 'text' && typeof block.text === 'string') {
          len += block.text.length
        } else if (block.type === 'tool_use') {
          len += JSON.stringify(block.input || {}).length
        } else if (block.type === 'tool_result') {
          const rc = block.content
          if (typeof rc === 'string') len += rc.length
          else if (Array.isArray(rc)) {
            for (const r of rc) {
              if (typeof r === 'string') len += r.length
              else if (r && typeof r.text === 'string') len += r.text.length
            }
          }
        }
      }
    }
    return len
  }
  return 0
}

interface ToolEvent {
  index: number
  name: string
  isError: boolean
}

export function analyzeJsonl(jsonlPath: string): JsonlAnalysis {
  let totalChars = 0
  const toolEvents: ToolEvent[] = []

  try {
    const content = fs.readFileSync(jsonlPath, 'utf-8')
    const rawLines = content.trim().split('\n')

    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i]
      if (!line.trim()) continue
      try {
        const entry = JSON.parse(line)

        if (entry.type === 'user' || entry.type === 'assistant') {
          const msg = entry.message
          const c = typeof msg === 'object' ? msg.content : msg
          totalChars += extractTextLength(c)

          // Track tool uses from assistant messages
          if (entry.type === 'assistant' && typeof msg === 'object' && Array.isArray(msg.content)) {
            for (const block of msg.content) {
              if (block.type === 'tool_use') {
                toolEvents.push({ index: i, name: block.name || '', isError: false })
              }
            }
          }

          // Track tool errors from user messages (tool_result with is_error)
          if (entry.type === 'user' && typeof msg === 'object' && Array.isArray(msg.content)) {
            for (const block of msg.content) {
              if (block.type === 'tool_result' && block.is_error) {
                // Find the matching tool event and mark it
                const toolUseId = block.tool_use_id
                for (let j = toolEvents.length - 1; j >= 0; j--) {
                  if (!toolEvents[j].isError) {
                    toolEvents[j].isError = true
                    break
                  }
                }
              }
            }
          }
        }
      } catch { /* skip unparseable lines */ }
    }
  } catch { /* file read error */ }

  // Compute retry rates for first/second half
  const midpoint = Math.floor(toolEvents.length / 2)
  const firstHalf = toolEvents.slice(0, midpoint)
  const secondHalf = toolEvents.slice(midpoint)

  const retryRateFirstHalf = firstHalf.length > 0
    ? firstHalf.filter(e => e.isError).length / firstHalf.length
    : 0

  const retryRateSecondHalf = secondHalf.length > 0
    ? secondHalf.filter(e => e.isError).length / secondHalf.length
    : 0

  return {
    totalChars,
    retryRateFirstHalf,
    retryRateSecondHalf,
    toolCallCount: toolEvents.length,
    toolErrorCount: toolEvents.filter(e => e.isError).length,
  }
}

// ── Rot Score Computation ───────────────────────────────────────────────────

function computeUtilizationPressure(utilizationPct: number): number {
  // 0 below 60%, ramps to 1.0 at 100%
  if (utilizationPct < 60) return 0
  return Math.min(1, (utilizationPct - 60) / 40)
}

function computeRetryTrend(firstHalfRate: number, secondHalfRate: number): number {
  // Higher score when retry rate increases from first to second half
  const delta = secondHalfRate - firstHalfRate
  if (delta <= 0) return 0
  return Math.min(1, delta * 5) // 20% increase → 1.0
}

function computeSuccessDecline(agentId: string, sessionStartedAt: number): number {
  // Use eval harness to get task outcomes since session start
  try {
    // evalHarness.reportByAgent is async but we need sync behavior here
    // Instead, we'll return 0 and let the async path handle it
    return 0
  } catch {
    return 0
  }
}

async function computeSuccessDeclineAsync(agentId: string, sessionStartedAt: number): Promise<number> {
  try {
    const report = await evalHarness.reportByAgent(agentId, new Date(sessionStartedAt))
    if (report.totalTasks < 4) return 0 // Not enough data

    // Check if recent outcomes are worse than earlier ones
    // Use the trend: if currentStreak is 0 and successRate < 0.7, that's declining
    if (report.successRate >= 0.8) return 0
    if (report.currentStreak > 0 && report.successRate >= 0.6) return 0.1

    // Success rate below 50% with broken streak = strong decline signal
    if (report.successRate < 0.5 && report.currentStreak === 0) return 0.8
    if (report.successRate < 0.7 && report.currentStreak === 0) return 0.5

    return Math.max(0, 1 - report.successRate)
  } catch {
    return 0
  }
}

function deriveRecommendation(
  utilizationPct: number,
  rotScore: number,
): ContextHealth['recommendation'] {
  if (rotScore >= 0.8 || utilizationPct >= 95) return 'restart'
  if (rotScore >= 0.6) return 'compress'
  if (utilizationPct >= 80 || rotScore >= 0.3) return 'warning'
  return 'healthy'
}

// ── ContextMonitor ──────────────────────────────────────────────────────────

export class ContextMonitor {
  private contextWindowSize: number

  constructor(contextWindowSize?: number) {
    this.contextWindowSize = contextWindowSize ?? DEFAULT_CONTEXT_WINDOW
  }

  async check(agentId: string): Promise<ContextHealth> {
    const sessions = getActiveSessionFiles()

    // Find session matching agentId — match by cwd basename or sessionId
    const session = sessions.find(s => {
      const project = path.basename(s.cwd)
      return project === agentId || s.sessionId === agentId
    })

    if (!session) {
      return this.emptyHealth(agentId, '')
    }

    return this.analyzeSession(agentId, session.sessionId, session.startedAt)
  }

  async checkAll(): Promise<ContextHealth[]> {
    const sessions = getActiveSessionFiles()
    const results: ContextHealth[] = []

    for (const session of sessions) {
      const agentId = path.basename(session.cwd) || session.sessionId
      const health = await this.analyzeSession(agentId, session.sessionId, session.startedAt)
      results.push(health)
    }

    return results
  }

  /** Analyze a specific session — public for testing */
  async analyzeSession(
    agentId: string,
    sessionId: string,
    startedAt: number,
  ): Promise<ContextHealth> {
    const jsonlPath = findJsonlPath(sessionId)
    if (!jsonlPath) {
      return this.emptyHealth(agentId, sessionId)
    }

    const analysis = analyzeJsonl(jsonlPath)
    const tokenCount = Math.round(analysis.totalChars / CHARS_PER_TOKEN)
    const utilizationPct = Math.round((tokenCount / this.contextWindowSize) * 100)

    // Compute rot score components
    const utilizationPressure = computeUtilizationPressure(utilizationPct)
    const retryTrend = computeRetryTrend(analysis.retryRateFirstHalf, analysis.retryRateSecondHalf)
    const successDecline = await computeSuccessDeclineAsync(agentId, startedAt)

    // Weighted combination
    const rotScore = Math.min(1, Math.max(0,
      utilizationPressure * 0.4 +
      retryTrend * 0.3 +
      successDecline * 0.3,
    ))

    const recommendation = deriveRecommendation(utilizationPct, rotScore)

    return {
      agentId,
      sessionId,
      tokenCount,
      contextWindowSize: this.contextWindowSize,
      utilizationPct,
      rotScore: Math.round(rotScore * 100) / 100,
      recommendation,
    }
  }

  /** Analyze a JSONL file directly by path — useful for testing */
  async analyzeFromPath(
    agentId: string,
    sessionId: string,
    jsonlPath: string,
    startedAt = 0,
  ): Promise<ContextHealth> {
    const analysis = analyzeJsonl(jsonlPath)
    const tokenCount = Math.round(analysis.totalChars / CHARS_PER_TOKEN)
    const utilizationPct = Math.round((tokenCount / this.contextWindowSize) * 100)

    const utilizationPressure = computeUtilizationPressure(utilizationPct)
    const retryTrend = computeRetryTrend(analysis.retryRateFirstHalf, analysis.retryRateSecondHalf)

    const rotScore = Math.min(1, Math.max(0,
      utilizationPressure * 0.4 +
      retryTrend * 0.3 +
      0, // skip evalHarness for direct-path analysis
    ))

    const recommendation = deriveRecommendation(utilizationPct, rotScore)

    return {
      agentId,
      sessionId,
      tokenCount,
      contextWindowSize: this.contextWindowSize,
      utilizationPct,
      rotScore: Math.round(rotScore * 100) / 100,
      recommendation,
    }
  }

  private emptyHealth(agentId: string, sessionId: string): ContextHealth {
    return {
      agentId,
      sessionId,
      tokenCount: 0,
      contextWindowSize: this.contextWindowSize,
      utilizationPct: 0,
      rotScore: 0,
      recommendation: 'healthy',
    }
  }
}

// ── Singleton ───────────────────────────────────────────────────────────────

export const contextMonitor = new ContextMonitor()
