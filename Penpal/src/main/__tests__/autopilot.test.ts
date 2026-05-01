/**
 * Unit tests for src/main/autopilot.ts — scheduled recurring task system
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const fsMocks = vi.hoisted(() => ({
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(() => '{}'),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}))

const enqueueMock = vi.hoisted(() => vi.fn(() => ({ id: 'task-mock-1' })))
const orchestratorEventsMock = vi.hoisted(() => ({
  emit: vi.fn(),
  on: vi.fn(),
  removeAllListeners: vi.fn(),
}))

// ── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('fs', () => ({
  default: fsMocks,
  ...fsMocks,
}))

vi.mock('../data-paths', () => ({
  getDataDir: vi.fn(() => '/tmp/penpal-test-data'),
}))

vi.mock('../dispatch-queue', () => ({
  enqueueTask: enqueueMock,
  orchestratorEvents: orchestratorEventsMock,
}))

// ── Import module under test ─────────────────────────────────────────────────

import {
  loadAutopilotConfig,
  saveAutopilotConfig,
  addScheduledTask,
  removeScheduledTask,
  toggleScheduledTask,
  checkAndEnqueue,
  startAutopilot,
  stopAutopilot,
  getAutopilotStatus,
  _resetForTest,
  calculateNextRun,
} from '../autopilot'

// ── Setup / Teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  vi.useFakeTimers()
  // Default: file does not exist
  fsMocks.existsSync.mockReturnValue(false)
})

afterEach(() => {
  _resetForTest()
  vi.useRealTimers()
  vi.clearAllMocks()
})

// ── loadAutopilotConfig ──────────────────────────────────────────────────────

describe('loadAutopilotConfig', () => {
  it('returns defaults when config file does not exist', () => {
    fsMocks.existsSync.mockReturnValue(false)

    const config = loadAutopilotConfig()

    expect(config).toEqual({
      enabled: false,
      checkInterval: 60_000,
      schedules: [],
    })
  })

  it('loads existing config from file', () => {
    const stored = {
      enabled: true,
      checkInterval: 30_000,
      schedules: [
        {
          id: 'sched-1',
          title: 'Daily deploy',
          description: 'Deploy to staging',
          project: 'my-app',
          cronExpression: 'daily',
          enabled: true,
          lastRunAt: null,
          nextRunAt: '2025-01-02T00:00:00.000Z',
          createdAt: '2025-01-01T00:00:00.000Z',
        },
      ],
    }
    fsMocks.existsSync.mockReturnValue(true)
    fsMocks.readFileSync.mockReturnValue(JSON.stringify(stored))

    const config = loadAutopilotConfig()

    expect(config.enabled).toBe(true)
    expect(config.checkInterval).toBe(30_000)
    expect(config.schedules).toHaveLength(1)
    expect(config.schedules[0].title).toBe('Daily deploy')
  })
})

// ── addScheduledTask ─────────────────────────────────────────────────────────

describe('addScheduledTask', () => {
  it('creates a new scheduled task and saves config', () => {
    vi.setSystemTime(new Date('2025-06-15T10:00:00.000Z'))

    const task = addScheduledTask({
      title: 'Run tests',
      description: 'Run the full test suite',
      project: 'my-project',
      cronExpression: 'daily',
    })

    expect(task.id).toMatch(/^sched-/)
    expect(task.title).toBe('Run tests')
    expect(task.description).toBe('Run the full test suite')
    expect(task.project).toBe('my-project')
    expect(task.cronExpression).toBe('daily')
    expect(task.enabled).toBe(true)
    expect(task.lastRunAt).toBeNull()
    expect(task.nextRunAt).toBeTruthy()
    expect(task.createdAt).toBe('2025-06-15T10:00:00.000Z')

    // Verify it was saved
    expect(fsMocks.writeFileSync).toHaveBeenCalled()
    const savedJson = fsMocks.writeFileSync.mock.calls[0][1] as string
    const saved = JSON.parse(savedJson)
    expect(saved.schedules).toHaveLength(1)
    expect(saved.schedules[0].title).toBe('Run tests')
  })
})

// ── removeScheduledTask ──────────────────────────────────────────────────────

describe('removeScheduledTask', () => {
  it('removes an existing task', () => {
    vi.setSystemTime(new Date('2025-06-15T10:00:00.000Z'))

    const task = addScheduledTask({
      title: 'Task to remove',
      description: 'Will be removed',
      project: 'proj',
      cronExpression: 'hourly',
    })

    const result = removeScheduledTask(task.id)
    expect(result).toBe(true)

    // Verify config was saved with empty schedules
    const lastCall = fsMocks.writeFileSync.mock.calls.at(-1)!
    const saved = JSON.parse(lastCall[1] as string)
    expect(saved.schedules).toHaveLength(0)
  })

  it('returns false for unknown task id', () => {
    const result = removeScheduledTask('nonexistent-id')
    expect(result).toBe(false)
  })
})

// ── toggleScheduledTask ──────────────────────────────────────────────────────

describe('toggleScheduledTask', () => {
  it('enables/disables a task', () => {
    vi.setSystemTime(new Date('2025-06-15T10:00:00.000Z'))

    const task = addScheduledTask({
      title: 'Toggle me',
      description: 'Toggling test',
      project: 'proj',
      cronExpression: 'daily',
    })

    // Disable
    const r1 = toggleScheduledTask(task.id, false)
    expect(r1).toBe(true)

    let lastCall = fsMocks.writeFileSync.mock.calls.at(-1)!
    let saved = JSON.parse(lastCall[1] as string)
    expect(saved.schedules[0].enabled).toBe(false)

    // Re-enable
    const r2 = toggleScheduledTask(task.id, true)
    expect(r2).toBe(true)

    lastCall = fsMocks.writeFileSync.mock.calls.at(-1)!
    saved = JSON.parse(lastCall[1] as string)
    expect(saved.schedules[0].enabled).toBe(true)
  })

  it('returns false for unknown task id', () => {
    const result = toggleScheduledTask('nonexistent', true)
    expect(result).toBe(false)
  })
})

// ── checkAndEnqueue ──────────────────────────────────────────────────────────

describe('checkAndEnqueue', () => {
  it('enqueues due tasks', () => {
    vi.setSystemTime(new Date('2025-06-15T10:00:00.000Z'))

    // Add a task
    const task = addScheduledTask({
      title: 'Due task',
      description: 'Should be enqueued',
      project: 'proj',
      cronExpression: 'daily',
    })

    // Start autopilot so enabled=true
    // We need to manually enable the config since startAutopilot has side effects
    const config = loadAutopilotConfig()
    config.enabled = true
    // Set nextRunAt to past so it's due
    config.schedules[0].nextRunAt = '2025-06-15T09:00:00.000Z'
    saveAutopilotConfig(config)

    // Reset the mock call count from setup
    enqueueMock.mockClear()

    const count = checkAndEnqueue()

    expect(count).toBe(1)
    expect(enqueueMock).toHaveBeenCalledWith({
      title: 'Due task',
      description: 'Should be enqueued',
      project: 'proj',
      source: 'api',
    })
  })

  it('skips disabled tasks', () => {
    vi.setSystemTime(new Date('2025-06-15T10:00:00.000Z'))

    addScheduledTask({
      title: 'Disabled task',
      description: 'Should be skipped',
      project: 'proj',
      cronExpression: 'daily',
    })

    const config = loadAutopilotConfig()
    config.enabled = true
    config.schedules[0].enabled = false
    config.schedules[0].nextRunAt = '2025-06-15T09:00:00.000Z'
    saveAutopilotConfig(config)

    enqueueMock.mockClear()

    const count = checkAndEnqueue()

    expect(count).toBe(0)
    expect(enqueueMock).not.toHaveBeenCalled()
  })

  it('skips tasks not yet due', () => {
    vi.setSystemTime(new Date('2025-06-15T10:00:00.000Z'))

    addScheduledTask({
      title: 'Future task',
      description: 'Not yet due',
      project: 'proj',
      cronExpression: 'daily',
    })

    const config = loadAutopilotConfig()
    config.enabled = true
    // nextRunAt is in the future
    config.schedules[0].nextRunAt = '2025-06-16T00:00:00.000Z'
    saveAutopilotConfig(config)

    enqueueMock.mockClear()

    const count = checkAndEnqueue()

    expect(count).toBe(0)
    expect(enqueueMock).not.toHaveBeenCalled()
  })

  it('returns 0 when autopilot is disabled', () => {
    vi.setSystemTime(new Date('2025-06-15T10:00:00.000Z'))

    // Config is disabled by default
    const count = checkAndEnqueue()
    expect(count).toBe(0)
  })
})

// ── startAutopilot / stopAutopilot ───────────────────────────────────────────

describe('startAutopilot / stopAutopilot', () => {
  it('starts and stops the check interval timer', () => {
    vi.setSystemTime(new Date('2025-06-15T10:00:00.000Z'))

    // Add a due task first
    addScheduledTask({
      title: 'Recurring',
      description: 'Runs periodically',
      project: 'proj',
      cronExpression: 'hourly',
    })

    // Manually make it due
    const config = loadAutopilotConfig()
    config.schedules[0].nextRunAt = '2025-06-15T09:00:00.000Z'
    saveAutopilotConfig(config)

    enqueueMock.mockClear()

    startAutopilot()

    // Advance time by the check interval (60s default)
    vi.advanceTimersByTime(60_000)

    expect(enqueueMock).toHaveBeenCalledTimes(1)

    stopAutopilot()

    enqueueMock.mockClear()

    // Advance more time — should NOT trigger after stop
    vi.advanceTimersByTime(120_000)

    expect(enqueueMock).not.toHaveBeenCalled()
  })

  it('startAutopilot sets config enabled to true', () => {
    startAutopilot()

    const lastCall = fsMocks.writeFileSync.mock.calls.at(-1)!
    const saved = JSON.parse(lastCall[1] as string)
    expect(saved.enabled).toBe(true)

    stopAutopilot()
  })

  it('stopAutopilot sets config enabled to false', () => {
    startAutopilot()
    stopAutopilot()

    const lastCall = fsMocks.writeFileSync.mock.calls.at(-1)!
    const saved = JSON.parse(lastCall[1] as string)
    expect(saved.enabled).toBe(false)
  })
})

// ── getAutopilotStatus ───────────────────────────────────────────────────────

describe('getAutopilotStatus', () => {
  it('returns current status with scheduled tasks', () => {
    vi.setSystemTime(new Date('2025-06-15T10:00:00.000Z'))

    addScheduledTask({
      title: 'Status test',
      description: 'Check status',
      project: 'proj',
      cronExpression: 'daily',
    })

    const status = getAutopilotStatus()

    expect(status.enabled).toBe(false)
    expect(status.scheduledTasks).toHaveLength(1)
    expect(status.scheduledTasks[0].title).toBe('Status test')
    expect(status.nextCheck).toBeTruthy()
  })

  it('returns null nextCheck when no enabled schedules', () => {
    const status = getAutopilotStatus()

    expect(status.enabled).toBe(false)
    expect(status.scheduledTasks).toHaveLength(0)
    expect(status.nextCheck).toBeNull()
  })
})

// ── _resetForTest ────────────────────────────────────────────────────────────

describe('_resetForTest', () => {
  it('clears all state', () => {
    vi.setSystemTime(new Date('2025-06-15T10:00:00.000Z'))

    addScheduledTask({
      title: 'Will be cleared',
      description: 'Reset test',
      project: 'proj',
      cronExpression: 'daily',
    })

    startAutopilot()
    _resetForTest()

    // After reset, loading config should return defaults (since _config is null
    // and existsSync still returns false)
    fsMocks.existsSync.mockReturnValue(false)
    const config = loadAutopilotConfig()

    expect(config.enabled).toBe(false)
    expect(config.schedules).toHaveLength(0)
  })
})

// ── calculateNextRun ─────────────────────────────────────────────────────────

describe('calculateNextRun', () => {
  it('hourly → next hour boundary', () => {
    const from = new Date('2025-06-15T10:30:00.000Z')
    const next = calculateNextRun('hourly', from)
    expect(next).toBe('2025-06-15T11:00:00.000Z')
  })

  it('daily → next midnight', () => {
    const from = new Date('2025-06-15T10:30:00.000Z')
    const next = calculateNextRun('daily', from)
    expect(next).toBe('2025-06-16T00:00:00.000Z')
  })

  it('weekly → next Monday midnight', () => {
    // June 15 2025 is a Sunday
    const from = new Date('2025-06-15T10:30:00.000Z')
    const next = calculateNextRun('weekly', from)
    expect(next).toBe('2025-06-16T00:00:00.000Z') // Monday June 16
  })

  it('cron-like "0 9 * * *" → next 9am', () => {
    const from = new Date('2025-06-15T07:00:00.000Z')
    const next = calculateNextRun('0 9 * * *', from)
    expect(next).toBe('2025-06-15T09:00:00.000Z')
  })

  it('cron-like "0 9 * * *" rolls to next day if past hour', () => {
    const from = new Date('2025-06-15T10:00:00.000Z')
    const next = calculateNextRun('0 9 * * *', from)
    expect(next).toBe('2025-06-16T09:00:00.000Z')
  })
})
