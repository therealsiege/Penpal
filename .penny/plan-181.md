Now I have everything I need. Here's the implementation plan:

---

## Implementation Plan: `therealsiege/sidekick#181` — Rebase-before-PR

---

### 1. `Penny/src/main/flight-board.ts` — Add `'pr-created'` status

- In `FlightBoardStatus` union type, add `'pr-created'` between `'executing'` and `'merged'`
- **Do not** add it to `TERMINAL_STATUSES` (it's an active lifecycle state, not expired-eligible)

---

### 2. `Penny/src/main/pods.ts` — Core rebase + PR logic

#### 2a. New exported types (add near other interface definitions, ~line 120)
```ts
export type RebaseStatus = 'clean' | 'conflict-resolved' | 'conflict-aborted'

export interface RebaseResult {
  status: RebaseStatus
  conflictedFiles?: string[]   // unsafe files still conflicted (when aborted)
  resolvedFiles?: string[]     // auto-resolved lock/generated files
}
```

#### 2b. Extend `PodWorkflow` interface (~line 146)
Add two optional fields:
```ts
prUrl?: string
rebaseConflict?: boolean
```

#### 2c. New exported function `rebaseBeforePR(cwd: string): RebaseResult`
Place after `getWorkingTreeDiff` (~line 754). Export for unit testing.

Logic:
1. Guard: run `git rev-parse --is-inside-work-tree` in `cwd`. If throws → return `{ status: 'clean' }` (not a git repo, skip silently).
2. `git fetch origin main` (throw if fails, caller handles)
3. `git rebase origin/main` — if exit 0 → return `{ status: 'clean' }`
4. On conflict exit code:
   - Get conflicted files: `git diff --name-only --diff-filter=U`
   - Classify each file:
     - Lock files: `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml` → `git checkout --theirs <file>`
     - Generated files: matches `*.generated.ts` or `sprites/*.json` → `git checkout --ours <file>`
     - Anything else → **unsafe**, leave conflicted
   - `git add` all resolved files
   - If no unsafe files remain: run `git rebase --continue` (with `GIT_EDITOR=true` env var to suppress editor) → return `{ status: 'conflict-resolved', resolvedFiles }`
   - If unsafe files remain: `git rebase --abort` → return `{ status: 'conflict-aborted', conflictedFiles: unsafeFiles }`

Use `execSync` with `{ cwd, stdio: 'pipe', encoding: 'utf8' }` throughout. Wrap in try/catch: on unexpected git error, attempt `git rebase --abort` and return `'conflict-aborted'`.

#### 2d. New private function `createPodPR(wf: PodWorkflow, label?: string): string`
Returns PR URL (or empty string on failure). Place after `rebaseBeforePR`.

Logic:
1. Get branch: `git rev-parse --abbrev-ref HEAD` in `wf.cwd`
2. If branch is `main` or `master`, log warning and return `''` (don't PR from main)
3. Build `gh pr create` command:
   - `--title`: first 72 chars of `wf.task`
   - `--body`: `"Pod workflow: ${wf.name}\n\nTask: ${wf.task}"` + rebase note if conflict
   - `--label "needs-rebase"` if `label === 'needs-rebase'`
4. Run with `execSync`, capture stdout, return trimmed URL
5. Catch any error: `console.warn('[pods] PR creation failed:', err)`, return `''`

#### 2e. Wire into `runWorkflow` — two pass locations (~lines 1324 and 1332)

Both `if (passed)` and `if (selfFixed)` blocks currently call:
```ts
setStatus(wf, 'complete')
appendWorkflowSummary(wf)
return
```

**Replace both** with a call to a new private async helper `completePodWithPR(wf)`:

```ts
async function completePodWithPR(wf: PodWorkflow): Promise<void> {
  // 1. Rebase
  let rebaseResult: RebaseResult
  try {
    rebaseResult = rebaseBeforePR(wf.cwd)
  } catch (err) {
    console.warn('[pods] Rebase step threw unexpectedly, skipping PR:', err)
    setStatus(wf, 'complete')
    appendWorkflowSummary(wf)
    return
  }

  // 2. Clean rebase → re-run executor once as quick validation
  if (rebaseResult.status === 'clean' || rebaseResult.status === 'conflict-resolved') {
    if (rebaseResult.status === 'conflict-resolved') {
      console.log(`[pods] Auto-resolved ${rebaseResult.resolvedFiles?.length} files (lock/generated)`)
    }
    const { passed: revalidated } = await runExecuteStage(wf)
    if (!revalidated) {
      // Rebase changed something that breaks tests — fall back to feedback loop
      console.warn('[pods] Post-rebase validation failed — returning to feedback loop')
      return  // caller loop continues (wf.status is 'executing' or 'failed' set by runExecuteStage)
    }
    const prUrl = createPodPR(wf)
    wf.prUrl = prUrl
    if (process.env.VITEST !== 'true') {
      updateEntry(wf.id, { status: 'pr-created' })
    }
  } else {
    // conflict-aborted → create PR with needs-rebase label
    console.warn(`[pods] Rebase conflict on: ${rebaseResult.conflictedFiles?.join(', ')} — creating PR with needs-rebase label`)
    const prUrl = createPodPR(wf, 'needs-rebase')
    wf.prUrl = prUrl
    wf.rebaseConflict = true
    if (process.env.VITEST !== 'true') {
      updateEntry(wf.id, { status: 'pr-created' })
    }
  }

  setStatus(wf, 'complete')
  appendWorkflowSummary(wf)
}
```

In `runWorkflow`, replace the two `setStatus(wf, 'complete'); appendWorkflowSummary(wf); return` blocks (after `if (passed)` and `if (selfFixed)`) with:
```ts
await completePodWithPR(wf)
return
```

Also handle `runWorkflow`'s `finally` block — the existing `updateEntry(wf.id, { status: wf.status === 'complete' ? 'merged' : 'failed' })` at line 1363 should only set `'merged'` if `'pr-created'` was NOT already set (otherwise it would overwrite). Change to:
```ts
const currentEntry = getActiveEntries().find(e => e.podId === wf.id)
const finalStatus = wf.status === 'complete'
  ? (currentEntry?.status === 'pr-created' ? 'pr-created' : 'merged')
  : 'failed'
updateEntry(wf.id, { status: finalStatus })
```

---

### 3. `Penny/tests/main/pods/rebase-before-pr.test.ts` — New test file

Mock `child_process.execSync` (the same pattern used in other pods tests). Test cases:

1. **`rebaseBeforePR` clean** — `git rebase origin/main` exits 0 → returns `{ status: 'clean' }`
2. **`rebaseBeforePR` lock file conflict** — rebase exits non-zero, conflicted files = `['package-lock.json']`, checkout+add succeed, `rebase --continue` exits 0 → returns `{ status: 'conflict-resolved', resolvedFiles: ['package-lock.json'] }`
3. **`rebaseBeforePR` unsafe conflict** — conflicted file is `src/main/pods.ts` → calls `git rebase --abort` → returns `{ status: 'conflict-aborted', conflictedFiles: ['src/main/pods.ts'] }`
4. **`rebaseBeforePR` not a git repo** — `git rev-parse --is-inside-work-tree` throws → returns `{ status: 'clean' }` (skip)
5. **`runWorkflow` integration** — mock `execSync` for git + gh commands, mock `runAgentHeadless` returning PASS (3 calls: solver, reviewer, executor) + PASS (re-validate) → workflow reaches `'complete'`, `prUrl` is set, `updateEntry` called with `'pr-created'`
6. **`runWorkflow` conflict path** — rebase aborts → PR created with `needs-rebase` label → `wf.rebaseConflict === true`, workflow still `'complete'`

---

### Summary of changed files

| File | Change |
|------|--------|
| `Penny/src/main/flight-board.ts` | Add `'pr-created'` to `FlightBoardStatus` |
| `Penny/src/main/pods.ts` | `RebaseResult` type, `rebaseBeforePR()`, `createPodPR()`, `completePodWithPR()`, `PodWorkflow.prUrl/rebaseConflict`, wire into `runWorkflow` (2 sites + finally) |
| `Penny/tests/main/pods/rebase-before-pr.test.ts` | New — 6 test cases covering rebase paths and workflow integration |