/**
 * Scrapes Claude.ai usage data for the current user session.
 *
 * Fetches the /api/usage endpoint from claude.ai using the Electron session
 * cookies so the request is authenticated. Parses the response into a
 * structured ClaudeUsage object.
 */

import { session } from 'electron'

export interface ClaudeUsageLimit {
  used: number      // 0–1 fraction
  label: string     // e.g. "57% used"
  resetsAt: string  // human-readable, e.g. "Fri 10:00 AM"
}

export interface ClaudeUsage {
  status: 'ok' | 'not-logged-in' | 'parse-error' | 'network-error'
  sessionUsedFraction: number  // 0–1
  sessionResetsIn: string      // e.g. "2 hr 57 min"
  allModels: ClaudeUsageLimit
  sonnetOnly: ClaudeUsageLimit
  extraSpent: number           // dollars
  extraLimit: number           // dollars
  extraBalance: number         // dollars
  fetchedAt: number            // Date.now() timestamp
}

const CLAUDE_USAGE_URL = 'https://claude.ai/api/usage'

// ── Helpers ───────────────────────────────────────────────────────────────────

function toFraction(value: unknown, max: unknown): number {
  const v = typeof value === 'number' ? value : 0
  const m = typeof max === 'number' && max > 0 ? max : 1
  return Math.min(1, Math.max(0, v / m))
}

function formatResetsAt(isoString: unknown): string {
  if (typeof isoString !== 'string') return 'unknown'
  try {
    const d = new Date(isoString)
    if (isNaN(d.getTime())) return 'unknown'
    return d.toLocaleString('en-US', {
      weekday: 'short',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  } catch {
    return 'unknown'
  }
}

function formatResetsIn(isoString: unknown): string {
  if (typeof isoString !== 'string') return 'unknown'
  try {
    const d = new Date(isoString)
    if (isNaN(d.getTime())) return 'unknown'
    const diffMs = d.getTime() - Date.now()
    if (diffMs <= 0) return 'now'
    const totalMins = Math.floor(diffMs / 60_000)
    const hours = Math.floor(totalMins / 60)
    const mins = totalMins % 60
    if (hours > 0) return `${hours} hr ${mins} min`
    return `${mins} min`
  } catch {
    return 'unknown'
  }
}

function pct(fraction: number): string {
  return `${Math.round(fraction * 100)}% used`
}

function parseLimitBlock(block: Record<string, unknown>, usedKey: string, maxKey: string, resetsKey: string): ClaudeUsageLimit {
  const used = typeof block[usedKey] === 'number' ? (block[usedKey] as number) : 0
  const max = typeof block[maxKey] === 'number' ? (block[maxKey] as number) : 1
  const fraction = toFraction(used, max)
  return {
    used: fraction,
    label: pct(fraction),
    resetsAt: formatResetsAt(block[resetsKey]),
  }
}

// ── Cookie-authenticated fetch ────────────────────────────────────────────────

async function fetchWithSessionCookies(url: string): Promise<{ status: number; body: string }> {
  const ses = session.defaultSession
  const cookies = await ses.cookies.get({ domain: 'claude.ai' })
  const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ')

  const resp = await fetch(url, {
    headers: {
      Cookie: cookieHeader,
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      Accept: 'application/json',
      'Accept-Language': 'en-US,en;q=0.9',
      Referer: 'https://claude.ai/',
    },
  })

  return { status: resp.status, body: await resp.text() }
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function getClaudeUsage(): Promise<ClaudeUsage> {
  const empty: ClaudeUsageLimit = { used: 0, label: '0% used', resetsAt: 'unknown' }
  const base: Omit<ClaudeUsage, 'status'> = {
    sessionUsedFraction: 0,
    sessionResetsIn: 'unknown',
    allModels: empty,
    sonnetOnly: empty,
    extraSpent: 0,
    extraLimit: 0,
    extraBalance: 0,
    fetchedAt: Date.now(),
  }

  let resp: { status: number; body: string }
  try {
    resp = await fetchWithSessionCookies(CLAUDE_USAGE_URL)
  } catch (err) {
    return { ...base, status: 'network-error', fetchedAt: Date.now() }
  }

  if (resp.status === 401 || resp.status === 403) {
    return { ...base, status: 'not-logged-in', fetchedAt: Date.now() }
  }

  if (resp.status !== 200) {
    return { ...base, status: 'network-error', fetchedAt: Date.now() }
  }

  let data: unknown
  try {
    data = JSON.parse(resp.body)
  } catch {
    return { ...base, status: 'parse-error', fetchedAt: Date.now() }
  }

  try {
    const d = data as Record<string, unknown>

    // Session-level usage (rate limit window)
    const session = (d.session ?? d.rate_limit ?? {}) as Record<string, unknown>
    const sessionUsed = typeof session.requests_used === 'number' ? session.requests_used : 0
    const sessionMax = typeof session.requests_limit === 'number' ? session.requests_limit : 1
    const sessionUsedFraction = toFraction(sessionUsed, sessionMax)
    const sessionResetsIn = formatResetsIn(session.resets_at ?? session.reset_at)

    // Weekly limit blocks
    const limits = (d.limits ?? d.usage_limits ?? {}) as Record<string, unknown>
    const allModelsBlock = (limits.all_models ?? limits.total ?? {}) as Record<string, unknown>
    const sonnetBlock = (limits.sonnet ?? limits.claude_3_5_sonnet ?? limits.premium ?? {}) as Record<string, unknown>

    const allModels = parseLimitBlock(allModelsBlock, 'used', 'limit', 'resets_at')
    const sonnetOnly = parseLimitBlock(sonnetBlock, 'used', 'limit', 'resets_at')

    // Extra usage (credit-based top-up)
    const extra = (d.extra ?? d.credit ?? {}) as Record<string, unknown>
    const extraSpent = typeof extra.spent === 'number' ? extra.spent : 0
    const extraLimit = typeof extra.limit === 'number' ? extra.limit : 0
    const extraBalance = typeof extra.balance === 'number' ? extra.balance : 0

    return {
      status: 'ok',
      sessionUsedFraction,
      sessionResetsIn,
      allModels,
      sonnetOnly,
      extraSpent,
      extraLimit,
      extraBalance,
      fetchedAt: Date.now(),
    }
  } catch {
    return { ...base, status: 'parse-error', fetchedAt: Date.now() }
  }
}
