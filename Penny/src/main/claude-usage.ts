/**
 * Claude.ai usage scraper — reads usage data from the Claude.ai web session.
 * Exposes init/destroy lifecycle hooks and three IPC-facing functions:
 *   - getClaudeUsage()    — returns cached usage data (or null if not yet fetched)
 *   - showClaudeLogin()   — opens the Claude.ai login page in a BrowserWindow
 *   - refreshClaudeUsage() — forces a fresh fetch and returns updated data
 */

import { BrowserWindow, shell } from 'electron'

export interface ClaudeUsageData {
  tokensUsed: number
  tokensLimit: number
  resetAt: string | null
  plan: string | null
  lastFetched: string
}

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

let _cache: ClaudeUsageData | null = null
let _refreshTimer: NodeJS.Timeout | null = null

const REFRESH_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes
const CLAUDE_USAGE_URL = 'https://claude.ai/settings/limits'
const CLAUDE_LOGIN_URL = 'https://claude.ai/login'

// ---------------------------------------------------------------------------
// Core fetch logic
// ---------------------------------------------------------------------------

/**
 * Attempt to read usage data from the claude.ai session cookies / local storage
 * by loading the settings page in a hidden BrowserWindow and extracting the DOM.
 *
 * Returns null when the user is not logged in or data cannot be parsed.
 */
async function fetchClaudeUsage(): Promise<ClaudeUsageData | null> {
  return new Promise((resolve) => {
    const win = new BrowserWindow({
      width: 1024,
      height: 768,
      show: false,
      webPreferences: {
        sandbox: true,
        nodeIntegration: false,
        contextIsolation: true,
      },
    })

    const timeout = setTimeout(() => {
      win.destroy()
      resolve(null)
    }, 15_000)

    win.webContents.once('did-finish-load', async () => {
      try {
        const result = await win.webContents.executeJavaScript(`
          (function() {
            try {
              // Try to find usage data in the rendered page
              const limitEls = document.querySelectorAll('[data-testid="usage-limit"], .usage-limit, [class*="usageLimit"]');
              const usedEls  = document.querySelectorAll('[data-testid="usage-used"],  .usage-used,  [class*="usageUsed"]');

              // Fallback: look for any text that mentions "messages" or "tokens"
              const bodyText = document.body?.innerText || '';

              // Simple heuristic: look for numbers near "of" patterns like "45 of 100"
              const match = bodyText.match(/(\\d[\\d,]*)\\s+(?:of|\\/)\\s+(\\d[\\d,]*)/);
              const used  = match ? parseInt(match[1].replace(/,/g, ''), 10) : 0;
              const limit = match ? parseInt(match[2].replace(/,/g, ''), 10) : 0;

              // Try to find reset date
              const resetMatch = bodyText.match(/resets?\\s+(?:on\\s+)?([A-Z][a-z]+ \\d+|\\d{1,2}\\/\\d{1,2})/i);
              const resetAt = resetMatch ? resetMatch[1] : null;

              // Plan detection
              const planMatch = bodyText.match(/\\b(Pro|Free|Max|Team|Enterprise)\\b/i);
              const plan = planMatch ? planMatch[1] : null;

              return { tokensUsed: used, tokensLimit: limit, resetAt, plan };
            } catch (e) {
              return null;
            }
          })()
        `)

        clearTimeout(timeout)
        win.destroy()

        if (result && typeof result === 'object' && 'tokensLimit' in result) {
          const data: ClaudeUsageData = {
            tokensUsed: result.tokensUsed ?? 0,
            tokensLimit: result.tokensLimit ?? 0,
            resetAt: result.resetAt ?? null,
            plan: result.plan ?? null,
            lastFetched: new Date().toISOString(),
          }
          _cache = data
          resolve(data)
        } else {
          resolve(null)
        }
      } catch {
        clearTimeout(timeout)
        win.destroy()
        resolve(null)
      }
    })

    win.webContents.on('did-fail-load', () => {
      clearTimeout(timeout)
      win.destroy()
      resolve(null)
    })

    win.loadURL(CLAUDE_USAGE_URL).catch(() => {
      clearTimeout(timeout)
      win.destroy()
      resolve(null)
    })
  })
}

// ---------------------------------------------------------------------------
// Public API (called by IPC handlers)
// ---------------------------------------------------------------------------

/** Return cached usage data without triggering a network request. */
export function getClaudeUsage(): ClaudeUsageData | null {
  return _cache
}

/** Open the Claude.ai login page in the user's default browser. */
export async function showClaudeLogin(): Promise<boolean> {
  await shell.openExternal(CLAUDE_LOGIN_URL)
  return true
}

/** Force a fresh fetch and return the updated data (or null on failure). */
export async function refreshClaudeUsage(): Promise<ClaudeUsageData | null> {
  const result = await fetchClaudeUsage()
  return result
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

/** Start the background refresh timer. Call once from app.whenReady(). */
export function initClaudeUsageScraper(): void {
  // Kick off an initial fetch shortly after startup (non-blocking)
  setTimeout(() => {
    fetchClaudeUsage().catch(() => {/* ignore — user may not be logged in */})
  }, 5_000)

  _refreshTimer = setInterval(() => {
    fetchClaudeUsage().catch(() => {/* ignore */})
  }, REFRESH_INTERVAL_MS)
}

/** Stop the background refresh timer. Call from before-quit. */
export function destroyClaudeUsageScraper(): void {
  if (_refreshTimer) {
    clearInterval(_refreshTimer)
    _refreshTimer = null
  }
}
