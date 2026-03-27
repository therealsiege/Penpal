import { describe, expect, it } from 'vitest'
import { createMockPodWorkflow } from '../../helpers/factories'

describe('pods smoke', () => {
  it('creates a valid mock pod workflow', () => {
    const workflow = createMockPodWorkflow()
    expect(workflow.id).toMatch(/^pod-/)
    expect(workflow.status).toBe('pending')
    expect(workflow.solverCandidateCount).toBe(1)
  })
})
