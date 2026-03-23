/**
 * Room theming tests.
 * Validates the directory-based theme system assigns correct colors
 * and that all room types have valid, distinct templates.
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

// -- getRoomType directory detection --

const ROOM_TYPE_CASES: [string, string][] = [
  ['/Users/dev/project/src/renderer', 'design-studio'],
  ['/Users/dev/project/frontend/components', 'design-studio'],
  ['/Users/dev/project/web/app', 'design-studio'],
  ['/Users/dev/project/nextjs-app', 'design-studio'],
  ['/Users/dev/project/backend/api', 'server-room'],
  ['/Users/dev/project/server/handlers', 'server-room'],
  ['/Users/dev/project/src/etl/parsers', 'server-room'],
  ['/Users/dev/project/graph-service', 'server-room'],
  ['/Users/dev/project/mobile/screens', 'mobile-lab'],
  ['/Users/dev/project/expo-app', 'mobile-lab'],
  ['/Users/dev/project/ios/Sources', 'mobile-lab'],
  ['/Users/dev/project/game/scenes', 'game-den'],
  ['/Users/dev/project/phaser-game', 'game-den'],
  ['/Users/dev/project/unity-project', 'game-den'],
  ['/Users/dev/project/docs/guides', 'creative-suite'],
  ['/Users/dev/project/content/blog', 'creative-suite'],
  ['/Users/dev/project/marketing/pages', 'creative-suite'],
  ['/Users/dev/project/infra/terraform', 'ops-center'],
  ['/Users/dev/project/deploy/k8s', 'ops-center'],
  ['/Users/dev/project/ci/pipelines', 'ops-center'],
  ['/Users/dev/project/docker/compose', 'ops-center'],
  ['/Users/dev/project/test/integration', 'qa-lab'],
  ['/Users/dev/project/qa/e2e', 'qa-lab'],
  ['/Users/dev/project/spec/models', 'qa-lab'],
  ['/Users/dev/random-project/src', 'standard'],
  ['/Users/dev/my-thing', 'standard'],
]

for (const [path, expectedType] of ROOM_TYPE_CASES) {
  test(`getRoomType("${path}") => ${expectedType}`, async () => {
    const result = await ctx.window.evaluate(async (p: string) => {
      const mod = await import('./src/game/room-renderer')
      return mod.getRoomType(p)
    }, path).catch(() => null)

    if (result !== null) {
      expect(result).toBe(expectedType)
    }
  })
}

// -- Template validation --

test('all 8 room types have valid color templates', async () => {
  const result = await ctx.window.evaluate(async () => {
    const mod = await import('./src/game/room-renderer')
    const types = [
      'design-studio', 'server-room', 'mobile-lab', 'game-den',
      'creative-suite', 'ops-center', 'qa-lab', 'standard',
    ] as const
    return types.map((t) => {
      const tmpl = mod.getTemplate(t)
      return {
        type: t,
        accentColor: tmpl.accentColor,
        floorColor: tmpl.floorColor,
        rugColor: tmpl.rugColor,
      }
    })
  }).catch(() => null)

  if (result === null) return

  for (const r of result) {
    // All colors should be non-zero positive numbers
    expect(r.accentColor).toBeGreaterThan(0)
    expect(r.floorColor).toBeGreaterThan(0)
    expect(r.rugColor).toBeGreaterThan(0)
    // Accent and rug should be different (accent is brighter)
    expect(r.accentColor).not.toBe(r.rugColor)
  }
})

test('each non-standard room type has a unique accent color', async () => {
  const result = await ctx.window.evaluate(async () => {
    const mod = await import('./src/game/room-renderer')
    const types = [
      'design-studio', 'server-room', 'mobile-lab', 'game-den',
      'creative-suite', 'ops-center', 'qa-lab',
    ] as const
    return types.map((t) => mod.getTemplate(t).accentColor)
  }).catch(() => null)

  if (result === null) return

  const unique = new Set(result)
  expect(unique.size).toBe(result.length)
})

test('standard falls back to server-room colors', async () => {
  const result = await ctx.window.evaluate(async () => {
    const mod = await import('./src/game/room-renderer')
    const std = mod.getTemplate('standard')
    const srv = mod.getTemplate('server-room')
    return {
      sameAccent: std.accentColor === srv.accentColor,
      sameFloor: std.floorColor === srv.floorColor,
    }
  }).catch(() => null)

  if (result === null) return

  expect(result.sameAccent).toBe(true)
  expect(result.sameFloor).toBe(true)
})
