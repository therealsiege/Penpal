import { app, BrowserWindow, shell } from 'electron'
import path from 'path'
import dotenv from 'dotenv'
import { registerIpcHandlers } from './ipc'
import { closeGraph } from './graph'

// Load sidekick-graph's .env for Memgraph/Qdrant connection strings
// In dev: __dirname is src/main, in prod build: __dirname is out/main
// Either way, go up to sidekick-electron/ then sibling sidekick-graph/
const SIDEKICK_GRAPH = path.resolve(__dirname, '..', '..', 'sidekick-graph')
dotenv.config({ path: path.join(SIDEKICK_GRAPH, '.env') })

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#020617',
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
}

app.whenReady().then(() => {
  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', async () => {
  await closeGraph()
})
