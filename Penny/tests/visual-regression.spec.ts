/**
 * Visual regression — compares Phaser canvas shots to baselines (pixelmatch).
 *
 * Prerequisites: npm run build
 *
 *   npm run test:visual:update   — write Penny/tests/screenshots/baselines/*.png
 *   npm run test:visual          — compare; failures write Penny/tests/screenshots/diffs/*.png
 */

import { test, expect } from '@playwright/test'
import { launchApp, waitForPhaser, evalInScene, type AppContext } from './electron.setup'
import {
  compareOrUpdateVisual,
  logVisualThresholdOnce,
} from './visual-diff'

let ctx: AppContext

async function screenshotCanvasBuffer(): Promise<Buffer> {
  const canvas = ctx.window.locator('canvas').first()
  return canvas.screenshot({ timeout: 15_000 })
}

test.beforeAll(async () => {
  logVisualThresholdOnce()
  ctx = await launchApp()
  await waitForPhaser(ctx.window)
  await ctx.window.waitForTimeout(2000)
})

test.afterAll(async () => {
  await ctx.app.close()
})

test.beforeEach(async () => {
  await ctx.window.waitForFunction(
    () => typeof (window as { PH?: { clearAgents: () => void } }).PH?.clearAgents === 'function',
    { timeout: 15_000 },
  )
  await ctx.window.evaluate(() => {
    const PH = (window as {
      PH?: {
        resume: () => void
        timeScale: (n: number) => void
        configReset: () => void
        clearAgents: () => void
        refresh: () => void
        setTimeOfDay: (p: string) => void
      }
    }).PH
    if (!PH) return
    try {
      PH.resume()
    } catch {
      /* already running */
    }
    PH.timeScale(1.0)
    PH.configReset()
    PH.clearAgents()
    PH.refresh()
    PH.setTimeOfDay('day')
  })
  await evalInScene(ctx.window, (scene) => {
    const rooms = (scene as { roomMap?: Map<string, unknown> }).roomMap
    if (rooms && rooms.size > 0) return
    const cam = scene.cameras.main
    const oc = (scene as { officeCamera?: { targetZoom: number; followTarget: unknown } }).officeCamera
    if (oc) {
      oc.targetZoom = 1
      oc.followTarget = null
    }
    const bg = (scene as { background?: { getBgDimensions: () => { w: number; h: number } } }).background?.getBgDimensions?.()
    const w = bg?.w ?? 1200
    const h = bg?.h ?? 700
    cam.setZoom(1)
    cam.centerOn(w / 2, h / 2)
  })
  await ctx.window.waitForTimeout(300)
})

test.afterEach(async () => {
  await ctx.window.evaluate(() => {
    try {
      ;(window as { PH?: { resume: () => void } }).PH?.resume()
    } catch {
      /* ignore */
    }
  })
})

test.describe('@visual Visual regression', () => {
  test('empty-office', async () => {
    await ctx.window.waitForTimeout(1500)
    const buffer = await screenshotCanvasBuffer()
    const r = compareOrUpdateVisual('empty-office', buffer)
    expect(r.ok, r.message).toBe(true)
  })

  test('four-idle-one-room', async () => {
    await ctx.window.evaluate(() => {
      const PH = (window as {
        PH?: { addAgents: (n: number, o?: object) => void; transitionAll: (s: string) => void; zoomToFit: () => void }
      }).PH
      PH?.addAgents(4, { sessionMode: 'idle' })
      PH?.transitionAll('idle')
    })
    await ctx.window.waitForTimeout(2000)
    await ctx.window.evaluate(() => {
      ;(window as { PH?: { zoomToFit: () => void } }).PH?.zoomToFit()
    })
    await ctx.window.waitForTimeout(800)
    const buffer = await screenshotCanvasBuffer()
    const r = compareOrUpdateVisual('four-idle-one-room', buffer)
    expect(r.ok, r.message).toBe(true)
  })

  test('eight-mixed-states', async () => {
    await ctx.window.evaluate(() => {
      const PH = (window as {
        PH?: {
          addAgents: (n: number, o?: object) => string[]
          block: (id: string, t?: string) => void
        }
      }).PH
      if (!PH) return
      const w = PH.addAgents(3, { sessionMode: 'working' })
      const i = PH.addAgents(2, { sessionMode: 'idle' })
      const b = PH.addAgents(3, { sessionMode: 'working' })
      b.forEach((id) => PH.block(id, 'tool-approval'))
      void w
      void i
    })
    await ctx.window.waitForTimeout(2500)
    await ctx.window.evaluate(() => {
      ;(window as { PH?: { zoomToFit: () => void } }).PH?.zoomToFit()
    })
    await ctx.window.waitForTimeout(800)
    const buffer = await screenshotCanvasBuffer()
    const r = compareOrUpdateVisual('eight-mixed-states', buffer)
    expect(r.ok, r.message).toBe(true)
  })

  /** L1 overview; baseline name matches issue #67 (no scene.minimap today). */
  test('minimap-visible', async () => {
    await ctx.window.evaluate(() => {
      const PH = (window as {
        PH?: { addAgents: (n: number, o?: object) => void; setCameraOverview: () => void }
      }).PH
      PH?.addAgents(3, { sessionMode: 'working' })
    })
    await ctx.window.waitForTimeout(2000)
    await ctx.window.evaluate(() => {
      ;(window as { PH?: { setCameraOverview: () => void } }).PH?.setCameraOverview()
    })
    await ctx.window.waitForTimeout(1200)
    const buffer = await screenshotCanvasBuffer()
    const r = compareOrUpdateVisual('minimap-visible', buffer)
    expect(r.ok, r.message).toBe(true)
  })

  test('season-hud-visible', async () => {
    await ctx.window.evaluate(() => {
      const PH = (window as { PH?: { addAgents: (n: number, o?: object) => void } }).PH
      PH?.addAgents(2, { sessionMode: 'idle' })
    })
    await ctx.window.waitForTimeout(1800)
    await ctx.window.evaluate(() => {
      const PH = (window as { PH?: { seasonHudRefresh: () => void; zoomToFit: () => void } }).PH
      PH?.seasonHudRefresh()
      PH?.zoomToFit()
    })
    await ctx.window.waitForTimeout(800)
    const buffer = await screenshotCanvasBuffer()
    const r = compareOrUpdateVisual('season-hud-visible', buffer)
    expect(r.ok, r.message).toBe(true)
  })

  test('atmosphere-night', async () => {
    await ctx.window.evaluate(() => {
      const PH = (window as {
        PH?: { addAgents: (n: number, o?: object) => void; setTimeOfDay: (p: string) => void; zoomToFit: () => void }
      }).PH
      PH?.addAgents(2, { sessionMode: 'working' })
      PH?.setTimeOfDay('night')
    })
    await ctx.window.waitForTimeout(2200)
    await ctx.window.evaluate(() => {
      ;(window as { PH?: { zoomToFit: () => void } }).PH?.zoomToFit()
    })
    await ctx.window.waitForTimeout(500)
    const buffer = await screenshotCanvasBuffer()
    const r = compareOrUpdateVisual('atmosphere-night', buffer)
    expect(r.ok, r.message).toBe(true)
  })

  test('celebration-rank-up', async () => {
    const agentId = await ctx.window.evaluate(() => {
      const PH = (window as { PH?: { addAgents: (n: number, o?: object) => string[]; clearAgents: () => void; refresh: () => void } }).PH
      PH?.clearAgents()
      PH?.refresh()
      const ids = PH?.addAgents(1, { sessionMode: 'idle', xpLevel: 5 }) ?? []
      return ids[0] ?? null
    })
    expect(agentId).toBeTruthy()
    await ctx.window.waitForTimeout(1200)
    await ctx.window.evaluate(() => {
      ;(window as { PH?: { zoomToFit: () => void } }).PH?.zoomToFit()
    })
    await ctx.window.waitForTimeout(500)

    await ctx.window.evaluate((id) => {
      const PH = (window as { PH?: { celebrate: (t: string, a?: string) => void } }).PH
      PH?.celebrate('rankUp', id)
    }, agentId as string)

    await ctx.window.waitForTimeout(450)
    await ctx.window.evaluate(() => {
      ;(window as { PH?: { pause: () => void } }).PH?.pause()
    })
    await ctx.window.waitForTimeout(200)

    const buffer = await screenshotCanvasBuffer()
    const r = compareOrUpdateVisual('celebration-rank-up', buffer)
    expect(r.ok, r.message).toBe(true)
  })
})
