Now I have full context. Here's the implementation plan:

---

## Implementation Plan — therealsiege/sidekick#75: Achievement Panel UI + Unlock Wiring

**Current state**: `achievements.ts` emits `ACHIEVEMENT_UNLOCKED` → `OfficeScene.ts:662` calls `celebrations.achievementUnlocked()` (world-space badge sprite, not screen-toast) + `ui-scene.ts` logs to activity feed. No panel, no dedicated toast, no workstation badge.

---

### 1. `achievements.ts` — Remove duplicate NOTIFICATION emit, store `unlockedAt` timestamp

**File**: `Penny/src/renderer/src/game/achievements.ts`

- In `tryUnlock()` (line 101–105): **remove** the `EventBus.emit(EVENTS.NOTIFICATION, ...)` call (the dedicated achievement toast in step 3 replaces it; keeping both causes duplicates)
- When adding to `_unlocked`, also store `unlockedAt` in a `Map<string, number>`: `this._unlockedAt.set(id, Date.now())`
- Add `private _unlockedAt = new Map<string, number>()` field to class
- In `load()`: restore `unlockedAt` from localStorage (store as `{ unlocked: string[], unlockedAt: Record<string, number>, totalTasks: number }`)
- In `save()`: persist `unlockedAt` map
- In `getAll()`: merge `unlockedAt` timestamp into each returned `Achievement` — the `Achievement` interface already has `unlockedAt?: number`
- Add `getByCategory()` helper returning `Map<string, Achievement[]>` keyed by category (Milestone, Productivity, Fun, Social) — derive category from a `CATEGORY_MAP` constant mapping achievement id → category string

---

### 2. `achievement-panel.ts` — New file: Phaser screen-space panel (hotkey A)

**File**: `Penny/src/renderer/src/game/achievement-panel.ts` (new)

Model after `season-hud.ts`'s overlay pattern exactly:

```
class AchievementPanel {
  private scene: Phaser.Scene
  private panelContainer: Phaser.GameObjects.Container | null = null
  panelVisible = false
  private viewWidth = 800
  private viewHeight = 600

  constructor(scene: Phaser.Scene)
  init(w: number, h: number): void
  setViewSize(w: number, h: number): void
  togglePanel(): void          // called from OfficeScene keydown-A
  destroy(): void
  private _showPanel(): void
  private _hidePanel(): void
}
```

`_showPanel()` layout (centered modal, 320×360, depth 9999, scrollFactor 0):
- Background: `activeTheme.bg` fill + `activeTheme.panelStroke` border, rounded rect
- Title: "ACHIEVEMENTS" + progress fraction `(N/13)` in gold
- Divider line (image or graphics fallback, matching season-hud pattern)
- Category sections (Milestone, Productivity, Fun) with section header text
- Per-achievement row (4 per row in a grid):
  - If unlocked: `SPRITESHEET_KEYS.GAME_ICONS` sprite at `iconFrame`, full alpha, hover title
  - If locked: same sprite frame but tinted `0x334455` (dark grey), scale-down slightly
- Progress bar for incremental achievements (`ten_tasks`, `hundred_tasks`): `achievements.getSessionTasks()` / target, rendered as a small filled rect (same pattern as challenge bars in `_showChallenges()`)
- Unlock date shown as subtitle under unlocked icons (formatted as `MM/DD` from `unlockedAt` timestamp)
- Dismiss hint: "Press A or ESC to close"
- Fade-in tween: `alpha: 0 → 1, duration: 200, ease: 'Quad.easeOut'` (matches `showHelpOverlay` pattern)

---

### 3. `office-ui.ts` — Add `showAchievementToast()` method

**File**: `Penny/src/renderer/src/game/office-ui.ts`

Add a new public method after `showToast()` (~line 244):

```typescript
showAchievementToast(title: string, description: string, iconFrame: number): void
```

- Wider toast: `TOAST_W = 260, TOAST_H = 44` (taller to fit title + description on two lines)
- Gold border: 2px `lineStyle(2, 0xfbbf24, 0.9)` stroke on the rounded rect background
- Background: `0x1a1a0a` (darker gold-tinted dark) + rounded rect
- Icon: `SPRITESHEET_KEYS.GAME_ICONS` at `iconFrame`, scale 0.38, positioned left
- Title text: bold gold `#fbbf24`, 11px
- Description text: subtle `activeTheme.subtleText`, 9px, below title
- "ACHIEVEMENT UNLOCKED" micro-label in `#fbbf24` at 7px above the title (cap-styled)
- Screen flash: brief `this.scene.cameras.main.flash(300, 200, 160, 0, false)` for gold flash effect
- Uses same slide-in + auto-dismiss pattern as `showToast()` (3.5s, slides right)
- **Does NOT use** `recentToasts` dedup (achievements are unique-per-id, dedup is handled by `AchievementManager.tryUnlock`)

---

### 4. `OfficeScene.ts` — Wire achievement toast + `A` hotkey

**File**: `Penny/src/renderer/src/game/OfficeScene.ts`

**4a. Wire toast in `ACHIEVEMENT_UNLOCKED` listener** (around line 662):

Replace:
```typescript
EventBus.on(EVENTS.ACHIEVEMENT_UNLOCKED, (...args: unknown[]) => {
  const [, title, iconFrame] = args as [string, string, number]
  const cam = this.cameras.main
  this.celebrations.achievementUnlocked(cam.width / 2, cam.height / 2, title, iconFrame)
  soundEngine.achievement()
```

With (keep existing celebration, add toast):
```typescript
EventBus.on(EVENTS.ACHIEVEMENT_UNLOCKED, (...args: unknown[]) => {
  const [id, title, iconFrame] = args as [string, string, number]
  const def = achievements.getAll().find(a => a.id === id)
  const cam = this.cameras.main
  this.celebrations.achievementUnlocked(cam.width / 2, cam.height / 2, title, iconFrame)
  this.officeUI.showAchievementToast(title, def?.description ?? '', iconFrame)
  soundEngine.achievement()
```

**4b. Instantiate `AchievementPanel`**:
- Import `AchievementPanel` from `./achievement-panel`
- Add field: `private achievementPanel!: AchievementPanel`
- In `create()`, after `this.seasonHud.init(...)`: `this.achievementPanel = new AchievementPanel(this); this.achievementPanel.init(this.scale.width, this.scale.height)`
- In resize handler: `this.achievementPanel.setViewSize(w, h)`
- In `shutdown()`/destroy: `this.achievementPanel.destroy()`

**4c. Add `A` hotkey** (after line 568 where `B` key is wired):
```typescript
this.input.keyboard.on('keydown-A', (e: KeyboardEvent) => {
  if (shouldIgnoreKeyboardShortcuts(e)) return
  this.achievementPanel.togglePanel()
})
```

**4d. Update help overlay shortcuts list** in `office-ui.ts:showHelpOverlay()` (~line 462):
Add `['A', 'Achievements']` to the `shortcuts` array.

---

### 5. `workstation-creation.ts` — Add achievement badge slot

**File**: `Penny/src/renderer/src/game/workstation-creation.ts`

- After the `orchTaskBadge` sprite definition (~line 583), add:
```typescript
// Most-recent achievement badge — shown below the role badge, rotates every 30s
const achievementBadge = this.scene.add.sprite(28, WS_SPRITE_Y - 22, SPRITESHEET_KEYS.GAME_ICONS, ICON_FRAMES.ACHIEVEMENT_BADGE)
  .setScale(0.22).setOrigin(0.5).setAlpha(0).setVisible(false)
wsContainer.add(achievementBadge)
```
- Add `achievementBadge` to the returned workstation object (update `WorkstationSprite` type in `office-types.ts` to add `achievementBadge?: Phaser.GameObjects.Sprite`)
- **NOT** in `lodLevel2Objects` — achievement badge logic manages its own visibility

**Rotation logic** — add to `office-workstation.ts` (or `workstation-animation.ts`) a method `updateAchievementBadge(ws)`:
- Called on a 30s interval from the main `update()` loop (throttled with `lastAchievementBadgeAt` timestamp)
- Gets `achievements.getUnlocked()`, cycles through them per-agent using `agentIndex % unlocked.length`
- Sets `ws.achievementBadge.setFrame(unlocked[idx].iconFrame).setVisible(true).setAlpha(0.7)`

---

### 6. `office-types.ts` — Add `achievementBadge` to `WorkstationSprite`

**File**: `Penny/src/renderer/src/game/office-types.ts`

Add to `WorkstationSprite` interface:
```typescript
achievementBadge?: Phaser.GameObjects.Sprite
```

---

### Summary of files touched

| File | Change |
|---|---|
| `achievements.ts` | Remove duplicate NOTIFICATION emit; add `_unlockedAt` map + persistence; add `getByCategory()` |
| `achievement-panel.ts` | **NEW** — full screen-space grid panel, hotkey A |
| `office-ui.ts` | Add `showAchievementToast()` method; add `A` to help overlay |
| `OfficeScene.ts` | Wire toast; instantiate/destroy `AchievementPanel`; add `keydown-A` |
| `workstation-creation.ts` | Add `achievementBadge` sprite slot |
| `office-types.ts` | Add `achievementBadge?: Phaser.GameObjects.Sprite` to `WorkstationSprite` |

---

### Acceptance criteria mapping

| Criterion | Implementation |
|---|---|
| Achievement unlock triggers visible toast | `office-ui.ts:showAchievementToast()` wired in `ACHIEVEMENT_UNLOCKED` handler |
| Panel shows all achievements locked/unlocked | `achievement-panel.ts:_showPanel()` grid |
| Progress bars for incremental achievements | `ten_tasks` (session) + `hundred_tasks` (total) bars in panel, using `getSessionTasks()` / `getProgress()` |
| `PH.celebrate('achievement')` triggers flow | Already works via test-harness line 485 → `celebrations.achievementUnlocked()` + new toast via EventBus |