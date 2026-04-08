import fs from 'fs'
import path from 'path'
import os from 'os'
import { spawn } from 'child_process'
import { SIDEKICK_ROOT } from './paths'

// ── Types ─────────────────────────────────────────────────────────────────────

export type SyncTarget = 'claude-global' | 'claude-project' | 'cursor'

export interface McpServer {
  id: string
  name: string
  transport: 'stdio' | 'sse' | 'url'
  command?: string
  args?: string[]
  url?: string
  env?: Record<string, string>
  enabled: boolean
  targets: SyncTarget[]
  notes?: string
}

export interface MasterConfig {
  version: number
  servers: McpServer[]
}

export interface ImportResult {
  imported: number
  skipped: number
  conflicts: string[]
}

export interface SyncResult {
  [target: string]: { written: number; path: string }
}

export interface HealthResult {
  status: 'healthy' | 'unreachable' | 'error'
  latencyMs: number
  error?: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

export const MASTER_CONFIG_PATH = path.join(SIDEKICK_ROOT, '.penpal', 'mcp-servers.json')

const HOME_DIR = os.homedir()

export const TARGET_PATHS: Record<SyncTarget, string> = {
  'claude-global': path.join(HOME_DIR, '.mcp.json'),
  'claude-project': path.join(SIDEKICK_ROOT, '.mcp.json'),
  cursor: path.join(HOME_DIR, '.cursor', 'mcp.json'),
}

// ── Master Config IO ──────────────────────────────────────────────────────────

export function readMasterConfig(): MasterConfig {
  if (!fs.existsSync(MASTER_CONFIG_PATH)) {
    return { version: 1, servers: [] }
  }
  try {
    const raw = fs.readFileSync(MASTER_CONFIG_PATH, 'utf-8')
    const parsed = JSON.parse(raw) as MasterConfig
    return { version: parsed.version ?? 1, servers: parsed.servers ?? [] }
  } catch {
    return { version: 1, servers: [] }
  }
}

export function writeMasterConfig(config: MasterConfig): void {
  const dir = path.dirname(MASTER_CONFIG_PATH)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  const tmp = MASTER_CONFIG_PATH + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(config, null, 2), 'utf-8')
  fs.renameSync(tmp, MASTER_CONFIG_PATH)
}

// ── Import from Existing Config Files ─────────────────────────────────────────

function readMcpJson(filePath: string): Record<string, unknown> {
  if (!fs.existsSync(filePath)) return {}
  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    const parsed = JSON.parse(raw)
    return (parsed?.mcpServers ?? {}) as Record<string, unknown>
  } catch {
    return {}
  }
}

function detectTransport(entry: Record<string, unknown>): McpServer['transport'] {
  if (entry.url || entry.type === 'url' || entry.type === 'sse') return 'sse'
  return 'stdio'
}

function entryToServer(
  name: string,
  entry: Record<string, unknown>,
  targets: SyncTarget[],
): McpServer {
  const transport = detectTransport(entry)
  const id = `imported-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`
  if (transport === 'sse') {
    return {
      id,
      name,
      transport: 'sse',
      url: String(entry.url ?? ''),
      env: (entry.env as Record<string, string>) ?? undefined,
      enabled: true,
      targets,
    }
  }
  return {
    id,
    name,
    transport: 'stdio',
    command: String(entry.command ?? ''),
    args: Array.isArray(entry.args) ? (entry.args as string[]) : [],
    env: (entry.env as Record<string, string>) ?? undefined,
    enabled: true,
    targets,
  }
}

export function importFromExisting(): ImportResult {
  const existing = readMasterConfig()

  // If master already has entries, do nothing
  if (existing.servers.length > 0) {
    return { imported: 0, skipped: existing.servers.length, conflicts: [] }
  }

  const globalServers = readMcpJson(TARGET_PATHS['claude-global'])
  const projectServers = readMcpJson(TARGET_PATHS['claude-project'])

  const merged = new Map<string, McpServer>()
  const conflicts: string[] = []

  // Global first, then project overrides
  for (const [name, entry] of Object.entries(globalServers)) {
    merged.set(name, entryToServer(name, entry as Record<string, unknown>, ['claude-global']))
  }

  for (const [name, entry] of Object.entries(projectServers)) {
    if (merged.has(name)) {
      conflicts.push(name)
      // Prefer project version, update targets to include both
      const existing = merged.get(name)!
      if (!existing.targets.includes('claude-project')) {
        existing.targets.push('claude-project')
      }
    } else {
      merged.set(name, entryToServer(name, entry as Record<string, unknown>, ['claude-project']))
    }
  }

  const servers = Array.from(merged.values())
  writeMasterConfig({ version: 1, servers })

  return { imported: servers.length, skipped: 0, conflicts }
}

// ── Sync to Target Files ──────────────────────────────────────────────────────

type ClaudeStdioEntry = { command: string; args?: string[]; env?: Record<string, string> }
type ClaudeSseEntry = { type: 'url'; url: string; env?: Record<string, string> }
type ClaudeEntry = ClaudeStdioEntry | ClaudeSseEntry

export function syncToTargets(config: MasterConfig): SyncResult {
  const result: SyncResult = {}

  for (const target of Object.keys(TARGET_PATHS) as SyncTarget[]) {
    const targetPath = TARGET_PATHS[target]
    const applicable = config.servers.filter((s) => s.enabled && s.targets.includes(target))

    const mcpServers: Record<string, ClaudeEntry> = {}
    for (const server of applicable) {
      if (server.transport === 'sse' || server.transport === 'url') {
        mcpServers[server.name] = {
          type: 'url',
          url: server.url ?? '',
          ...(server.env ? { env: server.env } : {}),
        }
      } else {
        const entry: ClaudeStdioEntry = {
          command: server.command ?? '',
          ...(server.args?.length ? { args: server.args } : {}),
          ...(server.env ? { env: server.env } : {}),
        }
        mcpServers[server.name] = entry
      }
    }

    const dir = path.dirname(targetPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(targetPath, JSON.stringify({ mcpServers }, null, 2), 'utf-8')

    result[target] = { written: applicable.length, path: targetPath }
  }

  return result
}

// ── Health Check ──────────────────────────────────────────────────────────────

export function healthCheckServer(server: McpServer): Promise<HealthResult> {
  return new Promise((resolve) => {
    if (server.transport !== 'stdio' || !server.command) {
      resolve({
        status: 'error',
        latencyMs: 0,
        error: 'Health check only supported for stdio servers',
      })
      return
    }

    const start = Date.now()
    const timeout = 3000

    let settled = false
    const settle = (result: HealthResult) => {
      if (settled) return
      settled = true
      if (proc.exitCode === null) {
        try {
          proc.kill()
        } catch {
          // ignore
        }
      }
      resolve(result)
    }

    let proc: ReturnType<typeof spawn>
    try {
      proc = spawn(server.command, server.args ?? [], {
        env: { ...process.env, ...(server.env ?? {}) },
        stdio: ['pipe', 'pipe', 'pipe'],
      })
    } catch (err) {
      resolve({ status: 'error', latencyMs: 0, error: String(err) })
      return
    }

    const timer = setTimeout(() => {
      settle({ status: 'unreachable', latencyMs: Date.now() - start, error: 'Timeout after 3s' })
    }, timeout)

    proc.stdout?.on('data', (chunk: Buffer) => {
      const text = chunk.toString()
      // MCP servers emit a JSON handshake on startup
      if (text.includes('"jsonrpc"') || text.includes('"method"') || text.includes('"result"')) {
        clearTimeout(timer)
        settle({ status: 'healthy', latencyMs: Date.now() - start })
      }
    })

    proc.on('error', (err) => {
      clearTimeout(timer)
      settle({ status: 'error', latencyMs: Date.now() - start, error: err.message })
    })

    proc.on('exit', (code) => {
      clearTimeout(timer)
      if (!settled) {
        settle({
          status: code === 0 ? 'healthy' : 'error',
          latencyMs: Date.now() - start,
          error: code !== 0 ? `Process exited with code ${code}` : undefined,
        })
      }
    })
  })
}

// ── Templates ─────────────────────────────────────────────────────────────────

export const SERVER_TEMPLATES: McpServer[] = [
  {
    id: 'tpl-context7',
    name: 'context7',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@upstash/context7-mcp'],
    enabled: true,
    targets: ['claude-global'],
    notes: 'Up-to-date library documentation for LLMs',
  },
  {
    id: 'tpl-sequential-thinking',
    name: 'sequential-thinking',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-sequential-thinking'],
    enabled: true,
    targets: ['claude-global'],
    notes: 'Structured multi-step reasoning',
  },
  {
    id: 'tpl-memory',
    name: 'memory',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-memory'],
    enabled: true,
    targets: ['claude-global'],
    notes: 'Persistent knowledge graph memory',
  },
  {
    id: 'tpl-firecrawl',
    name: 'firecrawl',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', 'firecrawl-mcp'],
    env: { FIRECRAWL_API_KEY: '' },
    enabled: true,
    targets: ['claude-global'],
    notes: 'Web scraping and crawling (requires FIRECRAWL_API_KEY)',
  },
  {
    id: 'tpl-github',
    name: 'github',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    env: { GITHUB_PERSONAL_ACCESS_TOKEN: '' },
    enabled: true,
    targets: ['claude-global'],
    notes: 'GitHub issues, PRs, and code search (requires GITHUB_PERSONAL_ACCESS_TOKEN)',
  },
  {
    id: 'tpl-linear',
    name: 'linear',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', 'linear-mcp-server'],
    env: { LINEAR_API_KEY: '' },
    enabled: true,
    targets: ['claude-global'],
    notes: 'Linear project management (requires LINEAR_API_KEY)',
  },
  {
    id: 'tpl-notion',
    name: 'notion',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-notion'],
    env: { NOTION_API_TOKEN: '' },
    enabled: true,
    targets: ['claude-global'],
    notes: 'Notion pages and databases (requires NOTION_API_TOKEN)',
  },
  {
    id: 'tpl-neon',
    name: 'neon',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@neondatabase/mcp-server-neon'],
    env: { NEON_API_KEY: '' },
    enabled: true,
    targets: ['claude-project'],
    notes: 'Neon Postgres database management (requires NEON_API_KEY)',
  },
  {
    id: 'tpl-playwright',
    name: 'playwright',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@executeautomation/playwright-mcp-server'],
    enabled: true,
    targets: ['claude-global'],
    notes: 'Browser automation and testing',
  },
  {
    id: 'tpl-vercel',
    name: 'vercel',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@vercel/mcp-adapter'],
    env: { VERCEL_TOKEN: '' },
    enabled: true,
    targets: ['claude-global'],
    notes: 'Vercel deployments and projects (requires VERCEL_TOKEN)',
  },
  {
    id: 'tpl-cloudflare',
    name: 'cloudflare',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@cloudflare/mcp-server-cloudflare'],
    env: { CLOUDFLARE_API_TOKEN: '' },
    enabled: true,
    targets: ['claude-global'],
    notes: 'Cloudflare Workers, D1, KV, R2 (requires CLOUDFLARE_API_TOKEN)',
  },
  {
    id: 'tpl-mermaid',
    name: 'mermaid',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@mermaid-chart/mcp-server'],
    enabled: true,
    targets: ['claude-global'],
    notes: 'Mermaid diagram creation and validation',
  },
  {
    id: 'tpl-filesystem',
    name: 'filesystem',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', os.homedir()],
    enabled: false,
    targets: ['claude-global'],
    notes: 'Local filesystem access (disabled by default — edit args to set allowed path)',
  },
  {
    id: 'tpl-ddg-search',
    name: 'ddg-search',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', 'duckduckgo-mcp'],
    enabled: true,
    targets: ['claude-global'],
    notes: 'DuckDuckGo web search',
  },
  {
    id: 'tpl-phaser-editor',
    name: 'phaser-editor',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', 'phaser-editor-mcp'],
    enabled: false,
    targets: ['claude-project'],
    notes: 'Phaser Editor v5 scene automation (requires Phaser Editor running)',
  },
]

export function getTemplates(existingConfig?: MasterConfig): McpServer[] {
  const config = existingConfig ?? readMasterConfig()
  const existingIds = new Set(config.servers.map((s) => s.id))
  const existingNames = new Set(config.servers.map((s) => s.name))
  return SERVER_TEMPLATES.filter((t) => !existingIds.has(t.id) && !existingNames.has(t.name))
}
