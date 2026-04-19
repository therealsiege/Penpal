import fs from 'fs'
import path from 'path'
import os from 'os'
import { SIDEKICK_ROOT, HOME_DIR } from '../main/paths'

// ── Types ───────────────────────────────────────────────────────────────────

export interface McpServer {
  id: string
  name: string
  transport: 'stdio' | 'sse'
  command: string
  args: string[]
  env: Record<string, string>
  enabled: boolean
  targets: Array<'claude-global' | 'claude-project' | 'cursor' | 'vscode'>
  notes?: string
}

export interface McpConfig {
  version: number
  servers: McpServer[]
}

// ── Helper functions ─────────────────────────────────────────────────────────

function readJsonSafe(filePath: string): Record<string, unknown> | null {
  try {
    if (!fs.existsSync(filePath)) return null
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  } catch {
    return null
  }
}

function writeJsonAtomic(filePath: string, data: unknown) {
  const tmpFilePath = `${filePath}.tmp-${Date.now()}`
  fs.writeFileSync(tmpFilePath, JSON.stringify(data, null, 2) + '\n')
  fs.renameSync(tmpFilePath, filePath)
}

function getMasterConfigPath(): string {
  return path.join(SIDEKICK_ROOT, '.penpal', 'mcp-servers.json')
}

function getTargetConfigPath(target: 'claude-global' | 'claude-project' | 'cursor' | 'vscode'): string {
  switch (target) {
    case 'claude-global': return path.join(HOME_DIR, '.mcp.json')
    case 'claude-project': return path.join(SIDEKICK_ROOT, '.mcp.json')
    case 'cursor': return path.join(HOME_DIR, '.cursor', 'mcp.json')
    case 'vscode': return path.join(os.homedir(), 'Library', 'Application Support', 'Code', 'User', 'settings.json')
  }
}

function getTransportFromCommand(command: string): 'stdio' | 'sse' {
  // Check if command has a URL with http/https
  if (command.startsWith('http://') || command.startsWith('https://')) {
    return 'sse'
  }
  return 'stdio'
}

// ── Discovery and import functions ───────────────────────────────────────────

/**
 * Scan existing MCP config sources and import them into master config.
 * Returns the number of servers found.
 */
export async function discoverAndImportMcpConfigs(): Promise<{ imported: number; conflicts: string[]; duplicates: string[] }> {
  const masterPath = getMasterConfigPath()
  let masterConfig: McpConfig = {
    version: 1,
    servers: [],
  }

  // If master config exists, load it
  if (fs.existsSync(masterPath)) {
    const data = readJsonSafe(masterPath)
    if (data && typeof data?.version === 'number' && Array.isArray(data?.servers)) {
      masterConfig = data as McpConfig
    }
  }

  const conflicts: string[] = []
  const duplicates: string[] = []

  // Import project-level configs (~/sidekick/.mcp.json)
  const projectPath = path.join(SIDEKICK_ROOT, '.mcp.json')
  if (fs.existsSync(projectPath)) {
    const data = readJsonSafe(projectPath)
    if (data?.mcpServers && typeof data.mcpServers === 'object') {
      const projectServers = data.mcpServers as Record<string, unknown>
      for (const [name, server] of Object.entries(projectServers)) {
        const serverObj = server as Record<string, unknown>
        const newServer: McpServer = {
          id: name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
          name,
          transport: getTransportFromCommand(serverObj.command as string || 'unknown'),
          command: serverObj.command as string || 'unknown',
          args: Array.isArray(serverObj.args) ? serverObj.args as string[] : [],
          env: typeof serverObj.env === 'object' ? serverObj.env as Record<string, string> : {},
          enabled: true,
          targets: ['claude-project'],
          notes: `Imported from project config file`
        }
        
        // Check for duplicated server names (keep existing one)
        const existingServer = masterConfig.servers.find(s => s.name === name)
        if (existingServer) {
          duplicates.push(name)
          // Prefer the project version which is usually more complete
          // Keep it in the existing position, but update if needed
          continue
        }
        
        masterConfig.servers.push(newServer)
      }
    }
  }

  // Import global Claude configs (~/.mcp.json)
  const globalPath = path.join(HOME_DIR, '.mcp.json')
  if (fs.existsSync(globalPath)) {
    const data = readJsonSafe(globalPath)
    if (data?.mcpServers && typeof data.mcpServers === 'object') {
      const globalServers = data.mcpServers as Record<string, unknown>
      for (const [name, server] of Object.entries(globalServers)) {
        const serverObj = server as Record<string, unknown>
        const newServer: McpServer = {
          id: name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
          name,
          transport: getTransportFromCommand(serverObj.command as string || 'unknown'),
          command: serverObj.command as string || 'unknown',
          args: Array.isArray(serverObj.args) ? serverObj.args as string[] : [],
          env: typeof serverObj.env === 'object' ? serverObj.env as Record<string, string> : {},
          enabled: true,
          targets: ['claude-global'],
          notes: `Imported from global Claude config file`
        }
        
        // Check for duplicated server names
        const existingServer = masterConfig.servers.find(s => s.name === name)
        if (existingServer) {
          // Flag as conflicting
          conflicts.push(name)
          continue
        }
        
        masterConfig.servers.push(newServer)
      }
    }
  }

  // Import Cursor configs
  const cursorPath = path.join(HOME_DIR, '.cursor', 'mcp.json')
  if (fs.existsSync(cursorPath)) {
    const data = readJsonSafe(cursorPath)
    if (data?.mcpServers && typeof data.mcpServers === 'object') {
      const cursorServers = data.mcpServers as Record<string, unknown>
      for (const [name, server] of Object.entries(cursorServers)) {
        const serverObj = server as Record<string, unknown>
        const newServer: McpServer = {
          id: name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
          name,
          transport: getTransportFromCommand(serverObj.command as string || 'unknown'),
          command: serverObj.command as string || 'unknown',
          args: Array.isArray(serverObj.args) ? serverObj.args as string[] : [],
          env: typeof serverObj.env === 'object' ? serverObj.env as Record<string, string> : {},
          enabled: true,
          targets: ['cursor'],
          notes: `Imported from Cursor config file`
        }
        
        // Check for duplicated server names
        const existingServer = masterConfig.servers.find(s => s.name === name)
        if (existingServer) {
          // Flag as conflicting
          conflicts.push(name)
          continue
        }
        
        masterConfig.servers.push(newServer)
      }
    }
  }

  // Import VS Code configs
  const vsCodePath = path.join(os.homedir(), 'Library', 'Application Support', 'Code', 'User', 'settings.json')
  if (fs.existsSync(vsCodePath)) {
    const data = readJsonSafe(vsCodePath)
    if (data?.['mcp.servers'] && typeof data['mcp.servers'] === 'object') {
      const vsCodeServers = data['mcp.servers'] as Record<string, unknown>
      for (const [name, server] of Object.entries(vsCodeServers)) {
        const serverObj = server as Record<string, unknown>
        const newServer: McpServer = {
          id: name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
          name,
          transport: getTransportFromCommand(serverObj.command as string || 'unknown'),
          command: serverObj.command as string || 'unknown',
          args: Array.isArray(serverObj.args) ? serverObj.args as string[] : [],
          env: typeof serverObj.env === 'object' ? serverObj.env as Record<string, string> : {},
          enabled: true,
          targets: ['vscode'],
          notes: `Imported from VS Code config file`
        }
        
        // Check for duplicated server names
        const existingServer = masterConfig.servers.find(s => s.name === name)
        if (existingServer) {
          // Flag as conflicting
          conflicts.push(name)
          continue
        }
        
        masterConfig.servers.push(newServer)
      }
    }
  }

  // Save updated master config
  writeJsonAtomic(masterPath, masterConfig)

  return {
    imported: masterConfig.servers.length,
    conflicts,
    duplicates,
  }
}

// ── Management functions ─────────────────────────────────────────────────────

/**
 * Get all MCP servers from the master config
 */
export function listMcpServers(): McpServer[] {
  const masterPath = getMasterConfigPath()
  if (fs.existsSync(masterPath)) {
    const data = readJsonSafe(masterPath)
    if (data && typeof data?.version === 'number' && Array.isArray(data?.servers)) {
      return data.servers as McpServer[]
    }
  }
  return []
}

/**
 * Add a new MCP server to the master config
 */
export function addMcpServer(server: Omit<McpServer, 'id'>): McpServer {
  const masterPath = getMasterConfigPath()
  let masterConfig: McpConfig = {
    version: 1,
    servers: [],
  }

  if (fs.existsSync(masterPath)) {
    const data = readJsonSafe(masterPath)
    if (data && typeof data?.version === 'number' && Array.isArray(data?.servers)) {
      masterConfig = data as McpConfig
    }
  }

  const newServer: McpServer = {
    ...server,
    id: server.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
  }

  masterConfig.servers.push(newServer)
  writeJsonAtomic(masterPath, masterConfig)
  return newServer
}

/**
 * Update an existing MCP server in the master config
 */
export function updateMcpServer(id: string, updates: Partial<McpServer>): McpServer {
  const masterPath = getMasterConfigPath()
  let masterConfig: McpConfig = {
    version: 1,
    servers: [],
  }

  if (fs.existsSync(masterPath)) {
    const data = readJsonSafe(masterPath)
    if (data && typeof data?.version === 'number' && Array.isArray(data?.servers)) {
      masterConfig = data as McpConfig
    }
  }

  const index = masterConfig.servers.findIndex(s => s.id === id)
  if (index !== -1) {
    Object.assign(masterConfig.servers[index], updates)
    writeJsonAtomic(masterPath, masterConfig)
    return masterConfig.servers[index]
  }

  throw new Error(`Server with id '${id}' not found`)
}

/**
 * Delete an MCP server from the master config
 */
export function deleteMcpServer(id: string): boolean {
  const masterPath = getMasterConfigPath()
  let masterConfig: McpConfig = {
    version: 1,
    servers: [],
  }

  if (fs.existsSync(masterPath)) {
    const data = readJsonSafe(masterPath)
    if (data && typeof data?.version === 'number' && Array.isArray(data?.servers)) {
      masterConfig = data as McpConfig
    }
  }

  const initialLength = masterConfig.servers.length
  masterConfig.servers = masterConfig.servers.filter(s => s.id !== id)
  if (masterConfig.servers.length === initialLength) {
    return false
  }

  writeJsonAtomic(masterPath, masterConfig)
  return true
}

/**
 * Toggle a server's enabled state
 */
export function toggleMcpServer(id: string, enabled: boolean): boolean {
  const masterPath = getMasterConfigPath()
  let masterConfig: McpConfig = {
    version: 1,
    servers: [],
  }

  if (fs.existsSync(masterPath)) {
    const data = readJsonSafe(masterPath)
    if (data && typeof data?.version === 'number' && Array.isArray(data?.servers)) {
      masterConfig = data as McpConfig
    }
  }

  const server = masterConfig.servers.find(s => s.id === id)
  if (server) {
    server.enabled = enabled
    writeJsonAtomic(masterPath, masterConfig)
    return true
  }

  return false
}

/**
 * Sync the master config to target files
 */
export function syncToTargets(): void {
  const masterPath = getMasterConfigPath()
  if (!fs.existsSync(masterPath)) return

  const data = readJsonSafe(masterPath)
  if (!data || typeof data?.version !== 'number' || !Array.isArray(data?.servers)) return

  const masterConfig = data as McpConfig

  // Create a map of server by name to check for conflicts
  const serversByName = new Map<string, McpServer>()
  for (const server of masterConfig.servers) {
    serversByName.set(server.name, server)
  }

  const allTargets = ['claude-global', 'claude-project', 'cursor', 'vscode'] as const
  for (const target of allTargets) {
    const targetPath = getTargetConfigPath(target)
    
    // Skip if target path doesn't exist (and we can't create it)
    const targetDir = path.dirname(targetPath)
    if (!fs.existsSync(targetDir)) {
      // Try to create directories
      try {
        fs.mkdirSync(targetDir, { recursive: true })
      } catch {
        // Skip if we can't create the directory
        continue
      }
    }
    
    // Filter servers for this target
    const targetServers = masterConfig.servers.filter(server => 
      server.enabled && server.targets.includes(target)
    )
    
    // Prepare target config
    const targetConfig = {
      mcpServers: {} as Record<string, unknown>
    }
    
    for (const server of targetServers) {
      targetConfig.mcpServers[server.name] = {
        command: server.command,
        args: server.args,
        env: server.env,
      }
    }
    
    // Write to target file
    try {
      writeJsonAtomic(targetPath, targetConfig)
    } catch (error) {
      console.error(`Failed to write to ${targetPath}:`, error)
    }
  }
}

// ── Health check functions ────────────────────────────────────────────────────

/**
 * Perform a health check on an MCP server by spawning it and testing the handshake
 */
export async function checkServerHealth(server: McpServer): Promise<'healthy' | 'unreachable' | 'never-checked'> {
  // For now, we just return "never-checked" as a placeholder
  // In a full implementation, this would actually spawn the server and test connectivity
  return 'never-checked'
}

// ── Template server configs ───────────────────────────────────────────────────

export const TEMPLATE_SERVERS: McpServer[] = [
  {
    id: 'context7',
    name: 'Context7',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@upstash/context7-mcp'],
    env: {},
    enabled: true,
    targets: ['claude-global', 'claude-project'],
    notes: 'Library documentation lookup'
  },
  {
    id: 'github',
    name: 'GitHub',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    env: { GITHUB_PERSONAL_ACCESS_TOKEN: 'ghp_...' },
    enabled: true,
    targets: ['claude-global', 'claude-project'],
    notes: 'GitHub API access'
  },
  {
    id: 'notion',
    name: 'Notion',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@notionhq/notion-mcp-server'],
    env: { NOTION_INTEGRATION_TOKEN: 'secret_...' },
    enabled: true,
    targets: ['claude-global', 'claude-project'],
    notes: 'Notion API access'
  },
  {
    id: 'firecrawl',
    name: 'Firecrawl',
    transport: 'stdio',
    command: 'npx',
    args: ['firecrawl-mcp'],
    env: { FIRECRAWL_API_KEY: 'fc-...' },
    enabled: true,
    targets: ['claude-project'],
    notes: 'Web scraping'
  },
  {
    id: 'browserbase',
    name: 'Browserbase',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@anthropic-ai/mcp-server-browserbase'],
    env: { BROWSERBASE_API_KEY: 'br-...' },
    enabled: true,
    targets: ['claude-project'],
    notes: 'Browser automation'
  },
  {
    id: 'sequential-thinking',
    name: 'Sequential Thinking',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-sequential-thinking'],
    env: {},
    enabled: true,
    targets: ['claude-project'],
    notes: 'Sequential thinking tool'
  },
  {
    id: 'memory',
    name: 'Memory',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-memory'],
    env: {},
    enabled: true,
    targets: ['claude-project'],
    notes: 'Memory-based tool'
  },
  {
    id: 'ddg-search',
    name: 'DuckDuckGo Search',
    transport: 'stdio',
    command: 'uvx',
    args: ['duckduckgo-mcp-server'],
    env: {},
    enabled: true,
    targets: ['claude-project'],
    notes: 'Search engine'
  },
  {
    id: 'serena',
    name: 'Serena',
    transport: 'stdio',
    command: 'uvx',
    args: ['git+https://github.com/oraios/serena'],
    env: {},
    enabled: true,
    targets: ['claude-project'],
    notes: 'Search and document'
  },
  {
    id: 'playwright',
    name: 'Playwright',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@executeautomation/playwright-mcp-server'],
    env: {},
    enabled: true,
    targets: ['claude-project'],
    notes: 'Browser automation'
  },
  {
    id: 'phaser-editor',
    name: 'Phaser Editor',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@phaserjs/editor-mcp-server'],
    env: {},
    enabled: true,
    targets: ['claude-project'],
    notes: 'Game development'
  },
  {
    id: 'veritas-kanban',
    name: 'Veritas Kanban',
    transport: 'stdio',
    command: 'node',
    args: ['local-path'],
    env: {},
    enabled: true,
    targets: ['claude-project'],
    notes: 'Kanban board'
  },
  {
    id: 'penny',
    name: 'Penny',
    transport: 'stdio',
    command: 'node',
    args: ['Penny/src/mcp/index.js'],
    env: {},
    enabled: true,
    targets: ['claude-project'],
    notes: 'Penny tool'
  },
  {
    id: 'trendradar',
    name: 'Trendradar',
    transport: 'sse',
    command: 'http://localhost:3333/mcp',
    args: [],
    env: {},
    enabled: true,
    targets: ['claude-project'],
    notes: 'Trend monitoring'
  },
  {
    id: 'firecrawl-sse',
    name: 'Firecrawl SSE',
    transport: 'sse',
    command: 'https://api.firecrawl.dev/mcp',
    args: [],
    env: { FIRECRAWL_API_KEY: 'fc-...' },
    enabled: true,
    targets: ['claude-project'],
    notes: 'Web scraping via SSE'
  }
]

// ── IPC Handlers ────────────────────────────────────────────────────────────

import { ipcMain } from 'electron'

export function registerMcpIpcHandlers() {
  ipcMain.handle('mcp:list', async () => {
    try { return { success: true, data: listMcpServers() } }
    catch (error) { return { success: false, error: (error as Error).message } }
  })
  ipcMain.handle('mcp:add', async (_event, serverData) => {
    try { const server = addMcpServer(serverData); syncToTargets(); return { success: true, data: server } }
    catch (error) { return { success: false, error: (error as Error).message } }
  })
  ipcMain.handle('mcp:update', async (_event, id, updates) => {
    try { const server = updateMcpServer(id, updates); syncToTargets(); return { success: true, data: server } }
    catch (error) { return { success: false, error: (error as Error).message } }
  })
  ipcMain.handle('mcp:delete', async (_event, id) => {
    try { const success = deleteMcpServer(id); if (success) syncToTargets(); return { success: true, deleted: success } }
    catch (error) { return { success: false, error: (error as Error).message } }
  })
  ipcMain.handle('mcp:toggle', async (_event, id, enabled) => {
    try { const success = toggleMcpServer(id, enabled); if (success) syncToTargets(); return { success: true, toggled: success } }
    catch (error) { return { success: false, error: (error as Error).message } }
  })
  ipcMain.handle('mcp:import', async () => {
    try { return { success: true, data: await discoverAndImportMcpConfigs() } }
    catch (error) { return { success: false, error: (error as Error).message } }
  })
  ipcMain.handle('mcp:templates', async () => {
    try { return { success: true, data: TEMPLATE_SERVERS } }
    catch (error) { return { success: false, error: (error as Error).message } }
  })
  ipcMain.handle('mcp:sync', async () => {
    try { syncToTargets(); return { success: true } }
    catch (error) { return { success: false, error: (error as Error).message } }
  })
}