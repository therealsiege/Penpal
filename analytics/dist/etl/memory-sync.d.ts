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
import "dotenv/config";
