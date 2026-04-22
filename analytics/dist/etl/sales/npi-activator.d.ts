/**
 * NPI Prospect Activator
 *
 * Converts high-value NPI Practice nodes from the graph into
 * actionable MedScrub leads with outreach-ready markdown files.
 *
 * Filters:
 *  - Sole proprietors or small practices (most likely independent)
 *  - Target states: TX, TN, CO, NC, AL
 *  - Target specialties: Family Medicine, Internal Medicine, General Practice
 *  - Enumerated within last 10 years (active, not retired)
 *
 * Usage:
 *   npm run npi:activate
 *   npm run npi:activate -- --limit 100 --state TX
 */
declare function main(): Promise<void>;
export { main as activateNPIProspects };
