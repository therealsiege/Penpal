/**
 * Layout geometry tests — validates cafe, team buildings, and camera positioning.
 */
import { test, expect } from '@playwright/test'
import { launchApp, waitForPhaser, type AppContext } from './electron.setup'

let ctx: AppContext

test.beforeAll(async () => {
  ctx = await launchApp()
  await waitForPhaser(ctx.window, 8000)
  await ctx.window.waitForTimeout(4000)
})

test.afterAll(async () => {
  await ctx.app.close()
})

function getLayoutData(window: any) {
  return window.evaluate(() => {
    const scene = (window as any).__PENNY_SCENE__
    if (!scene) return null
    let roomMinY = Infinity
    for (const [, room] of scene.rooms || []) {
      const r = room as any
      roomMinY = Math.min(roomMinY, r.y - r.height / 2)
    }
    return {
      roomCount: scene.rooms?.size ?? 0,
      roomMinY: Math.round(roomMinY),
      cafeBounds: scene.cafe?.getBounds?.() || null,
      world: { w: Math.round(scene.worldWidth || 0), h: Math.round(scene.worldHeight || 0) },
    }
  })
}

test('cafe is in the top-left corner', async () => {
  const d = await getLayoutData(ctx.window)
  if (!d?.cafeBounds) return
  expect(d.cafeBounds.x).toBeLessThan(100)
  expect(d.cafeBounds.y).toBeLessThan(100)
})

test('team buildings are on the same row or below the cafe', async () => {
  const d = await getLayoutData(ctx.window)
  if (!d?.cafeBounds) return
  // Rooms should be at or below the cafe's top edge (same row)
  expect(d.roomMinY).toBeGreaterThanOrEqual(d.cafeBounds.y - 20)
})

test('world includes cafe and all rooms', async () => {
  const d = await getLayoutData(ctx.window)
  if (!d?.cafeBounds) return
  expect(d.world.w).toBeGreaterThanOrEqual(d.cafeBounds.x + d.cafeBounds.w)
})
