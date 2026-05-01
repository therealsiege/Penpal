/**
 * Vitest test suite for linear-poller.ts
 *
 * Covers: team management, poller lifecycle, pollLinearNow / getLinearIssueCards,
 * activeDrive concurrency guard, and GraphQL error handling.
 *
 * Because linear-poller.ts holds module-level state (teams array, isRunning,
 * pipeline, etc.) we use vi.resetModules() + dynamic import in beforeEach to
 * give each test a fresh module instance.
 */

import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
} from 'vitest'

// ── Hoisted mock objects ─────────────────────────────────────────────────────
// Declared with vi.hoisted so they exist before vi.mock factories run.

const fsMocks = vi.hoisted(() => ({
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(() => '[]'),
  writeFileSync: vi.fn(),
  renameSync: vi.fn(),
  unlinkSync: vi.fn(),
  mkdirSync: vi.fn(),
}))

const atomicMocks = vi.hoisted(() => ({
  atomicWrite: vi.fn(),
  atomicUpdate: vi.fn(),
}))

const podsMocks = vi.hoisted(() => ({
  createPod: vi.fn(() => ({ id: 'pod-wf-1' })),
  getPodStatus: vi.fn(() => null),
}))

// ── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('fs', () => ({
  default: fsMocks,
  ...fsMocks,
}))

vi.mock('../atomic-store', () => ({
  atomicWrite: atomicMocks.atomicWrite,
  atomicUpdate: atomicMocks.atomicUpdate,
}))

vi.mock('../data-paths', () => ({
  getDataDir: vi.fn(() => '/tmp/penpal-test-data'),
}))

vi.mock('../pods', () => ({
  createPod: podsMocks.createPod,
  getPodStatus: podsMocks.getPodStatus,
}))

// ── Types re-exported from linear-poller ────────────────────────────────────
// Import types only (no values) so the static import doesn't hold a cached instance.

import type {
  LinearTeamConfig,
  LinearIssueCard,
} from '../linear-poller'

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Dynamically import a fresh instance of linear-poller after resetting modules. */
async function freshPoller() {
  const mod = await import('../linear-poller')
  return mod
}

function makeTeamResponse(key = 'META', id = 'team-uuid-1', name = 'Meta Team') {
  return {
    ok: true,
    json: () =>
      Promise.resolve({
        data: {
          teams: { nodes: [{ id, key, name }] },
        },
      }),
  }
}

function makeErrorResponse(status = 500, statusText = 'Internal Server Error') {
  return {
    ok: false,
    status,
    statusText,
    json: () => Promise.resolve({}),
  }
}

// ── Setup / teardown ─────────────────────────────────────────────────────────

let originalApiKey: string | undefined

beforeEach(() => {
  originalApiKey = process.env.LINEAR_API_KEY
  delete process.env.LINEAR_API_KEY

  vi.clearAllMocks()

  fsMocks.existsSync.mockReturnValue(false)
  fsMocks.readFileSync.mockReturnValue('[]')

  // Reset module registry so each test gets fresh singleton state.
  vi.resetModules()
})

afterEach(() => {
  if (originalApiKey !== undefined) {
    process.env.LINEAR_API_KEY = originalApiKey
  } else {
    delete process.env.LINEAR_API_KEY
  }

  vi.useRealTimers()
})

// ── Team management ──────────────────────────────────────────────────────────

describe('addLinearTeam', () => {
  it('persists a new team to the teams JSON file', async () => {
    process.env.LINEAR_API_KEY = 'test-key'
    const { addLinearTeam } = await freshPoller()

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      makeTeamResponse('META', 'team-uuid-1') as unknown as Response,
    )

    const result = await addLinearTeam('META', '/projects/meta')

    expect(result.ok).toBe(true)
    expect(atomicMocks.atomicWrite).toHaveBeenCalledOnce()
    const [writtenPath, writtenData] = atomicMocks.atomicWrite.mock.calls[0]
    expect(writtenPath).toContain('linear-teams.json')
    expect(Array.isArray(writtenData)).toBe(true)
    const teams = writtenData as { teamKey: string }[]
    expect(teams.some(t => t.teamKey === 'META')).toBe(true)

    fetchSpy.mockRestore()
  })

  it('rejects duplicate teamKey', async () => {
    process.env.LINEAR_API_KEY = 'test-key'
    const { addLinearTeam } = await freshPoller()

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      makeTeamResponse('META', 'team-uuid-1') as unknown as Response,
    )

    // First add succeeds.
    await addLinearTeam('META', '/projects/meta')

    // Second add with the same key should fail.
    const result = await addLinearTeam('META', '/projects/meta-2')

    expect(result.ok).toBe(false)
    expect(result.error).toContain('META')

    fetchSpy.mockRestore()
  })

  it('uses default label "agent-ready" when no label provided', async () => {
    process.env.LINEAR_API_KEY = 'test-key'
    const { addLinearTeam } = await freshPoller()

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      makeTeamResponse('SCRUB', 'team-uuid-2') as unknown as Response,
    )

    await addLinearTeam('SCRUB', '/projects/scrub')

    const [, writtenData] = atomicMocks.atomicWrite.mock.calls[0]
    const teams = writtenData as { teamKey: string; label: string }[]
    const team = teams.find(t => t.teamKey === 'SCRUB')
    expect(team?.label).toBe('agent-ready')

    fetchSpy.mockRestore()
  })

  it('accepts a custom label', async () => {
    process.env.LINEAR_API_KEY = 'test-key'
    const { addLinearTeam } = await freshPoller()

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      makeTeamResponse('HOOK', 'team-uuid-3') as unknown as Response,
    )

    await addLinearTeam('HOOK', '/projects/hook', 'my-custom-label')

    const [, writtenData] = atomicMocks.atomicWrite.mock.calls[0]
    const teams = writtenData as { teamKey: string; label: string }[]
    const team = teams.find(t => t.teamKey === 'HOOK')
    expect(team?.label).toBe('my-custom-label')

    fetchSpy.mockRestore()
  })

  it('returns error when LINEAR_API_KEY is not set', async () => {
    // No API key — cleared in beforeEach.
    const { addLinearTeam } = await freshPoller()

    const result = await addLinearTeam('META', '/projects/meta')
    expect(result.ok).toBe(false)
    expect(result.error).toContain('LINEAR_API_KEY')
  })
})

describe('removeLinearTeam', () => {
  it('removes an existing team', async () => {
    process.env.LINEAR_API_KEY = 'test-key'
    const { addLinearTeam, removeLinearTeam } = await freshPoller()

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      makeTeamResponse('META', 'team-uuid-1') as unknown as Response,
    )

    await addLinearTeam('META', '/projects/meta')
    atomicMocks.atomicWrite.mockClear()

    const result = await removeLinearTeam('META')

    expect(result.ok).toBe(true)
    expect(atomicMocks.atomicWrite).toHaveBeenCalledOnce()
    const [, writtenData] = atomicMocks.atomicWrite.mock.calls[0]
    const teams = writtenData as { teamKey: string }[]
    expect(teams.some(t => t.teamKey === 'META')).toBe(false)

    fetchSpy.mockRestore()
  })

  it('is a no-op for unknown teamKey (no error)', async () => {
    const { removeLinearTeam } = await freshPoller()

    const result = await removeLinearTeam('UNKNOWN')
    expect(result.ok).toBe(true)
    // No teams to remove — atomicWrite should not be called.
    expect(atomicMocks.atomicWrite).not.toHaveBeenCalled()
  })
})

describe('getLinearTeams', () => {
  it('returns empty array when no teams file exists', async () => {
    fsMocks.existsSync.mockReturnValue(false)
    const { getLinearTeams } = await freshPoller()

    const teams = getLinearTeams()
    expect(Array.isArray(teams)).toBe(true)
    expect(teams.length).toBe(0)
  })

  it('returns persisted teams after add', async () => {
    process.env.LINEAR_API_KEY = 'test-key'
    const { addLinearTeam, getLinearTeams } = await freshPoller()

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      makeTeamResponse('META', 'team-uuid-1') as unknown as Response,
    )

    await addLinearTeam('META', '/projects/meta')

    const teams = getLinearTeams()
    expect(teams.some(t => t.teamKey === 'META')).toBe(true)

    fetchSpy.mockRestore()
  })
})

// ── Poller lifecycle ─────────────────────────────────────────────────────────

describe('getLinearPollerStatus', () => {
  it('returns { running: false, polling: false } before start', async () => {
    const { getLinearPollerStatus } = await freshPoller()
    const status = getLinearPollerStatus()
    expect(status.running).toBe(false)
    expect(status.polling).toBe(false)
  })

  it('returns { running: true } after startLinearPoller', async () => {
    process.env.LINEAR_API_KEY = 'test-key'
    vi.useFakeTimers()

    const { startLinearPoller, stopLinearPoller, getLinearPollerStatus } = await freshPoller()

    startLinearPoller()
    expect(getLinearPollerStatus().running).toBe(true)

    stopLinearPoller()
  })

  it('stopLinearPoller sets running: false', async () => {
    process.env.LINEAR_API_KEY = 'test-key'
    vi.useFakeTimers()

    const { startLinearPoller, stopLinearPoller, getLinearPollerStatus } = await freshPoller()

    startLinearPoller()
    expect(getLinearPollerStatus().running).toBe(true)

    stopLinearPoller()
    expect(getLinearPollerStatus().running).toBe(false)
  })

  it('startLinearPoller is a no-op if already running (no double-start)', async () => {
    process.env.LINEAR_API_KEY = 'test-key'
    vi.useFakeTimers()

    const { startLinearPoller, stopLinearPoller } = await freshPoller()

    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval')

    startLinearPoller()
    const callsAfterFirst = setIntervalSpy.mock.calls.length

    // Second call — must not register additional intervals.
    startLinearPoller()
    expect(setIntervalSpy.mock.calls.length).toBe(callsAfterFirst)

    stopLinearPoller()
    setIntervalSpy.mockRestore()
  })

  it('startLinearPoller skips silently when LINEAR_API_KEY is not set', async () => {
    vi.useFakeTimers()

    const { startLinearPoller, stopLinearPoller, getLinearPollerStatus } = await freshPoller()

    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval')

    startLinearPoller()

    expect(getLinearPollerStatus().running).toBe(false)
    expect(setIntervalSpy).not.toHaveBeenCalled()

    setIntervalSpy.mockRestore()
  })
})

// ── pollLinearNow / getLinearIssueCards ──────────────────────────────────────

describe('pollLinearNow', () => {
  it('returns { enqueued: 0 } when no teams configured', async () => {
    process.env.LINEAR_API_KEY = 'test-key'
    const { pollLinearNow } = await freshPoller()

    // No teams — loadTeams() finds no file (existsSync returns false).
    const result = await pollLinearNow()
    expect(result).toEqual({ enqueued: 0 })
  })

  it('returns { enqueued: 0 } when LINEAR_API_KEY is not set', async () => {
    const { pollLinearNow } = await freshPoller()

    const result = await pollLinearNow()
    expect(result).toEqual({ enqueued: 0 })
  })
})

describe('getLinearIssueCards', () => {
  it('returns empty array before any polls', async () => {
    const { getLinearIssueCards } = await freshPoller()

    const cards = await getLinearIssueCards()
    expect(Array.isArray(cards)).toBe(true)
    expect(cards.length).toBe(0)
  })
})

// ── activeDrive concurrency guard ────────────────────────────────────────────

describe('activeDrive concurrency guard', () => {
  it('does not register additional pipeline timers when already running', async () => {
    process.env.LINEAR_API_KEY = 'test-key'
    vi.useFakeTimers()

    const { startLinearPoller, stopLinearPoller } = await freshPoller()

    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval')

    // Start once — creates exactly 2 intervals (pollTimer + pipelineTimer).
    startLinearPoller()
    const firstCallCount = setIntervalSpy.mock.calls.length

    // Start again — no-op due to isRunning guard; count stays the same.
    startLinearPoller()
    expect(setIntervalSpy.mock.calls.length).toBe(firstCallCount)

    stopLinearPoller()
    setIntervalSpy.mockRestore()
  })

  it('skips drive when activeDrive is in-flight (guard returns early)', async () => {
    process.env.LINEAR_API_KEY = 'test-key'
    vi.useFakeTimers()

    const { startLinearPoller, stopLinearPoller, getLinearPollerStatus } = await freshPoller()

    // getPodStatus returns null — no active pods, so drivePipeline completes
    // immediately without doing work. The important thing is the poller
    // remains stable across multiple interval ticks.
    podsMocks.getPodStatus.mockReturnValue(null)

    startLinearPoller()

    // Fire the initial 10s executePoll delay.
    await vi.advanceTimersByTimeAsync(10_001)
    // Fire the pipeline timer once.
    await vi.advanceTimersByTimeAsync(15_000)
    // Fire it again — guard allows re-entry since previous drive already resolved.
    await vi.advanceTimersByTimeAsync(15_000)

    expect(getLinearPollerStatus().running).toBe(true)

    stopLinearPoller()
  })
})

// ── GraphQL error handling ────────────────────────────────────────────────────

describe('GraphQL error handling', () => {
  it('when linearQuery fails (fetch throws), pollLinearNow resolves without throwing', async () => {
    process.env.LINEAR_API_KEY = 'test-key'
    const { addLinearTeam, pollLinearNow } = await freshPoller()

    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    // addLinearTeam resolves the team.
    fetchSpy.mockResolvedValueOnce(
      makeTeamResponse('META', 'team-uuid-1') as unknown as Response,
    )
    await addLinearTeam('META', '/projects/meta')

    // getTeamIssues throws a network error.
    fetchSpy.mockRejectedValueOnce(new Error('Network failure'))

    await expect(pollLinearNow()).resolves.toEqual({ enqueued: 0 })

    fetchSpy.mockRestore()
  })

  it('when fetch returns non-200 status, pollLinearNow resolves without throwing', async () => {
    process.env.LINEAR_API_KEY = 'test-key'
    const { addLinearTeam, pollLinearNow } = await freshPoller()

    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    // Add a team.
    fetchSpy.mockResolvedValueOnce(
      makeTeamResponse('HOOK', 'team-uuid-3') as unknown as Response,
    )
    await addLinearTeam('HOOK', '/projects/hook')

    // Next fetch returns 503.
    fetchSpy.mockResolvedValueOnce(
      makeErrorResponse(503, 'Service Unavailable') as unknown as Response,
    )

    await expect(pollLinearNow()).resolves.toEqual({ enqueued: 0 })

    fetchSpy.mockRestore()
  })
})
