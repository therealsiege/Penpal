/**
 * Atlas Graph Sync — pushes curated entities from Memgraph to Graphite Atlas.
 *
 * Reads Leads, Companies, EHR Systems, Territories, SalesStages, and
 * CompetitorProducts from Memgraph, transforms them into Atlas Points/Paths,
 * and upserts via the Graphite Atlas REST API.
 *
 * Usage:
 *   npm run atlas:sync
 *   npm run atlas:sync -- --dry-run
 */
import "dotenv/config";
export declare function syncToAtlas(opts?: {
    dryRun?: boolean;
}): Promise<void>;
