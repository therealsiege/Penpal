/**
 * Atlas Graph Sync — pushes curated entities from Memgraph to Graphite Atlas.
 *
 * Reads Leads, Companies, EHR Systems, Territories, SalesStages, and
 * CompetitorProducts from Memgraph, transforms them into Atlas Points/Paths,
 * and upserts via the Graphite Atlas REST API.
 *
 * Usage:
 *   npm run atlas:sync
 *   npm run atlas:sync -- --dry-run
 */

import "dotenv/config";
import { getSession, closeConnections } from "../shared/connections.js";

const ATLAS_API_URL =
  process.env.GRAPHITE_API_URL || "https://www.graphiteatlas.com";
const ATLAS_TOKEN = process.env.GRAPHITE_ACCESS_TOKEN;

interface AtlasPoint {
  name: string;
  type: string;
  properties: Record<string, unknown>;
}

interface AtlasPath {
  type: string;
  source_name: string;
  source_type: string;
  target_name: string;
  target_type: string;
  properties?: Record<string, unknown>;
}

// ── Cypher Queries ──────────────────────────────────────────────────────────

const QUERIES = {
  leads: `
    MATCH (l:Lead)
    OPTIONAL MATCH (l)-[:CURRENT_STAGE]->(s:SalesStage)
    OPTIONAL MATCH (l)-[:USES_EHR]->(e:EHRSystem)
    OPTIONAL MATCH (l)-[:LOCATED_IN]->(t:Territory)
    OPTIONAL MATCH (l)-[:WORKS_AT]->(c:Company)
    RETURN l.name AS name, l.company AS company, l.leadScore AS score,
           l.businessArm AS businessArm, l.location AS location,
           l.nextAction AS nextAction, l.leadSource AS source,
           l.npi AS npi, l.specialty AS specialty,
           s.name AS stage, e.name AS ehr, t.name AS territory,
           c.name AS linkedCompany
  `,
  companies: `
    MATCH (c:Company)
    RETURN DISTINCT c.name AS name, c.industry AS industry,
           c.website AS website, c.size AS size
  `,
  ehrSystems: `
    MATCH (e:EHRSystem)
    RETURN DISTINCT e.name AS name, e.vendor AS vendor
  `,
  territories: `
    MATCH (t:Territory)
    RETURN DISTINCT t.name AS name, t.state AS state, t.region AS region
  `,
  salesStages: `
    MATCH (s:SalesStage)
    RETURN DISTINCT s.name AS name, s.order AS stageOrder
  `,
  competitorProducts: `
    MATCH (cp:CompetitorProduct)
    RETURN DISTINCT cp.name AS name, cp.company AS company,
           cp.category AS category, cp.pricing AS pricing
  `,
};

// ── Extract from Memgraph ───────────────────────────────────────────────────

async function extractPoints(): Promise<AtlasPoint[]> {
  const points: AtlasPoint[] = [];
  const session = getSession();

  try {
    // Leads
    const leadResult = await session.run(QUERIES.leads);
    for (const r of leadResult.records) {
      const name = r.get("name");
      if (!name) continue;
      points.push({
        name,
        type: "Lead",
        properties: {
          company: r.get("company"),
          score: toNum(r.get("score")),
          businessArm: r.get("businessArm"),
          location: r.get("location"),
          nextAction: r.get("nextAction"),
          source: r.get("source"),
          npi: r.get("npi"),
          specialty: r.get("specialty"),
          stage: r.get("stage"),
          ehr: r.get("ehr"),
          territory: r.get("territory"),
          linkedCompany: r.get("linkedCompany"),
          syncedAt: new Date().toISOString(),
        },
      });
    }

    // Companies
    const compResult = await session.run(QUERIES.companies);
    for (const r of compResult.records) {
      const name = r.get("name");
      if (!name) continue;
      points.push({
        name,
        type: "Company",
        properties: {
          industry: r.get("industry"),
          website: r.get("website"),
          size: r.get("size"),
          syncedAt: new Date().toISOString(),
        },
      });
    }

    // EHR Systems
    const ehrResult = await session.run(QUERIES.ehrSystems);
    for (const r of ehrResult.records) {
      const name = r.get("name");
      if (!name) continue;
      points.push({
        name,
        type: "EHRSystem",
        properties: { vendor: r.get("vendor"), syncedAt: new Date().toISOString() },
      });
    }

    // Territories
    const terrResult = await session.run(QUERIES.territories);
    for (const r of terrResult.records) {
      const name = r.get("name");
      if (!name) continue;
      points.push({
        name,
        type: "Territory",
        properties: { state: r.get("state"), region: r.get("region"), syncedAt: new Date().toISOString() },
      });
    }

    // Sales Stages
    const stageResult = await session.run(QUERIES.salesStages);
    for (const r of stageResult.records) {
      const name = r.get("name");
      if (!name) continue;
      points.push({
        name,
        type: "SalesStage",
        properties: { stageOrder: toNum(r.get("stageOrder")), syncedAt: new Date().toISOString() },
      });
    }

    // Competitor Products
    const cpResult = await session.run(QUERIES.competitorProducts);
    for (const r of cpResult.records) {
      const name = r.get("name");
      if (!name) continue;
      points.push({
        name,
        type: "CompetitorProduct",
        properties: {
          company: r.get("company"),
          category: r.get("category"),
          pricing: r.get("pricing"),
          syncedAt: new Date().toISOString(),
        },
      });
    }
  } finally {
    await session.close();
  }

  return points;
}

async function extractPaths(): Promise<AtlasPath[]> {
  const paths: AtlasPath[] = [];
  const session = getSession();

  try {
    // Lead relationships
    const relResult = await session.run(`
      MATCH (l:Lead)-[:CURRENT_STAGE]->(s:SalesStage) RETURN l.name AS from, s.name AS to, 'CURRENT_STAGE' AS type
      UNION ALL
      MATCH (l:Lead)-[:USES_EHR]->(e:EHRSystem) RETURN l.name AS from, e.name AS to, 'USES_EHR' AS type
      UNION ALL
      MATCH (l:Lead)-[:LOCATED_IN]->(t:Territory) RETURN l.name AS from, t.name AS to, 'LOCATED_IN' AS type
      UNION ALL
      MATCH (l:Lead)-[:WORKS_AT]->(c:Company) RETURN l.name AS from, c.name AS to, 'WORKS_AT' AS type
      UNION ALL
      MATCH (cp:CompetitorProduct)-[:COMPETES_WITH]->(cp2:CompetitorProduct) RETURN cp.name AS from, cp2.name AS to, 'COMPETES_WITH' AS type
    `);

    const typeToTargetType: Record<string, string> = {
      CURRENT_STAGE: "SalesStage",
      USES_EHR: "EHRSystem",
      LOCATED_IN: "Territory",
      WORKS_AT: "Company",
      COMPETES_WITH: "CompetitorProduct",
    };

    for (const r of relResult.records) {
      const from = r.get("from");
      const to = r.get("to");
      const type = r.get("type");
      if (!from || !to || !type) continue;

      paths.push({
        type,
        source_name: from,
        source_type: "Lead",
        target_name: to,
        target_type: typeToTargetType[type] || "Unknown",
        properties: { syncedAt: new Date().toISOString() },
      });
    }
  } finally {
    await session.close();
  }

  return paths;
}

// ── Push to Atlas ───────────────────────────────────────────────────────────

async function pushToAtlas(points: AtlasPoint[], paths: AtlasPath[]): Promise<void> {
  const batchSize = 100;

  // Push points in batches
  for (let i = 0; i < points.length; i += batchSize) {
    const batch = points.slice(i, i + batchSize);
    const res = await fetch(`${ATLAS_API_URL}/api/v1/graph/batch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ATLAS_TOKEN}`,
      },
      body: JSON.stringify({ points: batch, paths: [] }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Atlas batch points failed (${res.status}): ${body}`);
    }
    console.log(`  Points batch ${Math.floor(i / batchSize) + 1}: ${batch.length} upserted`);
  }

  // Push paths in batches
  for (let i = 0; i < paths.length; i += batchSize) {
    const batch = paths.slice(i, i + batchSize);
    const res = await fetch(`${ATLAS_API_URL}/api/v1/graph/batch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ATLAS_TOKEN}`,
      },
      body: JSON.stringify({ points: [], paths: batch }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Atlas batch paths failed (${res.status}): ${body}`);
    }
    console.log(`  Paths batch ${Math.floor(i / batchSize) + 1}: ${batch.length} upserted`);
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function toNum(val: unknown): number | null {
  if (val == null) return null;
  if (typeof val === "number") return val;
  if (typeof val === "object" && "toNumber" in (val as object)) {
    return (val as { toNumber: () => number }).toNumber();
  }
  return Number(val) || null;
}

// ── Main ────────────────────────────────────────────────────────────────────

export async function syncToAtlas(opts?: { dryRun?: boolean }): Promise<void> {
  const dryRun = opts?.dryRun ?? false;

  if (!ATLAS_TOKEN) {
    console.error("GRAPHITE_ACCESS_TOKEN not set. Skipping Atlas sync.");
    return;
  }

  console.log("=== Graphite Atlas Sync ===");
  console.log(`Target: ${ATLAS_API_URL}`);

  const points = await extractPoints();
  const paths = await extractPaths();

  const typeCounts = points.reduce(
    (acc, p) => {
      acc[p.type] = (acc[p.type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  console.log(`\nExtracted from Memgraph:`);
  for (const [type, count] of Object.entries(typeCounts)) {
    console.log(`  ${type}: ${count}`);
  }
  console.log(`  Relationships: ${paths.length}`);

  if (dryRun) {
    console.log("\n[DRY RUN] Would push above to Atlas. Exiting.");
    return;
  }

  console.log("\nPushing to Atlas...");
  await pushToAtlas(points, paths);

  console.log(`\nAtlas sync complete: ${points.length} points, ${paths.length} paths.`);
}

// Run standalone: npm run atlas:sync [-- --dry-run]
if (process.argv[1]?.endsWith("atlas-sync.ts") || process.argv[1]?.endsWith("atlas-sync.js")) {
  syncToAtlas({ dryRun: process.argv.includes("--dry-run") })
    .then(() => closeConnections())
    .catch(async (err) => {
      console.error("Atlas sync failed:", err);
      await closeConnections().catch(() => {});
      process.exit(1);
    });
}
