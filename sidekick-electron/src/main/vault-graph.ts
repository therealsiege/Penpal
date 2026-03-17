import neo4j from 'neo4j-driver'

function getDriver() {
  const uri = process.env.MEMGRAPH_URI || 'bolt://localhost:7687'
  const user = process.env.MEMGRAPH_USER || ''
  const password = process.env.MEMGRAPH_PASSWORD || ''
  return user
    ? neo4j.driver(uri, neo4j.auth.basic(user, password))
    : neo4j.driver(uri)
}

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
  Person: '#f97316',
  Company: '#a855f7',
  Technology: '#06b6d4',
  EHRSystem: '#ec4899',
  Lead: '#eab308',
  Territory: '#64748b',
  Folder: '#475569',
}

type GraphScope = 'full' | 'local' | 'tag'

export async function getVaultGraph(
  scope: GraphScope = 'full',
  centerPath?: string,
  maxNodes = 2000,
): Promise<VaultGraphData> {
  const driver = getDriver()
  const session = driver.session()
  const nodes = new Map<string, GraphNode>()
  const links: GraphLink[] = []

  try {
    let query: string
    let params: Record<string, unknown> = {}

    if (scope === 'local' && centerPath) {
      // 2-hop neighborhood from center node
      query = `
        MATCH (center:Document) WHERE center.path ENDS WITH $path
        OPTIONAL MATCH path = (center)-[*1..2]-(neighbor)
        WITH center, collect(DISTINCT neighbor) AS neighbors
        UNWIND ([center] + neighbors) AS n
        WITH collect(DISTINCT n) AS allNodes
        UNWIND allNodes AS n
        OPTIONAL MATCH (n)-[r]-(m) WHERE m IN allNodes
        RETURN DISTINCT
          labels(n)[0] AS nType, n.name AS nName, n.title AS nTitle, n.path AS nPath, id(n) AS nId,
          labels(m)[0] AS mType, m.name AS mName, m.title AS mTitle, m.path AS mPath, id(m) AS mId,
          type(r) AS rType
        LIMIT ${maxNodes * 3}
      `
      params = { path: centerPath }
    } else if (scope === 'tag') {
      query = `
        MATCH (d:Document)-[r:TAGGED_WITH]->(t:Tag)
        RETURN DISTINCT
          'Document' AS nType, d.title AS nName, d.title AS nTitle, d.path AS nPath, id(d) AS nId,
          'Tag' AS mType, t.name AS mName, t.name AS mTitle, '' AS mPath, id(t) AS mId,
          'TAGGED_WITH' AS rType
        LIMIT ${maxNodes * 2}
      `
    } else {
      // Full graph — get nodes + relationships
      query = `
        MATCH (n)-[r]->(m)
        RETURN DISTINCT
          labels(n)[0] AS nType, n.name AS nName, n.title AS nTitle, n.path AS nPath, id(n) AS nId,
          labels(m)[0] AS mType, m.name AS mName, m.title AS mTitle, m.path AS mPath, id(m) AS mId,
          type(r) AS rType
        LIMIT ${maxNodes * 3}
      `
    }

    const result = await session.run(query, params)

    for (const record of result.records) {
      const nId = String(record.get('nId'))
      const mId = record.get('mId') ? String(record.get('mId')) : null
      const rType = record.get('rType')

      if (!nodes.has(nId)) {
        nodes.set(nId, {
          id: nId,
          label: String(record.get('nTitle') || record.get('nName') || nId),
          type: String(record.get('nType') || 'Unknown'),
          path: record.get('nPath') ? String(record.get('nPath')) : undefined,
        })
      }

      if (mId && !nodes.has(mId)) {
        nodes.set(mId, {
          id: mId,
          label: String(record.get('mTitle') || record.get('mName') || mId),
          type: String(record.get('mType') || 'Unknown'),
          path: record.get('mPath') ? String(record.get('mPath')) : undefined,
        })
      }

      if (mId && rType) {
        links.push({
          source: nId,
          target: mId,
          type: String(rType),
        })
      }
    }

    // Cap nodes
    const nodeArray = Array.from(nodes.values()).slice(0, maxNodes)
    const nodeIds = new Set(nodeArray.map(n => n.id))
    const filteredLinks = links.filter(l => nodeIds.has(l.source) && nodeIds.has(l.target))

    return { nodes: nodeArray, links: filteredLinks }
  } catch (err) {
    console.error('[vault-graph]', err)
    return { nodes: [], links: [] }
  } finally {
    await session.close()
    await driver.close()
  }
}
