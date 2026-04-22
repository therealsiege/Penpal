import { getDriver } from "../../shared/connections.js";
export const discoverConnectionsSchema = {
    name: "discover_connections",
    description: "Find paths between two entities in the knowledge graph. Discovers how entities are connected through intermediate nodes and relationships.",
    inputSchema: {
        type: "object",
        properties: {
            from: {
                type: "string",
                description: "Name of the source entity",
            },
            to: {
                type: "string",
                description: "Name of the target entity",
            },
            maxHops: {
                type: "number",
                description: "Maximum path length (default 4, max 6)",
            },
        },
        required: ["from", "to"],
    },
};
export async function discoverConnections(args) {
    const maxHops = Math.min(args.maxHops || 4, 6);
    const driver = getDriver();
    const session = driver.session();
    try {
        // Find shortest paths between entities matching the names
        const result = await session.run(`MATCH (a), (b)
       WHERE a.name IS NOT NULL AND b.name IS NOT NULL
         AND toLower(a.name) CONTAINS toLower($from)
         AND toLower(b.name) CONTAINS toLower($to)
         AND a <> b
       WITH a, b LIMIT 1
       MATCH p = allShortestPaths((a)-[*..${maxHops}]-(b))
       RETURN p
       LIMIT 5`, { from: args.from, to: args.to });
        if (result.records.length === 0) {
            // Try BFS for any connection
            const bfsResult = await session.run(`MATCH (a), (b)
         WHERE a.name IS NOT NULL AND b.name IS NOT NULL
           AND toLower(a.name) CONTAINS toLower($from)
           AND toLower(b.name) CONTAINS toLower($to)
           AND a <> b
         WITH a, b LIMIT 1
         RETURN a.name AS fromName, labels(a) AS fromLabels,
                b.name AS toName, labels(b) AS toLabels`, { from: args.from, to: args.to });
            if (bfsResult.records.length === 0) {
                return `Could not find entities matching "${args.from}" and/or "${args.to}".`;
            }
            const r = bfsResult.records[0];
            return `Found "${r.get("fromName")}" (${r.get("fromLabels")}) and "${r.get("toName")}" (${r.get("toLabels")}), but no path of length <= ${maxHops} connects them.`;
        }
        // Format paths
        const paths = result.records.map((record, idx) => {
            const path = record.get("p");
            const segments = path.segments;
            const steps = [];
            for (const seg of segments) {
                const startName = seg.start.properties.name || seg.start.properties.id;
                const startLabel = seg.start.labels?.[0] || "?";
                const endName = seg.end.properties.name || seg.end.properties.id;
                const endLabel = seg.end.labels?.[0] || "?";
                const relType = seg.relationship.type;
                if (steps.length === 0) {
                    steps.push(`(${startLabel}: ${startName})`);
                }
                steps.push(`-[${relType}]-> (${endLabel}: ${endName})`);
            }
            return `Path ${idx + 1} (${segments.length} hops):\n  ${steps.join("\n  ")}`;
        });
        return paths.join("\n\n");
    }
    finally {
        await session.close();
    }
}
