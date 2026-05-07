# Penpal

A self-orchestrating dispatch system for AI coding agents.

Penpal is an Electron desktop app that turns labeled GitHub issues into pull requests. A 3-agent pod (Solver → Reviewer → Executor) picks up an issue, works in an isolated git worktree, and pushes a PR. Built by [1Putt Health](https://1putthealth.com) as internal tooling — Penpal builds itself.

> **Status:** end-to-end pod runs are verified with `npm run dev`. The packaged `.app` boots and shows the dispatch board, but full pipeline runs in the packaged build aren't routinely tested. Use `npm run dev` if you want to actually run pods.

---

## What Penpal Does

### Dispatch Board

Label a GitHub issue `agent-ready`, walk away, come back to a PR.

- **GitHub issue poller** — watches configured repos for `agent-ready` labels (60s interval)
- **3-agent pod pipeline** — Solver implements → Reviewer validates independently → Executor tests
- **Workspace isolation** — each pod gets its own git worktree, so parallel pods can't conflict
- **Claim-based dispatch** — agents pull tasks from a priority queue (no double-assignment)

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

---

## Quick Start

```bash
npm install
npm run dev      # electron-vite dev with HMR — recommended for actually running pods
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
| **Dispatch** (default) | GitHub issue board with phase columns, agent avatars, pod controls |
| **Profiles** | Runtime profile editor — model per phase, timeouts, iteration limits |
| **Settings** | Sources (GitHub repos), appearance, config snapshot |
| **MCP** | MCP server configuration |
| **Results** | Pod outcome history with diffs, logs, PR links |
| **Evals** | Pod quality metrics, combo analytics, spot-check queue |
| **Replay** | Session replay viewer |

---

## Stack

| Layer | Technology |
|-------|-----------|
| Shell | Electron 33, electron-vite 5 |
| UI | React 18, Tailwind 3, Zustand |
| Language | TypeScript 5.7 |
| Testing | Vitest, Playwright |
