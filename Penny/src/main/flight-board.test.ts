import fs from 'fs'
import os from 'os'
import path from 'path'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  addEntry,
  updateEntry,
  removeEntry,
  getActiveEntries,
  getFilesInFlight,
  hasFileConflict,
  getFlightBoard,
} from './flight-board'

function tmpBoard(): string {
  return path.join(os.tmpdir(), `flight-board-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`)
}

describe('addEntry', () => {
  it('creates entry with defaults and returns the completed entry', () => {
    const fp = tmpBoard()
    try {
      const entry = addEntry({ podId: 'pod-1', task: 'Build feature X' }, fp)
      expect(entry.podId).toBe('pod-1')
      expect(entry.task).toBe('Build feature X')
      expect(entry.status).toBe('planning')
      expect(entry.filesInFlight).toEqual([])
      expect(typeof entry.startedAt).toBe('string')
      expect(typeof entry.updatedAt).toBe('string')
    } finally {
      try { fs.unlinkSync(fp) } catch { /* ignore */ }
    }
  })

  it('persists entry to file', () => {
    const fp = tmpBoard()
    try {
      addEntry({ podId: 'pod-2', task: 'Fix bug' }, fp)
      const board = getFlightBoard(fp)
      expect(board.entries).toHaveLength(1)
      expect(board.entries[0].podId).toBe('pod-2')
    } finally {
      try { fs.unlinkSync(fp) } catch { /* ignore */ }
    }
  })

  it('accepts optional fields', () => {
    const fp = tmpBoard()
    try {
      const entry = addEntry(
        { podId: 'pod-3', task: 'Refactor', status: 'solving', filesInFlight: ['src/foo.ts'], cwd: '/tmp' },
        fp,
      )
      expect(entry.status).toBe('solving')
      expect(entry.filesInFlight).toEqual(['src/foo.ts'])
      expect(entry.cwd).toBe('/tmp')
    } finally {
      try { fs.unlinkSync(fp) } catch { /* ignore */ }
    }
  })

  it('appends multiple entries', () => {
    const fp = tmpBoard()
    try {
      addEntry({ podId: 'pod-a', task: 'Task A' }, fp)
      addEntry({ podId: 'pod-b', task: 'Task B' }, fp)
      expect(getActiveEntries(fp)).toHaveLength(2)
    } finally {
      try { fs.unlinkSync(fp) } catch { /* ignore */ }
    }
  })
})

describe('updateEntry', () => {
  it('merges updates and bumps updatedAt', async () => {
    const fp = tmpBoard()
    try {
      addEntry({ podId: 'pod-x', task: 'Work' }, fp)
      const before = getActiveEntries(fp)[0]

      // Small delay to ensure updatedAt changes
      await new Promise(r => setTimeout(r, 5))

      updateEntry('pod-x', { status: 'solving', filesInFlight: ['src/a.ts'] }, fp)
      const after = getActiveEntries(fp)[0]

      expect(after.status).toBe('solving')
      expect(after.filesInFlight).toEqual(['src/a.ts'])
      expect(after.podId).toBe('pod-x')
      expect(after.startedAt).toBe(before.startedAt)
      expect(after.updatedAt).not.toBe(before.updatedAt)
    } finally {
      try { fs.unlinkSync(fp) } catch { /* ignore */ }
    }
  })

  it('is a no-op for unknown podId', () => {
    const fp = tmpBoard()
    try {
      addEntry({ podId: 'pod-y', task: 'Work' }, fp)
      updateEntry('nonexistent', { status: 'failed' }, fp)
      const entries = getActiveEntries(fp)
      expect(entries).toHaveLength(1)
      expect(entries[0].status).toBe('planning')
    } finally {
      try { fs.unlinkSync(fp) } catch { /* ignore */ }
    }
  })
})

describe('removeEntry', () => {
  it('removes the entry so it is no longer present', () => {
    const fp = tmpBoard()
    try {
      addEntry({ podId: 'pod-del', task: 'Delete me' }, fp)
      expect(getActiveEntries(fp)).toHaveLength(1)
      removeEntry('pod-del', fp)
      expect(getActiveEntries(fp)).toHaveLength(0)
    } finally {
      try { fs.unlinkSync(fp) } catch { /* ignore */ }
    }
  })

  it('only removes the targeted entry', () => {
    const fp = tmpBoard()
    try {
      addEntry({ podId: 'pod-keep', task: 'Keep' }, fp)
      addEntry({ podId: 'pod-gone', task: 'Gone' }, fp)
      removeEntry('pod-gone', fp)
      const entries = getActiveEntries(fp)
      expect(entries).toHaveLength(1)
      expect(entries[0].podId).toBe('pod-keep')
    } finally {
      try { fs.unlinkSync(fp) } catch { /* ignore */ }
    }
  })
})

describe('hasFileConflict', () => {
  it('returns null when no files are in flight', () => {
    const fp = tmpBoard()
    try {
      addEntry({ podId: 'pod-c1', task: 'Task' }, fp)
      expect(hasFileConflict(['src/foo.ts'], fp)).toBeNull()
    } finally {
      try { fs.unlinkSync(fp) } catch { /* ignore */ }
    }
  })

  it('returns null when files do not overlap', () => {
    const fp = tmpBoard()
    try {
      addEntry({ podId: 'pod-c2', task: 'Task', filesInFlight: ['src/a.ts'] }, fp)
      expect(hasFileConflict(['src/b.ts'], fp)).toBeNull()
    } finally {
      try { fs.unlinkSync(fp) } catch { /* ignore */ }
    }
  })

  it('returns the owning entry when there is an overlap', () => {
    const fp = tmpBoard()
    try {
      addEntry({ podId: 'pod-c3', task: 'Task', filesInFlight: ['src/shared.ts', 'src/other.ts'] }, fp)
      const conflict = hasFileConflict(['src/shared.ts'], fp)
      expect(conflict).not.toBeNull()
      expect(conflict!.podId).toBe('pod-c3')
    } finally {
      try { fs.unlinkSync(fp) } catch { /* ignore */ }
    }
  })
})

describe('getFilesInFlight', () => {
  it('maps each file to its owning entry', () => {
    const fp = tmpBoard()
    try {
      addEntry({ podId: 'pod-f1', task: 'A', filesInFlight: ['src/x.ts', 'src/y.ts'] }, fp)
      addEntry({ podId: 'pod-f2', task: 'B', filesInFlight: ['src/z.ts'] }, fp)
      const map = getFilesInFlight(fp)
      expect(map.size).toBe(3)
      expect(map.get('src/x.ts')?.podId).toBe('pod-f1')
      expect(map.get('src/y.ts')?.podId).toBe('pod-f1')
      expect(map.get('src/z.ts')?.podId).toBe('pod-f2')
    } finally {
      try { fs.unlinkSync(fp) } catch { /* ignore */ }
    }
  })

  it('returns empty map when no entries', () => {
    const fp = tmpBoard()
    try {
      expect(getFilesInFlight(fp).size).toBe(0)
    } finally {
      try { fs.unlinkSync(fp) } catch { /* ignore */ }
    }
  })
})

describe('auto-cleanup of expired terminal entries', () => {
  it('excludes terminal entries older than 24h from getActiveEntries', () => {
    const fp = tmpBoard()
    try {
      // Write a stale merged entry directly
      const staleTime = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()
      fs.writeFileSync(fp, JSON.stringify({
        version: 1,
        entries: [
          { podId: 'stale-pod', task: 'Old work', status: 'merged', filesInFlight: [], startedAt: staleTime, updatedAt: staleTime },
        ],
      }))

      expect(getActiveEntries(fp)).toHaveLength(0)
    } finally {
      try { fs.unlinkSync(fp) } catch { /* ignore */ }
    }
  })

  it('keeps terminal entries that are still within the TTL', () => {
    const fp = tmpBoard()
    try {
      const recentTime = new Date(Date.now() - 30 * 60 * 1000).toISOString() // 30 min ago
      fs.writeFileSync(fp, JSON.stringify({
        version: 1,
        entries: [
          { podId: 'recent-pod', task: 'Recent work', status: 'failed', filesInFlight: [], startedAt: recentTime, updatedAt: recentTime },
        ],
      }))

      expect(getActiveEntries(fp)).toHaveLength(1)
    } finally {
      try { fs.unlinkSync(fp) } catch { /* ignore */ }
    }
  })

  it('keeps non-terminal entries regardless of age', () => {
    const fp = tmpBoard()
    try {
      const oldTime = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
      fs.writeFileSync(fp, JSON.stringify({
        version: 1,
        entries: [
          { podId: 'long-pod', task: 'Long running', status: 'solving', filesInFlight: ['src/a.ts'], startedAt: oldTime, updatedAt: oldTime },
        ],
      }))

      expect(getActiveEntries(fp)).toHaveLength(1)
    } finally {
      try { fs.unlinkSync(fp) } catch { /* ignore */ }
    }
  })
})

describe('getFlightBoard fallback', () => {
  it('returns empty board when file does not exist', () => {
    const fp = tmpBoard() // never written
    const board = getFlightBoard(fp)
    expect(board.version).toBe(1)
    expect(board.entries).toEqual([])
  })

  it('returns empty board on corrupt JSON', () => {
    const fp = tmpBoard()
    try {
      fs.writeFileSync(fp, '{ corrupt json :::')
      const board = getFlightBoard(fp)
      expect(board.entries).toEqual([])
    } finally {
      try { fs.unlinkSync(fp) } catch { /* ignore */ }
    }
  })
})
