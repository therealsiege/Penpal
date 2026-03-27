import crypto from 'crypto'
import type { AgentState } from '../../src/main/agents'
import type { Task } from '../../src/main/orchestrator'
import type { PodWorkflow } from '../../src/main/pods'
import type { PreferenceEvent } from '../../src/main/preferences/types'

export function createMockAgent(overrides?: Partial<AgentState>): AgentState {
  return {
    config: {
      id: 'agent-test',
      name: 'Test Agent',
      title: 'Test Runner',
      podRole: 'solver',
      systemPrompt: '',
      model: 'claude-sonnet-4-20250514',
      mcpProfile: 'developer',
      skills: [],
      allowedTools: [],
      subAgents: {},
      defaultRepos: [],
      avatar: 'default',
      desk: { row: 0, col: 0 },
      autonomy: 'supervised',
    },
    status: 'sleeping',
    ...overrides,
  }
}

export function createMockTask(overrides?: Partial<Task>): Task {
  return {
    id: `task-${crypto.randomUUID().slice(0, 8)}`,
    title: 'Test task',
    description: 'A test task',
    project: 'test-project',
    priority: 'normal',
    status: 'queued',
    requiredSkills: [],
    source: 'dashboard',
    createdAt: Date.now(),
    retryCount: 0,
    maxRetries: 3,
    ...overrides,
  }
}

export function createMockPodWorkflow(overrides?: Partial<PodWorkflow>): PodWorkflow {
  const now = Date.now()
  return {
    id: `pod-${crypto.randomUUID().slice(0, 8)}`,
    name: 'Test Pod',
    status: 'pending',
    task: 'Implement test feature',
    cwd: '/tmp/test',
    solver: { agentId: 'solver-1', status: 'waiting' },
    reviewer: { agentId: 'reviewer-1', status: 'waiting' },
    executor: { agentId: 'executor-1', status: 'waiting' },
    iteration: 1,
    maxIterations: 3,
    artifacts: [],
    solverCandidateCount: 1,
    selfFixAttempts: 0,
    maxSelfFixes: 0,
    createdAt: now,
    updatedAt: now,
    stageHistory: [{ stage: 'pending', enteredAt: now }],
    ...overrides,
  }
}

export function createMockPreferenceEvent(overrides?: Partial<PreferenceEvent>): PreferenceEvent {
  return {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    agentId: 'agent-1',
    signal: 'approve',
    strength: 'strong',
    context: {},
    ...overrides,
  }
}
