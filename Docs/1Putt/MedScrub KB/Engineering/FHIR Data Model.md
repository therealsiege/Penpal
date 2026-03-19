Created: March 7, 2026
Tags: Engineering
*Updated: March 7, 2026*
## Overview

MedScrub uses FHIR R4 as its data lingua franca. All patient data flows through FHIR resources -- from EHR extraction through CDR storage to AI workflow input. The proxy de-identifies FHIR resources before they reach any external LLM, the CDR stores them for longitudinal access, and the desktop/mobile apps consume them to power clinical AI skills.

This document covers which FHIR resources MedScrub reads and writes, how de-identification works per resource type, and how the CDR fits into the data model.

---

## Resources Read from EHR

MedScrub reads the following FHIR R4 resources from connected EHRs. Both Epic (via SMART on FHIR) and athenahealth (via FHIR R4 API) support these resource types, though field-level availability varies by EHR configuration and customer permissions.

| Resource | Use Case |
|----------|----------|
| Patient | Demographics, identifiers, contact information |
| Condition | Active problems, diagnosis history (ICD-10 coded) |
| MedicationRequest | Current medications, prior prescriptions, dosages |
| AllergyIntolerance | Drug and food allergies, reaction severity |
| Observation | Vitals (BP, heart rate, BMI) and lab results (CBC, metabolic panels) |
| DiagnosticReport | Imaging results (MRI, CT, X-ray) and pathology reports |
| Encounter | Visit history, current encounter context, visit type |
| Procedure | Prior procedures, surgical history |
| DocumentReference | Prior clinical notes, faxed documents, specialist reports |
| Coverage | Insurance details -- carrier, plan, member ID (used for prior auth) |
| ServiceRequest | Orders, referrals, pending authorizations |

**EHR-specific notes:**

- **Epic:** Resources fetched via SMART on FHIR (provider-facing app launched from Hyperspace/Haiku). Patient context flows automatically from the Epic session. Backend systems app enables bulk data access.
- **athenahealth:** Resources fetched via FHIR R4 API through the athenahealth Marketplace. OAuth 2.0 SMART on FHIR authorization. Webhook subscriptions available for real-time updates.

---

## Resources Written to EHR

MedScrub currently writes a single resource type back to EHRs:

| Resource | Operation | Use Case |
|----------|-----------|----------|
| DocumentReference | Create | File clinical notes (SOAP notes, prior auth letters, patient messages) to Epic encounters as plain text |

Write-back is currently Epic-only via SMART on FHIR. The physician always reviews and approves content before anything is written to the EHR ("human in the middle" principle).

athenahealth write support (DocumentReference, Observation, CommunicationRequest) is planned but not yet in production.

---

## CDR (Medplum)

The Clinical Data Repository is a Medplum-hosted FHIR R4 server that stores longitudinal patient data. It sits between the EHR and the AI workspace.

### What gets stored

- **Patient context cache** -- FHIR resources fetched from the EHR are cached in the CDR so AI skills can access patient data without repeated EHR API calls
- **Generated documents** -- SOAP notes, prior auth letters, screening results, referral letters, and other AI-generated outputs are stored as DocumentReference resources
- **Longitudinal records** -- Visit history, lab trends, medication changes, and diagnosis progression accumulate over time

### Multi-tenant isolation

Each practice has isolated data. Medplum access policies enforce practice-level separation via RBAC. No practice can read another practice's patient data.

### Why the CDR matters

The CDR is what separates MedScrub from stateless AI scribes. Without persistent patient data, the following workflows are impossible:

- **Pre-visit planning** -- Surfacing overdue screenings, med refills, and care gaps before the patient arrives
- **Population health screening** -- Risk-stratifying patients across a panel for colorectal, breast, and prostate cancer screening programs
- **Care gap detection** -- Identifying patients missing USPSTF-recommended interventions
- **Daily briefings** -- AI-generated summaries of the day's patients with flagged interventions
- **Longitudinal trend analysis** -- Tracking lab values, medication changes, and diagnosis progression across encounters

No ambient scribe competitor stores patient data between visits. The CDR is the structural moat.

---

## De-identification Coverage

The PHI proxy handles FHIR resources through deterministic field-level tokenization. It supports 70+ FHIR R4 resource types with explicit field mapping, achieving 99.9% accuracy on structured data.

### Explicitly mapped resource categories (76 types, 99.9% accuracy)

| Category | Resource Types |
|----------|---------------|
| Clinical | Patient, Practitioner, PractitionerRole, RelatedPerson, Person, Observation, Condition, AllergyIntolerance, FamilyMemberHistory, ClinicalImpression, RiskAssessment, DetectedIssue, AdverseEvent |
| Medications | Medication, MedicationKnowledge, MedicationRequest, MedicationAdministration, MedicationDispense, MedicationStatement |
| Procedures & Services | Procedure, ServiceRequest, Immunization |
| Encounters | Encounter, EpisodeOfCare, Appointment, AppointmentResponse |
| Diagnostics | DiagnosticReport, ImagingStudy, Specimen, Media |
| Documents | DocumentReference, Composition |
| Care Planning | CarePlan, CareTeam, Goal, GuidanceResponse, MeasureReport |
| Financial | Claim, ClaimResponse, ExplanationOfBenefit, Coverage, Account, PaymentNotice, PaymentReconciliation, EligibilityRequest, EligibilityResponse, EnrollmentRequest, EnrollmentResponse |
| Infrastructure | Organization, Location, Device, Substance, HealthcareService, Endpoint |
| Communication | Communication, CommunicationRequest, Consent |
| Scheduling | Schedule, Slot |
| Workflow | RequestGroup, Task, Flag, Provenance, AuditEvent |
| Questionnaires | Questionnaire, QuestionnaireResponse, List |
| Research | ResearchStudy, ResearchSubject |
| Nutrition & Vision | NutritionOrder, VisionPrescription |
| Supply | SupplyRequest, SupplyDelivery, DeviceRequest, DeviceUseStatement, ReferralRequest |
| Container | Bundle (special handling -- maintains cross-resource referential integrity) |

### Generic fallback (~80% accuracy)

For resource types not in the explicit mapping, the proxy applies a generic fallback that recursively scans fields and uses pattern matching to detect PHI. This covers unmapped or custom resource types but at lower accuracy than the deterministic field mapping.

---

## 18 HIPAA Safe Harbor Identifiers

The proxy detects and tokenizes all 18 identifier types defined by the HIPAA Safe Harbor method (45 CFR 164.514(b)(2)):

| # | Identifier | Description |
|---|------------|-------------|
| 1 | Names | Patient, provider, and relative names in all variations (given, family, prefix, suffix) |
| 2 | Geographic subdivisions | Street addresses, city, state, ZIP codes (ZIP truncated to 3 digits if population < 20,000) |
| 3 | Dates | Birth dates, death dates, service dates, admission/discharge dates, and all dates directly related to an individual (year is permitted) |
| 4 | Phone numbers | All telephone numbers including home, work, mobile |
| 5 | Fax numbers | All fax numbers |
| 6 | Email addresses | All email addresses |
| 7 | Social Security numbers | Full or partial SSN |
| 8 | Medical record numbers | MRN and other facility-assigned patient identifiers |
| 9 | Health plan beneficiary numbers | Insurance member IDs, plan numbers |
| 10 | Account numbers | Financial account numbers |
| 11 | Certificate/license numbers | DEA numbers, medical license numbers, driver's license |
| 12 | Vehicle identifiers | VIN, license plate numbers |
| 13 | Device identifiers | Serial numbers, UDI (Unique Device Identifiers) |
| 14 | URLs | Web addresses associated with an individual |
| 15 | IP addresses | Network addresses associated with an individual |
| 16 | Biometric identifiers | Fingerprints, voiceprints, retinal scans |
| 17 | Full-face photographs | Photographic images and comparable images |
| 18 | Any unique identifying number | Any other characteristic or code that could identify an individual (e.g., custom patient IDs) |

---

## De-identification Strategy

### Deterministic tokenization

PHI values are replaced with deterministic tokens in the format `[TYPE_COUNTER]`:

```
Original: "John Smith, DOB: 1985-03-15, MRN: 12345"
Tokens:   "[NAME_1], DOB: [DATE_1], MRN: [IDENTIFIER_1]"
```

Token types include: `NAME`, `DATE`, `IDENTIFIER`, `PHONE`, `EMAIL`, `ADDRESS`, `PATIENT_ID`, and others corresponding to the 18 HIPAA identifier categories. The counter increments per unique value -- if the same name appears multiple times, it receives the same token, preserving relationships in the data.

### Cross-reference preservation

When processing FHIR Bundles (which contain multiple resources), the proxy maintains referential integrity across the entire Bundle. For example, if a Patient resource has `id: "123"` and an Encounter references `subject: "Patient/123"`, both are tokenized to the same value (e.g., `Patient/[PATIENT_ID_1]`). This ensures the de-identified Bundle remains structurally valid and clinically coherent for the LLM.

### Session-based mapping

Each de-identification request creates or extends a session that stores the full token-to-original mapping. When the LLM returns a response containing tokens like `[NAME_1]`, the proxy re-identifies by looking up the session mapping and restoring the original values. Sessions have a default TTL of 24 hours, extendable to 7 days.

### Unstructured text within FHIR

FHIR resources often contain free-text fields (e.g., `Observation.note`, `DocumentReference.content`, `DiagnosticReport.conclusion`). These fields are processed by the multi-layer text NER pipeline:

- **Layer 1 (Regex):** 75-80% coverage, less than 10ms -- fast contextual pattern matching
- **Layer 2 (spaCy NER):** +10-15% coverage, +25ms -- neural entity recognition with medical filtering
- **Layer 3 (Stanford):** 95-99% coverage, +190ms -- transformer model (99.5% F1 on i2b2 benchmark)

Layers are additive. The proxy merges detections across layers and keeps the best match for each entity.

---

## FHIR Fetch Strategies

Each AI skill (workflow) declares how patient data should be fetched from the CDR via the `input.fhir.fetchStrategy` field in its `.skill.json` definition file.

| Strategy | Behavior | Example Skills |
|----------|----------|----------------|
| `everything` | Calls `Patient/$everything` on the CDR to retrieve the full patient Bundle, filtered to the resource types listed in `input.fhir.resources` | SOAP Note, Pre-Visit Summary, Prior Auth, Screening Gap Analyzer, Lab Results Explanation, Referral Letter |
| `selective` | Fetches only the specific resource types listed in `input.fhir.resources` via individual FHIR queries -- useful when the full patient record is unnecessary or too large | (Defined in schema, not currently used by any shipping skill) |
| `none` | No FHIR data is fetched. The skill operates on text input only (physician-provided variables) | Coding Optimization (analyzes pasted note text), Daily Briefing Header (summarizes previously generated briefing cards) |

Example from a skill JSON file:

```json
{
  "input": {
    "fhir": {
      "resources": ["Patient", "Condition", "Observation", "MedicationRequest"],
      "fetchStrategy": "everything"
    }
  }
}
```

The `resources` array acts as a filter -- even with the `everything` strategy, only the listed resource types are included in the de-identified Bundle sent to the LLM.

---

## EHR Connectivity

### Epic

- **Protocol:** SMART on FHIR (provider-facing app) + backend systems app for bulk data
- **Launch:** From within Epic Hyperspace and Haiku -- patient context flows automatically via the SMART launch
- **Hosted endpoint:** `epicproxy.et4001.epichosted.com` for small practices on Epic's hosted infrastructure
- **Public registry:** `open.epic.com/MyApps/EndpointsJson` for endpoint discovery
- **Read:** All 11 resource types listed above
- **Write:** DocumentReference.Create (filing notes to encounters)
- **CDS Hooks:** Planned for clinical decision support triggers

### athenahealth — ✅ Implemented

- **Protocol:** FHIR R4 API via athenahealth Marketplace
- **Auth:** OAuth 2.0 backend JWT authentication
- **Sync:** Full sync service with scheduled imports and on-demand sync
- **Read:** Patient, Condition, MedicationRequest, AllergyIntolerance, Observation, Encounter, Coverage (7 resource types)
- **Write:** Planned (DocumentReference, Observation, CommunicationRequest)
- **Testing:** 7 sandbox test patients for development
- **IPC:** `athena:*` namespace (connect, disconnect, configure-sync, start/stop/cancel sync, get-status)

### Oracle Health (Cerner) — ✅ Implemented

- **Protocol:** Millennium FHIR R4 API
- **Auth:** Backend services JWT authentication
- **Sync:** Full sync service with scheduled imports and on-demand sync
- **Read:** Patient, Condition, MedicationRequest, AllergyIntolerance, Observation, Encounter, Procedure, DocumentReference (8 resource types)
- **Write:** DocumentReference write-back support
- **IPC:** `oracle:*` namespace (connect, disconnect, configure-sync, start/stop/cancel sync, get-status, write-back)

### Future: Vim Canvas (Mid-Market EHRs)

- **Protocol:** Iframe-based embedding into EHRs without modern API extensibility
- **Target EHRs:** eCW, NextGen, Elation, DrChrono, Practice Fusion
- **Purpose:** Brings MedScrub into mid-market EHRs that lack backend FHIR APIs
- **Integration:** Built by 1PuttHealth's consulting arm as custom integrations per EHR