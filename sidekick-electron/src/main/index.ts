import { app, BrowserWindow, nativeImage, shell } from 'electron'
import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
import { registerIpcHandlers } from './ipc'
import { closeGraph } from './graph'
import { loadAgentConfigs } from './agents'
import { registerPtyHandlers, destroyAllPtys } from './pty'
import { startSlackBridge, stopSlackBridge } from './slack-bridge'

// Load sidekick-graph's .env for Memgraph/Qdrant connection strings
// __dirname is out/main (or src/main in dev) — go up to sidekick-electron/
// then up one more to sidekick/, then into sidekick-graph/
const ELECTRON_ROOT = path.resolve(__dirname, '..', '..')
const SIDEKICK_GRAPH = path.join(ELECTRON_ROOT, '..', 'sidekick-graph')
// Fallback: if we're already at the vault root (sidekick/), check sibling
const envPath = fs.existsSync(path.join(SIDEKICK_GRAPH, '.env'))
  ? path.join(SIDEKICK_GRAPH, '.env')
  : path.join(ELECTRON_ROOT, 'sidekick-graph', '.env')
dotenv.config({ path: envPath })

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#020617',
    icon: path.join(__dirname, '../../resources/icon.png'),
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: false,
    },
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    console.error('[renderer crashed]', details)
  })
}

app.whenReady().then(() => {
  // Set dock icon (macOS) — ensures custom icon in dev mode
  if (process.platform === 'darwin') {
    const dockIcon = nativeImage.createFromPath(
      path.join(__dirname, '../../resources/icon.png')
    )
    if (!dockIcon.isEmpty()) app.dock.setIcon(dockIcon)
  }

  loadAgentConfigs()
  registerIpcHandlers()
  registerPtyHandlers()
  createWindow()
  startSlackBridge()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', async () => {
  destroyAllPtys()
  await stopSlackBridge()
  await closeGraph()
})
