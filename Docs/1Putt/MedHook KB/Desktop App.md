---
tags: [medhook, desktop, electron]
created: 2026-03-08
---

# Desktop App

The local control center for [[MedHook]]. An Electron app that manages the Docker stack, provides a visual workflow designer, and connects to the [[Web App]] for licensing and auth.

**Stack:** Electron 40 + React 19 + ReactFlow 11 + Zustand + Tailwind
**Builds:** DMG (macOS), Squirrel (Windows), DEB/RPM (Linux)

## What It Does

The desktop app is how users interact with MedHook day-to-day:

1. **Manages Docker Stack** — Start/stop/restart all 8 engine services
2. **Visual Workflow Builder** — ReactFlow-based DAG editor with 7 node types
3. **Service Monitoring** — Real-time health, logs, CPU/memory metrics
4. **Authentication** — OAuth with medhook.dev via `medhook://` protocol
5. **License Management** — Validate, fetch, and inject license keys
6. **Adapter Configuration** — Create/test connection profiles
7. **Execution Testing** — Run workflows and see live status overlay on nodes

## Pages

| Page | Purpose |
|------|---------|
| **Dashboard** | Engine health, stats, recent executions |
| **Workflows** | List, create, edit, delete, enable/disable |
| **WorkflowBuilder** | Visual DAG editor (NodePalette → Canvas → ConfigPanel) |
| **Executions** | Execution history with detail modals |
| **AdapterProfiles** | CRUD for adapter connections |
| **CodeTables** | Lookup table management |
| **Services** | Docker service status, logs, metrics |
| **Logs** | Engine log viewer |
| **Settings** | Engine URL, ports, license, auth secret |
| **Login** | OAuth flow initiation |
| **Welcome** | First-run setup wizard |

## Docker Management

The `DockerManager` class handles the full lifecycle:

- Resolves `docker-compose.medhook.yml` path
- Executes `docker compose` CLI commands
- Injects environment variables: `ENCRYPTION_MASTER_KEY`, `LICENSE_KEY`, port configs
- Uses `dockerode` for container inspection
- Monitors health via HTTP endpoints + TCP checks
- Calculates CPU/memory metrics per service

## Workflow Designer

Built on ReactFlow with Zustand state management:

- **NodePalette** — Drag 7 node types onto canvas
- **WorkflowCanvas** — ReactFlow graph renderer
- **NodeConfigPanel** — Configure selected node (adapter, transform, etc.)
- **TriggerConfigPanel** — Set trigger type and parameters
- **FilterConfigPanel** — Message filtering rules
- **AIMappingModal** — Claude-powered field mapping suggestions
- **TemplateGalleryModal** — Pre-built workflow templates
- **Undo/Redo** — 50-entry history stack

## Authentication Flow

```
1. User clicks "Sign In"
2. Desktop opens https://medhook.dev/auth/desktop in browser
3. User logs in on web app
4. Web app redirects to medhook://auth/callback?token=xxx&user=yyy&licenseKey=zzz
5. Electron captures callback via custom protocol handler
6. Token stored encrypted via Electron.safeStorage
7. Engine API calls include Bearer token
```

## Security

| Layer | Implementation |
|-------|---------------|
| Authentication | OAuth 2.0 via medhook.dev |
| Token storage | Electron.safeStorage (platform-native encryption) |
| IPC | Context isolation + preload script (no direct Node access) |
| Docker | ENCRYPTION_MASTER_KEY injected into engine |
| Credentials | Adapter profiles encrypted in engine Postgres |

## IPC Handlers (30+)

The preload script exposes a structured API via `window.electron`:

- `docker.*` — check, startStack, stopStack, getServices, restartService, getLogs, getMetrics, pullImages, updateStack
- `health.*` — checkAll, checkService, system
- `license.*` — validate, status, setKey, fetchFromPlatform
- `auth.*` — startOAuth, loadSession, logout, onSuccess, onError
- `settings.*` — getEngineUrl, setEngineUrl, getPorts, setPorts
- `engineAuth.*` — authenticate, generateSecret
- `theme.*` — get, set, getSystemPreference, onSystemChanged
- `updater.*` — check, onAvailable, onProgress

## Key Files

```
desktop/src/main/index.ts                    — Window creation, lifecycle
desktop/src/main/ipc.ts                      — IPC handler registration
desktop/src/main/docker/manager.ts           — Docker compose management
desktop/src/main/auth/oauth-handler.ts       — OAuth flow
desktop/src/main/auth/secure-storage.ts      — Encrypted token storage
desktop/src/main/license/validator.ts        — License validation
desktop/src/preload/index.ts                 — Secure IPC bridge
desktop/src/renderer/App.tsx                 — Main router + layout
desktop/src/renderer/stores/workflowStore.ts — Zustand workflow state
desktop/src/renderer/lib/api.ts              — Engine HTTP client
desktop/src/renderer/lib/types.ts            — Renderer type definitions
desktop/forge.config.ts                      — Electron Forge build config
desktop/docker-compose.medhook.yml           — Docker stack definition
```

## Related

- [[Architecture]]
- [[Engine]]
- [[Web App]]
