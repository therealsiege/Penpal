import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fsp from 'fs/promises'
import os from 'os'
import path from 'path'
import { PreferenceStore } from './store'
import { PairGenerator } from './pairs'
import type { DPOPair } from './pairs'
import type { PreferenceEvent } from './types'

function makeEvent(overrides: Partial<PreferenceEvent>): PreferenceEvent {
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

async function collectPairs(gen: AsyncIterable<DPOPair>): Promise<DPOPair[]> {
  const pairs: DPOPair[] = []
  for await (const pair of gen) pairs.push(pair)
  return pairs
}

describe('PairGenerator', () => {
  let tmpDir: string
  let store: PreferenceStore
  let generator: PairGenerator

  beforeEach(async () => {
    tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'dpo-pairs-'))
    store = new PreferenceStore(tmpDir)
    generator = new PairGenerator(store)
  })

  afterEach(async () => {
    await fsp.rm(tmpDir, { recursive: true, force: true })
  })

  it('approve + reject with same context produces valid pair', async () => {
    await store.append(
      makeEvent({
        signal: 'approve',
        agentId: 'agent-1',
        sessionId: 'session-1',
        context: { toolCall: 'run-tests', toolResult: 'npm test passed' },
        timestamp: '2026-03-01T00:00:00.000Z',
      }),
    )
    await store.append(
      makeEvent({
        signal: 'reject',
        agentId: 'agent-1',
        sessionId: 'session-1',
        context: { toolCall: 'run-tests', toolResult: 'rm -rf /' },
        timestamp: '2026-03-01T00:00:01.000Z',
      }),
    )

    const pairs = await collectPairs(generator.generate())
    expect(pairs).toHaveLength(1)
    expect(pairs[0].source).toBe('approve_reject')
    expect(pairs[0].prompt).toBe('run-tests')
    expect(pairs[0].chosen).toBe('npm test passed')
    expect(pairs[0].rejected).toBe('rm -rf /')
    expect(pairs[0].agentId).toBe('agent-1')
  })

  it('approve + reject with different context produces no pair', async () => {
    await store.append(
      makeEvent({
        signal: 'approve',
        agentId: 'agent-1',
        sessionId: 'session-1',
        context: { toolCall: 'run-tests', toolResult: 'good' },
      }),
    )
    await store.append(
      makeEvent({
        signal: 'reject',
        agentId: 'agent-1',
        sessionId: 'session-1',
        context: { toolCall: 'run-lint', toolResult: 'bad' },
      }),
    )

    const pairs = await collectPairs(generator.generate())
    expect(pairs).toHaveLength(0)
  })

  it('complete + fail on different task types produces no outcome pair', async () => {
    await store.append(
      makeEvent({
        signal: 'complete',
        agentId: 'agent-1',
        context: { toolCall: 'orchestrator:task-completed', toolResult: 'task-42 succeeded' },
        timestamp: '2026-03-02T00:00:00.000Z',
      }),
    )
    await store.append(
      makeEvent({
        signal: 'fail',
        agentId: 'agent-1',
        context: { toolCall: 'orchestrator:task-failed', toolResult: 'task-43 failed' },
        timestamp: '2026-03-02T00:00:01.000Z',
      }),
    )

    const pairs = await collectPairs(generator.generate())
    expect(pairs).toHaveLength(0)
  })

  it('complete + fail with same task type prefix produces one pair', async () => {
    await store.append(
      makeEvent({
        signal: 'complete',
        agentId: 'agent-1',
        context: { toolCall: 'build:api success', toolResult: 'build succeeded' },
      }),
    )
    await store.append(
      makeEvent({
        signal: 'fail',
        agentId: 'agent-1',
        context: { toolCall: 'build:api retry', toolResult: 'build failed' },
      }),
    )

    const pairs = await collectPairs(generator.generate())
    expect(pairs).toHaveLength(1)
    expect(pairs[0].source).toBe('complete_fail')
    expect(pairs[0].chosen).toBe('build succeeded')
    expect(pairs[0].rejected).toBe('build failed')
  })

  it('complete + fail on different task types produces no pair', async () => {
    await store.append(
      makeEvent({
        signal: 'complete',
        agentId: 'agent-1',
        context: { toolCall: 'build:api', toolResult: 'ok' },
      }),
    )
    await store.append(
      makeEvent({
        signal: 'fail',
        agentId: 'agent-1',
        context: { toolCall: 'test:api', toolResult: 'failed' },
      }),
    )
    const pairs = await collectPairs(generator.generate())
    expect(pairs).toHaveLength(0)
  })

  it('edit event produces corrective pair', async () => {
    await store.append(
      makeEvent({
        signal: 'edit',
        agentId: 'agent-1',
        context: { toolCall: 'write-code', toolResult: 'function foo() {}' },
        userAction: 'function foo(): string { return "bar" }',
      }),
    )

    const pairs = await collectPairs(generator.generate())
    expect(pairs).toHaveLength(1)
    expect(pairs[0].source).toBe('edit_corrective')
    expect(pairs[0].chosen).toBe('function foo(): string { return "bar" }')
    expect(pairs[0].rejected).toBe('function foo() {}')
  })

  it('edit without before/after yields no pairs', async () => {
    await store.append(
      makeEvent({
        signal: 'edit',
        agentId: 'agent-1',
        context: { toolCall: 'write-code', toolResult: '' },
        userAction: '',
      }),
    )

    const pairs = await collectPairs(generator.generate())
    expect(pairs).toHaveLength(0)
  })

  it('since filter excludes old events', async () => {
    const oldDate = new Date('2020-01-01T00:00:00Z')
    const recentDate = new Date()

    await store.append(
      makeEvent({
        signal: 'approve',
        agentId: 'agent-1',
        timestamp: oldDate.toISOString(),
        context: { toolCall: 'old-task' },
      }),
    )
    await store.append(
      makeEvent({
        signal: 'reject',
        agentId: 'agent-1',
        timestamp: oldDate.toISOString(),
        context: { toolCall: 'old-task' },
      }),
    )
    await store.append(
      makeEvent({
        signal: 'complete',
        agentId: 'agent-2',
        timestamp: recentDate.toISOString(),
        context: { toolCall: 'new-task', toolResult: 'done' },
      }),
    )
    await store.append(
      makeEvent({
        signal: 'fail',
        agentId: 'agent-2',
        timestamp: recentDate.toISOString(),
        context: { toolCall: 'new-task-2', toolResult: 'error' },
      }),
    )

    const since = new Date(Date.now() - 60 * 60 * 1000)
    const pairs = await collectPairs(generator.generate(since))
    expect(pairs).toHaveLength(0)
  })

  it('exported JSONL has correct TRL DPOTrainer schema', async () => {
    await store.append(
      makeEvent({
        signal: 'approve',
        agentId: 'agent-1',
        context: { toolCall: 'run-tests', toolResult: 'ok' },
      }),
    )
    await store.append(
      makeEvent({
        signal: 'reject',
        agentId: 'agent-1',
        context: { toolCall: 'run-tests', toolResult: 'bad' },
      }),
    )

    const outPath = path.join(tmpDir, 'output.jsonl')
    const count = await generator.export(outPath, 'jsonl')

    expect(count).toBe(1)

    const content = await fsp.readFile(outPath, 'utf-8')
    const lines = content.trim().split('\n')
    expect(lines).toHaveLength(1)

    const record = JSON.parse(lines[0])
    // TRL DPOTrainer requires prompt, chosen, rejected as strings
    expect(typeof record.prompt).toBe('string')
    expect(typeof record.chosen).toBe('string')
    expect(typeof record.rejected).toBe('string')
    expect(record.prompt).toBe('run-tests')
    expect(record.chosen).toBe('ok')
    expect(record.rejected).toBe('bad')
    // Metadata fields
    expect(record.source).toBe('approve_reject')
    expect(record.agentId).toBe('agent-1')
    expect(typeof record.timestamp).toBe('string')
  })

  it('export returns correct pair count', async () => {
    await store.append(
      makeEvent({
        signal: 'approve',
        agentId: 'agent-1',
        sessionId: 'session-1',
        context: { toolCall: 'task-1', toolResult: 'good' },
      }),
    )
    await store.append(
      makeEvent({
        signal: 'reject',
        agentId: 'agent-1',
        sessionId: 'session-1',
        context: { toolCall: 'task-1', toolResult: 'bad' },
      }),
    )
    await store.append(
      makeEvent({
        signal: 'edit',
        agentId: 'agent-2',
        context: { toolCall: 'edit-ctx', toolResult: 'original' },
        userAction: 'corrected',
      }),
    )

    const outPath = path.join(tmpDir, 'output.jsonl')
    const count = await generator.export(outPath, 'jsonl')

    expect(count).toBe(2)

    const content = await fsp.readFile(outPath, 'utf-8')
    const lines = content.trim().split('\n')
    expect(lines).toHaveLength(2)
  })

  it('parquet export throws not-implemented error', async () => {
    const outPath = path.join(tmpDir, 'output.parquet')
    await expect(generator.export(outPath, 'parquet')).rejects.toThrow('not yet implemented')
  })

  it('stats returns accurate counts by source', async () => {
    await store.append(
      makeEvent({
        signal: 'approve',
        agentId: 'agent-1',
        sessionId: 'session-1',
        context: { toolCall: 'task-1', toolResult: 'good' },
      }),
    )
    await store.append(
      makeEvent({
        signal: 'reject',
        agentId: 'agent-1',
        sessionId: 'session-1',
        context: { toolCall: 'task-1', toolResult: 'bad' },
      }),
    )
    await store.append(
      makeEvent({
        signal: 'complete',
        agentId: 'agent-2',
        context: { toolCall: 'build:api completed', toolResult: 'done' },
      }),
    )
    await store.append(
      makeEvent({
        signal: 'fail',
        agentId: 'agent-2',
        context: { toolCall: 'build:api failed', toolResult: 'error' },
      }),
    )
    await store.append(
      makeEvent({
        signal: 'edit',
        agentId: 'agent-3',
        context: { toolCall: 'edit-ctx', toolResult: 'original' },
        userAction: 'corrected',
      }),
    )

    const stats = await generator.stats()
    expect(stats.totalPairs).toBe(3)
    expect(stats.bySource).toEqual({
      approve_reject: 1,
      complete_fail: 1,
      edit_corrective: 1,
    })
  })

  it('pairs deterministically without reusing the same approve event', async () => {
    await store.append(
      makeEvent({
        id: 'approve-1',
        timestamp: '2026-03-05T00:00:00.000Z',
        signal: 'approve',
        agentId: 'agent-1',
        sessionId: 'session-1',
        context: { toolCall: 'run-tests', toolResult: 'good-1' },
      }),
    )
    await store.append(
      makeEvent({
        id: 'approve-2',
        timestamp: '2026-03-05T00:00:01.000Z',
        signal: 'approve',
        agentId: 'agent-1',
        sessionId: 'session-1',
        context: { toolCall: 'run-tests', toolResult: 'good-2' },
      }),
    )
    await store.append(
      makeEvent({
        id: 'reject-1',
        timestamp: '2026-03-05T00:00:02.000Z',
        signal: 'reject',
        agentId: 'agent-1',
        sessionId: 'session-1',
        context: { toolCall: 'run-tests', toolResult: 'bad-1' },
      }),
    )
    await store.append(
      makeEvent({
        id: 'reject-2',
        timestamp: '2026-03-05T00:00:03.000Z',
        signal: 'reject',
        agentId: 'agent-1',
        sessionId: 'session-1',
        context: { toolCall: 'run-tests', toolResult: 'bad-2' },
      }),
    )

    const pairs = await collectPairs(generator.generate())
    expect(pairs.map((pair) => [pair.chosen, pair.rejected])).toEqual([
      ['good-1', 'bad-1'],
      ['good-2', 'bad-2'],
    ])
  })
})
