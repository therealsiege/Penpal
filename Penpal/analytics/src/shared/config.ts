import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env from analytics root (two levels up from src/shared/)
dotenv.config({ path: path.resolve(__dirname, "..", "..", ".env") });
// Vault lives in ~/Documents/Vault (iCloud-backed, machine-agnostic)
const homeDir = process.env.HOME || "/tmp";
const defaultVaultPath = path.join(homeDir, "Documents", "Vault");

function resolveHome(p: string): string {
  if (p.startsWith("~/")) return path.join(homeDir, p.slice(2));
  if (p.startsWith("$HOME/")) return path.join(homeDir, p.slice(6));
  return p;
}

export interface VentureConfig {
  name: string;
  enabled: boolean;
  directories: string[];
  crmCsvPath?: string;
  referencesCsvPaths?: string[];
}

export const ventures: Record<string, VentureConfig> = {
  "1putt": {
    name: "1Putt Health",
    enabled: true,
    directories: [
      "1Putt/MedScrub KB",
      "1Putt/MedHook KB",
      "1Putt/Sales",
      "1Putt/Business",
      "1Putt/Engineering",
    ],
    crmCsvPath: "1Putt/MedScrub KB/Sales/Leads/1PuttHealth CRM.csv",
  },
  openloop: {
    name: "OpenLoop",
    enabled: true,
    directories: [
      "Open Loop/Campfire",
      "Open Loop/Medplum",
      "Open Loop/Fhir",
      "Open Loop/Migration",
      "Open Loop/OpenLoop",
      "Open Loop/Healthie",
      "Open Loop/docs",
    ],
    referencesCsvPaths: [
      "Open Loop/References.csv",
      "Open Loop/References2.csv",
    ],
  },
  "giving-prints": {
    name: "Giving Prints",
    enabled: false,
    directories: [
      "Giving Prints/Meetings",
      "Giving Prints/Tasks",
    ],
  },
  elion: {
    name: "Elion Health Research",
    enabled: false,
    directories: [
      "Research/Elion Health/Categories",
      "Research/Elion Health/Products",
      "Research/Elion Health/Research",
      "Research/Elion Health/Reviews",
    ],
  },
  research: {
    name: "Research",
    enabled: false,
    directories: [
      "Research",
    ],
  },
};

export const config = {
  vaultPath: process.env.VAULT_PATH ? resolveHome(process.env.VAULT_PATH) : defaultVaultPath,
  memgraphUri: process.env.MEMGRAPH_URI || "bolt://localhost:7687",
  memgraphUser: process.env.MEMGRAPH_USER || "",
  memgraphPassword: process.env.MEMGRAPH_PASSWORD || "",
  batchSize: 100,
  skipDirs: [".obsidian", ".trash", "node_modules", "game-assets"],
  ventures,

  // Qdrant
  qdrantUrl: process.env.QDRANT_URL || "http://localhost:6333",

  // OpenAI (embeddings)
  openaiApiKey: process.env.OPENAI_API_KEY || "",
  embeddingModel: "text-embedding-3-small",
  embeddingDimensions: 1536,

  // Anthropic (entity extraction + RAG)
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || "",

  // Firecrawl (company enrichment for lead ingestion)
  firecrawlApiKey: process.env.FIRECRAWL_API_KEY || "",

  // Embedding cache location
  embeddingCachePath: path.join(
    homeDir,
    ".sidekick",
    "embedding-cache.json",
  ),

  // LLM extraction cache location
  extractionCachePath: path.join(
    homeDir,
    ".sidekick",
    "extraction-cache.json",
  ),

  // NPI Registry
  npiFilePath: process.env.NPI_FILE_PATH || path.join(defaultVaultPath, "Data", "NPPES", "npidata_pfile_20050523-20260308.csv"),
  npiCachePath: path.join(
    homeDir,
    ".sidekick",
    "npi-cache.json",
  ),
  npiApiBaseUrl: "https://npiregistry.cms.hhs.gov/api/",

  // Brave Search (company enrichment)
  braveApiKey: process.env.BRAVE_API_KEY || "",

  // Web intelligence
  webIntelPath: path.resolve(__dirname, "..", "..", "data", "web-intel.json"),

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

/** Get enabled ventures, optionally filtered by CLI --venture flag */
export function getActiveVentures(filterKeys?: string[]): VentureConfig[] {
  const all = Object.entries(ventures);
  if (filterKeys && filterKeys.length > 0) {
    return all
      .filter(([key]) => filterKeys.includes(key))
      .map(([, v]) => v);
  }
  return all.filter(([, v]) => v.enabled).map(([, v]) => v);
}

/** Get the flat list of all included directories across active ventures */
export function getActiveDirectories(filterKeys?: string[]): string[] {
  return getActiveVentures(filterKeys).flatMap((v) => v.directories);
}

/** Check if a file path belongs to any active venture directory */
export function isInActiveVenture(relPath: string, filterKeys?: string[]): boolean {
  const dirs = getActiveDirectories(filterKeys);
  return dirs.some((d) => relPath.startsWith(d));
}

/** Resolve a relative file path to its venture key */
export function resolveVenture(relPath: string): string {
  for (const [key, v] of Object.entries(ventures)) {
    if (v.directories.some((d) => relPath.startsWith(d))) return key;
  }
  return "unknown";
}
