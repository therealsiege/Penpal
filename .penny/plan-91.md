Now I have sufficient context. Here is the implementation plan:

---

## Implementation Plan: sidekick#91 — Sleep/Wake Lifecycle + GPU Optimization

**Context:** `PodFoundryScene` and `CampusScene` do not exist yet (depend on #90). Plan scopes to existing files. The scene-sleep pattern adds `SLEEP`/`WAKE` event hooks to the running scene; Phaser pauses the scene's update loop but does NOT pause tweens/timers automatically — we must do it manually.

---

### 1. `office-atmosphere.ts` — Add `pause()` / `resume()` methods

**Add after `destroy()`:**
```ts
pause(): void {
  if (this.dayNightTimer) this.dayNightTimer.paused = true
  this.scene.tweens.pauseAll()  // atmosphere owns no other tween refs
}

resume(): void {
  if (this.dayNightTimer) this.dayNightTimer.paused = false
  this.scene.tweens.resumeAll()
  this.applyDayNightCycle(/* force= */ true)  // re-sync to wall-clock time
}
```

> `applyDayNightCycle(true)` forces a re-sync to real time so the office sky isn't frozen at the pre-sleep moment.

---

### 2. `office-particles.ts` — Add `pause()` / `resume()` methods

**Add after `setReducedMode()`:**
```ts
pause(): void {
  if (this.typingParticleTimer)   this.typingParticleTimer.paused = true
  if (this.corridorParticleTimer) this.corridorParticleTimer.paused = true
  // Pause all in-flight particle tweens by stopping emitters
  this.confettiEmitter?.stop()
  // Pool-based particles: let active tweens finish but block new ones via flag
  this._sleeping = true
}

resume(): void {
  if (this.typingParticleTimer)   this.typingParticleTimer.paused = false
  if (this.corridorParticleTimer) this.corridorParticleTimer.paused = false
  if (this.confettiEmitter?.active) this.confettiEmitter.start()
  this._sleeping = false
}
```

**Add `private _sleeping = false` class field.**

**Guard all `spawn*` methods with early-return:**
```ts
spawnTypingParticle(x: number, y: number): void {
  if (this._sleeping || this._reducedMode) return
  // ...existing code...
}
```
Apply the same guard to: `spawnAlertRipple`, `spawnEmojiReaction`, `spawnFlameParticle`, and any other public spawn methods.

---

### 3. `penny-cafe.ts` — Add `pause()` / `resume()`; delegate to `CafeCoffeeRunManager`

**`penny-cafe.ts`:**
```ts
pause(): void {
  if (this.visitorTimer) this.visitorTimer.paused = true
  if (this.steamTimer)   this.steamTimer.paused   = true
  this.coffeeRunManager.pause()
  this.chatManager.pause?.()   // no-op if chat doesn't need it
}

resume(): void {
  if (this.visitorTimer) this.visitorTimer.paused = false
  if (this.steamTimer)   this.steamTimer.paused   = false
  this.coffeeRunManager.resume()
  this.chatManager.resume?.()
}
```

**`cafe-coffee-run.ts` — Add `pause()` / `resume()` to `CafeCoffeeRunManager`:**
```ts
pause(): void {
  if (this.coffeeRunTimer) this.coffeeRunTimer.paused = true
}

resume(): void {
  if (this.coffeeRunTimer) this.coffeeRunTimer.paused = false
}
```

---

### 4. `office-ambient.ts` — Add `pause()` / `resume()`

```ts
pause(): void {
  if (this.timer) this.timer.paused = true
}

resume(): void {
  if (this.timer) this.timer.paused = false
}
```

---

### 5. `workstation-animation.ts` — Add `pauseAll()` / `resumeAll()` for per-workstation timers

**Add two new public methods to `WorkstationAnimation`:**
```ts
pauseAll(): void {
  for (const ws of this.scene.workstations.values()) {
    ws.lookAroundTimer?.    && (ws.lookAroundTimer.paused     = true)
    ws.stretchTimer?.       && (ws.stretchTimer.paused        = true)
    ws.walkBreakTimer?.     && (ws.walkBreakTimer.paused      = true)
    ws.lookAtNeighborTimer?.&& (ws.lookAtNeighborTimer.paused = true)
    ws.yawnTimer?.          && (ws.yawnTimer.paused           = true)
    ws.lampFlickerTimer?.   && (ws.lampFlickerTimer.paused    = true)
    ws.walkBreakTween?.     && ws.walkBreakTween.pause()
  }
}

resumeAll(): void {
  for (const ws of this.scene.workstations.values()) {
    ws.lookAroundTimer?.    && (ws.lookAroundTimer.paused     = false)
    ws.stretchTimer?.       && (ws.stretchTimer.paused        = false)
    ws.walkBreakTimer?.     && (ws.walkBreakTimer.paused      = false)
    ws.lookAtNeighborTimer?.&& (ws.lookAtNeighborTimer.paused = false)
    ws.yawnTimer?.          && (ws.yawnTimer.paused           = false)
    ws.lampFlickerTimer?.   && (ws.lampFlickerTimer.paused    = false)
    ws.walkBreakTween?.     && ws.walkBreakTween.resume()
  }
}
```

> Use the actual accessor for `workstations` — check how `OfficeScene` stores them (likely `this.workstationModule.workstations` or similar).

---

### 6. `OfficeScene.ts` (DuderHQ) — Wire `SLEEP` / `WAKE` event handlers

**In `create()`, after all modules are initialized (after `this.isReady = true`):**
```ts
this.events.on(Phaser.Scenes.Events.SLEEP, this._onSleep, this)
this.events.on(Phaser.Scenes.Events.WAKE,  this._onWake,  this)
```

**Add two private methods:**
```ts
private _onSleep(): void {
  this._isSleeping = true
  this.atmosphere?.pause()
  this.particles?.pause()
  this.cafe?.pause()
  this.ambient?.pause()
  this.workstationAnimation?.pauseAll()
  // Pause OfficeScene-owned timers
  if (this.bgTransitionTween) this.bgTransitionTween.pause()
  // NOTE: NavMesh is pure data — no pause needed
  // NOTE: resizeTimer/_workstationRefitTimer are setTimeout — not Phaser; leave running (they're rare/cheap)
}

private _onWake(): void {
  this._isSleeping = false
  this.atmosphere?.resume()   // re-syncs day/night to wall clock
  this.particles?.resume()
  this.cafe?.resume()
  this.ambient?.resume()
  this.workstationAnimation?.resumeAll()
  if (this.bgTransitionTween) this.bgTransitionTween.resume()
}
```

**Add `private _isSleeping = false` class field.**

**Update `_perfReducedMode` setter / update loop guard:**
```ts
// In update(), early-exit when sleeping (belt-and-suspenders — Phaser stops calling update on sleeping scenes, but guards against manual calls)
if (this._isSleeping) return
```

**Remove listeners in `destroy()`:**
```ts
this.events.off(Phaser.Scenes.Events.SLEEP, this._onSleep, this)
this.events.off(Phaser.Scenes.Events.WAKE,  this._onWake,  this)
```

---

### 7. Stub `pod-foundry-scene.ts` and `campus-scene.ts` (created by #90)

**This plan's executor should leave a TODO comment in the issue tracking that these scenes must add the same `SLEEP`/`WAKE` pattern once #90 is merged.** Do not create these files here — they are the product of #90.

---

### 8. NavMesh skip-rebuild on wake

**In whatever code rebuilds the NavMesh (likely `office-rooms.ts` or `OfficeScene.ts`):**

Add a flag `private _navMeshDirtyWhileSleeping = false`.

- In `_onSleep()`: snapshot current room count (`this._roomCountAtSleep = this.rooms.size`).
- On any room-add/remove IPC handler that fires while `_isSleeping`: set `_navMeshDirtyWhileSleeping = true` (don't rebuild yet).
- In `_onWake()`: `if (this._navMeshDirtyWhileSleeping) { this._rebuildNavMesh(); this._navMeshDirtyWhileSleeping = false }`.

---

### Implementation Order
1. Steps 1–4 (module pause/resume — no dependencies)
2. Step 5 (workstation-animation — references workstation type)
3. Step 6 (OfficeScene wiring — requires steps 1–5)
4. Step 8 (NavMesh guard — can be done alongside step 6)
5. Step 7 (stubs/TODOs — last)