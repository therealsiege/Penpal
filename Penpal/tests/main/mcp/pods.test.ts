import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PodWorkflow, PodStatus } from '../../../src/main/pods'

function makeWorkflow(overrides: Partial<PodWorkflow> = {}): PodWorkflow {
  const stage: PodStatus = overrides.status ?? 'pending'
  return {
    id: 'pod-fixture-1',
    name: 'fixture',
    status: stage,
    task: 'do the thing',
    cwd: '/tmp/sidekick-test',
    presetId: 'frontend-feature',
    solver: { agentId: 'solver-a', status: 'waiting' },
    reviewer: { agentId: 'reviewer-b', status: 'waiting' },
    executor: { agentId: 'executor-c', status: 'waiting' },
    iteration: 1,
    maxIterations: 3,
    artifacts: [],
    solverCandidateCount: 1,
    selfFixAttempts: 0,
    maxSelfFixes: 1,
    phaseConfig: {
      candidates: 1,
      selfEvaluation: false,
      confidenceThreshold: 0.5,
      maxSelfFixes: 1,
    },
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
    stageHistory: [
      { stage: 'pending', enteredAt: 1_700_000_000_000 },
      ...(overrides.status && overrides.status !== 'pending'
        ? [{ stage: overrides.status, enteredAt: 1_700_000_000_001 }]
        : []),
    ],
    ...overrides,
  }
}

const mockPresets = [
  {
    id: 'frontend-feature',
    solver: 'nextjs-frontend',
    reviewer: 'ui-designer',
    executor: 'electron-dev',
    description: 'Frontend preset',
  },
  {
    id: 'backend-feature',
    solver: 'fullstack-dev',
    reviewer: 'backend-arch',
    executor: 'electron-dev',
    description: 'Backend preset',
  },
]

vi.mock('../../../src/main/pods', () => ({
  createPod: vi.fn(),
  listPods: vi.fn(),
  getPodStatus: vi.fn(),
  getPodPresets: vi.fn(() => mockPresets),
}))

vi.mock('../../../src/main/evals/collectors/pod-quality', () => ({
  podQualityCollector: {
    report: vi.fn(() => ({
      period: { from: '', to: '' },
      totalPods: 2,
      completionRate: 1,
      avgIterations: 1.5,
      reviewerFirstPassRate: 0.5,
      executorPassRate: 1,
      selfFixRate: 0,
      avgCompletionTime_ms: 120_000,
      byPreset: {
        'frontend-feature': { total: 2, completed: 2, avgIterations: 1.5 },
      },
    })),
  },
}))

import { createPod, listPods, getPodStatus, getPodPresets } from '../../../src/main/pods'
import { handlePodsCreate, handlePodsList, handlePodsStatus } from '../../../src/mcp/tools/pods'

const mockCreatePod = vi.mocked(createPod)
const mockListPods = vi.mocked(listPods)
const mockGetPodStatus = vi.mocked(getPodStatus)
const mockGetPodPresets = vi.mocked(getPodPresets)

describe('MCP pods tools handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetPodPresets.mockReturnValue(mockPresets)
  })

  it('pods:create returns valid workflow structure with summary, suggestions, related_tools, _meta', async () => {
    const wf = makeWorkflow({ id: 'pod-new-99', status: 'pending', stageHistory: [{ stage: 'pending', enteredAt: 1 }] })
    mockCreatePod.mockReturnValue(wf)

    const result = await handlePodsCreate({
      task: 'Implement feature X',
      preset: 'frontend-feature',
    })

    expect(mockCreatePod).toHaveBeenCalledWith('Implement feature X', {
      presetId: 'frontend-feature',
      cwd: undefined,
      priority: undefined,
    })
    expect(result.data).toEqual(wf)
    expect(result.data?.id).toBe('pod-new-99')
    expect(result.data?.status).toBe('pending')
    expect(result.summary).toContain('pod-new-99')
    expect(result.suggestions.length).toBeGreaterThan(0)
    expect(result.related_tools).toContain('pods:status')
    expect(result.related_tools).toContain('pods:list')
    expect(result._meta.valid_presets).toEqual(['frontend-feature', 'backend-feature'])
    expect(result._meta.preset_suggestions).toHaveLength(2)
    expect(result._meta.phase_info).toBeDefined()
  })

  it('pods:create rejects unknown preset without calling createPod', async () => {
    const result = await handlePodsCreate({ task: 'Hello', preset: 'not-a-real-preset' })

    expect(mockCreatePod).not.toHaveBeenCalled()
    expect(result.data).toBeNull()
    expect(result.summary).toContain('Unknown preset')
    expect(result.summary).toContain('frontend-feature')
    expect(result._meta.valid_presets).toEqual(['frontend-feature', 'backend-feature'])
  })

  it('pods:list filters by status correctly', async () => {
    const wActive = makeWorkflow({ id: 'a', status: 'solving', stageHistory: [{ stage: 'pending', enteredAt: 1 }, { stage: 'solving', enteredAt: 2 }] })
    const wComplete = makeWorkflow({ id: 'b', status: 'complete' })
    const wFailed = makeWorkflow({ id: 'c', status: 'failed', error: 'boom' })
    mockListPods.mockReturnValue([wActive, wComplete, wFailed])

    const active = await handlePodsList({ status: 'active' })
    expect(active.data.map((p) => p.id).sort()).toEqual(['a'])

    const complete = await handlePodsList({ status: 'complete' })
    expect(complete.data.map((p) => p.id)).toEqual(['b'])

    const failed = await handlePodsList({ status: 'failed' })
    expect(failed.data.map((p) => p.id)).toEqual(['c'])

    const all = await handlePodsList({})
    expect(all.data).toHaveLength(3)
    expect(all._meta.counts).toMatchObject({
      total: 3,
      active: 1,
      complete: 1,
      failed: 1,
      returned: 3,
    })
  })

  it('pods:status returns phase and stage history for in-progress workflow', async () => {
    const wf = makeWorkflow({
      id: 'pod-inprog',
      status: 'reviewing',
      stageHistory: [
        { stage: 'pending', enteredAt: 1 },
        { stage: 'solving', enteredAt: 2 },
        { stage: 'reviewing', enteredAt: 3 },
      ],
    })
    mockGetPodStatus.mockReturnValue(wf)

    const result = await handlePodsStatus({ workflowId: 'pod-inprog' })

    expect(result.data?.status).toBe('reviewing')
    expect(result.data?.stageHistory?.length).toBeGreaterThanOrEqual(1)
    expect(result._meta.phase_description).toContain('Reviewer')
    expect(result._meta.stage_history_length).toBe(3)
    expect(result.summary).toContain('reviewing')
    expect(result.related_tools).toContain('pods:list')
  })
})
