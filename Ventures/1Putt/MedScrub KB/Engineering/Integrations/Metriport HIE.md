Created: February 20, 2026 8:00 PM
Tags: Research

## 🔗 HIE Data Integration via Metriport API

Research into adding Health Information Exchange (HIE) data to MedScrub CDR using Metriport as the aggregation layer. This would provide physicians with complete patient medical history across all health systems.

### ✅ TPO Treatment Flow Confirmed

Metriport **DOES support TPO treatment flow**. Their docs explicitly state: "Access requires requests on behalf of a covered entity with NPI number for valid Treatment purpose of use."

- Provider authentication via NPI registration
- Opt-out model (patients included by default for treatment)
- No explicit patient consent required for treatment access
- Connects to CommonWell + Carequality (largest HIE networks)

### 🏗️ Integration Architecture

1. Provider onboards with Metriport (NPI + practice details)
2. HIE queries executed by patient demographics (name, DOB, address)
3. Consolidated FHIR bundles returned from multiple HIE networks
4. Data syncs into local Medplum CDR alongside Epic/athenahealth data
5. MedScrub PHI proxy processes complete patient history for AI

### 🚀 Competitive Value Proposition

No physician AI competitor has this combination:

- Prior auth letters with **complete medical history** across all health systems
- SOAP notes that reference outside specialists, previous hospitalizations
- Care gap analysis with data from multiple EHRs
- Pre-visit summaries with comprehensive patient background

### 🔧 Implementation Details

Metriport provides a REST API with straightforward integration:

- Create Facility (practice location) and Patient records
- Network Query API to search HIE by demographics
- Consolidated Data API returns FHIR R4 bundles
- Webhook support for real-time data availability notifications

### 🎯 Desktop App Integration

Add HIE search to the MedScrub desktop app:

- One-time provider authentication with Metriport
- "Search HIE" button in patient view for external data discovery
- Background sync job to pull HIE data into local CDR
- Patient opt-out management via settings

### 📊 Research Sources

Documentation reviewed from `docs.metriport.com` on 2026-02-20:

- Quickstart guide & API reference
- HIE opt-out documentation and API endpoints
- Treatment purpose access requirements

Files stored in `.firecrawl/metriport-research/`

**METRIPORT DOCUMENTATION KNOWLEDGEBASE**

*Scraped from docs.metriport.com on 2026-02-20 via Firecrawl. Full source files in .firecrawl/metriport-research/*

**1. PLATFORM OVERVIEW**

Metriport is an open-source, universal API for healthcare data. Their Medical API helps digital health companies access and manage patient health and medical data through integrations with Health Information Exchanges (HIEs), pharmacies, and laboratories via CommonWell and Carequality networks.

- Open-source and FHIR-native — all data standardized to HL7 FHIR R4
- Connects to CommonWell + Carequality (largest US HIE networks)
- Automatic C-CDA to FHIR conversion, deduplication, standardization, and code enrichment
- REST API + Node.js SDK (@metriport/api-sdk)
- Dashboard UI for manual operations alongside API access
- Webhook-driven architecture for async data delivery
- AI Summaries feature — premium, generates cohesive patient medical history paragraphs
- Converter API available for standalone C-CDA ↔ FHIR conversion

**2. QUICKSTART — INTEGRATION STEPS**

*Source: [docs.metriport.com/medical-api/getting-started/quickstart](https://docs.metriport.com/medical-api/getting-started/quickstart)*

- **Step 1:** Create developer account at dash.metriport.com
- **Step 2:** Generate API key (displayed once, save securely). Toggle Sandbox mode for testing.
- **Step 3:** Integrate via Webhook (recommended — Metriport pushes data to your endpoint) or Polling (your app requests data).
- **Step 4:** Create Facilities (practice locations with NPI; sandbox NPI: 1234567893) and Patients (auto-links to HIE sources based on demographics).
- **Step 5:** Start Network Query — async query across HIEs, pharmacies, labs. Webhook events: network-query.hie, network-query.pharmacy, network-query.lab.
- **Step 6:** Get Consolidated Data — deduplicated, standardized FHIR bundles. Cached result of most recent Network Query. ~95% of patients will have data.
- **Step 7:** Contribute Data — required for reciprocal data exchange. Upload FHIR data or binary documents.
- **Step 8:** Request production API access — requires covered entity with NPI for valid Treatment purpose of use. Book intro call via Products & Billing.

**3. API REFERENCE — KEY ENDPOINTS**

**Base URLs:** Sandbox: api.sandbox.metriport.com | Production: api.metriport.com

**Auth:** x-api-key header

**SDK:** `import { MetriportMedicalApi } from "@metriport/api-sdk"`

**Facility Endpoints**

- `POST /medical/v1/facility` — Create Facility. Body: name (string), npi (string, required), address (addressLine1, city, state, zip, country), tin (optional), active (boolean).
- `GET /medical/v1/facility` — List all facilities
- `GET /medical/v1/facility/:id` — Get facility by ID
- `DELETE /medical/v1/facility/:id` — Delete facility

**Patient Endpoints**

- `POST /medical/v1/patient` — Create Patient. Body: firstName, lastName, dob (YYYY-MM-DD), genderAtBirth (M/F), address[] (required), personalIdentifiers[] (optional, e.g. driversLicense), contact[], externalId, cohorts[]. Auto-links to HIE on creation.
- `PUT /medical/v1/patient/:id/hie-opt-out?hieOptOut=true|false` — Opt patient in/out of HIE data sharing. Returns { id, hieOptOut, message }.
- `POST /medical/v1/patient/:id/sync` — Sync patient with external EHR system

**Network & Data Endpoints**

- `POST /medical/v1/patient/:id/network-query` — Start Network Query. Async. Queries HIEs, pharmacies, labs. Sends webhook events when data from each source is ready.
- `GET /medical/v1/patient/:id/network-query` — Get Network Query Status (polling alternative to webhooks)
- `POST /medical/v1/patient/:id/consolidated-query` — Start Consolidated Data Query. Returns cached, deduplicated FHIR bundles. conversionType: json (FHIR Bundle), html, or pdf (Medical Record Summary).
- `GET /medical/v1/patient/:id/medical-record-summary` — Get formatted medical record summary (HTML/PDF with optional AI brief at top)
- `GET /medical/v1/patient/:id/document` — List documents. POST /document/download-url-bulk for bulk raw document download.
- `POST /medical/v1/patient/:id/consolidated` — Create/contribute patient FHIR data back to networks.

**4. FHIR DATA STANDARD**

*Source: [docs.metriport.com/medical-api/fhir/overview](https://docs.metriport.com/medical-api/fhir/overview)*

Metriport uses HL7 FHIR R4 as its data standard. After a Network Query, C-CDA documents (XML) are automatically converted to FHIR Resources (JSON), deduplicated, standardized, and enriched with medical code lookups/crosswalks.

**Key FHIR Resources returned:**

- **Encounter** — patient-provider interactions
- **MedicationRequest** — medication orders and instructions
- **Observation** — vitals, lab results (weight, BP, BMI, etc.)
- **Condition** — diagnoses with Chronicity Extension (chronic vs acute)
- **DiagnosticReport, Procedure, AllergyIntolerance, Coverage, DocumentReference** — plus all standard FHIR R4 resources

Coding systems: ICD-10-CM, SNOMED, LOINC, and CCSR enrichment. meta.source points to original C-CDA source document.

**5. WEBHOOKS & REAL-TIME NOTIFICATIONS**

*Source: [docs.metriport.com/medical-api/handling-data/realtime-patient-notifications](https://docs.metriport.com/medical-api/handling-data/realtime-patient-notifications)*

Metriport sends real-time webhook notifications for patient events. Each payload includes a meta object (messageId, requestId, timestamp, type) and a payload with a presigned URL to a Patient Encounter Bundle (valid 10 min).

**Webhook event types:**

- `patient.admit` — patient admitted to health system
- `patient.discharge` — patient discharged (includes diagnosis data)
- `network-query.hie`, `network-query.pharmacy`, `network-query.lab` — data source ready events from Network Query

Encounter data includes FHIR resources: status (arrived/triaged/in-progress/finished), period, reasonCode, location, serviceProvider, diagnosis, and participant (practitioners).

**6. AI SUMMARIES (Premium Feature)**

*Source: [docs.metriport.com/medical-api/handling-data/ai-summaries](https://docs.metriport.com/medical-api/handling-data/ai-summaries)*

Summarizes lengthy patient records into one cohesive paragraph of the most relevant medical history. Premium feature — requires contacting Metriport for access.

- **FHIR Bundle access:** Trigger Consolidated Data Query with conversionType=json. AI brief returned as Binary resource with meta.source="metriport:ai-generated-brief". Data is Base64-encoded.
- **Medical Record Summary:** With conversionType=html or pdf, AI brief appears at top of the Medical Record Summary document.
- **Dashboard:** Viewable at top of patient medical record history.
- **MedScrub note:** This overlaps with our own AI summarization via PHI proxy. Could be used as a baseline/comparison or skipped in favor of our own pipeline.

**7. HIE OPT-OUT MANAGEMENT**

*Source: [docs.metriport.com/medical-api/handling-data/opt-out](https://docs.metriport.com/medical-api/handling-data/opt-out)*

Patients can be opted out of HIE network queries and data sharing. Opt-out stops new data exchanges until the patient opts back in.

- **Dashboard:** Patients → Click patient → Actions menu (⋯) → "Opt Out of Networks" / "Opt In to Networks"
- **API:** `PUT /medical/v1/patient/:id/hie-opt-out?hieOptOut=true` (or false to opt back in)
- **SDK:** `await metriport.updatePatientHieOptOut(patientId, true)`

**8. EHR APP INTEGRATIONS**

*Source: [docs.metriport.com/ehr-apps/overview](https://docs.metriport.com/ehr-apps/overview)*

Metriport provides embedded EHR apps for seamless workflow integration. Each app enables patient medical record summaries, automated patient sync, and document query/retrieval.

**Supported EHRs:**

- **athenahealth** — embedded app with auto-sync, patient matching, document queries
- **Epic** — embedded app integration
- **Canvas, Elation, Healthie, Salesforce, Practice Fusion** — additional supported EHRs. More being added regularly.

**9. USER ROLES & PERMISSIONS**

*Source: [docs.metriport.com/medical-api/more-info/user-roles](https://docs.metriport.com/medical-api/more-info/user-roles)*

- **Owner** — full access: users, billing, clinical data, developer features
- **Admin** — same as Owner
- **Clinical** — clinical data access only
- **Billing** — billing/subscription access only
- **Developer** — clinical data + developer features (API keys, webhooks, etc.)

SAML/Enterprise SSO also supported.

**10. MEDSCRUB INTEGRATION MAPPING**

How Metriport maps to MedScrub's architecture:

- **Metriport Facility = MedScrub practice location** — Create one Facility per physician practice during onboarding. Requires NPI.
- **Metriport Patient = MedScrub patient from EHR** — Create patient in Metriport using demographics from Epic/athenahealth FHIR. Auto-links to HIE sources.
- **Network Query = 'Search HIE' button** — Triggers async query. Webhook notifies when data ready. Pull FHIR bundles into local Medplum CDR.
- **Consolidated Data = enriched patient context for AI** — Feeds into PHI proxy alongside Epic/athena data for SOAP notes, prior auth, chart summaries.
- **Data Contribution = writing SOAP notes back** — MedScrub-generated notes can be contributed back to HIE networks via Metriport's consolidated data endpoint.
- **Webhooks = background sync trigger** — MedScrub proxy exposes webhook endpoint. Metriport pushes data availability. Proxy fetches and stores in Medplum CDR.
- **Opt-out = patient settings in desktop app** — Surface in patient view. Call Metriport HIE opt-out API when patient requests.

**11. DOCUMENTATION LINKS**

- **Homepage:** [metriport.com](https://www.metriport.com/)
- **Medical API Docs:** [docs.metriport.com/medical-api](https://docs.metriport.com/medical-api/getting-started/quickstart)
- **Dashboard:** [dash.metriport.com](https://dash.metriport.com/)
- **EHR Apps:** [docs.metriport.com/ehr-apps](https://docs.metriport.com/ehr-apps/overview)
- **Converter API:** [docs.metriport.com/converter-api](https://docs.metriport.com/converter-api/getting-started/quickstart)
- **NPM SDK:** `@metriport/api-sdk`
- **GitHub:** [github.com/metriport (open-source)](https://github.com/metriport)

**Local scraped files:** `.firecrawl/metriport-research/` (18 files, 4,597 lines total — quickstart.md, fhir-overview.md, webhooks.md, ai-summaries.md, opt-out.md, api-create-facility.md, api-create-patient.md, api-hie-opt-out.md, api-list-documents.md, api-medical-record-summary.md, api-network-entries.md, converter-api.md, ehr-apps-overview.md, ehr-athena.md, ehr-epic.md, homepage.md, medical-api-landing.md, user-roles.md)