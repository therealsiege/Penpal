import { vi } from 'vitest'

// Keep Electron imports safe in Node-only unit tests.
vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getPath: () => '/tmp',
    whenReady: () => Promise.resolve(),
    on: vi.fn(),
    quit: vi.fn(),
  },
  ipcMain: {
    handle: vi.fn(),
    removeHandler: vi.fn(),
    on: vi.fn(),
  },
  BrowserWindow: vi.fn(),
  shell: { openExternal: vi.fn() },
  dialog: { showErrorBox: vi.fn() },
}))
