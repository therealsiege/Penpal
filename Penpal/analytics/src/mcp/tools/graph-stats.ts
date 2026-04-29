import { getDriver } from "../../shared/connections.js";

export const graphStatsSchema = {
  name: "graph_stats",
  description:
    "Get knowledge graph statistics: node and edge counts by type, lead pipeline summary by stage, and data freshness indicators including latest ETL activity.",
  inputSchema: {
    type: "object" as const,
    properties: {},
    required: [],
  },
};

export async function graphStats(): Promise<string> {
  let session;
  try {
    const driver = getDriver();
    session = driver.session();
  } catch {
    return JSON.stringify({
      error: "Memgraph unavailable",
      status: "offline",
      message: "Could not connect to Memgraph. Ensure the database is running on bolt://localhost:7687.",
    });
  }

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
        LIMIT 25
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
    ]);

    const nodesByLabel: Record<string, number> = {};
    let totalNodes = 0;
    for (const r of nodeResult.records) {
      const label = String(r.get("label") ?? "");
      const cnt = toNum(r.get("cnt"));
      nodesByLabel[label] = cnt;
      totalNodes += cnt;
    }

    const relsByType: Record<string, number> = {};
    let totalRelationships = 0;
    for (const r of relResult.records) {
      const relType = String(r.get("relType") ?? "");
      const cnt = toNum(r.get("cnt"));
      relsByType[relType] = cnt;
      totalRelationships += cnt;
    }

    const lastUpdate = freshnessResult.records[0]?.get("lastUpdate") ?? null;
    const lastCreated = freshnessResult.records[0]?.get("lastCreated") ?? null;
    const totalLeads = toNum(freshnessResult.records[0]?.get("totalLeads"));

    const lastUpdateStr = lastUpdate ? String(lastUpdate) : null;
    const lastCreatedStr = lastCreated ? String(lastCreated) : null;
    const daysSinceUpdate = lastUpdateStr
      ? Math.floor((Date.now() - new Date(lastUpdateStr).getTime()) / (1000 * 60 * 60 * 24))
      : null;

    const leadsByStage: Record<string, number> = {};
    for (const r of stageResult.records) {
      const stage = String(r.get("stage") ?? "");
      leadsByStage[stage] = toNum(r.get("cnt"));
    }

    return JSON.stringify(
      {
        totalNodes,
        totalRelationships,
        nodesByLabel,
        relsByType,
        totalLeads,
        leadsByStage,
        freshness: {
          lastLeadUpdate: lastUpdateStr,
          lastLeadCreated: lastCreatedStr,
          daysSinceLastUpdate: daysSinceUpdate,
          status:
            daysSinceUpdate === null
              ? "unknown"
              : daysSinceUpdate <= 1
                ? "fresh"
                : daysSinceUpdate <= 7
                  ? "recent"
                  : "stale",
        },
      },
      null,
      2,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return JSON.stringify({
      error: "Memgraph unavailable",
      status: "offline",
      message,
    });
  } finally {
    await session.close();
  }
}

function toNum(val: unknown): number {
  if (val && typeof val === "object" && "toNumber" in val) {
    return (val as { toNumber(): number }).toNumber();
  }
  return typeof val === "number" ? val : 0;
}
