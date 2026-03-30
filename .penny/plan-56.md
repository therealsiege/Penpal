Now I have everything needed. Here's the implementation plan:

---

## Implementation Plan for sidekick#56

**Context**: `capabilitiesStatus()` is already wired in preload (line 100) but lacks `.then(unwrap)` and the `env.d.ts` return type is still `Record<string, unknown>`. No shared `CapabilityId` type exists on this branch yet. The full DTO types live in origin/main but haven't been merged here.

---

### 1. Create `Penny/src/main/capabilities-ids.ts` (new file)

```ts
export const CAPABILITY_IDS = [
  'orchestrator',
  'graph',
  'evals_harness',
  'vault',
  'pods',
  'evals_spot_check',
  'mcp_stdio',
] as const

export type CapabilityId = (typeof CAPABILITY_IDS)[number]
```

---

### 2. Add DTO types to `Penny/src/renderer/src/types.ts`

Append after existing exports:

```ts
export type { CapabilityId } from '../../main/capabilities-ids'

export type CapabilityCheckStatus = 'ok' | 'missing' | 'error' | 'unknown'

export interface CapabilityStatusItem {
  status: CapabilityCheckStatus
  message?: string
  lastCheckedAt?: string
}

/** One entry per capability id — required keys, not an open string map. */
export type CapabilitiesStatusItems = {
  [K in CapabilityId]: CapabilityStatusItem
}

export interface CapabilitiesStatusPayload {
  updatedAt: string
  overall: string
  items: CapabilitiesStatusItems
}
```

> Note: `overall` typed as `string` (not a union) until #55 specifies the exact enum — keeps stubbing safe.

---

### 3. Update `Penny/src/renderer/src/env.d.ts` — line 122

Replace:
```ts
capabilitiesStatus: () => Promise<{ updatedAt: string; overall: string; items: Record<string, unknown> }>
```
With:
```ts
capabilitiesStatus: () => Promise<import('./types').CapabilitiesStatusPayload>
```

---

### 4. Update `Penny/src/preload/index.ts` — line 100

Add `.then(unwrap)` to the existing call:

Replace:
```ts
capabilitiesStatus: () => ipcRenderer.invoke('capabilities:status'),
```
With:
```ts
capabilitiesStatus: () => ipcRenderer.invoke('capabilities:status').then(unwrap),
```

---

### 5. Update `Penny/src/main/ipc.ts` — capabilities:status handler (~line 1120)

Add import at top of file:
```ts
import { CAPABILITY_IDS } from './capabilities-ids'
```

Replace the stub body:
```ts
ipcMain.handle('capabilities:status', wrapHandler(() => ({
  updatedAt: new Date().toISOString(),
  overall: 'unknown',
  items: {} as Record<string, string>,
})))
```
With:
```ts
ipcMain.handle('capabilities:status', wrapHandler(() => ({
  updatedAt: new Date().toISOString(),
  overall: 'unknown',
  items: Object.fromEntries(
    CAPABILITY_IDS.map(id => [id, { status: 'unknown' as const }]),
  ) as Record<CapabilityId, { status: 'unknown' }>,
})))
```

Also add `CapabilityId` to the import line for the type annotation:
```ts
import { CAPABILITY_IDS, type CapabilityId } from './capabilities-ids'
```

---

### 6. Include `capabilities-ids.ts` in renderer typecheck path — `Penny/tsconfig.web.json`

Check if `src/main/**/*` is already included. If not, add `"src/main/capabilities-ids.ts"` to the `include` array so the `import type { CapabilityId } from '../../main/capabilities-ids'` in `types.ts` resolves under `tsc --project tsconfig.web.json`.

---

### Done-when validation

- `npx tsc --noEmit` (or `npx tsc -p tsconfig.web.json --noEmit`) passes with no `any` for `capabilitiesStatus`.
- `window.api.capabilitiesStatus()` resolves to `CapabilitiesStatusPayload` with all 7 item keys typed.