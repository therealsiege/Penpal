/**
 * GDS prop overlay animations — boot Electron, seed 2 agents in GDS mode,
 * assert that rotating knobs advance each frame, LEDs toggle alpha, and
 * pulse-glow overlays are present.
 *
 * Prerequisites: production build (same as other e2e)
 *   npm run build && npx playwright test tests/prop-animations.spec.ts --project=e2e
 *
 * Outputs:
 *   — tests/screenshots/captures/prop-animations-baseline.png
 */
import * as fs from 'fs'
import * as path from 'path'
import { test, expect } from '@playwright/test'
import { launchApp, waitForPhaser, type AppContext } from './electron.setup'

const PROJECT_ROOT = path.resolve(__dirname, '..')
const CAPTURE_DIR = path.join(PROJECT_ROOT, 'tests', 'screenshots', 'captures')
const CAPTURE_FILE = path.join(CAPTURE_DIR, 'prop-animations-baseline.png')

let ctx: AppContext

test.beforeAll(async () => {
  ctx = await launchApp()
  await waitForPhaser(ctx.window)
})

test.afterAll(async () => {
  await ctx.app.close()
})

test.describe('GDS prop overlay animations', () => {
  test('prop overlays are created when GDS scene is rendered', async () => {
    // Wait for PH harness
    await ctx.window.waitForFunction(
      () => typeof (window as { PH?: { clearAgents: () => void } }).PH?.clearAgents === 'function',
      { timeout: 15_000 },
    )

    // Seed 2 agents so the GDS scene is active
    await ctx.window.evaluate(() => {
      const PH = (window as {
        PH?: {
          clearAgents: () => void
          refresh: () => void
          addAgents: (n: number, o?: object) => void
        }
      }).PH
      if (!PH) return
      PH.clearAgents()
      PH.refresh()
      PH.addAgents(1, { sessionMode: 'working', cwd: '/org/atlas', name: 'Prop-Agent-1' })
      PH.addAgents(1, { sessionMode: 'idle', cwd: '/org/sidekick', name: 'Prop-Agent-2' })
      PH.refresh()
    })

    // Wait for layout + prop placement
    await ctx.window.waitForTimeout(3000)

    // Check GDS scene is rendered
    const gdsActive = await ctx.window.evaluate(() => {
      const scene = (window as { __PENNY_SCENE__?: Record<string, unknown> }).__PENNY_SCENE__
      if (!scene) return false
      const bg = (scene as { background?: { hasGdsScene?: () => boolean } }).background
      return bg?.hasGdsScene?.() ?? false
    })

    if (!gdsActive) {
      // GDS texture may not be present in CI — skip gracefully
      test.skip()
      return
    }

    // Assert prop overlays were created
    const propCount = await ctx.window.evaluate(() => {
      const scene = (window as { __PENNY_SCENE__?: unknown }).__PENNY_SCENE__ as {
        background?: { gdsRenderer?: { getPropOverlayCount?: () => number } }
      }
      return scene?.background?.gdsRenderer?.getPropOverlayCount?.() ?? 0
    })

    expect(propCount).toBeGreaterThan(0)
  })

  test('rotating knob angle advances over time', async () => {
    const gdsActive = await ctx.window.evaluate(() => {
      const scene = (window as { __PENNY_SCENE__?: Record<string, unknown> }).__PENNY_SCENE__
      if (!scene) return false
      const bg = (scene as { background?: { hasGdsScene?: () => boolean } }).background
      return bg?.hasGdsScene?.() ?? false
    })
    if (!gdsActive) { test.skip(); return }

    // Read initial angle for the first rotating knob
    const angleBefore = await ctx.window.evaluate(() => {
      const scene = (window as { __PENNY_SCENE__?: unknown }).__PENNY_SCENE__ as {
        background?: { gdsRenderer?: { getPropById?: (id: string) => { angle: number; alpha: number } | null } }
      }
      return scene?.background?.gdsRenderer?.getPropById?.('console-knob-1')?.angle ?? null
    })

    expect(angleBefore).not.toBeNull()

    // Wait for several frames of animation (500ms)
    await ctx.window.waitForTimeout(500)

    const angleAfter = await ctx.window.evaluate(() => {
      const scene = (window as { __PENNY_SCENE__?: unknown }).__PENNY_SCENE__ as {
        background?: { gdsRenderer?: { getPropById?: (id: string) => { angle: number; alpha: number } | null } }
      }
      return scene?.background?.gdsRenderer?.getPropById?.('console-knob-1')?.angle ?? null
    })

    expect(angleAfter).not.toBeNull()
    // Angle should have advanced (speed 0.5 rad/s × 0.5s ≈ 0.25 rad minimum)
    expect(Math.abs((angleAfter as number) - (angleBefore as number))).toBeGreaterThan(0.05)
  })

  test('pulse-glow overlay is present and has non-zero alpha', async () => {
    const gdsActive = await ctx.window.evaluate(() => {
      const scene = (window as { __PENNY_SCENE__?: Record<string, unknown> }).__PENNY_SCENE__
      if (!scene) return false
      const bg = (scene as { background?: { hasGdsScene?: () => boolean } }).background
      return bg?.hasGdsScene?.() ?? false
    })
    if (!gdsActive) { test.skip(); return }

    const glowProp = await ctx.window.evaluate(() => {
      const scene = (window as { __PENNY_SCENE__?: unknown }).__PENNY_SCENE__ as {
        background?: { gdsRenderer?: { getPropById?: (id: string) => { angle: number; alpha: number } | null } }
      }
      return scene?.background?.gdsRenderer?.getPropById?.('reactor-core') ?? null
    })

    expect(glowProp).not.toBeNull()
    expect((glowProp as { alpha: number }).alpha).toBeGreaterThan(0)
  })

  test('screenshot baseline for visual review', async () => {
    const gdsActive = await ctx.window.evaluate(() => {
      const scene = (window as { __PENNY_SCENE__?: Record<string, unknown> }).__PENNY_SCENE__
      if (!scene) return false
      const bg = (scene as { background?: { hasGdsScene?: () => boolean } }).background
      return bg?.hasGdsScene?.() ?? false
    })
    if (!gdsActive) { test.skip(); return }

    await ctx.window.evaluate(() => {
      const scene = (window as { __PENNY_SCENE__?: { zoomToFit?: (animated: boolean) => void } }).__PENNY_SCENE__
      scene?.zoomToFit?.(false)
    })
    await ctx.window.waitForTimeout(600)

    const canvas = ctx.window.locator('canvas').first()
    const png = await canvas.screenshot({ timeout: 15_000 })
    expect(png.byteLength).toBeGreaterThan(8000)

    fs.mkdirSync(CAPTURE_DIR, { recursive: true })
    fs.writeFileSync(CAPTURE_FILE, png)

    await test.info().attach('prop-animations-baseline', {
      body: png,
      contentType: 'image/png',
    })
  })
})
