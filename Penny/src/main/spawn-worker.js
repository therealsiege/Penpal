/**
 * spawn-worker.js — Forked child process that executes spawn requests.
 *
 * Runs in a clean Node process (no Electron fd corruption).
 * Receives requests via IPC, executes via child_process.execFile,
 * returns results via IPC.
 */

const { execFile } = require('child_process')

process.on('message', (msg) => {
  const { id, command, args, cwd, timeout } = msg

  execFile(command, args, {
    encoding: 'utf-8',
    cwd: cwd || undefined,
    timeout: timeout || 30000,
    maxBuffer: 10 * 1024 * 1024, // 10MB
  }, (err, stdout, stderr) => {
    if (err) {
      process.send({ id, error: err.message, stderr: stderr || '' })
    } else {
      process.send({ id, stdout, stderr })
    }
  })
})

// Keep alive
process.on('disconnect', () => process.exit(0))
