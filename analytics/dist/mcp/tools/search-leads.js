import { getDriver } from "../../shared/connections.js";
export const searchLeadsSchema = {
    name: "search_leads",
    description: "Search leads by name, company, or location with optional filters for state, EHR system, and pipeline stage. Returns scored results with context-engineered metadata including scoring breakdown and suggested next actions.",
    inputSchema: {
        type: "object",
        properties: {
            query: {
                type: "string",
                description: "Search term to match against lead name, company, or location",
            },
            filters: {
                type: "object",
                description: "Optional filters to narrow results",
                properties: {
                    state: {
                        type: "string",
                        description: "Filter by state/territory (e.g., 'TX', 'Tennessee')",
                    },
                    ehr: {
                        type: "string",
                        description: "Filter by EHR system (e.g., 'eClinicalWorks', 'Epic')",
                    },
                    stage: {
                        type: "string",
                        description: "Filter by pipeline stage (e.g., 'Outreach', 'Demo', 'Proposal')",
                    },
                },
            },
        },
        required: ["query"],
    },
};
function suggestAction(stage) {
    switch (stage.toLowerCase()) {
        case "outreach":
            return "Schedule intro call";
        case "qualified":
            return "Schedule discovery call";
        case "demo":
            return "Send proposal";
        case "proposal":
            return "Follow up on proposal";
        case "negotiation":
            return "Address objections and close";
        case "closed won":
            return "Begin onboarding";
        case "closed lost":
            return "Schedule re-engagement in 90 days";
        default:
            return "Review and advance pipeline";
    }
}
function scoringContext(lead) {
    const tier = lead.score >= 70 ? "High-scoring" : lead.score >= 40 ? "Mid-scoring" : "Early-stage";
    const parts = [`${tier} lead`];
    if (lead.stage)
        parts.push(`in ${lead.stage} stage`);
    if (lead.ehr)
        parts.push(`using ${lead.ehr}`);
    if (lead.businessArm)
        parts.push(`(${lead.businessArm})`);
    const action = suggestAction(lead.stage);
    parts.push(`— ${action}`);
    return parts.join(" ");
}
export async function searchLeads(args) {
    const driver = getDriver();
    const session = driver.session();
    try {
        const params = { q: args.query };
        const whereClauses = [
            "(toLower(l.name) CONTAINS toLower($q) OR toLower(l.company) CONTAINS toLower($q) OR toLower(l.location) CONTAINS toLower($q))",
        ];
        if (args.filters?.state) {
            whereClauses.push("t.name = $state");
            params.state = args.filters.state;
        }
        if (args.filters?.ehr) {
            whereClauses.push("e.name = $ehr");
            params.ehr = args.filters.ehr;
        }
        if (args.filters?.stage) {
            whereClauses.push("s.name = $stage");
            params.stage = args.filters.stage;
        }
        const query = `
      MATCH (l:Lead)
      OPTIONAL MATCH (l)-[:CURRENT_STAGE]->(s:SalesStage)
      OPTIONAL MATCH (l)-[:USES_EHR]->(e:EHRSystem)
      OPTIONAL MATCH (l)-[:LOCATED_IN]->(t:Territory)
      WHERE ${whereClauses.join(" AND ")}
      RETURN l.name AS name, l.company AS company,
             l.leadScore AS score, l.businessArm AS businessArm,
             l.nextAction AS nextAction, s.name AS stage,
             e.name AS ehr, l.location AS location,
             l.leadSource AS source, t.name AS territory
      ORDER BY l.leadScore DESC
      LIMIT 30
    `;
        const result = await session.run(query, params);
        if (result.records.length === 0) {
            return JSON.stringify({
                results: [],
                total: 0,
                message: `No leads found matching "${args.query}"${args.filters ? " with the given filters" : ""}.`,
            });
        }
        const leads = result.records.map((r) => {
            const lead = {
                name: r.get("name") ?? "",
                company: r.get("company") ?? "",
                score: toNum(r.get("score")),
                businessArm: r.get("businessArm") ?? "",
                stage: r.get("stage") ?? "",
                ehr: r.get("ehr") ?? "",
                location: r.get("location") ?? "",
                territory: r.get("territory") ?? "",
                nextAction: r.get("nextAction") ?? "",
                source: r.get("source") ?? "",
                scoringContext: "",
                suggestedAction: "",
            };
            lead.scoringContext = scoringContext(lead);
            lead.suggestedAction = suggestAction(lead.stage);
            return lead;
        });
        return JSON.stringify({
            results: leads,
            total: leads.length,
            query: args.query,
            filtersApplied: args.filters || {},
        }, null, 2);
    }
    finally {
        await session.close();
    }
}
function toNum(val) {
    if (val && typeof val === "object" && "toNumber" in val) {
        return val.toNumber();
    }
    return typeof val === "number" ? val : 0;
}
