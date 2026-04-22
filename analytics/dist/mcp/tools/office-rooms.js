/**
 * office_rooms MCP tool — Returns room layout with agent assignments and occupancy.
 */
import { readGameState } from "./office-types.js";
export const officeRoomsSchema = {
    name: "office_rooms",
    description: "Get the office room layout: room names, agent assignments, occupancy counts, and idle/active/blocked breakdown per room. Includes suggestions about room utilization.",
    inputSchema: {
        type: "object",
        properties: {},
        required: [],
    },
};
export async function officeRooms() {
    const { snapshot, error, stale } = readGameState();
    if (!snapshot) {
        return JSON.stringify({ error, suggestions: ["Start Penny (cd Penny && npm run dev) to begin writing game state snapshots."] });
    }
    const rooms = snapshot.rooms;
    const suggestions = [];
    const busiest = rooms.reduce((best, r) => r.activeCount > best.activeCount ? r : best, rooms[0]);
    const emptiest = rooms.reduce((best, r) => r.agentCount < best.agentCount ? r : best, rooms[0]);
    if (busiest && busiest.activeCount > 0) {
        suggestions.push(`Busiest room: "${busiest.name}" with ${busiest.activeCount} active agent${busiest.activeCount > 1 ? "s" : ""}.`);
    }
    if (emptiest && rooms.length > 1) {
        suggestions.push(`Emptiest room: "${emptiest.name}" with ${emptiest.agentCount} agent${emptiest.agentCount !== 1 ? "s" : ""}.`);
    }
    for (const room of rooms) {
        if (room.agentCount > 0 && room.idleCount === room.agentCount) {
            suggestions.push(`Room "${room.name}" has all ${room.agentCount} agents idle.`);
        }
        if (room.blockedCount > 0) {
            suggestions.push(`Room "${room.name}" has ${room.blockedCount} blocked agent${room.blockedCount > 1 ? "s" : ""}.`);
        }
    }
    if (stale)
        suggestions.push("Warning: snapshot is stale (>60s old). Penny may not be running.");
    return JSON.stringify({
        summary: {
            totalRooms: rooms.length,
            totalAgents: rooms.reduce((sum, r) => sum + r.agentCount, 0),
            busiestRoom: busiest?.name ?? null,
            snapshotAge: `${Math.round((Date.now() - snapshot.timestamp) / 1000)}s ago`,
        },
        rooms: rooms.map(r => ({
            name: r.name,
            path: r.path,
            agents: r.agents,
            agentCount: r.agentCount,
            idle: r.idleCount,
            active: r.activeCount,
            blocked: r.blockedCount,
        })),
        suggestions,
    }, null, 2);
}
