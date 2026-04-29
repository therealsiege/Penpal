# Penpal — Agent Office Simulator

> Penpal is the Electron app. Penny is the cafe-owner character within the simulation. References to "Penny" in class names (`PennyCafe`, `PennyHarness`), the `.penny-worktrees/` directory, the slack bot username, the MCP server id, and the `penny-sfx://` protocol all refer to the character and are intentional.

Electron desktop app with a Phaser 3 isometric office that visualizes Claude Code agent sessions as animated characters working at desks. Each agent gets a workstation with sprite, monitor, status indicators, and ambient animations.

## Stack

Electron 33, electron-vite 5, React 18, Phaser 3.90, Tailwind 3, TypeScript 5.7, Zustand (state), xterm.js (terminal), CodeMirror 6 (editor), neo4j-driver (graph queries).

## Directory Structure

- `src/main/` — Electron main process (IPC handlers, system integration)
- `src/preload/` — contextBridge IPC exposure
- `src/renderer/src/` — React shell + Phaser game
  - `game/` — All Phaser scene code (50+ files, ~20,000 lines total)
  - `types.ts` — Shared types (`AgentState`, `OpencodeSession`, `XP_RANKS`)

## Sprite Sheets & Build Scripts

9 individual build scripts in `scripts/`, plus a master runner:

| Script | Output | Description |
|--------|--------|-------------|
| `build-sprites.mjs` | `characters.png` | 3-row character sheet (256x512 per frame) |
| `build-game-icons.mjs` | `game-icons.png` | 32x32 icons: stars, medals, checkmarks, circles, arrows |
| `build-game-items.mjs` | `game-items.png` | 32x32 desk items: coffee, book, headphones, pizza, etc. |
| `build-desk-pets.mjs` | `desk-pets.png` | 24x24 pet body sprites (6 colors) |
| `build-pet-faces.mjs` | `desk-pet-faces.png` | 16x8 pet face parts (4 eye pairs + 4 mouths) |
| `build-lego-bar.mjs` | `lego-bar.png` | 16x8 XP bar segments (5 colors) |
| `build-lego-specials.mjs` | `lego-specials.png` | 24x24 special items (coin, crate, grade A) |
| `build-icons-hd.mjs` | `game-icons-hd.png` | 64x64 HD icons for LOD3 detail |
| `build-ui-panels.mjs` | UI panel images | Slider tracks, dividers, panel backgrounds |
| **`build-all-sprites.mjs`** | All of above | Master runner — `npm run sprites:all` |

## Game Architecture

OfficeScene.ts was originally a monolithic 8000+ line file. It has been fully decomposed into 18 focused modules plus the orchestrator. OfficeScene (~4650 lines) is now the orchestrator only — it instantiates and coordinates all subsystems but contains no rendering logic that belongs in a module.

### Module Pattern

Each extracted module is a class that receives `Phaser.Scene` in its constructor. Modules that need callbacks into OfficeScene define a host interface (e.g., `BackgroundHostScene`, `RoomsHostScene`, `CafeHostScene`, `SelectionHostScene`) specifying the contract. This avoids circular imports — the module depends on an interface, not on OfficeScene directly. Pure utility functions go in `office-helpers.ts` with no class or scene dependency.

### Module List (by size)

| File | Lines | Description |
|------|------:|-------------|
| `OfficeScene.ts` | ~4700 | Orchestrator. Owns agent sync, camera, update loop, delegates to all modules. Camera pull-back on world expansion. |
| `workstation-animation.ts` | ~1200 | All animation, mood, monitor-glow, blocked-indicator, thought-bubble, idle micro-variety (pet glance, item tap, energy glance). |
| `workstation-creation.ts` | ~1100 | Desk/chair/monitor/sprite creation, layout, cleanup. Rank-gated cosmetics, signature items, desk pets, energy bars. |
| `office-workstation.ts` | ~1700 | Workstation lifecycle: creation, destruction, sprite setup, monitor glow, XP bars, task counters, sparklines, progress rings, LOD arrays. |
| `office-background.ts` | ~740 | Team area rendering, layout orchestration, coordinates OfficeTerrain, OfficeCorridors, OfficeInterior. Defines `BackgroundHostScene`. |
| `office-terrain.ts` | ~600 | Outdoor terrain: steel floor plates, reactor, seasonal trees. Parallax scroll (0.95x). |
| `office-interior.ts` | ~500 | Office background: floor tiles, whiteboard, reactor glow, room activity indicators. |
| `office-corridors.ts` | ~400 | Corridor connectors, hallway indicators, floor arrows between rooms. |
| `celebrations.ts` | ~1130 | CelebrationManager: rank-up, task-complete (checkmark sprite), milestone (screen shake), error (screen shake), quest reward, season ceremonies, purchase, xp-gain effects. |
| `penny-cafe.ts` | ~830 | Cafe area with stools, coffee run animations, social emoji interactions. Defines `CafeHostScene`. |
| `cafe-coffee-run.ts` | ~410 | CafeCoffeeRunManager: agent walk-to-cafe, barista service, sip animations. |
| `office-particles.ts` | ~830 | Particle pool systems: sparkle trails, ambient motes, steam, mako motes, sparks. |
| `particles-weather.ts` | ~225 | Rain drops (with lightning), snow flakes (STAR_GREY sprites), weather control. |
| `particles-ambient.ts` | ~200 | Ambient floating particles in corridors. |
| `office-ui.ts` | ~920 | Screen-space overlays: notification toasts, rich hover tooltips (with pet/item preview sprites, status dot sprites), hover ring, help overlay, debug overlay, LOD label, status bar. |
| `office-atmosphere.ts` | ~740 | Day/night cycle, sky gradient, starfield, clouds, ceiling lights, wall clock, shadows. Dawn/dusk transition flash overlay. |
| `atmosphere-sky.ts` | ~200 | Sky gradient rendering, star/cloud management. |
| `atmosphere-lighting.ts` | ~175 | Window glint, ceiling light activity, chime ripple pool. |
| `office-rooms.ts` | ~1070 | Room creation, rendering, doors, headers, room haze. Animated room resize (scale tween on dimension change). |
| `office-selection.ts` | ~550 | Keyboard agent selection (Tab/Shift-Tab), selection ring, auto-pan cycling, focus mode. |
| `office-minimap.ts` | ~440 | Screen-space minimap with room outlines, viewport indicator, click-to-pan, hover labels, room flash alerts. |
| `office-pods.ts` | ~465 | Pod connecting lines, agent-to-agent chat dot animations (CIRCLE_BLUE sprites), rivalry VFX. |
| `office-ambient.ts` | ~260 | Ambient office-life micro-animations: paper airplanes, coffee refills, phone rings, printer noise, door peeks. |
| `office-camera.ts` | ~400 | Camera management, zoom-to-fit, follow target, drag handling, bounds. |
| `nav-mesh.ts` | ~250 | `NavMesh` class. A* grid pathfinding on 12px cells. |
| `path-walker.ts` | ~175 | Reusable walk utility with directional animation frames, shadow tracking, footstep dust puffs. |
| `office-theme.ts` | ~220 | Color theme definitions. Only `dark` is functional — light/neon defined but 100+ hardcoded hex values prevent switching. |
| `office-types.ts` | ~170 | Shared type definitions: `WorkstationSprite`, `Room`, `PodLineInfo`, etc. |
| `office-helpers.ts` | ~165 | Pure stateless utility functions. |
| `office-constants.ts` | ~150 | All numeric/string constants. `UPPER_SNAKE_CASE`. |
| `office-asset-keys.ts` | ~270 | Centralized registry of all spritesheet keys, frame indices, animation keys. |
| `office-layout.ts` | ~100 | Room layout computation (grid rows/cols from agent count). |
| `room-renderer.ts` | ~56 | Room type detection, procedural color templates. |
| `room-visibility.ts` | ~100 | Camera frustum culling for room containers. |
| `events.ts` | ~75 | `EventBus` singleton (pub/sub) for scene-to-React communication. |
| `OfficeGame.ts` | ~40 | Bootstraps Phaser with RESIZE scale mode, WebGL. |
| `quest-system.ts` | ~220 | Quest auto-wrapper with difficulty inference and XP/credit multipliers. |
| `cosmetic-tiers.ts` | ~185 | Rank-based cosmetic tier definitions (L1-L10). |
| `leaderboard.ts` | ~235 | Season XP rankings, weekly MVP, rivalry detection. |
| `seasons.ts` | ~310 | Seasonal arc system with themed challenges. |
| `season-hud.ts` | ~280 | Season HUD overlay (leaderboard L key, challenges C key). |
| `credits.ts` | ~200 | Cosmetic credits economy and shop catalog. |
| `agent-mood.ts` | ~100 | Mood config and mood bubble definitions. |
| `animated-bar.ts` | ~80 | Animated progress bar component. |
| `interactive-props.ts` | ~100 | Clickable office props (whiteboard, printer). |
| `achievements.ts` | ~150 | Achievement tracking and unlock logic. |
| `cafe-chat.ts` | ~200 | Cafe social chat system between seated agents. |
| `juice-utils.ts` | ~60 | fadeInUp, fadeOutDown, pulse tween helpers. |
| `base-scene.ts` | ~40 | Base scene class. |
| `state-machine.ts` | ~80 | Simple state machine for agent status transitions. |
| `sound-engine.ts` | ~60 | Sound effect management (currently audio-disabled). |
| `component-system.ts` | ~80 | ECS-lite component attachment system. |
| `room-config-loader.ts` | ~40 | Load room config from YAML/JSON. |

## Key Patterns

**LOD System** — 3 levels based on camera zoom: L1 overview (room outlines only), L2 room-level (agents, desks, status dots, names), L3 full detail (accessories, lamps, mugs, monitor text, mood emoji). Workstations track `lodLevel2Objects` and `lodLevel3Objects` arrays.

**WorkstationSprite** — Rich interface defined in `office-types.ts`: sprite, desk, monitor with glow FX, thought bubble, blocked indicator, XP bar, task counter, sparkline, sound waves, progress ring, shadow, uptime text, energy bar, desk pet, signature item.

**Spritesheets** — Compact format: 17 frames per row (4 idle rotations + 12 walk rotations + 1 sit). Loaded as animation strips, 256x512 per frame.

**Theme Colors** — 3 themes (dark/light/neon) defined in `office-theme.ts` with 30+ properties. All rendering code references `activeTheme.x` — no hardcoded dark-palette hex values remain outside the theme definitions. Press **T** to cycle themes at runtime.

**Particle Pools** — Pre-allocated circles recycled with `.getData('busy')` flag. Tweens set `busy=true` on use, `busy=false` on complete.

**Screen-space Overlays** — Use `.setScrollFactor(0)` and high depth values (9996-10001). Day/night overlay is depth 9997.

**Depth Ordering** — Sky: -11, terrain: -10, office bg: -4 to -1, world objects: 50-500, chat lines: 200, screen overlays: 9996-10001, debug: 11000.

**Text Resolution** — All `Phaser.GameObjects.Text` use `resolution: 2` for Retina clarity.

**Sprite-first rendering** — Prefer sprites from the GAME_ICONS sheet over `add.circle()` for status dots, snow flakes, dust puffs, pod chat dots, and tooltip indicators. This ensures crisp rendering at all zoom levels.

## Development

```
npm run dev          # electron-vite dev server with HMR
npm run build        # production build
npm run sprites      # rebuild character spritesheet
npm run sprites:all  # rebuild ALL sprite sheets (9 scripts)
npm run sprites:icons # rebuild game icons only
npx tsc --noEmit     # type check
```

## Animation Features

- **Room resize animation** — When agent count changes room dimensions, the container tweens from old→new scale over 300ms.
- **Camera pull-back** — When world expands (new rooms), camera briefly zooms out 12% then eases back to show expanded area.
- **Screen shake** — `cameras.main.shake(100, 0.003)` on milestones, `shake(60, 0.002)` on errors.
- **Footstep dust** — PathWalker spawns tiny CIRCLE_GREY dust puff sprites every 3 walk cycles during walks.
- **Parallax terrain** — Terrain layer scrolls at 0.95x camera speed for subtle depth.
- **Dawn/dusk flash** — Brief warm/cool color flash overlay when atmosphere crosses phase thresholds.
- **Task complete checkmark** — Uses CHECKMARK sprite (tinted green) instead of text character.
- **Snow flakes** — STAR_GREY sprites for crystalline look instead of circles.
- **Pod chat dots** — CIRCLE_BLUE sprites for traveling data dots.
- **Tooltip preview** — Shows desk pet + signature item sprites alongside agent stats.
- **Idle micro-variety** — Agents look at desk pet, tap signature item, glance at energy bar when low.
- **Desk plant leaf** — CIRCLE_GREEN sprite replaces the last `add.circle` for consistency.

## Fragile Areas

- **Room layout** — `calcRoomSize()` in OfficeScene + rendering in `office-background.ts` / `office-rooms.ts` have tightly coupled positioning math. Changes cascade.
- **LOD visibility** — `applyLodToWorkstation()` requires objects in correct `lodLevel2Objects` / `lodLevel3Objects` arrays or they vanish at wrong zoom levels.
- **Workstation creation** — `workstation-creation.ts` `createWorkstation()` is very long with many interdependent parts (tweens reference each other, depth ordering matters).
- **update() loop** — Throttled tick calls with `lastXxxAt` timestamps. Execution order matters (atmosphere before particles, camera before minimap).
- **NavMesh rebuild** — Must be called after room layout changes; stale mesh = agents walk through walls.
- **Host interfaces** — When adding new module callbacks, update the corresponding host interface and the OfficeScene implementation.
- **Room resize tween** — Scale tween must complete before layout recalculation or child positions drift.
- **Camera pull-back** — Triggered by worldWidth/Height growth >50px; could conflict with user's manual zoom if poorly timed.

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
- Prefer sprites from GAME_ICONS/GAME_ITEMS sheets over `add.circle()` for visual elements.
- All particle/VFX tweens should be <=300ms duration with low alpha changes for subtlety.
- All rendering colors must use `activeTheme.x` — never hardcode hex values from the dark palette.
