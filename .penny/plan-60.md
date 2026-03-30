Here is the numbered implementation plan for therealsiege/sidekick#60:

---

## Implementation Plan: OfficeScene `O` hotkey + `setCapabilitiesBoard` + CommandCenter poll

### Files changed
1. `Penny/src/renderer/src/game/office-ui.ts`
2. `Penny/src/renderer/src/game/OfficeScene.ts`
3. `Penny/src/renderer/src/panels/CommandCenter.tsx`
4. `Penny/src/main/ipc.ts`
5. `Penny/src/renderer/src/env.d.ts`

---

### Step 1 — `office-ui.ts`: Add ops board overlay

Add to the class:

```typescript
// Property
private opsOverlay: Phaser.GameObjects.Container | null = null
opsVisible = false

// Public API
showOpsBoardOverlay(rows: { id: string; title: string; status: string }[]): void
hideOpsBoardOverlay(): void
```

**`showOpsBoardOverlay`** — modelled after `showHelpOverlay`:
- Guard: if `this.opsOverlay` exists, destroy it first (refresh in-place)
- Set `this.opsVisible = true`
- Create `Phaser.GameObjects.Container` at depth 9998 (below help at 9999), `scrollFactor(0)`
- Backdrop: semi-transparent rect covering viewport
- Panel: centred dark rect, ~480 × (56 + rows.length × 28) px
- Title text: `"Ops Board"` styled like help overlay title
- For each row: a coloured dot (green=ok, yellow=degraded, red=error, grey=unknown) + title text + status label
- Alpha 0 → 1 fade over 200 ms
- Store in `this.opsOverlay`

**`hideOpsBoardOverlay`** — modelled after `hideHelpOverlay`:
- Guard if no overlay
- `this.opsVisible = false`
- Fade out 150 ms, destroy on complete, null the ref

**`destroy()`** — add cleanup: if `this.opsOverlay` destroy it.

---

### Step 2 — `OfficeScene.ts`: Add `O` key handler + update ESC + add `setCapabilitiesBoard`

**2a. `setCapabilitiesBoard(rows)` — new public method** (add near bottom of class, before `destroy()`):
```typescript
setCapabilitiesBoard(rows: { id: string; title: string; status: string }[]): void {
  this._capRows = rows
  if (this.ui.opsVisible) {
    // Refresh live
    this.ui.showOpsBoardOverlay(rows)
  }
}
private _capRows: { id: string; title: string; status: string }[] = []
```

**2b. ESC handler** — update document-order comment and add ops board first:
```typescript
this.input.keyboard.on('keydown-ESC', (e: KeyboardEvent) => {
  if (shouldIgnoreKeyboardShortcuts(e)) return
  e.preventDefault()
  if (this.ui.opsVisible) { this.ui.hideOpsBoardOverlay(); return }  // ← new
  if (this.ui.helpVisible) { this.ui.hideHelpOverlay(); return }
  if (this.selection.isFocused) { this.selection.exitFocusMode(); return }
  this.selection.deselectAgent()
  this.selection.stopAutoPan()
})
```
Add a comment above the ESC block: `// ESC document order: ops board → help → focus → deselect`

**2c. O key handler** — add after the T key handler block:
```typescript
// O — toggle ops / capabilities board
this.input.keyboard.on('keydown-O', (e: KeyboardEvent) => {
  if (shouldIgnoreKeyboardShortcuts(e)) return
  e.preventDefault()
  if (this.ui.opsVisible) {
    this.ui.hideOpsBoardOverlay()
  } else {
    this.ui.showOpsBoardOverlay(this._capRows)
  }
})
```

---

### Step 3 — `CommandCenter.tsx`: Poll `capabilitiesStatus`, map rows, call scene

**3a.** Add a `CAPABILITY_TITLES` inline constant at module scope (before the component):
```typescript
// Inline catalog — replace with shared util when #61 lands
const CAPABILITY_TITLES: Record<string, string> = {
  graph: 'Knowledge Graph',
  scheduler: 'Scheduler',
  agents: 'Agent Sessions',
  pods: 'Pod Workflows',
  etl: 'ETL Pipeline',
  mcp: 'MCP Servers',
  // extend as #55/#56 fill in items keys
}
```

**3b.** Add a `usePolling` call for capabilities status alongside the existing polls:
```typescript
const { data: capStatus } = usePolling(
  () => window.api.capabilitiesStatus().catch(() => null),
  10_000,
)
```

**3c.** Add a `useEffect` that maps the snapshot and calls the scene directly via `sceneRef`:
```typescript
useEffect(() => {
  if (!capStatus || !sceneRef.current) return
  const rows = Object.entries(capStatus.items as Record<string, string>).map(([id, status]) => ({
    id,
    title: CAPABILITY_TITLES[id] ?? id,
    status,
  }))
  sceneRef.current.setCapabilitiesBoard(rows)
}, [capStatus])
```

No new IPC round-trip — reuses existing `window.api.capabilitiesStatus()` via the same `usePolling` mechanism at the same 10 s cadence as `contextHealth`.

---

### Step 4 — `ipc.ts`: Fix `items` type in stub

Change:
```typescript
items: {} as Record<string, unknown>,
```
to:
```typescript
items: {} as Record<string, string>,
```

---

### Step 5 — `env.d.ts`: Tighten `capabilitiesStatus` return type

Change `items: Record<string, unknown>` → `items: Record<string, string>` in the `capabilitiesStatus` signature at line 122.

---

### Verification checklist (Done-when)
- `O` opens the ops board; pressing `O` again closes it
- `ESC` while ops board open closes ops board only (does not also close help)
- Ops board data matches what `capabilitiesStatus` returns; titles come from `CAPABILITY_TITLES`
- No extra IPC calls — `capabilitiesStatus` polls at 10 s via existing `usePolling` pattern
- `[data-disable-office-hotkeys="true"]` on a modal suppresses `O` (existing `shouldIgnoreKeyboardShortcuts` covers this automatically)