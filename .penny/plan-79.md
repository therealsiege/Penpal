Based on my exploration, the camera infrastructure is **mostly complete**. The issue is about filling gaps in wiring and tuning defaults. Here's the plan:

---

## Implementation Plan — sidekick#79: Camera Juice

**Status:** Core machinery (`pulseZoom`, `smoothPanTo`, `focusAgentBriefly`, `zoomToFit`) already exists in `office-camera.ts`. Gaps are in wiring, defaults, and `PH.config` deep-merge.

---

### 1. Fix `PH.config` deep merge — `test-harness.ts`

`PH.config()` uses shallow `Object.assign(_globalConfig, patch)` which destroys nested camera objects (e.g. `camera.pulse`). Replace with `patchAnimConfig()`:

**File:** `Penny/src/renderer/src/game/test-harness.ts`
- In the `config(patch?)` method (~line 622–630): replace `Object.assign(_globalConfig, patch)` with `patchAnimConfig(patch)` (already exported from `animation-config.ts`)
- Add the import for `patchAnimConfig` at top of file if not present

---

### 2. Tune animation defaults to match issue spec — `animation-config.ts`

**File:** `Penny/src/renderer/src/game/animation-config.ts` (lines ~325–345)

Change factory defaults:

| Field | Current | Target |
|---|---|---|
| `pulse.taskComplete.delta` | `0.04` | `0.02` (2% as spec says) |
| `pulse.taskComplete.durationMs` | `220` | `200` |
| `pulse.rankUp.delta` | `0.07` | `0.05` (5%) |
| `pulse.errorZoomOut.delta` | `-0.06` | `-0.01` (1%) |
| `pulse.agentLeave.delta` | `-0.03` | `-0.01` (1%) |
| `epicQuestHoldMs` | `120` | `500` (issue says "hold 500ms") |
| `workstationRefitThreshold` | `2` | `3` (issue says ±3) |
| `pan.ease` | `'Sine.easeInOut'` | `'Power2.easeInOut'` |

Also update the TypeScript type declaration block (lines ~195–213) to add `epicQuestHoldMs` JSDoc clarification.

---

### 3. Wire desk/room click → smooth pan — `OfficeScene.ts`

**File:** `Penny/src/renderer/src/game/OfficeScene.ts`

**3a.** Find `agentClickedHandler` (~line 635 area). If it doesn't already call `navigateCameraToAgent(agentId)`, add that call so clicking an agent in a far room triggers the smooth pan.

**3b.** Find the `EVENTS.DESK_CLICKED` listener (or add one in `create()`):
```typescript
EventBus.on(EVENTS.DESK_CLICKED, (...args: unknown[]) => {
  const [wx, wy] = args as [number, number]
  this.smoothNavigateCameraTo(wx, wy)
})
```
This handles clicking room/desk areas that emit world coordinates.

**3c.** Verify `onCameraJuice` is wired as a callback to `CelebrationManager` (or EventBus listener). Confirm `taskComplete` and `rankUp` hints actually reach `officeCamera.pulseZoom()`. If the wiring exists via callback in `celebrations.ts`, no change needed — just verify. If via EventBus, confirm the event name matches.

---

### 4. Emit `DESK_CLICKED` with world coords from room interaction — `office-rooms.ts`

**File:** `Penny/src/renderer/src/game/office-rooms.ts`

Find where room/desk pointerdown or click events are handled. When a desk or room header is clicked, emit:
```typescript
EventBus.emit(EVENTS.DESK_CLICKED, worldX, worldY)
```
This feeds step 3b above. If `EVENTS.DESK_CLICKED` already carries world coords, no change. Verify the payload matches `[number, number]`.

---

### 5. Verify `EVENTS.DESK_CLICKED` exists in events registry — `events.ts`

**File:** `Penny/src/renderer/src/game/events.ts`

Confirm `DESK_CLICKED` is in the `EVENTS` const with value `'desk:clicked'`. If missing, add it.

---

### 6. End-to-end acceptance check (no code change — executor verifies)

After all changes, verify via `PH.config({ camera: { pulse: { taskComplete: { delta: 0.05 } } } })` in browser console that:
- Nested camera config patches without clobbering sibling keys
- Task complete triggers visible zoom pulse (2% in, 200ms)
- Room-to-room desk click smoothly pans (400–800ms, Power2 ease)
- Agent arrival pans camera to new desk (~800ms)
- `±3` agent count change triggers slow 1s zoom-to-fit

---

**Summary of files to touch:**

| File | Change |
|---|---|
| `test-harness.ts` | Replace Object.assign with patchAnimConfig |
| `animation-config.ts` | Tune 7 default values |
| `OfficeScene.ts` | Wire agentClickedHandler + DESK_CLICKED listener |
| `office-rooms.ts` | Emit DESK_CLICKED with world coords on room/desk click |
| `events.ts` | Confirm/add DESK_CLICKED if missing |