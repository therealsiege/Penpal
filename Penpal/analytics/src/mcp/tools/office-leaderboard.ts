/**
 * office_leaderboard MCP tool — Returns ranked agent list by XP with season info.
 */

import { readGameState } from "./office-types.js";

export const officeLeaderboardSchema = {
  name: "office_leaderboard",
  description:
    "Get the agent leaderboard ranked by XP. Supports period filters: 'season' (default), 'weekly', or 'alltime'. Includes weekly MVP, rivalry detection, and season info.",
  inputSchema: {
    type: "object" as const,
    properties: {
      period: {
        type: "string",
        enum: ["season", "weekly", "alltime"],
        description: "Time period for ranking. Defaults to 'season'.",
      },
    },
    required: [],
  },
};

export async function officeLeaderboard(args: { period?: string }): Promise<string> {
  const { snapshot, error, stale } = readGameState();

  if (!snapshot) {
    return JSON.stringify({ error, suggestions: ["Start Penny (cd Penny && npm run dev) to begin writing game state snapshots."] });
  }

  const period = (args.period as "season" | "weekly" | "alltime") || "season";
  const lb = snapshot.leaderboard;

  let entries = lb.alltime;
  let sortLabel = "alltime XP";
  if (period === "season") {
    entries = lb.season;
    sortLabel = "season XP";
  } else if (period === "weekly") {
    entries = lb.weekly;
    sortLabel = "weekly XP";
  }

  const suggestions: string[] = [];

  if (lb.weeklyMVP) {
    suggestions.push(`Weekly MVP: ${lb.weeklyMVP.agentName} with ${lb.weeklyMVP.weekXP} XP this week.`);
  }

  for (const rivalry of lb.rivalries) {
    suggestions.push(`Rivalry: ${rivalry.agent1} vs ${rivalry.agent2} — only ${rivalry.percentDiff}% apart!`);
  }

  const topStreak = entries.reduce((best, e) => e.currentStreak > best.currentStreak ? e : best, entries[0]);
  if (topStreak && topStreak.currentStreak >= 3) {
    suggestions.push(`${topStreak.agentName} is on a ${topStreak.currentStreak}-task streak!`);
  }

  if (stale) suggestions.push("Warning: snapshot is stale (>60s old). Penny may not be running.");

  return JSON.stringify(
    {
      summary: {
        period,
        sortedBy: sortLabel,
        totalAgents: entries.length,
        snapshotAge: `${Math.round((Date.now() - snapshot.timestamp) / 1000)}s ago`,
      },
      leaderboard: entries.map(e => ({
        rank: e.rank,
        agent: e.agentName,
        agentId: e.agentId,
        totalXP: e.totalXP,
        seasonXP: e.seasonXP,
        weeklyXP: e.weeklyXP,
        level: e.level,
        rankTitle: e.rankTitle,
        tasksCompleted: e.tasksCompleted,
        currentStreak: e.currentStreak,
      })),
      weeklyMVP: lb.weeklyMVP,
      rivalries: lb.rivalries,
      orchestratorStats: snapshot.orchestrator,
      suggestions,
    },
    null,
    2,
  );
}
