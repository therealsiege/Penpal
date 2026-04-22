import { Hono } from "hono";
import { getSession, getQdrant, getOpenAI } from "../../shared/connections.js";
import { config } from "../../shared/config.js";

const app = new Hono();

interface SearchResult {
  path: string;
  title: string;
  type: string;
  venture: string;
  score: number;
  snippet: string;
  entities: string[];
}

async function enrichWithEntities(paths: string[]): Promise<Record<string, string[]>> {
  if (paths.length === 0) return {};
  const session = getSession();
  try {
    const result = await session.run(
      `MATCH (d:Document)-[r]->(e)
       WHERE d.relativePath IN $paths
         AND type(r) STARTS WITH 'MENTIONS_'
       RETURN d.relativePath AS path, collect(DISTINCT e.name) AS entities`,
      { paths }
    );
    const map: Record<string, string[]> = {};
    for (const record of result.records) {
      map[record.get("path")] = record.get("entities");
    }
    return map;
  } finally {
    await session.close();
  }
}

async function vectorSearch(query: string, venture?: string, type?: string, limit = 20): Promise<SearchResult[]> {
  const openai = getOpenAI();
  const qdrant = getQdrant();

  const embedding = await openai.embeddings.create({
    model: config.embeddingModel,
    input: query,
  });
  const vector = embedding.data[0].embedding;

  const filter: any = { must: [] };
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

  const paths = results.map((r) => (r.payload as any)?.documentPath as string).filter(Boolean);
  const entityMap = await enrichWithEntities(Array.from(new Set(paths)));

  return results.map((r) => {
    const p = r.payload as Record<string, unknown>;
    const docPath = (p.documentPath as string) || "";
    return {
      path: docPath,
      title: (p.title as string) || (p.headingPath as string) || docPath,
      type: (p.documentType as string) || "general",
      venture: (p.venture as string) || "unknown",
      score: r.score,
      snippet: ((p.content as string) || (p.contentPreview as string) || "").substring(0, 300),
      entities: entityMap[docPath] || [],
    };
  });
}

async function cypherSearch(query: string, venture?: string, type?: string, limit = 20): Promise<SearchResult[]> {
  const session = getSession();
  try {
    let cypher = `
      MATCH (d:Document)
      WHERE toLower(d.title) CONTAINS toLower($q) OR toLower(d.contentPreview) CONTAINS toLower($q)
    `;
    const params: Record<string, any> = { q: query };

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
  } finally {
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
    let results: SearchResult[];

    if (process.env.OPENAI_API_KEY) {
      results = await vectorSearch(q, venture, type, limit);
    } else {
      results = await cypherSearch(q, venture, type, limit);
    }

    return c.json(results);
  } catch (error: any) {
    console.error("Search error:", error);
    return c.json({ error: error.message || "Search failed" }, 500);
  }
});

export default app;
