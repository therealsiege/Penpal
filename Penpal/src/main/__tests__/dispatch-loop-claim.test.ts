/**
 * Unit tests for dispatch-loop claim model integration and heartbeat API.
 *
 * Covers:
 * - dispatchLoop uses claimTask when dispatching
 * - dispatchLoop skips task when claimTask returns null (race condition)
 * - recordHeartbeat / getHeartbeat / isAgentStale
 * - _resetForTest clears heartbeat state
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const mockOrchEvents = vi.hoisted(() => {
  // Minimal EventEmitter-like object for hoisted context
  const listeners = new Map<string, Array<(...args: unknown[]) => void>>()
  return {
    on: vi.fn((event: string, fn: (...args: unknown[]) => void) => {
      if (!listeners.has(event)) listeners.set(event, [])
      listeners.get(event)!.push(fn)
    }),
    emit: vi.fn((event: string, ...args: unknown[]) => {
      for (const fn of listeners.get(event) ?? []) fn(...args)
    }),
    removeAllListeners: vi.fn(() => { listeners.clear() }),
  }
})

const dispatchQueueMocks = vi.hoisted(() => ({
  getTasksInternal: vi.fn(() => []),
  saveTasks: vi.fn(),
  orchestratorEvents: mockOrchEvents,
  calculateTaskXP: vi.fn(() => 100),
  awardXP: vi.fn(() => 200),
  awardCredits: vi.fn(() => 50),
  getModelProvider: vi.fn(() => ({ type: 'claude', model: 'claude-sonnet-4-20250514' })),
  claimTask: vi.fn(),
  PRIORITY_ORDER: { critical: 0, high: 1, normal: 2, low: 3 },
  PRIORITY_CREDITS: { critical: 200, high: 100, normal: 50, low: 25 },
}))

const sessionsMocks = vi.hoisted(() => ({
  getClaudeSessions: vi.fn(async () => []),
  sendToSession: vi.fn(),
  runAgentHeadless: vi.fn(async () => ({ sessionId: 'sess-1', pid: 1234 })),
  analyzeSession: vi.fn(() => ({ mode: 'idle', interactionType: 'none' })),
}))

const agentsMocks = vi.hoisted(() => ({
  getAgentConfigs: vi.fn(() => []),
  getAgentConfig: vi.fn(),
  getTaskRunnerKind: vi.fn(() => 'claude'),
  loadAgentSessionMap: vi.fn(() => ({})),
  removeAgentSession: vi.fn(),
}))

// ── Module mocks ────────────────────────────────────────────────────────────

vi.mock('../dispatch-queue', () => dispatchQueueMocks)

vi.mock('../sessions', () => sessionsMocks)

vi.mock('../agents', () => agentsMocks)

vi.mock('../ollama-client', () => ({
  checkOllamaAvailable: vi.fn(async () => false),
  runOllama: vi.fn(),
}))

vi.mock('../project-paths', () => ({
  resolveProjectPath: vi.fn((p: string) => `/resolved/${p}`),
  pathsReferToSameRepo: vi.fn(() => false),
}))

// ── Import module under test ────────────────────────────────────────────────

import {
  dispatchLoop,
  recordHeartbeat,
  getHeartbeat,
  isAgentStale,
  _resetForTest,
} from '../dispatch-loop'

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeTask(overrides: Record<string, unknown> = {}) {
  return {
    id: 'task-1',
    title: 'Test task',
    description: 'A test task',
    project: 'test-project',
    priority: 'normal',
    status: 'queued',
    currentStage: 'queued',
    createdAt: Date.now(),
    retryCount: 0,
    maxRetries: 2,
    requiredSkills: [],
    source: 'api',
    ...overrides,
  }
}

function makeAgent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'agent-1',
    name: 'Test Agent',
    title: 'Solver',
    podRole: 'solver',
    systemPrompt: '',
    model: 'claude-sonnet-4-20250514',
    mcpProfile: 'default',
    skills: [],
    allowedTools: [],
    subAgents: {},
    defaultRepos: [],
    avatar: '',
    desk: { row: 0, col: 0 },
    autonomy: 'full',
    ...overrides,
  }
}

// ── Setup / Teardown ────────────────────────────────────────────────────────

beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
})

afterEach(() => {
  _resetForTest()
  vi.useRealTimers()
})

// ── dispatchLoop + claimTask ────────────────────────────────────────────────

describe('dispatchLoop uses claimTask', () => {
  it('calls claimTask with agent.config.id and task.id', async () => {
    const task = makeTask()
    const agent = makeAgent()

    dispatchQueueMocks.getTasksInternal.mockReturnValue([task])
    agentsMocks.getAgentConfigs.mockReturnValue([agent])

    // Make selectAgent find this agent: need a session or agent config
    sessionsMocks.getClaudeSessions.mockResolvedValue([])

    // claimTask returns the claimed task
    const claimedTask = { ...task, status: 'assigned', assignedAgent: 'agent-1', assignedAt: Date.now() }
    dispatchQueueMocks.claimTask.mockReturnValue(claimedTask)

    await dispatchLoop()

    expect(dispatchQueueMocks.claimTask).toHaveBeenCalledWith('agent-1', 'task-1')
  })

  it('skips task when claimTask returns null (race condition)', async () => {
    const task = makeTask()
    const agent = makeAgent()

    dispatchQueueMocks.getTasksInternal.mockReturnValue([task])
    agentsMocks.getAgentConfigs.mockReturnValue([agent])
    sessionsMocks.getClaudeSessions.mockResolvedValue([])

    // claimTask returns null (race condition — already claimed)
    dispatchQueueMocks.claimTask.mockReturnValue(null)

    await dispatchLoop()

    expect(dispatchQueueMocks.claimTask).toHaveBeenCalledWith('agent-1', 'task-1')
    // saveTasks should NOT be called since the task was not claimed
    expect(dispatchQueueMocks.saveTasks).not.toHaveBeenCalled()
  })
})

// ── Heartbeat API ───────────────────────────────────────────────────────────

describe('recordHeartbeat', () => {
  it('updates the heartbeat map', () => {
    const now = Date.now()
    recordHeartbeat('agent-1')

    const hb = getHeartbeat('agent-1')
    expect(hb).toBeTypeOf('number')
    expect(hb).toBeGreaterThanOrEqual(now)
  })
})

describe('isAgentStale', () => {
  it('returns false for fresh heartbeat', () => {
    recordHeartbeat('agent-1')
    expect(isAgentStale('agent-1')).toBe(false)
  })

  it('returns false when no heartbeat recorded', () => {
    expect(isAgentStale('agent-unknown')).toBe(false)
  })

  it('returns true for stale heartbeat (>120s)', () => {
    recordHeartbeat('agent-1')
    // Advance time by 121 seconds (past the 120s threshold)
    vi.advanceTimersByTime(121_000)
    expect(isAgentStale('agent-1')).toBe(true)
  })

  it('returns false just before threshold', () => {
    recordHeartbeat('agent-1')
    // Advance time by 119 seconds (just under the 120s threshold)
    vi.advanceTimersByTime(119_000)
    expect(isAgentStale('agent-1')).toBe(false)
  })
})

describe('_resetForTest', () => {
  it('clears heartbeat state', () => {
    recordHeartbeat('agent-1')
    recordHeartbeat('agent-2')
    expect(getHeartbeat('agent-1')).toBeTypeOf('number')

    _resetForTest()

    expect(getHeartbeat('agent-1')).toBeUndefined()
    expect(getHeartbeat('agent-2')).toBeUndefined()
  })
})
