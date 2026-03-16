> What exists in the repo, what to reuse, what to build. Based on `medplum/medplum` (cloned Mar 3, 2026).

**Repo path:** `/Users/clint.johnson/Workspace/Code/medplum`

**See also:** [Capability Mapping](Capability%20Mapping.md) | [Developer Experience](Developer%20Experience.md) | [Phases](Phases.md)

---

## Critical Discovery: Healthie Importer Exists

Medplum has a dedicated Healthie data import example:

```
examples/medplum-healthie-importer/
```

This is a bot-based tool for migrating data FROM Healthie into Medplum via SFTP. This should be the starting point for the ETL pipeline — not building from scratch.

---

## Feature Map by OpenLoop Need

### 1. E-Prescribe / EPCS

**Status: First-party packages + two integration paths ready**

| Asset | Path | What It Does |
|-------|------|-------------|
| `@medplum/dosespot-core` | `packages/dosespot-core/` | DoseSpot SDK — drug database, Rx writing, pharmacy routing |
| `@medplum/dosespot-react` | `packages/dosespot-react/` | React hooks — iframe embed, formulary, notifications |
| DoseSpot UI example | `examples/medplum-provider/src/pages/patient/DoseSpotTab.tsx` | Patient prescription interface |
| DoseSpot favorites | `examples/medplum-provider/src/pages/integrations/DoseSpotFavoritesPage.tsx` | Clinic formulary management |
| Photon integration | `examples/medplum-photon-integration/` | Full Photon Health integration |
| Photon Rx events | `examples/medplum-photon-integration/src/bots/handle-prescription-event.ts` | Prescription event handling |
| Photon formulary sync | `examples/medplum-photon-integration/src/bots/sync-formulary.ts` | Sync formulary to Photon |
| Photon patient sync | `examples/medplum-photon-integration/src/bots/sync-patient-from-photon.ts` | Patient data sync |
| DoseSpot docs | `packages/docs/docs/integration/dosespot/` | Getting started, enrollment, favorites |

**OpenLoop action:** DoseSpot packages are production-ready — can use as a bridge from day one since OpenLoop already uses DoseSpot. Photon example available for long-term target.

---

### 2. Billing & RCM (Candid Health)

**Status: Bot examples + server-side claim tooling ready**

| Asset | Path | What It Does |
|-------|------|-------------|
| Candid send bot | `examples/medplum-demo-bots/src/candid-health/send-to-candid.ts` | Submit Encounter → Candid API |
| Candid task sync | `examples/medplum-demo-bots/src/candid-health/sync-candid-tasks.ts` | Sync Candid tasks/exceptions back to Medplum |
| Candid docs | `packages/docs/docs/integration/candid-health.md` | Integration guide |
| CMS-1500 PDF | `packages/server/src/fhir/operations/utils/cms1500pdf.ts` | Server-side CMS-1500 generation |
| Claim export | `packages/server/src/fhir/operations/claimexport.ts` | Claim export operations |
| Claim utilities | `examples/medplum-provider/src/utils/claims.ts` | Claim helper functions |
| Superbill bot | `examples/medplum-demo-bots/src/billing-bots/superbill.ts` | Encounter → Superbill generation |
| Stripe bot | `examples/medplum-demo-bots/src/stripe-bots/stripe-create-invoice.ts` | Payment processing |
| Eligibility demo | `examples/medplum-eligibility-demo/` | Insurance eligibility workflow |

**OpenLoop action:** Candid Health bots are the starting point. CMS-1500 and superbill generation built into the server. Eligibility demo app can inform the patient-facing eligibility check UX.

---

### 3. Lab Orders & Results (Health Gorilla)

**Status: First-party packages + full demo app ready**

| Asset | Path | What It Does |
|-------|------|-------------|
| `@medplum/health-gorilla-core` | `packages/health-gorilla-core/` | Lab order bundle creation, ServiceRequest handling |
| `@medplum/health-gorilla-react` | `packages/health-gorilla-react/` | React hooks for lab ordering UI |
| Lab order logic | `packages/health-gorilla-core/src/lab-order.ts` | Transaction bundle creation for orders |
| Lab order hook | `packages/health-gorilla-react/src/useHealthGorillaLabOrder.ts` | React hook for ordering |
| Health Gorilla demo | `examples/medplum-health-gorilla-demo/` | Full lab ordering demo app |
| Lab order UI | `examples/medplum-provider/src/pages/labs/OrderLabsPage.tsx` | Provider lab ordering interface |
| HL7 lab integration | `examples/medplum-demo-bots/src/lab-integration/` | HL7 ORM/ORU message handling |
| Health Gorilla docs | `packages/docs/docs/integration/health-gorilla/` | Ordering, results, setup |

**Features included:** Multiple tests per order, Ask-on-Entry questions, specimen handling, insurance/billing options, ABN for Medicare, DiagnosticReport results.

**OpenLoop action:** Health Gorilla packages are production-ready. The provider example app already has the ordering UI. Lab integration bots handle HL7 results for legacy lab interfaces.

---

### 4. Video / Telehealth

**Status: Zoom and Twilio bot examples — no native video**

| Asset | Path | What It Does |
|-------|------|-------------|
| Zoom meeting bot | `examples/medplum-demo-bots/src/zoom-bots/zoom-create-meeting.ts` | Create Zoom meetings, store details in Appointment extensions |
| Twilio voice bot | `examples/medplum-demo-bots/src/twilio/voice-webhook.ts` | Twilio voice/IVR webhook handler |
| Bot layer (Twilio) | `packages/bot-layer/` | Pre-bundled Twilio SDK in Lambda layer |

**OpenLoop action:** Zoom bot is a reference for video provider integration pattern (Appointment → create meeting → store join URL in extension). Adapt for whatever video provider OpenLoop selects. Twilio bot useful for SMS appointment reminders.

---

### 5. Scheduling & Appointments

**Status: Server operations + React components ready**

| Asset | Path | What It Does |
|-------|------|-------------|
| $book operation | `packages/server/src/fhir/operations/book.ts` | Appointment booking operation |
| $find operation | `packages/server/src/fhir/operations/find.ts` | Find available slots |
| Scheduling utils | `packages/server/src/fhir/operations/utils/scheduling.ts` | Availability calculation |
| Scheduler component | `packages/react/src/Scheduler/Scheduler.tsx` | React scheduling UI |
| Calendar input | `packages/react/src/CalendarInput/CalendarInput.tsx` | Calendar picker |
| Appointment reminders | `examples/medplum-demo-bots/src/appointment-bots/send-appointment-reminders.ts` | Reminder notifications |
| Scheduling docs | `packages/docs/docs/scheduling/` | Availability, booking guides |

**OpenLoop action:** Scheduling is built into the server with $book and $find operations. React Scheduler component can be used in the provider app. Appointment reminder bot is ready to adapt.

---

### 6. Patient Intake & Forms

**Status: Full demo app + questionnaire bots ready**

| Asset | Path | What It Does |
|-------|------|-------------|
| Patient intake demo | `examples/medplum-patient-intake-demo/` | Complete intake workflow |
| Conditions questionnaire | `examples/medplum-demo-bots/src/questionnaire-bots/conditions-list/` | Conditions list form |
| Medications questionnaire | `examples/medplum-demo-bots/src/questionnaire-bots/medications-list/` | Medication list form |
| Questionnaire hooks | `examples/medplum-questionnaire-hooks/` | QuestionnaireResponse handling |

**OpenLoop action:** Patient intake demo is the reference for building intake flows. Map Healthie form schemas to FHIR Questionnaire resources.

---

### 7. Data Migration (Healthie → Medplum)

**Status: Dedicated Healthie importer exists**

| Asset | Path | What It Does |
|-------|------|-------------|
| Healthie importer | `examples/medplum-healthie-importer/` | Bot-based Healthie data import via SFTP |
| Patient deduplication | `examples/medplum-demo-bots/src/deduplication/` | Find + merge duplicate patients |
| C-CDA converter | `packages/ccda/` | C-CDA document parsing |

**OpenLoop action:** Start with the Healthie importer example. Add patient deduplication as a post-migration cleanup step.

---

### 8. Messaging & Communication

**Status: Multiple chat demos + notification bots**

| Asset | Path | What It Does |
|-------|------|-------------|
| Chat demo | `examples/medplum-chat-demo/` | Real-time chat |
| Live chat demo | `examples/medplum-live-chat-demo/` | Customer support chat |
| Auto-responder bot | `examples/medplum-demo-bots/src/auto-responder-bots/` | Automated message responses |
| Slack bot | `examples/medplum-demo-bots/src/slack-bots/` | Slack notifications |
| eFax demo | `examples/medplum-efax-demo/` | Fax send/receive |

**OpenLoop action:** Chat demos replace Healthie's messaging. eFax demo useful for pharmacy/lab faxing.

---

### 9. Multi-Tenant / White-Label

**Status: MSO demo exists**

| Asset | Path | What It Does |
|-------|------|-------------|
| MSO demo | `examples/medplum-mso-demo/` | Managed Service Organization — multi-tenant operations |

**OpenLoop action:** MSO demo is directly relevant to OpenLoop's white-label B2B2C model. Study this for Project-per-client architecture patterns.

---

### 10. Infrastructure & Deployment

**Status: AWS CDK production-ready, multi-cloud options**

| Asset | Path | What It Does |
|-------|------|-------------|
| AWS CDK | `packages/cdk/` | ECS Fargate, Aurora, Redis, CloudFront, WAF, CloudTrail |
| WAF config | `packages/cdk/src/waf.ts` | Web Application Firewall rules |
| CloudTrail | `packages/cdk/src/cloudtrail.ts` | Audit logging for compliance |
| Docker Compose | `docker-compose.yml` | Local dev stack |
| Full stack Docker | `docker-compose.full-stack.yml` | Production-like local stack |
| Helm charts | `charts/` | Kubernetes deployment |
| Azure Terraform | `terraform/azure/` | Azure deployment (17 modules) |
| GCP Terraform | `terraform/gcp/` | GCP deployment (18 modules) |

**OpenLoop action:** AWS CDK is the deployment target. WAF and CloudTrail already included for compliance.

---

### 11. SMART on FHIR

**Status: Server-side implementation complete**

| Asset | Path | What It Does |
|-------|------|-------------|
| SMART scope handling | `packages/server/src/fhir/smart.ts` | Scope parsing, access policy intersection |
| OAuth authorize | `packages/server/src/oauth/authorize.ts` | Authorization endpoint |
| OAuth token | `packages/server/src/oauth/token.ts` | Token endpoint |
| External auth | `packages/server/src/oauth/external.ts` | External identity providers |
| External IdP demo | `examples/medplum-client-external-idp-demo/` | SSO integration example |
| SMART docs | `packages/docs/docs/integration/smart-app-launch.md` | SMART App Launch guide |

**OpenLoop action:** SMART on FHIR is built into the server. Use for health system integrations (Phase 3).

---

### 12. Utilities & Cross-Cutting

| Asset | Path | What It Does |
|-------|------|-------------|
| PDF generation | `examples/medplum-demo-bots/src/create-pdf.ts` | Bot-based PDF creation |
| SFTP upload | `examples/medplum-demo-bots/src/sftp-upload.ts` | Secure file transfer |
| HTTP proxy | `examples/medplum-demo-bots/src/http-proxy.ts` | HTTP request proxying |
| AWS Textract | `examples/medplum-demo-bots/src/textract-bot.ts` | Document OCR |
| HL7 v2 package | `packages/hl7/` | HL7 message parsing/generation |
| C-CDA package | `packages/ccda/` | Clinical document exchange |
| Bot layer | `packages/bot-layer/` | Pre-bundled Lambda deps (Twilio, SSH2, PDFMake, SFTP) |
| Mock client | `packages/mock/` | Testing without a server |
| GraphiQL | `packages/graphiql/` | GraphQL IDE for API exploration |

---

## Build vs. Reuse Summary

| Need | Status | Action |
|------|--------|--------|
| Healthie data import | **EXISTS** | Adapt `medplum-healthie-importer` |
| E-prescribe (DoseSpot) | **EXISTS** (first-party package) | Use `@medplum/dosespot-core` + `dosespot-react` |
| E-prescribe (Photon) | **EXISTS** (example) | Adapt `medplum-photon-integration` |
| Billing / RCM (Candid) | **EXISTS** (bot example) | Adapt `candid-health/` bots |
| CMS-1500 PDF | **EXISTS** (server built-in) | Use directly |
| Insurance eligibility | **EXISTS** (demo app) | Adapt `medplum-eligibility-demo` |
| Lab orders (Health Gorilla) | **EXISTS** (first-party package) | Use `@medplum/health-gorilla-core` + `react` |
| Scheduling | **EXISTS** (server operations) | Use $book, $find, Scheduler component |
| Patient intake forms | **EXISTS** (demo app) | Adapt `medplum-patient-intake-demo` |
| Chat/messaging | **EXISTS** (demo apps) | Adapt `medplum-chat-demo` |
| Multi-tenant (white-label) | **EXISTS** (MSO demo) | Study `medplum-mso-demo` for patterns |
| Video/telehealth | **PARTIAL** (Zoom bot example) | Build — adapt Zoom bot pattern for chosen provider |
| SMART on FHIR | **EXISTS** (server built-in) | Use directly |
| AWS CDK deployment | **EXISTS** (CDK package) | Use `packages/cdk/` |
| Abstraction layer API | **BUILD** | Custom — OpenLoop-specific |
| EventBridge bridge | **BUILD** | Custom — Subscription → EventBridge bot |
| Provider network management | **BUILD** | Custom — 20K+ clinician network logic |
| Client onboarding automation | **BUILD** | Custom — Project creation, AccessPolicy setup |
| Appointment reminders (SMS) | **EXISTS** (bot example) | Adapt appointment-bots + Twilio |
| Patient deduplication | **EXISTS** (bot example) | Adapt deduplication bots |
| Fax integration | **EXISTS** (demo app) | Adapt `medplum-efax-demo` |

**Bottom line:** 17 of 21 identified needs have existing code to start from. Only 4 require greenfield development — and those are the OpenLoop-specific business logic (abstraction layer, EventBridge bridge, provider network, client onboarding).
