/**
 * reasoning-bank.ts — Store and retrieve successful pod patterns.
 *
 * Pods learn from past successes: before starting a task, the solver
 * can see how similar tasks were solved before. Failed patterns are
 * stored too, so we can route around known pitfalls.
 *
 * Inspired by agentic-flow's ReasoningBank and RuVector's self-learning.
 */

import fs from 'fs'
import path from 'path'
import { getDataDir } from './data-paths'

export interface PodPattern {
  id: string
  task: string
  taskType: 'refactor' | 'feature' | 'fix' | 'config' | 'test' | 'docs' | 'unknown'
  filesModified: string[]
  durationMs: number
  iterations: number
  selfFixes: number
  passed: boolean
  solverSummary: string
  reviewerVerdict: string
  timestamp: number
}

// ── Task Type Inference ─────────────────────────────────────────────────────

const TASK_TYPE_SIGNALS: Record<PodPattern['taskType'], RegExp[]> = {
  refactor: [/refactor/i, /extract/i, /split/i, /rename/i, /move.*to/i, /decouple/i, /cleanup/i],
  feature: [/implement/i, /add.*feature/i, /create.*new/i, /build/i, /enable/i],
  fix: [/fix/i, /bug/i, /crash/i, /leak/i, /broken/i, /resolve/i, /patch/i],
  config: [/config/i, /move.*to.*json/i, /env/i, /settings/i, /flag/i],
  test: [/test/i, /spec/i, /coverage/i, /e2e/i, /vitest/i],
  docs: [/document/i, /readme/i, /comment/i, /jsdoc/i],
  unknown: [],
}

export function inferTaskType(task: string): PodPattern['taskType'] {
  let bestType: PodPattern['taskType'] = 'unknown'
  let bestScore = 0

  for (const [type, patterns] of Object.entries(TASK_TYPE_SIGNALS)) {
    if (type === 'unknown') continue
    const score = patterns.filter(p => p.test(task)).length
    if (score > bestScore) {
      bestScore = score
      bestType = type as PodPattern['taskType']
    }
  }

  return bestType
}

// ── Similarity Scoring ──────────────────────────────────────────────────────

function extractKeywords(text: string): Set<string> {
  return new Set(
    text.toLowerCase()
      .split(/\W+/)
      .filter(w => w.length >= 3)
  )
}

function fileOverlap(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0
  const setB = new Set(b.map(f => path.basename(f)))
  const matches = a.filter(f => setB.has(path.basename(f))).length
  return matches / Math.max(a.length, b.length)
}

function keywordOverlap(a: string, b: string): number {
  const wordsA = extractKeywords(a)
  const wordsB = extractKeywords(b)
  if (wordsA.size === 0 || wordsB.size === 0) return 0
  let matches = 0
  for (const w of wordsA) {
    if (wordsB.has(w)) matches++
  }
  return matches / Math.max(wordsA.size, wordsB.size)
}

function similarityScore(query: string, queryFiles: string[], pattern: PodPattern): number {
  const fileScore = fileOverlap(queryFiles, pattern.filesModified) * 0.4
  const kwScore = keywordOverlap(query, pattern.task) * 0.4
  const typeScore = (inferTaskType(query) === pattern.taskType) ? 0.2 : 0
  return fileScore + kwScore + typeScore
}

// ── ReasoningBank Class ─────────────────────────────────────────────────────

const MAX_PATTERNS = 200
const PERSIST_PATH = path.join(getDataDir(), 'reasoning-bank.json')

export class ReasoningBank {
  private patterns: PodPattern[] = []

  constructor() {
    this.load()
  }

  private load(): void {
    try {
      if (fs.existsSync(PERSIST_PATH)) {
        const raw = fs.readFileSync(PERSIST_PATH, 'utf-8').trim()
        if (raw) {
          const parsed = JSON.parse(raw)
          if (Array.isArray(parsed)) {
            this.patterns = parsed.filter(
              (p: unknown) => p && typeof p === 'object'
                && typeof (p as PodPattern).id === 'string'
                && typeof (p as PodPattern).task === 'string'
                && Array.isArray((p as PodPattern).filesModified),
            )
          }
        }
      }
    } catch (err) {
      console.error('[reasoning-bank] Failed to load:', err)
      this.patterns = []
    }
  }

  private save(): void {
    try {
      const dir = path.dirname(PERSIST_PATH)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(PERSIST_PATH, JSON.stringify(this.patterns, null, 2))
    } catch (err) {
      console.error('[reasoning-bank] Failed to save:', err)
    }
  }

  store(pattern: PodPattern): void {
    this.patterns.push(pattern)

    // Eviction: cap at MAX_PATTERNS, but never evict first-try successes
    if (this.patterns.length > MAX_PATTERNS) {
      // Sort by eviction priority: failed first, then multi-iteration, then oldest
      const evictable = this.patterns
        .map((p, i) => ({ p, i }))
        .filter(({ p }) => !(p.passed && p.iterations === 1))
        .sort((a, b) => {
          if (a.p.passed !== b.p.passed) return a.p.passed ? 1 : -1 // failures evicted first
          if (a.p.iterations !== b.p.iterations) return b.p.iterations - a.p.iterations // high-iter first
          return a.p.timestamp - b.p.timestamp // oldest first
        })

      if (evictable.length > 0) {
        this.patterns.splice(evictable[0].i, 1)
      } else {
        // All are first-try successes — evict oldest
        this.patterns.shift()
      }
    }

    this.save()
  }

  findSimilar(task: string, files: string[] = [], limit = 3): PodPattern[] {
    if (this.patterns.length === 0) return []

    const scored = this.patterns
      .filter(p => p.passed) // Only show successes as examples
      .map(p => ({ pattern: p, score: similarityScore(task, files, p) }))
      .filter(({ score }) => score > 0.1)
      .sort((a, b) => b.score - a.score)

    return scored.slice(0, limit).map(({ pattern }) => pattern)
  }

  findFailures(task: string, files: string[] = [], limit = 2): PodPattern[] {
    if (this.patterns.length === 0) return []

    return this.patterns
      .filter(p => !p.passed)
      .map(p => ({ pattern: p, score: similarityScore(task, files, p) }))
      .filter(({ score }) => score > 0.15)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ pattern }) => pattern)
  }

  getSuccessRate(taskType: PodPattern['taskType']): number {
    const typed = this.patterns.filter(p => p.taskType === taskType)
    if (typed.length === 0) return 0
    return typed.filter(p => p.passed).length / typed.length
  }

  getAverageIterations(taskType: PodPattern['taskType']): number {
    const passed = this.patterns.filter(p => p.taskType === taskType && p.passed)
    if (passed.length === 0) return 0
    return passed.reduce((sum, p) => sum + p.iterations, 0) / passed.length
  }

  getAll(): PodPattern[] {
    return [...this.patterns]
  }

  delete(id: string): void {
    const idx = this.patterns.findIndex(p => p.id === id)
    if (idx !== -1) {
      this.patterns.splice(idx, 1)
      this.save()
    }
  }

  clear(): void {
    this.patterns = []
    this.save()
  }

  size(): number {
    return this.patterns.length
  }
}

// Singleton instance
export const reasoningBank = new ReasoningBank()

// ── Solver Prompt Formatting ────────────────────────────────────────────────

/**
 * Format similar past patterns for injection into solver prompt.
 * Returns empty string if no relevant patterns exist.
 */
export function formatPastPatterns(task: string, files: string[]): string {
  const successes = reasoningBank.findSimilar(task, files)
  const failures = reasoningBank.findFailures(task, files)

  if (successes.length === 0 && failures.length === 0) return ''

  const lines: string[] = ['--- PAST POD PATTERNS (learn from these) ---']

  if (successes.length > 0) {
    lines.push('**Successful approaches**:')
    for (const p of successes) {
      const fileList = p.filesModified.slice(0, 5).join(', ')
      lines.push(`- "${p.task.slice(0, 60)}" — ${p.iterations} iteration(s), modified: ${fileList}`)
    }
  }

  if (failures.length > 0) {
    lines.push('**Approaches that failed (avoid)**:')
    for (const p of failures) {
      lines.push(`- "${p.task.slice(0, 60)}" — failed after ${p.iterations} iteration(s)`)
    }
  }

  lines.push('---')
  return lines.join('\n')
}
