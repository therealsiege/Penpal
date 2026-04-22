# Pod Task Context (auto-scoped)

**Task**: Fix GitHub issue therealsiege/Penpal#355: Theme audit follow-up — replace remaining hardcoded hex values with activeTheme references. See issue body for exact file locations and values. Also fix particle pool re-init on theme switch and remove unused accent property.

## Stack
Electron 33, electron-vite 5, React 18, Phaser 3.90, Tailwind 3, TypeScript 5.7, Zustand (state), xterm.js (terminal), CodeMirror 6 (editor), neo4j-driver (graph queries).

## Directory Structure
- `src/main/` — Electron main process (IPC handlers, system integration)
- `src/preload/` — contextBridge IPC exposure
- `src/renderer/src/` — React shell + Phaser game
  - `game/` — All Phaser scene code (50+ files, ~20,000 lines total)
  - `types.ts` — Shared types (`AgentState`, `OpencodeSession`, `XP_RANKS`)

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

## Relevant Files
```
office-particles.ts
particles-weather.ts
particles-ambient.ts
office-theme.ts
```

## Recent Changes to These Files
```
(no history)
```

## Active Pod Branches (avoid conflicting)
```
origin/pod-204-rpg-layer-2-player-character-with-wasd-m
  origin/pod-212-rpg-anim-1-8-direction-character-sprites
  origin/pod-241-living-lab-2c-monitor-screensaver-pipe-p
  origin/pod-244-living-lab-3c-room-zone-ambient-lights-c
  origin/pod-251-living-lab-6b-task-lifecycle-vfx-start-c
  origin/pod-252-living-lab-6c-pod-communication-pulse-ce
  origin/pod-315-audio-1a-enable-phaser-audio-connect-aud
  origin/pod-316-audio-1b-sfx-triggers-task-lifecycle-cel
  origin/pod-317-theme-1a-audit-rendering-eliminate-hardc
  origin/pod-318-camera-1a-cinematic-letterbox-bars-for-k
  origin/pod-319-polish-1a-in-game-settings-menu-volumes
  origin/pod-320-polish-1b-session-replay-record-and-play
  origin/pod-333-refactor-1a-extract-tween-lifecycle-mana
  origin/pod-334-refactor-1b-fix-audio-manager-settimeout
  origin/pod-337-refactor-3a-sync-walk-animation-frame-ra
  origin/pod-338-refactor-3b-add-particle-pool-size-caps
  origin/pod-339-infra-1a-pod-pipeline-add-cleanup-flag-f
```
