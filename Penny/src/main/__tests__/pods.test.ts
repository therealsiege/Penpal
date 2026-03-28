/**
 * Unit tests for pods.ts reviewer critique format and routing
 */

import { describe, it, expect } from 'vitest'
import {
  parseReviewerCritique,
  formatCritiqueFeedback,
  formatReviewerMessage,
  formatExecutorMessage,
  type ReviewerCritique,
  type PodWorkflow,
} from '../pods'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeWorkflow(overrides: Partial<PodWorkflow> = {}): PodWorkflow {
  return {
    id: 'pod-test-1',
    name: 'Test workflow',
    status: 'pending',
    task: 'Implement feature X',
    cwd: '/tmp/test',
    solver: { agentId: 'solver-agent', status: 'waiting' },
    reviewer: { agentId: 'reviewer-agent', status: 'waiting' },
    executor: { agentId: 'executor-agent', status: 'waiting' },
    iteration: 1,
    maxIterations: 3,
    artifacts: [],
    solverCandidateCount: 1,
    selfFixAttempts: 0,
    maxSelfFixes: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    stageHistory: [],
    ...overrides,
  }
}

function makeCritique(overrides: Partial<ReviewerCritique> = {}): ReviewerCritique {
  return {
    verdict: 'approve',
    confidence: 0.9,
    issues: [],
    strengths: ['Clean implementation'],
    summary: 'Looks good.',
    ...overrides,
  }
}

// ── parseReviewerCritique ────────────────────────────────────────────────────

describe('parseReviewerCritique', () => {
  it('parses approve verdict from fenced JSON', () => {
    const raw = '```json\n' + JSON.stringify({
      verdict: 'approve',
      confidence: 0.95,
      issues: [],
      strengths: ['Well structured'],
      summary: 'All requirements met.',
    }) + '\n```'

    const result = parseReviewerCritique(raw)
    expect(result.verdict).toBe('approve')
    expect(result.confidence).toBe(0.95)
    expect(result.issues.length).toBe(0)
    expect(result.strengths[0]).toBe('Well structured')
    expect(result.summary).toBe('All requirements met.')
  })

  it('parses request-changes with issues', () => {
    const raw = '```json\n' + JSON.stringify({
      verdict: 'request-changes',
      confidence: 0.8,
      issues: [
        {
          severity: 'major',
          location: 'src/api.ts:42',
          description: 'Missing error handling',
          suggestion: 'Add try/catch around the fetch call',
        },
        {
          severity: 'minor',
          location: 'src/utils.ts',
          description: 'Unused import',
          suggestion: 'Remove unused import of lodash',
        },
      ],
      strengths: ['Good test coverage'],
      summary: 'Needs error handling improvements.',
    }) + '\n```'

    const result = parseReviewerCritique(raw)
    expect(result.verdict).toBe('request-changes')
    expect(result.issues.length).toBe(2)
    expect(result.issues[0].severity).toBe('major')
    expect(result.issues[0].location).toBe('src/api.ts:42')
    expect(result.issues[0].description).toBe('Missing error handling')
    expect(result.issues[0].suggestion).toBe('Add try/catch around the fetch call')
    expect(result.issues[1].severity).toBe('minor')
  })

  it('parses reject verdict', () => {
    const raw = '```json\n' + JSON.stringify({
      verdict: 'reject',
      confidence: 0.9,
      issues: [{ severity: 'critical', location: 'architecture', description: 'Wrong approach', suggestion: 'Use event sourcing' }],
      strengths: [],
      summary: 'Fundamentally wrong approach.',
    }) + '\n```'

    const result = parseReviewerCritique(raw)
    expect(result.verdict).toBe('reject')
    expect(result.issues[0].severity).toBe('critical')
    expect(result.summary).toBe('Fundamentally wrong approach.')
  })

  it('falls back on malformed JSON', () => {
    const result = parseReviewerCritique('This is not JSON at all, just some text.')
    expect(result.verdict).toBe('approve')
    expect(result.confidence).toBe(0.5)
    expect(result.summary).toContain('falling back')
  })

  it('falls back when required fields are missing', () => {
    const raw = '```json\n' + JSON.stringify({ confidence: 0.8 }) + '\n```'
    const result = parseReviewerCritique(raw)
    expect(result.verdict).toBe('approve')
    expect(result.confidence).toBe(0.5)
    expect(result.summary).toContain('Missing required fields')
  })

  it('falls back on null/undefined input', () => {
    const result = parseReviewerCritique(null)
    expect(result.verdict).toBe('approve')
    expect(result.confidence).toBe(0.5)
  })

  it('parses approve-with-notes verdict', () => {
    const raw = JSON.stringify({
      verdict: 'approve-with-notes',
      confidence: 0.75,
      issues: [{ severity: 'nitpick', location: 'naming', description: 'Consider renaming', suggestion: 'Use camelCase' }],
      strengths: ['Solid logic'],
      summary: 'Approved with minor notes.',
    })

    const result = parseReviewerCritique(raw)
    expect(result.verdict).toBe('approve-with-notes')
    expect(result.issues.length).toBe(1)
    expect(result.issues[0].severity).toBe('nitpick')
  })

  it('clamps confidence to 0-1 range', () => {
    const raw = JSON.stringify({
      verdict: 'approve',
      confidence: 1.5,
      issues: [],
      strengths: [],
      summary: 'Over-confident.',
    })

    const result = parseReviewerCritique(raw)
    expect(result.confidence).toBe(1)
  })

  it('filters out issues with invalid severity', () => {
    const raw = JSON.stringify({
      verdict: 'approve-with-notes',
      confidence: 0.7,
      issues: [
        { severity: 'major', location: 'a.ts', description: 'Valid', suggestion: 'Fix' },
        { severity: 'catastrophic', location: 'b.ts', description: 'Invalid severity', suggestion: 'N/A' },
      ],
      strengths: [],
      summary: 'Mixed issues.',
    })

    const result = parseReviewerCritique(raw)
    expect(result.issues.length).toBe(1)
    expect(result.issues[0].severity).toBe('major')
  })
})

// ── formatCritiqueFeedback ───────────────────────────────────────────────────

describe('formatCritiqueFeedback', () => {
  it('formats critique with issues into readable feedback', () => {
    const critique = makeCritique({
      verdict: 'request-changes',
      confidence: 0.8,
      issues: [
        { severity: 'major', location: 'src/api.ts', description: 'Missing validation', suggestion: 'Add zod schema' },
        { severity: 'minor', location: 'src/utils.ts', description: 'Unused import', suggestion: 'Remove it' },
      ],
      strengths: ['Good tests'],
      summary: 'Needs validation.',
    })

    const feedback = formatCritiqueFeedback(critique)
    expect(feedback).toContain('request-changes')
    expect(feedback).toContain('0.8')
    expect(feedback).toContain('MAJOR')
    expect(feedback).toContain('src/api.ts')
    expect(feedback).toContain('Missing validation')
    expect(feedback).toContain('Add zod schema')
    expect(feedback).toContain('MINOR')
    expect(feedback).toContain('Good tests')
    expect(feedback).toContain('Needs validation')
  })

  it('formats critique with no issues', () => {
    const critique = makeCritique({ verdict: 'approve', issues: [], strengths: [] })
    const feedback = formatCritiqueFeedback(critique)
    expect(feedback).toContain('approve')
    expect(feedback).not.toContain('Issues to address')
  })
})

// ── formatReviewerMessage ────────────────────────────────────────────────────

describe('formatReviewerMessage', () => {
  it('includes structured JSON schema in prompt', () => {
    const wf = makeWorkflow()
    const message = formatReviewerMessage(wf)
    expect(message).toContain('"verdict"')
    expect(message).toContain('"confidence"')
    expect(message).toContain('"issues"')
    expect(message).toContain('"severity"')
    expect(message).toContain('"strengths"')
    expect(message).toContain('"summary"')
    expect(message).toContain('approve')
    expect(message).toContain('approve-with-notes')
    expect(message).toContain('request-changes')
    expect(message).toContain('reject')
  })

  it('includes task and project directory', () => {
    const wf = makeWorkflow({ task: 'Build the widget', cwd: '/home/user/project' })
    const message = formatReviewerMessage(wf)
    expect(message).toContain('Build the widget')
    expect(message).toContain('/home/user/project')
  })
})

// ── formatExecutorMessage ────────────────────────────────────────────────────

describe('formatExecutorMessage', () => {
  it('includes reviewer notes when approve-with-notes', () => {
    const wf = makeWorkflow()
    const critique = makeCritique({
      verdict: 'approve-with-notes',
      issues: [
        { severity: 'minor', location: 'src/foo.ts', description: 'Consider renaming', suggestion: 'Use bar instead' },
      ],
    })

    const message = formatExecutorMessage(wf, 'solver output', 'reviewer output', critique)
    expect(message).toContain('Reviewer Notes')
    expect(message).toContain('[minor]')
    expect(message).toContain('src/foo.ts')
    expect(message).toContain('Consider renaming')
    expect(message).toContain('Use bar instead')
  })

  it('does not include reviewer notes for plain approve', () => {
    const wf = makeWorkflow()
    const critique = makeCritique({ verdict: 'approve' })

    const message = formatExecutorMessage(wf, 'solver output', 'reviewer output', critique)
    expect(message).not.toContain('Reviewer Notes')
  })

  it('works without critique parameter', () => {
    const wf = makeWorkflow()
    const message = formatExecutorMessage(wf, 'solver output', 'reviewer output')
    expect(message).toContain('QA Executor')
    expect(message).not.toContain('Reviewer Notes')
  })
})
