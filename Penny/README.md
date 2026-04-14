# Penpal

An operating system for running an AI workforce.

Penpal started as a way to manage terminal sessions across Claude Code, OpenCode, and Cursor Agent. It grew into a full operating system for orchestrating AI coding agents — visible as characters in an isometric game world, working autonomously on GitHub issues, communicating via Slack, and running across multiple machines.

Built by [1Putt Health](https://1putthealth.com) for creating and launching digital health products and software tools. Penpal builds itself — the pod system that solves GitHub issues is the same system we use to develop Penpal.

---

## What Penpal Does Today

### 1. Manage Current Operations

See every AI agent session running across your machines in one place.

- **Focus any terminal** running a Claude Code, OpenCode, or Cursor Agent session
- **Communicate via Slack** — each project gets its own channel, messages route to the right agent
- **Get DM'd** when an agent has a question or needs tool approval
- **World map** shows all your Penpal instances as pins with live status (fleet heartbeat via Slack)
- **Isometric lab view** — agents visualized as animated characters at workstations with status bubbles

### 2. Tee Up Background Work

Label a GitHub issue `agent-ready`, walk away, come back to a PR.

- **GitHub issue pipeline** — polls for `agent-ready` issues, spins up a 3-agent pod (Solver, Reviewer, Executor) in an isolated worktree, pushes a PR on completion
- **Configurable runtime profiles** — run on Claude Opus (max quality), Sonnet (balanced), or local Ollama via OpenCode (zero cost). Configure model, timeout, and iteration limits per phase
- **Pod workflow**: Solver implements → Reviewer validates independently → Executor tests. If tests fail, feedback loops back to the solver (up to 5 iterations on economic mode)
- **Dispatch board** — unified view of all issues and pods in phase columns (Planning → Executing → Validating → Done → Failed) with agent avatars and controls
- **All MCP servers** surfaced in one configurable area — Claude Code, Cursor, and OpenCode MCP configs managed from the app

### 3. Knowledge Management

A vault of markdown files backed by a knowledge graph.

- **Full markdown editor** — CodeMirror 6 with wikilinks, frontmatter, outline, templates, tabs, search
- **Knowledge graph** — ETL scripts generate a graph in Memgraph with embeddings in Qdrant from your vault files
- **Google GOG CLI** integration for additional research and data access
- **Live file watching** — external edits sync immediately

### 4. Soundboard

Currently just for goofs during meetings. Sound effects and vault files live in your home directory where Apple iCloud handles backup.

---

## Vision

**Theme: Run your agentic business like an RPG video game.**

Agents are characters with personas from *Journey to the West*. Pods are quests. The office is a scene. XP, leaderboards, seasons, and cosmetic rewards make the work visible and engaging.

### Current Scene: Development Lab

We're eating our own dogfood — Penpal's pod system is used to build Penpal itself. The lab scene shows an isometric office where agent characters work at desks, take coffee breaks, and celebrate task completions.

### Future Scenes

| Scene | Purpose |
|-------|---------|
| **Virtual Call Center** | Customer support agents handling tickets, escalating to humans, tracking resolution |
| **Marketing Content & Design Studio** | Content creation pipelines — blog posts, social campaigns, design assets, SEO optimization |
| **Mail Room** | Email triage, automated responses, lead qualification, correspondence management |
| **Strategic War Room** | Competitive intelligence, market analysis, product strategy, OKR tracking |

Each scene is a self-contained workspace with its own agent team, workflow patterns, and game mechanics — all managed from the same world map.

---

## Quick Start

```bash
npm install
npm run dev       # electron-vite dev (hot reload)
npm run build     # production build to out/
```

### Environment Setup

Secrets go in `Penny/.env` (gitignored). Shared config lives in `.env.shared` (committed).

```bash
# Penny/.env (required for full functionality)
SLACK_BOT_TOKEN=xoxb-...
SLACK_APP_TOKEN=xapp-...
FIRECRAWL_API_KEY=fc-...
GITHUB_PERSONAL_ACCESS_TOKEN=ghp_...
```

`opencode.json` (committed) configures the Ollama provider for economic-mode pods.

### Pod Profiles

| Profile | Model | Timeout | Iterations | Self-Fixes | Cost |
|---------|-------|---------|------------|------------|------|
| `max` | Claude Opus | 1x | 3 | 1 | $$$ |
| `sonnet` | Claude Sonnet | 1.5x | 3 | 1 | $$ |
| `economic` | Ollama qwen3-coder:30b (local) | 8x | 5 | 3 | Free |

Set the default profile in the Profiles panel. Label GitHub issues with `economic`, `max`, or `sonnet` to override per-issue.

---

## Architecture

### Main Process (`src/main/`)

| Module | Purpose |
|--------|---------|
| `pods.ts` | 3-agent workflow engine — Solver/Reviewer/Executor with runtime profiles, issue tracking, phase overrides |
| `github-pipeline.ts` | `agent-ready` issues → isolated worktree → pod → PR |
| `github-issues.ts` | GitHub issue poller, watched repo management |
| `fleet-heartbeat.ts` | Multi-instance discovery via Slack `#sk-fleet`, IP geolocation |
| `slack-bridge.ts` | Per-project Slack channels, bidirectional message routing, `!task` commands |
| `sessions.ts` | Discovers Claude Code / Cursor / OpenCode sessions, reads transcripts |
| `orchestrator.ts` | Task queue with priority routing, agent scoring, dispatch loop |
| `agents.ts` | Agent configs from `agent-types.yaml`, CLI args, headless backend chains |
| `ollama-client.ts` | Local Ollama HTTP client for model access |
| `flight-board.ts` | Tracks files being edited by active pods (conflict detection) |
| `vault.ts` | Vault file manager — CRUD, search, tags, backlinks, `vault://` protocol |
| `health.ts` | Infrastructure health checks |
| `ipc.ts` | All IPC handler registrations |

### Renderer (`src/renderer/src/`)

**Panels:**

| Panel | Description |
|-------|-------------|
| `CommandCenter.tsx` | World map (fleet pins) + isometric lab (agent visualization) |
| `OrchestratorModal.tsx` | Dispatch board — GitHub issues + pods in phase columns |
| `ProfilesPanel.tsx` | Runtime profile editor — model/timeout/iterations per phase |
| `VaultPanel.tsx` | Markdown editor with wikilinks, graph view, search |
| `EvalsPanel.tsx` | Agent evaluation dashboard and spot-check queue |
| `DataPanel.tsx` | Data exploration and graph queries |
| `SettingsPanel.tsx` | Appearance, GitHub repos, config |
| `SoundboardPanel.tsx` | Sound effect browser |

**Game (`game/`):**

80+ files, ~20,000 lines. The Phaser 3 game engine renders the world map and lab scenes.

| Scene | Description |
|-------|-------------|
| `CampusScene.ts` | World map with fleet pins — illustrated backdrop, sprite markers, geolocation |
| `OfficeScene.ts` | Isometric lab — agent workstations, status bubbles, rooms, animations |

Key modules: workstation animation, celebrations, cafe/coffee runs, quest system, seasons, leaderboard, credits economy, day/night cycle, particle effects, minimap, pod connecting lines.

### Agents (`agents/`)

| File | Description |
|------|-------------|
| `agent-types.yaml` | Agent definitions — persona, skills, model, pod role, runtime profiles, pod presets |
| `CLAUDE.md` | Shared team memory injected into all agent system prompts |
| `mcp-profiles/` | MCP server configurations per agent role |

---

## Stack

| Layer | Technology |
|-------|-----------|
| Shell | Electron 33, electron-vite 5 |
| UI | React 18, Tailwind 3, Zustand |
| Game | Phaser 3.90 |
| Editor | CodeMirror 6 |
| Terminal | xterm.js + node-pty |
| Graph | neo4j-driver (Memgraph) |
| Slack | @slack/bolt (Socket Mode) |
| Language | TypeScript 5.7 |
| Testing | Vitest (unit), Playwright (E2E) |

## Scripts

```bash
npm run dev              # electron-vite dev with HMR
npm run build            # production build
npm run sprites:all      # rebuild all sprite sheets
npm run test             # vitest unit tests (315 passing)
npm run mcp:start        # start MCP server
npm run pod:create       # CLI pod launcher
npm run typecheck        # tsc --noEmit
```

<details>
<summary>IPC API Reference</summary>

All IPC calls go through `window.api.*`. Each handler uses `wrapHandler` which catches errors and returns `{ error: string }`.

**Sessions**: `getClaudeSessions()`, `sendToSession(tty, msg)`, `focusSession(tty)`, `createNewSession(cwd)`, `approveSession(tty, choice)`, `broadcastToSessions(msg)`

**Agents**: `getAgents()`, `getAgentStatuses()`, `launchAgent(id, cwd)`, `focusAgent(id)`

**Pods**: `createPod(task, opts?)`, `listPods()`, `getPodStatus(id)`, `pausePod(id)`, `resumePod(id)`, `cancelPod(id)`, `overridePod(id, phase, override)`, `getPodPresets()`

**Pod Profiles**: `podProfiles()`, `podSaveProfile(name, profile)`, `podDeleteProfile(name)`, `podSetDefaultProfile(name)`

**Orchestrator**: `orchestratorQueue()`, `orchestratorEnqueue(...)`, `orchestratorCancelTask(id)`, `orchestratorRetryTask(id)`, `orchestratorStats()`

**GitHub**: `githubCards()`, `githubPollNow()`, `githubAddRepo(owner, repo, path)`, `githubRemoveRepo(owner, repo)`, `githubListRepos()`

**Fleet**: `fleetStatus()`

**Vault**: `vaultList(path)`, `vaultRead(path)`, `vaultWrite(path, content)`, `vaultSearch(query)`, `vaultTags()`, `vaultBacklinks(path)`, `vaultGraphData()`

**Slack**: `slackStatus()`, `slackStart()`, `slackStop()`

**Evals**: `evalsSpotCheckQueue()`, `evalsSpotCheckSample(count)`, `evalsSpotCheckReview(id, verdict)`, `evalsPodQuality()`

</details>

## macOS Notes

- `titleBarStyle: hiddenInset` with custom traffic light offset
- Agent terminal interaction via iTerm2 AppleScript
- Session focus uses `AXRaise` for reliable window foregrounding
- Vault + soundboard files in home directory for iCloud backup
