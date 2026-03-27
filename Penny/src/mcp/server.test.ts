import { describe, it, expect, beforeAll } from 'vitest'
import { toolRegistry } from './tools'

// Side-effect: registers meta tools
import './tools/meta'
import './tools/pods'

describe('MCP Tool Registry', () => {
  it('has meta tools registered', () => {
    const tools = toolRegistry.list()
    const names = tools.map((t) => t.name)
    expect(names).toContain('meta:list-tools')
    expect(names).toContain('meta:describe-tool')
    expect(names).toContain('pods:create')
    expect(names).toContain('pods:list')
    expect(names).toContain('pods:status')
    expect(tools.length).toBeGreaterThanOrEqual(2)
  })

  it('meta:list-tools returns tool catalog', async () => {
    const result = (await toolRegistry.call('meta:list-tools', {})) as {
      tools: Array<{ name: string; description: string; inputSchema: unknown }>
      _meta: unknown
    }
    expect(result.tools).toBeInstanceOf(Array)
    expect(result.tools.length).toBeGreaterThanOrEqual(2)
    for (const tool of result.tools) {
      expect(tool).toHaveProperty('name')
      expect(tool).toHaveProperty('description')
      expect(tool).toHaveProperty('inputSchema')
    }
    expect(result._meta).toBeDefined()
  })

  it('meta:describe-tool returns schema for a known tool', async () => {
    const result = (await toolRegistry.call('meta:describe-tool', {
      name: 'meta:list-tools',
    })) as {
      name: string
      description: string
      inputSchema: Record<string, unknown>
      _meta: unknown
    }
    expect(result.name).toBe('meta:list-tools')
    expect(result.description).toBeTruthy()
    expect(result.inputSchema).toBeDefined()
    expect(result.inputSchema.type).toBe('object')
    expect(result._meta).toBeDefined()
  })

  it('meta:describe-tool returns error for unknown tool', async () => {
    const result = (await toolRegistry.call('meta:describe-tool', {
      name: 'nonexistent',
    })) as { error: string; _meta: unknown }
    expect(result.error).toContain('nonexistent')
    expect(result._meta).toBeDefined()
  })
})
