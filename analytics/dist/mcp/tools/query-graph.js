import { getDriver } from "../../shared/connections.js";
export const queryGraphSchema = {
    name: "query_graph",
    description: "Run a Cypher query against the Memgraph knowledge graph. Use this for structured graph traversals, relationship queries, and analytics. Document, Folder, and Lead nodes have a 'venture' property (e.g. 'openloop', '1putt') for filtering by venture. Available node types: Document, Folder, Tag, Person, Company, Technology, EHRSystem, Skill, Regulation, Lead, Market, Event, SalesStage, Territory, Practice, BillingCode, Program, Specialty, CompetitorProduct. Relationship types: IN_FOLDER, PARENT_FOLDER, TAGGED_WITH, LINKS_TO, MENTIONS_COMPANY, MENTIONS_PERSON, MENTIONS_TECH, MENTIONS_EHR, MENTIONS_SKILL, MENTIONS_REGULATION, ABOUT_LEAD, WORKS_AT, COMPETES_WITH, CONTACT_AT, USES_EHR, OPERATES_IN, ADDRESSES, HAD_EVENT, REPORTED_IN, CURRENT_STAGE, ENTERED_STAGE, LOCATED_IN, PART_OF, ENABLES_BILLING, PART_OF_PROGRAM, ELIGIBLE_FOR, PRACTICES_AT, IN_SPECIALTY, ELIGIBLE_SPECIALTY, HAS_PRODUCT.",
    inputSchema: {
        type: "object",
        properties: {
            cypher: {
                type: "string",
                description: "Cypher query to execute",
            },
        },
        required: ["cypher"],
    },
};
export async function queryGraph(args) {
    // Basic safety check — block destructive queries
    const upper = args.cypher.toUpperCase().trim();
    if (upper.includes("DELETE") ||
        upper.includes("REMOVE") ||
        upper.includes("DROP") ||
        upper.includes("CREATE CONSTRAINT") ||
        upper.includes("CREATE INDEX")) {
        return "Error: Destructive or DDL queries are not allowed through the MCP server. Use read-only queries.";
    }
    const driver = getDriver();
    const session = driver.session();
    try {
        const result = await session.run(args.cypher);
        if (result.records.length === 0) {
            return "Query returned no results.";
        }
        // Format results as a table
        const keys = result.records[0].keys;
        const rows = result.records.map((record) => {
            const row = {};
            for (const key of keys) {
                const val = record.get(key);
                // Handle Neo4j integer types
                if (val && typeof val === "object" && "toNumber" in val) {
                    row[key] = val.toNumber();
                }
                else if (val && typeof val === "object" && "properties" in val) {
                    row[key] = val.properties;
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
