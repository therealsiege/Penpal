# Penpal

AI-powered venture intelligence platform built on an Obsidian vault. Parses markdown notes into a knowledge graph (Memgraph + Qdrant), orchestrates teams of Claude Code agents, and surfaces everything through **Penpal** -- an Electron dashboard with a pixel-art agent office, dispatch kanban, and real-time session monitoring.

![World Map](docs/screenshots/Landing.png)

## Penpal Dashboard

Penpal is the visual command center. It turns your Claude Code agent sessions into an interactive pixel-art lab where agents sit at desks, baristas serve coffee, and laser doors animate as agents walk through them.

### World Map

Click a location marker to enter the lab. Agents are shown as characters at their assigned desks. Double-click empty space to return to the map.

![Lab View](docs/screenshots/Location.png)

### Lab Scene

A GDS-exported pixel-art backdrop with 10 workstation positions, a cafe with animated baristas, and purple laser doorways. Each agent sits at a pre-designed desk facing the correct direction, with idle walk breaks on the NavMesh floor.

- **Agent sessions** rendered as animated characters at desks
- **Baristas** (Latte Larry & Mocha Maya) run a choreographed work loop in the cafe
- **Laser doors** fade open/closed based on agent proximity
- **NavMesh pathfinding** -- agents only walk on valid floor tiles
- **lab-map.json** -- single JSON config for all desk positions, rooms, walk tracks, and animations

### Dispatch Board

A kanban board that tracks GitHub issues through the agent pipeline: Planning, Executing, Validating, Done, Failed. Issues labeled `agent-ready` are picked up automatically.

![Dispatch](docs/screenshots/Dispatch.png)

### Panels

| Panel | Description |
|-------|-------------|
| **Lab** | Pixel-art agent office with live session status |
| **Dispatch** | Kanban board for GitHub issue pipeline |
| **Tasks** | Orchestrator queue, Veritas board, GitHub issues |
| **Data** | ETL pipeline controls, ingestion scripts |
| **Vault** | CodeMirror 6 editor with wikilinks, tags, graph viz |
| **Evals** | Agent evaluation metrics and quality tracking |
| **Soundboard** | Audio clip player (reads from ~/Documents/Sound Effects/) |
| **Settings** | Appearance, theme controls, service config |

## Agent Teams & Pod System

Agents work in **pods** -- three-phase workflows inspired by AgentCoder:

1. **Plan** -- Designs the implementation approach
2. **Execute** -- Implements the code in an isolated git worktree
3. **Validate** -- Runs tests (Playwright E2E) and asserts pass/fail

### Runtime Profiles

Pods support configurable model routing to balance speed vs cost:

| Profile | Plan | Execute | Validate | Timeout | Cost |
|---------|------|---------|----------|---------|------|
| **max** | Opus | Opus | Sonnet | 1x | Max plan quota |
| **economic** | coder:30b | coder:30b | coder:30b | 5x | $0 (local Ollama) |
| **sonnet** | Sonnet | Sonnet | Sonnet | 1.5x | Lower quota |

Set the default in `agents/agent-types.yaml` or override per-issue with `economic` / `max` GitHub labels.

### Pod Coordination

Multiple pods running in parallel share a **flight board** (`data/flight-board.json`) that tracks:
- Which files each pod is modifying
- Plan summaries for cross-pod awareness
- Dispatch gating to prevent file-level collisions

### Agent Personas

11 named agents with specialties, backstories, and desk assignments:

| Agent | Role | Specialty |
|-------|------|-----------|
| Marcus Chen | Fullstack Dev | Solver -- end-to-end features |
| Lena Park | Next.js Frontend | Solver -- React/Next.js |
| Kai Tanaka | Electron Dev | Executor -- testing & validation |
| Ravi Patel | Backend Architect | Reviewer -- architecture critique |
| Sofia Ruiz | Expo Mobile | Solver -- React Native |
| + 6 more | Various | Marketing, product, QA |

## Knowledge Graph & ETL

The `analytics/` directory houses a graph ETL pipeline that parses an Obsidian vault into a queryable knowledge graph:

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
    src/main/         # Electron main process (IPC, pods, sessions, flight board)
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
