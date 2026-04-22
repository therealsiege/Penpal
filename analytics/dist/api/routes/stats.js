import { Hono } from "hono";
import { getSession } from "../../shared/connections.js";
const app = new Hono();
app.get("/stats", async (c) => {
    const session = getSession();
    try {
        // Node counts by label
        const nodesResult = await session.run(`MATCH (n) RETURN labels(n)[0] AS type, count(n) AS count ORDER BY count DESC`);
        const nodes = nodesResult.records.map((record) => ({
            type: record.get("type"),
            count: record.get("count").toNumber(),
        }));
        // Relationship counts by type
        const relsResult = await session.run(`MATCH ()-[r]->() RETURN type(r) AS type, count(r) AS count ORDER BY count DESC LIMIT 20`);
        const relationships = relsResult.records.map((record) => ({
            type: record.get("type"),
            count: record.get("count").toNumber(),
        }));
        const totalNodes = nodes.reduce((sum, n) => sum + n.count, 0);
        const totalRelationships = relationships.reduce((sum, r) => sum + r.count, 0);
        return c.json({
            nodes,
            relationships,
            totalNodes,
            totalRelationships,
        });
    }
    catch (error) {
        console.error("Stats error:", error);
        return c.json({ error: error.message || "Failed to fetch stats" }, 500);
    }
    finally {
        await session.close();
    }
});
export default app;
