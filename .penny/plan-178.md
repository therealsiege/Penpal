Now I have enough context. Here's the implementation plan:

---

## Implementation Plan — `flight-board` (#178)

### 1. `Penny/src/main/flight-board.ts` (new file)

Create the module with the full API. Key implementation details:

- Import `atomicUpdate` / `atomicWrite` from `./atomic-store`
- `FLIGHT_BOARD_PATH = path.resolve(__dirname, '..', '..', 'data', 'flight-board.json')`
- `FALLBACK: FlightBoard = { version: 1, entries: [] }`
- `getFlightBoard()` — read with `JSON.parse` + fallback; filter expired entries on read (auto-cleanup: terminal status `merged`/`failed` older than 24h)
- `getActiveEntries()` — calls `getFlightBoard().entries` (cleanup already applied)
- `getFilesInFlight()` — builds `Map<string, FlightBoardEntry>` from all `filesInFlight` arrays across active entries
- `addEntry(partial)` — fills defaults (`startedAt`, `updatedAt`, `status: 'planning'`, `filesInFlight: []`), appends via `atomicUpdate`; returns completed entry
- `updateEntry(podId, updates)` — `atomicUpdate` finds entry by `podId`, merges updates + sets `updatedAt`
- `removeEntry(podId)` — `atomicUpdate` filters out by `podId`
- `hasFileConflict(files)` — builds `getFilesInFlight()` map, returns first entry whose files overlap, or `null`
- Export the `FlightBoardEntry` and `FlightBoard` types

### 2. `Penny/src/main/ipc.ts` — register IPC handlers

In the `registerIpc()` function, after the existing pod handlers block (~line 370 area), add:

```ts
import {
  getActiveEntries,
  getFilesInFlight,
} from './flight-board'
```

Add at top of file with other imports.

Then in `registerIpc()`:
```ts
// ── Flight Board ──────────────────────────────────────────────────────
ipcMain.handle('flight-board:list', wrapHandler(() => getActiveEntries()))
ipcMain.handle('flight-board:files-in-flight', wrapHandler(() =>
  Object.fromEntries(getFilesInFlight())
))
```

Note: `Map` isn't serializable over IPC — convert to plain object with `Object.fromEntries`.

### 3. `Penny/src/preload/index.ts` — expose to renderer

In the `window.api` `contextBridge.exposeInMainWorld('api', { ... })` block, add after the pod APIs:

```ts
// Flight Board
flightBoardList: () => ipcRenderer.invoke('flight-board:list'),
flightBoardFilesInFlight: () => ipcRenderer.invoke('flight-board:files-in-flight'),
```

### 4. `Penny/tests/unit/flight-board.test.ts` (new file)

Check test directory first — if tests are co-located in `src/main/` (like `pods.test.ts`), place at `Penny/src/main/flight-board.test.ts` instead.

Test cases using `vitest` (matching existing test style):
- `addEntry` — creates entry with defaults, returns completed entry with generated id if none provided
- `updateEntry` — merges updates, bumps `updatedAt`
- `removeEntry` — entry no longer present after removal
- `hasFileConflict` — returns `null` when no overlap; returns owning entry when overlap detected
- `getFilesInFlight` — maps each file to its owning entry
- auto-cleanup — expired terminal entries excluded from `getActiveEntries()`

Each test should use a temp file path (via `os.tmpdir()`) to avoid polluting real data, similar to existing test patterns.

---

**Files touched:**
1. `Penny/src/main/flight-board.ts` — new, ~120 lines
2. `Penny/src/main/ipc.ts` — add import + 2 `ipcMain.handle` calls
3. `Penny/src/preload/index.ts` — add 2 API methods to `contextBridge`
4. `Penny/src/main/flight-board.test.ts` — new unit tests (co-located with other tests)