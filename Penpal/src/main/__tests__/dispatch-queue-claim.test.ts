/**
 * Unit tests for claimTask / releaseTask / claimNextTask in dispatch-queue.ts
 */

import { describe, it, expect, vi, afterEach } from 'vitest'

// ── Hoisted mocks ────────────────────────────────────────────────────────────

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

vi.mock('../project-paths', () => ({
  normalizeEnqueueProject: vi.fn((p: string) => p),
  migratePersistedProject: vi.fn((p: string) => p),
}))

// ── Import module under test ─────────────────────────────────────────────────

import {
  enqueueTask,
  claimTask,
  releaseTask,
  claimNextTask,
  resetForTest,
  orchestratorEvents,
} from '../dispatch-queue'

// ── Helpers ──────────────────────────────────────────────────────────────────

function createTask(overrides: {
  title?: string
  project?: string
  priority?: 'critical' | 'high' | 'normal' | 'low'
} = {}) {
  return enqueueTask({
    title: overrides.title ?? 'Test task',
    description: 'A test task',
    project: overrides.project ?? 'test-project',
    priority: overrides.priority ?? 'normal',
    source: 'api',
  })
}

// ── Cleanup ──────────────────────────────────────────────────────────────────

afterEach(() => {
  resetForTest()
  vi.clearAllMocks()
})

// ── claimTask ────────────────────────────────────────────────────────────────

describe('claimTask', () => {
  it('claims a queued task and sets assigned status', () => {
    const task = createTask()
    const emitSpy = vi.spyOn(orchestratorEvents, 'emit')

    const claimed = claimTask('agent-1', task.id)

    expect(claimed).not.toBeNull()
    expect(claimed!.status).toBe('assigned')
    expect(claimed!.assignedAgent).toBe('agent-1')
    expect(claimed!.assignedAt).toBeTypeOf('number')
    expect(emitSpy).toHaveBeenCalledWith('task-claimed', claimed)
  })

  it('returns null for non-existent task', () => {
    const result = claimTask('agent-1', 'does-not-exist')
    expect(result).toBeNull()
  })

  it('returns null for already-assigned task', () => {
    const task = createTask()
    claimTask('agent-1', task.id)

    const second = claimTask('agent-2', task.id)
    expect(second).toBeNull()
  })
})

// ── releaseTask ──────────────────────────────────────────────────────────────

describe('releaseTask', () => {
  it('returns task to queued status', () => {
    const task = createTask()
    claimTask('agent-1', task.id)
    const emitSpy = vi.spyOn(orchestratorEvents, 'emit')

    const released = releaseTask(task.id)

    expect(released).toBe(true)
    expect(task.status).toBe('queued')
    expect(task.assignedAgent).toBeUndefined()
    expect(task.assignedAt).toBeUndefined()
    expect(emitSpy).toHaveBeenCalledWith('task-released', task)
  })

  it('returns false for completed task', () => {
    const task = createTask()
    // Manually set to completed to test the guard
    task.status = 'completed'

    const result = releaseTask(task.id)
    expect(result).toBe(false)
  })

  it('stores reason in error field', () => {
    const task = createTask()
    claimTask('agent-1', task.id)

    releaseTask(task.id, 'agent crashed')

    expect(task.error).toBe('agent crashed')
    expect(task.status).toBe('queued')
  })
})

// ── claimNextTask ────────────────────────────────────────────────────────────

describe('claimNextTask', () => {
  it('claims highest priority queued task', () => {
    const low = createTask({ title: 'Low', priority: 'low' })
    const critical = createTask({ title: 'Critical', priority: 'critical' })
    const high = createTask({ title: 'High', priority: 'high' })

    const claimed = claimNextTask('agent-1')

    expect(claimed).not.toBeNull()
    expect(claimed!.id).toBe(critical.id)
    expect(claimed!.status).toBe('assigned')
  })

  it('respects project filter', () => {
    createTask({ title: 'Other', project: 'other-project', priority: 'critical' })
    const match = createTask({ title: 'Match', project: 'my-project', priority: 'normal' })

    const claimed = claimNextTask('agent-1', { project: 'my-project' })

    expect(claimed).not.toBeNull()
    expect(claimed!.id).toBe(match.id)
  })

  it('returns null when no tasks match', () => {
    createTask({ title: 'Low', priority: 'low' })

    const claimed = claimNextTask('agent-1', { priority: 'high' })
    expect(claimed).toBeNull()
  })
})
