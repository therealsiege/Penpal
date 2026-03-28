import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fsp from 'fs/promises'
import os from 'os'
import path from 'path'
import { PreferenceStore } from './store'
import type { PreferenceEvent, PreferenceSignal } from './types'

function makeEvent(index: number, overrides: Partial<PreferenceEvent> = {}): PreferenceEvent {
  const signals: PreferenceSignal[] = ['approve', 'reject', 'edit', 'complete', 'fail']
  const signal = overrides.signal ?? signals[index % signals.length]
  return {
    id: `evt-${index}`,
    timestamp: new Date(Date.now() + index * 1000).toISOString(),
    agentId: `agent-${index % 4}`,
    signal,
    strength: signal === 'edit' ? 'weak' : 'strong',
    context: { toolCall: `task-${index}` },
    ...overrides,
  }
}

async function collectEvents(iterable: AsyncIterable<PreferenceEvent>): Promise<PreferenceEvent[]> {
  const events: PreferenceEvent[] = []
  for await (const event of iterable) {
    events.push(event)
  }
  return events
}

describe('PreferenceStore', () => {
  let tmpDir: string
  let store: PreferenceStore

  beforeEach(async () => {
    tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'preference-store-'))
    store = new PreferenceStore(tmpDir)
  })

  afterEach(async () => {
    await fsp.rm(tmpDir, { recursive: true, force: true })
  })

  it('writes 100 events and count() matches file content', async () => {
    for (let i = 0; i < 100; i++) {
      await store.append(makeEvent(i))
    }

    const total = await store.count()
    expect(total).toBe(100)

    const content = await fsp.readFile(path.join(tmpDir, 'preferences.jsonl'), 'utf-8')
    const lines = content.trim().split('\n')
    expect(lines).toHaveLength(100)
  })

  it('query filters by agentId, signal, and since date', async () => {
    const oldTs = new Date('2020-01-01T00:00:00.000Z').toISOString()
    await store.append(makeEvent(1, { timestamp: oldTs, agentId: 'agent-A', signal: 'approve' }))
    await store.append(makeEvent(2, { agentId: 'agent-A', signal: 'reject' }))
    await store.append(makeEvent(3, { agentId: 'agent-B', signal: 'reject' }))
    await store.append(makeEvent(4, { agentId: 'agent-B', signal: 'complete' }))

    const byAgent = await collectEvents(store.query({ agentId: 'agent-A' }))
    expect(byAgent).toHaveLength(2)
    expect(byAgent.every((e) => e.agentId === 'agent-A')).toBe(true)

    const bySignal = await collectEvents(store.query({ signal: 'reject' }))
    expect(bySignal).toHaveLength(2)
    expect(bySignal.every((e) => e.signal === 'reject')).toBe(true)

    const bySince = await collectEvents(store.query({ since: new Date(Date.now() - 60_000) }))
    expect(bySince).toHaveLength(3)
    expect(bySince.some((e) => e.timestamp === oldTs)).toBe(false)
  })

  it('stats returns totals grouped by signal and agent', async () => {
    await store.append(makeEvent(1, { agentId: 'agent-A', signal: 'approve' }))
    await store.append(makeEvent(2, { agentId: 'agent-A', signal: 'reject' }))
    await store.append(makeEvent(3, { agentId: 'agent-B', signal: 'reject' }))
    await store.append(makeEvent(4, { agentId: 'agent-B', signal: 'complete' }))
    await store.append(makeEvent(5, { agentId: 'agent-B', signal: 'complete' }))

    const stats = await store.stats()
    expect(stats.total).toBe(5)
    expect(stats.bySignal).toEqual({
      approve: 1,
      reject: 2,
      complete: 2,
    })
    expect(stats.byAgent).toEqual({
      'agent-A': 2,
      'agent-B': 3,
    })
  })

  it('concurrent appends keep JSONL lines valid and uncorrupted', async () => {
    const events = Array.from({ length: 200 }, (_, i) => makeEvent(i, { agentId: `agent-${i % 3}` }))
    await Promise.all(events.map((event) => store.append(event)))

    const filePath = path.join(tmpDir, 'preferences.jsonl')
    const content = await fsp.readFile(filePath, 'utf-8')
    const lines = content.trim().split('\n')
    expect(lines).toHaveLength(200)

    const ids = new Set<string>()
    for (const line of lines) {
      const parsed = JSON.parse(line) as PreferenceEvent
      ids.add(parsed.id)
    }
    expect(ids.size).toBe(200)
    expect(await store.count()).toBe(200)
  })

  it('rotates file at threshold and continues writing to active file', async () => {
    const tinyThreshold = 500
    const rotatingStore = new PreferenceStore(tmpDir, { rotationThreshold: tinyThreshold })

    for (let i = 0; i < 30; i++) {
      await rotatingStore.append(
        makeEvent(i, {
          context: { toolCall: `task-${i}`, toolResult: 'x'.repeat(120) },
        }),
      )
    }

    const files = await fsp.readdir(tmpDir)
    const rotated = files.filter((f) => /^preferences-\d{4}-/.test(f))
    expect(rotated.length).toBeGreaterThan(0)
    expect(files).toContain('preferences.jsonl')

    const queried = await collectEvents(rotatingStore.query())
    expect(queried.length).toBe(30)
  })
})
