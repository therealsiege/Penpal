import fs from 'fs'
import path from 'path'
import MiniSearch from 'minisearch'
import { DOCS_ROOT } from './paths'

const VAULT_ROOT = DOCS_ROOT
const HIDDEN_ROOT_DIRS = new Set([
  'node_modules', '.obsidian', '.git', '.trash',
])

interface IndexDoc {
  id: string
  path: string
  title: string
  body: string
  tags: string
  folder: string
}

export interface SearchResult {
  path: string
  title: string
  snippet: string
  score: number
}

let miniSearch: MiniSearch<IndexDoc> | null = null
let indexedCount = 0

function extractFromMarkdown(content: string): { title: string; body: string; tags: string } {
  let body = content
  let title = ''
  let tags = ''

  // Extract frontmatter
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n?/)
  if (fmMatch) {
    body = content.slice(fmMatch[0].length)
    const fm = fmMatch[1]
    const titleMatch = fm.match(/title:\s*["']?(.+?)["']?\s*$/m)
    if (titleMatch) title = titleMatch[1]
    const tagMatch = fm.match(/tags:\s*\[([^\]]*)\]/)
    if (tagMatch) tags = tagMatch[1].replace(/['"]/g, '')
  }

  // Extract title from first heading if not in frontmatter
  if (!title) {
    const headingMatch = body.match(/^#\s+(.+)$/m)
    if (headingMatch) title = headingMatch[1].trim()
  }

  return { title, body: body.slice(0, 5000), tags }
}

export function buildSearchIndex(): number {
  miniSearch = new MiniSearch<IndexDoc>({
    fields: ['title', 'body', 'tags', 'folder', 'path'],
    storeFields: ['path', 'title'],
    idField: 'id',
    searchOptions: {
      boost: { title: 5, tags: 3, folder: 1, body: 1 },
      fuzzy: 0.2,
      prefix: true,
    },
  })

  const docs: IndexDoc[] = []

  function walk(dir: string, relDir: string) {
    let entries: fs.Dirent[]
    try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return }

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue
      const fullPath = path.join(dir, entry.name)
      const relPath = relDir ? path.join(relDir, entry.name) : entry.name

      if (entry.isDirectory()) {
        if (HIDDEN_ROOT_DIRS.has(entry.name) && relDir === '') continue
        walk(fullPath, relPath)
      } else if (entry.name.endsWith('.md')) {
        try {
          const content = fs.readFileSync(fullPath, 'utf-8')
          const { title, body, tags } = extractFromMarkdown(content)
          const folder = relDir || ''
          docs.push({
            id: relPath,
            path: relPath,
            title: title || entry.name.replace(/\.md$/, ''),
            body,
            tags,
            folder,
          })
        } catch { /* skip */ }
      }
    }
  }

  walk(VAULT_ROOT, '')
  miniSearch.addAll(docs)
  indexedCount = docs.length
  return docs.length
}

export function searchIndexed(query: string, limit = 30): SearchResult[] {
  if (!miniSearch || !query.trim()) return []

  const results = miniSearch.search(query, { limit })
  const queryTerms = query.toLowerCase().split(/\s+/).filter(Boolean)

  return results.map(r => {
    const doc = r as unknown as { path: string; title: string; score: number }

    let snippet = ''
    try {
      const fullPath = path.join(VAULT_ROOT, doc.path)
      const content = fs.readFileSync(fullPath, 'utf-8').slice(0, 2000)
      const contentLower = content.toLowerCase()

      let bestIdx = -1
      for (const term of queryTerms) {
        const idx = contentLower.indexOf(term)
        if (idx !== -1) {
          bestIdx = idx
          break
        }
      }

      if (bestIdx !== -1) {
        const start = Math.max(0, bestIdx - 40)
        const end = Math.min(content.length, bestIdx + 80)
        snippet = (start > 0 ? '...' : '') + content.slice(start, end).replace(/\n/g, ' ').trim() + (end < content.length ? '...' : '')
      } else {
        snippet = content.slice(0, 120).replace(/\n/g, ' ').trim() + (content.length > 120 ? '...' : '')
      }
    } catch {
      if (r.terms && r.terms.length > 0) {
        snippet = r.terms.join(', ')
      }
    }

    return {
      path: doc.path,
      title: doc.title,
      snippet,
      score: r.score,
    }
  })
}

export function getIndexedCount(): number {
  return indexedCount
}

export function reindexFile(relativePath: string) {
  if (!miniSearch) return
  const fullPath = path.join(VAULT_ROOT, relativePath)

  // Remove old entry
  try { miniSearch.discard(relativePath) } catch { /* not indexed */ }

  // Re-add if file exists
  if (fs.existsSync(fullPath) && relativePath.endsWith('.md')) {
    try {
      const content = fs.readFileSync(fullPath, 'utf-8')
      const { title, body, tags } = extractFromMarkdown(content)
      const folder = path.dirname(relativePath)
      miniSearch.add({
        id: relativePath,
        path: relativePath,
        title: title || path.basename(relativePath, '.md'),
        body,
        tags,
        folder,
      })
    } catch { /* skip */ }
  }
}
