/**
 * MCP tools: graph:search-leads, graph:lead-detail, graph:stats
 *
 * Delegates to Penny/src/main/graph.ts (single Cypher source of truth).
 */

import { toolRegistry } from '../tools.js'
import { wrapResponse, type ContextEngineeredResponse } from '../response.js'
import {
  searchLeadsWithFilters,
  getLeadDetailByLeadId,
  getLeadDetail,
  getGraphStatsWithFreshness,
  type LeadSearchFilters,
  type LeadSearchResult,
  type LeadDetailByIdResult,
  type GraphStatsWithFreshness,
} from '../../main/graph.js'
import { suggestedActionsForStage } from '../../main/stage-suggestions.js'

function searchHitContext(lead: LeadSearchResult): string {
  const tier = lead.score >= 70 ? 'High-scoring' : lead.score >= 40 ? 'Mid-scoring' : 'Early-stage'
  const parts = [`${tier} lead`]
  if (lead.stage) parts.push(`in ${lead.stage}`)
  if (lead.ehr) parts.push(`EHR: ${lead.ehr}`)
  if (lead.territory) parts.push(`territory ${lead.territory}`)
  return parts.join(' — ')
}

export type SearchLeadsRow = LeadSearchResult & { contextSnippet: string }

export async function handleSearchLeads(params: {
  query: string
  filters?: LeadSearchFilters
  limit?: number
}): Promise<ContextEngineeredResponse<SearchLeadsRow[]>> {
  try {
    const limit = params.limit ?? 30
    const raw = await searchLeadsWithFilters(params.query, params.filters, limit)
    const data: SearchLeadsRow[] = raw.map(r => ({ ...r, contextSnippet: searchHitContext(r) }))

    const scores = data.map(r => r.score)
    const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0
    const topScore = scores.length > 0 ? Math.max(...scores) : 0
    const lowScoreCount = scores.filter(s => s < 40).length
    const mediumScoreCount = scores.filter(s => s >= 40 && s < 70).length
    const highScoreCount = scores.filter(s => s >= 70).length
    const stageDistribution: Record<string, number> = {}
    const armDistribution: Record<string, number> = {}
    for (const r of data) {
      stageDistribution[r.stage] = (stageDistribution[r.stage] || 0) + 1
      armDistribution[r.businessArm] = (armDistribution[r.businessArm] || 0) + 1
    }
    const topLead = data.length > 0 ? data.reduce((best, r) => (r.score > best.score ? r : best)) : null

    const stageStr = Object.entries(stageDistribution)
      .map(([s, n]) => `${n} ${s}`)
      .join(', ')
    const summary = `Found ${data.length} lead(s) matching "${params.query}"${params.filters?.state || params.filters?.ehr || params.filters?.stage ? ' (filtered)' : ''}${stageStr ? `: ${stageStr}` : ''}${avgScore ? `; avg score ${avgScore}` : ''}.`

    const suggestions: string[] = []
    if (topLead) {
      suggestions.push(
        `Top match: ${topLead.name} (score ${topLead.score})${topLead.leadId ? ` — graph:lead-detail with leadId "${topLead.leadId}"` : ''}.`,
      )
    }
    if (highScoreCount > 0) suggestions.push(`${highScoreCount} high-scoring lead(s) ready for outreach.`)
    if (data.length === 0) {
      suggestions.push('No results — broaden the query or adjust filters; check graph:stats for data health.')
    }
    if (data.length >= limit) suggestions.push('Results capped — narrow search or raise limit (max 100).')

    return wrapResponse(data, summary, suggestions, ['graph:lead-detail', 'graph:stats'], {
      scoringBreakdown: {
        tiers: {
          low: { maxExclusive: 40, count: lowScoreCount },
          medium: { min: 40, maxExclusive: 70, count: mediumScoreCount },
          high: { min: 70, count: highScoreCount },
        },
        note: 'leadScore is the canonical graph field; tiers mirror dashboard search metadata.',
      },
      avgScore,
      topScore,
      scoreDistribution: { low: lowScoreCount, medium: mediumScoreCount, high: highScoreCount },
      stageDistribution,
      businessArmDistribution: armDistribution,
      topLeadName: topLead?.name ?? null,
      topLeadId: topLead?.leadId ?? null,
      filtersApplied: params.filters ?? {},
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return wrapResponse(
      [],
      `Graph query failed: ${message.slice(0, 200)}`,
      ['Ensure Memgraph is running and MEMGRAPH_URI is set.', 'Check graph:stats for connectivity.'],
      ['graph:stats'],
      { error: message.slice(0, 500), offline: true },
    )
  }
}

async function fetchLeadDetailMcp(params: {
  leadId?: string
  name?: string
}): Promise<{ ok: true; detail: LeadDetailByIdResult } | { ok: false; error: string }> {
  const id = typeof params.leadId === 'string' ? params.leadId.trim() : ''
  const name = typeof params.name === 'string' ? params.name.trim() : ''
  if (id && name) {
    return { ok: false, error: 'Provide only one of leadId or name.' }
  }
  if (!id && !name) {
    return { ok: false, error: 'Provide leadId (preferred) or name.' }
  }
  if (id) {
    const detail = await getLeadDetailByLeadId(id)
    if (!detail) return { ok: false, error: 'Lead not found for given leadId.' }
    return { ok: true, detail }
  }
  const d = await getLeadDetail(name)
  if (!d) return { ok: false, error: 'Lead not found for given name.' }
  if (d.leadId) {
    const detail = await getLeadDetailByLeadId(d.leadId)
    if (detail) return { ok: true, detail }
  }
  return {
    ok: true,
    detail: {
      ...d,
      leadId: d.leadId ?? '',
      relationships: {
        stage: d.stage,
        ehr: d.ehr,
        territory: '',
        linkedCompany: '',
        edgeTypes: [],
      },
    },
  }
}

export type LeadDetailMcpPayload = LeadDetailByIdResult & {
  suggestedNextActions: string[]
}

export async function handleLeadDetail(params: {
  leadId?: string
  name?: string
}): Promise<ContextEngineeredResponse<LeadDetailMcpPayload | null>> {
  try {
    const resolved = await fetchLeadDetailMcp(params)
    if (!resolved.ok) {
      return wrapResponse(
        null,
        resolved.error,
        ['Use graph:search-leads to find leadId or exact name.'],
        ['graph:search-leads', 'graph:stats'],
        { validationError: true },
      )
    }
    const { detail } = resolved
    const suggestedNextActions = suggestedActionsForStage(detail.stage)

    const payload: LeadDetailMcpPayload = {
      ...detail,
      suggestedNextActions,
    }

    const lastEvent = detail.events.length > 0 ? detail.events[detail.events.length - 1] : null
    const daysSinceLastEvent = lastEvent
      ? Math.floor((Date.now() - new Date(lastEvent.date).getTime()) / 86400000)
      : null

    const summary = `${detail.name} at ${detail.company} — score ${detail.score}, stage: ${detail.stage}, EHR: ${detail.ehr || 'unknown'}.`
    const suggestions = [...suggestedNextActions]
    if (daysSinceLastEvent !== null && daysSinceLastEvent > 14) {
      suggestions.push(`No activity in ${daysSinceLastEvent} days — consider follow-up.`)
    }

    return wrapResponse(payload, summary, suggestions, ['graph:search-leads', 'graph:stats'], {
      eventCount: detail.events.length,
      documentCount: detail.documents.length,
      stageHistory: detail.stageHistory,
      daysSinceLastEvent,
      relationshipEdgeCount: detail.relationships.edgeTypes.length,
      suggestedStageActions: suggestedNextActions,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return wrapResponse(
      null,
      `Graph query failed: ${message.slice(0, 200)}`,
      ['Ensure Memgraph is running.'],
      ['graph:stats'],
      { error: message.slice(0, 500), offline: true },
    )
  }
}

export async function handleGraphStats(): Promise<ContextEngineeredResponse<GraphStatsWithFreshness>> {
  try {
    const data = await getGraphStatsWithFreshness()
    const leadCount = data.nodesByLabel['Lead'] ?? 0
    const summary = `Graph: ${data.totalNodes} nodes, ${data.totalRelationships} relationships; ${data.totalLeads} leads; freshness: ${data.freshness.status}.`

    const suggestions: string[] = []
    if (data.totalNodes === 0) suggestions.push('Graph is empty — run ETL to populate data.')
    if (leadCount > 0) suggestions.push(`${leadCount} Lead nodes — search via graph:search-leads.`)
    if (data.freshness.status === 'stale') suggestions.push('Lead data may be stale — refresh ETL or verify ingestion.')
    if (data.freshness.status === 'unknown' && leadCount > 0) {
      suggestions.push('No updatedAt on leads — freshness is unknown; check ETL writes updatedAt.')
    }

    return wrapResponse(data, summary, suggestions, ['graph:search-leads', 'graph:lead-detail'], {
      freshnessStatus: data.freshness.status,
      daysSinceLastUpdate: data.freshness.daysSinceLastUpdate,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    const empty: GraphStatsWithFreshness = {
      totalNodes: 0,
      totalRelationships: 0,
      nodesByLabel: {},
      relsByType: {},
      totalLeads: 0,
      leadsByStage: {},
      freshness: {
        lastLeadUpdate: null,
        lastLeadCreated: null,
        daysSinceLastUpdate: null,
        status: 'unknown',
      },
    }
    return wrapResponse(
      empty,
      `Graph unavailable: ${message.slice(0, 200)}`,
      ['Ensure Memgraph is running on MEMGRAPH_URI.', 'Confirm analytics/.env or env has MEMGRAPH_URI.'],
      [],
      { error: message.slice(0, 500), offline: true },
    )
  }
}

toolRegistry.register({
  name: 'graph:search-leads',
  description:
    'Search leads in Memgraph by name, company, or location with optional filters (state/territory, EHR, pipeline stage). Returns scored rows with short context and scoring metadata.',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Text match on name, company, location (case-insensitive)' },
      filters: {
        type: 'object',
        description: 'Optional filters (OPTIONAL MATCH pattern — rows kept, nulls excluded by predicate)',
        properties: {
          state: { type: 'string', description: 'Territory.name' },
          ehr: { type: 'string', description: 'EHRSystem.name' },
          stage: { type: 'string', description: 'SalesStage.name' },
        },
        additionalProperties: false,
      },
      limit: { type: 'number', description: 'Max results (default 30, max 100)' },
    },
    required: ['query'],
    additionalProperties: false,
  },
  handler: async (params) =>
    handleSearchLeads(params as { query: string; filters?: LeadSearchFilters; limit?: number }),
})

toolRegistry.register({
  name: 'graph:lead-detail',
  description:
    'Full lead profile by stable leadId (preferred) or exact name: relationships summary, events, documents, stage history, and suggested next actions by stage.',
  inputSchema: {
    type: 'object',
    properties: {
      leadId: { type: 'string', description: 'Stable Lead.id from search or graph' },
      name: { type: 'string', description: 'Exact lead name (fallback if leadId unknown)' },
    },
    additionalProperties: false,
  },
  handler: async (params) => handleLeadDetail(params as { leadId?: string; name?: string }),
})

toolRegistry.register({
  name: 'graph:stats',
  description:
    'Knowledge graph statistics: node/edge counts by type, lead counts by stage, freshness (last lead update, stale/recent/fresh).',
  inputSchema: {
    type: 'object',
    properties: {},
    additionalProperties: false,
  },
  handler: async () => handleGraphStats(),
})
