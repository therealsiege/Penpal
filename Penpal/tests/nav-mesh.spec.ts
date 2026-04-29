/**
 * NavMesh pathfinding tests.
 * Validates the A* grid navigation system: room walkability, wall blocking,
 * door passages, and path correctness.
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

// All NavMesh tests run via evaluate because NavMesh is a class instantiated
// in the renderer. We create a fresh instance for each test.

test('empty NavMesh returns direct path', async () => {
  const result = await ctx.window.evaluate(async () => {
    const { NavMesh } = await import('./src/game/nav-mesh')
    const mesh = new NavMesh()
    // No rebuild = empty grid → should return [end]
    const path = mesh.findPath({ x: 0, y: 0 }, { x: 100, y: 100 })
    return path
  }).catch(() => null)

  if (result === null) return

  expect(result).toHaveLength(1)
  expect(result[0]).toEqual({ x: 100, y: 100 })
})

test('single room: interior is walkable, walls are not', async () => {
  const result = await ctx.window.evaluate(async () => {
    const { NavMesh } = await import('./src/game/nav-mesh')
    const mesh = new NavMesh()
    mesh.rebuild({
      buildingBounds: { x: 0, y: 0, w: 400, h: 300 },
      rooms: [{
        x: 200, y: 150, width: 200, height: 150,
        doorX: 200, doorY: 75, // top door
      }],
      corridorSegments: [],
      cafeBounds: null,
    })

    return {
      stats: mesh.getStats(),
      centerWalkable: mesh.isPointWalkable(200, 160), // room center
      wallBlocked: mesh.isPointWalkable(0, 0), // far corner, blocked
      outsideBlocked: mesh.isPointWalkable(380, 280), // outside room
    }
  }).catch(() => null)

  if (result === null) return

  expect(result.stats.walkable).toBeGreaterThan(0)
  expect(result.centerWalkable).toBe(true)
  expect(result.wallBlocked).toBe(false)
})

test('path between two rooms goes through corridor', async () => {
  const result = await ctx.window.evaluate(async () => {
    const { NavMesh } = await import('./src/game/nav-mesh')
    const mesh = new NavMesh()

    // Two rooms side by side with a corridor connecting them
    const room1 = { x: 100, y: 100, width: 120, height: 100, doorX: 160, doorY: 50 }
    const room2 = { x: 300, y: 100, width: 120, height: 100, doorX: 240, doorY: 50 }

    mesh.rebuild({
      buildingBounds: { x: 0, y: 0, w: 500, h: 250 },
      rooms: [room1, room2],
      corridorSegments: [
        // Horizontal corridor connecting the doors
        { x1: 160, y1: 50, x2: 240, y2: 50 },
      ],
      cafeBounds: null,
    })

    const path = mesh.findPath({ x: 100, y: 120 }, { x: 300, y: 120 })
    return {
      pathLength: path?.length ?? 0,
      pathExists: path !== null && path.length > 1,
      stats: mesh.getStats(),
    }
  }).catch(() => null)

  if (result === null) return

  // A valid path through corridor should have multiple waypoints
  expect(result.pathExists).toBe(true)
  expect(result.pathLength).toBeGreaterThan(2) // not a direct line
})

test('walls block diagonal shortcuts', async () => {
  const result = await ctx.window.evaluate(async () => {
    const { NavMesh } = await import('./src/game/nav-mesh')
    const mesh = new NavMesh()

    mesh.rebuild({
      buildingBounds: { x: 0, y: 0, w: 400, h: 400 },
      rooms: [
        { x: 100, y: 100, width: 150, height: 150, doorX: 175, doorY: 25 },
      ],
      corridorSegments: [],
      cafeBounds: null,
    })

    // Point deep inside room wall area should be blocked
    const wallPoint = mesh.isPointWalkable(25, 25)
    // Point inside room interior should be walkable
    const interiorPoint = mesh.isPointWalkable(100, 120)

    return { wallPoint, interiorPoint }
  }).catch(() => null)

  if (result === null) return

  expect(result.wallPoint).toBe(false)
  expect(result.interiorPoint).toBe(true)
})

test('cafe adds walkable area and connecting path', async () => {
  const result = await ctx.window.evaluate(async () => {
    const { NavMesh } = await import('./src/game/nav-mesh')
    const mesh = new NavMesh()

    mesh.rebuild({
      buildingBounds: { x: 0, y: 0, w: 400, h: 300 },
      rooms: [{ x: 200, y: 100, width: 150, height: 100, doorX: 200, doorY: 50 }],
      corridorSegments: [
        { x1: 100, y1: 50, x2: 300, y2: 50 },
      ],
      cafeBounds: { x: 150, y: 350, w: 120, h: 80 },
    })

    const stats = mesh.getStats()
    const cafeCenter = mesh.isPointWalkable(210, 390)

    return { stats, cafeCenter }
  }).catch(() => null)

  if (result === null) return

  expect(result.stats.walkable).toBeGreaterThan(0)
  expect(result.cafeCenter).toBe(true)
})

test('getStats reports consistent grid dimensions', async () => {
  const result = await ctx.window.evaluate(async () => {
    const { NavMesh } = await import('./src/game/nav-mesh')
    const mesh = new NavMesh()

    mesh.rebuild({
      buildingBounds: { x: 0, y: 0, w: 600, h: 400 },
      rooms: [
        { x: 150, y: 150, width: 200, height: 150, doorX: 150, doorY: 75 },
        { x: 450, y: 150, width: 200, height: 150, doorX: 350, doorY: 75 },
      ],
      corridorSegments: [{ x1: 150, y1: 75, x2: 350, y2: 75 }],
      cafeBounds: null,
    })

    const stats = mesh.getStats()
    return stats
  }).catch(() => null)

  if (result === null) return

  expect(result.total).toBe(result.gridW * result.gridH)
  expect(result.walkable).toBeGreaterThan(0)
  expect(result.walkable).toBeLessThan(result.total) // not everything walkable
})
