import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock child_process and sessions before importing the module
vi.mock('child_process', () => ({
  execFile: vi.fn((_cmd, _args, _opts, cb) => {
    if (typeof _opts === 'function') { cb = _opts }
    cb?.(null, '', '')
  }),
}))

vi.mock('../../src/main/sessions', () => ({
  runAgentHeadless: vi.fn().mockResolvedValue({ success: true, output: 'VALIDATION_RESULT: PASS\nTEST_SUMMARY: All tests passed\nSCREENSHOTS: none\nDETAILS: ok' }),
}))

vi.mock('../../src/main/atomic-store', () => ({
  atomicWrite: vi.fn(),
}))

import {
  buildValidatorPrompt,
  collectScreenshots,
  type PipelineIssue,
} from '../../src/main/github-pipeline'

// ── buildValidatorPrompt ────────────────────────────────────────────────────

describe('buildValidatorPrompt', () => {
  const baseIssue: PipelineIssue = {
    number: 42,
    repo: 'owner/repo',
    title: 'Add dark mode',
    body: 'We need dark mode support',
    stage: 'validating',
    priority: 'normal',
    ingestedAt: Date.now(),
    updatedAt: Date.now(),
    branch: 'issue-42-add-dark-mode',
    worktreePath: '/tmp/worktree-42',
    plannerOutput: '1. Update theme.ts\n2. Add toggle component',
    executorAttempts: 1,
    plannerRunning: false,
    executorRunning: false,
    validatorRunning: true,
  }

  it('includes issue number and title', () => {
    const prompt = buildValidatorPrompt(baseIssue, 'owner/repo')
    expect(prompt).toContain('#42')
    expect(prompt).toContain('Add dark mode')
  })

  it('includes the planner output for context', () => {
    const prompt = buildValidatorPrompt(baseIssue, 'owner/repo')
    expect(prompt).toContain('Update theme.ts')
    expect(prompt).toContain('Add toggle component')
  })

  it('includes instructions for running tests', () => {
    const prompt = buildValidatorPrompt(baseIssue, 'owner/repo')
    expect(prompt).toContain('npm test')
  })

  it('includes instructions for Playwright screenshots', () => {
    const prompt = buildValidatorPrompt(baseIssue, 'owner/repo')
    expect(prompt).toContain('Playwright')
    expect(prompt).toContain('.playwright-screenshots/')
  })

  it('includes VALIDATION_RESULT format instructions', () => {
    const prompt = buildValidatorPrompt(baseIssue, 'owner/repo')
    expect(prompt).toContain('VALIDATION_RESULT: PASS or FAIL')
    expect(prompt).toContain('TEST_SUMMARY:')
    expect(prompt).toContain('SCREENSHOTS:')
  })

  it('handles missing planner output', () => {
    const issue = { ...baseIssue, plannerOutput: undefined }
    const prompt = buildValidatorPrompt(issue, 'owner/repo')
    expect(prompt).toContain('(no plan available)')
  })

  it('truncates very long planner output', () => {
    const issue = { ...baseIssue, plannerOutput: 'x'.repeat(5000) }
    const prompt = buildValidatorPrompt(issue, 'owner/repo')
    // Should not include the full 5000 chars
    expect(prompt.length).toBeLessThan(5000)
  })

  it('instructs agent not to fix code', () => {
    const prompt = buildValidatorPrompt(baseIssue, 'owner/repo')
    expect(prompt).toContain('Do NOT fix any code')
  })
})

// ── collectScreenshots ──────────────────────────────────────────────────────

describe('collectScreenshots', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pipeline-test-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('returns empty array when screenshot dir does not exist', async () => {
    const result = await collectScreenshots(tmpDir)
    expect(result).toEqual([])
  })

  it('returns only image files', async () => {
    const ssDir = path.join(tmpDir, '.playwright-screenshots')
    fs.mkdirSync(ssDir)
    fs.writeFileSync(path.join(ssDir, 'dashboard.png'), 'fake-png')
    fs.writeFileSync(path.join(ssDir, 'settings.jpg'), 'fake-jpg')
    fs.writeFileSync(path.join(ssDir, 'notes.txt'), 'not an image')
    fs.writeFileSync(path.join(ssDir, 'hero.webp'), 'fake-webp')

    const result = await collectScreenshots(tmpDir)
    expect(result).toHaveLength(3)
    expect(result).toContain('dashboard.png')
    expect(result).toContain('settings.jpg')
    expect(result).toContain('hero.webp')
    expect(result).not.toContain('notes.txt')
  })

  it('returns empty array for empty screenshot dir', async () => {
    const ssDir = path.join(tmpDir, '.playwright-screenshots')
    fs.mkdirSync(ssDir)

    const result = await collectScreenshots(tmpDir)
    expect(result).toEqual([])
  })
})

// ── PipelineIssue type validation ───────────────────────────────────────────

describe('PipelineIssue validating stage', () => {
  it('accepts validating as a valid stage', () => {
    const issue: PipelineIssue = {
      number: 1,
      repo: 'o/r',
      title: 'test',
      body: '',
      stage: 'validating',
      priority: 'normal',
      ingestedAt: 0,
      updatedAt: 0,
      executorAttempts: 0,
      plannerRunning: false,
      executorRunning: false,
      validatorRunning: true,
    }
    expect(issue.stage).toBe('validating')
    expect(issue.validatorRunning).toBe(true)
  })

  it('has validatorOutput as optional', () => {
    const issue: PipelineIssue = {
      number: 1,
      repo: 'o/r',
      title: 'test',
      body: '',
      stage: 'validating',
      priority: 'normal',
      ingestedAt: 0,
      updatedAt: 0,
      executorAttempts: 0,
      plannerRunning: false,
      executorRunning: false,
      validatorRunning: false,
      validatorOutput: 'VALIDATION_RESULT: PASS\nTEST_SUMMARY: ok',
    }
    expect(issue.validatorOutput).toContain('PASS')
  })
})
