import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
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

const server = new Server(
  {
    name: "penny-knowledge",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

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
    let result: string;

    switch (name) {
      case "search_knowledge":
        result = await searchKnowledge(args as Parameters<typeof searchKnowledge>[0]);
        break;
      case "query_graph":
        result = await queryGraph(args as Parameters<typeof queryGraph>[0]);
        break;
      case "find_entity":
        result = await findEntity(args as Parameters<typeof findEntity>[0]);
        break;
      case "ask_knowledge":
        result = await askKnowledge(args as Parameters<typeof askKnowledge>[0]);
        break;
      case "find_similar":
        result = await findSimilar(args as Parameters<typeof findSimilar>[0]);
        break;
      case "pipeline_status":
        result = await pipelineStatus(args as Parameters<typeof pipelineStatus>[0]);
        break;
      case "discover_connections":
        result = await discoverConnections(args as Parameters<typeof discoverConnections>[0]);
        break;
      case "list_communities":
        result = await listCommunities(args as Parameters<typeof listCommunities>[0]);
        break;
      case "revenue_opportunity":
        result = await revenueOpportunity(args as Parameters<typeof revenueOpportunity>[0]);
        break;
      case "update_lead":
        result = await updateLead(args as Parameters<typeof updateLead>[0]);
        break;
      case "get_pipeline":
        result = await getPipeline(args as Parameters<typeof getPipeline>[0]);
        break;
      case "vault_read":
        result = await vaultRead(args as Parameters<typeof vaultRead>[0]);
        break;
      case "vault_search":
        result = await vaultSearch(args as Parameters<typeof vaultSearch>[0]);
        break;
      case "vault_write":
        result = await vaultWrite(args as Parameters<typeof vaultWrite>[0]);
        break;
      case "search_leads":
        result = await searchLeads(args as Parameters<typeof searchLeads>[0]);
        break;
      case "lead_detail":
        result = await leadDetail(args as Parameters<typeof leadDetail>[0]);
        break;
      case "graph_stats":
        result = await graphStats();
        break;
      case "pods_list":
        result = await podsList(args as Parameters<typeof podsList>[0]);
        break;
      case "pods_status":
        result = await podsStatus(args as Parameters<typeof podsStatus>[0]);
        break;
      case "pods_create":
        result = await podsCreate(args as Parameters<typeof podsCreate>[0]);
        break;
      case "office_agents":
        result = await officeAgents();
        break;
      case "office_rooms":
        result = await officeRooms();
        break;
      case "office_leaderboard":
        result = await officeLeaderboard(args as Parameters<typeof officeLeaderboard>[0]);
        break;
      default:
        return {
          content: [{ type: "text" as const, text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }

    return {
      content: [{ type: "text" as const, text: result }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text" as const, text: `Error: ${message}` }],
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
