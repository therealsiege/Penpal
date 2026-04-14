# Penpal Development Blog

A journal of building an AI workforce operating system.

---

## April 12-13, 2026 — The System Comes Alive

**The big theme**: Penpal went from a collection of features to a coherent system in one marathon session. Fleet heartbeats, dispatch boards, pod profiles, economic mode, and the world map all came together.

### What happened

**Fleet heartbeat via Slack.** Each Penpal instance now posts a heartbeat to `#sk-fleet` every 60 seconds — hostname, active sessions, pod count, health, and IP geolocation. Other instances read the channel and discover each other. The world map shows pins for every machine. Two Mac Studios in Nashville, both visible, both clickable (well, your own is clickable — remote ones are view-only for now).

The transport choice was deliberate: Slack is already the connective tissue for agent communication. No new infrastructure, no port forwarding, works across networks. Each instance owns one message in the channel and updates it in-place via `chat.update`. Clean.

**Unified Dispatch board.** The old Dispatch panel was a GitHub issue kanban with oversized avatars. The old pod workflow view (KanbanBoard + PodCard) was embedded in Mission Control where it didn't belong. We ripped both out and built one unified board — each card is a GitHub issue progressing through pod phases (Planning → Executing → Validating → Done → Failed). Click to expand and see the pod team with their Journey to the West avatars, phase config, and controls.

No more tabs. Issues and pods are the same thing.

**Pod profiles panel.** Runtime profiles (max/economic/sonnet) were buried in YAML. Now there's a Profiles panel in the sidebar with a visual pipeline — Plan → Execute → Validate — where you pick the model, set the timeout multiplier, and configure iteration limits. Set a default and every new pod uses it. No per-issue micromanagement.

**Economic mode actually works.** The `economic` profile routes all three phases through OpenCode with local Ollama `qwen3-coder:30b`. Zero API cost. 8x timeout. 5 iterations. 3 self-fix attempts. We tested it end-to-end: GitHub issue → pod picks it up → solver creates files via OpenCode → reviewer approves → executor validates → branch pushed → PR created. All on a local 30B model.

The key insight: we had to route through OpenCode (which has tool use and file editing) instead of raw Ollama `/api/generate` (which is text-only). And `opencode.json` needs to be in the worktree so OpenCode finds its provider config.

**Pod system hardening.** 315 tests passing. Fixed: missing `os` import crashing `pickPodDefaultCwd`, reviewer auto-approving on parse failure (now rejects), `phaseOverrides` typed properly, `pausePod` guarding against double-pause, `overridePod` validating phase names, issue number tracking for dispatch matching.

**World map with sprite pins.** Replaced programmatic teardrop graphics with illustrated marker sprites from the asset pack. IP geolocation via `ip-api.com` positions pins automatically. Anchor-based coordinate projection calibrated to the illustrated map (linear projection kept landing pins in Canada).

**Secret rotation.** Repo went public with API keys in `.mcp.json` and `.env.shared`. BFG scrubbed 7 secrets from 361 commits across all branches. Rotated Firecrawl, GitHub PAT, Browserbase, Notion, and Slack tokens. Created `.env.shared` (committed, no secrets) and moved all keys to `Penny/.env` (gitignored).

### Decisions made

- **No Veritas.** We decided against the separate kanban board. One system: GitHub issues → pods.
- **No per-issue config.** Profiles are configured once. Pods run autonomously.
- **Slack as fleet bus.** No mDNS, no central broker. Slack is already connected.
- **OpenCode for Ollama.** Raw Ollama API can't edit files. OpenCode can.
- **Reviewer rejects on failure.** The old auto-approve fallback was a safety hole.

### Numbers

- 315 unit tests passing
- 3 runtime profiles (max, economic, sonnet)
- 60-second heartbeat interval
- 5 max iterations on economic mode
- 7 secrets rotated and scrubbed from git history
- 125 stale branches deleted
- 607 lines of dead code removed (KanbanBoard + PodCard)

---

## Earlier — The Foundation

*(To be backfilled from git history)*

The project started as a terminal session manager — a way to see all Claude Code sessions in one place, focus any terminal, and keep track of what each agent was doing. Then came the Phaser game view, the pod system, the orchestrator, the vault editor, and eventually the fleet.

Key milestones from the commit history:
- Phase 1: Vault parsing, embeddings, Qdrant
- Phase 2: LLM entity extraction
- Phase 3: Sales pipeline, territories, lead scoring
- Phase 4: Revenue intelligence
- Phase 5: External intelligence (NPI, web intel)
- Phase 6: Multi-venture ingestion
- Phase 7: Scheduler
- Phase 8: Electron dashboard with Phaser game
- Phase 9: Pod agent teams (Solver → Reviewer → Executor)
- Phase 10: Dev Studio Tycoon game systems (quests, seasons, leaderboard)
