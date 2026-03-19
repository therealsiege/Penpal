# Medplum CDR

Created: March 1, 2026 7:13 PM
Category: Medplum
Status: Reviewed
employment: No

<aside>
📋 Comprehensive reference for Medplum CDR integrations, capabilities, and how MedScrub leverages them. Last updated: Feb 17, 2026.

</aside>

## Docs

---

[Document Signatures & Digital Consent with Medplum](Medplum%20CDR/Document%20Signatures%20&%20Digital%20Consent%20with%20Medplum%20317f3cf2487f8154b23df7da1cf6ec10.md)

[IAL2 Identity Verification with Medplum (Flexpa Model)](Medplum%20CDR/IAL2%20Identity%20Verification%20with%20Medplum%20(Flexpa%20Mo%20317f3cf2487f81e1bbc6cb54fd5343e2.md)

## What is Medplum?

Medplum is an open-source, self-hostable FHIR R4 Clinical Data Repository (CDR) with a built-in integration engine. It serves as MedScrub's central data layer — all patient data from Epic, athenahealth, and other EHRs flows through the PHI proxy into Medplum, where it's stored as standard FHIR resources and made available to the AI workspace.

Key differentiator: Medplum is not just a database. It includes Bots (serverless functions), Subscriptions (event-driven triggers), an on-premise Agent (HL7/DICOM bridge), SMART App Launch support, and Bulk FHIR — all out of the box.

---

## First-Party Integrations (Built-In)

### 🏥 Clinical Systems (EHR, HIE, Labs)

- **Epic Systems** — Read/Write via FHIR API, JWT backend auth. We use this for bulk sync + SMART Launch.
- **Health Gorilla** — HIE integration for aggregated patient records + ADT data. Also provides Labcorp and Quest lab ordering.
- **Zus Health** — HIE with analytics, longitudinal care views, and clinical data enrichment.
- **Labcorp / Quest** — Lab orders and results via Health Gorilla integration.

### 🔐 Authentication & Identity

- **Okta** — SSO for providers
- **Auth0** — SSO for providers and patients
- **Google Auth** — SSO for providers and patients
- **Microsoft Entra (Azure AD)** — Enterprise SSO
- **OAuth2 (any provider)** — Plug in any OAuth2 identity provider
- **reCAPTCHA** — Patient registration security

### 💳 Billing & Payments

- **Candid Health** — Revenue cycle management and insurance eligibility checks

### 📡 Observability & Data

- **Datadog** — Application monitoring via sidecar
- **Snowflake** — Data warehouse sync (coming soon)
- **OpenAI** — LLM integration for clinical AI features

### 📠 Communications

- **eFax** — Send/receive faxes as FHIR Communication resources

---

## Protocol-Level Integrations

### 🔄 Medplum Agent (On-Premise Bridge)

The Medplum Agent runs inside your firewall and bridges legacy protocols to the cloud CDR over secure HTTPS WebSockets. Critical for connecting to hospital systems that speak HL7v2 or DICOM.

- **HL7v2 / MLLP** — ADT feeds, ORU results, ORM orders. Agent listens on configurable MLLP ports and routes messages to Bots for transformation.
- **DICOM** — Medical imaging. Agent receives DICOM files from modalities and routes to cloud storage.
- **ASTM** — Lab instrument protocol for point-of-care devices.

### 🔗 FHIR Standards

- **FHIR R4 API** — Full REST API with search, operations, bundles, and batch processing.
- **SMART App Launch 2.0** — Launch apps within EHR context with patient/encounter scope. Medplum acts as both SMART server and client.
- **Bulk FHIR** — Group/$export for large-scale data extraction. Supports NDJSON output, async polling, _type and _typeFilter params.
- **FHIRcast** — Event-driven workflow sync for radiology workstations.
- **FHIR CMS 9115** — Provider directory for payer compliance.
- **SFTP** — File-based data sync via Bot file upload support.

---

## Automation Engine

### 🤖 Bots (Serverless Functions)

Bots are TypeScript/JavaScript functions that execute on triggers. They are the core of Medplum's integration engine — every data transformation, webhook handler, and automated workflow runs as a Bot.

- **Trigger types:** FHIR Subscriptions (resource create/update), Cron schedules, Webhook endpoints, Custom FHIR Operations, QuestionnaireResponse submissions
- **Runtime options:** Medplum cloud (VM context), AWS Lambda, Fission (Kubernetes)
- **Built-in capabilities:** HL7v2 parsing/generation, PDF creation, file uploads (S3/SFTP), HTTP requests, Medplum SDK access, bot secrets management
- **Security:** Run-as-user context, access policy scoping, encrypted secrets store

### 📡 Subscriptions (Event-Driven)

FHIR Subscriptions trigger actions when resources are created or updated. Think of them as webhooks with FHIR-native filtering.

- Criteria-based filtering (e.g., "Patient?active=true" only triggers on active patients)
- Channels: REST webhook, WebSocket (real-time UI updates), Bot invocation
- AuditEvent trail for debugging subscription fires
- $resend operation for manual retrigger

---

## Custom Integration Templates

Medplum provides Bot templates and examples for common custom integrations:

- **Stripe** — Payment sync via Bot webhooks
- **Acuity / Cal.com** — Third-party scheduling via webhook consumption
- **CMS 1500 / Superbill** — PDF generation for billing documents
- **Medication APIs** — Prescribing and drug interaction checks

---

## Self-Hosting & Infrastructure

- **Docker Compose** — Local dev stack (Postgres + Redis + Medplum server). This is what MedScrub Desktop uses at localhost:8103.
- **AWS (CDK)** — Production deployment via ECS Fargate, RDS, ElastiCache, S3, CloudFront.
- **Medplum Cloud** — Managed hosting (SOC2, HIPAA BAA available).
- **Access Policies** — Fine-grained resource-level access control. Define which resources/fields each user or bot can read/write.
- **Projects** — Multi-tenant isolation. Each project has its own users, resources, bots, and access policies.

---

## How MedScrub Uses Medplum

MedScrub's architecture leverages Medplum as the data gravity layer in the stack:

1. **PHI Proxy → Medplum CDR:** Patient data from Epic/athena flows through the proxy (de-identification, audit logging) and lands in Medplum as FHIR R4 resources.
2. **Bulk Sync (Epic):** BulkExportClient uses Group/$export on production; Encounter/MRN discovery on Vendor Services sandbox. Resources are ID-mapped (Epic → UUID v5) and imported via batch bundles.
3. **AI Workspace:** Desktop app queries Medplum FHIR API to populate the workspace — patient summaries, encounters, conditions, observations. AI generates SOAP notes and prior auth docs from this data.
4. **SMART Launch:** MedScrub launches within Epic as a SMART on FHIR app, receiving patient context. Medplum acts as the SMART server for MedScrub's own launch flows.
5. **Local CDR (Docker):** MedScrub Desktop runs Medplum locally via Docker Compose — patient data never leaves the physician's machine.

---

## Key URLs & Resources

- **Medplum Docs:** [medplum.com/docs](https://www.medplum.com/docs)
- **Medplum GitHub:** [github.com/medplum/medplum](https://github.com/medplum/medplum)
- **Demo Bots Repo:** [github.com/medplum/medplum-demo-bots](https://github.com/medplum/medplum-demo-bots)
- **Medplum Discord:** [discord.gg/medplum](https://discord.gg/medplum)
- **FHIR R4 Spec:** [hl7.org/fhir/R4](https://hl7.org/fhir/R4)
- **Local CDR:** http://localhost:8103 (MedScrub Desktop Docker stack)