Here is the implementation plan:

---

## Implementation Plan — Walk Track System (#159)

### Context Summary
- `GDS_STOOL_POSITIONS` in `gds-scene-renderer.ts` — 10 hardcoded desk positions (no IDs, no walk tracks)
- `getWalkableTiles()` is called on `gdsRenderer` from `office-background.ts` but the method doesn't exist yet
- `WorkstationHost` has `getOrAssignGdsDeskSlot?` but no walk-track accessor
- Walk break timer in `workstation-animation.ts` (lines 776–855) currently always picks a random nearby point

---

### 1. Create `Penny/public/sprites/lab-map.json`

New JSON file. Structure mirrors `GDS_STOOL_POSITIONS` but adds `id` and `walkTrack`. All 10 desks get `walkTrack: null` initially, with **2–3 populated as examples** (e.g., `bot-left-upper`, `bot-center-1`) to verify the feature end-to-end.

Also include a top-level `walkableRects` array (list of `{ x, y, w, h }` rects in GDS space) so `getWalkableTiles()` can finally be implemented.

```json
{
  "walkableRects": [ ... ],
  "desks": [
    { "id": "top-room",        "x": 1824, "y": 294,  "flipX": false, "sitFrame": 3, "angle": 0, "walkTrack": null },
    { "id": "mid-console",     "x": 1478, "y": 958,  "flipX": false, "sitFrame": 2, "angle": 0, "walkTrack": null },
    ...
    { "id": "bot-left-upper",  "x": 880,  "y": 1669, "flipX": false, "sitFrame": 1, "angle": 0,
      "walkTrack": { "points": [{"x":880,"y":1669},{"x":1100,"y":1669},{"x":1100,"y":1400},{"x":880,"y":1400}], "loop": true } },
    ...
  ]
}
```

Y values = original Y + `STOOL_Y_NUDGE` (40), matching the existing hardcoded values.

---

### 2. `Penny/src/renderer/src/game/gds-scene-renderer.ts`

**a. Add types:**
```ts
interface LabMapWalkTrack { points: { x: number; y: number }[]; loop: boolean }
interface LabMapDesk { id: string; x: number; y: number; flipX: boolean; sitFrame: number; angle: number; walkTrack: LabMapWalkTrack | null }
interface LabMapJson { walkableRects: { x: number; y: number; w: number; h: number }[]; desks: LabMapDesk[] }
```

**b. Load `lab-map.json` in `render()`:**
- Accept an optional `labMap: LabMapJson | null` parameter (or store it separately via a `setLabMap(data)` call before `render()`).
- Since this is a Phaser renderer (no Node.js `fs`), the preload step in OfficeScene already loads JSON as a Phaser cache key. Add `getWalkTrackForSlot(idx)` and `getWalkableTiles()` that read from the loaded data.

**c. Replace `GDS_STOOL_POSITIONS` usage:**
- When `labMap` is set, use `labMap.desks` as the slot list (same shape, just read from JSON instead of hardcoded array). Keep the hardcoded array as fallback for when no lab-map is loaded.

**d. Add `getWalkableTiles()`:**
```ts
getWalkableTiles(): { x: number; y: number; w: number; h: number }[] {
  if (!this.rendered || !this.labMap) return []
  return this.labMap.walkableRects.map(r => ({
    x: this.originX + r.x * this.scale,
    y: this.originY + r.y * this.scale,
    w: r.w * this.scale,
    h: r.h * this.scale,
  }))
}
```

**e. Add `getWalkTrackForSlotIndex(idx)`:**
```ts
getWalkTrackForSlotIndex(idx: number): { points: { x: number; y: number }[]; loop: boolean } | null {
  const desk = this.labMap?.desks[idx] ?? null
  if (!desk?.walkTrack) return null
  // Convert GDS → world space
  return {
    loop: desk.walkTrack.loop,
    points: desk.walkTrack.points.map(p => ({
      x: this.originX + p.x * this.scale,
      y: this.originY + p.y * this.scale,
    })),
  }
}
```

**f. Add `loadLabMap(data: LabMapJson)`:** Public method called from OfficeScene after Phaser loads the JSON cache entry.

---

### 3. `Penny/src/renderer/src/game/office-background.ts`

**a. Call `gdsRenderer.loadLabMap(data)`** in the existing GDS scene init path, after the JSON asset is loaded from Phaser cache.

**b. Add `getGdsWalkTrackForAgent(agentId: string)`:**
```ts
getGdsWalkTrackForAgent(agentId: string): { points: { x: number; y: number }[]; loop: boolean } | null {
  const idx = this.gdsRenderer.getAssignedSlotIndex(agentId)
  if (idx === undefined) return null
  return this.gdsRenderer.getWalkTrackForSlotIndex(idx)
}
```
Also expose `getAssignedSlotIndex(agentId)` (already tracked in `assignedSlots` map — just needs a getter).

---

### 4. `Penny/src/renderer/src/game/office-workstation.ts` — `WorkstationHost` interface

Add optional method:
```ts
/** Returns world-space walk track for the agent's GDS desk slot, or null if none. */
getGdsWalkTrackForAgent?(agentId: string): { points: { x: number; y: number }[]; loop: boolean } | null
```

---

### 5. `Penny/src/renderer/src/game/OfficeScene.ts`

Wire up the new host method:
```ts
getGdsWalkTrackForAgent: (agentId: string) =>
  scene.background.hasGdsScene() ? scene.background.getGdsWalkTrackForAgent(agentId) : null,
```

---

### 6. `Penny/src/renderer/src/game/workstation-animation.ts` — Walk break timer (lines 776–855)

In the `walkBreakTimer` callback, **before** the random-point logic, check for a walk track:

```ts
// -- Walk track: use predefined patrol path if available --
const walkTrack = this.host.getGdsWalkTrackForAgent?.(agent.config.id) ?? null
if (walkTrack && walkTrack.points.length >= 2) {
  this._executeWalkTrack(ws, agent, walkTrack, ownerRoom, worldX, worldY, base, gdsLock)
  return
}
// ...existing random walk code continues...
```

Add private method `_executeWalkTrack(...)`:
- Build the ordered waypoint list (points are already world-space from the renderer)
- Use `navMesh.findPath` between each consecutive point pair OR walk them directly as waypoints (since they're authored positions, direct waypoints without pathfinding are acceptable — use `PathWalker.startPath` with the raw array)
- `loop: true` → walk forward through all points, then reverse the list and walk back
- `loop: false` → walk forward to end, pause 800ms, walk directly back (reverse path)
- Use the same `walkBreakTween` sentinel + `finishWalk` pattern as the existing random walk
- Same `PathWalker` instance — directional frames handled automatically by `PathWalker.directionFrame`

---

### 7. `Penny/tests/e2e/walk-tracks.spec.ts` — New test file

```ts
// Assert an agent with a configured walkTrack visits each point in sequence
// and returns to desk after track completes.
// Use window.__inspectWorkstations (per feedback memory) for inspection.
```

Tests:
1. **Config present**: desk with walkTrack visits each point (check `pathWalker` positions via `__inspectWorkstations`)
2. **Sequence order**: waypoints visited 0→N
3. **Return**: agent returns to starting world position
4. **Fallback**: desk with `walkTrack: null` still performs a walk (random)

---

### File Change Summary

| File | Change |
|---|---|
| `Penny/public/sprites/lab-map.json` | **Create** — 10 desk entries, 2–3 with walk tracks, walkableRects |
| `Penny/src/renderer/src/game/gds-scene-renderer.ts` | Add types, `loadLabMap()`, `getWalkableTiles()`, `getWalkTrackForSlotIndex()`, `getAssignedSlotIndex()` |
| `Penny/src/renderer/src/game/office-background.ts` | Call `loadLabMap()` on init, add `getGdsWalkTrackForAgent()` |
| `Penny/src/renderer/src/game/office-workstation.ts` | Add `getGdsWalkTrackForAgent?` to `WorkstationHost` |
| `Penny/src/renderer/src/game/OfficeScene.ts` | Wire `getGdsWalkTrackForAgent` into the host object |
| `Penny/src/renderer/src/game/workstation-animation.ts` | Check for walk track before random walk; add `_executeWalkTrack()` |
| `Penny/tests/e2e/walk-tracks.spec.ts` | **Create** — 4 E2E assertions |