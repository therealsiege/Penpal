/**
 * Playwright coverage for PH.loadFixture, record/replay, profile, listCommands.
 */

import { test, expect } from '@playwright/test'
import { launchApp, waitForPhaser, type AppContext } from './electron.setup'

let ctx: AppContext

test.beforeAll(async () => {
  ctx = await launchApp()
  await waitForPhaser(ctx.window)
  await ctx.window.waitForTimeout(2000)
})

test.afterAll(async () => {
  await ctx.app.close()
})

test.describe('PH fixtures', () => {
  test('loadFixture loads all-blocked with every agent needing interaction', async () => {
    const out = await ctx.window.evaluate(() => {
      const PH = (window as any).PH
      PH.clearAgents()
      PH.loadFixture('all-blocked')
      const rows = PH.getAgentsSummary()
      return {
        count: rows.length,
        allBlocked: rows.every((r: { needsInteraction: boolean }) => r.needsInteraction === true),
        types: rows.map((r: { interactionType: string }) => r.interactionType),
      }
    })
    expect(out.count).toBe(5)
    expect(out.allBlocked).toBe(true)
    expect(new Set(out.types).size).toBeGreaterThanOrEqual(3)
  })

  test('loadFixture mixed-ranks exposes varied XP and pod roles', async () => {
    const out = await ctx.window.evaluate(() => {
      const PH = (window as any).PH
      PH.clearAgents()
      PH.loadFixture('mixed-ranks')
      return PH.getAgentsSummary() as Array<{ xpLevel: number; podRole: string }>
    })
    expect(out.length).toBe(6)
    const levels = new Set(out.map(r => r.xpLevel))
    expect(levels.size).toBeGreaterThan(3)
    const roles = new Set(out.map(r => r.podRole))
    expect(roles.has('solver')).toBe(true)
    expect(roles.has('reviewer')).toBe(true)
    expect(roles.has('executor')).toBe(true)
  })

  test('fixtureNames lists at least bundled fixtures', async () => {
    const names = await ctx.window.evaluate(() => (window as any).PH.fixtureNames() as string[])
    expect(names.length).toBeGreaterThanOrEqual(5)
    for (const n of ['minimal-smoke', 'high-stress-office', 'all-blocked', 'mixed-ranks', 'mixed-modes']) {
      expect(names).toContain(n)
    }
  })
})

test.describe('PH record / replay', () => {
  test('round-trip replay restores agent summary', async () => {
    const result = await ctx.window.evaluate(async () => {
      const PH = (window as any).PH
      PH.timeScale(1)
      PH.record()
      PH.clearAgents()
      const ids = PH.addAgents(2, { sessionMode: 'working', xpLevel: 3 })
      PH.transition(ids[0], 'idle')
      PH.block(ids[1], 'question')
      const seq = PH.stopRecording()
      const expected = JSON.stringify(PH.getAgentsSummary())
      PH.clearAgents()
      PH.replay(seq)
      const deadline = Date.now() + 8000
      while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 40))
        if (JSON.stringify(PH.getAgentsSummary()) === expected) {
          return { ok: true as const, events: seq.events.length }
        }
      }
      return { ok: false as const, got: PH.getAgentsSummary(), events: seq.events.length }
    })
    expect(result.ok).toBe(true)
    expect(result.events).toBeGreaterThanOrEqual(3)
  })

  test('stopRecording without record returns empty sequence', async () => {
    const seq = await ctx.window.evaluate(() => {
      const PH = (window as any).PH
      return PH.stopRecording()
    })
    expect(seq.version).toBe(1)
    expect(seq.events).toEqual([])
  })
})

test.describe('PH profile', () => {
  test('profile(ms) returns fps, drops, renderCalls, memory fields', async () => {
    const report = await ctx.window.evaluate(async () => {
      const PH = (window as any).PH
      PH.timeScale(1)
      return await PH.profile(1500)
    })
    expect(report.durationMs).toBe(1500)
    expect(typeof report.avgFps).toBe('number')
    expect(report.avgFps).toBeGreaterThan(0)
    expect(typeof report.minFps).toBe('number')
    expect(typeof report.maxFps).toBe('number')
    expect(typeof report.frameDrops).toBe('number')
    expect(typeof report.renderCalls).toBe('number')
    expect(report.renderCalls).toBeGreaterThan(0)
    expect(report.avgMemoryMB === null || typeof report.avgMemoryMB === 'number').toBe(true)
    expect(report.peakMemoryMB === null || typeof report.peakMemoryMB === 'number').toBe(true)
    expect(typeof report.sampleFrames).toBe('number')
  })
})

test.describe('PH documentation surface', () => {
  test('listCommands includes new APIs', async () => {
    const cmds = await ctx.window.evaluate(() => (window as any).PH.listCommands() as string[])
    for (const c of ['loadFixture', 'record', 'stopRecording', 'replay', 'profile', 'getAgentsSummary', 'fixtureNames']) {
      expect(cmds).toContain(c)
    }
  })
})
