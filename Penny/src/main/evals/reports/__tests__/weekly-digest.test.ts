/**
 * Unit tests for Weekly Eval Digest
 *
 * Run with: npx vitest run src/main/evals/reports/__tests__/weekly-digest.test.ts
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { generateWeeklyDigest, type DigestOptions } from '../weekly-digest'
import type { TaskOutcome } from '../../harness'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'weekly-digest-test-'))
}

function makeOutcome(overrides: Partial<TaskOutcome> = {}): TaskOutcome {
  return {
    taskId: `task-${Math.random().toString(36).slice(2, 8)}`,
    agentId: 'marcus',
    status: 'completed',
    priority: 'normal',
    startedAt: new Date('2026-03-23T10:00:00Z').toISOString(),
    completedAt: new Date('2026-03-23T10:05:00Z').toISOString(),
    retryCount: 0,
    duration_ms: 5000,
    ...overrides,
  }
}

function writeOutcomes(filePath: string, outcomes: TaskOutcome[]): void {
  const dir = path.dirname(filePath)
  fs.mkdirSync(dir, { recursive: true })
  const lines = outcomes.map(o => JSON.stringify(o)).join('\n') + '\n'
  fs.writeFileSync(filePath, lines, 'utf-8')
}

interface PrefEvent {
  id: string
  timestamp: string
  agentId: string
  signal: string
  strength: string
  context: Record<string, unknown>
}

function writePreferences(dir: string, events: PrefEvent[]): void {
  fs.mkdirSync(dir, { recursive: true })
  const lines = events.map(e => JSON.stringify(e)).join('\n') + '\n'
  fs.writeFileSync(path.join(dir, 'preferences.jsonl'), lines, 'utf-8')
}

interface PodRecord {
  id: string
  status: string
  iteration: number
  createdAt: number
}

function writePods(filePath: string, pods: PodRecord[]): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(pods), 'utf-8')
}

// Monday March 23, 2026 is the start of W13
const WEEK_OF = new Date('2026-03-25T12:00:00Z') // Wednesday of W13
const THIS_WEEK_START = new Date('2026-03-23T00:00:00Z') // Monday
const PRIOR_WEEK_MID = new Date('2026-03-18T12:00:00Z') // Wednesday of W12

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Weekly Eval Digest', () => {
  let tmpDir: string
  let opts: DigestOptions

  beforeEach(() => {
    tmpDir = makeTmpDir()
    opts = {
      outcomesPath: path.join(tmpDir, 'eval-outcomes.jsonl'),
      preferencesDir: path.join(tmpDir, 'prefs'),
      podsPath: path.join(tmpDir, 'pod-workflows.json'),
      outputDir: path.join(tmpDir, 'output'),
      weekOf: WEEK_OF,
    }
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('generates a report with mock data', async () => {
    // Write task outcomes for this week
    const outcomes: TaskOutcome[] = []
    for (let i = 0; i < 10; i++) {
      outcomes.push(makeOutcome({
        agentId: i < 6 ? 'marcus' : 'lena',
        status: i < 8 ? 'completed' : 'failed',
        completedAt: new Date('2026-03-24T10:00:00Z').toISOString(),
      }))
    }
    writeOutcomes(opts.outcomesPath!, outcomes)

    // Write preferences
    const prefs: PrefEvent[] = [
      { id: '1', timestamp: new Date('2026-03-24T11:00:00Z').toISOString(), agentId: 'marcus', signal: 'approve', strength: 'strong', context: {} },
      { id: '2', timestamp: new Date('2026-03-24T12:00:00Z').toISOString(), agentId: 'lena', signal: 'reject', strength: 'strong', context: {} },
      { id: '3', timestamp: new Date('2026-03-24T13:00:00Z').toISOString(), agentId: 'marcus', signal: 'approve', strength: 'strong', context: {} },
    ]
    writePreferences(opts.preferencesDir!, prefs)

    // Write pods
    writePods(opts.podsPath!, [
      { id: 'pod-1', status: 'complete', iteration: 1, createdAt: new Date('2026-03-24T09:00:00Z').getTime() },
      { id: 'pod-2', status: 'complete', iteration: 3, createdAt: new Date('2026-03-25T09:00:00Z').getTime() },
    ])

    const result = await generateWeeklyDigest(opts)

    expect(result.markdown).toContain('# Penny Weekly Eval Digest — 2026-W13')
    expect(result.markdown).toContain('## Summary')
    expect(result.markdown).toContain('## Agent Rankings')
    expect(result.markdown).toContain('## Pod Quality')
    expect(result.markdown).toContain('## Recommendations')
    expect(result.markdown).toContain('10 tasks completed')
    expect(result.markdown).toContain('80% success rate')
    expect(result.markdown).toContain('3 preference signals')
    expect(result.markdown).toContain('2 approvals')
    expect(result.markdown).toContain('1 rejections')
    expect(result.markdown).toContain('2 pod workflows')
    expect(result.markdown).toContain('marcus')
    expect(result.markdown).toContain('lena')
    expect(fs.existsSync(result.filePath)).toBe(true)
  })

  it('computes trend correctly (week-over-week)', async () => {
    // Prior week: 60% success (3/5)
    const priorOutcomes = Array.from({ length: 5 }, (_, i) =>
      makeOutcome({
        agentId: 'marcus',
        status: i < 3 ? 'completed' : 'failed',
        completedAt: new Date(`2026-03-${18 + (i % 3)}T10:00:00Z`).toISOString(), // W12
      }),
    )
    // This week: 80% success (4/5)
    const thisWeekOutcomes = Array.from({ length: 5 }, (_, i) =>
      makeOutcome({
        agentId: 'marcus',
        status: i < 4 ? 'completed' : 'failed',
        completedAt: new Date(`2026-03-${24}T${10 + i}:00:00Z`).toISOString(), // W13
      }),
    )
    writeOutcomes(opts.outcomesPath!, [...priorOutcomes, ...thisWeekOutcomes])

    const result = await generateWeeklyDigest(opts)

    // Summary should show "up from 60%"
    expect(result.markdown).toContain('80% success rate')
    expect(result.markdown).toContain('+20%')
    expect(result.markdown).toContain('60%')

    // Agent table should show +20% trend
    const tableLines = result.markdown.split('\n').filter(l => l.startsWith('| marcus'))
    expect(tableLines.length).toBe(1)
    expect(tableLines[0]).toContain('+20%')
  })

  it('handles empty data gracefully', async () => {
    // No files at all
    const result = await generateWeeklyDigest(opts)

    expect(result.markdown).toContain('# Penny Weekly Eval Digest')
    expect(result.markdown).toContain('0 tasks completed')
    expect(result.markdown).toContain('0% success rate')
    expect(result.markdown).toContain('0 preference signals')
    expect(result.markdown).toContain('0 pod workflows this week')
    expect(result.markdown).toContain('No agent activity this week.')
    expect(fs.existsSync(result.filePath)).toBe(true)
  })

  it('counts preference signals correctly', async () => {
    const prefs: PrefEvent[] = [
      { id: '1', timestamp: new Date('2026-03-24T10:00:00Z').toISOString(), agentId: 'a', signal: 'approve', strength: 'strong', context: {} },
      { id: '2', timestamp: new Date('2026-03-24T11:00:00Z').toISOString(), agentId: 'a', signal: 'approve', strength: 'strong', context: {} },
      { id: '3', timestamp: new Date('2026-03-24T12:00:00Z').toISOString(), agentId: 'b', signal: 'reject', strength: 'strong', context: {} },
      { id: '4', timestamp: new Date('2026-03-24T13:00:00Z').toISOString(), agentId: 'a', signal: 'edit', strength: 'weak', context: {} },
      { id: '5', timestamp: new Date('2026-03-24T14:00:00Z').toISOString(), agentId: 'b', signal: 'complete', strength: 'strong', context: {} },
      // Outside range — should be excluded
      { id: '6', timestamp: new Date('2026-03-15T10:00:00Z').toISOString(), agentId: 'a', signal: 'approve', strength: 'strong', context: {} },
    ]
    writePreferences(opts.preferencesDir!, prefs)

    const result = await generateWeeklyDigest(opts)

    expect(result.markdown).toContain('5 preference signals captured')
    expect(result.markdown).toContain('2 approvals')
    expect(result.markdown).toContain('1 rejections')
  })

  it('summarizes pod quality correctly', async () => {
    writePods(opts.podsPath!, [
      { id: 'p1', status: 'complete', iteration: 1, createdAt: new Date('2026-03-24T09:00:00Z').getTime() },
      { id: 'p2', status: 'complete', iteration: 1, createdAt: new Date('2026-03-24T10:00:00Z').getTime() },
      { id: 'p3', status: 'complete', iteration: 2, createdAt: new Date('2026-03-25T09:00:00Z').getTime() },
      { id: 'p4', status: 'failed', iteration: 3, createdAt: new Date('2026-03-25T10:00:00Z').getTime() },
      // Outside range
      { id: 'p5', status: 'complete', iteration: 1, createdAt: new Date('2026-03-15T09:00:00Z').getTime() },
    ])

    const result = await generateWeeklyDigest(opts)

    expect(result.markdown).toContain('4 pod workflows')
    expect(result.markdown).toContain('Completed: 3')
    expect(result.markdown).toContain('Failed: 1')
    expect(result.markdown).toContain('First-pass completions: 2')
    expect(result.markdown).toContain('Iterated completions: 1')
  })

  it('generates recommendations for high and low performers', async () => {
    // High performer: >90% success, streak >= 5
    const outcomes: TaskOutcome[] = []
    for (let i = 0; i < 10; i++) {
      outcomes.push(makeOutcome({
        agentId: 'star-agent',
        status: 'completed',
        completedAt: new Date(`2026-03-24T${10 + i}:00:00Z`).toISOString(),
      }))
    }
    // Low performer: <60% success
    for (let i = 0; i < 5; i++) {
      outcomes.push(makeOutcome({
        agentId: 'struggling-agent',
        status: i < 2 ? 'completed' : 'failed',
        completedAt: new Date(`2026-03-24T${10 + i}:30:00Z`).toISOString(),
      }))
    }
    writeOutcomes(opts.outcomesPath!, outcomes)

    const result = await generateWeeklyDigest(opts)

    expect(result.markdown).toContain('star-agent ready for increased autonomy')
    expect(result.markdown).toContain('struggling-agent struggling')
  })

  it('detects inactive agents from prior week', async () => {
    // Prior week: agent had tasks
    const priorOutcomes = [
      makeOutcome({
        agentId: 'gone-agent',
        completedAt: new Date('2026-03-18T10:00:00Z').toISOString(),
      }),
    ]
    // This week: different agent active, gone-agent absent
    const thisWeekOutcomes = [
      makeOutcome({
        agentId: 'active-agent',
        completedAt: new Date('2026-03-24T10:00:00Z').toISOString(),
      }),
    ]
    writeOutcomes(opts.outcomesPath!, [...priorOutcomes, ...thisWeekOutcomes])

    const result = await generateWeeklyDigest(opts)

    expect(result.markdown).toContain('gone-agent inactive this week')
  })

  it('includes events at exact week boundaries', async () => {
    writeOutcomes(opts.outcomesPath!, [
      makeOutcome({ agentId: 'boundary-agent', status: 'completed', completedAt: '2026-03-23T00:00:00.000Z' }),
      makeOutcome({ agentId: 'boundary-agent', status: 'completed', completedAt: '2026-03-29T23:59:59.999Z' }),
      makeOutcome({ agentId: 'boundary-agent', status: 'failed', completedAt: '2026-03-22T23:59:59.999Z' }),
    ])

    writePreferences(opts.preferencesDir!, [
      { id: 'p1', timestamp: '2026-03-23T00:00:00.000Z', agentId: 'boundary-agent', signal: 'approve', strength: 'strong', context: {} },
      { id: 'p2', timestamp: '2026-03-29T23:59:59.999Z', agentId: 'boundary-agent', signal: 'reject', strength: 'strong', context: {} },
      { id: 'p3', timestamp: '2026-03-22T23:59:59.999Z', agentId: 'boundary-agent', signal: 'approve', strength: 'strong', context: {} },
    ])

    writePods(opts.podsPath!, [
      { id: 'pod-start', status: 'complete', iteration: 1, createdAt: Date.parse('2026-03-23T00:00:00.000Z') },
      { id: 'pod-end', status: 'failed', iteration: 2, createdAt: Date.parse('2026-03-29T23:59:59.999Z') },
      { id: 'pod-prior', status: 'complete', iteration: 1, createdAt: Date.parse('2026-03-22T23:59:59.999Z') },
    ])

    const result = await generateWeeklyDigest(opts)
    expect(result.markdown).toContain('2 tasks completed (100% success rate')
    expect(result.markdown).toContain('2 preference signals captured (1 approvals, 1 rejections)')
    expect(result.markdown).toContain('2 pod workflows')
    expect(result.markdown).toContain('Completed: 1')
    expect(result.markdown).toContain('Failed: 1')
  })

  it('ignores malformed records without throwing', async () => {
    writeOutcomes(opts.outcomesPath!, [
      makeOutcome({ agentId: 'safe-agent', status: 'completed', completedAt: '2026-03-24T10:00:00.000Z' }),
    ])
    fs.appendFileSync(opts.outcomesPath!, '{"invalid-json":\n', 'utf-8')

    writePreferences(opts.preferencesDir!, [
      { id: 'ok', timestamp: '2026-03-24T10:00:00.000Z', agentId: 'safe-agent', signal: 'approve', strength: 'strong', context: {} },
      { id: 'bad-ts', timestamp: 'not-a-date', agentId: 'safe-agent', signal: 'reject', strength: 'strong', context: {} },
    ])

    fs.writeFileSync(opts.podsPath!, JSON.stringify([
      { id: 'valid', status: 'complete', iteration: 1, createdAt: Date.parse('2026-03-24T10:00:00.000Z') },
      { id: 'invalid', status: 'complete', createdAt: Date.parse('2026-03-24T11:00:00.000Z') },
    ]), 'utf-8')

    const result = await generateWeeklyDigest(opts)
    expect(result.markdown).toContain('1 tasks completed (100% success rate')
    expect(result.markdown).toContain('1 preference signals captured (1 approvals, 0 rejections)')
    expect(result.markdown).toContain('1 pod workflows')
  })
})
