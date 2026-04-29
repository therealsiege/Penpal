# Changelog

All notable changes to Penpal are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- **Packaged .app no longer crashes at startup.** Centralized writable state under `app.getPath('userData')/data` via a new `src/main/data-paths.ts::getDataDir()` helper. Previously ~17 modules wrote to `__dirname/../../data/`, which resolves inside the read-only `app.asar` archive once packaged — `PreferenceStore`, `orchestrator`, `pods`, `flight-board`, `merge-queue`, `reasoning-bank`, `pod-governance`, `github-pipeline`, `github-issues`, `evals/*`, etc. are now packaged-safe. `PENPAL_DATA_DIR` env var overrides for users who want the .app to share state with a developer checkout.
- **Packaged .app reads MCP profiles + agent-types.yaml from the bundled `agents/` dir** (previously `config-reader.ts` resolved them under `~/sidekick/Penpal/agents/`, so they were invisible without a developer checkout). Mirrors the existing pattern in `agents.ts`.
- **`graph-env.ts` and `soundboard.ts`** no longer rely on `process.cwd()` for path resolution — Finder-launched apps run with `cwd=/`.
- **Data-script IPC handlers** (`data:run-script`, `data:set-briefing-schedule`) and `infraUp/infraDown`, `forceRunJob` short-circuit with a friendly error in packaged mode instead of spawning npm against the absent `analytics/` directory.
- **CI artifact upload** in `.github/workflows/release.yml` now points at `Penpal/dist-forge/` (Forge's actual `outDir`) instead of `Penpal/out/make/`. Without this, every release artifact upload was empty.
- **App icon** is regenerated from `public/logo.png` (the canonical Penpal mark) instead of the inline golden-retriever-on-blue-circle SVG previously hard-coded in `scripts/generate-icon.mjs`.

## [0.1.1] - 2026-04-28

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
- **macOS signing requires GitHub secrets to be configured.** Until `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_IDENTITY`, `APPLE_ID`, `APPLE_ID_PASSWORD`, `APPLE_TEAM_ID` are set in the repo's GitHub Actions secrets, releases will publish unsigned builds (which need `xattr -rd com.apple.quarantine` to launch on a fresh machine).

## [0.1.0] - 2026-03-15

Initial private release. Electron + Phaser 3 office simulator visualizing Claude Code agent sessions as animated characters. Includes pod system (Solver/Reviewer/Executor), Slack bridge, GitHub issue pipeline, Vault editor, knowledge graph integration, and seasonal game systems (quests, leaderboards, cosmetic credits).

[Unreleased]: https://github.com/therealsiege/Penpal/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/therealsiege/Penpal/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/therealsiege/Penpal/releases/tag/v0.1.0
