Strategic and technical reference for the OpenLoop platform migration from Healthie to Medplum.

---

## Quick Navigation

### OpenLoop
- [Company Overview](Company%20Overview.md) — Mission, leadership, metrics, service lines, engineering org
- [Tech Stack](Tech%20Stack.md) — AWS serverless architecture, dev tools, integrations, analytics strategy
- [Platform Packages](Platform%20Packages.md) — @olh/* package ecosystem: constructs, ehr-client, events, SDK
- [Platform Infrastructure](Platform%20Infrastructure.md) — CDK architecture: 3 APIs, networking, edge, event bus
- [Payments & ESL](Payments%20&%20ESL.md) — Enterprise Service Layer, Stripe abstraction, program catalog

### Healthie (Migrating FROM)
- [Current State](Healthie%20—%20Current%20State%20(Migrating%20FROM).md) — Platform analysis, capabilities, API, compliance, migration drivers
- [Technical Deep Dive](Technical%20Deep%20Dive.md) — GraphQL API, data model, integrations, webhooks, multi-tenancy, limitations

### Medplum (Migrating TO)
- [Platform Overview](Platform%20Overview.md) — CDR capabilities, integrations, protocols, automation engine
- [Self-Hosting on AWS](Self-Hosting%20on%20AWS.md) — CDK architecture, config, networking, scaling, monitoring
- [Access Control & Multi-Tenancy](Access%20Control%20&%20Multi-Tenancy.md) — Projects, AccessPolicy, RBAC, tenant isolation
- [Developer Experience](Developer%20Experience.md) — SDK, npm packages, CLI, React components, Bots, MCP
- [Server Operations](Server%20Operations.md) — All 56 custom FHIR operations ($apply, $extract, $export, $ai, etc.)
- [Bots & Subscriptions](Bots%20&%20Subscriptions.md) — Execution internals, retry logic, secrets cascade, event chains
- [Care Plans & Tasks](Care%20Plans%20&%20Tasks.md) — PlanDefinition $apply, Task lifecycle, workflow automation, $extract
- [React Components](React%20Components.md) — 123+ pre-built clinical UI components by category
- [AI & LLM Integration](AI%20&%20LLM%20Integration.md) — $ai operation, MCP server, AWS AI services, clinical AI patterns
- [Identity & Consent](Identity%20&%20Consent.md) — IAL2 verification, digital signatures, consent workflows
- [Telehealth](Telehealth.md) — Amazon Chime SDK integration, encounter lifecycle, scheduling, charting, scaling
- [E-Prescribe & EPCS](E-Prescribe.md) — Prescription workflow, Photon Health, controlled substances
- [Billing & RCM](Billing%20-%20RCM.md) — Claim lifecycle, Candid Health, payer integration
- [Repo Feature Map](OpenLoop%20Feature%20Map.md) — What exists in the repo vs. what to build (23 examples cataloged)

### Migration
- [Capability Mapping](Capability%20Mapping.md) — Healthie → Medplum feature-by-feature comparison
- [Data Migration](Data%20Migration.md) — FHIR constraints, ID mapping, ETL strategy, validation
- [Architecture](Architecture.md) — Partners API, macro services, domain structure, Event Gateway
- [Phased Roadmap](Phases.md) — 4-phase plan: Foundation → Pilot → Expand → Cutover
- [Risk Register](Risks.md) — 13 identified risks with mitigations
- [Testing & Validation](Validation.md) — 5-layer test strategy, per-client checklist
- [Cost Model](Cost%20Model.md) — TCO comparison, break-even framework

### Reference
- [FHIR Glossary](FHIR%20R4%20Glossary.md) — FHIR R4 primer for engineers coming from GraphQL
- [All Links](References.md) — Consolidated URLs by category

---

## Structure

```
KB/
├── openloop/
│   ├── company-overview.md
│   ├── tech-stack.md
│   ├── platform-packages.md
│   └── platform-infrastructure.md
├── healthie/
│   ├── current-state.md
│   └── technical-deep-dive.md
├── medplum/
│   ├── platform.md
│   ├── self-hosting.md
│   ├── access-control.md
│   ├── developer-experience.md
│   ├── server-operations.md        ← NEW (56 FHIR operations)
│   ├── bots-and-subscriptions.md   ← NEW (execution internals)
│   ├── care-plans-and-tasks.md     ← NEW ($apply, Task lifecycle)
│   ├── react-components.md         ← NEW (123+ components)
│   ├── ai-and-llm-integration.md   ← NEW ($ai, MCP, AWS AI)
│   ├── identity-and-consent.md
│   ├── telehealth.md
│   ├── eprescribe-epcs.md
│   ├── billing-rcm.md
│   └── repo-map.md
├── migration/
│   ├── capability-mapping.md
│   ├── data-migration.md
│   ├── architecture.md
│   ├── phases.md
│   ├── risks.md
│   ├── testing-validation.md
│   └── cost-model.md
├── fhir/
│   └── glossary.md
├── references.md
└── README.md
```

---

## Context

**What:** Migrate OpenLoop from Healthie (proprietary GraphQL EHR) to Medplum (open-source FHIR R4 CDR).

**Why:**
- FHIR-native interoperability — required by enterprise healthcare clients
- Open-source (Apache 2.0) — no vendor lock-in
- TypeScript/Node.js/PostgreSQL — same language, same paradigm as OpenLoop
- AWS CDK self-hosting — same IaC toolchain, same cloud provider
- EPCS-certified — upgrades e-prescribing from DoseSpot
- Bots map to Lambda patterns — serverless-native

**Key risk:** This is a complete paradigm shift (GraphQL → FHIR R4 REST), not a version upgrade. Requires data model transformation, API rewrite, and an abstraction layer for non-healthcare customers.

**Prior art:** Medplum has been leveraged across multiple prior products and ventures for FHIR-based clinical data infrastructure, bulk sync, SMART App Launch, AI workspaces, and patient consent workflows.

**Timeline:** ~9 months across 4 phases (see [Phased Roadmap](Phases.md)).
