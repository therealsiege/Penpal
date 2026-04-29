/**
 * Unit tests for ContextMonitor
 *
 * Run with: npx tsx --test src/main/evals/__tests__/context-usage.test.ts
 */

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { ContextMonitor, analyzeJsonl } from '../collectors/context-usage'

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeLine(type: 'user' | 'assistant', text: string): string {
  return JSON.stringify({
    type,
    message: { content: [{ type: 'text', text }] },
  })
}

function makeToolUseLine(name: string, id: string): string {
  return JSON.stringify({
    type: 'assistant',
    message: {
      content: [
        { type: 'tool_use', name, id, input: {} },
      ],
    },
  })
}

function makeToolResultLine(toolUseId: string, isError: boolean, text = 'ok'): string {
  return JSON.stringify({
    type: 'user',
    message: {
      content: [
        { type: 'tool_result', tool_use_id: toolUseId, is_error: isError, content: text },
      ],
    },
  })
}

function writeJsonl(filePath: string, lines: string[]): void {
  const dir = path.dirname(filePath)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(filePath, lines.join('\n') + '\n')
}

function makeQueueTaskNotification(status: 'completed' | 'failed'): string {
  return JSON.stringify({
    type: 'queue-operation',
    operation: 'enqueue',
    content: `<task-notification><status>${status}</status></task-notification>`,
  })
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('analyzeJsonl', () => {
  let tmpDir: string

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'context-usage-test-'))
  })

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('counts characters from user and assistant messages', () => {
    const jsonlPath = path.join(tmpDir, 'chars.jsonl')
    writeJsonl(jsonlPath, [
      makeLine('user', 'Hello world'),       // 11 chars
      makeLine('assistant', 'Hi there!'),     // 9 chars
    ])

    const analysis = analyzeJsonl(jsonlPath)
    assert.equal(analysis.totalChars, 20)
    assert.equal(analysis.toolCallCount, 0)
    assert.equal(analysis.toolErrorCount, 0)
  })

  it('tracks tool errors', () => {
    const jsonlPath = path.join(tmpDir, 'errors.jsonl')
    writeJsonl(jsonlPath, [
      makeLine('user', 'do something'),
      makeToolUseLine('Bash', 'tool-1'),
      makeToolResultLine('tool-1', true, 'command failed'),
      makeToolUseLine('Bash', 'tool-2'),
      makeToolResultLine('tool-2', false, 'ok'),
    ])

    const analysis = analyzeJsonl(jsonlPath)
    assert.equal(analysis.toolCallCount, 2)
    assert.equal(analysis.toolErrorCount, 1)
  })

  it('computes higher second-half retry rate when errors cluster at end', () => {
    const jsonlPath = path.join(tmpDir, 'trend.jsonl')
    const lines: string[] = []

    // First half: 4 successful tool calls
    for (let i = 0; i < 4; i++) {
      lines.push(makeToolUseLine('Read', `ok-${i}`))
      lines.push(makeToolResultLine(`ok-${i}`, false))
    }
    // Second half: 4 tool calls, 3 errors
    for (let i = 0; i < 4; i++) {
      lines.push(makeToolUseLine('Bash', `err-${i}`))
      lines.push(makeToolResultLine(`err-${i}`, i < 3))
    }

    writeJsonl(jsonlPath, lines)
    const analysis = analyzeJsonl(jsonlPath)
    assert.ok(
      analysis.retryRateSecondHalf > analysis.retryRateFirstHalf,
      `Second half retry rate (${analysis.retryRateSecondHalf}) should exceed first half (${analysis.retryRateFirstHalf})`,
    )
  })

  it('handles malformed JSONL lines gracefully', () => {
    const jsonlPath = path.join(tmpDir, 'malformed.jsonl')
    fs.writeFileSync(
      jsonlPath,
      `${makeLine('user', 'hello')}\n{"type":"assistant","message":\n${makeLine('assistant', 'ok')}\n`,
      'utf-8',
    )
    const analysis = analyzeJsonl(jsonlPath)
    assert.equal(analysis.totalChars, 7)
  })
})

describe('ContextMonitor', () => {
  it('fresh session (no matching agent) returns healthy', async () => {
    const monitor = new ContextMonitor(200_000)
    const health = await monitor.check('nonexistent-agent')
    assert.equal(health.recommendation, 'healthy')
    assert.equal(health.rotScore, 0)
    assert.equal(health.utilizationPct, 0)
    assert.equal(health.tokenCount, 0)
  })

  it('session at 90% utilization returns warning or higher', async () => {
    const monitor = new ContextMonitor(1000) // Small window: 1000 tokens = 4000 chars
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'util-test-'))

    // Create ~3600 chars of content => ~900 tokens => 90% of 1000
    const targetChars = 1000 * 4 * 0.9
    const longText = 'x'.repeat(Math.round(targetChars))
    const jsonlPath = path.join(tmpDir, 'session.jsonl')
    writeJsonl(jsonlPath, [makeLine('assistant', longText)])

    const health = await monitor.analyzeFromPath('test-agent', 'test-session', jsonlPath)

    assert.ok(health.utilizationPct >= 85, `Expected >=85% utilization, got ${health.utilizationPct}%`)
    assert.ok(health.utilizationPct <= 95, `Expected <=95% utilization, got ${health.utilizationPct}%`)
    assert.ok(
      ['warning', 'compress', 'restart'].includes(health.recommendation),
      `Expected warning/compress/restart, got ${health.recommendation}`,
    )

    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('declining success rate increases rot score', async () => {
    const monitor = new ContextMonitor(200_000)
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'decline-test-'))

    // Session where task outcomes decline over time.
    const declineLines: string[] = []
    for (let i = 0; i < 6; i++) {
      declineLines.push(makeQueueTaskNotification('completed'))
    }
    for (let i = 0; i < 6; i++) {
      declineLines.push(makeQueueTaskNotification('failed'))
    }
    const declinePath = path.join(tmpDir, 'decline.jsonl')
    writeJsonl(declinePath, declineLines)

    // Baseline session with stable success.
    const baselineLines: string[] = []
    for (let i = 0; i < 12; i++) {
      baselineLines.push(makeQueueTaskNotification('completed'))
    }
    const baselinePath = path.join(tmpDir, 'baseline.jsonl')
    writeJsonl(baselinePath, baselineLines)

    const declineHealth = await monitor.analyzeFromPath('decline-agent', 's1', declinePath)
    const baselineHealth = await monitor.analyzeFromPath('baseline-agent', 's2', baselinePath)

    assert.ok(
      declineHealth.rotScore > baselineHealth.rotScore,
      `Declining session rot score (${declineHealth.rotScore}) should exceed baseline (${baselineHealth.rotScore})`,
    )
    assert.equal(baselineHealth.rotScore, 0, 'Baseline with stable outcomes should have 0 rot score')

    fs.rmSync(tmpDir, { recursive: true, force: true })
  })
})
