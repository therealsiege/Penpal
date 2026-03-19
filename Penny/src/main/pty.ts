import { ipcMain, BrowserWindow } from 'electron'
import os from 'os'
import * as pty from 'node-pty'

// ── Types ───────────────────────────────────────────────────────────────────

interface PtySession {
  id: string
  proc: pty.IPty
  agentId?: string
}

// ── State ───────────────────────────────────────────────────────────────────

const sessions = new Map<string, PtySession>()
let nextId = 1

// ── Helpers ─────────────────────────────────────────────────────────────────

function getShell(): string {
  return process.env.SHELL || (os.platform() === 'win32' ? 'powershell.exe' : '/bin/zsh')
}

function getWindow(): BrowserWindow | null {
  const wins = BrowserWindow.getAllWindows()
  return wins.length > 0 ? wins[0] : null
}

// ── Public API ──────────────────────────────────────────────────────────────

export function createPty(
  cwd: string,
  command?: string,
  args?: string[],
  env?: Record<string, string>,
): string {
  const id = `pty-${nextId++}`
  const shell = command || getShell()
  const shellArgs = args || []

  const proc = pty.spawn(shell, shellArgs, {
    name: 'xterm-256color',
    cols: 120,
    rows: 30,
    cwd,
    env: { ...process.env, ...env } as Record<string, string>,
  })

  const session: PtySession = { id, proc }
  sessions.set(id, session)

  // Forward output to renderer
  proc.onData((data: string) => {
    const win = getWindow()
    if (win && !win.isDestroyed()) {
      win.webContents.send('pty:data', id, data)
    }
  })

  proc.onExit(({ exitCode }) => {
    const win = getWindow()
    if (win && !win.isDestroyed()) {
      win.webContents.send('pty:exit', id, exitCode)
    }
    sessions.delete(id)
  })

  return id
}

export function destroyPty(id: string): void {
  const session = sessions.get(id)
  if (session) {
    session.proc.kill()
    sessions.delete(id)
  }
}

export function destroyAllPtys(): void {
  for (const session of sessions.values()) {
    session.proc.kill()
  }
  sessions.clear()
}

// ── IPC Registration ────────────────────────────────────────────────────────

export function registerPtyHandlers(): void {
  ipcMain.handle('pty:create', (_event, cwd: string, command?: string, args?: string[], env?: Record<string, string>) => {
    return createPty(cwd, command, args, env)
  })

  ipcMain.on('pty:write', (_event, id: string, data: string) => {
    const session = sessions.get(id)
    if (session) session.proc.write(data)
  })

  ipcMain.on('pty:resize', (_event, id: string, cols: number, rows: number) => {
    const session = sessions.get(id)
    if (session) session.proc.resize(cols, rows)
  })

  ipcMain.handle('pty:destroy', (_event, id: string) => {
    destroyPty(id)
  })
}
