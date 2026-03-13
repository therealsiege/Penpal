**Created:** March 7, 2026
**Updated:** March 7, 2026
**Tags:** Engineering

---

## Overview

The MedScrub PHI Proxy is a self-hosted de-identification service that strips Protected Health Information (PHI) from FHIR R4 resources and clinical text before they are sent to AI/LLM services. It uses deterministic field-level tokenization for structured FHIR data and a multi-layer NER pipeline for unstructured text, achieving up to 99.9% accuracy on structured data (benchmarked). All de-identification is reversible through session-based token mapping, allowing AI responses to be re-contextualized with the original PHI after processing.

The proxy covers all 18 HIPAA Safe Harbor identifiers and can be deployed on any infrastructure -- cloud, on-premises, or air-gapped environments. It is designed for organizations that need HIPAA compliance without requiring a Business Associate Agreement with third-party AI providers, since PHI never leaves the customer's network.

## De-identification Pipeline

### FHIR De-identification

The FHIR de-identification engine uses deterministic field mapping across 77+ FHIR R4 resource types. Each resource type has an explicit mapping of PHI-containing fields (344+ fields total), which the engine traverses to detect and replace identifiers with tokens. This approach achieves 99.9% accuracy on structured FHIR data.

**Supported resource categories include:**

| Category | Example Resources |
|----------|-------------------|
| Clinical | Patient, Practitioner, Observation, Condition, AllergyIntolerance, FamilyMemberHistory |
| Medications | MedicationRequest, MedicationAdministration, MedicationDispense, MedicationStatement |
| Procedures | Procedure, ServiceRequest, Immunization |
| Encounters | Encounter, EpisodeOfCare, Appointment, AppointmentResponse |
| Diagnostics | DiagnosticReport, ImagingStudy, Specimen, Media |
| Documents | DocumentReference, Composition |
| Care Planning | CarePlan, CareTeam, Goal, GuidanceResponse |
| Financial | Claim, ExplanationOfBenefit, Coverage, Account, PaymentNotice |
| Infrastructure | Organization, Location, Device, HealthcareService, Endpoint |
| Communication | Communication, CommunicationRequest, Consent |
| Workflow | Task, Provenance, AuditEvent, RequestGroup |
| Research | ResearchStudy, ResearchSubject |

For unmapped resource types, a generic fallback engine uses recursive field scanning and pattern matching, achieving roughly 80% accuracy.

**Token format:**

Tokens follow the pattern `[TYPE_COUNTER]`, where `TYPE` identifies the PHI category and `COUNTER` increments per unique value within a session.

```
Original: "John Smith, DOB: 1985-03-15, MRN: 12345"
Tokens:   "[NAME_1], DOB: [DATE_1], MRN: [IDENTIFIER_1]"
```

Supported token types include `NAME`, `DATE`, `IDENTIFIER`, `PHONE`, `EMAIL`, `ADDRESS`, `SSN`, and others corresponding to the 18 HIPAA identifier categories.

**Cross-reference preservation:**

Within a FHIR Bundle, referential integrity is maintained across resources. For example, `Patient/123` is consistently tokenized as `Patient/[PATIENT_ID_1]` wherever it appears in the bundle, preserving the relationships that AI models need to reason about the data.

### Text De-identification

Text de-identification uses a multi-layer NER pipeline with a "Swiss cheese" defense-in-depth approach. Each layer catches entities the previous layer missed.

| Layer | Method | Coverage | Latency | Details |
|-------|--------|----------|---------|---------|
| Layer 1 | Regex patterns | 75--80% | <10ms | Fast contextual pattern matching (HIPAA Safe Harbor patterns) |
| Layer 2 | spaCy NER | +10--15% | +25ms | Neural entity recognition with medical filtering (optional, requires `NER_SERVICE_URL`) |
| Layer 3 | Stanford transformer | 95--99% | +190ms | State-of-the-art transformer model, 99.5% F1 on i2b2 benchmark (optional, enabled via `options.useLayer3`) |

The engine performs smart merging across layers -- deduplicating entities detected by multiple layers and keeping the highest-confidence detection for each span.

## Deployment Models

### Self-Hosted Docker (Primary)

The primary deployment model. The proxy runs as a Docker container alongside Redis for session storage, analytics, rate limiting, and API key management.

- **Infrastructure:** Docker, Kubernetes, bare metal, or any cloud provider (AWS, Azure, GCP)
- **Storage:** Redis
- **Use cases:** HIPAA compliance without BAA, air-gapped environments, unlimited throughput
- **Deployment templates:** Available for AWS (CloudFormation), Azure (ARM), and GCP

```bash
# Build and start
npm run build:docker
docker-compose up -d
```

### Cloudflare Workers (Demo/Managed)

A secondary deployment target used for the managed demo instance (`api.medscrub.dev`) and staging environments. Uses Cloudflare KV namespaces instead of Redis.

- **Infrastructure:** Cloudflare edge network
- **Storage:** Cloudflare KV
- **Use cases:** Demo access, global edge performance, zero infrastructure management

```bash
# Build and deploy
npm run build
npx wrangler deploy --env production
```

### Dual-Build System

The proxy maintains two separate TypeScript build configurations that share approximately 95% of the codebase. This exists because Cloudflare Workers cannot use Node.js modules (`redis`, `os`, `crypto`, `fs`, `net`), so the Workers build excludes files that depend on them.

| Build | Config | Command | Includes |
|-------|--------|---------|----------|
| Workers | `tsconfig.worker.json` | `npm run build` | Shared files + KV adapters |
| Docker | `tsconfig.json` | `npm run build:docker` | All files (Redis, license, credit manager) |

Shared files (safe for both builds): `fhir-deidentifier.ts`, `enhanced-deidentifier.ts`, `enhanced-patterns.ts`, `session.ts`, `auth.ts`, `analytics.ts`, `validation.ts`.

Docker-only files (excluded from Workers build): `server.ts`, `redis-adapter.ts`, `redis-auth.ts`, `license.ts`, `credit-manager.ts`.

## Authentication

### API Key Format

All API keys follow the format `msk_{environment}_{32_hex_chars}`:

| Prefix | Environment | Usage |
|--------|-------------|-------|
| `msk_live_` | Production | Live customer traffic |
| `msk_test_` | Test/sandbox | Development and testing |
| `msk_test_demo000...` | Demo | Hardcoded demo key, rate limited |

Keys are passed via the `X-API-Key` HTTP header on all requests except `/health`, `/api/stats`, and `/api/license/info`.

### Authentication Flow

1. Extract `X-API-Key` header from request
2. Validate format against regex: `msk_(live|test)_[0-9a-f]{30,32}`
3. Hash the key with SHA-256
4. Validate against storage backend:
   - Try Redis first (self-hosted deployments)
   - Fall back to Cloudflare KV (Workers deployments)
   - Auto-sync KV to Redis for future requests (if Redis is available)
5. Return authenticated context: `{ userId, email, authType, apiKeyId }`

### Key Lifecycle

1. User creates API key on the platform dashboard (`medscrub.dev/dashboard`)
2. Platform generates the key and stores the hash + metadata in its database
3. Platform syncs to Cloudflare KV via `/api/admin/sync-keys` (for Workers deployments)
4. Platform syncs to customer Redis via `/api/sync-key` (for self-hosted deployments)

### Rate Limiting

- **Demo key:** 100 requests/hour
- **Paid customers:** Unlimited (usage controlled by credit balance)
- **Self-hosted:** Configurable or unlimited

Rate limiting is KV/Redis-backed with 1-hour expiration windows and fails open on errors (allows the request through).

## Storage

### Redis (Self-Hosted)

Self-hosted deployments use Redis for all persistent state:

| Data | Key Pattern | TTL | Structure |
|------|-------------|-----|-----------|
| Sessions (token mappings) | `session:{uuid}` | 24hr (extendable to 7 days) | String (JSON) |
| API key metadata | `apikey:{sha256_hash}` | Never (until revoked) | Hash |
| Rate limit counters | `rate_limit:{userId}:{hourTimestamp}` | 1hr | String |
| Analytics aggregations | `analytics:hourly:{userId}:{date}:{hour}` | 90 days | Hash |

### Cloudflare KV (Workers)

Workers deployments use Cloudflare KV namespaces with the same schema:

| Namespace | Purpose | TTL |
|-----------|---------|-----|
| `SESSIONS` | Token mappings | 24hr (extendable to 7 days) |
| `PHI_CACHE` | PHI cache | 24hr |
| `RATE_LIMITS` | Rate limiting | 1hr |
| `USAGE_ANALYTICS` | Hourly/daily analytics | 90 days |
| `API_KEYS_KV` | Multi-tenant API keys | Never (until revoked) |

## Analytics and Platform Sync

### Per-Request Tracking

Every de-identification request is tracked with the following data:

```typescript
{
  userId: string,
  userEmail: string,
  apiKeyId?: string,
  endpoint: string,         // e.g., "/api/fhir/deidentify"
  timestamp: ISO8601,
  responseTime: number,     // milliseconds
  tokensProcessed: number,  // PHI elements detected
  success: boolean,
  errorMessage?: string
}
```

### Hourly Aggregation

Analytics are aggregated hourly under the key pattern `analytics:hourly:{userId}:{date}:{hour}`, storing:

- `requestCount`, `totalTokens`, `successCount`, `errorCount`
- `avgResponseTime`, endpoint breakdown

Daily aggregations are computed on-demand from hourly data.

### Sync to Platform

Analytics are synced to the platform dashboard (`medscrub.dev`) via two mechanisms:

| Method | Trigger | Scope | Behavior |
|--------|---------|-------|----------|
| Real-time | Per-request (fire-and-forget) | Today's data only | Pushes immediately after tracking |
| Batch (cron) | Every 5 minutes | All users, last 7 days | Full reconciliation sync |

Both methods push to staging and production platforms simultaneously.

**Webhook format:**

```
POST {PLATFORM_WEBHOOK_URL}/api/analytics/sync
Headers:
  X-Webhook-Secret: {ANALYTICS_WEBHOOK_SECRET}
  X-Proxy-Url: "cloudflare-worker" | "self-hosted"
Body: {
  userId, apiKeyId,
  dailyData: [{ date, requestCount, totalTokens, successRate, avgResponseTime }],
  endpointBreakdown: { "/api/fhir/deidentify": 100, ... },
  totalStats: { totalRequests, totalTokens, successRate, avgResponseTime }
}
```

## API Endpoints

| Endpoint | Method | Auth Required | Description |
|----------|--------|---------------|-------------|
| `/health` | GET | No | Health check |
| `/api/stats` | GET | No | System statistics |
| `/api/license/info` | GET | No | License type and features |
| `/api/fhir/deidentify` | POST | API key | De-identify FHIR R4 resource or Bundle |
| `/api/deidentify` | POST | API key | De-identify clinical text |
| `/api/session` | GET | API key | Get session info (`?sessionId=x`) |
| `/api/session` | PUT | API key | Extend session TTL |
| `/api/session` | DELETE | API key | Delete session (`?sessionId=x`) |
| `/api/analytics` | GET | API key | Usage analytics |
| `/api/expert-determination/analyze` | POST | API key | Analyze single session for re-identification risk |
| `/api/expert-determination/analyze-dataset` | POST | API key | Analyze multiple sessions for re-identification risk |
| `/api/admin/sync-keys` | POST | `ADMIN_SECRET` | Sync API keys from platform |
| `/api/admin/sync-analytics` | POST | `ADMIN_SECRET` | Sync analytics to platform |

## Key Metrics

| Metric | Value |
|--------|-------|
| FHIR accuracy (structured data) | 99.9% |
| Text accuracy (all layers enabled) | Up to 99% |
| FHIR response time | <50ms |
| Text response time (all layers) | <250ms |
| Supported FHIR resource types | 77+ (76 with explicit field mapping) |
| HIPAA Safe Harbor identifiers covered | All 18 |
| PHI fields mapped | 344+ |
| Default session TTL | 24 hours (extendable to 7 days) |
| Default rate limit | 100 requests/hour (configurable) |

## Key Files

```
proxy/
├── src/
│   ├── index.ts                     # Main Worker entry point, routing, analytics push
│   ├── server.ts                    # Express.js server for Docker deployments (Docker only)
│   ├── fhir-deidentifier.ts         # FHIR de-identification engine (99.9% accuracy, 77+ resource types)
│   ├── generic-fhir-deidentifier.ts # Fallback engine for unmapped FHIR resource types
│   ├── enhanced-deidentifier.ts     # Multi-layer text NER pipeline (Layer 1/2/3)
│   ├── enhanced-patterns.ts         # HIPAA Safe Harbor regex patterns (Layer 1)
│   ├── session.ts                   # Session management abstraction (KV and Redis)
│   ├── auth.ts                      # Authentication and rate limiting abstraction
│   ├── analytics.ts                 # Usage tracking and analytics aggregation
│   ├── validation.ts                # Zod request validation schemas
│   ├── kv-auth.ts                   # KV-based authentication (Workers only)
│   ├── redis-auth-stub.ts           # No-op Redis auth stub (Workers only)
│   ├── redis-auth.ts                # Redis-based authentication (Docker only)
│   ├── redis-adapter.ts             # Redis client wrapper (Docker only)
│   ├── license.ts                   # License validation (Docker only)
│   └── credit-manager.ts           # Credit tracking (Docker only)
├── ner-service/                     # Optional NER service for Layer 2/3 (Python, spaCy, Stanford)
├── deployments/                     # Cloud deployment templates (AWS, Azure, GCP)
├── docker-compose.yml               # Docker orchestration (proxy + Redis)
├── Dockerfile                       # Proxy container definition
├── wrangler.toml                    # Cloudflare Workers deployment config
├── tsconfig.json                    # TypeScript config for Docker build
└── tsconfig.worker.json             # TypeScript config for Workers build
```
