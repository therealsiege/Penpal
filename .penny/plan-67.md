Now I have a complete picture. Here's the implementation plan:

---

## Implementation Plan — sidekick#67 Visual Regression

**Current state:** `visual-regression.spec.ts` and `visual-diff.ts` are already written and wired up. Scripts and dependencies exist. The only gaps are: (1) three harness methods called in the spec don't exist yet, (2) no baseline PNGs, (3) no `.gitkeep` / `.gitignore` for the screenshot dirs.

---

### 1. Add 3 missing PH methods to `test-harness.ts`

**File:** `Penny/src/renderer/src/game/test-harness.ts`

Three methods used in `visual-regression.spec.ts` are absent from the harness:

**a) `zoomToFit()`** — Insert after the existing `resume()` method (~line 612). Delegates to `OfficeScene.zoomToFit(false)`:
```ts
zoomToFit(): void {
  this._maybeRecord('zoomToFit', [])
  ;(this.scene as unknown as { zoomToFit: (a: boolean) => void }).zoomToFit?.(false)
}
```

**b) `setCameraOverview()`** — Insert after `zoomToFit()`. Zooms the camera out to L1 overview (full office visible) using `zoomToFit`, then nudges the zoom slightly lower so LOD drops to overview level:
```ts
setCameraOverview(): void {
  this._maybeRecord('setCameraOverview', [])
  ;(this.scene as unknown as { zoomToFit: (a: boolean) => void }).zoomToFit?.(false)
  this.scene.cameras.main.setZoom(0.35)
}
```

**c) `seasonHudRefresh()`** — Insert after `setCameraOverview()`. Triggers HUD refresh:
```ts
seasonHudRefresh(): void {
  this._maybeRecord('seasonHudRefresh', [])
  ;(this.scene as unknown as { seasonHud?: { refreshForSeasonChange: () => void } })
    .seasonHud?.refreshForSeasonChange?.()
}
```

Also update the `help()` string (~line 758) and the `replay()` switch (~line 872) to include these three new cases. Add to `listCommands()` return array.

---

### 2. Create directory scaffolding

**File:** `Penny/tests/screenshots/baselines/.gitkeep` — empty file so git tracks the empty dir

**File:** `Penny/tests/screenshots/diffs/.gitignore` — contents:
```
# Diff images are generated at test time; not committed
*
!.gitignore
```
This keeps the `diffs/` directory itself in git (via the `.gitignore` file) but excludes the generated PNG diffs.

---

### 3. Build and capture baselines

Run in order:
```sh
cd Penny
npm run build
npm run test:visual:update
```

This writes 7 PNGs to `tests/screenshots/baselines/`:
- `empty-office.png`
- `four-idle-one-room.png`
- `eight-mixed-states.png`
- `minimap-visible.png`
- `season-hud-visible.png`
- `atmosphere-night.png`
- `celebration-rank-up.png`

Verify all 7 exist and are ≤ ~1 MB each.

---

### 4. Verify comparison mode works

```sh
npm run test:visual
```

All 7 tests should pass (0% diff against freshly-written baselines).

---

### 5. No changes needed

- `playwright.config.ts` — already has `visual` project matching `visual-regression.spec.ts` ✅
- `package.json` — `test:visual` and `test:visual:update` scripts already present ✅
- `pixelmatch`, `pngjs`, `@types/pixelmatch` — already in devDependencies ✅
- `visual-diff.ts` — fully implemented ✅
- `visual-regression.spec.ts` — 7 scenarios fully implemented ✅

---

### Summary of files changed/created

| Action | File |
|--------|------|
| Edit | `Penny/src/renderer/src/game/test-harness.ts` — add `zoomToFit`, `setCameraOverview`, `seasonHudRefresh` methods + update `help()`, `listCommands()`, replay switch |
| Create | `Penny/tests/screenshots/baselines/.gitkeep` |
| Create | `Penny/tests/screenshots/diffs/.gitignore` |
| Generate | `Penny/tests/screenshots/baselines/*.png` (7 files via `npm run test:visual:update`) |