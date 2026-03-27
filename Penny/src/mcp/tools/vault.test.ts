import fs from 'fs'
import path from 'path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const testState = vi.hoisted(() => ({
  vaultRoot: '/tmp/penny-vault-mcp-tools-test',
}))

vi.mock('../../main/paths', () => ({
  DOCS_ROOT: testState.vaultRoot,
}))

vi.mock('../../main/vault', () => {
  function safeJoin(relativePath: string): string {
    const normalized = path.normalize(relativePath)
    if (!normalized || normalized === '.' || normalized === '..' || normalized.startsWith(`..${path.sep}`)) {
      throw new Error('Path traversal denied')
    }
    return path.resolve(testState.vaultRoot, normalized)
  }

  function walkMarkdownFiles(rootDir: string, relDir = ''): string[] {
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(rootDir, { withFileTypes: true })
    } catch {
      return []
    }

    const files: string[] = []
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue
      const full = path.join(rootDir, entry.name)
      const rel = relDir ? path.join(relDir, entry.name) : entry.name
      if (entry.isDirectory()) {
        files.push(...walkMarkdownFiles(full, rel))
      } else if (entry.name.endsWith('.md')) {
        files.push(rel)
      }
    }
    return files
  }

  return {
    readVaultFile: vi.fn((relativePath: string) => {
      const fullPath = safeJoin(relativePath)
      if (!fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) return null
      const stat = fs.statSync(fullPath)
      return { content: fs.readFileSync(fullPath, 'utf-8'), mtime: stat.mtimeMs }
    }),
    writeVaultFile: vi.fn((relativePath: string, content: string) => {
      const fullPath = safeJoin(relativePath)
      const dir = path.dirname(fullPath)
      if (!fs.existsSync(dir)) throw new Error('Parent directory does not exist')
      fs.writeFileSync(fullPath, content, 'utf-8')
      const stat = fs.statSync(fullPath)
      return { success: true, mtime: stat.mtimeMs }
    }),
    createVaultFile: vi.fn((relativePath: string, content = '') => {
      const fullPath = safeJoin(relativePath)
      fs.mkdirSync(path.dirname(fullPath), { recursive: true })
      fs.writeFileSync(fullPath, content, { encoding: 'utf-8', flag: 'wx' })
      const stat = fs.statSync(fullPath)
      return { success: true, mtime: stat.mtimeMs }
    }),
    getBacklinks: vi.fn(async (relativePath: string) => {
      const targetName = path.basename(relativePath, '.md')
      const results: Array<{ title: string; path: string; snippet: string }> = []
      for (const rel of walkMarkdownFiles(testState.vaultRoot)) {
        if (rel === relativePath) continue
        const full = safeJoin(rel)
        const content = fs.readFileSync(full, 'utf-8')
        const regex = new RegExp(`\\[\\[${targetName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\|[^\\]]*)?\\]\\]`, 'i')
        const match = content.match(regex)
        if (!match) continue
        const lineIdx = content.slice(0, match.index).split('\n').length - 1
        const snippet = content.split('\n')[lineIdx]?.trim().slice(0, 120) ?? ''
        results.push({ title: path.basename(rel, '.md'), path: rel, snippet })
      }
      return results.sort((a, b) => a.path.localeCompare(b.path))
    }),
  }
})

import { handleVaultRead, handleVaultSearch, handleVaultWrite } from './vault'

function writeFixture(relativePath: string, content: string): void {
  const full = path.join(testState.vaultRoot, relativePath)
  fs.mkdirSync(path.dirname(full), { recursive: true })
  fs.writeFileSync(full, content, 'utf-8')
}

beforeEach(() => {
  fs.rmSync(testState.vaultRoot, { recursive: true, force: true })
  fs.mkdirSync(testState.vaultRoot, { recursive: true })

  writeFixture('Projects/Plan.md', `---
title: Sprint Plan
tags:
  - roadmap
  - sprint
---
# Sprint Plan
Link to [[Related Note]]
`)
  writeFixture('Projects/Related Note.md', '# Related Note\nBacklinks live here.')
  writeFixture('Research/Graph.md', '# Graph Search\nUse graph ranking for notes.')
})

describe('vault mcp tools', () => {
  it('vault:read returns content + parsed frontmatter + backlinks', async () => {
    const result = await handleVaultRead({ path: 'Projects/Related Note.md' })

    expect(result.data).not.toBeNull()
    expect(result.data?.content).toContain('Backlinks live here.')
    expect(result.data?.backlinks.some((b) => b.path === 'Projects/Plan.md')).toBe(true)

    const withFrontmatter = await handleVaultRead({ path: 'Projects/Plan.md' })
    expect(withFrontmatter.data?.frontmatter).toMatchObject({ title: 'Sprint Plan' })
    expect(withFrontmatter.data?.related.sameFolder).toContain('Projects/Related Note.md')
  })

  it('vault:search returns ranked contextual results', async () => {
    const result = await handleVaultSearch({ query: 'sprint plan', limit: 5 })

    expect(result.data.results.length).toBeGreaterThan(0)
    expect(result.data.results[0].path).toBe('Projects/Plan.md')
    expect(typeof result.data.results[0].score).toBe('number')
    expect(result.data.results[0].snippet.length).toBeGreaterThan(0)
    expect(Array.isArray(result.data.results[0].tags)).toBe(true)
    expect(result.data.results[0].folderHierarchy).toEqual(['Projects'])
  })

  it('vault:write creates missing file with createIfMissing and can read it back', async () => {
    const writeResult = await handleVaultWrite({
      path: 'Projects/New Note.md',
      content: '# New Note\nCreated via tool.',
      createIfMissing: true,
    })

    expect(writeResult.data.success).toBe(true)
    expect(writeResult.data.created).toBe(true)

    const readResult = await handleVaultRead({ path: 'Projects/New Note.md' })
    expect(readResult.data?.content).toContain('Created via tool.')
  })

  it('vault:write rejects missing file when createIfMissing is false', async () => {
    const result = await handleVaultWrite({
      path: 'Projects/Missing.md',
      content: 'nope',
    })

    expect(result.data.success).toBe(false)
    expect(result.data.error).toContain('createIfMissing=true')
  })

  it('rejects path traversal attempts', async () => {
    await expect(handleVaultRead({ path: '../etc/passwd' })).rejects.toThrow('Path traversal')
    await expect(handleVaultWrite({
      path: '../../bad.md',
      content: 'bad',
      createIfMissing: true,
    })).rejects.toThrow('Path traversal')
  })
})
import { beforeEach, describe, expect, it, vi } from 'vitest'

type MockFile = { content: string; mtime: number }
const files = new Map<string, MockFile>()
const backlinks = [{ title: 'Ref', path: 'Refs/ref.md', snippet: '[[note]] ref' }]

vi.mock('../../main/vault.js', () => ({
  readVaultFile: vi.fn((relativePath: string) => files.get(relativePath) ?? null),
  searchVault: vi.fn(async (query: string, _glob: string | undefined, limit: number) => {
    const matches = Array.from(files.entries())
      .filter(([, file]) => file.content.toLowerCase().includes(query.toLowerCase()))
      .slice(0, limit)
      .map(([path, file]) => ({
        path,
        line: 1,
        text: file.content.split('\n')[0] ?? '',
        snippet: file.content.split('\n')[0] ?? '',
        occurrences: 2,
        filename: path.split('/').pop() ?? path,
      }))
    return matches
  }),
  createVaultFile: vi.fn((relativePath: string, content = '') => {
    const mtime = Date.now()
    files.set(relativePath, { content, mtime })
    return { success: true, mtime }
  }),
  writeVaultFile: vi.fn((relativePath: string, content: string) => {
    const mtime = Date.now()
    files.set(relativePath, { content, mtime })
    return { success: true, mtime }
  }),
  parseMarkdownFrontmatter: vi.fn((content: string) => {
    if (!content.startsWith('---\n')) return null
    return { title: 'Mock Title', tags: ['test'] }
  }),
  extractTagsFromMarkdown: vi.fn(() => ['test']),
  getFolderHierarchy: vi.fn((relativePath: string) => {
    const parts = relativePath.split('/')
    return parts.length > 1 ? [parts[0]] : []
  }),
  getVaultFileContext: vi.fn(async () => ({
    backlinks,
    relatedFiles: ['Refs/ref.md', 'Folder/sibling.md'],
    folderContext: ['Folder'],
    tagContext: ['test'],
  })),
}))

import { handleVaultRead, handleVaultSearch, handleVaultWrite } from './vault'

describe('mcp vault tools', () => {
  beforeEach(() => {
    files.clear()
  })

  it('read returns content with frontmatter and context', async () => {
    files.set('Folder/note.md', {
      content: '---\ntitle: note\n---\nbody',
      mtime: 100,
    })
    const result = await handleVaultRead({ path: 'Folder/note.md' })
    expect(result.data?.content).toContain('body')
    expect(result.data?.frontmatter).toEqual({ title: 'Mock Title', tags: ['test'] })
    expect(result.data?.backlinks.length).toBeGreaterThan(0)
    expect(result.data?.relatedFiles.length).toBeGreaterThan(0)
    expect(result.data?.folderContext).toEqual(['Folder'])
    expect(result.data?.tagContext).toEqual(['test'])
  })

  it('search returns ranked snippets with scores', async () => {
    files.set('Folder/a.md', { content: 'firmware timing matters', mtime: 101 })
    const result = await handleVaultSearch({ query: 'firmware', limit: 5 })
    expect(result.data.length).toBe(1)
    expect(result.data[0].snippet).toContain('firmware')
    expect(typeof result.data[0].score).toBe('number')
    expect(result.data[0].tags).toContain('test')
    expect(result.data[0].relatedFiles.length).toBeGreaterThan(0)
  })

  it('write creates file when createIfMissing is true', async () => {
    const writeResult = await handleVaultWrite({
      path: 'Folder/new.md',
      content: '# New',
      createIfMissing: true,
    })
    expect(writeResult.data.success).toBe(true)
    expect(writeResult.data.created).toBe(true)
    expect(files.get('Folder/new.md')?.content).toBe('# New')
  })

  it('write fails safely when file is missing and createIfMissing is false', async () => {
    const writeResult = await handleVaultWrite({
      path: 'Folder/missing.md',
      content: '# Missing',
    })
    expect(writeResult.data.success).toBe(false)
    expect(writeResult.data.created).toBe(false)
    expect(writeResult.summary).toContain('failed')
  })
})
