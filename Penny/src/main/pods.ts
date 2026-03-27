import { EventEmitter } from 'events'
import fs from 'fs'
import path from 'path'
import { runAgentHeadless } from './sessions'
import { getAgentConfig, loadPodPresets } from './agents'
import { podQualityCollector } from './evals/collectors/pod-quality'

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

export interface PhaseConfig {
  candidates: number
  selfEvaluation: boolean
  confidenceThreshold: number
  maxSelfFixes: number
}

export interface PodWorkflow {
  id: string
  name: string
  status: PodStatus
  task: string
  cwd: string
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
  createdAt: number
  updatedAt: number
  error?: string
  stageHistory: { stage: PodStatus; enteredAt: number }[]
}

export interface PodPreset {
  id: string
  solver: string
  reviewer: string
  executor: string
  description: string
}

// ── Phase Config ────────────────────────────────────────────────────────────

const PHASE_CONFIGS: Record<string, PhaseConfig> = {
  critical: { candidates: 3, selfEvaluation: true, confidenceThreshold: 0.8, maxSelfFixes: 2 },
  high:     { candidates: 2, selfEvaluation: true, confidenceThreshold: 0.7, maxSelfFixes: 1 },
  normal:   { candidates: 1, selfEvaluation: false, confidenceThreshold: 0.5, maxSelfFixes: 0 },
  low:      { candidates: 1, selfEvaluation: false, confidenceThreshold: 0.5, maxSelfFixes: 0 },
}

function getPhaseConfig(priority?: string): PhaseConfig {
  return PHASE_CONFIGS[priority || 'normal'] || PHASE_CONFIGS.normal
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
    const data = JSON.parse(fs.readFileSync(PERSIST_PATH, 'utf-8')) as PodWorkflow[]
    for (const wf of data) {
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

function setStatus(wf: PodWorkflow, status: PodStatus): void {
  wf.status = status
  wf.updatedAt = Date.now()
  wf.stageHistory.push({ stage: status, enteredAt: Date.now() })
  podEvents.emit('status-change', wf)
  savePods()
}

// ── Headless execution helpers ──────────────────────────────────────────────

const PLAN_TIMEOUT_MS = 600_000
const EXECUTE_TIMEOUT_MS = 1_800_000

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
    const reasoning = parsed.reasoning

    if (!Number.isInteger(selected) || selected < 1 || selected > numCandidates) return null
    if (isNaN(confidence) || confidence < 0 || confidence > 1) return null
    if (typeof reasoning !== 'string') return null

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
    verdict: 'approve',
    confidence: 0.5,
    issues: [],
    strengths: [],
    summary: `Could not parse reviewer output — falling back to auto-approve. ${reason}`,
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

// ── Message formatting ──────────────────────────────────────────────────────

function formatSolverMessage(wf: PodWorkflow, feedbackFromExecutor?: string): string {
  const header = `## Pod Workflow: ${wf.name}\n### Stage: Solve (Iteration ${wf.iteration}/${wf.maxIterations})\n`
  const projectSection = `**Project Directory**: \`${wf.cwd}\`\n`
  const taskSection = `${projectSection}**Task**: ${wf.task}\n`

  if (feedbackFromExecutor) {
    return [
      header,
      taskSection,
      `**Feedback from QA (previous iteration)**:\n${feedbackFromExecutor}\n`,
      '**Instructions**: Fix the issues identified by QA. Focus on the failing tests and error messages above.',
    ].join('\n')
  }

  return [
    header,
    taskSection,
    '**Instructions**: Implement this task completely. When finished, provide a summary of what you built and which files were changed.',
  ].join('\n')
}

function formatReviewerMessage(wf: PodWorkflow): string {
  return [
    `## Pod Workflow: ${wf.name}`,
    `### Stage: Review (Iteration ${wf.iteration}/${wf.maxIterations})`,
    '',
    `**Project Directory**: \`${wf.cwd}\``,
    `**Original Task**: ${wf.task}`,
    '',
    '**Your Role**: You are the independent reviewer. Design comprehensive test criteria for this task WITHOUT looking at the implementation. Focus on:',
    '- Expected behavior from the task description',
    '- Edge cases and error conditions',
    '- Integration points and regressions',
    '- Accessibility and UX considerations (if applicable)',
    '',
    '**Output**: Write a structured test plan with numbered test cases. For each test case include:',
    '1. Test name',
    '2. Expected behavior',
    '3. Steps to verify',
    '4. Pass/fail criteria',
  ].join('\n')
}

function formatExecutorMessage(wf: PodWorkflow, solverOutput?: string, reviewerOutput?: string): string {
  return [
    `## Pod Workflow: ${wf.name}`,
    `### Stage: Execute (Iteration ${wf.iteration}/${wf.maxIterations})`,
    '',
    `**Project Directory**: \`${wf.cwd}\``,
    `**Original Task**: ${wf.task}`,
    '',
    solverOutput ? `**Solver Summary**: ${solverOutput}` : '',
    reviewerOutput ? `**Test Plan from Reviewer**: ${reviewerOutput}` : '',
    '',
    '**Your Role**: You are the QA Executor. Your job is to:',
    '1. Read the test plan from the Reviewer',
    '2. Verify the Solver\'s implementation against each test case',
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
  ].join('\n')
}

export function formatSelfFixMessage(wf: PodWorkflow, testOutput: string): string {
  const attemptNumber = wf.selfFixAttempts + 1
  const codeChanges = wf.solver.output || 'No solver output available.'

  return [
    `## Pod Workflow: ${wf.name}`,
    `### Stage: Self-Fix (Attempt ${attemptNumber}/${wf.maxSelfFixes}, Iteration ${wf.iteration}/${wf.maxIterations})`,
    '',
    'Your test run failed with these errors:',
    testOutput || 'No test output captured.',
    '',
    'The original task was:',
    wf.task,
    '',
    'Your code changes were:',
    codeChanges,
    '',
    'Diagnose the failure and generate a minimal fix. Only fix what\'s broken.',
    'Do NOT rewrite the solution — make the smallest change that fixes the test.',
  ].join('\n')
}

export function parseTestPassed(output: string): boolean {
  const normalized = (output || '').toUpperCase()
  if (!normalized.trim()) return false
  if (normalized.includes('RESULT: PASS')) return true
  if (normalized.includes('RESULT: FAIL')) return false
  return normalized.includes('PASS') && !normalized.includes('FAIL')
}

// ── Core workflow stages ─────────────────────────────────────────────────────

async function runSolveStage(wf: PodWorkflow, feedback?: string): Promise<boolean> {
  setStatus(wf, 'solving')
  wf.solver.status = 'active'
  wf.reviewer.status = 'waiting'
  wf.executor.status = 'waiting'

  const candidateCount = wf.solverCandidateCount

  if (candidateCount <= 1) {
    // ── Single candidate path (original behavior) ──
    const prompt = formatSolverMessage(wf, feedback)
    console.log(`[pods] Running solver ${wf.solver.agentId} headless in ${wf.cwd}`)
    const startMs = Date.now()
    const result = await runAgentHeadless(wf.solver.agentId, wf.cwd, prompt, {
      timeoutMs: EXECUTE_TIMEOUT_MS,
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
    console.log(`[pods] Solver done (${Math.round((result.durationMs ?? 0) / 1000)}s)`)
    return true
  }

  // ── Multi-candidate path (best-of-N) ──
  console.log(`[pods] Running ${candidateCount} solver candidates in parallel`)
  const prompt = formatSolverMessage(wf, feedback)
  const startMs = Date.now()

  const promises = Array.from({ length: candidateCount }, (_, i) =>
    runAgentHeadless(wf.solver.agentId, wf.cwd, prompt, {
      timeoutMs: EXECUTE_TIMEOUT_MS,
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
      timeoutMs: PLAN_TIMEOUT_MS,
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
      wf.solver.output = candidates[0].output
      wf.solver.status = 'complete'
      wf.selfEvaluation = { selected: 1, confidence: 0, reasoning: 'Self-eval parse failed — defaulting to first candidate' }
    }
  } else {
    // Single candidate survived or self-eval disabled
    wf.solver.output = candidates[0].output
    wf.solver.status = 'complete'
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
    timeoutMs: PLAN_TIMEOUT_MS,
  })

  if (!result.success) {
    wf.error = `Reviewer failed: ${result.error}`
    setStatus(wf, 'failed')
    return false
  }

  wf.reviewer.status = 'complete'
  wf.reviewer.output = result.output
  console.log(`[pods] Reviewer done (${Math.round(result.durationMs / 1000)}s)`)
  return true
}

async function runExecuteStage(wf: PodWorkflow): Promise<{ passed: boolean }> {
  setStatus(wf, 'executing')
  wf.executor.status = 'active'

  const prompt = formatExecutorMessage(wf, wf.solver.output, wf.reviewer.output)
  console.log(`[pods] Running executor ${wf.executor.agentId} headless in ${wf.cwd}`)
  const result = await runAgentHeadless(wf.executor.agentId, wf.cwd, prompt, {
    timeoutMs: EXECUTE_TIMEOUT_MS,
  })

  if (!result.success) {
    wf.error = `Executor failed: ${result.error}`
    setStatus(wf, 'failed')
    return { passed: false }
  }

  wf.executor.status = 'complete'
  wf.executor.output = result.output
  console.log(`[pods] Executor done (${Math.round(result.durationMs / 1000)}s)`)

  const passed = parseTestPassed(wf.executor.output || '')
  return { passed }
}

// ── CLAUDE.md auto-update ───────────────────────────────────────────────────

function appendWorkflowSummary(wf: PodWorkflow): void {
  const sharedMemoryPath = path.resolve(__dirname, '..', '..', 'agents', 'CLAUDE.md')
  if (!fs.existsSync(sharedMemoryPath)) return

  try {
    const date = new Date().toISOString().split('T')[0]
    const result = wf.status === 'complete' ? 'PASS' : 'FAIL'
    const summary = [
      '',
      `### Workflow: ${wf.name} (${date})`,
      `- Task: ${wf.task.slice(0, 200)}`,
      `- Team: ${wf.solver.agentId} / ${wf.reviewer.agentId} / ${wf.executor.agentId}`,
      `- Result: ${result} (${wf.iteration}/${wf.maxIterations} iterations)`,
      `- Key output: ${(wf.executor.output || wf.solver.output || 'N/A').slice(0, 150)}`,
      '',
    ].join('\n')

    fs.appendFileSync(sharedMemoryPath, summary)
    console.log(`[pods] Appended workflow summary to CLAUDE.md`)
  } catch (err) {
    console.error('[pods] Failed to update CLAUDE.md:', err)
  }
}

async function runWorkflow(wf: PodWorkflow): Promise<void> {
  try {
    for (let i = wf.iteration; i <= wf.maxIterations; i++) {
      wf.iteration = i

      if (wf.status === 'paused') return

      // Stage 1: Solve (with best-of-N when configured)
      const feedback = i > 1 ? wf.executor.output : undefined
      const solveOk = await runSolveStage(wf, feedback)
      if (!solveOk || wf.status === 'paused') return

      // Stage 2: Review (only on first iteration)
      if (i === 1) {
        const reviewOk = await runReviewStage(wf)
        if (!reviewOk || wf.status === 'paused') return
      }

      // Stage 3: Execute
      const { passed } = await runExecuteStage(wf)
      if (wf.status === 'failed' || wf.status === 'paused') return

      if (passed) {
        setStatus(wf, 'complete')
        appendWorkflowSummary(wf)
        return
      }

      let latestFailureOutput = wf.executor.output || ''
      while (wf.selfFixAttempts < wf.maxSelfFixes) {
        const attemptNumber = wf.selfFixAttempts + 1
        setStatus(wf, 'self-fixing')
        wf.executor.status = 'active'
        wf.selfFixAttempts = attemptNumber

        const prompt = formatSelfFixMessage(wf, latestFailureOutput)
        const result = await runAgentHeadless(wf.executor.agentId, wf.cwd, prompt, {
          timeoutMs: EXECUTE_TIMEOUT_MS,
        })

        if (!result.success) {
          latestFailureOutput = `Self-fix attempt failed: ${result.error || 'Unknown executor error'}`
          wf.executor.output = latestFailureOutput
          wf.executor.status = 'failed'
          wf.artifacts.push({
            stage: 'self-fix',
            path: `self-fix-attempt-${attemptNumber}-fail`,
            iteration: wf.iteration,
            timestamp: Date.now(),
          })
          savePods()
          continue
        }

        wf.executor.status = 'complete'
        wf.executor.output = result.output
        latestFailureOutput = result.output || ''
        const selfFixPassed = parseTestPassed(latestFailureOutput)
        wf.artifacts.push({
          stage: 'self-fix',
          path: `self-fix-attempt-${attemptNumber}-${selfFixPassed ? 'pass' : 'fail'}`,
          iteration: wf.iteration,
          timestamp: Date.now(),
        })
        savePods()

        if (selfFixPassed) {
          setStatus(wf, 'complete')
          appendWorkflowSummary(wf)
          return
        }
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
    activeWorkflowPromises.delete(wf.id)
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

  let cwd = opts.cwd
  if (!cwd) {
    const solverCfg = getAgentConfig(solver)
    cwd = solverCfg?.defaultRepos[0] || process.env.HOME || '/tmp'
  }

  const phaseConfig = getPhaseConfig(opts.priority)
  const candidateCount = opts.solverCandidates ?? phaseConfig.candidates
  const maxSelfFixes = opts.maxSelfFixes ?? phaseConfig.maxSelfFixes

  const wf: PodWorkflow = {
    id: generateId(),
    name: opts.name || task.slice(0, 60),
    status: 'pending',
    task,
    cwd,
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
    createdAt: Date.now(),
    updatedAt: Date.now(),
    stageHistory: [{ stage: 'pending', enteredAt: Date.now() }],
  }

  workflows.set(wf.id, wf)
  savePods()

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
