import neo4j from 'neo4j-driver'

let driver: ReturnType<typeof neo4j.driver> | null = null

function getDriver() {
  if (!driver) {
    const uri = process.env.MEMGRAPH_URI || 'bolt://localhost:7687'
    const user = process.env.MEMGRAPH_USER || ''
    const password = process.env.MEMGRAPH_PASSWORD || ''
    driver = user
      ? neo4j.driver(uri, neo4j.auth.basic(user, password))
      : neo4j.driver(uri)
  }
  return driver
}

function toNum(val: unknown): number {
  if (val && typeof val === 'object' && 'toNumber' in val) {
    return (val as { toNumber(): number }).toNumber()
  }
  return typeof val === 'number' ? val : 0
}

function toStr(val: unknown): string {
  return val == null ? '' : String(val)
}

// ── Pipeline Summary ────────────────────────────────────────────────────────

export interface StageSummary {
  stage: string
  total: number
  avgScore: number
  byArm: Record<string, number>
}

export async function getPipelineSummary(): Promise<StageSummary[]> {
  const session = getDriver().session()
  try {
    const result = await session.run(`
      MATCH (l:Lead)-[:CURRENT_STAGE]->(s:SalesStage)
      RETURN s.name AS stage, s.order AS stageOrder,
             l.businessArm AS businessArm,
             count(l) AS cnt,
             avg(l.leadScore) AS avgScore
      ORDER BY s.order
    `)

    const stageMap = new Map<string, StageSummary>()
    for (const record of result.records) {
      const stage = toStr(record.get('stage'))
      const arm = toStr(record.get('businessArm')) || 'Unassigned'
      const cnt = toNum(record.get('cnt'))
      const avg = toNum(record.get('avgScore'))

      if (!stageMap.has(stage)) {
        stageMap.set(stage, { stage, total: 0, avgScore: 0, byArm: {} })
      }
      const entry = stageMap.get(stage)!
      entry.total += cnt
      entry.avgScore = Math.round(avg)
      entry.byArm[arm] = cnt
    }

    return [...stageMap.values()]
  } finally {
    await session.close()
  }
}

// ── Hot Leads ───────────────────────────────────────────────────────────────

export interface HotLead {
  name: string
  company: string
  score: number
  businessArm: string
  stage: string
  ehr: string
  nextAction: string
}

export async function getHotLeads(): Promise<HotLead[]> {
  const session = getDriver().session()
  try {
    const result = await session.run(`
      MATCH (l:Lead)
      WHERE l.leadScore >= 45
      OPTIONAL MATCH (l)-[:CURRENT_STAGE]->(s:SalesStage)
      OPTIONAL MATCH (l)-[:USES_EHR]->(e:EHRSystem)
      RETURN l.name AS name, l.company AS company,
             l.leadScore AS score, l.businessArm AS businessArm,
             l.nextAction AS nextAction, s.name AS stage,
             e.name AS ehr
      ORDER BY l.leadScore DESC
      LIMIT 25
    `)

    return result.records.map(r => ({
      name: toStr(r.get('name')),
      company: toStr(r.get('company')),
      score: toNum(r.get('score')),
      businessArm: toStr(r.get('businessArm')),
      stage: toStr(r.get('stage')),
      ehr: toStr(r.get('ehr')),
      nextAction: toStr(r.get('nextAction')),
    }))
  } finally {
    await session.close()
  }
}

// ── Territories ─────────────────────────────────────────────────────────────

export interface TerritoryData {
  territory: string
  leads: number
  avgScore: number
}

export async function getTerritories(): Promise<TerritoryData[]> {
  const session = getDriver().session()
  try {
    const result = await session.run(`
      MATCH (l:Lead)-[:LOCATED_IN]->(t:Territory)
      RETURN t.name AS territory, count(l) AS cnt,
             avg(l.leadScore) AS avgScore
      ORDER BY cnt DESC
    `)

    return result.records.map(r => ({
      territory: toStr(r.get('territory')),
      leads: toNum(r.get('cnt')),
      avgScore: Math.round(toNum(r.get('avgScore'))),
    }))
  } finally {
    await session.close()
  }
}

// ── New Leads ───────────────────────────────────────────────────────────────

export interface NewLead {
  name: string
  company: string
  businessArm: string
  score: number
  source: string
}

export async function getNewLeads(): Promise<NewLead[]> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const session = getDriver().session()
  try {
    const result = await session.run(
      `MATCH (l:Lead)
       WHERE l.createdAt >= $since
       RETURN l.name AS name, l.company AS company,
              l.businessArm AS businessArm, l.leadScore AS score,
              l.leadSource AS source
       ORDER BY l.leadScore DESC
       LIMIT 20`,
      { since },
    )

    return result.records.map(r => ({
      name: toStr(r.get('name')),
      company: toStr(r.get('company')),
      businessArm: toStr(r.get('businessArm')),
      score: toNum(r.get('score')),
      source: toStr(r.get('source')),
    }))
  } finally {
    await session.close()
  }
}

// ── Graph Stats ─────────────────────────────────────────────────────────────

export interface GraphStats {
  totalNodes: number
  totalRelationships: number
  nodesByLabel: Record<string, number>
  relsByType: Record<string, number>
}

export interface GraphFreshness {
  lastLeadUpdate: string | null
  lastLeadCreated: string | null
  daysSinceLastUpdate: number | null
  status: 'fresh' | 'recent' | 'stale' | 'unknown'
}

export interface GraphStatsWithFreshness extends GraphStats {
  totalLeads: number
  leadsByStage: Record<string, number>
  freshness: GraphFreshness
}

export async function getGraphStats(): Promise<GraphStats> {
  const session = getDriver().session()
  try {
    const [nodeResult, relResult] = await Promise.all([
      session.run(`
        MATCH (n)
        RETURN labels(n)[0] AS label, count(n) AS cnt
        ORDER BY cnt DESC
      `),
      session.run(`
        MATCH ()-[r]->()
        RETURN type(r) AS relType, count(r) AS cnt
        ORDER BY cnt DESC
        LIMIT 15
      `),
    ])

    const nodesByLabel: Record<string, number> = {}
    let totalNodes = 0
    for (const r of nodeResult.records) {
      const label = toStr(r.get('label'))
      const cnt = toNum(r.get('cnt'))
      nodesByLabel[label] = cnt
      totalNodes += cnt
    }

    const relsByType: Record<string, number> = {}
    let totalRelationships = 0
    for (const r of relResult.records) {
      const relType = toStr(r.get('relType'))
      const cnt = toNum(r.get('cnt'))
      relsByType[relType] = cnt
      totalRelationships += cnt
    }

    return { totalNodes, totalRelationships, nodesByLabel, relsByType }
  } finally {
    await session.close()
  }
}

export async function getGraphStatsWithFreshness(): Promise<GraphStatsWithFreshness> {
  const session = getDriver().session()
  try {
    const [nodeResult, relResult, freshnessResult, stageResult] = await Promise.all([
      session.run(`
        MATCH (n)
        RETURN labels(n)[0] AS label, count(n) AS cnt
        ORDER BY cnt DESC
      `),
      session.run(`
        MATCH ()-[r]->()
        RETURN type(r) AS relType, count(r) AS cnt
        ORDER BY cnt DESC
        LIMIT 15
      `),
      session.run(`
        MATCH (l:Lead)
        RETURN max(l.updatedAt) AS lastUpdate,
               max(l.createdAt) AS lastCreated,
               count(l) AS totalLeads
      `),
      session.run(`
        MATCH (l:Lead)-[:CURRENT_STAGE]->(s:SalesStage)
        RETURN s.name AS stage, s.order AS stageOrder, count(l) AS cnt
        ORDER BY s.order
      `),
    ])

    const nodesByLabel: Record<string, number> = {}
    let totalNodes = 0
    for (const r of nodeResult.records) {
      const label = toStr(r.get('label'))
      const cnt = toNum(r.get('cnt'))
      nodesByLabel[label] = cnt
      totalNodes += cnt
    }

    const relsByType: Record<string, number> = {}
    let totalRelationships = 0
    for (const r of relResult.records) {
      const relType = toStr(r.get('relType'))
      const cnt = toNum(r.get('cnt'))
      relsByType[relType] = cnt
      totalRelationships += cnt
    }

    const lastUpdate = freshnessResult.records[0]?.get('lastUpdate') ?? null
    const lastCreated = freshnessResult.records[0]?.get('lastCreated') ?? null
    const totalLeads = toNum(freshnessResult.records[0]?.get('totalLeads'))
    const lastUpdateStr = lastUpdate != null && lastUpdate !== '' ? toStr(lastUpdate) : null
    const lastCreatedStr = lastCreated != null && lastCreated !== '' ? toStr(lastCreated) : null
    const daysSinceUpdate =
      lastUpdateStr && !Number.isNaN(Date.parse(lastUpdateStr))
        ? Math.floor((Date.now() - new Date(lastUpdateStr).getTime()) / (1000 * 60 * 60 * 24))
        : null

    const freshness: GraphFreshness = {
      lastLeadUpdate: lastUpdateStr,
      lastLeadCreated: lastCreatedStr,
      daysSinceLastUpdate: daysSinceUpdate,
      status:
        daysSinceUpdate === null
          ? 'unknown'
          : daysSinceUpdate <= 1
            ? 'fresh'
            : daysSinceUpdate <= 7
              ? 'recent'
              : 'stale',
    }

    const leadsByStage: Record<string, number> = {}
    for (const r of stageResult.records) {
      const stage = toStr(r.get('stage'))
      leadsByStage[stage] = toNum(r.get('cnt'))
    }

    return {
      totalNodes,
      totalRelationships,
      nodesByLabel,
      relsByType,
      totalLeads,
      leadsByStage,
      freshness,
    }
  } finally {
    await session.close()
  }
}

// ── Lead Search ─────────────────────────────────────────────────────────────

export interface LeadSearchFilters {
  state?: string
  ehr?: string
  stage?: string
}

export interface LeadSearchResult {
  leadId: string
  name: string
  company: string
  score: number
  businessArm: string
  stage: string
  ehr: string
  territory: string
  location: string
  nextAction: string
  source: string
}

/** Exported for unit tests (filter WHERE composition). */
export function buildSearchWhereAndParams(
  query: string,
  filters?: LeadSearchFilters,
): { whereClause: string; params: Record<string, unknown> } {
  const params: Record<string, unknown> = { q: query }
  const whereClauses: string[] = [
    '(toLower(l.name) CONTAINS toLower($q) OR toLower(l.company) CONTAINS toLower($q) OR toLower(l.location) CONTAINS toLower($q))',
  ]
  if (filters?.state) {
    whereClauses.push('t.name = $state')
    params.state = filters.state
  }
  if (filters?.ehr) {
    whereClauses.push('e.name = $ehr')
    params.ehr = filters.ehr
  }
  if (filters?.stage) {
    whereClauses.push('s.name = $stage')
    params.stage = filters.stage
  }
  return { whereClause: whereClauses.join(' AND '), params }
}

function mapLeadSearchRecord(r: { get(key: string): unknown }): LeadSearchResult {
  return {
    leadId: toStr(r.get('leadId')),
    name: toStr(r.get('name')),
    company: toStr(r.get('company')),
    score: toNum(r.get('score')),
    businessArm: toStr(r.get('businessArm')),
    stage: toStr(r.get('stage')),
    ehr: toStr(r.get('ehr')),
    territory: toStr(r.get('territory')),
    location: toStr(r.get('location')),
    nextAction: toStr(r.get('nextAction')),
    source: toStr(r.get('source')),
  }
}

export async function searchLeads(query: string): Promise<LeadSearchResult[]> {
  return searchLeadsWithFilters(query, undefined, 30)
}

export async function searchLeadsWithFilters(
  query: string,
  filters?: LeadSearchFilters,
  limit = 30,
): Promise<LeadSearchResult[]> {
  const cap = Math.min(Math.max(1, limit), 100)
  const { whereClause, params } = buildSearchWhereAndParams(query, filters)
  const session = getDriver().session()
  try {
    const result = await session.run(
      `MATCH (l:Lead)
       OPTIONAL MATCH (l)-[:CURRENT_STAGE]->(s:SalesStage)
       OPTIONAL MATCH (l)-[:USES_EHR]->(e:EHRSystem)
       OPTIONAL MATCH (l)-[:LOCATED_IN]->(t:Territory)
       WHERE ${whereClause}
       RETURN coalesce(l.id, '') AS leadId, l.name AS name, l.company AS company,
              l.leadScore AS score, l.businessArm AS businessArm,
              l.nextAction AS nextAction, s.name AS stage,
              e.name AS ehr, t.name AS territory, l.location AS location,
              l.leadSource AS source
       ORDER BY l.leadScore DESC
       LIMIT $lim`,
      { ...params, lim: cap },
    )

    return result.records.map(mapLeadSearchRecord)
  } finally {
    await session.close()
  }
}

// ── Lead Detail ────────────────────────────────────────────────────────────

export interface LeadDetail {
  /** Stable graph id when present on the Lead node. */
  leadId?: string
  name: string
  company: string
  score: number
  businessArm: string
  stage: string
  ehr: string
  location: string
  nextAction: string
  source: string
  npi: string
  phone: string
  specialty: string
  website: string
  events: { type: string; date: string; detail: string }[]
  documents: { title: string; path: string }[]
  stageHistory: { stage: string; enteredAt: string }[]
}

function leadDetailFromRow(
  r: { get(key: string): unknown },
  eventsResult: { records: { get(key: string): unknown }[] },
  docsResult: { records: { get(key: string): unknown }[] },
  historyResult: { records: { get(key: string): unknown }[] },
): LeadDetail {
  const l = r.get('l').properties
  const idRaw = l.id
  const leadIdOpt = idRaw != null && String(idRaw).length > 0 ? toStr(idRaw) : undefined
  return {
    ...(leadIdOpt ? { leadId: leadIdOpt } : {}),
    name: toStr(l.name),
    company: toStr(l.company),
    score: toNum(l.leadScore),
    businessArm: toStr(l.businessArm),
    stage: toStr(r.get('stage')),
    ehr: toStr(r.get('ehr')),
    location: toStr(l.location),
    nextAction: toStr(l.nextAction),
    source: toStr(l.leadSource),
    npi: toStr(l.npi),
    phone: toStr(l.phone),
    specialty: toStr(l.specialty),
    website: toStr(l.website),
    events: eventsResult.records.map(e => ({
      type: toStr(e.get('type')),
      date: toStr(e.get('date')),
      detail: toStr(e.get('detail')),
    })),
    documents: docsResult.records.map(d => ({
      title: toStr(d.get('title')),
      path: toStr(d.get('path')),
    })),
    stageHistory: historyResult.records.map(h => ({
      stage: toStr(h.get('stage')),
      enteredAt: toStr(h.get('enteredAt')),
    })),
  }
}

export async function getLeadDetail(name: string): Promise<LeadDetail | null> {
  const session = getDriver().session()
  try {
    const result = await session.run(
      `MATCH (l:Lead)
       WHERE l.name = $name
       OPTIONAL MATCH (l)-[:CURRENT_STAGE]->(s:SalesStage)
       OPTIONAL MATCH (l)-[:USES_EHR]->(e:EHRSystem)
       RETURN l, s.name AS stage, e.name AS ehr`,
      { name },
    )

    if (result.records.length === 0) return null

    const r = result.records[0]

    const [eventsResult, docsResult, historyResult] = await Promise.all([
      session.run(
        `MATCH (l:Lead {name: $name})-[:HAD_EVENT]->(ev:Event)
         RETURN ev.type AS type, ev.date AS date, ev.detail AS detail
         ORDER BY ev.date DESC LIMIT 20`,
        { name },
      ),
      session.run(
        `MATCH (l:Lead {name: $name})<-[:ABOUT_LEAD]-(d:Document)
         RETURN d.title AS title, d.path AS path
         ORDER BY d.title LIMIT 20`,
        { name },
      ),
      session.run(
        `MATCH (l:Lead {name: $name})-[:ENTERED_STAGE]->(s:SalesStage)
         RETURN s.name AS stage, s.enteredAt AS enteredAt
         ORDER BY s.enteredAt DESC`,
        { name },
      ),
    ])

    return leadDetailFromRow(r, eventsResult, docsResult, historyResult)
  } finally {
    await session.close()
  }
}

export interface LeadRelationshipSummary {
  stage: string
  ehr: string
  territory: string
  linkedCompany: string
  edgeTypes: string[]
}

export type LeadDetailByIdResult = LeadDetail & {
  leadId: string
  relationships: LeadRelationshipSummary
}

export async function getLeadDetailByLeadId(leadId: string): Promise<LeadDetailByIdResult | null> {
  const session = getDriver().session()
  try {
    const result = await session.run(
      `MATCH (l:Lead)
       WHERE l.id = $leadId
       OPTIONAL MATCH (l)-[:CURRENT_STAGE]->(s:SalesStage)
       OPTIONAL MATCH (l)-[:USES_EHR]->(e:EHRSystem)
       OPTIONAL MATCH (l)-[:LOCATED_IN]->(t:Territory)
       OPTIONAL MATCH (l)-[:WORKS_AT]->(c:Company)
       RETURN l, s.name AS stage, e.name AS ehr, t.name AS territory, c.name AS linkedCompany`,
      { leadId },
    )

    if (result.records.length === 0) return null

    const r = result.records[0]
    const territory = toStr(r.get('territory'))
    const linkedCompany = toStr(r.get('linkedCompany'))

    const [eventsResult, docsResult, historyResult, edgesResult] = await Promise.all([
      session.run(
        `MATCH (l:Lead) WHERE l.id = $leadId
         MATCH (l)-[:HAD_EVENT]->(ev:Event)
         RETURN ev.type AS type, ev.date AS date, ev.detail AS detail
         ORDER BY ev.date DESC LIMIT 20`,
        { leadId },
      ),
      session.run(
        `MATCH (l:Lead) WHERE l.id = $leadId
         MATCH (l)<-[:ABOUT_LEAD]-(d:Document)
         RETURN d.title AS title, d.path AS path
         ORDER BY d.title LIMIT 20`,
        { leadId },
      ),
      session.run(
        `MATCH (l:Lead) WHERE l.id = $leadId
         MATCH (l)-[:ENTERED_STAGE]->(s:SalesStage)
         RETURN s.name AS stage, s.enteredAt AS enteredAt
         ORDER BY s.enteredAt DESC`,
        { leadId },
      ),
      session.run(
        `MATCH (l:Lead) WHERE l.id = $leadId
         MATCH (l)-[r]-()
         RETURN DISTINCT type(r) AS relType`,
        { leadId },
      ),
    ])

    const profile = leadDetailFromRow(r, eventsResult, docsResult, historyResult)
    const edgeTypes = [...new Set(edgesResult.records.map(row => toStr(row.get('relType'))))].filter(Boolean)

    return {
      ...profile,
      leadId,
      relationships: {
        stage: profile.stage,
        ehr: profile.ehr,
        territory,
        linkedCompany,
        edgeTypes,
      },
    }
  } finally {
    await session.close()
  }
}

// ── Cleanup ─────────────────────────────────────────────────────────────────

export async function closeGraph() {
  if (driver) {
    await driver.close()
    driver = null
  }
}
