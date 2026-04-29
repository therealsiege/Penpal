import { describe, it, expect, afterEach } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { toolRegistry } from './tools'
import { buildToolCatalog, createPennyMcpServer } from './server'

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
    expect(result.inputSchema.properties).toEqual({})
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

describe('MCP wire protocol (in-memory transport)', () => {
  let client: Client | undefined
  let pennyServer: ReturnType<typeof createPennyMcpServer> | undefined

  afterEach(async () => {
    await client?.close().catch(() => {})
    await pennyServer?.close().catch(() => {})
    client = undefined
    pennyServer = undefined
  })

  async function connectPair(): Promise<void> {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
    pennyServer = createPennyMcpServer()
    client = new Client({ name: 'penny-mcp-test', version: '1.0.0' }, { capabilities: {} })
    await pennyServer.connect(serverTransport)
    await client.connect(clientTransport)
  }

  it('responds to tools/list with meta tools and object inputSchema', async () => {
    await connectPair()
    const { tools } = await client!.listTools()
    const names = tools.map((t) => t.name)
    expect(names).toContain('meta:list-tools')
    expect(names).toContain('meta:describe-tool')
    expect(names).toContain('pods:create')
    expect(names).toContain('pods:list')
    expect(names).toContain('pods:status')
    for (const t of tools) {
      expect(typeof t.description).toBe('string')
      expect(t.description.length).toBeGreaterThan(0)
      expect(t.inputSchema).toBeTypeOf('object')
      expect((t.inputSchema as { type?: string }).type).toBe('object')
    }
  })

  it('tools/call meta:describe-tool("meta:list-tools") returns valid JSON schema', async () => {
    await connectPair()
    const result = await client!.callTool({
      name: 'meta:describe-tool',
      arguments: { name: 'meta:list-tools' },
    })
    expect(result.isError).not.toBe(true)
    const block = result.content?.[0]
    expect(block?.type).toBe('text')
    const parsed = JSON.parse((block as { text: string }).text) as {
      name: string
      inputSchema: Record<string, unknown>
    }
    expect(parsed.name).toBe('meta:list-tools')
    expect(parsed.inputSchema.type).toBe('object')
    expect(parsed.inputSchema.properties).toEqual({})
    expect(parsed.inputSchema.additionalProperties).toBe(false)
  })
})
