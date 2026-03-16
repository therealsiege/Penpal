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

## Future Topics (Not Yet Covered)

- Provider credentialing and state licensing
- KPIs: turnaround time, time to first response, communication routing
- Data migration (bulk ETL from Healthie)
- Integrations: Labs (Junction), eRx (DoseSpot/Photon), RCM (Candid/Stedi)
- Automation: notifications, reminders
- Micro-frontend breakup of Clinic App
