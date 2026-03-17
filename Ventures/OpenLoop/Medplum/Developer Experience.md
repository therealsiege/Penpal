> SDK, npm packages, CLI, React components, MCP server, and TypeScript-first development. Everything OpenLoop engineers need to build on Medplum.

**See also:** [Platform Overview](Platform%20Overview.md) | [FHIR Glossary](FHIR%20R4%20Glossary.md) | [Server Operations](Server%20Operations.md) | [Bots & Subscriptions](Bots%20&%20Subscriptions.md) | [React Components](React%20Components.md) | [AI & LLM Integration](AI%20&%20LLM%20Integration.md)

---

## TypeScript-First

Medplum is written in TypeScript and provides full TypeScript types for every FHIR R4 resource. This aligns directly with OpenLoop's TypeScript-primary engineering org.

Every FHIR resource type has a corresponding TypeScript interface:

```typescript
import { Patient, Practitioner, Appointment, MedplumClient } from '@medplum/core';

const patient: Patient = {
  resourceType: 'Patient',
  name: [{ family: 'Smith', given: ['John'] }],
  birthDate: '1990-01-15',
};
```

---

## npm Packages

| Package | Purpose | Install |
|---------|---------|---------|
| `@medplum/core` | FHIR types, MedplumClient, utilities, validation | `npm i @medplum/core` |
| `@medplum/react` | React UI components for clinical interfaces | `npm i @medplum/react` |
| `@medplum/fhirtypes` | Standalone FHIR R4 TypeScript type definitions | `npm i @medplum/fhirtypes` |
| `@medplum/mock` | Mock client for testing (no server needed) | `npm i -D @medplum/mock` |
| `@medplum/agent` | On-premise HL7v2/DICOM bridge agent | `npm i @medplum/agent` |
| `@medplum/expo-polyfills` | React Native/Expo compatibility | `npm i @medplum/expo-polyfills` |
| `@medplum/cli` | CLI for deployment, bots, bulk operations | `npm i -g @medplum/cli` |
| `@medplum/cdk` | AWS CDK constructs for self-hosting | `npm i @medplum/cdk` |

### MedplumClient (Core SDK)

The primary SDK for interacting with the Medplum server. Works in Node.js, browsers, and React Native.

```typescript
import { MedplumClient } from '@medplum/core';

const medplum = new MedplumClient({
  baseUrl: 'https://api.openloop.health/',
  clientId: 'my-client-id',
});

// Authenticate
await medplum.startClientLogin('client-id', 'client-secret');

// CRUD operations
const patient = await medplum.createResource({
  resourceType: 'Patient',
  name: [{ family: 'Smith', given: ['John'] }],
});

const result = await medplum.readResource('Patient', patient.id);
const updated = await medplum.updateResource({ ...result, active: true });
await medplum.deleteResource('Patient', patient.id);

// Search
const patients = await medplum.searchResources('Patient', { name: 'Smith', active: 'true' });

// GraphQL (yes, FHIR over GraphQL is supported)
const response = await medplum.graphql(`{
  PatientList(name: "Smith") {
    id name { family given }
  }
}`);

// Batch/Transaction bundles
await medplum.executeBatch({
  resourceType: 'Bundle',
  type: 'transaction',
  entry: [
    { resource: patient, request: { method: 'POST', url: 'Patient' } },
    { resource: encounter, request: { method: 'POST', url: 'Encounter' } },
  ],
});
```

---

## React Components (`@medplum/react`)

Pre-built clinical UI components. Use these to build admin dashboards, provider interfaces, and patient portals.

| Component | Purpose |
|-----------|---------|
| `<MedplumProvider>` | Context provider wrapping the app |
| `<SignInForm>` | Authentication form |
| `<ResourceTable>` | Display FHIR resources in a table |
| `<ResourceForm>` | Create/edit FHIR resources with auto-generated forms |
| `<SearchControl>` | Search interface with filters and pagination |
| `<PatientSummary>` | Patient demographics display |
| `<Timeline>` | Clinical timeline (encounters, observations, notes) |
| `<ChatControl>` | Real-time messaging (FHIR Communication) |
| `<Scheduler>` | Appointment scheduling UI |
| `<QuestionnaireForm>` | Render FHIR Questionnaire as interactive form |
| `<DiagnosticReportDisplay>` | Lab results display |
| `<AttachmentInput>` | File upload to Binary resources |
| `<CodeableConceptInput>` | Terminology search/select (SNOMED, LOINC, etc.) |

---

## CLI (`@medplum/cli`)

Command-line tool for server management, bot deployment, and bulk operations.

```bash
# Login
medplum login

# Deploy a bot
medplum bot deploy my-bot

# Bulk import FHIR resources
medplum bulk import data.ndjson

# Execute a FHIR operation
medplum get 'Patient?name=Smith'
medplum post Patient '{"resourceType":"Patient","name":[{"family":"Smith"}]}'

# Profile management
medplum profile set production --base-url https://api.openloop.health
medplum profile set development --base-url http://localhost:8103
```

---

## Bots Development

Bots are TypeScript functions deployed to the Medplum server. They execute on triggers (Subscriptions, cron, webhooks, custom operations).

```typescript
import { BotEvent, MedplumClient } from '@medplum/core';
import { Patient } from '@medplum/fhirtypes';

export async function handler(medplum: MedplumClient, event: BotEvent): Promise<any> {
  const patient = event.input as Patient;

  // React to patient creation
  if (patient.resourceType === 'Patient') {
    // Create a welcome task
    await medplum.createResource({
      resourceType: 'Task',
      status: 'requested',
      intent: 'order',
      description: `Welcome intake for ${patient.name?.[0]?.family}`,
      for: { reference: `Patient/${patient.id}` },
    });

    // Send to EventBridge (OpenLoop's event bus)
    await fetch('https://events.openloop.health/patient-created', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: patient.id }),
    });
  }
}
```

**Bot runtimes:**
| Runtime | Best For |
|---------|----------|
| Medplum VM | Simple bots, quick deploy, built-in |
| AWS Lambda | Heavy compute, existing Lambda expertise (OpenLoop) |
| Fission (K8s) | Kubernetes-native environments |

**Testing bots locally:**
```typescript
import { MockClient } from '@medplum/mock';

const medplum = new MockClient();
// Test bot logic without a running server
```

---

## MCP Server (AI Integration)

Medplum provides a Model Context Protocol (MCP) server for AI agent interaction with FHIR data.

### Available MCP Tools

| Tool | Description |
|------|-------------|
| `fhir-request` | Execute any FHIR REST operation (GET, POST, PUT, DELETE) |
| `search` | Search FHIR resources with parameters |
| `fetch` | Retrieve a specific resource by reference |

**Authentication:** OAuth 2.0 (client credentials or user token)

**URL:** https://www.medplum.com/docs/ai/mcp

### Use Cases for OpenLoop

- **Migration validation:** AI agents query both Healthie (via healthie-dev-assist MCP) and Medplum (via Medplum MCP) to verify data transformations
- **Clinical decision support:** AI agents query patient data in Medplum to generate recommendations
- **Documentation assist:** AI generates SOAP notes from Encounter/Observation data
- **Care coordination:** AI agents create/update Task and Communication resources

### Healthie MCP Tool (During Migration)

Healthie's `healthie-dev-assist` MCP tool enables AI-assisted development against their GraphQL API. Useful during the transition period for:
- Exploring Healthie's GraphQL schema
- Generating data export queries
- Validating field mappings

**URL:** https://github.com/healthie/healthie-dev-assist

---

## Development Workflow

### Local Development

```bash
# 1. Start Medplum locally (Docker Compose)
git clone https://github.com/medplum/medplum.git
cd medplum
docker-compose up -d
# Server at http://localhost:8103

# 2. Create a new bot project
mkdir my-openloop-bot && cd my-openloop-bot
npm init -y
npm install @medplum/core @medplum/fhirtypes
npm install -D @medplum/mock typescript

# 3. Write, test, deploy
npx tsc
medplum bot deploy my-bot
```

### Testing Strategy

| Layer | Tool |
|-------|------|
| Unit tests (bot logic) | `@medplum/mock` — MockClient simulates server |
| Integration tests | Local Docker Compose Medplum instance |
| E2E tests | Staging Medplum Project (isolated from production) |

---

## Migration Guides (From the Repo)

Medplum includes dedicated migration documentation at `packages/docs/docs/migration/`:

| Guide | What It Covers |
|-------|---------------|
| **Migration Planning** | Timeline, stakeholder identification, data requirements, downtime tolerance, adoption strategy (phased vs big bang) |
| **Migration Sequencing** | Recommended data loading order: Practitioner/PractitionerRole → Organization → Patient → Conditions/Medications → Encounters/Observations. Follows FHIR dependency graph. |
| **Convert to FHIR** | Reshaping source data to FHIR, using identifiers to track source system origins, handling CodeableConcepts, enriching with standard codes (ICD-10, SNOMED, LOINC) |
| **Migration Pipelines** | Building ETL infrastructure — batch vs streaming, error handling, idempotency |
| **Adoption Strategy** | Parallel adoption, active-active synchronization, cutover planning |

**OpenLoop relevance:** The sequencing guide is directly applicable — follow the dependency order when migrating from Healthie. The "Convert to FHIR" guide addresses the GraphQL → FHIR paradigm shift head-on.

---

## Deeper References

For more detail on specific subsystems, see:

- **[Server Operations](Server%20Operations.md)** — All 56 custom FHIR operations with descriptions
- **[Bots & Subscriptions](Bots%20&%20Subscriptions.md)** — Execution internals, Lambda deployment, secrets cascade, retry logic
- **[Care Plans & Tasks](Care%20Plans%20&%20Tasks.md)** — PlanDefinition $apply, Task lifecycle, $extract, workflow automation
- **[React Components](React%20Components.md)** — Full catalog of 123+ clinical UI components
- **[AI & LLM Integration](AI%20&%20LLM%20Integration.md)** — $ai operation, MCP server, Textract, Comprehend Medical
