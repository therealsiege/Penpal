import fs from 'fs'
import path from 'path'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const runAgentHeadlessMock = vi.hoisted(() => vi.fn())

vi.mock('./sessions', () => ({
  runAgentHeadless: runAgentHeadlessMock,
}))

import { createPod, getPodStatus } from './pods'

function fencedCritique(obj: Record<string, unknown>): string {
  return `\`\`\`json\n${JSON.stringify(obj)}\n\`\`\``
}

async function waitForTerminal(id: string, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const w = getPodStatus(id)
    if (w && (w.status === 'complete' || w.status === 'failed')) return w
    await new Promise<void>(r => setTimeout(r, 15))
  }
  return getPodStatus(id)
}

function critiqueArtifactPath(wfId: string, iteration = 1): string {
  return path.join(__dirname, '..', '..', 'data', 'pod-critiques', `${wfId}-review-i${iteration}.json`)
}

function removeCritiqueArtifact(wfId: string, iteration = 1): void {
  const p = critiqueArtifactPath(wfId, iteration)
  if (fs.existsSync(p)) fs.unlinkSync(p)
}

describe('runWorkflow reviewer routing (mocked agents)', () => {
  beforeEach(() => {
    runAgentHeadlessMock.mockReset()
  })

  it('approve-with-notes: routes to executor; prompt includes verdict, issues, and non-blocking guidance', async () => {
    let executorPrompt = ''
    const critique = fencedCritique({
      verdict: 'approve-with-notes',
      confidence: 0.88,
      issues: [
        {
          severity: 'nitpick',
          location: 'x.ts',
          description: 'style',
          suggestion: 'rename',
        },
      ],
      strengths: ['Solid structure'],
      summary: 'Ship with minor notes.',
    })
    runAgentHeadlessMock.mockImplementation(async (agentId: string, _cwd: string, prompt: string) => {
      if (agentId === 'fullstack-dev') return { success: true, output: 'solver summary', durationMs: 1 }
      if (agentId === 'backend-arch') return { success: true, output: critique, durationMs: 1 }
      if (agentId === 'electron-dev') {
        executorPrompt = prompt
        return { success: true, output: 'RESULT: PASS\n', durationMs: 1 }
      }
      return { success: false, output: '', error: 'unknown agent', durationMs: 0 }
    })

    const wf = createPod('task', { maxIterations: 2, cwd: process.cwd() })
    let critiqueFileAbs: string | null = null
    try {
      const done = await waitForTerminal(wf.id)
      expect(done?.status).toBe('complete')
      expect(runAgentHeadlessMock).toHaveBeenCalledTimes(3)
      expect(executorPrompt).toContain('approve-with-notes')
      expect(executorPrompt).toContain('non-blocking')
      expect(executorPrompt).toContain('nitpick')
      expect(executorPrompt).toContain('Ship with minor notes.')

      expect(done!.critique?.verdict).toBe('approve-with-notes')
      const reviewArtifact = done!.artifacts.find((a) => a.stage === 'review')
      expect(reviewArtifact).toBeDefined()
      critiqueFileAbs = path.resolve(process.cwd(), reviewArtifact!.path)
      expect(fs.existsSync(critiqueFileAbs)).toBe(true)
      const parsed = JSON.parse(fs.readFileSync(critiqueFileAbs, 'utf-8')) as { verdict: string }
      expect(parsed.verdict).toBe('approve-with-notes')
    } finally {
      if (critiqueFileAbs && fs.existsSync(critiqueFileAbs)) fs.unlinkSync(critiqueFileAbs)
      else removeCritiqueArtifact(wf.id)
    }
  })

  it('approve: runs solver → reviewer → executor and completes', async () => {
    const critique = fencedCritique({
      verdict: 'approve',
      confidence: 0.9,
      issues: [],
      strengths: [],
      summary: 'Looks good.',
    })
    runAgentHeadlessMock.mockImplementation(async (agentId: string) => {
      if (agentId === 'fullstack-dev') return { success: true, output: 'solver summary', durationMs: 1 }
      if (agentId === 'backend-arch') return { success: true, output: critique, durationMs: 1 }
      if (agentId === 'electron-dev') return { success: true, output: 'RESULT: PASS\n', durationMs: 1 }
      return { success: false, output: '', error: 'unknown agent', durationMs: 0 }
    })

    const wf = createPod('task', { maxIterations: 2, cwd: process.cwd() })
    try {
      const done = await waitForTerminal(wf.id)
      expect(done?.status).toBe('complete')
      expect(runAgentHeadlessMock).toHaveBeenCalledTimes(3)
      const reviewArtifact = done?.artifacts?.find(a => a.stage === 'review')
      expect(reviewArtifact?.path).toMatch(/data\/pod-critiques\/.*-review-i1\.json/)
    } finally {
      removeCritiqueArtifact(wf.id)
    }
  })

  it('reject: fails before executor', async () => {
    const critique = fencedCritique({
      verdict: 'reject',
      confidence: 0.9,
      issues: [{ severity: 'critical', location: 'x', description: 'bad', suggestion: 'stop' }],
      strengths: [],
      summary: 'Wrong approach.',
    })
    runAgentHeadlessMock.mockImplementation(async (agentId: string) => {
      if (agentId === 'fullstack-dev') return { success: true, output: 'solver', durationMs: 1 }
      if (agentId === 'backend-arch') return { success: true, output: critique, durationMs: 1 }
      return { success: false, output: '', error: 'executor should not run', durationMs: 0 }
    })

    const wf = createPod('task', { maxIterations: 2, cwd: process.cwd() })
    try {
      const done = await waitForTerminal(wf.id)
      expect(done?.status).toBe('failed')
      expect(done?.error).toContain('Reviewer rejected:')
      expect(runAgentHeadlessMock).toHaveBeenCalledTimes(2)
    } finally {
      removeCritiqueArtifact(wf.id)
    }
  })

  it('request-changes: second solve receives reviewer feedback then executor runs', async () => {
    const critique = fencedCritique({
      verdict: 'request-changes',
      confidence: 0.8,
      issues: [
        {
          severity: 'major',
          location: 'a.ts',
          description: 'fix me',
          suggestion: 'patch',
        },
      ],
      strengths: [],
      summary: 'Needs work.',
    })
    runAgentHeadlessMock.mockImplementation(async (agentId: string, cwd: string, prompt: string) => {
      if (agentId === 'fullstack-dev') {
        if (prompt.includes('Feedback from Reviewer (requested changes)')) {
          return { success: true, output: 'solver v2', durationMs: 1 }
        }
        return { success: true, output: 'solver v1', durationMs: 1 }
      }
      if (agentId === 'backend-arch') return { success: true, output: critique, durationMs: 1 }
      if (agentId === 'electron-dev') return { success: true, output: 'RESULT: PASS\n', durationMs: 1 }
      return { success: false, output: '', error: 'unknown', durationMs: 0 }
    })

    const wf = createPod('task', { maxIterations: 2, cwd: process.cwd() })
    try {
      const done = await waitForTerminal(wf.id)
      expect(done?.status).toBe('complete')
      expect(runAgentHeadlessMock).toHaveBeenCalledTimes(4)
    } finally {
      removeCritiqueArtifact(wf.id)
    }
  })

  it('malformed reviewer JSON falls back to approve and still reaches executor', async () => {
    runAgentHeadlessMock.mockImplementation(async (agentId: string) => {
      if (agentId === 'fullstack-dev') return { success: true, output: 'solver', durationMs: 1 }
      if (agentId === 'backend-arch')
        return { success: true, output: 'This is not valid JSON {', durationMs: 1 }
      if (agentId === 'electron-dev') return { success: true, output: 'RESULT: PASS\n', durationMs: 1 }
      return { success: false, output: '', error: 'unknown', durationMs: 0 }
    })

    const wf = createPod('task', { maxIterations: 1, cwd: process.cwd() })
    try {
      const done = await waitForTerminal(wf.id)
      expect(done?.status).toBe('complete')
      expect(runAgentHeadlessMock).toHaveBeenCalledTimes(3)
      const final = getPodStatus(wf.id)
      expect(final?.critique?.verdict).toBe('approve')
      expect(final?.critique?.summary).toContain('falling back')
    } finally {
      removeCritiqueArtifact(wf.id)
    }
  })
})
