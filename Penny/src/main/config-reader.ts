/**
 * config-reader.ts
 * Reads and exposes all Claude/MCP/agent configuration to the Penpal UI.
 * Redacts secrets (API keys, tokens) before sending to the renderer.
 */

import fs from 'fs'
import path from 'path'
import os from 'os'
import { SIDEKICK_ROOT, HOME_DIR } from './paths'

// ── Types ───────────────────────────────────────────────────────────────────

export interface McpServerEntry {
  name: string
  command: string
  args: string[]
  env: Record<string, string>  // redacted
  cwd?: string
  source: 'project' | 'profile' | 'global'
}

export interface McpConfigSummary {
  projectServers: McpServerEntry[]        // from .mcp.json
  profileServers: Record<string, McpServerEntry[]>  // from agents/mcp-profiles/*.json
  totalUniqueServers: number
}

export interface ClaudeSettingsSummary {
  globalSettings: {
    envVars: string[]           // just key names, no values
    permissions: { allow: string[]; deny: string[] }
    alwaysThinking: boolean
    enabledPlugins: string[]
  }
  projectSettings: {
    exists: boolean
    path: string
  }
  claudeMdFiles: {
    path: string
    sizeBytes: number
    firstLine: string
  }[]
}

export interface AgentToolSummary {
  agentId: string
  agentName: string
  mcpProfile: string
  allowedTools: string[]
  mcpServers: string[]        // server names from their profile
  skills: string[]
}

export interface ConfigSnapshot {
  mcp: McpConfigSummary
  claude: ClaudeSettingsSummary
  agents: AgentToolSummary[]
  timestamp: number
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const REDACT_PATTERNS = [
  /key/i, /token/i, /secret/i, /password/i, /auth/i, /credential/i,
]

function redactEnv(env: Record<string, string>): Record<string, string> {
  const redacted: Record<string, string> = {}
  for (const [k, v] of Object.entries(env)) {
    const isSecret = REDACT_PATTERNS.some(p => p.test(k))
    redacted[k] = isSecret ? `${v.slice(0, 4)}...${v.slice(-4)}` : v
  }
  return redacted
}

function readJsonSafe(filePath: string): Record<string, unknown> | null {
  try {
    if (!fs.existsSync(filePath)) return null
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  } catch {
    return null
  }
}

function firstLine(filePath: string): string {
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    return content.split('\n')[0]?.trim() || ''
  } catch {
    return ''
  }
}

// ── Readers ─────────────────────────────────────────────────────────────────

function readProjectMcpConfig(): McpServerEntry[] {
  const mcpPath = path.join(SIDEKICK_ROOT, '.mcp.json')
  const data = readJsonSafe(mcpPath)
  if (!data?.mcpServers) return []

  const servers = data.mcpServers as Record<string, {
    command?: string; args?: string[]; env?: Record<string, string>; cwd?: string
  }>

  return Object.entries(servers).map(([name, cfg]) => ({
    name,
    command: cfg.command || 'unknown',
    args: cfg.args || [],
    env: redactEnv(cfg.env || {}),
    cwd: cfg.cwd,
    source: 'project' as const,
  }))
}

function readMcpProfiles(): Record<string, McpServerEntry[]> {
  const profileDir = path.join(SIDEKICK_ROOT, 'Penny', 'agents', 'mcp-profiles')
  const result: Record<string, McpServerEntry[]> = {}

  try {
    if (!fs.existsSync(profileDir)) return result
    const files = fs.readdirSync(profileDir).filter(f => f.endsWith('.json'))
    for (const file of files) {
      const profileName = file.replace('.json', '')
      const data = readJsonSafe(path.join(profileDir, file))
      if (!data?.mcpServers) continue
      const servers = data.mcpServers as Record<string, {
        command?: string; args?: string[]; env?: Record<string, string>; cwd?: string
      }>
      result[profileName] = Object.entries(servers).map(([name, cfg]) => ({
        name,
        command: cfg.command || 'unknown',
        args: cfg.args || [],
        env: redactEnv(cfg.env || {}),
        cwd: cfg.cwd,
        source: 'profile' as const,
      }))
    }
  } catch { /* skip */ }
  return result
}

function readClaudeSettings(): ClaudeSettingsSummary {
  const claudeDir = path.join(HOME_DIR, '.claude')

  // Global settings
  const globalData = readJsonSafe(path.join(claudeDir, 'settings.json'))
  const envKeys = globalData?.env ? Object.keys(globalData.env as Record<string, string>) : []
  const perms = (globalData?.permissions as { allow?: string[]; deny?: string[] }) || {}
  const plugins = globalData?.enabledPlugins
    ? Object.entries(globalData.enabledPlugins as Record<string, boolean>)
        .filter(([, v]) => v)
        .map(([k]) => k.replace('@claude-plugins-official', '').replace(/^@/, ''))
    : []

  // Project settings
  const projectKey = SIDEKICK_ROOT.replace(/\//g, '-').replace(/^-/, '-')
  const projectSettingsPath = path.join(claudeDir, 'projects', projectKey, 'settings.json')

  // CLAUDE.md files
  const claudeMdPaths = [
    path.join(SIDEKICK_ROOT, 'CLAUDE.md'),
    path.join(SIDEKICK_ROOT, 'Penny', 'CLAUDE.md'),
    path.join(SIDEKICK_ROOT, 'Penny', 'agents', 'CLAUDE.md'),
  ]

  const claudeMdFiles = claudeMdPaths
    .filter(p => fs.existsSync(p))
    .map(p => {
      const stat = fs.statSync(p)
      return {
        path: p.replace(HOME_DIR, '~'),
        sizeBytes: stat.size,
        firstLine: firstLine(p),
      }
    })

  return {
    globalSettings: {
      envVars: envKeys,
      permissions: {
        allow: (perms.allow || []) as string[],
        deny: (perms.deny || []) as string[],
      },
      alwaysThinking: !!globalData?.alwaysThinkingEnabled,
      enabledPlugins: plugins,
    },
    projectSettings: {
      exists: fs.existsSync(projectSettingsPath),
      path: projectSettingsPath.replace(HOME_DIR, '~'),
    },
    claudeMdFiles,
  }
}

function readAgentToolSummaries(): AgentToolSummary[] {
  const agentYaml = path.join(SIDEKICK_ROOT, 'Penny', 'agents', 'agent-types.yaml')
  try {
    if (!fs.existsSync(agentYaml)) return []
    const content = fs.readFileSync(agentYaml, 'utf-8')
    // Simple YAML parsing — we already have js-yaml in the project
    const yaml = require('js-yaml')
    const data = yaml.load(content) as { agents?: Record<string, Record<string, unknown>> }
    if (!data?.agents) return []

    const profiles = readMcpProfiles()

    return Object.entries(data.agents).map(([id, cfg]) => {
      const profileName = (cfg.mcpProfile as string) || ''
      const profileServers = profiles[profileName] || []
      return {
        agentId: id,
        agentName: (cfg.name as string) || id,
        mcpProfile: profileName,
        allowedTools: (cfg.allowedTools as string[]) || [],
        mcpServers: profileServers.map(s => s.name),
        skills: (cfg.skills as string[]) || [],
      }
    })
  } catch {
    return []
  }
}

// ── Writers ─────────────────────────────────────────────────────────────────

/**
 * Add an MCP server to the project .mcp.json.
 * `server` must have name, command, args; env and cwd are optional.
 */
export function addProjectMcpServer(server: {
  name: string; command: string; args: string[]; env?: Record<string, string>; cwd?: string
}): { success: boolean; error?: string } {
  const mcpPath = path.join(SIDEKICK_ROOT, '.mcp.json')
  try {
    const data = readJsonSafe(mcpPath) || { mcpServers: {} }
    const servers = (data.mcpServers || {}) as Record<string, unknown>
    const entry: Record<string, unknown> = { command: server.command, args: server.args }
    if (server.env && Object.keys(server.env).length > 0) entry.env = server.env
    if (server.cwd) entry.cwd = server.cwd
    servers[server.name] = entry
    data.mcpServers = servers
    fs.writeFileSync(mcpPath, JSON.stringify(data, null, 2) + '\n', 'utf-8')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

/** Remove an MCP server from the project .mcp.json by name. */
export function removeProjectMcpServer(name: string): { success: boolean; error?: string } {
  const mcpPath = path.join(SIDEKICK_ROOT, '.mcp.json')
  try {
    const data = readJsonSafe(mcpPath)
    if (!data?.mcpServers) return { success: false, error: 'No .mcp.json or mcpServers section' }
    const servers = data.mcpServers as Record<string, unknown>
    if (!(name in servers)) return { success: false, error: `Server "${name}" not found` }
    delete servers[name]
    data.mcpServers = servers
    fs.writeFileSync(mcpPath, JSON.stringify(data, null, 2) + '\n', 'utf-8')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

/** Add an MCP server to an agent MCP profile JSON. */
export function addProfileMcpServer(
  profileName: string,
  server: { name: string; command: string; args: string[]; env?: Record<string, string>; cwd?: string },
): { success: boolean; error?: string } {
  const profilePath = path.join(SIDEKICK_ROOT, 'Penny', 'agents', 'mcp-profiles', `${profileName}.json`)
  try {
    const data = readJsonSafe(profilePath) || { mcpServers: {} }
    const servers = (data.mcpServers || {}) as Record<string, unknown>
    const entry: Record<string, unknown> = { command: server.command, args: server.args }
    if (server.env && Object.keys(server.env).length > 0) entry.env = server.env
    if (server.cwd) entry.cwd = server.cwd
    servers[server.name] = entry
    data.mcpServers = servers
    fs.writeFileSync(profilePath, JSON.stringify(data, null, 2) + '\n', 'utf-8')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

/** Remove an MCP server from an agent MCP profile JSON. */
export function removeProfileMcpServer(
  profileName: string, serverName: string,
): { success: boolean; error?: string } {
  const profilePath = path.join(SIDEKICK_ROOT, 'Penny', 'agents', 'mcp-profiles', `${profileName}.json`)
  try {
    const data = readJsonSafe(profilePath)
    if (!data?.mcpServers) return { success: false, error: 'Profile not found or empty' }
    const servers = data.mcpServers as Record<string, unknown>
    if (!(serverName in servers)) return { success: false, error: `Server "${serverName}" not found in profile` }
    delete servers[serverName]
    data.mcpServers = servers
    fs.writeFileSync(profilePath, JSON.stringify(data, null, 2) + '\n', 'utf-8')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

/**
 * Update an agent's allowedTools list in agent-types.yaml.
 * Replaces the entire allowedTools array for the given agentId.
 */
export function updateAgentTools(
  agentId: string, allowedTools: string[],
): { success: boolean; error?: string } {
  const agentYaml = path.join(SIDEKICK_ROOT, 'Penny', 'agents', 'agent-types.yaml')
  try {
    const yaml = require('js-yaml')
    const content = fs.readFileSync(agentYaml, 'utf-8')
    const data = yaml.load(content) as { agents?: Record<string, Record<string, unknown>>; [k: string]: unknown }
    if (!data?.agents?.[agentId]) return { success: false, error: `Agent "${agentId}" not found` }
    data.agents[agentId].allowedTools = allowedTools
    // Dump back with flow-level 3 so arrays stay readable
    const out = yaml.dump(data, { lineWidth: 120, noRefs: true, quotingType: '"', forceQuotes: false })
    fs.writeFileSync(agentYaml, out, 'utf-8')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

export function getConfigSnapshot(): ConfigSnapshot {
  const projectServers = readProjectMcpConfig()
  const profileServers = readMcpProfiles()

  // Count unique server names across all sources
  const allNames = new Set<string>()
  for (const s of projectServers) allNames.add(s.name)
  for (const servers of Object.values(profileServers)) {
    for (const s of servers) allNames.add(s.name)
  }

  return {
    mcp: {
      projectServers,
      profileServers,
      totalUniqueServers: allNames.size,
    },
    claude: readClaudeSettings(),
    agents: readAgentToolSummaries(),
    timestamp: Date.now(),
  }
}
