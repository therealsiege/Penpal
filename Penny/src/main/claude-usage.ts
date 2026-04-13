// Stub module for Claude.ai usage scraping (see #162 for full implementation)
// Exports the interface expected by IPC handlers in ipc.ts and index.ts

export interface ClaudeUsageData {
  plan: string
  usagePercent: number
  usedTokens: number
  totalTokens: number
  resetDate: string | null
  scrapedAt: number
}

export function initClaudeUsageScraper(): void {
  // #162 will implement: BrowserWindow-based scraper with session cookie auth
}

export function destroyClaudeUsageScraper(): void {
  // #162 will implement: cleanup scraper window
}

export async function getClaudeUsage(): Promise<ClaudeUsageData | null> {
  // #162 will implement: return cached usage data
  return null
}

export async function showClaudeLogin(): Promise<boolean> {
  // #162 will implement: show login window for cookie acquisition
  return false
}

export async function refreshClaudeUsage(): Promise<ClaudeUsageData | null> {
  // #162 will implement: force re-scrape
  return null
}
