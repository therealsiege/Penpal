The implementation is **already complete**. Here's the full picture:

---

## Issue #72: Already Implemented

After exploring `celebrations.ts` and `animation-config.ts`, **all described features are already in the codebase**. No implementation work is needed — only verification/acceptance testing.

### What exists

**`Penny/src/renderer/src/game/celebrations.ts`**
- `_pending: PendingCelebration[]` queue with `_kickDispatch` / `_dispatchOne` (lines 135–251)
- Priority ordering: `rank-up=5 > milestone=4 > quest=3 > task=2 > error=1` (lines 91–97)
- Same-type merge within `sameTypeMergeWindowMs` window (lines 190–195)
- Per-agent cooldown maps: `_lastRankUpAt`, `_lastTaskCompleteAt`, `_lastErrorAt` (lines 139–141)
- Combo tracking: `_taskComboStreak` + `_taskComboLastPlayAt` (lines 142–143)
- Tier logic in `_playTaskComplete`: tier2=bigger burst, tier3=screen flash + `_comboFloatingLabel()`, fire=orange tint (lines 347–430)
- `_comboFloatingLabel(streak)` renders "COMBO x{N}" screen-space text (lines 432–462)

**`Penny/src/renderer/src/game/animation-config.ts`**
- Full `celebrations` config section (lines 312–323) with: `queueGapMs=400`, `comboWindowMs=10_000`, `comboCooldownMs=10_000`, `sameTypeMergeWindowMs=2000`, `rankUpCooldownMs=5000`, `taskCompleteCooldownMs=1000`, `errorCooldownMs=3000`, `comboTier2Min=2`, `comboTier3Min=3`, `comboTierFireMin=5`

**`OfficeScene.ts:163`** — `get celebrationsManager()` getter exposes the manager so `PH.celebrate()` in `test-harness.ts` routes through the queue.

### Acceptance criteria status
| Criterion | Status |
|---|---|
| Rapid events don't overlap | ✅ 400ms gap enforced in `_dispatchOne` |
| Combo text at 3+ completions | ✅ `_comboFloatingLabel` fired when `streak >= comboTier3Min` |
| Cooldowns prevent spam | ✅ Per-agent Maps + config values |
| `PH.celebrate()` respects queue | ✅ Routes through `celebrations.rankUp/taskComplete/error` |

### Recommended next steps (plan for executor)

1. **Verify no gap exists** — Run `PH.celebrate('taskComplete')` 6× rapidly in the debug console and confirm: no visual overlap, combo text appears at 3rd, orange tint at 5th
2. **Check `questCelebration` is queued** — `OfficeScene.ts:780` calls `this.celebrations.questCelebration(...)` — confirm it routes through `_enqueueCelebration('quest', ...)` not a bypass path
3. **Close issue** — If all AC pass, the issue is done; no code changes required