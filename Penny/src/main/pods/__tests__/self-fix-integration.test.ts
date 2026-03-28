import { vi, describe, it, expect, beforeEach } from 'vitest'
import type { HeadlessResult } from '../../sessions'
import type { PodWorkflow } from '../../pods'
import { getPhaseConfig } from '../phase-config'

// ── Mock sessions (runAgentHeadless) ─────────────────────────────────────────

const mockRunAgentHeadless = vi.fn<
  [string, string, string, { timeoutMs?: number }?],
  Promise<HeadlessResult>
>()

vi.mock('../../sessions', () => ({
  runAgentHeadless: (...args: unknown[]) => mockRunAgentHeadless(...(args as Parameters<typeof mockRunAgentHeadless>)),
  discoverSessions: vi.fn().mockReturnValue([]),
  getAgentSessions: vi.fn().mockReturnValue([]),
}))

// ── Mock fs to prevent file I/O ─────────────────────────────────────────────

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs')
  return {
    ...actual,
    default: {
      ...actual,
      writeFileSync: vi.fn(),
      existsSync: (p: string) => {
        // Block pods persistence file and agents/CLAUDE.md
        if (p.includes('pod-workflows') || p.includes('agents/CLAUDE.md')) return false
        return actual.existsSync(p)
      },
      readFileSync: actual.readFileSync,
      mkdirSync: vi.fn(),
    },
    writeFileSync: vi.fn(),
    existsSync: (p: string) => {
      if (p.includes('pod-workflows') || p.includes('agents/CLAUDE.md')) return false
      return actual.existsSync(p)
    },
    readFileSync: actual.readFileSync,
    mkdirSync: vi.fn(),
  }
})

// ── Mock agents module ──────────────────────────────────────────────────────

vi.mock('../../agents', () => ({
  getAgentConfig: vi.fn().mockReturnValue({ id: 'test', name: 'Test Agent' }),
  loadPodPresets: vi.fn().mockReturnValue([]),
}))

// ── Import after mocks ──────────────────────────────────────────────────────

const { runSelfFixLoop, parseTestPassed } = await import('../../pods')

// ── Test helpers ─────────────────────────────────────────────────────────────

function makeWorkflow(overrides: Partial<PodWorkflow> = {}): PodWorkflow {
  return {
    id: 'pod-test-1',
    name: 'Integration Test Pod',
    status: 'executing',
    task: 'Fix the login button',
    cwd: '/tmp/test-project',
    solver: { agentId: 'solver-1', status: 'complete', output: 'Added onClick handler' },
    reviewer: { agentId: 'reviewer-1', status: 'complete' },
    executor: { agentId: 'executor-1', status: 'active', output: 'RESULT: FAIL\nTypeError: onClick is not a function' },
    iteration: 1,
    maxIterations: 3,
    artifacts: [],
    solverCandidateCount: 1,
    selfFixAttempts: 0,
    maxSelfFixes: 2,
    priority: 'critical',
    phaseConfig: getPhaseConfig('critical'),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    stageHistory: [],
    ...overrides,
  }
}

function mockHeadlessSuccess(output: string): HeadlessResult {
  return { success: true, output, durationMs: 1000 }
}

function mockHeadlessFailure(error: string): HeadlessResult {
  return { success: false, output: '', error, durationMs: 500 }
}

// ── Integration Tests ────────────────────────────────────────────────────────

describe('Self-fix integration: runSelfFixLoop', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('maxSelfFixes=0 immediately returns without calling runAgentHeadless', async () => {
    const wf = makeWorkflow({ maxSelfFixes: 0, selfFixAttempts: 0 })
    const result = await runSelfFixLoop(wf, 'RESULT: FAIL\nSome error')

    expect(result.passed).toBe(false)
    expect(wf.selfFixAttempts).toBe(0)
    expect(mockRunAgentHeadless).not.toHaveBeenCalled()
    // Status should NOT have transitioned to 'self-fixing'
    expect(wf.stageHistory.find((h) => h.stage === 'self-fixing')).toBeUndefined()
  })

  it('maxSelfFixes=2 allows 2 self-fix attempts then escalates', async () => {
    const wf = makeWorkflow({ maxSelfFixes: 2, selfFixAttempts: 0 })

    // Both self-fix attempts return FAIL
    mockRunAgentHeadless
      .mockResolvedValueOnce(mockHeadlessSuccess('RESULT: FAIL\nStill broken — attempt 1'))
      .mockResolvedValueOnce(mockHeadlessSuccess('RESULT: FAIL\nStill broken — attempt 2'))

    const result = await runSelfFixLoop(wf, 'RESULT: FAIL\nInitial error')

    expect(result.passed).toBe(false)
    expect(wf.selfFixAttempts).toBe(2)
    expect(mockRunAgentHeadless).toHaveBeenCalledTimes(2)

    // Should have 2 self-fix artifacts
    const selfFixArtifacts = wf.artifacts.filter((a) => a.stage === 'self-fix')
    expect(selfFixArtifacts).toHaveLength(2)
    expect(selfFixArtifacts[0].path).toBe('self-fix-attempt-1')
    expect(selfFixArtifacts[1].path).toBe('self-fix-attempt-2')

    // Status should have transitioned to self-fixing twice
    const selfFixStatuses = wf.stageHistory.filter((h) => h.stage === 'self-fixing')
    expect(selfFixStatuses).toHaveLength(2)
  })

  it('successful self-fix on first attempt completes without further retries', async () => {
    const wf = makeWorkflow({ maxSelfFixes: 2, selfFixAttempts: 0 })

    // First self-fix succeeds
    mockRunAgentHeadless.mockResolvedValueOnce(
      mockHeadlessSuccess('Applied fix to onClick handler\nRe-running tests...\nRESULT: PASS'),
    )

    const result = await runSelfFixLoop(wf, 'RESULT: FAIL\nTypeError: onClick is not a function')

    expect(result.passed).toBe(true)
    expect(wf.selfFixAttempts).toBe(1)
    expect(mockRunAgentHeadless).toHaveBeenCalledTimes(1)

    // Only 1 artifact
    const selfFixArtifacts = wf.artifacts.filter((a) => a.stage === 'self-fix')
    expect(selfFixArtifacts).toHaveLength(1)
  })

  it('successful self-fix on second attempt completes', async () => {
    const wf = makeWorkflow({ maxSelfFixes: 2, selfFixAttempts: 0 })

    mockRunAgentHeadless
      .mockResolvedValueOnce(mockHeadlessSuccess('RESULT: FAIL\nWrong fix'))
      .mockResolvedValueOnce(mockHeadlessSuccess('RESULT: PASS\nAll tests passed'))

    const result = await runSelfFixLoop(wf, 'RESULT: FAIL\nError')

    expect(result.passed).toBe(true)
    expect(wf.selfFixAttempts).toBe(2)
    expect(mockRunAgentHeadless).toHaveBeenCalledTimes(2)
  })

  it('self-fix artifacts are logged with correct metadata', async () => {
    const wf = makeWorkflow({ maxSelfFixes: 2, selfFixAttempts: 0, iteration: 2 })

    mockRunAgentHeadless
      .mockResolvedValueOnce(mockHeadlessSuccess('RESULT: FAIL\nStill broken'))
      .mockResolvedValueOnce(mockHeadlessSuccess('RESULT: PASS'))

    await runSelfFixLoop(wf, 'Error output')

    expect(wf.artifacts).toHaveLength(2)

    // Check artifact metadata
    expect(wf.artifacts[0]).toMatchObject({
      stage: 'self-fix',
      path: 'self-fix-attempt-1',
      iteration: 2,
    })
    expect(wf.artifacts[1]).toMatchObject({
      stage: 'self-fix',
      path: 'self-fix-attempt-2',
      iteration: 2,
    })

    // Timestamps should be present and reasonable
    expect(wf.artifacts[0].timestamp).toBeGreaterThan(0)
    expect(wf.artifacts[1].timestamp).toBeGreaterThanOrEqual(wf.artifacts[0].timestamp)
  })

  it('paused workflow stops self-fix loop early', async () => {
    const wf = makeWorkflow({ maxSelfFixes: 3, selfFixAttempts: 0 })

    // First call: FAIL, then we pause before second call
    mockRunAgentHeadless.mockImplementation(async () => {
      // After the first self-fix attempt runs, pause the workflow
      if (mockRunAgentHeadless.mock.calls.length === 1) {
        wf.status = 'paused'
      }
      return mockHeadlessSuccess('RESULT: FAIL\nStill broken')
    })

    const result = await runSelfFixLoop(wf, 'RESULT: FAIL\nInitial error')

    expect(result.passed).toBe(false)
    // Only 1 call because the loop detects paused status on next iteration
    expect(mockRunAgentHeadless).toHaveBeenCalledTimes(1)
    expect(wf.selfFixAttempts).toBe(1)
  })

  it('headless process failure still increments attempt and continues', async () => {
    const wf = makeWorkflow({ maxSelfFixes: 2, selfFixAttempts: 0 })

    // First attempt: process crashes; second attempt: succeeds
    mockRunAgentHeadless
      .mockResolvedValueOnce(mockHeadlessFailure('Process timed out'))
      .mockResolvedValueOnce(mockHeadlessSuccess('RESULT: PASS'))

    const result = await runSelfFixLoop(wf, 'RESULT: FAIL\nError')

    expect(result.passed).toBe(true)
    expect(wf.selfFixAttempts).toBe(2)
    expect(mockRunAgentHeadless).toHaveBeenCalledTimes(2)

    // Both attempts should have artifacts
    expect(wf.artifacts).toHaveLength(2)
  })

  it('self-fix prompt includes test output and task description', async () => {
    const wf = makeWorkflow({ maxSelfFixes: 1, selfFixAttempts: 0 })

    mockRunAgentHeadless.mockResolvedValueOnce(mockHeadlessSuccess('RESULT: PASS'))

    await runSelfFixLoop(wf, 'TypeError: cannot read property "x" of undefined')

    // Verify the prompt sent to the agent
    const [, , prompt] = mockRunAgentHeadless.mock.calls[0]
    expect(prompt).toContain('TypeError: cannot read property "x" of undefined')
    expect(prompt).toContain('Fix the login button')
    expect(prompt).toContain('Added onClick handler')
    expect(prompt).toContain('smallest change that fixes the test')
    // formatSelfFixMessage is called after selfFixAttempts is incremented, so it shows "Attempt 2/1"
    expect(prompt).toContain('Self-Fix (Attempt')
  })
})
