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

const server = new Server(
  {
    name: "sidekick-knowledge",
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
