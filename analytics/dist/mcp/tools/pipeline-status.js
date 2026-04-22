import { getDriver } from "../../shared/connections.js";
export const pipelineStatusSchema = {
    name: "pipeline_status",
    description: "Sales pipeline analytics. Shows leads by stage, territory, EHR system, and scores. Can filter by various criteria.",
    inputSchema: {
        type: "object",
        properties: {
            groupBy: {
                type: "string",
                enum: ["stage", "territory", "ehr", "score", "businessArm"],
                description: "How to group the pipeline data (default: stage)",
            },
            territory: {
                type: "string",
                description: "Filter by territory/state name",
            },
            minScore: {
                type: "number",
                description: "Filter leads with score >= this value",
            },
        },
        required: [],
    },
};
export async function pipelineStatus(args) {
    const driver = getDriver();
    const session = driver.session();
    const groupBy = args.groupBy || "stage";
    try {
        let query;
        const params = {};
        switch (groupBy) {
            case "stage":
                query = `
          MATCH (s:SalesStage)
          OPTIONAL MATCH (l:Lead)-[:CURRENT_STAGE]->(s)
          ${args.minScore ? "WHERE l.leadScore >= $minScore" : ""}
          RETURN s.name AS stage, s.order AS stageOrder, count(l) AS leadCount,
                 avg(l.leadScore) AS avgScore
          ORDER BY s.order
        `;
                if (args.minScore)
                    params.minScore = args.minScore;
                break;
            case "territory":
                query = `
          MATCH (t:Territory {type: 'state'})
          OPTIONAL MATCH (l:Lead)-[:LOCATED_IN]->(t)
          ${args.minScore ? "WHERE l.leadScore >= $minScore" : ""}
          RETURN t.name AS territory, count(l) AS leadCount,
                 avg(l.leadScore) AS avgScore
          ORDER BY leadCount DESC
          LIMIT 20
        `;
                if (args.minScore)
                    params.minScore = args.minScore;
                break;
            case "ehr":
                query = `
          MATCH (e:EHRSystem)
          OPTIONAL MATCH (l:Lead)-[:USES_EHR]->(e)
          ${args.minScore ? "WHERE l.leadScore >= $minScore" : ""}
          RETURN e.name AS ehr, count(l) AS leadCount,
                 avg(l.leadScore) AS avgScore
          ORDER BY leadCount DESC
        `;
                if (args.minScore)
                    params.minScore = args.minScore;
                break;
            case "score":
                query = `
          MATCH (l:Lead)
          WHERE l.leadScore IS NOT NULL
          ${args.minScore ? "AND l.leadScore >= $minScore" : ""}
          ${args.territory ? "MATCH (l)-[:LOCATED_IN]->(t:Territory {name: $territory})" : ""}
          RETURN l.name AS name, l.company AS company, l.leadScore AS score,
                 l.salesFunnel AS funnel, l.location AS location
          ORDER BY l.leadScore DESC
          LIMIT 25
        `;
                if (args.minScore)
                    params.minScore = args.minScore;
                if (args.territory)
                    params.territory = args.territory;
                break;
            case "businessArm":
                query = `
          MATCH (l:Lead)
          WHERE l.businessArm IS NOT NULL AND l.businessArm <> ''
          ${args.minScore ? "AND l.leadScore >= $minScore" : ""}
          RETURN l.businessArm AS businessArm, count(l) AS leadCount,
                 avg(l.leadScore) AS avgScore
          ORDER BY leadCount DESC
        `;
                if (args.minScore)
                    params.minScore = args.minScore;
                break;
            default:
                return `Unknown groupBy value: ${groupBy}. Use: stage, territory, ehr, score, businessArm`;
        }
        const result = await session.run(query, params);
        if (result.records.length === 0) {
            return "No pipeline data found.";
        }
        const keys = result.records[0].keys;
        const rows = result.records.map((record) => {
            const row = {};
            for (const key of keys) {
                const val = record.get(key);
                if (val && typeof val === "object" && "toNumber" in val) {
                    row[key] = val.toNumber();
                }
                else if (typeof val === "number") {
                    row[key] = Math.round(val * 100) / 100;
                }
                else {
                    row[key] = val;
                }
            }
            return row;
        });
        return JSON.stringify(rows, null, 2);
    }
    finally {
        await session.close();
    }
}
