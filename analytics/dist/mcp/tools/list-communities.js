import { getDriver } from "../../shared/connections.js";
export const listCommunitiesSchema = {
    name: "list_communities",
    description: "Show entity clusters from community detection. Lists communities with their members, useful for discovering related entities and themes.",
    inputSchema: {
        type: "object",
        properties: {
            limit: {
                type: "number",
                description: "Max communities to return (default 10)",
            },
            entityType: {
                type: "string",
                description: "Filter by entity type: Company, Person, Technology, etc.",
            },
        },
        required: [],
    },
};
export async function listCommunities(args) {
    const limit = args.limit || 10;
    const driver = getDriver();
    const session = driver.session();
    try {
        const labelFilter = args.entityType ? `:${args.entityType}` : "";
        // Get communities with their members
        const result = await session.run(`MATCH (n${labelFilter})
       WHERE n.communityId IS NOT NULL
       WITH n.communityId AS communityId,
            collect({name: n.name, label: labels(n)[0], pageRank: n.pageRank}) AS members
       RETURN communityId, size(members) AS memberCount, members
       ORDER BY memberCount DESC
       LIMIT $limit`, { limit: neo4jInt(limit) });
        if (result.records.length === 0) {
            return "No community data found. Run the import with MAGE analytics enabled first.";
        }
        const output = result.records.map((record) => {
            const communityId = record.get("communityId");
            const memberCount = toNumber(record.get("memberCount"));
            const members = record.get("members");
            // Sort members by pageRank descending
            const sorted = members
                .filter((m) => m.name)
                .sort((a, b) => (b.pageRank || 0) - (a.pageRank || 0))
                .slice(0, 15);
            const memberList = sorted
                .map((m) => {
                const rank = m.pageRank ? ` (rank: ${m.pageRank.toFixed(4)})` : "";
                return `  - ${m.label}: ${m.name}${rank}`;
            })
                .join("\n");
            return `**Community ${communityId}** (${memberCount} members):\n${memberList}`;
        });
        return output.join("\n\n");
    }
    finally {
        await session.close();
    }
}
function toNumber(val) {
    if (typeof val === "number")
        return val;
    if (val && typeof val === "object" && "toNumber" in val) {
        return val.toNumber();
    }
    return 0;
}
function neo4jInt(n) {
    return n;
}
