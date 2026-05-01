/**
 * Unit tests for src/main/onboarding.ts
 *
 * Mocking strategy:
 *  - fs module: vi.mock('fs') with auto-mock, then spy on individual methods
 *  - child_process: vi.mock('child_process') to control isGitRepo behavior
 *  - ./github-issues: vi.mock factory to stub addWatchedRepo
 *  - process.env: mutated directly and cleaned up in afterEach
 *  - os: vi.mock to pin homedir so CONFIG_PATH is predictable
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { MockInstance } from 'vitest'

// ── Module mocks (must appear before any import of the module under test) ──────

vi.mock('fs')
vi.mock('child_process')
vi.mock('os', () => ({
  default: {
    homedir: vi.fn(() => '/fake/home'),
  },
  homedir: vi.fn(() => '/fake/home'),
}))

// github-issues is loaded via dynamic import() inside saveOnboarding.
// vi.mock with a factory replaces the module in the registry.
vi.mock('../github-issues', () => ({
  addWatchedRepo: vi.fn(),
}))

// ── Now import the module under test + dependencies ───────────────────────────

import fs from 'fs'
import { execFileSync } from 'child_process'
import os from 'os'
import { addWatchedRepo } from '../github-issues'
import { getOnboardingStatus, saveOnboarding, skipOnboarding } from '../onboarding'

// ── Typed mock helpers ─────────────────────────────────────────────────────────

const mockFs = vi.mocked(fs)
const mockExecFileSync = vi.mocked(execFileSync)
const mockOs = vi.mocked(os)
const mockAddWatchedRepo = vi.mocked(addWatchedRepo)

// A fake homedir so CONFIG_PATH is deterministic
const FAKE_HOME = '/fake/home'
const FAKE_CONFIG_PATH = `${FAKE_HOME}/.penpal/config.json`

// ── Shared setup ──────────────────────────────────────────────────────────────

// Saved env keys that the module writes; we restore them in afterEach.
const ENV_KEYS_UNDER_TEST = [
  'ANTHROPIC_API_KEY',
  'GITHUB_PERSONAL_ACCESS_TOKEN',
  'LINEAR_API_KEY',
]

let savedEnv: Record<string, string | undefined> = {}

beforeEach(() => {
  // Pin os.homedir so CONFIG_PATH is always under /fake/home
  mockOs.homedir.mockReturnValue(FAKE_HOME)

  // Default fs state: nothing exists
  mockFs.existsSync.mockReturnValue(false)
  mockFs.readFileSync.mockReturnValue('')
  mockFs.writeFileSync.mockReturnValue(undefined)
  mockFs.mkdirSync.mockReturnValue(undefined)
  mockFs.renameSync.mockReturnValue(undefined)

  // Save and clear all env keys under test
  for (const key of ENV_KEYS_UNDER_TEST) {
    savedEnv[key] = process.env[key]
    delete process.env[key]
  }
})

afterEach(() => {
  // Restore env
  for (const key of ENV_KEYS_UNDER_TEST) {
    if (savedEnv[key] === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = savedEnv[key]
    }
  }
  savedEnv = {}
})

// ─────────────────────────────────────────────────────────────────────────────
// getOnboardingStatus()
// ─────────────────────────────────────────────────────────────────────────────

describe('getOnboardingStatus()', () => {
  it('returns complete: false when config file does not exist and env vars are absent', () => {
    mockFs.existsSync.mockReturnValue(false)

    const status = getOnboardingStatus()

    expect(status.complete).toBe(false)
    expect(status.hasAnthropicKey).toBe(false)
    expect(status.hasGithubToken).toBe(false)
    expect(status.hasLinearKey).toBe(false)
  })

  it('returns complete: true when config has onboardingComplete: true', () => {
    mockFs.existsSync.mockReturnValue(true)
    mockFs.readFileSync.mockReturnValue(JSON.stringify({ onboardingComplete: true }))

    const status = getOnboardingStatus()

    expect(status.complete).toBe(true)
  })

  it('returns complete: true when both ANTHROPIC_API_KEY and GITHUB_PERSONAL_ACCESS_TOKEN are set (no config flag)', () => {
    mockFs.existsSync.mockReturnValue(false)
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test'
    process.env.GITHUB_PERSONAL_ACCESS_TOKEN = 'ghp_test'

    const status = getOnboardingStatus()

    expect(status.complete).toBe(true)
    expect(status.hasAnthropicKey).toBe(true)
    expect(status.hasGithubToken).toBe(true)
  })

  it('returns complete: false when only ANTHROPIC_API_KEY is set (missing GitHub token)', () => {
    mockFs.existsSync.mockReturnValue(false)
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test'

    const status = getOnboardingStatus()

    expect(status.complete).toBe(false)
    expect(status.hasAnthropicKey).toBe(true)
    expect(status.hasGithubToken).toBe(false)
  })

  it('returns complete: false when only GITHUB_PERSONAL_ACCESS_TOKEN is set (missing Anthropic key)', () => {
    mockFs.existsSync.mockReturnValue(false)
    process.env.GITHUB_PERSONAL_ACCESS_TOKEN = 'ghp_test'

    const status = getOnboardingStatus()

    expect(status.complete).toBe(false)
    expect(status.hasAnthropicKey).toBe(false)
    expect(status.hasGithubToken).toBe(true)
  })

  it('hasLinearKey is true when LINEAR_API_KEY is set', () => {
    process.env.LINEAR_API_KEY = 'lin_api_test'

    const status = getOnboardingStatus()

    expect(status.hasLinearKey).toBe(true)
  })

  it('hasLinearKey is false when LINEAR_API_KEY is absent', () => {
    delete process.env.LINEAR_API_KEY

    const status = getOnboardingStatus()

    expect(status.hasLinearKey).toBe(false)
  })

  it('handles malformed config JSON gracefully — returns complete: false without throwing', () => {
    mockFs.existsSync.mockReturnValue(true)
    mockFs.readFileSync.mockReturnValue('{ not valid json !!!')

    let status: ReturnType<typeof getOnboardingStatus> | undefined
    expect(() => {
      status = getOnboardingStatus()
    }).not.toThrow()

    expect(status!.complete).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// saveOnboarding()
// ─────────────────────────────────────────────────────────────────────────────

describe('saveOnboarding()', () => {
  // ── Validation failures ──────────────────────────────────────────────────

  it('returns { ok: false } when anthropicKey does not start with sk-ant-', async () => {
    const result = await saveOnboarding({
      anthropicKey: 'invalid-key',
      githubToken: 'ghp_test',
      linearKey: '',
    })

    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/sk-ant-/)
  })

  it('returns { ok: false } when anthropicKey is empty', async () => {
    const result = await saveOnboarding({
      anthropicKey: '',
      githubToken: 'ghp_test',
      linearKey: '',
    })

    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('returns { ok: false } when githubToken is empty', async () => {
    const result = await saveOnboarding({
      anthropicKey: 'sk-ant-valid',
      githubToken: '',
      linearKey: '',
    })

    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/GitHub/)
  })

  it('returns { ok: false } when anthropicKey contains a newline', async () => {
    const result = await saveOnboarding({
      anthropicKey: 'sk-ant-valid\ninjection',
      githubToken: 'ghp_test',
      linearKey: '',
    })

    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/newline/)
  })

  it('returns { ok: false } when githubToken contains a newline', async () => {
    const result = await saveOnboarding({
      anthropicKey: 'sk-ant-valid',
      githubToken: 'ghp_test\ninjection',
      linearKey: '',
    })

    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/newline/)
  })

  it('returns { ok: false } when linearKey contains a newline', async () => {
    const result = await saveOnboarding({
      anthropicKey: 'sk-ant-valid',
      githubToken: 'ghp_test',
      linearKey: 'lin_api\ninjection',
    })

    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/newline/)
  })

  it('returns { ok: false } when anthropicKey contains a carriage return', async () => {
    const result = await saveOnboarding({
      anthropicKey: 'sk-ant-valid\rinjection',
      githubToken: 'ghp_test',
      linearKey: '',
    })

    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/newline/)
  })

  it('returns { ok: false } when githubToken contains a carriage return', async () => {
    const result = await saveOnboarding({
      anthropicKey: 'sk-ant-valid',
      githubToken: 'ghp_test\rinjection',
      linearKey: '',
    })

    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/newline/)
  })

  // ── Successful write ─────────────────────────────────────────────────────

  it('writes correct lines to .env on success', async () => {
    mockFs.existsSync.mockReturnValue(false)
    mockFs.readFileSync.mockReturnValue('')

    const writtenContents: string[] = []
    mockFs.writeFileSync.mockImplementation((_p, data) => {
      writtenContents.push(data as string)
    })

    await saveOnboarding({
      anthropicKey: 'sk-ant-mykey',
      githubToken: 'ghp_mytoken',
      linearKey: '',
    })

    // First writeFileSync call should be the .env.tmp content
    const envContent = writtenContents[0]
    expect(envContent).toContain('ANTHROPIC_API_KEY=sk-ant-mykey')
    expect(envContent).toContain('GITHUB_PERSONAL_ACCESS_TOKEN=ghp_mytoken')
  })

  it('merges with existing .env content — preserves existing vars and updates specified ones', async () => {
    // Existing .env has OTHER_VAR and an old ANTHROPIC_API_KEY
    const existingEnv = 'OTHER_VAR=preserved\nANTHROPIC_API_KEY=sk-ant-old\n'
    mockFs.existsSync.mockImplementation((p: fs.PathLike) => {
      return String(p).endsWith('.env')
    })
    mockFs.readFileSync.mockImplementation((p: fs.PathOrFileDescriptor) => {
      if (String(p).endsWith('.env')) return existingEnv
      return ''
    })

    const writtenContents: string[] = []
    mockFs.writeFileSync.mockImplementation((_p, data) => {
      writtenContents.push(data as string)
    })

    await saveOnboarding({
      anthropicKey: 'sk-ant-newkey',
      githubToken: 'ghp_newtoken',
      linearKey: '',
    })

    const envContent = writtenContents[0]
    // Updated key
    expect(envContent).toContain('ANTHROPIC_API_KEY=sk-ant-newkey')
    // Existing OTHER_VAR is preserved
    expect(envContent).toContain('OTHER_VAR=preserved')
    // Old key value is gone
    expect(envContent).not.toContain('sk-ant-old')
  })

  it('loads new keys into process.env immediately after write', async () => {
    mockFs.existsSync.mockReturnValue(false)

    // Ensure keys are not set before
    delete process.env.ANTHROPIC_API_KEY
    delete process.env.GITHUB_PERSONAL_ACCESS_TOKEN

    await saveOnboarding({
      anthropicKey: 'sk-ant-immediate',
      githubToken: 'ghp_immediate',
      linearKey: '',
    })

    expect(process.env.ANTHROPIC_API_KEY).toBe('sk-ant-immediate')
    expect(process.env.GITHUB_PERSONAL_ACCESS_TOKEN).toBe('ghp_immediate')
  })

  it('loads LINEAR_API_KEY into process.env when linearKey is provided', async () => {
    mockFs.existsSync.mockReturnValue(false)
    delete process.env.LINEAR_API_KEY

    await saveOnboarding({
      anthropicKey: 'sk-ant-valid',
      githubToken: 'ghp_valid',
      linearKey: 'lin_api_key',
    })

    expect(process.env.LINEAR_API_KEY).toBe('lin_api_key')
  })

  it('writes onboardingComplete: true to config file on success', async () => {
    // Config file does not exist yet
    mockFs.existsSync.mockReturnValue(false)

    const configWrites: string[] = []
    mockFs.writeFileSync.mockImplementation((_p, data) => {
      const path = String(_p)
      if (path.includes('config.json')) {
        configWrites.push(data as string)
      }
    })

    await saveOnboarding({
      anthropicKey: 'sk-ant-valid',
      githubToken: 'ghp_valid',
      linearKey: '',
    })

    expect(configWrites.length).toBeGreaterThan(0)
    const written = JSON.parse(configWrites[configWrites.length - 1])
    expect(written.onboardingComplete).toBe(true)
  })

  it('returns { ok: true } on success', async () => {
    mockFs.existsSync.mockReturnValue(false)

    const result = await saveOnboarding({
      anthropicKey: 'sk-ant-valid',
      githubToken: 'ghp_valid',
      linearKey: '',
    })

    expect(result.ok).toBe(true)
    expect(result.error).toBeUndefined()
  })

  it('uses atomic write — writes to .env.tmp first then renames to .env', async () => {
    mockFs.existsSync.mockReturnValue(false)

    const writtenPaths: string[] = []
    mockFs.writeFileSync.mockImplementation((p) => {
      writtenPaths.push(String(p))
    })

    const renamedPairs: Array<[string, string]> = []
    mockFs.renameSync.mockImplementation((src, dest) => {
      renamedPairs.push([String(src), String(dest)])
    })

    await saveOnboarding({
      anthropicKey: 'sk-ant-valid',
      githubToken: 'ghp_valid',
      linearKey: '',
    })

    // The tmp path must have been written
    const tmpWrite = writtenPaths.find(p => p.endsWith('.env.tmp'))
    expect(tmpWrite).toBeTruthy()

    // renameSync should have been called with .env.tmp -> .env
    expect(renamedPairs.length).toBeGreaterThan(0)
    const [src, dest] = renamedPairs[0]
    expect(src).toMatch(/\.env\.tmp$/)
    expect(dest).toMatch(/\.env$/)
    expect(dest).not.toMatch(/\.tmp$/)
  })

  // ── addGithubRepo branch ─────────────────────────────────────────────────

  it('calls addWatchedRepo when addGithubRepo is provided and localPath is a valid git repo', async () => {
    const validPath = '/absolute/valid/repo'

    mockFs.existsSync.mockReturnValue(true)
    mockFs.readFileSync.mockReturnValue('')
    // execFileSync must not throw (simulates git rev-parse success)
    mockExecFileSync.mockReturnValue(Buffer.from('.git'))

    const result = await saveOnboarding({
      anthropicKey: 'sk-ant-valid',
      githubToken: 'ghp_valid',
      linearKey: '',
      addGithubRepo: { owner: 'acme', repo: 'widget', localPath: validPath },
    })

    expect(result.ok).toBe(true)
    expect(mockAddWatchedRepo).toHaveBeenCalledWith('acme', 'widget', validPath)
  })

  it('returns { ok: false } when addGithubRepo.localPath is not a git repo (execFileSync throws)', async () => {
    const notGitPath = '/absolute/not/a/git/dir'

    mockFs.existsSync.mockReturnValue(true)
    // execFileSync throws — git rev-parse fails
    mockExecFileSync.mockImplementation(() => {
      throw new Error('not a git repository')
    })

    const result = await saveOnboarding({
      anthropicKey: 'sk-ant-valid',
      githubToken: 'ghp_valid',
      linearKey: '',
      addGithubRepo: { owner: 'acme', repo: 'widget', localPath: notGitPath },
    })

    expect(result.ok).toBe(false)
    expect(result.error).toContain(notGitPath)
  })

  it('returns { ok: false } when addGithubRepo.localPath does not exist', async () => {
    const missingPath = '/absolute/missing/path'

    mockFs.existsSync.mockImplementation((p: fs.PathLike) => {
      // .env does not exist either — keeps env read simple
      return false
    })

    const result = await saveOnboarding({
      anthropicKey: 'sk-ant-valid',
      githubToken: 'ghp_valid',
      linearKey: '',
      addGithubRepo: { owner: 'acme', repo: 'widget', localPath: missingPath },
    })

    expect(result.ok).toBe(false)
    expect(result.error).toContain(missingPath)
  })

  it('returns { ok: false } when addGithubRepo.localPath is not absolute', async () => {
    const relativePath = 'relative/path/to/repo'

    const result = await saveOnboarding({
      anthropicKey: 'sk-ant-valid',
      githubToken: 'ghp_valid',
      linearKey: '',
      addGithubRepo: { owner: 'acme', repo: 'widget', localPath: relativePath },
    })

    expect(result.ok).toBe(false)
    expect(result.error).toContain(relativePath)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// skipOnboarding()
// ─────────────────────────────────────────────────────────────────────────────

describe('skipOnboarding()', () => {
  it('writes onboardingComplete: true to config without touching .env', async () => {
    // Config file does not exist yet
    mockFs.existsSync.mockReturnValue(false)

    const configWrites: Array<{ path: string; content: string }> = []
    const otherWrites: string[] = []

    mockFs.writeFileSync.mockImplementation((p, data) => {
      const pathStr = String(p)
      if (pathStr.includes('config.json')) {
        configWrites.push({ path: pathStr, content: data as string })
      } else {
        otherWrites.push(pathStr)
      }
    })

    await skipOnboarding()

    // Config was written with onboardingComplete: true
    expect(configWrites.length).toBe(1)
    const written = JSON.parse(configWrites[0].content)
    expect(written.onboardingComplete).toBe(true)

    // No .env writes occurred
    expect(otherWrites.filter(p => p.includes('.env'))).toHaveLength(0)
    expect(mockFs.renameSync).not.toHaveBeenCalled()
  })

  it('merges with existing config rather than overwriting other keys', async () => {
    // Existing config has a different key
    mockFs.existsSync.mockReturnValue(true)
    mockFs.readFileSync.mockImplementation((p: fs.PathOrFileDescriptor) => {
      if (String(p).includes('config.json')) {
        return JSON.stringify({ someOtherKey: 'preserved', onboardingComplete: false })
      }
      return ''
    })

    const configWrites: string[] = []
    mockFs.writeFileSync.mockImplementation((p, data) => {
      if (String(p).includes('config.json')) {
        configWrites.push(data as string)
      }
    })

    await skipOnboarding()

    expect(configWrites.length).toBe(1)
    const written = JSON.parse(configWrites[0])
    expect(written.onboardingComplete).toBe(true)
    expect(written.someOtherKey).toBe('preserved')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// isGitRepo() — tested indirectly via saveOnboarding behavior
// ─────────────────────────────────────────────────────────────────────────────

describe('isGitRepo() (via saveOnboarding)', () => {
  it('accepts a path when git rev-parse --git-dir succeeds', async () => {
    const validRepo = '/absolute/valid/git/repo'

    mockFs.existsSync.mockReturnValue(true)
    mockExecFileSync.mockReturnValue(Buffer.from('.git'))

    const result = await saveOnboarding({
      anthropicKey: 'sk-ant-valid',
      githubToken: 'ghp_valid',
      linearKey: '',
      addGithubRepo: { owner: 'owner', repo: 'repo', localPath: validRepo },
    })

    expect(result.ok).toBe(true)
    expect(mockExecFileSync).toHaveBeenCalledWith('git', ['rev-parse', '--git-dir'], expect.objectContaining({ cwd: validRepo }))
  })

  it('rejects a directory when git rev-parse --git-dir fails', async () => {
    const nonRepo = '/absolute/not/git'

    mockFs.existsSync.mockReturnValue(true)
    mockExecFileSync.mockImplementation(() => {
      throw new Error('fatal: not a git repository')
    })

    const result = await saveOnboarding({
      anthropicKey: 'sk-ant-valid',
      githubToken: 'ghp_valid',
      linearKey: '',
      addGithubRepo: { owner: 'owner', repo: 'repo', localPath: nonRepo },
    })

    expect(result.ok).toBe(false)
    expect(result.error).toContain(nonRepo)
  })
})
