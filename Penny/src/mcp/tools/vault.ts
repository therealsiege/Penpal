/**
 * MCP tools: vault:read, vault:search, vault:write
 *
 * Exposes vault (Obsidian) capabilities so agents can read,
 * search, and write files in the knowledge base.
 */

import fs from 'fs'
import fsp from 'fs/promises'
import path from 'path'
import os from 'os'
import { toolRegistry } from '../tools.js'
import { wrapResponse, type ContextEngineeredResponse } from '../response.js'

// ── Vault root ───────────────────────────────────────────────────────────────

const VAULT_ROOT = path.join(os.homedir(), 'sidekick')

function safePath(relativePath: string): string {
  const resolved = path.resolve(VAULT_ROOT, relativePath)
  if (!resolved.startsWith(VAULT_ROOT)) {
    throw new Error('Path traversal detected — must stay within vault root.')
  }
  return resolved
}

// ── Exported handler functions ───────────────────────────────────────────────

export async function handleVaultRead(params: {
  path: string
}): Promise<ContextEngineeredResponse<{ content: string; size: number } | null>> {
  const filePath = safePath(params.path)

  try {
    const stat = await fsp.stat(filePath)
    if (stat.isDirectory()) {
      const entries = await fsp.readdir(filePath)
      const listing = entries.slice(0, 50).join('\n')
      return wrapResponse(
        { content: listing, size: entries.length },
        `Directory with ${entries.length} entries.`,
        ['Use vault:read with a specific file path to read contents.'],
        ['vault:search', 'vault:write'],
      )
    }

    const content = await fsp.readFile(filePath, 'utf-8')
    const summary = `Read ${params.path} (${content.length} chars).`

    const suggestions: string[] = []
    if (content.includes('[[')) suggestions.push('File contains wiki-links — use vault:search to find linked notes.')
    if (params.path.endsWith('.md')) suggestions.push('Markdown file — editable via vault:write.')

    return wrapResponse({ content, size: content.length }, summary, suggestions, ['vault:search', 'vault:write'])
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return wrapResponse(null, 'File not found.', ['Check path and try vault:search to find files.'], ['vault:search'])
    }
    throw err
  }
}

export async function handleVaultSearch(params: {
  query: string
  glob?: string
  limit?: number
}): Promise<ContextEngineeredResponse<{ path: string; line: number; text: string }[]>> {
  const limit = params.limit ?? 20
  const results: { path: string; line: number; text: string }[] = []
  const query = params.query.toLowerCase()

  async function searchDir(dir: string): Promise<void> {
    if (results.length >= limit) return
    const entries = await fsp.readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (results.length >= limit) return
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue

      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        await searchDir(fullPath)
      } else if (entry.name.endsWith('.md')) {
        if (params.glob && !entry.name.includes(params.glob.replace(/\*/g, ''))) continue
        try {
          const content = await fsp.readFile(fullPath, 'utf-8')
          const lines = content.split('\n')
          for (let i = 0; i < lines.length; i++) {
            if (results.length >= limit) return
            if (lines[i].toLowerCase().includes(query)) {
              results.push({
                path: path.relative(VAULT_ROOT, fullPath),
                line: i + 1,
                text: lines[i].trim().slice(0, 200),
              })
            }
          }
        } catch { /* skip unreadable */ }
      }
    }
  }

  await searchDir(VAULT_ROOT)

  const summary = `Found ${results.length} result(s) for "${params.query}"${results.length >= limit ? ' (limit reached)' : ''}.`

  const suggestions: string[] = []
  if (results.length === 0) suggestions.push('No results — try a broader query or different keywords.')
  if (results.length >= limit) suggestions.push(`Showing first ${limit} results — narrow your query for more specific results.`)
  if (results.length > 0) suggestions.push(`Use vault:read to view full content of matched files.`)

  return wrapResponse(results, summary, suggestions, ['vault:read', 'vault:write'])
}

export async function handleVaultWrite(params: {
  path: string
  content: string
}): Promise<ContextEngineeredResponse<{ success: boolean; path: string }>> {
  const filePath = safePath(params.path)

  const dir = path.dirname(filePath)
  await fsp.mkdir(dir, { recursive: true })
  await fsp.writeFile(filePath, params.content, 'utf-8')

  const summary = `Wrote ${params.content.length} chars to ${params.path}.`
  return wrapResponse(
    { success: true, path: params.path },
    summary,
    ['Use vault:read to verify the written content.'],
    ['vault:read', 'vault:search'],
  )
}

// ── MCP Tool Registration ───────────────────────────────────────────────────

toolRegistry.register({
  name: 'vault:read',
  description: 'Read a file from the Obsidian vault (~/sidekick). Supports markdown files and directories.',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Relative path from vault root (e.g., "Ventures/1Putt/MedScrub KB/README.md")' },
    },
    required: ['path'],
    additionalProperties: false,
  },
  handler: async (params) => handleVaultRead(params as { path: string }),
})

toolRegistry.register({
  name: 'vault:search',
  description: 'Full-text search across vault markdown files. Returns matching lines with file paths.',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query (case-insensitive)' },
      glob: { type: 'string', description: 'Optional filename filter (e.g., "Lead" to match files containing "Lead")' },
      limit: { type: 'number', description: 'Max results to return (default 20)' },
    },
    required: ['query'],
    additionalProperties: false,
  },
  handler: async (params) => handleVaultSearch(params as { query: string; glob?: string; limit?: number }),
})

toolRegistry.register({
  name: 'vault:write',
  description: 'Write or update a file in the Obsidian vault. Creates parent directories if needed.',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Relative path from vault root' },
      content: { type: 'string', description: 'File content to write' },
    },
    required: ['path', 'content'],
    additionalProperties: false,
  },
  handler: async (params) => handleVaultWrite(params as { path: string; content: string }),
})
