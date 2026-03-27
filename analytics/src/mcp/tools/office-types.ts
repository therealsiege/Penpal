/**
 * office-types.ts — Shared types and reader for the game-state.json snapshot
 * written by Penny's main process.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SNAPSHOT_PATH = path.resolve(__dirname, "..", "..", "..", "data", "game-state.json");

// ── Snapshot shape (mirrors Penny/src/main/game-state-snapshot.ts) ──────────

export interface AgentSnapshot {
  id: string;
  name: string;
  title: string;
  status: "idle" | "active" | "sleeping" | "blocked";
  room: string;
  roomPath: string;
  currentTask: string | null;
  xp: number;
  level: number;
  rankTitle: string;
  credits: number;
  tasksCompleted: number;
  tasksFailed: number;
  currentStreak: number;
  sessionMode: string | null;
  uptime: string | null;
}

export interface RoomSnapshot {
  name: string;
  path: string;
  agents: string[];
  agentCount: number;
  idleCount: number;
  activeCount: number;
  blockedCount: number;
}

export interface LeaderboardEntrySnapshot {
  rank: number;
  agentId: string;
  agentName: string;
  totalXP: number;
  seasonXP: number;
  weeklyXP: number;
  level: number;
  rankTitle: string;
  tasksCompleted: number;
  currentStreak: number;
}

export interface RivalrySnapshot {
  agent1: string;
  agent2: string;
  xpDiff: number;
  percentDiff: number;
}

export interface GameStateSnapshot {
  timestamp: number;
  weekStart: number;
  agents: AgentSnapshot[];
  rooms: RoomSnapshot[];
  leaderboard: {
    alltime: LeaderboardEntrySnapshot[];
    season: LeaderboardEntrySnapshot[];
    weekly: LeaderboardEntrySnapshot[];
    weeklyMVP: { agentId: string; agentName: string; weekXP: number } | null;
    rivalries: RivalrySnapshot[];
  };
  orchestrator: {
    queueDepth: number;
    activeTasks: number;
    completedToday: number;
    failedToday: number;
    totalProcessed: number;
  };
}

// ── Reader ──────────────────────────────────────────────────────────────────

const STALE_THRESHOLD_MS = 60_000; // 1 minute

export function readGameState(): { snapshot: GameStateSnapshot | null; error: string | null; stale: boolean } {
  try {
    if (!fs.existsSync(SNAPSHOT_PATH)) {
      return { snapshot: null, error: "Game state snapshot not found. Is Penny running? The Electron app writes this file every 5 seconds.", stale: false };
    }
    const raw = fs.readFileSync(SNAPSHOT_PATH, "utf-8");
    const snapshot = JSON.parse(raw) as GameStateSnapshot;
    const age = Date.now() - snapshot.timestamp;
    const stale = age > STALE_THRESHOLD_MS;
    return { snapshot, error: null, stale };
  } catch (err) {
    return { snapshot: null, error: `Failed to read game state: ${err instanceof Error ? err.message : String(err)}`, stale: false };
  }
}
