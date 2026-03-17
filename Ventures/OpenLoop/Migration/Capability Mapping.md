# Healthie → Medplum

> Feature-by-feature mapping from Healthie's proprietary GraphQL model to Medplum's FHIR R4 resources.

**See also:** [Data Migration](Data%20Migration.md) | [Architecture](Architecture.md) | [Phases](Phases.md) | [FHIR Glossary](FHIR%20R4%20Glossary.md) | [Care Plans & Tasks](../Medplum/Care%20Plans%20&%20Tasks.md) | [Server Operations](../Medplum/Server%20Operations.md) | [Bots & Subscriptions](../Medplum/Bots%20&%20Subscriptions.md) | [React Components](../Medplum/React%20Components.md)

## Capability Map

| Healthie Capability | Medplum Equivalent | Notes | Deep Dive |
|--------------------|-------------------|-------|-----------|
| Patient management | FHIR Patient resource | Data model transformation required — reference importer at `examples/medplum-healthie-importer/` | [FHIR Glossary](FHIR%20R4%20Glossary.md) |
| Scheduling/Appointments | FHIR Schedule/Slot/Appointment + `$find`/`$book` operations | `$find` searches available slots, `$book` atomically reserves them | [Server Operations](../Medplum/Server%20Operations.md) |
| Forms & intake | FHIR Questionnaire/QuestionnaireResponse + `$extract` | `$extract` auto-generates Observations from QR without custom bots | [Care Plans & Tasks](../Medplum/Care%20Plans%20&%20Tasks.md) |
| Chat/messaging | FHIR Communication | May need custom UI layer; event chain pattern for SMS/email via Bots | [Bots & Subscriptions](../Medplum/Bots%20&%20Subscriptions.md) |
| Lab orders | FHIR ServiceRequest/DiagnosticReport | Lab integration connectors available (Health Gorilla) | |
| E-prescribe (DoseSpot) | FHIR MedicationRequest + EPCS | Medplum is EPCS-certified — upgrade | [E-Prescribe](E-Prescribe.md) |
| Billing/insurance | FHIR Claim/Coverage/ExplanationOfBenefit + `$export` CMS-1500 PDF | `Claim/$export` generates CMS-1500 PDFs natively | [Billing & RCM](Billing%20-%20RCM.md) |
| Video/telehealth | External video provider + FHIR Encounter | Amazon Chime SDK + FHIR Encounter | [Telehealth](Telehealth.md) |
| Documents/notes | FHIR DocumentReference/DiagnosticReport | Auto-download external URLs for Binary migration | |
| Webhooks | Medplum Subscriptions (REST hook, WebSocket, Bot) | 3 channels; BullMQ retry with exponential backoff (up to 19 attempts) | [Bots & Subscriptions](../Medplum/Bots%20&%20Subscriptions.md) |
| White-label | Medplum Projects + AccessPolicy + `$clone` | `$clone` duplicates template project for new client onboarding | [Access Control](Access%20Control%20&%20Multi-Tenancy.md) |
| React SDKs | `@medplum/react` — 74+ components | QuestionnaireForm, PlanDefinitionBuilder, SearchControl, PatientTimeline | [React Components](../Medplum/React%20Components.md) |
| GraphQL API | FHIR REST API + GraphQL (via FHIR) | Major API paradigm shift | |
| MCP tool | Medplum MCP Server (fhir-request, search, fetch tools) | Both have MCP support; dual-MCP pattern for migration validation | [AI & LLM Integration](../Medplum/AI%20&%20LLM%20Integration.md) |
| Care plans | FHIR CarePlan/Goal/Task + PlanDefinition `$apply` | `$apply` creates full CarePlan hierarchy from protocol template | [Care Plans & Tasks](../Medplum/Care%20Plans%20&%20Tasks.md) |
| Clinical protocols | PlanDefinition + ActivityDefinition | Non-technical staff manage via PlanDefinitionBuilder UI | [Care Plans & Tasks](../Medplum/Care%20Plans%20&%20Tasks.md) |
| Custom API endpoints | OperationDefinition + Bot | Define arbitrary FHIR operations without server modification | [Bots & Subscriptions](../Medplum/Bots%20&%20Subscriptions.md) |
| Code translation | ConceptMap + `$translate` | Map Healthie internal codes → SNOMED/LOINC/ICD-10/RxNorm | [Server Operations](../Medplum/Server%20Operations.md) |
| Bulk data export | `$export` (system, patient, group level) | FHIR Bulk Data Access IG compliant | [Server Operations](../Medplum/Server%20Operations.md) |
| AI/clinical decision support | `$ai` operation (OpenAI GPT-4) | Streaming, FHIR-aware function calling, SOAP note generation | [AI & LLM Integration](../Medplum/AI%20&%20LLM%20Integration.md) |

## Features Without Direct FHIR Equivalents

| Healthie Feature | Risk | Mitigation |
|-----------------|------|------------|
| Food/nutrition tracking | No FHIR equivalent | Custom solution or deprioritize |
| Some engagement tools | Partial coverage | Evaluate need per tool |

## API Paradigm Shift

| Aspect | Healthie | Medplum |
|--------|---------|---------|
| Query language | GraphQL mutations/queries | FHIR REST + FHIR Search params |
| Data shape | Flat/nested objects | FHIR resources with Reference types |
| Relationships | Foreign keys within objects | Reference types pointing to resources by ID |
| Extensibility | Custom fields | FHIR Extensions (requires StructureDefinition) |
| Coding systems | Free-text or internal codes | CodeableConcept bound to SNOMED CT, LOINC, ICD-10, RxNorm, CPT |

---

## Reference Implementation

The Medplum codebase includes a **complete Healthie → FHIR importer** built as a Bot:

**Path:** `examples/medplum-healthie-importer/`

| Module | Converts |
|--------|----------|
| `patient.ts` | Healthie user → FHIR `Patient` |
| `provider.ts` | Healthie org member → `Practitioner` + `PractitionerRole` |
| `medication.ts` | Healthie medication → `MedicationRequest` |
| `allergy.ts` | Healthie allergy → `AllergyIntolerance` |
| `coverage.ts` | Healthie policy → `Coverage` |
| `document.ts` | Healthie document → `DocumentReference` + `Binary` |
| `questionnaire-response.ts` | Healthie form answer group → `QuestionnaireResponse` |
| `clinical-activity.ts` | Healthie clinical activity → Clinical resources |

Uses idempotent conditional upserts (`PUT Patient?identifier=system|value`), per-patient batches, and parallel data fetching. See [Data Migration — Healthie Importer](Data%20Migration.md#medplum-healthie-importer-reference-implementation) for full details.

---

## Medplum Migration Guide References

Source: `packages/docs/docs/migration/`

| Guide | File | Key Content |
|-------|------|-------------|
| Planning your migration | `migration-planning.md` | Key questions, phased vs big bang adoption, stakeholder communication |
| Sequencing your migration | `migration-sequence.md` | FHIR dependency order: Practitioner → Organization → Patient → Condition/MedicationRequest → Encounter/Observation |
| Converting data to FHIR | `convert-to-fhir.md` | Field mapping, identifiers for traceability, CodeableConcept handling, conditional references |
| Building migration pipelines | `migration-pipelines.md` | Conditional upserts, batches (independent ops), transactions (atomic, 20 resource cap), binary file migration |
| Adoption strategy | `adoption-stategy.md` | 5-phase approach: dual write → backfill → read from Medplum → write to Medplum → deprecate old store |
| Code examples | `packages/examples/src/migration/` | TypeScript implementations of convert-to-fhir and migration-pipelines patterns |

**URL:** https://www.medplum.com/docs/migration
