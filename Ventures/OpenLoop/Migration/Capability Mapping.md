# Healthie → Medplum

> Feature-by-feature mapping from Healthie's proprietary GraphQL model to Medplum's FHIR R4 resources.

**See also:** [Data Migration](Data%20Migration.md) | [Architecture](Architecture.md) | [Phases](Phases.md) | [FHIR Glossary](FHIR%20R4%20Glossary.md)

## Capability Map

| Healthie Capability | Medplum Equivalent | Notes | Deep Dive |
|--------------------|-------------------|-------|-----------|
| Patient management | FHIR Patient resource | Data model transformation required | [FHIR Glossary](FHIR%20R4%20Glossary.md) |
| Scheduling/Appointments | FHIR Schedule/Slot/Appointment | Different API paradigm (GraphQL → REST/FHIR) | |
| Forms & intake | FHIR Questionnaire/QuestionnaireResponse | Map Healthie form schemas | |
| Chat/messaging | FHIR Communication | May need custom UI layer | |
| Lab orders | FHIR ServiceRequest/DiagnosticReport | Lab integration connectors available (Health Gorilla) | |
| E-prescribe (DoseSpot) | FHIR MedicationRequest + EPCS | Medplum is EPCS-certified — upgrade | [E-Prescribe](E-Prescribe.md) |
| Billing/insurance | FHIR Claim/Coverage/ExplanationOfBenefit | Candid Health integration available | [Billing & RCM](Billing%20-%20RCM.md) |
| Video/telehealth | External video provider + FHIR Encounter | Amazon Chime SDK + FHIR Encounter | [Telehealth](Telehealth.md) |
| Documents/notes | FHIR DocumentReference/DiagnosticReport | Standard FHIR mapping | |
| Webhooks | Medplum Subscriptions | Event-driven, aligns with EventBridge | |
| White-label | Medplum Projects + AccessPolicy | Self-hosted = full control | [Access Control](Access%20Control%20&%20Multi-Tenancy.md) |
| React SDKs | `@medplum/react` package | Component library available | [Developer Experience](Developer%20Experience.md) |
| GraphQL API | FHIR REST API + GraphQL (via FHIR) | Major API paradigm shift | |
| MCP tool | Medplum MCP integration | Both have MCP support | [Developer Experience](Developer%20Experience.md) |
| Care plans | FHIR CarePlan/Goal/Task | Standard FHIR mapping | |

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

## Medplum Migration Guide References

- Planning your migration
- Sequencing your migration
- Converting data to FHIR
- Building migration pipelines
- Adoption strategy

**URL:** https://www.medplum.com/docs/migration
