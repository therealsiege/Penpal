import { beforeEach, describe, expect, it, vi } from 'vitest'

type MockFile = { content: string; mtime: number }
const files = new Map<string, MockFile>()
const backlinks = [{ title: 'Ref', path: 'Refs/ref.md', snippet: '[[note]] ref' }]

vi.mock('../../main/vault.js', () => ({
  readVaultFile: vi.fn((relativePath: string) => files.get(relativePath) ?? null),
  searchVault: vi.fn(async (query: string, _glob: string | undefined, limit: number) => {
    return Array.from(files.entries())
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

beforeEach(() => {
  files.clear()
})

describe('mcp vault tools', () => {
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
