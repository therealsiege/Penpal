import path from "path";

export const config = {
  vaultPath: process.env.VAULT_PATH || "/Users/cj/SideKick",
  memgraphUri: process.env.MEMGRAPH_URI || "bolt://localhost:7687",
  memgraphUser: process.env.MEMGRAPH_USER || "",
  memgraphPassword: process.env.MEMGRAPH_PASSWORD || "",
  batchSize: 100,
  skipDirs: [".obsidian", ".trash", "node_modules", "sidekick-graph"],
  ventures: {
    medscrub: "Ventures/1Putt/MedScrub KB",
    openloop: "Ventures/OpenLoop",
    medhook: "Ventures/1Putt/MedHook KB",
  },
  crmCsvPath: "Ventures/1Putt/MedScrub KB/Sales/Leads/1PuttHealth CRM.csv",
  referencesCsvPaths: [
    "Ventures/OpenLoop/References.csv",
    "Ventures/OpenLoop/References2.csv",
  ],

  // Qdrant
  qdrantUrl: process.env.QDRANT_URL || "http://localhost:6333",

  // OpenAI (embeddings)
  openaiApiKey: process.env.OPENAI_API_KEY || "",
  embeddingModel: "text-embedding-3-small",
  embeddingDimensions: 1536,

  // Anthropic (entity extraction + RAG)
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || "",

  // Embedding cache location
  embeddingCachePath: path.join(
    process.env.HOME || "/tmp",
    ".sidekick",
    "embedding-cache.json",
  ),

  // LLM extraction cache location
  extractionCachePath: path.join(
    process.env.HOME || "/tmp",
    ".sidekick",
    "extraction-cache.json",
  ),

  // Document types to run LLM extraction on
  llmExtractionDocTypes: [
    "competitor",
    "engineering",
    "integration",
    "product",
    "skill",
    "reference",
    "general",
  ],
} as const;

export function resolveVaultPath(relativePath: string): string {
  return path.join(config.vaultPath, relativePath);
}
