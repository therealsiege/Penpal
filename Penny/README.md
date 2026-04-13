# Penpal

AI Operating System — a desktop command center for orchestrating AI coding agents. Built with Electron, React, Phaser 3, and Tailwind.

## Quick Start

```bash
npm install
npm run dev       # electron-vite dev (hot reload)
npm run build     # production build to out/
```

Requires a sibling `analytics/` directory with a `.env` file containing Memgraph/Qdrant connection strings. Secrets (Slack tokens, GitHub PAT, etc.) go in `Penny/.env` (gitignored). Shared non-secret config lives in `.env.shared` (committed).

## Architecture

### Main Process (`src/main/`)

The main process connects to Memgraph, discovers Claude/Cursor/OpenCode sessions, manages pod workflows, bridges to Slack for fleet heartbeat, and runs the GitHub issue pipeline.

| Module | Purpose |
|--------|---------|
| `index.ts` | App lifecycle, window creation, service startup/shutdown |
| `ipc.ts` | All `ipcMain.handle()` registrations, `wrapHandler` error boundary |
| `sessions.ts` | Discovers Claude Code sessions via `~/.claude/sessions/*.json`, reads JSONL transcripts, analyzes session state (idle/working/waiting), sends messages via iTerm2 AppleScript |
| `cursor-sessions.ts` | Discovers Cursor agent processes via `ps`/`lsof`, parses transcript JSONL |
| `opencode-sessions.ts` | Discovers OpenCode (Ollama) sessions |
| `agents.ts` | Loads agent configs from `agents/agent-types.yaml`, builds CLI args, manages agent-session persistence |
| `pods.ts` | Solver/Reviewer/Executor workflow engine -- deterministic state machine, runtime profiles, issue tracking |
| `orchestrator.ts` | Task queue with priority routing, agent selection scoring, dispatch loop, health monitor |
| `github-pipeline.ts` | Issues labeled `agent-ready` routed through pod workflow in isolated worktrees, auto-PR on completion |
| `github-issues.ts` | GitHub issue poller, watched repo management, issue card aggregation |
| `slack-bridge.ts` | Per-project Slack channels via Socket Mode, bidirectional message routing, `!task` command parsing |
| `fleet-heartbeat.ts` | Multi-instance discovery via Slack `#sk-fleet` channel, IP geolocation, 60s heartbeat cycle |
| `graph.ts` | Memgraph queries -- pipeline summary, hot leads, territories, graph stats |
| `health.ts` | Health checks for Memgraph, Qdrant, scheduler |
| `scheduler-bridge.ts` | Reads scheduler state and `schedule.yaml` for job statuses |
| `vault.ts` | Full vault file manager -- list, read, write, create, rename, delete, search, tags, backlinks. Registers `vault://` protocol for images |
| `vault-graph.ts` | Builds in-memory link/tag graph from vault files |
| `search-index.ts` | MiniSearch full-text index over vault files |
| `file-watcher.ts` | Chokidar watcher on vault root, pushes file change events to renderer |
| `flight-board.ts` | Tracks files currently being edited by agents |
| `pty.ts` | node-pty pseudo-terminals for embedded terminal |
| `config-reader.ts` | Loads MCP server configs from `.mcp.json` and agent profile overlays |
| `ollama-client.ts` | Ollama HTTP client for local model access |
| `evals.ts` | Eval reporting, harness, pod quality, context health |

### Preload (`src/preload/`)

`contextBridge.exposeInMainWorld` bindings. Everything goes through `window.api.*` and `window.pty.*`.

### Renderer (`src/renderer/src/`)

React 18 + Tailwind 3 SPA. No routing -- panel switching is managed by `App.tsx`.

**Panels** (`panels/`):

| Panel | Description |
|-------|-------------|
| `CommandCenter.tsx` | Default view -- Phaser world map (CampusScene) with fleet pins + isometric lab (OfficeScene) with agent visualization, status bar, quick actions, embedded terminal |
| `ProfilesPanel.tsx` | Pod runtime profile editor -- visual Plan/Execute/Validate pipeline, model dropdowns, timeout/iteration knobs, default profile selection |
| `DataPanel.tsx` | Data exploration and graph queries |
| `VaultPanel.tsx` | Full-featured markdown editor with file tree, tabs, wikilinks, frontmatter editor, outline, templates, search, graph view |
| `EvalsPanel.tsx` | Agent evaluation dashboard -- task outcomes, pod quality, spot-check queue, weekly digests |
| `SoundboardPanel.tsx` | Sound effect browser and playback |
| `SettingsPanel.tsx` | Appearance/theme controls, GitHub repo management, config snapshot |
| `GitHubPanel.tsx` | GitHub issue browser and pipeline status |
| `ActivityPanel.tsx` | Agent activity feed |
| `GraphPanel.tsx` | Vault knowledge graph visualization (react-force-graph-2d) |
| `HandbookPanel.tsx` | Team handbook and documentation browser |
| `PipelinePanel.tsx` | Sales pipeline view (Memgraph-backed) |

**Components** (`components/`):

| Component | Description |
|-----------|-------------|
| `OrchestratorModal.tsx` | Dispatch board -- unified GitHub issue + pod workflow board with phase columns (Planning/Executing/Validating/Done/Failed), agent avatars, expand for pod detail, pause/resume/cancel controls |
| `PodModal.tsx` | Pod launcher (preset picker), status viewer, workflow list |
| `PodAgentModal.tsx` | Detailed pod agent view with persona info |
| `SourcesModal.tsx` | GitHub poll status and watched repo management |
| `Terminal.tsx` | xterm.js embedded terminal connected to node-pty |
| `AgentAvatar.tsx` | Pixel-art avatar renderer for agents |
| `BriefingModal.tsx` | Daily briefing viewer |
| `CommandPalette.tsx` | Cmd+K command palette |
| `Toast.tsx` | Toast notification system |
| `StatusBadge.tsx` | Agent status indicator |
| `Layout.tsx` | App shell with sidebar navigation and status bar |
| `editor/` | CodeMirror 6 markdown editor with wikilink plugin, image/PDF widgets, daily notes, templates |
| `vault/` | File tree, search panel for vault browser |

**Game** (`game/`):

80 files, ~20,000+ lines total. Key scenes and modules:

| File | Description |
|------|-------------|
| `CampusScene.ts` | World map with fleet instance pins -- illustrated map backdrop (3840x2160), sprite marker pins, IP geolocation coordinate projection, double-click to enter lab |
| `OfficeScene.ts` | Isometric lab orchestrator (~4700 lines). Agent sync, camera, update loop, delegates to 18+ modules |
| `OfficeGame.ts` | Phaser game bootstrap |
| `events.ts` | EventBus singleton for game-to-React communication |
| `workstation-*.ts` | Agent desk creation, animation, idle micro-variety, mood, status bubbles |
| `office-background.ts` | Team area rendering, terrain, corridors, interior |
| `office-rooms.ts` | Room creation, doors, headers, animated resize |
| `office-pods.ts` | Pod connecting lines, agent-to-agent chat dot animations |
| `office-ui.ts` | Notification toasts, hover tooltips, debug overlay, status bar |
| `office-atmosphere.ts` | Day/night cycle, sky gradient, starfield, clouds, shadows |
| `office-camera.ts` | Camera management, zoom-to-fit, follow target, drag handling |
| `celebrations.ts` | Rank-up, task-complete, milestone, error effects |
| `penny-cafe.ts` | Cafe area with coffee run animations, social interactions |
| `quest-system.ts` | Quest auto-wrapper with difficulty inference and XP/credit multipliers |
| `seasons.ts` | 30-day seasonal arcs with themed challenges |
| `leaderboard.ts` | Season XP rankings, weekly MVP, rivalry detection |

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
| `agent-types.yaml` | Agent definitions -- name, persona, skills, model, defaultRepos, desk position, autonomy level, pod role, pod presets |
| `CLAUDE.md` | Shared team memory injected into all agent system prompts |
| `mcp-profiles/` | MCP server configurations per agent role (e.g. `qa-executor.json` with Playwright) |

### Data (`data/`)

Runtime state files (JSON). Not committed.

| File | Description |
|------|-------------|
| `agent-sessions.json` | Agent ID -> session/PID mapping |
| `task-queue.json` | Orchestrator task queue (persistent) |
| `pod-workflows.json` | Pod workflow state |
| `pod-profiles.json` | Custom runtime profiles |
| `agent-stats.json` | Agent statistics |
| `spot-checks.json` | Eval spot-check queue |

## Key Systems

### World Map (CampusScene)

The `CampusScene` renders an illustrated world map (3840x2160) showing all Penpal instances in the fleet as sprite marker pins.

**Pin types**:
- Local instance: red marker, always clickable, double-click to enter the lab
- Remote instances: blue pins from fleet heartbeat data
- Stale instances (no heartbeat >120s): gray pins

**Coordinate projection**: Anchor-based system calibrated to the illustrated map. Nashville is the anchor point; lat/lon offsets are converted to pixel positions using per-degree scaling factors.

**Interaction**: Single click zooms to pin. Double-click on local pin transitions to the OfficeScene (lab view). Hover shows username label tooltip.

### Fleet Heartbeat

Multi-instance discovery system using Slack as the transport layer:

- Each Penpal instance posts a structured heartbeat to `#sk-fleet` every 60 seconds
- Heartbeat includes: hostname, active sessions, pod count, health status, IP geolocation (lat/lon/city)
- Messages are updated in-place via `chat.update` to keep the channel clean
- Status bar shows a Fleet pill with online/total instance count
- Instances are considered stale after 120 seconds without a heartbeat

### Dispatch (OrchestratorModal)

Single unified board for GitHub issues and pod workflows. No tabs -- issues and pods are rendered as the same card type in phase columns:

**Columns**: Planning -> Executing -> Validating -> Done -> Failed

Each card shows:
- Issue title, repo badge, age
- Active agent avatar (persona artwork from Journey to the West theme)
- Team strip showing solver/reviewer/executor assignments

Expand a card for pod detail:
- Team grid with persona avatars and role badges (S/R/E)
- Phase config and iteration count
- Controls: pause, resume, cancel with error toasts

### Pod Workflows

Three-agent workflow engine (`src/main/pods.ts`):

1. **Solver** implements the task
2. **Reviewer** independently validates (does NOT see solver's code). Rejects on parse failure -- no silent auto-approve
3. **Executor** runs the test plan against the implementation

If tests fail, feedback goes back to the solver for iteration (max configurable rounds). Results are appended to `agents/CLAUDE.md` as team knowledge.

**Runtime Profiles**: Configure model + timeout + iterations per phase:

| Profile | Plan | Execute | Validate | Timeout | Notes |
|---------|------|---------|----------|---------|-------|
| `max` | Opus | Opus | Sonnet | 1x | Full quality, cloud models |
| `sonnet` | Sonnet | Sonnet | Sonnet | 1x | Balanced cost/quality |
| `economic` | `ollama:qwen3-coder:30b` | `ollama:qwen3-coder:30b` | `ollama:qwen3-coder:30b` | 8x | Local Ollama via OpenCode CLI, 5 iterations, 3 self-fixes |

Profiles are managed in the Profiles panel. Set a default -- all new pods use it. Custom profiles saved to `data/pod-profiles.json`.

**Issue tracking**: Pods store `issueNumber` and `issueRepo` for explicit matching between GitHub issues and Dispatch board cards.

### Profiles Panel

Visual runtime profile editor:

- Pipeline visualization: Plan -> Execute -> Validate nodes with model dropdown per phase
- Model options: `opus`, `sonnet`, `haiku`, `ollama:qwen3-coder:30b`
- Quality knobs: `maxIterations`, `maxSelfFixes`, `timeoutMultiplier` per profile
- Built-in profiles (`max`, `economic`, `sonnet`) loaded from YAML -- cannot be deleted
- Custom profiles saved to `data/pod-profiles.json`
- Set default profile -- all new pods inherit it

### GitHub Issue Pipeline

Automated issue-to-PR workflow (`src/main/github-pipeline.ts`, `github-issues.ts`):

1. Issues labeled `agent-ready` are picked up by the poller
2. Labels `economic`, `max`, or `sonnet` select the runtime profile
3. An isolated Git worktree is created for the issue branch
4. `opencode.json` is copied to the worktree for Ollama provider access
5. A pod is spawned (Solver -> Reviewer -> Executor) in the worktree
6. On completion: branch is pushed, PR is created, issue is labeled `pr-ready`
7. On failure: issue is labeled `agent-failed` with error comment

`issueNumber` and `issueRepo` are tracked on the pod for Dispatch board matching. Branch and worktree creation run in the Electron main process via `child_process`, not inside the agent.

### Agent Orchestration

The orchestrator (`src/main/orchestrator.ts`) provides centralized task management:

**Task lifecycle**: `queued` -> `assigned` -> `active` -> `completed` | `failed`

**Dispatch loop** (every 10s):
1. Pulls queued tasks sorted by priority (critical > high > normal > low), then by creation time
2. Scores each available agent against the task (skill match, project affinity, idle bonus, load penalty)
3. Dispatches to the highest-scoring available agent
4. Monitors active tasks -- marks completed when agent returns to idle, re-queues on agent death

**Health monitor** (every 30s):
- Detects dead agent processes
- Cleans up stale session mappings
- Flags high memory usage and stuck tool approvals

**Headless backends**: `runAgentHeadless` supports per-phase comma-separated backend chains. If the first backend fails with quota/rate-limit, the next backend runs automatically.

| Env | Phase |
|-----|-------|
| `PENNY_TASK_RUNNER` | Default single runner (`claude`, `cursor-agent`, `opencode`) |
| `PENNY_TASK_RUNNER_PLAN` | Planning phase |
| `PENNY_TASK_RUNNER_EXECUTE` | Implementation / executor / self-fix |
| `PENNY_TASK_RUNNER_VALIDATE` | Validation; also used for pod reviewer unless `PENNY_TASK_RUNNER_REVIEW` is set |
| `PENNY_TASK_RUNNER_REVIEW` | Pod reviewer only |

### Office Scene (Phaser 3)

The `OfficeScene.ts` renders a live isometric lab where each agent sits at a workstation. Agents are auto-grouped into rooms by project.

**Agent sources**: Claude Code, Cursor IDE, and OpenCode sessions are all discovered and displayed. Headless orchestrator tasks and pipeline issues appear as synthetic agents.

**Status bubbles** -- each agent shows a thought bubble reflecting their current state:

| State | Icon | Color | Pose |
|-------|------|-------|------|
| Working | lightning | Amber | Typing |
| Waiting (approval/question) | ? | Red | Idle |
| Plan mode | clipboard | Purple | Typing |
| Accept-edits | pencil | Blue | Idle |
| Idle prompt | coffee | Brown | Sitting |

**Game systems**: Quest auto-wrapper, cosmetic tiers (rank-gated desk items), XP leaderboard, 30-day seasons with themed challenges, credits economy for cosmetic purchases.

### Eval Spot-Check Queue

Manual review queue for random agent output spot checks:

- Samples recent orchestrator tasks (last 7 days)
- Automated score at sample time: `1.0` completed, `0.0` failed
- Human verdicts: pass/partial/fail with agreement metrics
- Persistence: `data/spot-checks.json`

### Slack Bridge

Per-project channels (`#sk-penny`, etc.) via Socket Mode:

- Outbound: polls agent JSONL transcripts every 5s, posts new assistant messages
- Inbound: routes user messages to correct agent (auto if single, `@mention` if multiple)
- Tasks: `!task` prefix creates orchestrator tasks with status updates as thread replies
- Fleet: `#sk-fleet` channel used for heartbeat-based instance discovery

### Vault Editor

Full-featured markdown editor in `VaultPanel.tsx`:

- CodeMirror 6 with custom wikilink plugin (`[[link]]` autocomplete + navigation)
- File tree with drag-and-drop, multi-tab editing
- Frontmatter editor (YAML), document outline, template inserter
- Full-text search (MiniSearch) and grep search
- Tag browser with backlink navigation
- Knowledge graph visualization
- Daily notes, image/PDF embedding via `vault://` protocol
- Live file watching (chokidar) for external changes

## Environment Variables

Shared config in `.env.shared` (committed). Secrets in `Penny/.env` (gitignored). Graph connection in `analytics/.env`.

| Variable | Required | Description |
|----------|----------|-------------|
| `MEMGRAPH_URI` | For graph features | Bolt URI (e.g. `bolt://localhost:7687`) |
| `MEMGRAPH_USER` | For graph features | Username |
| `MEMGRAPH_PASS` | For graph features | Password |
| `SLACK_BOT_TOKEN` | For Slack bridge + fleet | `xoxb-...` Bot User OAuth Token |
| `SLACK_APP_TOKEN` | For Slack bridge + fleet | `xapp-...` Socket Mode token |
| `SLACK_CHANNEL_PREFIX` | No (default: `sk`) | Channel name prefix |
| `GITHUB_TOKEN` | For issue pipeline | GitHub PAT with repo scope |
| `PENNY_TASK_RUNNER` | No | Default headless backend (`claude`, `cursor-agent`, `opencode`) |
| `PENNY_OLLAMA_BASE_URL` | No | Ollama API base URL (default `http://127.0.0.1:11434`) |
| `PENNY_OLLAMA_MODEL` | No | Ollama model name (default `qwen3-coder:30b`) |
| `PENNY_SFX_DIR` | No | Soundboard mp3 discovery folder |

`opencode.json` (committed) configures the Ollama provider for OpenCode CLI, used by economic-mode pods.

## IPC API Reference

All IPC calls go through `window.api.*`. Each handler uses `wrapHandler` which catches errors and returns `{ error: string }`.

### Context-Engineered Handler Contract

The most frequently called orchestration handlers return a context-engineered envelope:

- `data` (original payload for backward compatibility)
- `summary` (single sentence)
- `suggestions` (state-aware next actions)
- `related_tools` (adjacent tools likely needed next)
- optional `context` (supporting state for better decisions)

<details>
<summary>Full API list</summary>

**Health & Scheduler**
- `getHealth()` -- service health checks
- `getSchedulerStatus()` -- cron job statuses
- `getSchedulerHistory(jobName?)` -- job run history
- `runJob(name)` -- force-run a scheduled job

**Sessions**
- `getClaudeSessions()` -- all running Claude + Cursor + OpenCode sessions
- `getSessionConversation(sessionId, source?)` -- JSONL transcript as messages
- `sendToSession(tty, message)` -- type into agent terminal
- `focusSession(tty)` -- bring iTerm2 tab to front
- `createNewSession(cwd)` -- open new Claude session
- `broadcastToSessions(message)` -- send to all sessions
- `approveSession(tty, choice)` -- approve tool use (y/n/1/2/3)
- `approveAllSessions(choice)` -- approve all waiting sessions
- `getITermStatus()` -- iTerm2 availability check
- `pruneStaleSessions(maxIdleMinutes?)` -- kill stale sessions

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
- `overridePod(workflowId, phase, override)` -- override pod phase config
- `getPodPresets()` -- available team presets

**Pod Profiles**
- `podProfiles()` -- all profiles with default
- `podSaveProfile(name, profile)` -- create/update profile
- `podDeleteProfile(name)` -- delete custom profile
- `podSetDefaultProfile(name)` -- set default for new pods

**Orchestrator**
- `orchestratorQueue()` -- all tasks
- `orchestratorEnqueue(title, description, project, priority, provider?)` -- create task
- `orchestratorCancelTask(taskId)` -- cancel a task
- `orchestratorRetryTask(taskId)` -- retry a failed task
- `orchestratorAgentHealth()` -- per-agent health status
- `orchestratorShutdownAgent(agentId)` -- graceful agent shutdown
- `orchestratorStats()` -- queue depth, active count, completed/failed today
- `orchestratorXP()` -- all agent XP
- `orchestratorCredits()` -- all agent credits
- `orchestratorPrune()` -- prune terminal tasks from queue
- `orchestratorSetProvider(provider)` -- set model provider (claude/ollama)
- `orchestratorGetProvider()` -- current provider + Ollama availability

**GitHub**
- `githubStatus()` -- issue poller status
- `githubPollNow()` -- force poll
- `githubSeen()` -- seen issue cache
- `githubCards()` -- aggregated issue cards for Dispatch board
- `githubConsolidate()` -- consolidate tracked issues
- `githubAddRepo(owner, repo, localPath)` -- add watched repo
- `githubRemoveRepo(owner, repo)` -- remove watched repo
- `githubListRepos()` -- list watched repos

**Fleet**
- `fleetStatus()` -- all fleet instances with heartbeat data

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

**Evals**
- `evalsReportAll()` -- all eval results
- `evalsReportAgent(agentId)` -- per-agent eval report
- `evalsStats()` -- summary statistics
- `evalsHarnessReportAll(since?)` / `evalsHarnessReportAgent(agentId, since?)` -- harness reports
- `evalsWeeklyDigest(weekOverride?)` -- generate weekly digest
- `evalsPodQuality(since?)` -- pod quality metrics
- `evalsContextHealth()` / `evalsContextHealthAgent(agentId)` -- context usage
- `evalsSpotCheckQueue()` -- pending spot checks
- `evalsSpotCheckSample(count)` -- sample tasks into queue
- `evalsSpotCheckReview(id, verdict, notes?)` -- submit human verdict
- `evalsSpotCheckAgreement()` -- human-vs-automated agreement

**Flight Board**
- `flightBoardList()` -- active entries
- `flightBoardFilesInFlight()` -- files currently being edited

**Config**
- `configSnapshot()` -- full config state
- `configAddProjectMcp(server)` / `configRemoveProjectMcp(name)` -- project MCP servers
- `configAddProfileMcp(profile, server)` / `configRemoveProfileMcp(profile, name)` -- profile MCP servers
- `configUpdateAgentTools(agentId, tools)` -- update agent tool allowlist

**Other**
- `openDownloads()` -- open ~/Downloads in Finder
- `pickDirectory()` -- native directory picker dialog
- `focusCursorIDE()` -- bring Cursor to front
- `openUrl(url)` -- open HTTPS URL in browser
- `getSystemPaths()` -- system path info
- `getSoundboardClips()` -- list available sound effects
- `getCapabilitiesStatus()` -- aggregated capabilities snapshot

</details>

## MCP Server

Penpal exposes an MCP (Model Context Protocol) server so Claude sessions can programmatically discover and invoke Penpal's capabilities. The MCP process is a standalone Node child (`tsx`); tool handlers import main-process modules directly (same code paths as the Electron app).

### Available Tools

Call **`meta:list-tools`** first for the live catalog. Registered groups:

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

The server uses stdio transport -- stdout is reserved for the MCP protocol; startup and errors log to stderr only.

### Connect Claude / Cursor

`config-reader.ts` loads project MCP servers from `<sidekick-root>/.mcp.json` and profile overlays from `Penny/agents/mcp-profiles/*.json`.

**Option A -- npm from repo root**:

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

**Option B -- `npx tsx` with `cwd` on `Penny`**:

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
| Testing | Vitest (unit), Playwright (E2E + visual) |

## Scripts

```bash
npm run dev              # electron-vite dev with HMR
npm run build            # production build
npm run sprites:all      # rebuild all sprite sheets (9 scripts)
npm run test             # vitest unit tests
npm run test:e2e         # playwright E2E tests
npm run test:visual      # visual regression tests
npm run mcp:start        # start MCP server
npm run pod:create       # CLI pod launcher
npm run typecheck        # tsc --noEmit
npm run package          # electron-forge package
npm run make             # electron-forge make (distributable)
```

## macOS Notes

- `titleBarStyle: hiddenInset` with custom traffic light offset
- Agent terminal interaction via iTerm2 AppleScript (requires iTerm2)
- Session focus uses `AXRaise` for reliable window foregrounding on Ventura+
- Dock icon set programmatically in dev mode
