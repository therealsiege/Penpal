import { exec } from 'child_process'
import { promisify } from 'util'
import os from 'os'
import fs from 'fs'
import path from 'path'

const execAsync = promisify(exec)

const HOME = process.env.HOME || '/Users/fuzeelogik'

export interface OpencodeSession {
  pid: number
  cwd: string
  project: string
  uptime: string
  cpu: string
  memoryMB: number
  alive: boolean
  startedAt: number
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

async function getProcessStats(pid: number): Promise<{ cpu: string; memoryMB: number; startedAt: number }> {
  try {
    const { stdout } = await execAsync(
      `ps -o %cpu=,%mem=,rss=,etime= -p ${pid} 2>/dev/null`,
    )
    const parts = stdout.trim().split(/\s+/)
    const cpu = `${parseFloat(parts[0] || '0').toFixed(1)}%`
    const memoryMB = Math.round(parseInt(parts[2] || '0', 10) / 1024)

    // Parse elapsed time (etime format: [[dd-]hh:]mm:ss or mm:ss)
    const etime = parts[3] || '0'
    const startedAt = parseElapsedTimeToStart(etime)

    return { cpu, memoryMB, startedAt }
  } catch {
    return { cpu: '0%', memoryMB: 0, startedAt: Date.now() }
  }
}

function parseElapsedTimeToStart(etime: string): number {
  // etime format: [[dd-]hh:]mm:ss
  const parts = etime.split(/[-:]/)
  let seconds = 0

  if (parts.length === 3) {
    // dd-hh:mm:ss
    const days = parseInt(parts[0], 10) || 0
    const hours = parseInt(parts[1], 10) || 0
    const mins = parseInt(parts[2], 10) || 0
    seconds = days * 86400 + hours * 3600 + mins * 60
  } else if (parts.length === 2) {
    // hh:mm:ss
    const hours = parseInt(parts[0], 10) || 0
    const mins = parseInt(parts[1], 10) || 0
    seconds = hours * 3600 + mins * 60
  } else if (parts.length === 1 && parts[0].includes(':')) {
    // mm:ss
    const [mins, secs] = parts[0].split(':').map(n => parseInt(n, 10) || 0)
    seconds = mins * 60 + secs
  }

  return Date.now() - seconds * 1000
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
      `lsof -p ${pid} 2>/dev/null | grep cwd | awk '{print $NF}' | head -1`,
    )
    return stdout.trim() || HOME
  } catch {
    return HOME
  }
}

export async function getOpencodeSessions(): Promise<OpencodeSession[]> {
  const sessions: OpencodeSession[] = []

  try {
    const { stdout } = await execAsync(
      `ps aux | grep "[o]pencode" | grep -v "grep" | awk '{print $2}'`,
    )
    const pids = stdout.trim().split('\n').filter(p => p).map(p => parseInt(p.trim(), 10))

    for (const pid of pids) {
      if (!isProcessAlive(pid)) continue

      const [stats, cwd] = await Promise.all([
        getProcessStats(pid),
        getWorkingDirectory(pid),
      ])

      const project = cwd.split('/').pop() || 'opencode'

      sessions.push({
        pid,
        cwd,
        project,
        uptime: formatUptime(stats.startedAt),
        cpu: stats.cpu,
        memoryMB: stats.memoryMB,
        alive: true,
        startedAt: stats.startedAt,
      })
    }
  } catch {
    // No opencode sessions found
  }

  sessions.sort((a, b) => b.memoryMB - a.memoryMB)
  return sessions
}
