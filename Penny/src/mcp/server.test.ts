import { describe, it, expect } from 'vitest'
import { toolRegistry } from './tools'
import { buildToolCatalog } from './server'

// Side-effect: registers meta tools
import './tools/meta'

describe('MCP Server Meta Discovery', () => {
  it('tools/list catalog includes meta tools with schemas', () => {
    const tools = buildToolCatalog()
    const names = tools.map((t) => t.name)
    expect(names).toContain('meta:list-tools')
    expect(names).toContain('meta:describe-tool')
    expect(tools.every((t) => typeof t.description === 'string')).toBe(true)
    expect(tools.every((t) => t.inputSchema.type === 'object')).toBe(true)
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
    expect(result.inputSchema.additionalProperties).toBe(false)
    expect(result._meta).toBeDefined()
  })

  it('meta:describe-tool returns error for unknown tool', async () => {
    const result = (await toolRegistry.call('meta:describe-tool', {
      name: 'nonexistent',
    })) as { error: string; _meta: unknown }
    expect(result.error).toContain('nonexistent')
    expect(result._meta).toBeDefined()
  })

  it('meta:describe-tool validates required input', async () => {
    const result = (await toolRegistry.call('meta:describe-tool', {})) as {
      error: string
      inputSchema: Record<string, unknown>
      _meta: unknown
    }
    expect(result.error).toContain('Invalid input')
    expect(result.inputSchema.type).toBe('object')
    expect(result.inputSchema.required).toEqual(['name'])
    expect(result._meta).toBeDefined()
  })
})
