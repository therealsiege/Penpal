import { EventEmitter } from 'events'
import fs from 'fs'
import path from 'path'
import { analyzeSession, sendToSession, getClaudeSessions, createAgentSession, getSessionConversation } from './sessions'
import { getAgentConfig, loadTripletPresets } from './agents'
import { recordTaskComplete } from './agent-stats'

// ── Types ───────────────────────────────────────────────────────────────────

export type TripletStatus =
  | 'pending'
  | 'solving'
  | 'reviewing'
  | 'executing'
  | 'feedback'
  | 'complete'
  | 'failed'
  | 'paused'

export interface TripletRole {
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

export interface TripletWorkflow {
  id: string
  name: string
  status: TripletStatus
  task: string
  cwd: string
  solver: TripletRole
  reviewer: TripletRole
  executor: TripletRole
  iteration: number
  maxIterations: number
  artifacts: WorkflowArtifact[]
  createdAt: number
  updatedAt: number
  error?: string
  stageHistory: { stage: TripletStatus; enteredAt: number }[]
}

export interface TripletPreset {
  id: string
  solver: string
  reviewer: string
  executor: string
  description: string
}

// ── Presets ──────────────────────────────────────────────────────────────────

// Load presets from YAML (Fix 14), falling back to hardcoded defaults
let _cachedPresets: TripletPreset[] | null = null

function getPresets(): TripletPreset[] {
  if (_cachedPresets) return _cachedPresets

  // Try loading from YAML first
  const yamlPresets = loadTripletPresets()
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

const PERSIST_PATH = path.resolve(__dirname, '..', '..', 'data', 'triplet-workflows.json')

function saveTriplets(): void {
  try {
    const dir = path.dirname(PERSIST_PATH)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    const data = Array.from(workflows.values())
    fs.writeFileSync(PERSIST_PATH, JSON.stringify(data, null, 2))
  } catch (err) {
    console.error('[triplets] Failed to save workflows:', err)
  }
}

function loadTriplets(): void {
  try {
    if (!fs.existsSync(PERSIST_PATH)) return
    const data = JSON.parse(fs.readFileSync(PERSIST_PATH, 'utf-8')) as TripletWorkflow[]
    for (const wf of data) {
      workflows.set(wf.id, wf)
      if (wf.id.startsWith('triplet-')) {
        const num = parseInt(wf.id.split('-')[1] || '0', 10)
        if (num > workflowCounter) workflowCounter = num
      }
    }
  } catch (err) {
    console.error('[triplets] Failed to load workflows:', err)
  }
}

// ── Engine ───────────────────────────────────────────────────────────────────

let workflowCounter = 0
const workflows = new Map<string, TripletWorkflow>()
const activeWorkflowPromises = new Map<string, Promise<void>>() // Fix 3: track running workflows

export const tripletEvents = new EventEmitter()

// Load persisted workflows on module init (Fix 4)
loadTriplets()

function generateId(): string {
  workflowCounter += 1
  return `triplet-${Date.now()}-${workflowCounter}`
}

function setStatus(wf: TripletWorkflow, status: TripletStatus): void {
  wf.status = status
  wf.updatedAt = Date.now()
  wf.stageHistory.push({ stage: status, enteredAt: Date.now() })
  tripletEvents.emit('status-change', wf)
  saveTriplets() // Persist after every state transition (Fix 4)
}

// ── Output capture (Fix 1) ──────────────────────────────────────────────────

function getLastAssistantOutput(sessionId: string): string | undefined {
  const messages = getSessionConversation(sessionId, 10)
  // Walk backwards to find the last assistant message
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'assistant' && messages[i].text.trim().length > 1) {
      return messages[i].text
    }
  }
  return undefined
}

// ── Finding an agent's TTY ──────────────────────────────────────────────────

async function findAgentTty(agentId: string, targetCwd?: string): Promise<{ tty: string; sessionId: string } | null> {
  const sessions = await getClaudeSessions()
  const cfg = getAgentConfig(agentId)
  if (!cfg) return null

  // Match by agent name pattern or default repos
  for (const s of sessions) {
    if (!s.tty) continue
    // Match by name
    if (s.terminalName?.includes(`agent:${agentId}`) || s.terminalName?.includes(`dispatch:${agentId}`)) {
      return { tty: s.tty, sessionId: s.sessionId }
    }
    // Match by target cwd if specified
    if (targetCwd && s.cwd === targetCwd) {
      return { tty: s.tty, sessionId: s.sessionId }
    }
    // Match by default repos
    if (cfg.defaultRepos.some(repo => s.cwd === repo)) {
      return { tty: s.tty, sessionId: s.sessionId }
    }
  }
  return null
}

// ── Auto-launch agent if not running ────────────────────────────────────────

async function ensureAgentRunning(agentId: string, cwd: string): Promise<{ tty: string; sessionId: string } | null> {
  // First check if already running
  let info = await findAgentTty(agentId, cwd)
  if (info) return info

  // Launch it
  console.log(`[triplets] Auto-launching agent ${agentId} in ${cwd}`)
  const result = await createAgentSession(agentId, cwd)
  if (!result.success) {
    console.error(`[triplets] Failed to launch ${agentId}: ${result.error}`)
    return null
  }

  // Wait for the session to appear (agent takes a moment to start)
  for (let attempt = 0; attempt < 20; attempt++) {
    await new Promise(r => setTimeout(r, 3000))
    info = await findAgentTty(agentId, cwd)
    if (info) return info
  }

  console.error(`[triplets] Agent ${agentId} launched but session not found after 60s`)
  return null
}

// ── Stage detection ─────────────────────────────────────────────────────────

async function waitForAgentIdle(
  agentId: string,
  role: TripletRole,
  timeoutMs = 300000,
): Promise<{ idle: boolean; output?: string }> {
  let elapsed = 0

  return new Promise((resolve) => {
    const check = async () => {
      if (elapsed > timeoutMs) {
        resolve({ idle: false })
        return
      }

      const info = await findAgentTty(agentId)
      if (!info) {
        // Agent not found yet, keep waiting
        elapsed += 3000
        setTimeout(check, 3000)
        return
      }

      role.tty = info.tty
      role.sessionId = info.sessionId

      const analysis = analyzeSession(info.sessionId)

      // Fix 5: Don't count time spent waiting for tool approval against the timeout
      const isApprovalWait = analysis.interactionType === 'tool-approval' ||
        analysis.interactionType === 'accept-edits'

      // Agent is idle (end_turn) — task is done
      if (analysis.mode === 'idle' || analysis.interactionType === 'idle-prompt') {
        // Fix 1: Read the actual output from the JSONL transcript
        const output = getLastAssistantOutput(info.sessionId)
        resolve({ idle: true, output })
        return
      }

      // Agent needs approval — surface to dashboard but keep polling
      if (analysis.waitingForInput) {
        tripletEvents.emit('needs-interaction', { agentId, analysis })
      }

      // Fix 5: Only increment elapsed time if not waiting for approval
      if (!isApprovalWait) {
        elapsed += 3000
      }

      setTimeout(check, 3000)
    }

    check()
  })
}

// ── Message formatting ──────────────────────────────────────────────────────

function formatSolverMessage(wf: TripletWorkflow, feedbackFromExecutor?: string): string {
  const header = `## Triplet Workflow: ${wf.name}\n### Stage: Solve (Iteration ${wf.iteration}/${wf.maxIterations})\n`
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

function formatReviewerMessage(wf: TripletWorkflow): string {
  return [
    `## Triplet Workflow: ${wf.name}`,
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

function formatExecutorMessage(wf: TripletWorkflow, solverOutput?: string, reviewerOutput?: string): string {
  return [
    `## Triplet Workflow: ${wf.name}`,
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

// ── Core workflow loop ──────────────────────────────────────────────────────

async function runSolveStage(wf: TripletWorkflow, feedback?: string): Promise<boolean> {
  setStatus(wf, 'solving')
  wf.solver.status = 'active'
  wf.reviewer.status = 'waiting'
  wf.executor.status = 'waiting'

  const msg = formatSolverMessage(wf, feedback)
  const info = await ensureAgentRunning(wf.solver.agentId, wf.cwd)
  if (!info) {
    wf.error = `Solver agent ${wf.solver.agentId} could not be found or launched in ${wf.cwd}`
    setStatus(wf, 'failed')
    return false
  }

  wf.solver.tty = info.tty
  wf.solver.sessionId = info.sessionId

  const sendResult = await sendToSession(info.tty, msg)
  if (!sendResult.success) {
    wf.error = `Failed to send to solver: ${sendResult.error}`
    setStatus(wf, 'failed')
    return false
  }

  const result = await waitForAgentIdle(wf.solver.agentId, wf.solver)
  if (!result.idle) {
    wf.error = 'Solver timed out'
    setStatus(wf, 'failed')
    return false
  }

  wf.solver.status = 'complete'
  wf.solver.output = result.output
  return true
}

async function runReviewStage(wf: TripletWorkflow): Promise<boolean> {
  setStatus(wf, 'reviewing')
  wf.reviewer.status = 'active'

  const msg = formatReviewerMessage(wf)
  const info = await ensureAgentRunning(wf.reviewer.agentId, wf.cwd)
  if (!info) {
    wf.error = `Reviewer agent ${wf.reviewer.agentId} could not be found or launched in ${wf.cwd}`
    setStatus(wf, 'failed')
    return false
  }

  wf.reviewer.tty = info.tty
  wf.reviewer.sessionId = info.sessionId

  const sendResult = await sendToSession(info.tty, msg)
  if (!sendResult.success) {
    wf.error = `Failed to send to reviewer: ${sendResult.error}`
    setStatus(wf, 'failed')
    return false
  }

  const result = await waitForAgentIdle(wf.reviewer.agentId, wf.reviewer)
  if (!result.idle) {
    wf.error = 'Reviewer timed out'
    setStatus(wf, 'failed')
    return false
  }

  wf.reviewer.status = 'complete'
  wf.reviewer.output = result.output
  return true
}

async function runExecuteStage(wf: TripletWorkflow): Promise<{ passed: boolean }> {
  setStatus(wf, 'executing')
  wf.executor.status = 'active'

  const msg = formatExecutorMessage(wf, wf.solver.output, wf.reviewer.output)
  const info = await ensureAgentRunning(wf.executor.agentId, wf.cwd)
  if (!info) {
    wf.error = `Executor agent ${wf.executor.agentId} could not be found or launched in ${wf.cwd}`
    setStatus(wf, 'failed')
    return { passed: false }
  }

  wf.executor.tty = info.tty
  wf.executor.sessionId = info.sessionId

  const sendResult = await sendToSession(info.tty, msg)
  if (!sendResult.success) {
    wf.error = `Failed to send to executor: ${sendResult.error}`
    setStatus(wf, 'failed')
    return { passed: false }
  }

  const result = await waitForAgentIdle(wf.executor.agentId, wf.executor)
  if (!result.idle) {
    wf.error = 'Executor timed out'
    setStatus(wf, 'failed')
    return { passed: false }
  }

  wf.executor.status = 'complete'
  wf.executor.output = result.output

  // Check if executor reported PASS or FAIL
  const output = (wf.executor.output || '').toUpperCase()
  const passed = output.includes('RESULT: PASS') || (output.includes('PASS') && !output.includes('FAIL'))
  return { passed }
}

// ── CLAUDE.md auto-update (Fix 8) ──────────────────────────────────────────

function appendWorkflowSummary(wf: TripletWorkflow): void {
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
    console.log(`[triplets] Appended workflow summary to CLAUDE.md`)
  } catch (err) {
    console.error('[triplets] Failed to update CLAUDE.md:', err)
  }
}

async function runWorkflow(wf: TripletWorkflow): Promise<void> {
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
        // Record task completions for gamification
        recordTaskComplete(wf.solver.agentId)
        recordTaskComplete(wf.reviewer.agentId)
        recordTaskComplete(wf.executor.agentId)
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

export interface CreateTripletOpts {
  name?: string
  cwd?: string
  maxIterations?: number
  presetId?: string
  solverAgent?: string
  reviewerAgent?: string
  executorAgent?: string
}

export function createTriplet(task: string, opts: CreateTripletOpts = {}): TripletWorkflow {
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
      `All three triplet roles must use different agents. Got solver=${solver}, reviewer=${reviewer}, executor=${executor}`,
    )
  }

  // Resolve cwd: explicit > solver's default repo > home dir
  let cwd = opts.cwd
  if (!cwd) {
    const solverCfg = getAgentConfig(solver)
    cwd = solverCfg?.defaultRepos[0] || process.env.HOME || '/tmp'
  }

  const wf: TripletWorkflow = {
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
  saveTriplets() // Fix 4: persist immediately

  // Start workflow asynchronously, track the promise (Fix 3)
  const promise = runWorkflow(wf)
  activeWorkflowPromises.set(wf.id, promise)

  return wf
}

export function getTripletStatus(workflowId: string): TripletWorkflow | null {
  return workflows.get(workflowId) ?? null
}

export function listTriplets(): TripletWorkflow[] {
  return Array.from(workflows.values()).sort((a, b) => b.updatedAt - a.updatedAt)
}

export function pauseTriplet(workflowId: string): boolean {
  const wf = workflows.get(workflowId)
  if (!wf || wf.status === 'complete' || wf.status === 'failed') return false
  setStatus(wf, 'paused')
  return true
}

export function resumeTriplet(workflowId: string): boolean {
  const wf = workflows.get(workflowId)
  if (!wf || wf.status !== 'paused') return false

  // Fix 3: Check if a workflow promise is already running
  if (activeWorkflowPromises.has(workflowId)) {
    console.warn(`[triplets] Workflow ${workflowId} already has an active promise, skipping resume`)
    return false
  }

  // Resume from where we left off
  const promise = runWorkflow(wf)
  activeWorkflowPromises.set(workflowId, promise)
  return true
}

export function cancelTriplet(workflowId: string): boolean {
  const wf = workflows.get(workflowId)
  if (!wf) return false
  wf.error = 'Cancelled by user'
  setStatus(wf, 'failed')
  // Fix 6: removed dead pollingIntervals cleanup
  return true
}

export function getTripletPresets(): TripletPreset[] {
  return getPresets()
}
