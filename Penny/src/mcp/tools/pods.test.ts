import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PodWorkflow } from '../../main/pods'

const now = Date.now()

const workflows: PodWorkflow[] = [
  {
    id: 'pod-active-1',
    name: 'Active workflow',
    status: 'solving',
    task: 'Build UI panel',
    cwd: '/tmp/project',
    solver: { agentId: 'solver-a', status: 'active' },
    reviewer: { agentId: 'reviewer-a', status: 'waiting' },
    executor: { agentId: 'executor-a', status: 'waiting' },
    iteration: 1,
    maxIterations: 3,
    artifacts: [],
    solverCandidateCount: 1,
    selfFixAttempts: 0,
    maxSelfFixes: 0,
    priority: 'high',
    phaseConfig: { candidates: 2, selfEvaluation: true, confidenceThreshold: 0.7, maxSelfFixes: 1 },
    createdAt: now - 5 * 60_000,
    updatedAt: now - 60_000,
    stageHistory: [
      { stage: 'pending', enteredAt: now - 5 * 60_000 },
      { stage: 'solving', enteredAt: now - 4 * 60_000 },
    ],
  },
  {
    id: 'pod-complete-1',
    name: 'Completed workflow',
    status: 'complete',
    task: 'Fix API bug',
    cwd: '/tmp/project',
    solver: { agentId: 'solver-b', status: 'complete' },
    reviewer: { agentId: 'reviewer-b', status: 'complete' },
    executor: { agentId: 'executor-b', status: 'complete' },
    iteration: 2,
    maxIterations: 3,
    artifacts: [],
    solverCandidateCount: 1,
    selfFixAttempts: 0,
    maxSelfFixes: 0,
    priority: 'high',
    phaseConfig: { candidates: 2, selfEvaluation: true, confidenceThreshold: 0.7, maxSelfFixes: 1 },
    createdAt: now - 60 * 60_000,
    updatedAt: now - 30 * 60_000,
    stageHistory: [
      { stage: 'pending', enteredAt: now - 60 * 60_000 },
      { stage: 'solving', enteredAt: now - 58 * 60_000 },
      { stage: 'reviewing', enteredAt: now - 45 * 60_000 },
      { stage: 'executing', enteredAt: now - 40 * 60_000 },
      { stage: 'complete', enteredAt: now - 30 * 60_000 },
    ],
  },
  {
    id: 'pod-failed-1',
    name: 'Failed workflow',
    status: 'failed',
    task: 'Content pipeline',
    cwd: '/tmp/project',
    solver: { agentId: 'solver-c', status: 'failed' },
    reviewer: { agentId: 'reviewer-c', status: 'waiting' },
    executor: { agentId: 'executor-c', status: 'waiting' },
    iteration: 1,
    maxIterations: 2,
    artifacts: [],
    solverCandidateCount: 1,
    selfFixAttempts: 0,
    maxSelfFixes: 0,
    createdAt: now - 20 * 60_000,
    updatedAt: now - 18 * 60_000,
    error: 'Solver failed',
    stageHistory: [
      { stage: 'pending', enteredAt: now - 20 * 60_000 },
      { stage: 'solving', enteredAt: now - 19 * 60_000 },
      { stage: 'failed', enteredAt: now - 18 * 60_000 },
    ],
  },
]

vi.mock('../../main/pods', () => ({
  listPods: vi.fn(() => workflows),
  getPodStatus: vi.fn((id: string) => workflows.find(wf => wf.id === id) ?? null),
  getPodPresets: vi.fn(() => [
    { id: 'frontend-feature', solver: 'a', reviewer: 'b', executor: 'c', description: 'UI work' },
    { id: 'backend-feature', solver: 'a', reviewer: 'b', executor: 'c', description: 'API work' },
    { id: 'full-stack', solver: 'a', reviewer: 'b', executor: 'c', description: 'end-to-end' },
  ]),
  createPod: vi.fn((task: string, opts: { presetId?: string; cwd?: string }) => ({
    ...workflows[0],
    id: 'pod-created-1',
    name: task.slice(0, 30),
    task,
    cwd: opts.cwd ?? '/tmp/project',
    status: 'pending',
    stageHistory: [{ stage: 'pending', enteredAt: now }],
  })),
}))

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(() => true),
    readFileSync: vi.fn(() => JSON.stringify(workflows)),
  },
}))

import { handlePodsCreate, handlePodsList, handlePodsStatus } from './pods'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('pods:create', () => {
  it('returns workflow payload, phase metadata, and preset guidance', async () => {
    const result = await handlePodsCreate({ task: 'Build frontend dashboard', cwd: '/tmp/project' })

    expect(result.data.workflow).toBeDefined()
    expect(result.data.workflow.id).toBe('pod-created-1')
    expect(result.data.presets.length).toBeGreaterThan(0)
    expect(result.data.recommended_presets).toContain('frontend-feature')
    expect(result._meta.phase).toBeDefined()
    expect(result.summary).toContain('Created workflow')
    expect(result.suggestions.length).toBeGreaterThan(0)
    expect(result.related_tools).toContain('pods:status')
  })
})

describe('pods:list', () => {
  it('filters active workflows correctly', async () => {
    const result = await handlePodsList({ status: 'active' })
    expect(result.data.workflows).toHaveLength(1)
    expect(result.data.workflows[0].status).toBe('solving')
    expect(result.data.summary.filtered).toBe(1)
    expect(result.summary).toContain('status "active"')
  })

  it('filters complete and failed workflows correctly', async () => {
    const complete = await handlePodsList({ status: 'complete' })
    const failed = await handlePodsList({ status: 'failed' })

    expect(complete.data.workflows).toHaveLength(1)
    expect(complete.data.workflows[0].status).toBe('complete')
    expect(failed.data.workflows).toHaveLength(1)
    expect(failed.data.workflows[0].status).toBe('failed')
  })
})

describe('pods:status', () => {
  it('returns full status with phase details and stage history', async () => {
    const result = await handlePodsStatus({ workflowId: 'pod-active-1' })
    expect(result.data.workflow).toBeDefined()
    expect(result.data.workflow?.stageHistory.length).toBeGreaterThan(0)
    expect(result.data.phase?.current).toBe('solving')
    expect(result.data.timeline?.sequence).toContain('solving')
    expect(result.data.eta).toBeDefined()
    expect(result.related_tools).toContain('pods:list')
  })

  it('always includes context-engineered fields', async () => {
    const result = await handlePodsStatus({ workflowId: 'pod-missing' })
    expect(result).toHaveProperty('summary')
    expect(result).toHaveProperty('suggestions')
    expect(result).toHaveProperty('related_tools')
    expect(result).toHaveProperty('_meta')
  })
})
