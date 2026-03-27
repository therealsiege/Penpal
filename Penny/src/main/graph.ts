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

export type FreshnessStatus = 'fresh' | 'stale' | 'unknown'

export interface GraphFreshness {
  latestEtlRunAt: string | null
  etlSource: string | null
  etlStatus: string | null
  ageMinutes: number | null
  staleness: FreshnessStatus
}

export interface GraphStats {
  totalNodes: number
  totalRelationships: number
  nodesByLabel: Record<string, number>
  relsByType: Record<string, number>
  freshness: GraphFreshness
  available: boolean
  error?: string
  remediation?: string[]
}

function normalizeDate(value: unknown): string | null {
  if (!value) return null
  const dt = new Date(String(value))
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString()
}

function getStaleness(ageMinutes: number | null): FreshnessStatus {
  if (ageMinutes == null) return 'unknown'
  return ageMinutes <= 120 ? 'fresh' : 'stale'
}

export async function getGraphStats(): Promise<GraphStats> {
  const session = getDriver().session()
  try {
    const [nodeResult, relResult, etlResult] = await Promise.all([
      session.run(`
        MATCH (n)
        UNWIND labels(n) AS label
        RETURN label, count(*) AS cnt
        ORDER BY cnt DESC
      `),
      session.run(`
        MATCH ()-[r]->()
        RETURN type(r) AS relType, count(r) AS cnt
        ORDER BY cnt DESC
      `),
      session.run(`
        OPTIONAL MATCH (run:ETLRun)
        RETURN run.completedAt AS completedAt, run.startedAt AS startedAt, run.status AS status, run.source AS source
        ORDER BY coalesce(run.completedAt, run.startedAt) DESC
        LIMIT 1
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

    const etlRecord = etlResult.records[0]
    const latestEtlRunAt = normalizeDate(etlRecord?.get('completedAt') ?? etlRecord?.get('startedAt'))
    const ageMinutes = latestEtlRunAt
      ? Math.max(0, Math.round((Date.now() - new Date(latestEtlRunAt).getTime()) / 60000))
      : null

    return {
      totalNodes,
      totalRelationships,
      nodesByLabel,
      relsByType,
      freshness: {
        latestEtlRunAt,
        etlSource: toStr(etlRecord?.get('source')) || null,
        etlStatus: toStr(etlRecord?.get('status')) || null,
        ageMinutes,
        staleness: getStaleness(ageMinutes),
      },
      available: true,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      totalNodes: 0,
      totalRelationships: 0,
      nodesByLabel: {},
      relsByType: {},
      freshness: {
        latestEtlRunAt: null,
        etlSource: null,
        etlStatus: null,
        ageMinutes: null,
        staleness: 'unknown',
      },
      available: false,
      error: message,
      remediation: [
        'Ensure Memgraph is running and reachable at MEMGRAPH_URI.',
        'Verify credentials and network access for the graph service.',
        'Re-run ETL after connectivity is restored.',
      ],
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
  id: string
  name: string
  company: string
  score: number
  businessArm: string
  stage: string
  ehr: string
  location: string
  state: string
  nextAction: string
  source: string
  scoreBreakdown?: {
    baseScore: number
    textMatchBoost: number
    filterBoost: number
    recencyBoost: number
    total: number
  }
  matchContext?: {
    matchedFields: string[]
    filtersApplied: { state?: string; ehr?: string; stage?: string }
    lastActivityAt: string | null
  }
}

function recencyBoost(lastActivityAt: string | null): number {
  if (!lastActivityAt) return 0
  const ageDays = (Date.now() - new Date(lastActivityAt).getTime()) / 86400000
  if (ageDays <= 7) return 5
  if (ageDays <= 30) return 2
  return 0
}

export async function searchLeads(query: string, filters: LeadSearchFilters = {}): Promise<LeadSearchResult[]> {
  const session = getDriver().session()
  try {
    const state = (filters.state || '').trim()
    const ehr = (filters.ehr || '').trim()
    const stage = (filters.stage || '').trim()
    const result = await session.run(
      `MATCH (l:Lead)
       OPTIONAL MATCH (l)-[:CURRENT_STAGE]->(s:SalesStage)
       OPTIONAL MATCH (l)-[:USES_EHR]->(e:EHRSystem)
       WITH l, s, e,
            toLower(coalesce(l.name, '')) AS leadName,
            toLower(coalesce(l.company, '')) AS leadCompany,
            toLower(coalesce(l.location, '')) AS leadLocation,
            toLower(coalesce(l.state, '')) AS leadState,
            toLower(coalesce(e.name, coalesce(l.ehr, ''))) AS leadEhr,
            toLower(coalesce(s.name, coalesce(l.stage, ''))) AS leadStage,
            toLower($q) AS qLower
       WHERE (
         qLower = '' OR
         leadName CONTAINS qLower OR
         leadCompany CONTAINS qLower OR
         leadLocation CONTAINS qLower OR
         leadState CONTAINS qLower OR
         toLower(coalesce(l.npi, '')) CONTAINS qLower OR
         toLower(coalesce(l.id, '')) CONTAINS qLower
       )
         AND ($state = '' OR leadState = toLower($state) OR leadLocation CONTAINS toLower($state))
         AND ($ehr = '' OR leadEhr CONTAINS toLower($ehr))
         AND ($stage = '' OR leadStage = toLower($stage))
       WITH l, s, e, qLower, leadName, leadCompany, leadLocation, leadState,
            CASE
              WHEN qLower = '' THEN 0
              WHEN leadName = qLower THEN 12
              WHEN leadName CONTAINS qLower THEN 8
              WHEN leadCompany CONTAINS qLower THEN 6
              WHEN leadLocation CONTAINS qLower OR leadState CONTAINS qLower THEN 3
              ELSE 1
            END AS textMatchBoost,
            CASE WHEN $state <> '' THEN 2 ELSE 0 END +
            CASE WHEN $ehr <> '' THEN 2 ELSE 0 END +
            CASE WHEN $stage <> '' THEN 2 ELSE 0 END AS filterBoost
       RETURN coalesce(l.id, l.npi, l.name) AS id,
              l.name AS name, l.company AS company,
              l.leadScore AS score, l.businessArm AS businessArm,
              l.nextAction AS nextAction, s.name AS stage,
              e.name AS ehr, l.location AS location,
              coalesce(l.state, '') AS state,
              l.leadSource AS source,
              coalesce(l.lastActivityAt, l.updatedAt, l.createdAt) AS activityAt,
              textMatchBoost, filterBoost,
              [field IN [
                CASE WHEN qLower <> '' AND leadName CONTAINS qLower THEN 'name' ELSE '' END,
                CASE WHEN qLower <> '' AND leadCompany CONTAINS qLower THEN 'company' ELSE '' END,
                CASE WHEN qLower <> '' AND (leadLocation CONTAINS qLower OR leadState CONTAINS qLower) THEN 'location' ELSE '' END,
                CASE WHEN qLower <> '' AND toLower(coalesce(l.npi, '')) CONTAINS qLower THEN 'npi' ELSE '' END,
                CASE WHEN qLower <> '' AND toLower(coalesce(l.id, '')) CONTAINS qLower THEN 'id' ELSE '' END
              ] WHERE field <> ''] AS matchedFields
       ORDER BY (coalesce(l.leadScore, 0) + textMatchBoost + filterBoost) DESC, coalesce(l.leadScore, 0) DESC, l.name ASC
       LIMIT 30`,
      { q: query, state, ehr, stage },
    )

    return result.records.map(r => {
      const baseScore = toNum(r.get('score'))
      const textMatchBoost = toNum(r.get('textMatchBoost'))
      const filterBoost = toNum(r.get('filterBoost'))
      const lastActivityAt = normalizeDate(r.get('activityAt'))
      const activityBoost = recencyBoost(lastActivityAt)
      const matched = r.get('matchedFields')
      const matchedFields = Array.isArray(matched) ? matched.map(v => String(v)) : []

      return {
        id: toStr(r.get('id')),
        name: toStr(r.get('name')),
        company: toStr(r.get('company')),
        score: baseScore,
        businessArm: toStr(r.get('businessArm')),
        stage: toStr(r.get('stage')),
        ehr: toStr(r.get('ehr')),
        location: toStr(r.get('location')),
        state: toStr(r.get('state')),
        nextAction: toStr(r.get('nextAction')),
        source: toStr(r.get('source')),
        scoreBreakdown: {
          baseScore,
          textMatchBoost,
          filterBoost,
          recencyBoost: activityBoost,
          total: baseScore + textMatchBoost + filterBoost + activityBoost,
        },
        matchContext: {
          matchedFields,
          filtersApplied: {
            state: state || undefined,
            ehr: ehr || undefined,
            stage: stage || undefined,
          },
          lastActivityAt,
        },
      }
    })
  } finally {
    await session.close()
  }
}

// ── Lead Detail ────────────────────────────────────────────────────────────

export interface LeadDetail {
  id: string
  name: string
  company: string
  score: number
  businessArm: string
  stage: string
  ehr: string
  location: string
  state: string
  territory: string
  nextAction: string
  source: string
  npi: string
  phone: string
  specialty: string
  website: string
  events: { type: string; date: string; detail: string }[]
  documents: { title: string; path: string }[]
  stageHistory: { stage: string; enteredAt: string }[]
  relationships: { type: string; targetType: string; target: string }[]
  scoring: { leadScore: number }
  suggestedNextActions: string[]
  activity: { lastActivityAt: string | null; staleDays: number | null }
}

function stageActionSuggestions(stage: string, staleDays: number | null): string[] {
  const normalized = stage.toLowerCase()
  const byStage: Record<string, string[]> = {
    prospecting: ['Send a tailored intro with one concrete value point.', 'Confirm contact ownership and outreach channel.'],
    qualified: ['Book discovery with decision-maker and influencer.', 'Validate urgency, budget, and timeline in writing.'],
    demo: ['Run a role-specific demo tied to workflow pain.', 'Share a recap with implementation path and owners.'],
    negotiation: ['Align legal/procurement stakeholders and timeline.', 'Propose a dated mutual close plan.'],
    'closed-won': ['Capture implementation milestones and owners.', 'Schedule kickoff and define success metrics.'],
    'closed-lost': ['Document loss reason and competitive signal.', 'Set a re-engagement date with trigger criteria.'],
  }
  const suggestions = [...(byStage[normalized] || ['Review lead context and define the highest-impact next step.'])]
  if (staleDays !== null && staleDays > 14) {
    suggestions.push(`No recent activity in ${staleDays} days; prioritize follow-up.`)
  }
  return suggestions
}

// `leadId` resolves in this order: `l.id` -> `l.npi` -> `l.name`.
export async function getLeadDetail(leadId: string): Promise<LeadDetail | null> {
  const session = getDriver().session()
  try {
    const result = await session.run(
      `MATCH (l:Lead)
       WHERE coalesce(l.id, '') = $leadId
          OR coalesce(l.npi, '') = $leadId
          OR l.name = $leadId
       OPTIONAL MATCH (l)-[:CURRENT_STAGE]->(s:SalesStage)
       OPTIONAL MATCH (l)-[:USES_EHR]->(e:EHRSystem)
       OPTIONAL MATCH (l)-[:LOCATED_IN]->(t:Territory)
       OPTIONAL MATCH (l)-[:WORKS_AT]->(c:Company)
       RETURN l, s.name AS stage, e.name AS ehr, t.name AS territory, c.name AS company
       LIMIT 1`,
      { leadId },
    )

    if (result.records.length === 0) return null

    const r = result.records[0]
    const l = r.get('l').properties
    const resolvedLeadId = toStr((l as Record<string, unknown>).id) || toStr((l as Record<string, unknown>).npi) || toStr((l as Record<string, unknown>).name)

    const [eventsResult, docsResult, historyResult] = await Promise.all([
      session.run(
        `MATCH (l:Lead)
         WHERE coalesce(l.id, '') = $leadId OR coalesce(l.npi, '') = $leadId OR l.name = $leadId
         OPTIONAL MATCH (l)-[:HAD_EVENT]->(ev:Event)
         RETURN ev.type AS type, ev.date AS date, ev.detail AS detail
         ORDER BY ev.date DESC LIMIT 30`,
        { leadId: resolvedLeadId },
      ),
      session.run(
        `MATCH (l:Lead)
         WHERE coalesce(l.id, '') = $leadId OR coalesce(l.npi, '') = $leadId OR l.name = $leadId
         OPTIONAL MATCH (l)<-[:ABOUT_LEAD]-(d:Document)
         RETURN d.title AS title, d.path AS path
         ORDER BY d.title LIMIT 30`,
        { leadId: resolvedLeadId },
      ),
      session.run(
        `MATCH (l:Lead)
         WHERE coalesce(l.id, '') = $leadId OR coalesce(l.npi, '') = $leadId OR l.name = $leadId
         OPTIONAL MATCH (l)-[:ENTERED_STAGE]->(s:SalesStage)
         RETURN s.name AS stage, s.enteredAt AS enteredAt
         ORDER BY s.enteredAt DESC`,
        { leadId: resolvedLeadId },
      ),
    ])

    const events = eventsResult.records
      .filter(e => e.get('type') || e.get('date') || e.get('detail'))
      .map(e => ({
        type: toStr(e.get('type')),
        date: toStr(e.get('date')),
        detail: toStr(e.get('detail')),
      }))

    const documents = docsResult.records
      .filter(d => d.get('title') || d.get('path'))
      .map(d => ({
        title: toStr(d.get('title')),
        path: toStr(d.get('path')),
      }))

    const stageHistory = historyResult.records
      .filter(h => h.get('stage') || h.get('enteredAt'))
      .map(h => ({
        stage: toStr(h.get('stage')),
        enteredAt: toStr(h.get('enteredAt')),
      }))

    const stage = toStr(r.get('stage')) || toStr((l as Record<string, unknown>).stage)
    const mostRecentActivityIso = normalizeDate((l as Record<string, unknown>).lastActivityAt) || normalizeDate(events[0]?.date)
    const staleDays = mostRecentActivityIso
      ? Math.floor((Date.now() - new Date(mostRecentActivityIso).getTime()) / 86400000)
      : null

    return {
      id: resolvedLeadId,
      name: toStr((l as Record<string, unknown>).name),
      company: toStr(r.get('company')) || toStr((l as Record<string, unknown>).company),
      score: toNum((l as Record<string, unknown>).leadScore),
      businessArm: toStr((l as Record<string, unknown>).businessArm),
      stage,
      ehr: toStr(r.get('ehr')) || toStr((l as Record<string, unknown>).ehr),
      location: toStr((l as Record<string, unknown>).location),
      state: toStr((l as Record<string, unknown>).state),
      territory: toStr(r.get('territory')),
      nextAction: toStr((l as Record<string, unknown>).nextAction),
      source: toStr((l as Record<string, unknown>).leadSource),
      npi: toStr((l as Record<string, unknown>).npi),
      phone: toStr((l as Record<string, unknown>).phone),
      specialty: toStr((l as Record<string, unknown>).specialty),
      website: toStr((l as Record<string, unknown>).website),
      events,
      documents,
      stageHistory,
      relationships: [
        { type: 'WORKS_AT', targetType: 'Company', target: toStr(r.get('company')) || toStr((l as Record<string, unknown>).company) },
        { type: 'USES_EHR', targetType: 'EHRSystem', target: toStr(r.get('ehr')) || toStr((l as Record<string, unknown>).ehr) },
        { type: 'CURRENT_STAGE', targetType: 'SalesStage', target: stage },
        { type: 'LOCATED_IN', targetType: 'Territory', target: toStr(r.get('territory')) || toStr((l as Record<string, unknown>).state) },
      ].filter(rel => rel.target),
      scoring: {
        leadScore: toNum((l as Record<string, unknown>).leadScore),
      },
      suggestedNextActions: stageActionSuggestions(stage, staleDays),
      activity: {
        lastActivityAt: mostRecentActivityIso,
        staleDays,
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
