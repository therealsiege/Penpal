> 123+ pre-built React components in `@medplum/react` for clinical interfaces. Organized by category for OpenLoop's provider app, patient portal, and admin dashboard.

**See also:** [Developer Experience](Developer%20Experience.md) | [Care Plans & Tasks](Care%20Plans%20&%20Tasks.md) | [Telehealth](Telehealth.md)

---

## Setup

```typescript
import { MedplumClient } from '@medplum/core';
import { MedplumProvider } from '@medplum/react';

const medplum = new MedplumClient({ baseUrl: 'https://api.fhir.openloop.health' });

function App() {
  return (
    <MedplumProvider medplum={medplum}>
      {/* All Medplum components available here */}
    </MedplumProvider>
  );
}
```

---

## Questionnaire & Forms

| Component | Purpose | OpenLoop Use |
|-----------|---------|-------------|
| `QuestionnaireForm` | Render FHIR Questionnaire as interactive form with pagination, stepper, signature capture, conditional logic | Patient intake, MWL assessments, PHQ-9 |
| `QuestionnaireBuilder` | Visual editor for creating/editing Questionnaires | Clinical ops builds intake forms without code |
| `QuestionnaireResponseDisplay` | Display completed QuestionnaireResponse | Review submissions |
| `ResourceForm` | Auto-generated CRUD form for any FHIR resource type with profile-based schema, access policy enforcement | Admin editing of resources |
| `Form` / `FormSection` | Composed form layout | Custom forms |
| `CheckboxFormSection` | Checkbox grouping | Multi-select options |
| `SubmitButton` | Standard form submission | All forms |

---

## Search & Tables

| Component | Purpose | OpenLoop Use |
|-----------|---------|-------------|
| `SearchControl` | Table-based resource search with inline filtering, pagination, sorting, bulk operations, export | Provider patient lists, admin dashboards |
| `SearchFieldEditor` | Dynamic field/column configuration | Customize table columns |
| `SearchFilterEditor` | Dynamic filter configuration | Build complex queries |
| `ResourceTable` | Read-only tabular resource display | Reports, summaries |
| `FhirPathTable` | Display FHIRPath expression results as table | Analytics views |

---

## Patient Display

| Component | Purpose | OpenLoop Use |
|-----------|---------|-------------|
| `PatientSummary` | Patient demographics overview | Provider app header |
| `PatientHeader` | Compact patient context bar | Visit context |
| `PatientTimeline` | Activity timeline — encounters, communications, reports, tasks | Clinical history |
| `PatientExportForm` | Patient data export ($everything) | Data portability |
| `ResourceAvatar` | Resource visual indicator/photo | Patient/provider lists |
| `ResourceBadge` | Resource label with avatar + name | Compact references |
| `ResourceName` | Formatted resource display name | Inline references |

---

## Clinical Timelines

| Component | Purpose | OpenLoop Use |
|-----------|---------|-------------|
| `Timeline` | Base timeline component | Custom timeline views |
| `DefaultResourceTimeline` | Generic resource activity timeline | Admin audit views |
| `EncounterTimeline` | Encounter-specific events | Visit detail page |
| `ServiceRequestTimeline` | Service request tracking | Lab order tracking |

---

## Care Plans & Workflow

| Component | Purpose | OpenLoop Use |
|-----------|---------|-------------|
| `PlanDefinitionBuilder` | Visual editor for care protocols — add actions, link questionnaires, set timing | Clinical ops protocol management |
| `RequestGroupDisplay` | Display task hierarchy and sequences | Task dashboard |

---

## Communication & Chat

| Component | Purpose | OpenLoop Use |
|-----------|---------|-------------|
| `ChatControl` | Real-time messaging (FHIR Communication) | Patient-provider messaging |
| `NoteDisplay` | Clinical note display | SOAP notes, visit summaries |

---

## Clinical Data Input

| Component | Purpose | OpenLoop Use |
|-----------|---------|-------------|
| `CodeableConceptInput` | Terminology search/select (SNOMED, LOINC, ICD-10, RxNorm) | Diagnosis entry, medication search |
| `CodeableConceptDisplay` | Formatted coded value display | Clinical records |
| `CodeInput` / `CodingInput` | Code system selection | Simplified code entry |
| `ValueSetAutocomplete` | Autocomplete from ValueSet | Constrained selections |
| `ReferenceInput` | Link to any FHIR resource | Patient-provider assignment |
| `ReferenceDisplay` | Display resolved references | Show linked resources |
| `QuantityInput` | Measurement values (with units) | Vitals, lab values |
| `RangeInput` | Range values | Reference ranges |
| `MoneyInput` / `MoneyDisplay` | Currency handling | Copay, charges |
| `SignatureInput` | Electronic signature capture | Chart note signing, consent |

---

## Demographics & Contact

| Component | Purpose | OpenLoop Use |
|-----------|---------|-------------|
| `HumanNameInput` / `HumanNameDisplay` | Name capture and formatting | Registration, demographics |
| `AddressInput` / `AddressDisplay` | Address capture | Patient registration |
| `ContactPointDisplay` / `ContactDetailInput` | Phone, email, etc. | Contact info |
| `IdentifierInput` / `IdentifierDisplay` | Patient/resource identifiers | MRN, SSN, insurance ID |

---

## Date & Time

| Component | Purpose | OpenLoop Use |
|-----------|---------|-------------|
| `DateTimeInput` | Date/time picker | Appointment scheduling |
| `PeriodInput` | Start/end period | Encounter periods |
| `TimingInput` | Recurring timing (frequency, period, day of week) | Medication dosing, recurring tasks |
| `CalendarInput` | Calendar date picker | Date selection |

---

## File & Document

| Component | Purpose | OpenLoop Use |
|-----------|---------|-------------|
| `AttachmentInput` | File upload to Binary resources | Document upload, ID scans |
| `AttachmentDisplay` | Display attachments | View uploaded files |
| `DocumentDisplay` | Document rendering | Clinical documents |
| `DiagnosticReportDisplay` | Lab results display | Lab review |
| `CcdaDisplay` | C-CDA document rendering | Legacy document import |
| `MeasureReportDisplay` | Clinical quality measure results | Quality reporting |

---

## Scheduling

| Component | Purpose | OpenLoop Use |
|-----------|---------|-------------|
| `Scheduler` | Appointment scheduling UI | Provider/patient booking |

---

## Auth & Navigation

| Component | Purpose | OpenLoop Use |
|-----------|---------|-------------|
| `SignInForm` | Authentication form | Login pages |
| `GoogleButton` | Google OAuth button | SSO |
| `SmartAppLaunchLink` | SMART on FHIR launch link | EHR integration |
| `AppShell` | Application layout wrapper (sidebar, header) | App shell |
| `ErrorBoundary` | React error handling | Error recovery |

---

## Utility & Advanced

| Component | Purpose | OpenLoop Use |
|-----------|---------|-------------|
| `ResourceDiff` / `ResourceDiffTable` | Version comparison | Audit, change tracking |
| `ResourceHistoryTable` | Full resource audit history | Compliance review |
| `ResourcePropertyDisplay` | Dynamic property rendering by schema | Generic resource views |
| `FhirPathDisplay` | Render FHIRPath expression results | Custom data views |
| `ExtensionDisplay` / `ExtensionInput` | FHIR extension handling | Custom fields |
| `BackboneElementInput` / `BackboneElementDisplay` | Complex nested structures | Advanced resources |
| `ElementsInput` | Array element management | Multi-value fields |
| `SensitiveTextarea` | Masked text input | SSN, sensitive data |
| `StatusBadge` | Status indicator | Task/encounter status |
| `OperationOutcomeAlert` | Error/validation messages | Form validation |
| `AsyncAutocomplete` | Async-loaded dropdown | Dynamic lookups |

---

## Component Count by Category

| Category | Count |
|----------|-------|
| Questionnaire & Forms | 7 |
| Search & Tables | 5 |
| Patient Display | 7 |
| Clinical Timelines | 4 |
| Care Plans & Workflow | 2 |
| Communication | 2 |
| Clinical Data Input | 12 |
| Demographics & Contact | 6 |
| Date & Time | 4 |
| File & Document | 6 |
| Scheduling | 1 |
| Auth & Navigation | 5 |
| Utility & Advanced | 13 |
| **Total Cataloged** | **74** |

Plus ~50 additional internal/helper components. Full source at `packages/react/src/`.
