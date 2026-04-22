/**
 * Health Check
 *
 * Verifies that all Penny infrastructure is reachable:
 * - Memgraph (bolt connection + simple query)
 * - Qdrant (collection list)
 * - API keys present (OpenAI, Anthropic)
 * - Docker containers running
 *
 * Usage:
 *   npm run health
 *   npm run health -- --json
 *
 * Exports checkHealth() for use by the scheduler and future Electron dashboard.
 */
import type { HealthResult } from "./types.js";
export declare function checkHealth(): Promise<HealthResult>;
