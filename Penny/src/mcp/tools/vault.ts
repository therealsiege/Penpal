/**
 * MCP tools: vault:read, vault:search, vault:write
 */

import fsp from 'fs/promises'
import path from 'path'
import { toolRegistry } from '../tools.js'
import { wrapResponse, type ContextEngineeredResponse } from '../response.js'
import { DOCS_ROOT } from '../../main/paths.js'
import {
  readVaultFile,
  searchVault,
  createVaultFile,
  writeVaultFile,
  parseMarkdownFrontmatter,
  extractTagsFromMarkdown,
  getFolderHierarchy,
  getVaultFileContext,
} from '../../main/vault.js'

/** Same root as main-process vault I/O (see paths.ts / VAULT_PATH / SIDEKICK_DOCS_ROOT). */
const VAULT_ROOT = DOCS_ROOT

function safePath(relativePath: string): string {
  const resolved = path.resolve(VAULT_ROOT, relativePath)
  if (!resolved.startsWith(VAULT_ROOT)) throw new Error('Path traversal detected — must stay within vault root.')
  return resolved
}

function normalizeRelativePath(input: string): string {
  const absolute = safePath(input).replace(/\\/g, '/')
  const root = `${VAULT_ROOT.replace(/\\/g, '/')}/`
  return absolute.startsWith(root) ? absolute.slice(root.length) : input
}

export async function handleVaultRead(params: {
  path: string
}): Promise<ContextEngineeredResponse<{
  path: string
  content: string
  frontmatter: Record<string, unknown> | null
  backlinks: Array<{ title: string; path: string; snippet: string }>
  relatedFiles: string[]
  folderContext: string[]
  tagContext: string[]
  mtime: number
} | null>> {
  const relativePath = normalizeRelativePath(params.path)
  const file = readVaultFile(relativePath)
  if (!file) {
    return wrapResponse(null, 'File not found.', ['Check path and try vault:search to find files.'], ['vault:search'])
  }
  const context = await getVaultFileContext(relativePath)
  return wrapResponse(
    {
      path: relativePath,
      content: file.content,
      frontmatter: parseMarkdownFrontmatter(file.content),
      backlinks: context.backlinks,
      relatedFiles: context.relatedFiles,
      folderContext: context.folderContext,
      tagContext: context.tagContext,
      mtime: file.mtime,
    },
    `Read ${relativePath} with context-rich metadata.`,
    ['Response includes backlinks, folder context, and related files.'],
    ['vault:search', 'vault:write'],
  )
}

export async function handleVaultSearch(params: {
  query: string
  limit?: number
}): Promise<ContextEngineeredResponse<Array<{
  path: string
  snippet: string
  score: number
  tags: string[]
  folderHierarchy: string[]
  relatedFiles: string[]
}>>> {
  const limit = Math.max(1, Math.min(params.limit ?? 20, 50))
  const raw = await searchVault(params.query, undefined, limit * 3)
  const loweredQuery = params.query.toLowerCase()
  const scored = await Promise.all(raw.map(async (match) => {
    const file = readVaultFile(match.path)
    const frontmatter = file ? parseMarkdownFrontmatter(file.content) : null
    const tags = file ? extractTagsFromMarkdown(file.content, frontmatter) : []
    const context = await getVaultFileContext(match.path)
    let score = match.occurrences
    if (path.basename(match.path, '.md').toLowerCase().includes(loweredQuery)) score += 5
    if (match.snippet.toLowerCase().includes(loweredQuery)) score += 3
    if (tags.some((tag) => tag.toLowerCase().includes(loweredQuery))) score += 2
    return {
      path: match.path,
      snippet: match.snippet,
      score: Number(score.toFixed(2)),
      tags,
      folderHierarchy: getFolderHierarchy(match.path),
      relatedFiles: context.relatedFiles.slice(0, 12),
    }
  }))
  const results = scored.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path)).slice(0, limit)
  return wrapResponse(
    results,
    `Found ${results.length} ranked result(s) for "${params.query}".`,
    [results.length === 0 ? 'No matches found; try broader terms.' : 'Results include snippets, score, tags, and related context.'],
    ['vault:read', 'vault:write'],
  )
}

export async function handleVaultWrite(params: {
  path: string
  content: string
  createIfMissing?: boolean
}): Promise<ContextEngineeredResponse<{
  success: boolean
  path: string
  created: boolean
  mtime: number | null
  backlinks: Array<{ title: string; path: string; snippet: string }>
  relatedFiles: string[]
}>> {
  const relativePath = normalizeRelativePath(params.path)
  const fullPath = safePath(relativePath)
  const exists = await fsp.stat(fullPath).then(() => true).catch(() => false)
  if (!exists && !params.createIfMissing) {
    return wrapResponse(
      { success: false, path: relativePath, created: false, mtime: null, backlinks: [], relatedFiles: [] },
      'Write failed: target file does not exist.',
      ['Set createIfMissing=true to create a new file.'],
      ['vault:read', 'vault:search'],
    )
  }

  if (!exists && params.createIfMissing) {
    const created = createVaultFile(relativePath, params.content)
    const context = await getVaultFileContext(relativePath)
    return wrapResponse(
      {
        success: true,
        path: relativePath,
        created: true,
        mtime: created.mtime,
        backlinks: context.backlinks,
        relatedFiles: context.relatedFiles,
      },
      `Created ${relativePath}.`,
      ['File created and context refreshed.'],
      ['vault:read', 'vault:search'],
    )
  }

  const updated = writeVaultFile(relativePath, params.content)
  const context = await getVaultFileContext(relativePath)
  return wrapResponse(
    {
      success: true,
      path: relativePath,
      created: false,
      mtime: updated.mtime,
      backlinks: context.backlinks,
      relatedFiles: context.relatedFiles,
    },
    `Updated ${relativePath}.`,
    ['Use vault:read to verify content.'],
    ['vault:read', 'vault:search'],
  )
}

toolRegistry.register({
  name: 'vault:read',
  description: 'Read a vault file and return content, frontmatter, backlinks, and related context.',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Relative path from vault root' },
    },
    required: ['path'],
    additionalProperties: false,
  },
  handler: async (params) => handleVaultRead(params as { path: string }),
})

toolRegistry.register({
  name: 'vault:search',
  description: 'Search vault notes and return ranked snippets with score, tags, and folder context.',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query text' },
      limit: { type: 'number', description: 'Max results (default 20, max 50)' },
    },
    required: ['query'],
    additionalProperties: false,
  },
  handler: async (params) => handleVaultSearch(params as { query: string; limit?: number }),
})

toolRegistry.register({
  name: 'vault:write',
  description: 'Write to a vault file; optionally create missing files safely.',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Relative path from vault root' },
      content: { type: 'string', description: 'File content to write' },
      createIfMissing: { type: 'boolean', description: 'Create file and parent directories if missing' },
    },
    required: ['path', 'content'],
    additionalProperties: false,
  },
  handler: async (params) => handleVaultWrite(params as { path: string; content: string; createIfMissing?: boolean }),
})
