import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getHeadlessBackendChain,
  getTaskRunnerKind,
  headlessFailureShouldFallback,
  parseHeadlessBackends,
} from '../../src/main/agents'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('parseHeadlessBackends', () => {
  it('parses comma-separated runners and ollama/local', () => {
    expect(parseHeadlessBackends('claude, cursor-agent ,opencode')).toEqual([
      'claude',
      'cursor-agent',
      'opencode',
    ])
    expect(parseHeadlessBackends('ollama,local')).toEqual(['ollama', 'ollama'])
  })

  it('returns null for empty', () => {
    expect(parseHeadlessBackends(undefined)).toBeNull()
    expect(parseHeadlessBackends('')).toBeNull()
    expect(parseHeadlessBackends(' , ')).toBeNull()
  })
})

describe('getHeadlessBackendChain', () => {
  it('uses phase env then falls back to PENNY_TASK_RUNNER', () => {
    vi.stubEnv('PENNY_TASK_RUNNER', 'claude')
    vi.stubEnv('PENNY_TASK_RUNNER_PLAN', '')
    vi.stubEnv('PENNY_TASK_RUNNER_PLANNING', '')
    expect(getHeadlessBackendChain('planning')).toEqual(['claude'])

    vi.stubEnv('PENNY_TASK_RUNNER_PLAN', 'cursor-agent,opencode')
    expect(getHeadlessBackendChain('planning')).toEqual(['cursor-agent', 'opencode'])
  })

  it('reviewing inherits validate then plan', () => {
    vi.stubEnv('PENNY_TASK_RUNNER_REVIEW', '')
    vi.stubEnv('PENNY_TASK_RUNNER_REVIEWING', '')
    vi.stubEnv('PENNY_TASK_RUNNER_VALIDATE', 'ollama')
    vi.stubEnv('PENNY_TASK_RUNNER_PLAN', 'claude')
    expect(getHeadlessBackendChain('reviewing')).toEqual(['ollama'])

    vi.stubEnv('PENNY_TASK_RUNNER_VALIDATE', '')
    vi.stubEnv('PENNY_TASK_RUNNER_VALIDATING', '')
    vi.stubEnv('PENNY_TASK_RUNNER_PLAN', 'opencode')
    expect(getHeadlessBackendChain('reviewing')).toEqual(['opencode'])
  })
})

describe('headlessFailureShouldFallback', () => {
  it('detects quota-style messages', () => {
    expect(headlessFailureShouldFallback("You've hit your limit", '')).toBe(true)
    expect(headlessFailureShouldFallback('', 'rate limit exceeded')).toBe(true)
    expect(headlessFailureShouldFallback('Ollama not running', '')).toBe(true)
  })

  it('returns false for generic errors', () => {
    expect(headlessFailureShouldFallback('syntax error', '')).toBe(false)
  })
})

describe('getTaskRunnerKind', () => {
  it('defaults to cursor-agent when unset', () => {
    vi.stubEnv('PENNY_TASK_RUNNER', '')
    expect(getTaskRunnerKind()).toBe('cursor-agent')
  })
})
