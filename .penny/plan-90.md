Now I have enough context. Here's the implementation plan:

---

## Issue #90 Implementation Plan: Scene Transition Router + CommandCenter State Routing

**Prerequisite note:** CampusScene, DuderHQScene, and PodFoundryScene do not exist yet. This plan creates them as part of implementing the router.

---

### 1. `Penny/src/renderer/src/game/events.ts` — Add 3 new events + payloads

Add to the `EVENTS` constant:
```
NAVIGATE_CAMPUS: 'navigate:campus'
NAVIGATE_BUILDING: 'navigate:building'   // payload: (sceneKey: string, focusAgentId?: string)
ACTIVE_SCENE_CHANGED: 'scene:activeChanged'  // payload: (sceneKey: string)
```
Add corresponding entries to `EventPayloadMap`.

---

### 2. `Penny/src/renderer/src/game/duder-hq-scene.ts` — New file

Create `DuderHQScene extends OfficeScene`. Override the Phaser scene key to `'DuderHQScene'` via `super({ key: 'DuderHQScene' })` in the constructor. Inherits `setAgents()` and `setOrchestratorTasks()` from OfficeScene without changes. Export `DuderHQScene`.

---

### 3. `Penny/src/renderer/src/game/pod-foundry-scene.ts` — New file

Create `PodFoundryScene extends BaseScene` with scene key `'PodFoundryScene'`. Implement:
- `setPodWorkflows(workflows: PodLineInfo[]): void` — stores workflows, updates connecting lines (stub: log + store for now; full pod visualization is follow-on work)
- `create()`: draws placeholder background (dark gradient, "Pod Foundry" label)
- `update()`: no-op initially

---

### 4. `Penny/src/renderer/src/game/campus-scene.ts` — New file

Create `CampusScene extends BaseScene` with scene key `'CampusScene'`. Implement:
- `create()`: Draw two building panel cards (DuderHQ, PodFoundry) centered on screen. Each panel shows name + live count text (`agentCount`, `podCount`). Make panels interactive — click emits `EventBus.emit(EVENTS.NAVIGATE_BUILDING, sceneKey)`.
- Private state: `agentCount = 0`, `podCount = 0`, text refs for live update.
- In `create()`, subscribe:
  - `AGENT_ARRIVED` → `agentCount++`, refresh text
  - `AGENT_DEPARTED` → `agentCount--`, refresh text
- `updatePodCount(n: number)`: called from CommandCenter when pod workflows change.
- On scene `shutdown`, unsubscribe EventBus listeners.

---

### 5. `Penny/src/renderer/src/game/OfficeGame.ts` — Update scene registration + return type

- Import `DuderHQScene`, `PodFoundryScene`, `CampusScene`.
- Replace `new OfficeScene()` with `new DuderHQScene()` in the `scene` array. Add `new CampusScene()` and `new PodFoundryScene()` (both start sleeping).
- Updated scene array order: `[new BootScene(), campusScene, duderHQScene, podFoundryScene, new UIScene()]`
- Start CampusScene + UIScene awake; DuderHQScene and PodFoundryScene sleep initially via `scene.sleep()` calls after BootScene completes (handled via BootScene's `create()` completion callback or a scene `ready` event).
- Change return type and value:
```ts
return { game, duderHQ: duderHQScene, podFoundry: podFoundryScene, campus: campusScene }
```
- Add helper `transitionTo(game: Phaser.Game, fromKey: string, toKey: string, focusAgentId?: string)`:
  - Emit `EventBus.emit(EVENTS.ACTIVE_SCENE_CHANGED, toKey)`
  - UIScene plays 200ms fade-to-black overlay (call `UIScene.startTransitionFade()`)
  - After 100ms: `game.scene.sleep(fromKey)`, `game.scene.wake(toKey)` (or `run` if never started)
  - After 200ms: UIScene clears fade overlay
  - If `focusAgentId` provided, emit `EVENTS.AGENT_CLICKED` on the target scene after wake

---

### 6. `Penny/src/renderer/src/game/ui-scene.ts` — Add transition fade + deep-link toast click

- Add `startTransitionFade(duration = 200)` method: creates/tweens a full-screen black rectangle at depth 9999 from alpha 0 → 0.85 → 0 over `duration` ms.
- In the `AGENT_STATE_CHANGED` listener that shows "needs input" toasts: make the toast text/container interactive. On `pointerdown`, emit `EventBus.emit(EVENTS.NAVIGATE_BUILDING, 'DuderHQScene', agentId)`.

---

### 7. `Penny/src/renderer/src/panels/CommandCenter.tsx` — Multi-scene routing

- Replace:
  ```ts
  sceneRef = useRef<OfficeScene | null>(null)
  ```
  With:
  ```ts
  duderHQRef = useRef<DuderHQScene | null>(null)
  podFoundryRef = useRef<PodFoundryScene | null>(null)
  campusRef = useRef<CampusScene | null>(null)
  gameRef = useRef<Phaser.Game | null>(null)
  activeScene = useRef<string>('CampusScene')
  ```
- Update `createOfficeGame()` call to destructure `{ game, duderHQ, podFoundry, campus }` and assign all refs.
- Route data methods:
  - `setAgents(...)` → `duderHQRef.current?.setAgents(...)` only
  - `setOrchestratorTasks(...)` → `duderHQRef.current?.setOrchestratorTasks(...)` only
  - `setPodWorkflows(...)` → `podFoundryRef.current?.setPodWorkflows(...)` + `campusRef.current?.updatePodCount(workflows.length)`
- Add `useEffect` to subscribe to `NAVIGATE_BUILDING` and `NAVIGATE_CAMPUS`:
  - `NAVIGATE_BUILDING(toKey, focusAgentId?)` → calls `transitionTo(gameRef.current, activeScene.current, toKey, focusAgentId)`, updates `activeScene.current`
  - `NAVIGATE_CAMPUS` → calls `transitionTo(gameRef.current, activeScene.current, 'CampusScene')`
  - Unsubscribe on unmount.
- Update cleanup (`unmount` effect) to null all four refs.
- Remove all `(window as any).__PENNY_SCENE__` = single scene; replace with `__PENNY_GAME__` only (already set inside OfficeGame.ts).

---

### 8. Check: UIScene always-awake guarantee

UIScene is added to the Phaser scene list last and never appears in any `sleep()` call. Phaser runs all non-sleeping scenes. No code change needed — verify in `transitionTo()` that only `fromKey` and `toKey` are passed to sleep/wake, never `'UIScene'`.

---

**Execution order:** Steps 1 → 2 → 3 → 4 → 5 → 6 → 7. Step 8 is a verification, not a code change.