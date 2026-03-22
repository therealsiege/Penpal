/**
 * Memory Graph Sync — bridges the MCP Knowledge Graph Memory into Memgraph.
 *
 * Reads the Memory MCP's JSON file (entities + relations) and upserts them
 * into Memgraph as MemoryEntity nodes and typed relationships.
 *
 * Usage:
 *   npm run memory:sync
 *   npm run memory:sync -- --dry-run
 */

import { readFileSync, existsSync } from "fs";
import { GraphImporter } from "./graph/importer.js";
import { stableId } from "../shared/utils/id.js";
import { createSchema } from "./db/schema.js";
import { getSession } from "../shared/connections.js";
import "dotenv/config";

const MEMORY_FILE =
  process.env.MEMORY_FILE_PATH ||
  "/Users/fuzeelogik/sidekick/analytics/data/memory-graph.json";

interface MemoryEntity {
  name: string;
  entityType: string;
  observations: string[];
}

interface MemoryRelation {
  from: string;
  to: string;
  relationType: string;
}

interface MemoryGraph {
  entities: MemoryEntity[];
  relations: MemoryRelation[];
}

function loadMemoryGraph(): MemoryGraph {
  if (!existsSync(MEMORY_FILE)) {
    console.log(`Memory file not found at ${MEMORY_FILE} — nothing to sync.`);
    return { entities: [], relations: [] };
  }
  const raw = readFileSync(MEMORY_FILE, "utf-8").trim();
  if (!raw) return { entities: [], relations: [] };
  return JSON.parse(raw) as MemoryGraph;
}

function entityToNode(entity: MemoryEntity) {
  return {
    label: "MemoryEntity",
    properties: {
      id: stableId("MemoryEntity", entity.name),
      name: entity.name,
      entityType: entity.entityType,
      observations: entity.observations.join(" | "),
      observationCount: entity.observations.length,
      source: "mcp-memory",
      syncedAt: new Date().toISOString(),
    },
  };
}

function relationToRel(rel: MemoryRelation) {
  // Sanitize relation type for Cypher (uppercase, underscores only)
  const type = rel.relationType
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, "_")
    .replace(/_+/g, "_");

  return {
    fromLabel: "MemoryEntity",
    fromId: stableId("MemoryEntity", rel.from),
    toLabel: "MemoryEntity",
    toId: stableId("MemoryEntity", rel.to),
    type,
    properties: {
      source: "mcp-memory",
      originalType: rel.relationType,
    },
  };
}

async function ensureMemorySchema(): Promise<void> {
  const session = getSession();
  try {
    const stmts = [
      "CREATE CONSTRAINT ON (n:MemoryEntity) ASSERT n.id IS UNIQUE",
      "CREATE INDEX ON :MemoryEntity(name)",
      "CREATE INDEX ON :MemoryEntity(entityType)",
    ];
    for (const stmt of stmts) {
      try {
        await session.run(stmt);
      } catch {
        // already exists
      }
    }
  } finally {
    await session.close();
  }
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  console.log("=== Memory Graph Sync ===");
  console.log(`Reading: ${MEMORY_FILE}`);

  const graph = loadMemoryGraph();
  console.log(
    `Found ${graph.entities.length} entities, ${graph.relations.length} relations`
  );

  if (graph.entities.length === 0) {
    console.log("Nothing to sync.");
    return;
  }

  const importer = new GraphImporter();

  for (const entity of graph.entities) {
    importer.addNode(entityToNode(entity));
  }

  for (const rel of graph.relations) {
    importer.addRel(relationToRel(rel));
  }

  if (dryRun) {
    console.log("\n[DRY RUN] Would sync:");
    importer.printStats();
    return;
  }

  await ensureMemorySchema();
  await importer.flush();
  importer.printStats();
  console.log("\nMemory graph synced to Memgraph.");
}

main().catch((err) => {
  console.error("Memory sync failed:", err);
  process.exit(1);
});
