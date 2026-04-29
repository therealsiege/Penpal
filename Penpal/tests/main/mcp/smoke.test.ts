import { describe, expect, it } from 'vitest'
import { createMockAgent } from '../../helpers/factories'

describe('mcp smoke', () => {
  it('creates a valid mock agent state', () => {
    const agent = createMockAgent({ status: 'idle' })
    expect(agent.config.id).toBe('agent-test')
    expect(agent.status).toBe('idle')
  })
})
