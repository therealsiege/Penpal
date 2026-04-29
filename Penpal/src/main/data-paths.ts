import path from 'path'
import fs from 'fs'
import { findDevCheckout } from './paths'

let cachedDataDir: string | null = null

/**
 * Writable data directory for Penpal.
 *
 * Resolution order:
 *   1. PENPAL_DATA_DIR env var (explicit override)
 *   2. Dev checkout at SIDEKICK_ROOT/Penpal/data (packaged-only —
 *      keeps the .app sharing state with `npm run dev`)
 *   3. app.getPath('userData')/data when packaged
 *      (~/Library/Application Support/Penpal/data on macOS)
 *   4. Penpal/data/ relative to this file (dev)
 */
export function getDataDir(): string {
  if (cachedDataDir) return cachedDataDir

  const override = process.env.PENPAL_DATA_DIR
  if (override && override.trim()) {
    cachedDataDir = path.resolve(override.trim())
    fs.mkdirSync(cachedDataDir, { recursive: true })
    return cachedDataDir
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { app } = require('electron') as typeof import('electron')
    if (app?.isPackaged) {
      const dev = findDevCheckout()
      if (dev) {
        const devData = path.join(dev, 'data')
        if (fs.existsSync(devData)) {
          cachedDataDir = devData
          console.log(`[data-paths] Using dev checkout data dir: ${cachedDataDir}`)
          return cachedDataDir
        }
      }
      if (typeof app.getPath === 'function') {
        cachedDataDir = path.join(app.getPath('userData'), 'data')
        fs.mkdirSync(cachedDataDir, { recursive: true })
        return cachedDataDir
      }
    }
  } catch {
    /* electron unavailable in unit tests */
  }

  // Dev / test: __dirname is src/main in dev, out/main when bundled — two
  // levels up = Penpal/.
  cachedDataDir = path.resolve(__dirname, '..', '..', 'data')
  return cachedDataDir
}
