/**
 * MCP tools: office:rooms, office:agents, office:leaderboard
 *
 * Exposes game state so agents can see the office layout,
 * agent positions/statuses, and season rankings.
 */

import fs from 'fs'
import path from 'path'
import { toolRegistry } from '../tools.js'
import { wrapResponse, type ContextEngineeredResponse } from '../response.js'

// ── Game state snapshot ─────────────────────────────────────────────────────

const SNAPSHOT_PATH = path.resolve(__dirname, '..', '..', '..', '..', 'analytics', 'data', 'game-state.json')

interface GameStateSnapshot {
  timestamp: number
  agents: {
    id: string
    name: string
    title: string
    status: string
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
  }[]
  rooms: {
    name: string
    path: string
    agents: string[]
    agentCount: number
    idleCount: number
    activeCount: number
    blockedCount: number
  }[]
  leaderboard: {
    alltime: {
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
    }[]
    weekly: {
      rank: number
      agentId: string
      agentName: string
      weeklyXP: number
    }[]
    weeklyMVP: { agentId: string; agentName: string; weekXP: number } | null
    rivalries: { agent1: string; agent2: string; xpDiff: number; percentDiff: number }[]
  }
  orchestrator: {
    queueDepth: number
    activeTasks: number
    completedToday: number
    failedToday: number
  }
}

function loadSnapshot(): GameStateSnapshot | null {
  try {
    if (!fs.existsSync(SNAPSHOT_PATH)) return null
    return JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf-8')) as GameStateSnapshot
  } catch {
    return null
  }
}

function snapshotAge(snapshot: GameStateSnapshot): string {
  const ageMs = Date.now() - snapshot.timestamp
  if (ageMs < 60_000) return `${Math.round(ageMs / 1000)}s ago`
  if (ageMs < 3_600_000) return `${Math.round(ageMs / 60_000)}min ago`
  return `${Math.round(ageMs / 3_600_000)}h ago`
}

// ── Exported handler functions ───────────────────────────────────────────────

export async function handleOfficeRooms(): Promise<ContextEngineeredResponse<unknown>> {
  const snapshot = loadSnapshot()
  if (!snapshot) {
    return wrapResponse(
      { rooms: [] },
      'No game state snapshot available — Penny dashboard may not be running.',
      ['Start Penny Electron app to generate game state.'],
      ['office:agents'],
    )
  }

  const rooms = snapshot.rooms
  const totalAgents = rooms.reduce((sum, r) => sum + r.agentCount, 0)
  const activeRooms = rooms.filter(r => r.activeCount > 0)

  const summary = `${rooms.length} room(s) with ${totalAgents} agent(s). ${activeRooms.length} room(s) have active agents. Snapshot: ${snapshotAge(snapshot)}.`

  const suggestions: string[] = []
  const blockedRooms = rooms.filter(r => r.blockedCount > 0)
  if (blockedRooms.length > 0) {
    suggestions.push(`${blockedRooms.length} room(s) have blocked agents — check office:agents for details.`)
  }
  if (rooms.length === 0) suggestions.push('No rooms — agents may not be assigned yet.')

  return wrapResponse({ rooms, snapshotAge: snapshotAge(snapshot) }, summary, suggestions, ['office:agents', 'office:leaderboard'])
}

export async function handleOfficeAgents(): Promise<ContextEngineeredResponse<unknown>> {
  const snapshot = loadSnapshot()
  if (!snapshot) {
    return wrapResponse(
      { agents: [] },
      'No game state snapshot available.',
      ['Start Penny Electron app to generate game state.'],
      ['office:rooms'],
    )
  }

  const agents = snapshot.agents
  const active = agents.filter(a => a.status === 'active')
  const idle = agents.filter(a => a.status === 'idle' || a.status === 'sleeping')
  const blocked = agents.filter(a => a.status === 'blocked')

  const summary = `${agents.length} agent(s): ${active.length} active, ${idle.length} idle, ${blocked.length} blocked. Snapshot: ${snapshotAge(snapshot)}.`

  const suggestions: string[] = []
  if (blocked.length > 0) {
    suggestions.push(`Blocked agents: ${blocked.map(a => a.name).join(', ')} — approve via sessions:approve.`)
  }
  if (idle.length > 0 && snapshot.orchestrator.queueDepth > 0) {
    suggestions.push(`${idle.length} idle agent(s) with ${snapshot.orchestrator.queueDepth} queued tasks — assign via pod:create.`)
  }

  return wrapResponse({ agents, snapshotAge: snapshotAge(snapshot) }, summary, suggestions, [
    'office:rooms',
    'office:leaderboard',
    'orchestrator:queue',
  ])
}

export async function handleOfficeLeaderboard(): Promise<ContextEngineeredResponse<unknown>> {
  const snapshot = loadSnapshot()
  if (!snapshot) {
    return wrapResponse(
      { leaderboard: null },
      'No game state snapshot available.',
      ['Start Penny Electron app to generate game state.'],
      ['office:agents'],
    )
  }

  const lb = snapshot.leaderboard
  const topAgent = lb.alltime[0]
  const mvp = lb.weeklyMVP

  let summary = `Leaderboard: ${lb.alltime.length} agent(s) ranked.`
  if (topAgent) summary += ` #1: ${topAgent.agentName} (${topAgent.totalXP} XP, L${topAgent.level} ${topAgent.rankTitle}).`
  if (mvp) summary += ` Weekly MVP: ${mvp.agentName} (+${mvp.weekXP} XP).`

  const suggestions: string[] = []
  if (lb.rivalries.length > 0) {
    const r = lb.rivalries[0]
    suggestions.push(`Rivalry: ${r.agent1} vs ${r.agent2} (${r.percentDiff}% apart) — close competition!`)
  }
  if (topAgent && topAgent.currentStreak >= 5) {
    suggestions.push(`${topAgent.agentName} on a ${topAgent.currentStreak}-task streak — consider increased autonomy.`)
  }

  return wrapResponse(
    { alltime: lb.alltime, weekly: lb.weekly, weeklyMVP: mvp, rivalries: lb.rivalries },
    summary,
    suggestions,
    ['office:agents', 'office:rooms'],
  )
}

// ── MCP Tool Registration ───────────────────────────────────────────────────

toolRegistry.register({
  name: 'office:rooms',
  description: 'Get the current office room layout with agent counts and activity levels.',
  inputSchema: {
    type: 'object',
    properties: {},
    additionalProperties: false,
  },
  handler: async () => handleOfficeRooms(),
})

toolRegistry.register({
  name: 'office:agents',
  description: 'Get all agent positions, statuses, XP levels, and current tasks in the office.',
  inputSchema: {
    type: 'object',
    properties: {},
    additionalProperties: false,
  },
  handler: async () => handleOfficeAgents(),
})

toolRegistry.register({
  name: 'office:leaderboard',
  description: 'Get the current season leaderboard with XP rankings, weekly MVP, and rivalries.',
  inputSchema: {
    type: 'object',
    properties: {},
    additionalProperties: false,
  },
  handler: async () => handleOfficeLeaderboard(),
})
