import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { toolRegistry, ToolNotFoundError } from './tools.js'

// Side-effect: registers tools via toolRegistry
import './tools/meta.js'
import './tools/orchestrator.js'
import './tools/pods.js'
import './tools/vault.js'
import './tools/office.js'

/**
 * Bridge: this process runs as a standalone Node child (tsx) with stdio MCP transport.
 * Tool implementations import Penny main modules directly (e.g. orchestrator state), same
 * as the Electron app — not a live IPC bridge to a running Electron main. Use IPC only if
 * tools must mutate a single in-memory runtime that cannot be shared across processes.
 */

export function buildToolCatalog() {
  return toolRegistry.list().map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  }))
}

function registerPennyMcpHandlers(target: Server): void {
  target.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: buildToolCatalog(),
  }))

  target.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params
    try {
      const result = await toolRegistry.call(name, args ?? {})
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const isToolNotFound = error instanceof ToolNotFoundError
      process.stderr.write(`penny-mcp call failed for ${name}: ${message}\n`)

      return {
        content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
        isError: isToolNotFound,
      }
    }
  })
}

/** Fresh server instance (e.g. in-memory transport tests). Stdio uses `server`. */
export function createPennyMcpServer(): Server {
  const instance = new Server(
    { name: 'penny-mcp', version: '1.0.0' },
    { capabilities: { tools: {}, resources: {} } },
  )
  registerPennyMcpHandlers(instance)
  return instance
}

export const server = createPennyMcpServer()

export async function startMcpServer(): Promise<void> {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  process.stderr.write('penny-mcp server started on stdio\n')
}
