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
const UTILIZATION_WARNING_THRESHOLD = 80
const RECOMMENDATION_COMPRESS_ROT = 0.55
const RECOMMENDATION_RESTART_ROT = 0.8
const RECOMMENDATION_RESTART_UTILIZATION = 95
const MIN_TOOL_EVENTS_FOR_TREND = 6
const MIN_TASK_OUTCOMES_FOR_TREND = 6

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
  model?: string
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
          model: typeof data.model === 'string' ? data.model : undefined,
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
  successRateFirstHalf: number
  successRateSecondHalf: number
  taskOutcomeCount: number
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
  const taskOutcomes: Array<'completed' | 'failed'> = []

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
                // Find the latest unresolved tool event and mark it.
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

        // Track explicit task outcomes emitted in XML task-notifications.
        // These are the same notifications that session state logic already parses.
        if (
          (entry.type === 'user' || entry.type === 'queue-operation') &&
          typeof entry.message?.content === 'string'
        ) {
          const rawContent = entry.message.content
          if (rawContent.includes('<task-notification>') && rawContent.includes('<status>completed</status>')) {
            taskOutcomes.push('completed')
          } else if (rawContent.includes('<task-notification>') && rawContent.includes('<status>failed</status>')) {
            taskOutcomes.push('failed')
          }
        }
        if (entry.type === 'queue-operation' && typeof entry.content === 'string') {
          const rawContent = entry.content
          if (rawContent.includes('<task-notification>') && rawContent.includes('<status>completed</status>')) {
            taskOutcomes.push('completed')
          } else if (rawContent.includes('<task-notification>') && rawContent.includes('<status>failed</status>')) {
            taskOutcomes.push('failed')
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

  const outcomesMidpoint = Math.floor(taskOutcomes.length / 2)
  const firstOutcomeHalf = taskOutcomes.slice(0, outcomesMidpoint)
  const secondOutcomeHalf = taskOutcomes.slice(outcomesMidpoint)
  const successRateFirstHalf = firstOutcomeHalf.length > 0
    ? firstOutcomeHalf.filter(o => o === 'completed').length / firstOutcomeHalf.length
    : 0
  const successRateSecondHalf = secondOutcomeHalf.length > 0
    ? secondOutcomeHalf.filter(o => o === 'completed').length / secondOutcomeHalf.length
    : 0

  return {
    totalChars,
    retryRateFirstHalf,
    retryRateSecondHalf,
    toolCallCount: toolEvents.length,
    toolErrorCount: toolEvents.filter(e => e.isError).length,
    successRateFirstHalf,
    successRateSecondHalf,
    taskOutcomeCount: taskOutcomes.length,
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

function computeSuccessDecline(firstHalfSuccessRate: number, secondHalfSuccessRate: number): number {
  // Higher score when success rate declines from first to second half.
  const delta = firstHalfSuccessRate - secondHalfSuccessRate
  if (delta <= 0) return 0
  return Math.min(1, delta / 0.5) // 50% drop => 1.0
}

function deriveRecommendation(
  utilizationPct: number,
  rotScore: number,
): ContextHealth['recommendation'] {
  if (rotScore >= RECOMMENDATION_RESTART_ROT || utilizationPct >= RECOMMENDATION_RESTART_UTILIZATION) {
    return 'restart'
  }
  if (rotScore >= RECOMMENDATION_COMPRESS_ROT) return 'compress'
  if (utilizationPct >= UTILIZATION_WARNING_THRESHOLD || rotScore >= 0.3) return 'warning'
  return 'healthy'
}

// ── ContextMonitor ──────────────────────────────────────────────────────────

export class ContextMonitor {
  private readonly defaultContextWindowSize: number

  constructor(contextWindowSize?: number) {
    this.defaultContextWindowSize = contextWindowSize ?? DEFAULT_CONTEXT_WINDOW
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

    return this.analyzeSession(agentId, session.sessionId, session.startedAt, session.model)
  }

  async checkAll(): Promise<ContextHealth[]> {
    const sessions = getActiveSessionFiles()
    const results: ContextHealth[] = []

    for (const session of sessions) {
      const agentId = path.basename(session.cwd) || session.sessionId
      const health = await this.analyzeSession(agentId, session.sessionId, session.startedAt, session.model)
      results.push(health)
    }

    return results
  }

  /** Analyze a specific session — public for testing */
  async analyzeSession(
    agentId: string,
    sessionId: string,
    startedAt: number,
    model?: string,
  ): Promise<ContextHealth> {
    const jsonlPath = findJsonlPath(sessionId)
    if (!jsonlPath) {
      return this.emptyHealth(agentId, sessionId)
    }

    const analysis = analyzeJsonl(jsonlPath)
    const contextWindowSize = this.resolveContextWindow(model)
    const tokenCount = Math.round(analysis.totalChars / CHARS_PER_TOKEN)
    const utilizationPct = Math.round((tokenCount / contextWindowSize) * 100)

    // Compute rot score components with sparse-data guardrails.
    const utilizationPressure = computeUtilizationPressure(utilizationPct)
    const retryTrend = analysis.toolCallCount >= MIN_TOOL_EVENTS_FOR_TREND
      ? computeRetryTrend(analysis.retryRateFirstHalf, analysis.retryRateSecondHalf)
      : 0
    const successDecline = analysis.taskOutcomeCount >= MIN_TASK_OUTCOMES_FOR_TREND
      ? computeSuccessDecline(analysis.successRateFirstHalf, analysis.successRateSecondHalf)
      : 0

    // Weighted combination; clamp to [0..1].
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
      contextWindowSize,
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
    void startedAt
    const analysis = analyzeJsonl(jsonlPath)
    const contextWindowSize = this.defaultContextWindowSize
    const tokenCount = Math.round(analysis.totalChars / CHARS_PER_TOKEN)
    const utilizationPct = Math.round((tokenCount / contextWindowSize) * 100)

    const utilizationPressure = computeUtilizationPressure(utilizationPct)
    const retryTrend = analysis.toolCallCount >= MIN_TOOL_EVENTS_FOR_TREND
      ? computeRetryTrend(analysis.retryRateFirstHalf, analysis.retryRateSecondHalf)
      : 0
    const successDecline = analysis.taskOutcomeCount >= MIN_TASK_OUTCOMES_FOR_TREND
      ? computeSuccessDecline(analysis.successRateFirstHalf, analysis.successRateSecondHalf)
      : 0

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
      contextWindowSize,
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
      contextWindowSize: this.defaultContextWindowSize,
      utilizationPct: 0,
      rotScore: 0,
      recommendation: 'healthy',
    }
  }

  private resolveContextWindow(model?: string): number {
    if (!model) return this.defaultContextWindowSize
    return MODEL_CONTEXT_WINDOWS[model] ?? this.defaultContextWindowSize
  }
}

// ── Singleton ───────────────────────────────────────────────────────────────

export const contextMonitor = new ContextMonitor()
