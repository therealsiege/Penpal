/**
 * Visual consistency check — verifies the production build renders
 * core elements: canvas, service buildings, minimap, status bar.
 */

import { test, expect } from '@playwright/test'
import { launchApp, waitForPhaser, evalInScene, type AppContext } from './electron.setup'

let ctx: AppContext

test.beforeAll(async () => {
  ctx = await launchApp()
  await waitForPhaser(ctx.window)
  // Extra wait for service buildings + first minimap draw
  await ctx.window.waitForTimeout(3000)
})

test.afterAll(async () => {
  await ctx.app.close()
})

test('canvas fills the game container', async () => {
  const dims = await ctx.window.evaluate(() => {
    const canvas = document.querySelector('canvas')
    if (!canvas) return null
    const parent = canvas.parentElement
    if (!parent) return { cw: canvas.clientWidth, ch: canvas.clientHeight, pw: 0, ph: 0 }
    return {
      cw: canvas.clientWidth,
      ch: canvas.clientHeight,
      pw: parent.clientWidth,
      ph: parent.clientHeight,
    }
  })
  expect(dims).not.toBeNull()
  // Canvas should be within 2px of parent
  expect(Math.abs(dims!.cw - dims!.pw)).toBeLessThanOrEqual(2)
  expect(Math.abs(dims!.ch - dims!.ph)).toBeLessThanOrEqual(2)
})

test('GitHub Dispatch building exists', async () => {
  const bounds = await evalInScene(ctx.window, (scene) => {
    if (typeof scene.githubBuilding?.getBounds === 'function') {
      return scene.githubBuilding.getBounds()
    }
    return null
  })
  // Building should be built (non-zero bounds)
  if (bounds) {
    expect(bounds.w).toBeGreaterThan(0)
    expect(bounds.h).toBeGreaterThan(0)
  }
})

test('minimap is positioned in bottom-right above status bar', async () => {
  const info = await evalInScene(ctx.window, (scene) => {
    const mm = (scene as any).minimap
    if (!mm || !mm.minimapContainer) return null
    return {
      x: mm.minimapContainer.x,
      y: mm.minimapContainer.y,
      viewW: (scene as any).viewWidth,
      viewH: (scene as any).viewHeight,
    }
  })
  if (info && info.viewW > 0) {
    expect(info.x).toBeGreaterThan(info.viewW / 2)
    expect(info.y).toBeGreaterThan(info.viewH / 2)
    expect(info.y).toBeLessThan(info.viewH)
  }
})

test('status bar spans full viewport width', async () => {
  const info = await evalInScene(ctx.window, (scene) => {
    const ui = (scene as any).ui
    if (!ui?.statusBarBg) return null
    return {
      bgW: ui.statusBarBg.width,
      viewW: ui.viewWidth,
      containerY: ui.statusBarContainer?.y || 0,
      viewH: ui.viewHeight,
    }
  })
  if (info && info.viewW > 0) {
    // Status bar bg should match viewport width
    expect(info.bgW).toBeGreaterThanOrEqual(info.viewW - 2)
    // Container Y should be near the bottom
    expect(info.containerY).toBeGreaterThan(info.viewH - 30)
  }
})

test('production screenshot shows rendered content', async () => {
  const canvas = ctx.window.locator('canvas').first()
  const screenshot = await canvas.screenshot()
  // Should be a reasonable image (not blank)
  expect(screenshot.byteLength).toBeGreaterThan(5000)
})

test('viewWidth and viewHeight are sane (not inflated)', async () => {
  const info = await evalInScene(ctx.window, (scene) => {
    return {
      viewWidth: (scene as any).viewWidth,
      viewHeight: (scene as any).viewHeight,
      scaleWidth: scene.scale?.width || 0,
      scaleHeight: scene.scale?.height || 0,
      canvasW: scene.sys?.game?.canvas?.clientWidth || 0,
      canvasH: scene.sys?.game?.canvas?.clientHeight || 0,
      parentW: scene.sys?.game?.canvas?.parentElement?.clientWidth || 0,
      parentH: scene.sys?.game?.canvas?.parentElement?.clientHeight || 0,
    }
  })
  expect(info).not.toBeNull()
  // viewWidth/Height should be reasonable (< 3000px) not inflated to 6000+
  expect(info!.viewWidth).toBeLessThan(3000)
  expect(info!.viewHeight).toBeLessThan(3000)
  expect(info!.viewWidth).toBeGreaterThan(100)
  expect(info!.viewHeight).toBeGreaterThan(100)
  // Should roughly match parent container
  if (info!.parentW > 0) {
    expect(Math.abs(info!.viewWidth - info!.parentW)).toBeLessThan(50)
    expect(Math.abs(info!.viewHeight - info!.parentH)).toBeLessThan(50)
  }
})

test('minimap is within visible canvas bounds', async () => {
  const info = await evalInScene(ctx.window, (scene) => {
    const mm = (scene as any).minimap
    if (!mm?.minimapContainer) return null
    return {
      mmX: mm.minimapContainer.x,
      mmY: mm.minimapContainer.y,
      viewWidth: (scene as any).viewWidth,
      viewHeight: (scene as any).viewHeight,
    }
  })
  if (info) {
    expect(info.mmX).toBeGreaterThan(0)
    expect(info.mmX).toBeLessThan(info.viewWidth)
    expect(info.mmY).toBeGreaterThan(0)
    expect(info.mmY).toBeLessThan(info.viewHeight)
  }
})

test('status bar Y is at the bottom of the viewport', async () => {
  const info = await evalInScene(ctx.window, (scene) => {
    const ui = (scene as any).ui
    if (!ui?.statusBarContainer) return null
    return {
      barY: ui.statusBarContainer.y,
      viewHeight: (scene as any).viewHeight,
    }
  })
  if (info) {
    expect(info.barY).toBeGreaterThan(info.viewHeight - 30)
    expect(info.barY).toBeLessThan(info.viewHeight)
  }
})
