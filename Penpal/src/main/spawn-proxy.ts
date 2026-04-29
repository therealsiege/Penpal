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
const { execFile, spawn } = require('child_process');
const children = new Map();

process.on('message', (msg) => {
  const { id, type, command, args, cwd, timeout, env, signal } = msg;

  if (type === 'kill') {
    const child = children.get(id);
    if (child) child.kill(signal || 'SIGTERM');
    return;
  }

  if (type === 'spawn') {
    // Long-running process with streaming output
    const child = spawn(command, args, {
      cwd: cwd || undefined,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: env ? { ...process.env, ...env } : { ...process.env },
    });
    children.set(id, child);
    child.stdout.on('data', (d) => process.send({ id, type: 'stdout', data: d.toString() }));
    child.stderr.on('data', (d) => process.send({ id, type: 'stderr', data: d.toString() }));
    child.on('close', (code) => { children.delete(id); process.send({ id, type: 'close', code: code || 0 }); });
    child.on('error', (err) => { children.delete(id); process.send({ id, type: 'error', error: err.message }); });
    if (timeout) {
      setTimeout(() => { if (children.has(id)) { child.kill('SIGKILL'); } }, timeout);
    }
    return;
  }

  // Default: execFile (one-shot, returns stdout/stderr)
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
 * Spawn a long-running command via the forked worker (EBADF-safe).
 * Returns an object with stdout/stderr event emitters and a kill method.
 * Used for headless agent processes that stream output.
 */
export function proxySpawn(
  command: string,
  args: string[],
  opts?: { cwd?: string; env?: Record<string, string>; timeout?: number },
): { stdout: { on: (e: 'data', cb: (d: string) => void) => void }; stderr: { on: (e: 'data', cb: (d: string) => void) => void }; on: (e: 'close' | 'error', cb: (codeOrErr: number | Error) => void) => void; kill: (sig?: string) => void } {
  const id = ++requestId
  const stdoutCbs: Array<(d: string) => void> = []
  const stderrCbs: Array<(d: string) => void> = []
  const closeCbs: Array<(code: number) => void> = []
  const errorCbs: Array<(err: Error) => void> = []

  if (!worker) {
    // Return a fake that immediately errors
    setTimeout(() => errorCbs.forEach(cb => cb(new Error('Spawn proxy not started'))), 0)
    return {
      stdout: { on: (_e, cb) => { stdoutCbs.push(cb) } },
      stderr: { on: (_e, cb) => { stderrCbs.push(cb) } },
      on: (e, cb) => { if (e === 'error') errorCbs.push(cb as (err: Error) => void); if (e === 'close') closeCbs.push(cb as (code: number) => void) },
      kill: () => {},
    }
  }

  worker.send({ id, type: 'spawn', command, args, cwd: opts?.cwd, env: opts?.env, timeout: opts?.timeout })

  // Listen for streamed messages from the worker
  const msgHandler = (msg: { id: number; type?: string; stream?: string; data?: string; code?: number; error?: string }) => {
    if (msg.id !== id) return
    if (msg.type === 'stdout') stdoutCbs.forEach(cb => cb(msg.data || ''))
    else if (msg.type === 'stderr') stderrCbs.forEach(cb => cb(msg.data || ''))
    else if (msg.type === 'close') {
      worker?.removeListener('message', msgHandler)
      closeCbs.forEach(cb => cb(msg.code ?? 1))
    }
    else if (msg.type === 'error') {
      worker?.removeListener('message', msgHandler)
      errorCbs.forEach(cb => cb(new Error(msg.error || 'unknown')))
    }
  }
  worker.on('message', msgHandler)

  return {
    stdout: { on: (_e, cb) => { stdoutCbs.push(cb) } },
    stderr: { on: (_e, cb) => { stderrCbs.push(cb) } },
    on: (e, cb) => { if (e === 'error') errorCbs.push(cb as (err: Error) => void); if (e === 'close') closeCbs.push(cb as (code: number) => void) },
    kill: (sig) => { worker?.send({ id, type: 'kill', signal: sig || 'SIGTERM' }) },
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
