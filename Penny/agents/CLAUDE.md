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

## Updates

_This file is automatically updated after completed pod workflows._
