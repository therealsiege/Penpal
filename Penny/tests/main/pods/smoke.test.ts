import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PHASE_CONFIGS } from '../../../../src/main/pods/phase-config'

const { runAgentHeadlessMock } = vi.hoisted(() => ({
  runAgentHeadlessMock: vi.fn(),
}))

vi.mock('../../../src/main/sessions', () => ({
  runAgentHeadless: runAgentHeadlessMock,
}))

import { createPod, formatSelfEvalMessage, getPodStatus, parseSelfEvalResult } from '../../../src/main/pods'

type HeadlessResult = {
  success: boolean
  output: string
  error?: string
  durationMs: number
}

async function waitForWorkflowDone(workflowId: string): Promise<NonNullable<ReturnType<typeof getPodStatus>>> {
  const timeoutAt = Date.now() + 5000
  while (Date.now() < timeoutAt) {
    const wf = getPodStatus(workflowId)
    if (wf && (wf.status === 'complete' || wf.status === 'failed')) return wf
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error(`Timed out waiting for workflow ${workflowId}`)
}

function ok(output: string): HeadlessResult {
  return { success: true, output, durationMs: 25 }
}

function fail(error: string): HeadlessResult {
  return { success: false, output: '', error, durationMs: 25 }
}

describe('solver best-of-N flow', () => {
  beforeEach(() => {
    runAgentHeadlessMock.mockReset()
  })

  it('keeps candidates=1 behavior and uses single solve output', async () => {
    runAgentHeadlessMock
      .mockResolvedValueOnce(ok('single-solver-output'))
      .mockResolvedValueOnce(ok('review-plan'))
      .mockResolvedValueOnce(ok('RESULT: PASS'))

    const wf = createPod('single candidate task', {
      cwd: '/tmp',
      solverAgent: 'solver-a',
      reviewerAgent: 'reviewer-b',
      executorAgent: 'executor-c',
      maxIterations: 1,
      solverCandidates: 1,
    })

    const done = await waitForWorkflowDone(wf.id)
    expect(done.status).toBe('complete')
    expect(done.solver.output).toBe('single-solver-output')
    expect(done.selfEvaluation).toBeUndefined()
    // Single-candidate solve path records output on the role only; solve-stage artifacts are written for multi-candidate runs.
    expect(done.artifacts.filter((a) => a.stage === 'solve')).toHaveLength(0)
    expect(done.solverCandidates).toHaveLength(1)
  })

  it('creates three solve artifacts and marks exactly one selected', async () => {
    runAgentHeadlessMock
      .mockResolvedValueOnce(ok('candidate-1-output'))
      .mockResolvedValueOnce(ok('candidate-2-output'))
      .mockResolvedValueOnce(ok('candidate-3-output'))
      .mockResolvedValueOnce(ok('{ "selected": 2, "confidence": 0.9, "reasoning": "best" }'))
      .mockResolvedValueOnce(ok('review-plan'))
      .mockResolvedValueOnce(ok('RESULT: PASS'))

    const wf = createPod('multi candidate task', {
      cwd: '/tmp',
      solverAgent: 'solver-a',
      reviewerAgent: 'reviewer-b',
      executorAgent: 'executor-c',
      maxIterations: 1,
      priority: 'critical',
      solverCandidates: 3,
    })

    expect(wf.phaseConfig).toEqual(PHASE_CONFIGS.critical)

    const done = await waitForWorkflowDone(wf.id)
    expect(done.status).toBe('complete')
    expect(done.solverCandidates).toHaveLength(3)
    const solveArtifacts = done.artifacts.filter((a) => a.stage === 'solve' && a.iteration === done.iteration)
    expect(solveArtifacts).toHaveLength(3)
    expect(solveArtifacts.filter((a) => a.selected)).toHaveLength(1)
    expect(done.selfEvaluation?.selected).toBe(2)
    expect(done.solver.output).toBe('candidate-2-output')
  })

  it('falls back deterministically when self-eval JSON is invalid', async () => {
    runAgentHeadlessMock
      .mockResolvedValueOnce(ok('candidate-1-output'))
      .mockResolvedValueOnce(ok('candidate-2-output'))
      .mockResolvedValueOnce(ok('candidate-3-output'))
      .mockResolvedValueOnce(ok('not valid json'))
      .mockResolvedValueOnce(ok('review-plan'))
      .mockResolvedValueOnce(ok('RESULT: PASS'))

    const wf = createPod('invalid self eval task', {
      cwd: '/tmp',
      solverAgent: 'solver-a',
      reviewerAgent: 'reviewer-b',
      executorAgent: 'executor-c',
      maxIterations: 1,
      priority: 'critical',
      solverCandidates: 3,
    })

    const done = await waitForWorkflowDone(wf.id)
    expect(done.status).toBe('complete')
    expect(done.solver.output).toBe('candidate-1-output')
    expect(done.selfEvaluation?.selected).toBe(1)
    const solveArtifacts = done.artifacts.filter((a) => a.stage === 'solve' && a.iteration === done.iteration)
    expect(solveArtifacts.filter((a) => a.selected)).toHaveLength(1)
    expect(solveArtifacts.find((a) => a.selected)?.candidateIndex).toBe(1)
  })

  it('fails workflow when all candidates fail', async () => {
    runAgentHeadlessMock
      .mockResolvedValueOnce(fail('candidate 1 failed'))
      .mockResolvedValueOnce(fail('candidate 2 failed'))
      .mockResolvedValueOnce(fail('candidate 3 failed'))
      .mockResolvedValueOnce(fail('candidate 1 retry failed'))
      .mockResolvedValueOnce(fail('candidate 2 retry failed'))
      .mockResolvedValueOnce(fail('candidate 3 retry failed'))

    const wf = createPod('all fail task', {
      cwd: '/tmp',
      solverAgent: 'solver-a',
      reviewerAgent: 'reviewer-b',
      executorAgent: 'executor-c',
      maxIterations: 1,
      priority: 'critical',
      solverCandidates: 3,
    })

    const done = await waitForWorkflowDone(wf.id)
    expect(done.status).toBe('failed')
    expect(done.error).toContain('All solver candidates failed')
    expect(done.solverCandidates ?? []).toHaveLength(0)
  })

  it('stores normal phase config when priority is unknown', () => {
    const wf = createPod('unknown priority task', {
      cwd: '/tmp',
      solverAgent: 'solver-a',
      reviewerAgent: 'reviewer-b',
      executorAgent: 'executor-c',
      maxIterations: 1,
      priority: 'urgent',
      solverCandidates: 1,
    })

    expect(wf.phaseConfig).toEqual(PHASE_CONFIGS.normal)
  })
})

describe('self-eval helpers', () => {
  it('parses valid self-eval JSON', () => {
    const parsed = parseSelfEvalResult('{ "selected": 2, "confidence": 0.7, "reasoning": "best" }', 3)
    expect(parsed).toEqual({ selected: 2, confidence: 0.7, reasoning: 'best' })
  })

  it('rejects invalid self-eval JSON fields and bounds', () => {
    expect(parseSelfEvalResult('{ "selected": 0, "confidence": 0.7, "reasoning": "bad index" }', 3)).toBeNull()
    expect(parseSelfEvalResult('{ "selected": 2, "confidence": 1.4, "reasoning": "bad confidence" }', 3)).toBeNull()
    // Non-string reasoning is coerced via String() for resilience
    expect(parseSelfEvalResult('{ "selected": 2, "confidence": 0.7, "reasoning": 123 }', 3)).toEqual({
      selected: 2,
      confidence: 0.7,
      reasoning: '123',
    })
  })

  it('formats self-eval prompt with criteria and candidates', () => {
    const msg = formatSelfEvalMessage('Solve task', [
      { index: 1, output: 'A', agentId: 'solver', durationMs: 10 },
      { index: 2, output: 'B', agentId: 'solver', durationMs: 10 },
      { index: 3, output: 'C', agentId: 'solver', durationMs: 10 },
    ])
    expect(msg).toContain('Correctness')
    expect(msg).toContain('Completeness')
    expect(msg).toContain('Simplicity')
    expect(msg).toContain('Candidate 1')
    expect(msg).toContain('Candidate 2')
    expect(msg).toContain('Candidate 3')
  })
})
