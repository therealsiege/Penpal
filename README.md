# Sidekick

AI-powered venture intelligence platform built on an Obsidian vault. Parses markdown notes into a knowledge graph (Memgraph + Qdrant), orchestrates teams of Claude Code agents, and surfaces everything through an Electron dashboard and MCP server.

## Repository Structure

```
sidekick/
  analytics/        # Graph ETL pipeline, MCP server, scheduler
  Penny/            # Electron dashboard (React + Tailwind + Phaser)
  Docs/             # Per-venture documentation and knowledge bases
  Resources/        # Reference materials
  tools/            # Utility scripts (dispatch, etc.)
  agents/           # Agent personas, shared memory, MCP profiles
```

## What We Built

### Phase 1 -- Vault Parsing & Embeddings
- Obsidian vault walker that parses markdown, frontmatter, wikilinks, and tags
- Memgraph ingestion: Documents, Folders, Tags with full relationship graph
- Qdrant vector store with OpenAI `text-embedding-3-small` embeddings
- Chunking strategy for long documents with overlap

### Phase 2 -- LLM Entity Extraction
- Claude Haiku extraction of People, Companies, Technologies, EHR Systems, Regulations, and Skills from document text
- Curated dictionaries for entity normalization and fuzzy matching
- Graph analytics via Memgraph MAGE: PageRank, community detection, betweenness centrality

### Phase 3 -- Sales Pipeline & Territories
- Lead ingestion from markdown files and CRM CSV
- Sales stage tracking (prospect -> qualified -> demo -> pilot -> closed)
- Territory mapping by state/region
- Lead scoring engine with weighted signals

### Phase 4 -- Revenue Intelligence
- CMS billing code mapping (MIPS quality measures, CPT codes)
- Program eligibility tracking (CCM, RPM, TCM)
- Specialty and practice association graphs

### Phase 5 -- External Intelligence
- NPI Registry integration: streaming 11GB NPPES CSV + real-time NPI API queries
- Web intelligence parser for structured competitor data
- Competitor product graph nodes and COMPETES_WITH relationships
- Output docs: Competitive Intelligence Matrix, Design Partner Shortlist, Messaging Playbook

### Phase 6 -- Multi-Venture Ingestion
- Venture-based ETL: each venture (MedScrub, MedHook, 1Putt Health) gets its own config, directories, and scoring profile
- Shared enrichment pipeline: extract -> enrich -> score -> write -> graph push
- RSS ingestion from healthcare feeds (HIStalk, Becker's, Fierce, ONC, CMS)
- Google Alerts ingestion with venture-aware routing
- Per-venture lead scoring profiles (clinical, integration, consulting)

### Phase 7 -- Scheduler
- Cron-like job runner with YAML config (`schedule.yaml`)
- Jobs: health checks, RSS ingest, daily briefing, NPI enrichment, full ETL
- Persistent state tracking with run history
- Daily briefing generator that writes markdown summaries to the vault
- NPI enricher with Firecrawl-powered practice website scraping and EHR detection
- System crontab integration (runs every minute)

### Phase 8 -- Electron Dashboard (Penny)
- Full desktop app: Electron + React 18 + Tailwind 3 + Phaser 3
- **Command Center**: Live pixel-art office scene with agent sprites, animated status bubbles, desk assignments, room decorations
- **Vault Editor**: CodeMirror 6 with wikilinks, frontmatter editor, multi-tab, templates, full-text search, tag browser, knowledge graph visualization
- **Pipeline Panel**: Sales stages, lead cards, territory breakdown
- **Health/Scheduler Panels**: Service status, job history, manual triggers
- **Sessions Panel**: Raw Claude Code + Cursor IDE session browser with JSONL transcript viewer
- **Graph Panel**: Interactive force-directed knowledge graph (react-force-graph-2d)
- **Settings Panel**: Appearance/theme controls, Veritas service management
- Embedded terminal (node-pty + xterm.js), command palette (Cmd+K), toast notifications

### Phase 9 -- Agent Teams & Orchestration
- **Agent personas**: 11 named agents with specialties, backstories, and desk positions (CrewAI-inspired)
- **Triplet workflows**: Solver/Reviewer/Executor pattern (AgentCoder-inspired) with independent review and max 3 feedback iterations
- **Task orchestrator**: Priority queue with skill-based agent scoring, automatic dispatch (10s loop), health monitoring (30s), graceful shutdown
- **Slack bridge**: Per-project channels via Socket Mode, bidirectional message routing, `!task` command for creating orchestrator tasks
- **Session discovery**: Both Claude Code (`~/.claude/sessions/`) and Cursor IDE agent transcripts
- **Headless execution**: Agents run via `claude -p` for background task processing
- Shared team memory (`agents/CLAUDE.md`) injected into all agent prompts

## MCP Server

The MCP server exposes 8 tools for graph + vector queries:

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

## Quick Start

```bash
# Infrastructure
cd analytics
npm install
npm run infra:up          # Start Memgraph + Qdrant via Docker

# ETL
npm run etl               # Run full pipeline for all enabled ventures
npm run etl -- --venture 1putt   # Single venture
npm run etl:clean         # Drop all data and reimport

# MCP Server
npm run mcp:dev           # Start MCP server (dev mode)

# Scheduler
npm run scheduler         # Start cron runner
npm run scheduler:status  # Check job statuses

# Sales Intelligence
npm run ingest:all        # Run all ingestion sources
npm run rss:ingest        # RSS feeds only
npm run alerts:ingest     # Google Alerts only

# Dashboard
cd Penny
npm install
npm run dev               # Electron dev with hot reload
npm run build             # Production build
```

## Requirements

- Node.js 18+
- Docker (Memgraph + Qdrant)
- macOS (iTerm2 for agent terminal interaction)
- `OPENAI_API_KEY` -- embeddings
- `ANTHROPIC_API_KEY` -- LLM extraction, RAG, and agent execution
- Optional: `SLACK_BOT_TOKEN` + `SLACK_APP_TOKEN` for Slack bridge

## Ventures

| Venture | Focus | Scoring Profile |
|---------|-------|-----------------|
| MedScrub | Clinical screening compliance (starting with CRC/MIPS #113) | Clinical |
| MedHook | EHR integration platform | Integration |
| 1Putt Health | Healthcare IT consulting | Consulting |
