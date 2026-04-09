Now I have everything I need. Here's the implementation plan:

---

## Implementation Plan: #179 — Planning Broadcast

### 1. Extend `FlightBoardEntry` in `Penny/src/main/flight-board.ts`

Add `planSummary?: string` to the `FlightBoardEntry` interface — this is the only type change needed.

---

### 2. Add two pure helpers to `Penny/src/main/pods.ts` (exported for tests)

**`extractFilesFromOutput(output: string): string[]`**
Heuristic extractor. Scan lines for path-like tokens matching:
- `src/`, `public/`, `tests/`, `scripts/`, `agents/`, `data/`
- Common config files: `*.json`, `*.yaml`, `*.ts`, `*.tsx`, `*.md` at known root locations
- Pattern: token starts with one of those prefixes or is a basename ending in a known extension at a short path depth.

Deduplicate, cap at 20 results.

**`extractPlanSummary(output: string): string`**
Take the first 2–3 meaningful sentences (non-empty, non-header lines). Cap at 400 chars to stay well under 500-token budget.

**`formatFlightBoardContext(entries: FlightBoardEntry[]): string`**
Build the injection block. Returns `''` if `entries` is empty. Otherwise:
```
--- ACTIVE POD WORK (DO NOT CONFLICT) ---
Pod "<task>" (<podId>): editing <files>
...
---
Plan your approach to avoid modifying these files if possible.
If you must edit a file another pod is touching, note the overlap in your plan.
```
Truncate each file list to first 5 files + `...N more` if longer. Entire block must be ≤ 500 tokens (~2000 chars); truncate entries list if needed.

---

### 3. Write side — post-solve broadcast in `runSolveStage()` in `Penny/src/main/pods.ts`

After `wf.solver.output = result.output` (both single-candidate and multi-candidate paths, after `wf.solver.status = 'complete'` is set), and only when `wf.iteration === 1`:

```ts
const filesInFlight = extractFilesFromOutput(wf.solver.output || '')
const planSummary = extractPlanSummary(wf.solver.output || '')
updateEntry(wf.id, { planSummary, filesInFlight, status: 'solving' })
```

The import for `updateEntry` and `getActiveEntries` is added at the top of `pods.ts` from `./flight-board`.

For the multi-candidate path, broadcast after the winning candidate is selected (after `wf.solver.output` is set from the selected candidate).

---

### 4. Read side — pre-plan injection in `formatSolverMessage()` in `Penny/src/main/pods.ts`

`formatSolverMessage` currently builds the prompt string. Change its signature to also accept a `flightBoardContext?: string` parameter and prepend it when non-empty:

```ts
function formatSolverMessage(
  wf: PodWorkflow,
  feedbackFromExecutor?: string,
  feedbackFromReviewer?: string,
  flightBoardContext?: string,
): string
```

At the call site in `runSolveStage()`, before calling `formatSolverMessage`, call:

```ts
const otherEntries = getActiveEntries().filter(e => e.podId !== wf.id)
const flightBoardContext = formatFlightBoardContext(otherEntries)
```

Pass `flightBoardContext` into `formatSolverMessage`. The context block is injected between the task section and the instructions section (or at the top after the header), only when non-empty.

---

### 5. Register flight board entry at pod creation in `createPod()` in `Penny/src/main/pods.ts`

After `workflows.set(wf.id, wf)` and before `runWorkflow(wf)`, add:

```ts
addEntry({ podId: wf.id, task: wf.task, cwd: wf.cwd })
```

And in `runWorkflow()`, in the `finally` block after `activeWorkflowPromises.delete(wf.id)`:

```ts
updateEntry(wf.id, { status: wf.status === 'complete' ? 'merged' : 'failed' })
```

(The `addEntry` import is already included from step 3.)

---

### 6. New test file: `Penny/tests/main/pods/planning-broadcast.test.ts`

Test cases (pure unit — no headless runner needed for helpers):

- `extractFilesFromOutput` catches `src/**` paths
- `extractFilesFromOutput` catches `public/**`, config files (`*.json`, `*.yaml`)
- `extractFilesFromOutput` deduplicates and caps at 20
- `extractFilesFromOutput` returns `[]` for output with no path-like tokens
- `extractPlanSummary` returns first 2–3 sentences, capped at 400 chars
- `extractPlanSummary` returns `''` for empty input
- `formatFlightBoardContext` returns `''` for empty entries array
- `formatFlightBoardContext` produces correct block for 1+ entries
- `formatFlightBoardContext` stays under 2000 chars with 5+ active pods (truncation)
- `formatFlightBoardContext` truncates file list to 5 + `...N more`