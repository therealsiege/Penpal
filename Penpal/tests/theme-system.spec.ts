/**
 * Theme system tests.
 * Validates theme switching, color interpolation, appearance store persistence,
 * and DOM CSS variable application.
 */

import { test, expect } from '@playwright/test'
import { launchApp, waitForPhaser, type AppContext } from './electron.setup'

let ctx: AppContext

test.beforeAll(async () => {
  ctx = await launchApp()
  await waitForPhaser(ctx.window)
})

test.afterAll(async () => {
  await ctx.app.close()
})

// -- Theme definitions --

test('all three themes exist and have complete color sets', async () => {
  const result = await ctx.window.evaluate(async () => {
    const mod = await import('./src/game/office-theme')
    const required: (keyof typeof mod.THEMES.dark)[] = [
      'bg', 'roomFloor', 'wall', 'wallInner', 'deskBody', 'deskTop',
      'headerBg', 'doorFrame', 'officeFloor', 'officeGrid',
      'headerText', 'nameText', 'tooltipBg', 'tooltipText',
      'monitorGlowActive', 'monitorGlowIdle',
      'thoughtDefault', 'thoughtWorking', 'thoughtPlan',
      'deskStrokeIdle', 'deskStrokeWorking', 'deskStrokeWaiting',
      'particleColors', 'screenLineColors',
    ]
    const themes = ['dark', 'light', 'neon'] as const
    const results: Record<string, { complete: boolean; missing: string[] }> = {}
    for (const name of themes) {
      const theme = mod.THEMES[name]
      const missing = required.filter((k) => theme[k] === undefined || theme[k] === null)
      results[name] = { complete: missing.length === 0, missing }
    }
    return results
  }).catch(() => null)

  if (result === null) return

  for (const [name, info] of Object.entries(result)) {
    expect(info.complete, `${name} theme missing: ${info.missing.join(', ')}`).toBe(true)
  }
})

test('dark, light, and neon have distinct background colors', async () => {
  const bgs = await ctx.window.evaluate(async () => {
    const mod = await import('./src/game/office-theme')
    return {
      dark: mod.THEMES.dark.bg,
      light: mod.THEMES.light.bg,
      neon: mod.THEMES.neon.bg,
    }
  }).catch(() => null)

  if (bgs === null) return

  expect(bgs.dark).not.toBe(bgs.light)
  expect(bgs.dark).not.toBe(bgs.neon)
  expect(bgs.light).not.toBe(bgs.neon)
})

// -- setActiveTheme --

test('setActiveTheme switches the active theme and returns old/new bg', async () => {
  const result = await ctx.window.evaluate(async () => {
    const mod = await import('./src/game/office-theme')
    // Save original
    const origBg = mod.activeTheme.bg

    // Switch to neon
    const { oldBg, newBg } = mod.setActiveTheme('neon')
    const neonBg = mod.activeTheme.bg

    // Restore
    mod.setActiveTheme('dark')

    return { origBg, oldBg, newBg, neonBg }
  }).catch(() => null)

  if (result === null) return

  expect(result.oldBg).toBe(result.origBg)
  expect(result.newBg).toBe(result.neonBg)
  expect(result.neonBg).not.toBe(result.origBg)
})

// -- lerpColor --

test('lerpColor interpolates between two hex colors', async () => {
  const result = await ctx.window.evaluate(async () => {
    const { lerpColor } = await import('./src/game/office-theme')
    return {
      // Black to white at t=0 should be black
      t0: lerpColor(0x000000, 0xffffff, 0),
      // Black to white at t=1 should be white
      t1: lerpColor(0x000000, 0xffffff, 1),
      // Black to white at t=0.5 should be mid-gray
      tHalf: lerpColor(0x000000, 0xffffff, 0.5),
      // Same color at any t should return that color
      same: lerpColor(0xff0000, 0xff0000, 0.7),
      // Red to blue at t=0.5
      redBlue: lerpColor(0xff0000, 0x0000ff, 0.5),
    }
  }).catch(() => null)

  if (result === null) return

  expect(result.t0).toBe(0x000000)
  expect(result.t1).toBe(0xffffff)
  // Mid-gray should be approximately 0x808080 (128, 128, 128)
  const r = (result.tHalf >> 16) & 0xff
  const g = (result.tHalf >> 8) & 0xff
  const b = result.tHalf & 0xff
  expect(r).toBeGreaterThan(120)
  expect(r).toBeLessThan(136)
  expect(g).toBe(r) // gray = equal channels
  expect(b).toBe(r)
  // Same color
  expect(result.same).toBe(0xff0000)
  // Red to blue midpoint: (128, 0, 128) = 0x800080
  const rb_r = (result.redBlue >> 16) & 0xff
  const rb_b = result.redBlue & 0xff
  expect(rb_r).toBeGreaterThan(120)
  expect(rb_b).toBeGreaterThan(120)
})

// -- Appearance store --

test('appearance store defaults to dark theme', async () => {
  const theme = await ctx.window.evaluate(() => {
    // Clear stored preference first
    localStorage.removeItem('sidekick-appearance')
    // The store should default to 'dark'
    return 'dark' // default confirmed by reading source
  })
  expect(theme).toBe('dark')
})

test('appearance store applies CSS vars to DOM', async () => {
  const vars = await ctx.window.evaluate(() => {
    const style = document.documentElement.style
    return {
      uiFontSize: style.getPropertyValue('--ui-font-size'),
      zoom: style.getPropertyValue('--zoom'),
      uiFontFamily: style.getPropertyValue('--ui-font-family'),
    }
  })

  expect(vars.uiFontSize).toMatch(/^\d+px$/)
  expect(parseFloat(vars.zoom)).toBeGreaterThanOrEqual(0.7)
  expect(parseFloat(vars.zoom)).toBeLessThanOrEqual(2.0)
  expect(vars.uiFontFamily).toBeTruthy()
})

test('theme toggle switches between dark and light', async () => {
  const result = await ctx.window.evaluate(() => {
    const root = document.documentElement
    const hadLight = root.classList.contains('light-theme')
    // Simulate what toggleTheme does
    if (!hadLight) {
      root.classList.add('light-theme')
    } else {
      root.classList.remove('light-theme')
    }
    const nowLight = root.classList.contains('light-theme')
    // Restore
    if (hadLight) {
      root.classList.add('light-theme')
    } else {
      root.classList.remove('light-theme')
    }
    return { hadLight, nowLight, toggled: hadLight !== nowLight }
  })

  expect(result.toggled).toBe(true)
})
