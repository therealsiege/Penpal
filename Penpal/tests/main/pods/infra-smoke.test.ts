import { describe, expect, it } from 'vitest'
import { createMockPodWorkflow } from '../../helpers/factories'

describe('pods infra smoke', () => {
  it('creates a typed pod workflow', () => {
    const workflow = createMockPodWorkflow()
    expect(workflow.id).toMatch(/^pod-/)
    expect(workflow.status).toBe('pending')
    expect(workflow.solverCandidateCount).toBe(1)
  })
})
