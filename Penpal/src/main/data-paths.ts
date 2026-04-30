import path from 'path'
import fs from 'fs'
import os from 'os'

let cachedDataDir: string | null = null

/**
 * Writable data directory for Penpal.
 *
 * Resolution order:
 *   1. PENPAL_DATA_DIR env var (explicit override)
 *   2. ~/.penpal/data (default for all users, dev and packaged)
 */
export function getDataDir(): string {
  if (cachedDataDir) return cachedDataDir

  const override = process.env.PENPAL_DATA_DIR
  if (override?.trim()) {
    cachedDataDir = path.resolve(override.trim())
    fs.mkdirSync(cachedDataDir, { recursive: true })
    return cachedDataDir
  }

  cachedDataDir = path.join(os.homedir(), '.penpal', 'data')
  fs.mkdirSync(cachedDataDir, { recursive: true })
  return cachedDataDir
}
