Now I have all the context needed. Here's the implementation plan:

---

## Implementation Plan: `tests/e2e/navmesh-walking.spec.ts`

**Only one file needs to be created.** All required APIs already exist:
- `scene.wsManager.triggerWalkBreak(agentId)` → `office-workstation.ts:1260`
- `scene.getNavMesh().isWalkable(x, y)` → `OfficeScene.ts:1716`, `nav-mesh.ts`
- NavMesh enabled/disabled flag → `nav-mesh.ts`
- Walk sprite at depth 9000 → `workstation-animation.ts:1882-1883`
- `ws.walkBreakTween` sentinel → `workstation-animation.ts:1887` (undefined = walk complete)

---

### 1. Create `Penny/tests/e2e/navmesh-walking.spec.ts`

Follow the exact pattern of `cafe-automation.spec.ts`. Structure:

**a) Imports & shared context**
```ts
import { launchApp, waitForPhaser, evalInScene, type AppContext } from '../electron.setup'
// ctx, beforeAll (launchApp + waitForPhaser), afterAll (app.close)
```

**b) `patchNavMesh()` helper** — called after `PH.addAgents()`. Unlike `patchForCoffeeRun`, do NOT mock `findPath` (we want real pathfinding):
```ts
async function patchNavMesh(): Promise<void> {
  await ctx.window.evaluate(() => {
    const scene = (window as any).__PENNY_SCENE__
    const navMesh = (scene as any).navMesh
    if (navMesh) navMesh.disabled = false
  })
}
```

**c) `triggerWalkBreakFor(agentId)` helper**:
```ts
// returns true if walk started
await ctx.window.evaluate((id) => {
  const scene = (window as any).__PENNY_SCENE__
  return !!(scene as any).wsManager?.triggerWalkBreak(id)
}, agentId)
```

**d) `pollWalkSpritePositions(durationMs, intervalMs)` helper** — polls scene children for sprites at depth 9000 (the walk sprite), collects `{x, y}` samples:
```ts
// Use page.waitForTimeout in a loop, evalInScene each iteration:
// (scene as any).children.list.filter(c => c.depth === 9000 && c.active && c.type === 'Sprite')
//   .map(s => ({ x: s.x, y: s.y }))
```

**e) `waitForWalkComplete(agentId, timeoutMs=8000)` helper** — polls until `ws.walkBreakTween === undefined`:
```ts
await ctx.window.waitForFunction((id) => {
  const scene = (window as any).__PENNY_SCENE__
  for (const room of (scene as any).wsManager?.getRooms?.()?.values() ?? []) {
    const ws = room.workstations?.get(id)
    if (ws) return !ws.walkBreakTween
  }
  return false
}, agentId, { timeout: timeoutMs })
```

**f) `getAgentWorldPos(agentId)` helper** — reads `room.x + ws.container.x`, `room.y + ws.container.y`:
```ts
return evalInScene(ctx.window, (scene) => {
  for (const room of (scene as any).wsManager?.rooms?.values() ?? []) {
    const ws = room.workstations?.get(agentId)
    if (ws) return { x: room.x + ws.container.x, y: room.y + ws.container.y }
  }
  return null
})
```

---

### 2. Test cases (in `test.describe('NavMesh Pathfinding')`)

**Test 1 — Agent spawns at walkable desk position:**
```
addAgents(1, { sessionMode: 'idle' })
patchNavMesh()
pos = getAgentWorldPos(id)
walkable = evalInScene(scene => scene.getNavMesh().isWalkable(pos.x, pos.y))
expect(walkable).toBe(true)
```
Skip gracefully if `PH` unavailable.

**Test 2 — triggerWalkBreak returns true (navMesh functional):**
```
addAgents(1, { sessionMode: 'idle' })
patchNavMesh()
result = triggerWalkBreakFor(id)
expect(result).toBe(true)
```

**Test 3 — Walk path stays within walkable tiles:**
```
addAgents(1, { sessionMode: 'idle' })
patchNavMesh()
triggerWalkBreakFor(id)
// Poll walkSprite position every 150ms for 4s
// At each sample: navMesh.isWalkable(sprite.x, sprite.y) must be true
// Collect any violations; expect violations.length === 0
```
Uses `ctx.window.evaluate` loop with depth-9000 sprite scan.

**Test 4 — Agent returns to original desk position:**
```
addAgents(1, { sessionMode: 'idle' })
patchNavMesh()
startPos = getAgentWorldPos(id)
triggerWalkBreakFor(id)
waitForWalkComplete(id, 10000)
endPos = getAgentWorldPos(id)
// Allow ±8px tolerance (sprite snaps to WS_SPRITE_Y offset)
expect(Math.abs(endPos.x - startPos.x)).toBeLessThan(8)
expect(Math.abs(endPos.y - startPos.y)).toBeLessThan(8)
```

**Test 5 — Walk frame is a valid directional frame (not spinning/wrong index):**
```
addAgents(1, { sessionMode: 'idle' })
patchNavMesh()
triggerWalkBreakFor(id)
await page.waitForTimeout(400)  // mid-walk
frameName = evalInScene(scene =>
  scene.children.list.find(c => c.depth===9000 && c.active && c.type==='Sprite')?.frame?.name
)
// PathWalker uses frames: 0,1 (down), 3,4 (right), 6,7 (up), 9,10 (left)
const validFrames = [0,1,3,4,6,7,9,10].map(String)
expect(validFrames).toContain(String(frameName))
```

**Test 6 — Two agents walking simultaneously don't share the same position:**
```
ids = addAgents(2, { sessionMode: 'idle' })
patchNavMesh()
triggerWalkBreakFor(ids[0])
triggerWalkBreakFor(ids[1])
// Poll both walkSprites for 3s; at each frame check distance between them
// Expect minimum distance > 8px (they're never at exact same spot)
```

**Test 7 — Visual regression: agents at desks after walk complete:**
```
addAgents(3, { sessionMode: 'idle' })
patchNavMesh()
// Trigger all 3, wait for all to complete
// Screenshot matches baseline (Playwright visual comparison)
await expect(page).toHaveScreenshot('navmesh-agents-at-desks.png', { maxDiffPixels: 200 })
```
This goes in the `visual` project (filename matches `visual-regression` glob from `playwright.config.ts`). Rename to `navmesh-walking.visual-regression.spec.ts` OR add the screenshot assertion in a separate `test.describe('Visual Regression')` inside the file if the config uses `grep` patterns.

---

### 3. Access pattern for `wsManager.getRooms()`

The `getRooms()` method is on `WorkstationAnimator`'s host interface, not directly on `wsManager`. Use `(scene as any).wsManager` — since `triggerWalkBreak` is public on `OfficeWorkstations`, it's safe to call. For room iteration to read `ws.walkBreakTween`, access `(scene as any).wsManager` private rooms map via `(scene as any).wsManager.rooms` or use a helper that calls `triggerWalkBreak` and checks via the private internal path `(scene as any).wsManager.animator` if needed.

**Simplest safe alternative for `waitForWalkComplete`:** check `ws.sprite.visible` — it's set to `false` during walk and `true` again on `finishWalk()`:
```ts
await ctx.window.waitForFunction((id) => {
  const scene = (window as any).__PENNY_SCENE__
  const wsManager = (scene as any).wsManager
  if (!wsManager) return false
  for (const room of wsManager.rooms?.values() ?? []) {
    const ws = room.workstations?.get(id)
    if (ws) return ws.sprite.visible === true  // true when walk is done
  }
  return false
}, agentId)
```

---

### Summary

| # | File | Change |
|---|------|--------|
| 1 | `Penny/tests/e2e/navmesh-walking.spec.ts` | **Create** — 7 test cases + 5 helpers |

No source modifications needed. All test infrastructure (`triggerWalkBreak`, `getNavMesh`, `isWalkable`, walk sprite at depth 9000, `ws.sprite.visible` sentinel) is already in place.