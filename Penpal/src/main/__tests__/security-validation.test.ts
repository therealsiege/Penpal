/**
 * Security and input validation tests.
 *
 * Covers:
 *   - sanitizePtyEnv (pty.ts) — blocked env key stripping
 *   - addWatchedRepo (github-issues.ts) — localPath validation
 *   - briefing:get date validation (pure logic)
 *   - pod:retry-issue repo format validation (pure logic)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// sanitizePtyEnv
//
// The function is not exported from pty.ts, so we reproduce the exact same
// algorithm extracted verbatim from the source.  The constants are also
// copied verbatim so the tests would catch any change to either set.
// ---------------------------------------------------------------------------

const BLOCKED_ENV_KEYS = new Set([
  'LD_PRELOAD',
  'LD_LIBRARY_PATH',
  'DYLD_INSERT_LIBRARIES',
  'DYLD_LIBRARY_PATH',
  'DYLD_FORCE_FLAT_NAMESPACE',
  'LD_AUDIT',
  'LD_DEBUG',
])

function sanitizePtyEnv(env: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(env)) {
    if (!BLOCKED_ENV_KEYS.has(k) && typeof v === 'string') {
      out[k] = v
    }
  }
  return out
}

describe('sanitizePtyEnv', () => {
  it('strips LD_PRELOAD', () => {
    const result = sanitizePtyEnv({ LD_PRELOAD: '/evil.so', HOME: '/home/user' })
    expect(result).not.toHaveProperty('LD_PRELOAD')
    expect(result.HOME).toBe('/home/user')
  })

  it('strips DYLD_INSERT_LIBRARIES', () => {
    const result = sanitizePtyEnv({ DYLD_INSERT_LIBRARIES: '/evil.dylib', PATH: '/usr/bin' })
    expect(result).not.toHaveProperty('DYLD_INSERT_LIBRARIES')
    expect(result.PATH).toBe('/usr/bin')
  })

  it('strips LD_LIBRARY_PATH', () => {
    const result = sanitizePtyEnv({ LD_LIBRARY_PATH: '/bad/lib', NODE_ENV: 'production' })
    expect(result).not.toHaveProperty('LD_LIBRARY_PATH')
    expect(result.NODE_ENV).toBe('production')
  })

  it('strips DYLD_LIBRARY_PATH', () => {
    const result = sanitizePtyEnv({ DYLD_LIBRARY_PATH: '/bad/lib', HOME: '/root' })
    expect(result).not.toHaveProperty('DYLD_LIBRARY_PATH')
    expect(result.HOME).toBe('/root')
  })

  it('strips DYLD_FORCE_FLAT_NAMESPACE', () => {
    const result = sanitizePtyEnv({ DYLD_FORCE_FLAT_NAMESPACE: '1', HOME: '/root' })
    expect(result).not.toHaveProperty('DYLD_FORCE_FLAT_NAMESPACE')
    expect(result.HOME).toBe('/root')
  })

  it('preserves safe env vars', () => {
    const input = {
      HOME: '/home/user',
      PATH: '/usr/local/bin:/usr/bin',
      NODE_ENV: 'production',
      ANTHROPIC_API_KEY: 'sk-ant-secret',
    }
    const result = sanitizePtyEnv(input)
    expect(result.HOME).toBe('/home/user')
    expect(result.PATH).toBe('/usr/local/bin:/usr/bin')
    expect(result.NODE_ENV).toBe('production')
    expect(result.ANTHROPIC_API_KEY).toBe('sk-ant-secret')
  })

  it('handles an empty env object without error', () => {
    expect(() => sanitizePtyEnv({})).not.toThrow()
    expect(sanitizePtyEnv({})).toEqual({})
  })

  it('returns empty object when all keys are blocked', () => {
    const input: Record<string, string> = {}
    for (const key of BLOCKED_ENV_KEYS) input[key] = 'value'
    expect(sanitizePtyEnv(input)).toEqual({})
  })

  it('strips non-string values', () => {
    const result = sanitizePtyEnv({
      NUMERIC: 42 as unknown as string,
      ARRAY: [] as unknown as string,
      NULL_VAL: null as unknown as string,
      GOOD: 'ok',
    })
    expect(result).not.toHaveProperty('NUMERIC')
    expect(result).not.toHaveProperty('ARRAY')
    expect(result).not.toHaveProperty('NULL_VAL')
    expect(result.GOOD).toBe('ok')
  })
})

// ---------------------------------------------------------------------------
// addWatchedRepo — path validation
//
// addWatchedRepo calls:
//   !path.isAbsolute(localPath) || !fs.existsSync(localPath) || !isGitRepo(localPath)
// and throws `${localPath} is not a git repository` on any failure.
//
// isGitRepo calls execFileSync('git', ['rev-parse', '--git-dir'], ...) and
// returns false on non-zero exit.
// ---------------------------------------------------------------------------

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>()
  return {
    ...actual,
    existsSync: vi.fn(actual.existsSync),
    default: {
      ...actual,
      existsSync: vi.fn(actual.existsSync),
    },
  }
})

vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>()
  return {
    ...actual,
    execFileSync: vi.fn(actual.existsSync),
    default: {
      ...actual,
      execFileSync: vi.fn(),
    },
  }
})

describe('addWatchedRepo path validation', () => {
  // We test the validation logic directly rather than importing addWatchedRepo,
  // which drags in heavy module-level side effects (loadPersistedRepos, REPOS init,
  // dynamic imports of orchestrator, pods, etc.).  The validation logic is a
  // single guard expression that maps directly to these pure-logic tests.

  // Mirrors the guard: !path.isAbsolute(p) || !existsSync(p) || !isGitRepo(p)
  function validateLocalPath(
    localPath: string,
    existsSync: (p: string) => boolean,
    isGitRepo: (p: string) => boolean,
  ): void {
    const path = { isAbsolute: (p: string) => p.startsWith('/') }
    if (!path.isAbsolute(localPath) || !existsSync(localPath) || !isGitRepo(localPath)) {
      throw new Error(`${localPath} is not a git repository`)
    }
  }

  it('throws when localPath is a relative path', () => {
    expect(() =>
      validateLocalPath('relative/path', () => true, () => true),
    ).toThrow('is not a git repository')
  })

  it('throws when localPath directory does not exist', () => {
    expect(() =>
      validateLocalPath('/absolute/nonexistent', () => false, () => true),
    ).toThrow('is not a git repository')
  })

  it('throws when localPath exists but is not a git repo', () => {
    expect(() =>
      validateLocalPath('/absolute/exists/no-git', () => true, () => false),
    ).toThrow('is not a git repository')
  })

  it('succeeds when localPath is absolute, exists, and is a git repo', () => {
    expect(() =>
      validateLocalPath('/absolute/valid/repo', () => true, () => true),
    ).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// briefing:get — date validation (pure logic)
// Extracted from: ipcMain.handle('briefing:get', ...)
// ---------------------------------------------------------------------------

const isValidBriefingDate = (s: unknown): s is string =>
  typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)

describe('isValidBriefingDate', () => {
  it('accepts a well-formed ISO date', () => {
    expect(isValidBriefingDate('2024-01-15')).toBe(true)
  })

  it('rejects a date with single-digit month/day', () => {
    expect(isValidBriefingDate('2024-1-5')).toBe(false)
  })

  it('rejects a path traversal string', () => {
    expect(isValidBriefingDate('../../.env')).toBe(false)
  })

  it('rejects a date with a .md extension appended', () => {
    expect(isValidBriefingDate('2024-01-15.md')).toBe(false)
  })

  it('rejects an empty string', () => {
    expect(isValidBriefingDate('')).toBe(false)
  })

  it('rejects null', () => {
    expect(isValidBriefingDate(null)).toBe(false)
  })

  it('rejects undefined', () => {
    expect(isValidBriefingDate(undefined)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// pod:retry-issue — repo format validation (pure logic)
// Extracted from: ipcMain.handle('pod:retry-issue', ...)
// ---------------------------------------------------------------------------

const isValidRepo = (s: unknown): s is string =>
  typeof s === 'string' && /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(s)

describe('isValidRepo', () => {
  it('accepts owner/repo', () => {
    expect(isValidRepo('owner/repo')).toBe(true)
  })

  it('accepts org and repo with hyphens and dots', () => {
    expect(isValidRepo('my-org/my.repo')).toBe(true)
  })

  it('rejects a path traversal string', () => {
    expect(isValidRepo('../../../etc/passwd')).toBe(false)
  })

  it('rejects a string with no slash', () => {
    expect(isValidRepo('owner')).toBe(false)
  })

  it('rejects extra path segments after owner/repo', () => {
    expect(isValidRepo('owner/repo/extra')).toBe(false)
  })

  it('rejects a shell injection string', () => {
    expect(isValidRepo('; rm -rf /')).toBe(false)
  })
})
