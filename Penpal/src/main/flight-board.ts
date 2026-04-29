/**
 * Flight Board — shared state for files actively being worked on by pods.
 *
 * Prevents concurrent agent pods from stomping on the same files by tracking
 * which files each active pod has claimed. Pods register entries when they
 * start and remove them when they finish (or the entry expires).
 *
 * Data lives in data/flight-board.json and is written atomically.
 */

import path from 'path'
import fs from 'fs'
import { atomicUpdate } from './atomic-store'
import { getDataDir } from './data-paths'

// ── Types ────────────────────────────────────────────────────────────────────

export type FlightBoardStatus =
  | 'planning'
  | 'solving'
  | 'reviewing'
  | 'executing'
  | 'pr-created'
  | 'merged'
  | 'failed'

export interface FlightBoardEntry {
  podId: string
  task: string
  status: FlightBoardStatus
  filesInFlight: string[]
  startedAt: string   // ISO 8601
  updatedAt: string   // ISO 8601
  cwd?: string
  planSummary?: string
}

export interface FlightBoard {
  version: number
  entries: FlightBoardEntry[]
}

// ── Constants ────────────────────────────────────────────────────────────────

export const FLIGHT_BOARD_PATH = path.join(getDataDir(), 'flight-board.json')

const FALLBACK: FlightBoard = { version: 1, entries: [] }

/** Terminal statuses — entries in these states expire after this duration. */
const TERMINAL_STATUSES: ReadonlySet<FlightBoardStatus> = new Set(['merged', 'failed'])
const TERMINAL_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

// ── Helpers ──────────────────────────────────────────────────────────────────

function readBoard(filePath = FLIGHT_BOARD_PATH): FlightBoard {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as FlightBoard
    }
  } catch {
    // fall through to fallback
  }
  return { ...FALLBACK, entries: [] }
}

function isExpired(entry: FlightBoardEntry): boolean {
  if (!TERMINAL_STATUSES.has(entry.status)) return false
  const updatedMs = new Date(entry.updatedAt).getTime()
  return Date.now() - updatedMs > TERMINAL_TTL_MS
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Read the full flight board, auto-purging expired terminal entries.
 */
export function getFlightBoard(filePath = FLIGHT_BOARD_PATH): FlightBoard {
  const board = readBoard(filePath)
  const filtered = board.entries.filter(e => !isExpired(e))
  return { ...board, entries: filtered }
}

/**
 * Returns only active (non-expired) entries. Expired terminal entries are excluded.
 */
export function getActiveEntries(filePath = FLIGHT_BOARD_PATH): FlightBoardEntry[] {
  return getFlightBoard(filePath).entries
}

/**
 * Returns a map of file path → owning FlightBoardEntry for all active entries.
 */
export function getFilesInFlight(filePath = FLIGHT_BOARD_PATH): Map<string, FlightBoardEntry> {
  const map = new Map<string, FlightBoardEntry>()
  for (const entry of getActiveEntries(filePath)) {
    for (const file of entry.filesInFlight) {
      map.set(file, entry)
    }
  }
  return map
}

/**
 * Add a new entry to the flight board and return the completed entry.
 */
export function addEntry(
  partial: Pick<FlightBoardEntry, 'podId' | 'task'> & Partial<Omit<FlightBoardEntry, 'podId' | 'task' | 'startedAt' | 'updatedAt'>>,
  filePath = FLIGHT_BOARD_PATH,
): FlightBoardEntry {
  const now = new Date().toISOString()
  const entry: FlightBoardEntry = {
    status: 'planning',
    filesInFlight: [],
    ...partial,
    startedAt: now,
    updatedAt: now,
  }

  atomicUpdate<FlightBoard>(
    filePath,
    board => ({ ...board, entries: [...board.entries, entry] }),
    { ...FALLBACK, entries: [] },
  )

  return entry
}

/**
 * Update an existing entry by podId, merging `updates` and bumping `updatedAt`.
 * No-op if the entry doesn't exist.
 */
export function updateEntry(
  podId: string,
  updates: Partial<Omit<FlightBoardEntry, 'podId' | 'startedAt' | 'updatedAt'>>,
  filePath = FLIGHT_BOARD_PATH,
): void {
  atomicUpdate<FlightBoard>(
    filePath,
    board => ({
      ...board,
      entries: board.entries.map(e =>
        e.podId === podId
          ? { ...e, ...updates, podId: e.podId, startedAt: e.startedAt, updatedAt: new Date().toISOString() }
          : e,
      ),
    }),
    { ...FALLBACK, entries: [] },
  )
}

/**
 * Remove an entry by podId.
 */
export function removeEntry(podId: string, filePath = FLIGHT_BOARD_PATH): void {
  atomicUpdate<FlightBoard>(
    filePath,
    board => ({ ...board, entries: board.entries.filter(e => e.podId !== podId) }),
    { ...FALLBACK, entries: [] },
  )
}

/**
 * Check if any active entry already claims one of the given files.
 * Returns the first conflicting entry, or null if no conflict.
 */
export function hasFileConflict(
  files: string[],
  filePath = FLIGHT_BOARD_PATH,
): FlightBoardEntry | null {
  const inFlight = getFilesInFlight(filePath)
  for (const file of files) {
    const owner = inFlight.get(file)
    if (owner) return owner
  }
  return null
}

/** A detected file-level conflict between two pods. */
export interface FileConflict {
  file: string
  ownerPodId: string
  ownerTask: string
}

/**
 * Find all file-level conflicts for the given files, excluding a specific pod.
 * Returns an array of conflicts (may be empty).
 */
export function getFileConflicts(
  files: string[],
  excludePodId: string,
  filePath = FLIGHT_BOARD_PATH,
): FileConflict[] {
  const conflicts: FileConflict[] = []
  const seen = new Set<string>()
  for (const entry of getActiveEntries(filePath)) {
    if (entry.podId === excludePodId) continue
    for (const file of files) {
      if (entry.filesInFlight.includes(file) && !seen.has(`${entry.podId}:${file}`)) {
        seen.add(`${entry.podId}:${file}`)
        conflicts.push({ file, ownerPodId: entry.podId, ownerTask: entry.task })
      }
    }
  }
  return conflicts
}
