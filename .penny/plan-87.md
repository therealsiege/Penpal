Now I have a complete picture. Here is the implementation plan:

---

## Implementation Plan — sidekick#87: CampusScene

### 1. `Penny/src/renderer/src/game/office-asset-keys.ts` — Add CAMPUS to SCENE_KEYS

In the `SCENE_KEYS` object, add:
```ts
CAMPUS: 'CampusScene',
```
alongside the existing `BOOT`, `OFFICE`, and `UI_SCENE` keys.

---

### 2. `Penny/src/renderer/src/game/events.ts` — Add two new events

In the `EVENTS` object add:
```ts
NAVIGATE_CAMPUS: 'navigate-campus',
NAVIGATE_BUILDING: 'navigate-building',
```

Add corresponding entries to `EventPayloadMap`:
```ts
[EVENTS.NAVIGATE_CAMPUS]: []
[EVENTS.NAVIGATE_BUILDING]: [building: 'office' | 'pod-foundry']
```

Also add `CAMPUS_COUNTS_UPDATED: 'campus-counts-updated'` event with payload `[agents: number, pods: number]` — used by React/IPC to push live counts into the scene.

---

### 3. **Create** `Penny/src/renderer/src/game/campus-scene.ts`

New file extending `BaseScene`. Structure:

```
class CampusScene extends BaseScene {
  key: SCENE_KEYS.CAMPUS

  private agentCount = 0
  private podCount = 0
  private duderLabel: Phaser.GameObjects.Text
  private podLabel: Phaser.GameObjects.Text

  onPreload(): void {}  // all assets already loaded by BootScene

  onCreate(): void {
    // 1. Fade in from black
    // 2. Draw two building panels side by side (centered)
    //    - Use KENNEY_UI spritesheet frame BTN_RECT_FLAT (index 1) for panel bg
    //    - Left panel: "Duder HQ" + agentCount display
    //    - Right panel: "Pod Foundry" + podCount display
    // 3. Style text with activeTheme colors, resolution: 2
    // 4. Make panels interactive (setInteractive, pointerover/out/up handlers)
    // 5. Listen for CAMPUS_COUNTS_UPDATED to refresh labels
    // 6. Listen for NAVIGATE_CAMPUS to wake self
  }

  private enterDuderHQ(): void {
    this.scene.sleep(SCENE_KEYS.CAMPUS)
    if (this.scene.isActive(SCENE_KEYS.OFFICE)) {
      this.scene.wake(SCENE_KEYS.OFFICE)
    } else {
      this.scene.start(SCENE_KEYS.OFFICE)
    }
  }

  private enterPodFoundry(): void {
    // Pod Foundry scene doesn't exist yet — start OfficeScene for now (stub)
    this.enterDuderHQ()
  }

  onUpdate(): void {}
}
```

**Panel layout**: Two 240×300 px rectangles centered horizontally, 40px gap, vertically centered with `camH * 0.4`. Each panel:
- Background: filled rect using `activeTheme.roomFloor` tinted dark
- Border: `add.rectangle` stroke using `activeTheme.accent`
- Building name text (large, `activeTheme.agentName`)
- Count badge below name (medium, `activeTheme.subtleText`)
- Hover: border color flashes to `activeTheme.accent`, scale tweens to 1.05
- Press: `cameras.main.flash(150)` then navigate

**Count labels** are stored as instance fields and updated via `CAMPUS_COUNTS_UPDATED` EventBus event.

---

### 4. `Penny/src/renderer/src/game/OfficeGame.ts` — Register CampusScene

- Import `CampusScene`
- Add `new CampusScene()` to the scene array **between** BootScene and OfficeScene:
  ```ts
  scene: [new BootScene(), new CampusScene(), scene, new UIScene()]
  ```

---

### 5. `Penny/src/renderer/src/game/boot-scene.ts` — Transition to CampusScene

In the completion handler (line ~196), change:
```ts
this.scene.start(SCENE_KEYS.OFFICE)
```
to:
```ts
this.scene.start(SCENE_KEYS.CAMPUS)
```

---

### 6. `Penny/src/renderer/src/game/OfficeScene.ts` — Emit NAVIGATE_CAMPUS on shutdown / emit counts

- In `OfficeScene.setAgents()`, after updating `this.agents`, emit `CAMPUS_COUNTS_UPDATED` with `[activeAgentCount, podCount]`.
- (Pod count is already tracked via `setPodLines()`; emit there too.)
- In OfficeScene's `create()` (after UIScene launch), register a listener for `NAVIGATE_BUILDING` event; if building is `'campus'`, sleep OfficeScene and emit `NAVIGATE_CAMPUS`.

Add a `NAVIGATE_BUILDING` EventBus listener in OfficeScene that does:
```ts
this.scene.sleep(SCENE_KEYS.OFFICE)
EventBus.emit(EVENTS.NAVIGATE_CAMPUS)
```

CampusScene hears `NAVIGATE_CAMPUS` → `this.scene.wake(SCENE_KEYS.CAMPUS)`.

---

### 7. UIScene stays running across all transitions

No changes needed — UIScene is launched with `scene.launch()` (parallel overlay) and is never touched by sleep/wake/start of CampusScene or OfficeScene. Verify `ui-scene.ts` has no `scene.stop()` calls keyed on OFFICE (it shouldn't).

---

### Summary of files touched

| Action | File |
|--------|------|
| Modify | `office-asset-keys.ts` — add `CAMPUS` to SCENE_KEYS |
| Modify | `events.ts` — add `NAVIGATE_CAMPUS`, `NAVIGATE_BUILDING`, `CAMPUS_COUNTS_UPDATED` |
| **Create** | `campus-scene.ts` — new BaseScene subclass |
| Modify | `OfficeGame.ts` — register CampusScene in scene array |
| Modify | `boot-scene.ts` — start CAMPUS instead of OFFICE |
| Modify | `OfficeScene.ts` — emit count updates + handle NAVIGATE_BUILDING |