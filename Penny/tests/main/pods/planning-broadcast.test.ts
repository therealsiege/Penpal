import { describe, it, expect } from 'vitest'
import {
  extractFilesFromOutput,
  extractPlanSummary,
  formatFlightBoardContext,
} from '../../../src/main/pods'
import type { FlightBoardEntry } from '../../../src/main/flight-board'

// ── Test helpers ─────────────────────────────────────────────────────────────

function makeEntry(overrides: Partial<FlightBoardEntry> = {}): FlightBoardEntry {
  return {
    podId: 'pod-test-1',
    task: 'Build login feature',
    status: 'solving',
    filesInFlight: [],
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

// ── extractFilesFromOutput ────────────────────────────────────────────────────

describe('extractFilesFromOutput', () => {
  it('catches src/** paths', () => {
    const output = `
I implemented the feature by modifying:
- src/main/pods.ts — added helper functions
- src/renderer/src/components/PodModal.tsx — updated UI
- src/preload/index.ts — bridged new IPC
    `
    const files = extractFilesFromOutput(output)
    expect(files).toContain('src/main/pods.ts')
    expect(files).toContain('src/renderer/src/components/PodModal.tsx')
    expect(files).toContain('src/preload/index.ts')
  })

  it('catches public/** paths and config files', () => {
    const output = `
Updated public/manifest.json and agents/CLAUDE.md.
Also touched data/pod-workflows.json and package.json.
    `
    const files = extractFilesFromOutput(output)
    expect(files).toContain('public/manifest.json')
    expect(files).toContain('agents/CLAUDE.md')
    expect(files).toContain('data/pod-workflows.json')
    expect(files).toContain('package.json')
  })

  it('catches tests/ and scripts/ paths', () => {
    const output = `Modified tests/main/pods/pods.test.ts and scripts/deploy.ts`
    const files = extractFilesFromOutput(output)
    expect(files).toContain('tests/main/pods/pods.test.ts')
    expect(files).toContain('scripts/deploy.ts')
  })

  it('deduplicates repeated file references', () => {
    const output = `
src/main/pods.ts was updated.
See src/main/pods.ts for details.
Also see src/main/pods.ts one more time.
    `
    const files = extractFilesFromOutput(output)
    const count = files.filter(f => f === 'src/main/pods.ts').length
    expect(count).toBe(1)
  })

  it('caps results at 20 files', () => {
    const lines = Array.from({ length: 30 }, (_, i) => `src/component-${i}.ts`).join('\n')
    const files = extractFilesFromOutput(lines)
    expect(files.length).toBeLessThanOrEqual(20)
  })

  it('returns [] for output with no path-like tokens', () => {
    const output = 'I built the feature. Everything looks great. No files to report here!'
    const files = extractFilesFromOutput(output)
    expect(files).toEqual([])
  })

  it('returns [] for empty string', () => {
    expect(extractFilesFromOutput('')).toEqual([])
  })
})

// ── extractPlanSummary ────────────────────────────────────────────────────────

describe('extractPlanSummary', () => {
  it('returns first meaningful lines, capped at 400 chars', () => {
    const output = `
# Implementation Summary

I added flight board integration to the pods module.
The solver now broadcasts which files it is editing after the first iteration.
A new helper extracts file paths from output using heuristics.
This line should not appear in the summary because we already have 3.
    `
    const summary = extractPlanSummary(output)
    expect(summary.length).toBeLessThanOrEqual(400)
    expect(summary).toContain('I added flight board integration')
    // Should not exceed 3 meaningful sentences
    expect(summary.split('. ').length).toBeLessThanOrEqual(4)
  })

  it('returns empty string for empty input', () => {
    expect(extractPlanSummary('')).toBe('')
  })

  it('returns empty string for whitespace-only input', () => {
    expect(extractPlanSummary('   \n\n   ')).toBe('')
  })

  it('skips markdown headers and code fences', () => {
    const output = `
# Summary
\`\`\`
some code
\`\`\`
The actual content starts here.
    `
    const summary = extractPlanSummary(output)
    expect(summary).toContain('The actual content starts here.')
    expect(summary).not.toContain('#')
    expect(summary).not.toContain('```')
  })

  it('truncates very long single lines to fit within 400 chars', () => {
    const longLine = 'A'.repeat(500)
    const summary = extractPlanSummary(longLine)
    expect(summary.length).toBeLessThanOrEqual(400)
  })
})

// ── formatFlightBoardContext ──────────────────────────────────────────────────

describe('formatFlightBoardContext', () => {
  it('returns empty string for empty entries array', () => {
    expect(formatFlightBoardContext([])).toBe('')
  })

  it('produces correct block for a single entry with no files', () => {
    const entry = makeEntry({ podId: 'pod-1', task: 'Build login feature', filesInFlight: [] })
    const block = formatFlightBoardContext([entry])
    expect(block).toContain('ACTIVE POD WORK')
    expect(block).toContain('Pod "Build login feature"')
    expect(block).toContain('pod-1')
    expect(block).toContain('(no files claimed yet)')
    expect(block).toContain('Plan your approach to avoid modifying these files if possible.')
  })

  it('produces correct block for an entry with files', () => {
    const entry = makeEntry({
      podId: 'pod-2',
      task: 'Fix auth bug',
      filesInFlight: ['src/main/auth.ts', 'src/main/sessions.ts'],
    })
    const block = formatFlightBoardContext([entry])
    expect(block).toContain('src/main/auth.ts')
    expect(block).toContain('src/main/sessions.ts')
  })

  it('truncates file list to 5 + "...N more" when entry has more than 5 files', () => {
    const filesInFlight = Array.from({ length: 8 }, (_, i) => `src/file-${i}.ts`)
    const entry = makeEntry({ filesInFlight })
    const block = formatFlightBoardContext([entry])
    expect(block).toContain('...3 more')
    // Only first 5 should appear individually
    expect(block).toContain('src/file-0.ts')
    expect(block).toContain('src/file-4.ts')
    expect(block).not.toContain('src/file-5.ts')
  })

  it('stays under 2000 chars with many active pods', () => {
    const entries = Array.from({ length: 10 }, (_, i) =>
      makeEntry({
        podId: `pod-${i}`,
        task: `Long task description number ${i} that takes up space`,
        filesInFlight: Array.from({ length: 6 }, (_, j) => `src/component-${i}-${j}.tsx`),
      }),
    )
    const block = formatFlightBoardContext(entries)
    expect(block.length).toBeLessThanOrEqual(2000)
  })

  it('includes closing instructions', () => {
    const entry = makeEntry()
    const block = formatFlightBoardContext([entry])
    expect(block).toContain('If you must edit a file another pod is touching, note the overlap in your plan.')
  })

  it('includes multiple entries when they fit', () => {
    const entries = [
      makeEntry({ podId: 'pod-a', task: 'Feature A', filesInFlight: ['src/a.ts'] }),
      makeEntry({ podId: 'pod-b', task: 'Feature B', filesInFlight: ['src/b.ts'] }),
    ]
    const block = formatFlightBoardContext(entries)
    expect(block).toContain('pod-a')
    expect(block).toContain('pod-b')
    expect(block).toContain('src/a.ts')
    expect(block).toContain('src/b.ts')
  })
})
