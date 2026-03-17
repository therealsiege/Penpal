import path from 'path'
import { BrowserWindow } from 'electron'
import chokidar from 'chokidar'
import { reindexFile } from './search-index'

const VAULT_ROOT = path.resolve(__dirname, '..', '..')
const IGNORE_PATTERNS = [
  '**/.obsidian/**',
  '**/.git/**',
  '**/node_modules/**',
  '**/sidekick-electron/**',
  '**/sidekick-graph/**',
  '**/game-assets/**',
  '**/out/**',
  '**/build/**',
  '**/dist/**',
  '**/.sidekick-tmp',
]

let watcher: chokidar.FSWatcher | null = null

export function startFileWatcher() {
  if (watcher) return

  watcher = chokidar.watch(VAULT_ROOT, {
    ignored: IGNORE_PATTERNS,
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 500,
      pollInterval: 100,
    },
  })

  const notify = (eventType: string, filePath: string) => {
    const relativePath = path.relative(VAULT_ROOT, filePath)
    // Re-index changed file
    if (relativePath.endsWith('.md')) {
      reindexFile(relativePath)
    }
    // Notify renderer
    const windows = BrowserWindow.getAllWindows()
    for (const win of windows) {
      win.webContents.send('vault:file-changed', { eventType, path: relativePath })
    }
  }

  watcher
    .on('change', (p) => notify('change', p))
    .on('add', (p) => notify('add', p))
    .on('unlink', (p) => notify('unlink', p))
}

export function stopFileWatcher() {
  if (watcher) {
    watcher.close()
    watcher = null
  }
}
