import fs from 'fs'
import path from 'path'
import os from 'os'
import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest'

type MockFile = { content: string; mtime: number }
const files = new Map<string, MockFile>()

function normalizePath(input: string): string {
  const normalized = input.replace(/\\/g, '/')
  const marker = '/sidekick/'
  const idx = normalized.indexOf(marker)
  if (idx >= 0) return normalized.slice(idx + marker.length)
  return normalized.replace(/^\/+/, '')
}

vi.mock('../../../src/main/vault.js', () => ({
  readVaultFile: vi.fn((relativePath: string) => files.get(normalizePath(relativePath)) ?? null),
  searchVault: vi.fn(async (query: string, _glob: string | undefined, limit: number) =>
    Array.from(files.entries())
      .filter(([, file]) => file.content.toLowerCase().includes(query.toLowerCase()))
      .slice(0, limit)
      .map(([filePath, file]) => ({
        path: filePath,
        line: 1,
        text: file.content.split('\n')[0] ?? '',
        snippet: file.content.split('\n')[0] ?? '',
        occurrences: 2,
        filename: filePath.split('/').pop() ?? filePath,
      })),
  ),
  createVaultFile: vi.fn((relativePath: string, content = '') => {
    const mtime = Date.now()
    files.set(normalizePath(relativePath), { content, mtime })
    return { success: true, mtime }
  }),
  writeVaultFile: vi.fn((relativePath: string, content: string) => {
    const mtime = Date.now()
    files.set(normalizePath(relativePath), { content, mtime })
    return { success: true, mtime }
  }),
  parseMarkdownFrontmatter: vi.fn(() => ({ title: 'Mock Title', tags: ['test'] })),
  extractTagsFromMarkdown: vi.fn(() => ['test']),
  getFolderHierarchy: vi.fn((relativePath: string) => {
    const parts = relativePath.split('/')
    return parts.length > 1 ? [parts[0]] : []
  }),
  getVaultFileContext: vi.fn(async () => ({
    backlinks: [{ title: 'Ref', path: 'Refs/ref.md', snippet: '[[note]] ref' }],
    relatedFiles: ['Refs/ref.md'],
    folderContext: ['Folder'],
    tagContext: ['test'],
  })),
}))

describe('vault mcp infra smoke', () => {
  let handleVaultRead: typeof import('../../../src/mcp/tools/vault').handleVaultRead
  let handleVaultSearch: typeof import('../../../src/mcp/tools/vault').handleVaultSearch
  let handleVaultWrite: typeof import('../../../src/mcp/tools/vault').handleVaultWrite
  let tmpHome: string

  beforeEach(async () => {
    vi.resetModules()
    files.clear()
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'vault-infra-'))
    vi.stubEnv('HOME', tmpHome)
    vi.stubEnv('VAULT_PATH', path.join(tmpHome, 'vault-root'))
    const v = await import('../../../src/mcp/tools/vault')
    handleVaultRead = v.handleVaultRead
    handleVaultSearch = v.handleVaultSearch
    handleVaultWrite = v.handleVaultWrite
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    if (tmpHome) fs.rmSync(tmpHome, { recursive: true, force: true })
  })

  it('read returns rich context response', async () => {
    files.set('Folder/note.md', { content: '# body', mtime: 100 })
    const result = await handleVaultRead({ path: 'Folder/note.md' })
    expect(result.data?.content).toContain('body')
    expect(result.data?.frontmatter).toEqual({ title: 'Mock Title', tags: ['test'] })
    expect(result.data?.relatedFiles.length).toBeGreaterThan(0)
  })

  it('search returns ranked results with snippet and score', async () => {
    files.set('Folder/a.md', { content: 'firmware timing matters', mtime: 101 })
    const result = await handleVaultSearch({ query: 'firmware', limit: 5 })
    expect(result.data.length).toBe(1)
    expect(typeof result.data[0].score).toBe('number')
    expect(result.data[0].snippet).toContain('firmware')
  })

  it('write create-if-missing semantics work', async () => {
    const fail = await handleVaultWrite({ path: 'Folder/missing.md', content: 'x' })
    expect(fail.data.success).toBe(false)

    const ok = await handleVaultWrite({ path: 'Folder/missing.md', content: 'x', createIfMissing: true })
    expect(ok.data.success).toBe(true)
    expect(ok.data.created).toBe(true)
  })
})
