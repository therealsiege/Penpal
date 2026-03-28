import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../main/graph.js', () => ({
  searchLeadsWithFilters: vi.fn(),
  getLeadDetailByLeadId: vi.fn(),
  getLeadDetail: vi.fn(),
  getGraphStatsWithFreshness: vi.fn(),
}))

import {
  searchLeadsWithFilters,
  getLeadDetailByLeadId,
  getLeadDetail,
  getGraphStatsWithFreshness,
} from '../../main/graph.js'
import { handleSearchLeads, handleLeadDetail, handleGraphStats } from './graph.js'
import { toolRegistry } from '../tools.js'

const mockSearch = vi.mocked(searchLeadsWithFilters)
const mockById = vi.mocked(getLeadDetailByLeadId)
const mockByName = vi.mocked(getLeadDetail)
const mockStats = vi.mocked(getGraphStatsWithFreshness)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('graph MCP tool catalog', () => {
  it('registers graph:search-leads with query required and filter schema', () => {
    const t = toolRegistry.get('graph:search-leads')
    expect(t).toBeDefined()
    const schema = t!.inputSchema as {
      required?: string[]
      properties: Record<string, unknown>
      additionalProperties?: boolean
    }
    expect(schema.required).toEqual(['query'])
    expect(schema.additionalProperties).toBe(false)
    expect(schema.properties).toHaveProperty('filters')
    expect(schema.properties).toHaveProperty('limit')
  })

  it('registers graph:lead-detail without required fields (leadId or name validated in handler)', () => {
    const t = toolRegistry.get('graph:lead-detail')
    expect(t).toBeDefined()
    const schema = t!.inputSchema as { properties: Record<string, unknown>; additionalProperties?: boolean }
    expect(schema.properties).toHaveProperty('leadId')
    expect(schema.properties).toHaveProperty('name')
    expect(schema.additionalProperties).toBe(false)
  })

  it('registers graph:stats with empty object schema', () => {
    const t = toolRegistry.get('graph:stats')
    expect(t).toBeDefined()
    const schema = t!.inputSchema as { type: string; additionalProperties?: boolean }
    expect(schema.type).toBe('object')
    expect(schema.additionalProperties).toBe(false)
  })
})

describe('graph:search-leads handler', () => {
  it('forwards state filter to searchLeadsWithFilters', async () => {
    mockSearch.mockResolvedValue([
      {
        leadId: 'L1',
        name: 'A',
        company: 'Co',
        score: 50,
        businessArm: 'x',
        stage: 'prospecting',
        ehr: 'Epic',
        territory: 'TX',
        location: 'Austin',
        nextAction: '',
        source: 'web',
      },
    ])

    await handleSearchLeads({ query: 'test', filters: { state: 'TX' }, limit: 10 })

    expect(mockSearch).toHaveBeenCalledWith('test', { state: 'TX' }, 10)
  })

  it('includes scoring _meta and contextSnippet per row', async () => {
    mockSearch.mockResolvedValue([
      {
        leadId: 'L1',
        name: 'A',
        company: 'Co',
        score: 75,
        businessArm: 'dental',
        stage: 'qualified',
        ehr: 'Epic',
        territory: '',
        location: '',
        nextAction: '',
        source: '',
      },
    ])

    const r = await handleSearchLeads({ query: 'a' })
    expect(r.data[0].contextSnippet).toContain('High-scoring')
    expect(r._meta.scoreDistribution).toEqual({ low: 0, medium: 0, high: 1 })
    expect(r._meta.topLeadId).toBe('L1')
  })
})

describe('graph:lead-detail handler', () => {
  it('loads by leadId and includes suggestedNextActions and relationships', async () => {
    mockById.mockResolvedValue({
      leadId: 'id-1',
      name: 'Dr X',
      company: 'Clinic',
      score: 60,
      businessArm: 'medical',
      stage: 'qualified',
      ehr: 'Epic',
      location: 'TX',
      nextAction: '',
      source: '',
      npi: '',
      phone: '',
      specialty: '',
      website: '',
      events: [],
      documents: [],
      stageHistory: [],
      relationships: {
        stage: 'qualified',
        ehr: 'Epic',
        territory: 'South',
        linkedCompany: '',
        edgeTypes: ['CURRENT_STAGE', 'USES_EHR'],
      },
    })

    const r = await handleLeadDetail({ leadId: 'id-1' })
    expect(mockById).toHaveBeenCalledWith('id-1')
    expect(r.data?.suggestedNextActions.length).toBeGreaterThan(0)
    expect(r.data?.relationships.edgeTypes).toContain('CURRENT_STAGE')
    expect(r._meta.relationshipEdgeCount).toBe(2)
  })

  it('resolves name to id when lead has leadId on node', async () => {
    mockByName.mockResolvedValue({
      leadId: 'nid',
      name: 'N',
      company: 'C',
      score: 1,
      businessArm: '',
      stage: 'prospecting',
      ehr: '',
      location: '',
      nextAction: '',
      source: '',
      npi: '',
      phone: '',
      specialty: '',
      website: '',
      events: [],
      documents: [],
      stageHistory: [],
    })
    mockById.mockResolvedValue({
      leadId: 'nid',
      name: 'N',
      company: 'C',
      score: 1,
      businessArm: '',
      stage: 'prospecting',
      ehr: '',
      location: '',
      nextAction: '',
      source: '',
      npi: '',
      phone: '',
      specialty: '',
      website: '',
      events: [],
      documents: [],
      stageHistory: [],
      relationships: {
        stage: 'prospecting',
        ehr: '',
        territory: '',
        linkedCompany: '',
        edgeTypes: ['LOCATED_IN'],
      },
    })

    await handleLeadDetail({ name: 'N' })
    expect(mockByName).toHaveBeenCalledWith('N')
    expect(mockById).toHaveBeenCalledWith('nid')
  })
})

describe('graph:stats handler', () => {
  it('returns freshness fields from getGraphStatsWithFreshness', async () => {
    mockStats.mockResolvedValue({
      totalNodes: 10,
      totalRelationships: 5,
      nodesByLabel: { Lead: 3 },
      relsByType: { CURRENT_STAGE: 2 },
      totalLeads: 3,
      leadsByStage: { prospecting: 2 },
      freshness: {
        lastLeadUpdate: '2026-01-01T00:00:00.000Z',
        lastLeadCreated: null,
        daysSinceLastUpdate: 0,
        status: 'fresh',
      },
    })

    const r = await handleGraphStats()
    expect(r.data.freshness.status).toBe('fresh')
    expect(r.data.totalLeads).toBe(3)
    expect(r._meta.freshnessStatus).toBe('fresh')
  })

  it('returns zeroed stats envelope on Memgraph error', async () => {
    mockStats.mockRejectedValue(new Error('connection refused'))
    const r = await handleGraphStats()
    expect(r.data.totalNodes).toBe(0)
    expect(r.data.freshness.status).toBe('unknown')
    expect(r._meta.offline).toBe(true)
  })
})
