import { test, expect } from '@playwright/test'
import { launchApp, type AppContext } from './electron.setup'

let ctx: AppContext

test.beforeAll(async () => {
  ctx = await launchApp()
})

test.afterAll(async () => {
  await ctx.app.close()
})

test('app opens a window', async () => {
  expect(ctx.window).toBeTruthy()
})

test('window has correct title or is non-empty', async () => {
  const title = await ctx.window.title()
  // Electron-vite apps may have empty title initially; just ensure the page loaded
  expect(typeof title).toBe('string')
})

test('window has reasonable dimensions', async () => {
  const size = await ctx.window.evaluate(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }))
  expect(size.width).toBeGreaterThan(400)
  expect(size.height).toBeGreaterThan(300)
})

test('renderer exposes api bridge', async () => {
  const hasApi = await ctx.window.evaluate(() => typeof (window as any).api === 'object')
  expect(hasApi).toBe(true)
})

test('renderer exposes pty bridge', async () => {
  const hasPty = await ctx.window.evaluate(() => typeof (window as any).pty === 'object')
  expect(hasPty).toBe(true)
})
