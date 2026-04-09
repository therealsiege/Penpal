Now I have everything needed. Here is the implementation plan:

---

## Implementation Plan — therealsiege/sidekick#151

### 1. Extract walk break body into a private method (`Penny/src/renderer/src/game/workstation-animation.ts`)

**Where:** In `WorkstationAnimator`, add a new private method below the existing `setupIdleAnimations` method:

```typescript
private _executeWalkBreak(ws: WorkstationSprite, agent: AgentState): void
```

Move the entire body of the `walkBreakTimer` callback (the code after the `stillIdle` guard — finding navMesh, owner room, computing world/target coords, clamp, pathfind, create walkSprite, PathWalker, finishWalk) into this method. The timer callback becomes:

```typescript
callback: () => {
  if (!ws.state || ws.walkBreakTween || !ws.sprite.visible) return
  const stillIdle = !ws.state.needsInteraction &&
    ws.state.sessionMode !== 'working' && ...
  if (!stillIdle) return
  this._executeWalkBreak(ws, agent)
}
```

Inside `_executeWalkBreak`, `gdsLock` is recomputed as `this.host.getOrAssignGdsDeskSlot != null` and `base` via `getAgentCharacterIndex(agent) === 1 ? FRAME_WALK_2_BASE : FRAME_WALK_1_BASE` (same as the existing timer body).

### 2. Add `triggerWalkBreak(agentId: string): boolean` to `WorkstationAnimator`

```typescript
triggerWalkBreak(agentId: string): boolean {
  for (const room of this.host.getRooms().values()) {
    const ws = room.workstations.get(agentId)
    if (!ws?.state || ws.walkBreakTween) continue
    this._executeWalkBreak(ws, ws.state)
    return true
  }
  return false
}
```

### 3. Delegate in `OfficeWorkstations` (`Penny/src/renderer/src/game/office-workstation.ts`)

Add after the existing delegation block:

```typescript
triggerWalkBreak(agentId: string): boolean {
  return this.animator.triggerWalkBreak(agentId)
}
```

### 4. Expose `wsAnimator` getter on `OfficeScene` (`Penny/src/renderer/src/game/OfficeScene.ts`)

Add a getter so `scene.wsAnimator` works in `evalInScene`:

```typescript
get wsAnimator(): OfficeWorkstations { return this.wsManager }
```

(Return type is `OfficeWorkstations` since it's the public surface. The issue's test API `scene.wsAnimator.triggerWalkBreak(id)` will resolve correctly.)

### 5. Create `Penny/tests/e2e/navmesh-walking.spec.ts`

Full test file structure:

**Imports / setup** — same pattern as `cafe-automation.spec.ts`: `launchApp`, `waitForPhaser`, `evalInScene`, single `beforeAll`/`afterAll`, 2s settle.

**Helper: `patchForNavMesh()`** — mirrors `patchForCoffeeRun`. Re-enables `navMesh.disabled = false`, rebuilds navmesh if `gridW === 0`, ensures the scene is not in GDS mode (or sets up minimal building bounds). Called before each navigation test.

**Helper: `triggerWalkBreak(agentId)`** — calls `evalInScene` with `scene.wsAnimator.triggerWalkBreak(agentId)`.

**Helper: `getWalkState(agentId)`** — returns `{ isWalking, worldX, worldY, frameName, walkBreakActive }` by reading `ws.container.x/y` relative to owner room + `ws.sprite.frame.name` + `!!ws.walkBreakTween`.

**Tests (7):**

1. **`NavMesh grid is built with walkable cells`** — `evalInScene` to call `navMesh.getStats()`, assert `walkable > 0` and `gridW > 0`. Skips if PH unavailable.

2. **`Agent spawns at valid desk position`** — `addAgents([idle agent])`, read `ws.container.x/y` + owner room position, check `navMesh.isPointWalkable(worldX, worldY)` returns true OR is within a walkable room rect (uses `buildOwnRoomRect` logic). Skip if PH unavailable.

3. **`triggerWalkBreak sets walkBreakTween sentinel`** — patch navmesh, `addAgents([idle agent])`, call `triggerWalkBreak`, poll 500ms, assert `ws.walkBreakTween !== undefined`. Skip if PH unavailable.

4. **`Walk path stays within room bounds`** — patch navmesh, trigger walk break, capture agent world position every 100ms for 3s (via `getWalkState` in a polling loop), assert all captured positions are within the owner room bounds clamped rect (same `roomLeft/Top/Right/Bottom` formula as in `_executeWalkBreak`). Skip if PH unavailable.

5. **`Agent returns to desk after walk break`** — trigger walk break, wait up to 8s polling every 200ms for `walkBreakTween` to clear AND `sprite.visible === true`, then assert position is near original desk position (within 4px). Skip if PH unavailable.

6. **`Walk animation uses directional frames (not frame 0 exclusively)`** — patch navmesh, trigger walk break, collect `ws.sprite.frame.name` over 1.5s, assert that at least 2 distinct frames appear (rules out spinning stuck on frame 0). Skip if PH unavailable.

7. **`Multiple agents walking simultaneously do not share world position`** — `addAgents([idle-A, idle-B])`, trigger walk break on both, poll positions for 2s, assert that at no sample do both agents share the same `(Math.round(worldX/10), Math.round(worldY/10))` bucket. Skip if PH unavailable.

**Visual regression test** (separate `projects: visual` match):

8. **`Lab screenshot with agents at desks matches baseline`** — `addAgents([working, working])`, wait 1s for settle, take `window.screenshot({ path: 'tests/screenshots/navmesh-baseline.png' })`, assert file exists. On subsequent runs, compare pixel-level diff (Playwright built-in `toHaveScreenshot`). Tagged `@visual`.

---

### File Summary

| # | File | Change |
|---|------|--------|
| 1 | `Penny/src/renderer/src/game/workstation-animation.ts` | Add `_executeWalkBreak(ws, agent)` private method; refactor timer callback to call it; add `triggerWalkBreak(agentId)` public method |
| 2 | `Penny/src/renderer/src/game/office-workstation.ts` | Add `triggerWalkBreak(agentId)` delegation to `animator` |
| 3 | `Penny/src/renderer/src/game/OfficeScene.ts` | Add `get wsAnimator()` getter returning `this.wsManager` |
| 4 | `Penny/tests/e2e/navmesh-walking.spec.ts` | New file — 7 behavioral tests + 1 visual regression test |