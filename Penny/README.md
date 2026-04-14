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

- **GitHub issue pipeline** — polls for `agent-ready` issues, spins up a 3-agent pod in an isolated worktree, pushes a PR on completion
- **Configurable runtime profiles** — run on Claude Opus (max quality), Sonnet (balanced), or local Ollama via OpenCode (zero cost)
- **Pod workflow**: Solver implements -> Reviewer validates independently -> Executor tests. Feedback loops on failure
- **Dispatch board** — unified view of all issues and pods in phase columns with agent avatars and controls
- **MCP servers** surfaced in one configurable area

### 3. Knowledge Management

A vault of markdown files backed by a knowledge graph.

- **Full markdown editor** — CodeMirror 6 with wikilinks, frontmatter, outline, templates, tabs, search
- **Knowledge graph** — ETL scripts generate a graph in Memgraph with embeddings in Qdrant
- **Google GOG CLI** integration for research and data access
- **Live file watching** — external edits sync immediately

### 4. Soundboard

Sound effects for meetings and fun. Vault and soundboard files live in your home directory where Apple iCloud handles backup.

---

## Vision

**Theme: Run your agentic business like an RPG video game.**

Agents are characters with personas from *Journey to the West*. Pods are quests. The office is a scene. XP, leaderboards, seasons, and cosmetic rewards make the work visible and engaging.

The long-term goal: manage the operations of an entire business through Slack, GitHub Issues, and Linear — with Penpal as the operating system that turns those inputs into coordinated agent work, visible in real-time through game scenes.

### Current Scene: Development Lab

We're eating our own dogfood — Penpal's pod system is used to build Penpal itself. The lab scene shows an isometric office where agent characters work at desks, take coffee breaks in the cafe, and celebrate task completions with particle effects.

### Roadmap

**Dispatch evolution:**
- **Linear integration** — pull tasks from Linear alongside GitHub Issues. Same dispatch board, same pod system, another source of work
- **Dispatch in the game** — weave the dispatch board into Mission Control itself. Issues appear as quest markers in the lab. Click an agent's desk to see their current pod. The game IS the control surface
- **Slack-first operations** — manage everything from Slack. `!task`, `!pod status`, `!dispatch`. The desktop app is the visual layer; Slack is the command line

**Future scenes:**

| Scene | Purpose |
|-------|---------|
| **Virtual Call Center** | Customer support agents handling tickets, escalating to humans, tracking resolution |
| **Marketing Content & Design Studio** | Content creation pipelines — blog posts, social campaigns, design assets, SEO optimization |
| **Mail Room** | Email triage, automated responses, lead qualification, correspondence management |
| **Strategic War Room** | Competitive intelligence, market analysis, product strategy, OKR tracking |

Each scene is a self-contained workspace with its own agent team, workflow patterns, and game mechanics — all managed from the same world map.

---

## The Agent Roster

Agents have personas from *Journey to the West* with unique backstories, working styles, and roles.

| Agent ID | Persona | Role | Default Pod Role |
|----------|---------|------|-----------------|
| `fullstack-dev` | **Sun Wukong** — The Monkey King | Senior full-stack developer | Solver |
| `nextjs-frontend` | **Erlang Shen** — The Three-Eyed God | Next.js / React frontend specialist | Solver |
| `electron-dev` | **Sha Wujing** — The Curtain-Lifting General | Electron / desktop specialist | Executor |
| `backend-arch` | **Guanyin** — Bodhisattva of Compassion | Backend architecture reviewer | Reviewer |
| `expo-mobile` | **Nezha** — The Third Lotus Prince | React Native / Expo mobile | Solver |
| `embedded-dev` | **Bull Demon King** — Great Sage Who Pacifies Heaven | Embedded systems / low-level | Solver |
| `videogame-dev` | **Red Boy** — Holy Child King | Phaser / game development | Solver |
| `ui-designer` | **Ao Guang** — Dragon King of the East Sea | UI/UX design reviewer | Reviewer |
| `product-mgr` | **Tripitaka** — The Monk | Product management / planning | Reviewer |
| `product-marketer` | **Ao Run** — White Dragon Horse | Content marketing | Solver |
| `exec-assistant` | **Zhu Bajie** — Marshal of the Heavenly Canopy | Executive assistant / ops | Executor |

Each agent has a catchphrase, backstory, and working style injected into their system prompt. Pod presets combine agents into teams:

| Preset | Solver | Reviewer | Executor |
|--------|--------|----------|----------|
| `frontend-feature` | Erlang Shen | Ao Guang | Sha Wujing |
| `backend-feature` | Sun Wukong | Guanyin | Sha Wujing |
| `full-stack` | Sun Wukong | Guanyin | Sha Wujing |
| `content-pipeline` | Ao Run | Tripitaka | Zhu Bajie |

---

## Pod Workflow — How Issues Become PRs

```
GitHub Issue (labeled agent-ready)
  |
  v
[1] GitHub Pipeline picks up the issue
  |  - Creates isolated git worktree + branch
  |  - Selects runtime profile from labels (economic/max/sonnet)
  |  - Copies opencode.json for Ollama provider access
  |
  v
[2] SOLVER (e.g. Sun Wukong)
  |  - Reads the issue description
  |  - Implements the solution in the worktree
  |  - Commits changes to the branch
  |
  v
[3] REVIEWER (e.g. Guanyin)
  |  - Reviews independently (does NOT see solver's code)
  |  - Returns structured verdict: approve / reject / request-changes
  |  - On reject: feedback goes back to solver (iteration loop)
  |  - On parse failure: rejects (no silent auto-approve)
  |
  v
[4] EXECUTOR (e.g. Sha Wujing)
  |  - Runs test plan against the implementation
  |  - Returns RESULT: PASS or RESULT: FAIL
  |  - On fail: self-fix loop (up to maxSelfFixes attempts)
  |  - On continued fail: feedback to solver (next iteration)
  |
  v
[5] PR Created
     - Branch pushed to origin
     - PR created with "Closes #N"
     - Issue labeled pr-ready
```

**Max iterations**: configurable per profile. Economic mode gets 5 rounds; max gets 3.

---

## Fleet — Multiple Machines

Penpal instances discover each other via Slack. No port forwarding, no central broker.

### How It Works

1. Each instance posts a heartbeat to `#sk-fleet` every 60 seconds
2. Heartbeat includes: hostname, username, sessions, pods, health, IP geolocation
3. Messages are updated in-place (`chat.update`) — one message per instance
4. The world map renders pins for each instance (red = you, blue = remote, gray = stale)

### Setup on a New Machine

1. Clone the repo
2. `npm install` in `Penny/`
3. Add Slack tokens to `Penny/.env` (or they auto-load from `.env.shared`)
4. `npm run dev` — your pin appears on the world map within 60 seconds

Fleet pins show the OS username as a hover label. Same-city instances nudge apart slightly so both are clickable.

---

## Runtime Profiles

Configure once in the Profiles panel. Every new pod inherits the default.

| Profile | Plan Model | Execute Model | Validate Model | Timeout | Iterations | Self-Fixes | Cost |
|---------|-----------|---------------|----------------|---------|------------|------------|------|
| `max` | Opus | Opus | Sonnet | 1x | 3 | 1 | $$$ |
| `sonnet` | Sonnet | Sonnet | Sonnet | 1.5x | 3 | 1 | $$ |
| `economic` | ollama:qwen3-coder:30b | ollama:qwen3-coder:30b | ollama:qwen3-coder:30b | 8x | 5 | 3 | Free |

**Economic mode**: Routes through OpenCode CLI (which has tool use + file editing) to your local Ollama instance. More iterations and self-fixes compensate for the smaller model. Zero API cost.

**Per-issue override**: Label a GitHub issue with `economic`, `max`, or `sonnet` to override the default profile for that issue.

**Custom profiles**: Create your own in the Profiles panel — mix models per phase, tune timeouts, save to `data/pod-profiles.json`.

---

## Game Systems — Dev Studio Tycoon

The isometric lab isn't just a visualizer — it's a game layer on top of real work.

| System | Description |
|--------|-------------|
| **Quests** | Every agent task auto-wraps into a quest. Difficulty inferred from priority. XP/credit multipliers: trivial 1x, normal 1.5x, hard 2x, epic 3x, legendary 5x |
| **Cosmetic Tiers** | Desk items gated by XP rank — interns get bare desks, higher ranks unlock keyboard, lamp, plant, phone, gold trim, RGB underglow |
| **Leaderboard** | Season XP rankings. Weekly MVP. Rivalries detected when agents are within 5% XP. Toggle with `L` key |
| **Seasons** | 30-day arcs with themed challenges (Neon Sprint, Deep Focus, Ship It, Blitz Mode). Auto-rotates on expiry |
| **Credits** | Cosmetic-only currency earned from quests. Shop: room themes, desk LED colors, particle effects, name colors |
| **Day/Night** | Atmospheric cycle with sky gradients, starfield, clouds, shadows, dawn/dusk flash transitions |
| **Cafe** | Agents take coffee breaks, sit at stools, social emoji interactions between seated agents |

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
SLACK_OWNER_USER_ID=U...        # Your Slack member ID for DM alerts
FIRECRAWL_API_KEY=fc-...
GITHUB_PERSONAL_ACCESS_TOKEN=ghp_...
BROWSERBASE_API_KEY=bb_live_...
NOTION_API_KEY=ntn_...

# Optional
PENNY_TASK_RUNNER=claude        # Default headless backend (claude/opencode/cursor-agent)
PENNY_OLLAMA_BASE_URL=http://127.0.0.1:11434
PENNY_OLLAMA_MODEL=qwen3-coder:30b
FLEET_MAP_X=820                 # Pin position on world map (3840x2160 space)
FLEET_MAP_Y=1020
```

### Adding Watched Repos

In the Dispatch panel, click **Sources** to add GitHub repos. Issues labeled `agent-ready` in those repos will be picked up by the pipeline.

```
Sources → + Add repository → owner/repo → local clone path
```

### OpenCode + Ollama Setup (Economic Mode)

`opencode.json` (committed) configures the Ollama provider:

```json
{
  "provider": {
    "ollama": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "Ollama (local)",
      "options": { "baseURL": "http://127.0.0.1:11434/v1" },
      "models": { "qwen3-coder:30b": { "name": "Qwen3 Coder 30B" } }
    }
  }
}
```

Requires Ollama running locally with `qwen3-coder:30b` pulled: `ollama pull qwen3-coder:30b`

---

## Architecture

### Main Process (`src/main/`)

| Module | Purpose |
|--------|---------|
| `pods.ts` | 3-agent workflow engine — Solver/Reviewer/Executor with runtime profiles, issue tracking, phase overrides, file conflict detection |
| `github-pipeline.ts` | `agent-ready` issues -> isolated worktree -> pod -> PR creation |
| `github-issues.ts` | GitHub issue poller, watched repo management, card aggregation |
| `fleet-heartbeat.ts` | Multi-instance discovery via Slack `#sk-fleet`, IP geolocation, 60s cycle |
| `slack-bridge.ts` | Per-project Slack channels, bidirectional message routing, `!task` commands, fleet re-export |
| `sessions.ts` | Discovers Claude Code / Cursor / OpenCode sessions, reads JSONL transcripts, headless agent execution |
| `orchestrator.ts` | Task queue with priority routing, agent scoring, dispatch loop (10s), health monitor (30s) |
| `agents.ts` | Agent configs from `agent-types.yaml`, CLI arg building, headless backend chains, model mapping |
| `ollama-client.ts` | Local Ollama HTTP client (`/api/generate`, `/api/tags`) |
| `flight-board.ts` | Tracks files being edited by active pods for conflict detection |
| `vault.ts` | Vault file manager — CRUD, search, tags, backlinks, `vault://` protocol |
| `health.ts` | Infrastructure health checks (Memgraph, Qdrant, Docker) |
| `ipc.ts` | All `ipcMain.handle()` registrations with `wrapHandler` error boundary |

### Renderer (`src/renderer/src/`)

**Panels:**

| Panel | Description |
|-------|-------------|
| `CommandCenter.tsx` | World map (CampusScene with fleet pins) + isometric lab (OfficeScene with agent visualization), status bar with fleet pill, scheduler, health, leaderboard |
| `OrchestratorModal.tsx` | Dispatch board — unified GitHub issue + pod workflow board with phase columns, agent avatars, expand for pod detail with team grid and controls |
| `ProfilesPanel.tsx` | Runtime profile editor — visual Plan/Execute/Validate pipeline, model dropdowns, timeout/iteration/self-fix knobs, default selection |
| `VaultPanel.tsx` | Full markdown editor with file tree, wikilinks, graph view, frontmatter, search, tags, backlinks |
| `EvalsPanel.tsx` | Agent evaluation dashboard — pod quality metrics, spot-check queue, weekly digests |
| `DataPanel.tsx` | Data exploration, ETL scripts, graph queries |
| `SettingsPanel.tsx` | Appearance/theme, GitHub repo management, config snapshot viewer |
| `SoundboardPanel.tsx` | Sound effect browser and playback |

**Game (`game/`):**

80+ files, ~20,000 lines. Two Phaser 3 scenes:

| Scene | Description |
|-------|-------------|
| `CampusScene.ts` | World map — illustrated 3840x2160 backdrop, sprite marker pins per fleet instance, anchor-based lat/lon projection, hover labels, click-to-zoom, double-click-to-enter-lab |
| `OfficeScene.ts` | Isometric lab orchestrator (~4700 lines) — delegates to 18+ modules for workstations, rooms, animations, atmosphere, particles, UI overlays, cafe, pods, minimap, camera |

Key game modules:

| Module | Lines | Description |
|--------|------:|-------------|
| `workstation-animation.ts` | ~1200 | Status bubbles, mood, monitor glow, idle micro-variety |
| `workstation-creation.ts` | ~1100 | Desk/chair/monitor/sprite creation, rank-gated cosmetics |
| `office-workstation.ts` | ~1700 | Workstation lifecycle, XP bars, sparklines, progress rings |
| `celebrations.ts` | ~1130 | Rank-up, task-complete, milestone, error effects |
| `penny-cafe.ts` | ~830 | Cafe with stools, coffee runs, social interactions |
| `office-atmosphere.ts` | ~740 | Day/night cycle, sky, starfield, clouds, shadows |
| `office-rooms.ts` | ~1070 | Room creation, doors, headers, animated resize |
| `quest-system.ts` | ~220 | Quest auto-wrapper, difficulty inference, XP multipliers |
| `seasons.ts` | ~310 | 30-day seasonal arcs with themed challenges |
| `leaderboard.ts` | ~235 | XP rankings, weekly MVP, rivalry detection |

### Agents (`agents/`)

| File | Description |
|------|-------------|
| `agent-types.yaml` | Agent definitions — persona (name, backstory, style, catchphrase), skills, model, pod role, runtime profiles, pod presets |
| `CLAUDE.md` | Shared team memory — injected into all agent system prompts. Pod results are appended here as team knowledge |
| `mcp-profiles/` | MCP server configurations per agent role (e.g. `qa-executor.json` with Playwright tools) |

### Data (`data/`)

Runtime state files (JSON, gitignored):

| File | Description |
|------|-------------|
| `pod-workflows.json` | Pod workflow state (all active + recent completed) |
| `pod-profiles.json` | Custom runtime profiles (merged with YAML built-ins) |
| `agent-sessions.json` | Agent ID -> session/PID mapping |
| `task-queue.json` | Orchestrator task queue |
| `flight-board.json` | Active file claims for conflict detection |
| `github-pipeline.json` | Pipeline issue tracking state |
| `spot-checks.json` | Eval spot-check queue |

---

## MCP Server

Penpal exposes an MCP (Model Context Protocol) server so Claude sessions can programmatically discover and invoke Penpal's capabilities.

```bash
npm run mcp:start        # stdio transport
```

| Group | Tools |
|-------|--------|
| **meta** | `meta:list-tools`, `meta:describe-tool` |
| **orchestrator** | `orchestrator:enqueue`, `orchestrator:queue`, `orchestrator:agent-health` |
| **pods** | `pod:list`, `pod:status`, `pod:create` |
| **office** | `office:rooms`, `office:agents`, `office:leaderboard` |
| **vault** | `vault:read`, `vault:search`, `vault:write` |

Connect via `.mcp.json`:

```json
{
  "mcpServers": {
    "penny-mcp": {
      "command": "npm",
      "args": ["run", "--prefix", "Penny", "mcp:start"]
    }
  }
}
```

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
| Slack | @slack/bolt 4 (Socket Mode) |
| Language | TypeScript 5.7 |
| Testing | Vitest (315 unit tests), Playwright (E2E) |

## Scripts

```bash
npm run dev              # electron-vite dev with HMR
npm run build            # production build
npm run sprites:all      # rebuild all sprite sheets (9 scripts)
npm run test             # vitest unit tests
npm run mcp:start        # start MCP server
npm run pod:create       # CLI pod launcher
npm run typecheck        # tsc --noEmit
npm run package          # electron-forge package
npm run make             # electron-forge make (distributable)
```

<details>
<summary>Full IPC API Reference</summary>

All IPC calls go through `window.api.*`. Each handler uses `wrapHandler` which catches errors and returns `{ error: string }`.

**Sessions**: `getClaudeSessions()`, `sendToSession(tty, msg)`, `focusSession(tty)`, `createNewSession(cwd)`, `approveSession(tty, choice)`, `broadcastToSessions(msg)`, `pruneStaleSessions(maxIdleMinutes?)`

**Agents**: `getAgents()`, `getAgentStatuses()`, `launchAgent(id, cwd)`, `focusAgent(id)`

**Pods**: `createPod(task, opts?)`, `listPods()`, `getPodStatus(id)`, `pausePod(id)`, `resumePod(id)`, `cancelPod(id)`, `overridePod(id, phase, override)`, `getPodPresets()`

**Pod Profiles**: `podProfiles()`, `podSaveProfile(name, profile)`, `podDeleteProfile(name)`, `podSetDefaultProfile(name)`

**Orchestrator**: `orchestratorQueue()`, `orchestratorEnqueue(...)`, `orchestratorCancelTask(id)`, `orchestratorRetryTask(id)`, `orchestratorStats()`, `orchestratorXP()`, `orchestratorCredits()`

**GitHub**: `githubCards()`, `githubPollNow()`, `githubAddRepo(owner, repo, path)`, `githubRemoveRepo(owner, repo)`, `githubListRepos()`

**Fleet**: `fleetStatus()` — all instances with heartbeat data, health, geolocation

**Vault**: `vaultList(path)`, `vaultRead(path)`, `vaultWrite(path, content)`, `vaultCreate(path)`, `vaultSearch(query)`, `vaultTags()`, `vaultBacklinks(path)`, `vaultGraphData()`

**Slack**: `slackStatus()`, `slackStart()`, `slackStop()`

**Evals**: `evalsSpotCheckQueue()`, `evalsSpotCheckSample(count)`, `evalsSpotCheckReview(id, verdict)`, `evalsPodQuality()`

**Flight Board**: `flightBoardList()`, `flightBoardFilesInFlight()`

**Config**: `configSnapshot()`, `configAddProjectMcp(server)`, `configRemoveProjectMcp(name)`

</details>

## macOS Notes

- `titleBarStyle: hiddenInset` with custom traffic light offset
- Agent terminal interaction via iTerm2 AppleScript (requires iTerm2)
- Session focus uses `AXRaise` for reliable window foregrounding
- Vault + soundboard files in home directory for iCloud backup
