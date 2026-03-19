Focus: No
Preview Environment: staging.medscrub.dev
Project Hub: MedScrub (https://www.notion.so/MedScrub-276f3cf2487f80ef9884e33e71dd2c0f?pvs=21) 
Stack: NextJS, Postgres, mcp, radix, reSend, shadcn
Type: Incubator

# MedScrub Engineering Onboarding

**Welcome to MedScrub!** This document will help you understand our codebase, architecture, and development practices.

## Table of Contents

1. [Product Overview](about:blank#product-overview)
2. [System Architecture](about:blank#system-architecture)
3. [Component Deep Dive](about:blank#component-deep-dive)
4. [Development Setup](about:blank#development-setup)
5. [Key Concepts](about:blank#key-concepts)
6. [Data Flow](about:blank#data-flow)
7. [Common Workflows](about:blank#common-workflows)
8. [Testing](about:blank#testing)
9. [Deployment](about:blank#deployment)

---

## Product Overview

**MedScrub** is a healthcare data de-identification platform that enables organizations to safely use AI/LLMs while maintaining HIPAA compliance.

### Core Value Proposition

- **Scrub PHI** from FHIR and clinical data before sending to AI services
- **Restore context** in AI responses automatically with session-based tokens
- **Integrate in minutes** via hosted API, MCP server, or local deployment
- **Maintain compliance** - 99.9% accuracy on FHIR R4, HIPAA Safe Harbor compliant

### Key Metrics

| Metric | Value | Notes |
| --- | --- | --- |
| **FHIR Accuracy** | 99.9% | Structured data with deterministic field mapping |
| **Text Accuracy** | Up to 99% | Multi-layer NER (regex + spaCy + Stanford) |
| **Response Time** | <50ms | FHIR processing at edge (p95) |
| **Supported FHIR Resources** | 77 types | Patient, Practitioner, Observation, Claim, etc. |
| **HIPAA Identifiers** | All 18 | Safe Harbor compliant |

---

## System Architecture

MedScrub consists of three main components working together:

```mermaid
graph TB
    subgraph "User Interfaces"
        UI1[Claude Desktop/Code]
        UI2[Platform Dashboard]
        UI3[Custom Apps]
    end

    subgraph "Integration Layer"
        MCP[MCP Server<br/>@medscrub/mcp<br/>npm package]
        API_CLIENT[Direct API Clients]
    end

    subgraph "Platform - medscrub.dev"
        PLATFORM[Next.js 14 App<br/>Vercel]
        AUTH[NextAuth.js<br/>JWT Generation]
        DB[(Neon Postgres<br/>Prisma)]

        PLATFORM --> AUTH
        AUTH --> DB
    end

    subgraph "Proxy API - api.medscrub.dev"
        WORKER[Cloudflare Worker<br/>Edge Runtime]
        KV[(Cloudflare KV<br/>Sessions/Analytics)]
        NER[NER Service<br/>spaCy Optional]

        WORKER --> KV
        WORKER -.-> NER
    end

    subgraph "Self-Hosted Option"
        DOCKER[Docker Container<br/>Express + Redis]
        REDIS[(Redis<br/>Sessions/Analytics)]

        DOCKER --> REDIS
    end

    UI1 --> MCP
    UI2 --> PLATFORM
    UI3 --> API_CLIENT

    MCP --> WORKER
    MCP --> DOCKER
    API_CLIENT --> WORKER
    API_CLIENT --> DOCKER

    PLATFORM -.Sync API Keys.-> WORKER
    WORKER -.Push Analytics.-> PLATFORM
    DOCKER -.Sync Analytics.-> PLATFORM

    style WORKER fill:#f9a825
    style PLATFORM fill:#4caf50
    style MCP fill:#2196f3
    style DOCKER fill:#9c27b0
```

### Component Responsibilities

| Component | Purpose | Technology | Deployment |
| --- | --- | --- | --- |
| **Proxy API** | FHIR/text de-identification, session management | TypeScript, Cloudflare Workers OR Docker | `api.medscrub.dev` (edge) OR customer infrastructure |
| **Platform** | Marketing site, customer portal, JWT tokens, docs | Next.js 14, Prisma, Neon Postgres | `medscrub.dev` (Vercel) |
| **MCP Server** | Claude Desktop/Code integration | TypeScript, MCP SDK | Local via `npx @medscrub/mcp` |

---

## Component Deep Dive

### 1. Proxy API (`/proxy`)

**Primary codebase for de-identification logic.**

### Dual Deployment Architecture

The proxy has a **unique dual-build system** that supports both edge and self-hosted deployments:

```mermaid
graph LR
    subgraph "Source Code"
        SRC[TypeScript Source<br/>src/]
    end

    subgraph "Build Targets"
        WORKER_BUILD[Workers Build<br/>tsconfig.worker.json]
        DOCKER_BUILD[Docker Build<br/>tsconfig.json]
    end

    subgraph "Deployments"
        WORKER[Cloudflare Workers<br/>api.medscrub.dev]
        CONTAINER[Docker Container<br/>Customer Infrastructure]
    end

    SRC -->|Excludes Node.js modules| WORKER_BUILD
    SRC -->|Includes all modules| DOCKER_BUILD

    WORKER_BUILD --> WORKER
    DOCKER_BUILD --> CONTAINER

    WORKER --> KV[(Cloudflare KV)]
    CONTAINER --> REDIS[(Redis)]
```

**Critical Build Rules:**

❌ **Never include in Workers build:**
- Files using Node.js modules: `redis`, `os`, `crypto`, `net`, `tls`, `fs`
- Examples: `server.ts`, `redis-adapter.ts`, `redis-auth.ts`, `license.ts`, `credit-manager.ts`

✅ **Safe for both environments:**
- FHIR de-identification: `fhir-deidentifier.ts`
- Text de-identification: `enhanced-deidentifier.ts`
- Pattern matching: `enhanced-patterns.ts`
- Session management: `session.ts` (abstraction)
- Authentication: `auth.ts` (abstraction)

### Key Files

```
proxy/
├── src/
│   ├── core/
│   │   ├── index.ts                        # Workers entry point, routing
│   │   ├── server.ts                       # Express server (Docker only)
│   │   └── validation.ts                   # Zod request schemas
│   ├── deidentification/
│   │   ├── fhir-deidentifier.ts           # FHIR de-identification (99.9%)
│   │   ├── generic-fhir-deidentifier.ts   # Fallback for unmapped resources
│   │   ├── enhanced-deidentifier.ts       # Multi-layer text NER
│   │   ├── enhanced-patterns.ts           # HIPAA Safe Harbor patterns
│   │   └── expert-determination.ts        # Expert Determination analyzer
│   ├── storage/
│   │   ├── session.ts                     # Session management abstraction
│   │   ├── analytics.ts                   # Analytics manager (KV/Redis)
│   │   └── redis-adapter.ts               # Redis client (Docker only)
│   └── middleware/
│       ├── auth.ts                        # Authentication abstraction
│       ├── redis-auth.ts                  # Redis auth (Docker only)
│       ├── license.ts                     # License validation (Docker only)
│       └── credit-manager.ts              # Credit tracking (Docker only)
├── wrangler.toml                          # Cloudflare deployment config
├── docker-compose.yml                     # Docker deployment
├── Dockerfile                             # Docker build
├── tsconfig.worker.json                   # Workers build config
└── tsconfig.json                          # Docker build config
```

### API Endpoints

```
POST   /api/fhir/deidentify              # De-identify FHIR R4 resource/Bundle
POST   /api/deidentify                    # De-identify clinical text
GET    /api/session?sessionId={id}        # Get session info
PUT    /api/session                       # Extend session TTL
DELETE /api/session?sessionId={id}        # Delete session
GET    /api/analytics                     # Usage analytics (authenticated)
GET    /health                            # Health check (no auth)
GET    /api/stats                         # System statistics (no auth)

# Admin endpoints (require ADMIN_SECRET)
POST   /api/admin/sync-keys               # Sync API keys from platform to Workers KV
POST   /api/admin/sync-analytics          # Sync analytics from Docker to platform
```

---

### 2. Platform (`/medscrub.dev`)

**Marketing site + customer portal + JWT token generation.**

### Architecture

```mermaid
graph TB
    subgraph "Frontend - Next.js 14 App Router"
        LANDING[Landing Page<br/>page.tsx]
        DASHBOARD[Dashboard<br/>dashboard/]
        DEMO[Demo Page<br/>demo/page.tsx]
        DOCS[Documentation<br/>docs/]
        ADMIN[Admin Portal<br/>admin/]
    end

    subgraph "API Routes - /api"
        AUTH_API["/api/auth/*<br/>NextAuth.js"]
        TOKEN_API["/api/jwt<br/>JWT Generation"]
        KEYS_API["/api/keys<br/>API Key Management"]
        ANALYTICS_API["/api/analytics/*<br/>Analytics Sync"]
        ADMIN_API["/api/admin/*<br/>Admin Operations"]
    end

    subgraph "Data Layer"
        PRISMA[Prisma ORM]
        DB[(Neon Postgres)]
    end

    LANDING --> AUTH_API
    DASHBOARD --> KEYS_API
    DASHBOARD --> ANALYTICS_API
    DEMO --> TOKEN_API
    ADMIN --> ADMIN_API

    AUTH_API --> PRISMA
    TOKEN_API --> PRISMA
    KEYS_API --> PRISMA
    ANALYTICS_API --> PRISMA
    ADMIN_API --> PRISMA

    PRISMA --> DB
```

### Database Schema (Prisma)

**Key Models:**

```
model User {
  id                       String
  email                    String              @unique
  plan                     String              @default("free")
  requestLimit             Int                 @default(1000)
  role                     Role                @default(USER)
  proxyUrl                 String?
  selfHostedLicenseKey     String?             @unique
  stripeCustomerId         String?             @unique

  accounts                 Account[]
  apiKeys                  ApiKey[]
  analytics                AnalyticsDaily[]
  creditTransactions       CreditTransaction[]
}

model ApiKey {
  id           String
  userId       String
  name         String
  keyHash      String    @unique
  prefix       String
  environment  String    @default("live")
  requestCount Int       @default(0)
  lastUsedAt   DateTime?
  createdAt    DateTime  @default(now())
  expiresAt    DateTime?
  revokedAt    DateTime?
}

model AnalyticsDaily {
  id              String
  userId          String
  date            DateTime
  source          String
  requestCount    Int      @default(0)
  totalTokens     Int      @default(0)
  successCount    Int      @default(0)
  errorCount      Int      @default(0)
  avgResponseTime Float    @default(0)
  apiKeyId        String?
}
```

### Key Files

```
medscrub.dev/
├── src/
│   ├── app/
│   │   ├── page.tsx                       # Landing page
│   │   ├── dashboard/                     # Customer portal
│   │   ├── demo/page.tsx                  # JWT token display, MCP setup
│   │   ├── docs/                          # API documentation
│   │   ├── admin/                         # Admin portal
│   │   └── api/
│   │       ├── auth/[...nextauth]/       # NextAuth.js endpoints
│   │       ├── jwt/route.ts              # JWT token generation
│   │       ├── keys/route.ts             # API key management
│   │       ├── analytics/sync/route.ts   # Analytics webhook
│   │       └── admin/                    # Admin API routes
│   ├── components/
│   │   └── ui/                           # shadcn/ui components
│   └── lib/
│       ├── auth.ts                       # JWT token generation
│       └── prisma.ts                     # Prisma client
├── prisma/
│   └── schema.prisma                     # Database schema
└── package.json
```

---

### 3. MCP Server (`/mcp`)

**Claude Desktop/Code integration.**

### Architecture

```mermaid
graph LR
    CLAUDE[Claude Desktop/Code] -->|stdio| MCP[MCP Server<br/>@medscrub/mcp]

    MCP -->|JWT or API Key| PROXY_HOSTED[Hosted API<br/>api.medscrub.dev]
    MCP -->|API Key| PROXY_LOCAL[Local Docker<br/>localhost:8787]

    PROXY_HOSTED --> KV[(Cloudflare KV)]
    PROXY_LOCAL --> REDIS[(Redis)]
```

### MCP Tools

| Tool | Description |
| --- | --- |
| `medscrub__deidentify_fhir` | De-identify FHIR resources |
| `medscrub__reidentify_fhir` | Restore FHIR resources |
| `medscrub__deidentify_text` | De-identify clinical text |
| `medscrub__reidentify_text` | Restore text |
| `medscrub__get_session_info` | Get session details |
| `medscrub__list_phi_types` | List PHI types |

### Key Files

```
mcp/
├── src/
│   ├── index.ts        # MCP server entry point
│   ├── client.ts       # MedScrub API client (JWT + API key)
│   ├── tools.ts        # MCP tool implementations
│   └── resources.ts    # Documentation resources
├── package.json        # Published as @medscrub/mcp
└── README.md           # Setup guide
```

---

## Development Setup

### Prerequisites

- **Node.js**: 18+ (check with `node --version`)
- **npm**: 9+ (check with `npm --version`)
- **Docker**: For local proxy deployment (optional)
- **Git**: For version control

### Quick Start

### 1. Clone Repository

```bash
git clone https://github.com/medscrub/medscrub.git
cd medscrub
```

### 2. Set Up Proxy (Option A: Cloudflare Workers Dev)

```bash
cd proxy
npm install
cp .env.example .env
# Edit .env with your configuration

# Run local Workers development server
npx wrangler dev
# API available at http://localhost:8787
```

### 2. Set Up Proxy (Option B: Docker)

```bash
cd proxy
npm install
cp .env.example .env
# Edit .env with your configuration

# Build and run Docker services
npm run docker:build
npm run docker:up
# API available at http://localhost:8787
```

### 3. Set Up Platform

```bash
cd medscrub.dev
npm install
cp .env.example .env.local
# Edit .env.local with database credentials

# Set up database
npx prisma generate
npx prisma db push

# Run development server
npm run dev
# Platform available at http://localhost:3000
```

### 4. Set Up MCP Server

```bash
cd mcp
npm install
npm run build

# Configure Claude Desktop
# Add to ~/.config/Claude/claude_desktop_config.json:
{
  "mcpServers": {
    "medscrub": {
      "command": "npx",
      "args": ["-y", "@medscrub/mcp"],
      "env": {
        "MEDSCRUB_API_URL": "http://localhost:8787",
        "MEDSCRUB_API_KEY": "msk_test_demokey123456789012345678901234"
      }
    }
  }
}
```

### Environment Variables

### Proxy API

```bash
# Required
REDIS_URL=redis://redis:6379              # Redis URL (Docker only)
JWT_SECRET=your-shared-secret             # Shared with platform
ADMIN_SECRET=your-admin-secret            # Admin endpoint auth

# Optional
NER_SERVICE_URL=http://ner-service:8000   # Layer 2 NER service
PLATFORM_WEBHOOK_URL=https://medscrub.dev/api/analytics/sync
ANALYTICS_WEBHOOK_SECRET=your-webhook-secret
CONFIDENCE_THRESHOLD=0.7
API_KEY_REQUIRED=true
```

### Platform

```bash
# Required
DATABASE_URL=postgresql://user:pass@host/db
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-nextauth-secret
JWT_SECRET=your-shared-secret             # Same as proxy

# Optional
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
RESEND_API_KEY=re_...
```

### MCP Server

```bash
# Option 1: Hosted API
MEDSCRUB_API_URL=https://api.medscrub.dev
MEDSCRUB_JWT_TOKEN=your-jwt-token         # From medscrub.dev/demo

# Option 2: Local Docker
MEDSCRUB_API_URL=http://localhost:8787
MEDSCRUB_API_KEY=msk_test_demokey123456789012345678901234
```

---

## Key Concepts

### 1. FHIR De-identification

**How it works:**

```mermaid
sequenceDiagram
    participant Client
    participant Proxy
    participant FHIRDeidentifier
    participant Session

    Client->>Proxy: POST /api/fhir/deidentify<br/>{resource: Patient}
    Proxy->>Proxy: Validate request (Zod)
    Proxy->>FHIRDeidentifier: deidentifyResource(resource)

    FHIRDeidentifier->>FHIRDeidentifier: Map PHI fields<br/>(344+ mapped fields)
    FHIRDeidentifier->>FHIRDeidentifier: Generate tokens<br/>[NAME_1], [DATE_1], etc.

    FHIRDeidentifier->>Session: Store mapping<br/>{[NAME_1]: "John Smith"}
    Session-->>FHIRDeidentifier: sessionId

    FHIRDeidentifier-->>Proxy: Deidentified resource + detectedPHI
    Proxy-->>Client: {deidentifiedResource, sessionId, detectedPHI}
```

**PHI Field Mapping Strategy:**

- **Explicit mapping**: 344+ fields across 77 resource types
- **Deterministic**: Same value → same token (preserves relationships)
- **Recursive**: Handles nested objects, extensions, contained resources
- **Cross-reference preservation**: Bundle resources maintain referential integrity

**Example:**

```json
// Input (Patient resource)
{
  "resourceType": "Patient",
  "id": "patient-123",
  "name": [{"family": "Smith", "given": ["John"]}],
  "birthDate": "1985-03-15",
  "telecom": [{"system": "phone", "value": "555-1234"}]
}

// Output (De-identified)
{
  "resourceType": "Patient",
  "id": "[PATIENT_ID_1]",
  "name": [{"family": "[NAME_1]", "given": ["[NAME_2]"]}],
  "birthDate": "[DATE_1]",
  "telecom": [{"system": "phone", "value": "[PHONE_1]"}]
}

// Session mapping stored
{
  "[PATIENT_ID_1]": "patient-123",
  "[NAME_1]": "Smith",
  "[NAME_2]": "John",
  "[DATE_1]": "1985-03-15",
  "[PHONE_1]": "555-1234"
}
```

**Accuracy: 99.9%** (deterministic field mapping, no ambiguity)

---

### 2. Text De-identification (Multi-Layer NER)

**Multi-layer approach:**

```mermaid
graph TB
    INPUT[Clinical Text] --> LAYER1

    subgraph "Layer 1: Regex Patterns"
        LAYER1[Pattern Matching<br/>75-80% coverage<br/>&lt;10ms]
    end

    subgraph "Layer 2: spaCy NER"
        LAYER2[spaCy NER Service<br/>85-90% coverage<br/>+25ms]
    end

    subgraph "Layer 3: Stanford NER"
        LAYER3[Stanford CoreNLP<br/>95-99% coverage<br/>+190ms]
    end

    LAYER1 --> MERGE1{Merge}
    LAYER2 --> MERGE1

    MERGE1 --> MERGE2{Smart Merge}
    LAYER3 --> MERGE2

    MERGE2 --> OUTPUT[De-identified Text<br/>with tokens]
```

**Smart Merging:**
- Deduplicates entities across layers
- Keeps best detections (highest confidence)
- Preserves original text spans

**Performance:**
- **Layer 1 only**: ~75-80% accuracy, <10ms (fast, good for real-time)
- **Layers 1+2**: ~85-90% accuracy, ~35ms (balanced)
- **All layers**: ~95-99% accuracy, ~200ms (highest accuracy)

---

### 3. Authentication System

**Multi-tenant API key authentication:**

```mermaid
sequenceDiagram
    participant Client
    participant Proxy
    participant Auth
    participant KV/Redis

    Client->>Proxy: Request with<br/>X-API-Key: msk_live_abc123
    Proxy->>Auth: validateApiKey(key)

    Auth->>Auth: Validate format<br/>msk_(live|test)_[0-9a-f]{30,32}
    Auth->>Auth: Hash API key (SHA-256)

    Auth->>KV/Redis: Get API key metadata
    KV/Redis-->>Auth: {userId, email, apiKeyId}

    Auth->>Auth: Check rate limit<br/>100 req/hr default

    alt Rate limit exceeded
        Auth-->>Proxy: 429 Too Many Requests
        Proxy-->>Client: Error response
    else Within limit
        Auth-->>Proxy: {userId, email, authType, apiKeyId}
        Proxy->>Proxy: Process request
        Proxy-->>Client: Success response
    end
```

**API Key Format:**
- `msk_live_*` - Production keys
- `msk_test_*` - Test/sandbox keys
- `msk_test_demo000...` - Hardcoded demo key (no storage)

**Key Lifecycle:**
1. User creates API key on platform dashboard
2. Platform generates key: `msk_live_` + 32 random hex chars
3. Platform stores hash + metadata in database
4. Platform pushes to Workers KV (Cloudflare) or syncs to Redis (Docker)
5. Proxy validates key on each request

---

### 4. Session Management

**Session lifecycle:**

```mermaid
stateDiagram-v2
    [*] --> Created: POST /api/fhir/deidentify<br/>or /api/deidentify
    Created --> Active: Session ID generated<br/>TTL (24 hours)
    Active --> Extended: PUT /api/session<br/>Extend to 7 days
    Active --> Deleted: DELETE /api/session
    Extended --> Deleted: DELETE /api/session
    Active --> Expired: TTL reached
    Extended --> Expired: TTL reached
    Deleted --> [*]
    Expired --> [*]
```

**Storage:**
- **Cloudflare KV**: `session:{uuid}` key, JSON value, 24hr-7day TTL
- **Redis**: String key, JSON value, TTL managed by Redis

**Session Data:**

```json
{
  "sessionId": "uuid-v4",
  "userId": "user-id",
  "apiKeyId": "apikey-id",
  "createdAt": "2025-01-14T12:00:00Z",
  "expiresAt": "2025-01-15T12:00:00Z",
  "mapping": {
    "[NAME_1]": "John Smith",
    "[DATE_1]": "1985-03-15",
    "[PHONE_1]": "555-1234"
  }
}
```

---

### 5. Analytics System

**Tracking per request:**

```mermaid
sequenceDiagram
    participant Proxy
    participant Analytics
    participant KV/Redis
    participant Platform

    Proxy->>Analytics: Track event<br/>{endpoint, responseTime, tokens, success}

    Analytics->>KV/Redis: Increment hourly counters<br/>analytics:hourly:{userId}:{date}:{hour}

    Analytics->>Platform: Push to webhook (fire-and-forget)<br/>POST /api/analytics/sync

    Note over Platform: Platform aggregates<br/>into daily stats

    Platform-->>Analytics: 200 OK (async)
```

**Data Collection:**
- **Per request**: endpoint, timestamp, responseTime, tokensProcessed, success, errorMessage
- **Aggregation**: Hourly → Daily rollup
- **Sync**: Real-time webhook + 5-minute batch cron

**Analytics Webhook Format:**

```json
{
  "userId": "user-id",
  "apiKeyId": "apikey-id",
  "events": [{
    "apiKeyId": "apikey-id",
    "endpoint": "/api/fhir/deidentify",
    "timestamp": "2025-01-14T12:00:00Z",
    "responseTime": 45,
    "tokensProcessed": 12,
    "success": true
  }],
  "dailyData": [{
    "date": "2025-01-14",
    "requestCount": 100,
    "totalTokens": 1200,
    "successRate": 98.5,
    "avgResponseTime": 42
  }],
  "endpointBreakdown": {
    "/api/fhir/deidentify": 75,
    "/api/deidentify": 25
  }
}
```

---

## Data Flow

### Complete Request Flow (FHIR De-identification)

```mermaid
sequenceDiagram
    participant Client
    participant Auth
    participant Validator
    participant FHIRDeidentifier
    participant Session
    participant Analytics
    participant Platform

    Client->>Auth: POST /api/fhir/deidentify<br/>X-API-Key: msk_live_xxx
    Auth->>Auth: Validate API key
    Auth->>Auth: Check rate limit
    Auth-->>Validator: {userId, email, apiKeyId}

    Validator->>Validator: Validate request (Zod)<br/>FHIRDeidentifyRequestSchema
    Validator-->>FHIRDeidentifier: Validated request

    FHIRDeidentifier->>FHIRDeidentifier: Map PHI fields<br/>344+ field mappings
    FHIRDeidentifier->>FHIRDeidentifier: Generate tokens<br/>[NAME_1], [DATE_1], etc.

    FHIRDeidentifier->>Session: Store mapping<br/>sessionId + token map
    Session-->>FHIRDeidentifier: sessionId

    FHIRDeidentifier-->>Analytics: Track event<br/>{tokens, responseTime, success}

    Analytics->>Analytics: Store in KV/Redis<br/>hourly aggregation
    Analytics->>Platform: Push to webhook<br/>fire-and-forget

    FHIRDeidentifier-->>Client: {deidentifiedResource, sessionId, detectedPHI}
```

---

## Common Workflows

### 1. Adding a New FHIR Resource Type

**Steps:**

1. **Update type definition** (`proxy/src/deidentification/fhir-deidentifier.ts:19-121`)
    
    ```tsx
    export type FHIRResourceType =
      | 'Patient'
      | 'Practitioner'
      | 'YourNewResource'  // Add here
      | ...
    ```
    
2. **Add field mappings** (`proxy/src/deidentification/fhir-deidentifier.ts:~344+`)
    
    ```tsx
    const FHIR_PHI_FIELDS: Record<string, string[]> = {
      Patient: ['id', 'name', 'birthDate', 'telecom', ...],
      Practitioner: ['id', 'name', 'telecom', ...],
      YourNewResource: ['id', 'yourPhiField1', 'yourPhiField2', ...],  // Add here
      ...
    };
    ```
    
3. **Add tests** (`proxy/src/__tests__/fhir-deidentifier.test.ts`)
    
    ```tsx
    it('should deidentify YourNewResource', async () => {
      const resource = {
        resourceType: 'YourNewResource',
        id: 'test-id',
        yourPhiField1: 'sensitive-value'
      };
      const result = await deidentifyResource(resource, sessionManager);
      expect(result.deidentifiedResource.yourPhiField1).toMatch(/^\[.*\]$/);
    });
    ```
    
4. **Update documentation** (`proxy/README.md`, `CLAUDE.md`)
5. **Run tests**
    
    ```bash
    npm test
    ```
    

---

### 2. Deploying Proxy API Changes

### Cloudflare Workers Deployment

```bash
# 1. Ensure Workers build works
npm run build
# This should NOT error on Node.js modules

# 2. Deploy to staging
npx wrangler deploy --env staging

# 3. Test staging deployment
curl https://stage.api.medscrub.dev/health

# 4. Deploy to production
npx wrangler deploy --env production

# 5. Verify production
curl https://api.medscrub.dev/health
```

### Docker Deployment

```bash
# 1. Ensure Docker build works
npm run build:docker

# 2. Build Docker image
npm run docker:build

# 3. Push to registry (if applicable)
docker tag medscrub/proxy:latest your-registry/medscrub-proxy:latest
docker push your-registry/medscrub-proxy:latest

# 4. Deploy to customer infrastructure
# (Customer runs docker-compose up with new image)
```

---

### 3. Creating a New Platform API Route

**Example: Create `/api/custom/endpoint`**

1. **Create route file** (`medscrub.dev/src/app/api/custom/endpoint/route.ts`)
    
    ```tsx
    import { NextRequest, NextResponse } from 'next/server';
    import { getServerSession } from 'next-auth';
    import { authOptions } from '@/lib/auth';
    import { prisma } from '@/lib/prisma';
    
    export async function GET(req: NextRequest) {
      const session = await getServerSession(authOptions);
    
      if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    
      // Your logic here
      const data = await prisma.yourModel.findMany({
        where: { userId: session.user.id }
      });
    
      return NextResponse.json({ data });
    }
    
    export async function POST(req: NextRequest) {
      const session = await getServerSession(authOptions);
    
      if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    
      const body = await req.json();
    
      // Your logic here
      const result = await prisma.yourModel.create({
        data: { ...body, userId: session.user.id }
      });
    
      return NextResponse.json({ result });
    }
    ```
    
2. **Add Prisma model** (if needed) (`medscrub.dev/prisma/schema.prisma`)
    
    ```
    model YourModel {
      id        String   @id @default(cuid())
      userId    String
      data      String
      createdAt DateTime @default(now())
      user      User     @relation(fields: [userId], references: [id])
    
      @@index([userId])
    }
    ```
    
3. **Generate Prisma client**
    
    ```bash
    npx prisma generate
    npx prisma db push
    ```
    
4. **Test locally**
    
    ```bash
    npm run dev
    curl http://localhost:3000/api/custom/endpoint
    ```
    

---

### 4. Publishing MCP Server Updates

```bash
cd mcp

# 1. Update version in package.json
# "version": "0.1.16"

# 2. Build
npm run build

# 3. Test locally
npm link
# In another terminal: npx @medscrub/mcp

# 4. Publish to npm
npm publish --access public

# 5. Verify published
npm info @medscrub/mcp
```

---

## Testing

### Unit Tests (Proxy)

```bash
cd proxy

# Run all tests
npm test

# Run specific test file
npm test -- fhir-deidentifier.test.ts

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

**Test structure:**

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { FHIRDeidentifier } from '../deidentification/fhir-deidentifier';
import { SessionManager } from '../storage/session';

describe('FHIRDeidentifier', () => {
  let sessionManager: SessionManager;
  let deidentifier: FHIRDeidentifier;

  beforeEach(() => {
    sessionManager = new SessionManager(mockKV);
    deidentifier = new FHIRDeidentifier(sessionManager);
  });

  it('should deidentify Patient resource', async () => {
    const patient = {
      resourceType: 'Patient',
      id: 'patient-123',
      name: [{ family: 'Smith', given: ['John'] }]
    };

    const result = await deidentifier.deidentifyResource(patient);

    expect(result.deidentifiedResource.id).toMatch(/^\[.*\]$/);
    expect(result.detectedPHI.length).toBeGreaterThan(0);
    expect(result.sessionId).toBeDefined();
  });
});
```

---

### E2E Tests (Platform)

```bash
cd medscrub.dev

# Run all E2E tests
npm run test:e2e

# Run with UI
npm run test:e2e:ui

# Run in headed mode (see browser)
npm run test:e2e:headed

# Debug mode
npm run test:e2e:debug
```

**Test example:**

```tsx
import { test, expect } from '@playwright/test';

test('user can create API key', async ({ page }) => {
  // Login
  await page.goto('http://localhost:3000/login');
  await page.fill('input[name="email"]', 'test@example.com');
  await page.click('button[type="submit"]');

  // Navigate to dashboard
  await page.goto('http://localhost:3000/dashboard');

  // Create API key
  await page.click('button:has-text("Create API Key")');
  await page.fill('input[name="name"]', 'Test Key');
  await page.click('button:has-text("Create")');

  // Verify key created
  await expect(page.locator('text=Test Key')).toBeVisible();
});
```

---

## Deployment

### Cloudflare Workers (Proxy)

**GitHub Actions CI/CD** (`.github/workflows/deploy-proxy.yml`)

```yaml
name: Deploy Proxy

on:
push:
branches:
- main        # Deploy to production
- stage       # Deploy to staging

jobs:
deploy:
runs-on: ubuntu-latest
steps:
-uses: actions/checkout@v3
-uses: actions/setup-node@v3
with:
node-version:18
-run: npm install
-run: npm run build
-name: Deploy to Cloudflare Workers
        run:|
          if [ "${{ github.ref }}" == "refs/heads/main" ]; then
            npx wrangler deploy --env production
          else
            npx wrangler deploy --env staging
          fi
env:
CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

**Manual deployment:**

```bash
# Production
npm run build
npx wrangler deploy --env production

# Staging
npm run build
npx wrangler deploy --env staging
```

---

### Vercel (Platform)

**Automatic deployment:**
- Push to `main` branch → Deploys to production (`medscrub.dev`)
- Pull request → Creates preview deployment

**Manual deployment:**

```bash
cd medscrub.dev

# Deploy to production
vercel --prod

# Deploy to preview
vercel
```

**Environment variables** (set in Vercel dashboard):
- `DATABASE_URL`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `JWT_SECRET`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

---

### Docker (Self-Hosted Proxy)

**Build and push:**

```bash
cd proxy

# Build image
docker build -t medscrub/proxy:latest .

# Tag for registry
docker tag medscrub/proxy:latest your-registry/medscrub-proxy:latest

# Push to registry
docker push your-registry/medscrub-proxy:latest
```

**Customer deployment:**

```bash
# Pull latest image
docker pull your-registry/medscrub-proxy:latest

# Start services
docker-compose up -d

# View logs
docker-compose logs -f proxy

# Stop services
docker-compose down
```

---

## Common Pitfalls & Tips

### ❌ Common Mistakes

1. **Adding Node.js imports to Workers code**
    - DON’T: `import * as fs from 'fs'` in shared files
    - DO: Keep Node.js imports in Docker-only files (`server.ts`, `redis-adapter.ts`, etc.)
2. **Forgetting to exclude new files from Workers build**
    - If you add a new file using Node.js modules, update `tsconfig.worker.json` exclude array
3. **Not testing both build targets**
    - Always run BOTH `npm run build` (Workers) AND `npm run build:docker`
4. **Logging PHI**
    - NEVER: `console.log('Patient name:', patient.name)`
    - DO: `console.log('Patient ID token:', patientIdToken)`
5. **Hardcoding API URLs**
    - DON’T: `const API_URL = 'https://api.medscrub.dev'`
    - DO: `const API_URL = process.env.MEDSCRUB_API_URL || 'https://api.medscrub.dev'`

### ✅ Best Practices

1. **Use abstractions for dual deployment**
    - `auth.ts`, `session.ts`, `analytics.ts` handle KV vs Redis automatically
2. **Test with realistic FHIR data**
    - Use Synthea FHIR data generator for realistic test cases
3. **Follow HIPAA logging guidelines**
    - Log tokens, not PHI values
    - Use audit logs for compliance
4. **Run linters before committing**
    
    ```bash
    npm run lint
    npm run format:check
    npm run type-check
    ```
    
5. **Use environment variables for configuration**
    - Never hardcode secrets or URLs

---

## Resources

### Documentation

- **API Docs**: https://medscrub.dev/docs
- **MCP Setup Guide**: `/mcp/README.md`
- **FHIR Expansion Plan**: `/proxy/FHIR_EXPANSION_PLAN.md`
- **LLM-Optimized Format**: `/proxy/LLM_OPTIMIZED_FORMAT.md`

### External Links

- **FHIR R4 Spec**: https://hl7.org/fhir/R4/
- **HIPAA Safe Harbor**: https://www.hhs.gov/hipaa/for-professionals/privacy/special-topics/de-identification/index.html
- **Cloudflare Workers Docs**: https://developers.cloudflare.com/workers/
- **Next.js Docs**: https://nextjs.org/docs
- **MCP SDK**: https://github.com/modelcontextprotocol/sdk

### Internal Tools

- **Prisma Studio**: `npm run db:studio` (database GUI)
- **Wrangler Dev**: `npx wrangler dev` (local Workers testing)
- **Docker Compose**: `npm run docker:up` (local proxy testing)

---

## Getting Help

### Onboarding Checklist

- [ ]  Clone repository and set up local development environment
- [ ]  Run proxy locally (Wrangler or Docker)
- [ ]  Run platform locally (Next.js)
- [ ]  Set up MCP server and test with Claude Desktop
- [ ]  Read through CLAUDE.md and key source files
- [ ]  Run test suite for proxy and platform
- [ ]  Make a small code change and deploy to staging
- [ ]  Review GitHub Actions workflows
- [ ]  Join team Slack/Discord for questions

### Common Questions

**Q: How do I add a new FHIR resource type?**
A: See [Adding a New FHIR Resource Type](about:blank#1-adding-a-new-fhir-resource-type)

**Q: Why does Workers build fail with “Could not resolve ‘redis’”?**
A: A Node.js module is being imported in a file that’s included in the Workers build. Check `tsconfig.worker.json` exclude array.

**Q: How do I test changes locally without deploying?**
A: Use `npx wrangler dev` for proxy or `npm run dev` for platform.

**Q: Where do I find API keys for testing?**
A: Use the demo key: `msk_test_demo000000000000000000000000000000` or create one at https://medscrub.dev/dashboard

**Q: How do I sync analytics from Docker to platform?**
A: Set `PLATFORM_WEBHOOK_URL` and `ANALYTICS_WEBHOOK_SECRET` in `.env`, analytics will sync automatically.

---

**Welcome to the team! 🎉**

If you have any questions not covered here, please reach out to the team or check the internal documentation.

---

*Last Updated: 2025-01-14
Maintainer: MedScrub Engineering Team*