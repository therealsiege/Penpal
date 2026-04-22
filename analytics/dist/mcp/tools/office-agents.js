/**
 * office_agents MCP tool — Returns all agent states from the game.
 */
import { readGameState } from "./office-types.js";
export const officeAgentsSchema = {
    name: "office_agents",
    description: "Get the current state of all agents in the Penny office: name, status (idle/active/sleeping/blocked), room assignment, current task, XP, rank, and credits. Includes a status breakdown and actionable suggestions.",
    inputSchema: {
        type: "object",
        properties: {},
        required: [],
    },
};
export async function officeAgents() {
    const { snapshot, error, stale } = readGameState();
    if (!snapshot) {
        return JSON.stringify({ error, suggestions: ["Start Penny (cd Penny && npm run dev) to begin writing game state snapshots."] });
    }
    const agents = snapshot.agents;
    const idleCount = agents.filter(a => a.status === "idle" || a.status === "sleeping").length;
    const activeCount = agents.filter(a => a.status === "active").length;
    const blockedCount = agents.filter(a => a.status === "blocked").length;
    const suggestions = [];
    if (idleCount > 0)
        suggestions.push(`${idleCount} agent${idleCount > 1 ? "s" : ""} idle — consider dispatching tasks.`);
    if (blockedCount > 0)
        suggestions.push(`${blockedCount} agent${blockedCount > 1 ? "s" : ""} blocked — may need tool approval or intervention.`);
    const topStreak = agents.reduce((best, a) => a.currentStreak > best.currentStreak ? a : best, agents[0]);
    if (topStreak && topStreak.currentStreak >= 3) {
        suggestions.push(`${topStreak.name} is on a ${topStreak.currentStreak}-task streak!`);
    }
    if (stale)
        suggestions.push("Warning: snapshot is stale (>60s old). Penny may not be running.");
    return JSON.stringify({
        summary: {
            totalAgents: agents.length,
            idle: idleCount,
            active: activeCount,
            blocked: blockedCount,
            snapshotAge: `${Math.round((Date.now() - snapshot.timestamp) / 1000)}s ago`,
        },
        agents: agents.map(a => ({
            id: a.id,
            name: a.name,
            title: a.title,
            status: a.status,
            room: a.room,
            currentTask: a.currentTask,
            xp: a.xp,
            level: a.level,
            rank: a.rankTitle,
            credits: a.credits,
            tasksCompleted: a.tasksCompleted,
            currentStreak: a.currentStreak,
            uptime: a.uptime,
        })),
        suggestions,
    }, null, 2);
}
