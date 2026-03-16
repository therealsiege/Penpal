# Workflows & Features

> Customer-facing workflows and platform features that OpenLoop delivers, mapped to the Medplum/FHIR implementation.

**See also:** [Capability Mapping](../Migration/Capability%20Mapping.md) | [OpenLoop Feature Map](../Medplum/OpenLoop%20Feature%20Map.md) | [Company Overview](Company%20Overview.md)

---

## Context

OpenLoop is a **B2B2C white-label telehealth platform** serving **120+ clients** with **20K+ clinicians** across all 50 states, handling **250K+ monthly patient visits**. Customers range from performance marketers (who never see FHIR) to health systems (who want direct FHIR access).

---

## Customer-Facing Workflows

### 1. Telehealth Visits

End-to-end virtual care — patient schedules, joins a video visit with a clinician, encounter is documented. Currently using Doxy.me, migrating to a proprietary solution on **Amazon Chime SDK** with FHIR `Encounter` as the clinical backbone.

| FHIR Resources | Integrations |
|----------------|-------------|
| Encounter | Amazon Chime SDK (target), Doxy.me (current) |

### 2. Scheduling & Appointments

Availability management, slot finding, and booking. Includes appointment reminders (SMS via Twilio). Server-side `$book` and `$find` operations with a React `Scheduler` component.

| FHIR Resources | Key Assets |
|----------------|-----------|
| Schedule, Slot, Appointment | `$book` operation, `$find` operation, Scheduler component, reminder bots |

### 3. Patient Intake & Forms

Custom intake questionnaires per client — demographics, medical history, conditions, medications. Each client can have their own intake flow. Map Healthie form schemas to FHIR Questionnaire resources.

| FHIR Resources | Key Assets |
|----------------|-----------|
| Questionnaire, QuestionnaireResponse | `medplum-patient-intake-demo`, questionnaire bots |

### 4. E-Prescribing (EPCS-Certified)

Clinicians write prescriptions including controlled substances. Currently via **DoseSpot** (through Healthie), with **Photon Health** as a long-term option.

| FHIR Resources | Integrations |
|----------------|-------------|
| MedicationRequest | DoseSpot (bridge), Photon Health (target) |

### 5. Lab Orders & Results

Order labs through **Labcorp**, **Quest Diagnostics**, and others via **Health Gorilla** HIE. Results flow back as diagnostic reports. Includes HL7 ORM/ORU handling for legacy lab interfaces.

| FHIR Resources | Integrations |
|----------------|-------------|
| ServiceRequest, DiagnosticReport, Observation | Health Gorilla, Labcorp, Quest Diagnostics |

### 6. Billing & Revenue Cycle Management (RCM)

OpenLoop has **600+ payer contracts**. Claim submission, eligibility checks, superbill generation, CMS-1500 forms. **Candid Health** is the billing partner. **Stripe** handles patient payments ($1B+ processed).

| FHIR Resources | Integrations |
|----------------|-------------|
| Claim, Coverage, ExplanationOfBenefit | Candid Health, Stripe |

### 7. Chat & Messaging

Patient-provider messaging for async care communication. Includes **eFax** integration for pharmacy/lab faxing.

| FHIR Resources | Key Assets |
|----------------|-----------|
| Communication | `medplum-chat-demo`, `medplum-live-chat-demo`, `medplum-efax-demo` |

### 8. Care Plans

Structured care plans with goals and tasks for ongoing patient management.

| FHIR Resources |
|----------------|
| CarePlan, Goal, Task |

### 9. Clinical Documentation

Encounter notes, diagnostic reports, and document management.

| FHIR Resources |
|----------------|
| DocumentReference, DiagnosticReport |

---

## Platform Features (B2B)

### 10. White-Label / Multi-Tenancy

Each client gets their own branded, isolated experience. Implemented via **Medplum Projects** with `AccessPolicy` for fine-grained RBAC. This is the MSO (Managed Service Organization) model.

| Key Assets |
|-----------|
| `medplum-mso-demo`, AccessPolicy, Projects |

### 11. Partners API (Abstraction Layer)

85% of customers are performance marketers who don't speak FHIR. The **Partners API** wraps FHIR behind a domain-friendly REST API. Health system customers get **direct FHIR access** via API key.

| Status |
|--------|
| **BUILD** — custom OpenLoop-specific |

### 12. Event-Driven Integrations

Webhooks (Healthie) are replaced by **Medplum Subscriptions** feeding into **EventBridge** for a canonical event bus. Supports real-time notifications to client systems.

| FHIR Resources | Technologies |
|----------------|-------------|
| Subscription | EventBridge |

### 13. SMART on FHIR

Standards-based app integration for health system customers — authorization, token exchange, scoped access. Built into the Medplum server.

| Key Assets |
|-----------|
| `smart.ts`, OAuth endpoints, `medplum-client-external-idp-demo` |

### 14. Provider Network Management

Management of 20K+ clinicians across 50 states — credentialing, availability, routing.

| Status |
|--------|
| **BUILD** — custom greenfield |

### 15. Client Onboarding Automation

Automated Project creation, AccessPolicy setup, and configuration for new B2B clients.

| Status |
|--------|
| **BUILD** — custom greenfield |

---

## Build vs. Reuse Summary

| Status | Count | Items |
|--------|-------|-------|
| **EXISTS** (reuse/adapt) | 17 | E-prescribe, billing, labs, scheduling, intake, chat, fax, multi-tenant, SMART on FHIR, CDK, data migration, dedup, reminders, eligibility, care plans, documentation, event subscriptions |
| **BUILD** (greenfield) | 4 | Partners API abstraction layer, EventBridge bridge, provider network management, client onboarding automation |
