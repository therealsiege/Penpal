export interface ToolDefinition {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  handler: (params: Record<string, unknown>) => Promise<unknown>
}

export class ToolNotFoundError extends Error {
  constructor(name: string) {
    super(`Tool not found: ${name}`)
    this.name = 'ToolNotFoundError'
  }
}

export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>()

  register(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool)
  }

  list(): Array<{ name: string; description: string; inputSchema: Record<string, unknown> }> {
    return Array.from(this.tools.values())
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
      }))
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name)
  }

  async call(name: string, params: Record<string, unknown>): Promise<unknown> {
    const tool = this.tools.get(name)
    if (!tool) {
      throw new ToolNotFoundError(name)
    }
    return tool.handler(params)
  }
}

export const toolRegistry = new ToolRegistry()
