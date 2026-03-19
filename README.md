# Penny

AI-powered knowledge graph and MCP server for an Obsidian vault. Parses markdown notes, builds a graph in Memgraph, generates vector embeddings in Qdrant, and exposes it all via a Model Context Protocol server.

## Structure

```
analytics/
  src/
    shared/          # Shared connections, config, and utilities
    etl/             # Vault parser → Memgraph + Qdrant ingestion pipeline
    mcp/             # MCP server exposing 8 tools for graph + vector queries
  docker-compose.yml # Memgraph, Memgraph Lab, Qdrant
```

## Setup

```bash
cd analytics
npm install
npm run infra:up   # start Memgraph + Qdrant via Docker
```

## Scripts

| Script | Description |
|--------|-------------|
| `npm run etl` | Run the ETL pipeline for all enabled ventures |
| `npm run etl:clean` | Drop all data and reimport from scratch |
| `npm run etl:openloop` | Run ETL for the OpenLoop venture only |
| `npm run etl:1putt` | Run ETL for the 1Putt venture only |
| `npm run etl:elion` | Run ETL for the Elion Health venture only |
| `npm run etl:research` | Run ETL for the Research venture only |
| `npm run mcp:dev` | Start the MCP server (dev, via tsx) |
| `npm run mcp:build` | Compile TypeScript to `dist/` |
| `npm run mcp:start` | Start the compiled MCP server |
| `npm run infra:up` | Start Memgraph + Qdrant containers |
| `npm run infra:down` | Stop containers |

## ETL Pipeline

Walks the Obsidian vault and builds a knowledge graph with:

- **Documents, Folders, Tags** from markdown files
- **People, Companies, Technologies, EHR Systems, Regulations, Skills** from curated dictionaries + LLM extraction (Claude Haiku)
- **Leads and Sales Pipeline** from markdown lead files and CRM CSV
- **Vector Embeddings** (OpenAI `text-embedding-3-small`) stored in Qdrant for semantic search
- **Graph Analytics** via Memgraph MAGE (PageRank, community detection, betweenness centrality)

CLI flags: `--clean`, `--skip-embeddings`, `--skip-llm`, `--skip-analytics`, `--venture <name>`

### Venture-Based Processing

The ETL pipeline processes directories on a per-venture basis. Ventures are configured in `src/shared/config.ts` with:

- **name** -- display name
- **enabled** -- whether the venture is included in a default `npm run etl`
- **directories** -- list of vault subdirectories that belong to the venture (processed into both Qdrant and Memgraph)
- **crmCsvPath** -- optional path to a CRM CSV for lead ingestion
- **referencesCsvPaths** -- optional CSV files for reference data

Configured ventures: `openloop`, `1putt`, `giving-prints`, `elion`, `research`. Enable/disable them in `config.ts` or run a single venture with `--venture openloop`.

## MCP Tools

The MCP server exposes 8 tools:

| Tool | Description |
|------|-------------|
| `search_knowledge` | Semantic search across document chunks |
| `query_graph` | Run Cypher queries against Memgraph |
| `find_entity` | Look up an entity and its relationships |
| `ask_knowledge` | RAG-powered Q&A with source citations |
| `find_similar` | Find similar documents/chunks by vector similarity |
| `pipeline_status` | Sales pipeline analytics (by stage, territory, EHR, score) |
| `discover_connections` | Find paths between two entities in the graph |
| `list_communities` | Show entity clusters from community detection |

## Requirements

- Node.js 18+
- Docker (for Memgraph + Qdrant)
- `OPENAI_API_KEY` env var (embeddings)
- `ANTHROPIC_API_KEY` env var (LLM extraction + RAG)
