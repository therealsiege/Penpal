## Implementation Plan: Issue #52 — Remaining Capability Catalog Entries

**Files to change:** 2

---

**1. `Penny/src/renderer/src/capabilities/catalog.ts`**

Extend `CapabilityId` union and add 6 new entries to `CAPABILITY_CATALOG`.

Replace the existing content:

```typescript
export type CapabilityId =
  | 'orchestrator'
  | 'graph'
  | 'evals'
  | 'vault'
  | 'pods'
  | 'spot_check'
  | 'mcp'
```

Add these entries to `CAPABILITY_CATALOG` after `orchestrator`:

```typescript
graph: {
  title: 'Knowledge Graph',
  blurb: 'Memgraph + Qdrant graph and vector store backing entity extraction and semantic search.',
  validationSteps: [
    'Verify Memgraph connection returns node counts > 0.',
    'Run a Qdrant collection stats check and confirm at least one collection exists.',
  ],
},
evals: {
  title: 'Evals Harness',
  blurb: 'Automated evaluation pipeline for scoring agent outputs against golden datasets.',
  validationSteps: [
    'Confirm the evals runner can load at least one golden dataset.',
    'Execute a dry-run eval and verify a score report is produced.',
  ],
},
vault: {
  title: 'Vault',
  blurb: 'Obsidian vault reader providing document parsing, tag extraction, and link traversal.',
  validationSteps: [
    'Confirm the vault root resolves to a valid directory.',
    'Parse one markdown file and verify frontmatter and body are returned.',
  ],
},
pods: {
  title: 'Pods',
  blurb: 'Pod agent team engine running Solver → Reviewer → Executor triplet workflows.',
  validationSteps: [
    'List active pods and confirm the state machine responds.',
    'Create a dry-run pod and verify it reaches the SOLVER_RUNNING stage.',
  ],
},
spot_check: {
  title: 'Spot-Check Queue',
  blurb: 'Human-in-the-loop queue for flagging agent outputs that require manual review.',
  validationSteps: [
    'Confirm the spot-check queue can be listed without error.',
    'Enqueue a test item and verify it appears in the queue with correct metadata.',
  ],
},
mcp: {
  title: 'MCP Stdio',
  blurb: 'Model Context Protocol stdio transport exposing tools and resources to connected agents.',
  validationSteps: [
    'Confirm the MCP server process starts and responds to an initialize request.',
    'List available tools and verify at least one tool is registered.',
  ],
},
```

---

**2. `Penny/tests/renderer/capabilities/catalog.test.ts`**

Update the single test that asserts exactly 1 entry. Replace:

```typescript
it('has exactly one catalog entry', () => {
  expect(Object.keys(CAPABILITY_CATALOG).length).toBe(1)
  expect(listCapabilities().length).toBe(1)
  expect(listCapabilities()[0]).toBe('orchestrator')
})
```

With:

```typescript
it('has all required capability entries', () => {
  const ids = listCapabilities()
  expect(ids).toContain('orchestrator')
  expect(ids).toContain('graph')
  expect(ids).toContain('evals')
  expect(ids).toContain('vault')
  expect(ids).toContain('pods')
  expect(ids).toContain('spot_check')
  expect(ids).toContain('mcp')
  expect(ids.length).toBe(7)
})

it('every catalog entry has required shape', () => {
  for (const id of listCapabilities()) {
    const entry = CAPABILITY_CATALOG[id]
    expect(typeof entry.title).toBe('string')
    expect(typeof entry.blurb).toBe('string')
    expect(Array.isArray(entry.validationSteps)).toBe(true)
    expect(entry.validationSteps.length).toBeGreaterThan(0)
  }
})
```

---

**No other files need changes.** The `capabilities:status` stub in `ipc.ts` stays empty (`items: {}`) — that's correct per the comment; #54/#55 will populate it. The `CapabilityId` union type change propagates automatically through TypeScript so the `Record<CapabilityId, ...>` in the catalog enforces completeness at compile time.

**Coordination note for #54/#55:** The IPC keys they return for `items` should match the 7 string literals above exactly (`graph`, `evals`, `vault`, `pods`, `spot_check`, `mcp`, `orchestrator`). If they differ, a one-line follow-up rename to `CapabilityId` suffices.