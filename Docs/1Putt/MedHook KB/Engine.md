---
tags: [medhook, engine, technical]
created: 2026-03-08
---

# Engine

The self-hosted integration runtime. This is the heart of [[MedHook]] — a DAG-based workflow execution engine with 10 healthcare adapters, AI-assisted field mapping, and compliance-grade security.

**Stack:** Next.js 14 + Bun + Redis + PostgreSQL + Prisma

## Workflow Execution Model

Unlike [[Retrohook]]'s linear pipelines, the Engine uses a **directed acyclic graph (DAG)** model inspired by Mirth Connect. Workflows are graphs of nodes connected by edges.

### 7 Node Types

| Type | Purpose | Example |
|------|---------|---------|
| **trigger** | Starts another workflow | Chain workflows together |
| **adapter** | Read/write from external system | Fetch FHIR patients from Epic |
| **transform** | Transform data between formats | HL7v2 → FHIR R4 conversion |
| **condition** | Branch based on expression | Route by message type |
| **parallel** | Fan out to concurrent branches | Process labs and meds simultaneously |
| **loop** | Iterate over array | Process each patient in a bundle |
| **wait** | Pause execution | Delay before retry |

### Triggers

Workflows can be started by:

- **Manual** — Button click in UI
- **Webhook** — HTTP POST with auth validation
- **Cron** — Scheduled execution (cron expressions)
- **Polling** — Periodic adapter check
- **MLLP** — Inbound HL7v2 message (via [[MLLP Server]])
- **FHIR Subscription** — FHIR resource change notification
- **X12** — EDI transaction received via SFTP/webhook

### Execution Engine (`graph-executor.ts`)

The `GraphExecutor` is the core runtime:

1. Takes a `WorkflowGraph` + optional input data
2. Creates an execution record in Redis (fast) + Postgres (audit)
3. Traverses the DAG from `startNodeId`
4. Executes each node via the adapter registry or transformer
5. Stores per-node results with status tracking
6. Follows edges (success/error/conditional) to next nodes
7. Implements retry with exponential backoff
8. Returns `WorkflowExecution` with all node results

### Transformation Engine (`transformer.ts`)

Supports 8 transform types:

| Transform | Description |
|-----------|-------------|
| `field-mapping` | Visual source → target with JSONPath |
| `javascript` | Custom code in sandboxed isolated-vm |
| `code-table` | Lookup/translation tables |
| `hl7v2-to-fhir` | HL7v2 pipe-delimited → FHIR R4 JSON |
| `fhir-to-hl7v2` | FHIR R4 → HL7v2 |
| `x12-parse` | X12 EDI → structured JSON |
| `x12-generate` | Structured data → X12 EDI |
| `template` | Template-based rendering |

## Adapters

See [[Adapters]] for the full list of 10 adapters. All extend `BaseAdapter`:

```typescript
abstract class BaseAdapter {
  abstract type: string
  abstract configSchema: ZodSchema
  abstract read(profile, params): Promise<any>
  abstract write(profile, data): Promise<any>
  async testConnection(profile): Promise<boolean>
}
```

## AI-Assisted Mapping

When `ANTHROPIC_API_KEY` is configured, the engine can suggest field mappings using Claude:

- Analyzes source and target schemas
- Supports HL7v2, FHIR, X12, JSON, CSV formats
- Returns suggestions with confidence scores (0–1)
- Integrated into the desktop and engine workflow designer UIs

This is the key differentiator from [[Retrohook]] v1 which had basic AI parsing but no mapping intelligence.

## Data Storage

| Store | Data | TTL |
|-------|------|-----|
| **Redis** | Workflow definitions | Permanent |
| **Redis** | Execution session state | 24 hours |
| **Redis** | Execution status | 7 days |
| **Postgres** | Workflows | Permanent |
| **Postgres** | Executions + node results | Permanent |
| **Postgres** | Adapter profiles (encrypted) | Permanent |
| **Postgres** | Audit logs | 90 days |
| **Postgres** | Code tables, mapping sets | Permanent |

## Database Schema (Prisma)

10 models:

1. `Workflow` — Graph definition (nodes, edges, startNodeId)
2. `WorkflowTrigger` — Trigger configuration
3. `AdapterProfile` — Connection credentials (AES-256-GCM encrypted)
4. `Execution` — Workflow execution record
5. `NodeResult` — Per-node execution result
6. `AuditLog` — Compliance activity trail
7. `CronSchedule` — Cron trigger state
8. `FhirSubscription` — FHIR subscription tracking
9. `MappingSet` — Saved field mappings
10. `CodeTable` — Value translation tables

## Sandbox Execution

Custom JavaScript transforms run in `isolated-vm`:

- **128 MB memory limit** per execution
- **5-second timeout** for custom code
- **1-second timeout** for expressions
- Input data is frozen (read-only)
- No access to Node.js APIs, filesystem, or network
- Falls back to Node VM if isolated-vm unavailable

## Docker Stack

8 services in `docker-compose.yml`:

| Service | Port | Purpose |
|---------|------|---------|
| **engine** | 3000 | Main application |
| **redis** | 6379 | Session/execution state |
| **postgres** | 5432 | Persistent data + Medplum DB |
| **medplum** | 8103 | FHIR R4 reference server |
| **mllp-server** | 2575 | HL7v2 TCP receiver |
| **prometheus** | 9090 | Metrics collection |
| **grafana** | 3002 | Monitoring dashboards |
| **ipsec** | — | Optional VPN sidecar |

## Key Files

```
engine/src/core/graph-executor.ts    — Main workflow runtime
engine/src/core/transformer.ts       — Transform engine
engine/src/core/trigger-manager.ts   — Trigger routing
engine/src/adapters/base/adapter.ts  — Base adapter interface
engine/src/lib/types.ts              — All type definitions (508 lines)
engine/src/lib/encryption.ts         — AES-256-GCM encryption
engine/src/lib/sandbox.ts            — Isolated code execution
engine/src/lib/ai-mapper.ts          — Claude-powered mapping
engine/src/lib/hl7v2-parser.ts       — Custom HL7v2 parser
```

## Related

- [[Architecture]]
- [[Adapters]]
- [[MLLP Server]]
- [[API Reference]]
- [[Security and Compliance]]
- [[Deployment]]
