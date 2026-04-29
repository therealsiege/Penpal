import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Fixture: write a mock game-state.json ──────────────────────────────────

const SNAPSHOT_DIR = path.resolve(__dirname, "..", "..", "..", "..", "data");
const SNAPSHOT_PATH = path.join(SNAPSHOT_DIR, "game-state.json");
let originalSnapshot: string | null = null;

function makeMockSnapshot(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    timestamp: Date.now(),
    weekStart: Date.now() - 86400000,
    agents: [
      {
        id: "fullstack-dev",
        name: "Marcus Chen",
        title: "Full-Stack Developer",
        status: "active",
        room: "sidekick",
        roomPath: "/Users/test/sidekick",
        currentTask: "Build feature X",
        xp: 5000,
        level: 4,
        rankTitle: "Agent",
        credits: 200,
        tasksCompleted: 30,
        tasksFailed: 2,
        currentStreak: 5,
        sessionMode: "working",
        uptime: "2h 15m",
      },
      {
        id: "backend-arch",
        name: "Ravi Patel",
        title: "Backend Architect",
        status: "idle",
        room: "sidekick",
        roomPath: "/Users/test/sidekick",
        currentTask: null,
        xp: 4800,
        level: 4,
        rankTitle: "Agent",
        credits: 150,
        tasksCompleted: 28,
        tasksFailed: 1,
        currentStreak: 0,
        sessionMode: null,
        uptime: null,
      },
      {
        id: "electron-dev",
        name: "Kai Tanaka",
        title: "Electron Developer",
        status: "blocked",
        room: "Penny",
        roomPath: "/Users/test/Penny",
        currentTask: "Fix IPC handler",
        xp: 1200,
        level: 2,
        rankTitle: "Junior",
        credits: 75,
        tasksCompleted: 10,
        tasksFailed: 3,
        currentStreak: 2,
        sessionMode: "accept-edits",
        uptime: "45m",
      },
      {
        id: "nextjs-dev",
        name: "Lena Park",
        title: "Next.js Developer",
        status: "sleeping",
        room: "website",
        roomPath: "/Users/test/website",
        currentTask: null,
        xp: 0,
        level: 1,
        rankTitle: "Intern",
        credits: 0,
        tasksCompleted: 0,
        tasksFailed: 0,
        currentStreak: 0,
        sessionMode: null,
        uptime: null,
      },
    ],
    rooms: [
      {
        name: "sidekick",
        path: "/Users/test/sidekick",
        agents: ["Marcus Chen", "Ravi Patel"],
        agentCount: 2,
        idleCount: 1,
        activeCount: 1,
        blockedCount: 0,
      },
      {
        name: "Penny",
        path: "/Users/test/Penny",
        agents: ["Kai Tanaka"],
        agentCount: 1,
        idleCount: 0,
        activeCount: 0,
        blockedCount: 1,
      },
      {
        name: "website",
        path: "/Users/test/website",
        agents: ["Lena Park"],
        agentCount: 1,
        idleCount: 1,
        activeCount: 0,
        blockedCount: 0,
      },
    ],
    leaderboard: {
      alltime: [
        { rank: 1, agentId: "fullstack-dev", agentName: "Marcus Chen", totalXP: 5000, seasonXP: 5000, weeklyXP: 300, level: 4, rankTitle: "Agent", tasksCompleted: 30, currentStreak: 5 },
        { rank: 2, agentId: "backend-arch", agentName: "Ravi Patel", totalXP: 4800, seasonXP: 4800, weeklyXP: 100, level: 4, rankTitle: "Agent", tasksCompleted: 28, currentStreak: 0 },
        { rank: 3, agentId: "electron-dev", agentName: "Kai Tanaka", totalXP: 1200, seasonXP: 1200, weeklyXP: 50, level: 2, rankTitle: "Junior", tasksCompleted: 10, currentStreak: 2 },
        { rank: 4, agentId: "nextjs-dev", agentName: "Lena Park", totalXP: 0, seasonXP: 0, weeklyXP: 0, level: 1, rankTitle: "Intern", tasksCompleted: 0, currentStreak: 0 },
      ],
      season: [
        { rank: 1, agentId: "fullstack-dev", agentName: "Marcus Chen", totalXP: 5000, seasonXP: 5000, weeklyXP: 300, level: 4, rankTitle: "Agent", tasksCompleted: 30, currentStreak: 5 },
        { rank: 2, agentId: "backend-arch", agentName: "Ravi Patel", totalXP: 4800, seasonXP: 4800, weeklyXP: 100, level: 4, rankTitle: "Agent", tasksCompleted: 28, currentStreak: 0 },
        { rank: 3, agentId: "electron-dev", agentName: "Kai Tanaka", totalXP: 1200, seasonXP: 1200, weeklyXP: 50, level: 2, rankTitle: "Junior", tasksCompleted: 10, currentStreak: 2 },
        { rank: 4, agentId: "nextjs-dev", agentName: "Lena Park", totalXP: 0, seasonXP: 0, weeklyXP: 0, level: 1, rankTitle: "Intern", tasksCompleted: 0, currentStreak: 0 },
      ],
      weekly: [
        { rank: 1, agentId: "fullstack-dev", agentName: "Marcus Chen", totalXP: 5000, seasonXP: 5000, weeklyXP: 300, level: 4, rankTitle: "Agent", tasksCompleted: 30, currentStreak: 5 },
        { rank: 2, agentId: "backend-arch", agentName: "Ravi Patel", totalXP: 4800, seasonXP: 4800, weeklyXP: 100, level: 4, rankTitle: "Agent", tasksCompleted: 28, currentStreak: 0 },
        { rank: 3, agentId: "electron-dev", agentName: "Kai Tanaka", totalXP: 1200, seasonXP: 1200, weeklyXP: 50, level: 2, rankTitle: "Junior", tasksCompleted: 10, currentStreak: 2 },
        { rank: 4, agentId: "nextjs-dev", agentName: "Lena Park", totalXP: 0, seasonXP: 0, weeklyXP: 0, level: 1, rankTitle: "Intern", tasksCompleted: 0, currentStreak: 0 },
      ],
      weeklyMVP: { agentId: "fullstack-dev", agentName: "Marcus Chen", weekXP: 300 },
      rivalries: [
        { agent1: "Marcus Chen", agent2: "Ravi Patel", xpDiff: 200, percentDiff: 4 },
      ],
    },
    orchestrator: {
      queueDepth: 2,
      activeTasks: 1,
      completedToday: 5,
      failedToday: 0,
      totalProcessed: 40,
    },
    ...overrides,
  };
}

before(() => {
  // Preserve existing snapshot if present
  if (fs.existsSync(SNAPSHOT_PATH)) {
    originalSnapshot = fs.readFileSync(SNAPSHOT_PATH, "utf-8");
  }
  if (!fs.existsSync(SNAPSHOT_DIR)) fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
  fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify(makeMockSnapshot()));
});

after(() => {
  // Restore original snapshot or clean up
  if (originalSnapshot !== null) {
    fs.writeFileSync(SNAPSHOT_PATH, originalSnapshot);
  } else if (fs.existsSync(SNAPSHOT_PATH)) {
    fs.unlinkSync(SNAPSHOT_PATH);
  }
});

// Dynamic imports after fixture is written
const { officeAgents } = await import("../office-agents.js");
const { officeRooms } = await import("../office-rooms.js");
const { officeLeaderboard } = await import("../office-leaderboard.js");

// ── Tests ──────────────────────────────────────────────────────────────────

describe("office_agents", () => {
  it("returns all agents with status breakdown", async () => {
    const result = JSON.parse(await officeAgents());
    assert.ok(result.summary);
    assert.equal(result.summary.totalAgents, 4);
    assert.equal(result.summary.active, 1);
    assert.equal(result.summary.blocked, 1);
    // idle includes sleeping
    assert.equal(result.summary.idle, 2);
    assert.ok(Array.isArray(result.agents));
    assert.equal(result.agents.length, 4);
  });

  it("includes agent XP and rank data", async () => {
    const result = JSON.parse(await officeAgents());
    const marcus = result.agents.find((a: { id: string }) => a.id === "fullstack-dev");
    assert.ok(marcus);
    assert.equal(marcus.xp, 5000);
    assert.equal(marcus.level, 4);
    assert.equal(marcus.rank, "Agent");
  });

  it("includes suggestions when agents are idle or blocked", async () => {
    const result = JSON.parse(await officeAgents());
    assert.ok(Array.isArray(result.suggestions));
    assert.ok(result.suggestions.length > 0);
    assert.ok(result.suggestions.some((s: string) => s.includes("idle")));
    assert.ok(result.suggestions.some((s: string) => s.includes("blocked")));
  });

  it("includes streak suggestion for high-streak agents", async () => {
    const result = JSON.parse(await officeAgents());
    assert.ok(result.suggestions.some((s: string) => s.includes("streak")));
  });
});

describe("office_rooms", () => {
  it("returns all rooms with agent counts", async () => {
    const result = JSON.parse(await officeRooms());
    assert.ok(result.summary);
    assert.equal(result.summary.totalRooms, 3);
    assert.ok(Array.isArray(result.rooms));

    const sidekickRoom = result.rooms.find((r: { name: string }) => r.name === "sidekick");
    assert.ok(sidekickRoom);
    assert.equal(sidekickRoom.agentCount, 2);
    assert.deepEqual(sidekickRoom.agents, ["Marcus Chen", "Ravi Patel"]);
  });

  it("includes per-room idle/active/blocked breakdown", async () => {
    const result = JSON.parse(await officeRooms());
    const pennyRoom = result.rooms.find((r: { name: string }) => r.name === "Penny");
    assert.ok(pennyRoom);
    assert.equal(pennyRoom.blocked, 1);
    assert.equal(pennyRoom.active, 0);
    assert.equal(pennyRoom.idle, 0);
  });

  it("includes suggestions about room activity", async () => {
    const result = JSON.parse(await officeRooms());
    assert.ok(Array.isArray(result.suggestions));
    assert.ok(result.suggestions.length > 0);
  });
});

describe("office_leaderboard", () => {
  it("returns leaderboard sorted by XP descending (default: season)", async () => {
    const result = JSON.parse(await officeLeaderboard({}));
    assert.equal(result.summary.period, "season");
    assert.ok(Array.isArray(result.leaderboard));
    assert.equal(result.leaderboard.length, 4);

    // Verify sorted descending by seasonXP
    for (let i = 0; i < result.leaderboard.length - 1; i++) {
      assert.ok(result.leaderboard[i].seasonXP >= result.leaderboard[i + 1].seasonXP);
    }
  });

  it("supports alltime period", async () => {
    const result = JSON.parse(await officeLeaderboard({ period: "alltime" }));
    assert.equal(result.summary.period, "alltime");
    assert.equal(result.leaderboard[0].agent, "Marcus Chen");
  });

  it("supports weekly period", async () => {
    const result = JSON.parse(await officeLeaderboard({ period: "weekly" }));
    assert.equal(result.summary.period, "weekly");
    assert.equal(result.leaderboard[0].weeklyXP, 300);
  });

  it("includes weekly MVP", async () => {
    const result = JSON.parse(await officeLeaderboard({}));
    assert.ok(result.weeklyMVP);
    assert.equal(result.weeklyMVP.agentName, "Marcus Chen");
    assert.equal(result.weeklyMVP.weekXP, 300);
  });

  it("detects rivalries (agents within 5% XP)", async () => {
    const result = JSON.parse(await officeLeaderboard({}));
    assert.ok(Array.isArray(result.rivalries));
    assert.equal(result.rivalries.length, 1);
    assert.equal(result.rivalries[0].agent1, "Marcus Chen");
    assert.equal(result.rivalries[0].agent2, "Ravi Patel");
    assert.ok(result.rivalries[0].percentDiff <= 5);
  });

  it("includes rivalry in suggestions", async () => {
    const result = JSON.parse(await officeLeaderboard({}));
    assert.ok(result.suggestions.some((s: string) => s.includes("Rivalry")));
  });
});

describe("graceful error handling", () => {
  it("returns error when snapshot is missing", async () => {
    // Temporarily rename the file
    const backupPath = SNAPSHOT_PATH + ".bak";
    fs.renameSync(SNAPSHOT_PATH, backupPath);

    try {
      // Re-import to get fresh reads
      const { readGameState } = await import("../office-types.js");
      const { snapshot, error } = readGameState();
      assert.equal(snapshot, null);
      assert.ok(error);
      assert.ok(error.includes("not found") || error.includes("Penny"));
    } finally {
      fs.renameSync(backupPath, SNAPSHOT_PATH);
    }
  });
});
