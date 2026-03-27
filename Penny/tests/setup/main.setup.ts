import { vi } from 'vitest'

// Main-process tests: mock Electron here so importing ipc/main modules does not load native Electron.
// Extend with ipcRenderer, nativeTheme, etc. when a test needs them. For node-pty, sqlite, or other
// native deps, add vi.mock in the test file or a tests/setup/*.ts fragment.
// Renderer tests mock window.api / preload via renderer.setup.ts or per-file vi.stubGlobal.
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
