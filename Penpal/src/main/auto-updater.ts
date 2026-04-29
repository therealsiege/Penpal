import { autoUpdater } from 'electron-updater'
import { BrowserWindow, dialog } from 'electron'

export function initAutoUpdater(): void {
  // Don't check for updates in dev
  if (process.env.ELECTRON_RENDERER_URL) return

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', (info) => {
    console.log(`[updater] Update available: v${info.version}`)
    const win = BrowserWindow.getFocusedWindow()
    if (!win) {
      autoUpdater.downloadUpdate()
      return
    }
    dialog.showMessageBox(win, {
      type: 'info',
      title: 'Update Available',
      message: `Penpal v${info.version} is available.`,
      detail: 'Would you like to download and install it?',
      buttons: ['Update', 'Later'],
      defaultId: 0,
    }).then(({ response }) => {
      if (response === 0) autoUpdater.downloadUpdate()
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    console.log(`[updater] Update downloaded: v${info.version}`)
    const win = BrowserWindow.getFocusedWindow()
    if (!win) {
      autoUpdater.quitAndInstall()
      return
    }
    dialog.showMessageBox(win, {
      type: 'info',
      title: 'Update Ready',
      message: `Penpal v${info.version} has been downloaded.`,
      detail: 'Restart now to apply the update?',
      buttons: ['Restart', 'Later'],
      defaultId: 0,
    }).then(({ response }) => {
      if (response === 0) autoUpdater.quitAndInstall()
    })
  })

  autoUpdater.on('error', (err) => {
    console.error('[updater] Error:', err.message)
  })

  // Check for updates after a short delay
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      console.error('[updater] Check failed:', err.message)
    })
  }, 10000)
}
