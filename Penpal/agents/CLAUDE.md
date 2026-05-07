# Penpal Team Memory

This file is injected into every agent's system prompt. Keep it concise and actionable.

## What We're Building

Penpal is an Electron app that runs 3-agent pods (Solver → Reviewer → Executor) to turn GitHub issues into pull requests. Each pod works in an isolated git worktree. Built by 1Putt Health as internal tooling.

## Tech Stack

TypeScript 5.7, Electron 33, React 18, Tailwind 3, electron-vite 5, Zustand, Vitest.

## Key Conventions

- **IPC errors**: `wrapHandler` in `ipc.ts` returns `{ error: string }` on failure — never rejects. Always check `result?.error`.
- **Paths**: expand `~` with `os.homedir()` before any `path.isAbsolute()` check. Store resolved absolute paths.
- **Data dir**: `~/.penpal/data/` at runtime (via `getDataDir()`). Not `Penpal/data/`.
- **Worktrees**: isolated per pod under `~/.penpal/data/workspaces/`.
- **No game code**: the Phaser game layer is not present in the current codebase.

## Agent Roles

- **Solver**: implements the feature in an isolated worktree. Works alone, does not coordinate with Reviewer.
- **Reviewer**: validates the implementation independently — does not see Solver's output before forming an opinion.
- **Executor**: runs tests, self-fix loop on failure, then rebases and pushes the PR.

## Recent Pod Outcomes































































































































































































































### Workflow: task (2026-05-07)
- Task: task
- Team: fullstack-dev / backend-arch / electron-dev
- Result: PASS (1/2 iterations)
- Self-fix attempts: 1
- Key output: RESULT: PASS

### Workflow: task (2026-05-07)
- Task: task
- Team: fullstack-dev / backend-arch / electron-dev
- Result: PASS (2/2 iterations)
- Key output: RESULT: PASS

### Workflow: task (2026-05-07)
- Task: task
- Team: fullstack-dev / backend-arch / electron-dev
- Result: PASS (2/2 iterations)
- Key output: RESULT: PASS

### Workflow: task (2026-05-07)
- Task: task
- Team: fullstack-dev / backend-arch / electron-dev
- Result: FAIL (1/1 iterations)
- Key output: solver

### Workflow: rebase pr task (2026-05-07)
- Task: rebase pr task
- Team: solver-a / reviewer-b / executor-c
- Result: PASS (1/1 iterations)
- Key output: RESULT: PASS

### Workflow: rebase conflict task (2026-05-07)
- Task: rebase conflict task
- Team: solver-a / reviewer-b / executor-c
- Result: PASS (1/1 iterations)
- Key output: RESULT: PASS

### Workflow: single candidate task (2026-05-07)
- Task: single candidate task
- Team: solver-a / reviewer-b / executor-c
- Result: PASS (1/1 iterations)
- Key output: RESULT: PASS

### Workflow: multi candidate task (2026-05-07)
- Task: multi candidate task
- Team: solver-a / reviewer-b / executor-c
- Result: PASS (1/1 iterations)
- Key output: RESULT: PASS

### Workflow: invalid self eval task (2026-05-07)
- Task: invalid self eval task
- Team: solver-a / reviewer-b / executor-c
- Result: PASS (1/1 iterations)
- Key output: RESULT: PASS

### Workflow: pod quality pass (2026-05-07)
- Task: pod quality pass
- Team: nextjs-frontend / ui-designer / electron-dev
- Result: PASS (1/1 iterations)
- Key output: RESULT: PASS

### Workflow: task (2026-05-07)
- Task: task
- Team: fullstack-dev / backend-arch / electron-dev
- Result: FAIL (1/1 iterations)
- Key output: RESULT: FAIL
broken

--- REAL VALIDATION (authoritative) ---

### Workflow: task (2026-05-07)
- Task: task
- Team: fullstack-dev / backend-arch / electron-dev
- Result: PASS (1/2 iterations)
- Key output: RESULT: PASS

### Workflow: task (2026-05-07)
- Task: task
- Team: fullstack-dev / backend-arch / electron-dev
- Result: PASS (1/2 iterations)
- Key output: RESULT: PASS

### Workflow: rejected (2026-05-07)
- Task: rejected
- Team: fullstack-dev / backend-arch / electron-dev
- Result: FAIL (1/2 iterations)
- Key output: solver output

### Workflow: task (2026-05-07)
- Task: task
- Team: fullstack-dev / backend-arch / electron-dev
- Result: PASS (1/3 iterations)
- Self-fix attempts: 2
- Key output: RESULT: PASS

### Workflow: task (2026-05-07)
- Task: task
- Team: fullstack-dev / backend-arch / electron-dev
- Result: FAIL (1/2 iterations)
- Key output: solver

### Workflow: task (2026-05-07)
- Task: task
- Team: fullstack-dev / backend-arch / electron-dev
- Result: PASS (1/2 iterations)
- Self-fix attempts: 1
- Key output: RESULT: PASS

### Workflow: task (2026-05-07)
- Task: task
- Team: fullstack-dev / backend-arch / electron-dev
- Result: PASS (2/2 iterations)
- Key output: RESULT: PASS

### Workflow: task (2026-05-07)
- Task: task
- Team: fullstack-dev / backend-arch / electron-dev
- Result: FAIL (1/1 iterations)
- Key output: solver

### Workflow: task (2026-05-07)
- Task: task
- Team: fullstack-dev / backend-arch / electron-dev
- Result: PASS (2/2 iterations)
- Key output: RESULT: PASS

