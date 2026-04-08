import fs from 'fs'
import path from 'path'
import os from 'os'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

// ── Setup temp dirs ──────────────────────────────────────────────────────────

const testState = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const _path = require('path') as typeof import('path')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const _os = require('os') as typeof import('os')
  const tmpDir = _path.join(_os.tmpdir(), `penny-mcp-test-${Date.now()}`)
  return {
    tmpDir,
    sidekickRoot: _path.join(tmpDir, 'sidekick'),
    homeDir: _path.join(tmpDir, 'home'),
  }
})

// Mock paths before importing mcp-manager
vi.mock('./paths', () => ({
  SIDEKICK_ROOT: testState.sidekickRoot,
  HOME_DIR: testState.homeDir,
}))

// Override os.homedir() since mcp-manager calls it directly
vi.mock('os', async (importOriginal) => {
  const original = await importOriginal<typeof import('os')>()
  return {
    ...original,
    homedir: () => testState.homeDir,
    default: {
      ...original,
      homedir: () => testState.homeDir,
    },
  }
})

import {
  readMasterConfig,
  writeMasterConfig,
  importFromExisting,
  syncToTargets,
  getTemplates,
  SERVER_TEMPLATES,
  TARGET_PATHS,
  type McpServer,
  type MasterConfig,
} from './mcp-manager'

// ── Helpers ──────────────────────────────────────────────────────────────────

const masterConfigPath = path.join(testState.sidekickRoot, '.penpal', 'mcp-servers.json')

function writeMcpJson(filePath: string, servers: Record<string, unknown>) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify({ mcpServers: servers }, null, 2), 'utf-8')
}

function makeServer(overrides: Partial<McpServer> = {}): McpServer {
  return {
    id: 'test-server-1',
    name: 'test-server',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', 'some-mcp-package'],
    enabled: true,
    targets: ['claude-global'],
    ...overrides,
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  fs.mkdirSync(testState.sidekickRoot, { recursive: true })
  fs.mkdirSync(testState.homeDir, { recursive: true })
})

afterEach(() => {
  fs.rmSync(testState.tmpDir, { recursive: true, force: true })
})

describe('readMasterConfig', () => {
  it('returns empty config when file does not exist', () => {
    const cfg = readMasterConfig()
    expect(cfg).toEqual({ version: 1, servers: [] })
  })

  it('reads existing config file', () => {
    const config: MasterConfig = {
      version: 1,
      servers: [makeServer()],
    }
    fs.mkdirSync(path.dirname(masterConfigPath), { recursive: true })
    fs.writeFileSync(masterConfigPath, JSON.stringify(config), 'utf-8')

    const result = readMasterConfig()
    expect(result.servers).toHaveLength(1)
    expect(result.servers[0].name).toBe('test-server')
  })

  it('returns empty config on malformed JSON', () => {
    fs.mkdirSync(path.dirname(masterConfigPath), { recursive: true })
    fs.writeFileSync(masterConfigPath, 'not json', 'utf-8')
    const cfg = readMasterConfig()
    expect(cfg).toEqual({ version: 1, servers: [] })
  })
})

describe('writeMasterConfig', () => {
  it('creates parent directory and writes file atomically', () => {
    const config: MasterConfig = { version: 1, servers: [makeServer()] }
    writeMasterConfig(config)

    expect(fs.existsSync(masterConfigPath)).toBe(true)
    const read = JSON.parse(fs.readFileSync(masterConfigPath, 'utf-8'))
    expect(read.servers).toHaveLength(1)
    expect(read.servers[0].id).toBe('test-server-1')
  })

  it('overwrites existing config', () => {
    writeMasterConfig({ version: 1, servers: [makeServer({ name: 'first' })] })
    writeMasterConfig({ version: 1, servers: [makeServer({ name: 'second' }), makeServer({ id: 'x', name: 'third' })] })

    const read = readMasterConfig()
    expect(read.servers).toHaveLength(2)
    expect(read.servers[0].name).toBe('second')
  })
})

describe('importFromExisting', () => {
  it('returns skipped count if master already has entries', () => {
    writeMasterConfig({ version: 1, servers: [makeServer()] })
    const result = importFromExisting()
    expect(result.skipped).toBe(1)
    expect(result.imported).toBe(0)
  })

  it('imports from global mcp.json', () => {
    writeMcpJson(TARGET_PATHS['claude-global'], {
      firecrawl: { command: 'npx', args: ['-y', 'firecrawl-mcp'], env: { FIRECRAWL_API_KEY: 'key' } },
      context7: { command: 'npx', args: ['-y', '@upstash/context7-mcp'] },
    })

    const result = importFromExisting()
    expect(result.imported).toBe(2)
    expect(result.skipped).toBe(0)

    const cfg = readMasterConfig()
    expect(cfg.servers).toHaveLength(2)
    const names = cfg.servers.map((s) => s.name)
    expect(names).toContain('firecrawl')
    expect(names).toContain('context7')
  })

  it('merges global and project, preferring project version and updating targets', () => {
    writeMcpJson(TARGET_PATHS['claude-global'], {
      shared: { command: 'npx', args: ['-y', 'shared-global'] },
      globalOnly: { command: 'npx', args: ['-y', 'global-only'] },
    })
    writeMcpJson(TARGET_PATHS['claude-project'], {
      shared: { command: 'npx', args: ['-y', 'shared-project'] },
      projectOnly: { command: 'npx', args: ['-y', 'project-only'] },
    })

    const result = importFromExisting()
    expect(result.imported).toBe(3) // shared (merged), globalOnly, projectOnly
    expect(result.conflicts).toContain('shared')

    const cfg = readMasterConfig()
    const shared = cfg.servers.find((s) => s.name === 'shared')
    expect(shared).toBeDefined()
    expect(shared?.targets).toContain('claude-global')
    expect(shared?.targets).toContain('claude-project')
  })

  it('handles missing config files gracefully', () => {
    // Neither file exists
    const result = importFromExisting()
    expect(result.imported).toBe(0)
    expect(result.skipped).toBe(0)
  })
})

describe('syncToTargets', () => {
  it('writes enabled servers to their specified targets', () => {
    const config: MasterConfig = {
      version: 1,
      servers: [
        makeServer({ name: 'global-server', targets: ['claude-global'], enabled: true }),
        makeServer({ id: 'proj', name: 'project-server', targets: ['claude-project'], enabled: true }),
        makeServer({ id: 'dis', name: 'disabled-server', targets: ['claude-global'], enabled: false }),
      ],
    }

    const result = syncToTargets(config)

    // claude-global should have global-server only (disabled filtered out)
    expect(result['claude-global'].written).toBe(1)
    const globalContent = JSON.parse(fs.readFileSync(TARGET_PATHS['claude-global'], 'utf-8'))
    expect(Object.keys(globalContent.mcpServers)).toContain('global-server')
    expect(Object.keys(globalContent.mcpServers)).not.toContain('disabled-server')

    // claude-project should have project-server only
    expect(result['claude-project'].written).toBe(1)
    const projectContent = JSON.parse(fs.readFileSync(TARGET_PATHS['claude-project'], 'utf-8'))
    expect(Object.keys(projectContent.mcpServers)).toContain('project-server')
  })

  it('writes SSE/URL servers with type:url format', () => {
    const config: MasterConfig = {
      version: 1,
      servers: [
        makeServer({
          name: 'sse-server',
          transport: 'sse',
          url: 'https://example.com/mcp',
          command: undefined,
          args: undefined,
          targets: ['claude-global'],
        }),
      ],
    }

    syncToTargets(config)
    const content = JSON.parse(fs.readFileSync(TARGET_PATHS['claude-global'], 'utf-8'))
    expect(content.mcpServers['sse-server']).toMatchObject({ type: 'url', url: 'https://example.com/mcp' })
  })

  it('writes empty mcpServers when no servers match target', () => {
    const config: MasterConfig = { version: 1, servers: [] }
    const result = syncToTargets(config)
    expect(result['claude-global'].written).toBe(0)
    const content = JSON.parse(fs.readFileSync(TARGET_PATHS['claude-global'], 'utf-8'))
    expect(content.mcpServers).toEqual({})
  })

  it('omits args when empty', () => {
    const config: MasterConfig = {
      version: 1,
      servers: [
        makeServer({ name: 'noargs', args: [], targets: ['claude-global'] }),
      ],
    }
    syncToTargets(config)
    const content = JSON.parse(fs.readFileSync(TARGET_PATHS['claude-global'], 'utf-8'))
    expect(content.mcpServers['noargs'].args).toBeUndefined()
  })
})

describe('getTemplates', () => {
  it('returns all templates when master is empty', () => {
    const templates = getTemplates({ version: 1, servers: [] })
    expect(templates.length).toBe(SERVER_TEMPLATES.length)
  })

  it('filters out templates already in master config by id', () => {
    const config: MasterConfig = {
      version: 1,
      servers: [{ ...SERVER_TEMPLATES[0] }],
    }
    const templates = getTemplates(config)
    expect(templates.find((t) => t.id === SERVER_TEMPLATES[0].id)).toBeUndefined()
    expect(templates.length).toBe(SERVER_TEMPLATES.length - 1)
  })

  it('filters out templates already in master config by name', () => {
    const config: MasterConfig = {
      version: 1,
      servers: [makeServer({ name: SERVER_TEMPLATES[1].name })],
    }
    const templates = getTemplates(config)
    expect(templates.find((t) => t.name === SERVER_TEMPLATES[1].name)).toBeUndefined()
  })

  it('returns empty array when all templates are added', () => {
    const templates = getTemplates({ version: 1, servers: [...SERVER_TEMPLATES] })
    expect(templates).toHaveLength(0)
  })
})

describe('SERVER_TEMPLATES', () => {
  it('has at least 15 templates', () => {
    expect(SERVER_TEMPLATES.length).toBeGreaterThanOrEqual(15)
  })

  it('all templates have required fields', () => {
    for (const t of SERVER_TEMPLATES) {
      expect(t.id).toBeTruthy()
      expect(t.name).toBeTruthy()
      expect(['stdio', 'sse', 'url']).toContain(t.transport)
      expect(Array.isArray(t.targets)).toBe(true)
      expect(t.targets.length).toBeGreaterThan(0)
    }
  })

  it('all template ids are unique', () => {
    const ids = SERVER_TEMPLATES.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('all template names are unique', () => {
    const names = SERVER_TEMPLATES.map((t) => t.name)
    expect(new Set(names).size).toBe(names.length)
  })
})
