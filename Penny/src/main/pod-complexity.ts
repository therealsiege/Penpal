/**
 * pod-complexity.ts — Three-tier model routing by task complexity.
 *
 * Automatically selects the right model tier for a pod based on task
 * signals: file count, keyword analysis, and past performance from
 * ReasoningBank.
 *
 * Inspired by ruflo's WASM/Haiku/Opus routing pattern.
 */

import { reasoningBank, inferTaskType } from './reasoning-bank'
import { detectRelevantFiles } from './pod-context'

export type ComplexityTier = 'simple' | 'moderate' | 'complex'

export interface ComplexityAssessment {
  tier: ComplexityTier
  score: number // 0–100
  signals: string[]
  recommendedProfile: string // maps to runtime profile name
  recommendedCandidates: number
}

// ── Signal Weights ──────────────────────────────────────────────────────────

const SIMPLE_KEYWORDS = /\bextract\b|\bmove\b|\brename\b|\bfix typo\b|\bupdate config\b|\bremove unused\b|\bsync\b|\bcleanup\b/i
const MODERATE_KEYWORDS = /\brefactor\b|\bimplement\b|\bcreate\b|\bbuild\b|\badd feature\b|\breplace\b|\bmigrate\b/i
const COMPLEX_KEYWORDS = /\barchitect\b|\bredesign\b|\bintegrate multiple\b|\bsystem\b|\boverhaul\b|\bnew module\b|\bfull.?stack\b/i

/**
 * Assess task complexity and recommend a model tier.
 */
export function assessComplexity(task: string, cwd?: string): ComplexityAssessment {
  let score = 50 // Start at moderate
  const signals: string[] = []

  // ── File count signal ─────────────────────────────────────────────────
  const files = cwd ? detectRelevantFiles(task, cwd) : detectRelevantFiles(task, '')
  const fileCount = files.length

  if (fileCount <= 1) {
    score -= 20
    signals.push(`single file (${fileCount})`)
  } else if (fileCount <= 3) {
    score -= 10
    signals.push(`few files (${fileCount})`)
  } else if (fileCount >= 6) {
    score += 15
    signals.push(`many files (${fileCount})`)
  } else if (fileCount >= 10) {
    score += 25
    signals.push(`very many files (${fileCount})`)
  }

  // ── Keyword signal ────────────────────────────────────────────────────
  if (SIMPLE_KEYWORDS.test(task)) {
    score -= 15
    signals.push('simple keywords detected')
  }
  if (MODERATE_KEYWORDS.test(task)) {
    score += 5
    signals.push('moderate keywords detected')
  }
  if (COMPLEX_KEYWORDS.test(task)) {
    score += 20
    signals.push('complex keywords detected')
  }

  // ── Task type signal ──────────────────────────────────────────────────
  const taskType = inferTaskType(task)
  if (taskType === 'config' || taskType === 'docs') {
    score -= 15
    signals.push(`task type: ${taskType}`)
  } else if (taskType === 'feature') {
    score += 10
    signals.push(`task type: ${taskType}`)
  }

  // ── Past performance signal (from ReasoningBank) ──────────────────────
  const similar = reasoningBank.findSimilar(task, files, 3)
  if (similar.length > 0) {
    const avgIterations = similar.reduce((sum, p) => sum + p.iterations, 0) / similar.length
    if (avgIterations <= 1) {
      score -= 10
      signals.push(`similar tasks averaged ${avgIterations.toFixed(1)} iterations`)
    } else if (avgIterations >= 2.5) {
      score += 15
      signals.push(`similar tasks averaged ${avgIterations.toFixed(1)} iterations`)
    }

    const successRate = similar.filter(p => p.passed).length / similar.length
    if (successRate >= 0.9) {
      score -= 5
      signals.push(`high past success rate (${(successRate * 100).toFixed(0)}%)`)
    } else if (successRate < 0.5) {
      score += 10
      signals.push(`low past success rate (${(successRate * 100).toFixed(0)}%)`)
    }
  }

  // ── Task description length signal ────────────────────────────────────
  const wordCount = task.split(/\s+/).length
  if (wordCount > 50) {
    score += 10
    signals.push(`long task description (${wordCount} words)`)
  } else if (wordCount < 15) {
    score -= 5
    signals.push(`short task description (${wordCount} words)`)
  }

  // ── Clamp and classify ────────────────────────────────────────────────
  score = Math.max(0, Math.min(100, score))

  let tier: ComplexityTier
  let recommendedProfile: string
  let recommendedCandidates: number

  if (score < 35) {
    tier = 'simple'
    recommendedProfile = 'haiku'   // cheapest — content, config, docs
    recommendedCandidates = 1
  } else if (score < 70) {
    tier = 'moderate'
    recommendedProfile = 'sonnet'  // balanced — most features and refactors
    recommendedCandidates = 1
  } else {
    tier = 'complex'
    recommendedProfile = 'max'     // Opus — architecture, multi-file, novel problems
    recommendedCandidates = 2
  }

  return { tier, score, signals, recommendedProfile, recommendedCandidates }
}
