Created: March 7, 2026
Tags: Engineering, Compliance
*Updated: March 7, 2026*
## Overview

MedScrub's security model is built on the principle that PHI never leaves customer infrastructure unprotected. The self-hosted PHI proxy is the trust foundation -- it sits between patient data and any external AI service, ensuring that identifiable health information is de-identified before it reaches consumer LLMs and re-identified only after the response returns to the customer's environment.

This architecture means MedScrub can leverage the best consumer LLMs (Claude, GPT, Gemini, Llama) without requiring custom model hosting or exposing patient data. The proxy is LLM-agnostic -- it works with any OpenAI-compatible API.

---

## HIPAA Compliance

### Safe Harbor Method

MedScrub implements the HIPAA Safe Harbor de-identification standard, covering all 18 identifiers:

| # | Identifier | Examples |
|---|------------|----------|
| 1 | Names | All variations (given, family, maiden, alias) |
| 2 | Geographic subdivisions | Addresses, city, state, ZIP code |
| 3 | Dates | Birth, death, admission, discharge, service dates |
| 4 | Phone numbers | All formats |
| 5 | Fax numbers | All formats |
| 6 | Email addresses | All formats |
| 7 | Social Security numbers | SSN |
| 8 | Medical record numbers | MRN |
| 9 | Health plan beneficiary numbers | Insurance IDs |
| 10 | Account numbers | Financial accounts |
| 11 | Certificate/license numbers | DEA, NPI, driver's license |
| 12 | Vehicle identifiers | VIN, plate numbers |
| 13 | Device identifiers/serial numbers | UDI, serial numbers |
| 14 | URLs | Web addresses |
| 15 | IP addresses | Network identifiers |
| 16 | Biometric identifiers | Fingerprints, voiceprints |
| 17 | Full-face photographs | Images |
| 18 | Any unique identifying number/code | Any other unique ID |

### Expert Determination

The proxy includes Expert Determination analysis endpoints (`POST /api/expert-determination/analyze`, `POST /api/expert-determination/analyze-dataset`) that perform statistical risk analysis using K-anonymity, L-diversity, and T-closeness measures. The technical infrastructure for Expert Determination is in place; formal certification with a qualified statistician is on the backlog and not currently being pursued.

### De-identification Accuracy

| Data Type | Accuracy | Method | Latency |
|-----------|----------|--------|---------|
| Structured FHIR R4 | 99.9% | Deterministic field mapping across 77+ resource types | <50ms |
| Clinical text (all layers) | Up to 99% | Multi-layer NER (regex + spaCy + Stanford transformer) | <250ms |
| Unmapped FHIR resources | ~80% | Generic recursive field scanning + pattern detection | <50ms |

Text de-identification uses a Swiss cheese defense-in-depth approach with three layers:

- **Layer 1 (Regex):** 75-80% coverage, <10ms -- fast contextual pattern matching
- **Layer 2 (spaCy NER):** +10-15% coverage, +25ms -- neural entity recognition with medical filtering
- **Layer 3 (Stanford):** 95-99% total coverage, +190ms -- transformer model (99.5% F1 on i2b2 benchmark)

Layers are additive. Smart merging deduplicates entities across layers and keeps the best detections.

### No PHI Logging Policy

Patient data is never logged by the proxy. Only token IDs (e.g., `[NAME_1]`, `[DATE_3]`) appear in logs. This is enforced at the code level -- all logging paths use de-identified references.

### Session-Based Reversible Tokenization

PHI is replaced with deterministic tokens that preserve clinical relationships:

```
Original: "John Smith, DOB: 1985-03-15, MRN: 12345"
Tokenized: "[NAME_1], DOB: [DATE_1], MRN: [IDENTIFIER_1]"
```

Token mappings are stored in sessions (Redis or Cloudflare KV) with a 24-hour TTL, extendable to 7 days. Cross-references within FHIR Bundles maintain referential integrity -- `Patient/123` becomes `Patient/[PATIENT_ID_1]` consistently across all resources in the bundle.

---

## PHI Data Flow

PHI moves through MedScrub in a controlled pipeline where identifiable data never reaches external services:

```
EHR (Epic / athenahealth / Oracle Health)
    │
    │  FHIR R4 API (SMART on FHIR / backend systems)
    ▼
CDR (Medplum) — FHIR R4 data store, encrypted at rest
    │
    │  Patient bundle (identifiable)
    ▼
PHI Proxy — De-identify (reversible tokenization, all 18 identifiers)
    │
    │  De-identified data (tokens only, no PHI)
    ▼
LLM (Claude / GPT / any OpenAI-compatible API) — generates clinical output
    │
    │  De-identified output (tokens preserved)
    ▼
PHI Proxy — Re-identify (restore original values from session)
    │
    │  Re-identified output (identifiable, for physician only)
    ▼
Physician — Reviews and edits (human in the middle)
    │
    │  Approved output
    ▼
EHR — Write-back via DocumentReference.Create
```

The LLM never receives identifiable PHI. It works with tokens like `[NAME_1]` and `[DATE_3]` that preserve clinical context without revealing patient identity. The proxy handles both directions -- de-identification on the way out, re-identification on the way back.

In self-hosted deployments, the proxy runs on customer infrastructure (Docker). PHI never leaves the customer's environment in identifiable form.

---

## Authentication & Authorization

MedScrub supports three authentication methods, each suited to different deployment models:

| Method | Format | Use Case | Validity |
|--------|--------|----------|----------|
| JWT Tokens | Bearer token | Platform-generated, desktop/mobile apps | 24 hours |
| API Keys | `msk_{env}_{32_hex}` | Self-hosted deployments, developer API | Until revoked |
| License Keys | Enterprise format | Air-gapped environments, offline validation | Per contract |

### API Key Lifecycle

1. User creates an API key on the platform dashboard (`medscrub.dev/dashboard`)
2. Platform generates key: `msk_live_` + 32 random hex characters
3. Platform stores SHA-256 hash + metadata in database
4. Key is synced to the deployment target:
   - Cloudflare Workers: pushed to KV via `/api/admin/sync-keys`
   - Self-hosted Docker: synced to Redis via `/api/sync-key`

### Authentication Flow

1. Extract `X-API-Key` header from request
2. Validate format: `msk_(live|test)_[0-9a-f]{30,32}`
3. Hash the key (SHA-256)
4. Multi-backend validation:
   - Try Redis first (self-hosted)
   - Fallback to Cloudflare KV (Workers)
   - Auto-sync KV to Redis for future requests (if Redis available)
5. Return authenticated context: `{ userId, email, authType, apiKeyId }`

### Multi-Tenant Isolation

Medplum CDR enforces practice-level data separation via RBAC access policies. Each practice operates in an isolated data partition. API keys are scoped to individual users and organizations.

### Rate Limiting

- Default: 100 requests/hour per user (configurable)
- Backed by KV or Redis with 1-hour expiration windows
- Fail-open on errors (requests are allowed if the rate limiter is unavailable)
- Self-hosted: unlimited (no rate limits enforced)
- Admin endpoints: require separate `ADMIN_SECRET` header

---

## Encryption

| Layer | Standard | Details |
|-------|----------|---------|
| In transit | TLS 1.3 | All API communication encrypted |
| At rest | AES-256 | CDR data, session storage |
| Session data | Redis encryption | Token mappings encrypted in Redis (self-hosted) |
| Cloudflare KV | Platform encryption | Token mappings encrypted at rest in KV (cloud) |

Session data (PHI token mappings) has a 24-hour TTL by default, extendable to 7 days. After expiration, mappings are permanently deleted.

---

## Desktop Security

The Electron desktop app follows security best practices for process isolation and hardening.

### Process Isolation

- **Context Isolation:** Enabled. Renderer process cannot access Node.js APIs directly.
- **Sandboxed Renderer:** Runs in a browser context with limited permissions.
- **No nodeIntegration:** Renderer has no access to Node.js modules.
- **No Remote Modules:** All code runs locally; no remote code execution.

### Electron Fuses

Security fuses are compile-time flags that cannot be changed at runtime:

| Fuse | Setting | Purpose |
|------|---------|---------|
| RunAsNode | Disabled | Prevents using Electron as a Node.js runtime |
| EnableCookieEncryption | Enabled | Encrypts cookies at rest |
| EnableNodeOptionsEnvironmentVariable | Disabled | Prevents NODE_OPTIONS injection |
| EnableEmbeddedAsarIntegrityValidation | Enabled | Validates ASAR archive integrity |
| OnlyLoadAppFromAsar | Enabled | Prevents loading app code from filesystem |

### IPC Whitelisting

All communication between renderer and main process flows through typed, whitelisted IPC channels defined in the preload script. The renderer can only invoke operations that are explicitly exposed through the context bridge -- Docker management, configuration, API key operations, and system utilities. No arbitrary Node.js execution is possible from the renderer.

### Mobile Security

- **No PHI stored on device** — only session IDs and de-identified content cached in memory
- **Expo Push Notifications** — push payloads contain no PHI; only briefing IDs and notification metadata are transmitted through the Expo Push Service
- **Push token lifecycle** — tokens registered on enrollment (`POST /api/push-tokens`), deregistered on logout (`DELETE /api/push-tokens`)
- **Re-identification requires proxy connectivity** — PHI is restored live through the hospital-hosted proxy (WiFi/VPN required), never cached on device
- **Biometric gate** — Face ID / Touch ID required on every app launch
- **Encrypted credentials** — all API keys, JWT tokens, and session data stored in `expo-secure-store` (iOS Keychain, Android Keystore)

---

## Self-Hosted Deployment

The self-hosted model is the foundation of MedScrub's security story. PHI stays on customer infrastructure at all times.

### Deployment Options

| Platform | Method | Notes |
|----------|--------|-------|
| Docker | `docker-compose up -d` | Proxy + Redis, any Docker host |
| AWS | CloudFormation template | ECS/Fargate deployment |
| Azure | ARM template | Container Instances deployment |
| GCP | Deployment template | Cloud Run deployment |
| Kubernetes | Helm chart | Enterprise orchestration |
| Bare metal | Docker or Node.js | Air-gapped environments |

### Air-Gapped Support

For environments with no internet access:

- License keys validate offline (no platform callback required)
- De-identification runs entirely locally (regex + pattern matching layers)
- NER service (spaCy/Stanford) can be deployed as a co-located Docker container
- Analytics stored locally in Redis; optional batch sync when connectivity is available

### No Cloud Dependency

Core de-identification requires no external services. The proxy runs with Redis as its only infrastructure dependency. In air-gapped mode, even Redis can be replaced with in-memory storage (reduced durability, suitable for single-instance deployments).

---

## Regulatory Landscape

### HIPAA Safe Harbor / Expert Determination

MedScrub implements the Safe Harbor method (all 18 identifiers). The proxy provides statistical risk analysis endpoints that could support a future Expert Determination certification, but formal certification is not currently being pursued. See the [HIPAA Compliance](#hipaa-compliance) section above for details.

### California AB 3030 -- AI Disclosure in Patient Communications

**Effective:** January 1, 2025

**Requirement:** Disclosure when generative AI is used in clinical communications with patients.

**MedScrub implementation:**

- AI disclosure toggle is ON by default in the patient messaging workflow
- Disclosure text is appended programmatically after re-identification via `postProcess: "appendDisclosure"` in skill JSON -- not by the LLM, ensuring 100% compliance regardless of model behavior
- Default text: "This message was drafted with AI assistance and reviewed by your physician before sending."
- Text is configurable in settings (for physicians in states without disclosure requirements)
- Audit trail: every generated message logs whether disclosure was included

### Colorado SB 24-205 -- AI Transparency

**Requirement:** Transparency in high-risk AI-driven decisions, including healthcare.

**MedScrub approach:** The human-in-the-middle architecture satisfies transparency requirements -- AI assists, physician decides. All AI-generated outputs are explicitly labeled and require physician review before reaching patients or the EHR.

### Utah AI Policy Act

**Requirement:** Disclosure requirements for automated decisions in healthcare.

**MedScrub approach:** Same architectural safeguards as AB 3030 -- configurable disclosure, audit trail, human review mandatory.

### ONC HTI-2 Rule -- Federal AI Transparency Standards

**Status:** Finalized 2025

**Requirement:** Federal transparency standards for AI used in clinical decision-making.

**MedScrub approach:** All AI outputs in MedScrub are labeled as AI-generated. The physician reviews and approves every output before it enters the EHR. The skill-based architecture maintains provenance -- each output traces back to the skill definition, input data, and model used.

### CMS-0057-F -- Electronic Prior Authorization APIs

**Effective:** January 1, 2026

**Requirement:** Payers must expose prior authorization requirements via FHIR APIs. Payers must report PA metrics (volume, approvals, decision times).

**MedScrub approach:** Implementing Da Vinci Implementation Guides for end-to-end electronic prior authorization:

| Implementation Guide | Purpose |
|---------------------|---------|
| CRD (Coverage Requirements Discovery) | Does this procedure/medication need prior auth? |
| DTR (Documentation Templates and Rules) | What clinical evidence does the payer require? |
| PAS (Prior Authorization Support) | Submit the prior auth request via FHIR |

MedScrub uses CDR data to auto-assemble clinical justification from the patient's diagnosis history, failed treatments, lab trends, and imaging results. The PHI proxy ensures safe communication with payer APIs.

### MIPS Penalties

**Impact in 2026:** Up to 9% of Medicare reimbursement at risk.

Nearly half of solo practices were penalized by MIPS in 2025. MedScrub's care gap detection and quality measure tracking (MIPS/HEDIS) through the CDR enables passive compliance monitoring. Flipping a MIPS penalty to a bonus represents an 18%+ swing on Medicare revenue.

---

## BAA & Audit

### Business Associate Agreements

BAAs are available for cloud-hosted deployments where MedScrub processes PHI on behalf of the covered entity. Self-hosted deployments do not require a BAA with MedScrub because PHI never leaves customer infrastructure.

### Audit Trail

Every PHI access is logged with:

- **User:** authenticated user ID and email
- **Timestamp:** ISO 8601
- **Resource:** FHIR resource type and operation
- **Endpoint:** API endpoint invoked
- **Response time:** milliseconds
- **Tokens processed:** number of PHI elements detected
- **Success/failure:** including error messages on failure
- **API key ID:** for per-key attribution

Analytics data is aggregated hourly and daily, stored in Redis (self-hosted) or Cloudflare KV (cloud), with a 90-day retention window. Optional sync to the platform dashboard provides centralized visibility.

### Compliance Analytics

The platform dashboard displays usage analytics for compliance reporting:

- Request volume by user, endpoint, and time period
- De-identification accuracy metrics
- Session lifecycle tracking
- AB 3030 disclosure inclusion rates (for patient messaging)

---

## Human in the Middle

This is a core design principle, not a feature toggle. AI assists, physician decides. Every output is reviewed before it touches the EHR. This is not optional -- it is architectural.

The pipeline enforces this:

1. AI generates output (SOAP note, prior auth letter, patient message, etc.)
2. Output is displayed to the physician for review and editing
3. Physician approves before the output is saved to the CDR or written back to the EHR
4. No automated write-back path exists -- there is no code path that bypasses physician review

This satisfies regulatory requirements for human oversight of AI in clinical decision-making (ONC HTI-2, state AI transparency laws) and aligns with the practical reality that AI-generated clinical content requires physician judgment before it becomes part of the medical record.

