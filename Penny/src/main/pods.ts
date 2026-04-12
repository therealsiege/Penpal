import { EventEmitter } from 'events'
import { execSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'
import {
  getAgentConfig,
  getHeadlessBackendChain,
  getTaskRunnerKind,
  loadPodPresets,
  type TaskRunnerKind,
} from './agents'
import { runAgentHeadless } from './sessions'
import { getPhaseConfig, type PhaseConfig } from './pods/phase-config'
import { podQualityCollector, type PodQualityEvent } from './evals/collectors/pod-quality'
import { resolveProjectPath } from './project-paths'
import { addEntry, updateEntry, getActiveEntries, type FlightBoardEntry } from './flight-board'

export type { PhaseConfig } from './pods/phase-config'

// ── Runtime Profiles ────────────────────────────────────────────────────────

export type PodPhase = 'plan' | 'execute' | 'validate'

export interface PhaseModel {
  model: string
}

export interface RuntimeProfile {
  /** Per-phase model configuration. */
  phases: Record<PodPhase, PhaseModel>
  timeoutMultiplier: number
  ollamaUrl?: string
  description: string
}

const DEFAULT_PROFILE: RuntimeProfile = {
  phases: {
    plan: { model: 'opus' },
    execute: { model: 'opus' },
    validate: { model: 'sonnet' },
  },
  timeoutMultiplier: 1,
  description: 'default',
}

/** Load runtime profiles from agent-types.yaml. Returns profile map + default profile ID. */
function loadRuntimeProfiles(): { profiles: Record<string, RuntimeProfile>; defaultProfile: string } {
  try {
    const yaml = require('js-yaml')
    const agentTypesPath = path.join(__dirname, '../../agents/agent-types.yaml')
    const raw = yaml.load(fs.readFileSync(agentTypesPath, 'utf-8')) as Record<string, unknown>
    const rp = raw?.runtime_profiles as Record<string, unknown> | undefined
    if (!rp) return { profiles: {}, defaultProfile: 'max' }

    const defaultProfile = (rp.default_profile as string) || 'max'
    const profiles: Record<string, RuntimeProfile> = {}

    for (const [key, val] of Object.entries(rp)) {
      if (key === 'default_profile' || typeof val !== 'object' || !val) continue
      const v = val as Record<string, unknown>
      const phases = v.phases as Record<string, Record<string, string>> | undefined

      profiles[key] = {
        phases: {
          plan: { model: phases?.plan?.model || 'opus' },
          execute: { model: phases?.execute?.model || 'opus' },
          validate: { model: phases?.validate?.model || 'sonnet' },
        },
        timeoutMultiplier: (v.timeout_multiplier as number) || 1,
        ollamaUrl: v.ollama_url as string | undefined,
        description: (v.description as string) || '',
      }
    }
    return { profiles, defaultProfile }
  } catch {
    return { profiles: {}, defaultProfile: 'max' }
  }
}

/** Resolve a profile by name. Falls back to max defaults if not found. */
export function resolveRuntimeProfile(profileName?: string): RuntimeProfile {
  const { profiles, defaultProfile } = loadRuntimeProfiles()
  const name = profileName || defaultProfile
  return profiles[name] ?? DEFAULT_PROFILE
}

// ── Rebase types (exported for testing) ─────────────────────────────────────

export type RebaseStatus = 'clean' | 'conflict-resolved' | 'conflict-aborted'

export interface RebaseResult {
  status: RebaseStatus
  conflictedFiles?: string[]
  resolvedFiles?: string[]
}

// ── Types ───────────────────────────────────────────────────────────────────

export type PodStatus =
  | 'pending'
  | 'solving'
  | 'reviewing'
  | 'executing'
  | 'self-fixing'
  | 'feedback'
  | 'complete'
  | 'failed'
  | 'paused'

export interface PodRole {
  agentId: string
  tty?: string
  sessionId?: string
  status: 'waiting' | 'active' | 'complete' | 'failed'
  output?: string
}

export interface WorkflowArtifact {
  stage: 'solve' | 'review' | 'execute' | 'self-fix'
  path: string
  iteration: number
  timestamp: number
  candidateIndex?: number
  selected?: boolean
}

export interface SolverCandidate {
  index: number
  output: string
  agentId: string
  durationMs: number
}

export interface SelfEvalResult {
  selected: number
  confidence: number
  reasoning: string
}

export interface ReviewIssue {
  severity: 'critical' | 'major' | 'minor' | 'nitpick'
  location: string
  description: string
  suggestion: string
}

export interface ReviewerCritique {
  verdict: 'approve' | 'approve-with-notes' | 'request-changes' | 'reject'
  confidence: number
  issues: ReviewIssue[]
  strengths: string[]
  summary: string
}

export interface PodWorkflow {
  id: string
  name: string
  status: PodStatus
  task: string
  cwd: string
  presetId?: string
  solver: PodRole
  reviewer: PodRole
  executor: PodRole
  iteration: number
  maxIterations: number
  artifacts: WorkflowArtifact[]
  solverCandidates?: SolverCandidate[]
  selfEvaluation?: SelfEvalResult
  solverCandidateCount: number
  critique?: ReviewerCritique
  selfFixAttempts: number
  maxSelfFixes: number
  priority?: string
  phaseConfig?: PhaseConfig
  runtimeProfile?: string
  resolvedProfile?: RuntimeProfile
  phaseOverrides?: Partial<Record<'plan' | 'execute' | 'validate', { model?: string; timeoutMultiplier?: number }>>
  createdAt: number
  updatedAt: number
  error?: string
  stageHistory: { stage: PodStatus; enteredAt: number }[]
  pendingReviewerFeedback?: string
  lastExecutorPassed?: boolean
  qualityRecorded?: boolean
  prUrl?: string
  rebaseConflict?: boolean
  /** GitHub issue tracking — set when pod is created from a pipeline issue */
  issueNumber?: number
  issueRepo?: string
}

export interface PodPreset {
  id: string
  solver: string
  reviewer: string
  executor: string
  description: string
}

// ── Presets ──────────────────────────────────────────────────────────────────

let _cachedPresets: PodPreset[] | null = null

function getPresets(): PodPreset[] {
  if (_cachedPresets) return _cachedPresets

  const yamlPresets = loadPodPresets()
  if (yamlPresets.length > 0) {
    _cachedPresets = yamlPresets
    return _cachedPresets
  }

  _cachedPresets = [
    {
      id: 'frontend-feature',
      solver: 'nextjs-frontend',
      reviewer: 'ui-designer',
      executor: 'electron-dev',
      description: 'Build, review, and test a frontend feature',
    },
    {
      id: 'backend-feature',
      solver: 'fullstack-dev',
      reviewer: 'backend-arch',
      executor: 'electron-dev',
      description: 'Build, review, and test backend logic',
    },
    {
      id: 'full-stack',
      solver: 'fullstack-dev',
      reviewer: 'backend-arch',
      executor: 'electron-dev',
      description: 'End-to-end feature with architecture review',
    },
    {
      id: 'content-pipeline',
      solver: 'product-marketer',
      reviewer: 'product-mgr',
      executor: 'exec-assistant',
      description: 'Create, review, and validate marketing content',
    },
  ]
  return _cachedPresets
}

// ── Persistence ─────────────────────────────────────────────────────────────

const PERSIST_PATH = path.resolve(__dirname, '..', '..', 'data', 'pod-workflows.json')
const CRITIQUES_DIR = path.resolve(__dirname, '..', '..', 'data', 'pod-critiques')

function writeCritiqueArtifactFile(wf: PodWorkflow, critique: ReviewerCritique): string {
  try {
    if (!fs.existsSync(CRITIQUES_DIR)) fs.mkdirSync(CRITIQUES_DIR, { recursive: true })
    const fileName = `${wf.id}-review-i${wf.iteration}.json`
    const fullPath = path.join(CRITIQUES_DIR, fileName)
    fs.writeFileSync(fullPath, JSON.stringify(critique, null, 2), 'utf-8')
    return path.join('data', 'pod-critiques', fileName)
  } catch (err) {
    console.warn('[pods] Failed to write critique artifact file — using in-workflow only:', err)
    return 'reviewer-critique'
  }
}

function savePods(): void {
  try {
    const dir = path.dirname(PERSIST_PATH)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    const data = Array.from(workflows.values())
    fs.writeFileSync(PERSIST_PATH, JSON.stringify(data, null, 2))
  } catch (err) {
    console.error('[pods] Failed to save workflows:', err)
  }
}

function loadPods(): void {
  try {
    if (!fs.existsSync(PERSIST_PATH)) return
    const raw = fs.readFileSync(PERSIST_PATH, 'utf-8').trim()
    if (!raw) return
    const data = JSON.parse(raw) as PodWorkflow[]
    for (const wf of data) {
      if (wf.phaseConfig == null) {
        wf.phaseConfig = getPhaseConfig(wf.priority)
      }
      workflows.set(wf.id, wf)
      if (wf.id.startsWith('pod-')) {
        const num = parseInt(wf.id.split('-')[1] || '0', 10)
        if (num > workflowCounter) workflowCounter = num
      }
    }
  } catch (err) {
    console.error('[pods] Failed to load workflows:', err)
  }
}

// ── Engine ───────────────────────────────────────────────────────────────────

let workflowCounter = 0
const workflows = new Map<string, PodWorkflow>()
const activeWorkflowPromises = new Map<string, Promise<void>>()

export const podEvents = new EventEmitter()

loadPods()

function generateId(): string {
  workflowCounter += 1
  return `pod-${Date.now()}-${workflowCounter}`
}

/** Avoid TS narrowing issues when checking `paused` after other status checks in the workflow loop. */
function isPodPaused(wf: PodWorkflow): boolean {
  return (wf as PodWorkflow).status === 'paused'
}

function isPodFailed(wf: PodWorkflow): boolean {
  return (wf as PodWorkflow).status === 'failed'
}

function setStatus(wf: PodWorkflow, status: PodStatus): void {
  wf.status = status
  wf.updatedAt = Date.now()
  wf.stageHistory.push({ stage: status, enteredAt: Date.now() })
  if (status === 'complete' || status === 'failed') {
    finalizePodQuality(wf)
  }
  podEvents.emit('status-change', wf)
  savePods()
}

// ── Headless execution helpers ──────────────────────────────────────────────

const PLAN_TIMEOUT_MS = 600_000
const EXECUTE_TIMEOUT_MS = 1_800_000

/** Get the effective timeout for a workflow phase, scaled by runtime profile and optional phaseOverride. */
function getTimeout(wf: PodWorkflow, baseMs: number, phase?: PodPhase): number {
  const mult = (phase && wf.phaseOverrides?.[phase]?.timeoutMultiplier)
    ?? wf.resolvedProfile?.timeoutMultiplier
    ?? 1
  return Math.round(baseMs * mult)
}

/** Get the model override for a specific pod phase, checking phaseOverrides first. */
function getModelOverride(wf: PodWorkflow, phase: PodPhase): string | undefined {
  const override = wf.phaseOverrides?.[phase]?.model
  if (override) return override
  return wf.resolvedProfile?.phases?.[phase]?.model || undefined
}

// ── Self-Eval Helpers (exported for tests) ──────────────────────────────────

export function formatSelfEvalMessage(task: string, candidates: SolverCandidate[]): string {
  const candidateBlocks = candidates.map((c) => {
    const summary = c.output.length > 2000 ? c.output.slice(0, 2000) + '\n... [truncated]' : c.output
    return `### Candidate ${c.index}\n${summary}`
  })

  return [
    `You generated ${candidates.length} candidate solutions for this task:`,
    '',
    `**Task**: ${task}`,
    '',
    ...candidateBlocks,
    '',
    'Evaluate each candidate against these criteria:',
    '1. **Correctness** — does it solve the stated problem?',
    '2. **Completeness** — does it handle edge cases?',
    '3. **Simplicity** — is it the simplest correct solution?',
    '',
    'Select the best candidate and explain why.',
    'Output ONLY valid JSON in this exact format:',
    '```json',
    '{ "selected": 1, "confidence": 0.85, "reasoning": "Candidate 1 is the most correct and complete..." }',
    '```',
    '',
    'Where "selected" is the candidate number (1-indexed), "confidence" is 0.0-1.0, and "reasoning" explains your choice.',
  ].join('\n')
}

export function parseSelfEvalResult(output: string, numCandidates: number): SelfEvalResult | null {
  try {
    const jsonMatch = output.match(/\{[^{}]*"selected"\s*:\s*\d+[^{}]*"confidence"\s*:\s*[\d.]+[^{}]*\}/s)
      ?? output.match(/\{[^{}]*"confidence"\s*:\s*[\d.]+[^{}]*"selected"\s*:\s*\d+[^{}]*\}/s)
    if (!jsonMatch) return null

    const parsed = JSON.parse(jsonMatch[0])
    const selected = Number(parsed.selected)
    const confidence = Number(parsed.confidence)
    const reasoning = String(parsed.reasoning || '')

    if (!Number.isInteger(selected) || selected < 1 || selected > numCandidates) return null
    if (isNaN(confidence) || confidence < 0 || confidence > 1) return null

    return { selected, confidence, reasoning }
  } catch {
    return null
  }
}

// ── Reviewer Critique Parser (exported for tests) ───────────────────────────

const VALID_VERDICTS = ['approve', 'approve-with-notes', 'request-changes', 'reject'] as const
const VALID_SEVERITIES = ['critical', 'major', 'minor', 'nitpick'] as const

function makeFallbackCritique(reason: string): ReviewerCritique {
  return {
    verdict: 'reject',
    confidence: 0,
    issues: [{
      severity: 'critical' as const,
      location: 'reviewer',
      description: `Reviewer output could not be parsed: ${reason}`,
      suggestion: 'Check reviewer agent logs and retry.',
    }],
    strengths: [],
    summary: `Reviewer output unparseable — rejecting to prevent unreviewed code from passing. ${reason}`,
  }
}

export function parseReviewerCritique(raw: string | undefined | null): ReviewerCritique {
  if (!raw) {
    console.warn('[pods] No reviewer output to parse — falling back')
    return makeFallbackCritique('No output.')
  }

  try {
    // Try to extract JSON from markdown fenced block first
    let jsonStr = raw
    const fenced = raw.match(/```(?:json)?\s*\n?([\s\S]*?)```/)
    if (fenced) {
      jsonStr = fenced[1].trim()
    } else {
      const jsonMatch = raw.match(/\{[\s\S]*"verdict"[\s\S]*\}/)
      if (jsonMatch) {
        jsonStr = jsonMatch[0]
      }
    }

    const parsed = JSON.parse(jsonStr)

    if (!parsed.verdict || !parsed.summary) {
      console.warn('[pods] Missing required fields in reviewer critique — falling back')
      return makeFallbackCritique('Missing required fields.')
    }

    if (!VALID_VERDICTS.includes(parsed.verdict)) {
      console.warn(`[pods] Invalid verdict "${parsed.verdict}" — falling back`)
      return makeFallbackCritique(`Invalid verdict: ${parsed.verdict}`)
    }

    let confidence = Number(parsed.confidence)
    if (isNaN(confidence)) confidence = 0.5
    confidence = Math.max(0, Math.min(1, confidence))

    const issues: ReviewIssue[] = (parsed.issues || [])
      .filter((i: Record<string, unknown>) => VALID_SEVERITIES.includes(i.severity as typeof VALID_SEVERITIES[number]))
      .map((i: Record<string, unknown>) => ({
        severity: i.severity as ReviewIssue['severity'],
        location: String(i.location || ''),
        description: String(i.description || ''),
        suggestion: String(i.suggestion || ''),
      }))

    return {
      verdict: parsed.verdict,
      confidence,
      issues,
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths.map(String) : [],
      summary: String(parsed.summary),
    }
  } catch {
    console.warn('[pods] Failed to parse reviewer critique JSON — falling back')
    return makeFallbackCritique('JSON parse error.')
  }
}

// ── Review routing (exported for tests) ───────────────────────────────────

export type ReviewRoute = 'execute' | 'feedback' | 'fail'

export function routeAfterReview(critique: ReviewerCritique): ReviewRoute {
  switch (critique.verdict) {
    case 'approve':
    case 'approve-with-notes':
      return 'execute'
    case 'request-changes':
      return 'feedback'
    case 'reject':
      return 'fail'
    default:
      return 'execute'
  }
}

export function formatCritiqueForSolver(c: ReviewerCritique): string {
  const lines: string[] = [
    `**Summary**: ${c.summary}`,
    `**Reviewer confidence**: ${(c.confidence * 100).toFixed(0)}%`,
  ]
  if (c.strengths.length > 0) {
    lines.push(`**Strengths noted**: ${c.strengths.join('; ')}`)
  }
  if (c.issues.length > 0) {
    lines.push('**Issues to address** (by severity):')
    for (const issue of c.issues) {
      lines.push(`- [${issue.severity}] ${issue.location}: ${issue.description}`)
      lines.push(`  Suggestion: ${issue.suggestion}`)
    }
  }
  return lines.join('\n')
}

export function formatReviewerRejectError(c: ReviewerCritique): string {
  const critical = c.issues.filter(i => i.severity === 'critical')
  const tail = critical.length > 0
    ? ` Critical issues: ${critical.map(i => i.description).join('; ')}`
    : ''
  return `Reviewer rejected: ${c.summary}${tail}`
}

// ── Planning broadcast helpers (exported for tests) ─────────────────────────

const FILE_PATH_PREFIXES = ['src/', 'public/', 'tests/', 'test/', 'scripts/', 'agents/', 'data/']
const FILE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.json', '.yaml', '.yml', '.md']
const ROOT_CONFIG_PATTERNS = /^[\w.-]+\.(json|yaml|yml|ts|tsx|js|md)$/

/**
 * Heuristic extractor: scan output for path-like tokens.
 * Returns deduplicated list of paths, capped at 20.
 */
export function extractFilesFromOutput(output: string): string[] {
  const seen = new Set<string>()
  const results: string[] = []

  // Match path-like tokens: word chars, slashes, dots, dashes
  const tokenRe = /[\w./\\-]+/g
  let match: RegExpExecArray | null
  while ((match = tokenRe.exec(output)) !== null) {
    // Strip trailing punctuation (periods, commas, etc.) that may be sentence punctuation
    const token = match[0].replace(/[.,;:!?]+$/, '')
    if (token.length < 3 || token.length > 200) continue

    const isPathPrefixed = FILE_PATH_PREFIXES.some(p => token.startsWith(p))
    const hasKnownExt = FILE_EXTENSIONS.some(e => token.endsWith(e))
    const isRootConfig = ROOT_CONFIG_PATTERNS.test(token)

    if ((isPathPrefixed && hasKnownExt) || (isRootConfig && !token.includes('/'))) {
      if (!seen.has(token)) {
        seen.add(token)
        results.push(token)
        if (results.length >= 20) break
      }
    }
  }
  return results
}

/**
 * Extract the first 2–3 meaningful sentences from solver output as a plan summary.
 * Caps at 400 chars.
 */
export function extractPlanSummary(output: string): string {
  if (!output.trim()) return ''

  const lines = output.split('\n')
  const sentences: string[] = []
  let charCount = 0

  for (const line of lines) {
    const trimmed = line.trim()
    // Skip empty lines and markdown headers
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('```') || trimmed.startsWith('---')) continue

    if (charCount + trimmed.length > 400) {
      const remaining = 400 - charCount
      if (remaining > 20 && sentences.length === 0) {
        sentences.push(trimmed.slice(0, remaining))
      }
      break
    }
    sentences.push(trimmed)
    charCount += trimmed.length + 1
    if (sentences.length >= 3) break
  }

  return sentences.join(' ').slice(0, 400)
}

const MAX_FLIGHT_BOARD_BLOCK_CHARS = 2000

/**
 * Format the flight board context block for injection into solver prompts.
 * Returns '' if entries is empty. Stays under 2000 chars.
 */
export function formatFlightBoardContext(entries: FlightBoardEntry[]): string {
  if (entries.length === 0) return ''

  const lines: string[] = ['--- ACTIVE POD WORK (DO NOT CONFLICT) ---']
  let totalChars = lines[0].length

  for (const entry of entries) {
    const files = entry.filesInFlight
    let fileList: string
    if (files.length === 0) {
      fileList = '(no files claimed yet)'
    } else if (files.length <= 5) {
      fileList = files.join(', ')
    } else {
      fileList = files.slice(0, 5).join(', ') + `, ...${files.length - 5} more`
    }
    const line = `Pod "${entry.task}" (${entry.podId}): editing ${fileList}`
    if (totalChars + line.length + 1 > MAX_FLIGHT_BOARD_BLOCK_CHARS - 100) break
    lines.push(line)
    totalChars += line.length + 1
  }

  lines.push('---')
  lines.push('Plan your approach to avoid modifying these files if possible.')
  lines.push('If you must edit a file another pod is touching, note the overlap in your plan.')

  return lines.join('\n')
}

// ── Message formatting ──────────────────────────────────────────────────────

function formatSolverMessage(
  wf: PodWorkflow,
  feedbackFromExecutor?: string,
  feedbackFromReviewer?: string,
  flightBoardContext?: string,
): string {
  const header = `## Pod Workflow: ${wf.name}\n### Stage: Solve (Iteration ${wf.iteration}/${wf.maxIterations})\n`
  const projectSection = `**Project Directory**: \`${wf.cwd}\`\n`
  const taskSection = `${projectSection}**Task**: ${wf.task}\n`
  const contextBlock = flightBoardContext ? `\n${flightBoardContext}\n` : ''

  if (feedbackFromReviewer || feedbackFromExecutor) {
    const blocks: string[] = [header, taskSection]
    if (contextBlock) blocks.push(contextBlock)
    if (feedbackFromReviewer) {
      blocks.push(`**Feedback from Reviewer (requested changes)**:\n${feedbackFromReviewer}\n`)
    }
    if (feedbackFromExecutor) {
      blocks.push(`**Feedback from QA (previous iteration)**:\n${feedbackFromExecutor}\n`)
    }
    if (feedbackFromReviewer && feedbackFromExecutor) {
      blocks.push(
        '**Instructions**: Address both reviewer feedback and QA feedback above. Prefer fixing blocking QA failures first, then reviewer items.',
      )
    } else if (feedbackFromReviewer) {
      blocks.push(
        '**Instructions**: Address the reviewer feedback above. Do not proceed until the requested changes are reflected in the implementation.',
      )
    } else {
      blocks.push(
        '**Instructions**: Fix the issues identified by QA. Focus on the failing tests and error messages above.',
      )
    }
    return blocks.join('\n')
  }

  return [
    header,
    taskSection,
    contextBlock,
    '**Instructions**: Implement this task completely. When finished, provide a summary of what you built and which files were changed.',
  ].filter(s => s !== '').join('\n')
}

function formatReviewerMessage(wf: PodWorkflow): string {
  return [
    `## Pod Workflow: ${wf.name}`,
    `### Stage: Review (Iteration ${wf.iteration}/${wf.maxIterations})`,
    '',
    `**Project Directory**: \`${wf.cwd}\``,
    `**Original Task**: ${wf.task}`,
    '',
    '**Your Role**: You are the independent reviewer. Reason from the **task description only** — do not read or assume implementation details.',
    'Consider: expected behavior, edge cases and errors, integration and regressions, accessibility/UX when relevant.',
    '',
    '**Output (required)**: Respond with **only** a JSON object inside one markdown fenced block.',
    'Use an opening line ```json then the JSON body, then a closing ``` line.',
    'The JSON must include: verdict, confidence (0–1), issues (array — empty [] if none), strengths (string array), summary (string).',
    'Each object in issues must include all four fields: severity, location, description, suggestion (use empty string if not applicable).',
    'severity must be one of: critical | major | minor | nitpick.',
    'verdict must be one of: approve | approve-with-notes | request-changes | reject.',
    'Do not include prose outside the fenced JSON block.',
  ].join('\n')
}

function formatExecutorMessage(
  wf: PodWorkflow,
  solverOutput?: string,
  reviewerRawOutput?: string,
  critique?: ReviewerCritique,
): string {
  const reviewerBlock = critique
    ? [
        `**Reviewer verdict**: ${critique.verdict} (confidence ${(critique.confidence * 100).toFixed(0)}%)`,
        `**Reviewer summary**: ${critique.summary}`,
        critique.strengths.length > 0 ? `**Strengths**: ${critique.strengths.join('; ')}` : '',
        critique.issues.length > 0
          ? `**Reviewer issues**:\n${critique.issues
              .map(
                i =>
                  `- [${i.severity}] ${i.location}: ${i.description}\n  Suggestion: ${i.suggestion}`,
              )
              .join('\n')}`
          : '',
        critique.verdict === 'approve-with-notes'
          ? '**Note**: approve-with-notes — treat minor/nitpick items as non-blocking notes unless they affect correctness.'
          : '',
        reviewerRawOutput
          ? `**Raw reviewer output** (reference): ${reviewerRawOutput.length > 4000 ? reviewerRawOutput.slice(0, 4000) + '\n... [truncated]' : reviewerRawOutput}`
          : '',
      ]
        .filter(Boolean)
        .join('\n\n')
    : reviewerRawOutput
      ? `**Reviewer output**: ${reviewerRawOutput}`
      : ''

  return [
    `## Pod Workflow: ${wf.name}`,
    `### Stage: Execute (Iteration ${wf.iteration}/${wf.maxIterations})`,
    '',
    `**Project Directory**: \`${wf.cwd}\``,
    `**Original Task**: ${wf.task}`,
    '',
    solverOutput ? `**Solver Summary**: ${solverOutput}` : '',
    reviewerBlock,
    '',
    '**Your Role**: You are the QA Executor. Your job is to:',
    critique
      ? '1. Use the structured reviewer critique above (verdict, summary, issues)'
      : '1. Read the reviewer output above',
    '2. Verify the Solver\'s implementation against the task and reviewer criteria',
    '3. Run any automated tests if applicable',
    '4. Report structured results: PASS/FAIL for each test case with details',
    '',
    '**Output Format**:',
    '```',
    'RESULT: [PASS|FAIL]',
    '',
    'Test Case 1: [name] - [PASS|FAIL]',
    '  Details: ...',
    '',
    'Test Case 2: [name] - [PASS|FAIL]',
    '  Details: ...',
    '',
    'FEEDBACK FOR SOLVER (if any failures):',
    '- Issue 1: ...',
    '- Issue 2: ...',
    '```',
  ]
    .filter(line => line !== '')
    .join('\n')
}

const MAX_WORKING_TREE_DIFF = 12_000

export function getWorkingTreeDiff(cwd: string): string {
  try {
    const opts = { cwd, encoding: 'utf8' as const, maxBuffer: 2 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] as const }
    const unstaged = execSync('git diff HEAD', opts)
    const staged = execSync('git diff --cached', opts)
    const combined = `${unstaged}\n${staged}`.trim()
    if (combined.length > MAX_WORKING_TREE_DIFF) {
      return `${combined.slice(0, MAX_WORKING_TREE_DIFF)}\n... [truncated]`
    }
    return combined
  } catch {
    return ''
  }
}

const LOCK_FILES = new Set(['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'])
const GENERATED_RE = /\.generated\.ts$|sprites[\\/][^/]+\.json$/

/**
 * Rebase the current branch onto origin/main, auto-resolving lock/generated file conflicts.
 * Exported for unit testing.
 */
export function rebaseBeforePR(cwd: string): RebaseResult {
  const opts = { cwd, stdio: 'pipe' as const, encoding: 'utf8' as const }

  // Guard: skip silently if not a git repo
  try {
    execSync('git rev-parse --is-inside-work-tree', opts)
  } catch {
    return { status: 'clean' }
  }

  execSync('git fetch origin main', opts)

  try {
    execSync('git rebase origin/main', opts)
    return { status: 'clean' }
  } catch {
    // rebase exited non-zero — check for conflicts
  }

  try {
    const conflictedRaw = execSync('git diff --name-only --diff-filter=U', opts).trim()
    const conflictedFiles = conflictedRaw ? conflictedRaw.split('\n').map(f => f.trim()).filter(Boolean) : []

    const resolvedFiles: string[] = []
    const unsafeFiles: string[] = []

    for (const file of conflictedFiles) {
      const base = path.basename(file)
      if (LOCK_FILES.has(base)) {
        execSync(`git checkout --theirs -- "${file}"`, opts)
        execSync(`git add -- "${file}"`, opts)
        resolvedFiles.push(file)
      } else if (GENERATED_RE.test(file)) {
        execSync(`git checkout --ours -- "${file}"`, opts)
        execSync(`git add -- "${file}"`, opts)
        resolvedFiles.push(file)
      } else {
        unsafeFiles.push(file)
      }
    }

    if (unsafeFiles.length === 0) {
      execSync('git rebase --continue', { ...opts, env: { ...process.env, GIT_EDITOR: 'true' } })
      return { status: 'conflict-resolved', resolvedFiles }
    }

    execSync('git rebase --abort', opts)
    return { status: 'conflict-aborted', conflictedFiles: unsafeFiles }
  } catch (err) {
    try { execSync('git rebase --abort', opts) } catch { /* ignore */ }
    return { status: 'conflict-aborted', conflictedFiles: [] }
  }
}

/**
 * Create a GitHub PR for the completed pod workflow. Returns the PR URL or '' on failure.
 */
function createPodPR(wf: PodWorkflow, label?: string): string {
  try {
    const opts = { cwd: wf.cwd, stdio: 'pipe' as const, encoding: 'utf8' as const }
    const branch = execSync('git rev-parse --abbrev-ref HEAD', opts).trim()

    if (branch === 'main' || branch === 'master') {
      console.warn('[pods] createPodPR: branch is main/master — skipping PR creation')
      return ''
    }

    const title = wf.task.slice(0, 72)
    const rebaseNote = wf.rebaseConflict ? '\n\n⚠️ Rebase conflict detected — manual resolution required.' : ''
    const body = `Pod workflow: ${wf.name}\n\nTask: ${wf.task}${rebaseNote}`

    const labelArg = label ? `--label "${label}"` : ''
    const cmd = `gh pr create --title "${title.replace(/"/g, '\\"')}" --body "${body.replace(/"/g, '\\"')}" ${labelArg}`.trim()

    const url = execSync(cmd, opts).trim()
    console.log(`[pods] PR created: ${url}`)
    return url
  } catch (err) {
    console.warn('[pods] PR creation failed:', err)
    return ''
  }
}

/**
 * Strict pass detection for executor QA output.
 * The first explicit `RESULT: PASS|FAIL` line wins; otherwise Vitest-style `Test Case N: …` lines are evaluated.
 */
export function parseTestPassed(raw: string | undefined | null): boolean {
  if (raw == null || raw === '') return false
  const s = raw.trim()
  if (!s) return false

  const resultRe = /^RESULT:\s*(PASS|FAIL)\b/gim
  const firstResult = resultRe.exec(s)
  if (firstResult) {
    return firstResult[1].toUpperCase() === 'PASS'
  }

  const caseRe = /Test Case\s+\d+:\s*(PASS|FAIL)\b/gi
  const outcomes: Array<'PASS' | 'FAIL'> = []
  let m: RegExpExecArray | null
  while ((m = caseRe.exec(s)) !== null) {
    outcomes.push(m[1].toUpperCase() as 'PASS' | 'FAIL')
  }
  if (outcomes.length > 0) {
    if (outcomes.some(o => o === 'FAIL')) return false
    return outcomes.every(o => o === 'PASS')
  }

  const hasPass = /\bPASS\b/i.test(s)
  const hasFail = /\bFAIL\b/i.test(s)
  if (hasPass && hasFail) return false
  if (hasFail) return false
  if (hasPass) return true
  return false
}

export function executorOutputIndicatesPass(output: string | undefined | null): boolean {
  return parseTestPassed(output)
}

export type PodFailureCategory =
  | 'headless-solver'
  | 'headless-reviewer'
  | 'headless-executor'
  | 'all-candidates-failed'
  | 'reviewer-reject'
  | 'reviewer-feedback-no-iterations'
  | 'exhausted-iterations'
  | 'invalid-cwd'
  | 'cancelled'
  | 'unknown'

export function categorizePodFailure(error: string | undefined): PodFailureCategory {
  if (!error) return 'unknown'
  if (error.startsWith('Solver failed:')) return 'headless-solver'
  if (error.startsWith('Reviewer failed:')) return 'headless-reviewer'
  if (error.startsWith('Executor failed:')) return 'headless-executor'
  if (error === 'All solver candidates failed') return 'all-candidates-failed'
  if (error.startsWith('Reviewer rejected:')) return 'reviewer-reject'
  if (error.includes('no solver iterations remain') || error.includes('no iterations remain')) {
    return 'reviewer-feedback-no-iterations'
  }
  if (error.startsWith('Exhausted ') && error.includes('iterations without passing')) return 'exhausted-iterations'
  if (error.startsWith('Working directory') || error.includes('working directory')) return 'invalid-cwd'
  if (error === 'Cancelled by user') return 'cancelled'
  return 'unknown'
}

export interface PodRunnerDiagnostics {
  taskRunner: TaskRunnerKind
  runnerBinary: string
  runnerBinaryFound: boolean
  cursorApiKeySet: boolean
  /** Resolved backend chains per phase (env `PENNY_TASK_RUNNER_*`). */
  phaseBackendChains: Record<'planning' | 'executing' | 'validating' | 'reviewing', string[]>
}

function resolveHeadlessRunnerBinary(): { taskRunner: TaskRunnerKind; binary: string } {
  const taskRunner = getTaskRunnerKind()
  if (taskRunner === 'claude') return { taskRunner, binary: 'claude' }
  if (taskRunner === 'opencode') return { taskRunner, binary: 'opencode' }
  const binary = process.env.PENNY_CURSOR_AGENT_BIN?.trim() || 'agent'
  return { taskRunner, binary }
}

function isRunnerBinaryResolvable(binary: string): boolean {
  if (path.isAbsolute(binary)) return fs.existsSync(binary)
  if (binary.includes(path.sep)) return fs.existsSync(binary)
  try {
    if (process.platform === 'win32') {
      execSync(`where ${binary}`, { encoding: 'utf8', stdio: 'pipe' })
    } else {
      execSync(`command -v ${binary}`, { encoding: 'utf8', stdio: 'pipe' })
    }
    return true
  } catch {
    return false
  }
}

export function getPodRunnerDiagnostics(): PodRunnerDiagnostics {
  const { taskRunner, binary } = resolveHeadlessRunnerBinary()
  const cursorApiKeySet = Boolean(process.env.CURSOR_API_KEY?.trim())
  return {
    taskRunner,
    runnerBinary: binary,
    runnerBinaryFound: isRunnerBinaryResolvable(binary),
    cursorApiKeySet: taskRunner !== 'cursor-agent' ? true : cursorApiKeySet,
    phaseBackendChains: {
      planning: getHeadlessBackendChain('planning'),
      executing: getHeadlessBackendChain('executing'),
      validating: getHeadlessBackendChain('validating'),
      reviewing: getHeadlessBackendChain('reviewing'),
    },
  }
}

export function validatePodCwd(cwd: string): string | null {
  if (!cwd.trim()) return 'Working directory is empty.'
  try {
    if (!fs.existsSync(cwd)) return `Working directory does not exist: ${cwd}`
    const st = fs.statSync(cwd)
    if (!st.isDirectory()) return `Working directory is not a folder: ${cwd}`
    return null
  } catch (e) {
    return `Cannot access working directory: ${(e as Error).message}`
  }
}

/** Prefer Atlas clone when present, then solver defaultRepos, then /tmp. */
function pickPodDefaultCwd(solverId: string): string {
  const solverCfg = getAgentConfig(solverId)
  const ordered: string[] = ['atlas']
  for (const r of solverCfg?.defaultRepos ?? []) {
    if (!ordered.includes(r)) ordered.push(r)
  }
  for (const label of ordered) {
    const p = resolveProjectPath(label)
    if (validatePodCwd(p) === null) return p
  }
  for (const fb of ['/tmp', process.env.HOME || os.homedir()]) {
    if (validatePodCwd(fb) === null) return fb
  }
  return '/tmp'
}

export function formatSelfFixMessage(wf: PodWorkflow, testError: string): string {
  const attemptNum = wf.selfFixAttempts + 1
  const diff = getWorkingTreeDiff(wf.cwd)
  const codeChanges = diff.trim() || (wf.solver.output || '').trim() || '(no code changes captured)'
  const err = testError.trim() || '(no error text)'
  return [
    `## Pod Workflow: ${wf.name}`,
    `### Stage: Executor self-fix (Iteration ${wf.iteration}/${wf.maxIterations})`,
    `(Self-fix attempt ${attemptNum}/${wf.maxSelfFixes})`,
    '',
    `**Project Directory**: \`${wf.cwd}\``,
    '',
    'Your test run failed with these errors:',
    '```',
    err,
    '```',
    '',
    'The original task was:',
    '```',
    wf.task,
    '```',
    '',
    'Your code changes were:',
    '```',
    codeChanges,
    '```',
    '',
    'Diagnose the failure and generate a minimal fix. Only fix what\'s broken.',
    'Do NOT rewrite the solution — make the smallest change that fixes the test.',
    '',
    'When done, report structured results using the same RESULT: PASS|FAIL and test-case format as the main execute stage.',
  ].join('\n')
}

async function runSelfFixStage(wf: PodWorkflow): Promise<boolean> {
  while (wf.selfFixAttempts < wf.maxSelfFixes) {
    if (isPodPaused(wf)) return false

    const priorOutput = wf.executor.output || ''
    const prompt = formatSelfFixMessage(wf, priorOutput)
    setStatus(wf, 'self-fixing')
    wf.executor.status = 'active'
    console.log(`[pods] Executor self-fix ${wf.selfFixAttempts + 1}/${wf.maxSelfFixes} in ${wf.cwd}`)
    const result = await runAgentHeadless(wf.executor.agentId, wf.cwd, prompt, {
      timeoutMs: getTimeout(wf, EXECUTE_TIMEOUT_MS, 'validate'),
      phase: 'executing',
      modelOverride: getModelOverride(wf, 'validate'),
    })

    wf.selfFixAttempts += 1
    wf.artifacts.push({
      stage: 'self-fix',
      path: `self-fix-${wf.selfFixAttempts}`,
      iteration: wf.iteration,
      timestamp: Date.now(),
    })

    if (!result.success) {
      wf.executor.status = 'complete'
      wf.executor.output = [
        priorOutput,
        '',
        `Self-fix runner failed (attempt ${wf.selfFixAttempts}/${wf.maxSelfFixes}): ${result.error}`,
      ]
        .join('\n')
        .trim()
      wf.lastExecutorPassed = false
      console.warn(`[pods] Executor self-fix headless failed: ${result.error}`)
      continue
    }

    wf.executor.status = 'complete'
    wf.executor.output = result.output
    const passed = parseTestPassed(wf.executor.output || '')
    wf.lastExecutorPassed = passed
    if (passed) return true
  }

  wf.lastExecutorPassed = parseTestPassed(wf.executor.output || '')
  return false
}

// ── Core workflow stages ─────────────────────────────────────────────────────

async function runSolveStage(wf: PodWorkflow, feedback?: string): Promise<boolean> {
  setStatus(wf, 'solving')
  wf.solver.status = 'active'
  wf.reviewer.status = 'waiting'
  wf.executor.status = 'waiting'

  let reviewerFeedback: string | undefined
  if (wf.iteration > 1 && wf.pendingReviewerFeedback !== undefined) {
    reviewerFeedback = wf.pendingReviewerFeedback
    wf.pendingReviewerFeedback = undefined
  }

  const candidateCount = wf.solverCandidateCount

  // Build flight board context from other active pods
  const otherEntries = getActiveEntries().filter(e => e.podId !== wf.id)
  const flightBoardContext = formatFlightBoardContext(otherEntries)

  if (candidateCount <= 1) {
    // ── Single candidate path (original behavior) ──
    const prompt = formatSolverMessage(wf, feedback, reviewerFeedback, flightBoardContext)
    console.log(`[pods] Running solver ${wf.solver.agentId} headless in ${wf.cwd}`)
    const startMs = Date.now()
    const result = await runAgentHeadless(wf.solver.agentId, wf.cwd, prompt, {
      timeoutMs: getTimeout(wf, EXECUTE_TIMEOUT_MS, 'execute'),
      phase: 'executing',
      modelOverride: getModelOverride(wf, 'execute'),
    })

    if (!result.success) {
      wf.error = `Solver failed: ${result.error}`
      setStatus(wf, 'failed')
      return false
    }

    wf.solver.status = 'complete'
    wf.solver.output = result.output
    wf.solverCandidates = [{
      index: 1,
      output: result.output || '',
      agentId: wf.solver.agentId,
      durationMs: result.durationMs ?? (Date.now() - startMs),
    }]

    // Broadcast files + plan summary to flight board after first iteration solve
    if (wf.iteration === 1) {
      const filesInFlight = extractFilesFromOutput(wf.solver.output || '')
      const planSummary = extractPlanSummary(wf.solver.output || '')
      updateEntry(wf.id, { planSummary, filesInFlight, status: 'solving' })
    }

    console.log(`[pods] Solver done (${Math.round((result.durationMs ?? 0) / 1000)}s)`)
    return true
  }

  // ── Multi-candidate path (best-of-N) ──
  console.log(`[pods] Running ${candidateCount} solver candidates in parallel`)
  const prompt = formatSolverMessage(wf, feedback, reviewerFeedback, flightBoardContext)
  const startMs = Date.now()

  const promises = Array.from({ length: candidateCount }, (_, i) =>
    runAgentHeadless(wf.solver.agentId, wf.cwd, prompt, {
      timeoutMs: getTimeout(wf, EXECUTE_TIMEOUT_MS, 'execute'),
      phase: 'executing',
      modelOverride: getModelOverride(wf, 'execute'),
    }).then(result => ({
      index: i + 1,
      result,
      durationMs: Date.now() - startMs,
    })),
  )

  const settled = await Promise.allSettled(promises)
  const candidates: SolverCandidate[] = []

  for (const entry of settled) {
    if (entry.status === 'fulfilled' && entry.value.result.success) {
      candidates.push({
        index: entry.value.index,
        output: entry.value.result.output || '',
        agentId: wf.solver.agentId,
        durationMs: entry.value.durationMs,
      })
    }
  }

  if (candidates.length === 0) {
    wf.error = 'All solver candidates failed'
    setStatus(wf, 'failed')
    return false
  }

  wf.solverCandidates = candidates

  // Store artifacts for each candidate
  for (const c of candidates) {
    wf.artifacts.push({
      stage: 'solve',
      path: `candidate-${c.index}`,
      iteration: wf.iteration,
      timestamp: Date.now(),
      candidateIndex: c.index,
      selected: false,
    })
  }

  // ── Self-evaluation ──
  if (candidates.length > 1 && wf.phaseConfig?.selfEvaluation) {
    console.log(`[pods] Running self-evaluation on ${candidates.length} candidates`)
    const evalPrompt = formatSelfEvalMessage(wf.task, candidates)

    const evalResult = await runAgentHeadless(wf.solver.agentId, wf.cwd, evalPrompt, {
      permissionMode: 'plan',
      timeoutMs: getTimeout(wf, PLAN_TIMEOUT_MS, 'plan'),
      phase: 'planning',
      modelOverride: getModelOverride(wf, 'plan'),
    })

    let selection: SelfEvalResult | null = null
    if (evalResult.success && evalResult.output) {
      selection = parseSelfEvalResult(evalResult.output, candidates.length)
    }

    if (selection) {
      wf.selfEvaluation = selection
      const selected = candidates.find(c => c.index === selection!.selected) || candidates[0]
      wf.solver.output = selected.output
      wf.solver.status = 'complete'

      // Mark selected artifact
      for (const a of wf.artifacts) {
        if (a.stage === 'solve' && a.iteration === wf.iteration && a.candidateIndex === selected.index) {
          a.selected = true
        }
      }

      console.log(`[pods] Self-eval selected candidate ${selection.selected} (confidence: ${selection.confidence})`)
    } else {
      // Fallback: pick the first candidate
      console.log('[pods] Self-eval failed to parse — selecting first candidate')
      const selected = candidates[0]
      wf.solver.output = selected.output
      wf.solver.status = 'complete'
      wf.selfEvaluation = { selected: 1, confidence: 0, reasoning: 'Self-eval parse failed — defaulting to first candidate' }
      for (const a of wf.artifacts) {
        if (a.stage === 'solve' && a.iteration === wf.iteration && a.candidateIndex === selected.index) {
          a.selected = true
        }
      }
    }
  } else {
    // Single candidate survived or self-eval disabled
    wf.solver.output = candidates[0].output
    wf.solver.status = 'complete'
  }

  // Broadcast files + plan summary to flight board after first iteration solve
  if (wf.iteration === 1) {
    const filesInFlight = extractFilesFromOutput(wf.solver.output || '')
    const planSummary = extractPlanSummary(wf.solver.output || '')
    updateEntry(wf.id, { planSummary, filesInFlight, status: 'solving' })
  }

  console.log(`[pods] Solver done with ${candidates.length}/${candidateCount} candidates`)
  return true
}

async function runReviewStage(wf: PodWorkflow): Promise<boolean> {
  setStatus(wf, 'reviewing')
  wf.reviewer.status = 'active'

  const prompt = formatReviewerMessage(wf)
  console.log(`[pods] Running reviewer ${wf.reviewer.agentId} headless (plan mode) in ${wf.cwd}`)
  const result = await runAgentHeadless(wf.reviewer.agentId, wf.cwd, prompt, {
    permissionMode: 'plan',
    timeoutMs: getTimeout(wf, PLAN_TIMEOUT_MS, 'plan'),
    phase: 'reviewing',
    modelOverride: getModelOverride(wf, 'plan'),
  })

  if (!result.success) {
    wf.error = `Reviewer failed: ${result.error}`
    setStatus(wf, 'failed')
    return false
  }

  wf.reviewer.status = 'complete'
  wf.reviewer.output = result.output
  wf.critique = parseReviewerCritique(wf.reviewer.output)
  const critiquePath = writeCritiqueArtifactFile(wf, wf.critique)
  wf.artifacts.push({
    stage: 'review',
    path: critiquePath,
    iteration: wf.iteration,
    timestamp: Date.now(),
  })
  podEvents.emit('reviewer-verdict', {
    workflowId: wf.id,
    solverAgentId: wf.solver.agentId,
    reviewerAgentId: wf.reviewer.agentId,
    critique: wf.critique,
  })
  savePods()
  console.log(`[pods] Reviewer done (${Math.round(result.durationMs / 1000)}s)`)
  return true
}

async function runExecuteStage(wf: PodWorkflow): Promise<{ passed: boolean }> {
  setStatus(wf, 'executing')
  wf.executor.status = 'active'

  const prompt = formatExecutorMessage(wf, wf.solver.output, wf.reviewer.output, wf.critique)
  console.log(`[pods] Running executor ${wf.executor.agentId} headless in ${wf.cwd}`)
  const result = await runAgentHeadless(wf.executor.agentId, wf.cwd, prompt, {
    timeoutMs: getTimeout(wf, EXECUTE_TIMEOUT_MS, 'validate'),
    phase: 'executing',
    modelOverride: getModelOverride(wf, 'validate'),
  })

  if (!result.success) {
    wf.error = `Executor failed: ${result.error}`
    wf.lastExecutorPassed = false
    setStatus(wf, 'failed')
    return { passed: false }
  }

  wf.executor.status = 'complete'
  wf.executor.output = result.output
  console.log(`[pods] Executor done (${Math.round(result.durationMs / 1000)}s)`)

  const passed = parseTestPassed(wf.executor.output || '')
  wf.lastExecutorPassed = passed
  return { passed }
}

function finalizePodQuality(wf: PodWorkflow): void {
  if (wf.qualityRecorded) return
  if (wf.status !== 'complete' && wf.status !== 'failed') return

  // Review runs once per workflow (iteration === 1 only); critique is not overwritten later.
  const firstPassAccepted =
    wf.critique !== undefined &&
    (wf.critique.verdict === 'approve' || wf.critique.verdict === 'approve-with-notes')

  const event: PodQualityEvent = {
    podId: wf.id,
    presetId: wf.presetId ?? 'default',
    status: wf.status === 'complete' ? 'complete' : 'failed',
    iterations: wf.iteration,
    firstPassAccepted,
    executorPassed: wf.lastExecutorPassed ?? false,
    selfFixed: wf.status === 'complete' && wf.selfFixAttempts > 0,
    completionTime_ms: Math.max(0, Date.now() - wf.createdAt),
    timestamp: Date.now(),
  }

  wf.qualityRecorded = true
  podQualityCollector.record(event)
}

// ── CLAUDE.md auto-update ───────────────────────────────────────────────────

const MAX_WORKFLOW_LOG_ENTRIES = 5

function appendWorkflowSummary(wf: PodWorkflow): void {
  const sharedMemoryPath = path.resolve(__dirname, '..', '..', 'agents', 'CLAUDE.md')
  if (!fs.existsSync(sharedMemoryPath)) return

  try {
    const content = fs.readFileSync(sharedMemoryPath, 'utf-8')
    const date = new Date().toISOString().split('T')[0]
    const result = wf.status === 'complete' ? 'PASS' : 'FAIL'
    const newEntry = [
      `### Workflow: ${wf.name} (${date})`,
      `- Task: ${wf.task.slice(0, 200)}`,
      `- Team: ${wf.solver.agentId} / ${wf.reviewer.agentId} / ${wf.executor.agentId}`,
      `- Result: ${result} (${wf.iteration}/${wf.maxIterations} iterations)`,
      ...(wf.selfFixAttempts > 0 ? [`- Self-fix attempts: ${wf.selfFixAttempts}`] : []),
      `- Key output: ${(wf.executor.output || wf.solver.output || 'N/A').slice(0, 150)}`,
    ].join('\n')

    // Split on workflow entries, keep only the most recent N-1 (new one makes N)
    const marker = '### Workflow:'
    const parts = content.split(marker)
    const header = parts[0] // everything before the first entry
    const entries = parts.slice(1).map(p => marker + p.trimEnd())
    entries.push(newEntry)
    const kept = entries.slice(-MAX_WORKFLOW_LOG_ENTRIES)

    fs.writeFileSync(sharedMemoryPath, header + '\n' + kept.join('\n\n') + '\n')
    console.log(`[pods] Updated CLAUDE.md workflow log (${kept.length} entries)`)
  } catch (err) {
    console.error('[pods] Failed to update CLAUDE.md:', err)
  }
}

async function completePodWithPR(wf: PodWorkflow): Promise<void> {
  // In the test environment, skip real git/gh operations unless the test explicitly
  // opts in by setting PENNY_TEST_REBASE (used in rebase-specific integration tests
  // that mock child_process.execSync themselves).
  if (process.env.VITEST === 'true' && !process.env.PENNY_TEST_REBASE) {
    setStatus(wf, 'complete')
    appendWorkflowSummary(wf)
    return
  }

  let rebaseResult: RebaseResult
  try {
    rebaseResult = rebaseBeforePR(wf.cwd)
  } catch (err) {
    console.warn('[pods] Rebase step threw unexpectedly, skipping PR:', err)
    setStatus(wf, 'complete')
    appendWorkflowSummary(wf)
    return
  }

  if (rebaseResult.status === 'clean' || rebaseResult.status === 'conflict-resolved') {
    if (rebaseResult.status === 'conflict-resolved') {
      // Files changed during rebase — re-validate to catch regressions
      console.log(`[pods] Auto-resolved ${rebaseResult.resolvedFiles?.length} files (lock/generated), re-validating`)
      const { passed: revalidated } = await runExecuteStage(wf)
      if (!revalidated) {
        console.warn('[pods] Post-rebase validation failed — returning to feedback loop')
        return
      }
    }
    const prUrl = createPodPR(wf)
    wf.prUrl = prUrl
    if (process.env.VITEST !== 'true') {
      updateEntry(wf.id, { status: 'pr-created' })
    }
  } else {
    console.warn(`[pods] Rebase conflict on: ${rebaseResult.conflictedFiles?.join(', ')} — creating PR with needs-rebase label`)
    wf.rebaseConflict = true
    const prUrl = createPodPR(wf, 'needs-rebase')
    wf.prUrl = prUrl
    if (process.env.VITEST !== 'true') {
      updateEntry(wf.id, { status: 'pr-created' })
    }
  }

  setStatus(wf, 'complete')
  appendWorkflowSummary(wf)
}

async function runWorkflow(wf: PodWorkflow): Promise<void> {
  try {
    const cwdErr = validatePodCwd(wf.cwd)
    if (cwdErr) {
      wf.error = cwdErr
      setStatus(wf, 'failed')
      return
    }

    for (let i = wf.iteration; i <= wf.maxIterations; i++) {
      wf.iteration = i

      if (isPodPaused(wf)) return

      if (i > 1) wf.selfFixAttempts = 0

      // Stage 1: Solve (with best-of-N when configured)
      const feedback = i > 1 ? wf.executor.output : undefined
      const solveOk = await runSolveStage(wf, feedback)
      if (!solveOk || isPodPaused(wf)) return

      // Stage 2: Review (only on first iteration of each outer loop)
      if (i === 1) {
        const reviewOk = await runReviewStage(wf)
        if (!reviewOk || isPodPaused(wf)) return

        const critique = wf.critique!
        const route = routeAfterReview(critique)
        if (route === 'fail') {
          wf.error = formatReviewerRejectError(critique)
          setStatus(wf, 'failed')
          appendWorkflowSummary(wf)
          return
        }
        if (route === 'feedback') {
          if (i >= wf.maxIterations) {
            wf.error = 'Reviewer requested changes but no solver iterations remain to address them.'
            setStatus(wf, 'failed')
            appendWorkflowSummary(wf)
            return
          }
          wf.pendingReviewerFeedback = formatCritiqueForSolver(critique)
          setStatus(wf, 'feedback')
          wf.solver.output = undefined
          wf.solver.status = 'waiting'
          continue
        }
      }

      // Stage 3: Execute
      const { passed } = await runExecuteStage(wf)
      if (wf.status === 'failed' || isPodPaused(wf)) return

      if (passed) {
        await completePodWithPR(wf)
        return
      }

      const selfFixed = await runSelfFixStage(wf)
      if (wf.status === 'failed' || isPodPaused(wf)) return
      if (selfFixed) {
        await completePodWithPR(wf)
        return
      }

      // Tests failed — feedback loop
      if (i < wf.maxIterations) {
        setStatus(wf, 'feedback')
        wf.solver.status = 'waiting'
        wf.solver.output = undefined
      }
    }

    if (wf.status !== 'complete') {
      wf.error = `Exhausted ${wf.maxIterations} iterations without passing tests`
      setStatus(wf, 'failed')
      appendWorkflowSummary(wf)
    }
  } catch (err) {
    wf.error = (err as Error).message
    setStatus(wf, 'failed')
  } finally {
    if (
      (wf.status === 'complete' || wf.status === 'failed') &&
      !wf.qualityRecorded
    ) {
      finalizePodQuality(wf)
    }
    activeWorkflowPromises.delete(wf.id)
    if (process.env.VITEST !== 'true') {
      const currentEntry = getActiveEntries().find(e => e.podId === wf.id)
      const finalStatus = wf.status === 'complete'
        ? (currentEntry?.status === 'pr-created' ? 'pr-created' : 'merged')
        : 'failed'
      updateEntry(wf.id, { status: finalStatus })
    }
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

export interface CreatePodOpts {
  name?: string
  cwd?: string
  maxIterations?: number
  presetId?: string
  solverAgent?: string
  reviewerAgent?: string
  executorAgent?: string
  priority?: string
  solverCandidates?: number
  maxSelfFixes?: number
  /** Runtime profile name: 'max' | 'economic' | 'sonnet'. Overrides default_profile from agent-types.yaml. */
  runtimeProfile?: string
  /** GitHub issue tracking — set when creating from pipeline */
  issueNumber?: number
  issueRepo?: string
}

export function createPod(task: string, opts: CreatePodOpts = {}): PodWorkflow {
  let solver: string
  let reviewer: string
  let executor: string

  const presets = getPresets()

  if (opts.presetId) {
    const preset = presets.find(p => p.id === opts.presetId)
    if (!preset) throw new Error(`Unknown preset: ${opts.presetId}`)
    solver = opts.solverAgent || preset.solver
    reviewer = opts.reviewerAgent || preset.reviewer
    executor = opts.executorAgent || preset.executor
  } else {
    solver = opts.solverAgent || 'fullstack-dev'
    reviewer = opts.reviewerAgent || 'backend-arch'
    executor = opts.executorAgent || 'electron-dev'
  }

  if (solver === reviewer || solver === executor || reviewer === executor) {
    throw new Error(
      `All three pod roles must use different agents. Got solver=${solver}, reviewer=${reviewer}, executor=${executor}`,
    )
  }

  let cwd = opts.cwd ? resolveProjectPath(opts.cwd) : undefined
  if (!cwd) {
    cwd = pickPodDefaultCwd(solver)
  }

  const phaseConfig = getPhaseConfig(opts.priority)
  const candidateCount = opts.solverCandidates ?? phaseConfig.candidates
  const maxSelfFixes = opts.maxSelfFixes ?? phaseConfig.maxSelfFixes

  const presetId = opts.presetId ?? 'default'
  const profile = resolveRuntimeProfile(opts.runtimeProfile)

  const cwdErr = validatePodCwd(cwd)
  const wf: PodWorkflow = {
    id: generateId(),
    name: opts.name || task.slice(0, 60),
    status: cwdErr ? 'failed' : 'pending',
    task,
    cwd,
    presetId,
    solver: { agentId: solver, status: 'waiting' },
    reviewer: { agentId: reviewer, status: 'waiting' },
    executor: { agentId: executor, status: 'waiting' },
    iteration: 1,
    maxIterations: opts.maxIterations ?? 3,
    artifacts: [],
    solverCandidateCount: candidateCount,
    selfFixAttempts: 0,
    maxSelfFixes,
    priority: opts.priority,
    phaseConfig,
    runtimeProfile: opts.runtimeProfile,
    resolvedProfile: profile,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    stageHistory: [{ stage: cwdErr ? 'failed' : 'pending', enteredAt: Date.now() }],
    qualityRecorded: false,
    error: cwdErr ?? undefined,
    issueNumber: opts.issueNumber,
    issueRepo: opts.issueRepo,
  }

  workflows.set(wf.id, wf)
  savePods()

  if (cwdErr) {
    finalizePodQuality(wf)
    return wf
  }

  // Register on flight board (skip during Vitest to avoid writing real data files in tests)
  if (process.env.VITEST !== 'true') {
    addEntry({ podId: wf.id, task: wf.task, cwd: wf.cwd })
  }

  if (process.env.VITEST !== 'true') {
    console.log(
      `[pods] Workflow started — preset \`${presetId}\`, priority ${opts.priority ?? '(default)'}, `
      + `maxSelfFixes ${maxSelfFixes}, solver candidates ${candidateCount}`,
    )
  }

  const promise = runWorkflow(wf)
  activeWorkflowPromises.set(wf.id, promise)

  return wf
}

export function getPodStatus(workflowId: string): PodWorkflow | null {
  return workflows.get(workflowId) ?? null
}

export function listPods(): PodWorkflow[] {
  return Array.from(workflows.values()).sort((a, b) => b.updatedAt - a.updatedAt)
}

export function overridePod(
  workflowId: string,
  phase: PodPhase,
  override: { model?: string; timeoutMultiplier?: number },
): boolean {
  const wf = workflows.get(workflowId)
  if (!wf) return false
  wf.phaseOverrides = { ...wf.phaseOverrides, [phase]: override }
  wf.updatedAt = Date.now()
  savePods()
  return true
}

export function pausePod(workflowId: string): boolean {
  const wf = workflows.get(workflowId)
  if (!wf || wf.status === 'complete' || wf.status === 'failed') return false
  setStatus(wf, 'paused')
  return true
}

export function resumePod(workflowId: string): boolean {
  const wf = workflows.get(workflowId)
  if (!wf || wf.status !== 'paused') return false

  if (activeWorkflowPromises.has(workflowId)) {
    console.warn(`[pods] Workflow ${workflowId} already has an active promise, skipping resume`)
    return false
  }

  const promise = runWorkflow(wf)
  activeWorkflowPromises.set(workflowId, promise)
  return true
}

export function cancelPod(workflowId: string): boolean {
  const wf = workflows.get(workflowId)
  if (!wf) return false
  wf.error = 'Cancelled by user'
  setStatus(wf, 'failed')
  return true
}

export function getPodPresets(): PodPreset[] {
  return getPresets()
}
