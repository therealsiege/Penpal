# Platform Infrastructure — CDK Architecture

> Two-stack deployment spanning `us-east-2` (compute) and `us-east-1` (edge). Three API surfaces, shared networking, cross-account event bus, and multi-region failover via CloudFront.

**See also:** [Platform Packages](Platform%20Packages.md) | [Tech Stack](Tech%20Stack.md) | [Architecture](../Migration/Architecture.md)

## Stack Overview

```
olh-platform/
├── src/
│   ├── app.ts                    # CDK entry point — creates both stacks
│   ├── platform.stack.ts         # PlatformStack (us-east-2)
│   ├── edge.stack.ts             # EdgeStack (us-east-1)
│   └── features/
│       ├── partner-api/          # PartnerApi + Authorizer + SecurityLayer
│       ├── internal-api/         # InternalApi (service-to-service)
│       ├── integrations-api/     # IntegrationsApi (webhook inbound)
│       ├── network-integration/  # VPC, NLB, VPC Endpoints
│       ├── enterprise-event-bus/ # EventBridge + cross-account role
│       ├── key-repository/       # KMS (Stripe ESL key)
│       ├── edge-waf/             # WAFv2 (bot, DDoS protection)
│       └── multiregion-distribution/ # CloudFront + failover
└── .claude/CLAUDE.md             # Architecture documentation
```

## PlatformStack (us-east-2)

The main compute stack. Creates shared infrastructure and all three API surfaces.

### Shared Infrastructure

| Resource | Construct | Purpose |
|----------|-----------|---------|
| **EnterpriseEventBus** | `EventBus` + `IntegrationRole` | Cross-account EventBridge with KMS encryption. Bus name: `platform-enterprise-event-bus`. Archive enabled. |
| **KeyRepository** | KMS Key | `StripeEslKey` — cross-account KMS key for Stripe ESL secrets |
| **NetworkIntegration** | VPC + NLB + VPC Endpoint | Private connectivity: Interface VPC Endpoint for API Gateway, internal NLB (TCP 443), health check on `/ping` |
| **VpcLink** | API Gateway VPC Link | Routes API Gateway traffic through NLB to private backends |

### Three API Surfaces

#### 1. PartnerApi — External Partner-Facing

The customer-facing REST API described in [Architecture](../Migration/Architecture.md). Abstracts FHIR behind domain-friendly endpoints.

- **Endpoint type:** Regional
- **Auth:** API Key required + Custom Lambda Authorizer
- **API Keys:** `healthie-partner-api-key`, `medplum-partner-api-key`, `healthie-admin-partner-api-key`, `medplum-admin-partner-api-key`
- **Not deployed in production** — gated by `isProdEnv` (currently only in dev/staging while domains migrate routes)
- **Debug endpoint:** `GET /request-inspector` — returns full request context (non-prod only)

**Stack outputs:** `PartnerApiId`, `PartnerApiIntegrationRoleArn`, `PartnerApiAuthorizerId`

#### 2. InternalApi — Service-to-Service

Private API for inter-service communication within the platform.

- **Auth:** API Key + Custom Authorizer resolving consumer identity
- **API Keys:** `clinic-api-key`, `hey-revia-api-key`
- **Authorizer:** `resolveConsumer()` — returns `'clinic'` or `'heyRevia'`
- **Header injection:** `x-consumer` (derived from authorizer context)
- **Always deployed** (not gated by `isProdEnv`)

**Stack outputs:** `InternalApiId`, `InternalApiIntegrationRoleArn`, `InternalApiAuthorizerId`

#### 3. IntegrationsApi — Third-Party Webhook Inbound

Receives webhooks from external services (Stripe, Healthie, etc.).

- **Auth:** None (no authorizer)
- **Always deployed**

**Stack outputs:** `IntegrationsApiId`, `IntegrationsApiIntegrationRoleArn`

## EdgeStack (us-east-1)

Edge-layer infrastructure. Must be in `us-east-1` for CloudFront/WAF association.

### Components

| Resource | Purpose |
|----------|---------|
| **EdgeWaf** | WAFv2 web ACL: bot protection (requires User-Agent), DDoS, rate limiting. Applied to all three API CloudFront distributions. |
| **Domain** (x3) | Route53 hosted zones + ACM certificates for each API variant (Partner, Internal, Integrations) |
| **MultiRegionDistribution** (x3) | CloudFront distributions with Lambda@Edge origin verification, geo-restriction (US, CA, PE default), and multi-region failover |

### Multi-Region Failover

Each `MultiRegionDistribution` creates:
1. **CloudFront distribution** with WAF association
2. **Lambda@Edge** (`OriginRequestFunction`) — fetches origin-verify secrets from Secrets Manager, injects `x-origin-verify-{region}` header
3. **FailoverAggregator** — REST API with circuit breaker logic per `region:method:path` (threshold: 3 failures, timeout: 60s). Tries primary region first, fails over to secondary.

## PartnerApi Authorizer — EHR Resolution

The custom Lambda authorizer is the mechanism that enables gradual Healthie→Medplum migration. Each API key maps to an EHR provider; the authorizer resolves this at request time and injects it as a header.

### resolveEhr() Flow

```
Client                    API Gateway              Authorizer Lambda
  │                           │                          │
  │  x-api-key: <key>        │                          │
  ├──────────────────────────>│                          │
  │                           │  apiKeyId from context   │
  │                           ├─────────────────────────>│
  │                           │                          │
  │                           │   resolveEhr(apiKeyId):  │
  │                           │   healthieApiKeyId? → 'healthie'
  │                           │   medplumApiKeyId?  → 'medplum'
  │                           │   *-admin variants  → '*-admin'
  │                           │                          │
  │                           │  IAM policy + context    │
  │                           │  { ehr: 'medplum' }      │
  │                           │<─────────────────────────│
  │                           │                          │
  │                           │  Inject headers:         │
  │                           │  x-ehr-source: medplum   │
  │                           │  x-partner-id: <id>      │
  │                           │                          │
  │                           │──── VPC Link ──── NLB ──── Domain Backend
```

**Key file:** `src/features/partner-api/authorizer/function/authorizer.handler.ts`

The `resolveEhr()` function (lines 10-31):
- Matches `apiKeyId` against environment variables: `HEALTHIE_API_KEY_ID`, `MEDPLUM_API_KEY_ID`, `HEALTHIE_ADMIN_API_KEY_ID`, `MEDPLUM_ADMIN_API_KEY_ID`
- Returns EHR type: `'healthie'` | `'medplum'` | `'healthie-admin'` | `'medplum-admin'`
- Throws on unknown API key

**Config validation** requires at least one of Healthie or Medplum API key IDs. If a provider is enabled, its admin key must also be configured.

**Cache:** 5-minute TTL on authorizer responses.

## Producer/Consumer Pattern

Domain repos register routes on Platform APIs using the `ProducerRestApi` construct from `@olh/constructs`. This enables each domain to own its routes while sharing the Platform's API Gateway, authorizer, and networking.

### How Domain Repos Register Routes

1. Domain repo CDK stack receives Platform outputs as context:
   - `CONSUMER_API_ID` — REST API ID
   - `CONSUMER_API_ROLE` — Cross-account integration role ARN
   - `CONSUMER_API_VPC_ENDPOINT` — VPC endpoint ID
   - `CONSUMER_API_VPC_LINK` — VPC Link ID
   - `CONSUMER_API_AUTHORIZER_ID` — (optional) Authorizer ID

2. `ProducerRestApi` assumes the `IntegrationRole` (cross-account IAM) to manage routes on the Platform API Gateway

3. Traffic flows: CloudFront → API Gateway → VPC Link → NLB → Domain backend (private)

4. If `CONSUMER_API_AUTHORIZER_ID` is set, routes require authorization; otherwise they're open

## Cross-Account Event Bus

The `EnterpriseEventBus` is the canonical event backbone described in [Architecture](../Migration/Architecture.md).

**Integration role grants to organization members:**
- `events:PutEvents` on the platform bus
- `events:PutRule`, `DeleteRule`, `PutTargets`, `RemoveTargets` for rule management
- KMS Decrypt/GenerateDataKey for encrypted events
- IAM PassRole to EventBridge service

**Trust policy:** Organization principal with `aws:PrincipalOrgPaths` condition.

## Security Layers

### WAF (Edge)
- Bot protection: requires User-Agent header
- DDoS protection via AWS managed rules
- Rate limiting
- Applied to all CloudFront distributions

### Origin Verification
- Each API has a Secrets Manager secret with `secretHeaderName` + `token`
- Lambda@Edge injects `x-origin-verify-{region}` header on every request
- API Gateway WAF validates the header — blocks direct API Gateway access (must come through CloudFront)

### Geo-Restriction
- CloudFront geo-restriction via `GEO_RESTRICTION` env var (default: `US,CA,PE`)

### Network Isolation
- Domain backends run in private subnets
- API Gateway reaches them via VPC Link → NLB → private IPs
- VPC Endpoint restricts API Gateway access to the VPC

## Environment Configuration

Key environment variables for deployment:

| Variable | Purpose | Default |
|----------|---------|---------|
| `CDK_DEFAULT_REGION` | Primary region | — |
| `CDK_DEFAULT_ACCOUNT` | AWS account ID | — |
| `OU_ID_ORG_PATH` | Organization unit paths (cross-account trust) | — |
| `GEO_RESTRICTION` | CloudFront geo-restriction | `US,CA,PE` |
| `THROTTLING_BURST_LIMIT` | API Gateway burst | 100 |
| `THROTTLING_RATE_LIMIT` | API Gateway rate | 50 |
| `CIRCUIT_BREAKER_THRESHOLD` | Failover trigger | 3 |
| `CIRCUIT_BREAKER_TIMEOUT` | Circuit reset (ms) | 60000 |
| `REQUEST_TIMEOUT` | Upstream timeout (ms) | 5000 |
| `STRIPE_ESL_KEY_ALLOWED_ACCOUNT_IDS` | Accounts with Stripe KMS access | — |

## Request Flow (End-to-End)

```
Client Request (x-api-key header)
    │
    ▼
CloudFront (EdgeWaf — bot check, User-Agent required)
    │
    ▼
Lambda@Edge (inject x-origin-verify-{region} header)
    │
    ▼
FailoverAggregator (circuit breaker per region:method:path)
    │
    ▼
API Gateway (validate API key → Custom Authorizer)
    │
    ▼
Authorizer Lambda (resolveEhr → inject x-ehr-source, x-partner-id)
    │
    ▼
VPC Link → NLB → Domain Backend (private subnet)
    │
    ▼
Lambda handler reads x-ehr-source → builds @olh/ehr-client with correct provider
```
