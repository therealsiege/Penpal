# Penny Shared Agent Memory

This file is shared across all agents in the Penny platform. Reference it for team-wide conventions, patterns, and decisions.

## Architecture

- **Electron Dashboard**: `Penny/` — React + Tailwind + Phaser game view
- **Graph ETL + MCP**: `analytics/` — Memgraph + Qdrant knowledge graph
- **Vault Root**: `~/sidekick/` (Obsidian vault)

## Code Conventions

- TypeScript strict mode, no `any` unless absolutely necessary
- Prefer `const` over `let`, never use `var`
- Use functional React components with hooks
- Tailwind for styling, no CSS modules
- IPC pattern: main → `ipcMain.handle`, preload → `contextBridge`, renderer → `window.api.*`

## Pod Workflow Protocol

When working in a pod (Solver/Reviewer/Executor):
- **Solver**: Implement the task completely. Provide a summary of changes.
- **Reviewer**: Design test criteria independently WITHOUT seeing implementation code. Focus on expected behavior from the task description.
- **Executor**: Verify implementation against test plan. Report structured PASS/FAIL results.
- Feedback flows from Executor → Solver. Max 3 iterations.

## Quality Standards

- All new features should handle error cases gracefully
- UI components must work with keyboard navigation
- Performance: keep React re-renders minimal, use `useCallback` and `useMemo` where appropriate
- Git commits should be atomic and well-described

## Known Patterns

- Agent sessions are tracked via `~/.claude/sessions/*.json` and JSONL transcripts
- Agent state is polled every 5s from the renderer
- Pod workflows are orchestrated by a state machine in `src/main/pods.ts`
- Use `sendToSession()` for inter-agent communication via iTerm TTY

## Penny MCP Tools

You have access to Penny tools via MCP. Available tools:
- `meta:list-tools` — List all available Penny tools
- `meta:describe-tool` — Get full schema for a specific tool
- `orchestrator:enqueue` — Add a task to the queue
- `orchestrator:queue` — View current task queue (filterable by status)
- `orchestrator:agent-health` — Check health of all agents
Always call `meta:list-tools` first to discover the current tool set.

## Updates

_This file is automatically updated after completed pod workflows._

### Workflow: first-pass metrics (2026-03-27)
- Task: first-pass metrics
- Team: nextjs-frontend / ui-designer / electron-dev
- Result: PASS (1/1 iterations)
- Key output: RESULT: PASS

### Workflow: failing metrics (2026-03-27)
- Task: failing metrics
- Team: fullstack-dev / backend-arch / electron-dev
- Result: FAIL (1/1 iterations)
- Key output: RESULT: FAIL

### Workflow: single candidate task (2026-03-27)
- Task: single candidate task
- Team: solver-a / reviewer-b / executor-c
- Result: PASS (1/1 iterations)
- Key output: RESULT: PASS

### Workflow: multi candidate task (2026-03-27)
- Task: multi candidate task
- Team: solver-a / reviewer-b / executor-c
- Result: PASS (1/1 iterations)
- Key output: RESULT: PASS

### Workflow: invalid self eval task (2026-03-27)
- Task: invalid self eval task
- Team: solver-a / reviewer-b / executor-c
- Result: PASS (1/1 iterations)
- Key output: RESULT: PASS

### Workflow: pod quality pass (2026-03-27)
- Task: pod quality pass
- Team: nextjs-frontend / ui-designer / electron-dev
- Result: PASS (1/1 iterations)
- Key output: RESULT: PASS

### Workflow: pod quality pass (2026-03-27)
- Task: pod quality pass
- Team: nextjs-frontend / ui-designer / electron-dev
- Result: PASS (1/1 iterations)
- Key output: RESULT: PASS

### Workflow: rejected (2026-03-27)
- Task: rejected
- Team: fullstack-dev / backend-arch / electron-dev
- Result: FAIL (1/2 iterations)
- Key output: solver output

### Workflow: task (2026-03-27)
- Task: task
- Team: fullstack-dev / backend-arch / electron-dev
- Result: FAIL (1/1 iterations)
- Key output: RESULT: FAIL
broken

### Workflow: task (2026-03-27)
- Task: task
- Team: fullstack-dev / backend-arch / electron-dev
- Result: PASS (1/3 iterations)
- Self-fix attempts: 2
- Key output: RESULT: PASS


### Workflow: task (2026-03-27)
- Task: task
- Team: fullstack-dev / backend-arch / electron-dev
- Result: PASS (1/2 iterations)
- Self-fix attempts: 1
- Key output: RESULT: PASS


### Workflow: task (2026-03-27)
- Task: task
- Team: fullstack-dev / backend-arch / electron-dev
- Result: PASS (2/2 iterations)
- Key output: RESULT: PASS


### Workflow: task (2026-03-27)
- Task: task
- Team: fullstack-dev / backend-arch / electron-dev
- Result: FAIL (1/1 iterations)
- Key output: RESULT: FAIL
broken

### Workflow: single candidate task (2026-03-27)
- Task: single candidate task
- Team: solver-a / reviewer-b / executor-c
- Result: PASS (1/1 iterations)
- Key output: RESULT: PASS

### Workflow: task (2026-03-27)
- Task: task
- Team: fullstack-dev / backend-arch / electron-dev
- Result: PASS (1/2 iterations)
- Key output: RESULT: PASS


### Workflow: pod quality pass (2026-03-27)
- Task: pod quality pass
- Team: nextjs-frontend / ui-designer / electron-dev
- Result: PASS (1/1 iterations)
- Key output: RESULT: PASS

### Workflow: task (2026-03-27)
- Task: task
- Team: fullstack-dev / backend-arch / electron-dev
- Result: PASS (1/2 iterations)
- Key output: RESULT: PASS


### Workflow: multi candidate task (2026-03-27)
- Task: multi candidate task
- Team: solver-a / reviewer-b / executor-c
- Result: PASS (1/1 iterations)
- Key output: RESULT: PASS

### Workflow: rejected (2026-03-27)
- Task: rejected
- Team: fullstack-dev / backend-arch / electron-dev
- Result: FAIL (1/2 iterations)
- Key output: solver output

### Workflow: task (2026-03-27)
- Task: task
- Team: fullstack-dev / backend-arch / electron-dev
- Result: FAIL (1/2 iterations)
- Key output: solver

### Workflow: invalid self eval task (2026-03-27)
- Task: invalid self eval task
- Team: solver-a / reviewer-b / executor-c
- Result: PASS (1/1 iterations)
- Key output: RESULT: PASS

### Workflow: task (2026-03-27)
- Task: task
- Team: fullstack-dev / backend-arch / electron-dev
- Result: PASS (2/2 iterations)
- Key output: RESULT: PASS


### Workflow: task (2026-03-27)
- Task: task
- Team: fullstack-dev / backend-arch / electron-dev
- Result: PASS (1/1 iterations)
- Key output: RESULT: PASS


### Workflow: task (2026-03-27)
- Task: task
- Team: fullstack-dev / backend-arch / electron-dev
- Result: PASS (1/3 iterations)
- Self-fix attempts: 2
- Key output: RESULT: PASS


### Workflow: task (2026-03-27)
- Task: task
- Team: fullstack-dev / backend-arch / electron-dev
- Result: PASS (1/2 iterations)
- Self-fix attempts: 1
- Key output: RESULT: PASS


### Workflow: task (2026-03-27)
- Task: task
- Team: fullstack-dev / backend-arch / electron-dev
- Result: PASS (2/2 iterations)
- Key output: RESULT: PASS


### Workflow: task (2026-03-27)
- Task: task
- Team: fullstack-dev / backend-arch / electron-dev
- Result: FAIL (1/1 iterations)
- Key output: RESULT: FAIL
broken

### Workflow: task (2026-03-27)
- Task: task
- Team: fullstack-dev / backend-arch / electron-dev
- Result: PASS (1/2 iterations)
- Key output: RESULT: PASS


### Workflow: single candidate task (2026-03-27)
- Task: single candidate task
- Team: solver-a / reviewer-b / executor-c
- Result: PASS (1/1 iterations)
- Key output: RESULT: PASS

### Workflow: pod quality pass (2026-03-27)
- Task: pod quality pass
- Team: nextjs-frontend / ui-designer / electron-dev
- Result: PASS (1/1 iterations)
- Key output: RESULT: PASS

### Workflow: task (2026-03-27)
- Task: task
- Team: fullstack-dev / backend-arch / electron-dev
- Result: PASS (1/2 iterations)
- Key output: RESULT: PASS


### Workflow: multi candidate task (2026-03-27)
- Task: multi candidate task
- Team: solver-a / reviewer-b / executor-c
- Result: PASS (1/1 iterations)
- Key output: RESULT: PASS

### Workflow: rejected (2026-03-27)
- Task: rejected
- Team: fullstack-dev / backend-arch / electron-dev
- Result: FAIL (1/2 iterations)
- Key output: solver output

### Workflow: task (2026-03-27)
- Task: task
- Team: fullstack-dev / backend-arch / electron-dev
- Result: FAIL (1/2 iterations)
- Key output: solver

### Workflow: invalid self eval task (2026-03-27)
- Task: invalid self eval task
- Team: solver-a / reviewer-b / executor-c
- Result: PASS (1/1 iterations)
- Key output: RESULT: PASS

### Workflow: task (2026-03-27)
- Task: task
- Team: fullstack-dev / backend-arch / electron-dev
- Result: PASS (2/2 iterations)
- Key output: RESULT: PASS


### Workflow: task (2026-03-27)
- Task: task
- Team: fullstack-dev / backend-arch / electron-dev
- Result: PASS (1/3 iterations)
- Self-fix attempts: 2
- Key output: RESULT: PASS


### Workflow: task (2026-03-27)
- Task: task
- Team: fullstack-dev / backend-arch / electron-dev
- Result: PASS (1/1 iterations)
- Key output: RESULT: PASS


### Workflow: task (2026-03-27)
- Task: task
- Team: fullstack-dev / backend-arch / electron-dev
- Result: PASS (1/2 iterations)
- Self-fix attempts: 1
- Key output: RESULT: PASS


### Workflow: task (2026-03-27)
- Task: task
- Team: fullstack-dev / backend-arch / electron-dev
- Result: PASS (2/2 iterations)
- Key output: RESULT: PASS

