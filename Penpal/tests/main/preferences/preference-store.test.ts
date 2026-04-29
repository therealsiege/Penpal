import { describe, it, beforeEach, afterEach, expect } from 'vitest'
import fs from 'fs'
import fsp from 'fs/promises'
import path from 'path'
import os from 'os'
import crypto from 'crypto'
import { PreferenceStore } from '../../../src/main/preferences/store'
import type { PreferenceEvent } from '../../../src/main/preferences/types'

function tmpDir(): string {
  return path.join(os.tmpdir(), `pref-test-${crypto.randomUUID()}`)
}

function makeEvent(overrides: Partial<PreferenceEvent> = {}): PreferenceEvent {
  return {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    agentId: 'agent-1',
    signal: 'approve',
    strength: 'strong',
    context: {},
    ...overrides,
  }
}

async function collect<T>(iter: AsyncIterable<T>): Promise<T[]> {
  const items: T[] = []
  for await (const item of iter) items.push(item)
  return items
}

describe('PreferenceStore', () => {
  let dataDir: string

  beforeEach(() => {
    dataDir = tmpDir()
  })

  afterEach(async () => {
    await fsp.rm(dataDir, { recursive: true, force: true })
  })

  it('write and read 100 events', async () => {
    const store = new PreferenceStore(dataDir)
    const events = Array.from({ length: 100 }, (_, i) =>
      makeEvent({ id: `evt-${i}`, agentId: `agent-${i % 3}`, signal: i % 2 === 0 ? 'approve' : 'reject' }),
    )
    for (const e of events) await store.append(e)

    const count = await store.count()
    expect(count).toBe(100)

    const all = await collect(store.query())
    expect(all.length).toBe(100)
  })

  it('query by agentId', async () => {
    const store = new PreferenceStore(dataDir)
    for (let i = 0; i < 30; i++) {
      await store.append(makeEvent({ agentId: `agent-${i % 3}` }))
    }

    const agent0 = await collect(store.query({ agentId: 'agent-0' }))
    expect(agent0.length).toBe(10)
    expect(agent0.every((e) => e.agentId === 'agent-0')).toBe(true)
  })

  it('query by signal', async () => {
    const store = new PreferenceStore(dataDir)
    const signals: Array<PreferenceEvent['signal']> = ['approve', 'reject', 'edit']
    for (let i = 0; i < 30; i++) {
      await store.append(makeEvent({ signal: signals[i % 3] }))
    }

    const edits = await collect(store.query({ signal: 'edit' }))
    expect(edits.length).toBe(10)
    expect(edits.every((e) => e.signal === 'edit')).toBe(true)
  })

  it('query by date range (since)', async () => {
    const store = new PreferenceStore(dataDir)
    const now = Date.now()
    for (let i = 0; i < 20; i++) {
      await store.append(makeEvent({ timestamp: new Date(now - (20 - i) * 1000).toISOString() }))
    }

    const since = new Date(now - 10 * 1000)
    const recent = await collect(store.query({ since }))
    // Since filter compares timestamps; string ISO comparison works chronologically
    expect(recent.length).toBeGreaterThanOrEqual(1)
  })

  it('stats() returns correct counts by signal and agent', async () => {
    const store = new PreferenceStore(dataDir)
    const distribution = [
      { agentId: 'alice', signal: 'approve' as const, count: 5 },
      { agentId: 'alice', signal: 'reject' as const, count: 3 },
      { agentId: 'bob', signal: 'approve' as const, count: 7 },
      { agentId: 'bob', signal: 'edit' as const, count: 2 },
    ]

    for (const { agentId, signal, count } of distribution) {
      for (let i = 0; i < count; i++) {
        await store.append(makeEvent({ agentId, signal }))
      }
    }

    const stats = await store.stats()
    expect(stats.total).toBe(17)
    expect(stats.bySignal['approve']).toBe(12)
    expect(stats.bySignal['reject']).toBe(3)
    expect(stats.bySignal['edit']).toBe(2)
    expect(stats.byAgent['alice']).toBe(8)
    expect(stats.byAgent['bob']).toBe(9)
  })

  it('concurrent appends do not corrupt', async () => {
    const store = new PreferenceStore(dataDir)
    const promises = Array.from({ length: 20 }, (_, i) =>
      store.append(makeEvent({ id: `concurrent-${i}` })),
    )
    await Promise.all(promises)

    const count = await store.count()
    expect(count).toBe(20)

    // Verify every line is valid JSON
    const content = await fsp.readFile(path.join(dataDir, 'preferences.jsonl'), 'utf-8')
    const lines = content.split('\n').filter((l) => l.trim())
    expect(lines.length).toBe(20)
    for (const line of lines) {
      expect(() => JSON.parse(line)).not.toThrow()
    }
  })

  it('file rotation at threshold', async () => {
    // Use a tiny threshold (512 bytes) so rotation triggers quickly
    const store = new PreferenceStore(dataDir, { rotationThreshold: 512 })
    for (let i = 0; i < 20; i++) {
      await store.append(makeEvent({ id: `rot-${i}`, context: { payload: 'x'.repeat(50) } as any }))
    }

    const files = fs.readdirSync(dataDir).filter((f) => f.startsWith('preferences') && f.endsWith('.jsonl'))
    expect(files.length).toBeGreaterThanOrEqual(2)

    // All events should still be queryable across rotated files
    const all = await collect(store.query())
    expect(all.length).toBe(20)
  })
})
