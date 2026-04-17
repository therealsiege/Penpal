import { describe, it, expect, beforeEach, vi } from 'vitest'
import { 
  listMcpServers, 
  addMcpServer, 
  updateMcpServer, 
  deleteMcpServer, 
  toggleMcpServer, 
  discoverAndImportMcpConfigs, 
  TEMPLATE_SERVERS 
} from '../main/mcp-manager'

// Mock fs module
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
    renameSync: vi.fn(),
  }
}))

vi.mock('path', () => ({
  default: {
    join: vi.fn((...args) => args.join('/')),
    dirname: vi.fn((path) => path.split('/').slice(0, -1).join('/')),
  }
}))

describe('McpManager', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks()
  })

  it('should list MCP servers when no config exists', () => {
    // Mock file not existing
    vi.mocked(require('fs').existsSync).mockReturnValue(false)
    
    const servers = listMcpServers()
    expect(servers).toEqual([])
  })

  it('should add a new MCP server', () => {
    // Mock file not existing
    vi.mocked(require('fs').existsSync).mockReturnValue(false)
    vi.mocked(require('fs').writeFileSync).mockReturnValue(undefined)
    
    const server = addMcpServer({
      name: 'test-server',
      transport: 'stdio',
      command: 'node',
      args: ['test.js'],
      env: {},
      enabled: true,
      targets: ['claude-project']
    })
    
    expect(server.name).toBe('test-server')
    expect(server.id).toBe('test-server')
  })

  it('should have template servers available', () => {
    expect(TEMPLATE_SERVERS).toBeDefined()
    expect(TEMPLATE_SERVERS.length).toBeGreaterThan(0)
    expect(TEMPLATE_SERVERS[0]).toHaveProperty('name')
    expect(TEMPLATE_SERVERS[0]).toHaveProperty('transport')
    expect(TEMPLATE_SERVERS[0]).toHaveProperty('command')
  })
})