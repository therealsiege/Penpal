import { describe, expect, it } from 'vitest'
import { createMockTask } from '../../helpers/factories'

describe('evals infra smoke', () => {
  it('creates a typed task', () => {
    const task = createMockTask({ priority: 'high' })
    expect(task.id).toMatch(/^task-/)
    expect(task.priority).toBe('high')
    expect(task.status).toBe('queued')
  })
})
