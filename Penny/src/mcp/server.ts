import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { toolRegistry } from './tools.js'

// Side-effect: registers tools via toolRegistry
import './tools/meta.js'
import './tools/orchestrator.js'
import './tools/pods.js'
import './tools/vault.js'
import './tools/graph.js'
import './tools/office.js'

const server = new Server(
  { name: 'penny-mcp', version: '1.0.0' },
  { capabilities: { tools: {} } },
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: toolRegistry.list().map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  })),
}))

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params
  const result = await toolRegistry.call(name, args ?? {})
  return {
    content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
  }
})

export async function startMcpServer(): Promise<void> {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  process.stderr.write('penny-mcp server started on stdio\n')
}
