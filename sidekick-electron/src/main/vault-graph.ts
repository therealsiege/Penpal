// Graph data from filesystem (wikilink-based graph)
// Memgraph is not required — this builds a graph from wikilinks in markdown files

import fs from 'fs'
import path from 'path'

const HOME = process.env.HOME || '/Users/fuzeelogik'
const VAULT_ROOT = path.join(HOME, 'sidekick', 'Ventures')

interface GraphNode {
  id: string
  label: string
  type: string
  path?: string
}

interface GraphLink {
  source: string
  target: string
  type: string
}

export interface VaultGraphData {
  nodes: GraphNode[]
  links: GraphLink[]
}

const NODE_COLORS: Record<string, string> = {
  Document: '#3b82f6',
  Tag: '#22c55e',
  Folder: '#475569',
}

type GraphScope = 'full' | 'local' | 'tag'

export async function getVaultGraph(
  scope: GraphScope = 'full',
  centerPath?: string,
  maxNodes = 2000,
): Promise<VaultGraphData> {
  const nodes = new Map<string, GraphNode>()
  const links: GraphLink[] = []
  const wikilinksByFile = new Map<string, string[]>()
  const filesByName = new Map<string, string>() // basename -> relPath

  function walk(dir: string, relDir: string) {
    let entries: fs.Dirent[]
    try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return }
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue
      const full = path.join(dir, entry.name)
      const rel = relDir ? path.join(relDir, entry.name) : entry.name
      if (entry.isDirectory()) {
        walk(full, rel)
        continue
      }
      if (!entry.name.endsWith('.md')) continue
      const baseName = entry.name.replace(/\.md$/, '')
      filesByName.set(baseName.toLowerCase(), rel)

      try {
        const content = fs.readFileSync(full, 'utf-8').slice(0, 5000)
        const wikilinks: string[] = []
        const regex = /\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g
        let match
        while ((match = regex.exec(content)) !== null) {
          wikilinks.push(match[1].trim())
        }
        wikilinksByFile.set(rel, wikilinks)

        nodes.set(rel, {
          id: rel,
          label: baseName,
          type: 'Document',
          path: rel,
        })
      } catch { /* skip */ }
    }
  }

  walk(VAULT_ROOT, '')

  // Build links from wikilinks
  for (const [sourcePath, wikilinks] of wikilinksByFile) {
    for (const link of wikilinks) {
      const targetPath = filesByName.get(link.toLowerCase())
      if (targetPath && targetPath !== sourcePath) {
        links.push({ source: sourcePath, target: targetPath, type: 'LINKS_TO' })
      }
    }
  }

  if (scope === 'local' && centerPath) {
    // 2-hop neighborhood from center
    const hop1 = new Set<string>()
    hop1.add(centerPath)
    for (const l of links) {
      if (l.source === centerPath) hop1.add(l.target)
      if (l.target === centerPath) hop1.add(l.source)
    }
    const hop2 = new Set(hop1)
    for (const l of links) {
      if (hop1.has(l.source)) hop2.add(l.target)
      if (hop1.has(l.target)) hop2.add(l.source)
    }
    const filteredNodes = Array.from(nodes.values()).filter(n => hop2.has(n.id)).slice(0, maxNodes)
    const nodeIds = new Set(filteredNodes.map(n => n.id))
    return {
      nodes: filteredNodes,
      links: links.filter(l => nodeIds.has(l.source) && nodeIds.has(l.target)),
    }
  }

  if (scope === 'tag') {
    // Show only files that have tags, connected to tag nodes
    const tagNodes: GraphNode[] = []
    const tagLinks: GraphLink[] = []
    const seenTags = new Map<string, string>() // tag -> nodeId

    for (const [rel] of wikilinksByFile) {
      const full = path.join(VAULT_ROOT, rel)
      try {
        const content = fs.readFileSync(full, 'utf-8').slice(0, 3000)
        const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n?/)
        const fileTags: string[] = []
        if (fmMatch) {
          const tagLine = fmMatch[1].match(/tags:\s*\[([^\]]*)\]/)
          if (tagLine) {
            tagLine[1].split(',').map(t => t.replace(/['"]/g, '').trim()).filter(Boolean)
              .forEach(t => fileTags.push(t))
          }
        }
        if (fileTags.length > 0) {
          for (const tag of fileTags) {
            const tagId = `tag:${tag}`
            if (!seenTags.has(tag)) {
              seenTags.set(tag, tagId)
              tagNodes.push({ id: tagId, label: tag, type: 'Tag' })
            }
            tagLinks.push({ source: rel, target: tagId, type: 'TAGGED_WITH' })
          }
        }
      } catch { /* skip */ }
    }

    const docNodes = Array.from(nodes.values())
      .filter(n => tagLinks.some(l => l.source === n.id))
      .slice(0, maxNodes - tagNodes.length)
    const allNodes = [...docNodes, ...tagNodes].slice(0, maxNodes)
    const nodeIds = new Set(allNodes.map(n => n.id))
    return {
      nodes: allNodes,
      links: tagLinks.filter(l => nodeIds.has(l.source) && nodeIds.has(l.target)),
    }
  }

  // Full graph
  const nodeArray = Array.from(nodes.values()).slice(0, maxNodes)
  const nodeIds = new Set(nodeArray.map(n => n.id))
  return {
    nodes: nodeArray,
    links: links.filter(l => nodeIds.has(l.source) && nodeIds.has(l.target)),
  }
}
