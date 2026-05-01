import { ipcMain, BrowserWindow } from 'electron'
import os from 'os'
import * as pty from 'node-pty'

// ── Types ───────────────────────────────────────────────────────────────────

interface PtySession {
  id: string
  proc: pty.IPty
  agentId?: string
}

// ── Constants ───────────────────────────────────────────────────────────────

const MAX_CONCURRENT_PTYS = 10
const SWEEP_INTERVAL_MS = 60_000

// ── Security ────────────────────────────────────────────────────────────────

const BLOCKED_ENV_KEYS = new Set([
  'LD_PRELOAD', 'LD_LIBRARY_PATH', 'DYLD_INSERT_LIBRARIES', 'DYLD_LIBRARY_PATH',
  'DYLD_FORCE_FLAT_NAMESPACE', 'LD_AUDIT', 'LD_DEBUG',
])

function sanitizePtyEnv(env: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(env)) {
    if (!BLOCKED_ENV_KEYS.has(k) && typeof v === 'string') {
      out[k] = v
    }
  }
  return out
}

// ── State ───────────────────────────────────────────────────────────────────

const sessions = new Map<string, PtySession>()
let nextId = 1
let sweepTimer: ReturnType<typeof setInterval> | null = null

// ── Helpers ─────────────────────────────────────────────────────────────────

function getShell(): string {
  return process.env.SHELL || (os.platform() === 'win32' ? 'powershell.exe' : '/bin/zsh')
}

function getWindow(): BrowserWindow | null {
  const wins = BrowserWindow.getAllWindows()
  return wins.length > 0 ? wins[0] : null
}

function isPtyAlive(proc: pty.IPty): boolean {
  try {
    process.kill(proc.pid, 0)
    return true
  } catch {
    return false
  }
}

/** Periodic sweep: check if PTY processes are still alive, clean up dead ones */
function sweepDeadPtys(): void {
  for (const [id, session] of sessions) {
    if (!isPtyAlive(session.proc)) {
      console.warn(`[pty] Sweeping dead PTY: ${id} (pid=${session.proc.pid})`)
      const win = getWindow()
      if (win && !win.isDestroyed()) {
        win.webContents.send('pty:exit', id, -1)
      }
      sessions.delete(id)
    }
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

export function createPty(
  cwd: string,
  command?: string,
  args?: string[],
  env?: Record<string, string>,
): string {
  // Cap max concurrent PTY sessions
  if (sessions.size >= MAX_CONCURRENT_PTYS) {
    throw new Error(`Maximum concurrent PTY sessions (${MAX_CONCURRENT_PTYS}) reached. Close some terminals first.`)
  }

  const id = `pty-${nextId++}`
  const shell = command || getShell()
  const shellArgs = args || []

  const proc = pty.spawn(shell, shellArgs, {
    name: 'xterm-256color',
    cols: 120,
    rows: 30,
    cwd,
    env: { ...process.env, ...(env ? sanitizePtyEnv(env) : {}) } as Record<string, string>,
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
    try { session.proc.kill() } catch { /* already dead */ }
  }
  sessions.clear()
}

/** Start the periodic dead-PTY sweep */
export function startPtySweep(): void {
  if (sweepTimer) return
  sweepTimer = setInterval(sweepDeadPtys, SWEEP_INTERVAL_MS)
}

/** Stop the periodic sweep (call on app quit) */
export function stopPtySweep(): void {
  if (sweepTimer) {
    clearInterval(sweepTimer)
    sweepTimer = null
  }
}

/** Get current PTY session count */
export function getPtyCount(): number {
  return sessions.size
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

  // Start the periodic sweep
  startPtySweep()
}
