Now I have enough context. Here is the implementation plan:

---

## Implementation Plan: sidekick#88 — Rename OfficeScene → DuderHQScene, Remove Pod Viz

### 1. `Penny/src/renderer/src/game/office-asset-keys.ts` — Add DUDER_HQ scene key

**Line 359–363:** Add `DUDER_HQ` to `SCENE_KEYS`:
```ts
export const SCENE_KEYS = {
  BOOT: 'BootScene',
  OFFICE: 'OfficeScene',   // keep for any legacy ref; unused after step 3
  DUDER_HQ: 'DuderHQScene',
  UI_SCENE: 'UIScene',
} as const
```

---

### 2. `Penny/src/renderer/src/game/events.ts` — Add NAVIGATE_CAMPUS event

**After `ACHIEVEMENT_UNLOCKED` (line 142), before the closing `} as const`:**
```ts
// --- Navigation ---
/** Fired when ESC is pressed with no agent selected, requesting return to CampusScene. No payload. */
NAVIGATE_CAMPUS: 'navigate:campus',
```

**In `EventPayloadMap` (after line 224):**
```ts
[EVENTS.NAVIGATE_CAMPUS]: []
```

---

### 3. `Penny/src/renderer/src/game/OfficeScene.ts` → rename to `DuderHQScene.ts`

This is the largest change. Do it in-place (rename the file, then update contents):

**a. Rename the file** from `OfficeScene.ts` to `DuderHQScene.ts`.

**b. Remove pod import and field:**
- Line 11: Remove `import { OfficePods } from './office-pods'`
- Line 73: Remove `pods!: OfficePods`

**c. Remove `POD_REFRESH_MS` usage** (the constant itself lives in `office-constants.ts` — leave it there; just remove the usages).

**d. Remove pod initialization** (lines 311–312):
```ts
// DELETE:
this.pods = new OfficePods(this)
this.pods.init()
```

**e. Remove pod update-loop block** (lines 991–995):
```ts
// DELETE: the entire if (this.pods.podLines.length > 0 ...) block
```

**f. Remove rivalry draw block** (lines 1006–1008):
```ts
// DELETE:
if (this.pods.hasRivalries() && time - this.pods.getLastRivalryDrawAt() >= 2500) {
  this.pods.drawRivalryLines(time, this.rooms)
}
```

**g. Remove `markPodsDirty` callback** (line 301):
```ts
// DELETE: markPodsDirty: () => { if (this.pods) this.pods.markDirty() }
```

**h. Remove `setPodWorkflows()` method** (lines 1314–1319).

**i. Remove pod `destroy()` call** (line ~1682):
```ts
// DELETE: this.pods.destroy()
```

**j. Remove any pod dirty-mark calls on room changes** (lines ~1425–1428).

**k. Rename class** from `OfficeScene` to `DuderHQScene` (line 54).

**l. Update the Phaser scene key** in the constructor `super()` call — change the scene key string from `'OfficeScene'` to `SCENE_KEYS.DUDER_HQ` (import `SCENE_KEYS` from `./office-asset-keys`).

**m. Add ESC → NAVIGATE_CAMPUS binding** in `create()` (after keyboard setup section):
```ts
this.input.keyboard?.on('keydown-ESC', () => {
  if (!this.selection.getSelectedAgentId()) {
    EventBus.emit(EVENTS.NAVIGATE_CAMPUS)
  }
})
```

**n. Add `sleep()` and `wake()` lifecycle methods** before `destroy()`:
```ts
sleep(): void {
  // Pause all running tweens to avoid memory drift
  this.tweens.pauseAll()
}

wake(): void {
  this.tweens.resumeAll()
}
```

**o. Update export:** `export class DuderHQScene extends Phaser.Scene`

---

### 4. `Penny/src/renderer/src/game/OfficeGame.ts` — Import rename

- Line 3: `import { DuderHQScene } from './DuderHQScene'`
- Line 8: return type `scene: DuderHQScene`
- Line 12: `const scene = new DuderHQScene()`
- Line 57: `(window as any).__PENNY_SCENE__ = scene` — no change needed (value type updates automatically)

---

### 5. `Penny/src/renderer/src/panels/CommandCenter.tsx` — Update type + remove pod push

- Line 10: `import { DuderHQScene } from '../game/DuderHQScene'`
- Line 1426: `const sceneRef = useRef<DuderHQScene | null>(null)`
- Lines 1534–1550: **Remove** the entire `setPodWorkflows` call block (the filtering/mapping of `podWorkflows` and the `sceneRef.current.setPodWorkflows(activeWorkflows)` call). Pod data routing to `PodFoundryScene` is a future concern per the issue — just remove from here.

---

### 6. `Penny/src/renderer/src/game/test-harness.ts` — Update comment

- Line 779: Change `"Direct reference to OfficeScene"` → `"Direct reference to DuderHQScene"`.

---

### Notes for Executor

- `office-pods.ts` is **not modified** — it remains for future use by `PodFoundryScene`.
- The `SCENE_KEYS.OFFICE` key can stay in the constants file for backward compat (nothing breaks if it's unused).
- After removing `setPodWorkflows()` from CommandCenter, any TypeScript refs to `PodLineInfo` in CommandCenter's import list should be cleaned up if they become unused.
- UIScene references `OfficeScene` only in comments (lines 10–16 of `ui-scene.ts`) — update those comments to say `DuderHQScene`.
- Run `npx tsc --noEmit` after all changes to confirm zero type errors before finishing.