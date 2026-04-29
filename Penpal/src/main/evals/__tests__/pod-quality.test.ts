/**
 * Unit tests for PodQualityCollector
 *
 * Run with: npx tsx src/main/evals/__tests__/pod-quality.test.ts
 */

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { PodQualityCollector, type PodQualityEvent } from '../collectors/pod-quality'

function makeTmpPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pod-quality-test-'))
  return path.join(dir, 'eval-pod-quality.jsonl')
}

function makeEvent(overrides: Partial<PodQualityEvent> = {}): PodQualityEvent {
  return {
    podId: `pod-${Math.random().toString(36).slice(2, 8)}`,
    presetId: 'frontend-feature',
    status: 'complete',
    iterations: 1,
    firstPassAccepted: true,
    executorPassed: true,
    selfFixed: false,
    completionTime_ms: 60_000,
    timestamp: Date.now(),
    ...overrides,
  }
}

describe('PodQualityCollector', () => {
  it('should handle empty/missing file gracefully', () => {
    const tmpPath = makeTmpPath()
    const collector = new PodQualityCollector(tmpPath)
    const report = collector.report()
    assert.equal(report.totalPods, 0)
    assert.equal(report.completionRate, 0)
    assert.equal(report.avgIterations, 0)
    assert.equal(report.reviewerFirstPassRate, 0)
    assert.equal(report.executorPassRate, 0)
    assert.equal(report.selfFixRate, 0)
    assert.equal(report.avgCompletionTime_ms, 0)
    assert.deepEqual(report.byPreset, {})
    assert.deepEqual(report.period, { from: '', to: '' })
    fs.rmSync(path.dirname(tmpPath), { recursive: true, force: true })
  })

  it('pod completing on first iteration → firstPassRate = 1.0', () => {
    const tmpPath = makeTmpPath()
    const collector = new PodQualityCollector(tmpPath)

    collector.record(makeEvent({
      status: 'complete',
      iterations: 1,
      firstPassAccepted: true,
      executorPassed: true,
    }))

    const report = collector.report()
    assert.equal(report.totalPods, 1)
    assert.equal(report.completionRate, 1.0)
    assert.equal(report.reviewerFirstPassRate, 1.0)
    assert.equal(report.executorPassRate, 1.0)
    assert.equal(report.avgIterations, 1)
    fs.rmSync(path.dirname(tmpPath), { recursive: true, force: true })
  })

  it('pod failing → decreases completionRate', () => {
    const tmpPath = makeTmpPath()
    const collector = new PodQualityCollector(tmpPath)

    collector.record(makeEvent({
      status: 'complete',
      iterations: 1,
      firstPassAccepted: true,
      executorPassed: true,
      timestamp: Date.now(),
    }))
    collector.record(makeEvent({
      status: 'failed',
      iterations: 3,
      firstPassAccepted: false,
      executorPassed: false,
      selfFixed: false,
      timestamp: Date.now() + 1000,
    }))

    const report = collector.report()
    assert.equal(report.totalPods, 2)
    assert.equal(report.completionRate, 0.5)
    assert.equal(report.executorPassRate, 0.5)
    fs.rmSync(path.dirname(tmpPath), { recursive: true, force: true })
  })

  it('byPreset breakdown is accurate', () => {
    const tmpPath = makeTmpPath()
    const collector = new PodQualityCollector(tmpPath)

    // 2 frontend-feature pods (1 complete, 1 failed)
    collector.record(makeEvent({
      presetId: 'frontend-feature',
      status: 'complete',
      iterations: 1,
      timestamp: Date.now(),
    }))
    collector.record(makeEvent({
      presetId: 'frontend-feature',
      status: 'failed',
      iterations: 3,
      timestamp: Date.now() + 1000,
    }))

    // 1 backend-feature pod (complete on iteration 2)
    collector.record(makeEvent({
      presetId: 'backend-feature',
      status: 'complete',
      iterations: 2,
      firstPassAccepted: false,
      selfFixed: true,
      timestamp: Date.now() + 2000,
    }))

    const report = collector.report()
    assert.equal(report.totalPods, 3)

    assert.equal(report.byPreset['frontend-feature'].total, 2)
    assert.equal(report.byPreset['frontend-feature'].completed, 1)
    assert.equal(report.byPreset['frontend-feature'].avgIterations, 2) // (1+3)/2

    assert.equal(report.byPreset['backend-feature'].total, 1)
    assert.equal(report.byPreset['backend-feature'].completed, 1)
    assert.equal(report.byPreset['backend-feature'].avgIterations, 2)

    fs.rmSync(path.dirname(tmpPath), { recursive: true, force: true })
  })

  it('self-fix rate tracks pods that passed after iteration > 1', () => {
    const tmpPath = makeTmpPath()
    const collector = new PodQualityCollector(tmpPath)

    // Pod that self-fixed (iteration 2, complete)
    collector.record(makeEvent({
      status: 'complete',
      iterations: 2,
      firstPassAccepted: false,
      selfFixed: true,
      timestamp: Date.now(),
    }))

    // Pod that failed after multiple iterations
    collector.record(makeEvent({
      status: 'failed',
      iterations: 3,
      firstPassAccepted: false,
      executorPassed: false,
      selfFixed: false,
      timestamp: Date.now() + 1000,
    }))

    const report = collector.report()
    // 2 pods with iterations > 1, 1 self-fixed
    assert.equal(report.selfFixRate, 0.5)
    fs.rmSync(path.dirname(tmpPath), { recursive: true, force: true })
  })

  it('self-fix rate includes iteration-1 pods that self-fixed without solver retry', () => {
    const tmpPath = makeTmpPath()
    const collector = new PodQualityCollector(tmpPath)

    collector.record(makeEvent({
      status: 'complete',
      iterations: 1,
      firstPassAccepted: true,
      executorPassed: true,
      selfFixed: true,
      timestamp: Date.now(),
    }))

    const report = collector.report()
    assert.equal(report.totalPods, 1)
    assert.equal(report.selfFixRate, 1.0)
    fs.rmSync(path.dirname(tmpPath), { recursive: true, force: true })
  })

  it('persists as JSONL (one JSON object per line)', () => {
    const tmpPath = makeTmpPath()
    const collector = new PodQualityCollector(tmpPath)

    collector.record(makeEvent({ podId: 'pod-1' }))
    collector.record(makeEvent({ podId: 'pod-2' }))
    collector.record(makeEvent({ podId: 'pod-3' }))

    const raw = fs.readFileSync(tmpPath, 'utf-8')
    const lines = raw.split('\n').filter(l => l.trim().length > 0)
    assert.equal(lines.length, 3)

    for (const line of lines) {
      const parsed = JSON.parse(line)
      assert.equal(typeof parsed.podId, 'string')
      assert.equal(typeof parsed.presetId, 'string')
      assert.equal(typeof parsed.timestamp, 'number')
    }

    fs.rmSync(path.dirname(tmpPath), { recursive: true, force: true })
  })

  it('filters by since date', () => {
    const tmpPath = makeTmpPath()
    const collector = new PodQualityCollector(tmpPath)

    const oldTs = new Date('2025-06-01').getTime()
    const newTs = new Date('2026-03-01').getTime()

    collector.record(makeEvent({ timestamp: oldTs }))
    collector.record(makeEvent({ timestamp: newTs }))

    const allReport = collector.report()
    assert.equal(allReport.totalPods, 2)

    const filteredReport = collector.report(new Date('2026-01-01'))
    assert.equal(filteredReport.totalPods, 1)

    fs.rmSync(path.dirname(tmpPath), { recursive: true, force: true })
  })

  it('filters by since and until (inclusive window)', () => {
    const tmpPath = makeTmpPath()
    const collector = new PodQualityCollector(tmpPath)

    const t0 = new Date('2026-03-23T00:00:00.000Z').getTime()
    const t1 = new Date('2026-03-24T12:00:00.000Z').getTime()
    const t2 = new Date('2026-03-30T00:00:00.000Z').getTime()

    collector.record(makeEvent({ timestamp: t0, podId: 'a' }))
    collector.record(makeEvent({ timestamp: t1, podId: 'b' }))
    collector.record(makeEvent({ timestamp: t2, podId: 'c' }))

    const weekStart = new Date('2026-03-23T00:00:00.000Z')
    const weekEnd = new Date('2026-03-29T23:59:59.999Z')
    const windowed = collector.report(weekStart, weekEnd)
    assert.equal(windowed.totalPods, 2)

    fs.rmSync(path.dirname(tmpPath), { recursive: true, force: true })
  })
})
