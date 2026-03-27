/**
 * SpotCheckQueue — Random sampling of agent outputs for manual human review.
 *
 * Implements the "20-50 outputs" manual review practice (Hamel Husain).
 * Persists spot-check records to a JSON file and computes agreement
 * between human verdicts and automated scores.
 */

import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { getTaskQueue, type Task } from '../../orchestrator'

// ── Types ───────────────────────────────────────────────────────────────────

export interface SpotCheck {
  id: string
  taskId: string
  agentId: string
  taskDescription: string
  agentOutput: string
  automatedScore?: number
  humanVerdict?: 'pass' | 'fail' | 'partial'
  humanNotes?: string
  reviewedAt?: string
  sampledAt: string
}

export interface SpotCheckAgreement {
  total: number
  agreed: number
  rate: number
}

type HumanVerdict = SpotCheck['humanVerdict']
type SpotCheckRow = SpotCheck & { sampledAt: string }

const RECENT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000
const AUTOMATED_PASS_THRESHOLD = 0.5

// ── SpotCheckQueue ──────────────────────────────────────────────────────────

export class SpotCheckQueue {
  private filePath: string
  private readonly taskProvider: () => Task[]

  constructor(filePath?: string, taskProvider: () => Task[] = getTaskQueue) {
    const dataDir = filePath
      ? path.dirname(filePath)
      : path.resolve(__dirname, '..', '..', '..', 'data')
    this.filePath = filePath ?? path.join(dataDir, 'spot-checks.json')
    this.taskProvider = taskProvider

    const dir = path.dirname(this.filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
  }

  private load(): SpotCheckRow[] {
    try {
      if (!fs.existsSync(this.filePath)) return []
      const raw = fs.readFileSync(this.filePath, 'utf-8')
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return []
      return parsed.flatMap((row) => this.parseRow(row))
    } catch {
      return []
    }
  }

  private parseRow(row: unknown): SpotCheckRow[] {
    if (!row || typeof row !== 'object') return []
    const candidate = row as Record<string, unknown>
    if (
      typeof candidate.id !== 'string' ||
      typeof candidate.taskId !== 'string' ||
      typeof candidate.agentId !== 'string' ||
      typeof candidate.taskDescription !== 'string' ||
      typeof candidate.agentOutput !== 'string'
    ) {
      return []
    }

    const automatedScore =
      typeof candidate.automatedScore === 'number' ? candidate.automatedScore : undefined
    const humanVerdict = this.parseVerdict(candidate.humanVerdict)
    const humanNotes = typeof candidate.humanNotes === 'string' ? candidate.humanNotes : undefined
    const reviewedAt = typeof candidate.reviewedAt === 'string' ? candidate.reviewedAt : undefined
    const sampledAt =
      typeof candidate.sampledAt === 'string' ? candidate.sampledAt : new Date(0).toISOString()

    return [{
      id: candidate.id,
      taskId: candidate.taskId,
      agentId: candidate.agentId,
      taskDescription: candidate.taskDescription,
      agentOutput: candidate.agentOutput,
      automatedScore,
      humanVerdict,
      humanNotes,
      reviewedAt,
      sampledAt,
    }]
  }

  private parseVerdict(value: unknown): HumanVerdict {
    if (value === 'pass' || value === 'fail' || value === 'partial') return value
    return undefined
  }

  private save(checks: SpotCheckRow[]): void {
    const tmpPath = `${this.filePath}.tmp`
    fs.writeFileSync(tmpPath, JSON.stringify(checks, null, 2), 'utf-8')
    fs.renameSync(tmpPath, this.filePath)
  }

  async sample(count: number): Promise<SpotCheck[]> {
    if (!Number.isFinite(count) || count <= 0) return []

    const existing = this.load()
    const existingTaskIds = new Set(existing.map(sc => sc.taskId))

    const recentCutoff = Date.now() - RECENT_WINDOW_MS
    const tasks = this.taskProvider().filter(t => {
      if (t.status !== 'completed' && t.status !== 'failed') return false
      if (!t.completedAt || t.completedAt < recentCutoff) return false
      if (existingTaskIds.has(t.id)) return false
      return true
    })

    // Fisher-Yates shuffle
    for (let i = tasks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[tasks[i], tasks[j]] = [tasks[j], tasks[i]]
    }

    const selected = tasks.slice(0, Math.floor(count))
    const sampledAt = new Date().toISOString()
    const newChecks: SpotCheckRow[] = selected.map(t => ({
      id: crypto.randomUUID(),
      taskId: t.id,
      agentId: t.assignedAgent ?? 'unknown',
      taskDescription: t.description || t.title,
      agentOutput: t.result ?? '',
      automatedScore: t.status === 'completed' ? 1.0 : 0.0,
      sampledAt,
    }))

    existing.push(...newChecks)
    this.save(existing)
    return newChecks
  }

  async review(id: string, verdict: 'pass' | 'fail' | 'partial', notes?: string): Promise<void> {
    if (typeof id !== 'string' || id.trim().length === 0) {
      throw new Error('spot check id must be a non-empty string')
    }
    const normalizedVerdict = this.parseVerdict(verdict)
    if (!normalizedVerdict) {
      throw new Error('verdict must be pass, fail, or partial')
    }

    const checks = this.load()
    const check = checks.find(sc => sc.id === id)
    if (!check) throw new Error(`Spot check ${id} not found`)
    check.humanVerdict = normalizedVerdict
    check.humanNotes = typeof notes === 'string' && notes.trim().length > 0 ? notes.trim() : undefined
    check.reviewedAt = new Date().toISOString()
    this.save(checks)
  }

  async agreement(): Promise<SpotCheckAgreement> {
    const checks = this.load()
    const reviewed = checks.filter(
      sc => sc.automatedScore !== undefined && sc.humanVerdict !== undefined,
    )

    if (reviewed.length === 0) return { total: 0, agreed: 0, rate: 0 }

    let agreed = 0
    // Agreement policy is intentionally binary and deterministic:
    // - Automated pass if score >= AUTOMATED_PASS_THRESHOLD
    // - Human pass if verdict is pass or partial (fail is non-pass)
    for (const sc of reviewed) {
      const automatedPass = (sc.automatedScore ?? 0) >= AUTOMATED_PASS_THRESHOLD
      const humanPass = sc.humanVerdict === 'pass' || sc.humanVerdict === 'partial'
      if (automatedPass === humanPass) agreed++
    }

    return {
      total: reviewed.length,
      agreed,
      rate: agreed / reviewed.length,
    }
  }

  async getQueue(): Promise<SpotCheck[]> {
    return this.load()
  }

  async getPending(): Promise<SpotCheck[]> {
    return this.load().filter(sc => !sc.humanVerdict)
  }
}

// ── Singleton ───────────────────────────────────────────────────────────────

export const spotCheckQueue = new SpotCheckQueue()
