/**
 * Electron test helpers — launches the built app via Playwright's Electron support.
 * Shared across all test files via beforeAll/afterAll.
 */

import { _electron as electron, type ElectronApplication, type Page } from 'playwright-core'
import path from 'path'

const PROJECT_ROOT = path.resolve(__dirname, '..')

export interface AppContext {
  app: ElectronApplication
  window: Page
}

/**
 * Launch the built Electron app. Caller must close via app.close().
 */
export async function launchApp(): Promise<AppContext> {
  const app = await electron.launch({
    args: [path.join(PROJECT_ROOT, 'out', 'main', 'index.js')],
    cwd: PROJECT_ROOT,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      ELECTRON_DISABLE_SANDBOX: '1',
    },
  })

  const window = await app.firstWindow()
  await window.waitForLoadState('domcontentloaded')

  return { app, window }
}

/**
 * Wait for Phaser to finish booting (canvas rendered + scene ready).
 */
export async function waitForPhaser(window: Page, timeoutMs = 5000): Promise<void> {
  await window.waitForSelector('canvas', { timeout: timeoutMs })
  // Give Phaser a couple frames to initialize the scene
  await window.waitForTimeout(2000)
}

/**
 * Evaluate a function inside the renderer process with access to the Phaser game.
 * Returns null if the scene isn't accessible.
 */
export async function evalInScene<T>(
  window: Page,
  fn: (scene: any) => T,
): Promise<T | null> {
  return window.evaluate((fnStr) => {
    // Prefer the explicit global set by OfficeGame.ts
    const scene = (window as any).__PENNY_SCENE__
    if (scene) {
      const fn = new Function('scene', `return (${fnStr})(scene)`)
      return fn(scene)
    }
    // Fallback: Phaser global registry
    const games = (window as any).Phaser?.GAMES
    if (!games?.length) return null
    const found = games[0].scene.scenes?.find(
      (s: any) => s.constructor?.name === 'OfficeScene' || s.sys?.config?.key === 'OfficeScene',
    )
    if (!found) return null
    const fn2 = new Function('scene', `return (${fnStr})(scene)`)
    return fn2(found)
  }, fn.toString())
}
