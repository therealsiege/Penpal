import fs from 'fs'
import path from 'path'
import { execFile } from 'child_process'
import neo4j from 'neo4j-driver'
import { protocol, net } from 'electron'

const VAULT_ROOT = path.resolve(__dirname, '..', '..')
const MAX_PREVIEW_BYTES = 5 * 1024 * 1024 // 5MB

export interface VaultEntry {
  name: string
  isDirectory: boolean
  path: string
  size?: number
  mtime?: number
}

export interface VaultFileContent {
  content: string
  mtime: number
}

export interface VaultSearchResult {
  path: string
  line: number
  text: string
}

export interface VaultTag {
  name: string
  count: number
}

export interface VaultBacklink {
  title: string
  path: string
  snippet: string
}

// Directories to hide from the root listing (code/build noise)
const HIDDEN_ROOT_DIRS = new Set([
  'sidekick-electron', 'sidekick-graph', 'game-assets', 'tools',
  'node_modules', 'out', 'build', 'dist', '.obsidian',
])

function validatePath(relativePath: string): string {
  const resolved = path.resolve(VAULT_ROOT, relativePath)
  if (!resolved.startsWith(VAULT_ROOT)) {
    throw new Error('Path traversal denied')
  }
  return resolved
}

function getDriver() {
  const uri = process.env.MEMGRAPH_URI || 'bolt://localhost:7687'
  const user = process.env.MEMGRAPH_USER || ''
  const password = process.env.MEMGRAPH_PASSWORD || ''
  return user
    ? neo4j.driver(uri, neo4j.auth.basic(user, password))
    : neo4j.driver(uri)
}

// ── List directory ─────────────────────────────────────────────────────────

export function listVaultDir(relativePath: string): VaultEntry[] {
  const rel = typeof relativePath === 'string' ? relativePath : ''
  const fullPath = validatePath(rel)

  if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isDirectory()) return []

  const isRoot = rel === '' || rel === '.'
  const entries = fs.readdirSync(fullPath, { withFileTypes: true })
  return entries
    .filter(e => !e.name.startsWith('.'))
    .filter(e => !(isRoot && HIDDEN_ROOT_DIRS.has(e.name)))
    .map(e => {
      const entryPath = path.join(fullPath, e.name)
      let size: number | undefined
      let mtime: number | undefined
      try {
        const stat = fs.statSync(entryPath)
        size = stat.size
        mtime = stat.mtimeMs
      } catch { /* skip */ }
      return {
        name: e.name,
        isDirectory: e.isDirectory(),
        path: path.join(rel, e.name),
        size,
        mtime,
      }
    })
    .sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
      return a.name.localeCompare(b.name)
    })
}

// ── Read file ──────────────────────────────────────────────────────────────

export function readVaultFile(relativePath: string): VaultFileContent | null {
  if (typeof relativePath !== 'string') throw new Error('relativePath must be a string')
  const fullPath = validatePath(relativePath)

  if (!fs.existsSync(fullPath)) return null
  const stat = fs.statSync(fullPath)
  if (stat.isDirectory()) return null
  if (stat.size > MAX_PREVIEW_BYTES) {
    return { content: `[File too large: ${(stat.size / 1024 / 1024).toFixed(1)}MB]`, mtime: stat.mtimeMs }
  }

  return { content: fs.readFileSync(fullPath, 'utf-8'), mtime: stat.mtimeMs }
}

// ── Write file (atomic) ───────────────────────────────────────────────────

export function writeVaultFile(
  relativePath: string,
  content: string,
): { success: boolean; mtime: number; error?: string } {
  if (typeof relativePath !== 'string') throw new Error('relativePath must be a string')
  const fullPath = validatePath(relativePath)

  // Check parent directory exists
  const dir = path.dirname(fullPath)
  if (!fs.existsSync(dir)) {
    throw new Error('Parent directory does not exist')
  }

  // Atomic write: write to tmp, then rename
  const tmpPath = fullPath + '.sidekick-tmp'
  try {
    fs.writeFileSync(tmpPath, content, 'utf-8')
    fs.renameSync(tmpPath, fullPath)
    const stat = fs.statSync(fullPath)
    return { success: true, mtime: stat.mtimeMs }
  } catch (err) {
    // Clean up tmp file if rename failed
    try { fs.unlinkSync(tmpPath) } catch { /* ignore */ }
    throw err
  }
}

// ── Create file ───────────────────────────────────────────────────────────

export function createVaultFile(
  relativePath: string,
  content = '',
): { success: boolean; mtime: number } {
  if (typeof relativePath !== 'string') throw new Error('relativePath must be a string')
  const fullPath = validatePath(relativePath)

  if (fs.existsSync(fullPath)) {
    throw new Error('File already exists')
  }

  const dir = path.dirname(fullPath)
  fs.mkdirSync(dir, { recursive: true })

  const tmpPath = fullPath + '.sidekick-tmp'
  fs.writeFileSync(tmpPath, content, 'utf-8')
  fs.renameSync(tmpPath, fullPath)
  const stat = fs.statSync(fullPath)
  return { success: true, mtime: stat.mtimeMs }
}

// ── Create folder ─────────────────────────────────────────────────────────

export function createVaultFolder(relativePath: string): { success: boolean } {
  if (typeof relativePath !== 'string') throw new Error('relativePath must be a string')
  const fullPath = validatePath(relativePath)

  if (fs.existsSync(fullPath)) {
    throw new Error('Folder already exists')
  }

  fs.mkdirSync(fullPath, { recursive: true })
  return { success: true }
}

// ── Rename file/folder ────────────────────────────────────────────────────

export function renameVaultFile(
  oldRelPath: string,
  newRelPath: string,
): { success: boolean; mtime?: number } {
  if (typeof oldRelPath !== 'string' || typeof newRelPath !== 'string') {
    throw new Error('paths must be strings')
  }
  const oldFull = validatePath(oldRelPath)
  const newFull = validatePath(newRelPath)

  if (!fs.existsSync(oldFull)) throw new Error('Source does not exist')
  if (fs.existsSync(newFull)) throw new Error('Destination already exists')

  const newDir = path.dirname(newFull)
  fs.mkdirSync(newDir, { recursive: true })
  fs.renameSync(oldFull, newFull)

  try {
    const stat = fs.statSync(newFull)
    return { success: true, mtime: stat.mtimeMs }
  } catch {
    return { success: true }
  }
}

// ── Delete file/folder ────────────────────────────────────────────────────

export function deleteVaultFile(relativePath: string): { success: boolean } {
  if (typeof relativePath !== 'string') throw new Error('relativePath must be a string')
  const fullPath = validatePath(relativePath)

  if (!fs.existsSync(fullPath)) throw new Error('Path does not exist')

  const stat = fs.statSync(fullPath)
  if (stat.isDirectory()) {
    fs.rmSync(fullPath, { recursive: true })
  } else {
    fs.unlinkSync(fullPath)
  }
  return { success: true }
}

// ── Index vault (flat file list) ──────────────────────────────────────────

export interface VaultIndexEntry {
  path: string
  name: string
  title: string
  mtime: number
  size: number
  tags: string[]
}

export function indexVault(): VaultIndexEntry[] {
  const results: VaultIndexEntry[] = []

  function walk(dir: string, relDir: string) {
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch { return }

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue
      const fullPath = path.join(dir, entry.name)
      const relPath = relDir ? path.join(relDir, entry.name) : entry.name

      if (entry.isDirectory()) {
        if (HIDDEN_ROOT_DIRS.has(entry.name) && relDir === '') continue
        walk(fullPath, relPath)
      } else if (entry.name.endsWith('.md')) {
        try {
          const stat = fs.statSync(fullPath)
          // Extract title from first heading or filename
          const head = Buffer.alloc(512)
          const fd = fs.openSync(fullPath, 'r')
          const bytesRead = fs.readSync(fd, head, 0, 512, 0)
          fs.closeSync(fd)
          const snippet = head.toString('utf-8', 0, bytesRead)

          let title = entry.name.replace(/\.md$/, '')
          const headingMatch = snippet.match(/^#\s+(.+)$/m)
          if (headingMatch) title = headingMatch[1].trim()

          // Extract tags from frontmatter
          const tags: string[] = []
          const fmMatch = snippet.match(/^---\n([\s\S]*?)\n---/)
          if (fmMatch) {
            const tagLine = fmMatch[1].match(/tags:\s*\[([^\]]*)\]/)
            if (tagLine) {
              tags.push(...tagLine[1].split(',').map(t => t.trim().replace(/['"]/g, '')).filter(Boolean))
            }
          }

          results.push({ path: relPath, name: entry.name, title, mtime: stat.mtimeMs, size: stat.size, tags })
        } catch { /* skip unreadable */ }
      }
    }
  }

  walk(VAULT_ROOT, '')
  return results
}

// ── Search ─────────────────────────────────────────────────────────────────

export function searchVault(
  query: string,
  globPattern?: string,
  limit = 50,
): Promise<VaultSearchResult[]> {
  return new Promise((resolve) => {
    if (!query || query.trim().length === 0) {
      resolve([])
      return
    }

    // Sanitize: only allow basic search terms
    const sanitized = query.replace(/[^\w\s\-_.]/g, '').trim()
    if (!sanitized) {
      resolve([])
      return
    }

    // Try rg first, fall back to grep
    const args = ['-rn', '--max-count', '3', '-i', '-l']
    if (globPattern) {
      args.push('--include', globPattern)
    }
    // Exclude hidden dirs and node_modules
    args.push('--exclude-dir=.git', '--exclude-dir=node_modules', '--exclude-dir=.obsidian', '--exclude-dir=out', '--exclude-dir=build')
    args.push('--', sanitized, VAULT_ROOT)

    execFile('grep', args, { maxBuffer: 1024 * 1024, timeout: 10000 }, (err, stdout) => {
      if (err && !stdout) {
        resolve([])
        return
      }

      // grep -l gives file paths; now get snippets
      const files = stdout.trim().split('\n').filter(Boolean).slice(0, limit)
      const results: VaultSearchResult[] = []

      for (const file of files) {
        const rel = path.relative(VAULT_ROOT, file)
        results.push({ path: rel, line: 0, text: '' })
      }

      // Get context lines with a second pass
      if (results.length > 0) {
        const contextArgs = ['-rn', '-i', '--max-count', '1']
        contextArgs.push('--exclude-dir=.git', '--exclude-dir=node_modules', '--exclude-dir=.obsidian', '--exclude-dir=out', '--exclude-dir=build')
        if (globPattern) {
          contextArgs.push('--include', globPattern)
        }
        contextArgs.push('--', sanitized, VAULT_ROOT)

        execFile('grep', contextArgs, { maxBuffer: 1024 * 1024, timeout: 10000 }, (err2, stdout2) => {
          if (err2 && !stdout2) {
            resolve(results)
            return
          }

          const lineMap = new Map<string, { line: number; text: string }>()
          for (const line of stdout2.trim().split('\n').filter(Boolean)) {
            // Format: /path/to/file:linenum:text
            const firstColon = line.indexOf(':')
            const secondColon = line.indexOf(':', firstColon + 1)
            if (firstColon < 0 || secondColon < 0) continue
            const filePath = line.slice(0, firstColon)
            const lineNum = parseInt(line.slice(firstColon + 1, secondColon), 10)
            const text = line.slice(secondColon + 1).trim()
            const rel = path.relative(VAULT_ROOT, filePath)
            lineMap.set(rel, { line: lineNum, text: text.slice(0, 200) })
          }

          for (const r of results) {
            const match = lineMap.get(r.path)
            if (match) {
              r.line = match.line
              r.text = match.text
            }
          }

          resolve(results)
        })
      } else {
        resolve(results)
      }
    })
  })
}

// ── Resolve vault asset ───────────────────────────────────────────────────

export function resolveVaultAsset(filename: string): string | null {
  // Search for the file anywhere in the vault
  function find(dir: string): string | null {
    let entries: fs.Dirent[]
    try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return null }

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue
      const full = path.join(dir, entry.name)
      if (entry.isFile() && entry.name === filename) return full
      if (entry.isDirectory() && !HIDDEN_ROOT_DIRS.has(entry.name)) {
        const found = find(full)
        if (found) return found
      }
    }
    return null
  }

  return find(VAULT_ROOT)
}

// ── Register vault:// protocol ────────────────────────────────────────────

export function registerVaultProtocol() {
  protocol.handle('vault', (request) => {
    // vault://filename.png
    const filename = decodeURIComponent(request.url.replace('vault://', ''))
    const resolved = resolveVaultAsset(filename)
    if (!resolved) {
      return new Response('Not found', { status: 404 })
    }
    return net.fetch(`file://${resolved}`)
  })
}

// ── Tags from Memgraph ─────────────────────────────────────────────────────

export async function getVaultTags(): Promise<VaultTag[]> {
  const driver = getDriver()
  const session = driver.session()
  try {
    const result = await session.run(`
      MATCH (d:Document)-[:TAGGED_WITH]->(t:Tag)
      RETURN t.name AS name, count(d) AS cnt
      ORDER BY cnt DESC
      LIMIT 100
    `)
    return result.records.map(r => ({
      name: String(r.get('name') || ''),
      count: typeof r.get('cnt') === 'object' && 'toNumber' in (r.get('cnt') as object)
        ? (r.get('cnt') as { toNumber(): number }).toNumber()
        : Number(r.get('cnt')),
    }))
  } catch {
    return []
  } finally {
    await session.close()
    await driver.close()
  }
}

// ── Files by tag ───────────────────────────────────────────────────────────

export async function getFilesByTag(tag: string): Promise<string[]> {
  const driver = getDriver()
  const session = driver.session()
  try {
    const result = await session.run(
      `MATCH (d:Document)-[:TAGGED_WITH]->(t:Tag {name: $tag})
       RETURN d.path AS path
       ORDER BY d.path`,
      { tag },
    )
    return result.records.map(r => String(r.get('path') || ''))
  } catch {
    return []
  } finally {
    await session.close()
    await driver.close()
  }
}

// ── Backlinks ──────────────────────────────────────────────────────────────

export async function getBacklinks(relativePath: string): Promise<VaultBacklink[]> {
  const driver = getDriver()
  const session = driver.session()
  try {
    const result = await session.run(
      `MATCH (source:Document)-[:LINKS_TO]->(target:Document)
       WHERE target.path ENDS WITH $path
       RETURN source.title AS title, source.path AS path
       ORDER BY source.title
       LIMIT 30`,
      { path: relativePath },
    )
    return result.records.map(r => ({
      title: String(r.get('title') || ''),
      path: String(r.get('path') || ''),
      snippet: '',
    }))
  } catch {
    return []
  } finally {
    await session.close()
    await driver.close()
  }
}
