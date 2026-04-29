import { getQdrant, getOpenAI, getDriver } from "../../shared/connections.js";

export const searchKnowledgeSchema = {
  name: "search_knowledge",
  description:
    "Semantic search across all documents in the knowledge base. Returns the most relevant chunks matching a natural language query, with entity context from the graph.",
  inputSchema: {
    type: "object" as const,
    properties: {
      query: {
        type: "string",
        description: "Natural language search query",
      },
      limit: {
        type: "number",
        description: "Max results to return (default 10)",
      },
      documentType: {
        type: "string",
        description:
          "Filter by document type: lead, engineering, integration, competitor, skill, product, meeting, reference, general",
      },
      venture: {
        type: "string",
        description:
          "Filter by venture: openloop, 1putt. Omit to search across all ventures.",
      },
    },
    required: ["query"],
  },
};

export async function searchKnowledge(args: {
  query: string;
  limit?: number;
  documentType?: string;
  venture?: string;
}): Promise<string> {
  const limit = args.limit || 10;

  // Generate query embedding
  const openai = getOpenAI();
  const embResponse = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: args.query,
  });
  const queryVector = embResponse.data[0].embedding;

  // Search Qdrant
  const qdrant = getQdrant();
  const mustClauses: Array<{ key: string; match: { value: string } }> = [];
  if (args.documentType) mustClauses.push({ key: "documentType", match: { value: args.documentType } });
  if (args.venture) mustClauses.push({ key: "venture", match: { value: args.venture } });
  const filter = mustClauses.length > 0 ? { must: mustClauses } : undefined;

  const results = await qdrant.search("document_chunks", {
    vector: queryVector,
    limit,
    with_payload: true,
    ...(filter ? { filter } : {}),
  });

  if (results.length === 0) {
    return "No results found.";
  }

  // Enrich with graph context: find entities mentioned in the parent documents
  const driver = getDriver();
  const session = driver.session();
  const enrichedResults: string[] = [];

  try {
    for (const result of results) {
      const payload = result.payload as Record<string, unknown>;
      const docPath = payload.documentPath as string;
      const headingPath = payload.headingPath as string;
      const content = payload.content as string;
      const score = result.score;

      // Get entities mentioned by this document
      let entities = "";
      try {
        const entityResult = await session.run(
          `MATCH (d:Document {relativePath: $docPath})-[r]->(e)
           WHERE type(r) STARTS WITH 'MENTIONS_'
           RETURN labels(e)[0] AS entityType, e.name AS name
           LIMIT 10`,
          { docPath },
        );
        const entityList = entityResult.records.map(
          (r) => `${r.get("entityType")}: ${r.get("name")}`,
        );
        if (entityList.length > 0) {
          entities = `\n  Entities: ${entityList.join(", ")}`;
        }
      } catch {
        // Graph query failed — skip enrichment
      }

      enrichedResults.push(
        `**[${(score * 100).toFixed(1)}%]** ${docPath}\n` +
          `  Section: ${headingPath}\n` +
          `  ${content.slice(0, 300)}${content.length > 300 ? "..." : ""}` +
          entities,
      );
    }
  } finally {
    await session.close();
  }

  return enrichedResults.join("\n\n---\n\n");
}
