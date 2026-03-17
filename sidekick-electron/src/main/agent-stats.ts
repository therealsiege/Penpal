import fs from 'fs'
import path from 'path'
import { getAgentConfig } from './agents'

// ── Types ───────────────────────────────────────────────────────────────────

export interface AgentStats {
  agentId: string
  tasksCompleted: number
  totalUptime: number
  messagesReceived: number
  approvalsGranted: number
  streak: number
  bestStreak: number
  xp: number
  level: number
  lastActive: number
  achievements: string[]
}

export interface LeaderboardEntry {
  agentId: string
  agentName: string
  xp: number
  level: number
  tasksCompleted: number
  streak: number
  achievements: string[]
}

export interface AchievementDef {
  id: string
  name: string
  description: string
  icon: string
}

// ── Achievement Definitions ─────────────────────────────────────────────────

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first-task', name: 'First Task', description: 'Complete your first task', icon: '\u2B50' },
  { id: 'ten-tasks', name: 'Decathlon', description: 'Complete 10 tasks', icon: '\uD83C\uDFC5' },
  { id: 'fifty-tasks', name: 'Half Century', description: 'Complete 50 tasks', icon: '\uD83C\uDFC6' },
  { id: 'streak-5', name: 'On Fire', description: 'Achieve a streak of 5 tasks without error', icon: '\uD83D\uDD25' },
  { id: 'streak-10', name: 'Unstoppable', description: 'Achieve a streak of 10 tasks without error', icon: '\u26A1' },
  { id: 'level-5', name: 'Veteran', description: 'Reach level 5', icon: '\uD83C\uDF96\uFE0F' },
  { id: 'level-10', name: 'Elite', description: 'Reach level 10', icon: '\uD83D\uDC8E' },
  { id: 'marathon', name: 'Marathon', description: 'Accumulate 24 hours of active time', icon: '\uD83C\uDFC3' },
]

// ── Persistence ─────────────────────────────────────────────────────────────

const STATS_FILE = path.resolve(__dirname, '..', '..', 'data', 'agent-stats.json')

function loadStatsMap(): Record<string, AgentStats> {
  try {
    if (fs.existsSync(STATS_FILE)) {
      return JSON.parse(fs.readFileSync(STATS_FILE, 'utf-8'))
    }
  } catch { /* */ }
  return {}
}

function saveStatsMap(map: Record<string, AgentStats>): void {
  const dir = path.dirname(STATS_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(STATS_FILE, JSON.stringify(map, null, 2))
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function defaultStats(agentId: string): AgentStats {
  return {
    agentId,
    tasksCompleted: 0,
    totalUptime: 0,
    messagesReceived: 0,
    approvalsGranted: 0,
    streak: 0,
    bestStreak: 0,
    xp: 0,
    level: 0,
    lastActive: Date.now(),
    achievements: [],
  }
}

function computeXp(stats: AgentStats): number {
  return stats.tasksCompleted * 100 + stats.approvalsGranted * 10 + stats.messagesReceived * 5
}

function computeLevel(xp: number): number {
  return Math.floor(Math.sqrt(xp / 100))
}

function checkAchievements(stats: AgentStats): string[] {
  const newlyEarned: string[] = []

  const checks: [string, boolean][] = [
    ['first-task', stats.tasksCompleted >= 1],
    ['ten-tasks', stats.tasksCompleted >= 10],
    ['fifty-tasks', stats.tasksCompleted >= 50],
    ['streak-5', stats.bestStreak >= 5],
    ['streak-10', stats.bestStreak >= 10],
    ['level-5', stats.level >= 5],
    ['level-10', stats.level >= 10],
    ['marathon', stats.totalUptime >= 86400],
  ]

  for (const [id, condition] of checks) {
    if (condition && !stats.achievements.includes(id)) {
      stats.achievements.push(id)
      newlyEarned.push(id)
    }
  }

  return newlyEarned
}

function touchAndRecalc(stats: AgentStats): void {
  stats.lastActive = Date.now()
  stats.xp = computeXp(stats)
  stats.level = computeLevel(stats.xp)
}

// ── Public API ──────────────────────────────────────────────────────────────

export function getAgentStats(agentId: string): AgentStats {
  const map = loadStatsMap()
  if (!map[agentId]) {
    map[agentId] = defaultStats(agentId)
    saveStatsMap(map)
  }
  return map[agentId]
}

export function getAllAgentStats(): Record<string, AgentStats> {
  return loadStatsMap()
}

export function recordTaskComplete(agentId: string): string[] {
  const map = loadStatsMap()
  if (!map[agentId]) map[agentId] = defaultStats(agentId)
  const stats = map[agentId]

  stats.tasksCompleted += 1
  stats.streak += 1
  if (stats.streak > stats.bestStreak) {
    stats.bestStreak = stats.streak
  }

  touchAndRecalc(stats)
  const newAchievements = checkAchievements(stats)
  saveStatsMap(map)
  return newAchievements
}

export function recordMessage(agentId: string): void {
  const map = loadStatsMap()
  if (!map[agentId]) map[agentId] = defaultStats(agentId)
  const stats = map[agentId]

  stats.messagesReceived += 1

  touchAndRecalc(stats)
  checkAchievements(stats)
  saveStatsMap(map)
}

export function recordApproval(agentId: string): void {
  const map = loadStatsMap()
  if (!map[agentId]) map[agentId] = defaultStats(agentId)
  const stats = map[agentId]

  stats.approvalsGranted += 1

  touchAndRecalc(stats)
  checkAchievements(stats)
  saveStatsMap(map)
}

export function updateUptime(agentId: string, seconds: number): void {
  const map = loadStatsMap()
  if (!map[agentId]) map[agentId] = defaultStats(agentId)
  const stats = map[agentId]

  stats.totalUptime += seconds

  touchAndRecalc(stats)
  checkAchievements(stats)
  saveStatsMap(map)
}

export function resetStreak(agentId: string): void {
  const map = loadStatsMap()
  if (!map[agentId]) map[agentId] = defaultStats(agentId)
  const stats = map[agentId]

  stats.streak = 0

  touchAndRecalc(stats)
  saveStatsMap(map)
}

export function getLeaderboard(): LeaderboardEntry[] {
  const map = loadStatsMap()

  return Object.values(map)
    .sort((a, b) => b.xp - a.xp)
    .map((stats) => {
      const config = getAgentConfig(stats.agentId)
      return {
        agentId: stats.agentId,
        agentName: config?.name ?? stats.agentId,
        xp: stats.xp,
        level: stats.level,
        tasksCompleted: stats.tasksCompleted,
        streak: stats.streak,
        achievements: stats.achievements,
      }
    })
}
