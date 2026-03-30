# Penny

Desktop command center for managing Claude Code agents, vault knowledge, and sales intelligence. Built with Electron, React, Tailwind, and Phaser 3.

## Quick Start

```bash
npm install
npm run dev       # electron-vite dev (hot reload)
npm run build     # production build to out/
```

Requires a sibling `analytics/` directory with a `.env` file containing Memgraph/Qdrant connection strings and optional Slack tokens.

## Architecture

### Main Process (`src/main/`)

The main process connects directly to Memgraph, reads Claude session files, manages agent lifecycles, and bridges to Slack.

| Module | Purpose |
|--------|---------|
| `index.ts` | App lifecycle, window creation, service startup/shutdown |
| `ipc.ts` | All `ipcMain.handle()` registrations, `wrapHandler` error boundary |
| `sessions.ts` | Discovers running Claude Code sessions via `~/.claude/sessions/*.json`, reads JSONL transcripts, analyzes session state (idle/working/waiting), sends messages via iTerm2 AppleScript |
| `cursor-sessions.ts` | Discovers Cursor agent processes via `ps`/`lsof`, parses `~/.cursor/projects/*/agent-transcripts/*.jsonl` transcripts, classifies session state (working/waiting/idle-prompt) |
| `agents.ts` | Loads agent configs from `agents/agent-types.yaml`, builds CLI args, manages agent-session persistence (`data/agent-sessions.json`) |
| `pods.ts` | Solver/Reviewer/Executor workflow engine -- deterministic state machine that chains three agents with feedback loops |
| `orchestrator.ts` | Task queue with priority routing, agent selection scoring, dispatch loop (10s), health monitor (30s), graceful shutdown |
| `slack-bridge.ts` | Per-project Slack channels via Socket Mode, bidirectional message routing, `!task` command parsing, orchestrator status updates |
| `graph.ts` | Memgraph queries -- pipeline summary, hot leads, territories, graph stats, lead search/detail |
| `health.ts` | Health checks for Memgraph, Qdrant, scheduler |
| `scheduler-bridge.ts` | Reads `analytics/data/scheduler-state.json` and `schedule.yaml` for job statuses |
| `veritas-service.ts` | Docker Compose control-plane for Veritas (status/start/stop/restart/logs helpers) |
| `vault.ts` | Full vault file manager -- list, read, write, create, rename, delete, search, tags, backlinks. Registers `vault://` protocol for images |
| `vault-graph.ts` | Builds in-memory link/tag graph from vault files for visualization |
| `search-index.ts` | MiniSearch-based full-text index over vault files |
| `file-watcher.ts` | Chokidar watcher on vault root, pushes `vault:file-changed` events to renderer |
| `pty.ts` | node-pty pseudo-terminals for embedded terminal in the dashboard |

### Preload (`src/preload/`)

`contextBridge.exposeInMainWorld` bindings. Everything goes through `window.api.*` and `window.pty.*`.

### Renderer (`src/renderer/src/`)

React 18 + Tailwind 3 SPA. No routing -- panel switching is managed by `App.tsx`.

**Panels** (`panels/`):

| Panel | Description |
|-------|-------------|
| `CommandCenter.tsx` | Default view -- Phaser office scene, agent cards with inline actions (send/approve/focus), quick-action bar, embedded terminal, pod launcher, orchestrator modal |
| `VaultPanel.tsx` | Full-featured markdown editor with file tree, tabs, wikilinks, frontmatter editor, outline, templates, search, graph view |
| `HealthPanel.tsx` | Service health dashboard |
| `SchedulerPanel.tsx` | Cron job status and history |
| `PipelinePanel.tsx` | Sales pipeline -- stages, leads, territories |
| `ActivityPanel.tsx` | Agent activity feed |
| `SessionsPanel.tsx` | Raw Claude session browser |
| `GraphPanel.tsx` | Vault knowledge graph visualization (react-force-graph-2d) |
| `SettingsPanel.tsx` | Appearance/theme controls and Veritas service controls |

**Components** (`components/`):

| Component | Description |
|-----------|-------------|
| `OrchestratorModal.tsx` | Task queue table + agent health cards, inline enqueue form |
| `PodModal.tsx` | Pod launcher (preset picker), status viewer, workflow list |
| `Terminal.tsx` | xterm.js embedded terminal connected to node-pty |
| `AgentAvatar.tsx` | Pixel-art avatar renderer for agents |
| `BriefingModal.tsx` | Daily briefing viewer |
| `CommandPalette.tsx` | Cmd+K command palette |
| `Toast.tsx` | Toast notification system |
| `StatusBadge.tsx` | Agent status indicator |
| `editor/` | CodeMirror 6 markdown editor with wikilink plugin, image/PDF widgets, daily notes, templates |
| `vault/` | File tree, search panel for vault browser |

**Game** (`game/`):

| File | Description |
|------|-------------|
| `OfficeScene.ts` | Phaser 3 office scene with agent sprites, desk assignments, animated status bubbles, room decorations (plants, art, bookshelf, rugs), per-state character animations, and warm wood-floor rendering |
| `OfficeGame.ts` | Phaser game bootstrap |
| `events.ts` | EventBus for game <-> React communication |

**Stores** (`stores/`):

| Store | Description |
|-------|-------------|
| `editor-store.ts` | Zustand store for open tabs, active file, editor state |
| `appearance-store.ts` | UI appearance preferences |
| `theme-store.ts` | Color theme management |
| `vault-index.ts` | Client-side vault file index |

### Agents (`agents/`)

| File | Description |
|------|-------------|
| `agent-types.yaml` | Agent definitions -- name, persona, skills, model, defaultRepos, desk position, autonomy level, pod role |
| `CLAUDE.md` | Shared team memory injected into all agent system prompts |
| `mcp-profiles/` | MCP server configurations per agent role (e.g. `qa-executor.json` with Playwright) |

### Data (`data/`)

Runtime state files (JSON). Not committed.

| File | Description |
|------|-------------|
| `agent-sessions.json` | Agent ID -> session/PID mapping |
| `task-queue.json` | Orchestrator task queue (persistent) |
| `pod-workflows.json` | Pod workflow state |
| `agent-stats.json` | Agent statistics |

## Key Systems

### Office Scene (Phaser 3)

The `OfficeScene.ts` renders a live pixel-art office where each agent sits at a workstation. Agents are auto-grouped into rooms by project.

**Agent sources**: Both Claude Code (`~/.claude/sessions/`) and Cursor IDE (`~/.cursor/projects/*/agent-transcripts/`) agents are discovered and displayed. Claude agents use character sprite 0; Cursor agents use character sprite 1.

**Status bubbles** -- each agent shows a thought bubble reflecting their current state:

| State | Icon | Color | Pose | Animation |
|-------|------|-------|------|-----------|
| Working (executing tools, actively processing) | ⚡ | Amber | Typing (INTERACT) | Gentle sway, soft bounce, slow lean |
| Waiting (tool-approval, question, accept-edits) | ? | Red | Idle (IDLE) | Scale pulse, side-to-side fidget |
| Plan mode | 📋 | Purple | Typing (INTERACT) | Same as working |
| Accept-edits mode | ✏️ | Blue | Idle (IDLE) | Same as waiting |
| Idle prompt (session open, no work) | ☕ | Brown | Sitting (SIT) | Slow breathing |
| No session | *(none)* | -- | Sitting (SIT) | Slow breathing |

**Room decorations**: Each room has a warm wood-plank floor, a center rug, potted plants in the corners, picture frames along the top wall, and a bookshelf on the left wall (in taller rooms). Workstations include a desk lamp with a light cone, a coffee mug with animated steam, and a monitor with a glow overlay.

### Agent Orchestration

The orchestrator (`src/main/orchestrator.ts`) provides centralized task management:

**Task lifecycle**: `queued` -> `assigned` -> `active` -> `completed` | `failed`

**Dispatch loop** (every 10s):
1. Pulls queued tasks sorted by priority (critical > high > normal > low), then by creation time
2. Scores each available agent against the task:
   - Skill match: 0-100 points (task `requiredSkills` vs agent `skills`)
   - Project affinity: +50 (agent's `defaultRepos` contains task project)
   - Preferred agent: +100 (explicit match)
   - Already idle: +30 (no launch cost)
   - Load penalty: -20 per active task already assigned
3. Dispatches to the highest-scoring available agent (launches if sleeping, reuses if idle)
4. Monitors active tasks -- marks completed when agent returns to idle prompt, re-queues on agent death

**Health monitor** (every 30s):
- Detects dead agent processes via `kill(pid, 0)`
- Cleans up stale session mappings
- Flags high memory usage (>2GB) and stuck tool approvals

**Task sources**:
- Dashboard: via `OrchestratorModal` -> `+ New Task`
- Slack: `!task Fix the login bug` / `!task priority:high agent:marcus Refactor the lead scorer`
- API: `enqueueTask()` from any main-process module

### Pod Workflows

Three-agent workflow engine (`src/main/pods.ts`):

1. **Solver** implements the task
2. **Reviewer** independently designs test criteria (does NOT see solver's code)
3. **Executor** runs the test plan against the implementation

If tests fail, the executor's feedback goes back to the solver for iteration (max 3 rounds). Results are appended to `agents/CLAUDE.md` as team knowledge.

**Headless backends (pods, GitHub pipeline, orchestrator execute/validate):** `runAgentHeadless` can use a **per-phase** comma-separated chain. If the first backend fails with a quota/rate-limit style message (or Ollama unreachable), the next backend runs automatically.

| Env | Phase |
|-----|--------|
| `PENNY_TASK_RUNNER` | Default single runner when no phase override is set (`claude`, `cursor-agent`, `opencode`). |
| `PENNY_TASK_RUNNER_PLAN` / `PENNY_TASK_RUNNER_PLANNING` | Planning (GitHub planner, orchestrator plan, pod self-eval). |
| `PENNY_TASK_RUNNER_EXECUTE` / `PENNY_TASK_RUNNER_EXECUTING` | Implementation / executor / self-fix. |
| `PENNY_TASK_RUNNER_VALIDATE` / `PENNY_TASK_RUNNER_VALIDATING` | Orchestrator validation; also used for pod **reviewer** unless `PENNY_TASK_RUNNER_REVIEW` is set. |
| `PENNY_TASK_RUNNER_REVIEW` / `PENNY_TASK_RUNNER_REVIEWING` | Pod reviewer only (overrides validate/plan fallback). |

Chain entries: `claude`, `cursor-agent`, `opencode`, `ollama` (or `local`). Example: `PENNY_TASK_RUNNER_PLAN=claude,cursor-agent` when Claude Code hits limits. **Ollama-compatible API** (orchestrator + headless `ollama` backend): set `PENNY_OLLAMA_BASE_URL` to your NemoClaw/OpenClaw tunnel or gateway base URL (Ollama-style `/api/tags` + `/api/generate`). Aliases: `PENNY_NEMOCLAW_OLLAMA_URL`, `PENNY_OPENCLAW_OLLAMA_URL`. Default base is `http://127.0.0.1:11434`. `PENNY_OLLAMA_MODEL` selects the model name (default `qwen3-coder:30b`). Optional `PENNY_OLLAMA_API_KEY` sends `Authorization: Bearer …` if your gateway requires it. Set `PENNY_TASK_RUNNER_RETRY_ANY_FAILURE=1` to always try the next backend on any error (debugging). Orchestrator tasks with `provider: ollama` still use this HTTP client for plan/validate (unchanged, but now respect the same base URL env vars).

### Eval Spot-Check Queue

Manual review queue for random agent output spot checks (`src/main/evals/judges/human-judge.ts`):

- Sampling source: recent orchestrator tasks with status `completed` or `failed`
- Automated score at sample time: `1.0` when status is `completed`, `0.0` when `failed` (for agreement vs human verdict)
- Recency policy: last 7 days by `completedAt`
- Uniqueness policy: a task can only be sampled once (by `taskId`)
- Persistence: JSON-backed queue at `data/spot-checks.json` with atomic writes
- Agreement policy: automated score `>= 0.5` maps to pass; human `partial` is treated as pass for binary agreement math
- Operational limits: file-backed queue, no pagination yet

### Slack Bridge

Per-project channels (`#sk-penny`, `#sk-medscrub`) via Socket Mode:

- Outbound: polls agent JSONL transcripts every 5s, posts new assistant messages to Slack
- Inbound: routes user messages to the correct agent (auto if single agent, `@mention` if multiple)
- Status: posts interaction state changes (tool approval, questions, completion)
- Tasks: `!task` prefix creates orchestrator tasks with status updates posted back as thread replies

### Vault Editor

Full-featured markdown editor in `VaultPanel.tsx`:

- CodeMirror 6 with custom wikilink plugin (`[[link]]` autocomplete + navigation)
- File tree with drag-and-drop
- Multi-tab editing with unsaved change tracking
- Frontmatter editor (YAML)
- Document outline panel
- Template inserter
- Full-text search (MiniSearch) and grep search
- Tag browser with backlink navigation
- Knowledge graph visualization
- Daily notes
- Image and PDF embedding via `vault://` protocol
- Live file watching (chokidar) for external changes

## Environment Variables

Set in `analytics/.env`:

| Variable | Required | Description |
|----------|----------|-------------|
| `MEMGRAPH_URI` | For graph features | Bolt URI (e.g. `bolt://localhost:7687`) |
| `MEMGRAPH_USER` | For graph features | Username |
| `MEMGRAPH_PASS` | For graph features | Password |
| `SLACK_BOT_TOKEN` | For Slack bridge | `xoxb-...` Bot User OAuth Token |
| `SLACK_APP_TOKEN` | For Slack bridge | `xapp-...` Socket Mode token |
| `SLACK_CHANNEL_PREFIX` | No (default: `sk`) | Channel name prefix |
| `SLACK_ARCHIVE_INACTIVE_CHANNELS` | No (default: `false`) | Auto-archive inactive project channels when all agents exit |

Optional Penny infra vars can be set in `Penny/docker/.env.control-plane`:

| Variable | Required | Description |
|----------|----------|-------------|
| `PENNY_VERITAS_COMPOSE_FILE` | No | Absolute path to compose file (defaults to `Penny/docker/compose.control-plane.yml`) |
| `PENNY_VERITAS_ENV_FILE` | No | Env file consumed by compose and Penny status/start/stop commands |
| `PENNY_VERITAS_SOURCE_DIR` | If building local image | Local checkout of `veritas-kanban` for Docker build context |
| `PENNY_VERITAS_PORT` | No (default: `47832`) | Host port bound to Veritas container port `3001` |
| `PENNY_VERITAS_API_URL` | No | URL used by MCP and status checks (default `http://127.0.0.1:47832/api`) |
| `PENNY_VERITAS_WEB_URL` | No | Browser URL opened from Settings (default `http://127.0.0.1:47832`) |
| `PENNY_VERITAS_ADMIN_KEY` | Yes for authenticated usage | Veritas admin key for the service |
| `PENNY_VERITAS_AGENT_KEY` | Recommended | Non-admin key used by MCP agents (`VK_API_KEY`) |
| `PENNY_SFX_DIR` | No | Absolute or relative folder for Soundboard mp3 discovery (default auto-detect, fallback `Penny/sound-effects`) |

## IPC API Reference

All IPC calls go through `window.api.*`. Each handler uses `wrapHandler` which catches errors and returns `{ error: string }`.

### Context-Engineered Handler Contract

The most frequently called orchestration handlers return a context-engineered envelope:

- `data` (original payload for backward compatibility)
- `summary` (single sentence)
- `suggestions` (state-aware next actions)
- `related_tools` (adjacent tools likely needed next)
- optional `context` (supporting state for better decisions)

For lead channels, `leads:*` remains canonical in renderer APIs and `graph:*` aliases are now registered for tooling parity:

- `graph:search-leads` -> `leads:search`
- `graph:lead-detail` -> `leads:detail`

<details>
<summary>Full API list</summary>

**Health & Scheduler**
- `getHealth()` -- service health checks
- `getSchedulerStatus()` -- cron job statuses
- `getSchedulerHistory(jobName?)` -- job run history
- `runJob(name)` -- force-run a scheduled job

**Pipeline & Leads**
- `getPipelineSummary()` -- sales stage summary
- `getHotLeads()` -- top-scoring leads
- `getTerritories()` -- territory breakdown
- `getNewLeads()` -- recently added leads
- `searchLeads(query)` -- search leads by name/company
- `getLeadDetail(name)` -- full lead profile
- `getGraphStats()` -- node/relationship counts

**Sessions**
- `getClaudeSessions()` -- all running Claude + Cursor sessions
- `getSessionConversation(sessionId, source?)` -- JSONL transcript as messages
- `sendToSession(tty, message)` -- type into agent terminal
- `focusSession(tty)` -- bring iTerm2 tab to front
- `createNewSession(cwd)` -- open new Claude session
- `broadcastToSessions(message)` -- send to all sessions
- `approveSession(tty, choice)` -- approve tool use (y/n/1/2/3)
- `approveAllSessions(choice)` -- approve all waiting sessions

**Agents**
- `getAgents()` -- agent config list
- `getAgentStatuses()` -- live agent states with session matching
- `launchAgent(agentId, cwd)` -- launch agent in iTerm2
- `focusAgent(agentId)` -- focus agent's iTerm2 tab

**Pods**
- `createPod(task, opts?)` -- launch solver/reviewer/executor workflow
- `listPods()` -- all workflows
- `getPodStatus(workflowId)` -- workflow detail
- `pausePod(workflowId)` / `resumePod(workflowId)` / `cancelPod(workflowId)`
- `getPodPresets()` -- available team presets

**Orchestrator**
- `orchestratorQueue()` -- all tasks
- `orchestratorEnqueue(title, description, project, priority)` -- create task
- `orchestratorCancelTask(taskId)` -- cancel a task
- `orchestratorRetryTask(taskId)` -- retry a failed task
- `orchestratorAgentHealth()` -- per-agent health status
- `orchestratorShutdownAgent(agentId)` -- graceful agent shutdown
- `orchestratorStats()` -- queue depth, active count, completed/failed today

**Vault**
- `vaultList(path)` / `vaultRead(path)` / `vaultWrite(path, content)` / `vaultCreate(path, content?)` / `vaultCreateFolder(path)` / `vaultRename(old, new)` / `vaultDelete(path)`
- `vaultSearch(query, glob?, limit?)` -- grep search
- `vaultSearchIndexed(query, limit?)` -- full-text search
- `vaultBuildSearchIndex()` -- rebuild search index
- `vaultTags()` / `vaultFilesByTag(tag)` / `vaultBacklinks(path)`
- `vaultIndex()` -- file listing with metadata
- `vaultGraphData(scope?, centerPath?)` -- link/tag graph
- `onVaultFileChanged(callback)` -- live file change events

**Slack**
- `slackStatus()` -- bridge running/configured state
- `slackStart()` / `slackStop()`

**Veritas**
- `veritasStatus()` -- Docker + compose + container/API health snapshot
- `veritasStart()` / `veritasStop()` / `veritasRestart()`
- `veritasLogs(tail?)` -- tail container logs (no-color)
- `veritasOpen()` -- open Veritas web URL in browser
- `veritasListTasks(status?)` -- list Veritas board tasks (summary view)
- `veritasTaskCounts()` -- status bucket counts from Veritas
- `veritasCreateTask(title, description?, project?, priority?)` -- create Veritas task
- `veritasUpdateTaskStatus(taskId, status)` -- patch task status (`todo`/`in-progress`/`blocked`/`done`)

**Other**
- `openDownloads()` -- open ~/Downloads in Finder
- `pickDirectory()` -- native directory picker dialog
- `focusCursorIDE()` -- bring Cursor to front

**Spot Checks**
- `evalsSpotCheckQueue()` -- fetch pending spot checks for manual review
- `evalsSpotCheckSample(count)` -- sample recent task outputs into queue
- `evalsSpotCheckReview(id, verdict, notes?)` -- submit human verdict (`pass`/`partial`/`fail`)
- `evalsSpotCheckAgreement()` -- compute human-vs-automated agreement metrics

</details>

## MCP Server

Penny exposes an MCP (Model Context Protocol) server so Claude sessions can programmatically discover and invoke Penny's capabilities. The MCP process is a standalone Node child (`tsx`); tool handlers import Penny main-process modules directly (same code paths as the Electron app), not a live IPC bridge into a running app window.

### Available Tools

Call **`meta:list-tools`** first for the live catalog. Registered groups mirror main IPC domains:

| Group | Tools |
|-------|--------|
| **meta** | `meta:list-tools`, `meta:describe-tool` |
| **orchestrator** | `orchestrator:enqueue`, `orchestrator:queue`, `orchestrator:agent-health` |
| **pods** | `pod:list`, `pod:status`, `pod:create` |
| **office** | `office:rooms`, `office:agents`, `office:leaderboard` |
| **vault** | `vault:read`, `vault:search`, `vault:write` |
| **graph** | `graph:search-leads`, `graph:lead-detail`, `graph:stats` |

### Start the Server

```bash
# from Penny/
npm run mcp:start

# from repo root
npm run --prefix Penny mcp:start
```

The server uses stdio transport — stdout is reserved for the MCP protocol; startup and errors log to stderr only.

### Environment

Tools that touch on-disk data or Veritas may read:

| Variable | Required | Notes |
|----------|----------|--------|
| `PENNY_DATA_DIR` | No | Data directory (e.g. `./data` under Penny when using profile configs) |
| `PENNY_VERITAS_API_URL` | No | Veritas API base (defaults and related keys are in **Environment Variables** above) |
| `PENNY_VERITAS_AGENT_KEY` | Recommended | Non-admin key for Veritas-backed operations |

### Connect Claude / Cursor

`config-reader.ts` loads project MCP servers from `<sidekick-root>/.mcp.json` and profile overlays from `Penny/agents/mcp-profiles/*.json`.

**Option A — npm from repo root** (cwd defaults to the project root):

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

**Option B — `npx tsx` with `cwd` on `Penny`** (matches agent profiles and many local setups):

```json
{
  "mcpServers": {
    "penny-mcp": {
      "command": "npx",
      "args": ["tsx", "src/mcp/index.ts"],
      "cwd": "Penny",
      "env": {
        "PENNY_DATA_DIR": "./data"
      }
    }
  }
}
```

Use paths relative to your sidekick repo root; expand `cwd` to an absolute path if your client does not resolve relative `cwd` the same way.

### Follow-ups (not in this server yet)

- **Resources** — `resources/list` and resource providers (capabilities are declared; handlers can be added later)
- **IPC-only bridge** — only if a tool must drive a single long-lived Electron main process that cannot share state with the MCP Node process

## macOS Notes

- `titleBarStyle: hiddenInset` with custom traffic light offset
- Agent terminal interaction via iTerm2 AppleScript (requires iTerm2)
- Session focus uses `AXRaise` for reliable window foregrounding on Ventura+
- Dock icon set programmatically in dev mode
