# Penpal

An AI Operating System for Product Engineers. Orchestrates teams of autonomous Claude Code agents through a visual command center, manages knowledge via a graph database, and ships code through a three-phase pod pipeline with built-in quality gates.

> This is 💯 a work in progress, but with that being said I use this tool to run my development workflow.
> I refer to agents as duders.

## Current Utility and Workflow

1. I plan with claude-code agents and use the lab view to quickly locate and focus on terminal windows that belong to a specific instance. Clicking a desk focuses on the terminal session no matter where it is. I was getting lost in terminal windows previously. It surfaces all of my llm sessions no matter their flavor (claude code, cursor agent, nemoclaw, opencode) to one place.
2. My planning creates github issues. I make sure claude-code or cursor agent (whatever I'm using at the time) creates small issues that have a solid definition of done. I even allow this agent to provide a execution strategy for the github issues as some of them can depend on each other. The pod system has mechanisms to help from collisions and pod to pod communication.
3. Agents from the pods are split into triplets (planning, executing and validating), they are connected to slack. This connection gives them the ability to DM me when they have questions (usually the planning agent).
4. While interacting with the issues and the pods, I am often toggling the github labels to retrigger the planning duder after answering a question, this allows me to simulate revving an agent in plan mode, but through the github issue comments, or slack.
5. Execution creates a branch, does the work, writes a test to validate, then sets the issue to the label our validation triplet is waiting for. The validator runs playwright e2e tests, then raises a PR or labels the issue as a failure and notifies me.
- When pods finish the validation pod raises a pull request into the default branch usually `main`.

## Vision: Run Your Business Like an RPG

Penpal turns your entire operation into a game. Your AI agents are characters in a pixel-art world. Your GitHub issues are quests. Shipping code earns XP. Every department is a scene on the world map, staffed by specialized duders who share a single knowledge graph — the company's brain.

### World Map

![World Map](docs/screenshots/Landing.png)

The overworld. Each pin is a department, a Penpal instance, or a remote service. Click a location to enter it. The vision: multiple Penpal instances communicating across users and machines, each one a different part of the business.

### Departments (Scenes)

Each department is a pixel-art scene with its own agents, tools, and purpose. They all read from and write to the same knowledge graph.

| Department | Status | What it does |
|-----------|--------|-------------|
| **The Lab** | Live | R&D headquarters — agents ship code, run tests, raise PRs |
| **Call Center** | Planned | Outreach — agents handle lead follow-up, appointment setting, email campaigns |
| **Marketing Studio** | Planned | Content — agents create blog posts, social media, design assets, messaging |
| **War Room** | Planned | Strategy — competitive intelligence, pipeline reviews, quarterly planning |

### The Lab

![Lab View](docs/screenshots/Location.png)

The R&D headquarters. Agents ("duders") sit at desks, take coffee breaks at the cafe, and walk through laser doorways. Every Claude Code session is a living character in the lab. The more you ship, the more the lab comes alive.

- Agents work at assigned desks with directional sit animations
- Baristas run the cafe -- Latte Larry and Mocha Maya serve the team
- Laser doors open as agents walk through corridors
- Idle agents take walk breaks on the NavMesh floor
- Scene layout driven by `lab-map.json` -- edit positions, rooms, and animations without touching code
- XP, ranks, seasons, leaderboards, cosmetic rewards -- gamification built into every workflow

### Dispatch Board

Your quest log. GitHub issues flow through a kanban pipeline: Planning, Executing, Validating, Done, Failed. Label an issue `agent-ready` and a pod picks it up automatically.

![Dispatch](docs/screenshots/Dispatch.png)

## Agent Personas

Pod worker agents have the personas below and the configurations. Configurability here is evolving for economic and speed modes.

| | Agent | Title | Role | Model | Specialty |
|---|-------|-------|------|-------|-----------|
| <img src="Penny/public/sprites/avatars/WuKong.png" width="40"> | **Sun Wukong** | The Monkey King | Solver | Opus | Full-stack — transforms into whatever the codebase needs |
| <img src="Penny/public/sprites/avatars/ErlangShen.png" width="40"> | **Erlang Shen** | The Three-Eyed God | Solver | Opus | Frontend — third eye sees broken layouts |
| <img src="Penny/public/sprites/avatars/Guanyin.png" width="40"> | **Guanyin** | Bodhisattva of Compassion | Reviewer | Opus | Backend architecture — sees the whole system |
| <img src="Penny/public/sprites/avatars/Tripitaka.png" width="40"> | **Tang Sanzang** | The Monk Tripitaka | Reviewer | Opus | Product management — keeps the mission on track |
| <img src="Penny/public/sprites/avatars/AoGuang.png" width="40"> | **Dragon King Ao Guang** | King of the East Sea | Reviewer | Opus | UI/UX — every pixel intentional |
| <img src="Penny/public/sprites/avatars/ShaWujing.png" width="40"> | **Sha Wujing** | Curtain-Lifting General | Executor | Sonnet | Validation & QA — if he says it passes, it passes |
| <img src="Penny/public/sprites/avatars/ZhuBajie.png" width="40"> | **Zhu Bajie** | Marshal of the Heavenly Canopy | Executor | Sonnet | Executive ops — brute-force effective |
| <img src="Penny/public/sprites/avatars/Nezha.png" width="40"> | **Nezha** | The Third Lotus Prince | Solver | Opus | Mobile — everything must be instant |
| <img src="Penny/public/sprites/avatars/RedBoy.png" width="40"> | **Red Boy** | Holy Child King | Solver | Opus | Game dev — creative fire, playful destruction |
| <img src="Penny/public/sprites/avatars/BullDemonKing.png" width="40"> | **Bull Demon King** | Great Sage Who Pacifies Heaven | Solver | Opus | Embedded/systems — zero waste, low-level mastery |
| <img src="Penny/public/sprites/avatars/AoRun.png" width="40"> | **White Dragon Horse** | Third Prince of the West Sea | Solver | Opus | Content & marketing — carries the message |

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

## Knowledge Graph — The Company Brain

Every department, every agent, every decision draws from the same knowledge graph. It's the flow of all knowledge through the business — not a static database, but a living network that grows as agents work.

![Knowledge Graph](docs/screenshots/knowledgegraph.png)
*3,281 nodes, 8,582 relationships — queryable by every agent via MCP tools*

Your markdown files, emails, RSS feeds, and alerts all feed into a structured graph. When a lab agent builds a feature, it knows which customers asked for it. When a marketing agent writes a blog post, it pulls competitive context from the same graph. Every department reads from and writes to the same brain.

**How it works:**

1. **Parse** -- Walk every markdown file. Extract frontmatter, links, tags, and prose.
2. **Extract** -- Claude identifies entities in the text: people, companies, technologies, regulations, sales leads.
3. **Connect** -- Build a relationship graph in Memgraph. Documents link to entities. Entities link to each other (WORKS_AT, COMPETES_WITH, MENTIONS).
4. **Embed** -- Chunk content and embed into Qdrant vectors for semantic similarity search.
5. **Analyze** -- Run graph algorithms (PageRank, community detection, betweenness centrality) to surface the most important nodes and hidden connections.
6. **Refresh** -- Scheduler runs cron jobs to ingest Google Alerts, RSS feeds, email mining (via [gog CLI](https://gogcli.sh/)), and daily briefings. The graph stays current automatically.

The result is a self-updating web of your entire knowledge base that every agent in every department can query.

**What agents can do with it:**

| MCP Tool | What it does |
|----------|-------------|
| `search_knowledge` | Semantic search across all document chunks |
| `query_graph` | Run Cypher queries against the full graph |
| `find_entity` | Look up any entity and its relationships |
| `ask_knowledge` | RAG-powered Q&A with source citations |
| `find_similar` | Find related documents by vector similarity |
| `pipeline_status` | Sales analytics by stage, territory, EHR, score |
| `discover_connections` | Find paths between two entities in the graph |
| `list_communities` | Show entity clusters from community detection |

### Panels

| Panel | Description |
|-------|-------------|
| **Lab** | Pixel-art agent headquarters with live session status |
| **Dispatch** | Kanban quest board for the GitHub issue pipeline |
| **Tasks** | Orchestrator queue, Veritas board, GitHub issues |
| **Data** | ETL pipeline controls, ingestion scripts |
| **Vault** | Knowledge base editor with linked documents, tags, and graph viz |
| **Evals** | Agent evaluation metrics and quality tracking |
| **Soundboard** | Audio clip player (synced via ~/Documents/Sound Effects/) |
| **Settings** | Appearance, theme controls, service config |

## Repository Structure

```
Penpal/
  Penny/                # Electron dashboard (React + Tailwind + Phaser)
    agents/             # Agent personas (Journey to the West), shared memory, MCP profiles
    public/sprites/     # Sprite sheets, lab-map.json, GDS scene assets
    src/main/           # Main process (IPC, pods, flight board, sessions, soundboard)
    src/renderer/       # React shell + Phaser game (50+ game modules)
    tests/              # Playwright E2E + Vitest unit tests
    data/               # Runtime state (flight-board.json, pod-workflows.json)
  analytics/            # Graph ETL pipeline, MCP server, scheduler
    src/etl/            # Entity extraction, sales pipeline, RSS ingestion
    src/mcp/            # MCP server (8 tools for graph + vector queries)
    schedule.yaml       # Cron job definitions
  scripts/              # Vault utilities (image automation, transcription, cleanup)
  tools/                # Dispatch scripts
  data/                 # Eval outcomes
  macos/                # macOS service installers (Finder automations, Whisper)
  docs/                 # Screenshots and documentation
```

### External Directories

These live outside the repo and are synced via iCloud across devices:

```
~/Documents/Sound Effects/    # Soundboard audio clips (mp3)
~/Documents/Vault/            # Knowledge base (markdown files — source for ETL)
```

## Quick Start

```bash
# Infrastructure
cd analytics
npm install
npm run infra:up          # Start Memgraph + Qdrant via Docker

# ETL
npm run etl               # Run full pipeline
npm run etl -- --project myapp   # Single project

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
