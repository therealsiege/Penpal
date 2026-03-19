import fs from 'fs'
import path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

const PENNY_ROOT = path.resolve(__dirname, '..', '..')
const DEFAULT_COMPOSE_FILE = path.join(PENNY_ROOT, 'docker', 'compose.control-plane.yml')
const DEFAULT_ENV_FILE = path.join(PENNY_ROOT, 'docker', '.env.control-plane')
const DEFAULT_PROJECT_NAME = 'penny'
const DEFAULT_SERVICE_NAME = 'veritas-kanban'

export interface VeritasServiceStatus {
  configured: boolean
  composeFile: string
  envFile?: string
  projectName: string
  serviceName: string
  sourceDir: string
  sourceDirConfigured: boolean
  sourceDirValid: boolean
  dockerAvailable: boolean
  composeAvailable: boolean
  running: boolean
  healthy: boolean
  apiReachable: boolean
  state: string
  health: string
  apiUrl: string
  webUrl: string
  warnings: string[]
  error?: string
}

export interface VeritasCommandResult {
  success: boolean
  output?: string
  error?: string
}

interface ComposePsRow {
  Service?: string
  Name?: string
  State?: string
  Health?: string
}

function resolveFromRoot(inputPath: string): string {
  return path.isAbsolute(inputPath) ? path.normalize(inputPath) : path.resolve(PENNY_ROOT, inputPath)
}

function getConfig() {
  const composeFileRaw = process.env.PENNY_VERITAS_COMPOSE_FILE || DEFAULT_COMPOSE_FILE
  const composeFile = resolveFromRoot(composeFileRaw)

  const envFileCandidateRaw = process.env.PENNY_VERITAS_ENV_FILE || DEFAULT_ENV_FILE
  const envFileCandidate = resolveFromRoot(envFileCandidateRaw)
  const envFile = fs.existsSync(envFileCandidate) ? envFileCandidate : undefined

  const sourceDirConfigured = Boolean(process.env.PENNY_VERITAS_SOURCE_DIR?.trim())
  const sourceDirRaw = process.env.PENNY_VERITAS_SOURCE_DIR || '../../veritas-kanban'
  const sourceDir = path.isAbsolute(sourceDirRaw)
    ? path.normalize(sourceDirRaw)
    : path.resolve(path.dirname(composeFile), sourceDirRaw)
  const sourceDirValid = fs.existsSync(sourceDir) && fs.statSync(sourceDir).isDirectory()

  const projectName = process.env.PENNY_DOCKER_PROJECT || DEFAULT_PROJECT_NAME
  const serviceName = process.env.PENNY_VERITAS_SERVICE_NAME || DEFAULT_SERVICE_NAME
  const apiUrl = process.env.PENNY_VERITAS_API_URL || 'http://127.0.0.1:47832/api'
  const webUrl = process.env.PENNY_VERITAS_WEB_URL || apiUrl.replace(/\/api\/?$/, '')
  const warnings: string[] = []

  if (!sourceDirConfigured) {
    warnings.push('PENNY_VERITAS_SOURCE_DIR is not set; using default relative build context.')
  }
  if (!sourceDirValid) {
    warnings.push(`Veritas source directory is missing or invalid: ${sourceDir}`)
  } else {
    const dockerfilePath = path.join(sourceDir, 'Dockerfile')
    if (!fs.existsSync(dockerfilePath)) {
      warnings.push(`Veritas source directory is missing Dockerfile: ${dockerfilePath}`)
    }
  }

  return {
    composeFile,
    envFile,
    projectName,
    serviceName,
    sourceDir,
    sourceDirConfigured,
    sourceDirValid,
    apiUrl,
    webUrl,
    warnings,
  }
}

function composeBaseArgs(composeFile: string, envFile: string | undefined, projectName: string): string[] {
  return [
    'compose',
    '-f', composeFile,
    ...(envFile ? ['--env-file', envFile] : []),
    '--project-name', projectName,
  ]
}

function parseComposePs(stdout: string): ComposePsRow[] {
  const trimmed = stdout.trim()
  if (!trimmed) return []

  try {
    const parsed = JSON.parse(trimmed) as unknown
    if (Array.isArray(parsed)) return parsed as ComposePsRow[]
    if (parsed && typeof parsed === 'object') return [parsed as ComposePsRow]
  } catch {
    // Fall through to line-delimited JSON parsing.
  }

  const rows: ComposePsRow[] = []
  for (const line of trimmed.split('\n')) {
    if (!line.trim()) continue
    try {
      rows.push(JSON.parse(line) as ComposePsRow)
    } catch {
      // ignore unparsable lines
    }
  }
  return rows
}

async function runDocker(args: string[], timeout = 20_000): Promise<{ stdout: string; stderr: string }> {
  const { stdout, stderr } = await execFileAsync('docker', args, {
    timeout,
    maxBuffer: 10 * 1024 * 1024,
  })
  return { stdout, stderr }
}

async function checkHttpHealth(webUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${webUrl.replace(/\/$/, '')}/health`, { signal: AbortSignal.timeout(4_000) })
    return res.ok
  } catch {
    return false
  }
}

function apiToWebBase(apiUrl: string): string {
  return apiUrl.replace(/\/api\/?$/, '').replace(/\/$/, '')
}

async function checkVeritasApiReachable(cfg: { webUrl: string; apiUrl: string }): Promise<boolean> {
  const candidates = Array.from(
    new Set([cfg.webUrl.replace(/\/$/, ''), apiToWebBase(cfg.apiUrl)].filter(Boolean)),
  )
  for (const candidate of candidates) {
    if (await checkHttpHealth(candidate)) return true
  }
  return false
}

export async function getVeritasStatus(): Promise<VeritasServiceStatus> {
  const cfg = getConfig()
  const configured = fs.existsSync(cfg.composeFile)

  const status: VeritasServiceStatus = {
    configured,
    composeFile: cfg.composeFile,
    envFile: cfg.envFile,
    projectName: cfg.projectName,
    serviceName: cfg.serviceName,
    sourceDir: cfg.sourceDir,
    sourceDirConfigured: cfg.sourceDirConfigured,
    sourceDirValid: cfg.sourceDirValid,
    dockerAvailable: false,
    composeAvailable: false,
    running: false,
    healthy: false,
    apiReachable: false,
    state: 'unknown',
    health: 'unknown',
    apiUrl: cfg.apiUrl,
    webUrl: cfg.webUrl,
    warnings: cfg.warnings,
  }

  status.apiReachable = await checkVeritasApiReachable(cfg)

  try {
    await runDocker(['--version'], 7_000)
    status.dockerAvailable = true
  } catch (err) {
    status.error = `Docker unavailable: ${(err as Error).message}`
    return status
  }

  try {
    await runDocker(['compose', 'version'], 7_000)
    status.composeAvailable = true
  } catch (err) {
    status.error = `Docker Compose unavailable: ${(err as Error).message}`
    return status
  }

  if (!configured) {
    status.error = `Compose file not found: ${cfg.composeFile}`
    return status
  }

  try {
    const composeArgs = composeBaseArgs(cfg.composeFile, cfg.envFile, cfg.projectName)
    const { stdout } = await runDocker([...composeArgs, 'ps', '--format', 'json'], 15_000)
    const rows = parseComposePs(stdout)
    const row = rows.find(r =>
      (r.Service || '') === cfg.serviceName ||
      (r.Name || '').includes(cfg.serviceName),
    )

    if (!row) {
      status.state = 'not-created'
      status.health = 'unknown'
      return status
    }

    status.state = (row.State || 'unknown').toLowerCase()
    status.health = (row.Health || '').toLowerCase()
    status.running = status.state.includes('running')
    status.healthy = status.running && (status.health === '' || status.health === 'healthy')
    if (status.running && !status.apiReachable) {
      status.error = 'Container is running but /health is not reachable yet.'
    }
  } catch (err) {
    status.error = `Failed to inspect compose status: ${(err as Error).message}`
  }

  return status
}

async function ensureComposeAvailable(): Promise<ReturnType<typeof getConfig>> {
  const cfg = getConfig()
  if (!fs.existsSync(cfg.composeFile)) {
    throw new Error(`Compose file not found: ${cfg.composeFile}`)
  }
  if (!cfg.sourceDirValid) {
    throw new Error(`Veritas source directory is missing or invalid: ${cfg.sourceDir}`)
  }
  if (!fs.existsSync(path.join(cfg.sourceDir, 'Dockerfile'))) {
    throw new Error(`Veritas Dockerfile not found: ${path.join(cfg.sourceDir, 'Dockerfile')}`)
  }
  return cfg
}

export async function startVeritasService(): Promise<VeritasServiceStatus> {
  const cfg = await ensureComposeAvailable()
  const composeArgs = composeBaseArgs(cfg.composeFile, cfg.envFile, cfg.projectName)
  await runDocker([...composeArgs, 'up', '-d', '--build', cfg.serviceName], 600_000)
  return getVeritasStatus()
}

export async function stopVeritasService(): Promise<VeritasServiceStatus> {
  const cfg = await ensureComposeAvailable()
  const composeArgs = composeBaseArgs(cfg.composeFile, cfg.envFile, cfg.projectName)
  await runDocker([...composeArgs, 'stop', cfg.serviceName], 120_000)
  return getVeritasStatus()
}

export async function restartVeritasService(): Promise<VeritasServiceStatus> {
  const cfg = await ensureComposeAvailable()
  const composeArgs = composeBaseArgs(cfg.composeFile, cfg.envFile, cfg.projectName)
  await runDocker([...composeArgs, 'restart', cfg.serviceName], 120_000)
  return getVeritasStatus()
}

export async function getVeritasLogs(tail = 120): Promise<VeritasCommandResult> {
  const cfg = await ensureComposeAvailable()
  const composeArgs = composeBaseArgs(cfg.composeFile, cfg.envFile, cfg.projectName)
  try {
    const { stdout, stderr } = await runDocker(
      [...composeArgs, 'logs', '--no-color', '--tail', String(Math.max(1, tail)), cfg.serviceName],
      60_000,
    )
    return { success: true, output: stdout || stderr }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}
