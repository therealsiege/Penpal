# Medplum Workshop History

> Product team's collaborative workshop sessions with the Medplum enterprise team (Jul 2025 – Mar 2026). Defines tenancy, clinical workflows, FHIR data modeling, and Questionnaire strategy.

**See also:** [Access Control & Multi-Tenancy](Access%20Control%20&%20Multi-Tenancy.md) | [Developer Experience](Developer%20Experience.md) | [Platform Overview](Platform%20Overview.md) | [Capability Mapping](../Migration/Capability%20Mapping.md)

---

## Workshop Timeline

| Date | Session | Focus | Recording |
|------|---------|-------|-----------|
| Jul 30, 2025 | Enterprise Scoping | Define MVP vertical, workstreams, stakeholders | [Fathom](https://fathom.video/calls/366238351) |
| Jul 31, 2025 | Session 1: Templating & Tenancy | Intake forms, org hierarchy, access questions | [Fathom](https://fathom.video/calls/367738157) |
| Aug 1, 2025 | Session 2: Instantiating Templates | PlanDefinition$apply, CarePlan hierarchy | [Fathom](https://fathom.video/calls/369808187) |
| Aug 5, 2025 | Session 3: Using Tenancy Model | meta.compartment, AccessPolicy, parameterized access | [Fathom](https://fathom.video/calls/372567393) |
| Aug 12, 2025 | Session 4: Questionnaires | Client-specific Questionnaire customization, Concept IDs | [Fathom](https://fathom.video/calls/377729968) |
| Sep 4, 2025 | FHIR Questions Potpourri | SOAP→FHIR, bundles, profiles, performance, validation | [Fathom](https://fathom.video/calls/399872932) |
| Sep 12, 2025 | Office Hours | Medications, scheduling, billing, MedicationDispense shipping | [Fathom](https://fathom.video/calls/408155121) |
| Nov 19, 2025 | Intake Work Session | FHIR basics training, Concept ID→FHIR resource mapping | — |
| Jan 16, 2026 | Intake & Assessments | Main Questionnaire strategy, cross-vertical Concept IDs | — |
| Mar 6, 2026 | Enterprise Workshop Scoping 2 | Clinical MVP for 1-week proof of value | — |

---

## Stakeholders

| Role | Person | Org |
|------|--------|-----|
| Medplum FDE | Maddy Li | Medplum |
| Executive Sponsor | Christian Williams | OpenLoop |
| Implementation | Shaun Wei, David Zhu | OpenLoop |
| Customer Onboarding | Curtis Olson, Jack | OpenLoop |
| Physician Experience | Jamie Gray, Katie | OpenLoop |
| Product | Devin | OpenLoop |
| Engineering | Steve, Lakshmi Ramamurthy, Rahul Agarwal | OpenLoop |
| Contractors | Tonda, Vilem, Jakub Šlambora | OaksLab |
| HeyRavia | Gloria | HeyRavia |

---

## Key Architectural Decisions

### Tenancy Model

- **Organization** = OpenLoop client (e.g., G-Plans, Fridays, TrimRx)
- **HealthcareService** = vertical (e.g., MWL/GLP-1, TRT)
- Patient data tagged with `meta.compartment` referencing both Organization and HealthcareService
- `_compartment` search parameter filters data at query time
- **AccessPolicy** parameterized by `%customer_organization` and `%vertical_healthcare_service`

```
Hierarchy:
  Level 0: All OpenLoop (global templates, admin access)
  Level 1: Across Vertical (e.g., all MWL clients share charting template)
  Level 2: Across Client Type (optional)
  Level 3: Per Client (client-specific Questionnaires, med lists)
```

### CarePlan Hierarchy

Each patient journey = one main/root CarePlan with child CarePlans:

1. **Intake & Payment CarePlan** — Patient intake Questionnaire → consent → payment via Stripe → parse into FHIR
2. **Initial Visit (Sync) CarePlan** — Encounter note → scheduling → practitioner charting → sign note
3. **Labs CarePlan** (conditional) — ServiceRequest to Junction/lab partner → Task for patient
4. **Rx CarePlan** (conditional) — MedicationRequest to DoseSpot/Photon → MedicationDispense → follow-up Task

PlanDefinition$apply translates templates into actionable Tasks, QuestionnaireResponses, and ServiceRequests — moving business logic from code to editable FHIR data.

### Questionnaire Strategy

- **Main Questionnaire per vertical** with OpenLoop Concept IDs as `linkId`
- Clients can customize question wording but not semantic content (same `code`, different `text`)
- Clients needing full control maintain their own intake + mapping to Main Questionnaire
- **Bot** translates client-specific QuestionnaireResponse → Main QuestionnaireResponse → FHIR clinical resources
- Concept IDs should be **atomic** (smallest complete piece of data) to enable cross-vertical prefilling

### Auth & Access

- **Providers**: Per-client access via parameterized AccessPolicy; one login, access to all assigned clients
- **OpenLoop Admins**: Super-user AccessPolicy with no compartment restrictions
- **Clients**: Read-only access to their referred patients' data (future)
- **Patients**: Auth exists but not actively used yet
- **Hybrid approach recommended**: Single ProjectMembership with multi-tenant access, client-side `_compartment` filtering for UI scoping

---

## FHIR Data Modeling

### SOAP Note → FHIR Mapping

| SOAP Section | FHIR Resources |
|-------------|----------------|
| Subjective | Observation ("patient reports...") |
| Objective | DiagnosticReport, Observation (labs, vitals, photos) |
| Assessment | Condition (ICD-10 diagnosis codes) |
| Plan | MedicationRequest, ServiceRequest, CommunicationRequest |

### OpenLoop Concept ID → FHIR Mapping (MWL Vertical)

| Concept ID | Name | FHIR Resource | Code System |
|------------|------|---------------|-------------|
| 104 | weight_goal | Goal | Custom ValueSet |
| 107 | weight | Observation | LOINC 29463-7 |
| 108 | bmi | Observation | LOINC 39156-5 |
| 109 | height | Observation | LOINC 8302-2 |
| 110 | comorbidity_required | Observation/Condition | Custom LOINC ValueSet |
| 111 | gender | Patient | US Core gender extensions |
| 112-113 | dob/age | Patient | birthDate |
| 114 | state | Patient | address |
| 117 | prior_weight_loss_meds | MedicationRequest | — |
| 120 | medication_allergies | AllergyIntolerance | RxNorm |
| 121 | allergy_description | AllergyIntolerance | SNOMED |

### Medication Lifecycle in FHIR

- **MedicationKnowledge** — drug catalog (with compartment tagging for client-specific med lists)
- **MedicationRequest** — prescription order (RxNorm codes)
- **MedicationDispense** — fulfillment (shipping: `whenPrepared` = ship date, `whenHandedOver` = delivery, extension for tracking number)
- **MedicationAdministration** — patient ingests drug
- **MedicationStatement** — summary

---

## First Vertical: Medical Weight Loss (MWL)

Selected as the pilot migration vertical because:
- Highest patient volume
- Well-understood workflow (intake → charting → labs → Rx → refill)
- Multiple clients with varying configurations (G-Plans, Fridays, TrimRx)
- Good test case for tenancy model (branded vs. compounded medications)

**Clinician targets**: Sub-1 minute for async visits, 10-15 minutes for sync visits.

---

## Technical Notes from Q&A

- **Bundle performance**: Transactions are slower (rollback integrity) but ensure referential integrity. Batches are sequential and independent.
- **Large imports**: Can cause DB transaction errors at 100+ resources/transaction. Medplum bumped retry limits and is implementing async batches.
- **Rate limits**: Being negotiated specifically for OpenLoop in contract.
- **Profile enforcement**: US Core profiles loaded by default. Can enforce at project level via `defaultProfile` setting.
- **Referential integrity**: `checkReferencesOnWrite` project setting validates references on create/update.
- **FHIR versioning**: All resources versioned by default. Spec alignment ensures backward compatibility.

---

## March 2026 Workshop: Clinical MVP Sprint

**Source:** `Product/March 2026 Workshop Sessions/Enterprise Workshop Scoping 2`

### Objective

Achieve **proof of value** by delivering a business-ready MVP within 1 week. 5 daily sessions with pair programming, each building toward production.

### Clinical MVP Definition

**An OpenLoop client can:**
- Access the Main MWL Intake Questionnaire (all info needed to see a patient)
- Configure client-specific MWL intake Questionnaires
- View their patients' Questionnaires and QuestionnaireResponses (multi-tenant isolation)
- Be alerted when OpenLoop changes the Main MWL Intake Questionnaire

**An OpenLoop developer/admin can:**
- Write a Bot to convert client-specific QR → Main MWL QR
- Write a Bot to convert Main MWL QR → clinical FHIR resources
- Provision new tenants for new clients

### Session Plan

| Day | Topic | Deliverable |
|-----|-------|-------------|
| 1: Capturing Intake | Questionnaires, Terminology Services | Create Main MWL Questionnaire + client-specific Questionnaires |
| 2: Parsing Intake | Bots, Charting | Bots: client QR → Main QR → FHIR resources |
| 3: Representing Tenants | MSO, Multi-Tenancy | Tenanting resources, role definitions |
| 4: Enrolling Clients | Patient Compartment, Access Policies | Example patients, AccessPolicies for Practitioners and Clients |
| 5: Pre-filling Intake | QuestionnaireResponse pre-fill, real-time validation | Pre-fill for existing patients in new verticals |

**Prerequisites per session:**
- Day 1: Read FHIR Basics, Search, Questionnaires, Terminology Services
- Day 2: Read Bots, Charting Basics
- Day 3: Read Multitenant Access Control, MSO Example App Video
- Day 4: Read Assigning Data to Tenants, Access Policies with Tenant Parameterization

**Open questions from scoping:**
- Disqualification validation: server-side or application-side?
- What powers the Intake UI currently? Server-side, app-side, or other framework?
- What patient data should clients have access to? All PII, no PHI? Some PHI?
- For practitioners, which patients? Only their assigned, or all for assigned clients?

---

## Session Details (Jul-Aug 2025)

### Session 1: Templating & Tenancy (Jul 31)

**Key outcomes:**
- Defined 4-level hierarchy: All OpenLoop → Across Vertical → Across Client Type → Per Client
- Intake forms standard at base data level per vertical, with "keys" per vertical for clinical protocol
- Clients wanting full control maintain own intake + mapping to Main Questionnaire
- Current system stores intake responses as text blobs — not scalable
- Charting needs modularization: standardize UI, allow client-specific medication lists
- Moving from code-driven to data-driven configuration

**Client deep dive (MWL vertical):**
- **G-Plans:** Legacy custom intake, Smart intake fields mapped directly, full MWL med list, Metformin via manual Quest ticket (should be Junction)
- **Fridays:** No Junction lab ordering, previously 12-week ordering cycles
- **TrimRx:** Standard medication ordering

**Auth decisions:**
- Providers: per-client access within their vertical
- Clients: read/write to QuestionnaireResponses, read-only to Patient data, no access to other info
- Patients: auth exists but not actively used; clients have patient portals
- Clinical ops: small centralized team, specialized by function (scheduling team manages across all customers)

### Session 2: Instantiating Templates (Aug 1)

**Key outcomes:**
- Demoed Medplum provider app showing PlanDefinition$apply with Questionnaires, ServiceRequests, Tasks
- Mapped CarePlan templates to tenancy hierarchy
- Verticals represented by HealthcareService (GLP-1s, TRT, etc.)
- Each client has its own Organization

**Child CarePlan detail (from session notes):**

| CarePlan | Activities | Trigger |
|----------|-----------|---------|
| **Intake & Payment** | Patient intake Task→Questionnaire, Consent, Rx selection Task→Questionnaire, Payment webhook→Stripe subscription, Parse QR→FHIR | Patient referral |
| **Initial Visit (Sync)** | Encounter note Task→Charting Questionnaire (with pre-fill), Scheduling Task→Appointment, Provider edits/signs QR | Intake complete |
| **Labs** | Patient Task (go get labs), ServiceRequest to Junction | Charting QR has labs selected |
| **Rx** | MedicationRequest to DoseSpot/Photon, MedicationDispense (tracking), Follow-up Task for clinical ops | Charting QR responses |

**Payment failure path:** PlanDefinition$apply creates Task for billing team + Communication resource. Does NOT apply next CarePlan.

**Refill architecture:** Discussed but details in separate document.

### Session 3: Using Tenancy Model (Aug 5)

**Key outcomes — the complete access control pattern:**

1. **Organization = client**, HealthcareService = vertical
2. Resources tagged with `meta.compartment` referencing both Organization AND HealthcareService
3. AccessPolicy uses `_compartment=%customer_organization` criteria
4. ProjectMembership passes `customer_organization` and `vertical_healthcare_service` as parameters
5. Only admin Users can set `meta.compartment` (enforced by Medplum)
6. Child resources (Observations linked to Patient) auto-inherit compartment references

**Resource bucket model:**
- **Tenant-level:** Patient, Observation, PlanDefinition (criteria: `_compartment=%customer_organization`)
- **Vertical-level:** Practitioner (criteria: `_compartment=%vertical_healthcare_service`, read-only)
- **Global:** Organization (read/search only, no criteria)

**Multi-tenant provider access — decided on hybrid approach:**
- Single ProjectMembership with access to all assigned tenants
- Client-side `_compartment` filtering for UI scoping (tenant switcher in UI, not in auth)
- Pros: simple management, single auth context
- Cons: API returns resources from multiple tenants (mitigated by client-side filtering)

**Admin super users:** Simple AccessPolicy with no criteria — unrestricted access across all customers.

### Session 4: Questionnaires (Aug 12)

**Key outcomes:**
- Reviewed parent/child CarePlan Miro
- Scoped CarePlans to All OpenLoop / Across Vertical / Specific Client levels
- Performed UX review of clinician workflow

**Questionnaire customization — two options formalized:**
1. Allow customization of question **wording** only (same `code`, different `text`)
2. Allow full customization with a **translation layer** between client Questionnaire and Main Questionnaire

---

## FHIR Questions Potpourri (Sep 4, 2025)

**Source:** `Product/Notes - FHIR Questions Potpourri`

Key technical answers from Medplum:

| Question | Answer |
|----------|--------|
| Custom FHIR profiles | Create your own: `docs/fhir-datastore/profiles` |
| US Core enforcement | Loaded into every project. Enforce per-resource via `defaultProfile` project setting |
| FHIR versioning | All resources versioned by default. Backward-compatible — spec-aligned |
| SOAP → FHIR | S: Observation, O: DiagnosticReport+Observation, A: Condition, P: MedicationRequest+ServiceRequest+CommunicationRequest |
| Bundle vs Transaction | Transactions = all-or-nothing (slower, referential integrity). Batches = sequential, independent |
| Large imports | 100+ resources/transaction causes DB errors. Medplum bumped retry limits, implementing async batches |
| Rate limits | Being negotiated specifically for OpenLoop in contract |
| Referential integrity | `checkReferencesOnWrite` project setting validates references on create/update |
| QR → FHIR extraction | Save as QuestionnaireResponse, parse via Bots — or use `$extract` (SDC, in progress at time of session, now available) |
| Conformance tools | Not needed — Medplum validates on submission |

---

## Office Hours: Medications, Scheduling, Billing (Sep 12, 2025)

**Source:** `Product/Notes - Medplum Office Hours`

Key technical guidance from Medplum (with international implementation experience at 10M+ patient scale):

**Medications:**
- `MedicationKnowledge` = drug catalog (compartment-tagged per client)
- `MedicationRequest` = prescription order (RxNorm codes)
- `MedicationDispense` = fulfillment tracking:
  - `whenPrepared` = ship date
  - `whenHandedOver` = delivery date
  - `status`: preparation → in-progress → completed (preparing → in transit → delivered)
  - Extension for shipping/tracking number
- Experience integrating with Pharmacy Information Systems

**Scheduling:**
- Medplum is system of record for Appointments/Practitioners/Patients
- Many customers use outside vendors for scheduling UI/middleware
- All tools are composable — anything clickable can be automated via code

**Billing:**
- `Claim` = billable event
- `ClaimResponse.payment` = payment record
- Actively implementing Stedi and Candid integrations

**International considerations (food for thought):**
- Country-specific FHIR implementation guides (EU has GDPR + country-specific)
- Each country has own integration partners (labs, Rx, data exchange)
- Data sovereignty requirements

---

## Future Topics (Not Yet Covered)

- Provider credentialing and state licensing
- KPIs: turnaround time, time to first response, communication routing
- Pharmacy access: OL-owned and partner pharmacies need identity verification for controlled substances
- Micro-frontend breakup of Clinic App
- International expansion considerations (EU GDPR, country-specific FHIR IGs)
