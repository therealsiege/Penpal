import { describe, expect, it } from 'vitest'
import { buildListToolsResult, callToolByName } from '../../../src/mcp/server.js'
import { toolRegistry } from '../../../src/mcp/tools.js'
import '../../../src/mcp/tools/meta.js'

describe('meta MCP tools', () => {
  it('returns a deterministic tool catalog via tools/list shape', () => {
    const result = buildListToolsResult()
    const names = result.tools.map((tool) => tool.name)

    expect(names.length).toBeGreaterThanOrEqual(2)
    expect(names).toContain('meta:list-tools')
    expect(names).toContain('meta:describe-tool')
    expect([...names]).toEqual([...names].sort((a, b) => a.localeCompare(b)))
  })

  it('describes meta:list-tools with valid JSON schema', async () => {
    const response = await callToolByName('meta:describe-tool', { name: 'meta:list-tools' })
    const payload = JSON.parse(response.content[0].text) as {
      name: string
      inputSchema: { type: string; properties: Record<string, unknown> }
    }

    expect(payload.name).toBe('meta:list-tools')
    expect(payload.inputSchema.type).toBe('object')
    expect(payload.inputSchema.properties).toBeDefined()
  })

  it('returns structured UNKNOWN_TOOL payload for unknown names', async () => {
    const result = (await toolRegistry.call('meta:describe-tool', {
      name: 'meta:nope',
    })) as {
      error: { code: string; tool: string; message: string }
    }

    expect(result.error.code).toBe('UNKNOWN_TOOL')
    expect(result.error.tool).toBe('meta:nope')
    expect(result.error.message).toContain('meta:nope')
  })
})
