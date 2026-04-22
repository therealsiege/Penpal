/**
 * Intelligence Briefing
 *
 * Queries the Memgraph knowledge graph and local state files to generate
 * a briefing with: pipeline summary, new/hot leads, dispatched work
 * (GitHub pipeline + pod activity), competitive signals, and action items.
 *
 * Runs 3x/day after each ingestion cycle (7:30, 13:30, 19:30).
 *
 * Usage:
 *   npm run briefing
 */
export {};
