---
slug: the-system-comes-alive
title: "The System Comes Alive"
authors: [siege]
tags: [fleet, dispatch, pods, economic-mode, world-map]
---

Penpal went from a collection of features to a coherent system in one marathon session. Fleet heartbeats, dispatch boards, pod profiles, economic mode, and the world map all came together.

{/* truncate */}

## What Happened

**Fleet heartbeat via Slack.** Each Penpal instance now posts a heartbeat to `#sk-fleet` every 60 seconds — hostname, active sessions, pod count, health, and IP geolocation. Other instances read the channel and discover each other. The world map shows pins for every machine.

The transport choice was deliberate: Slack is already the connective tissue for agent communication. No new infrastructure, no port forwarding, works across networks.

**Unified Dispatch board.** We ripped out the separate GitHub issue kanban and pod workflow views, and built one unified board. Each card is a GitHub issue progressing through pod phases (Planning → Executing → Validating → Done → Failed). No more tabs. Issues and pods are the same thing.

**Pod profiles panel.** Runtime profiles were buried in YAML. Now there's a Profiles panel with a visual pipeline — Plan → Execute → Validate — where you pick the model, set the timeout multiplier, and configure iteration limits. Set a default and every new pod uses it.

**Economic mode actually works.** The `economic` profile routes all three phases through OpenCode with local Ollama `qwen3-coder:30b`. Zero API cost. 8x timeout. 5 iterations. 3 self-fix attempts. We tested it end-to-end: GitHub issue → pod → solver creates files via OpenCode → reviewer approves → executor validates → branch pushed → PR created.

**Pod system hardening.** 315 tests passing. Fixed reviewer auto-approve on parse failure (now rejects), added phase override validation, issue number tracking for dispatch matching.

**World map with sprite pins.** Illustrated marker sprites from an asset pack. IP geolocation positions pins automatically. Anchor-based coordinate projection calibrated to the illustrated map.

## Decisions

- **No Veritas.** One system: GitHub issues → pods.
- **No per-issue config.** Profiles configured once. Pods run autonomously.
- **Slack as fleet bus.** No mDNS, no central broker.
- **OpenCode for Ollama.** Raw Ollama API can't edit files. OpenCode can.
- **Reviewer rejects on failure.** The old auto-approve fallback was a safety hole.

## By the Numbers

- 315 unit tests passing
- 3 runtime profiles (max, economic, sonnet)
- 9 RPG layer issues queued across 4 waves for overnight pod runs
- 7 secrets rotated and scrubbed from git history
- 125 stale branches deleted
