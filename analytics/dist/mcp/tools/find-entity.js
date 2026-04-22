import { getDriver } from "../../shared/connections.js";
export const findEntitySchema = {
    name: "find_entity",
    description: "Look up a company, person, technology, or other entity in the knowledge graph. Returns the entity's properties and all its relationships with other entities.",
    inputSchema: {
        type: "object",
        properties: {
            name: {
                type: "string",
                description: "Entity name to search for (case-insensitive partial match)",
            },
            type: {
                type: "string",
                description: "Entity type filter: Company, Person, Technology, EHRSystem, Skill, Regulation, Market, Lead",
            },
            venture: {
                type: "string",
                description: "Filter by venture: openloop, 1putt. Only applies to Document and Lead nodes. Omit for all.",
            },
        },
        required: ["name"],
    },
};
export async function findEntity(args) {
    const driver = getDriver();
    const session = driver.session();
    try {
        // Find the entity by name (case-insensitive)
        const labelFilter = args.type ? `:${args.type}` : "";
        const ventureClause = args.venture ? ` AND e.venture = $venture` : "";
        const findQuery = `
      MATCH (e${labelFilter})
      WHERE e.name IS NOT NULL AND toLower(e.name) CONTAINS toLower($name)${ventureClause}
      RETURN e, labels(e) AS labels
      LIMIT 5
    `;
        const findResult = await session.run(findQuery, { name: args.name, venture: args.venture || "" });
        if (findResult.records.length === 0) {
            return `No entity found matching "${args.name}"${args.type ? ` of type ${args.type}` : ""}.`;
        }
        const results = [];
        for (const record of findResult.records) {
            const entity = record.get("e");
            const labels = record.get("labels");
            const props = entity.properties;
            // Get all relationships
            const relQuery = `
        MATCH (e {id: $id})-[r]-(other)
        RETURN type(r) AS relType,
               CASE WHEN startNode(r) = e THEN 'outgoing' ELSE 'incoming' END AS direction,
               labels(other)[0] AS otherLabel,
               other.name AS otherName,
               properties(r) AS relProps
        ORDER BY relType
        LIMIT 50
      `;
            const relResult = await session.run(relQuery, { id: props.id });
            let output = `## ${labels.join(", ")}: ${props.name}\n`;
            output += `Properties: ${JSON.stringify(props, null, 2)}\n`;
            if (relResult.records.length > 0) {
                output += `\nRelationships (${relResult.records.length}):\n`;
                for (const rel of relResult.records) {
                    const dir = rel.get("direction") === "outgoing" ? "\u2192" : "\u2190";
                    const relType = rel.get("relType");
                    const otherLabel = rel.get("otherLabel");
                    const otherName = rel.get("otherName") || "(unnamed)";
                    output += `  ${dir} ${relType} ${dir === "\u2192" ? "\u2192" : "\u2190"} ${otherLabel}: ${otherName}\n`;
                }
            }
            // Check for graph analytics properties
            if (props.pageRank !== undefined)
                output += `\nPageRank: ${props.pageRank}`;
            if (props.communityId !== undefined)
                output += `\nCommunity: ${props.communityId}`;
            if (props.centrality !== undefined)
                output += `\nCentrality: ${props.centrality}`;
            results.push(output);
        }
        return results.join("\n\n---\n\n");
    }
    finally {
        await session.close();
    }
}
