# Changelog

All notable changes to Penpal are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.4.0] - 2026-05-06

### Removed
- **Phaser 3 game layer removed.** `src/renderer/src/game/` (~115 files, ~57k lines) deleted — the isometric office simulator, all game systems (quest engine, leaderboard, seasons, cosmetics, soundboard, bestiary, café, weather, particles), and every associated test. The dispatch board is now the sole UI. Game will be restored in a future release.
- **Dead main-process files removed.** `soundboard.ts`, `wave-dispatcher.ts`, `graph-env.ts`, `vault-graph.ts` — all orphaned after earlier feature removals. Corresponding `driveWaves` call in `github-issues.ts` and all `vault:*` IPC handlers in `ipc.ts` removed.
- **Dead API surface stripped.** 30+ `Window.api` entries removed from `env.d.ts` (graph, vault, leads, briefing, pipeline methods and their `*Rich` variants). 9 dead types removed from `types.ts`.
- **Orphaned renderer components deleted.** `ActivityModal.tsx`, `PipelineModal.tsx`.
- **35+ dead test files deleted.** Graph, capabilities, vault, game, and MCP-graph tests removed. Remaining suite: 54 files, 495 tests, all passing.

### Fixed
- **Pod self-fix test mock.** `runRealValidation` in `pods.ts` was returning `passed: true` in test mode regardless of mock output, masking self-fix loop failures.

### Documentation
- **CLAUDE.md rewritten** to reflect dispatch-system scope — game architecture, sprite sheet docs, and Dev Studio Tycoon system descriptions removed.
- **README trimmed** to match actual panels and working features.

## [0.3.9] - 2026-05-06

### Changed
- **Heavy startup work deferred behind first paint.** `startSlackBridge()` and `initAutoUpdater()` (network-bound) now run 1500ms after `createWindow()`. `startFileWatcher()`, `startOrchestrator()`, `startGC()`, `startAutopilot()`, and `infraUp()` (disk-bound) run 250ms after the window appears. Result: window paints noticeably faster on cold start because the first 1.5s of work is no longer blocking the renderer's initial commit.

### Removed
- **Dead `graph.ts` deleted.** All exported lead/territory/stats/search functions were unused after the graph IPC handlers were removed in v0.3.3. Eliminates the `neo4j-driver` import from the main process critical path. (`neo4j-driver` is still pulled in transitively by `health.ts` for the Slack `/health` command, but it no longer loads as the very first thing on startup.)
- **`capabilities-status.ts` deleted.** The `capabilities:status` IPC handler and its renderer surface (`window.api.capabilitiesStatus`) were leftovers from the deleted Handbook panel.
- **`HealthModal.tsx` and `src/renderer/src/capabilities/` deleted.** Both unused after panel cleanup.

### Documentation
- **README rewritten to match actual scope.** Removed references to: Phaser 3 isometric office game, world map / CampusScene, knowledge graph / Memgraph / ETL features in the app, vault editor, 8 deleted panels (CommandCenter, VaultPanel, DataPanel, GraphPanel, HandbookPanel, PipelinePanel, GitHubPanel, ActivityPanel), MCP `office:*` and `vault:*` tool groups, Dev Studio Tycoon game systems (quests, cosmetic tiers, leaderboards, seasons, credits, achievements, bestiary), agent roster table with avatars, future scenes vision (call center, content studio, etc.), keyboard shortcuts (game-specific). The new README is ~190 lines vs the old 700+ and accurately reflects the dispatch-system-only scope.

## [0.3.8] - 2026-05-06

### Fixed
- **"Poll Now" now shows a result toast.** Previously clicking Poll Now gave no feedback — if the poll found 0 issues it silently did nothing. Now shows "Queued N issues" on success or "No new issues found — check that labels are applied on GitHub" when the poll completes with nothing to enqueue.
- **Empty dispatch board now shows watched repos with GitHub links.** Instead of just "No issues tracked yet", the empty state now lists each watched repository with a direct link to its issues page on GitHub, making it easy to apply the `agent-ready` label to the right issues. If no repos are configured, a "Add a repository in Settings" link is shown instead.

## [0.3.5] - 2026-05-06

### Fixed
- **`isGitRepo` no longer fails when `GIT_DIR` is inherited from the shell.** electron-vite (dev) and some shell launchers propagate `GIT_DIR` into the Electron main process, causing `execFileSync` to ignore `cwd` and check the wrong repository. Fix: fast-path with `fs.existsSync('.git')` bypasses the git binary entirely; fallback strips `GIT_DIR`, `GIT_WORK_TREE`, and `GIT_INDEX_FILE` before exec.

## [0.3.4] - 2026-05-06

### Changed
- **Sources config moved to Settings panel.** GitHub repo and Linear team management now lives in a dedicated Sources section at the top of Settings, with full inline CRUD (add form with validation, remove, inline error display). The Dispatch "Sources" button navigates to Settings instead of opening a layered modal. The Linear Teams management form is removed from the kanban board.

## [0.3.3] - 2026-05-05

### Removed
- **Dead graph/pipeline/leads IPC handlers stripped.** `graph:stats`, `leads:search`, `leads:detail`, `graph:search-leads`, `graph:lead-detail`, `pipeline:summary`, `pipeline:hot-leads`, `pipeline:territories`, `pipeline:new-leads`, `vault:folders`, `ventures:list`, `ventures:read`, `sessions:prune`, `briefing:latest`, `briefing:list`, `briefing:get` handlers removed from `ipc.ts`. Their corresponding preload entries and local helper functions (`scanVaultFolders`, `getLatestBriefing`, `listBriefings`, `getBriefing`, `VaultFolder` interface) removed.
- **Graph module imports removed from main process.** `getPipelineSummary`, `getHotLeads`, `getTerritories`, `getNewLeads`, `getGraphStatsWithFreshness`, `searchLeads`, `getLeadDetail` from `graph.ts` and `suggestedActionsForStage` from `stage-suggestions.ts` no longer imported into `ipc.ts`. Prevents `neo4j-driver` from initializing at startup.
- **8 unused renderer panels deleted.** `ActivityPanel`, `CommandCenter`, `DataPanel`, `GitHubPanel`, `GraphPanel`, `HandbookPanel`, `PipelinePanel`, `VaultPanel` — none were imported in `App.tsx`. Removes ~188KB of dead renderer source.
- **Dead preload surface removed.** Pipeline, graph, leads, briefing, vault, data-script, and `searchLeadsRich`/`getLeadDetailRich`/`vaultReadRich`/`vaultSearchRich` entries stripped from `contextBridge` exposure.

## [0.3.2] - 2026-05-06

### Fixed
- **`isGitRepo` now uses an absolute git path and explicit `HOME` env.** The packaged app's `execFileSync('git', ...)` call was unreliable because git's env resolution behaves differently outside a terminal. Now resolves to `/usr/bin/git` (or first available absolute path) and passes `HOME` explicitly so git can find its config.
- **Add-repo error messages now distinguish the exact failure.** "Path must be absolute", "Path does not exist", and "Not a git repository" are three distinct errors instead of one generic message, making it easier to diagnose what went wrong.

## [0.3.1] - 2026-05-05

### Fixed
- **Sources modal now works with `~/...` paths.** `addWatchedRepo` was calling `path.isAbsolute()` on tilde-prefixed paths, which always returns false, causing every watch attempt to silently fail. The path is now expanded to an absolute path before validation and stored as the resolved absolute path for agent `cwd`.
- **Sources modal shows inline error on failure** instead of closing silently. The IPC error response is now checked and surfaced as a red error message inside the "Watch repository" modal so users know what went wrong without the modal dismissing.

## [0.2.0] - 2026-05-01

### Changed
- **Orchestrator split into dispatch-queue + dispatch-loop.** The 1,127-line monolith `orchestrator.ts` is now a thin barrel re-export backed by `dispatch-queue.ts` (pure state — queue, priorities, status transitions) and `dispatch-loop.ts` (side effects — agent spawn, health checks, retries). All existing import paths still work.
- **OrchestratorModal now renders Linear issues alongside GitHub issues.** Cards from both sources appear in the same kanban lanes; a new `DisplayCard` union type and `LinearIssueCard` / `LinearTeamConfig` types support this.
- **Input validation tightened** on `briefing:get` (date format regex) and `pod:retry-issue` (owner/repo regex) IPC handlers.

### Added
- **Linear issue poller** (`linear-poller.ts`) — polls Linear GraphQL API for `agent-ready` labeled issues and feeds them into the pod pipeline, mirroring the GitHub issue flow.
- **Onboarding screen** (`onboarding.ts` + `OnboardingScreen.tsx`) — first-run setup wizard that checks for API keys and git repo config before showing the main app. `App.tsx` gates on onboarding status.
- **New test suites** — `linear-poller.test.ts`, `onboarding.test.ts`, `security-validation.test.ts`, `OnboardingScreen.test.tsx`, `OrchestratorModal.test.tsx`.
- `.env.example` — documents required env vars for new contributors.
- `src/renderer/src/types.ts` — shared renderer type definitions extracted from inline types.

### Removed
- **SoundboardPanel** and `soundboard.ts` — the `penny-sfx://` custom protocol registration, `soundboard:list` IPC handler, and entire `SoundboardPanel.tsx` component are removed.
- **Wave Dispatcher** — `wave:start`, `wave:stop`, `wave:status` IPC handlers and `wave-dispatcher` import removed.
- `pruneTaskQueue` and `getAllAgentCredits` exports pruned from orchestrator surface.
- `consolidateTrackedIssues` export removed from github-issues.

## [0.1.3] - 2026-04-29

### Changed
- **Dispatch and Results panel sizing rolled back to pre-size-up baseline.** A run of ~10 "make it bigger" commits accumulated while iterating without live preview (compiled .app vs. dev server) and rendered comically oversized at native resolution. OrchestratorModal back to 72px avatars + 18px titles + horizontal cards; ResultsPanel back to pre-1.4x text.

## [0.1.2] - 2026-04-29

### Fixed
- **Packaged .app now picks up the maintainer's dev tree automatically.** When `app.isPackaged`, the data dir falls back to `SIDEKICK_ROOT/Penpal/data` if it exists (validated by reading `package.json` at that location), and the env loader pulls `analytics/.env`, `.env`, and `.env.shared` from the same checkout. Without this, a fresh install had empty userData + no API keys, so all panels hung on missing Memgraph/Qdrant connections.
- **File watcher EMFILE flood silenced.** Launchd's low fd limit (256 vs. terminal's 4096+) made chokidar throw on every poll cycle when watching the Vault, producing thousands of `UnhandledPromiseRejectionWarning` lines per minute. Now caught + logged once.
- **CI lockfile drift fixed** — `@types/express` transitive deps were missing from `package-lock.json`, breaking `npm ci`.

## [0.1.1] - 2026-04-28

### Fixed
- **Packaged .app no longer crashes at startup.** Centralized writable state under `app.getPath('userData')/data` via a new `src/main/data-paths.ts::getDataDir()` helper. Previously ~17 modules wrote to `__dirname/../../data/`, which resolves inside the read-only `app.asar` archive once packaged — `PreferenceStore`, `orchestrator`, `pods`, `flight-board`, `merge-queue`, `reasoning-bank`, `pod-governance`, `github-pipeline`, `github-issues`, `evals/*`, etc. are now packaged-safe. `PENPAL_DATA_DIR` env var overrides for users who want the .app to share state with a developer checkout.
- **Packaged .app reads MCP profiles + agent-types.yaml from the bundled `agents/` dir** (previously `config-reader.ts` resolved them under `~/sidekick/Penpal/agents/`, so they were invisible without a developer checkout). Mirrors the existing pattern in `agents.ts`.
- **`graph-env.ts` and `soundboard.ts`** no longer rely on `process.cwd()` for path resolution — Finder-launched apps run with `cwd=/`.
- **Data-script IPC handlers** (`data:run-script`, `data:set-briefing-schedule`) and `infraUp/infraDown`, `forceRunJob` short-circuit with a friendly error in packaged mode instead of spawning npm against the absent `analytics/` directory.
- **CI artifact upload** in `.github/workflows/release.yml` now points at `Penpal/dist-forge/` (Forge's actual `outDir`) instead of `Penpal/out/make/`. Without this, every release artifact upload was empty.
- **App icon** is regenerated from `public/logo.png` (the canonical Penpal mark) instead of the inline golden-retriever-on-blue-circle SVG previously hard-coded in `scripts/generate-icon.mjs`.

### Changed
- Renamed source folder `Penny/` → `Penpal/` to match the product name. Internal character references (the `PennyCafe` cafe owner, `.penny-worktrees` git worktree dir, slack bot username, MCP server id, `penny-sfx://` protocol) are unchanged — Penny is a character within the Penpal app.
- Folded `analytics/` (graph-ETL + MCP server + scheduler) inside Penpal as `Penpal/analytics/`. All path references updated; previously the analytics service had to live as a sibling of Penpal at the sidekick repo root.
- Moved release workflow from `Penny/.github/workflows/release.yml` to repo-root `.github/workflows/release.yml` so GitHub Actions actually picks it up.

### Added
- Explicit `forge.config.js` (replaces implicit Forge defaults) — sets bundle id, icon, signing/notarization gating, DMG + ZIP makers, and the `publisher-github` config.
- `build/entitlements.mac.plist` — hardened-runtime entitlements for V8 JIT, native modules, and network access.
- `analytics/.env.example` — documents the env keys analytics (and Penpal) need at runtime.
- This `CHANGELOG.md`.
- `productName: "Penpal"` and `name: "penpal"` in `package.json`.

### Removed
- Stale top-level `data/eval-outcomes.jsonl` (eval harness now writes to `Penpal/data/`).
- Empty `website/` directory.
- `test-music-system.ts` scratch file.
- Empty `Penpal/public/audio/` placeholder folders (real audio lives in `Penpal/public/sounds/`).
- `Penpal/.serena/` stale Serena MCP cache.
- 9670 accidentally-tracked `analytics/node_modules/` files (added to gitignore via the existing `Penpal/.gitignore`).

### Known limitations
- **Analytics is dev-mode-only in v0.1.1.** The `Penpal/analytics/` Node service is not bundled inside the packaged `.app`; it expects to run from a developer checkout (`cd Penpal/analytics && npm install`). A future v0.2 release may bundle analytics as `extraResource` so the .app is fully self-contained.
- **Local `npm run make` produces an unsigned .app** (signing only fires in CI, where the Apple certificate + notarization secrets live). For local launches you may need `xattr -rd com.apple.quarantine dist-forge/Penpal-darwin-arm64/Penpal.app`.

## [0.1.0] - 2026-03-15

Initial private release. Electron + Phaser 3 office simulator visualizing Claude Code agent sessions as animated characters. Includes pod system (Solver/Reviewer/Executor), Slack bridge, GitHub issue pipeline, Vault editor, knowledge graph integration, and seasonal game systems (quests, leaderboards, cosmetic credits).

[Unreleased]: https://github.com/therealsiege/Penpal/compare/v0.3.5...HEAD
[0.3.5]: https://github.com/therealsiege/Penpal/compare/v0.3.4...v0.3.5
[0.3.4]: https://github.com/therealsiege/Penpal/compare/v0.3.3...v0.3.4
[0.3.3]: https://github.com/therealsiege/Penpal/compare/v0.3.2...v0.3.3
[0.3.2]: https://github.com/therealsiege/Penpal/compare/v0.3.1...v0.3.2
[0.3.1]: https://github.com/therealsiege/Penpal/compare/v0.2.0...v0.3.1
[0.2.0]: https://github.com/therealsiege/Penpal/compare/v0.1.3...v0.2.0
[0.1.3]: https://github.com/therealsiege/Penpal/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/therealsiege/Penpal/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/therealsiege/Penpal/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/therealsiege/Penpal/releases/tag/v0.1.0
