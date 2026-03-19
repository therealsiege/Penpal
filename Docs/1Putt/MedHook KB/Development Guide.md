---
tags: [medhook, development, engineering]
created: 2026-03-08
---

# Development Guide

How to work on the [[MedHook]] codebase. The monorepo contains three components as git submodules plus shared docs and CI/CD.

## Repository Structure

```
medhook/                    (main repo)
├── engine/                 (submodule — Next.js + Bun)
├── medhook.dev/            (submodule — Next.js on Vercel)
├── desktop/                (submodule — Electron)
├── docs/                   (architecture, API, deployment, security docs)
├── scripts/                (integration test script)
├── .github/workflows/      (CI for all 3 components)
└── CLAUDE.md               (project instructions)
```

## Tech Stacks

| Component | Framework | Runtime | DB | UI |
|-----------|-----------|---------|----|----|
| Engine | Next.js 14 | Bun | Postgres + Redis | React + ReactFlow + shadcn/ui |
| Web App | Next.js 14 | Node.js | Neon Postgres (Prisma) | React + Tailwind + shadcn/ui |
| Desktop | Electron 40 | Node.js | — | React 19 + ReactFlow + Zustand + Tailwind |

## Local Development

### Engine

```bash
cd engine
cp .env.local.example .env.local
# Set ENCRYPTION_MASTER_KEY, LICENSE_KEY, DATABASE_URL, REDIS_URL
docker compose -f docker-compose.dev.yml up -d  # Redis + Postgres
npm install
npx prisma generate && npx prisma db push
npm run dev
```

### Web App

```bash
cd medhook.dev
cp .env.example .env.local
# Set DATABASE_URL, NEXTAUTH_URL, NEXTAUTH_SECRET, OAuth credentials
npm install
npx prisma generate && npx prisma db push
npm run dev
```

### Desktop

```bash
cd desktop
npm install
npm start  # Electron Forge with hot reload
```

## Testing

### Engine
- `npm test` — Vitest unit tests
- `npm run test:e2e` — Playwright E2E (needs running engine)
- `npm run test:all` — Type check + unit + E2E

### Web App
- `npm run type-check` — TypeScript check
- `npm run lint` — ESLint

### Desktop
- `npm test` — Vitest unit tests
- `npm run test:e2e` — Playwright E2E

### Integration
- `./scripts/integration-test.sh` — Cross-component tests (needs all running)

## CI/CD (GitHub Actions)

Three workflows triggered on push to `main`/`develop`:

| Workflow | Jobs |
|----------|------|
| `engine.yml` | Type check + unit tests |
| `web.yml` | Type check |
| `desktop.yml` | Type check + unit tests |

CI test environment uses dummy keys and SQLite in-memory DB.

## Code Conventions

- **TypeScript strict mode** everywhere
- **Functional programming** where appropriate
- **Zod** for all input validation
- **Naming:** `executeWorkflowStep` not `run`; single responsibility functions
- **Error handling:** Explicit error types, never fail silently
- **Healthcare terminology:** "workflow", "adapter", "mapping", "ETL"
- **All healthcare data treated as PHI**

## Key Patterns

- **Adapter Pattern** — `BaseAdapter` → specific adapters
- **Registry Pattern** — `adapterRegistry` singleton
- **DAG Model** — Workflows as directed acyclic graphs
- **Singleton** — Redis, Prisma, encryption, metrics clients
- **Zustand stores** — Desktop state management

## Adding a New Adapter

1. Create `engine/src/adapters/{name}/index.ts`
2. Extend `BaseAdapter`, implement `read()`, `write()`, define `configSchema`
3. Add to `engine/src/lib/init-adapters.ts`
4. Write tests in `engine/tests/unit/adapters/`
5. Adapter auto-appears in UI and API

## Adding a New Transform Type

1. Add type to `TransformType` union in `engine/src/lib/types.ts`
2. Implement handler in `engine/src/core/transformer.ts`
3. Add config panel in desktop/engine UI if needed

## Related

- [[Architecture]]
- [[Engine]]
- [[Web App]]
- [[Desktop App]]
