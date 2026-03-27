import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Task, AgentHealthStatus, OrchestratorStats, TaskPriority } from '../../main/orchestrator'
import type { ContextEngineeredResponse } from '../response'

// Mock the orchestrator module before importing handlers
vi.mock('../../main/orchestrator', () => {
  const tasks: Task[] = []
  let taskCounter = 0

  return {
    enqueueTask: vi.fn((opts: { title: string; description: string; project: string; priority: TaskPriority; source: string }) => {
      taskCounter++
      const task: Task = {
        id: `task-${Date.now()}-${taskCounter}`,
        title: opts.title,
        description: opts.description,
        project: opts.project,
        priority: opts.priority || 'normal',
        status: 'queued',
        requiredSkills: [],
        source: opts.source as Task['source'],
        createdAt: Date.now(),
        retryCount: 0,
        maxRetries: 1,
        currentStage: 'queued',
        stageResults: [],
      }
      tasks.push(task)
      return task
    }),
    getTaskQueue: vi.fn(() => [...tasks]),
    getAgentHealthStatuses: vi.fn(async () => [] as AgentHealthStatus[]),
    getOrchestratorStats: vi.fn((): OrchestratorStats => ({
      queueDepth: 0,
      activeTasks: 0,
      completedToday: 0,
      failedToday: 0,
      totalProcessed: 0,
    })),
  }
})

// Import after mocks are set up
import { handleEnqueue, handleQueue, handleAgentHealth } from './orchestrator'
import { enqueueTask, getTaskQueue, getAgentHealthStatuses, getOrchestratorStats } from '../../main/orchestrator'

const mockEnqueueTask = vi.mocked(enqueueTask)
const mockGetTaskQueue = vi.mocked(getTaskQueue)
const mockGetAgentHealthStatuses = vi.mocked(getAgentHealthStatuses)
const mockGetOrchestratorStats = vi.mocked(getOrchestratorStats)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('orchestrator:enqueue', () => {
  it('creates a task and returns valid response shape', async () => {
    mockGetTaskQueue.mockReturnValue([])
    mockGetAgentHealthStatuses.mockResolvedValue([])

    const result = await handleEnqueue({
      title: 'Fix login bug',
      description: 'Users cannot log in',
      priority: 'high',
    })

    expect(result).toHaveProperty('data')
    expect(result).toHaveProperty('summary')
    expect(result).toHaveProperty('suggestions')
    expect(result).toHaveProperty('related_tools')

    expect(result.data.title).toBe('Fix login bug')
    expect(result.data.priority).toBe('high')
    expect(result.data.status).toBe('queued')
    expect(result.data.source).toBe('api')

    expect(result.summary).toContain('Fix login bug')
    expect(result.summary).toContain('high')
    expect(result.suggestions.length).toBeGreaterThan(0)
    expect(result.related_tools).toContain('orchestrator:queue')
    expect(result.related_tools).toContain('pod:create')
  })

  it('defaults project to ~/sidekick when not provided', async () => {
    mockGetTaskQueue.mockReturnValue([])
    mockGetAgentHealthStatuses.mockResolvedValue([])

    const result = await handleEnqueue({
      title: 'Test task',
      description: 'Testing defaults',
    })

    expect(result.data.project).toBe('~/sidekick')
    expect(result.data.priority).toBe('normal')
  })

  it('suggests pod:create when idle agents are available', async () => {
    mockGetTaskQueue.mockReturnValue([])
    mockGetAgentHealthStatuses.mockResolvedValue([
      { agentId: 'marcus', name: 'Marcus Chen', alive: true, activeTasks: 0, status: 'healthy', warnings: [] },
    ] as AgentHealthStatus[])

    const result = await handleEnqueue({
      title: 'Urgent fix',
      description: 'Something is broken',
      priority: 'critical',
    })

    const hasPodSuggestion = result.suggestions.some(s => s.includes('pod:create'))
    expect(hasPodSuggestion).toBe(true)
  })
})

describe('orchestrator:queue', () => {
  it('returns all tasks when no status filter', async () => {
    const mockTasks: Task[] = [
      { id: 't-1', title: 'A', description: '', project: '~/sidekick', priority: 'normal', status: 'queued', requiredSkills: [], source: 'api', createdAt: Date.now(), retryCount: 0, maxRetries: 1 },
      { id: 't-2', title: 'B', description: '', project: '~/sidekick', priority: 'high', status: 'active', requiredSkills: [], source: 'api', createdAt: Date.now(), retryCount: 0, maxRetries: 1 },
      { id: 't-3', title: 'C', description: '', project: '~/sidekick', priority: 'low', status: 'completed', requiredSkills: [], source: 'api', createdAt: Date.now(), retryCount: 0, maxRetries: 1 },
    ] as Task[]
    mockGetTaskQueue.mockReturnValue(mockTasks)
    mockGetOrchestratorStats.mockReturnValue({ queueDepth: 1, activeTasks: 1, completedToday: 1, failedToday: 0, totalProcessed: 1 })
    mockGetAgentHealthStatuses.mockResolvedValue([])

    const result = await handleQueue({})

    expect(result.data.tasks).toHaveLength(3)
    expect(result.data.stats).toBeDefined()
    expect(result.summary).toContain('3 task(s)')
    expect(result.related_tools).toContain('orchestrator:enqueue')
  })

  it('filters by status when provided', async () => {
    const mockTasks: Task[] = [
      { id: 't-1', title: 'A', description: '', project: '~/sidekick', priority: 'normal', status: 'queued', requiredSkills: [], source: 'api', createdAt: Date.now(), retryCount: 0, maxRetries: 1 },
      { id: 't-2', title: 'B', description: '', project: '~/sidekick', priority: 'high', status: 'active', requiredSkills: [], source: 'api', createdAt: Date.now(), retryCount: 0, maxRetries: 1 },
    ] as Task[]
    mockGetTaskQueue.mockReturnValue(mockTasks)
    mockGetOrchestratorStats.mockReturnValue({ queueDepth: 1, activeTasks: 1, completedToday: 0, failedToday: 0, totalProcessed: 0 })
    mockGetAgentHealthStatuses.mockResolvedValue([])

    const result = await handleQueue({ status: 'queued' })

    expect(result.data.tasks).toHaveLength(1)
    expect(result.data.tasks[0].status).toBe('queued')
    expect(result.summary).toContain('queued')
  })

  it('suggests pod:create when critical tasks + idle agents', async () => {
    const mockTasks: Task[] = [
      { id: 't-1', title: 'Critical bug', description: '', project: '~/sidekick', priority: 'critical', status: 'queued', requiredSkills: [], source: 'api', createdAt: Date.now(), retryCount: 0, maxRetries: 1 },
    ] as Task[]
    mockGetTaskQueue.mockReturnValue(mockTasks)
    mockGetOrchestratorStats.mockReturnValue({ queueDepth: 1, activeTasks: 0, completedToday: 0, failedToday: 0, totalProcessed: 0 })
    mockGetAgentHealthStatuses.mockResolvedValue([
      { agentId: 'lena', name: 'Lena Park', alive: true, activeTasks: 0, status: 'healthy', warnings: [] },
    ] as AgentHealthStatus[])

    const result = await handleQueue({})

    const hasCriticalSuggestion = result.suggestions.some(s => s.includes('critical') && s.includes('pod:create'))
    expect(hasCriticalSuggestion).toBe(true)
  })
})

describe('orchestrator:agent-health', () => {
  it('returns all agents with correct summary counts', async () => {
    const mockAgents: AgentHealthStatus[] = [
      { agentId: 'marcus', name: 'Marcus Chen', alive: true, activeTasks: 1, status: 'healthy', warnings: [] },
      { agentId: 'lena', name: 'Lena Park', alive: true, activeTasks: 0, status: 'healthy', warnings: [] },
      { agentId: 'kai', name: 'Kai Tanaka', alive: true, activeTasks: 0, status: 'warning', warnings: ['High memory usage: 2500MB'] },
      { agentId: 'ravi', name: 'Ravi Patel', alive: false, activeTasks: 0, status: 'dead', warnings: ['Process not found'] },
    ] as AgentHealthStatus[]
    mockGetAgentHealthStatuses.mockResolvedValue(mockAgents)
    mockGetOrchestratorStats.mockReturnValue({ queueDepth: 2, activeTasks: 1, completedToday: 0, failedToday: 0, totalProcessed: 0 })

    const result = await handleAgentHealth()

    expect(result.data.agents).toHaveLength(4)
    expect(result.summary).toContain('2 healthy')
    expect(result.summary).toContain('1 warning')
    expect(result.summary).toContain('1 dead')
    expect(result.summary).toContain('2 idle')
    expect(result.related_tools).toContain('orchestrator:queue')
  })

  it('suggests restarting dead agents', async () => {
    mockGetAgentHealthStatuses.mockResolvedValue([
      { agentId: 'ravi', name: 'Ravi Patel', alive: false, activeTasks: 0, status: 'dead', warnings: ['Process not found'] },
    ] as AgentHealthStatus[])
    mockGetOrchestratorStats.mockReturnValue({ queueDepth: 0, activeTasks: 0, completedToday: 0, failedToday: 0, totalProcessed: 0 })

    const result = await handleAgentHealth()

    const hasRestartSuggestion = result.suggestions.some(s => s.includes('dead') && s.includes('Ravi Patel'))
    expect(hasRestartSuggestion).toBe(true)
  })

  it('suggests checking warning agents', async () => {
    mockGetAgentHealthStatuses.mockResolvedValue([
      { agentId: 'kai', name: 'Kai Tanaka', alive: true, activeTasks: 0, status: 'warning', warnings: ['High memory usage: 2500MB'] },
    ] as AgentHealthStatus[])
    mockGetOrchestratorStats.mockReturnValue({ queueDepth: 0, activeTasks: 0, completedToday: 0, failedToday: 0, totalProcessed: 0 })

    const result = await handleAgentHealth()

    const hasWarningSuggestion = result.suggestions.some(s => s.includes('Kai Tanaka') && s.includes('High memory'))
    expect(hasWarningSuggestion).toBe(true)
  })

  it('suggests assigning tasks when idle agents + queued tasks', async () => {
    mockGetAgentHealthStatuses.mockResolvedValue([
      { agentId: 'marcus', name: 'Marcus Chen', alive: true, activeTasks: 0, status: 'healthy', warnings: [] },
    ] as AgentHealthStatus[])
    mockGetOrchestratorStats.mockReturnValue({ queueDepth: 3, activeTasks: 0, completedToday: 0, failedToday: 0, totalProcessed: 0 })

    const result = await handleAgentHealth()

    const hasAssignSuggestion = result.suggestions.some(s => s.includes('idle') && s.includes('queued'))
    expect(hasAssignSuggestion).toBe(true)
  })

  it('returns benign suggestion when all healthy and no tasks', async () => {
    mockGetAgentHealthStatuses.mockResolvedValue([
      { agentId: 'marcus', name: 'Marcus Chen', alive: true, activeTasks: 0, status: 'healthy', warnings: [] },
    ] as AgentHealthStatus[])
    mockGetOrchestratorStats.mockReturnValue({ queueDepth: 0, activeTasks: 0, completedToday: 0, failedToday: 0, totalProcessed: 0 })

    const result = await handleAgentHealth()

    expect(result.suggestions).toContain('All agents healthy, no action needed')
  })
})
