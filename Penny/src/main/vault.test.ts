import fs from 'fs'
import os from 'os'
import path from 'path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const vaultRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'vault-main-test-'))

vi.mock('./paths', () => ({
  DOCS_ROOT: vaultRoot,
}))

import {
  parseMarkdownFrontmatter,
  extractTagsFromMarkdown,
  createVaultFile,
  writeVaultFile,
  readVaultFile,
  searchVault,
  getFolderHierarchy,
} from './vault'

describe('main vault helpers', () => {
  beforeEach(() => {
    fs.rmSync(vaultRoot, { recursive: true, force: true })
    fs.mkdirSync(vaultRoot, { recursive: true })
  })

  it('parses frontmatter and extracts tags', () => {
    const content = `---\ntitle: Alpha\ntags: [ops, infra]\n---\n# Hello\n#roadmap`
    const frontmatter = parseMarkdownFrontmatter(content)
    const tags = extractTagsFromMarkdown(content, frontmatter)
    expect(frontmatter).toEqual({ title: 'Alpha', tags: ['ops', 'infra'] })
    expect(tags).toContain('ops')
    expect(tags).toContain('infra')
    expect(tags).toContain('roadmap')
  })

  it('handles missing and malformed frontmatter safely', () => {
    expect(parseMarkdownFrontmatter('# No frontmatter')).toBeNull()
    expect(parseMarkdownFrontmatter('---\nfoo: [bar\n---\ntext')).toBeNull()
  })

  it('creates and updates files with read-back', () => {
    const createResult = createVaultFile('Notes/test.md', '# First')
    expect(createResult.success).toBe(true)

    const writeResult = writeVaultFile('Notes/test.md', '# Second')
    expect(writeResult.success).toBe(true)

    const readResult = readVaultFile('Notes/test.md')
    expect(readResult?.content).toBe('# Second')
    expect(typeof readResult?.mtime).toBe('number')
  })

  it('returns rich search matches and folder hierarchy', async () => {
    createVaultFile('Research/alpha.md', '# Title\nThis chip benchmark is excellent.')
    createVaultFile('Research/beta.md', '# Other\nNo relevant token.')

    const results = await searchVault('chip benchmark', undefined, 10)
    expect(results.length).toBeGreaterThan(0)
    expect(results[0]).toHaveProperty('snippet')
    expect(results[0]).toHaveProperty('occurrences')
    expect(results[0]).toHaveProperty('filename')
    expect(getFolderHierarchy('Research/alpha.md')).toEqual(['Research'])
  })
})
