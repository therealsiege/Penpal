Now I have enough to write the plan.

---

## Implementation Plan: sidekick#92 — RPG Foundation Agent Avatar

### 1. Create `Penny/src/renderer/src/game/agent-avatar.ts`

**`AgentAvatarConfig` interface** (top of file):
```typescript
export interface AgentAvatarConfig {
  scene: Phaser.Scene
  x: number
  y: number
  navMesh: NavMesh
  /** 0–2 character index — or pass AgentState and let getAgentCharacterIndex resolve it */
  charIndex?: number
  agent?: AgentState            // optional — only needed for getAgentCharacterIndex
  sheetKey?: string             // defaults to SPRITESHEET_KEYS.CHARACTERS
  speed?: number                // defaults to DEFAULT_WALK_SPEED (55)
  parentContainer?: Phaser.GameObjects.Container  // for Y-sort scenes
}
```

**`AgentAvatar` class** — compose `Phaser.GameObjects.Sprite` + `PathWalker` + `StateMachine`:

```typescript
export class AgentAvatar {
  readonly sprite: Phaser.GameObjects.Sprite
  readonly shadow: Phaser.GameObjects.Ellipse
  private fsm: StateMachine
  private walker: PathWalker
  private scene: Phaser.Scene
  private navMesh: NavMesh
  private charIndex: number
  private idleTimers: Phaser.Time.TimerEvent[]
  private currentState: 'idle' | 'walking' | 'sitting' | 'coffee-run'

  constructor(config: AgentAvatarConfig)
  destroy(): void
  update(dt: number): void               // call from scene update(); updates FSM + Y-sort depth
  walkTo(x: number, y: number, onComplete?: () => void): void
  sit(): void
  idle(): void
  startCoffeeRun(waypoints: NavPoint[]): void
  get position(): { x: number; y: number }
  get stateName(): string
}
```

**Frame calculation** — extract from PathWalker's model:
- Character base frame offset: `charIndex * 17` (each character gets 17 frames per row based on asset-keys data)
- Idle frame (facing down): `charBase + 0` (POSE_IDLE maps to frame 0 within the character section)
- Sitting frame: `charBase + POSE_SIT` (= charBase + 2)
- Walk frames: delegated entirely to PathWalker (it handles startFrame + directional offset internally)
- **NOTE**: Verify exact FRAMES_PER_CHARACTER count by reading `office-asset-keys.ts` before coding. Use the constant rather than hardcoding 17.

**State definitions** (passed to `StateMachine.addState`):

```
idle:
  onEnter: clear all timers, reset sprite to idle facing-down frame, schedule micro-variety timers
  onUpdate: Y-sort (sprite.setDepth(sprite.y))
  onExit: cancel/destroy all idleTimers

walking:
  onEnter: call walker.startPath(waypoints, () => fsm.setState('idle'))
  onUpdate: Y-sort; if walker.isWalking() === false and state still 'walking' → fsm.setState('idle')
  onExit: no-op (PathWalker fires onComplete naturally)

sitting:
  onEnter: cancel walker if active; set frame to sitFrame (charBase + POSE_SIT)
  onUpdate: Y-sort
  onExit: reset to idle frame

coffee-run:
  onEnter: like walking but no auto-return to idle; caller manages completion callback
  onUpdate: Y-sort
  onExit: no-op
```

**Idle micro-variety timers** — port timing from `workstation-animation.ts` idle patterns (lines 617–849), but drive `sprite.setAngle`/`sprite.setScale` directly without workstation container:

| Timer | Delay range | Action |
|---|---|---|
| lookAroundTimer | 8–15s random | tween angle ±4°, hold 1s, return to 0; Sine.easeInOut |
| stretchTimer | 20–30s random | tween scaleY 1→1.04 over 300ms, hold 200ms, return |
| yawnTimer | 60s (idle only) | set frame to POSE_INTERACT frame for 1.5s then back to idle |
| walkBreakTimer | 9–16s random | call `walkTo(randomNearbyPoint)` then return; only if `currentState === 'idle'` |

Random nearby point: pick `{x: x ± rand(30,60), y: y ± rand(30,60)}`, clamp to navMesh bounds.

**Shadow ellipse** — create in constructor: `scene.add.ellipse(x, y+8, 18, 6, 0x000000, 0.25)`. Pass to PathWalker so it tracks the sprite during walks. Set `shadow.setDepth(sprite.depth - 1)` each update.

**Y-sort depth** — in `update()`: `sprite.setDepth(sprite.y); shadow.setDepth(sprite.y - 1)`

---

### 2. Opt-in integration in DuderHQ / OfficeScene

**No file changes required for acceptance criteria.** The class is self-contained. Integration is caller's responsibility.

**CampusScene ambient avatars** (when CampusScene is built per #87): instantiate 2–4 `AgentAvatar` instances with `charIndex: Math.floor(Math.random() * 3)`, call `idle()`, let walk-break timers do ambient movement.

**DuderHQ opt-in path** (future, not part of this issue): `WorkstationFactory` can replace raw sprite + `PathWalker` instantiation with `new AgentAvatar(...)` and read back `avatar.sprite` for container insertion.

---

### 3. Export from game index (if one exists)

Check if `Penny/src/renderer/src/game/index.ts` or similar barrel exists. If so, add:
```typescript
export { AgentAvatar } from './agent-avatar'
export type { AgentAvatarConfig } from './agent-avatar'
```

---

### Pre-coding verification steps for executor

Before writing the file, the executor should:
1. Read `Penny/src/renderer/src/game/office-asset-keys.ts` — confirm `SPRITESHEET_KEYS.CHARACTERS` key name and `FRAMES_PER_CHARACTER` or equivalent constant
2. Read `path-walker.ts` lines 40-80 to verify constructor signature hasn't changed
3. Read `nav-mesh.ts` lines 1-50 to confirm `NavPoint` export name
4. Read `office-constants.ts` to confirm `POSE_SIT`, `POSE_IDLE`, `POSE_INTERACT` values and `DEFAULT_WALK_SPEED` import path (may live in path-walker.ts)

---

### Files summary

| Action | File | Notes |
|---|---|---|
| **Create** | `Penny/src/renderer/src/game/agent-avatar.ts` | ~280 lines |
| **Verify/maybe add export** | `Penny/src/renderer/src/game/index.ts` (if exists) | Barrel export |
| **No changes** | `path-walker.ts`, `state-machine.ts`, `nav-mesh.ts`, `office-helpers.ts` | Reuse as-is |
| **No changes** | `workstation-animation.ts`, `office-workstation.ts` | Backwards-compatible |