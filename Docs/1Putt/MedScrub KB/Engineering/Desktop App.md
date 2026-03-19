
| Field   | Value         |
| ------- | ------------- |
| Created | March 7, 2026 |
| Updated | March 7, 2026 |
| Tags    | Engineering   |

---

## Overview

The MedScrub Desktop App is an Electron-based physician workspace that serves two audiences:

- **Physicians** use it for AI-assisted clinical workflows -- SOAP note generation, prior authorization prep, patient education, lab result explanation, and other skills powered by EHR data and consumer LLMs.
- **IT administrators** use it to install, configure, and monitor the MedScrub PHI proxy deployment, manage Docker containers, configure API keys, and view usage analytics.

Primary workflows include:

1. Connecting to EHR systems (Epic, athenahealth, Oracle Health) via SMART on FHIR or backend APIs
2. Pulling patient context from a local Medplum CDR or directly from the EHR
3. De-identifying PHI through the embedded proxy before sending to LLMs
4. Running clinical skills (SOAP notes, prior auth letters, etc.) through a generic pipeline
5. Re-identifying the LLM output and writing documents back to the EHR
6. Managing proxy infrastructure, API keys, and configuration

## Architecture

The desktop app follows Electron's 3-process isolation model:

**Main Process** -- Runs in a full Node.js environment with unrestricted system access. Handles app lifecycle, system tray, Docker operations (via dockerode), file system access, proxy management, EHR connectivity, and all privileged operations. This is the only process that can interact with the OS, network, and Docker Engine.

**Renderer Process** -- Runs the React application in a sandboxed Chromium browser context. Has no direct access to Node.js APIs, the file system, or native modules. All communication with the main process goes through IPC channels. Uses HashRouter for client-side navigation.

**Preload Script** -- Acts as the secure bridge between main and renderer. Uses Electron's `contextBridge.exposeInMainWorld()` to expose a whitelisted set of IPC methods as `window.electron`. The renderer can only call methods explicitly defined in the preload script -- there is no open channel.

Key architectural decisions:

- `nodeIntegration` is disabled -- the renderer cannot require Node.js modules
- Context isolation is enabled -- renderer JavaScript runs in a separate context from the preload script
- The renderer is fully sandboxed with limited permissions
- All Docker and system operations are routed through typed IPC channels
- The full proxy codebase is bundled as an `extraResource` for offline installation
- Electron Forge handles build tooling, packaging, and publishing

## Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| Electron | 40.x | Cross-platform desktop runtime |
| React | 19.x | Component-based UI |
| TypeScript | 5.3.x | Type-safe development (`noImplicitAny` enabled) |
| Tailwind CSS | 4.x | Utility-first styling |
| Webpack | 5.x | Module bundling (via Electron Forge) |
| react-router-dom | 7.x | Client-side routing (HashRouter) |
| dockerode | 4.x | Docker Engine API client |
| zustand | 5.x | Lightweight state management (planned) |
| recharts | 3.x | Analytics visualization |
| lucide-react | 0.562.x | Icon system |
| xterm | 6.x | Terminal emulator for log viewing |
| Monaco Editor | 4.x | Code editing for configuration |
| electron-updater | 6.x | Auto-updates via GitHub Releases |

## IPC Communication

All communication between the renderer and main process uses Electron's `ipcRenderer.invoke()` / `ipcMain.handle()` pattern. The preload script exposes a typed `window.electron` object with namespaced methods. Each namespace groups related operations.

### Pattern

```typescript
// Renderer (React component)
const status = await window.electron.docker.check();

// Preload (secure bridge) -- maps to IPC channel
check: () => ipcRenderer.invoke('docker:check')

// Main process (handler)
ipcMain.handle('docker:check', async () => {
  return await dockerManager.checkDocker();
});
```

### IPC Channel Namespaces

| Namespace | Channel Prefix | Purpose |
|-----------|---------------|---------|
| `docker` | `docker:*` | Docker installation check, start/stop/restart services, logs, metrics |
| `proxy` | `proxy:*` | Proxy installation, health check, de-identify/re-identify FHIR and text, session management |
| `config` | `config:*` | Read, write, and validate proxy configuration (.env) |
| `apiKey` | `apikey:*` | List, add, remove, and retrieve API keys |
| `license` | `license:*` | Validate and sync license keys |
| `analytics` | `analytics:*` | Usage stats and history |
| `system` | `system:*` | Open browser, show notifications, get proxy path |
| `updater` | `updater:*` | Check for updates, toggle auto-check |
| `llm` | `llm:*` | LLM chat and transcription (routed through main to bypass CSP) |
| `credits` | `credits:*` | Credit balance, deduction, sufficiency check |
| `platform` | `platform:*` | Fetch API keys and user profile from medscrub.ai |
| `auth` | `auth:*` | OAuth flow, success/error callbacks |
| `briefing` | `briefing:*` | Daily briefing scheduler -- configure, start, stop, generate |
| `discovery` | `discovery:*` | Network service discovery (mDNS broadcast/browse) |
| `hie` | `hie:*` | Health Information Exchange -- facility registration, patient enrichment |
| `medplum` | `medplum:*` | Local CDR -- Docker stack management, FHIR CRUD, patient search, data import (C-CDA, HL7, CSV), SMART on FHIR launch, connection profiles |
| `athena` | `athena:*` | athenahealth -- connect, patient match, clinical data, CDR sync |
| `oracle` | `oracle:*` | Oracle Health (Cerner) -- connect, patient match, clinical data, document write-back, CDR sync |
| `epic` | `epic:*` | Epic -- connect (Vendor Services/sandbox/production), patient match, clinical data, de-identify, document write-back, CDR sync, bulk export |

The full `ElectronAPI` interface is defined in `src/preload/index.ts` and re-exported as a global `window.electron` type declaration.

## Skill SDK Integration

The desktop app uses a declarative Skill SDK to define and execute clinical AI workflows. Skills are JSON files that describe inputs, prompts, LLM configuration, and output handling -- eliminating the need for per-workflow TypeScript code.

### Skill Definitions

Each skill is a `.skill.json` file in `src/skills/`. There are currently 17 built-in skills:

| Skill | File |
|-------|------|
| SOAP Note | `soap-note.skill.json` |
| Prior Auth -- MRI | `prior-auth-mri.skill.json` |
| Prior Auth -- Specialty Drug | `prior-auth-specialty-drug.skill.json` |
| Referral Letter | `referral-letter.skill.json` |
| Patient Education | `patient-education.skill.json` |
| Lab Results Explanation | `lab-results-explanation.skill.json` |
| Pre-Visit Summary | `pre-visit-summary.skill.json` |
| Care Plan -- Diabetes | `care-plan-diabetes.skill.json` |
| ICD-10 Suggester | `icd10-suggester.skill.json` |
| Coding Optimization | `coding-optimization.skill.json` |
| Screening Gap Analyzer | `screening-gap-analyzer.skill.json` |
| Lab Triage | `lab-triage.skill.json` |
| Daily Briefing Header | `daily-briefing-header.skill.json` |
| Message -- Lab Results | `message-lab-results.skill.json` |
| Message -- Post Visit | `message-post-visit.skill.json` |
| Message -- Pre-Visit Prep | `message-pre-visit-prep.skill.json` |
| Message -- Care Gap | `message-care-gap.skill.json` |

A `SkillDefinition` (defined in `src/shared/skill-types.ts`) includes:

- **Metadata** -- id, name, version, category, specialty, description, tier (`physician` | `admin` | `internal`)
- **Input** -- FHIR resource requirements (`fetchStrategy`: everything, selective, or none) and typed variables (string, number, boolean with optional enums and defaults)
- **Prompt** -- system and user prompt templates with optional named variants
- **LLM** -- temperature, maxTokens, estimatedTokens
- **Output** -- format (structured, narrative, letter, json, bullet-points), whether to re-identify, and post-processing (none, parseJson, appendDisclosure)
- **Adapters** (Phase 2+) -- external data sources (HTTP, FHIR query) and output targets (Epic DocumentReference, PDF render, platform upload)

### Skill Registry

The skill registry (`src/renderer/lib/skill-registry.ts`) loads all `.skill.json` files at startup using webpack's `require.context`. It validates each definition against a schema, indexes them by ID in a `Map<string, LoadedSkill>`, and provides query APIs for listing and retrieving skills by ID, category, or specialty.

### Skill Executor

The skill executor (`src/renderer/lib/skill-executor.ts`) implements a generic 5-stage pipeline:

1. **Fetch patient FHIR data** -- pulls from CDR or EHR based on the skill's FHIR config
2. **De-identify PHI** -- sends FHIR bundle through the proxy via IPC
3. **Build prompt** -- interpolates skill variables into the prompt templates; runs `extension.transformInput()` if present
4. **Call LLM** -- sends the prompt to the configured provider (Claude, GPT, etc.) via the `llm:chat` IPC channel
5. **Re-identify PHI** -- restores original identifiers via the proxy; runs `extension.transformOutput()` if present

### Extension Hooks

For skills that need custom logic beyond what JSON can express, the `SkillExtension` interface provides two optional TypeScript hooks:

- `transformInput(context)` -- called after de-identification, before prompt building. Can modify variables, select a prompt variant, or reshape the execution context.
- `transformOutput(content, context)` -- called after LLM response, before re-identification. Can transform or post-process the raw output.

## Security

The desktop app follows Electron security best practices:

**Context Isolation** -- The renderer process runs in a separate JavaScript context from the preload script. The renderer cannot access `ipcRenderer` directly or any Node.js APIs.

**No nodeIntegration** -- Node.js modules are not available in the renderer process.

**Sandboxed Renderer** -- The browser context runs with limited OS-level permissions.

**Electron Fuses** -- Compile-time security flags that cannot be overridden at runtime:

| Fuse | Setting | Effect |
|------|---------|--------|
| RunAsNode | false | Prevents `ELECTRON_RUN_AS_NODE` environment variable from turning the app into a plain Node.js process |
| EnableCookieEncryption | true | Encrypts cookies at rest |
| EnableNodeOptionsEnvironmentVariable | false | Prevents `NODE_OPTIONS` from being used to inject code |
| EnableEmbeddedAsarIntegrityValidation | true | Validates the integrity of the bundled ASAR archive |
| OnlyLoadAppFromAsar | true | Prevents loading app code from outside the ASAR archive |

**Whitelisted IPC Channels** -- The preload script explicitly defines every IPC method. There is no generic `send` or `invoke` passthrough. The renderer can only call operations that the preload script exposes.

**No Remote Modules** -- All code runs locally. The Electron `remote` module is not used.

## Embedded Proxy

The full MedScrub proxy codebase is bundled into the desktop app as an Electron `extraResource`. This allows the desktop app to run the de-identification proxy locally without requiring Docker or an external deployment.

The embedded proxy code lives in `src/proxy-server/` and includes:

- De-identification engines (PHI detection pipeline)
- Auth and licensing middleware
- Session management
- An in-memory KV adapter (`memory-kv-adapter.ts`) that replaces Redis for local operation

This design supports air-gapped and offline environments where Docker or network access may not be available. The proxy starts as part of the main process and the renderer communicates with it through the standard `proxy:*` IPC channels.

## Key Directories

```
desktop/
├── src/
│   ├── main/                  # Main process (Node.js)
│   │   ├── index.ts           # App lifecycle, window creation
│   │   ├── ipc.ts             # IPC handler registrations
│   │   ├── tray.ts            # System tray icon and menu
│   │   ├── updater.ts         # Auto-updater (electron-updater)
│   │   ├── platform-client.ts # HTTP client for medscrub.ai APIs
│   │   ├── docker/            # Docker integration (manager, compose, health)
│   │   ├── config/            # .env file management
│   │   └── proxy/             # Proxy installation logic
│   │
│   ├── renderer/              # Renderer process (React app)
│   │   ├── index.tsx          # React entry point
│   │   ├── App.tsx            # Root component, router setup
│   │   ├── pages/             # Page components (Dashboard, Services, Logs,
│   │   │                      #   Settings, Analytics, APIKeys, Playground, Welcome)
│   │   ├── components/        # Reusable components (Sidebar, Header, Logo, etc.)
│   │   ├── lib/               # Utilities, skill registry, skill executor,
│   │   │                      #   LLM providers, prompt templates
│   │   ├── data/              # Sample data for development/testing
│   │   └── styles/            # CSS (Tailwind imports)
│   │
│   ├── preload/               # Preload script (secure IPC bridge)
│   │   └── index.ts           # contextBridge API definitions
│   │
│   ├── shared/                # Shared types and constants
│   │   ├── types.ts           # Core TypeScript interfaces
│   │   ├── skill-types.ts     # Skill SDK type definitions
│   │   └── constants.ts       # App-wide constants
│   │
│   ├── skills/                # 17 built-in skill JSON definitions
│   │   ├── soap-note.skill.json
│   │   ├── prior-auth-mri.skill.json
│   │   └── ...
│   │
│   └── proxy-server/          # Embedded proxy (bundled as extraResource)
│       ├── deidentification/  # PHI detection engines
│       ├── middleware/        # Auth and licensing
│       ├── storage/           # Session management
│       └── memory-kv-adapter.ts  # In-memory KV store (replaces Redis)
│
├── resources/                 # App assets (icon.png)
├── forge.config.ts            # Electron Forge build configuration
├── webpack.*.config.js        # Webpack configs (main, renderer, preload)
├── tailwind.config.js         # Tailwind CSS configuration
├── tsconfig.json              # TypeScript configuration
└── package.json               # Dependencies and scripts
```

## Development

### Prerequisites

- Node.js 18+
- npm
- Docker Desktop (required only for Docker-based proxy management)

### Commands

| Command | Description |
|---------|-------------|
| `npm start` | Start Electron in development mode with hot reload |
| `npm run package` | Package the app without creating installers |
| `npm run make` | Build platform-specific installers |
| `npm run publish` | Publish to GitHub Releases |
| `npm run lint` | Run ESLint on TypeScript files |

### Platform Builds

| Platform | Installer Type | Output |
|----------|---------------|--------|
| macOS | ZIP archive | `.zip` |
| Windows | Squirrel installer | `.exe` |
| Linux | Debian + RPM | `.deb`, `.rpm` |

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PROXY_URL` | Yes | Local proxy endpoint |
| `EPIC_CLIENT_ID` | No | SMART on FHIR app ID for Epic integration |

### Code Style

- React components use PascalCase file names (`Dashboard.tsx`)
- Utilities and services use camelCase or kebab-case (`manager.ts`, `platform-client.ts`)
- Functional components with `React.FC` typing
- Tailwind CSS utility classes for styling
- Import order: Node.js builtins, Electron, external packages, internal imports, relative imports, type imports, style imports
