# Penny — Agent Office Simulator

Electron desktop app with a Phaser 3 isometric office that visualizes Claude Code agent sessions as animated characters working at desks. Each agent gets a workstation with sprite, monitor, status indicators, and ambient animations.

## Stack

Electron 33, electron-vite 5, React 18, Phaser 3.90, Tailwind 3, TypeScript 5.7, Zustand (state), xterm.js (terminal), CodeMirror 6 (editor), neo4j-driver (graph queries).

## Directory Structure

- `src/main/` — Electron main process (IPC handlers, system integration)
- `src/preload/` — contextBridge IPC exposure
- `src/renderer/src/` — React shell + Phaser game
  - `game/` — All Phaser scene code (see Game Architecture below)
  - `types.ts` — Shared types (`AgentState`, `OpencodeSession`, `XP_RANKS`)

## Game Architecture

**OfficeGame.ts** — Bootstraps Phaser with `RESIZE` scale mode, transparent background, WebGL, no audio. Returns `{ game, scene }`.

**OfficeScene.ts** — The single scene. Very large file being decomposed into modules:
- `office-particles.ts` — Particle pool systems (rain, snow, sparkle trails, effects)
- `office-atmosphere.ts` — Day/night cycle, sky gradient, ceiling lights, wall clock, shadows, weather
- `office-theme.ts` — 3 themes (`dark` / `light` / `neon`), exported `activeTheme` global
- `nav-mesh.ts` — A* grid pathfinding, 12px cells, blocked-by-default with walkable rooms/corridors/doors
- `penny-cafe.ts` — Cafe area subsystem (stools, coffee runs, social emoji interactions)
- `room-renderer.ts` — Room type detection from cwd path keywords, procedural color templates
- `events.ts` — `EventBus` singleton for scene-to-React communication (`AGENT_CLICKED`, `BROADCAST`, etc.)

## Key Patterns

**LOD System** — 3 levels based on camera zoom: L1 overview (room outlines only), L2 room-level (agents, desks, status dots, names), L3 full detail (accessories, lamps, mugs, monitor text, mood emoji). Workstations track `lodLevel2Objects` and `lodLevel3Objects` arrays.

**WorkstationSprite** — Rich interface: sprite, desk, monitor with glow FX, thought bubble, blocked indicator, XP bar, task counter, sparkline, sound waves, progress ring, shadow, uptime text. Many optional tweens for animation states.

**Spritesheets** — Compact format: 17 frames per row (4 idle rotations + 12 walk rotations + 1 sit). Loaded as individual animation strips (`walk-1.png`, `idle-1.png`, `sit-1.png`, etc.), 256x512 per frame.

**Theme Colors** — Always use `activeTheme.propertyName`, never hardcoded hex values. Theme switch via `setActiveTheme(name)` then caller redraws.

**Particle Pools** — Pre-allocated circles recycled with `.getData('busy')` flag pattern. Tweens set `busy=true` on use, `busy=false` on complete.

**Screen-space Overlays** — Use `.setScrollFactor(0)` and high depth values (9996-10001). Day/night overlay is depth 9997.

**Phaser FX Pipeline** — `postFX` used for vignette, monitor glow (`Phaser.FX.Glow`).

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

- **Room layout** — `layoutRooms()` / `calcRoomSize()` have tightly coupled positioning math. Changes cascade.
- **LOD visibility** — `applyLodToWorkstation()` requires objects in correct `lodLevel2Objects` / `lodLevel3Objects` arrays or they vanish at wrong zoom levels.
- **Workstation creation** — `createWorkstation()` is very long with many interdependent parts (tweens reference each other, depth ordering matters).
- **update() loop** — Throttled tick calls with `lastXxxAt` timestamps. Execution order matters for some subsystems (atmosphere before particles, camera before minimap).
- **NavMesh rebuild** — Must be called after room layout changes; stale mesh = agents walk through walls.

## Conventions

- In extracted module classes, use `this.scene.add.*` (not `this.add.*`) since only the Scene has `add`.
- Constants are `UPPER_SNAKE_CASE`, defined at module file top.
- Interfaces for host-scene dependencies (e.g., `CafeHostScene`) define the contract between modules and OfficeScene.
- Camera pan is manual drag; `followTarget` for programmatic follow; zoom lerps in `update()`.
