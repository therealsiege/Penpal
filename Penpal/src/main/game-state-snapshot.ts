/**
 * game-state-snapshot.ts
 *
 * Periodically writes a JSON snapshot of game state (agents, rooms, leaderboard)
 * to analytics/data/game-state.json so the MCP server can read it.
 */

import fs from 'fs'
import path from 'path'
import { getClaudeSessions, type ClaudeSession } from './sessions'
import { getAgentConfigs, type AgentConfig, type AgentStatus } from './agents'
import { getAllAgentXP, getAllAgentCredits, getOrchestratorStats, getTaskQueue, type AgentXP, type Task } from './orchestrator'
import { getDataDir } from './data-paths'

// ── Types ───────────────────────────────────────────────────────────────────

export interface AgentSnapshot {
  id: string
  name: string
  title: string
  status: 'idle' | 'active' | 'sleeping' | 'blocked'
  room: string
  roomPath: string
  currentTask: string | null
  xp: number
  level: number
  rankTitle: string
  credits: number
  tasksCompleted: number
  tasksFailed: number
  currentStreak: number
  sessionMode: string | null
  uptime: string | null
}

export interface RoomSnapshot {
  name: string
  path: string
  agents: string[]
  agentCount: number
  idleCount: number
  activeCount: number
  blockedCount: number
}

export interface LeaderboardEntrySnapshot {
  rank: number
  agentId: string
  agentName: string
  totalXP: number
  seasonXP: number
  weeklyXP: number
  level: number
  rankTitle: string
  tasksCompleted: number
  currentStreak: number
}

export interface RivalrySnapshot {
  agent1: string
  agent2: string
  xpDiff: number
  percentDiff: number
}

export interface GameStateSnapshot {
  timestamp: number
  weekStart: number
  agents: AgentSnapshot[]
  rooms: RoomSnapshot[]
  leaderboard: {
    alltime: LeaderboardEntrySnapshot[]
    season: LeaderboardEntrySnapshot[]
    weekly: LeaderboardEntrySnapshot[]
    weeklyMVP: { agentId: string; agentName: string; weekXP: number } | null
    rivalries: RivalrySnapshot[]
  }
  orchestrator: {
    queueDepth: number
    activeTasks: number
    completedToday: number
    failedToday: number
    totalProcessed: number
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const RIVALRY_THRESHOLD = 0.05

function getWeekStart(): number {
  const now = new Date()
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1) // Monday
  const weekStart = new Date(now)
  weekStart.setDate(diff)
  weekStart.setHours(0, 0, 0, 0)
  return weekStart.getTime()
}

function roomNameFromCwd(cwd: string): string {
  return path.basename(cwd) || cwd
}

function deriveAgentStatus(session: ClaudeSession | undefined): AgentSnapshot['status'] {
  if (!session) return 'sleeping'
  if (session.interactionType === 'tool-approval' || session.interactionType === 'accept-edits') return 'blocked'
  if (session.sessionMode === 'working' || session.sessionMode === 'compressing') return 'active'
  return 'idle'
}

// ── Weekly XP tracking ──────────────────────────────────────────────────────

const WEEKLY_XP_PATH = path.join(getDataDir(), 'weekly-xp.json')

interface WeeklyXPData {
  weekStart: number
  agents: Record<string, number>
}

function loadWeeklyXP(): WeeklyXPData {
  try {
    if (fs.existsSync(WEEKLY_XP_PATH)) {
      const data = JSON.parse(fs.readFileSync(WEEKLY_XP_PATH, 'utf-8')) as WeeklyXPData
      const currentWeekStart = getWeekStart()
      if (data.weekStart === currentWeekStart) return data
      // New week — reset
    }
  } catch { /* start fresh */ }
  return { weekStart: getWeekStart(), agents: {} }
}

let previousXPSnapshot: Record<string, number> = {}
let weeklyXPData = loadWeeklyXP()

function updateWeeklyXP(currentXP: Record<string, AgentXP>): void {
  const currentWeekStart = getWeekStart()
  if (weeklyXPData.weekStart !== currentWeekStart) {
    weeklyXPData = { weekStart: currentWeekStart, agents: {} }
    previousXPSnapshot = {}
  }

  for (const [agentId, xp] of Object.entries(currentXP)) {
    const prev = previousXPSnapshot[agentId] ?? xp.totalXP
    const delta = Math.max(0, xp.totalXP - prev)
    if (delta > 0) {
      weeklyXPData.agents[agentId] = (weeklyXPData.agents[agentId] ?? 0) + delta
    }
    previousXPSnapshot[agentId] = xp.totalXP
  }

  try {
    const dir = path.dirname(WEEKLY_XP_PATH)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(WEEKLY_XP_PATH, JSON.stringify(weeklyXPData, null, 2))
  } catch { /* noop */ }
}

// ── Snapshot Writer ─────────────────────────────────────────────────────────

// MCP server reads this snapshot. In dev it lives at analytics/data/ so the
// MCP server (which runs from analytics/) finds it; in packaged mode it goes
// to the writable data dir alongside other state.
const SNAPSHOT_PATH = (() => {
  const analyticsData = path.resolve(__dirname, '..', '..', 'analytics', 'data')
  if (fs.existsSync(analyticsData)) return path.join(analyticsData, 'game-state.json')
  return path.join(getDataDir(), 'game-state.json')
})()

export async function writeGameStateSnapshot(): Promise<void> {
  try {
    const [sessions, configs, xpData, creditData, stats, taskQueue] = await Promise.all([
      getClaudeSessions(),
      Promise.resolve(getAgentConfigs()),
      Promise.resolve(getAllAgentXP()),
      Promise.resolve(getAllAgentCredits()),
      Promise.resolve(getOrchestratorStats()),
      Promise.resolve(getTaskQueue()),
    ])

    updateWeeklyXP(xpData)

    // Build agent snapshots
    const agents: AgentSnapshot[] = configs.map(config => {
      const session = sessions.find(s =>
        config.defaultRepos.some(repo => s.cwd === repo),
      )

      const xp = xpData[config.id]
      const credits = creditData[config.id]
      const activeTask = taskQueue.find(
        t => t.assignedAgent === config.id && (t.status === 'assigned' || t.status === 'active'),
      )

      return {
        id: config.id,
        name: config.name,
        title: config.title,
        status: deriveAgentStatus(session),
        room: session ? roomNameFromCwd(session.cwd) : config.defaultRepos[0] ? roomNameFromCwd(config.defaultRepos[0]) : 'unassigned',
        roomPath: session?.cwd ?? config.defaultRepos[0] ?? '',
        currentTask: activeTask?.title ?? null,
        xp: xp?.totalXP ?? 0,
        level: xp?.level ?? 1,
        rankTitle: xp?.rank ?? 'Intern',
        credits: credits?.balance ?? 0,
        tasksCompleted: xp?.tasksCompleted ?? 0,
        tasksFailed: xp?.tasksFailed ?? 0,
        currentStreak: xp?.currentStreak ?? 0,
        sessionMode: session?.sessionMode ?? null,
        uptime: session?.uptime ?? null,
      }
    })

    // Build room snapshots by grouping agents by roomPath
    const roomMap = new Map<string, RoomSnapshot>()
    for (const agent of agents) {
      const key = agent.roomPath || 'unassigned'
      let room = roomMap.get(key)
      if (!room) {
        room = { name: agent.room, path: key, agents: [], agentCount: 0, idleCount: 0, activeCount: 0, blockedCount: 0 }
        roomMap.set(key, room)
      }
      room.agents.push(agent.name)
      room.agentCount++
      if (agent.status === 'idle' || agent.status === 'sleeping') room.idleCount++
      else if (agent.status === 'active') room.activeCount++
      else if (agent.status === 'blocked') room.blockedCount++
    }
    const rooms = Array.from(roomMap.values())

    // Build leaderboard entries
    const alltime: LeaderboardEntrySnapshot[] = agents
      .map(a => ({
        rank: 0,
        agentId: a.id,
        agentName: a.name,
        totalXP: a.xp,
        seasonXP: a.xp, // season XP tracked in renderer; use totalXP as proxy
        weeklyXP: weeklyXPData.agents[a.id] ?? 0,
        level: a.level,
        rankTitle: a.rankTitle,
        tasksCompleted: a.tasksCompleted,
        currentStreak: a.currentStreak,
      }))
      .sort((a, b) => b.totalXP - a.totalXP)
    alltime.forEach((e, i) => { e.rank = i + 1 })

    const season = [...alltime].sort((a, b) => b.seasonXP - a.seasonXP)
    season.forEach((e, i) => { e.rank = i + 1 })

    const weekly = [...alltime].sort((a, b) => b.weeklyXP - a.weeklyXP)
    weekly.forEach((e, i) => { e.rank = i + 1 })

    // Weekly MVP
    const topWeekly = weekly[0]
    const weeklyMVP = topWeekly && topWeekly.weeklyXP > 0
      ? { agentId: topWeekly.agentId, agentName: topWeekly.agentName, weekXP: topWeekly.weeklyXP }
      : null

    // Rivalry detection
    const rivalries: RivalrySnapshot[] = []
    for (let i = 0; i < alltime.length - 1; i++) {
      for (let j = i + 1; j < alltime.length; j++) {
        const a = alltime[i]
        const b = alltime[j]
        if (a.totalXP === 0 && b.totalXP === 0) continue
        const max = Math.max(a.totalXP, b.totalXP)
        if (max === 0) continue
        const diff = Math.abs(a.totalXP - b.totalXP)
        const pct = diff / max
        if (pct <= RIVALRY_THRESHOLD) {
          rivalries.push({
            agent1: a.agentName,
            agent2: b.agentName,
            xpDiff: diff,
            percentDiff: Math.round(pct * 100),
          })
        }
      }
    }

    const snapshot: GameStateSnapshot = {
      timestamp: Date.now(),
      weekStart: weeklyXPData.weekStart,
      agents,
      rooms,
      leaderboard: { alltime, season, weekly, weeklyMVP, rivalries },
      orchestrator: stats,
    }

    const dir = path.dirname(SNAPSHOT_PATH)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify(snapshot, null, 2))
  } catch (err) {
    console.error('[game-state-snapshot] Failed to write snapshot:', err)
  }
}
