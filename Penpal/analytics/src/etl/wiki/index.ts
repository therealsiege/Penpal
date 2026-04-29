/**
 * Knowledge Wiki Generator
 *
 * Synthesizes intelligence pages from the knowledge graph using Claude.
 * Only generates pages for high-value entities — curated companies,
 * people, technologies, top leads, and competitor products.
 *
 * Standalone: npm run wiki:generate
 * Flags: --clean (wipe Knowledge/ first), --types company,person (filter)
 */

import { getDriver, verifyConnection, closeConnections } from "../../shared/connections.js";
import { generateWiki, type WikiGeneratorOptions } from "./wiki-generator.js";

export { generateWiki } from "./wiki-generator.js";
export type { WikiGeneratorOptions } from "./wiki-generator.js";

export async function runWikiGeneration(options: WikiGeneratorOptions = {}): Promise<void> {
  console.log("\n=== Knowledge Wiki Generation ===\n");

  await verifyConnection();
  const driver = getDriver();
  const session = driver.session();

  try {
    const stats = await generateWiki(session, options);
    console.log(`\n  Wiki complete: ${stats.total} entities → ${stats.written} pages updated\n`);
  } finally {
    await session.close();
  }
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const clean = args.includes("--clean");
  const typesIdx = args.indexOf("--types");
  const types = typesIdx >= 0 && args[typesIdx + 1]
    ? args[typesIdx + 1].split(",").map((t) => t.trim())
    : undefined;

  await runWikiGeneration({ clean, types });
  await closeConnections();
}

const isDirectRun = process.argv[1]?.endsWith("wiki/index.ts") ||
  process.argv[1]?.endsWith("wiki/index.js");

if (isDirectRun) {
  main().catch((err) => {
    console.error("Wiki generation failed:", err);
    process.exit(1);
  });
}
