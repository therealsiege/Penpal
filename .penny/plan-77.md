Now I have everything I need. Here's the implementation plan:

---

## Implementation Plan: sidekick#77 — Quest Log Panel

### 1. `Penny/src/renderer/src/game/quest-system.ts`

Add `QuestStats` interface and `getQuestStats()` method to the `QuestSystem` class.

```typescript
export interface QuestStats {
  totalCompleted: number
  xpEarnedToday: number
  averageDifficulty: number   // 1=trivial .. 5=legendary
  longestStreak: number       // consecutive completed (non-failed) quests
}
```

`getQuestStats()` implementation:
- `totalCompleted` — filter `_completedQuests` by `status === 'completed'`
- `xpEarnedToday` — sum `xpReward` for completed quests where `completedAt >= start of today (midnight)`
- `averageDifficulty` — mean of `{ trivial:1, normal:2, hard:3, epic:4, legendary:5 }[q.difficulty]` across all completed quests (0 if none)
- `longestStreak` — reverse the `_completedQuests` array (oldest first) and count the max consecutive `status === 'completed'` run

---

### 2. NEW `Penny/src/renderer/src/game/quest-panel.ts`

Create `QuestPanel` class following the exact `SeasonHUD` overlay pattern:

**Public API:**
- `constructor(scene: Phaser.Scene)`
- `init(viewWidth: number, viewHeight: number): void` — create panel container
- `setViewSize(w: number, h: number): void` — reposition to bottom-left
- `toggleQuestLog(): void` — fade in/out, rebuild content on show
- `update(): void` — refresh active quest list
- `destroy(): void`
- `getPanelScreenPosition(): { x: number; y: number }` — returns center-top of panel (for star-fly target)

**Panel layout** (bottom-left, 240×dynamic):
- `setScrollFactor(0)`, depth 9999
- Position: `x=10, y=viewHeight-10` with origin bottom-left
- Background: `activeTheme.bg` rounded rect with `activeTheme.panelStroke` border
- Title "QUEST LOG" (same font/size as leaderboard)
- Divider sprite or Graphics line
- **Active section:** up to 5 active quests. Per row: difficulty star sprite (GAME_ICONS frame, STAR_* per difficulty), agent ID truncated, elapsed time (`mm:ss`), `+${xpReward} XP`. Empty state: "No active quests"
- **History section:** up to 5 most recent completed quests. Per row: check/X icon (CHECKMARK or CIRCLE_GREY), title (truncated), XP earned, duration formatted
- **Stats footer:** `${totalCompleted} done | ⌀${avg.toFixed(1)} diff | x${streak}`
- Fade in/out tweens (180ms in, 140ms out) — same timing as leaderboard

**Difficulty star frames:** use the `DIFFICULTY_STAR_FRAME` mapping already in `workstation-animation.ts` — re-export or duplicate locally. Import `QuestSystem.getDifficultyConfig()` for colors.

---

### 3. `Penny/src/renderer/src/game/workstation-animation.ts`

In the working-mode branch that shows the quest star (~line 341–350), after the existing bob tween, add difficulty-proportional animations:

- `hard`: alpha 0.95, bob duration 900ms, add a slow scale pulse (scale ±0.04, 1600ms yoyo repeat)
- `epic`: alpha 1.0, bob duration 700ms, faster scale pulse (scale ±0.08, 900ms yoyo repeat), `setTint(0xf59e0b)` yellow
- `legendary`: alpha 1.0, bob duration 500ms, rapid scale pulse (scale ±0.12, 600ms yoyo repeat), `setTint(0xef4444)` red, add a second alpha flicker tween (0.8↔1.0, 400ms yoyo repeat)

Extract a helper `_applyQuestStarStyle(ws: WorkstationSprite, difficulty: QuestDifficulty)` called from the existing working-mode block. Store any additional tweens in a new optional `ws.questIconPulseTween?: Phaser.Tweens.Tween` field (add to `WorkstationSprite` in `office-types.ts`). Destroy it in the idle transition and in `workstation-creation.ts` cleanup.

---

### 4. `Penny/src/renderer/src/game/office-types.ts`

Add to `WorkstationSprite`:
```typescript
questIconPulseTween?: Phaser.Tweens.Tween
```

---

### 5. `Penny/src/renderer/src/game/celebrations.ts`

Add public method `starFlyToPanel(worldX, worldY, difficulty, panelScreenX, panelScreenY)`:

```typescript
starFlyToPanel(
  worldX: number, worldY: number,
  difficulty: QuestDifficulty,
  panelScreenX: number, panelScreenY: number,
): void
```

Implementation:
1. Convert world→screen: `const cam = this._scene.cameras.main; const sx = (worldX - cam.scrollX) * cam.zoom; const sy = (worldY - cam.scrollY) * cam.zoom`
2. Create screen-space star sprite at `(sx, sy - 16)`: `setScrollFactor(0)`, depth 10000, alpha 0.9, scale 0.38
3. Tween to `(panelScreenX, panelScreenY)` over 600ms `Cubic.easeIn`:
   - scaleX/Y: 0.38 → 0.18
   - alpha: 0.9 → 0
   - `onComplete: () => star.destroy()`

---

### 6. `Penny/src/renderer/src/game/OfficeScene.ts`

**Imports:** Add `QuestPanel` from `./quest-panel`.

**Property:** `private questPanel!: QuestPanel`

**In `create()`** (after `seasonHud.init`):
```typescript
this.questPanel = new QuestPanel(this)
this.questPanel.init(this.viewWidth, this.viewHeight)
```

**New hotkey `keydown-Q`** (after the existing `keydown-B` block):
```typescript
this.input.keyboard.on('keydown-Q', (e: KeyboardEvent) => {
  if (shouldIgnoreKeyboardShortcuts(e)) return
  e.preventDefault()
  this.questPanel.toggleQuestLog()
})
```

**In `RESIZE` handler** (after `seasonHud.setViewSize`):
```typescript
if (this.questPanel) { this.questPanel.setViewSize(gameSize.width, gameSize.height) }
```

**In `QUEST_COMPLETED` handler** (after calling `questCelebration`), add:
```typescript
if (this.questPanel.isVisible) {
  const panelPos = this.questPanel.getPanelScreenPosition()
  this.celebrations.starFlyToPanel(wx, wy, difficulty as QuestDifficulty, panelPos.x, panelPos.y)
}
```

**In `update()** (after `seasonHud.update()`):
```typescript
if (this.questPanel && time - this.lastQuestPanelUpdateAt >= 3000) {
  this.lastQuestPanelUpdateAt = time
  this.questPanel.update()
}
```
Add `private lastQuestPanelUpdateAt = 0` property.

**In `destroy()`** (after `seasonHud.destroy()`):
```typescript
this.questPanel.destroy()
```

**In help overlay** (if one exists listing hotkeys): add `Q — quest log` entry.

---

### 7. `Penny/src/renderer/src/game/workstation-creation.ts`

In the workstation cleanup function (~line 1058), destroy `questIconPulseTween`:
```typescript
if (ws.questIconPulseTween) ws.questIconPulseTween.destroy()
```

---

**Acceptance checklist mapping:**
- ✅ Active quests visible → quest-panel.ts active section
- ✅ Completed history + XP breakdown → quest-panel.ts history section + stats footer
- ✅ Difficulty stars animate proportionally → workstation-animation.ts `_applyQuestStarStyle()`
- ✅ Quest completion triggers star-fly → celebrations.ts `starFlyToPanel()` called from OfficeScene QUEST_COMPLETED handler