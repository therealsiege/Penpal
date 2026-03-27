/**
 * MCP tools: graph:search-leads, graph:lead-detail, graph:stats
 *
 * Exposes Memgraph knowledge graph capabilities so agents can
 * query leads, view details, and check graph statistics.
 */

import path from 'path'
import { toolRegistry } from '../tools.js'
import { wrapResponse, type ContextEngineeredResponse } from '../response.js'

// ── Neo4j driver (lazy) ──────────────────────────────────────────────────────

let _driver: import('neo4j-driver').Driver | null = null

async function getDriver(): Promise<import('neo4j-driver').Driver> {
  if (_driver) return _driver

  // Load env from analytics/.env
  const dotenv = await import('dotenv')
  const envPath = path.resolve(__dirname, '..', '..', '..', '..', 'analytics', '.env')
  dotenv.config({ path: envPath })

  const neo4j = await import('neo4j-driver')
  const uri = process.env.MEMGRAPH_URI || 'bolt://localhost:7687'
  _driver = neo4j.default.driver(uri)
  return _driver
}

async function runCypher<T = Record<string, unknown>>(query: string, params?: Record<string, unknown>): Promise<T[]> {
  const driver = await getDriver()
  const session = driver.session()
  try {
    const result = await session.run(query, params)
    return result.records.map(r => r.toObject() as T)
  } finally {
    await session.close()
  }
}

// ── Exported handler functions ───────────────────────────────────────────────

export async function handleSearchLeads(params: {
  query: string
  limit?: number
}): Promise<ContextEngineeredResponse<unknown[]>> {
  try {
    const limit = params.limit ?? 20
    const results = await runCypher(
      `MATCH (l:Lead)
       WHERE toLower(l.name) CONTAINS toLower($query)
          OR toLower(l.company) CONTAINS toLower($query)
       RETURN l.name AS name, l.company AS company, l.score AS score,
              l.businessArm AS businessArm, l.stage AS stage, l.ehr AS ehr
       ORDER BY l.score DESC
       LIMIT $limit`,
      { query: params.query, limit },
    )

    const summary = `Found ${results.length} lead(s) matching "${params.query}".`
    const suggestions: string[] = []
    if (results.length > 0) suggestions.push('Use graph:lead-detail for full lead information.')
    if (results.length === 0) suggestions.push('No results — try broader keywords or check graph:stats for data availability.')
    if (results.length >= limit) suggestions.push('Results capped — narrow your search for more specific results.')

    return wrapResponse(results, summary, suggestions, ['graph:lead-detail', 'graph:stats'])
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return wrapResponse(
      [],
      `Graph query failed: ${message.slice(0, 200)}`,
      ['Ensure Memgraph is running (bolt://localhost:7687).', 'Check graph:stats for connectivity.'],
      ['graph:stats'],
    )
  }
}

export async function handleLeadDetail(params: {
  name: string
}): Promise<ContextEngineeredResponse<unknown | null>> {
  try {
    const results = await runCypher(
      `MATCH (l:Lead {name: $name})
       OPTIONAL MATCH (l)-[:WORKS_AT]->(c:Company)
       OPTIONAL MATCH (l)-[:USES_EHR]->(e:EHRSystem)
       OPTIONAL MATCH (l)-[:LOCATED_IN]->(t:Territory)
       OPTIONAL MATCH (l)-[:CURRENT_STAGE]->(s:SalesStage)
       OPTIONAL MATCH (l)-[:HAD_EVENT]->(ev)
       RETURN l, c.name AS company, e.name AS ehr, t.name AS territory,
              s.name AS stage, collect(DISTINCT {type: ev.type, date: ev.date, detail: ev.detail}) AS events
       LIMIT 1`,
      { name: params.name },
    )

    if (results.length === 0) {
      return wrapResponse(null, 'Lead not found.', ['Use graph:search-leads to find available leads.'], ['graph:search-leads'])
    }

    const lead = results[0]
    const summary = `Lead detail for "${params.name}".`
    return wrapResponse(lead, summary, ['Review events and plan next action.'], ['graph:search-leads', 'graph:stats'])
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return wrapResponse(null, `Graph query failed: ${message.slice(0, 200)}`, ['Ensure Memgraph is running.'], ['graph:stats'])
  }
}

export async function handleGraphStats(): Promise<ContextEngineeredResponse<unknown>> {
  try {
    const nodeResults = await runCypher<{ label: string; count: number }>(
      `MATCH (n) UNWIND labels(n) AS label RETURN label, count(*) AS count ORDER BY count DESC`,
    )
    const relResults = await runCypher<{ type: string; count: number }>(
      `MATCH ()-[r]->() RETURN type(r) AS type, count(*) AS count ORDER BY count DESC`,
    )

    const totalNodes = nodeResults.reduce((sum, r) => sum + Number(r.count), 0)
    const totalRels = relResults.reduce((sum, r) => sum + Number(r.count), 0)

    const nodesByLabel: Record<string, number> = {}
    for (const r of nodeResults) nodesByLabel[r.label] = Number(r.count)

    const relsByType: Record<string, number> = {}
    for (const r of relResults) relsByType[r.type] = Number(r.count)

    const data = { totalNodes, totalRelationships: totalRels, nodesByLabel, relsByType }
    const summary = `Graph has ${totalNodes} nodes and ${totalRels} relationships across ${nodeResults.length} labels.`

    const suggestions: string[] = []
    const leadCount = nodesByLabel['Lead'] ?? 0
    if (leadCount > 0) suggestions.push(`${leadCount} Lead nodes — search via graph:search-leads.`)
    if (totalNodes === 0) suggestions.push('Graph is empty — run ETL to populate data.')
    if (leadCount > 0 && !(nodesByLabel['Company'])) suggestions.push('No Company nodes — consider enrichment via NPI or web intel.')

    return wrapResponse(data, summary, suggestions, ['graph:search-leads', 'graph:lead-detail'])
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return wrapResponse(
      { totalNodes: 0, totalRelationships: 0, nodesByLabel: {}, relsByType: {} },
      `Graph unavailable: ${message.slice(0, 200)}`,
      ['Ensure Memgraph is running on bolt://localhost:7687.'],
      [],
    )
  }
}

// ── MCP Tool Registration ───────────────────────────────────────────────────

toolRegistry.register({
  name: 'graph:search-leads',
  description: 'Search for leads in the Memgraph knowledge graph by name or company.',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search term (name or company, case-insensitive)' },
      limit: { type: 'number', description: 'Max results (default 20)' },
    },
    required: ['query'],
    additionalProperties: false,
  },
  handler: async (params) => handleSearchLeads(params as { query: string; limit?: number }),
})

toolRegistry.register({
  name: 'graph:lead-detail',
  description: 'Get full details for a specific lead including relationships, events, and sales stage.',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Exact lead name' },
    },
    required: ['name'],
    additionalProperties: false,
  },
  handler: async (params) => handleLeadDetail(params as { name: string }),
})

toolRegistry.register({
  name: 'graph:stats',
  description: 'Get knowledge graph statistics: node counts by label, relationship counts by type.',
  inputSchema: {
    type: 'object',
    properties: {},
    additionalProperties: false,
  },
  handler: async () => handleGraphStats(),
})
