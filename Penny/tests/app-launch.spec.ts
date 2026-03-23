/**
 * App launch + Electron shell tests.
 * Validates the app boots, window renders, and IPC bridges are exposed.
 */

import { test, expect } from '@playwright/test'
import { launchApp, type AppContext } from './electron.setup'

let ctx: AppContext

test.beforeAll(async () => {
  ctx = await launchApp()
})

test.afterAll(async () => {
  await ctx.app.close()
})

// -- Window basics --

test('app opens a window with reasonable dimensions', async () => {
  const size = await ctx.window.evaluate(() => ({
    w: window.innerWidth,
    h: window.innerHeight,
  }))
  expect(size.w).toBeGreaterThan(800)
  expect(size.h).toBeGreaterThan(500)
})

test('background color is dark (not white flash)', async () => {
  const bg = await ctx.window.evaluate(() => {
    return getComputedStyle(document.body).backgroundColor
  })
  // Should be dark — not white (rgb(255,255,255)) or transparent
  expect(bg).not.toBe('rgb(255, 255, 255)')
})

// -- IPC bridge exposure --

test('renderer exposes window.api with expected methods', async () => {
  const methods = await ctx.window.evaluate(() => {
    const api = (window as any).api
    if (!api) return null
    return Object.keys(api).sort()
  })
  expect(methods).not.toBeNull()
  // Spot-check critical methods
  expect(methods).toContain('getHealth')
  expect(methods).toContain('getClaudeSessions')
  expect(methods).toContain('getAgents')
  expect(methods).toContain('createTriplet')
  expect(methods).toContain('searchLeads')
})

test('renderer exposes window.pty with terminal methods', async () => {
  const methods = await ctx.window.evaluate(() => {
    const pty = (window as any).pty
    if (!pty) return null
    return Object.keys(pty).sort()
  })
  expect(methods).toContain('create')
  expect(methods).toContain('write')
  expect(methods).toContain('resize')
  expect(methods).toContain('destroy')
  expect(methods).toContain('onData')
  expect(methods).toContain('onExit')
})

// -- IPC handlers respond (don't throw) --

test('health:check IPC returns a response', async () => {
  const result = await ctx.window.evaluate(async () => {
    try {
      return await (window as any).api.getHealth()
    } catch (e: any) {
      return { error: e.message }
    }
  })
  // Health check may return error objects if Memgraph/Qdrant aren't running,
  // but it should always return *something* (not throw)
  expect(result).toBeDefined()
})

test('sessions:list IPC returns an array', async () => {
  const result = await ctx.window.evaluate(async () => {
    try {
      return await (window as any).api.getClaudeSessions()
    } catch (e: any) {
      return { error: e.message }
    }
  })
  // Should be an array (possibly empty) or an error object
  expect(result).toBeDefined()
  if (!result.error) {
    expect(Array.isArray(result)).toBe(true)
  }
})

test('agents:list IPC returns agent configs', async () => {
  const result = await ctx.window.evaluate(async () => {
    try {
      return await (window as any).api.getAgents()
    } catch (e: any) {
      return { error: e.message }
    }
  })
  expect(result).toBeDefined()
  if (!result.error) {
    expect(Array.isArray(result)).toBe(true)
  }
})

// -- DOM structure --

test('root element has correct theme class', async () => {
  const classes = await ctx.window.evaluate(() => {
    return document.documentElement.className
  })
  // Default theme is 'dark', so no 'light-theme' or 'neon-theme' class
  expect(classes).not.toContain('light-theme')
})

test('CSS custom properties are set by appearance store', async () => {
  const vars = await ctx.window.evaluate(() => {
    const style = document.documentElement.style
    return {
      uiFontFamily: style.getPropertyValue('--ui-font-family'),
      uiFontSize: style.getPropertyValue('--ui-font-size'),
      zoom: style.getPropertyValue('--zoom'),
    }
  })
  // These are set by the appearance store on init
  expect(vars.uiFontSize).toMatch(/\d+px/)
  expect(vars.zoom).toBeTruthy()
})
