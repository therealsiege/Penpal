import { app, BrowserWindow, nativeImage, shell } from 'electron'
import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
import { registerIpcHandlers } from './ipc'
import { closeGraph } from './graph'
import { loadAgentConfigs } from './agents'
import { registerPtyHandlers, destroyAllPtys } from './pty'
import { startSlackBridge, stopSlackBridge } from './slack-bridge'
import { protocol } from 'electron'
import { registerVaultProtocol } from './vault'
import { registerSoundboardProtocol } from './soundboard'

// Register custom schemes as privileged before app is ready
// This allows them to be used by media elements (Audio, Video)
protocol.registerSchemesAsPrivileged([
  { scheme: 'penny-sfx', privileges: { stream: true, supportFetchAPI: true, bypassCSP: true } },
])
import { startFileWatcher, stopFileWatcher } from './file-watcher'
import { startOrchestrator, stopOrchestrator } from './orchestrator'

// Load analytics/.env for Memgraph/Qdrant connection strings
// __dirname is out/main (or src/main in dev) — go up to Penny/
// then up one more to sidekick/, then into analytics/
const ELECTRON_ROOT = path.resolve(__dirname, '..', '..')
const SIDEKICK_GRAPH = path.join(ELECTRON_ROOT, '..', 'analytics')
// Fallback: if we're already at the vault root (sidekick/), check sibling
const envPath = fs.existsSync(path.join(SIDEKICK_GRAPH, '.env'))
  ? path.join(SIDEKICK_GRAPH, '.env')
  : path.join(ELECTRON_ROOT, 'analytics', '.env')
dotenv.config({ path: envPath })

// Optionally load Penny-controlled infra variables (Veritas, docker controls).
const pennyEnvPath = path.join(ELECTRON_ROOT, '.env')
if (fs.existsSync(pennyEnvPath)) {
  dotenv.config({ path: pennyEnvPath, override: false })
}
const controlPlaneEnvPath = process.env.PENNY_VERITAS_ENV_FILE || path.join(ELECTRON_ROOT, 'docker', '.env.control-plane')
if (fs.existsSync(controlPlaneEnvPath)) {
  dotenv.config({ path: controlPlaneEnvPath, override: false })
}

// Prevent EPIPE from Slack bridge logger crashing the app
process.on('uncaughtException', (err) => {
  if (err.message?.includes('EPIPE')) return
  console.error('[uncaughtException]', err)
})

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

  registerVaultProtocol()
  registerSoundboardProtocol()
  loadAgentConfigs()
  registerIpcHandlers()
  registerPtyHandlers()
  createWindow()
  startSlackBridge()
  startFileWatcher()
  startOrchestrator()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', async () => {
  stopFileWatcher()
  stopOrchestrator()
  destroyAllPtys()
  await stopSlackBridge()
  await closeGraph()
})
