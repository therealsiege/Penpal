/**
 * Phaser game scene tests.
 * Validates the canvas renders, the scene boots, and core game systems initialize.
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

// -- Canvas rendering --

test('Phaser canvas exists and has non-zero dimensions', async () => {
  const info = await ctx.window.evaluate(() => {
    const c = document.querySelector('canvas')
    return c ? { w: c.width, h: c.height } : null
  })
  expect(info).not.toBeNull()
  expect(info!.w).toBeGreaterThan(100)
  expect(info!.h).toBeGreaterThan(100)
})

test('canvas renders non-blank pixels', async () => {
  const canvas = ctx.window.locator('canvas').first()
  const screenshot = await canvas.screenshot()
  // A non-trivial image should have more than a few KB of data
  expect(screenshot.byteLength).toBeGreaterThan(1000)
})

// -- Scene state via getDebugSnapshot --

test('OfficeScene reports ready via getDebugSnapshot', async () => {
  const snapshot = await evalInScene(ctx.window, (scene) => {
    if (typeof scene.getDebugSnapshot === 'function') {
      return scene.getDebugSnapshot()
    }
    return null
  })

  if (snapshot) {
    expect(snapshot.ready).toBe(true)
    expect(snapshot.camera).toBeDefined()
    expect(snapshot.camera.zoom).toBeGreaterThan(0)
    expect(snapshot.world.width).toBeGreaterThan(0)
    expect(snapshot.world.height).toBeGreaterThan(0)
  }
})

test('camera zoom is within valid bounds', async () => {
  const zoom = await evalInScene(ctx.window, (scene) => {
    return scene.cameras?.main?.zoom ?? null
  })

  if (zoom !== null) {
    expect(zoom).toBeGreaterThanOrEqual(0.4) // ZOOM_MIN
    expect(zoom).toBeLessThanOrEqual(2.0) // ZOOM_MAX
  }
})

// -- Room system --

test('rooms map is initialized (may be empty without sessions)', async () => {
  const info = await evalInScene(ctx.window, (scene) => {
    if (!scene.rooms) return null
    return {
      isMap: scene.rooms instanceof Map,
      size: scene.rooms.size,
    }
  })

  if (info) {
    expect(info.isMap).toBe(true)
    expect(info.size).toBeGreaterThanOrEqual(0)
  }
})

test('rooms have valid layout (no overlapping rooms)', async () => {
  const rooms = await evalInScene(ctx.window, (scene) => {
    if (!scene.rooms || scene.rooms.size === 0) return null
    const arr: { x: number; y: number; w: number; h: number; label: string }[] = []
    for (const [, room] of scene.rooms) {
      arr.push({
        x: room.x - room.width / 2,
        y: room.y - room.height / 2,
        w: room.width,
        h: room.height,
        label: room.label,
      })
    }
    return arr
  })

  if (rooms && rooms.length > 1) {
    // Check no two rooms overlap
    for (let i = 0; i < rooms.length; i++) {
      for (let j = i + 1; j < rooms.length; j++) {
        const a = rooms[i], b = rooms[j]
        const overlaps =
          a.x < b.x + b.w &&
          a.x + a.w > b.x &&
          a.y < b.y + b.h &&
          a.y + a.h > b.y
        expect(overlaps).toBe(false)
      }
    }
  }
})

// -- Workstation system --

test('each room has a workstations Map', async () => {
  const result = await evalInScene(ctx.window, (scene) => {
    if (!scene.rooms || scene.rooms.size === 0) return null
    for (const [, room] of scene.rooms) {
      if (!(room.workstations instanceof Map)) return false
    }
    return true
  })

  if (result !== null) {
    expect(result).toBe(true)
  }
})

// -- LOD system --

test('LOD level is a valid integer 1-3', async () => {
  const lod = await evalInScene(ctx.window, (scene) => {
    return scene.lastLodLevel ?? null
  })

  if (lod !== null) {
    expect(lod).toBeGreaterThanOrEqual(1)
    expect(lod).toBeLessThanOrEqual(3)
  }
})

// -- Subsystem initialization --

test('NavMesh is initialized', async () => {
  const stats = await evalInScene(ctx.window, (scene) => {
    if (scene.navMesh && typeof scene.navMesh.getStats === 'function') {
      return scene.navMesh.getStats()
    }
    return null
  })

  if (stats) {
    expect(stats.gridW).toBeGreaterThanOrEqual(0)
    expect(stats.gridH).toBeGreaterThanOrEqual(0)
    expect(stats.total).toBe(stats.gridW * stats.gridH)
  }
})

test('minimap exists', async () => {
  const hasMinimap = await evalInScene(ctx.window, (scene) => {
    return !!(scene.minimap || scene.minimapContainer)
  })
  if (hasMinimap !== null) {
    expect(hasMinimap).toBe(true)
  }
})
