/**
 * pod-governance.ts — Explicit constraints on pod behavior.
 *
 * Prevents pods from sprawling unchecked: max files, max diff size,
 * max duration, forbidden paths. Violations trigger warn/pause/fail.
 *
 * Inspired by DAA's rule-based governance with audit logs.
 */

import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import { atomicWrite } from './atomic-store'
import { getDataDir } from './data-paths'

// ── Types ───────────────────────────────────────────────────────────────────

export type GovernanceRuleType =
  | 'max-files'
  | 'max-diff-lines'
  | 'max-duration'
  | 'forbidden-paths'
  | 'required-test'

export type GovernanceAction = 'warn' | 'pause' | 'fail'

export interface GovernanceRule {
  id: string
  type: GovernanceRuleType
  value: number | string | string[]
  action: GovernanceAction
  message: string
}

export interface GovernanceViolation {
  rule: GovernanceRule
  details: string
  timestamp: number
}

// ── Default Rules ───────────────────────────────────────────────────────────

export const DEFAULT_RULES: GovernanceRule[] = [
  {
    id: 'max-files',
    type: 'max-files',
    value: 12,
    action: 'warn',
    message: 'Pod touching >12 files — consider splitting task',
  },
  {
    id: 'max-diff',
    type: 'max-diff-lines',
    value: 800,
    action: 'warn',
    message: 'Diff exceeds 800 lines — review scope',
  },
  {
    id: 'max-duration',
    type: 'max-duration',
    value: 30 * 60 * 1000, // 30 minutes
    action: 'pause',
    message: 'Pod running >30 minutes — auto-pausing for review',
  },
  {
    id: 'no-secrets',
    type: 'forbidden-paths',
    value: ['.env', 'credentials', 'secrets', '.pem', '.key'],
    action: 'fail',
    message: 'Pod attempted to modify sensitive file',
  },
]

// ── Rule Loading ────────────────────────────────────────────────────────────

const RULES_PATH = path.join(getDataDir(), 'governance-rules.json')

export const DEFAULT_MAX_CONCURRENT_PODS = 2
export const MAX_ALLOWED_CONCURRENT_PODS = 8
export const DEFAULT_MAX_POD_RETRIES = 3
export const MAX_ALLOWED_POD_RETRIES = 10

export interface GovernanceConfig {
  rules: GovernanceRule[]
  maxConcurrentPods: number
  maxPodRetries: number
}

function clampConcurrency(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_MAX_CONCURRENT_PODS
  const rounded = Math.round(value)
  if (rounded < 1) return 1
  if (rounded > MAX_ALLOWED_CONCURRENT_PODS) return MAX_ALLOWED_CONCURRENT_PODS
  return rounded
}

function clampRetries(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_MAX_POD_RETRIES
  const rounded = Math.round(value)
  if (rounded < 0) return 0
  if (rounded > MAX_ALLOWED_POD_RETRIES) return MAX_ALLOWED_POD_RETRIES
  return rounded
}

function readGovernanceFile(): unknown {
  try {
    if (fs.existsSync(RULES_PATH)) {
      const raw = fs.readFileSync(RULES_PATH, 'utf-8').trim()
      if (raw) return JSON.parse(raw)
    }
  } catch (err) {
    console.warn('[governance] Failed to parse governance-rules.json, using defaults:', err)
  }
  return null
}

export function loadGovernanceConfig(): GovernanceConfig {
  const parsed = readGovernanceFile()
  if (Array.isArray(parsed)) {
    return {
      rules: parsed as GovernanceRule[],
      maxConcurrentPods: DEFAULT_MAX_CONCURRENT_PODS,
      maxPodRetries: DEFAULT_MAX_POD_RETRIES,
    }
  }
  if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>
    const rules = Array.isArray(obj.rules) ? (obj.rules as GovernanceRule[]) : DEFAULT_RULES
    const maxConcurrentPods = clampConcurrency(obj.maxConcurrentPods)
    const maxPodRetries = clampRetries(obj.maxPodRetries)
    return { rules, maxConcurrentPods, maxPodRetries }
  }
  return {
    rules: DEFAULT_RULES,
    maxConcurrentPods: DEFAULT_MAX_CONCURRENT_PODS,
    maxPodRetries: DEFAULT_MAX_POD_RETRIES,
  }
}

export function saveGovernanceConfig(partial: Partial<GovernanceConfig>): GovernanceConfig {
  const current = loadGovernanceConfig()
  const next: GovernanceConfig = {
    rules: Array.isArray(partial.rules) ? partial.rules : current.rules,
    maxConcurrentPods: partial.maxConcurrentPods != null
      ? clampConcurrency(partial.maxConcurrentPods)
      : current.maxConcurrentPods,
    maxPodRetries: partial.maxPodRetries != null
      ? clampRetries(partial.maxPodRetries)
      : current.maxPodRetries,
  }
  try {
    atomicWrite(RULES_PATH, next)
  } catch (err) {
    console.warn('[governance] Failed to write governance-rules.json:', err)
  }
  return next
}

export function loadRules(): GovernanceRule[] {
  return loadGovernanceConfig().rules
}

export function getMaxConcurrentPods(): number {
  return loadGovernanceConfig().maxConcurrentPods
}

export function getMaxPodRetries(): number {
  return loadGovernanceConfig().maxPodRetries
}

// ── Governance Checks ───────────────────────────────────────────────────────

/**
 * Check file count against max-files rule.
 */
function checkMaxFiles(files: string[], rule: GovernanceRule): GovernanceViolation | null {
  const max = rule.value as number
  if (files.length > max) {
    return {
      rule,
      details: `${files.length} files modified (max: ${max})`,
      timestamp: Date.now(),
    }
  }
  return null
}

/**
 * Check diff size against max-diff-lines rule.
 */
function checkMaxDiff(cwd: string, rule: GovernanceRule): GovernanceViolation | null {
  const max = rule.value as number
  try {
    const opts = { cwd, encoding: 'utf-8' as const, stdio: 'pipe' as const, timeout: 10_000 }
    const diffStat = execSync('git diff --stat HEAD 2>/dev/null || echo ""', opts).toString()
    // Parse last line: " X files changed, Y insertions(+), Z deletions(-)"
    const insertions = parseInt(diffStat.match(/(\d+) insertions?\(/)?.[1] ?? '0', 10)
    const deletions = parseInt(diffStat.match(/(\d+) deletions?\(/)?.[1] ?? '0', 10)
    const totalLines = insertions + deletions

    if (totalLines > max) {
      return {
        rule,
        details: `${totalLines} lines changed (max: ${max})`,
        timestamp: Date.now(),
      }
    }
  } catch {
    // Can't check — skip
  }
  return null
}

/**
 * Check elapsed duration against max-duration rule.
 */
function checkMaxDuration(startedAt: number, rule: GovernanceRule): GovernanceViolation | null {
  if (!startedAt || startedAt < 1_000_000_000_000) return null // guard bogus values
  const maxMs = rule.value as number
  const elapsed = Date.now() - startedAt
  if (elapsed > 0 && elapsed > maxMs) {
    const minutes = Math.round(elapsed / 60_000)
    return {
      rule,
      details: `Running for ${minutes} minutes (max: ${Math.round(maxMs / 60_000)} min)`,
      timestamp: Date.now(),
    }
  }
  return null
}

/**
 * Check for forbidden path modifications.
 */
function checkForbiddenPaths(files: string[], rule: GovernanceRule): GovernanceViolation | null {
  const forbidden = rule.value as string[]
  const violations = files.filter(f => {
    const basename = path.basename(f).toLowerCase()
    return forbidden.some(p => basename.includes(p.toLowerCase()))
  })

  if (violations.length > 0) {
    return {
      rule,
      details: `Forbidden files touched: ${violations.join(', ')}`,
      timestamp: Date.now(),
    }
  }
  return null
}

// ── Public API ──────────────────────────────────────────────────────────────

export interface GovernanceCheckInput {
  files?: string[]
  cwd?: string
  startedAt?: number
}

/**
 * Run all governance rules against current pod state.
 * Returns list of violations (empty = all clear).
 */
export function checkGovernance(input: GovernanceCheckInput, rules?: GovernanceRule[]): GovernanceViolation[] {
  const activeRules = rules ?? loadRules()
  const violations: GovernanceViolation[] = []

  for (const rule of activeRules) {
    let violation: GovernanceViolation | null = null

    switch (rule.type) {
      case 'max-files':
        if (input.files) violation = checkMaxFiles(input.files, rule)
        break
      case 'max-diff-lines':
        if (input.cwd) violation = checkMaxDiff(input.cwd, rule)
        break
      case 'max-duration':
        if (input.startedAt != null) violation = checkMaxDuration(input.startedAt, rule)
        break
      case 'forbidden-paths':
        if (input.files) violation = checkForbiddenPaths(input.files, rule)
        break
      case 'required-test':
        // Handled externally (executor runs tests)
        break
    }

    if (violation) violations.push(violation)
  }

  return violations
}

/**
 * Format violations for logging.
 */
export function formatViolations(violations: GovernanceViolation[]): string {
  if (violations.length === 0) return ''
  return violations
    .map(v => `[${v.rule.action.toUpperCase()}] ${v.rule.message} — ${v.details}`)
    .join('\n')
}
