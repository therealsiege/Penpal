---
tags: [medhook, architecture, technical]
created: 2026-03-08
---

# Architecture

MedHook is a three-component system connected by license validation and analytics webhooks.

```
┌─────────────────────┐     OAuth / License     ┌─────────────────────┐
│                     │◄────────────────────────►│                     │
│   Desktop App       │                          │   Web App           │
│   (Electron)        │                          │   (medhook.dev)     │
│                     │                          │                     │
│   - Docker mgmt     │                          │   - User accounts   │
│   - Workflow UI     │                          │   - License keys    │
│   - Service monitor │                          │   - Analytics       │
│                     │                          │   - Billing         │
└────────┬────────────┘                          └──────────┬──────────┘
         │ HTTP API                                         │
         │ (localhost:3000)                                  │ Analytics
         ▼                                                  │ Webhook
┌─────────────────────────────────────────────────────────────────────┐
│                         Engine (Docker)                              │
│                                                                     │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│   │  Engine   │  │  Redis   │  │ Postgres │  │ Medplum  │          │
│   │ (Next.js) │  │ (state)  │  │ (audit)  │  │ (FHIR)   │          │
│   └──────────┘  └──────────┘  └──────────┘  └──────────┘          │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│   │   MLLP   │  │Prometheus│  │ Grafana  │  │  IPSec   │          │
│   │ (HL7v2)  │  │(metrics) │  │(dashbrd) │  │  (VPN)   │          │
│   └──────────┘  └──────────┘  └──────────┘  └──────────┘          │
└─────────────────────────────────────────────────────────────────────┘
```

## Component Details

### [[Engine]]

- **Stack:** Next.js 14 + Bun + Redis + PostgreSQL + Prisma
- **Core:** DAG-based `GraphExecutor` that traverses workflow graphs
- **10 adapters** extending `BaseAdapter` abstract class
- **Dual storage:** Redis (fast ephemeral state) + Postgres (persistent audit trail)
- **8-service Docker Compose** stack
- **Port:** 3000 (configurable)

### [[Web App]]

- **Stack:** Next.js 14 + Neon Postgres + Prisma + NextAuth.js + Stripe
- **17 API routes** for auth, licensing, analytics, billing
- **Deployed:** Vercel (medhook.dev)
- **License system:** SHA-256 hashed keys, validated by engine

### [[Desktop App]]

- **Stack:** Electron 40 + React 19 + ReactFlow + Zustand
- **30+ IPC handlers** for Docker, health, license, auth
- **OAuth:** Custom `medhook://` protocol handler
- **Builds:** DMG (macOS), Squirrel (Windows), DEB/RPM (Linux)

## Data Flow

### Workflow Execution

```
User triggers workflow
    → TriggerManager routes to GraphExecutor
    → GraphExecutor.executeGraph():
        1. Create execution record (Redis + Postgres)
        2. Start at startNodeId
        3. Execute node (adapter/transform/condition/parallel/loop)
        4. Store node result
        5. Follow edge to next node
        6. Repeat until completion
    → Return WorkflowExecution with all results
    → Session data auto-cleaned (Redis TTL)
    → Persistent records kept for audit (Postgres)
```

### Cross-Component Communication

```
Engine ──analytics sync──► Web App
         (POST /api/analytics/sync)
         (HMAC-SHA256 signed)

Desktop ──OAuth──► Web App ──callback──► Desktop
         (medhook://auth/callback)

Desktop ──HTTP API──► Engine
         (Bearer JWT token)

Engine ──license validate──► Web App
         (POST /api/license/validate)
```

## Design Patterns

1. **Adapter Pattern** — All integrations inherit from `BaseAdapter`
2. **Registry Pattern** — Global `adapterRegistry` singleton
3. **DAG Model** — Workflows as directed acyclic graphs (inspired by Mirth Connect)
4. **Singleton Pattern** — Redis, Prisma, encryption, metrics clients
5. **Pipeline Pattern** — Transformer with pluggable transform types

## Related

- [[Engine]]
- [[Web App]]
- [[Desktop App]]
- [[Security and Compliance]]
