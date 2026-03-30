## Implementation Plan: Issue #97 — Theme System Migration

### Findings Summary
- `office-theme.ts` already has **76 properties** in `OfficeTheme` with two complete theme objects (dark/light)
- `activeTheme` is already imported in **21 files** — the plumbing is in place
- `office-constants.ts` has **legacy color constants** (COLOR_BG, COLOR_WALL, etc.) that duplicate values already in the theme
- True new-property count needed: **~40 new theme properties** across terrain, corridors, interior, props, celebrations
- Semantic/intentionally-constant colors (eval glow, LED status, MCP server identity colors): keep as constants, document with comments

---

### Plan

**1. Expand `OfficeTheme` interface + update both theme objects**
File: `Penny/src/renderer/src/game/office-theme.ts`

Add the following property groups to the interface, with values in both dark and light theme objects:

| Group | New Properties |
|-------|----------------|
| Corridors | `corridorFloor`, `corridorStripe`, `corridorEdge`, `corridorCeiling` |
| Terrain base | `terrainGround`, `terrainGroundFar`, `terrainBuildingFar`, `terrainBuildingMid`, `terrainBuildingNear` |
| Terrain industrial | `reactorGlow`, `reactorPulse`, `reactorCore`, `pipeFill`, `pipeStroke`, `steelPlate`, `steelPlateAlt`, `makoGlow`, `makoGlowAlt` |
| Seasonal | `seasonWinter: {base: number, accent: number}`, `seasonSpring`, `seasonSummer`, `seasonAutumn` |
| Interior decorations | `clockFace`, `clockHand`, `clockMark`, `whiteboardFill`, `whiteboardStroke`, `whiteboardMarker`, `bookshelfWood`, `bookshelfSpine` |
| Activity indicators | `activityActive`, `activityWaiting`, `activityIdle` |
| Props | `arcadeFill`, `arcadeScreen`, `fishTankFill`, `fishTankGlow`, `vendingFill`, `serverRackFill`, `coffeeMachineFill`, `cafeFurniture`, `cafeCounter` |
| Celebrations | `celebrationColors: number[]` |
| Doors | `doorFill` |

Dark theme values: source from current hardcoded values in each file (dark theme baseline). Light theme values: derive lighter/inverted equivalents.

---

**2. Clean up `office-constants.ts`**
File: `Penny/src/renderer/src/game/office-constants.ts`

- **Remove** (migrate to theme): `COLOR_BG`, `COLOR_WALL`, `COLOR_DESK_BODY`, `COLOR_DESK_TOP`, `COLOR_HEADER_BG`, `COLOR_DOOR_FRAME`, `COLOR_DOOR_FILL`
- **Keep with JSDoc `@intentional` comments**: `COLOR_LED_GREEN`, `COLOR_LED_AMBER`, `COLOR_LED_GRAY`, `EVAL_GLOW_GREEN`, `EVAL_GLOW_AMBER`, `EVAL_GLOW_RED`, `EVAL_GLOW_GREY`, `MCP_SERVER_COLORS`
- Comment template: `/** @intentional Semantic status color — not theme-dependent */`

---

**3. Fix call sites that import legacy constants**
Files: `office-rooms.ts`, `office-ui.ts`, `room-renderer.ts`, any other files importing `COLOR_*` from `office-constants.ts`

Replace:
```ts
import { COLOR_HEADER_BG, COLOR_DOOR_FILL } from './office-constants'
// usage: COLOR_HEADER_BG
```
With:
```ts
import { activeTheme } from './office-theme'
// usage: activeTheme.headerBg, activeTheme.doorFill
```

---

**4. Migrate `office-corridors.ts` (~27 hardcoded colors)**
File: `Penny/src/renderer/src/game/office-corridors.ts`

Replace all `0x[hex]` literals for floor/stripe/edge/ceiling colors with `activeTheme.corridorFloor`, `.corridorStripe`, `.corridorEdge`, `.corridorCeiling`. Colors used for active/waiting status strips remain as semantic constants or reuse `activeTheme.activityActive` / `.activityWaiting`.

---

**5. Migrate `office-terrain.ts` (~149 hardcoded colors)**
File: `Penny/src/renderer/src/game/office-terrain.ts`

This is the largest file. Strategy:
- Replace `getSeasonalConfig()` hardcoded palette with `activeTheme.seasonWinter`, `.seasonSpring`, `.seasonSummer`, `.seasonAutumn`
- Replace terrain fill colors (ground, buildings, far/near layers) with `activeTheme.terrainGround`, `.terrainBuildingFar`, etc.
- Replace reactor/mako/pipe industrial colors with `activeTheme.reactorGlow`, `.makoGlow`, `.pipeFill`, etc.
- Replace steel plate variants with `activeTheme.steelPlate`, `.steelPlateAlt`

---

**6. Migrate `office-rooms.ts` (~32 hardcoded colors)**
File: `Penny/src/renderer/src/game/office-rooms.ts`

- Status strip colors (active → `activeTheme.activityActive`, waiting → `activeTheme.activityWaiting`, idle → `activeTheme.wall`)
- Remove imported `COLOR_HEADER_BG`, `COLOR_DOOR_FILL` constants (now covered by step 3)
- Any remaining hardcoded fills: map to nearest existing theme property or new one from step 1

---

**7. Migrate `office-interior.ts` (~30 hardcoded colors)**
File: `Penny/src/renderer/src/game/office-interior.ts`

- Clock colors → `activeTheme.clockFace`, `.clockHand`, `.clockMark`
- Whiteboard colors → `activeTheme.whiteboardFill`, `.whiteboardStroke`, `.whiteboardMarker`
- Bookshelf → `activeTheme.bookshelfWood`, `.bookshelfSpine`
- Activity indicators → `activeTheme.activityActive`, `.activityWaiting`, `.activityIdle`

---

**8. Migrate `interactive-props.ts` (~39 hardcoded colors)**
File: `Penny/src/renderer/src/game/interactive-props.ts`

- Arcade cabinet → `activeTheme.arcadeFill`, `.arcadeScreen`
- Fish tank → `activeTheme.fishTankFill`, `.fishTankGlow`
- Vending machine → `activeTheme.vendingFill`
- Server rack → `activeTheme.serverRackFill`
- Coffee machine → `activeTheme.coffeeMachineFill`
- Mako lamp / lava lamp glow colors → `activeTheme.reactorGlow`, `.makoGlow` (reuse terrain properties)

---

**9. Migrate `celebrations.ts` (~27 hardcoded colors)**
File: `Penny/src/renderer/src/game/celebrations.ts`

- Replace the inline color array literals used for particle effects with `activeTheme.celebrationColors`
- The dark theme array: current values verbatim. Light theme array: softer/more saturated equivalents.

---

**10. Migrate `penny-cafe.ts` (~19 hardcoded colors)**
File: `Penny/src/renderer/src/game/penny-cafe.ts`

- Furniture/counter → `activeTheme.cafeFurniture`, `.cafeCounter`
- Coffee machine → `activeTheme.coffeeMachineFill`
- Remaining accent fills → map to nearest existing theme property (wall, separator, panelBg)

---

**11. Migrate remaining files with < 20 colors**
Files: `atmosphere-sky.ts`, `office-particles.ts`, `office-ui.ts`, `workstation-creation.ts`, `workstation-animation.ts`, `office-workstation.ts`, `office-pods.ts`, `room-renderer.ts`, `season-hud.ts`, `office-ambient.ts`, `particles-weather.ts`, `juice-utils.ts`

- `atmosphere-sky.ts` (~15): add `skyGradientTop`, `skyGradientMid`, `skyGradientBot`, `starColor` to theme
- `office-particles.ts` (~15): already has `particleColors` array in theme — migrate any that aren't already using it
- All others: do a targeted pass replacing each hardcoded value with the closest existing `activeTheme` property; add new minimal properties only where no match exists

---

**12. Verify no visual regression**
- Run `npm run dev` in `Penny/`
- Load dark theme (default) and confirm game renders identically to pre-migration
- Call `setActiveTheme('light')` in dev console; confirm light theme renders correctly with new properties
- Check: rooms, corridors, terrain, workstations, cafe, props, celebrations all update

---

### Semantic Constants (Do Not Migrate)
Document in `office-constants.ts` with `@intentional` JSDoc:
- `COLOR_LED_GREEN/AMBER/GRAY` — agent status LEDs (always green=active, amber=waiting, gray=idle)
- `EVAL_GLOW_GREEN/AMBER/RED/GREY` — evaluation result indicators (red always means failure)
- `MCP_SERVER_COLORS` — server identity colors (per-server brand identity, not aesthetic)