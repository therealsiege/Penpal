import { exec } from 'child_process'
import { promisify } from 'util'
import { HOME_DIR } from './paths'

const execAsync = promisify(exec)

const HOME = HOME_DIR
const RUNTIMES = ['openclaw', 'nemoclaw', 'opencode'] as const

export type ExternalCliRuntime = typeof RUNTIMES[number]

export interface OpencodeSession {
  pid: number
  cwd: string
  project: string
  uptime: string
  cpu: string
  memoryMB: number
  alive: boolean
  startedAt: number
  runtime: ExternalCliRuntime
  tty: string
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function parseElapsedTimeToStart(etime: string): number {
  // etime format: [[dd-]hh:]mm:ss
  let days = 0
  let hours = 0
  let mins = 0
  let secs = 0

  const trimmed = etime.trim()
  if (!trimmed) return Date.now()

  const daySplit = trimmed.split('-')
  const timePart = daySplit.length > 1 ? daySplit[daySplit.length - 1] : daySplit[0]
  if (daySplit.length > 1) days = parseInt(daySplit[0] || '0', 10) || 0

  const parts = timePart.split(':').map(n => parseInt(n, 10) || 0)
  if (parts.length === 3) {
    hours = parts[0]
    mins = parts[1]
    secs = parts[2]
  } else if (parts.length === 2) {
    mins = parts[0]
    secs = parts[1]
  } else if (parts.length === 1) {
    secs = parts[0]
  }

  const elapsedSec = days * 86400 + hours * 3600 + mins * 60 + secs
  return Date.now() - elapsedSec * 1000
}

function formatUptime(startedAt: number): string {
  const diff = Date.now() - startedAt
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  const remainMins = mins % 60
  if (hours < 24) return `${hours}h ${remainMins}m`
  const days = Math.floor(hours / 24)
  return `${days}d ${hours % 24}h`
}

async function getWorkingDirectory(pid: number): Promise<string> {
  try {
    const { stdout } = await execAsync(
      `lsof -a -p ${pid} -d cwd -Fn 2>/dev/null`,
    )
    const cwdLine = stdout
      .trim()
      .split('\n')
      .find(line => line.startsWith('n'))
    return cwdLine?.slice(1).trim() || HOME
  } catch {
    return HOME
  }
}

function normalizeTty(tty: string): string {
  if (!tty || tty === '??') return ''
  return tty.replace(/^\/dev\//, '')
}

interface RuntimeProcess {
  pid: number
  tty: string
  cpu: string
  memoryMB: number
  startedAt: number
  runtime: ExternalCliRuntime
  source: 'direct' | 'gateway'
  command: string
}

interface RuntimeDetection {
  runtime: ExternalCliRuntime
  source: 'direct' | 'gateway'
}

function detectRuntime(command: string): RuntimeDetection | null {
  const tokens = command.trim().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return null

  const runtimeFromToken = (token: string): ExternalCliRuntime | null => {
    const raw = token.replace(/^['"]|['"]$/g, '')
    const base = raw.split('/').pop()?.toLowerCase() || ''
    const stem = base.replace(/\.(mjs|cjs|js|ts)$/, '')
    if (stem === 'claw' || stem.includes('openclaw')) return 'openclaw'
    if (stem.includes('nemoclaw')) return 'nemoclaw'
    if (stem.includes('opencode')) return 'opencode'
    if (RUNTIMES.includes(stem as ExternalCliRuntime)) {
      return stem as ExternalCliRuntime
    }
    return null
  }

  // Skip values for known flags where runtime words can appear incidentally.
  const valueFlags = new Set([
    '--gateway-name',
    '--sandbox-id',
    '--token',
    '--gateway',
    '-o',
  ])

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    if (token.startsWith('-')) continue
    const prev = (tokens[i - 1] || '').toLowerCase()
    if (valueFlags.has(prev)) continue
    const runtime = runtimeFromToken(token)
    if (runtime) return { runtime, source: 'direct' }
  }

  // Fallback: openshell gateway tunnels where runtime appears in --gateway-name.
  const gatewayMatch = command.match(/--gateway-name\s+([a-z0-9_-]+)/i)
  if (gatewayMatch) {
    const runtime = gatewayMatch[1].toLowerCase()
    if (RUNTIMES.includes(runtime as ExternalCliRuntime) && command.toLowerCase().includes('openshell')) {
      return { runtime: runtime as ExternalCliRuntime, source: 'gateway' }
    }
  }

  return null
}

async function findRuntimeProcesses(): Promise<RuntimeProcess[]> {
  try {
    const { stdout } = await execAsync(
      'ps -ww -eo pid=,tty=,%cpu=,rss=,etime=,command= 2>/dev/null',
    )
    const processes: RuntimeProcess[] = []
    for (const rawLine of stdout.split('\n')) {
      const line = rawLine.trim()
      if (!line) continue

      const match = line.match(/^(\d+)\s+(\S+)\s+(\S+)\s+(\d+)\s+(\S+)\s+(.+)$/)
      if (!match) continue

      const pid = parseInt(match[1], 10)
      if (!Number.isFinite(pid) || pid <= 0) continue

      const detection = detectRuntime(match[6])
      if (!detection) continue

      const cpuVal = parseFloat(match[3] || '0')
      const memoryKB = parseInt(match[4] || '0', 10)
      processes.push({
        pid,
        tty: normalizeTty(match[2]),
        cpu: `${(Number.isFinite(cpuVal) ? cpuVal : 0).toFixed(1)}%`,
        memoryMB: Math.round((Number.isFinite(memoryKB) ? memoryKB : 0) / 1024),
        startedAt: parseElapsedTimeToStart(match[5]),
        runtime: detection.runtime,
        source: detection.source,
        command: match[6],
      })
    }

    // Deduplicate gateway helper stacks (ssh + openshell) per runtime/tty.
    const deduped = new Map<string, RuntimeProcess>()
    for (const proc of processes) {
      const key =
        proc.source === 'gateway'
          ? `${proc.runtime}:${proc.tty || 'no-tty'}`
          : `${proc.runtime}:pid:${proc.pid}`
      const existing = deduped.get(key)
      if (!existing || proc.memoryMB > existing.memoryMB) {
        deduped.set(key, proc)
      }
    }
    return Array.from(deduped.values())
  } catch {
    return []
  }
}

export async function getOpencodeSessions(): Promise<OpencodeSession[]> {
  type SessionCandidate = OpencodeSession & { source: 'direct' | 'gateway'; command: string }
  const candidates: SessionCandidate[] = []

  try {
    const processes = await findRuntimeProcesses()
    for (const process of processes) {
      if (!isProcessAlive(process.pid)) continue
      const cwd = await getWorkingDirectory(process.pid)
      const project = cwd.split('/').pop() || process.runtime

      candidates.push({
        pid: process.pid,
        cwd,
        project,
        uptime: formatUptime(process.startedAt),
        cpu: process.cpu,
        memoryMB: process.memoryMB,
        alive: true,
        startedAt: process.startedAt,
        runtime: process.runtime,
        tty: process.tty,
        source: process.source,
        command: process.command,
      })
    }
  } catch {
    // No external CLI sessions found
  }

  // Deduplicate helpers and wrappers that map to the same runtime terminal.
  // Keep the most "project-like" session, not node_modules/runtime internals.
  const cmdHas = (s: SessionCandidate, token: string): boolean => s.command.toLowerCase().includes(token)
  const isNodeModulesPath = (cwd: string): boolean =>
    cwd.includes('/node_modules/') || cwd.endsWith('/node_modules')
  const isHomeOrRootPath = (cwd: string): boolean =>
    cwd === HOME || cwd === '/'
  const looksLikeRuntimeInstallPath = (cwd: string): boolean =>
    cwd.includes('/.nvm/versions/node/') ||
    cwd.includes('/.opencode/') ||
    cwd.includes('/.local/share/') ||
    cwd.includes('/.cache/')
  const isHelperCommand = (s: SessionCandidate): boolean =>
    cmdHas(s, 'ssh-proxy') ||
    cmdHas(s, 'vscode-eslint/server/out/eslintserver.js') ||
    cmdHas(s, '--gateway-name') ||
    cmdHas(s, 'proxycommand=')
  const isProjectLike = (s: SessionCandidate): boolean =>
    s.cwd !== HOME &&
    !isNodeModulesPath(s.cwd) &&
    !looksLikeRuntimeInstallPath(s.cwd) &&
    !cmdHas(s, '/node_modules/') &&
    !isHelperCommand(s)
  const isUnfocusableHelper = (s: SessionCandidate): boolean =>
    !s.tty || (
      s.source === 'gateway' ||
      isHelperCommand(s) ||
      cmdHas(s, '/node_modules/') ||
      isNodeModulesPath(s.cwd) ||
      looksLikeRuntimeInstallPath(s.cwd)
    )
  const isRootOpenclawWithoutTerminal = (s: SessionCandidate): boolean =>
    s.runtime === 'openclaw' &&
    isHomeOrRootPath(s.cwd) &&
    (
      !s.tty ||
      s.source === 'gateway' ||
      cmdHas(s, 'openclaw-gateway') ||
      isHelperCommand(s)
    )
  const candidateScore = (s: SessionCandidate): number => {
    let score = 0
    if (isProjectLike(s)) score += 2000
    if (!isNodeModulesPath(s.cwd)) score += 1000
    if (!cmdHas(s, '/node_modules/')) score += 600
    if (!looksLikeRuntimeInstallPath(s.cwd)) score += 250
    if (!isHelperCommand(s)) score += 200
    if (s.source === 'direct') score += 120
    if (s.cwd && s.cwd !== HOME) score += 60
    if (s.tty) score += 20
    score += Math.min(s.memoryMB, 400) // mild tie-breaker
    return score
  }

  // If we have at least one project-like session for a runtime, suppress
  // helper/runtime-install candidates for that runtime.
  const runtimeHasProjectLike = new Set<ExternalCliRuntime>()
  for (const candidate of candidates) {
    if (isProjectLike(candidate)) runtimeHasProjectLike.add(candidate.runtime)
  }

  const deduped = new Map<string, SessionCandidate>()
  for (const candidate of candidates) {
    // Suppress root-level OpenClaw daemon sessions that do not map to an IDE terminal.
    if (isRootOpenclawWithoutTerminal(candidate)) continue
    // Suppress helper processes that cannot be focused to a terminal.
    if (isUnfocusableHelper(candidate)) continue
    // When a project session exists for this runtime, hide wrapper/helper rows.
    if (
      runtimeHasProjectLike.has(candidate.runtime) &&
      !isProjectLike(candidate) &&
      (
        isNodeModulesPath(candidate.cwd) ||
        looksLikeRuntimeInstallPath(candidate.cwd) ||
        isHelperCommand(candidate) ||
        !candidate.tty
      )
    ) {
      continue
    }
    const key = candidate.tty
      ? `${candidate.runtime}:${candidate.tty}`
      : `${candidate.runtime}:pid:${candidate.pid}`
    const existing = deduped.get(key)
    if (!existing || candidateScore(candidate) > candidateScore(existing)) {
      deduped.set(key, candidate)
    }
  }

  const sessions = Array.from(deduped.values()).map(({ source: _source, command: _command, ...session }) => session)

  // Detect active gateway tunnels for runtimes that have no direct session.
  // A gateway tunnel (ssh port-forward) means the TUI is running inside a sandbox.
  const runtimesWithSessions = new Set(sessions.map(s => s.runtime))
  for (const candidate of candidates) {
    if (candidate.source !== 'gateway') continue
    if (runtimesWithSessions.has(candidate.runtime)) continue
    // Gateway tunnel alive = synthetic session for the remote TUI
    sessions.push({
      pid: candidate.pid,
      cwd: candidate.cwd === HOME ? HOME : candidate.cwd,
      project: candidate.runtime,
      uptime: candidate.uptime,
      cpu: candidate.cpu,
      memoryMB: candidate.memoryMB,
      alive: true,
      startedAt: candidate.startedAt,
      runtime: candidate.runtime,
      tty: candidate.tty,
    })
    runtimesWithSessions.add(candidate.runtime)
  }

  sessions.sort((a, b) => b.memoryMB - a.memoryMB)
  return sessions
}
