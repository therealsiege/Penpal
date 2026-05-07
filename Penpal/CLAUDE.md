# Penpal

Electron desktop app that turns GitHub issues labeled `agent-ready` into pull requests via a 3-agent pod pipeline (Solver → Reviewer → Executor). Each pod runs in an isolated git worktree.

## Stack

Electron 33, electron-vite 5, React 18, Tailwind 3, TypeScript 5.7, Zustand, xterm.js, node-pty.

## Directory Structure

```
src/main/          — Electron main process: IPC handlers, pod engine, GitHub poller, Slack bridge
src/preload/       — contextBridge IPC exposure (index.ts)
src/renderer/src/  — React UI
  App.tsx          — Panel routing (dispatch, results, profiles, evals, settings, mcp, replay)
  components/      — OrchestratorModal (dispatch board), SettingsPanel, ResultsPanel, etc.
  types.ts         — Shared renderer types
agents/            — Agent configs (agent-types.yaml, CLAUDE.md, mcp-profiles/)
```

## Key Main-Process Modules

| File | Purpose |
|------|---------|
| `pods.ts` | 3-agent workflow engine (Solver→Reviewer→Executor state machine) |
| `github-pipeline.ts` | `agent-ready` issues → worktree → pod → PR |
| `github-issues.ts` | Issue poller, watched repo management |
| `dispatch-queue.ts` | Priority queue, claim/release |
| `dispatch-loop.ts` | Dispatch loop, agent spawn |
| `workspace-isolation.ts` | Per-pod git worktree |
| `slack-bridge.ts` | Per-project channels, DM alerts |
| `merge-queue.ts` | Sequential rebase → tsc → ff-merge → push |
| `agents.ts` | Agent configs from `agent-types.yaml` |
| `reasoning-bank.ts` | Pattern storage for solver injection |
| `pod-governance.ts` | File count, diff size, duration, forbidden-path checks |

## IPC Pattern

All main→renderer IPC goes through `ipc.ts`. `wrapHandler` catches thrown errors and returns `{ error: string }` instead of rejecting — renderer code must check `result?.error` rather than relying on catch.

## Data Directory

Runtime state lives in `~/.penpal/data/` (override with `PENPAL_DATA_DIR`). Not in the repo. Key files: `pod-workflows.json`, `task-queue.json`, `github-watched-repos.json`, `github-pipeline.json`, `reasoning-bank.json`.

## Development

```bash
npm run dev        # electron-vite dev with HMR — use this to run pods
npm run build      # production build
npm run typecheck  # tsc --noEmit
npm run test       # vitest
npm run release    # bump version, tag, push
```

## Agent Personas

Agents use *Journey to the West* personas (Sun Wukong, Guanyin, Sha Wujing, etc.) injected via `agents/CLAUDE.md` and `agent-types.yaml`. Each persona has a backstory, working style, and catchphrase.

## Conventions

- Tilde paths (`~/...`) must be expanded with `os.homedir()` before `path.isAbsolute()` checks.
- Agent `cwd` must always be an absolute path.
- Worktrees land in `~/.penpal/data/workspaces/`.
- `wrapHandler` returns `{ error }` on failure — always check before assuming success.
