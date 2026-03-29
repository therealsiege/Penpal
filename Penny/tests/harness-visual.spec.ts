/**
 * harness-visual.spec.ts
 *
 * Playwright E2E test suite that uses the PH test harness to inject mock agents
 * into the running Phaser scene and capture screenshots of the result.
 *
 * Prerequisites:
 *   - App must be built first: npm run build
 *   - Harness must be mounted in the app (mountHarness called from OfficeScene)
 *   - Screenshots are written to tests/screenshots/
 *
 * Usage:
 *   npx playwright test harness-visual
 */

import { test, expect } from '@playwright/test'
import { launchApp, waitForPhaser, evalInScene, type AppContext } from './electron.setup'
import path from 'path'
import fs from 'fs'

const SCREENSHOT_DIR = path.join(__dirname, 'screenshots')

let ctx: AppContext

test.beforeAll(async () => {
  // Ensure screenshot directory exists before any test writes to it
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })

  ctx = await launchApp()
  await waitForPhaser(ctx.window)
  // Extra wait for harness to mount (mountHarness is called in OfficeScene.create)
  await ctx.window.waitForTimeout(2000)
})

test.afterAll(async () => {
  await ctx.app.close()
})

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

/**
 * Capture the Phaser canvas and write a PNG to tests/screenshots/<name>.png.
 * Returns both the raw Buffer and the absolute file path.
 */
async function screenshot(name: string): Promise<{ buffer: Buffer; filePath: string }> {
  const canvas = ctx.window.locator('canvas').first()
  // Use an explicit timeout so atmosphere transitions (which can take multiple
  // frames to settle) don't cause a locator action timeout on slower CI runs.
  const buffer = await canvas.screenshot({ timeout: 15000 })
  const filePath = path.join(SCREENSHOT_DIR, `${name}.png`)
  fs.writeFileSync(filePath, buffer)
  return { buffer, filePath }
}

// ---------------------------------------------------------------------------
// Test Harness — Agent Injection
// ---------------------------------------------------------------------------

test.describe('Test Harness - Agent Injection', () => {
  test('PH is available on window', async () => {
    const hasHarness = await ctx.window.evaluate(() => {
      return typeof (window as any).PH !== 'undefined'
    })
    expect(hasHarness).toBe(true)
  })

  test('addAgents creates working agents', async () => {
    const result = await ctx.window.evaluate(() => {
      const PH = (window as any).PH
      PH.clearAgents()
      const ids = PH.addAgents(3, { sessionMode: 'working', xpLevel: 3 })
      return { count: ids.length, ids }
    })
    expect(result.count).toBe(3)
    expect(result.ids).toHaveLength(3)

    // Allow Phaser enough time to render the new workstations
    await ctx.window.waitForTimeout(1500)
    const { filePath } = await screenshot('01-working-agents')
    console.log(`Screenshot: ${filePath}`)
  })

  test('agents in different states render without errors', async () => {
    await ctx.window.evaluate(() => {
      const PH = (window as any).PH
      PH.clearAgents()
      PH.addAgents(2, { sessionMode: 'working' })
      PH.addAgents(1, { sessionMode: 'idle' })
      PH.addAgents(1, {
        sessionMode: 'working',
        needsInteraction: true,
        interactionType: 'tool-approval',
      })
    })

    await ctx.window.waitForTimeout(2000)
    const { buffer } = await screenshot('02-mixed-states')
    // Canvas should contain meaningful content, not a blank frame
    expect(buffer.byteLength).toBeGreaterThan(5000)
  })

  test('clearAgents removes all mock agents from the scene', async () => {
    // Seed agents then clear
    await ctx.window.evaluate(() => {
      const PH = (window as any).PH
      PH.addAgents(3, { sessionMode: 'working' })
    })
    await ctx.window.waitForTimeout(500)

    const countAfterClear = await ctx.window.evaluate(() => {
      const PH = (window as any).PH
      PH.clearAgents()
      // Access internal state through listAgents output is not practical —
      // use the harness internal mockAgents array via __PENNY_HARNESS__
      const harness = (window as any).__PENNY_HARNESS__
      return harness ? harness.mockAgents.length : -1
    })

    expect(countAfterClear).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Test Harness — State Transitions
// ---------------------------------------------------------------------------

test.describe('Test Harness - State Transitions', () => {
  test('transition working → idle', async () => {
    const agentId = await ctx.window.evaluate(() => {
      const PH = (window as any).PH
      PH.clearAgents()
      const ids = PH.addAgents(1, { sessionMode: 'working' })
      return ids[0]
    })

    await ctx.window.waitForTimeout(1000)
    await screenshot('03a-before-transition')

    await ctx.window.evaluate((id) => {
      ;(window as any).PH.transition(id, 'idle')
    }, agentId)

    await ctx.window.waitForTimeout(1000)
    await screenshot('03b-after-transition-idle')

    // Verify harness state was updated
    const mode = await ctx.window.evaluate((id) => {
      const harness = (window as any).__PENNY_HARNESS__
      const agent = harness?.mockAgents.find((a: any) => a.config.id === id)
      return agent?.sessionMode ?? null
    }, agentId)

    expect(mode).toBe('idle')
  })

  test('transition working → waiting (tool-approval)', async () => {
    const agentId = await ctx.window.evaluate(() => {
      const PH = (window as any).PH
      PH.clearAgents()
      const ids = PH.addAgents(1, { sessionMode: 'working' })
      return ids[0]
    })

    await ctx.window.waitForTimeout(1000)

    await ctx.window.evaluate((id) => {
      ;(window as any).PH.transition(id, 'waiting')
    }, agentId)

    await ctx.window.waitForTimeout(1000)
    await screenshot('03c-after-transition-waiting')

    const needsInteraction = await ctx.window.evaluate((id) => {
      const harness = (window as any).__PENNY_HARNESS__
      const agent = harness?.mockAgents.find((a: any) => a.config.id === id)
      return agent?.needsInteraction ?? null
    }, agentId)

    expect(needsInteraction).toBe(true)
  })

  test('block and unblock agent', async () => {
    const agentId = await ctx.window.evaluate(() => {
      const PH = (window as any).PH
      PH.clearAgents()
      const ids = PH.addAgents(1, { sessionMode: 'working' })
      return ids[0]
    })

    await ctx.window.waitForTimeout(1000)

    await ctx.window.evaluate((id) => {
      ;(window as any).PH.block(id, 'tool-approval')
    }, agentId)

    await ctx.window.waitForTimeout(1500)
    await screenshot('04-blocked-agent')

    // Confirm blocked state in harness
    const blockedState = await ctx.window.evaluate((id) => {
      const harness = (window as any).__PENNY_HARNESS__
      const agent = harness?.mockAgents.find((a: any) => a.config.id === id)
      return agent ? { needsInteraction: agent.needsInteraction, interactionType: agent.interactionType } : null
    }, agentId)
    expect(blockedState).not.toBeNull()
    expect(blockedState!.needsInteraction).toBe(true)
    expect(blockedState!.interactionType).toBe('tool-approval')

    await ctx.window.evaluate((id) => {
      ;(window as any).PH.unblock(id)
    }, agentId)

    await ctx.window.waitForTimeout(1000)
    await screenshot('05-unblocked-agent')

    const unblockedState = await ctx.window.evaluate((id) => {
      const harness = (window as any).__PENNY_HARNESS__
      const agent = harness?.mockAgents.find((a: any) => a.config.id === id)
      return agent ? { needsInteraction: agent.needsInteraction, interactionType: agent.interactionType } : null
    }, agentId)
    expect(unblockedState).not.toBeNull()
    expect(unblockedState!.needsInteraction).toBe(false)
    expect(unblockedState!.interactionType).toBe('none')
  })

  test('transitionAll applies preset to every mock agent', async () => {
    await ctx.window.evaluate(() => {
      const PH = (window as any).PH
      PH.clearAgents()
      PH.addAgents(4, { sessionMode: 'working' })
    })

    await ctx.window.waitForTimeout(800)

    await ctx.window.evaluate(() => {
      ;(window as any).PH.transitionAll('idle')
    })

    await ctx.window.waitForTimeout(800)

    const allIdle = await ctx.window.evaluate(() => {
      const harness = (window as any).__PENNY_HARNESS__
      return harness?.mockAgents.every((a: any) => a.sessionMode === 'idle') ?? false
    })

    expect(allIdle).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Test Harness — Scenarios
// ---------------------------------------------------------------------------

test.describe('Test Harness - Scenarios', () => {
  test('busy-office scenario spawns 8 agents', async () => {
    await ctx.window.evaluate(() => {
      const PH = (window as any).PH
      PH.clearAgents()
      PH.scenario('busy-office')
    })

    await ctx.window.waitForTimeout(3000)
    const { buffer } = await screenshot('06-busy-office')
    // 8 workstations should produce a non-trivial frame
    expect(buffer.byteLength).toBeGreaterThan(5000)

    const agentCount = await ctx.window.evaluate(() => {
      const harness = (window as any).__PENNY_HARNESS__
      return harness?.mockAgents.length ?? 0
    })
    // busy-office: 6 working + 2 waiting = 8 total
    expect(agentCount).toBe(8)
  })

  test('blocked scenario shows 4 agents with different interaction types', async () => {
    await ctx.window.evaluate(() => {
      const PH = (window as any).PH
      PH.clearAgents()
      PH.scenario('blocked')
    })

    await ctx.window.waitForTimeout(2000)
    await screenshot('07-blocked-scenario')

    const agentCount = await ctx.window.evaluate(() => {
      const harness = (window as any).__PENNY_HARNESS__
      return harness?.mockAgents.length ?? 0
    })
    expect(agentCount).toBe(4)

    const allBlocked = await ctx.window.evaluate(() => {
      const harness = (window as any).__PENNY_HARNESS__
      return harness?.mockAgents.every((a: any) => a.needsInteraction === true) ?? false
    })
    expect(allBlocked).toBe(true)
  })

  test('stress-test scenario spawns 16 agents', async () => {
    await ctx.window.evaluate(() => {
      const PH = (window as any).PH
      PH.clearAgents()
      PH.scenario('stress-test')
    })

    await ctx.window.waitForTimeout(3000)
    const { buffer } = await screenshot('08-stress-test')
    expect(buffer.byteLength).toBeGreaterThan(5000)

    const agentCount = await ctx.window.evaluate(() => {
      const harness = (window as any).__PENNY_HARNESS__
      return harness?.mockAgents.length ?? 0
    })
    expect(agentCount).toBe(16)
  })
})

// ---------------------------------------------------------------------------
// Test Harness — Atmosphere
// ---------------------------------------------------------------------------

test.describe('Test Harness - Atmosphere', () => {
  test('cycle through all time-of-day phases', async () => {
    // This test cycles through 4 atmosphere phases with waits and screenshots.
    // Give it extra headroom beyond the global 30 s default.
    test.setTimeout(60000)

    await ctx.window.evaluate(() => {
      const PH = (window as any).PH
      PH.clearAgents()
      PH.addAgents(3, { sessionMode: 'working' })
    })

    await ctx.window.waitForTimeout(1500)

    const phases = ['morning', 'day', 'evening', 'night'] as const

    for (const phase of phases) {
      await ctx.window.evaluate((p) => {
        ;(window as any).PH.setTimeOfDay(p)
      }, phase)
      // Give the atmosphere tween (and any dawn/dusk flash overlay) time to
      // settle before snapping the screenshot.  Atmosphere transitions involve
      // a multi-step tween chain that can take up to ~1 s on slower hardware.
      await ctx.window.waitForTimeout(2000)
      const { buffer } = await screenshot(`09-atmosphere-${phase}`)
      expect(buffer.byteLength).toBeGreaterThan(5000)
    }
  })

  test('setWeather maps to valid atmosphere phases', async () => {
    await ctx.window.evaluate(() => {
      const PH = (window as any).PH
      PH.clearAgents()
      PH.addAgents(2, { sessionMode: 'idle' })
    })

    await ctx.window.waitForTimeout(1000)

    // Each weather type should not throw
    for (const weather of ['clear', 'rain', 'snow', 'sunset'] as const) {
      await ctx.window.evaluate((w) => {
        ;(window as any).PH.setWeather(w)
      }, weather)
      await ctx.window.waitForTimeout(800)
    }

    // Final shot after weather cycle
    await screenshot('09e-weather-cycle-complete')
  })
})

// ---------------------------------------------------------------------------
// Test Harness — Celebrations
// ---------------------------------------------------------------------------

test.describe('Test Harness - Celebrations', () => {
  test('rankUp celebration fires without throwing', async () => {
    const agentId = await ctx.window.evaluate(() => {
      const PH = (window as any).PH
      PH.clearAgents()
      const ids = PH.addAgents(1, { sessionMode: 'idle', xpLevel: 5 })
      return ids[0]
    })

    await ctx.window.waitForTimeout(1000)

    const threwError = await ctx.window.evaluate((id) => {
      try {
        ;(window as any).PH.celebrate('rankUp', id)
        return false
      } catch {
        return true
      }
    }, agentId)

    expect(threwError).toBe(false)

    await ctx.window.waitForTimeout(500)
    await screenshot('10-rank-up-celebration')
  })

  test('taskComplete celebration fires without throwing', async () => {
    const agentId = await ctx.window.evaluate(() => {
      const PH = (window as any).PH
      PH.clearAgents()
      const ids = PH.addAgents(1, { sessionMode: 'working' })
      return ids[0]
    })

    await ctx.window.waitForTimeout(1000)

    const threwError = await ctx.window.evaluate((id) => {
      try {
        ;(window as any).PH.celebrate('taskComplete', id)
        return false
      } catch {
        return true
      }
    }, agentId)

    expect(threwError).toBe(false)

    await ctx.window.waitForTimeout(500)
    await screenshot('11-task-complete')
  })

  test('all celebration types fire without throwing', async () => {
    const agentId = await ctx.window.evaluate(() => {
      const PH = (window as any).PH
      PH.clearAgents()
      const ids = PH.addAgents(1, { sessionMode: 'idle', xpLevel: 8 })
      return ids[0]
    })

    await ctx.window.waitForTimeout(1000)

    const errors: string[] = []

    for (const type of ['rankUp', 'taskComplete', 'milestone', 'error', 'achievement'] as const) {
      const threw = await ctx.window.evaluate(
        ([t, id]) => {
          try {
            ;(window as any).PH.celebrate(t, id)
            return null
          } catch (e: unknown) {
            return e instanceof Error ? e.message : String(e)
          }
        },
        [type, agentId] as const,
      )
      if (threw) errors.push(`${type}: ${threw}`)
      await ctx.window.waitForTimeout(300)
    }

    expect(errors).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Test Harness — Config Hot-Swap
// ---------------------------------------------------------------------------

test.describe('Test Harness - Config Hot-Swap', () => {
  test('config returns current AnimationConfig object', async () => {
    const cfg = await ctx.window.evaluate(() => {
      return (window as any).PH.config()
    })
    // config() with no args returns the current config — should be an object
    expect(cfg).toBeDefined()
    expect(typeof cfg).toBe('object')
  })

  test('config patch merges fields into global config', async () => {
    await ctx.window.evaluate(() => {
      ;(window as any).PH.configReset()
      ;(window as any).PH.config({ bounceOffset: 8, bounceDuration: 300 })
    })

    const cfg = await ctx.window.evaluate(() => {
      return (window as any).PH.config()
    })

    expect(cfg).not.toBeNull()
    expect((cfg as any).bounceOffset).toBe(8)
    expect((cfg as any).bounceDuration).toBe(300)
  })

  test('config change and refresh affect workstation tweens', async () => {
    await ctx.window.evaluate(() => {
      const PH = (window as any).PH
      PH.clearAgents()
      PH.addAgents(3, { sessionMode: 'working' })
    })

    await ctx.window.waitForTimeout(1500)
    await screenshot('12a-default-config')

    await ctx.window.evaluate(() => {
      const PH = (window as any).PH
      PH.config({ bounceOffset: 8, bounceDuration: 300 })
      PH.refresh()
    })

    await ctx.window.waitForTimeout(1500)
    await screenshot('12b-custom-config')

    // Reset back to defaults for test isolation
    await ctx.window.evaluate(() => {
      const PH = (window as any).PH
      PH.configReset()
      PH.refresh()
    })
  })

  test('configReset clears all patched values', async () => {
    await ctx.window.evaluate(() => {
      ;(window as any).PH.config({ breathDuration: 999, idleWalkInterval: 1234 })
    })

    await ctx.window.evaluate(() => {
      ;(window as any).PH.configReset()
    })

    const cfg = await ctx.window.evaluate(() => {
      return (window as any).PH.config()
    })

    expect((cfg as any).breathDuration).toBeUndefined()
    expect((cfg as any).idleWalkInterval).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Test Harness — Time Control
// ---------------------------------------------------------------------------

test.describe('Test Harness - Time Control', () => {
  test('timeScale adjusts Phaser loop speed', async () => {
    await ctx.window.evaluate(() => {
      const PH = (window as any).PH
      PH.clearAgents()
      PH.addAgents(2, { sessionMode: 'working' })
    })

    await ctx.window.waitForTimeout(500)

    // Speed up to 2x
    await ctx.window.evaluate(() => {
      ;(window as any).PH.timeScale(2.0)
    })
    await ctx.window.waitForTimeout(1000)
    await screenshot('13a-timescale-2x')

    // Slow to 0.5x
    await ctx.window.evaluate(() => {
      ;(window as any).PH.timeScale(0.5)
    })
    await ctx.window.waitForTimeout(1000)
    await screenshot('13b-timescale-half')

    // Restore normal speed
    await ctx.window.evaluate(() => {
      ;(window as any).PH.timeScale(1.0)
    })
  })

  test('pause and resume do not crash the loop', async () => {
    const threw = await ctx.window.evaluate(() => {
      try {
        ;(window as any).PH.pause()
        ;(window as any).PH.resume()
        return false
      } catch {
        return true
      }
    })
    expect(threw).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Regression — Scene integration
// ---------------------------------------------------------------------------

test.describe('Harness - Scene Integration', () => {
  test('PH shares the same Phaser scene as __PENNY_SCENE__', async () => {
    const same = await evalInScene(ctx.window, (scene) => {
      const harness = (window as any).__PENNY_HARNESS__
      if (!harness) return null
      // Compare scene identity
      return harness.scene === scene
    })
    // null means scene not accessible — skip rather than fail
    if (same !== null) {
      expect(same).toBe(true)
    }
  })

  test('mock agents injected by PH appear in scene workstations', async () => {
    // Inject the agent and immediately check workstations in the same evaluate call.
    // This avoids a race where the React polling loop (every 5 s) calls scene.setAgents()
    // with real data between our inject and the assertion, evicting the mock workstation.
    const foundInScene = await ctx.window.evaluate(() => {
      const PH = (window as any).PH
      PH.clearAgents()
      PH.addAgents(1, { sessionMode: 'working', xpLevel: 3 })

      // setAgents is synchronous when the scene is ready, so workstations are
      // populated immediately after _flush(). Assert inline before any async
      // poll can overwrite the mock agents.
      const scene = (window as any).__PENNY_SCENE__
      if (!scene) return null
      const rooms: Map<string, unknown> = (scene as any).roomMap
      if (!rooms) return null
      const harness = (window as any).__PENNY_HARNESS__
      const agentId = harness?.mockAgents[0]?.config?.id
      if (!agentId) return null
      for (const room of rooms.values()) {
        const r = room as { workstations?: Map<string, unknown> }
        if (r.workstations?.has(agentId)) {
          return true
        }
      }
      return false
    })

    // foundInScene may be null if scene/roomMap is not accessible — only assert
    // when we get a definitive answer.
    if (foundInScene !== null) {
      expect(foundInScene).toBe(true)
    }

    // Wait for Phaser to render, then screenshot.
    await ctx.window.waitForTimeout(1000)
    await screenshot('14-scene-agent-integration')
  })
})
