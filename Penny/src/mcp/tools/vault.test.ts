import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'

describe('mcp vault tools', () => {
  let handleVaultRead: typeof import('./vault').handleVaultRead
  let handleVaultSearch: typeof import('./vault').handleVaultSearch
  let handleVaultWrite: typeof import('./vault').handleVaultWrite
  let home: string

  beforeEach(async () => {
    vi.resetModules()
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'penny-vault-'))
    vi.stubEnv('HOME', home)
    const v = await import('./vault')
    handleVaultRead = v.handleVaultRead
    handleVaultSearch = v.handleVaultSearch
    handleVaultWrite = v.handleVaultWrite
  })

  afterEach(() => {
    fs.rmSync(home, { recursive: true, force: true })
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('read returns file content from ~/sidekick', async () => {
    const dir = path.join(home, 'sidekick', 'Folder')
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'note.md'), 'hello body\n', 'utf8')

    const result = await handleVaultRead({ path: 'Folder/note.md' })
    expect(result.data?.content).toContain('hello body')
    expect(typeof result.data?.size).toBe('number')
    expect(result.summary).toMatch(/read/i)
  })

  it('search returns matching markdown lines', async () => {
    const dir = path.join(home, 'sidekick', 'Folder')
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'a.md'), 'firmware timing matters\n', 'utf8')

    const result = await handleVaultSearch({ query: 'firmware', limit: 5 })
    expect(result.data.length).toBe(1)
    expect(result.data[0].text.toLowerCase()).toContain('firmware')
    expect(result.data[0].path).toMatch(/a\.md$/)
  })

  it('write creates file and parent directories', async () => {
    const result = await handleVaultWrite({
      path: 'Folder/new.md',
      content: '# New',
    })
    expect(result.data.success).toBe(true)
    expect(result.data.path).toBe('Folder/new.md')
    const abs = path.join(home, 'sidekick', 'Folder', 'new.md')
    expect(fs.readFileSync(abs, 'utf8')).toBe('# New')
  })

  it('read returns null when file is missing', async () => {
    fs.mkdirSync(path.join(home, 'sidekick'), { recursive: true })
    const result = await handleVaultRead({ path: 'missing.md' })
    expect(result.data).toBeNull()
    expect(result.summary.toLowerCase()).toContain('not found')
  })
})
