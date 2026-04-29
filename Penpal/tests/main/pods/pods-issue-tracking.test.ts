import { describe, it, expect, vi } from 'vitest'

vi.mock('../../../src/main/sessions', () => ({
  runAgentHeadless: vi.fn().mockReturnValue(new Promise(() => {})),
}))

vi.mock('../../../src/main/evals/collectors/pod-quality', () => ({
  podQualityCollector: { record: vi.fn() },
}))

import { createPod, getPodStatus } from '../../../src/main/pods'

describe('pod issue tracking', () => {
  it('stores issueNumber and issueRepo when provided', () => {
    const wf = createPod('fix auth bug', {
      cwd: process.cwd(),
      maxIterations: 1,
      presetId: 'frontend-feature',
      issueNumber: 142,
      issueRepo: 'therealsiege/sidekick',
    })

    expect(wf.issueNumber).toBe(142)
    expect(wf.issueRepo).toBe('therealsiege/sidekick')

    // Verify it's also available via getPodStatus
    const status = getPodStatus(wf.id)
    expect(status?.issueNumber).toBe(142)
    expect(status?.issueRepo).toBe('therealsiege/sidekick')
  })

  it('leaves issueNumber undefined when not provided', () => {
    const wf = createPod('standalone task', {
      cwd: process.cwd(),
      maxIterations: 1,
      presetId: 'frontend-feature',
    })

    expect(wf.issueNumber).toBeUndefined()
    expect(wf.issueRepo).toBeUndefined()
  })

  it('includes issue number in pod name when created from pipeline', () => {
    const wf = createPod('fix the login form CSS', {
      cwd: process.cwd(),
      name: 'therealsiege/sidekick#142',
      maxIterations: 1,
      presetId: 'frontend-feature',
      issueNumber: 142,
      issueRepo: 'therealsiege/sidekick',
    })

    expect(wf.name).toBe('therealsiege/sidekick#142')
    expect(wf.issueNumber).toBe(142)
  })
})
