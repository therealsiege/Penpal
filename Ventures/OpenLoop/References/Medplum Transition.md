# Medplum Transition

Created: March 1, 2026 11:52 PM
employment: No

<aside>
🔄 Core Initiative — Migrate from Healthie (GraphQL/non-FHIR) to Medplum (FHIR-native). Significant data model transformation required.

</aside>

## Capability Mapping

**Healthie Capability → Medplum Equivalent:**

---

**Patient management** → FHIR Patient resource — Data model transformation required

**Scheduling/Appointments** → FHIR Schedule/Slot/Appointment — Different API paradigm (GraphQL → REST/FHIR)

**Forms & intake** → FHIR Questionnaire/QuestionnaireResponse — Need to map Healthie form schemas

**Chat/messaging** → FHIR Communication — May need custom UI layer

**Lab orders** → FHIR ServiceRequest/DiagnosticReport — Lab integration connectors available

**E-prescribe** → FHIR MedicationRequest + EPCS — Medplum is EPCS-certified

**Billing/insurance** → FHIR Claim/Coverage/ExplanationOfBenefit — Candid Health integration available

**Documents/notes** → FHIR DocumentReference/DiagnosticReport — Standard FHIR mapping

**Webhooks** → Medplum Subscriptions — Event-driven, aligns with EventBridge architecture

**White-label** → Medplum Branding/Customization — Self-hosted = full control

**React SDKs** → @medplum/react package

**GraphQL API** → FHIR REST API + GraphQL (via FHIR) — Major API paradigm shift

**MCP tool** → Medplum MCP integration — Both have MCP support

---

## Data Migration Strategy

1. Export data from Healthie via GraphQL API (bulk queries)
2. Transform Healthie data models → FHIR resources (ETL pipeline)
3. Validate FHIR resources against Medplum schemas
4. Import into Medplum via FHIR Batch/Transaction bundles
5. Verify data integrity and completeness

## Medplum Migration Guide References

- Planning your migration
- Sequencing your migration
- Converting data to FHIR
- Building migration pipelines
- Adoption strategy

## Key Considerations

- Healthie is GraphQL/non-FHIR; Medplum is FHIR-native — significant data model transformation required
- OpenLoop's AWS/CDK stack aligns well with Medplum's recommended AWS self-hosting path
- Both platforms have MCP tooling — can leverage AI-assisted development during migration
- Medplum's Bot system maps conceptually to OpenLoop's Lambda-based serverless patterns

<aside>
⚠️ Risk: Healthie has features (food/nutrition tracking, some engagement tools) that may not have direct FHIR equivalents. These will need custom solutions or may be deprioritized.

</aside>

## FHIR Data Contract Differences

<aside>
⚠️ Healthie does not use FHIR. It uses a proprietary GraphQL data model. Medplum is FHIR R4-native. This is a complete paradigm shift, not a delta within the same standard.

</aside>

### ID Constraints

Medplum enforces FHIR R4 ID rules:

- Resource IDs: `[A-Za-z0-9\-\.]{1,64}` — max 64 characters
- Healthie uses its own ID system (database serial IDs or UUIDs) with no FHIR constraints
- Migration requires: **Map Healthie IDs to FHIR-compliant IDs, or use Medplum-generated IDs with a cross-reference table**

### Data Model Paradigm

**Healthie (proprietary GraphQL)** vs **Medplum (FHIR R4 REST)**

- **Query language:** GraphQL mutations/queries → FHIR REST (GET/POST/PUT/PATCH/DELETE) + FHIR Search parameters
- **Data shape:** Healthie's flat/nested objects → FHIR resources with references (e.g., Patient.generalPractitioner → Reference(Practitioner))
- **Relationships:** Healthie uses foreign keys within objects → FHIR uses Reference types that point to other resources by ID
- **Extensibility:** Healthie custom fields → FHIR Extensions (must define StructureDefinition for non-standard data)
- **Coding systems:** Healthie may use free-text or internal codes → FHIR requires CodeableConcepts bound to standard terminologies (SNOMED CT, LOINC, ICD-10, RxNorm, CPT)

### Resource Validation

- Medplum validates all resources against FHIR R4 StructureDefinitions on write
- Required fields vary per resource (e.g., Patient requires no fields, but Observation requires status + code)
- Cardinality enforced: fields marked 1..1 or 1..* in FHIR must be present
- Healthie has its own validation rules that do not map 1:1 to FHIR constraints

### Key FHIR Constraints to Watch

- **Resource IDs:** 64 char max, alphanumeric + hyphens/periods only
- **String fields:** Max 1,048,576 characters (1MB) per FHIR spec
- **DateTime format:** FHIR uses ISO 8601 (YYYY-MM-DDThh:mm:ss+zz:zz) — Healthie may use different formats
- **Coding bindings:** Some FHIR fields have required value sets (e.g., AdministrativeGender must be male|female|other|unknown)
- **Versioning:** Medplum tracks resource versions (meta.versionId) — every update creates a new version. Healthie does not have this concept.
- **Bundles:** Medplum supports Transaction and Batch bundles for atomic multi-resource operations. Migration imports should use Transaction bundles to maintain referential integrity.

**ABSTRACTION LAYER (from CTO interview)**

Most OpenLoop customers are not healthcare companies, so FHIR primitives are not ideal for them directly. A key architectural requirement is building an abstraction layer between FHIR resources and the customer-facing API. This layer should translate complex FHIR resources into domain-friendly concepts that non-healthcare engineers can consume.

**REFERENCE: HEALTHIE CURRENT STATE**

API-first EHR platform with GraphQL API, built on Ruby/Postgres/React/React Native. Closed API on Enterprise/Group plans. Sandbox available for development.

**Core capabilities used by OpenLoop:**

- Patient management & charting, Scheduling & appointments, Forms & intake
- Chat/messaging, Lab orders & results, E-prescribe (DoseSpot)
- Billing & insurance (claims, CMS-1500), Documents & notes, Care plans
- White-label settings, Webhooks, Food/nutrition tracking

**Developer tools:** GraphQL Schema Explorer, React SDKs (Chat, Forms), MCP dev-assist tool (healthie/healthie-dev-assist on GitHub)

**REFERENCE: MEDPLUM TARGET STATE**

Medplum is an open-source (Apache 2.0) healthcare development platform built natively on FHIR R4. Stack: TypeScript, Node.js, PostgreSQL. Designed for self-hosting on AWS via CDK.

**Core Capabilities:**

- FHIR Datastore — Full FHIR R4 resource server with search, history, versioning
- Custom EHR — React component library for building clinical interfaces
- Bots — TypeScript event-driven automation (similar to Lambda functions)
- Subscriptions — FHIR-native event system for resource change notifications
- Scheduling — FHIR Schedule/Slot resources for appointment management
- Medications — MedicationRequest, MedicationDispense, e-prescribing workflows
- Care Plans — CarePlan, Goal, Task resources for care coordination
- Access Control — Fine-grained RBAC with FHIR AccessPolicy resources

**Self-Hosting on AWS:**

Deploys via AWS CDK with ECS Fargate, Aurora PostgreSQL, ElastiCache Redis, CloudFront CDN, and S3. Full infrastructure-as-code with configurable settings for region, domain, certificates, and scaling.

**Compliance Certifications:**

- HIPAA — BAA available, encryption at rest and in transit
- SOC 2 Type II — Audited security controls
- ONC HTI-4 — Health IT certification
- EPCS — Electronic Prescribing for Controlled Substances
- ISO 9001 — Quality management systems
- 21 CFR Part 11 — Electronic records and signatures

**Ecosystem & Connectors:**

Built-in integrations for Health Gorilla (labs), Photon Health (e-prescribe), CandidHealth (billing/RCM), and Epic/Cerner via SMART on FHIR. Extensible via Bots for custom integrations.

**AI & MCP Integration:**

Medplum provides a Model Context Protocol (MCP) server enabling AI agents to interact with FHIR data. Supports agent-mediated workflows for clinical decision support, documentation, and care coordination.

**KEY LINKS**

**Healthie:**

- API Documentation: [https://docs.gethealthie.com](https://docs.gethealthie.com)
- Developer Resources: [https://www.gethealthie.com/developer-resources](https://www.gethealthie.com/developer-resources)
- EMR Integration Guide: [https://www.gethealthie.com/solutions/emr-integration](https://www.gethealthie.com/solutions/emr-integration)
- API & SDKs Overview: [https://www.gethealthie.com/solutions/api-sdks](https://www.gethealthie.com/solutions/api-sdks)
- Healthcare API Overview: [https://www.gethealthie.com/solutions/healthcare-api](https://www.gethealthie.com/solutions/healthcare-api)
- MCP Tool (GitHub): [https://github.com/mcp-healthie/healthie-mcp-tool](https://github.com/mcp-healthie/healthie-mcp-tool)

**Medplum:**

- Documentation: [https://www.medplum.com/docs](https://www.medplum.com/docs)
- Self-Hosting Guide: [https://www.medplum.com/docs/self-hosting](https://www.medplum.com/docs/self-hosting)
- AWS Install: [https://www.medplum.com/docs/self-hosting/install-on-aws](https://www.medplum.com/docs/self-hosting/install-on-aws)
- CDK Config Settings: [https://www.medplum.com/docs/self-hosting/config-settings](https://www.medplum.com/docs/self-hosting/config-settings)
- Migration Guides: [https://www.medplum.com/docs/migration](https://www.medplum.com/docs/migration)
- MCP Integration: [https://www.medplum.com/docs/medplum-mcp](https://www.medplum.com/docs/medplum-mcp)
- FHIR Fundamentals: [https://www.medplum.com/docs/fhir-basics](https://www.medplum.com/docs/fhir-basics)
- GitHub: [https://github.com/medplum/medplum](https://github.com/medplum/medplum)