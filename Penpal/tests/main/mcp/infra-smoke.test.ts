import { describe, expect, it } from 'vitest'
import { createMockAgent } from '../../helpers/factories'

describe('mcp infra smoke', () => {
  it('creates a typed agent state', () => {
    const agent = createMockAgent({ status: 'idle' })
    expect(agent.config.id).toBe('agent-test')
    expect(agent.status).toBe('idle')
  })
})
