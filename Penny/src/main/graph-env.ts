import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'

let analyticsEnvLoaded = false

/** Load MEMGRAPH_* from repo `analytics/.env` (MCP / CLI when cwd is `Penny/` or repo root). */
export function loadAnalyticsEnvForMemgraph(): void {
  if (analyticsEnvLoaded) return
  analyticsEnvLoaded = true
  const candidates = [
    path.resolve(process.cwd(), '..', 'analytics', '.env'),
    path.resolve(process.cwd(), 'analytics', '.env'),
  ]
  for (const envPath of candidates) {
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath })
      return
    }
  }
}
