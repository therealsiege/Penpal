# Epic #29 Execution Checklist

Source of truth: `Penny/GOLDEN-FRAMEWORK.md`

## Sequencing and Dependencies

- Phase 1: Foundation (`evals` + `preferences` + dashboard IPC)
- Phase 2: MCP server and context-engineered tool surfaces
- Phase 3: Smart pods compute allocation and iterative quality
- Phase 4: Learning loop (pairs, context rot, weekly digest, spot checks)
- Phase 5: Game polish, feature-flagged and default-off until validated

## Cross-Cutting Done Criteria

- Typed IPC contracts from main -> preload -> renderer (`window.api.*`)
- Graceful error handling for every new handler and MCP tool
- Keyboard-safe UI interactions for newly added controls and panels
- Regression tests for each new IPC handler or tool surface
- No unbounded query surfaces (caps or paging on stores and reports)

## Phase Tracking

### Phase 1

- [x] #28 Vitest infrastructure baseline in place
- [x] #1 Preference collector hook
- [x] #2 Preference JSONL store with rotation and malformed line tolerance
- [x] #3 Eval harness pass/fail tracking and reporting
- [x] #4 Eval dashboard handler and renderer panel states

### Phase 2

- [x] #5 MCP server scaffold with stdio transport
- [x] #6 Orchestrator tools (`enqueue`, `queue`, `agent-health`)
- [x] #7 Pod tools (`create`, `list`, `status`)
- [x] #8 Vault tools (`read`, `search`, `write`)
- [x] #9 Graph tools (`search-leads`, `lead-detail`, `stats`)
- [x] #10 Office tools (`rooms`, `agents`, `leaderboard`)
- [x] #11 Context-engineered high-traffic IPC handlers
- [x] #23 `.mcp.json` auto-discovery wiring for Penny

### Phase 3

- [x] #12 Priority-aware phase config
- [x] #13 Best-of-N solver candidate sampling
- [x] #14 Structured reviewer critique schema
- [x] #15 Executor self-fix loop
- [x] #24 Pod quality metrics exposed via `evals:pod-quality`

### Phase 4

- [x] #16 DPO pair generation from preference store
- [x] #17 Context rot detection and context health handlers
- [x] #26 Weekly eval digest generation
- [x] #27 Spot-check queue with agreement metrics

### Phase 5

- [x] #18 Eval glow effect
- [x] #19 Thinking animation for best-of-N
- [x] #20 Quality streak effect
- [x] #21 Preference sparkle particles
- [x] #22 Context utilization meter
- [x] #25 MCP connection line rendering

## Success Metrics Checkpoints

- Task success rate: track via `evals:stats` and harness reports
- Preference pairs: track via `preferences:count` and `preferences:generate-pairs`
- Eval coverage: track from orchestrator outcomes vs harness rows
- MCP-connected sessions: track from MCP tool usage and session inventory
- Human review cadence: track via `evals:spot-check-*` queue and agreement

## Release Readiness Gates

- Thin-slice sequence validated: capture -> API -> UI/game -> tests
- High-risk pod/game behaviors behind toggles until validated
- Regression pass: approvals, queueing, pod lifecycle, vault search/read, eval polling
- Evidence attached before epic close: tests, typed handlers, dashboard updates, metrics
