import path from 'path'
import { BrowserWindow } from 'electron'
import { reindexFile } from './search-index'
import { DOCS_ROOT } from './paths'

const VAULT_ROOT = DOCS_ROOT
const IGNORE_PATTERNS = [
  '**/.obsidian/**',
  '**/.git/**',
  '**/node_modules/**',
  '**/.trash/**',
  '**/.sidekick-tmp',
]

let watcher: { close(): Promise<void> } | null = null

export async function startFileWatcher() {
  if (watcher) return

  const chokidar = await import('chokidar')
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
    if (relativePath.endsWith('.md')) {
      reindexFile(relativePath)
    }
    const windows = BrowserWindow.getAllWindows()
    for (const win of windows) {
      win.webContents.send('vault:file-changed', { eventType, path: relativePath })
    }
  }

  watcher
    .on('change', (p: string) => notify('change', p))
    .on('add', (p: string) => notify('add', p))
    .on('unlink', (p: string) => notify('unlink', p))
}

export function stopFileWatcher() {
  if (watcher) {
    watcher.close()
    watcher = null
  }
}
