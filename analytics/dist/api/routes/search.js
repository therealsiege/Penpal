import { Hono } from "hono";
import { getSession, getQdrant, getOpenAI } from "../../shared/connections.js";
import { config } from "../../shared/config.js";
const app = new Hono();
async function enrichWithEntities(paths) {
    if (paths.length === 0)
        return {};
    const session = getSession();
    try {
        const result = await session.run(`MATCH (d:Document)-[r]->(e)
       WHERE d.relativePath IN $paths
         AND type(r) STARTS WITH 'MENTIONS_'
       RETURN d.relativePath AS path, collect(DISTINCT e.name) AS entities`, { paths });
        const map = {};
        for (const record of result.records) {
            map[record.get("path")] = record.get("entities");
        }
        return map;
    }
    finally {
        await session.close();
    }
}
async function vectorSearch(query, venture, type, limit = 20) {
    const openai = getOpenAI();
    const qdrant = getQdrant();
    const embedding = await openai.embeddings.create({
        model: config.embeddingModel,
        input: query,
    });
    const vector = embedding.data[0].embedding;
    const filter = { must: [] };
    if (venture) {
        filter.must.push({ key: "venture", match: { value: venture } });
    }
    if (type) {
        filter.must.push({ key: "documentType", match: { value: type } });
    }
    const results = await qdrant.search("document_chunks", {
        vector,
        limit: Math.floor(limit),
        with_payload: true,
        ...(filter.must.length > 0 ? { filter } : {}),
    });
    const paths = results.map((r) => r.payload?.documentPath).filter(Boolean);
    const entityMap = await enrichWithEntities(Array.from(new Set(paths)));
    return results.map((r) => {
        const p = r.payload;
        const docPath = p.documentPath || "";
        return {
            path: docPath,
            title: p.title || p.headingPath || docPath,
            type: p.documentType || "general",
            venture: p.venture || "unknown",
            score: r.score,
            snippet: (p.content || p.contentPreview || "").substring(0, 300),
            entities: entityMap[docPath] || [],
        };
    });
}
async function cypherSearch(query, venture, type, limit = 20) {
    const session = getSession();
    try {
        let cypher = `
      MATCH (d:Document)
      WHERE toLower(d.title) CONTAINS toLower($q) OR toLower(d.contentPreview) CONTAINS toLower($q)
    `;
        const params = { q: query };
        if (venture) {
            cypher += ` AND d.venture = $venture`;
            params.venture = venture;
        }
        if (type) {
            cypher += ` AND d.documentType = $type`;
            params.type = type;
        }
        cypher += `
      RETURN d.relativePath AS path, d.title AS title, d.documentType AS type,
             d.venture AS venture, d.contentPreview AS snippet
      LIMIT ${Math.floor(limit)}
    `;
        const result = await session.run(cypher, params);
        const paths = result.records.map((r) => r.get("path")).filter(Boolean);
        const entityMap = await enrichWithEntities(paths);
        return result.records.map((record) => ({
            path: record.get("path") || "",
            title: record.get("title") || "",
            type: record.get("type") || "general",
            venture: record.get("venture") || "unknown",
            score: 1.0,
            snippet: (record.get("snippet") || "").substring(0, 300),
            entities: entityMap[record.get("path")] || [],
        }));
    }
    finally {
        await session.close();
    }
}
app.get("/search", async (c) => {
    const q = c.req.query("q");
    if (!q) {
        return c.json({ error: "Query parameter 'q' is required" }, 400);
    }
    const venture = c.req.query("venture");
    const type = c.req.query("type");
    const limit = parseInt(c.req.query("limit") || "20", 10);
    try {
        let results;
        if (process.env.OPENAI_API_KEY) {
            results = await vectorSearch(q, venture, type, limit);
        }
        else {
            results = await cypherSearch(q, venture, type, limit);
        }
        return c.json(results);
    }
    catch (error) {
        console.error("Search error:", error);
        return c.json({ error: error.message || "Search failed" }, 500);
    }
});
export default app;
