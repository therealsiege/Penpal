Here is the implementation plan for therealsiege/sidekick#185:

---

## Implementation Plan — Kanban Pod Control Surface

### 1. `Penny/src/main/pods.ts` — Add `phaseOverrides` field and wire into helpers

**1a.** Add `phaseOverrides` to `PodWorkflow` interface (after line 175, before closing `}`):
```ts
phaseOverrides?: Partial<Record<PodPhase, { model?: string; timeoutMultiplier?: number }>>
```

**1b.** Update `getModelOverride` (line 329) to check `phaseOverrides` first:
```ts
function getModelOverride(wf: PodWorkflow, phase: PodPhase): string | undefined {
  const override = wf.phaseOverrides?.[phase]?.model
  if (override) return override
  return wf.resolvedProfile?.phases?.[phase]?.model || undefined
}
```

**1c.** Update `getTimeout` (line 323) to accept a `phase` param and check `phaseOverrides` first:
```ts
function getTimeout(wf: PodWorkflow, baseMs: number, phase?: PodPhase): number {
  const mult = (phase && wf.phaseOverrides?.[phase]?.timeoutMultiplier)
    ?? wf.resolvedProfile?.timeoutMultiplier
    ?? 1
  return Math.round(baseMs * mult)
}
```
Update all call sites to pass the relevant phase (e.g., `getTimeout(wf, EXECUTE_TIMEOUT_MS, 'execute')` for solver, `getTimeout(wf, PLAN_TIMEOUT_MS, 'plan')` for reviewer, `getTimeout(wf, EXECUTE_TIMEOUT_MS, 'validate')` for executor).

**1d.** Add exported `overridePod` function (after `listPods`):
```ts
export function overridePod(
  workflowId: string,
  phase: PodPhase,
  override: { model?: string; timeoutMultiplier?: number }
): boolean {
  const wf = workflows.get(workflowId)
  if (!wf) return false
  wf.phaseOverrides = { ...wf.phaseOverrides, [phase]: override }
  wf.updatedAt = Date.now()
  persistWorkflows()
  return true
}
```

---

### 2. `Penny/src/renderer/src/types.ts` — Extend `PodWorkflow` client type

Add to `PodWorkflow` interface (after `error?`):
```ts
runtimeProfile?: string
resolvedProfile?: { phases: Record<string, { model: string }>; timeoutMultiplier: number }
phaseOverrides?: Partial<Record<'plan' | 'execute' | 'validate', { model?: string; timeoutMultiplier?: number }>>
```

---

### 3. `Penny/src/main/ipc.ts` — Register `pod:override` handler

Import `overridePod` from `./pods`. Add handler after the `pod:cancel` block:
```ts
ipcMain.handle('pod:override', wrapHandler((workflowId: unknown, phase: unknown, override: unknown) => {
  if (typeof workflowId !== 'string') throw new Error('workflowId must be a string')
  if (typeof phase !== 'string' || !['plan', 'execute', 'validate'].includes(phase)) throw new Error('invalid phase')
  if (typeof override !== 'object' || override === null) throw new Error('override must be object')
  const ok = overridePod(workflowId, phase as 'plan' | 'execute' | 'validate', override as { model?: string; timeoutMultiplier?: number })
  return { success: ok }
}))
```

---

### 4. `Penny/src/preload/index.ts` — Expose `overridePod`

Add to the `contextBridge.exposeInMainWorld` call alongside other pod methods:
```ts
overridePod: (workflowId: string, phase: string, override: { model?: string; timeoutMultiplier?: number }) =>
  ipcRenderer.invoke('pod:override', workflowId, phase, override),
```

---

### 5. `Penny/src/renderer/src/components/PodCard.tsx` — New file: expandable pod card

Create with these responsibilities:
- **Props**: `workflow: PodWorkflow`, `onPause`, `onResume`, `onCancel`, `onOverride`
- **Collapsed view**: name (truncated), status badge, `iter X/Y`, elapsed time since last stage entry
- **Expanded view** (toggled by click):
  - Phase Config grid (3 rows: plan/execute/validate) showing: role label, model name from `resolvedProfile.phases[phase].model` (or `phaseOverrides[phase].model` if set), status indicator (✓ complete / ◉ running / ○ pending), elapsed ms for running phase
  - MCP tools: read `solver.allowedTools` (from `PodRole` — check what fields PodRole has) and render with the existing `extractAgentTools` helper pattern from CommandCenter.tsx
  - Timeout: `resolvedProfile.timeoutMultiplier ?? 1`x multiplier, show base timeout (plan=10m, execute=30m)
  - **Override Next Phase** section: only shown when pod is active and not in final phase
    - Determine `nextPhase`: solving→`plan`, reviewing→`validate`, executing→nothing
    - Model selector: dropdown with options `['opus', 'sonnet', 'haiku', 'coder:30b']`
    - Timeout multiplier: radio/button group `[1x, 2x, 5x]`
    - Apply button calls `onOverride(wf.id, nextPhase, { model, timeoutMultiplier })`
  - If `phaseOverrides` has an entry: show badge `⚡ override: <model> for <phase>`
  - Controls row: Pause / Resume / Cancel buttons (greyed if terminal state)
- **Failed pod**: red left border, show `wf.error` preview (first 100 chars)
- **Completed pod**: muted opacity (0.6), green/red result badge based on `lastExecutorPassed`

---

### 6. `Penny/src/renderer/src/components/KanbanBoard.tsx` — New file: kanban board

Column → status mapping:
- **Planning**: `['pending', 'solving', 'feedback']`
- **Executing**: `['reviewing']`  
- **Validating**: `['executing', 'self-fixing']`

Column header stats (computed from props `workflows: PodWorkflow[]`):
- Active pod count for that column
- Model breakdown: count occurrences of `resolvedProfile.phases['execute' | 'plan' | 'validate'].model` across pods in column
- Avg duration in current phase: diff `Date.now() - stageHistory[last].enteredAt` for active pods

Column flash animation: use a `useRef` to track previous pod IDs per column; when a new pod ID appears in a column, add a CSS class `animate-column-flash` (a brief border-color pulse via keyframes in Tailwind `tailwind.config.js` or inline style with `animation`).

Layout: `flex gap-4` with three columns, each `flex-1 min-w-[280px]`. Each column scrolls independently (`overflow-y-auto max-h-[600px]`). Cards use `flex flex-col gap-2`.

Also render a 4th muted column "Completed" for `['complete', 'failed']` pods (last 10 only, oldest discarded).

---

### 7. `Penny/src/renderer/src/panels/CommandCenter.tsx` — Wire up kanban board

**7a.** Import `KanbanBoard` from `../components/KanbanBoard`.

**7b.** Add to `window.api` call for override:
```ts
const handleOverride = useCallback(async (workflowId: string, phase: string, override: { model?: string; timeoutMultiplier?: number }) => {
  await window.api.overridePod(workflowId, phase, override)
  toast(`Override set for ${phase} phase`, 'success')
}, [])
```

**7c.** Add a "Dispatch Board" section in the CommandCenter layout (below Quick Actions or as a collapsible panel). Render `<KanbanBoard workflows={podWorkflows ?? []} onPause={...} onResume={...} onCancel={...} onOverride={handleOverride} />`. The existing `podWorkflows` polling (5s interval, line 1418) feeds this directly — no new polling needed.

---

### 8. Column flash keyframe (Tailwind config or CSS)

In `Penny/src/renderer/src/index.css` (or equivalent global CSS), add:
```css
@keyframes column-flash {
  0%   { border-color: rgba(99, 102, 241, 0.6); }
  100% { border-color: transparent; }
}
.animate-column-flash {
  animation: column-flash 800ms ease-out;
}
```

---

### Notes for executor

- `PodRole` type in `types.ts` — check whether it includes `allowedTools`. If not, the MCP tools section should be skipped or read from the solver `AgentConfig` via a separate lookup.
- The `nextPhase` mapping for Override: solver (`solving`/`feedback`) → next is reviewer → phase key is `plan`; reviewer (`reviewing`) → next is executor → phase key is `validate`; executor (`executing`) → no override possible.
- `phaseOverrides` must survive the `persistWorkflows()` serialization in pods.ts — it's already part of the `PodWorkflow` object so the existing JSON serialization handles it automatically.
- Do not change the existing `PodStatusModal` — the kanban board is additive.