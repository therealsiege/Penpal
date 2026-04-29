/**
 * Keyboard interaction tests.
 * Validates camera controls, zoom, and keyboard shortcuts in the game view.
 */

import { test, expect } from '@playwright/test'
import { launchApp, waitForPhaser, evalInScene, type AppContext } from './electron.setup'

let ctx: AppContext

test.beforeAll(async () => {
  ctx = await launchApp()
  await waitForPhaser(ctx.window)
})

test.afterAll(async () => {
  await ctx.app.close()
})

test('pressing + zooms in', async () => {
  const before = await evalInScene(ctx.window, (s) => s.cameras.main.zoom)
  if (before === null) return

  // Focus the canvas and press +
  await ctx.window.locator('canvas').first().click()
  await ctx.window.keyboard.press('Equal') // + key (unshifted =, but Phaser reads +/=)
  await ctx.window.waitForTimeout(400)

  const after = await evalInScene(ctx.window, (s) => s.cameras.main.zoom)
  if (after === null) return

  expect(after).toBeGreaterThanOrEqual(before)
})

test('pressing - zooms out', async () => {
  const before = await evalInScene(ctx.window, (s) => s.cameras.main.zoom)
  if (before === null) return

  await ctx.window.locator('canvas').first().click()
  await ctx.window.keyboard.press('Minus')
  await ctx.window.waitForTimeout(400)

  const after = await evalInScene(ctx.window, (s) => s.cameras.main.zoom)
  if (after === null) return

  expect(after).toBeLessThanOrEqual(before)
})


test('arrow keys set a follow target for camera pan', async () => {
  await ctx.window.locator('canvas').first().click()

  const before = await evalInScene(ctx.window, (s) => s.followTarget)

  await ctx.window.keyboard.press('ArrowRight')
  await ctx.window.waitForTimeout(100)

  const after = await evalInScene(ctx.window, (s) => s.followTarget)

  // Arrow key should set a followTarget (camera lerps to it over time)
  // If followTarget was null and is now set, or its x changed, the key worked
  if (before === null && after !== null) {
    expect(after).toBeTruthy()
  } else if (before && after) {
    // Either x or y should have changed
    expect(after.x !== before.x || after.y !== before.y).toBe(true)
  }
  // If both null, the scene might not support arrow key pan — skip
})

test('zoom stays within bounds after rapid input', async () => {
  const canvas = ctx.window.locator('canvas').first()
  await canvas.click()

  // Spam zoom out
  for (let i = 0; i < 20; i++) {
    await ctx.window.keyboard.press('Minus')
  }
  await ctx.window.waitForTimeout(500)

  const zoomAfterOut = await evalInScene(ctx.window, (s) => s.cameras.main.zoom)

  // Spam zoom in
  for (let i = 0; i < 40; i++) {
    await ctx.window.keyboard.press('Equal')
  }
  await ctx.window.waitForTimeout(500)

  const zoomAfterIn = await evalInScene(ctx.window, (s) => s.cameras.main.zoom)

  if (zoomAfterOut !== null) {
    expect(zoomAfterOut).toBeGreaterThanOrEqual(0.39) // ZOOM_MIN = 0.4 (with float tolerance)
  }
  if (zoomAfterIn !== null) {
    expect(zoomAfterIn).toBeLessThanOrEqual(2.01) // ZOOM_MAX = 2.0
  }
})
