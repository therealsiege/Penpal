import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'

let analyticsEnvLoaded = false

// In dev, __dirname is Penpal/src/main; in packaged, it's app.asar/out/main.
// Walking up two levels lands at Penpal/ in dev, app.asar/ in packaged.
// Analytics is intentionally not bundled (CHANGELOG v0.1.1), so this only
// finds a .env when running from a developer checkout.
const PENPAL_ROOT = path.resolve(__dirname, '..', '..')

export function loadAnalyticsEnvForMemgraph(): void {
  if (analyticsEnvLoaded) return
  analyticsEnvLoaded = true
  const candidates = [
    path.join(PENPAL_ROOT, 'analytics', '.env'),
    path.join(PENPAL_ROOT, '..', 'analytics', '.env'),
  ]
  for (const envPath of candidates) {
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath })
      return
    }
  }
}
