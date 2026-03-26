# Penny — Agent Office Simulator

Electron desktop app with a Phaser 3 isometric office that visualizes Claude Code agent sessions as animated characters working at desks. Each agent gets a workstation with sprite, monitor, status indicators, and ambient animations.

## Stack

Electron 33, electron-vite 5, React 18, Phaser 3.90, Tailwind 3, TypeScript 5.7, Zustand (state), xterm.js (terminal), CodeMirror 6 (editor), neo4j-driver (graph queries).

## Directory Structure

- `src/main/` — Electron main process (IPC handlers, system integration)
- `src/preload/` — contextBridge IPC exposure
- `src/renderer/src/` — React shell + Phaser game
  - `game/` — All Phaser scene code (20 files, ~14,300 lines total)
  - `types.ts` — Shared types (`AgentState`, `OpencodeSession`, `XP_RANKS`)

## Game Architecture

OfficeScene.ts was originally a monolithic 8000+ line file. It has been fully decomposed into 18 focused modules plus the orchestrator. OfficeScene (~4650 lines) is now the orchestrator only — it instantiates and coordinates all subsystems but contains no rendering logic that belongs in a module.

### Module Pattern

Each extracted module is a class that receives `Phaser.Scene` in its constructor. Modules that need callbacks into OfficeScene define a host interface (e.g., `BackgroundHostScene`, `RoomsHostScene`, `CafeHostScene`, `SelectionHostScene`) specifying the contract. This avoids circular imports — the module depends on an interface, not on OfficeScene directly. Pure utility functions go in `office-helpers.ts` with no class or scene dependency.

### Module List (by size)

| File | Lines | Description |
|------|------:|-------------|
| `OfficeScene.ts` | 4652 | Orchestrator. Owns agent sync, camera, update loop, delegates to all modules. |
| `office-workstation.ts` | 1698 | Workstation lifecycle: creation, destruction, sprite setup, monitor glow, XP bars, task counters, sparklines, progress rings, LOD arrays. |
| `office-background.ts` | 1449 | Office floor plan rendering: walls, floors, corridor connectors, team area layouts, decorative props (plants, whiteboards, sofas), world bounds. Defines `BackgroundHostScene`. |
| `penny-cafe.ts` | 826 | Cafe area with stools, coffee run animations, social emoji interactions. Defines `CafeHostScene`. |
| `office-particles.ts` | 824 | Particle pool systems: rain, snow, sparkle trails, ambient motes, steam effects. Exports `SteamHost` and `ParticleWorkstation` interfaces. |
| `office-ui.ts` | 749 | Screen-space overlays: notification toasts, hover tooltips, hover ring, keyboard help overlay, debug overlay (FPS, object count, nav mesh). |
| `office-atmosphere.ts` | 718 | `OfficeAtmosphere` class. Day/night cycle, sky gradient, starfield, clouds, ceiling lights, wall clock, shadows, weather phases. |
| `office-rooms.ts` | 646 | Room creation, rendering, doors, headers. Defines `RoomsHostScene`. |
| `office-selection.ts` | 546 | Keyboard agent selection (Tab/Shift-Tab), selection ring, auto-pan cycling, focus mode. Defines `SelectionHostScene`. |
| `office-minimap.ts` | 440 | Screen-space minimap with room outlines, viewport indicator, click-to-pan, hover labels, room flash alerts. |
| `office-pods.ts` | 344 | Pod connecting lines between agent teams and agent-to-agent chat dot animations. |
| `office-ambient.ts` | 256 | Ambient office-life micro-animations: paper airplanes, coffee refills, phone rings, printer noise, door peeks. |
| `nav-mesh.ts` | 248 | `NavMesh` class. A* grid pathfinding on 12px cells. Blocked-by-default with walkable rooms, corridors, doors, and cafe. |
| `office-theme.ts` | 216 | 3 color themes (`dark` / `light` / `neon`). Exports `activeTheme`, `setActiveTheme()`, `lerpColor()`. |
| `office-types.ts` | 170 | Shared type definitions: `WorkstationSprite`, `Room`, `PodLineInfo`, `TeamAreaLayout`, `MinimapProjection`, etc. |
| `office-helpers.ts` | 165 | Pure stateless utility functions: `getPoseFrame()`, door-Y calculation, sprite index helpers. No class or scene dependency. |
| `office-constants.ts` | 150 | All numeric/string constants: spritesheet geometry, zoom limits, layout gaps, pool sizes, color values. `UPPER_SNAKE_CASE`. |
| `events.ts` | 75 | `EventBus` singleton (pub/sub) for scene-to-React communication. Event constants: `AGENT_CLICKED`, `BROADCAST`, etc. |
| `room-renderer.ts` | 56 | Room type detection from cwd path keywords, procedural color templates (design-studio, server-room, game-den, etc.). |
| `OfficeGame.ts` | 40 | Bootstraps Phaser with RESIZE scale mode, transparent background, WebGL. Returns `{ game, scene }`. |
| `quest-system.ts` | 220 | Quest auto-wrapper. Wraps agent tasks into quests with difficulty inference (trivial/normal/hard/epic/legendary), XP/credit multipliers. Singleton `questSystem`. |
| `cosmetic-tiers.ts` | 185 | Rank-based cosmetic tier definitions (L1-L10). Maps XP rank to unlocked desk items, agent flair, office effects. Used by `workstation-creation.ts`. |
| `leaderboard.ts` | 235 | Competitive leaderboard. Ranks agents by season XP, tracks weekly MVP, detects rivalries (within 5% XP). Singleton `leaderboardManager`. |
| `seasons.ts` | 310 | Seasonal arc system. Monthly seasons with themes, challenges (task counts, streaks, difficulty targets), scoring, history. Singleton `seasonManager`. |
| `season-hud.ts` | 280 | Season HUD overlay. Displays season name, progress bar, credits counter, active quest count. Toggle leaderboard (L key) and challenges (C key). |
| `credits.ts` | 200 | Cosmetic credits economy. Earned from quests, spent on room themes, desk colors, particle effects, name colors. Shop catalog + equip system. Singleton `creditManager`. |

## Key Patterns

**LOD System** — 3 levels based on camera zoom: L1 overview (room outlines only), L2 room-level (agents, desks, status dots, names), L3 full detail (accessories, lamps, mugs, monitor text, mood emoji). Workstations track `lodLevel2Objects` and `lodLevel3Objects` arrays.

**WorkstationSprite** — Rich interface defined in `office-types.ts`: sprite, desk, monitor with glow FX, thought bubble, blocked indicator, XP bar, task counter, sparkline, sound waves, progress ring, shadow, uptime text.

**Spritesheets** — Compact format: 17 frames per row (4 idle rotations + 12 walk rotations + 1 sit). Loaded as animation strips, 256x512 per frame.

**Theme Colors** — Always use `activeTheme.propertyName`, never hardcoded hex. Theme switch via `setActiveTheme(name)` then caller redraws.

**Particle Pools** — Pre-allocated circles recycled with `.getData('busy')` flag. Tweens set `busy=true` on use, `busy=false` on complete.

**Screen-space Overlays** — Use `.setScrollFactor(0)` and high depth values (9996-10001). Day/night overlay is depth 9997.

**Depth Ordering** — Sky: -11, office bg: -4 to -1, world objects: 50-500, chat lines: 200, screen overlays: 9996-10001, debug: 11000.

**Text Resolution** — All `Phaser.GameObjects.Text` use `resolution: 2` for Retina clarity.

## Development

```
npm run dev          # electron-vite dev server with HMR
npm run build        # production build
npm run sprites      # rebuild spritesheets (scripts/build-sprites.mjs)
npx tsc --noEmit     # type check
```

## Fragile Areas

- **Room layout** — `calcRoomSize()` in OfficeScene + rendering in `office-background.ts` / `office-rooms.ts` have tightly coupled positioning math. Changes cascade.
- **LOD visibility** — `applyLodToWorkstation()` requires objects in correct `lodLevel2Objects` / `lodLevel3Objects` arrays or they vanish at wrong zoom levels.
- **Workstation creation** — `office-workstation.ts` `createWorkstation()` is very long with many interdependent parts (tweens reference each other, depth ordering matters).
- **update() loop** — Throttled tick calls with `lastXxxAt` timestamps. Execution order matters (atmosphere before particles, camera before minimap).
- **NavMesh rebuild** — Must be called after room layout changes; stale mesh = agents walk through walls.
- **Host interfaces** — When adding new module callbacks, update the corresponding host interface and the OfficeScene implementation.

## Game System — "Dev Studio Tycoon"

Cohesive game layer on top of the office visualizer. Six interconnected systems:

1. **Quest Auto-Wrapper** (`quest-system.ts`): Every agent task auto-wraps into a quest. Difficulty inferred from priority/pod status. Idle→working starts a quest; working→idle completes it. XP/credit multipliers: trivial 1x, normal 1.5x, hard 2x, epic 3x, legendary 5x.

2. **Cosmetic Tiers** (`cosmetic-tiers.ts`): Desk items gated by XP rank. Interns get bare desks; higher ranks unlock keyboard, lamp, plant, phone, gold trim, RGB underglow. Agent flair (name glow, crown, aura) also rank-gated. Used in `workstation-creation.ts` via `isDeskItemUnlocked()` / `isFlairUnlocked()`.

3. **Leaderboard** (`leaderboard.ts`): Agents ranked by season XP. Weekly MVP tracked. Rivalries detected when agents are within 5% XP. HUD overlay toggled with `L` key.

4. **Seasons** (`seasons.ts`): 30-day seasons with themed challenges (e.g., "Complete 50 tasks", "3 agents reach Level 5"). Season templates: Neon Sprint, Deep Focus, Ship It, Blitz Mode. Auto-rotates on expiry.

5. **Credits Economy** (`credits.ts`): Cosmetic-only currency. Earned from quest completions. Shop catalog: room themes, desk LED colors, particle effects, name colors. Equip per-agent.

6. **Season HUD** (`season-hud.ts`): Screen-space overlay (top-right). Shows season name, progress bar, credits balance, active quest count. Toggle challenge checklist with `C` key.

**Integration points**: `workstation-animation.ts` hooks working→idle and idle→working transitions to start/complete quests and track stats. `office-workstation.ts` tracks rank-ups in leaderboard/season. `workstation-creation.ts` gates desk items by rank. `orchestrator.ts` awards credits alongside XP.

## Conventions

- In extracted module classes, use `this.scene.add.*` (not `this.add.*`) since only the Scene has `add`.
- Constants are `UPPER_SNAKE_CASE`, defined in `office-constants.ts`.
- Host interfaces (e.g., `BackgroundHostScene`, `RoomsHostScene`, `CafeHostScene`, `SelectionHostScene`) define the contract between modules and OfficeScene. New modules must follow this pattern.
- Types shared across modules go in `office-types.ts`, not duplicated per file.
- Pure utility functions (no scene dependency) go in `office-helpers.ts`.
- Camera pan is manual drag; `followTarget` for programmatic follow; zoom lerps in `update()`.
