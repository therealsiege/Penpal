Now I have everything I need. Here is the implementation plan:

---

## Implementation Plan: sidekick#133 — Add Sidekick as duder

### Context
OpenCode/OpenClaw/NemoClaw are surfaced as duders via `opencode-sessions.ts` → `getOpencodeSessions()` → merged into `setAgents()` in OfficeScene. Sidekick (the analytics MCP server + scheduler at `SIDEKICK_ROOT/analytics`) should follow the same pattern.

---

**1. `Penny/src/main/opencode-sessions.ts`**

- Add `'sidekick'` to the `RUNTIMES` const:
  ```ts
  const RUNTIMES = ['openclaw', 'nemoclaw', 'opencode', 'sidekick'] as const
  ```
- Import `SIDEKICK_ROOT` from `./paths` (already exported there)
- Add a new `findSidekickProcesses()` async function at the bottom of the runtime-detection section. It should:
  - Run `ps -ww -eo pid=,tty=,%cpu=,rss=,etime=,command= 2>/dev/null` and filter for any process whose command contains `mcp/index` or `scheduler/runner` (both entry points of the analytics package)
  - For each candidate pid, call `getWorkingDirectory(pid)` and check if it starts with `path.join(SIDEKICK_ROOT, 'analytics')`
  - Return matching processes as `RuntimeProcess[]` with `runtime: 'sidekick'`
- In `findRuntimeProcesses()`: call `findSidekickProcesses()` in parallel and merge its results with the existing detection results (avoid duplicate pids)

**2. `Penny/src/renderer/src/types.ts`**

- Extend `OpencodeSession.runtime` union from `'opencode' | 'openclaw' | 'nemoclaw'` to add `| 'sidekick'`

**3. `Penny/src/renderer/src/game/OfficeScene.ts`** — `setAgents()`, line ~1138

- Add `sidekick` case to the `runtimeTitle` ternary chain:
  ```ts
  runtime === 'openclaw' ? 'OpenClaw' :
  runtime === 'nemoclaw' ? 'Gus (NemoClaw)' :
  runtime === 'sidekick' ? 'Sidekick' :
  'OpenCode'
  ```
- Also update the config's `name` field to use the display name (`'Sidekick'`) rather than the runtime token when `runtime === 'sidekick'`

**4. `Penny/src/renderer/src/game/office-helpers.ts`** — `isOpencodeAgent()`, lines 105–113

- Add sidekick to the check so it gets character index 2 (tinted sprite, same as other external runtimes):
  ```ts
  model === 'sidekick' ||
  agent.config.id.startsWith('sidekick-')
  ```

---

No sprite changes needed — `avatar: runtime` resolves to `'sidekick'` which falls through to the default character sprite with tinting (same as opencode). No `agent-types.yaml` entry needed — Sidekick appears as an auto-detected freelancer, matching the OpenCode/OpenClaw pattern exactly.