/**
 * wiki-queries.ts
 *
 * Cypher queries that fetch high-value entities and their relationships
 * from Memgraph. Uses WITH clauses between OPTIONAL MATCHes as required
 * by Memgraph's Cypher implementation.
 */

import type { Session } from "neo4j-driver";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toStr(val: unknown): string {
  if (val == null) return "";
  return String(val);
}

function toNum(val: unknown): number {
  if (val && typeof val === "object" && "toNumber" in val) {
    return (val as { toNumber(): number }).toNumber();
  }
  return typeof val === "number" ? val : 0;
}

// ---------------------------------------------------------------------------
// Entity result types
// ---------------------------------------------------------------------------

export interface WikiCompany {
  name: string;
  type: string;
  funding: string;
  hq: string;
  people: Array<{ name: string; role: string }>;
  products: Array<{ name: string; category: string; pricing: string }>;
  competitors: string[];
  technologies: string[];
  documents: Array<{ title: string; relativePath: string }>;
}

export interface WikiPerson {
  name: string;
  company: string;
  role: string;
  title: string;
  documents: Array<{ title: string; relativePath: string }>;
  companies: string[];
}

export interface WikiTechnology {
  name: string;
  category: string;
  companies: string[];
  documents: Array<{ title: string; relativePath: string }>;
}

export interface WikiLead {
  name: string;
  company: string;
  location: string;
  jobTitle: string;
  type: string;
  emr: string;
  leadScore: number;
  businessArm: string;
  stage: string;
  nextAction: string;
  notes: string;
  createdAt: string;
  practices: Array<{ name: string; npi: string; specialty: string }>;
  events: Array<{ type: string; description: string; date: string }>;
}

export interface WikiProduct {
  name: string;
  company: string;
  category: string;
  pricing: string;
  features: string;
  customerCount: string;
  positioning: string;
  funding: string;
}

// ---------------------------------------------------------------------------
// Curated queries — only high-value entities
// ---------------------------------------------------------------------------

/** Companies with 3+ relationships (people, products, competitors, or document mentions) */
export async function getCompanies(session: Session, minRels = 3): Promise<WikiCompany[]> {
  const result = await session.run(`
    MATCH (c:Company)
    OPTIONAL MATCH (p:Person)-[:WORKS_AT]->(c)
    WITH c, collect(DISTINCT {name: p.name, role: p.role}) AS people
    OPTIONAL MATCH (c)-[:HAS_PRODUCT]->(cp:CompetitorProduct)
    WITH c, people, collect(DISTINCT {name: cp.name, category: cp.category, pricing: cp.pricing}) AS products
    OPTIONAL MATCH (c)-[:COMPETES_WITH]-(rival:Company)
    WITH c, people, products, collect(DISTINCT rival.name) AS competitors
    OPTIONAL MATCH (d:Document)-[:MENTIONS_COMPANY]->(c)
    WITH c, people, products, competitors, collect(DISTINCT {title: d.title, relativePath: d.relativePath}) AS documents
    OPTIONAL MATCH (c)-[:MENTIONS_TECH]->(t:Technology)
    WITH c, people, products, competitors, documents, collect(DISTINCT t.name) AS technologies
    WITH c, people, products, competitors, documents, technologies,
         size(people) + size(products) + size(competitors) + size(documents) AS relCount
    WHERE relCount >= $minRels
    RETURN c.name AS name, c.type AS type, c.funding AS funding, c.hq AS hq,
           people, products, competitors, documents, technologies
    ORDER BY relCount DESC
  `, { minRels });

  return result.records.map((r) => ({
    name: toStr(r.get("name")),
    type: toStr(r.get("type")),
    funding: toStr(r.get("funding")),
    hq: toStr(r.get("hq")),
    people: (r.get("people") as any[]).filter((p) => p.name),
    products: (r.get("products") as any[]).filter((p) => p.name),
    competitors: (r.get("competitors") as string[]).filter(Boolean),
    technologies: (r.get("technologies") as string[]).filter(Boolean),
    documents: (r.get("documents") as any[]).filter((d) => d.title),
  }));
}

/** All people in the graph (usually curated via dictionary seeding) */
export async function getPeople(session: Session): Promise<WikiPerson[]> {
  const result = await session.run(`
    MATCH (p:Person)
    OPTIONAL MATCH (p)-[:WORKS_AT]->(c:Company)
    WITH p, collect(DISTINCT c.name) AS companies
    OPTIONAL MATCH (d:Document)-[:MENTIONS_PERSON]->(p)
    RETURN p.name AS name, p.company AS company, p.role AS role, p.title AS title,
           companies,
           collect(DISTINCT {title: d.title, relativePath: d.relativePath}) AS documents
    ORDER BY name
  `);

  return result.records.map((r) => ({
    name: toStr(r.get("name")),
    company: toStr(r.get("company")),
    role: toStr(r.get("role")),
    title: toStr(r.get("title")),
    companies: (r.get("companies") as string[]).filter(Boolean),
    documents: (r.get("documents") as any[]).filter((d) => d.title),
  }));
}

/** Technologies mentioned in 2+ documents */
export async function getTechnologies(session: Session, minDocs = 2): Promise<WikiTechnology[]> {
  const result = await session.run(`
    MATCH (t:Technology)
    OPTIONAL MATCH (c:Company)-[:MENTIONS_TECH]->(t)
    WITH t, collect(DISTINCT c.name) AS companies
    OPTIONAL MATCH (d:Document)-[:MENTIONS_TECH]->(t)
    WITH t, companies, collect(DISTINCT {title: d.title, relativePath: d.relativePath}) AS documents
    WHERE size(documents) >= $minDocs
    RETURN t.name AS name, t.category AS category,
           companies, documents
    ORDER BY size(documents) DESC
  `, { minDocs });

  return result.records.map((r) => ({
    name: toStr(r.get("name")),
    category: toStr(r.get("category")),
    companies: (r.get("companies") as string[]).filter(Boolean),
    documents: (r.get("documents") as any[]).filter((d) => d.title),
  }));
}

/** Top leads by score (minimum 30) */
export async function getLeads(session: Session, minScore = 30, limit = 50): Promise<WikiLead[]> {
  // Memgraph requires LIMIT as a literal integer, not a parameter
  const result = await session.run(`
    MATCH (l:Lead)
    WHERE l.leadScore >= $minScore
    OPTIONAL MATCH (l)-[:CURRENT_STAGE]->(s:SalesStage)
    WITH l, collect(s.name)[0] AS stage
    OPTIONAL MATCH (l)-[:PRACTICES_AT]->(pr:Practice)
    WITH l, stage, collect(DISTINCT {name: pr.name, npi: pr.npi, specialty: pr.specialty}) AS practices
    OPTIONAL MATCH (l)-[:HAD_EVENT]->(e:Event)
    WITH l, stage, practices, collect(DISTINCT {type: e.type, description: e.description, date: e.date}) AS events
    RETURN l.name AS name, l.company AS company, l.location AS location,
           l.jobTitle AS jobTitle, l.type AS type, l.emr AS emr,
           l.leadScore AS leadScore, l.businessArm AS businessArm,
           l.nextAction AS nextAction, l.notes AS notes, l.createdAt AS createdAt,
           stage, practices, events
    ORDER BY leadScore DESC
    LIMIT ${Math.floor(limit)}
  `, { minScore });

  return result.records.map((r) => ({
    name: toStr(r.get("name")),
    company: toStr(r.get("company")),
    location: toStr(r.get("location")),
    jobTitle: toStr(r.get("jobTitle")),
    type: toStr(r.get("type")),
    emr: toStr(r.get("emr")),
    leadScore: toNum(r.get("leadScore")),
    businessArm: toStr(r.get("businessArm")),
    stage: toStr(r.get("stage")),
    nextAction: toStr(r.get("nextAction")),
    notes: toStr(r.get("notes")),
    createdAt: toStr(r.get("createdAt")),
    practices: (r.get("practices") as any[]).filter((p) => p.name),
    events: (r.get("events") as any[]).filter((e) => e.type),
  }));
}

/** All competitor products (always curated, small set) */
export async function getCompetitorProducts(session: Session): Promise<WikiProduct[]> {
  const result = await session.run(`
    MATCH (cp:CompetitorProduct)
    OPTIONAL MATCH (c:Company)-[:HAS_PRODUCT]->(cp)
    RETURN cp.name AS name, c.name AS company, cp.category AS category,
           cp.pricing AS pricing, cp.features AS features,
           cp.customerCount AS customerCount, cp.positioning AS positioning,
           cp.funding AS funding
    ORDER BY cp.name
  `);

  return result.records.map((r) => ({
    name: toStr(r.get("name")),
    company: toStr(r.get("company")),
    category: toStr(r.get("category")),
    pricing: toStr(r.get("pricing")),
    features: toStr(r.get("features")),
    customerCount: toStr(r.get("customerCount")),
    positioning: toStr(r.get("positioning")),
    funding: toStr(r.get("funding")),
  }));
}
