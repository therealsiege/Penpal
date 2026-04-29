import { Hono } from "hono";
import { getSession } from "../../shared/connections.js";

const app = new Hono();

app.get("/graph/neighbors/:id", async (c) => {
  const idParam = c.req.param("id");
  const nodeId = parseInt(idParam, 10);

  if (isNaN(nodeId)) {
    return c.json({ error: "Invalid node ID" }, 400);
  }

  const session = getSession();
  try {
    // Get center node
    const centerResult = await session.run(
      `MATCH (n) WHERE id(n) = $nodeId RETURN n, labels(n)[0] AS type, id(n) AS nodeId`,
      { nodeId }
    );

    if (centerResult.records.length === 0) {
      return c.json({ error: "Node not found" }, 404);
    }

    const centerRecord = centerResult.records[0];
    const centerNode = centerRecord.get("n");
    const center = {
      id: nodeId,
      name: centerNode.properties.name || centerNode.properties.title || "unnamed",
      type: centerRecord.get("type"),
    };

    // Get 1-hop neighborhood (limit 50)
    const neighborsResult = await session.run(
      `MATCH (n)-[r]-(m)
       WHERE id(n) = $nodeId
       RETURN DISTINCT id(m) AS targetId,
              m.name AS name,
              m.title AS title,
              labels(m)[0] AS type,
              type(r) AS relType,
              CASE WHEN startNode(r) = n THEN id(n) ELSE id(m) END AS sourceId,
              CASE WHEN startNode(r) = n THEN id(m) ELSE id(n) END AS destId
       LIMIT 50`,
      { nodeId }
    );

    const nodesMap = new Map<number, { id: number; name: string; type: string }>();
    const edges: { source: number; target: number; type: string }[] = [];

    for (const record of neighborsResult.records) {
      const targetId = record.get("targetId").toNumber();
      const nodeName = record.get("name") || record.get("title") || "unnamed";
      const nodeType = record.get("type");

      nodesMap.set(targetId, { id: targetId, name: nodeName, type: nodeType });

      edges.push({
        source: record.get("sourceId").toNumber(),
        target: record.get("destId").toNumber(),
        type: record.get("relType"),
      });
    }

    return c.json({
      center,
      nodes: [center, ...Array.from(nodesMap.values())],
      edges,
    });
  } catch (error: any) {
    console.error("Graph neighbors error:", error);
    return c.json({ error: error.message || "Failed to fetch neighbors" }, 500);
  } finally {
    await session.close();
  }
});

export default app;
