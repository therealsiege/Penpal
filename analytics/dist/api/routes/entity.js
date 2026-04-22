import { Hono } from "hono";
import { getSession } from "../../shared/connections.js";
const app = new Hono();
app.get("/entity/types", async (c) => {
    const session = getSession();
    try {
        const result = await session.run(`MATCH (n) RETURN labels(n)[0] AS type, count(n) AS count ORDER BY count DESC`);
        const types = result.records.map((record) => ({
            type: record.get("type"),
            count: record.get("count").toNumber(),
        }));
        return c.json(types);
    }
    catch (error) {
        console.error("Entity types error:", error);
        return c.json({ error: error.message || "Failed to fetch entity types" }, 500);
    }
    finally {
        await session.close();
    }
});
app.get("/entity/:type/:name", async (c) => {
    const { type, name } = c.req.param();
    const session = getSession();
    try {
        // Find entity with case-insensitive partial match
        const entityResult = await session.run(`MATCH (n)
       WHERE labels(n)[0] = $type AND toLower(n.name) CONTAINS toLower($name)
       RETURN n, labels(n) AS labels, id(n) AS nodeId
       LIMIT 1`, { type, name });
        if (entityResult.records.length === 0) {
            return c.json({ error: "Entity not found" }, 404);
        }
        const record = entityResult.records[0];
        const node = record.get("n");
        const nodeId = record.get("nodeId").toNumber();
        const properties = node.properties;
        // Get relationships
        const relsResult = await session.run(`MATCH (n)-[r]-(m)
       WHERE id(n) = $nodeId
       RETURN type(r) AS relType,
              CASE WHEN startNode(r) = n THEN 'outgoing' ELSE 'incoming' END AS direction,
              labels(m)[0] AS targetType,
              m.name AS targetName
       LIMIT 100`, { nodeId });
        const relationships = relsResult.records.map((r) => ({
            type: r.get("relType"),
            direction: r.get("direction"),
            targetType: r.get("targetType"),
            targetName: r.get("targetName") || "unnamed",
        }));
        // Serialize properties (handle neo4j Integer types)
        const serializedProps = {};
        for (const [key, value] of Object.entries(properties)) {
            if (value && typeof value === "object" && "toNumber" in value) {
                serializedProps[key] = value.toNumber();
            }
            else {
                serializedProps[key] = value;
            }
        }
        return c.json({
            name: properties.name || name,
            type,
            properties: serializedProps,
            relationships,
        });
    }
    catch (error) {
        console.error("Entity lookup error:", error);
        return c.json({ error: error.message || "Entity lookup failed" }, 500);
    }
    finally {
        await session.close();
    }
});
export default app;
