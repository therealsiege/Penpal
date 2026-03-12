import { getQdrant, getOpenAI, getDriver, getAnthropic } from "../../shared/connections.js";

export const askKnowledgeSchema = {
  name: "ask_knowledge",
  description:
    "RAG-powered Q&A over the knowledge base. Ask a natural language question and get a synthesized answer with source citations. Uses semantic search + graph context + Claude Sonnet for answer generation.",
  inputSchema: {
    type: "object" as const,
    properties: {
      question: {
        type: "string",
        description: "The question to answer",
      },
      documentType: {
        type: "string",
        description: "Optional filter by document type",
      },
    },
    required: ["question"],
  },
};

export async function askKnowledge(args: {
  question: string;
  documentType?: string;
}): Promise<string> {
  // 1. Generate query embedding
  const openai = getOpenAI();
  const embResponse = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: args.question,
  });
  const queryVector = embResponse.data[0].embedding;

  // 2. Search Qdrant for relevant chunks
  const qdrant = getQdrant();
  const filter = args.documentType
    ? { must: [{ key: "documentType", match: { value: args.documentType } }] }
    : undefined;

  const results = await qdrant.search("document_chunks", {
    vector: queryVector,
    limit: 15,
    with_payload: true,
    ...(filter ? { filter } : {}),
  });

  if (results.length === 0) {
    return "I couldn't find any relevant information in the knowledge base to answer this question.";
  }

  // 3. Gather graph context for the most relevant documents
  const driver = getDriver();
  const session = driver.session();
  let graphContext = "";

  try {
    const docPaths = [
      ...new Set(results.map((r) => (r.payload as Record<string, unknown>).documentPath as string)),
    ].slice(0, 5);

    for (const docPath of docPaths) {
      const entityResult = await session.run(
        `MATCH (d:Document {relativePath: $docPath})-[r]->(e)
         WHERE type(r) STARTS WITH 'MENTIONS_'
         RETURN type(r) AS relType, e.name AS name, labels(e)[0] AS label
         LIMIT 10`,
        { docPath },
      );

      if (entityResult.records.length > 0) {
        const entities = entityResult.records.map(
          (r) => `${r.get("label")}: ${r.get("name")}`,
        );
        graphContext += `\nDocument "${docPath}" mentions: ${entities.join(", ")}`;
      }
    }
  } finally {
    await session.close();
  }

  // 4. Build context for RAG
  const chunks = results.map((r) => {
    const p = r.payload as Record<string, unknown>;
    return `[Source: ${p.documentPath}]\n[Section: ${p.headingPath}]\n${p.content}`;
  });

  const contextText = chunks.join("\n\n---\n\n");

  // 5. Generate answer with Claude Sonnet
  const anthropic = getAnthropic();
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    system:
      "You are a knowledgeable assistant for a healthcare technology company. Answer questions using ONLY the provided context from the knowledge base. Cite sources by document path. If the context doesn't contain enough information, say so clearly.",
    messages: [
      {
        role: "user",
        content: `Context from knowledge base:\n\n${contextText}\n\n${graphContext ? `\nGraph relationships:\n${graphContext}\n` : ""}\n\nQuestion: ${args.question}`,
      },
    ],
  });

  const answer =
    response.content[0].type === "text" ? response.content[0].text : "No answer generated.";

  // Add sources
  const sources = [
    ...new Set(results.slice(0, 5).map((r) => (r.payload as Record<string, unknown>).documentPath as string)),
  ];

  return `${answer}\n\n**Sources:**\n${sources.map((s) => `- ${s}`).join("\n")}`;
}
