import { getQdrant, getOpenAI } from "../../shared/connections.js";

export const findSimilarSchema = {
  name: "find_similar",
  description:
    "Find documents or chunks similar to a given text or document path. Uses vector cosine similarity for semantic matching.",
  inputSchema: {
    type: "object" as const,
    properties: {
      text: {
        type: "string",
        description: "Text to find similar content for. Either text or documentPath is required.",
      },
      documentPath: {
        type: "string",
        description: "Find documents similar to this document (by relative path).",
      },
      limit: {
        type: "number",
        description: "Max results (default 10)",
      },
      searchType: {
        type: "string",
        enum: ["chunks", "documents"],
        description: "Search chunks (granular) or documents (high-level). Default: documents",
      },
      venture: {
        type: "string",
        description: "Filter by venture: openloop, 1putt. Omit for all.",
      },
    },
    required: [],
  },
};

export async function findSimilar(args: {
  text?: string;
  documentPath?: string;
  limit?: number;
  searchType?: string;
  venture?: string;
}): Promise<string> {
  if (!args.text && !args.documentPath) {
    return "Error: Either 'text' or 'documentPath' is required.";
  }

  const limit = args.limit || 10;
  const collection = args.searchType === "chunks" ? "document_chunks" : "document_summaries";

  let queryVector: number[];

  if (args.documentPath) {
    // Get the vector from the existing document in Qdrant
    const qdrant = getQdrant();
    const scrollResult = await qdrant.scroll("document_summaries", {
      filter: {
        must: [{ key: "documentPath", match: { value: args.documentPath } }],
      },
      limit: 1,
      with_vector: true,
    });

    if (scrollResult.points.length === 0) {
      return `Document "${args.documentPath}" not found in the vector store.`;
    }

    queryVector = scrollResult.points[0].vector as number[];
  } else {
    // Generate embedding for the text
    const openai = getOpenAI();
    const embResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: args.text!,
    });
    queryVector = embResponse.data[0].embedding;
  }

  // Search Qdrant
  const qdrant = getQdrant();
  const ventureFilter = args.venture
    ? { filter: { must: [{ key: "venture", match: { value: args.venture } }] } }
    : {};
  const results = await qdrant.search(collection, {
    vector: queryVector,
    limit: limit + 1, // +1 to exclude self-match
    with_payload: true,
    ...ventureFilter,
  });

  // Filter out self-match
  const filtered = results.filter((r) => {
    const p = r.payload as Record<string, unknown>;
    return p.documentPath !== args.documentPath;
  }).slice(0, limit);

  if (filtered.length === 0) {
    return "No similar content found.";
  }

  const output = filtered.map((r) => {
    const p = r.payload as Record<string, unknown>;
    const score = (r.score * 100).toFixed(1);

    if (collection === "document_summaries") {
      return `**[${score}%]** ${p.documentPath}\n  Title: ${p.title}\n  Type: ${p.documentType}\n  ${(p.contentPreview as string || "").slice(0, 200)}`;
    } else {
      return `**[${score}%]** ${p.documentPath}\n  Section: ${p.headingPath}\n  ${(p.content as string || "").slice(0, 200)}`;
    }
  });

  return output.join("\n\n---\n\n");
}
