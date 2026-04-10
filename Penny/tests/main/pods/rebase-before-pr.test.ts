import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Mock child_process.execSync ───────────────────────────────────────────────

const execSyncMock = vi.fn()

vi.mock('child_process', () => ({
  execSync: (...args: unknown[]) => execSyncMock(...args),
}))

// ── Mock other deps that pods.ts imports ──────────────────────────────────────

const runAgentHeadlessMock = vi.fn()
const podQualityRecordMock = vi.fn()

vi.mock('../../../src/main/sessions', () => ({
  runAgentHeadless: (...args: unknown[]) => runAgentHeadlessMock(...args),
}))

vi.mock('../../../src/main/evals/collectors/pod-quality', () => ({
  podQualityCollector: {
    record: (...args: unknown[]) => podQualityRecordMock(...args),
  },
}))

import { rebaseBeforePR, createPod, getPodStatus } from '../../../src/main/pods'

// ── Helpers ───────────────────────────────────────────────────────────────────

function ok(output: string) {
  return { success: true, output, durationMs: 25 }
}

async function waitForTerminalStatus(workflowId: string): Promise<NonNullable<ReturnType<typeof getPodStatus>>> {
  const deadline = Date.now() + 5000
  while (Date.now() < deadline) {
    const wf = getPodStatus(workflowId)
    if (wf && (wf.status === 'complete' || wf.status === 'failed')) return wf
    await new Promise((r) => setTimeout(r, 10))
  }
  throw new Error(`Timed out waiting for terminal status: ${workflowId}`)
}

// ── rebaseBeforePR unit tests ─────────────────────────────────────────────────

describe('rebaseBeforePR', () => {
  beforeEach(() => {
    execSyncMock.mockReset()
    podQualityRecordMock.mockReset()
  })

  it('returns clean when rebase exits 0', () => {
    // git rev-parse, git fetch, git rebase all succeed
    execSyncMock.mockReturnValue('')

    const result = rebaseBeforePR('/fake/cwd')
    expect(result.status).toBe('clean')

    const calls = execSyncMock.mock.calls.map((c: unknown[]) => c[0] as string)
    expect(calls.some((c) => c.includes('rev-parse --is-inside-work-tree'))).toBe(true)
    expect(calls.some((c) => c.includes('fetch origin main'))).toBe(true)
    expect(calls.some((c) => c.includes('rebase origin/main'))).toBe(true)
  })

  it('returns clean when cwd is not a git repo', () => {
    // git rev-parse throws → treated as not a git repo
    execSyncMock.mockImplementationOnce(() => {
      throw new Error('not a git repo')
    })

    const result = rebaseBeforePR('/not/a/repo')
    expect(result.status).toBe('clean')
    // Only one call (the rev-parse guard)
    expect(execSyncMock).toHaveBeenCalledTimes(1)
  })

  it('auto-resolves lock file conflicts and returns conflict-resolved', () => {
    const calls: string[] = []
    execSyncMock.mockImplementation((cmd: string) => {
      calls.push(cmd)
      if (cmd.includes('rebase origin/main')) {
        throw Object.assign(new Error('conflict'), { status: 1 })
      }
      if (cmd.includes('--diff-filter=U')) {
        return 'package-lock.json\n'
      }
      return ''
    })

    const result = rebaseBeforePR('/fake/cwd')
    expect(result.status).toBe('conflict-resolved')
    expect(result.resolvedFiles).toContain('package-lock.json')
    expect(result.conflictedFiles).toBeUndefined()
    expect(calls.some((c) => c.includes('checkout --theirs'))).toBe(true)
    expect(calls.some((c) => c.includes('rebase --continue'))).toBe(true)
  })

  it('aborts and returns conflict-aborted for unsafe conflicted files', () => {
    const calls: string[] = []
    execSyncMock.mockImplementation((cmd: string) => {
      calls.push(cmd)
      if (cmd.includes('rebase origin/main')) {
        throw Object.assign(new Error('conflict'), { status: 1 })
      }
      if (cmd.includes('--diff-filter=U')) {
        return 'src/main/pods.ts\n'
      }
      return ''
    })

    const result = rebaseBeforePR('/fake/cwd')
    expect(result.status).toBe('conflict-aborted')
    expect(result.conflictedFiles).toContain('src/main/pods.ts')
    expect(calls.some((c) => c.includes('rebase --abort'))).toBe(true)
    // Should NOT have called rebase --continue
    expect(calls.some((c) => c.includes('rebase --continue'))).toBe(false)
  })
})

// ── runWorkflow integration: rebase+PR path ───────────────────────────────────

describe('runWorkflow rebase + PR integration', () => {
  beforeEach(() => {
    execSyncMock.mockReset()
    runAgentHeadlessMock.mockReset()
    podQualityRecordMock.mockReset()
    // Opt into the rebase path: completePodWithPR normally skips git ops in VITEST
    // unless this env var is set, to avoid polluting other tests with real git commands.
    process.env.PENNY_TEST_REBASE = '1'
  })

  afterEach(() => {
    delete process.env.PENNY_TEST_REBASE
  })

  it('creates PR after clean rebase on first-pass PASS', async () => {
    // git commands: rev-parse, fetch, rebase all succeed (clean — no re-validate needed)
    execSyncMock.mockImplementation((cmd: string) => {
      if (cmd.includes('rev-parse --abbrev-ref HEAD')) return 'feature/test-branch\n'
      if (cmd.includes('pr create')) return 'https://github.com/owner/repo/pull/99\n'
      return ''
    })

    // solver, reviewer, executor — no extra re-validate call on clean rebase
    runAgentHeadlessMock
      .mockResolvedValueOnce(ok('solver output'))
      .mockResolvedValueOnce(ok('review output'))
      .mockResolvedValueOnce(ok('RESULT: PASS'))

    const wf = createPod('rebase pr task', {
      cwd: process.cwd(),
      maxIterations: 1,
      solverAgent: 'solver-a',
      reviewerAgent: 'reviewer-b',
      executorAgent: 'executor-c',
    })

    const done = await waitForTerminalStatus(wf.id)
    expect(done.status).toBe('complete')
    expect(done.prUrl).toBe('https://github.com/owner/repo/pull/99')
    expect(done.rebaseConflict).toBeFalsy()
  })

  it('creates PR with needs-rebase label when rebase conflicts on unsafe files', async () => {
    execSyncMock.mockImplementation((cmd: string) => {
      if (cmd.includes('rebase origin/main')) {
        throw Object.assign(new Error('conflict'), { status: 1 })
      }
      if (cmd.includes('--diff-filter=U')) return 'src/main/pods.ts\n'
      if (cmd.includes('rev-parse --abbrev-ref HEAD')) return 'feature/test-branch\n'
      if (cmd.includes('pr create')) return 'https://github.com/owner/repo/pull/100\n'
      return ''
    })

    runAgentHeadlessMock
      .mockResolvedValueOnce(ok('solver output'))
      .mockResolvedValueOnce(ok('review output'))
      .mockResolvedValueOnce(ok('RESULT: PASS'))

    const wf = createPod('rebase conflict task', {
      cwd: process.cwd(),
      maxIterations: 1,
      solverAgent: 'solver-a',
      reviewerAgent: 'reviewer-b',
      executorAgent: 'executor-c',
    })

    const done = await waitForTerminalStatus(wf.id)
    expect(done.status).toBe('complete')
    expect(done.rebaseConflict).toBe(true)
    expect(done.prUrl).toBe('https://github.com/owner/repo/pull/100')

    // Verify the PR was created with needs-rebase label
    const prCreateCall = execSyncMock.mock.calls.find((c: unknown[]) =>
      typeof c[0] === 'string' && (c[0] as string).includes('pr create'),
    )
    expect(prCreateCall).toBeDefined()
    expect(prCreateCall?.[0]).toContain('needs-rebase')
  })
})
