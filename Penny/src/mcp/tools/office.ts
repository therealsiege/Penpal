/**
 * MCP tools: office:rooms, office:agents, office:leaderboard
 *
 * Exposes Phaser game state (snapshot at `analytics/data/game-state.json`) so agents
 * can reason about office layout, agent positions, and rankings.
 *
 * **Status normalization** (rollups use these labels):
 * - `busy` — in-game `active` (working)
 * - `idle` — `idle` or `sleeping`
 * - `blocked` — `blocked`
 *
 * **Room capacity**: Prefer `rooms[].capacity` from the snapshot when present. Otherwise
 * capacity is **inferred** as `Math.max(agentCount, 4)` (minimum four desks per room) so
 * utilization is meaningful; `capacitySource` is `"snapshot"` or `"inferred"`.
 *
 * **Leaderboard periods**:
 * - `season` — current season XP (`leaderboard.season`, falls back to `alltime` if missing)
 * - `weekly` — ranked by `weeklyXP`
 * - `alltime` — ranked by `totalXP`
 *
 * **Rivalries**: Pairs from `leaderboard.rivalries` (close XP competition); surfaced in
 * `data.rivalries` and in suggestions when non-empty.
 */

import fs from 'fs'
import path from 'path'
import { toolRegistry } from '../tools.js'
import { wrapResponse, type ContextEngineeredResponse } from '../response.js'

// ── Game state snapshot ─────────────────────────────────────────────────────

const SNAPSHOT_PATH = path.resolve(__dirname, '..', '..', '..', '..', 'analytics', 'data', 'game-state.json')

export type LeaderboardPeriod = 'season' | 'weekly' | 'alltime'

export interface SnapshotRoom {
  name: string
  path: string
  agents: string[]
  agentCount: number
  idleCount: number
  activeCount: number
  blockedCount: number
  /** When present, used as authoritative capacity (desks / seats). */
  capacity?: number
}

export interface SnapshotAgent {
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
}

export interface LeaderboardRow {
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

export interface WeeklyMiniRow {
  rank: number
  agentId: string
  agentName: string
  weeklyXP: number
}

export interface RivalryEntry {
  agent1: string
  agent2: string
  xpDiff: number
  percentDiff: number
}

export interface GameStateSnapshot {
  timestamp: number
  weekStart?: number
  agents: SnapshotAgent[]
  rooms: SnapshotRoom[]
  leaderboard: {
    alltime: LeaderboardRow[]
    season?: LeaderboardRow[]
    weekly: (LeaderboardRow | WeeklyMiniRow)[]
    weeklyMVP: { agentId: string; agentName: string; weekXP: number } | null
    rivalries: RivalryEntry[]
  }
  orchestrator: {
    queueDepth: number
    activeTasks: number
    completedToday: number
    failedToday: number
    totalProcessed?: number
  }
}

// ── Response shapes (MCP `data` payloads) ─────────────────────────────────

export type NormalizedAgentStatus = 'busy' | 'idle' | 'blocked'

export interface OfficeAgentRow extends SnapshotAgent {
  /** 1-based rank from all-time leaderboard (by agent id), or 0 if unknown */
  rank: number
  /** Normalized status for rollups */
  normalizedStatus: NormalizedAgentStatus
}

export interface StatusBreakdown {
  busy: number
  idle: number
  blocked: number
  total: number
}

export interface OfficeAgentsData {
  agents: OfficeAgentRow[]
  statusBreakdown: StatusBreakdown
  snapshotAge: string
}

export interface RoomOccupancy {
  count: number
  capacity: number
  utilizationPercent: number
  capacitySource: 'snapshot' | 'inferred'
}

export interface OfficeRoomRow {
  name: string
  path: string
  agents: string[]
  agentCount: number
  idleCount: number
  activeCount: number
  blockedCount: number
  occupancy: RoomOccupancy
}

export interface OfficeRoomsData {
  rooms: OfficeRoomRow[]
  totalRooms: number
  totalAssignedAgents: number
  highUtilizationRooms: string[]
  overCapacityRooms: string[]
  snapshotAge: string
}

export interface RankedLeaderboardEntry {
  rank: number
  agentId: string
  agentName: string
  /** Sort key for the selected period */
  xp: number
  totalXP: number
  seasonXP: number
  weeklyXP: number
  level: number
  rankTitle: string
  tasksCompleted: number
  currentStreak: number
}

export interface OfficeLeaderboardData {
  period: LeaderboardPeriod
  rankings: RankedLeaderboardEntry[]
  weeklyMVP: { agentId: string; agentName: string; weekXP: number } | null
  rivalries: RivalryEntry[]
  seasonInfo: {
    weekStart: number | null
    label: string | null
  }
  snapshotAge: string
}

const DEFAULT_INFERRED_MIN_CAPACITY = 4

function normalizeAgentStatus(raw: string): NormalizedAgentStatus {
  if (raw === 'blocked') return 'blocked'
  if (raw === 'active') return 'busy'
  return 'idle'
}

function snapshotAge(snapshot: GameStateSnapshot): string {
  const ts = typeof snapshot.timestamp === 'number' ? snapshot.timestamp : 0
  const ageMs = Date.now() - ts
  if (ageMs < 0) return '0s ago'
  if (ageMs < 60_000) return `${Math.round(ageMs / 1000)}s ago`
  if (ageMs < 3_600_000) return `${Math.round(ageMs / 60_000)}min ago`
  return `${Math.round(ageMs / 3_600_000)}h ago`
}

function safeArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : []
}

/** Loads and parses snapshot; returns null if missing or invalid. */
export function loadSnapshot(): GameStateSnapshot | null {
  try {
    if (!fs.existsSync(SNAPSHOT_PATH)) return null
    const raw = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf-8')) as unknown
    return parseSnapshot(raw)
  } catch {
    return null
  }
}

export function parseSnapshot(raw: unknown): GameStateSnapshot | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const ts = typeof o.timestamp === 'number' ? o.timestamp : 0
  const agents = safeArray<SnapshotAgent>(o.agents)
  const rooms = safeArray<SnapshotRoom>(o.rooms)
  const lbRaw = o.leaderboard
  const orchestratorRaw = o.orchestrator

  const lbObj =
    lbRaw && typeof lbRaw === 'object'
      ? (lbRaw as Record<string, unknown>)
      : {
          alltime: [],
          weekly: [],
          weeklyMVP: null,
          rivalries: [],
        }

  const alltime = safeArray<LeaderboardRow>(lbObj.alltime)
  const season = lbObj.season !== undefined ? safeArray<LeaderboardRow>(lbObj.season) : undefined
  const weekly = safeArray<LeaderboardRow | WeeklyMiniRow>(lbObj.weekly)
  const weeklyMVP =
    lbObj.weeklyMVP === null || lbObj.weeklyMVP === undefined
      ? null
      : (lbObj.weeklyMVP as { agentId: string; agentName: string; weekXP: number })
  const rivalries = safeArray<RivalryEntry>(lbObj.rivalries)

  const orch =
    orchestratorRaw && typeof orchestratorRaw === 'object'
      ? (orchestratorRaw as GameStateSnapshot['orchestrator'])
      : { queueDepth: 0, activeTasks: 0, completedToday: 0, failedToday: 0 }

  return {
    timestamp: ts,
    weekStart: typeof o.weekStart === 'number' ? o.weekStart : undefined,
    agents,
    rooms,
    leaderboard: {
      alltime,
      season,
      weekly,
      weeklyMVP,
      rivalries,
    },
    orchestrator: {
      queueDepth: orch.queueDepth ?? 0,
      activeTasks: orch.activeTasks ?? 0,
      completedToday: orch.completedToday ?? 0,
      failedToday: orch.failedToday ?? 0,
      totalProcessed: orch.totalProcessed,
    },
  }
}

function rankByAgentId(alltime: LeaderboardRow[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const row of alltime) {
    if (row.agentId && typeof row.rank === 'number') {
      m.set(row.agentId, row.rank)
    }
  }
  return m
}

function rowToLeaderboardRow(r: LeaderboardRow | WeeklyMiniRow): LeaderboardRow {
  const w = r as WeeklyMiniRow
  const full = r as LeaderboardRow
  return {
    rank: typeof r.rank === 'number' ? r.rank : 0,
    agentId: r.agentId ?? '',
    agentName: r.agentName ?? '',
    totalXP: typeof full.totalXP === 'number' ? full.totalXP : 0,
    seasonXP: typeof full.seasonXP === 'number' ? full.seasonXP : 0,
    weeklyXP: typeof w.weeklyXP === 'number' ? w.weeklyXP : typeof full.weeklyXP === 'number' ? full.weeklyXP : 0,
    level: typeof full.level === 'number' ? full.level : 0,
    rankTitle: typeof full.rankTitle === 'string' ? full.rankTitle : '',
    tasksCompleted: typeof full.tasksCompleted === 'number' ? full.tasksCompleted : 0,
    currentStreak: typeof full.currentStreak === 'number' ? full.currentStreak : 0,
  }
}

function metricForPeriod(row: LeaderboardRow, period: LeaderboardPeriod): number {
  if (period === 'weekly') return row.weeklyXP
  if (period === 'season') return row.seasonXP
  return row.totalXP
}

function sortAndRankRows(rows: LeaderboardRow[], period: LeaderboardPeriod): RankedLeaderboardEntry[] {
  const normalized = rows.map(rowToLeaderboardRow).filter((r) => r.agentId)
  const sorted = [...normalized].sort((a, b) => {
    const diff = metricForPeriod(b, period) - metricForPeriod(a, period)
    if (diff !== 0) return diff
    return a.agentName.localeCompare(b.agentName)
  })
  return sorted.map((r, i) => ({
    rank: i + 1,
    agentId: r.agentId,
    agentName: r.agentName,
    xp: metricForPeriod(r, period),
    totalXP: r.totalXP,
    seasonXP: r.seasonXP,
    weeklyXP: r.weeklyXP,
    level: r.level,
    rankTitle: r.rankTitle,
    tasksCompleted: r.tasksCompleted,
    currentStreak: r.currentStreak,
  }))
}

function rowsForPeriod(snapshot: GameStateSnapshot, period: LeaderboardPeriod): LeaderboardRow[] {
  const lb = snapshot.leaderboard
  if (period === 'season') {
    const s = lb.season
    if (s && s.length > 0) return s.map(rowToLeaderboardRow)
    return lb.alltime.map(rowToLeaderboardRow)
  }
  if (period === 'weekly') {
    return lb.weekly.map(rowToLeaderboardRow)
  }
  return lb.alltime.map(rowToLeaderboardRow)
}

function inferRoomCapacity(room: SnapshotRoom): { capacity: number; capacitySource: 'snapshot' | 'inferred' } {
  const cap = room.capacity
  if (typeof cap === 'number' && cap > 0) {
    return { capacity: cap, capacitySource: 'snapshot' }
  }
  return {
    capacity: Math.max(room.agentCount, DEFAULT_INFERRED_MIN_CAPACITY),
    capacitySource: 'inferred',
  }
}

export function parseLeaderboardPeriod(value: unknown): LeaderboardPeriod {
  if (value === 'season' || value === 'weekly' || value === 'alltime') return value
  return 'season'
}

/** Builds office:agents payload from a loaded snapshot (for tests and composition). */
export function buildOfficeAgentsResponse(snapshot: GameStateSnapshot): ContextEngineeredResponse<OfficeAgentsData> {
  const rankMap = rankByAgentId(snapshot.leaderboard.alltime.map(rowToLeaderboardRow))
  const agents: OfficeAgentRow[] = snapshot.agents.map((a) => ({
    ...a,
    rank: rankMap.get(a.id) ?? 0,
    normalizedStatus: normalizeAgentStatus(a.status),
  }))

  let busy = 0
  let idle = 0
  let blocked = 0
  for (const a of agents) {
    if (a.normalizedStatus === 'busy') busy++
    else if (a.normalizedStatus === 'blocked') blocked++
    else idle++
  }

  const statusBreakdown: StatusBreakdown = {
    busy,
    idle,
    blocked,
    total: agents.length,
  }

  const age = snapshotAge(snapshot)
  const summary = `${agents.length} agent(s): ${busy} busy, ${idle} idle, ${blocked} blocked. Snapshot: ${age}.`

  const suggestions: string[] = []
  if (blocked > 0) {
    const names = agents.filter((x) => x.normalizedStatus === 'blocked').map((x) => x.name)
    suggestions.push(`Blocked agents: ${names.join(', ')} — approve via sessions:approve.`)
  }
  if (idle > 0 && snapshot.orchestrator.queueDepth > 0) {
    suggestions.push(`${idle} idle agent(s) with ${snapshot.orchestrator.queueDepth} queued task(s) — assign via pods:create.`)
  }
  if (idle > 0 && snapshot.orchestrator.queueDepth === 0 && blocked === 0) {
    suggestions.push(`${idle} idle agent(s) — check orchestrator:queue for incoming work or pods:create to start workflows.`)
  }
  if (suggestions.length === 0) {
    suggestions.push('Cross-check office:rooms for spatial context and office:leaderboard for standings.')
  }

  return wrapResponse({ agents, statusBreakdown, snapshotAge: age }, summary, suggestions, [
    'office:rooms',
    'office:leaderboard',
    'orchestrator:queue',
  ])
}

/** Builds office:rooms payload from a loaded snapshot. */
export function buildOfficeRoomsResponse(snapshot: GameStateSnapshot): ContextEngineeredResponse<OfficeRoomsData> {
  const rooms: OfficeRoomRow[] = snapshot.rooms.map((r) => {
    const { capacity, capacitySource } = inferRoomCapacity(r)
    const count = typeof r.agentCount === 'number' ? r.agentCount : 0
    const utilizationPercent = capacity > 0 ? Math.min(100, Math.round((count / capacity) * 100)) : 0
    return {
      name: r.name,
      path: r.path,
      agents: safeArray<string>(r.agents),
      agentCount: count,
      idleCount: r.idleCount ?? 0,
      activeCount: r.activeCount ?? 0,
      blockedCount: r.blockedCount ?? 0,
      occupancy: {
        count,
        capacity,
        utilizationPercent,
        capacitySource,
      },
    }
  })

  const totalRooms = rooms.length
  const totalAssignedAgents = rooms.reduce((s, r) => s + r.agentCount, 0)

  const highUtilizationRooms = rooms.filter((r) => r.occupancy.utilizationPercent >= 85).map((r) => r.name)
  const overCapacityRooms = rooms.filter((r) => r.agentCount > r.occupancy.capacity).map((r) => r.name)

  const age = snapshotAge(snapshot)
  let summary = `${totalRooms} room(s), ${totalAssignedAgents} assigned agent(s). Snapshot: ${age}.`
  if (highUtilizationRooms.length > 0) {
    summary += ` High utilization (≥85%): ${highUtilizationRooms.join(', ')}.`
  }
  if (overCapacityRooms.length > 0) {
    summary += ` Over capacity: ${overCapacityRooms.join(', ')}.`
  }

  const blockedRoomCount = blockedRoomsCount(snapshot.rooms)
  const suggestions: string[] = []
  if (blockedRoomCount > 0) {
    suggestions.push(`${blockedRoomCount} room(s) report blocked agents — use office:agents for names.`)
  }
  if (highUtilizationRooms.length > 0) {
    suggestions.push(`Tight rooms: ${highUtilizationRooms.join(', ')} — consider rebalancing workloads across rooms.`)
  }
  if (overCapacityRooms.length > 0) {
    suggestions.push(`Over-capacity rooms: ${overCapacityRooms.join(', ')} — verify desk assignments in the dashboard.`)
  }
  if (suggestions.length === 0) {
    suggestions.push('Use office:agents for per-agent status and office:leaderboard for XP standings.')
  }

  return wrapResponse(
    {
      rooms,
      totalRooms,
      totalAssignedAgents,
      highUtilizationRooms,
      overCapacityRooms,
      snapshotAge: age,
    },
    summary,
    suggestions,
    ['office:agents', 'office:leaderboard'],
  )
}

function blockedRoomsCount(rooms: SnapshotRoom[]): number {
  return rooms.filter((r) => (r.blockedCount ?? 0) > 0).length
}

/** Builds office:leaderboard payload from a loaded snapshot. */
export function buildOfficeLeaderboardResponse(
  snapshot: GameStateSnapshot,
  period: LeaderboardPeriod,
): ContextEngineeredResponse<OfficeLeaderboardData> {
  const lb = snapshot.leaderboard
  const sourceRows = rowsForPeriod(snapshot, period)
  const rankings = sortAndRankRows(sourceRows, period)

  const mvp = lb.weeklyMVP
  const rivalries = safeArray<RivalryEntry>(lb.rivalries)

  const weekStart = typeof snapshot.weekStart === 'number' ? snapshot.weekStart : null
  const seasonInfo = {
    weekStart,
    label: weekStart !== null ? `Week of ${new Date(weekStart).toISOString().slice(0, 10)}` : null,
  }

  const age = snapshotAge(snapshot)
  const periodLabel =
    period === 'season' ? 'season XP' : period === 'weekly' ? 'weekly XP' : 'all-time XP'
  let summary = `${period} leaderboard (${periodLabel}): ${rankings.length} agent(s) ranked. Snapshot: ${age}.`
  const top = rankings[0]
  if (top) {
    summary += ` #1: ${top.agentName} (${top.xp} XP for this period).`
  }
  if (mvp) {
    summary += ` Weekly MVP: ${mvp.agentName} (+${mvp.weekXP} XP).`
  }
  if (rivalries.length > 0) {
    summary += ` ${rivalries.length} rivalry pair(s) detected.`
  }

  const suggestions: string[] = []
  if (rivalries.length > 0) {
    const r = rivalries[0]
    suggestions.push(`Rivalry: ${r.agent1} vs ${r.agent2} (Δ${r.xpDiff} XP, ${r.percentDiff}% gap) — close competition.`)
  }
  if (top && top.currentStreak >= 5) {
    suggestions.push(`${top.agentName} on a ${top.currentStreak}-task streak — consider increased autonomy.`)
  }
  if (suggestions.length === 0) {
    suggestions.push('Compare office:agents to see who is idle versus busy on the floor.')
  }

  return wrapResponse(
    {
      period,
      rankings,
      weeklyMVP: mvp,
      rivalries,
      seasonInfo,
      snapshotAge: age,
    },
    summary,
    suggestions,
    ['office:agents', 'office:rooms'],
  )
}

// ── Handlers (file-backed) ─────────────────────────────────────────────────

const EMPTY_SNAPSHOT_AGE = 'unavailable'

export async function handleOfficeRooms(): Promise<ContextEngineeredResponse<OfficeRoomsData>> {
  const snapshot = loadSnapshot()
  if (!snapshot) {
    return wrapResponse(
      {
        rooms: [],
        totalRooms: 0,
        totalAssignedAgents: 0,
        highUtilizationRooms: [],
        overCapacityRooms: [],
        snapshotAge: EMPTY_SNAPSHOT_AGE,
      },
      'No game state snapshot available — Penny dashboard may not be running.',
      ['Start Penny Electron app to generate game state.'],
      ['office:agents'],
    )
  }
  return buildOfficeRoomsResponse(snapshot)
}

export async function handleOfficeAgents(): Promise<ContextEngineeredResponse<OfficeAgentsData>> {
  const snapshot = loadSnapshot()
  if (!snapshot) {
    return wrapResponse(
      {
        agents: [],
        statusBreakdown: { busy: 0, idle: 0, blocked: 0, total: 0 },
        snapshotAge: EMPTY_SNAPSHOT_AGE,
      },
      'No game state snapshot available.',
      ['Start Penny Electron app to generate game state.'],
      ['office:rooms'],
    )
  }
  return buildOfficeAgentsResponse(snapshot)
}

export async function handleOfficeLeaderboard(
  params: Record<string, unknown> = {},
): Promise<ContextEngineeredResponse<OfficeLeaderboardData>> {
  const snapshot = loadSnapshot()
  const period = parseLeaderboardPeriod(params.period)
  if (!snapshot) {
    return wrapResponse(
      {
        period,
        rankings: [],
        weeklyMVP: null,
        rivalries: [],
        seasonInfo: { weekStart: null, label: null },
        snapshotAge: EMPTY_SNAPSHOT_AGE,
      },
      'No game state snapshot available.',
      ['Start Penny Electron app to generate game state.'],
      ['office:agents'],
    )
  }
  return buildOfficeLeaderboardResponse(snapshot, period)
}

// ── MCP Tool Registration ───────────────────────────────────────────────────

toolRegistry.register({
  name: 'office:rooms',
  description: 'Get the current office room layout with occupancy, inferred capacity, and agent counts.',
  inputSchema: {
    type: 'object',
    properties: {},
    additionalProperties: false,
  },
  handler: async () => handleOfficeRooms(),
})

toolRegistry.register({
  name: 'office:agents',
  description:
    'Get all agent states: name, status, room, task, XP, rank, plus idle/busy/blocked breakdown.',
  inputSchema: {
    type: 'object',
    properties: {},
    additionalProperties: false,
  },
  handler: async () => handleOfficeAgents(),
})

toolRegistry.register({
  name: 'office:leaderboard',
  description:
    'Ranked agents by XP for the selected period (season, weekly, or all-time), with MVP and rivalries.',
  inputSchema: {
    type: 'object',
    properties: {
      period: {
        type: 'string',
        enum: ['season', 'weekly', 'alltime'],
        description: 'Ranking basis: season XP, weekly XP, or all-time total XP',
      },
    },
    additionalProperties: false,
  },
  handler: async (params) => handleOfficeLeaderboard(params),
})
