> Open-source (Apache 2.0) FHIR R4 Clinical Data Repository with built-in integration engine. Stack: TypeScript, Node.js, PostgreSQL.

**See also:** [Self-Hosting](Self-Hosting%20on%20AWS.md) | [Access Control](Access%20Control%20&%20Multi-Tenancy.md) | [Developer Experience](Developer%20Experience.md) | [Identity & Consent](Identity%20&%20Consent.md)

## What Is Medplum?

Not just a database — includes Bots (serverless functions), Subscriptions (event-driven triggers), on-premise Agent (HL7/DICOM bridge), SMART App Launch, and Bulk FHIR out of the box.

**Trusted by:** Ro, Summer Health, CDC, Thirty Madison, and other healthcare leaders.

## Core Capabilities

| Capability | Details |
|-----------|---------|
| FHIR Datastore | Full FHIR R4 resource server — search, history, versioning |
| Custom EHR | React component library (`@medplum/react`) for clinical interfaces |
| Bots | TypeScript serverless functions — event-driven automation |
| Subscriptions | FHIR-native event system for resource change notifications |
| Scheduling | FHIR Schedule/Slot resources for appointment management |
| Medications | MedicationRequest, MedicationDispense, e-prescribing |
| Care Plans | CarePlan, Goal, Task resources for care coordination |
| Access Control | Fine-grained RBAC via FHIR AccessPolicy resources |
| Multi-tenancy | Project-based isolation — each project has own users, resources, bots |

## Compliance Certifications

| Certification | Details |
|--------------|---------|
| HIPAA | BAA available, encryption at rest and in transit |
| SOC 2 Type II | Audited security controls |
| ONC HTI-4 | Health IT certification |
| EPCS | Electronic Prescribing for Controlled Substances |
| ISO 9001 | Quality management systems |
| 21 CFR Part 11 | Electronic records and signatures |

## First-Party Integrations

### Clinical Systems (EHR, HIE, Labs)

| Integration | Details |
|------------|---------|
| Epic Systems | Read/Write via FHIR API, JWT backend auth, bulk sync + SMART Launch |
| Health Gorilla | HIE integration — aggregated records, ADT, Labcorp/Quest ordering |
| Zus Health | HIE with analytics, longitudinal care views, data enrichment |
| Labcorp / Quest | Via Health Gorilla |

### Authentication & Identity

| Provider | Use Case |
|----------|----------|
| Okta | SSO for providers |
| Auth0 | SSO for providers and patients |
| Google Auth | SSO for providers and patients |
| Microsoft Entra | Enterprise SSO |
| OAuth2 (any) | Plug in any OAuth2 identity provider |
| reCAPTCHA | Patient registration security |

### Billing & Payments

| Integration | Details |
|------------|---------|
| Candid Health | Revenue cycle management, insurance eligibility |

### Observability & Data

| Integration | Details |
|------------|---------|
| Datadog | Application monitoring via sidecar |
| Snowflake | Data warehouse sync (coming soon) |
| OpenAI | LLM integration for clinical AI features |

### Communications

| Integration | Details |
|------------|---------|
| eFax | Send/receive faxes as FHIR Communication resources |

## Protocol-Level Integrations

### Medplum Agent (On-Premise Bridge)

Runs inside your firewall, bridges legacy protocols to cloud CDR over secure HTTPS WebSockets.

| Protocol | Details |
|----------|---------|
| HL7v2 / MLLP | ADT feeds, ORU results, ORM orders — routes to Bots for transformation |
| DICOM | Medical imaging — receives from modalities, routes to cloud storage |
| ASTM | Lab instrument protocol for point-of-care devices |

### FHIR Standards

| Standard | Details |
|----------|---------|
| FHIR R4 API | Full REST API — search, operations, bundles, batch |
| SMART App Launch 2.0 | Launch apps within EHR context, patient/encounter scope |
| Bulk FHIR | Group/$export, NDJSON, async polling |
| FHIRcast | Event-driven workflow sync for radiology |
| FHIR CMS 9115 | Provider directory for payer compliance |
| SFTP | File-based data sync via Bot uploads |

## Automation Engine

### Bots (Serverless Functions)

TypeScript/JavaScript functions that execute on triggers. Core of the integration engine.

**Triggers:** FHIR Subscriptions, Cron schedules, Webhook endpoints, Custom FHIR Operations, QuestionnaireResponse submissions

**Runtimes:** Medplum cloud (VM), AWS Lambda, Fission (Kubernetes)

**Built-in:** HL7v2 parsing/generation, PDF creation, file uploads (S3/SFTP), HTTP requests, Medplum SDK, secrets management

**Security:** Run-as-user context, access policy scoping, encrypted secrets store

### Subscriptions (Event-Driven)

FHIR Subscriptions trigger actions on resource create/update.

- Criteria-based filtering (e.g., `Patient?active=true`)
- Channels: REST webhook, WebSocket (real-time UI), Bot invocation
- AuditEvent trail for debugging
- `$resend` operation for manual retrigger

### Custom Integration Templates

Bot templates for: Stripe payments, Acuity/Cal.com scheduling, CMS 1500/Superbill PDF generation, Medication APIs

## Proven Medplum Patterns (Prior Implementations)

1. **PHI Proxy → CDR:** Patient data from EHRs flows through a proxy layer into Medplum as FHIR R4 resources
2. **Bulk Sync:** BulkExportClient uses Group/$export, ID-mapped (EHR IDs → UUID v5), imported via batch bundles
3. **AI Workspace:** Client app queries FHIR API — patient summaries, encounters, conditions. AI generates SOAP notes + prior auth docs
4. **SMART App Launch:** Launch within EHRs (Epic, athena) as a SMART on FHIR app with patient/encounter context
5. **Local CDR (Docker):** Runs Medplum locally via Docker Compose — data never leaves the local machine
