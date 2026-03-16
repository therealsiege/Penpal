> Primer for engineers migrating from Healthie's GraphQL model. Covers the FHIR concepts and resources you'll encounter daily on the OpenLoop Medplum migration.

**See also:** [Capability Mapping](Capability%20Mapping.md) | [Data Migration](Data%20Migration.md)

---

## Core Concepts

### What is FHIR?

Fast Healthcare Interoperability Resources (FHIR, pronounced "fire") is the HL7 standard for exchanging healthcare data. Think of it as a schema specification for healthcare — like OpenAPI, but for clinical data. FHIR R4 is the current normative release.

**Mental model for GraphQL engineers:** FHIR defines ~150 resource types (like GraphQL types), each with a fixed schema (like a GraphQL schema). Instead of mutations, you use REST verbs. Instead of a single GraphQL endpoint, each resource type has its own REST endpoint.

### Resources

The fundamental unit of data in FHIR. Every piece of clinical data is a Resource with:

- A **resourceType** (e.g., `Patient`, `Observation`, `Encounter`)
- An **id** (server-assigned, max 64 chars, `[A-Za-z0-9\-\.]{1,64}`)
- A **meta** block (versionId, lastUpdated, profile, security, tag)

```json
{
  "resourceType": "Patient",
  "id": "abc-123",
  "meta": { "versionId": "1", "lastUpdated": "2026-03-01T00:00:00Z" },
  "name": [{ "family": "Smith", "given": ["John"] }]
}
```

### References

How resources link to each other. Instead of foreign keys (Healthie) or nested objects (GraphQL), FHIR uses explicit Reference types.

```json
// Healthie (GraphQL): appointment has patient_id foreign key
{ "patient_id": "12345", "provider_id": "67890" }

// FHIR: Appointment references Patient and Practitioner by resource path
{
  "resourceType": "Appointment",
  "participant": [
    { "actor": { "reference": "Patient/abc-123" } },
    { "actor": { "reference": "Practitioner/def-456" } }
  ]
}
```

### Bundles

A container for a collection of resources. Used for batch operations, search results, and transactions.

| Type | Purpose |
|------|---------|
| `transaction` | Atomic — all-or-nothing. Use for migration imports. |
| `batch` | Independent — each entry processed separately, failures don't roll back. |
| `searchset` | Search results returned by the server. |
| `document` | Clinical document (like a CDA). |

### Search Parameters

FHIR's query language. Instead of GraphQL's flexible query syntax, FHIR uses predefined search parameters per resource type.

```
# GraphQL (Healthie)
query { patients(name: "Smith", active: true) { id, name } }

# FHIR Search
GET /Patient?name=Smith&active=true

# Chained search (follow references)
GET /Observation?patient.name=Smith

# Include related resources in response
GET /Patient?_id=abc-123&_include=Patient:generalPractitioner
```

### CodeableConcept

FHIR's way of representing coded values. Instead of free-text or internal codes (Healthie), FHIR binds values to standard terminologies.

```json
{
  "code": {
    "coding": [
      {
        "system": "http://snomed.info/sct",
        "code": "386661006",
        "display": "Fever"
      }
    ],
    "text": "Fever"
  }
}
```

**Key terminologies you'll encounter:**

| System | Used For | Example |
|--------|----------|---------|
| SNOMED CT | Clinical findings, procedures | Diagnoses, symptoms |
| LOINC | Lab tests, observations | Lab order codes |
| ICD-10-CM | Diagnosis codes | Billing diagnoses |
| RxNorm | Medications | Drug codes |
| CPT | Procedures | Billing procedure codes |
| HCPCS | Supplies, services | DME, ambulance |

### Extensions

How you add non-standard data to FHIR resources. Healthie custom fields become FHIR Extensions.

```json
{
  "resourceType": "Patient",
  "extension": [
    {
      "url": "https://openloop.health/fhir/StructureDefinition/client-brand-id",
      "valueString": "grindr-woodwork"
    }
  ]
}
```

Extensions must be defined in a StructureDefinition and registered with the server.

---

## Resource Types — OpenLoop Migration Reference

### Clinical Resources

| Resource | Healthie Equivalent | What It Stores |
|----------|-------------------|----------------|
| **Patient** | Patient record | Demographics, identifiers, contacts, communication preferences |
| **Practitioner** | Provider record | Provider demographics, qualifications |
| **PractitionerRole** | Provider-org link | What a practitioner does at an organization (specialty, location, schedule) |
| **Organization** | Organization/client | Healthcare organizations (OpenLoop clients, clinics, health systems) |
| **Encounter** | Appointment/visit | A patient-practitioner interaction (telehealth visit, in-person) |
| **Appointment** | Appointment | A scheduled future encounter |
| **Schedule** | Provider availability | Available time slots for booking |
| **Slot** | Time slot | Individual bookable time windows within a Schedule |

### Clinical Data

| Resource | Healthie Equivalent | What It Stores |
|----------|-------------------|----------------|
| **Observation** | Vitals, lab results | Measurements: vitals, lab values, social history, assessments |
| **Condition** | Diagnosis | Active/resolved diagnoses and health concerns |
| **AllergyIntolerance** | Allergies | Allergies and adverse reactions |
| **MedicationRequest** | Prescription / e-prescribe | Prescriptions (replaces DoseSpot integration) |
| **MedicationDispense** | Pharmacy fill | Pharmacy dispensing records |
| **ServiceRequest** | Lab order | Orders for labs, imaging, referrals |
| **DiagnosticReport** | Lab results | Lab results, imaging reports |
| **DocumentReference** | Documents/notes | Clinical documents, PDFs, scanned forms |
| **CarePlan** | Care plan | Treatment plans with goals and activities |

### Workflow & Forms

| Resource | Healthie Equivalent | What It Stores |
|----------|-------------------|----------------|
| **Questionnaire** | Form template | Form definitions (intake forms, assessments) |
| **QuestionnaireResponse** | Form submission | Patient's answers to a Questionnaire |
| **Task** | Task/to-do | Workflow tasks assigned to practitioners |
| **Communication** | Chat message | Messages between patients and practitioners |

### Financial

| Resource | Healthie Equivalent | What It Stores |
|----------|-------------------|----------------|
| **Coverage** | Insurance info | Patient's insurance coverage |
| **Claim** | Insurance claim | Submitted insurance claims (CMS-1500) |
| **ExplanationOfBenefit** | Claim adjudication | Payer's response to a claim |
| **PaymentNotice** | Payment | Payment notifications |

### Identity & Consent

| Resource | Healthie Equivalent | What It Stores |
|----------|-------------------|----------------|
| **Consent** | Consent form | Patient consent decisions (data sharing, treatment) |
| **Contract** | Legal agreement | BAAs, service agreements, provider contracts |
| **Provenance** | Audit log | Who did what to which resource and when |

**See also:** [Identity & Consent deep-dive](Identity%20&%20Consent.md)

### Infrastructure

| Resource | Healthie Equivalent | What It Stores |
|----------|-------------------|----------------|
| **Subscription** | Webhook | Event-driven notifications on resource changes |
| **AuditEvent** | Audit trail | Immutable log of all system activity (auto-generated) |
| **Binary** | File upload | Raw files (PDFs, images, documents) |
| **OperationOutcome** | Error response | Structured error/success messages from the server |
| **Bundle** | Batch request | Container for multiple resources |

---

## FHIR vs GraphQL — Quick Reference

| Concept | Healthie (GraphQL) | Medplum (FHIR R4) |
|---------|-------------------|-------------------|
| Schema | GraphQL SDL | FHIR StructureDefinitions |
| Read one | `query { patient(id: "123") { ... } }` | `GET /Patient/123` |
| Search | `query { patients(name: "Smith") { ... } }` | `GET /Patient?name=Smith` |
| Create | `mutation { createPatient(...) { ... } }` | `POST /Patient` with JSON body |
| Update | `mutation { updatePatient(id: "123", ...) { ... } }` | `PUT /Patient/123` with full resource |
| Patch | N/A (full mutation) | `PATCH /Patient/123` with JSONPatch |
| Delete | `mutation { deletePatient(id: "123") }` | `DELETE /Patient/123` |
| Batch | Multiple mutations | `POST /` with Bundle (transaction/batch) |
| Real-time | GraphQL subscriptions | FHIR Subscriptions (webhook/WebSocket/Bot) |
| Auth | API key / OAuth | OAuth 2.0 / SMART on FHIR |
| Relationships | Foreign keys / nested objects | `Reference(ResourceType/id)` |
| Custom fields | Custom columns | FHIR Extensions |
| Error handling | GraphQL errors array | OperationOutcome resource |
