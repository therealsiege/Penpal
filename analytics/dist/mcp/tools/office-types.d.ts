/**
 * office-types.ts — Shared types and reader for the game-state.json snapshot
 * written by Penny's main process.
 */
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
        weeklyMVP: {
            agentId: string;
            agentName: string;
            weekXP: number;
        } | null;
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
export declare function readGameState(): {
    snapshot: GameStateSnapshot | null;
    error: string | null;
    stale: boolean;
};
