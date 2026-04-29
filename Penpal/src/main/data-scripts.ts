import { spawn, ChildProcess } from 'child_process'
import { app, ipcMain, BrowserWindow } from 'electron'
import fs from 'fs'
import path from 'path'
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'

const ANALYTICS_DIR = path.resolve(__dirname, '..', '..', 'analytics')
const SCHEDULE_PATH = path.join(ANALYTICS_DIR, 'schedule.yaml')

// analytics/ is intentionally not bundled in the packaged .app (CHANGELOG v0.1.1).
// Anything that shells out to npm scripts in analytics/ must short-circuit when packaged.
const PACKAGED_ANALYTICS_ERROR =
  'Data scripts require a developer checkout of Penpal/analytics. Not available in the packaged app.'

// Track running scripts by runId
const running = new Map<string, ChildProcess>()
let runCounter = 0

function nextRunId(): string {
  return `run-${++runCounter}-${Date.now()}`
}

function broadcast(channel: string, data: unknown) {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel, data)
  }
}

export function registerDataScriptHandlers() {
  // Run a script from analytics/package.json
  ipcMain.handle('data:run-script', (_event, script: unknown, opts?: unknown) => {
    if (app.isPackaged) throw new Error(PACKAGED_ANALYTICS_ERROR)
    if (typeof script !== 'string') throw new Error('script must be a string')
    const options = (opts as Record<string, unknown>) || {}
    const rootDir = typeof options.rootDir === 'string' ? options.rootDir : undefined

    // Prevent double-runs of same script
    for (const [, proc] of running) {
      if ((proc as ChildProcess & { _script?: string })._script === script) {
        throw new Error(`Script "${script}" is already running`)
      }
    }

    const id = nextRunId()
    const args = ['run', script]
    if (rootDir) args.push('--', '--root', rootDir)

    const child = spawn('npm', args, {
      cwd: ANALYTICS_DIR,
      env: { ...process.env, FORCE_COLOR: '0' },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    ;(child as ChildProcess & { _script?: string })._script = script
    running.set(id, child)

    const startTime = Date.now()

    const sendLine = (stream: 'stdout' | 'stderr', line: string) => {
      broadcast('data:script-output', { id, stream, line })
    }

    let stdoutBuffer = ''
    child.stdout?.on('data', (chunk: Buffer) => {
      stdoutBuffer += chunk.toString()
      const lines = stdoutBuffer.split('\n')
      stdoutBuffer = lines.pop() || ''
      for (const line of lines) sendLine('stdout', line)
    })

    let stderrBuffer = ''
    child.stderr?.on('data', (chunk: Buffer) => {
      stderrBuffer += chunk.toString()
      const lines = stderrBuffer.split('\n')
      stderrBuffer = lines.pop() || ''
      for (const line of lines) sendLine('stderr', line)
    })

    child.on('close', (code) => {
      // Flush remaining buffers
      if (stdoutBuffer) sendLine('stdout', stdoutBuffer)
      if (stderrBuffer) sendLine('stderr', stderrBuffer)
      running.delete(id)
      broadcast('data:script-done', {
        id,
        exitCode: code ?? 1,
        durationMs: Date.now() - startTime,
      })
    })

    child.on('error', (err) => {
      running.delete(id)
      broadcast('data:script-done', {
        id,
        exitCode: 1,
        error: err.message,
        durationMs: Date.now() - startTime,
      })
    })

    return id
  })

  // Cancel a running script
  ipcMain.handle('data:cancel-script', (_event, runId: unknown) => {
    if (typeof runId !== 'string') throw new Error('runId must be a string')
    const child = running.get(runId)
    if (!child) return false
    child.kill('SIGTERM')
    return true
  })

  // Get briefing schedule from schedule.yaml
  ipcMain.handle('data:get-briefing-schedule', () => {
    try {
      const raw = fs.readFileSync(SCHEDULE_PATH, 'utf-8')
      const doc = parseYaml(raw)
      const briefing = doc?.jobs?.['daily-briefing']
      if (!briefing) return { cron: '30 6 * * 1-5', enabled: true }
      return { cron: briefing.cron || '30 6 * * 1-5', enabled: briefing.enabled !== false }
    } catch {
      return { cron: '30 6 * * 1-5', enabled: true }
    }
  })

  // Update briefing schedule in schedule.yaml
  ipcMain.handle('data:set-briefing-schedule', (_event, cron: unknown, enabled: unknown) => {
    if (app.isPackaged) throw new Error(PACKAGED_ANALYTICS_ERROR)
    if (typeof cron !== 'string') throw new Error('cron must be a string')
    const raw = fs.readFileSync(SCHEDULE_PATH, 'utf-8')
    const doc = parseYaml(raw)
    if (!doc?.jobs?.['daily-briefing']) throw new Error('daily-briefing job not found in schedule.yaml')
    doc.jobs['daily-briefing'].cron = cron
    doc.jobs['daily-briefing'].enabled = enabled !== false
    fs.writeFileSync(SCHEDULE_PATH, stringifyYaml(doc, { lineWidth: 0 }), 'utf-8')
    return { success: true }
  })
}

// Auto-infrastructure lifecycle
export function infraUp() {
  if (app.isPackaged) {
    console.log('[data-scripts] infra:up skipped (analytics/ not bundled in packaged app)')
    return
  }
  if (!fs.existsSync(path.join(ANALYTICS_DIR, 'docker-compose.yml')) &&
      !fs.existsSync(path.join(ANALYTICS_DIR, 'docker-compose.yaml')) &&
      !fs.existsSync(path.join(ANALYTICS_DIR, 'compose.yaml'))) {
    console.log('[data-scripts] No docker compose file found in analytics/, skipping infra:up')
    return
  }
  console.log('[data-scripts] Running infra:up...')
  const child = spawn('npm', ['run', 'infra:up'], {
    cwd: ANALYTICS_DIR,
    stdio: 'ignore',
    detached: false,
  })
  child.on('error', (err) => console.error('[data-scripts] infra:up error:', err.message))
  child.on('close', (code) => console.log(`[data-scripts] infra:up exited with code ${code}`))
}

export function infraDown(): Promise<void> {
  if (app.isPackaged) return Promise.resolve()
  if (!fs.existsSync(path.join(ANALYTICS_DIR, 'docker-compose.yml')) &&
      !fs.existsSync(path.join(ANALYTICS_DIR, 'docker-compose.yaml')) &&
      !fs.existsSync(path.join(ANALYTICS_DIR, 'compose.yaml'))) {
    return Promise.resolve()
  }
  console.log('[data-scripts] Running infra:down...')
  return new Promise((resolve) => {
    const child = spawn('npm', ['run', 'infra:down'], {
      cwd: ANALYTICS_DIR,
      stdio: 'ignore',
      detached: false,
    })
    child.on('error', () => resolve())
    child.on('close', () => resolve())
    // Don't block quit forever
    setTimeout(resolve, 10_000)
  })
}
