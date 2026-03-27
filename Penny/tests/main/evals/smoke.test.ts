import { describe, expect, it } from 'vitest'
import { createMockTask } from '../../helpers/factories'

describe('evals smoke', () => {
  it('creates a valid mock task', () => {
    const task = createMockTask({ priority: 'high' })
    expect(task.id).toMatch(/^task-/)
    expect(task.priority).toBe('high')
    expect(task.status).toBe('queued')
  })
})
