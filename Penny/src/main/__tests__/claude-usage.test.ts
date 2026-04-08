/**
 * Unit tests for claude-usage.ts
 *
 * Mocks the Electron `session` module and the global `fetch` so the scraper
 * can be tested without a running Electron process.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock electron before importing claude-usage ───────────────────────────────
vi.mock('electron', () => ({
  session: {
    defaultSession: {
      cookies: {
        get: vi.fn().mockResolvedValue([
          { name: 'sessionKey', value: 'abc123' },
        ]),
      },
    },
  },
}))

// ── Import after mock is set up ───────────────────────────────────────────────
import { getClaudeUsage } from '../claude-usage'

// ── Helper: wire global fetch ─────────────────────────────────────────────────

function mockFetch(status: number, body: unknown) {
  const text = typeof body === 'string' ? body : JSON.stringify(body)
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    status,
    text: () => Promise.resolve(text),
  }))
}

beforeEach(() => {
  vi.unstubAllGlobals()
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('getClaudeUsage', () => {
  it('returns not-logged-in on 401', async () => {
    mockFetch(401, '')
    const result = await getClaudeUsage()
    expect(result.status).toBe('not-logged-in')
    expect(result.fetchedAt).toBeGreaterThan(0)
  })

  it('returns not-logged-in on 403', async () => {
    mockFetch(403, '')
    const result = await getClaudeUsage()
    expect(result.status).toBe('not-logged-in')
  })

  it('returns network-error on non-200 non-auth status', async () => {
    mockFetch(500, 'internal error')
    const result = await getClaudeUsage()
    expect(result.status).toBe('network-error')
  })

  it('returns network-error when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ENOTFOUND')))
    const result = await getClaudeUsage()
    expect(result.status).toBe('network-error')
  })

  it('returns parse-error on non-JSON response body', async () => {
    mockFetch(200, 'not json at all')
    const result = await getClaudeUsage()
    expect(result.status).toBe('parse-error')
  })

  it('returns ok and parses session usage', async () => {
    const now = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString() // 3 hours from now
    mockFetch(200, {
      session: {
        requests_used: 50,
        requests_limit: 100,
        resets_at: now,
      },
      limits: {
        all_models: { used: 30, limit: 100, resets_at: now },
        sonnet: { used: 20, limit: 50, resets_at: now },
      },
    })
    const result = await getClaudeUsage()
    expect(result.status).toBe('ok')
    expect(result.sessionUsedFraction).toBe(0.5)
    expect(result.allModels.used).toBe(0.3)
    expect(result.allModels.label).toBe('30% used')
    expect(result.sonnetOnly.used).toBe(0.4)
    expect(result.sonnetOnly.label).toBe('40% used')
  })

  it('clamps fractions to [0, 1]', async () => {
    const now = new Date(Date.now() + 60_000).toISOString()
    mockFetch(200, {
      session: {
        requests_used: 200,
        requests_limit: 100,
        resets_at: now,
      },
      limits: {
        all_models: { used: 0, limit: 0, resets_at: now },
        sonnet: { used: -5, limit: 50, resets_at: now },
      },
    })
    const result = await getClaudeUsage()
    expect(result.status).toBe('ok')
    expect(result.sessionUsedFraction).toBe(1) // clamped at 1
    expect(result.allModels.used).toBe(0)       // used/0 → 0 (max defaults to 1)
    expect(result.sonnetOnly.used).toBe(0)       // clamped at 0
  })

  it('includes extra usage fields when present', async () => {
    const now = new Date(Date.now() + 60_000).toISOString()
    mockFetch(200, {
      session: { requests_used: 10, requests_limit: 100, resets_at: now },
      limits: {
        all_models: { used: 10, limit: 100, resets_at: now },
        sonnet: { used: 5, limit: 50, resets_at: now },
      },
      extra: {
        spent: 1.5,
        limit: 10.0,
        balance: 8.5,
      },
    })
    const result = await getClaudeUsage()
    expect(result.status).toBe('ok')
    expect(result.extraSpent).toBe(1.5)
    expect(result.extraLimit).toBe(10.0)
    expect(result.extraBalance).toBe(8.5)
  })

  it('gracefully handles missing limit blocks (uses empty defaults)', async () => {
    const now = new Date(Date.now() + 60_000).toISOString()
    mockFetch(200, {
      session: { requests_used: 5, requests_limit: 100, resets_at: now },
      // no limits, no extra
    })
    const result = await getClaudeUsage()
    expect(result.status).toBe('ok')
    expect(result.allModels.used).toBe(0)
    expect(result.sonnetOnly.used).toBe(0)
    expect(result.extraSpent).toBe(0)
    expect(result.extraLimit).toBe(0)
  })

  it('formats resetsIn as hours and minutes', async () => {
    const future = new Date(Date.now() + (2 * 60 + 57) * 60_000).toISOString()
    mockFetch(200, {
      session: { requests_used: 10, requests_limit: 100, resets_at: future },
      limits: {
        all_models: { used: 10, limit: 100, resets_at: future },
        sonnet: { used: 5, limit: 50, resets_at: future },
      },
    })
    const result = await getClaudeUsage()
    expect(result.status).toBe('ok')
    // Should contain hours
    expect(result.sessionResetsIn).toMatch(/\d+ hr \d+ min/)
  })

  it('formats resetsIn as just minutes when under 1 hour', async () => {
    const future = new Date(Date.now() + 45 * 60_000).toISOString()
    mockFetch(200, {
      session: { requests_used: 10, requests_limit: 100, resets_at: future },
      limits: {
        all_models: { used: 10, limit: 100, resets_at: future },
        sonnet: { used: 5, limit: 50, resets_at: future },
      },
    })
    const result = await getClaudeUsage()
    expect(result.status).toBe('ok')
    expect(result.sessionResetsIn).toMatch(/^\d+ min$/)
  })

  it('sets fetchedAt close to Date.now()', async () => {
    mockFetch(401, '')
    const before = Date.now()
    const result = await getClaudeUsage()
    const after = Date.now()
    expect(result.fetchedAt).toBeGreaterThanOrEqual(before)
    expect(result.fetchedAt).toBeLessThanOrEqual(after)
  })
})
