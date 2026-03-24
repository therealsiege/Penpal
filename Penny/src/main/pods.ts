import { EventEmitter } from 'events'
import fs from 'fs'
import path from 'path'
import { runAgentHeadless } from './sessions'
import { getAgentConfig, loadPodPresets } from './agents'

// ── Types ───────────────────────────────────────────────────────────────────

export type PodStatus =
  | 'pending'
  | 'solving'
  | 'reviewing'
  | 'executing'
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
  stage: 'solve' | 'review' | 'execute'
  path: string
  iteration: number
  timestamp: number
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

// ── Presets ──────────────────────────────────────────────────────────────────

// Load presets from YAML (Fix 14), falling back to hardcoded defaults
let _cachedPresets: PodPreset[] | null = null

function getPresets(): PodPreset[] {
  if (_cachedPresets) return _cachedPresets

  // Try loading from YAML first
  const yamlPresets = loadPodPresets()
  if (yamlPresets.length > 0) {
    _cachedPresets = yamlPresets
    return _cachedPresets
  }

  // Fallback to hardcoded defaults
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
      executor: 'electron-dev', // Fix 2: was fullstack-dev (collision with solver)
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

// ── Persistence (Fix 4) ─────────────────────────────────────────────────────

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
const activeWorkflowPromises = new Map<string, Promise<void>>() // Fix 3: track running workflows

export const podEvents = new EventEmitter()

// Load persisted workflows on module init (Fix 4)
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
  savePods() // Persist after every state transition (Fix 4)
}

// ── Headless execution helpers ──────────────────────────────────────────────

const PLAN_TIMEOUT_MS = 600_000   // 10 min for planning
const EXECUTE_TIMEOUT_MS = 1_800_000  // 30 min for execution

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

// ── Core workflow loop (headless) ────────────────────────────────────────────

async function runSolveStage(wf: PodWorkflow, feedback?: string): Promise<boolean> {
  setStatus(wf, 'solving')
  wf.solver.status = 'active'
  wf.reviewer.status = 'waiting'
  wf.executor.status = 'waiting'

  const prompt = formatSolverMessage(wf, feedback)
  console.log(`[pods] Running solver ${wf.solver.agentId} headless in ${wf.cwd}`)
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
  console.log(`[pods] Solver done (${Math.round(result.durationMs / 1000)}s)`)
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

  const output = (wf.executor.output || '').toUpperCase()
  const passed = output.includes('RESULT: PASS') || (output.includes('PASS') && !output.includes('FAIL'))
  return { passed }
}

// ── CLAUDE.md auto-update (Fix 8) ──────────────────────────────────────────

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

      // Check if paused
      if (wf.status === 'paused') return

      // Stage 1: Solve
      const feedback = i > 1 ? wf.executor.output : undefined
      const solveOk = await runSolveStage(wf, feedback)
      if (!solveOk || wf.status === 'paused') return

      // Stage 2: Review (only on first iteration — reviewer designs test plan once)
      if (i === 1) {
        const reviewOk = await runReviewStage(wf)
        if (!reviewOk || wf.status === 'paused') return
      }

      // Stage 3: Execute
      const { passed } = await runExecuteStage(wf)
      if (wf.status === 'failed' || wf.status === 'paused') return

      if (passed) {
        setStatus(wf, 'complete')
        // Fix 8: Auto-update CLAUDE.md
        appendWorkflowSummary(wf)
        return
      }

      // Tests failed — feedback loop
      if (i < wf.maxIterations) {
        setStatus(wf, 'feedback')
        // Reset solver status for next iteration
        wf.solver.status = 'waiting'
        wf.solver.output = undefined
      }
    }

    // Exhausted max iterations
    if (wf.status !== 'complete') {
      wf.error = `Exhausted ${wf.maxIterations} iterations without passing tests`
      setStatus(wf, 'failed')
      // Fix 8: Still record the summary on failure
      appendWorkflowSummary(wf)
    }
  } catch (err) {
    wf.error = (err as Error).message
    setStatus(wf, 'failed')
  } finally {
    // Fix 3: Remove from active promises when done
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

  // Fix 2: Validate that all three roles use different agentIds
  if (solver === reviewer || solver === executor || reviewer === executor) {
    throw new Error(
      `All three pod roles must use different agents. Got solver=${solver}, reviewer=${reviewer}, executor=${executor}`,
    )
  }

  // Resolve cwd: explicit > solver's default repo > home dir
  let cwd = opts.cwd
  if (!cwd) {
    const solverCfg = getAgentConfig(solver)
    cwd = solverCfg?.defaultRepos[0] || process.env.HOME || '/tmp'
  }

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
    createdAt: Date.now(),
    updatedAt: Date.now(),
    stageHistory: [{ stage: 'pending', enteredAt: Date.now() }],
  }

  workflows.set(wf.id, wf)
  savePods() // Fix 4: persist immediately

  // Start workflow asynchronously, track the promise (Fix 3)
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

  // Fix 3: Check if a workflow promise is already running
  if (activeWorkflowPromises.has(workflowId)) {
    console.warn(`[pods] Workflow ${workflowId} already has an active promise, skipping resume`)
    return false
  }

  // Resume from where we left off
  const promise = runWorkflow(wf)
  activeWorkflowPromises.set(workflowId, promise)
  return true
}

export function cancelPod(workflowId: string): boolean {
  const wf = workflows.get(workflowId)
  if (!wf) return false
  wf.error = 'Cancelled by user'
  setStatus(wf, 'failed')
  // Fix 6: removed dead pollingIntervals cleanup
  return true
}

export function getPodPresets(): PodPreset[] {
  return getPresets()
}
