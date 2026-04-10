# Penpal

An AI Operating System for Product Engineers. Orchestrates teams of autonomous Claude Code agents through a visual command center, manages knowledge via a graph database, and ships code through a three-phase pod pipeline with built-in quality gates.

![World Map](docs/screenshots/Landing.png)

## Penpal — Visual Command Center

Penpal is the dashboard. A pixel-art lab where your AI agents sit at desks, take coffee breaks, and ship code. Every Claude Code session becomes a character you can watch, interact with, and dispatch work to.

### World Map

Click a location marker to enter the lab. Double-click empty space to return to the map.

![Lab View](docs/screenshots/Location.png)

### Lab Scene

A GDS-exported pixel-art backdrop with 10 workstation positions, a cafe with animated baristas, and purple laser doorways that open as agents walk through.

- **Live agent sessions** rendered as animated characters at assigned desks
- **Baristas** (Latte Larry & Mocha Maya) run choreographed work loops in the cafe
- **Laser doors** fade open/closed based on agent proximity
- **NavMesh pathfinding** -- agents walk only on valid floor tiles
- **lab-map.json** -- single JSON config for desks, rooms, walk tracks, and animations

### Dispatch Board

Kanban board tracking GitHub issues through the agent pipeline. Label an issue `agent-ready` and the system picks it up automatically.

![Dispatch](docs/screenshots/Dispatch.png)

### Panels

| Panel | Description |
|-------|-------------|
| **Lab** | Pixel-art agent lab with live session status |
| **Dispatch** | Kanban board for the GitHub issue pipeline |
| **Tasks** | Orchestrator queue, Veritas board, GitHub issues |
| **Data** | ETL pipeline controls, ingestion scripts |
| **Vault** | CodeMirror 6 editor with wikilinks, tags, graph viz |
| **Evals** | Agent evaluation metrics and quality tracking |
| **Soundboard** | Audio clip player (synced via ~/Documents/Sound Effects/) |
| **Settings** | Appearance, theme controls, service config |

## Agent Personas — Journey to the West

Every agent is a character from the Chinese epic *Journey to the West*, with a specialty, backstory, and assigned desk in the lab.

| Agent | Title | Role | Model | Specialty |
|-------|-------|------|-------|-----------|
| **Sun Wukong** | The Monkey King | Solver | Opus | Full-stack — transforms into whatever the codebase needs |
| **Erlang Shen** | The Three-Eyed God | Solver | Opus | Frontend — third eye sees broken layouts |
| **Guanyin** | Bodhisattva of Compassion | Reviewer | Opus | Backend architecture — sees the whole system |
| **Tang Sanzang** | The Monk Tripitaka | Reviewer | Opus | Product management — keeps the mission on track |
| **Dragon King Ao Guang** | King of the East Sea | Reviewer | Opus | UI/UX — every pixel intentional |
| **Sha Wujing** | Curtain-Lifting General | Executor | Sonnet | Validation & QA — if he says it passes, it passes |
| **Zhu Bajie** | Marshal of the Heavenly Canopy | Executor | Sonnet | Executive ops — brute-force effective |
| **Nezha** | The Third Lotus Prince | Solver | Opus | Mobile — everything must be instant |
| **Red Boy** | Holy Child King | Solver | Opus | Game dev — creative fire, playful destruction |
| **Bull Demon King** | Great Sage Who Pacifies Heaven | Solver | Opus | Embedded/systems — zero waste, low-level mastery |
| **White Dragon Horse** | Third Prince of the West Sea | Solver | Opus | Content & marketing — carries the message |

Executor agents default to Sonnet with 1.5x timeout -- validation doesn't need Opus-level reasoning.

## Pod System — Three-Phase Pipeline

Agents work in **pods** -- three-phase workflows inspired by AgentCoder:

1. **Plan** -- Explore the codebase, design the approach
2. **Execute** -- Implement in an isolated git worktree
3. **Validate** -- Run Playwright E2E tests, assert pass/fail

### Runtime Profiles

Route pods between frontier cloud models and local inference to balance speed vs cost:

| Profile | Plan | Execute | Validate | Timeout | Cost |
|---------|------|---------|----------|---------|------|
| **max** | Opus | Opus | Sonnet | 1x | Max plan quota |
| **economic** | coder:30b | coder:30b | coder:30b | 5x | $0 (local Ollama) |
| **sonnet** | Sonnet | Sonnet | Sonnet | 1.5x | Lower quota |

Set the system default in `agents/agent-types.yaml` or override per-issue with `economic` / `max` GitHub labels.

### Pod Coordination — Flight Board

Multiple pods running in parallel share a **flight board** that prevents collisions:

- **Planning broadcast** -- when a pod's planner finishes, it publishes its plan summary and file manifest
- **Cross-pod awareness** -- new pods see what's already in flight before they start planning
- **File-level gating** -- dispatch queues pods that would touch overlapping files
- **Rebase-before-PR** -- pods rebase onto latest main before creating PRs

## Knowledge Graph & Intelligence

The `analytics/` directory houses a graph ETL pipeline that parses markdown documents into a queryable knowledge graph:

- **Memgraph** -- 20+ node types (Documents, People, Companies, Technologies, Leads, etc.)
- **Qdrant** -- Vector embeddings for semantic search
- **MCP Server** -- 8 tools for graph queries, semantic search, RAG-powered Q&A
- **Scheduler** -- Cron jobs for RSS ingestion, daily briefings, NPI enrichment

### Ventures

| Venture | Focus | Scoring Profile |
|---------|-------|-----------------|
| MedScrub | Clinical screening compliance (CRC/MIPS #113) | Clinical |
| MedHook | EHR integration platform | Integration |
| 1Putt Health | Healthcare IT consulting | Consulting |

## Repository Structure

```
sidekick/
  Penny/              # Electron dashboard (React + Tailwind + Phaser)
    agents/           # Agent personas, shared memory, MCP profiles
    public/sprites/   # Sprite sheets, lab-map.json, GDS scene assets
    src/main/         # Main process (IPC, pods, flight board, sessions)
    src/renderer/     # React shell + Phaser game (50+ game modules)
  analytics/          # Graph ETL pipeline, MCP server, scheduler
  Docs/               # Per-venture documentation and knowledge bases
  tools/              # Utility scripts (dispatch, etc.)
```

## Quick Start

```bash
# Infrastructure
cd analytics
npm install
npm run infra:up          # Start Memgraph + Qdrant via Docker

# ETL
npm run etl               # Run full pipeline
npm run etl -- --venture 1putt   # Single venture

# MCP Server
npm run mcp:dev           # Start MCP server

# Dashboard
cd Penny
npm install
npm run dev               # Electron dev with hot reload
npm run build             # Production build

# Agent Dispatch
# Label a GitHub issue with 'agent-ready' to trigger the pipeline
# Add 'economic' label to route to local Ollama model
```

## Requirements

- Node.js 18+
- Docker (Memgraph + Qdrant)
- macOS (Electron + iTerm2 for agent terminal interaction)
- `ANTHROPIC_API_KEY` -- agent execution and LLM extraction
- `OPENAI_API_KEY` -- embeddings
- Optional: Ollama with `coder:30b` for economic mode
- Optional: `SLACK_BOT_TOKEN` + `SLACK_APP_TOKEN` for Slack bridge
