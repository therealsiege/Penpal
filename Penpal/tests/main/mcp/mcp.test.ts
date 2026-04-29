import { describe, it, expect } from 'vitest'
import { toolRegistry } from '../../../src/mcp/tools.js'
import '../../../src/mcp/tools/office.js'
import {
  buildOfficeAgentsResponse,
  buildOfficeRoomsResponse,
  buildOfficeLeaderboardResponse,
  parseLeaderboardPeriod,
  parseSnapshot,
  type GameStateSnapshot,
  type SnapshotAgent,
} from '../../../src/mcp/tools/office.js'

function agent(partial: Partial<SnapshotAgent> & Pick<SnapshotAgent, 'id' | 'name' | 'status'>): SnapshotAgent {
  return {
    title: '',
    room: 'r1',
    roomPath: '/r1',
    currentTask: null,
    xp: 0,
    level: 1,
    rankTitle: '',
    credits: 0,
    tasksCompleted: 0,
    tasksFailed: 0,
    currentStreak: 0,
    sessionMode: null,
    uptime: null,
    ...partial,
  }
}

function baseSnapshot(): GameStateSnapshot {
  return {
    timestamp: Date.now(),
    weekStart: 1_704_000_000_000,
    agents: [],
    rooms: [],
    leaderboard: {
      alltime: [],
      season: [],
      weekly: [],
      weeklyMVP: null,
      rivalries: [],
    },
    orchestrator: { queueDepth: 0, activeTasks: 0, completedToday: 0, failedToday: 0 },
  }
}

describe('office MCP tools', () => {
  it('registers office:agents, office:rooms, office:leaderboard with expected schemas', () => {
    const names = toolRegistry.list().map((t) => t.name)
    expect(names).toContain('office:agents')
    expect(names).toContain('office:rooms')
    expect(names).toContain('office:leaderboard')

    const lb = toolRegistry.get('office:leaderboard')
    expect(lb?.inputSchema).toMatchObject({
      type: 'object',
      additionalProperties: false,
      properties: {
        period: { type: 'string', enum: ['season', 'weekly', 'alltime'] },
      },
    })
  })

  it('office:agents includes status breakdown matching normalized statuses', () => {
    const snapshot = baseSnapshot()
    snapshot.agents = [
      agent({ id: 'a1', name: 'Busy', status: 'active', xp: 10 }),
      agent({ id: 'a2', name: 'Idle', status: 'idle', xp: 5 }),
      agent({ id: 'a3', name: 'Sleep', status: 'sleeping', xp: 5 }),
      agent({ id: 'a4', name: 'Block', status: 'blocked', xp: 0 }),
    ]
    snapshot.leaderboard.alltime = [
      {
        rank: 1,
        agentId: 'a1',
        agentName: 'Busy',
        totalXP: 10,
        seasonXP: 10,
        weeklyXP: 2,
        level: 1,
        rankTitle: 'X',
        tasksCompleted: 1,
        currentStreak: 1,
      },
    ]

    const res = buildOfficeAgentsResponse(snapshot)
    expect(res.data.statusBreakdown.busy).toBe(1)
    expect(res.data.statusBreakdown.idle).toBe(2)
    expect(res.data.statusBreakdown.blocked).toBe(1)
    expect(res.data.statusBreakdown.total).toBe(4)
    expect(res.data.agents.find((a) => a.id === 'a1')?.normalizedStatus).toBe('busy')
    expect(res.data.agents.find((a) => a.id === 'a3')?.normalizedStatus).toBe('idle')
    expect(res.summary.length).toBeGreaterThan(0)
    expect(res.suggestions.length).toBeGreaterThan(0)
  })

  it('office:rooms includes per-room occupancy counts', () => {
    const snapshot = baseSnapshot()
    snapshot.rooms = [
      {
        name: 'alpha',
        path: '/a',
        agents: ['u1', 'u2'],
        agentCount: 2,
        idleCount: 1,
        activeCount: 1,
        blockedCount: 0,
      },
      {
        name: 'beta',
        path: '/b',
        agents: ['u3'],
        agentCount: 1,
        idleCount: 1,
        activeCount: 0,
        blockedCount: 0,
      },
    ]

    const res = buildOfficeRoomsResponse(snapshot)
    expect(res.data.totalRooms).toBe(2)
    expect(res.data.totalAssignedAgents).toBe(3)
    const alpha = res.data.rooms.find((r) => r.name === 'alpha')
    const beta = res.data.rooms.find((r) => r.name === 'beta')
    expect(alpha?.occupancy.count).toBe(2)
    expect(alpha?.occupancy.capacity).toBeGreaterThanOrEqual(2)
    expect(beta?.occupancy.count).toBe(1)
    expect(res.summary.length).toBeGreaterThan(0)
    expect(res.suggestions.length).toBeGreaterThan(0)
  })

  it('office:leaderboard sorts by XP for each period (defensive reorder)', () => {
    const snapshot = baseSnapshot()
    const rows = [
      {
        rank: 9,
        agentId: 'low',
        agentName: 'Low',
        totalXP: 10,
        seasonXP: 10,
        weeklyXP: 1,
        level: 1,
        rankTitle: '',
        tasksCompleted: 0,
        currentStreak: 0,
      },
      {
        rank: 1,
        agentId: 'high',
        agentName: 'High',
        totalXP: 500,
        seasonXP: 400,
        weeklyXP: 50,
        level: 2,
        rankTitle: '',
        tasksCompleted: 5,
        currentStreak: 2,
      },
    ]
    snapshot.leaderboard.alltime = [...rows].reverse()
    snapshot.leaderboard.season = [...rows].reverse()
    snapshot.leaderboard.weekly = [...rows].reverse()

    const alltime = buildOfficeLeaderboardResponse(snapshot, 'alltime')
    expect(alltime.data.rankings[0]?.xp).toBe(500)
    expect(alltime.data.rankings[0]?.agentId).toBe('high')

    const season = buildOfficeLeaderboardResponse(snapshot, 'season')
    expect(season.data.rankings[0]?.xp).toBe(400)

    const weekly = buildOfficeLeaderboardResponse(snapshot, 'weekly')
    expect(weekly.data.rankings[0]?.xp).toBe(50)

    expect(alltime.summary.length).toBeGreaterThan(0)
    expect(alltime.suggestions.length).toBeGreaterThan(0)
  })

  it('surfaces rivalry in leaderboard suggestions when rivalries exist', () => {
    const snapshot = baseSnapshot()
    snapshot.leaderboard.alltime = [
      {
        rank: 1,
        agentId: 'x',
        agentName: 'X',
        totalXP: 100,
        seasonXP: 100,
        weeklyXP: 0,
        level: 1,
        rankTitle: '',
        tasksCompleted: 1,
        currentStreak: 1,
      },
    ]
    snapshot.leaderboard.rivalries = [
      { agent1: 'X', agent2: 'Y', xpDiff: 2, percentDiff: 3 },
    ]

    const res = buildOfficeLeaderboardResponse(snapshot, 'alltime')
    expect(res.data.rivalries).toHaveLength(1)
    const joined = res.suggestions.join(' ')
    expect(joined).toMatch(/Rivalry|X|Y/)
  })

  it('parseLeaderboardPeriod defaults invalid values to season', () => {
    expect(parseLeaderboardPeriod(undefined)).toBe('season')
    expect(parseLeaderboardPeriod('nope')).toBe('season')
    expect(parseLeaderboardPeriod('weekly')).toBe('weekly')
  })

  it('parseSnapshot returns stable defaults for malformed input', () => {
    expect(parseSnapshot(null)).toBeNull()
    expect(parseSnapshot({})).not.toBeNull()
    const p = parseSnapshot({})
    expect(p?.agents).toEqual([])
    expect(p?.leaderboard.alltime).toEqual([])
  })
})
