import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
import { closeConnections } from "../shared/connections.js";
import { searchKnowledgeSchema, searchKnowledge } from "./tools/search-knowledge.js";
import { queryGraphSchema, queryGraph } from "./tools/query-graph.js";
import { findEntitySchema, findEntity } from "./tools/find-entity.js";
import { askKnowledgeSchema, askKnowledge } from "./tools/ask-knowledge.js";
import { findSimilarSchema, findSimilar } from "./tools/find-similar.js";
import { pipelineStatusSchema, pipelineStatus } from "./tools/pipeline-status.js";
import { discoverConnectionsSchema, discoverConnections } from "./tools/discover-connections.js";
import { listCommunitiesSchema, listCommunities } from "./tools/list-communities.js";
import { revenueOpportunitySchema, revenueOpportunity } from "./tools/revenue-opportunity.js";
import { updateLeadSchema, updateLead } from "./tools/update-lead.js";
import { getPipelineSchema, getPipeline } from "./tools/get-pipeline.js";
import { vaultReadSchema, vaultRead } from "./tools/vault-read.js";
import { vaultSearchSchema, vaultSearch } from "./tools/vault-search.js";
import { vaultWriteSchema, vaultWrite } from "./tools/vault-write.js";
import { searchLeadsSchema, searchLeads } from "./tools/search-leads.js";
import { leadDetailSchema, leadDetail } from "./tools/lead-detail.js";
import { graphStatsSchema, graphStats } from "./tools/graph-stats.js";
import { podsListSchema, podsList } from "./tools/pods-list.js";
import { podsStatusSchema, podsStatus } from "./tools/pods-status.js";
import { podsCreateSchema, podsCreate } from "./tools/pods-create.js";
import { officeAgentsSchema, officeAgents } from "./tools/office-agents.js";
import { officeRoomsSchema, officeRooms } from "./tools/office-rooms.js";
import { officeLeaderboardSchema, officeLeaderboard } from "./tools/office-leaderboard.js";
const server = new Server({
    name: "penny-knowledge",
    version: "1.0.0",
}, {
    capabilities: {
        tools: {},
    },
});
// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            searchKnowledgeSchema,
            queryGraphSchema,
            findEntitySchema,
            askKnowledgeSchema,
            findSimilarSchema,
            pipelineStatusSchema,
            discoverConnectionsSchema,
            listCommunitiesSchema,
            revenueOpportunitySchema,
            updateLeadSchema,
            getPipelineSchema,
            vaultReadSchema,
            vaultSearchSchema,
            vaultWriteSchema,
            searchLeadsSchema,
            leadDetailSchema,
            graphStatsSchema,
            podsListSchema,
            podsStatusSchema,
            podsCreateSchema,
            officeAgentsSchema,
            officeRoomsSchema,
            officeLeaderboardSchema,
        ],
    };
});
// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
        let result;
        switch (name) {
            case "search_knowledge":
                result = await searchKnowledge(args);
                break;
            case "query_graph":
                result = await queryGraph(args);
                break;
            case "find_entity":
                result = await findEntity(args);
                break;
            case "ask_knowledge":
                result = await askKnowledge(args);
                break;
            case "find_similar":
                result = await findSimilar(args);
                break;
            case "pipeline_status":
                result = await pipelineStatus(args);
                break;
            case "discover_connections":
                result = await discoverConnections(args);
                break;
            case "list_communities":
                result = await listCommunities(args);
                break;
            case "revenue_opportunity":
                result = await revenueOpportunity(args);
                break;
            case "update_lead":
                result = await updateLead(args);
                break;
            case "get_pipeline":
                result = await getPipeline(args);
                break;
            case "vault_read":
                result = await vaultRead(args);
                break;
            case "vault_search":
                result = await vaultSearch(args);
                break;
            case "vault_write":
                result = await vaultWrite(args);
                break;
            case "search_leads":
                result = await searchLeads(args);
                break;
            case "lead_detail":
                result = await leadDetail(args);
                break;
            case "graph_stats":
                result = await graphStats();
                break;
            case "pods_list":
                result = await podsList(args);
                break;
            case "pods_status":
                result = await podsStatus(args);
                break;
            case "pods_create":
                result = await podsCreate(args);
                break;
            case "office_agents":
                result = await officeAgents();
                break;
            case "office_rooms":
                result = await officeRooms();
                break;
            case "office_leaderboard":
                result = await officeLeaderboard(args);
                break;
            default:
                return {
                    content: [{ type: "text", text: `Unknown tool: ${name}` }],
                    isError: true,
                };
        }
        return {
            content: [{ type: "text", text: result }],
        };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
            content: [{ type: "text", text: `Error: ${message}` }],
            isError: true,
        };
    }
});
// Start server
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((err) => {
    console.error("MCP server failed:", err);
    process.exit(1);
});
// Cleanup on exit
process.on("SIGINT", async () => {
    await closeConnections();
    process.exit(0);
});
process.on("SIGTERM", async () => {
    await closeConnections();
    process.exit(0);
});
