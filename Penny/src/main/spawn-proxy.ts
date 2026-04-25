/**
 * spawn-proxy.ts — Routes child_process.execFile through a forked Node worker.
 *
 * Electron 33 on macOS Tahoe corrupts the fd table, causing EBADF on all
 * spawn calls from the main process. This module forks a clean Node process
 * at startup (before corruption) and proxies spawn requests through IPC.
 *
 * Usage:
 *   import { proxyExecFile } from './spawn-proxy'
 *   const { stdout } = await proxyExecFile('gh', ['issue', 'list', ...], { timeout: 30000 })
 */

import { spawn, type ChildProcess } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'

let worker: ChildProcess | null = null
let requestId = 0
const pending = new Map<number, { resolve: (v: { stdout: string; stderr: string }) => void; reject: (e: Error) => void }>()

// Inline worker script — written to a temp file at startup because electron-vite
// bundles the main process and doesn't copy standalone .js files to out/main/.
const WORKER_SCRIPT = `
const { execFile } = require('child_process');
process.on('message', (msg) => {
  const { id, command, args, cwd, timeout } = msg;
  execFile(command, args, {
    encoding: 'utf-8',
    cwd: cwd || undefined,
    timeout: timeout || 30000,
    maxBuffer: 10 * 1024 * 1024,
    env: { ...process.env },
  }, (err, stdout, stderr) => {
    if (err) {
      process.send({ id, error: err.message, stderr: stderr || '' });
    } else {
      process.send({ id, stdout, stderr });
    }
  });
});
process.on('disconnect', () => process.exit(0));
`

let workerScriptPath: string | null = null

function getWorkerScriptPath(): string {
  if (!workerScriptPath) {
    workerScriptPath = path.join(os.tmpdir(), `penny-spawn-worker-${process.pid}.js`)
    fs.writeFileSync(workerScriptPath, WORKER_SCRIPT)
  }
  return workerScriptPath
}

/** Start the spawn worker. Call once at app startup. */
export function startSpawnProxy(): void {
  if (worker) return
  const scriptPath = getWorkerScriptPath()
  // Use ELECTRON_RUN_AS_NODE to spawn a clean Node process using the
  // Electron binary itself — bypasses Electron's patched fork() which
  // throws EBADF on macOS Tahoe.
  worker = spawn(process.execPath, [scriptPath], {
    stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
  }) as ChildProcess
  worker.on('message', (msg: { id: number; error?: string; stdout?: string; stderr?: string }) => {
    const p = pending.get(msg.id)
    if (!p) return
    pending.delete(msg.id)
    if (msg.error) {
      p.reject(new Error(msg.error))
    } else {
      p.resolve({ stdout: msg.stdout || '', stderr: msg.stderr || '' })
    }
  })
  let restartCount = 0
  worker.on('exit', (code) => {
    worker = null
    // Reject all pending requests
    for (const [id, p] of pending) {
      p.reject(new Error('Spawn worker exited'))
      pending.delete(id)
    }
    restartCount++
    if (restartCount <= 3) {
      console.warn(`[spawn-proxy] Worker exited with code ${code}, restarting (attempt ${restartCount}/3)...`)
      startSpawnProxy()
    } else {
      console.error(`[spawn-proxy] Worker failed ${restartCount} times, giving up. Child process spawning will not work.`)
    }
  })
  console.log('[spawn-proxy] Worker started')
}

/** Stop the spawn worker. Call on app shutdown. */
export function stopSpawnProxy(): void {
  if (worker) {
    worker.kill()
    worker = null
  }
}

/**
 * Execute a command via the forked worker (EBADF-safe).
 * Drop-in replacement for execFileAsync with encoding: 'utf-8'.
 */
export function proxyExecFile(
  command: string,
  args: string[],
  opts?: { cwd?: string; timeout?: number; encoding?: string },
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    if (!worker) {
      reject(new Error('Spawn proxy not started'))
      return
    }
    const id = ++requestId
    pending.set(id, { resolve, reject })

    // Timeout on our side too
    const timeout = opts?.timeout ?? 30_000
    const timer = setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id)
        reject(new Error(`proxyExecFile timeout after ${timeout}ms`))
      }
    }, timeout + 5000) // extra 5s buffer over worker timeout

    pending.set(id, {
      resolve: (v) => { clearTimeout(timer); resolve(v) },
      reject: (e) => { clearTimeout(timer); reject(e) },
    })

    worker.send({ id, command, args, cwd: opts?.cwd, timeout })
  })
}
