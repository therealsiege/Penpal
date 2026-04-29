import path from 'path'
import fs from 'fs'

let cachedDataDir: string | null = null

/**
 * Writable data directory for Penpal.
 *
 * Dev: Penpal/data/ (resolved from this file's __dirname).
 * Packaged: app.getPath('userData')/data — typically
 *   ~/Library/Application Support/Penpal/data on macOS.
 *
 * The packaged app cannot write inside its read-only .asar archive,
 * so all persistent state must live under userData. The PENPAL_DATA_DIR
 * env var overrides both — useful when a compiled .app should share
 * state with a developer checkout.
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
    if (app?.isPackaged && typeof app.getPath === 'function') {
      cachedDataDir = path.join(app.getPath('userData'), 'data')
      fs.mkdirSync(cachedDataDir, { recursive: true })
      return cachedDataDir
    }
  } catch {
    /* electron unavailable in unit tests */
  }

  // Dev / test: __dirname is src/main in dev, out/main when bundled — two
  // levels up = Penpal/.
  cachedDataDir = path.resolve(__dirname, '..', '..', 'data')
  return cachedDataDir
}
