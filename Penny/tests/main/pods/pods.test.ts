import { describe, it, expect } from 'vitest'
import { createMockPodWorkflow } from '../../helpers/factories'

describe('pods', () => {
  it('factory produces valid PodWorkflow shape', () => {
    const pod = createMockPodWorkflow()
    expect(pod.id).toBeDefined()
    expect(pod.status).toBe('pending')
    expect(pod.iteration).toBe(0)
    expect(pod.solver.agentId).toBeDefined()
    expect(pod.reviewer.agentId).toBeDefined()
    expect(pod.executor.agentId).toBeDefined()
  })
})
