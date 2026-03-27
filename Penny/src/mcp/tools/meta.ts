import { toolRegistry } from '../tools.js'

toolRegistry.register({
  name: 'meta:list-tools',
  description: 'List all available tools with their names, descriptions, and input schemas.',
  inputSchema: {
    type: 'object',
    properties: {},
    additionalProperties: false,
  },
  handler: async () => {
    const tools = toolRegistry.list()
    return {
      tools,
      _meta: {
        next_actions: ['Use meta:describe-tool to get full schema for any tool'],
        related_tools: ['meta:describe-tool'],
      },
    }
  },
})

toolRegistry.register({
  name: 'meta:describe-tool',
  description: 'Get the full schema and description for a specific tool by name.',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'The tool name to describe' },
    },
    required: ['name'],
    additionalProperties: false,
  },
  handler: async (params) => {
    const name = typeof params.name === 'string' ? params.name.trim() : ''
    if (!name) {
      return {
        error: 'Invalid input: "name" must be a non-empty string.',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
          },
          required: ['name'],
          additionalProperties: false,
        },
        _meta: {
          next_actions: ['Provide a valid tool name and call meta:describe-tool again'],
          related_tools: ['meta:list-tools'],
        },
      }
    }

    const tool = toolRegistry.get(name)
    if (!tool) {
      return {
        error: `Tool not found: ${name}`,
        requestedTool: name,
        _meta: {
          next_actions: ['Use meta:list-tools to see all available tools'],
          related_tools: ['meta:list-tools'],
        },
      }
    }
    return {
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      _meta: {
        next_actions: [`Call ${tool.name} with the required parameters`],
        related_tools: ['meta:list-tools'],
      },
    }
  },
})
