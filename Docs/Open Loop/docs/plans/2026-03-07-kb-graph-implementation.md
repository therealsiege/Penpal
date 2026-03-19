# KB Graph Loader — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a TypeScript script that reads the OpenLoop KB (Obsidian vault), extracts entities and relationships, and loads them into Memgraph as a labeled property graph.

**Architecture:** Single script (`scripts/load-graph.ts`) with modular extraction functions. Reads all `.md` files from `~/Workspace/KB/`, parses structured content (tables, headings, lists, checkboxes), builds Cypher MERGE statements, and executes against Memgraph over Bolt. Entity data is defined in a static catalog (curated from the KB) plus dynamic extraction from file content.

**Tech Stack:** TypeScript, `tsx` runner, `neo4j-driver` (Bolt protocol to Memgraph), Node.js `fs/path` for file I/O.

**Design doc:** `docs/plans/2026-03-07-kb-graph-design.md`

---

### Task 1: Project scaffolding

**Files:**
- Create: `scripts/package.json`
- Create: `scripts/tsconfig.json`

**Step 1: Initialize the scripts directory with dependencies**

```bash
cd ~/Workspace/KB
mkdir -p scripts
cd scripts
```

Create `scripts/package.json`:

```json
{
  "name": "kb-graph-loader",
  "private": true,
  "type": "module",
  "scripts": {
    "load": "tsx load-graph.ts",
    "reload": "tsx load-graph.ts --clear",
    "validate": "tsx validate-graph.ts"
  },
  "dependencies": {
    "neo4j-driver": "^5.27.0"
  },
  "devDependencies": {
    "tsx": "^4.19.0",
    "typescript": "^5.7.0"
  }
}
```

**Step 2: Create tsconfig**

Create `scripts/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "."
  },
  "include": ["*.ts"]
}
```

**Step 3: Install dependencies**

```bash
cd ~/Workspace/KB/scripts && npm install
```

Expected: `neo4j-driver`, `tsx`, and `typescript` installed in `node_modules/`.

**Step 4: Verify Memgraph is reachable**

```bash
cd ~/Workspace/KB/scripts && npx tsx -e "
import neo4j from 'neo4j-driver';
const driver = neo4j.driver('bolt://localhost:7687');
const session = driver.session();
const result = await session.run('RETURN 1 AS n');
console.log('Connected! Result:', result.records[0].get('n').toNumber());
await session.close();
await driver.close();
"
```

Expected: `Connected! Result: 1`

**Step 5: Commit**

```bash
git add scripts/package.json scripts/tsconfig.json scripts/package-lock.json
git commit -m "chore: scaffold KB graph loader project"
```

---

### Task 2: Entity catalog — static data

**Files:**
- Create: `scripts/catalog.ts`

This file contains curated entity data extracted from the KB. Using a static catalog (rather than NLP extraction) because the KB is structured and the entities are well-known. This is the single source of truth for entity properties.

**Step 1: Create the catalog file**

`scripts/catalog.ts` defines typed arrays for each entity type. All data is hand-curated from the KB content.

The catalog should contain:

**Type definitions:**
- `DomainDef` — name, description
- `PersonDef` — name, role, org
- `OrganizationDef` — name, type (platform/vendor/partner/customer-type), description
- `TechnologyDef` — name, category (language/cloud/database/tool/protocol/framework)
- `IntegrationDef` — name, vendor, category (clinical/payments/identity/comms/observability)
- `FhirResourceDef` — name, description
- `PhaseDef` — name, number, weekRange, goal, status
- `RiskDef` — id, title, severity, mitigation
- `DecisionDef` — id, title, rationale
- `TechMappingDef` — from, to

**Data arrays (exported constants):**

`domains` — 6 entries:
- OpenLoop, Healthie, Medplum, Migration, Fhir, Campfire

`people` — 14 entries:
- Jon Lensing (CEO), Christian Williams (COO), Curtis Olson (CTO), Mohit Joshipura (CMO), Alice Shang (Chief of Staff), Jamie Gray (Head of Product), Clint Johnson (Lead Engineer), Brian (PM Payments), Nilay (Stripe), Connor (Stripe), Justin (Stripe), Jessica (Stripe), Kate (RCM), Kara (RCM)

`organizations` — 13 entries:
- OpenLoop (platform), Healthie (vendor), Medplum (vendor), Stripe (vendor), ChargeBee (vendor), Candid Health (vendor), Health Gorilla (vendor), Photon Health (vendor), Zus Health (vendor), DoseSpot (vendor), Doxy.me (vendor), AWS (vendor), Surescripts (vendor)

`technologies` — 38 entries across categories:
- Languages: TypeScript, Python
- Cloud: AWS Lambda, API Gateway, AppSync, EventBridge, SQS, SNS, Step Functions, S3, Athena, AWS CDK, ECS Fargate, ElastiCache Redis, Amazon Chime SDK, Amazon Connect
- Databases: DynamoDB, Aurora PostgreSQL, PostgreSQL
- Tools: Cursor, Claude Code, LocalStack, Excalidraw, Figma, WIZ, Linear, Jira, Datadog, Docker
- Protocols: FHIR R4, HL7v2, SMART on FHIR, OAuth2, GraphQL, Bolt, DICOM
- Frameworks: Medplum Bots, FHIR Subscriptions, Medplum SDK

`integrations` — 19 entries:
- Clinical: Epic Systems, Health Gorilla HIE, Zus Health HIE, Labcorp, Quest Diagnostics, Photon E-Prescribe, DoseSpot E-Prescribe
- Payments: Stripe Payments, Stripe Billing, ChargeBee Billing, Candid Health RCM
- Identity: Okta SSO, Auth0 SSO, Google Auth, Microsoft Entra
- Comms: eFax, Amazon Chime Telehealth, Doxy.me Telehealth
- Observability: Datadog Monitoring

`fhirResources` — 35 entries:
- Clinical: Patient, Practitioner, PractitionerRole, Organization, Encounter, Appointment, Schedule, Slot
- Clinical Data: Observation, Condition, AllergyIntolerance, MedicationRequest, MedicationDispense, ServiceRequest, DiagnosticReport, DocumentReference, CarePlan
- Workflow: Questionnaire, QuestionnaireResponse, Task, Communication
- Financial: Coverage, Claim, ExplanationOfBenefit, PaymentNotice, Account, ChargeItem, Invoice
- Identity/Consent: Consent, Contract, Provenance
- Infrastructure: Subscription, AuditEvent, Binary, OperationOutcome, Bundle

`phases` — 4 entries (Phase 0-3 from Phases.md)

`risks` — 13 entries (R1-R13 from Risks.md)

`decisions` — 8 entries (D1-D8 from Architecture.md "Key Architectural Decisions")

`techMappings` — 6 entries (Lambda->Bots, EventBridge->Subscriptions, etc.)

**Step 2: Verify file compiles**

```bash
cd ~/Workspace/KB/scripts && npx tsx -e "import * as c from './catalog.ts'; console.log('Domains:', c.domains.length, 'People:', c.people.length, 'Orgs:', c.organizations.length, 'Tech:', c.technologies.length, 'Integrations:', c.integrations.length, 'FHIR:', c.fhirResources.length, 'Phases:', c.phases.length, 'Risks:', c.risks.length, 'Decisions:', c.decisions.length)"
```

Expected: `Domains: 6 People: 14 Orgs: 13 Tech: 38 Integrations: 19 FHIR: 35 Phases: 4 Risks: 13 Decisions: 8`

**Step 3: Commit**

```bash
git add scripts/catalog.ts
git commit -m "feat: add static entity catalog for KB graph"
```

---

### Task 3: Markdown parser — file reader and document extraction

**Files:**
- Create: `scripts/parse-kb.ts`

Reads all `.md` files from the KB, classifies them (Document vs MeetingNote), extracts metadata (title, summary, folder, URLs, cross-references), and extracts action items from Campfire files.

**Step 1: Create the parser**

`scripts/parse-kb.ts` should export:

**Types:**
- `ParsedDocument` — type ("Document"|"MeetingNote"), title, summary, filePath, folder, urls (string[]), crossRefs (string[]), date?, topic?, actionItems?
- `ActionItemRaw` — description, assignee, status ("open"|"done")

**Functions:**
- `parseKB(): ParsedDocument[]` — main entry point

**Internal helpers:**
- `findMarkdownFiles(dir)` — recursively find all .md files, skipping dotfiles
- `extractTitle(content, filename)` — try H1 heading first, fall back to filename
- `extractSummary(content)` — try blockquote first, fall back to first non-empty non-heading line
- `extractUrls(content)` — regex for http/https URLs
- `extractCrossRefs(content)` — regex for markdown links to .md files `[text](path.md)`
- `extractMeetingDate(filename)` — regex for `YYYY-MM-DD` prefix in filename
- `extractMeetingTopic(filename)` — text after date separator
- `extractMeetingSummary(content)` — look for "### Meeting Context" section
- `extractActionItems(content)` — match `- [ ]` and `- [x]` lines, extract assignee from "Name to ..." pattern

**Key behavior:**
- KB root is `~/Workspace/KB/`
- Skip files in `docs/` directory (plans, not KB content)
- Campfire files (in `/Campfire/` path) become MeetingNote type
- All other .md files become Document type

**Step 2: Test the parser**

```bash
cd ~/Workspace/KB/scripts && npx tsx -e "
import { parseKB } from './parse-kb.ts';
const docs = parseKB();
console.log('Total files parsed:', docs.length);
console.log('Documents:', docs.filter(d => d.type === 'Document').length);
console.log('MeetingNotes:', docs.filter(d => d.type === 'MeetingNote').length);
const campfire = docs.find(d => d.type === 'MeetingNote');
if (campfire) {
  console.log('Sample meeting:', campfire.title, campfire.date);
  console.log('Action items:', campfire.actionItems?.length);
  console.log('Summary preview:', campfire.summary?.slice(0, 80));
}
const doc = docs.find(d => d.title.includes('Architecture'));
if (doc) {
  console.log('Sample doc:', doc.title, 'crossRefs:', doc.crossRefs.length, 'urls:', doc.urls.length);
}
"
```

Expected: ~26 files parsed (24 Documents + 2 MeetingNotes), action items extracted, cross-refs found.

**Step 3: Commit**

```bash
git add scripts/parse-kb.ts
git commit -m "feat: add KB markdown parser with document and meeting note extraction"
```

---

### Task 4: Graph loader — Cypher generation and execution

**Files:**
- Create: `scripts/load-graph.ts`

The main script. Connects to Memgraph, clears existing data (optional), creates indexes, loads catalog entities, loads parsed documents, and wires up all relationships.

**Step 1: Create the loader script**

`scripts/load-graph.ts` should have:

**Config:**
- `BOLT_URL` from env `MEMGRAPH_URL` or default `bolt://localhost:7687`
- `CLEAR` flag from `--clear` CLI arg

**Helper:**
- `run(session, query, params)` — execute a Cypher query

**Functions (called in order by `main()`):**

1. `clearGraph(session)` — `MATCH (n) DETACH DELETE n` (only if `--clear`)
2. `createIndexes(session)` — `CREATE INDEX ON :Label(property)` for all labels (Memgraph syntax)
3. Node loaders (one per entity type):
   - `loadDomains` — MERGE on name
   - `loadPeople` — MERGE on name
   - `loadOrganizations` — MERGE on name
   - `loadTechnologies` — MERGE on name
   - `loadIntegrations` — MERGE on name
   - `loadFhirResources` — MERGE on name
   - `loadPhases` — MERGE on number
   - `loadRisks` — MERGE on id
   - `loadDecisions` — MERGE on id
   - `loadDocuments` — MERGE on filePath, handles both Document and MeetingNote labels; creates ActionItem nodes for meeting notes and links with PRODUCED, also links assignees with ASSIGNED_TO via `STARTS WITH` match on Person.name
4. Relationship loaders:
   - `loadDomainContains` — Domain-[:CONTAINS]->Document/MeetingNote based on folder
   - `loadCrossRefs` — Document-[:REFERENCES]->Document using cross-ref filenames matched with `ENDS WITH`
   - `loadEmploysRelationships` — Organization-[:EMPLOYS]->Person using catalog.people org field
   - `loadOwnsRelationships` — Person-[:OWNS]->Domain (Clint -> Migration, Clint -> OpenLoop)
   - `loadUsesRelationships` — Organization-[:USES]->Technology (OpenLoop uses all, Medplum uses subset, Healthie uses GraphQL)
   - `loadProvidesRelationships` — Organization-[:PROVIDES]->Integration using vendor-to-org mapping
   - `loadTechMappings` — Technology-[:MAPS_TO]->Technology from catalog.techMappings
   - `loadMigratingFrom` — OpenLoop-[:MIGRATING_FROM]->Healthie, OpenLoop-[:MIGRATING_TO]->Medplum
   - `loadPhaseDependencies` — Phase(n)-[:DEPENDS_ON]->Phase(n-1)
   - `loadDecisionDocLinks` — Decision-[:DECIDED_IN]->Document (Architecture.md)
   - `loadMentions` — Document/MeetingNote-[:MENTIONS]->Entity by checking if entity name appears in file content (string includes check) across Technology, Organization, Integration, Person, FhirResource
   - `loadMeetingAttendees` — MeetingNote-[:ATTENDED_BY]->Person by checking if person name appears in file

**Main function:**
- Connect to Memgraph
- Optionally clear graph
- Create indexes
- Parse KB files
- Run all node loaders
- Run all relationship loaders
- Print summary (total nodes, total relationships, nodes by label)

**Step 2: Run the loader with --clear**

```bash
cd ~/Workspace/KB/scripts && npx tsx load-graph.ts --clear
```

Expected: Graph loaded with ~170+ nodes, ~300+ relationships, summary printed.

**Step 3: Verify with sample queries**

```bash
cd ~/Workspace/KB/scripts && npx tsx -e "
import neo4j from 'neo4j-driver';
const driver = neo4j.driver('bolt://localhost:7687');
const session = driver.session();
let r = await session.run('MATCH (d:Domain)-[:CONTAINS]->(doc) RETURN d.name, count(doc) AS docs ORDER BY docs DESC');
console.log('Domains:');
r.records.forEach(rec => console.log('  ', rec.get('d.name'), rec.get('docs').toNumber()));
r = await session.run('MATCH (o:Organization {name: \"OpenLoop\"})-[:USES]->(t:Technology) RETURN t.name, t.category ORDER BY t.category, t.name LIMIT 10');
console.log('OpenLoop tech (top 10):');
r.records.forEach(rec => console.log('  ', rec.get('t.category'), '-', rec.get('t.name')));
await session.close();
await driver.close();
"
```

**Step 4: Commit**

```bash
git add scripts/load-graph.ts
git commit -m "feat: add graph loader — loads KB entities and relationships into Memgraph"
```

---

### Task 5: Validation script

**Files:**
- Create: `scripts/validate-graph.ts`

A validation script that runs assertions against the loaded graph.

**Step 1: Create the validation script**

`scripts/validate-graph.ts` should:

- Connect to Memgraph
- Run assertion checks with a helper: `assert(name, query, checkFn)`
- Print pass/fail for each check
- Exit with code 1 if any fail

**Assertions to include:**

Node counts:
- 6 domains
- 14 people
- 13 organizations
- 38 technologies
- 19 integrations
- 35 FHIR resources
- 4 phases
- 13 risks
- 8 decisions
- 24+ documents
- 2+ meeting notes

Relationships:
- All 6 domains contain docs
- Cross-references exist (count > 0)
- 14 people employed
- Phase chain exists (3 phases depend on another)
- OpenLoop MIGRATING_FROM Healthie
- Tech mappings exist (>= 5)
- All 8 decisions linked to Architecture doc
- MENTIONS relationships exist (> 50)
- Action items produced from meeting notes

Semantic checks:
- EventBridge mentioned in Tech Stack doc
- Stripe provides Stripe Payments integration
- Clint owns Migration domain

**Step 2: Run validation**

```bash
cd ~/Workspace/KB/scripts && npx tsx validate-graph.ts
```

Expected: All checks pass.

**Step 3: Commit**

```bash
git add scripts/validate-graph.ts
git commit -m "feat: add graph validation script"
```

---

### Task 6: Final verification — end-to-end reload and validate

**Step 1: Run full pipeline**

```bash
cd ~/Workspace/KB/scripts && npm run reload && npm run validate
```

Expected: Clean load + all validations pass.

**Step 2: Final commit**

```bash
git add -A scripts/
git commit -m "chore: finalize KB graph loader — reload and validate scripts"
```

---

## File Summary

| File | Purpose |
|------|---------|
| `scripts/package.json` | Dependencies and run scripts |
| `scripts/tsconfig.json` | TypeScript config |
| `scripts/catalog.ts` | Static entity catalog (people, orgs, tech, integrations, FHIR, phases, risks, decisions) |
| `scripts/parse-kb.ts` | Markdown parser — reads KB files, extracts metadata, cross-refs, action items |
| `scripts/load-graph.ts` | Main loader — connects to Memgraph, creates nodes/relationships via Cypher MERGE |
| `scripts/validate-graph.ts` | Validation — asserts node counts, relationship existence, semantic correctness |

## Usage

```bash
cd ~/Workspace/KB/scripts
npm run reload    # Clear and reload graph
npm run load      # Incremental load (idempotent)
npm run validate  # Run validation checks
```
