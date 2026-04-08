/**
 * laser-doors.spec.ts
 *
 * E2E tests for the GDS scene laser door proximity animation system.
 *
 * Tests verify:
 *   - Doors are created when the GDS scene is active
 *   - Doors open (fade to alpha 0) when an agent is nearby
 *   - Doors close (fade to alpha 1) when agents leave
 *   - Animation timing (~200ms open, ~400ms close)
 *   - Multi-agent: door stays open while any agent remains nearby
 *   - Visual regression baselines (run with VISUAL_UPDATE=1 to create)
 *
 * All tests are guarded by `gdsActive` — they skip if the GDS scene texture
 * is not loaded (i.e. in CI without the GDS asset).
 *
 * Usage:
 *   npx playwright test laser-doors --project=e2e
 *   VISUAL_UPDATE=1 npx playwright test laser-doors  # write baselines
 */

import { test, expect } from '@playwright/test'
import path from 'path'
import fs from 'fs'
import type { AppContext } from './electron.setup'
import { launchApp, waitForPhaser } from './electron.setup'
import { compareOrUpdateVisual, isVisualUpdateMode, logVisualThresholdOnce } from './visual-diff'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DoorState {
  alpha: number
  open: boolean
  worldX: number
  worldY: number
  worldW: number
  worldH: number
}

// ---------------------------------------------------------------------------
// Suite state
// ---------------------------------------------------------------------------

let ctx: AppContext
let gdsActive = false

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

test.beforeAll(async () => {
  ctx = await launchApp()
  await waitForPhaser(ctx.window)
  // Extra time for GDS scene to render after initial layout
  await ctx.window.waitForTimeout(2000)

  // Check if the GDS scene is active by calling updateGdsLaserDoors once
  // (lazy init: builds doors only when rendered is true)
  await ctx.window.evaluate(() => {
    const scene = (window as any).__PENNY_SCENE__
    scene?.background?.updateGdsLaserDoors([])
  })

  const doorCount = await ctx.window.evaluate((): number => {
    const scene = (window as any).__PENNY_SCENE__
    return (scene?.background?.getGdsLaserDoorStates() ?? []).length
  })
  gdsActive = doorCount > 0
})

test.afterAll(async () => {
  await ctx.app.close()
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getLaserDoors(): Promise<DoorState[]> {
  const result = await ctx.window.evaluate((): DoorState[] => {
    const scene = (window as any).__PENNY_SCENE__
    return scene?.background?.getGdsLaserDoorStates() ?? []
  })
  return result ?? []
}

async function triggerProximity(positions: { x: number; y: number }[]): Promise<void> {
  await ctx.window.evaluate((pos: { x: number; y: number }[]) => {
    const scene = (window as any).__PENNY_SCENE__
    scene?.background?.updateGdsLaserDoors(pos)
  }, positions)
}

async function screenshotCanvas(): Promise<Buffer> {
  const canvas = ctx.window.locator('canvas').first()
  return canvas.screenshot({ timeout: 15000 })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('GDS scene has laser doors', async () => {
  test.skip(!gdsActive, 'GDS scene not rendered — skipping laser door tests')
  const doors = await getLaserDoors()
  expect(doors.length).toBe(5)
})

test('All 5 doors render closed on scene load', async () => {
  test.skip(!gdsActive, 'GDS scene not rendered')
  const doors = await getLaserDoors()
  expect(doors.length).toBe(5)
  for (const door of doors) {
    // Initial alpha is 0.5 (semi-transparent resting state)
    expect(door.alpha).toBeGreaterThanOrEqual(0.4)
    expect(door.alpha).toBeLessThanOrEqual(0.6)
    expect(door.open).toBe(false)
  }
})

test('Door fades open when agent within proximity', async () => {
  test.skip(!gdsActive, 'GDS scene not rendered')
  const doors = await getLaserDoors()
  const door = doors[0]

  // Place agent at door center — satisfies rectangular proximity check
  await triggerProximity([{ x: door.worldX, y: door.worldY }])
  await ctx.window.waitForTimeout(250)

  const updated = await getLaserDoors()
  expect(updated[0].open).toBe(true)
  expect(updated[0].alpha).toBeLessThan(0.1)
})

test('Door fades closed when agent leaves', async () => {
  test.skip(!gdsActive, 'GDS scene not rendered')
  const doors = await getLaserDoors()
  const door = doors[0]

  // First open the door
  await triggerProximity([{ x: door.worldX, y: door.worldY }])
  await ctx.window.waitForTimeout(250)

  // Then remove all agents
  await triggerProximity([])
  await ctx.window.waitForTimeout(450)

  const updated = await getLaserDoors()
  expect(updated[0].open).toBe(false)
  expect(updated[0].alpha).toBeGreaterThan(0.9)
})

test('Open animation completes in ~200ms', async () => {
  test.skip(!gdsActive, 'GDS scene not rendered')
  const doors = await getLaserDoors()
  const door = doors[0]

  // Ensure door is closed first
  await triggerProximity([])
  await ctx.window.waitForTimeout(450)

  // Trigger open
  await triggerProximity([{ x: door.worldX, y: door.worldY }])

  // At 100ms, alpha should already be decreasing (< 0.45)
  await ctx.window.waitForTimeout(100)
  const mid = await getLaserDoors()
  expect(mid[0].alpha).toBeLessThan(0.45)

  // At 250ms total (100+150), animation should be complete (< 0.05)
  await ctx.window.waitForTimeout(150)
  const done = await getLaserDoors()
  expect(done[0].alpha).toBeLessThan(0.05)
})

test('Close animation completes in ~400ms', async () => {
  test.skip(!gdsActive, 'GDS scene not rendered')
  const doors = await getLaserDoors()
  const door = doors[0]

  // Open the door
  await triggerProximity([{ x: door.worldX, y: door.worldY }])
  await ctx.window.waitForTimeout(250)

  // Remove agent to trigger close
  await triggerProximity([])

  // At 200ms (mid-close), alpha should be < 0.6
  await ctx.window.waitForTimeout(200)
  const mid = await getLaserDoors()
  expect(mid[0].alpha).toBeLessThan(0.6)

  // At 450ms total (200+250), animation should be complete (> 0.9)
  await ctx.window.waitForTimeout(250)
  const done = await getLaserDoors()
  expect(done[0].alpha).toBeGreaterThan(0.9)
})

test('Multiple agents: door stays open until all leave', async () => {
  test.skip(!gdsActive, 'GDS scene not rendered')
  const doors = await getLaserDoors()
  const door1 = doors[1]

  // Two agents near door[1]
  const agent1 = { x: door1.worldX, y: door1.worldY }
  const agent2 = { x: door1.worldX + 10, y: door1.worldY + 10 }
  await triggerProximity([agent1, agent2])
  await ctx.window.waitForTimeout(250)

  // Remove only agent2, agent1 still nearby
  await triggerProximity([agent1])
  await ctx.window.waitForTimeout(250)

  // Door should still be open
  const stillOpen = await getLaserDoors()
  expect(stillOpen[1].open).toBe(true)
  expect(stillOpen[1].alpha).toBeLessThan(0.1)

  // Remove all agents
  await triggerProximity([])
  await ctx.window.waitForTimeout(450)

  // Door should now be closed
  const closed = await getLaserDoors()
  expect(closed[1].open).toBe(false)
  expect(closed[1].alpha).toBeGreaterThan(0.9)
})

// ---------------------------------------------------------------------------
// Visual regression tests
// Run with: VISUAL_UPDATE=1 npx playwright test laser-doors
// ---------------------------------------------------------------------------

test('@visual doors-all-closed', async () => {
  test.skip(!gdsActive, 'GDS scene not rendered')
  const baselineFile = path.join(__dirname, 'screenshots', 'baselines', 'laser-doors-all-closed.png')
  test.skip(!isVisualUpdateMode() && !fs.existsSync(baselineFile), 'No baseline — run with VISUAL_UPDATE=1 first')

  logVisualThresholdOnce()

  // Ensure all doors are closed
  await triggerProximity([])
  await ctx.window.waitForTimeout(500)

  const buffer = await screenshotCanvas()
  const r = compareOrUpdateVisual('laser-doors-all-closed', buffer)
  expect(r.ok, r.message).toBe(true)
})

test('@visual doors-one-open', async () => {
  test.skip(!gdsActive, 'GDS scene not rendered')
  const baselineFile = path.join(__dirname, 'screenshots', 'baselines', 'laser-doors-one-open.png')
  test.skip(!isVisualUpdateMode() && !fs.existsSync(baselineFile), 'No baseline — run with VISUAL_UPDATE=1 first')

  logVisualThresholdOnce()

  const doors = await getLaserDoors()
  const door = doors[0]

  // Open door[0]
  await triggerProximity([{ x: door.worldX, y: door.worldY }])
  await ctx.window.waitForTimeout(250)

  const buffer = await screenshotCanvas()
  const r = compareOrUpdateVisual('laser-doors-one-open', buffer)
  expect(r.ok, r.message).toBe(true)

  // Reset
  await triggerProximity([])
})
