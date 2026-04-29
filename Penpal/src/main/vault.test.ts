import fs from 'fs'
import path from 'path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const testState = vi.hoisted(() => ({
  vaultRoot: '/tmp/penny-vault-main-test',
}))

vi.mock('./paths', () => ({
  DOCS_ROOT: testState.vaultRoot,
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
    fs.rmSync(testState.vaultRoot, { recursive: true, force: true })
    fs.mkdirSync(testState.vaultRoot, { recursive: true })
  })

  it('parses frontmatter and extracts tags', () => {
    const content = `---
title: Alpha
tags: [ops, infra]
---
# Hello
#roadmap`
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

  it('returns search matches and folder hierarchy', async () => {
    fs.mkdirSync(path.join(testState.vaultRoot, 'Research'), { recursive: true })
    fs.writeFileSync(path.join(testState.vaultRoot, 'Research', 'alpha.md'), '# Title\nThis chip benchmark is excellent.', 'utf-8')
    fs.writeFileSync(path.join(testState.vaultRoot, 'Research', 'beta.md'), '# Other\nNo relevant token.', 'utf-8')

    const results = await searchVault('chip benchmark', undefined, 10)
    expect(results.length).toBeGreaterThan(0)
    expect(results[0]).toHaveProperty('snippet')
    expect(results[0]).toHaveProperty('occurrences')
    expect(results[0]).toHaveProperty('filename')
    expect(getFolderHierarchy('Research/alpha.md')).toEqual(['Research'])
  })
})
