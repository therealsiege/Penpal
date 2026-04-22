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
import { type WikiGeneratorOptions } from "./wiki-generator.js";
export { generateWiki } from "./wiki-generator.js";
export type { WikiGeneratorOptions } from "./wiki-generator.js";
export declare function runWikiGeneration(options?: WikiGeneratorOptions): Promise<void>;
