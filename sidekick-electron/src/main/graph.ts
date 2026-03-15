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

// ── Cleanup ─────────────────────────────────────────────────────────────────

export async function closeGraph() {
  if (driver) {
    await driver.close()
    driver = null
  }
}
