import { toolRegistry } from '../tools.js'
import { wrapResponse, type ContextEngineeredResponse } from '../response.js'
import { searchLeads, getLeadDetail, getGraphStats, type LeadSearchFilters } from '../../main/graph.js'

// ── Exported handler functions ───────────────────────────────────────────────

export async function handleSearchLeads(params: {
  query: string
  filters?: LeadSearchFilters
}): Promise<ContextEngineeredResponse<unknown[]>> {
  try {
    const results = await searchLeads(params.query, params.filters || {})
    const summary = `Found ${results.length} lead(s) for "${params.query}"${params.filters?.state ? ` in ${params.filters.state}` : ''}.`
    const suggestions: string[] = []
    if (results.length > 0) suggestions.push('Open top result with graph:lead-detail to get relationship context and next actions.')
    if (results.length === 0) suggestions.push('No matches found; broaden query terms or validate graph freshness via graph:stats.')
    if (params.filters && Object.values(params.filters).some(Boolean)) suggestions.push('Relax filters to widen candidate coverage.')

    return wrapResponse(results, summary, suggestions, ['graph:lead-detail', 'graph:stats', 'orchestrator:enqueue'])
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
  leadId: string
}): Promise<ContextEngineeredResponse<unknown | null>> {
  try {
    const detail = await getLeadDetail(params.leadId)
    if (!detail) {
      return wrapResponse(null, 'Lead not found.', ['Use graph:search-leads to find available leads.'], ['graph:search-leads'])
    }

    const summary = `${detail.name} at ${detail.company} is in ${detail.stage || 'unknown'} stage with score ${detail.score}.`
    const suggestions = detail.suggestedNextActions.length > 0
      ? detail.suggestedNextActions.slice(0, 3)
      : ['Review relationship graph and define immediate next step.']
    return wrapResponse(detail, summary, suggestions, ['graph:search-leads', 'graph:stats', 'vault:search'])
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return wrapResponse(null, `Graph query failed: ${message.slice(0, 200)}`, ['Ensure Memgraph is running.'], ['graph:stats'])
  }
}

export async function handleGraphStats(): Promise<ContextEngineeredResponse<unknown>> {
  try {
    const data = await getGraphStats()
    const summary = data.available
      ? `Graph has ${data.totalNodes} nodes and ${data.totalRelationships} relationships (${data.freshness.staleness} data).`
      : `Graph unavailable: ${data.error?.slice(0, 120) || 'connectivity error'}.`

    const suggestions: string[] = []
    const leadCount = data.nodesByLabel['Lead'] ?? 0
    if (leadCount > 0) suggestions.push(`${leadCount} Lead nodes — search via graph:search-leads.`)
    if (data.totalNodes === 0 && data.available) suggestions.push('Graph is empty — run ETL to populate data.')
    if (!data.available) suggestions.push(...(data.remediation || ['Ensure Memgraph is running on bolt://localhost:7687.']))

    return wrapResponse(data, summary, suggestions, ['graph:search-leads', 'graph:lead-detail', 'meta:list-tools'])
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return wrapResponse(
      { totalNodes: 0, totalRelationships: 0, nodesByLabel: {}, relsByType: {}, freshness: { latestEtlRunAt: null, etlSource: null, etlStatus: null, ageMinutes: null, staleness: 'unknown' }, available: false },
      `Graph unavailable: ${message.slice(0, 200)}`,
      ['Ensure Memgraph is running on bolt://localhost:7687.'],
      [],
    )
  }
}

// ── MCP Tool Registration ───────────────────────────────────────────────────

toolRegistry.register({
  name: 'graph:search-leads',
  description: 'Search leads with optional state/EHR/stage filters and scored match context.',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search term (name, company, location, id, or npi)' },
      filters: {
        type: 'object',
        properties: {
          state: { type: 'string' },
          ehr: { type: 'string' },
          stage: { type: 'string' },
        },
        additionalProperties: false,
      },
    },
    required: ['query'],
    additionalProperties: false,
  },
  handler: async (params) => handleSearchLeads(params as { query: string; filters?: LeadSearchFilters }),
})

toolRegistry.register({
  name: 'graph:lead-detail',
  description: 'Get full lead profile, relationship graph, events, scoring, and stage-aware next actions.',
  inputSchema: {
    type: 'object',
    properties: {
      leadId: { type: 'string', description: 'Lead identifier resolved by id, then npi, then exact name.' },
    },
    required: ['leadId'],
    additionalProperties: false,
  },
  handler: async (params) => handleLeadDetail(params as { leadId: string }),
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
