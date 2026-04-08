import { BrowserWindow, session } from 'electron'

// ── Types ─────────────────────────────────────────────────────────────────────

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

// ── Constants ─────────────────────────────────────────────────────────────────

const CLAUDE_USAGE_URL = 'https://claude.ai/settings/limits'
const PARTITION = 'persist:claude-ai'
const POLL_INTERVAL_MS = 2.5 * 60 * 1000 // 2.5 minutes
const MAX_BACKOFF_MS = 10 * 60 * 1000 // 10 minutes
const FAILURE_THRESHOLD = 3

// ── Module state ──────────────────────────────────────────────────────────────

let hiddenWindow: BrowserWindow | null = null
let loginWindow: BrowserWindow | null = null
let cachedUsage: ClaudeUsageData | null = null
let pollTimer: ReturnType<typeof setInterval> | null = null
let consecutiveFailures = 0
let currentIntervalMs = POLL_INTERVAL_MS
let pendingScrapeResolvers: Array<(data: ClaudeUsageData) => void> = []

// ── DOM Extraction (runs in renderer context) ─────────────────────────────────

/**
 * Pure function: extract usage data from visible page text.
 * Exported for unit testing.
 */
export function extractFromText(text: string): {
  session: { percentUsed: number; resetLabel: string } | null
  weeklyLimits: {
    allModels: { percentUsed: number; resetLabel: string }
    sonnetOnly: { percentUsed: number; resetLabel: string }
  } | null
  extra: { dollarsSpent: number; monthlyLimit: number; balance: number } | null
} {
  // Match percent values with optional context labels
  // Patterns like "42% used", "42% of limit used"
  const percentMatches = [...text.matchAll(/(\d+)%\s*(?:of\s+\w+\s+)?used/gi)]

  // Match reset labels: "Resets in 2 hours", "Resets in 3 days"
  const resetMatches = [...text.matchAll(/Resets?\s+in\s+([^\n,]+)/gi)]

  // Match dollar amounts: "$12.50 spent", "$50.00 Monthly", "$37.50 remaining"
  const spentMatch = text.match(/\$([\d.]+)\s+spent/i)
  const monthlyMatch = text.match(/\$([\d.]+)\s*(?:monthly|\/mo|limit)/i)
  const balanceMatch = text.match(/\$([\d.]+)\s*(?:remaining|balance|left)/i)

  const hasUsageData = percentMatches.length > 0 || spentMatch !== null

  if (!hasUsageData) {
    return { session: null, weeklyLimits: null, extra: null }
  }

  // Parse session usage (first percent match, typically "Current session")
  let sessionData: { percentUsed: number; resetLabel: string } | null = null
  if (percentMatches.length > 0) {
    sessionData = {
      percentUsed: parseInt(percentMatches[0][1], 10),
      resetLabel: resetMatches[0]?.[1]?.trim() ?? '',
    }
  }

  // Parse weekly limits (second = all models, third = sonnet only)
  let weeklyLimits: ClaudeUsageData['weeklyLimits'] = null
  if (percentMatches.length >= 2) {
    weeklyLimits = {
      allModels: {
        percentUsed: parseInt(percentMatches[1][1], 10),
        resetLabel: resetMatches[1]?.[1]?.trim() ?? '',
      },
      sonnetOnly: {
        percentUsed: percentMatches.length >= 3 ? parseInt(percentMatches[2][1], 10) : 0,
        resetLabel: resetMatches[2]?.[1]?.trim() ?? '',
      },
    }
  }

  // Parse extra usage (dollar amounts)
  let extra: ClaudeUsageData['extra'] = null
  if (spentMatch || monthlyMatch || balanceMatch) {
    const dollarsSpent = spentMatch ? parseFloat(spentMatch[1]) : 0
    const monthlyLimit = monthlyMatch ? parseFloat(monthlyMatch[1]) : 0
    const balance = balanceMatch
      ? parseFloat(balanceMatch[1])
      : monthlyLimit > 0
        ? monthlyLimit - dollarsSpent
        : 0
    extra = { dollarsSpent, monthlyLimit, balance }
  }

  return { session: sessionData, weeklyLimits, extra }
}

// ── Hidden window scraper ─────────────────────────────────────────────────────

function getOrCreateHiddenWindow(): BrowserWindow {
  if (hiddenWindow && !hiddenWindow.isDestroyed()) return hiddenWindow

  const ses = session.fromPartition(PARTITION)

  hiddenWindow = new BrowserWindow({
    show: false,
    width: 1200,
    height: 800,
    webPreferences: {
      session: ses,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  hiddenWindow.webContents.on('did-finish-load', () => {
    void runScrape()
  })

  hiddenWindow.webContents.on('did-fail-load', (_event, _errorCode, errorDescription, validatedURL) => {
    console.warn('[claude-usage] did-fail-load', validatedURL, errorDescription)
    onScrapeResult({
      status: 'network-error',
      session: null,
      weeklyLimits: null,
      extra: null,
      scrapedAt: Date.now(),
      error: errorDescription,
    })
  })

  hiddenWindow.webContents.on('did-navigate', (_event, url) => {
    if (url.includes('/login') || url.includes('/auth')) {
      console.log('[claude-usage] redirected to login, not logged in')
      onScrapeResult({
        status: 'not-logged-in',
        session: null,
        weeklyLimits: null,
        extra: null,
        scrapedAt: Date.now(),
      })
      stopPolling()
    }
  })

  hiddenWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('[claude-usage] render process gone', details)
    hiddenWindow = null
  })

  hiddenWindow.on('closed', () => {
    hiddenWindow = null
  })

  return hiddenWindow
}

async function runScrape(): Promise<void> {
  const win = hiddenWindow
  if (!win || win.isDestroyed()) return

  try {
    const text: string = await win.webContents.executeJavaScript(
      `document.body ? document.body.innerText : ''`
    )

    const currentUrl: string = await win.webContents.executeJavaScript(
      `window.location.href`
    )

    if (currentUrl.includes('/login') || currentUrl.includes('/auth')) {
      onScrapeResult({
        status: 'not-logged-in',
        session: null,
        weeklyLimits: null,
        extra: null,
        scrapedAt: Date.now(),
      })
      stopPolling()
      return
    }

    const parsed = extractFromText(text)
    const hasData = parsed.session !== null || parsed.weeklyLimits !== null || parsed.extra !== null

    if (!hasData) {
      onScrapeResult({
        status: 'parse-error',
        session: null,
        weeklyLimits: null,
        extra: null,
        scrapedAt: Date.now(),
        error: 'No usage data found in page text',
      })
    } else {
      onScrapeResult({
        status: 'ok',
        ...parsed,
        scrapedAt: Date.now(),
      })
    }
  } catch (err) {
    console.error('[claude-usage] scrape error', err)
    onScrapeResult({
      status: 'parse-error',
      session: null,
      weeklyLimits: null,
      extra: null,
      scrapedAt: Date.now(),
      error: (err as Error).message,
    })
  }
}

function onScrapeResult(data: ClaudeUsageData) {
  cachedUsage = data

  // Adaptive backoff
  if (data.status === 'ok') {
    consecutiveFailures = 0
    currentIntervalMs = POLL_INTERVAL_MS
  } else if (data.status !== 'not-logged-in') {
    consecutiveFailures++
    if (consecutiveFailures >= FAILURE_THRESHOLD) {
      currentIntervalMs = Math.min(currentIntervalMs * 2, MAX_BACKOFF_MS)
      console.log(`[claude-usage] backing off to ${currentIntervalMs / 1000}s interval`)
    }
  }

  // Resolve any pending refresh callers
  const resolvers = pendingScrapeResolvers.splice(0)
  for (const resolve of resolvers) {
    resolve(data)
  }
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

function triggerLoad() {
  try {
    const win = getOrCreateHiddenWindow()
    win.webContents.loadURL(CLAUDE_USAGE_URL).catch((err) => {
      console.error('[claude-usage] loadURL error', err)
    })
  } catch (err) {
    console.error('[claude-usage] triggerLoad error', err)
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export function initClaudeUsageScraper() {
  // Set initial loading state
  cachedUsage = {
    status: 'loading',
    session: null,
    weeklyLimits: null,
    extra: null,
    scrapedAt: Date.now(),
  }

  triggerLoad()

  pollTimer = setInterval(() => {
    triggerLoad()
  }, currentIntervalMs)
}

export function getClaudeUsage(): ClaudeUsageData | null {
  return cachedUsage
}

export function refreshClaudeUsage(): Promise<ClaudeUsageData> {
  return new Promise<ClaudeUsageData>((resolve) => {
    pendingScrapeResolvers.push(resolve)
    triggerLoad()
  })
}

export function showClaudeLogin(): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    if (loginWindow && !loginWindow.isDestroyed()) {
      loginWindow.focus()
      resolve(false)
      return
    }

    const ses = session.fromPartition(PARTITION)

    loginWindow = new BrowserWindow({
      show: true,
      width: 1000,
      height: 700,
      title: 'Sign in to Claude.ai',
      webPreferences: {
        session: ses,
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
      },
    })

    loginWindow.loadURL('https://claude.ai/login').catch(console.error)

    loginWindow.webContents.on('did-navigate', (_event, url) => {
      if (!url.includes('/login') && !url.includes('/auth')) {
        // Successfully navigated away from login
        loginWindow?.close()
        loginWindow = null
        // Restart polling and trigger immediate scrape
        if (!pollTimer) {
          pollTimer = setInterval(() => {
            triggerLoad()
          }, POLL_INTERVAL_MS)
        }
        triggerLoad()
        resolve(true)
      }
    })

    loginWindow.on('closed', () => {
      loginWindow = null
      resolve(false)
    })
  })
}

export function destroyClaudeUsageScraper() {
  stopPolling()

  if (hiddenWindow && !hiddenWindow.isDestroyed()) {
    hiddenWindow.destroy()
    hiddenWindow = null
  }

  if (loginWindow && !loginWindow.isDestroyed()) {
    loginWindow.destroy()
    loginWindow = null
  }

  pendingScrapeResolvers = []
}
