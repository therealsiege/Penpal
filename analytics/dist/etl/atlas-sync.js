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
const ATLAS_API_URL = process.env.GRAPHITE_API_URL || "https://www.graphiteatlas.com";
const ATLAS_TOKEN = process.env.GRAPHITE_ACCESS_TOKEN;
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
async function extractPoints() {
    const points = [];
    const session = getSession();
    try {
        // Leads
        const leadResult = await session.run(QUERIES.leads);
        for (const r of leadResult.records) {
            const name = r.get("name");
            if (!name)
                continue;
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
            if (!name)
                continue;
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
            if (!name)
                continue;
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
            if (!name)
                continue;
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
            if (!name)
                continue;
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
            if (!name)
                continue;
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
    }
    finally {
        await session.close();
    }
    return points;
}
async function extractPaths() {
    const paths = [];
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
        const relMeta = {
            CURRENT_STAGE: { sourceType: "Lead", targetType: "SalesStage" },
            USES_EHR: { sourceType: "Lead", targetType: "EHRSystem" },
            LOCATED_IN: { sourceType: "Lead", targetType: "Territory" },
            WORKS_AT: { sourceType: "Lead", targetType: "Company" },
            COMPETES_WITH: { sourceType: "CompetitorProduct", targetType: "CompetitorProduct" },
        };
        for (const r of relResult.records) {
            const from = r.get("from");
            const to = r.get("to");
            const type = r.get("type");
            if (!from || !to || !type)
                continue;
            const meta = relMeta[type];
            if (!meta)
                continue;
            paths.push({
                type,
                source_name: from,
                source_type: meta.sourceType,
                target_name: to,
                target_type: meta.targetType,
                properties: { syncedAt: new Date().toISOString() },
            });
        }
    }
    finally {
        await session.close();
    }
    return paths;
}
// ── Atlas API helpers ────────────────────────────────────────────────────────
const ATLAS_HEADERS = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${ATLAS_TOKEN}`,
    "User-Agent": "sidekick-atlas-sync/1.0",
    "X-Graphite-Source": "etl",
};
const ATLAS_NAME = process.env.GRAPHITE_ATLAS_NAME || "Sidekick Sales";
async function atlasGet(path) {
    const res = await fetch(`${ATLAS_API_URL}${path}`, { headers: ATLAS_HEADERS });
    if (!res.ok)
        throw new Error(`Atlas GET ${path} failed (${res.status}): ${await res.text()}`);
    const json = await res.json();
    return json.data ?? json;
}
async function atlasPost(path, body) {
    const res = await fetch(`${ATLAS_API_URL}${path}`, {
        method: "POST",
        headers: ATLAS_HEADERS,
        body: JSON.stringify(body),
    });
    if (!res.ok)
        throw new Error(`Atlas POST ${path} failed (${res.status}): ${await res.text()}`);
    const json = await res.json();
    return json.data ?? json;
}
/** Find or create the target atlas, return its ID. */
async function resolveAtlasId() {
    // List atlases
    const data = await atlasGet("/api/atlas");
    const atlases = Array.isArray(data) ? data : [...(data.owned || []), ...(data.shared || [])];
    const existing = atlases.find((a) => a.name === ATLAS_NAME);
    if (existing) {
        console.log(`  Using atlas: "${existing.name}" (${existing.id})`);
        return existing.id;
    }
    // Create new atlas
    console.log(`  Creating atlas: "${ATLAS_NAME}"`);
    const created = await atlasPost("/api/atlas", { name: ATLAS_NAME, description: "Sales intelligence graph synced from Memgraph ETL" });
    console.log(`  Created atlas: ${created.id}`);
    return created.id;
}
// ── Push to Atlas ───────────────────────────────────────────────────────────
async function pushToAtlas(points, paths) {
    const atlasId = await resolveAtlasId();
    const batchSize = 50;
    // Push points first (all of them)
    for (let i = 0; i < points.length; i += batchSize) {
        const batch = points.slice(i, i + batchSize);
        const formatted = batch.map((p) => ({
            name: p.name,
            type: p.type,
            properties: p.properties,
        }));
        await atlasPost(`/api/atlas/${atlasId}/graph/batch`, { points: formatted, paths: [] });
        console.log(`  Points batch ${Math.floor(i / batchSize) + 1}: ${batch.length} upserted`);
    }
    console.log(`  All ${points.length} points pushed.`);
    // Filter paths to only include references to points we actually pushed (by name+type)
    const pointKeys = new Set(points.map((p) => `${p.type}:${p.name}`));
    const validPaths = paths.filter((p) => pointKeys.has(`${p.source_type}:${p.source_name}`) &&
        pointKeys.has(`${p.target_type}:${p.target_name}`));
    const skipped = paths.length - validPaths.length;
    if (skipped > 0)
        console.log(`  Skipping ${skipped} paths with missing endpoints`);
    // Push paths in small batches, skip failures gracefully
    let pathsCreated = 0;
    let pathsFailed = 0;
    for (let i = 0; i < validPaths.length; i += batchSize) {
        const batch = validPaths.slice(i, i + batchSize);
        try {
            await atlasPost(`/api/atlas/${atlasId}/graph/batch`, { points: [], paths: batch });
            pathsCreated += batch.length;
            console.log(`  Paths batch ${Math.floor(i / batchSize) + 1}: ${batch.length} upserted`);
        }
        catch (err) {
            pathsFailed += batch.length;
            console.warn(`  Paths batch ${Math.floor(i / batchSize) + 1}: FAILED (${err.message.slice(0, 120)})`);
        }
    }
    console.log(`  Paths: ${pathsCreated} created, ${pathsFailed} failed`);
}
const VIEW_DEFS = [
    // Pipeline views
    {
        name: "Hot Leads",
        description: "Leads with score >= 45 — ready for outreach",
        viewType: "combo",
        layout: "force",
        filter: (p) => p.type === "Lead" && typeof p.properties?.score === "number" && p.properties.score >= 45,
        folder: "Pipeline",
    },
    {
        name: "Pipeline by Stage",
        description: "All leads with their current sales stage — full funnel view",
        viewType: "map",
        layout: "hierarchical",
        filter: (p) => p.type === "Lead" || p.type === "SalesStage",
        folder: "Pipeline",
    },
    {
        name: "New Leads (Recent)",
        description: "Recently created leads for triage",
        viewType: "table",
        filter: (p) => p.type === "Lead",
        folder: "Pipeline",
    },
    // Territory views
    {
        name: "Territory Map",
        description: "Leads organized by territory — geographic coverage",
        viewType: "map",
        layout: "force",
        filter: (p) => p.type === "Lead" || p.type === "Territory",
        folder: "Territories",
    },
    // EHR / Technology views
    {
        name: "EHR Landscape",
        description: "Which leads use which EHR systems — technology distribution",
        viewType: "map",
        layout: "force",
        filter: (p) => p.type === "Lead" || p.type === "EHRSystem",
        folder: "Technology",
    },
    // Competitive views
    {
        name: "Competitive Landscape",
        description: "Competitor products and their relationships",
        viewType: "map",
        layout: "force",
        filter: (p) => p.type === "CompetitorProduct",
        folder: "Intelligence",
    },
    {
        name: "Companies & Leads",
        description: "Leads mapped to their employer companies",
        viewType: "map",
        layout: "force",
        filter: (p) => p.type === "Lead" || p.type === "Company",
        folder: "Intelligence",
    },
    // Business arm views
    {
        name: "MedScrub Leads",
        description: "Clinical screening product leads",
        viewType: "combo",
        filter: (p) => p.type === "Lead" && String(p.properties?.businessArm || "").toLowerCase() === "medscrub",
        folder: "Ventures",
    },
    {
        name: "MedHook Leads",
        description: "Integration product leads",
        viewType: "combo",
        filter: (p) => p.type === "Lead" && String(p.properties?.businessArm || "").toLowerCase() === "medhook",
        folder: "Ventures",
    },
    {
        name: "1Putt Consulting Leads",
        description: "Health IT consulting leads",
        viewType: "combo",
        filter: (p) => p.type === "Lead" && String(p.properties?.businessArm || "").toLowerCase() === "1putt",
        folder: "Ventures",
    },
];
async function createComposableViews(atlasId) {
    console.log("\nCreating composable views...");
    const cypherResult = await atlasPost(`/api/atlas/${atlasId}/graph/query/cypher`, {
        query: "MATCH (n:Point {atlasId: $atlasId}) RETURN n.id AS id, n.name AS name, n.type AS type, n.properties AS properties",
        parameters: { atlasId },
    });
    const rawList = Array.isArray(cypherResult) ? cypherResult : (cypherResult.results || []);
    // Parse stringified properties and merge into top-level for filter access
    const pointList = rawList.map((p) => {
        let props = p.properties;
        if (typeof props === "string") {
            try {
                props = JSON.parse(props);
            }
            catch {
                props = {};
            }
        }
        return { ...p, properties: (props || {}) };
    });
    console.log(`  Fetched ${pointList.length} points for view filtering`);
    // Get existing views to avoid duplicates
    const existingViews = await atlasGet(`/api/atlas/${atlasId}/views`);
    const viewList = Array.isArray(existingViews) ? existingViews : (existingViews.views || []);
    const existingNames = new Set(viewList.map((v) => v.name));
    // Collect folder names we need
    const folderNames = [...new Set(VIEW_DEFS.map((v) => v.folder).filter(Boolean))];
    // Create folders first
    const folderIds = {};
    for (const folderName of folderNames) {
        // Get current hierarchy to check if folder exists
        const hierarchy = await atlasGet(`/api/atlas/${atlasId}/views/hierarchy`);
        const nodes = hierarchy.hierarchy?.nodes
            || hierarchy.nodes
            || [];
        const existing = nodes.find((n) => n.type === "group" && n.name === folderName);
        if (existing) {
            folderIds[folderName] = existing.id;
        }
        else {
            // Create folder via hierarchy update
            const folderId = `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const maxOrder = nodes.reduce((max, n) => Math.max(max, n.order || 0), 0);
            const updated = [
                ...nodes,
                { id: folderId, name: folderName, type: "group", order: maxOrder + 1, children: [], expanded: true, isExpanded: true },
            ];
            await fetch(`${ATLAS_API_URL}/api/atlas/${atlasId}/views/hierarchy`, {
                method: "PUT",
                headers: ATLAS_HEADERS,
                body: JSON.stringify({ hierarchy: { nodes: updated } }),
            });
            folderIds[folderName] = folderId;
            console.log(`  Created folder: "${folderName}"`);
        }
    }
    // Create or update each view
    const existingViewMap = new Map(viewList.map((v) => [v.name, v.id]));
    for (const def of VIEW_DEFS) {
        // Filter points for this view
        const matching = pointList.filter(def.filter);
        if (matching.length === 0) {
            console.log(`  Skipping "${def.name}" (0 matching points)`);
            continue;
        }
        const pointIds = matching.map((p) => p.id);
        let viewId = existingViewMap.get(def.name);
        // Create view if it doesn't exist
        if (!viewId) {
            const view = await atlasPost(`/api/atlas/${atlasId}/views`, {
                name: def.name,
                description: def.description,
                viewType: def.viewType,
                settings: { layout: def.layout || "force" },
            });
            viewId = view.id || view.view?.id;
            console.log(`  Created "${def.name}" (${def.viewType})`);
            // Move to folder if specified
            if (def.folder && folderIds[def.folder] && viewId) {
                const hierarchy = await atlasGet(`/api/atlas/${atlasId}/views/hierarchy`);
                const nodes = (hierarchy.hierarchy?.nodes
                    || hierarchy.nodes
                    || []);
                const updated = nodes.map((n) => {
                    if (n.id === viewId)
                        return { ...n, parentId: folderIds[def.folder] };
                    if (n.type === "group" && n.id === folderIds[def.folder]) {
                        const children = n.children || [];
                        if (!children.includes(viewId))
                            return { ...n, children: [...children, viewId] };
                    }
                    return n;
                });
                if (!updated.some((n) => n.id === viewId)) {
                    updated.push({ id: viewId, type: "view", parentId: folderIds[def.folder], children: [] });
                }
                await fetch(`${ATLAS_API_URL}/api/atlas/${atlasId}/views/hierarchy`, {
                    method: "PUT",
                    headers: ATLAS_HEADERS,
                    body: JSON.stringify({ hierarchy: { nodes: updated } }),
                });
            }
        }
        // Populate view with points (batch in chunks of 100)
        if (viewId) {
            for (let i = 0; i < pointIds.length; i += 100) {
                const batch = pointIds.slice(i, i + 100);
                await atlasPost(`/api/atlas/${atlasId}/views/${viewId}/points`, { pointIds: batch });
            }
            console.log(`  Populated "${def.name}" — ${pointIds.length} points`);
        }
    }
}
// ── Helpers ──────────────────────────────────────────────────────────────────
function toNum(val) {
    if (val == null)
        return null;
    if (typeof val === "number")
        return val;
    if (typeof val === "object" && "toNumber" in val) {
        return val.toNumber();
    }
    return Number(val) || null;
}
// ── Main ────────────────────────────────────────────────────────────────────
export async function syncToAtlas(opts) {
    const dryRun = opts?.dryRun ?? false;
    if (!ATLAS_TOKEN) {
        console.error("GRAPHITE_ACCESS_TOKEN not set. Skipping Atlas sync.");
        return;
    }
    console.log("=== Graphite Atlas Sync ===");
    console.log(`Target: ${ATLAS_API_URL}`);
    const points = await extractPoints();
    const paths = await extractPaths();
    const typeCounts = points.reduce((acc, p) => {
        acc[p.type] = (acc[p.type] || 0) + 1;
        return acc;
    }, {});
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
    // Create composable views after data is pushed
    const atlasId = await resolveAtlasId();
    await createComposableViews(atlasId);
    console.log(`\nAtlas sync complete: ${points.length} points, ${paths.length} paths.`);
}
// Run standalone: npm run atlas:sync [-- --dry-run]
if (process.argv[1]?.endsWith("atlas-sync.ts") || process.argv[1]?.endsWith("atlas-sync.js")) {
    syncToAtlas({ dryRun: process.argv.includes("--dry-run") })
        .then(() => closeConnections())
        .catch(async (err) => {
        console.error("Atlas sync failed:", err);
        await closeConnections().catch(() => { });
        process.exit(1);
    });
}
