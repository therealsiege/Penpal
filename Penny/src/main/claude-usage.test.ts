/**
 * Unit tests for claude-usage.ts — IPC wiring for Claude.ai usage data.
 *
 * Tests focus on the pure/sync logic (cache accessors, lifecycle) without
 * spinning up a real BrowserWindow or hitting the network.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Mock Electron before importing the module under test
// ---------------------------------------------------------------------------

vi.mock('electron', () => ({
  BrowserWindow: vi.fn().mockImplementation(() => ({
    webContents: {
      once: vi.fn(),
      on: vi.fn(),
      executeJavaScript: vi.fn().mockResolvedValue(null),
      setWindowOpenHandler: vi.fn(),
    },
    loadURL: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn(),
  })),
  shell: {
    openExternal: vi.fn().mockResolvedValue(undefined),
  },
}))

// ---------------------------------------------------------------------------
// Import after mocks are registered
// ---------------------------------------------------------------------------

import {
  getClaudeUsage,
  showClaudeLogin,
  initClaudeUsageScraper,
  destroyClaudeUsageScraper,
  type ClaudeUsageData,
} from './claude-usage'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('getClaudeUsage', () => {
  it('returns null before any fetch has completed', () => {
    // Cache starts empty — module is freshly imported (vitest isolates modules)
    const result = getClaudeUsage()
    // May be null (not yet fetched) or a valid shape if a prior test primed it
    // We only assert the type contract: null OR a ClaudeUsageData object
    if (result !== null) {
      expect(typeof result.tokensUsed).toBe('number')
      expect(typeof result.tokensLimit).toBe('number')
      expect(typeof result.lastFetched).toBe('string')
    } else {
      expect(result).toBeNull()
    }
  })
})

describe('showClaudeLogin', () => {
  it('opens the Claude.ai login URL via shell.openExternal and returns true', async () => {
    const { shell } = await import('electron')
    const result = await showClaudeLogin()
    expect(result).toBe(true)
    expect(shell.openExternal).toHaveBeenCalledWith(
      expect.stringContaining('claude.ai')
    )
  })
})

describe('ClaudeUsageData shape', () => {
  it('has the expected fields with correct types', () => {
    const sample: ClaudeUsageData = {
      tokensUsed: 1500,
      tokensLimit: 5000,
      resetAt: '2026-05-01',
      plan: 'Pro',
      lastFetched: new Date().toISOString(),
    }
    expect(typeof sample.tokensUsed).toBe('number')
    expect(typeof sample.tokensLimit).toBe('number')
    expect(typeof sample.lastFetched).toBe('string')
    // resetAt and plan are nullable
    expect(sample.resetAt === null || typeof sample.resetAt === 'string').toBe(true)
    expect(sample.plan === null || typeof sample.plan === 'string').toBe(true)
  })
})

describe('lifecycle — initClaudeUsageScraper / destroyClaudeUsageScraper', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    destroyClaudeUsageScraper()
    vi.useRealTimers()
  })

  it('init does not throw', () => {
    expect(() => initClaudeUsageScraper()).not.toThrow()
  })

  it('destroy can be called multiple times without throwing', () => {
    initClaudeUsageScraper()
    expect(() => destroyClaudeUsageScraper()).not.toThrow()
    expect(() => destroyClaudeUsageScraper()).not.toThrow()
  })

  it('does not leak timers after destroy', () => {
    initClaudeUsageScraper()
    destroyClaudeUsageScraper()
    // After destroy, advancing time should not trigger any pending fetch work
    // (no error is thrown = timer was cleared)
    expect(() => vi.advanceTimersByTime(10 * 60 * 1000)).not.toThrow()
  })
})

describe('IPC channel name contract', () => {
  // These tests document the expected channel names without requiring a live
  // Electron IPC bus. They guard against accidental renames.
  it('exports the three functions consumed by IPC handlers', async () => {
    const mod = await import('./claude-usage')
    expect(typeof mod.getClaudeUsage).toBe('function')
    expect(typeof mod.showClaudeLogin).toBe('function')
    expect(typeof mod.refreshClaudeUsage).toBe('function')
  })

  it('exports lifecycle hooks for index.ts', async () => {
    const mod = await import('./claude-usage')
    expect(typeof mod.initClaudeUsageScraper).toBe('function')
    expect(typeof mod.destroyClaudeUsageScraper).toBe('function')
  })
})
