/**
 * NPI Lead Enricher
 *
 * Enriches existing NPI lead files with web data + EHR detection
 * via Firecrawl, re-scores, updates markdown in-place, and
 * pushes updated nodes to the graph.
 *
 * Usage:
 *   npm run npi:enrich -- --dry-run --limit 5
 *   npm run npi:enrich -- --limit 50
 *   npm run npi:enrich -- --limit 400 --state TX
 */
export {};
