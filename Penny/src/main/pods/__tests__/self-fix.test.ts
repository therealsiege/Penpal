import { describe, it, expect } from 'vitest'
import { getPhaseConfig } from '../phase-config'
import { parseTestPassed, formatSelfFixMessage } from '../../pods'
import type { PodWorkflow } from '../../pods'

// ── parseTestPassed ─────────────────────────────────────────────────────────

describe('parseTestPassed', () => {
  it('returns true for RESULT: PASS', () => {
    expect(parseTestPassed('RESULT: PASS\nAll tests passed')).toBe(true)
  })

  it('returns true for PASS-only output', () => {
    expect(parseTestPassed('Test Case 1: PASS')).toBe(true)
  })

  it('returns false for RESULT: FAIL', () => {
    expect(parseTestPassed('RESULT: FAIL\nTest Case 1: FAIL')).toBe(false)
  })

  it('returns false for mixed PASS and FAIL', () => {
    expect(parseTestPassed('Test Case 1: PASS\nTest Case 2: FAIL')).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(parseTestPassed('')).toBe(false)
  })
})

// ── formatSelfFixMessage ────────────────────────────────────────────────────

describe('formatSelfFixMessage', () => {
  function makeWorkflow(overrides: Partial<PodWorkflow> = {}): PodWorkflow {
    return {
      id: 'pod-1',
      name: 'Test Pod',
      status: 'self-fixing',
      task: 'Fix the login button',
      cwd: '/tmp/project',
      solver: { agentId: 'solver-1', status: 'complete', output: 'Added onClick handler' },
      reviewer: { agentId: 'reviewer-1', status: 'complete' },
      executor: { agentId: 'executor-1', status: 'complete', output: 'RESULT: FAIL\nTypeError: onClick is not a function' },
      iteration: 1,
      maxIterations: 3,
      artifacts: [],
      solverCandidateCount: 1,
      selfFixAttempts: 1,
      maxSelfFixes: 2,
      priority: 'normal',
      phaseConfig: getPhaseConfig('normal'),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      stageHistory: [],
      ...overrides,
    }
  }

  it('includes test error output', () => {
    const wf = makeWorkflow()
    const msg = formatSelfFixMessage(wf, 'TypeError: onClick is not a function')
    expect(msg).toContain('TypeError: onClick is not a function')
  })

  it('includes original task', () => {
    const wf = makeWorkflow()
    const msg = formatSelfFixMessage(wf, 'some error')
    expect(msg).toContain('Fix the login button')
  })

  it('includes solver output as code changes', () => {
    const wf = makeWorkflow()
    const msg = formatSelfFixMessage(wf, 'some error')
    expect(msg).toContain('Added onClick handler')
  })

  it('includes attempt counter', () => {
    const wf = makeWorkflow({ selfFixAttempts: 1, maxSelfFixes: 3 })
    const msg = formatSelfFixMessage(wf, 'some error')
    expect(msg).toContain('2/3')
  })

  it('includes minimal-fix instruction', () => {
    const wf = makeWorkflow()
    const msg = formatSelfFixMessage(wf, 'some error')
    expect(msg).toContain('smallest change that fixes the test')
  })
})

// ── PhaseConfig maxSelfFixes values ─────────────────────────────────────────

describe('PhaseConfig maxSelfFixes', () => {
  it('maxSelfFixes=0 for low priority (immediate escalation)', () => {
    expect(getPhaseConfig('low').maxSelfFixes).toBe(0)
  })

  it('maxSelfFixes=1 for normal priority', () => {
    expect(getPhaseConfig('normal').maxSelfFixes).toBe(1)
  })

  it('maxSelfFixes=1 for high priority', () => {
    expect(getPhaseConfig('high').maxSelfFixes).toBe(1)
  })

  it('maxSelfFixes=2 for critical priority (allows 2 self-fix attempts)', () => {
    expect(getPhaseConfig('critical').maxSelfFixes).toBe(2)
  })
})
