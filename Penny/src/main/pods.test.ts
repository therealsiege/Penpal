import { describe, it, expect, vi } from 'vitest'
import { parseSelfEvalResult, formatSelfEvalMessage, parseReviewerCritique } from './pods'

describe('parseSelfEvalResult', () => {
  it('parses valid JSON with all fields', () => {
    const raw = '{ "selected": 2, "confidence": 0.85, "reasoning": "Candidate 2 is more complete" }'
    const result = parseSelfEvalResult(raw, 3)
    expect(result).not.toBeNull()
    expect(result!.selected).toBe(2)
    expect(result!.confidence).toBe(0.85)
    expect(result!.reasoning).toBe('Candidate 2 is more complete')
  })

  it('parses JSON with surrounding text', () => {
    const raw = `After careful analysis...
      { "selected": 1, "confidence": 0.92, "reasoning": "Candidate 1 handles edge cases best" }
      That's my answer.`
    const result = parseSelfEvalResult(raw, 3)
    expect(result).not.toBeNull()
    expect(result!.selected).toBe(1)
    expect(result!.confidence).toBe(0.92)
  })

  it('returns null when no JSON found', () => {
    const raw = 'I think candidate 2 is the best but no JSON'
    const result = parseSelfEvalResult(raw, 3)
    expect(result).toBeNull()
  })

  it('returns null when selected index is out of range', () => {
    const raw = '{ "selected": 5, "confidence": 0.9, "reasoning": "Candidate 5" }'
    const result = parseSelfEvalResult(raw, 3)
    expect(result).toBeNull()
  })

  it('returns null when selected is 0', () => {
    const raw = '{ "selected": 0, "confidence": 0.8, "reasoning": "Zero-indexed" }'
    const result = parseSelfEvalResult(raw, 3)
    expect(result).toBeNull()
  })

  it('returns null when confidence is out of range', () => {
    const raw = '{ "selected": 1, "confidence": 1.5, "reasoning": "Too confident" }'
    const result = parseSelfEvalResult(raw, 3)
    expect(result).toBeNull()
  })

  it('returns null for malformed JSON', () => {
    const raw = '{ "selected": 1, "confidence": 0.8, "reasoning": unclosed'
    const result = parseSelfEvalResult(raw, 3)
    expect(result).toBeNull()
  })

  it('handles NaN confidence by returning null', () => {
    const raw = '{ "selected": 2, "confidence": "high", "reasoning": "Best" }'
    const result = parseSelfEvalResult(raw, 3)
    expect(result).toBeNull()
  })

  it('accepts boundary: selected equals candidateCount', () => {
    const raw = '{ "selected": 3, "confidence": 0.7, "reasoning": "Third is best" }'
    const result = parseSelfEvalResult(raw, 3)
    expect(result).not.toBeNull()
    expect(result!.selected).toBe(3)
    expect(result!.confidence).toBe(0.7)
  })

  it('handles fields in different order (confidence before selected)', () => {
    const raw = '{ "confidence": 0.6, "selected": 2, "reasoning": "Reversed fields" }'
    const result = parseSelfEvalResult(raw, 3)
    expect(result).not.toBeNull()
    expect(result!.selected).toBe(2)
    expect(result!.confidence).toBe(0.6)
  })
})

describe('formatSelfEvalMessage', () => {
  it('includes task and all candidate outputs', () => {
    const candidates = [
      { index: 1, output: 'Solution A', agentId: 'solver', durationMs: 5000 },
      { index: 2, output: 'Solution B', agentId: 'solver', durationMs: 6000 },
      { index: 3, output: 'Solution C', agentId: 'solver', durationMs: 4000 },
    ]
    const msg = formatSelfEvalMessage('Build a widget', candidates)
    expect(msg).toContain('3 candidate solutions')
    expect(msg).toContain('Build a widget')
    expect(msg).toContain('Candidate 1')
    expect(msg).toContain('Solution A')
    expect(msg).toContain('Candidate 2')
    expect(msg).toContain('Solution B')
    expect(msg).toContain('Candidate 3')
    expect(msg).toContain('Solution C')
    expect(msg).toContain('Correctness')
    expect(msg).toContain('Completeness')
    expect(msg).toContain('Simplicity')
  })

  it('truncates long candidate outputs', () => {
    const longOutput = 'x'.repeat(3000)
    const candidates = [
      { index: 1, output: longOutput, agentId: 'solver', durationMs: 5000 },
    ]
    const msg = formatSelfEvalMessage('Task', candidates)
    expect(msg).toContain('[truncated]')
    expect(msg.length).toBeLessThan(longOutput.length)
  })
})

describe('SolverCandidate type contract', () => {
  it('has the expected shape', () => {
    const candidate = { index: 1, output: 'solution', agentId: 'solver-1', durationMs: 5000 }
    expect(candidate.index).toBe(1)
    expect(typeof candidate.output).toBe('string')
    expect(typeof candidate.agentId).toBe('string')
    expect(typeof candidate.durationMs).toBe('number')
  })
})

describe('SelfEvalResult type contract', () => {
  it('has the expected shape', () => {
    const result = { selected: 2, confidence: 0.85, reasoning: 'Best candidate' }
    expect(result.selected).toBe(2)
    expect(result.confidence).toBeGreaterThanOrEqual(0)
    expect(result.confidence).toBeLessThanOrEqual(1)
    expect(typeof result.reasoning).toBe('string')
  })
})

// ── Reviewer Critique Tests ─────────────────────────────────────────────────

describe('parseReviewerCritique', () => {
  it('parses valid approve JSON', () => {
    const raw = JSON.stringify({
      verdict: 'approve',
      confidence: 0.95,
      issues: [],
      strengths: ['Clean implementation', 'Good tests'],
      summary: 'Task completed correctly.',
    })

    const result = parseReviewerCritique(raw)
    expect(result.verdict).toBe('approve')
    expect(result.confidence).toBe(0.95)
    expect(result.issues).toHaveLength(0)
    expect(result.strengths).toEqual(['Clean implementation', 'Good tests'])
    expect(result.summary).toBe('Task completed correctly.')
  })

  it('parses valid request-changes JSON with issues', () => {
    const raw = JSON.stringify({
      verdict: 'request-changes',
      confidence: 0.8,
      issues: [
        {
          severity: 'major',
          location: 'src/main/pods.ts:100',
          description: 'Missing error handling',
          suggestion: 'Add try-catch around the API call',
        },
        {
          severity: 'minor',
          location: 'src/main/pods.ts:200',
          description: 'Variable naming',
          suggestion: 'Use camelCase',
        },
      ],
      strengths: ['Good architecture'],
      summary: 'Needs error handling improvements.',
    })

    const result = parseReviewerCritique(raw)
    expect(result.verdict).toBe('request-changes')
    expect(result.issues).toHaveLength(2)
    expect(result.issues[0].severity).toBe('major')
    expect(result.issues[1].severity).toBe('minor')
  })

  it('parses valid reject JSON', () => {
    const raw = JSON.stringify({
      verdict: 'reject',
      confidence: 0.9,
      issues: [
        {
          severity: 'critical',
          location: 'global',
          description: 'Task requirements not met',
          suggestion: 'Start over with correct approach',
        },
      ],
      strengths: [],
      summary: 'Fundamental approach is wrong.',
    })

    const result = parseReviewerCritique(raw)
    expect(result.verdict).toBe('reject')
    expect(result.confidence).toBe(0.9)
    expect(result.issues[0].severity).toBe('critical')
  })

  it('extracts JSON from markdown fenced block', () => {
    const raw = `Here is my review:

\`\`\`json
{
  "verdict": "approve-with-notes",
  "confidence": 0.85,
  "issues": [
    {
      "severity": "nitpick",
      "location": "src/types.ts",
      "description": "Could use readonly",
      "suggestion": "Add readonly modifier"
    }
  ],
  "strengths": ["Well-structured code"],
  "summary": "Looks good with minor note."
}
\`\`\`

Overall good work.`

    const result = parseReviewerCritique(raw)
    expect(result.verdict).toBe('approve-with-notes')
    expect(result.issues).toHaveLength(1)
    expect(result.issues[0].severity).toBe('nitpick')
  })

  it('falls back on malformed JSON', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = parseReviewerCritique('This is not JSON at all { broken }')
    expect(result.verdict).toBe('approve')
    expect(result.confidence).toBe(0.5)
    expect(result.summary).toContain('falling back')
    consoleSpy.mockRestore()
  })

  it('falls back on missing required fields', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const raw = JSON.stringify({ verdict: 'approve' }) // missing summary
    const result = parseReviewerCritique(raw)
    expect(result.verdict).toBe('approve')
    expect(result.confidence).toBe(0.5)
    expect(result.summary).toContain('falling back')
    consoleSpy.mockRestore()
  })

  it('falls back on invalid verdict value', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const raw = JSON.stringify({
      verdict: 'maybe',
      confidence: 0.5,
      issues: [],
      strengths: [],
      summary: 'Unsure.',
    })
    const result = parseReviewerCritique(raw)
    expect(result.verdict).toBe('approve')
    expect(result.summary).toContain('falling back')
    consoleSpy.mockRestore()
  })

  it('clamps confidence to 0-1 range', () => {
    const overRaw = JSON.stringify({
      verdict: 'approve',
      confidence: 1.5,
      issues: [],
      strengths: [],
      summary: 'Over-confident.',
    })
    expect(parseReviewerCritique(overRaw).confidence).toBe(1)

    const underRaw = JSON.stringify({
      verdict: 'approve',
      confidence: -0.3,
      issues: [],
      strengths: [],
      summary: 'Under-confident.',
    })
    expect(parseReviewerCritique(underRaw).confidence).toBe(0)
  })

  it('falls back on undefined input', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = parseReviewerCritique(undefined)
    expect(result.verdict).toBe('approve')
    expect(result.confidence).toBe(0.5)
    consoleSpy.mockRestore()
  })

  it('skips issues with invalid severity', () => {
    const raw = JSON.stringify({
      verdict: 'approve-with-notes',
      confidence: 0.7,
      issues: [
        { severity: 'minor', location: 'a.ts', description: 'valid', suggestion: 'fix' },
        { severity: 'unknown', location: 'b.ts', description: 'invalid', suggestion: 'nope' },
        { severity: 'critical', location: 'c.ts', description: 'also valid', suggestion: 'fix now' },
      ],
      strengths: [],
      summary: 'Mixed issues.',
    })

    const result = parseReviewerCritique(raw)
    expect(result.issues).toHaveLength(2)
    expect(result.issues[0].severity).toBe('minor')
    expect(result.issues[1].severity).toBe('critical')
  })

  it('defaults confidence to 0.5 when not a number', () => {
    const raw = JSON.stringify({
      verdict: 'approve',
      confidence: 'high',
      issues: [],
      strengths: [],
      summary: 'Non-numeric confidence.',
    })
    expect(parseReviewerCritique(raw).confidence).toBe(0.5)
  })
})
