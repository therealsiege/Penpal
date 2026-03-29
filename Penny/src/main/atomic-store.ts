/**
 * Atomic JSON state file operations.
 *
 * Prevents data races when multiple processes (agents, orchestrator, poller)
 * read-modify-write the same JSON files concurrently.
 *
 * atomicUpdate:  read → transform → write-to-temp → rename (atomic on POSIX)
 * withMutex:     file-based mutex for long-running exclusive operations (npm build, etc.)
 */

import fs from 'fs'
import path from 'path'

// ── Atomic JSON Update ───────────────────────────────────────────────────────

/**
 * Atomically read-modify-write a JSON file.
 *
 * 1. Reads the file (or uses `fallback` if missing/corrupt)
 * 2. Calls `updater(current)` to produce the new value
 * 3. Writes to a temp file, then renames (atomic on POSIX filesystems)
 *
 * Returns the new value.
 */
export function atomicUpdate<T>(filePath: string, updater: (current: T) => T, fallback: T): T {
  // Read current
  let current: T = fallback
  try {
    if (fs.existsSync(filePath)) {
      current = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T
    }
  } catch {
    current = fallback
  }

  // Transform
  const next = updater(current)

  // Write atomically: temp file + rename
  const dir = path.dirname(filePath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const tmpPath = `${filePath}.tmp.${process.pid}`
  try {
    fs.writeFileSync(tmpPath, JSON.stringify(next, null, 2))
    fs.renameSync(tmpPath, filePath)
  } catch (err) {
    // Clean up temp file on failure
    try { fs.unlinkSync(tmpPath) } catch { /* ignore */ }
    throw err
  }

  return next
}

/**
 * Atomically write a JSON value to a file (no read step).
 * Useful when the caller already holds the canonical in-memory state.
 */
export function atomicWrite(filePath: string, data: unknown): void {
  const dir = path.dirname(filePath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const tmpPath = `${filePath}.tmp.${process.pid}`
  try {
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2))
    fs.renameSync(tmpPath, filePath)
  } catch (err) {
    try { fs.unlinkSync(tmpPath) } catch { /* ignore */ }
    throw err
  }
}

// ── File-based Mutex ─────────────────────────────────────────────────────────

interface LockInfo {
  pid: number
  timestamp: number
  holder: string
}

const LOCKS_DIR_NAME = '.locks'
const STALE_LOCK_MS = 10 * 60 * 1000 // 10 min — if PID is dead or lock is this old, steal it
const POLL_INTERVAL_MS = 500
const MAX_WAIT_MS = 60_000 // 1 min max wait

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

/**
 * Execute `fn` while holding an exclusive file-based lock.
 *
 * - Creates `data/.locks/{name}.lock` with PID + timestamp
 * - If lock exists and PID is alive: waits up to 60s
 * - If lock exists and PID is dead: steals the stale lock
 * - On completion or error: removes lock file
 */
export async function withMutex<T>(
  dataDir: string,
  name: string,
  fn: () => Promise<T>,
  holder = 'unknown',
): Promise<T> {
  const locksDir = path.join(dataDir, LOCKS_DIR_NAME)
  if (!fs.existsSync(locksDir)) fs.mkdirSync(locksDir, { recursive: true })
  const lockPath = path.join(locksDir, `${name}.lock`)

  // Acquire lock
  const startWait = Date.now()
  while (true) {
    try {
      // Try to read existing lock
      if (fs.existsSync(lockPath)) {
        const raw = fs.readFileSync(lockPath, 'utf-8')
        const lock = JSON.parse(raw) as LockInfo
        const isStale = !isProcessAlive(lock.pid) || (Date.now() - lock.timestamp > STALE_LOCK_MS)
        if (!isStale) {
          // Lock is held by a live process — wait
          if (Date.now() - startWait > MAX_WAIT_MS) {
            console.warn(`[mutex] Timed out waiting for lock "${name}" held by pid ${lock.pid} (${lock.holder})`)
            // Steal the lock after timeout
          } else {
            await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS))
            continue
          }
        }
        // Stale or timed out — steal
      }

      // Write our lock
      const info: LockInfo = { pid: process.pid, timestamp: Date.now(), holder }
      fs.writeFileSync(lockPath, JSON.stringify(info))
      break
    } catch {
      // File system error — retry
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS))
      if (Date.now() - startWait > MAX_WAIT_MS) break
    }
  }

  // Execute under lock
  try {
    return await fn()
  } finally {
    try { fs.unlinkSync(lockPath) } catch { /* already gone */ }
  }
}
