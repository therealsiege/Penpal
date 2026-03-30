The test file already exists at 564 lines. Here is the implementation plan accounting for the current state:

---

## Implementation Plan — sidekick#64: CelebrationManager Unit Tests

### Observation

`tests/renderer/game/celebrations.test.ts` (564 lines) and `tests/renderer/game/celebrations-queue.test.ts` (142 lines) already exist. The main test file covers all 7+ celebration types and the queue file covers priority/cooldown/merge-window behavior. The plan below verifies DoD completeness and fills the one gap identified.

---

### 1. Verify `tests/renderer/game/celebrations.test.ts` passes as-is

**File:** `Penny/tests/renderer/game/celebrations.test.ts` — no changes needed.

Run: `cd Penny && npm test -- --reporter=verbose tests/renderer/game/celebrations`

Expected: all 18 tests in `describe('CelebrationManager')` pass.

---

### 2. Add explicit duplicate-key deduplication guard test

**Gap:** DoD requires "Verifies guard conditions prevent duplicates." The existing `guards` block tests `setCelebrationsAllowed(false)` but not the same-key cooldown drop (rank-up for same agent within cooldown window). That logic lives in queue, but belongs in the main guard suite for clarity.

**File:** `Penny/tests/renderer/game/celebrations.test.ts`

**Change:** Inside `describe('guards')`, append a second `it` block after line 544:

```ts
it('drops duplicate rankUp for same agent within cooldown window', () => {
  vi.spyOn(soundEngine, 'levelUp').mockImplementation(() => {})
  vi.spyOn(Math, 'random').mockReturnValue(0.2)
  const b = createScene()
  const m = new CelebrationManager(b.scene as never)

  m.rankUp(1, 2, 'agent-A', 'Senior', 0xffffff)
  drainQueue(b)
  const firstShakeCount = b.shake.mock.calls.length
  const firstSoundCount = (soundEngine.levelUp as ReturnType<typeof vi.fn>).mock.calls.length

  // Second rankUp for same agent — cooldown not expired, should be dropped
  m.rankUp(1, 2, 'agent-A', 'Staff', 0xffffff)
  // Flush queue — nothing new dispatched
  drainQueue(b)

  expect((soundEngine.levelUp as ReturnType<typeof vi.fn>).mock.calls.length).toBe(firstSoundCount)
})
```

---

### 3. Verify `celebrations-queue.test.ts` covers queue DoD items

**File:** `Penny/tests/renderer/game/celebrations-queue.test.ts` — no changes needed.

Confirms: priority ordering, cooldown drop, merge-window coalescing.

---

### 4. Confirm `npm test` passes end-to-end

Run: `cd Penny && npm test`

All renderer test files (including `celebrations.test.ts` and `celebrations-queue.test.ts`) run under jsdom environment per `vitest.config.ts`. Both files use `// @vitest-environment jsdom` header and the standard mock pattern (`vi.mock('phaser', ...)` + `createScene()` factory).

---

### DoD Checklist

| Item | Status |
|------|--------|
| Test file passes `npm test` | Verify in step 1 |
| Covers all 7+ celebration types | ✅ (rankUp, taskComplete, milestone, error, questReward, seasonEnd, purchase + 5 more) |
| Guard conditions prevent duplicates | ✅ after step 2 |
| Screen shake parameters per type | ✅ (milestone: `shake(100, 0.003)`, error: `shake(60, 0.002)`, others: no shake) |