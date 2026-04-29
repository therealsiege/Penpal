/**
 * SpotCheckQueue — Random sampling of agent outputs for manual human review.
 *
 * Implements the "20-50 outputs" manual review practice (Hamel Husain).
 * Persists spot-check records to a JSON file and computes agreement
 * between human verdicts and automated scores.
 *
 * Automated score at sample time: 1.0 for `completed`, 0.0 for `failed`.
 * Agreement: auto-pass iff score >= automatedPassThreshold (default 0.5);
 * human "partial" counts as pass-leaning for the binary comparison.
 */

import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { getDataDir } from '../../data-paths'
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

type ReviewVerdict = 'pass' | 'fail' | 'partial'

interface SpotCheckQueueOptions {
  filePath?: string
  recentWindowMs?: number
  automatedPassThreshold?: number
  taskProvider?: () => Task[]
  now?: () => number
}

// ── SpotCheckQueue ──────────────────────────────────────────────────────────

export class SpotCheckQueue {
  private filePath: string
  private readonly recentWindowMs: number
  private readonly automatedPassThreshold: number
  private readonly taskProvider: () => Task[]
  private readonly now: () => number

  constructor(opts?: string | SpotCheckQueueOptions) {
    const options: SpotCheckQueueOptions = typeof opts === 'string' ? { filePath: opts } : (opts ?? {})
    const filePath = options.filePath
    // Align with orchestrator / evals: Penpal/data (judges/ is one level deeper than evals/)
    const dataDir = filePath
      ? path.dirname(filePath)
      : getDataDir()
    this.filePath = filePath ?? path.join(dataDir, 'spot-checks.json')
    this.recentWindowMs = options.recentWindowMs ?? 7 * 24 * 60 * 60 * 1000
    this.automatedPassThreshold = options.automatedPassThreshold ?? 0.5
    this.taskProvider = options.taskProvider ?? getTaskQueue
    this.now = options.now ?? Date.now

    const dir = path.dirname(this.filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
  }

  private load(): SpotCheck[] {
    try {
      if (!fs.existsSync(this.filePath)) return []
      const raw = fs.readFileSync(this.filePath, 'utf-8')
      if (!raw.trim()) return []
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return []
      return parsed
        .map((candidate) => this.parseSpotCheck(candidate))
        .filter((item): item is SpotCheck => item !== null)
    } catch {
      return []
    }
  }

  private save(checks: SpotCheck[]): void {
    const payload = JSON.stringify(checks, null, 2)
    const tempPath = `${this.filePath}.tmp`
    fs.writeFileSync(tempPath, payload, 'utf-8')
    fs.renameSync(tempPath, this.filePath)
  }

  private parseSpotCheck(candidate: unknown): SpotCheck | null {
    if (!candidate || typeof candidate !== 'object') return null
    const raw = candidate as Record<string, unknown>

    const id = typeof raw.id === 'string' ? raw.id : null
    const taskId = typeof raw.taskId === 'string' ? raw.taskId : null
    const agentId = typeof raw.agentId === 'string' ? raw.agentId : null
    const taskDescription = typeof raw.taskDescription === 'string' ? raw.taskDescription : null
    const sampledAt = typeof raw.sampledAt === 'string' ? raw.sampledAt : null
    const agentOutput = typeof raw.agentOutput === 'string' ? raw.agentOutput : ''
    if (!id || !taskId || !agentId || !taskDescription || !sampledAt) return null

    const verdict = raw.humanVerdict
    const parsedVerdict: ReviewVerdict | undefined =
      verdict === 'pass' || verdict === 'fail' || verdict === 'partial'
        ? verdict
        : undefined

    const parsed: SpotCheck = {
      id,
      taskId,
      agentId,
      taskDescription,
      agentOutput,
      sampledAt,
    }

    if (typeof raw.automatedScore === 'number' && Number.isFinite(raw.automatedScore)) {
      parsed.automatedScore = raw.automatedScore
    }
    if (parsedVerdict) {
      parsed.humanVerdict = parsedVerdict
    }
    if (typeof raw.humanNotes === 'string') {
      parsed.humanNotes = raw.humanNotes
    }
    if (typeof raw.reviewedAt === 'string') {
      parsed.reviewedAt = raw.reviewedAt
    }

    // Canonicalize review state: reviewed items must include both verdict and timestamp.
    if ((parsed.humanVerdict && !parsed.reviewedAt) || (!parsed.humanVerdict && parsed.reviewedAt)) {
      return null
    }
    return parsed
  }

  async sample(count: number): Promise<SpotCheck[]> {
    if (!Number.isFinite(count) || count <= 0) return []

    const existing = this.load()
    const existingTaskIds = new Set(existing.map(sc => sc.taskId))
    const recentCutoff = this.now() - this.recentWindowMs
    const tasks = this.taskProvider().filter((t) => {
      if (t.status !== 'completed' && t.status !== 'failed') return false
      if (!t.completedAt || t.completedAt < recentCutoff) return false
      if (existingTaskIds.has(t.id)) return false
      if (!(t.description || t.title)) return false
      return true
    })

    // Fisher-Yates shuffle
    for (let i = tasks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[tasks[i], tasks[j]] = [tasks[j], tasks[i]]
    }

    const selected = tasks.slice(0, Math.floor(count))
    const newChecks: SpotCheck[] = selected.map(t => ({
      id: crypto.randomUUID(),
      taskId: t.id,
      agentId: t.assignedAgent ?? 'unknown',
      taskDescription: t.description || t.title,
      agentOutput: t.result ?? '',
      automatedScore: t.status === 'completed' ? 1.0 : 0.0,
      sampledAt: new Date().toISOString(),
    }))

    if (newChecks.length === 0) return []
    existing.push(...newChecks)
    this.save(existing)
    return newChecks
  }

  async review(id: string, verdict: ReviewVerdict, notes?: string): Promise<void> {
    if (!id.trim()) throw new Error('Spot check id is required')
    if (verdict !== 'pass' && verdict !== 'fail' && verdict !== 'partial') {
      throw new Error('Invalid verdict. Must be pass, fail, or partial')
    }

    const checks = this.load()
    const check = checks.find(sc => sc.id === id.trim())
    if (!check) throw new Error(`Spot check ${id} not found`)

    check.humanVerdict = verdict
    check.reviewedAt = new Date().toISOString()
    if (typeof notes === 'string' && notes.trim().length > 0) {
      check.humanNotes = notes.trim()
    } else {
      delete check.humanNotes
    }
    this.save(checks)
  }

  async agreement(): Promise<SpotCheckAgreement> {
    const checks = this.load()
    const reviewed = checks.filter(
      sc => sc.automatedScore !== undefined && sc.humanVerdict !== undefined,
    )

    if (reviewed.length === 0) return { total: 0, agreed: 0, rate: 0 }

    let agreed = 0
    for (const sc of reviewed) {
      const automatedPass = (sc.automatedScore ?? 0) >= this.automatedPassThreshold
      // Policy: treat "partial" as pass-leaning for binary agreement checks.
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
    return this.load()
      .filter(sc => !sc.humanVerdict)
      .sort((a, b) => b.sampledAt.localeCompare(a.sampledAt))
  }
}

// ── Singleton ───────────────────────────────────────────────────────────────

export const spotCheckQueue = new SpotCheckQueue()
