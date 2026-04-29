/**
 * PENPAL lab — Playwright capture for the same kind of visual review you’d do manually:
 * boot Electron, seed two atlas/sidekick-style zones, zoom to fit, screenshot the canvas.
 *
 * Prerequisites: production build (same as other e2e)
 *   npm run build && npx playwright test tests/lab-layout-visual.spec.ts --project=e2e
 *
 * Outputs:
 *   — Playwright HTML report attachment: "penpal-lab-canvas"
 *   — tests/screenshots/captures/penpal-lab-latest.png (overwritten each run)
 */
import * as fs from 'fs'
import * as path from 'path'
import { test, expect } from '@playwright/test'
import { launchApp, waitForPhaser, type AppContext } from './electron.setup'

const PROJECT_ROOT = path.resolve(__dirname, '..')
const CAPTURE_DIR = path.join(PROJECT_ROOT, 'tests', 'screenshots', 'captures')
const CAPTURE_FILE = path.join(CAPTURE_DIR, 'penpal-lab-latest.png')

let ctx: AppContext

test.beforeAll(async () => {
  ctx = await launchApp()
  await waitForPhaser(ctx.window)
})

test.afterAll(async () => {
  await ctx.app.close()
})

test.describe('PENPAL lab visual capture', () => {
  test('two-zone lab, facility props, screenshot for review', async () => {
    await ctx.window.waitForFunction(
      () => typeof (window as { PH?: { clearAgents: () => void } }).PH?.clearAgents === 'function',
      { timeout: 15_000 },
    )

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
      PH.addAgents(1, { sessionMode: 'idle', cwd: '/org/atlas', name: 'Lab-Atlas' })
      PH.addAgents(1, { sessionMode: 'idle', cwd: '/org/sidekick', name: 'Lab-Sidekick' })
      PH.refresh()
    })

    await ctx.window.waitForTimeout(2800)

    await ctx.window.evaluate(() => {
      const scene = (window as { __PENNY_SCENE__?: { zoomToFit?: (animated: boolean) => void } }).__PENNY_SCENE__
      scene?.zoomToFit?.(false)
    })
    await ctx.window.waitForTimeout(900)

    const harnessCallsLabDecoration = await ctx.window.evaluate(() => {
      const PH = (window as { PH?: { labDecoration?: () => void } }).PH
      if (typeof PH?.labDecoration !== 'function') return false
      PH.labDecoration()
      return true
    })
    expect(harnessCallsLabDecoration).toBe(true)

    const decorationInfo = await ctx.window.evaluate(() => {
      const scene = (window as {
        __PENNY_SCENE__?: { getLabDecorationDebugInfo?: () => Record<string, unknown> }
      }).__PENNY_SCENE__
      return scene?.getLabDecorationDebugInfo?.() ?? null
    })

    expect(decorationInfo).not.toBeNull()
    expect(decorationInfo!.pipelineId).toBe('facility-json-per-room-v1')
    expect(Array.isArray(decorationInfo!.strategicLayoutLinks)).toBe(true)
    expect((decorationInfo!.strategicLayoutLinks as unknown[]).length).toBeGreaterThan(0)
    expect(decorationInfo!.labPropsTextureLoaded).toBe(true)
    expect(decorationInfo!.perRoomStrategicPropsSkipped).toBe(true)
    expect(typeof decorationInfo!.strategicLayoutJsonVersion).toBe('number')
    expect(decorationInfo!.strategicLayoutJsonVersion as number).toBeGreaterThanOrEqual(31)
    expect(decorationInfo!.facilityLayerVisible).toBe(true)
    expect(typeof decorationInfo!.facilityLayerChildCount).toBe('number')
    expect(decorationInfo!.facilityLayerChildCount as number).toBeGreaterThan(12)
    expect(typeof decorationInfo!.roomCount).toBe('number')
    expect(decorationInfo!.roomCount as number).toBeGreaterThanOrEqual(1)

    const labInfo = await ctx.window.evaluate(() => {
      const scene = (window as { __PENNY_SCENE__?: { labFacilityPropsLayer?: { list: unknown[]; visible: boolean } } })
        .__PENNY_SCENE__
      if (!scene) {
        return { layerExists: false, spriteCount: 0, visible: false }
      }
      const layer = scene.labFacilityPropsLayer
      const list = layer?.list ?? []
      return {
        layerExists: layer != null,
        spriteCount: list.length,
        visible: layer?.visible !== false,
      }
    })

    expect(labInfo).not.toBeNull()
    expect(labInfo!.layerExists).toBe(true)
    // Sprites only (facility layer no longer merges cyan glow discs).
    expect(labInfo!.spriteCount).toBeGreaterThan(12)
    expect(labInfo!.visible).toBe(true)

    const canvas = ctx.window.locator('canvas').first()
    const png = await canvas.screenshot({ timeout: 15_000 })
    expect(png.byteLength).toBeGreaterThan(8000)

    fs.mkdirSync(CAPTURE_DIR, { recursive: true })
    fs.writeFileSync(CAPTURE_FILE, png)

    await test.info().attach('penpal-lab-canvas', {
      body: png,
      contentType: 'image/png',
    })
  })
})
