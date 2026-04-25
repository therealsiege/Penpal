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

import { fork, type ChildProcess } from 'child_process'
import path from 'path'

let worker: ChildProcess | null = null
let requestId = 0
const pending = new Map<number, { resolve: (v: { stdout: string; stderr: string }) => void; reject: (e: Error) => void }>()

/** Start the spawn worker. Call once at app startup. */
export function startSpawnProxy(): void {
  if (worker) return
  worker = fork(path.join(__dirname, 'spawn-worker.js'), [], {
    stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
  })
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
  worker.on('exit', (code) => {
    console.warn(`[spawn-proxy] Worker exited with code ${code}, restarting...`)
    worker = null
    // Reject all pending requests
    for (const [id, p] of pending) {
      p.reject(new Error('Spawn worker exited'))
      pending.delete(id)
    }
    // Restart
    startSpawnProxy()
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
