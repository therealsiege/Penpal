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
    const dataDir = filePath
      ? path.dirname(filePath)
      : path.resolve(__dirname, '..', '..', '..', 'data')
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
      return JSON.parse(raw) as SpotCheck[]
    } catch {
      return []
    }
  }

  private save(checks: SpotCheck[]): void {
    fs.writeFileSync(this.filePath, JSON.stringify(checks, null, 2), 'utf-8')
  }

  async sample(count: number): Promise<SpotCheck[]> {
    const existing = this.load()
    const existingTaskIds = new Set(existing.map(sc => sc.taskId))

    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    const tasks = getTaskQueue().filter(t => {
      if (t.status !== 'completed' && t.status !== 'failed') return false
      if (!t.completedAt || t.completedAt < sevenDaysAgo) return false
      if (existingTaskIds.has(t.id)) return false
      return true
    })

    // Fisher-Yates shuffle
    for (let i = tasks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[tasks[i], tasks[j]] = [tasks[j], tasks[i]]
    }

    const selected = tasks.slice(0, count)
    const newChecks: SpotCheck[] = selected.map(t => ({
      id: crypto.randomUUID(),
      taskId: t.id,
      agentId: t.assignedAgent ?? 'unknown',
      taskDescription: t.description || t.title,
      agentOutput: t.result ?? '',
      automatedScore: t.status === 'completed' ? 1.0 : 0.0,
      sampledAt: new Date().toISOString(),
    }))

    existing.push(...newChecks)
    this.save(existing)
    return newChecks
  }

  async review(id: string, verdict: 'pass' | 'fail' | 'partial', notes?: string): Promise<void> {
    const checks = this.load()
    const check = checks.find(sc => sc.id === id)
    if (!check) throw new Error(`Spot check ${id} not found`)
    check.humanVerdict = verdict
    check.humanNotes = notes
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
    for (const sc of reviewed) {
      const automatedPass = (sc.automatedScore ?? 0) >= 0.5
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
