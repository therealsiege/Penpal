# Penpal

A self-orchestrating dispatch system for AI coding agents.

Penpal is an Electron desktop app that turns labeled GitHub issues into pull requests. A 3-agent pod (Solver → Reviewer → Executor) picks up an issue, works in an isolated git worktree, and pushes a PR. Built by [1Putt Health](https://1putthealth.com) as internal tooling — Penpal builds itself.

---

## What Penpal Does

### Dispatch Board

Label a GitHub issue `agent-ready`, walk away, come back to a PR.

- **GitHub issue poller** — watches configured repos for `agent-ready` labels (60s interval)
- **3-agent pod pipeline** — Solver implements → Reviewer validates independently → Executor tests
- **Workspace isolation** — each pod gets its own git worktree, so parallel pods can't conflict
- **Claim-based dispatch** — agents pull tasks from a priority queue (no double-assignment)
- **Heartbeat health** — stale agents auto-detected and their claimed tasks released back to the queue
- **Workspace GC** — 3-tier cleanup (soft-delete → archive → hard delete) keeps disk usage in check
- **Autopilot** — scheduled recurring tasks via cron expressions
- **Linear integration** — pulls Linear issues alongside GitHub

### Runtime Profiles

| Profile | Plan | Execute | Validate | Cost |
|---------|------|---------|----------|------|
| `max` | Opus | Opus | Sonnet | $$$ |
| `sonnet` | Sonnet | Sonnet | Sonnet | $$ |
| `economic` | ollama:qwen3-coder:30b | (same) | (same) | Free |

Per-issue override: label an issue with `economic`, `max`, or `sonnet`.

### Slack Integration

- Per-project channels — agent activity routed to its own channel
- DMs to the owner when an agent needs tool approval
- Fleet heartbeat — multiple Penpal instances discover each other via `#sk-fleet`

---

## Quick Start

```bash
npm install
npm run dev      # electron-vite dev with HMR
npm run build    # production build
npm run release  # bump version, tag, push (triggers CI release)
```

### Environment

Required tokens go in `.env` (gitignored):

```bash
GITHUB_PERSONAL_ACCESS_TOKEN=ghp_...
SLACK_BOT_TOKEN=xoxb-...        # optional — enables Slack bridge
SLACK_APP_TOKEN=xapp-...
SLACK_OWNER_USER_ID=U...
LINEAR_API_KEY=lin_api_...      # optional — enables Linear poller

# Optional — economic mode
PENNY_OLLAMA_BASE_URL=http://127.0.0.1:11434
PENNY_OLLAMA_MODEL=qwen3-coder:30b
```

### Adding Watched Repos

Settings → Sources → Add repository. Issues labeled `agent-ready` in those repos get queued.

The label must be applied **on GitHub** — Penpal polls for issues that already have it. The first time you add a repo, Penpal creates the `agent-ready` and `agent-working` labels if they don't exist, but you still have to apply them to the specific issues you want dispatched.

---

## Pod System

Pods are 3-agent teams. Each agent has a persona from *Journey to the West* — Sun Wukong, Guanyin, Sha Wujing, etc. — with a backstory and working style injected into its system prompt.

### The Pipeline

```
agent-ready label
    ↓
Complexity routing → picks Sonnet/Opus/economic profile
    ↓
Scoped context injection → task-aware CLAUDE.md filter
    ↓
Pattern matching → similar past successes injected into solver
    ↓
SOLVER (e.g. Sun Wukong) — implements in isolated worktree
    ↓
Governance check → max files, diff size, duration, secrets
    ↓
REVIEWER (e.g. Guanyin) — independent review (does not see solver code)
    ↓
EXECUTOR (e.g. Sha Wujing) — runs test plan, self-fix loop on failure
    ↓
Rebase → push → create PR → merge queue
    ↓
Reflection + pattern storage → feeds back into next pod
```

### Pod Presets

| Preset | Solver | Reviewer | Executor |
|--------|--------|----------|----------|
| `frontend-feature` | Erlang Shen | Ao Guang | Sha Wujing |
| `backend-feature` | Sun Wukong | Guanyin | Sha Wujing |
| `full-stack` | Sun Wukong | Guanyin | Sha Wujing |
| `content-pipeline` | Ao Run | Tripitaka | Zhu Bajie |

### Intelligence Modules

| Module | When |
|--------|------|
| `pod-complexity.ts` | Before pod starts — scores task, picks model tier |
| `pod-context.ts` | At worktree creation — builds task-specific CLAUDE.md |
| `reasoning-bank.ts` | Before solver (query) and after completion (store) |
| `pod-governance.ts` | After solver — checks file count, diff, duration, paths |
| `pod-reflection.ts` | After completion — efficiency rating, bottleneck detection |
| `merge-queue.ts` | After PR — sequential rebase → tsc → ff-merge → push |
| `workspace-isolation.ts` | At pod creation — isolated git worktree |
| `workspace-gc.ts` | Background — 3-tier cleanup |
| `autopilot.ts` | Background — enqueues scheduled recurring tasks |
| `dispatch-loop.ts` | Every 30s — heartbeat health check, stale agent reclaim |

### Governance Defaults

| Rule | Limit | Action |
|------|-------|--------|
| Max files modified | 12 | Warn |
| Max diff lines | 800 | Warn |
| Max duration | 30 min | Auto-pause |
| Forbidden paths | `.env`, `credentials`, `secrets`, `*.pem`, `*.key` | Fail |

Override via `~/.penpal/data/governance-rules.json`.

---

## Panels

| Panel | Purpose |
|-------|---------|
| **Dispatch** (default) | Unified GitHub + Linear issue board with phase columns, agent avatars, and pod controls |
| **Results** | Pod outcome history with diffs, logs, and PR links |
| **Profiles** | Runtime profile editor — model per phase, timeouts, iteration limits |
| **Evals** | Pod quality metrics, combo analytics, spot-check queue, weekly digests |
| **MCP** | MCP server configuration |
| **Replay** | Session replay viewer |
| **Settings** | Sources (GitHub repos + Linear teams), appearance, config snapshot |

---

## Architecture

### Main Process (`src/main/`)

| Module | Purpose |
|--------|---------|
| `pods.ts` | 3-agent workflow engine |
| `github-pipeline.ts` | `agent-ready` issues → worktree → pod → PR |
| `github-issues.ts` | Issue poller, watched repo management, card aggregation |
| `linear-poller.ts` | Linear issue poller (parallel to GitHub) |
| `dispatch-queue.ts` | Priority queue, claim/release pull model |
| `dispatch-loop.ts` | Heartbeat monitoring, stale agent detection |
| `workspace-isolation.ts` | Per-pod git worktree |
| `workspace-gc.ts` | 3-tier worktree garbage collection |
| `autopilot.ts` | Scheduled recurring tasks |
| `slack-bridge.ts` | Per-project channels, fleet heartbeat, DM alerts |
| `fleet-heartbeat.ts` | Multi-instance discovery via `#sk-fleet` |
| `agents.ts` | Agent configs from `agent-types.yaml`, headless backend chains |
| `health.ts` | Memgraph/Qdrant/Docker health checks (used by Slack `/health`) |
| `merge-queue.ts` | Sequential rebase → tsc → ff-merge → push pipeline |
| `flight-board.ts` | Active file claims for conflict detection |
| `reasoning-bank.ts` | Pattern storage for solver injection |

### Renderer (`src/renderer/src/`)

React 18 + Tailwind. No Phaser, no game scene. Panels render in a flat `Layout` switched via `App.tsx`.

### Agents (`agents/`)

| File | Purpose |
|------|---------|
| `agent-types.yaml` | Persona, skills, model, pod role, presets |
| `CLAUDE.md` | Shared team memory injected into all agent prompts |
| `mcp-profiles/` | Per-agent MCP server configs (e.g. `qa-executor.json` with Playwright) |

### Data (`~/.penpal/data/`)

Runtime state files (JSON, written to user home, not the repo):

| File | Purpose |
|------|---------|
| `pod-workflows.json` | Pod state — active + recent completed |
| `task-queue.json` | Orchestrator task queue |
| `flight-board.json` | Active file claims |
| `reasoning-bank.json` | Pod pattern history (max 200) |
| `merge-queue.json` | Merge queue state (last 50) |
| `github-watched-repos.json` | Configured GitHub repos |
| `github-pipeline.json` | Pipeline issue tracking |
| `autopilot.json` | Scheduled tasks config |
| `governance-rules.json` | Optional custom governance overrides |
| `workspaces/` | Per-pod isolated git worktrees |

Override location with `PENPAL_DATA_DIR=/some/path`.

---

## MCP Server

```bash
npm run mcp:start   # stdio transport
```

| Group | Tools |
|-------|-------|
| `meta` | `meta:list-tools`, `meta:describe-tool` |
| `orchestrator` | `orchestrator:enqueue`, `orchestrator:queue`, `orchestrator:agent-health` |
| `pods` | `pod:list`, `pod:status`, `pod:create` |

Connect via `.mcp.json`:

```json
{
  "mcpServers": {
    "penny-mcp": {
      "command": "npm",
      "args": ["run", "--prefix", "Penpal", "mcp:start"]
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
| Editor | CodeMirror 6 (used in profiles + replay) |
| Terminal | xterm.js + node-pty |
| Slack | @slack/bolt 4 (Socket Mode) |
| Health | neo4j-driver (Memgraph probe), Qdrant probe |
| Language | TypeScript 5.7 |
| Testing | Vitest, Playwright |

## Scripts

```bash
npm run dev       # electron-vite dev with HMR
npm run build     # production build
npm run test      # vitest unit tests
npm run mcp:start # start MCP server
npm run pod:create -- --task "..." --preset frontend-feature
npm run typecheck # tsc --noEmit
npm run package   # electron-forge package
npm run make      # electron-forge make (distributable)
npm run release   # bump version, tag, push (triggers CI release build)
```

## macOS Notes

- `titleBarStyle: hiddenInset` with custom traffic light offset
- Auto-updater via electron-updater pulling from GitHub Releases
- Spawn proxy forks a clean Node worker before Electron's renderer corrupts the parent fd table
