Now I have a clear picture of the current system. Here's the implementation plan:

---

## Implementation Plan: Cafe Patron Service Flow

### 1. `Penny/src/renderer/src/game/cafe-coffee-run.ts` — Core refactor

**Add types and constants:**
- Add `PatronPhase` type: `'walking-to-cafe' | 'ordering' | 'waiting-for-barista' | 'walking-to-stool' | 'seated' | 'sipping' | 'returning'`
- Add constant `MAX_COUNTER_QUEUE = 2`
- Add constant `COUNTER_APPROACH_OFFSET = 30` (px above stool row = patron stands at counter side)

**Extend `CoffeeRunHost` interface:**
- Add `baristasBusy: boolean[]` — barista occupancy array
- Add `counterWorldY: number` — computed world-Y for patron counter position

**Add state to `CafeCoffeeRunManager`:**
```typescript
readonly patronPhases = new Map<string, PatronPhase>()  // testability
private counterQueue: Array<{ agentId: string; onReady: (baristaIdx: number) => void }> = []
```

**Refactor `sendAgentForCoffee()`** — stool is still picked upfront (skip if null), then new multi-phase flow:

```
Phase 1 — walk to counter:
  target = (stoolWorldX(stoolIdx), host.counterWorldY)
  pathWalker.startPath(counterPath, onAtCounter)

Phase 2 — order at counter (onAtCounter):
  setPhase(agentId, 'ordering')
  scene.spawnEmojiReaction(x, y-25, '☕')
  wait 500–1000ms → requestBaristaService(...)

Phase 3 — requestBaristaService():
  find first barista where !baristasBusy[i]
  if found: baristasBusy[i]=true → onBaristaAssigned(baristaIdx)
  else if counterQueue.length < MAX_COUNTER_QUEUE:
    setPhase(agentId, 'waiting-for-barista')
    counterQueue.push({ agentId, onReady: onBaristaAssigned })
  else: cleanup() (skip run — counter full)

Phase 4 — onBaristaAssigned(baristaIdx):
  baristaWalkToCounterAndInteract(baristaIdx, stoolLocalX, () => {
    baristasBusy[baristaIdx] = false
    dequeueNextPatron()
    patrons faces forward, walk to stool
  })

Phase 5 — baristaWalkToCounterAndInteract():
  [replaces current serveDrink() logic]
  tween barista.x to stoolLocalX (clamped)
  face patron (barista sprite child[0].setFlipX)
  interact animation: brief scale bob + 1200ms delay (simulate prep)
  spawn cup, tween cup toward patron's current world position
  tween barista back home, kill idle sway tween then re-add it

Phase 6 — walkToStool (after cup delivered):
  setPhase(agentId, 'walking-to-stool')
  visitor.walker faces barista during wait (flipX by barista position)
  short direct tween from counter Y to stool Y (same X)
  onAtStool() → existing sit+sip flow (reuse current seated/sip logic)
  setPhase(agentId, 'seated'), then 'sipping' on first sip

Phase 7 — returning (existing triggerReturn):
  setPhase(agentId, 'returning') before pathWalker.startPath(returnPath)
```

**Add `dequeueNextPatron()`:**  
If `counterQueue.length > 0`: pop front, find free barista, assign it.

**Add `EventBus` emissions:**  
Each `setPhase()` call emits `EventBus.emit('cafe:patron-phase', { agentId, phase })` — import EventBus from `./events`.

**Add public `triggerForAgent(ws, room)` method** (wraps `sendAgentForCoffee`, exposed for testing).

**Delete `serveDrink()`** — its logic is folded into phase 4/5 above as `baristaWalkToCounterAndInteract()`.

---

### 2. `Penny/src/renderer/src/game/penny-cafe.ts` — Expose counter position + barista busy state

**Add to `PennyCafe`:**
```typescript
readonly baristasBusy: boolean[] = [false, false]

get counterWorldY(): number {
  return this.container ? this.container.y + 160 : this.worldY - 30
  // local Y = BARISTA_Y(120) + 40 = 160 — patron stands at serving counter side
}
```

**Expose in `CoffeeRunHost` interface** (already updated above — penny-cafe.ts implements it).

---

### 3. `Penny/src/renderer/src/game/events.ts` — Add new event type

Add `'cafe:patron-phase'` to the EventBus event map (if EventBus is typed). If it's an untyped pub/sub singleton, no change needed — just call `EventBus.emit`.

---

### 4. `Penny/tests/e2e/cafe-service-flow.spec.ts` — New e2e test

Create test file that:
1. Launches Electron app (same setup as existing e2e specs — look at `tests/electron.setup.ts`)
2. Evaluates `window.__cafeCoffeeRunManager?.patronPhases` or listens for `cafe:patron-phase` events
3. Triggers a run via `window.__cafeCoffeeRunManager?.triggerForAgent(mockWs, mockRoom)`
4. Asserts phase transitions: `walking-to-cafe → ordering → waiting-for-barista (optional) → walking-to-stool → seated → returning`

---

### 5. `Penny/src/renderer/src/game/OfficeScene.ts` — Expose manager for testing

In the scene's `create()` or where `PennyCafe` is initialized, assign:
```typescript
;(window as any).__cafeCoffeeRunManager = this.cafe.getCoffeeRunManager()
```

Add `getCoffeeRunManager()` to `PennyCafe`:
```typescript
getCoffeeRunManager(): CafeCoffeeRunManager { return this.coffeeRunManager }
```

---

### Summary of touched files:
| File | Change |
|------|--------|
| `cafe-coffee-run.ts` | Full refactor: multi-phase state machine, barista busy tracking, FIFO queue, EventBus emissions, public test trigger |
| `penny-cafe.ts` | Add `baristasBusy[]`, `counterWorldY`, `getCoffeeRunManager()` |
| `events.ts` | Add `cafe:patron-phase` event (if typed) |
| `OfficeScene.ts` | Expose `__cafeCoffeeRunManager` on window for e2e |
| `tests/e2e/cafe-service-flow.spec.ts` | New e2e test for phase transitions |