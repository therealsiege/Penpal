/**
 * Claude.ai Usage Scraper — Main Process Module
 *
 * Scrapes https://claude.ai/settings/usage via a hidden BrowserWindow
 * using the persist:claude-ai session partition for cookie persistence.
 */

import { BrowserWindow, session } from 'electron'

// ── Types ───────────────────────────────────────────────────────────────────

export interface ClaudeUsageData {
  status: 'ok' | 'not-logged-in' | 'parse-error' | 'network-error' | 'loading'
  session: { percentUsed: number; resetLabel: string } | null
  weeklyLimits: {
    allModels: { percentUsed: number; resetLabel: string }
    sonnetOnly: { percentUsed: number; resetLabel: string }
  } | null
  extra: { dollarsSpent: number; monthlyLimit: number; balance: number } | null
  scrapedAt: number
  error?: string
}

// ── Constants ───────────────────────────────────────────────────────────────

const PARTITION = 'persist:claude-ai'
const USAGE_URL = 'https://claude.ai/settings/usage'
const LOGIN_URL = 'https://claude.ai'
const BASE_POLL_MS = 2.5 * 60 * 1000 // 2.5 minutes
const MAX_POLL_MS = 10 * 60 * 1000   // 10 minutes
const BACKOFF_THRESHOLD = 3           // consecutive failures before backoff

// ── Module State ────────────────────────────────────────────────────────────

let cachedData: ClaudeUsageData | null = null
let hiddenWindow: BrowserWindow | null = null
let loginWindow: BrowserWindow | null = null
let pollTimer: ReturnType<typeof setTimeout> | null = null
let consecutiveFailures = 0
let currentPollMs = BASE_POLL_MS
let destroyed = false

// ── DOM Extraction ──────────────────────────────────────────────────────────

/** JS executed inside the hidden BrowserWindow to extract usage text. */
const EXTRACT_SCRIPT = `
(function() {
  const text = document.body.innerText;
  return { text, url: window.location.href };
})()
`

function parseUsageText(text: string): Omit<ClaudeUsageData, 'status' | 'scrapedAt' | 'error'> {
  // Session usage: e.g. "75% used" near "Current session"
  const sessionMatch = text.match(/(?:current\s+session|session\s+usage)[^]*?(\d+)%\s*used/i)
  const sessionResetMatch = text.match(/(?:current\s+session|session\s+usage)[^]*?resets?\s+in\s+([^\n]+)/i)

  const sessionData = sessionMatch
    ? { percentUsed: parseInt(sessionMatch[1], 10), resetLabel: sessionResetMatch?.[1]?.trim() ?? '' }
    : null

  // Weekly limits — all models
  const allModelsMatch = text.match(/(?:all\s+models)[^]*?(\d+)%\s*used/i)
  const allModelsResetMatch = text.match(/(?:all\s+models)[^]*?resets?\s+in\s+([^\n]+)/i)

  // Weekly limits — Sonnet only
  const sonnetMatch = text.match(/(?:sonnet\s+only|sonnet)[^]*?(\d+)%\s*used/i)
  const sonnetResetMatch = text.match(/(?:sonnet\s+only|sonnet)[^]*?resets?\s+in\s+([^\n]+)/i)

  const weeklyLimits = allModelsMatch || sonnetMatch
    ? {
        allModels: {
          percentUsed: allModelsMatch ? parseInt(allModelsMatch[1], 10) : 0,
          resetLabel: allModelsResetMatch?.[1]?.trim() ?? '',
        },
        sonnetOnly: {
          percentUsed: sonnetMatch ? parseInt(sonnetMatch[1], 10) : 0,
          resetLabel: sonnetResetMatch?.[1]?.trim() ?? '',
        },
      }
    : null

  // Extra usage: "$X.XX spent" and "$Y.YY Monthly limit" or "balance"
  const spentMatch = text.match(/\$(\d+(?:\.\d+)?)\s*spent/i)
  const limitMatch = text.match(/\$(\d+(?:\.\d+)?)\s*(?:monthly\s*limit|monthly)/i)
  const balanceMatch = text.match(/\$(\d+(?:\.\d+)?)\s*(?:balance|remaining)/i)

  const extra = spentMatch
    ? {
        dollarsSpent: parseFloat(spentMatch[1]),
        monthlyLimit: limitMatch ? parseFloat(limitMatch[1]) : 0,
        balance: balanceMatch ? parseFloat(balanceMatch[1]) : 0,
      }
    : null

  return { session: sessionData, weeklyLimits, extra }
}

// ── Hidden Window Management ────────────────────────────────────────────────

function createHiddenWindow(): BrowserWindow {
  const win = new BrowserWindow({
    show: false,
    width: 1024,
    height: 768,
    webPreferences: {
      partition: PARTITION,
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  win.webContents.on('did-fail-load', (_e, errorCode, errorDesc) => {
    console.warn(`[claude-usage] Hidden window load failed: ${errorCode} ${errorDesc}`)
    handleScrapeResult({
      status: 'network-error',
      session: null,
      weeklyLimits: null,
      extra: null,
      scrapedAt: Date.now(),
      error: `${errorCode}: ${errorDesc}`,
    })
  })

  win.webContents.on('render-process-gone', (_e, details) => {
    console.warn(`[claude-usage] Renderer crashed: ${details.reason}`)
    hiddenWindow = null
  })

  return win
}

async function scrape(): Promise<ClaudeUsageData> {
  if (destroyed) {
    return { status: 'network-error', session: null, weeklyLimits: null, extra: null, scrapedAt: Date.now(), error: 'Scraper destroyed' }
  }

  // Recreate window if it was destroyed or crashed
  if (!hiddenWindow || hiddenWindow.isDestroyed()) {
    hiddenWindow = createHiddenWindow()
  }

  try {
    await hiddenWindow.loadURL(USAGE_URL)
  } catch (err) {
    return {
      status: 'network-error',
      session: null,
      weeklyLimits: null,
      extra: null,
      scrapedAt: Date.now(),
      error: (err as Error).message,
    }
  }

  // Check for login redirect
  const currentUrl = hiddenWindow.webContents.getURL()
  if (currentUrl.includes('/login') || currentUrl.includes('/signin')) {
    return { status: 'not-logged-in', session: null, weeklyLimits: null, extra: null, scrapedAt: Date.now() }
  }

  try {
    const result = await hiddenWindow.webContents.executeJavaScript(EXTRACT_SCRIPT) as { text: string; url: string }

    // Double-check URL after JS execution (may have redirected)
    if (result.url.includes('/login') || result.url.includes('/signin')) {
      return { status: 'not-logged-in', session: null, weeklyLimits: null, extra: null, scrapedAt: Date.now() }
    }

    const parsed = parseUsageText(result.text)

    // If we got zero fields, the page structure likely changed
    if (!parsed.session && !parsed.weeklyLimits && !parsed.extra) {
      return {
        status: 'parse-error',
        session: null,
        weeklyLimits: null,
        extra: null,
        scrapedAt: Date.now(),
        error: `No fields parsed. Raw text (first 500 chars): ${result.text.slice(0, 500)}`,
      }
    }

    return {
      status: 'ok',
      ...parsed,
      scrapedAt: Date.now(),
    }
  } catch (err) {
    return {
      status: 'parse-error',
      session: null,
      weeklyLimits: null,
      extra: null,
      scrapedAt: Date.now(),
      error: (err as Error).message,
    }
  }
}

// ── Result Handling & Polling ────────────────────────────────────────────────

function handleScrapeResult(data: ClaudeUsageData): void {
  cachedData = data

  if (data.status === 'ok') {
    consecutiveFailures = 0
    currentPollMs = BASE_POLL_MS
  } else if (data.status === 'not-logged-in') {
    // Stop polling — user needs to log in
    stopPolling()
    return
  } else {
    consecutiveFailures++
    if (consecutiveFailures >= BACKOFF_THRESHOLD) {
      currentPollMs = Math.min(currentPollMs * 2, MAX_POLL_MS)
      console.log(`[claude-usage] Backing off to ${currentPollMs / 1000}s after ${consecutiveFailures} failures`)
    }
  }

  scheduleNextPoll()
}

function scheduleNextPoll(): void {
  if (destroyed) return
  stopPolling()
  pollTimer = setTimeout(async () => {
    const result = await scrape()
    handleScrapeResult(result)
  }, currentPollMs)
}

function stopPolling(): void {
  if (pollTimer) {
    clearTimeout(pollTimer)
    pollTimer = null
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

/** Initialize the scraper. Call once at app startup. */
export function initClaudeUsageScraper(): void {
  destroyed = false
  cachedData = { status: 'loading', session: null, weeklyLimits: null, extra: null, scrapedAt: Date.now() }

  // Check if we have cookies — if so, start scraping immediately
  const ses = session.fromPartition(PARTITION)
  ses.cookies.get({ domain: '.claude.ai' }).then((cookies) => {
    if (cookies.length > 0) {
      // We have cookies — try scraping
      scrape().then(handleScrapeResult)
    } else {
      cachedData = { status: 'not-logged-in', session: null, weeklyLimits: null, extra: null, scrapedAt: Date.now() }
    }
  }).catch(() => {
    // Cookie check failed — try scraping anyway
    scrape().then(handleScrapeResult)
  })
}

/** Get the most recent cached usage data. Returns null if scraper not initialized. */
export function getClaudeUsage(): ClaudeUsageData | null {
  return cachedData
}

/** Show a login window to claude.ai for the user to authenticate. Resolves true on successful login. */
export function showClaudeLogin(): Promise<boolean> {
  return new Promise((resolve) => {
    // Don't open multiple login windows
    if (loginWindow && !loginWindow.isDestroyed()) {
      loginWindow.focus()
      resolve(false)
      return
    }

    loginWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      title: 'Sign in to Claude',
      webPreferences: {
        partition: PARTITION,
        nodeIntegration: false,
        contextIsolation: true,
      },
    })

    let loggedIn = false

    loginWindow.webContents.on('did-navigate', (_e, url) => {
      // If URL leaves /login, user has authenticated
      if (!url.includes('/login') && !url.includes('/signin') && url.includes('claude.ai')) {
        loggedIn = true
        loginWindow?.close()
      }
    })

    loginWindow.on('closed', () => {
      loginWindow = null
      if (loggedIn) {
        // Trigger first scrape after login
        scrape().then(handleScrapeResult)
      }
      resolve(loggedIn)
    })

    loginWindow.loadURL(LOGIN_URL)
  })
}

/** Force an immediate scrape, bypassing the poll timer. */
export async function refreshClaudeUsage(): Promise<ClaudeUsageData> {
  const result = await scrape()
  handleScrapeResult(result)
  return result
}

/** Tear down the scraper, close windows, stop polling. */
export function destroyClaudeUsageScraper(): void {
  destroyed = true
  stopPolling()

  if (hiddenWindow && !hiddenWindow.isDestroyed()) {
    hiddenWindow.close()
  }
  hiddenWindow = null

  if (loginWindow && !loginWindow.isDestroyed()) {
    loginWindow.close()
  }
  loginWindow = null

  cachedData = null
}
