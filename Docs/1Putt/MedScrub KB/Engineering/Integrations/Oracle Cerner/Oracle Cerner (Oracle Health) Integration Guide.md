Created: February 21, 2026 9:09 PM
Tags: Research

# Overview

Oracle completed its Cerner acquisition in June 2022 (~$28.3B). Build on Millennium FHIR R4 — the mature, production API surface all existing sites expose.

- **FHIR R4 (4.0.1)** · JSON only · US Core compliant · SMART on FHIR auth (v1+v2)
- **Base URL:** `https://fhir-ehr.cerner.com/r4/{tenant-uuid}/{Resource}`
- Oracle Health Cloud APIs (next-gen) are NOT ready. Stick with Millennium FHIR R4 for 2026-2027+.

---

# API Surface

- **Patient** — Full CRUD (PATCH). Rich search params.
- **Encounter** — Full CRUD (PATCH).
- **Condition** — Full CRUD (PUT). Problem-list + encounter-diagnosis.
- **Observation** — Full CRUD (PUT). Vitals, labs, social history.
- **Procedure** — Read/Search/Create (no update).
- **DocumentReference** — Full CRUD + `$docref`. Write-back supported!
- **MedicationRequest** — Full CRUD (PATCH).
- **AllergyIntolerance** — Full CRUD.
- **DiagnosticReport** — Read/Search/Create.
- **Binary** — Read only. CCD via `$autogen-ccd-if`.
- Also: Appointment, CarePlan, CareTeam, Communication, Coverage, Immunization, ChargeItem, FinancialTransaction, Consent, Schedule/Slot, etc.

### Gotchas

- Proprietary code systems (Code Set 72) vary per tenant — biggest pain point
- DataAbsentReason extensions instead of nulls
- Search always requires at least one param
- JSON only — no XML

---

# Authentication

SMART on FHIR (v1 + v2) on OAuth 2.0. Very similar to Epic.

- **Provider** — Auth code grant (clinician-launched)
- **Patient** — Auth code grant (patient portal)
- **System** — Client credentials + JWT (what MedScrub needs)

### System Auth Setup

1. Register app as System/Confidential in code Console
2. System account auto-created in Cerner Central
3. Configure JWKS (recommended) or client secret
4. Token via client_credentials grant with JWT assertion

**Discovery:** `{fhir-base}/.well-known/smart-configuration` — never hardcode.

**Scopes:** Explicit per-resource, no wildcards. Format: `system/{Resource}.read`

### vs Epic Auth

- Centralized auth server (`authorization.cerner.com`) vs Epic per-instance
- Supports JWKS + client secret (Epic: JWT + private key only)

---

# Key Resources & URLs

- FHIR R4 Docs: docs.oracle.com/en/industries/health/millennium-platform-apis/mfrap/
- Auth Framework: docs.oracle.com/.../millennium-authorization-framework/
- FAQs: docs.oracle.com/.../fhir-faqs-common-issues/
- Forums: forums.oracle.com/ords/apexds/domain/open-developer-experience
- Community: community.oracle.com/oraclehealth/

---

# Bulk Data / Sync

- FHIR Bulk Data Export (`$export`) via SMART Backend Services
- `Patient/$export` and system-level `$export` with `_since` for incremental → NDJSON
- Polling: date-filtered searches with `_lastUpdated`
- **No native webhooks/subscriptions** — no real-time push

**Strategy:** Small volume → poll every 5-15 min with `_lastUpdated`. Large → bulk `$export` nightly.

No CDS Hooks. Real-time triggers need HL7v2 ADT feeds via Millennium team.

---

# Write-back (DocumentReference)

✅ DocumentReference.Create fully supported. `POST {fhir-base}/DocumentReference` with base64 content.

- MIME types: PDF, plain text, richtext, RTF, HTML, XML, XHTML
- `type` coding: LOINC OR proprietary Code Set 72 — not both
- `docStatus`: Provider → `final` only. System → `final` or `amended`
- `author`: Provider → single (authenticated user). System → multiple
- One `content` entry, base64-encoded. All dates need time component.

Also writable: DiagnosticReport, Observation, Condition, Procedure, Communication.

---

# Sandbox / Testing

**Open (no auth):** `https://fhir-open.cerner.com/r4/ec2458f2-1e24-41c8-b71b-0e701af7583d/{Resource}`

**Secure (auth):** `https://fhir-ehr-code.cerner.com/r4/ec2458f2-1e24-41c8-b71b-0e701af7583d/`

**Patient sandbox:** `https://fhir-myrecord.cerner.com/r4/ec2458f2-1e24-41c8-b71b-0e701af7583d/`

Test patients pre-loaded (IDs: 12742400, 12457977). Tenant UUID: `ec2458f2-1e24-41c8-b71b-0e701af7583d`

---

# Go-Live Process

1. Register app in code Console → client ID
2. Build & test against sandbox
3. Validate (Oracle provides validation tools)
4. Engage health system directly — no marketplace
5. Health system admin enables app + configures scopes
6. Get production FHIR base URL + tenant ID

### Timeline

- Registration + sandbox: 2-4 wks
- Integration build: 4-8 wks (leveraging Epic code)
- Validation: 2-4 wks · Per-site enablement: 2-6 wks
- **Total: ~3-5 months**

No App Orchard equivalent. Faster initial approval, slower per-site rollout.

---

# Market Coverage

- **US market share:** ~25-30% (#2 behind Epic ~38%)
- **500+ health systems globally**, 2,000+ US hospitals, 35+ countries, ~250M lives
- **Key customers:** VA, DoD, CommonSpirit, Adventist, UCHealth, NHS trusts
- **Strongest:** Mid-market community hospitals, federal/gov (#1), international

Adding Cerner opens ~25-30% of US hospital market.

---

# Epic Comparison

- **Same:** FHIR R4, SMART auth, Bulk Export, DocRef write-back, JSON Patch, open sandbox
- **Different:** JSON only, centralized auth, UUID tenants, no marketplace, no CDS Hooks, no Subscriptions
- **Biggest pain:** Proprietary code systems per tenant
- **Code reuse: ~60-70%** from Epic integration

### Cerner-Specific Work

- UUID tenant management vs Epic host-based
- Proprietary code mapping layer (biggest effort)
- Centralized auth discovery
- Aggressive DataAbsentReason handling

---

# Quick-Start Checklist

- [ ]  Create CernerCare account
- [ ]  Register app (System type, Confidential)
- [ ]  Get client ID + configure system account in Cerner Central
- [ ]  Set up JWKS for backend auth
- [ ]  Hit open sandbox (Patient/12742400)
- [ ]  Implement SMART Backend Services auth
- [ ]  Test key reads: Patient, Encounter, Condition, Observation, DocumentReference
- [ ]  Test DocumentReference.Create (write-back)
- [ ]  Build proprietary code mapping layer
- [ ]  Implement incremental sync
- [ ]  Engage first health system for production enablement

[Oracle Cerner Desktop Integration Guide](Oracle%20Cerner%20(Oracle%20Health)%20Integration%20Guide/Oracle%20Cerner%20Desktop%20Integration%20Guide%2030ff3cf2487f81c09502fae2f9db5f86.md)