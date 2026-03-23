/**
 * Electron test helpers — launches the built app via Playwright's Electron support.
 *
 * Usage:
 *   const { app, window } = await launchApp()
 *   // ... assertions ...
 *   await app.close()
 */

import { _electron as electron, type ElectronApplication, type Page } from 'playwright-core'
import path from 'path'

const PROJECT_ROOT = path.resolve(__dirname, '..')

export interface AppContext {
  app: ElectronApplication
  window: Page
}

/**
 * Build the app (if not already built) and launch Electron.
 * Returns the ElectronApplication handle and the first BrowserWindow page.
 */
export async function launchApp(): Promise<AppContext> {
  const app = await electron.launch({
    args: [path.join(PROJECT_ROOT, 'out', 'main', 'index.js')],
    cwd: PROJECT_ROOT,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      // Suppress GPU sandbox warnings in CI
      ELECTRON_DISABLE_SANDBOX: '1',
    },
  })

  // Wait for the first BrowserWindow to open
  const window = await app.firstWindow()

  // Wait for the renderer to be interactive
  await window.waitForLoadState('domcontentloaded')

  return { app, window }
}
