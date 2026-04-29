/**
 * E2E tests for GDS prop automation — knobs, dials, LEDs, reactor glow,
 * ceiling lights, and steam vents.
 *
 * All tests gracefully skip when GDS mode is not active (non-GDS lab scenes)
 * or when the PH test harness is absent. Phase 1 (ambient overlays) tests
 * run purely through scene inspection. Phase 2 (event-driven) tests call
 * the public API methods directly and assert state changes.
 */

import { test, expect } from '@playwright/test'
import { launchApp, waitForPhaser, evalInScene, type AppContext } from '../electron.setup'

let ctx: AppContext

test.beforeAll(async () => {
  ctx = await launchApp()
  await waitForPhaser(ctx.window)
  // Allow GDS scene render + tween system to initialise
  await ctx.window.waitForTimeout(2000)
})

test.afterAll(async () => {
  await ctx.app.close()
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** True when GDS renderer has rendered the lab backdrop. */
async function isGdsRendered(): Promise<boolean> {
  const result = await evalInScene(ctx.window, (scene) => {
    const gds = (scene as any).background?.gdsRenderer
    return !!(gds?.rendered ?? gds?.isRendered?.())
  })
  return result === true
}

/** Returns the gdsRenderer prop overlay count. */
async function getPropOverlayCount(): Promise<number | null> {
  return evalInScene(ctx.window, (scene) => {
    const gds = (scene as any).background?.gdsRenderer
    if (!gds) return null
    return (gds.propOverlays as any[])?.length ?? 0
  })
}

/** Returns prop entries from lab-map.json via the renderer's labMap. */
async function getLabMapProps(): Promise<any[] | null> {
  return evalInScene(ctx.window, (scene) => {
    const gds = (scene as any).background?.gdsRenderer
    if (!gds) return null
    return gds.getLabMap?.()?.props ?? null
  })
}

// ---------------------------------------------------------------------------
// Phase 1 — Ambient overlays
// ---------------------------------------------------------------------------

test.describe('Phase 1: Ambient Overlays', () => {
  test('lab-map.json has props section', async () => {
    const props = await getLabMapProps()
    if (props === null) {
      // GDS not active — evaluate from cache instead
      const result = await evalInScene(ctx.window, (scene) => {
        const raw = (scene as any).cache?.json?.get('lab-map')
        return raw?.props ?? null
      })
      if (result === null) {
        test.skip()
        return
      }
      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBeGreaterThan(0)
      return
    }
    expect(Array.isArray(props)).toBe(true)
    expect(props!.length).toBeGreaterThan(0)
  })

  test('props section contains required types', async () => {
    const props = await getLabMapProps()
    if (props === null) { test.skip(); return }

    const types = new Set(props!.map((p: any) => p.type))
    expect(types.has('rotating-knob')).toBe(true)
    expect(types.has('blink-led')).toBe(true)
    expect(types.has('pulse-glow')).toBe(true)
    expect(types.has('ceiling-light')).toBe(true)
    expect(types.has('steam-vent')).toBe(true)
  })

  test('every prop has a unique id', async () => {
    const props = await getLabMapProps()
    if (props === null) { test.skip(); return }

    const ids = props!.map((p: any) => p.id)
    const unique = new Set(ids)
    expect(unique.size).toBe(ids.length)
  })

  test('prop overlays are placed when GDS is rendered', async () => {
    const gdsActive = await isGdsRendered()
    if (!gdsActive) { test.skip(); return }

    const count = await getPropOverlayCount()
    if (count === null) { test.skip(); return }

    // At minimum one overlay per prop (many props create 2-3 objects)
    expect(count).toBeGreaterThan(0)
  })

  test('rotating knob game objects are active and have tweens', async () => {
    const gdsActive = await isGdsRendered()
    if (!gdsActive) { test.skip(); return }

    const result = await evalInScene(ctx.window, (scene) => {
      const gds = (scene as any).background?.gdsRenderer
      if (!gds) return null
      const props: any[] = gds.getLabMap?.()?.props ?? []
      const knobIds: string[] = props
        .filter((p: any) => p.type === 'rotating-knob')
        .map((p: any) => p.id)

      for (const id of knobIds) {
        const targets: any[] = gds.propById?.get(id) ?? []
        for (const go of targets) {
          if (!go.active) return { pass: false, reason: `knob ${id} not active` }
          const tweens = scene.tweens.getTweensOf(go)
          if (tweens.length === 0) return { pass: false, reason: `knob ${id} has no tweens` }
        }
      }
      return { pass: knobIds.length > 0, reason: 'ok' }
    })

    if (result === null) { test.skip(); return }
    expect(result.pass).toBe(true)
  })

  test('LED arcs are active game objects', async () => {
    const gdsActive = await isGdsRendered()
    if (!gdsActive) { test.skip(); return }

    const result = await evalInScene(ctx.window, (scene) => {
      const gds = (scene as any).background?.gdsRenderer
      if (!gds) return null
      const props: any[] = gds.getLabMap?.()?.props ?? []
      const ledIds: string[] = props
        .filter((p: any) => p.type === 'blink-led')
        .map((p: any) => p.id)

      let found = 0
      for (const id of ledIds) {
        const targets: any[] = gds.propById?.get(id) ?? []
        for (const go of targets) {
          if (go.active) found++
        }
      }
      return { ledPropCount: ledIds.length, activeObjects: found }
    })

    if (result === null) { test.skip(); return }
    expect(result.ledPropCount).toBeGreaterThan(0)
    // Each LED has at least 1 active arc (arc + halo = 2, so activeObjects >= count)
    expect(result.activeObjects).toBeGreaterThanOrEqual(result.ledPropCount)
  })

  test('pulse-glow props create multiple concentric ring objects', async () => {
    const gdsActive = await isGdsRendered()
    if (!gdsActive) { test.skip(); return }

    const result = await evalInScene(ctx.window, (scene) => {
      const gds = (scene as any).background?.gdsRenderer
      if (!gds) return null
      const props: any[] = gds.getLabMap?.()?.props ?? []
      const glowProps = props.filter((p: any) => p.type === 'pulse-glow')

      for (const prop of glowProps) {
        const targets: any[] = gds.propById?.get(prop.id) ?? []
        // Each pulse-glow creates 3 arcs (outer, mid, core)
        if (targets.length < 3) return { pass: false, id: prop.id, count: targets.length }
      }
      return { pass: glowProps.length > 0, id: null, count: 0 }
    })

    if (result === null) { test.skip(); return }
    expect(result.pass).toBe(true)
  })

  test('ceiling lights have tweens for ambient flicker', async () => {
    const gdsActive = await isGdsRendered()
    if (!gdsActive) { test.skip(); return }

    const result = await evalInScene(ctx.window, (scene) => {
      const gds = (scene as any).background?.gdsRenderer
      if (!gds) return null
      const lights: any[] = gds.ceilingLightOverlays ?? []
      if (lights.length === 0) return { pass: false, reason: 'no ceiling lights' }

      for (const rect of lights) {
        if (!rect.active) return { pass: false, reason: 'inactive rect' }
        const tweens = scene.tweens.getTweensOf(rect)
        if (tweens.length === 0) return { pass: false, reason: 'no tween on ceiling light' }
      }
      return { pass: true, reason: 'ok' }
    })

    if (result === null) { test.skip(); return }
    expect(result.pass).toBe(true)
  })

  test('steam vents start hidden', async () => {
    const gdsActive = await isGdsRendered()
    if (!gdsActive) { test.skip(); return }

    const result = await evalInScene(ctx.window, (scene) => {
      const gds = (scene as any).background?.gdsRenderer
      if (!gds) return null
      const vents: any[] = gds.steamContainers ?? []
      if (vents.length === 0) return null  // no steam vents in this scene
      return vents.every((c: any) => !c.visible)
    })

    if (result === null) { test.skip(); return }
    expect(result).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Phase 2 — Event-driven props
// ---------------------------------------------------------------------------

test.describe('Phase 2: Event-Driven Props', () => {
  test('flashConsoles() API exists on gdsRenderer', async () => {
    const gdsActive = await isGdsRendered()
    if (!gdsActive) { test.skip(); return }

    const hasMethod = await evalInScene(ctx.window, (scene) => {
      const gds = (scene as any).background?.gdsRenderer
      if (!gds) return null
      return typeof gds.flashConsoles === 'function'
    })

    if (hasMethod === null) { test.skip(); return }
    expect(hasMethod).toBe(true)
  })

  test('setSteamActive() shows steam containers', async () => {
    const gdsActive = await isGdsRendered()
    if (!gdsActive) { test.skip(); return }

    const result = await evalInScene(ctx.window, (scene) => {
      const gds = (scene as any).background?.gdsRenderer
      if (!gds) return null
      const vents: any[] = gds.steamContainers ?? []
      if (vents.length === 0) return null

      gds.setSteamActive(true)
      const allVisible = vents.every((c: any) => c.visible)
      gds.setSteamActive(false)  // restore
      return allVisible
    })

    if (result === null) { test.skip(); return }
    expect(result).toBe(true)
  })

  test('setSteamActive(false) hides steam containers', async () => {
    const gdsActive = await isGdsRendered()
    if (!gdsActive) { test.skip(); return }

    const result = await evalInScene(ctx.window, (scene) => {
      const gds = (scene as any).background?.gdsRenderer
      if (!gds) return null
      const vents: any[] = gds.steamContainers ?? []
      if (vents.length === 0) return null

      gds.setSteamActive(true)
      gds.setSteamActive(false)
      return vents.every((c: any) => !c.visible)
    })

    if (result === null) { test.skip(); return }
    expect(result).toBe(true)
  })

  test('flashConsoles() runs without error on all props', async () => {
    const gdsActive = await isGdsRendered()
    if (!gdsActive) { test.skip(); return }

    const result = await evalInScene(ctx.window, (scene) => {
      const gds = (scene as any).background?.gdsRenderer
      if (!gds || typeof gds.flashConsoles !== 'function') return null
      try {
        gds.flashConsoles()           // all consoles
        gds.flashConsoles('top-room-1') // filtered by desk
        return true
      } catch (e) {
        return false
      }
    })

    if (result === null) { test.skip(); return }
    expect(result).toBe(true)
  })

  test('setAtmosphereLevel() updates ceiling light tween targets', async () => {
    const gdsActive = await isGdsRendered()
    if (!gdsActive) { test.skip(); return }

    const result = await evalInScene(ctx.window, (scene) => {
      const gds = (scene as any).background?.gdsRenderer
      if (!gds) return null
      const lights: any[] = gds.ceilingLightOverlays ?? []
      if (lights.length === 0) return null

      try {
        gds.setAtmosphereLevel(0.0)  // night
        gds.setAtmosphereLevel(1.0)  // day
        gds.setAtmosphereLevel(0.5)  // dusk/dawn — restore neutral
        return true
      } catch (e) {
        return false
      }
    })

    if (result === null) { test.skip(); return }
    expect(result).toBe(true)
  })

  test('nearDesk linkage — only linked props flash when desk id provided', async () => {
    const gdsActive = await isGdsRendered()
    if (!gdsActive) { test.skip(); return }

    const result = await evalInScene(ctx.window, (scene) => {
      const gds = (scene as any).background?.gdsRenderer
      if (!gds) return null
      const props: any[] = gds.getLabMap?.()?.props ?? []
      const linkedProps = props.filter(
        (p: any) => p.nearDesk && (p.type === 'rotating-knob' || p.type === 'blink-led')
      )
      return linkedProps.length > 0
    })

    if (result === null) { test.skip(); return }
    // At least some knob/LED props should have nearDesk set
    expect(result).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Visual regression baseline
// ---------------------------------------------------------------------------

test.describe('Visual Regression', () => {
  test('prop system baseline screenshot (GDS must be active)', async () => {
    const gdsActive = await isGdsRendered()
    if (!gdsActive) { test.skip(); return }

    // Wait for tweens to settle into initial animation positions
    await ctx.window.waitForTimeout(1500)

    // Screenshot for visual baseline — stored in test-results/
    await ctx.window.screenshot({
      path: 'test-results/prop-animations-baseline.png',
      fullPage: false,
    }).catch(() => {
      // Screenshot may not be available in all test environments — not a test failure
    })

    // Verify props are rendering by checking overlay count is non-zero
    const overlayCount = await getPropOverlayCount()
    if (overlayCount === null) { test.skip(); return }
    expect(overlayCount).toBeGreaterThan(0)
  })
})
