Now I have a complete picture. Here's the gap analysis and plan:

---

## Implementation Plan — sidekick#68: Expand PH Test Harness

**What already exists (committed in eb39a7ea):**
- `test-harness.ts`: `loadFixture`, `record`, `stopRecording`, `replay` are fully implemented
- `harness-fixtures.ts`: fixture loader via `import.meta.glob('./fixtures/*.json')` — but the `fixtures/` subdirectory is missing
- `tests/harness-capabilities.spec.ts`: full Playwright spec already written — it has stricter expectations than the current implementation
- `tests/fixtures/*.json`: 7 fixture files in the wrong location (need to be in `src/renderer/src/game/fixtures/`)

**What's broken / missing:**
1. `game/fixtures/` directory doesn't exist → `loadFixture` always returns false
2. `HarnessProfileReport` fields don't match what the test asserts (`avgFps` vs `meanFps`, missing `minFps`, `maxFps`, `frameDrops`, `renderCalls`, `peakMemoryMB`, `sampleFrames`, `durationMs`)
3. `getAgentsSummary()` omits `needsInteraction` and `interactionType` — the fixture test needs them
4. `fixtureNames` is a getter but the spec calls it as `PH.fixtureNames()` (a method)

---

### Step-by-step Plan

**1. Create `Penny/src/renderer/src/game/fixtures/` — 5 JSON fixture files**

Copy the correct versions from `tests/fixtures/` but place them in the game bundle path so Vite's `import.meta.glob` picks them up. Files needed (matching what the spec asserts):

- `minimal-smoke.json` — 2 agents, one working/xpLevel 2, one idle/xpLevel 1
- `high-stress-office.json` — 12 agents: varied desk grid, 2 blocked, xpLevels 2–8
- `all-blocked.json` — exactly **5** agents (test asserts `count === 5`), all with `needsInteraction: true`, at least 3 distinct `interactionType` values (tool-approval, question, accept-edits, idle-prompt)
- `mixed-ranks.json` — 6 agents, xpLevels spanning >3 distinct values, all three pod roles present (solver, reviewer, executor)
- `mixed-modes.json` — 4 agents with different `sessionMode` values
- `pod-trio.json` — 3-agent pod (solver/reviewer/executor) — already in tests/fixtures, copy it too

**2. Update `HarnessProfileReport` interface in `test-harness.ts`**

Replace the current interface at lines 55–60 with:
```typescript
export interface HarnessProfileReport {
  durationMs: number          // actual wall time elapsed
  sampleFrames: number        // total rAF frames counted
  avgFps: number              // mean fps over duration
  minFps: number              // worst single-frame fps
  maxFps: number              // best single-frame fps
  frameDrops: number          // frames where instantaneous fps < 30
  renderCalls: number         // Phaser renderer.gl.drawCalls or drawArrays count
  avgMemoryMB: number | null  // average usedJSHeapSize in MB (Chromium only)
  peakMemoryMB: number | null // peak usedJSHeapSize in MB (Chromium only)
}
```

**3. Rewrite `profile(durationMs)` implementation in `test-harness.ts`**

Replace the simple rAF counter (lines 291–311) with a per-frame sampling loop that:
- Tracks `prevTimestamp` to compute each frame's delta → instantaneous fps
- Accumulates `minFps`, `maxFps`, `frameDrops` (fps < 30)
- Samples `performance.memory.usedJSHeapSize` each frame; tracks `sum` and `peak`
- For `renderCalls`: reads `this.scene.game.renderer` — cast to `any` and access `.gl` (WebGL) or Phaser's `drawCount` / `totalObjectsRendered` if available; fall back to counting rAF ticks as a proxy
  - Concrete: `(this.scene.game.renderer as any).drawCount ?? frames` — Phaser 3.60+ exposes `renderer.drawCount` per frame, so accumulate it across frames
- Returns the populated `HarnessProfileReport` on resolve

**4. Update `getAgentsSummary()` in `test-harness.ts`** (lines 231–237)

Add `needsInteraction` and `interactionType` to the returned rows so fixture tests can assert on them:
```typescript
return this.mockAgents.map(a => ({
  id: a.config.id,
  name: a.config.name,
  sessionMode: a.sessionMode,
  needsInteraction: a.needsInteraction ?? false,
  interactionType: a.interactionType ?? 'none',
  xpLevel: a.xp?.level ?? 1,
  podRole: a.config.podRole,
}))
```

**5. Convert `fixtureNames` getter → method in `test-harness.ts`**

The spec at line 55 calls `PH.fixtureNames()`. Change:
```typescript
// Before (getter, line 220):
get fixtureNames(): string[] { return listFixtureNames() }

// After (method):
fixtureNames(): string[] { return listFixtureNames() }
```

Also update the `help()` text (line 747) from `PH.fixtureNames` → `PH.fixtureNames()`.

---

### Files Changed / Created

| File | Action |
|------|--------|
| `Penny/src/renderer/src/game/fixtures/minimal-smoke.json` | **Create** |
| `Penny/src/renderer/src/game/fixtures/high-stress-office.json` | **Create** |
| `Penny/src/renderer/src/game/fixtures/all-blocked.json` | **Create** (5 agents, 4 interaction types) |
| `Penny/src/renderer/src/game/fixtures/mixed-ranks.json` | **Create** (6 agents, xpLevels 1/2/5/7/9/10, all 3 roles) |
| `Penny/src/renderer/src/game/fixtures/mixed-modes.json` | **Create** |
| `Penny/src/renderer/src/game/fixtures/pod-trio.json` | **Create** |
| `Penny/src/renderer/src/game/test-harness.ts` | **Edit**: interface, `profile()`, `getAgentsSummary()`, `fixtureNames` getter→method, `help()` text |

No changes needed to: `harness-fixtures.ts`, `harness-capabilities.spec.ts`, `playwright.config.ts`.