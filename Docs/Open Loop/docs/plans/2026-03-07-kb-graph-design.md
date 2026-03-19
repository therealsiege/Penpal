# Design: OpenLoop KB as Labeled Property Graph in Memgraph

**Date:** 2026-03-07
**Status:** Approved
**Author:** Clint Johnson + Claude

---

## Goal

Load the OpenLoop knowledgebase (Obsidian vault at `~/Workspace/KB/`) into a local Memgraph instance as a labeled property graph. The graph serves as both:

1. **AI context retrieval** — Claude/agents traverse the graph to find relevant KB context
2. **Visual exploration** — Memgraph Lab for navigating relationships between systems, people, tech, migration phases

## Approach: Document-Anchored Entity Graph

Documents are the anchors. Entities are extracted from structured content (tables, headings, lists) and linked back to their source documents AND to each other. Folder structure becomes Domain nodes.

---

## Node Labels & Properties

### Domain
Represents a top-level folder / knowledge area.

| Property | Type | Description |
|----------|------|-------------|
| `name` | string | Folder name (e.g., "Migration", "Medplum") |
| `description` | string | Brief description of the domain |

### Document
A KB markdown file (non-Campfire).

| Property | Type | Description |
|----------|------|-------------|
| `title` | string | Derived from H1 heading or filename |
| `summary` | string | First paragraph or blockquote |
| `filePath` | string | Absolute path to .md file |
| `folder` | string | Parent folder name |
| `urls` | string[] | External URLs referenced in the document |

### MeetingNote
A Campfire meeting transcript/notes file.

| Property | Type | Description |
|----------|------|-------------|
| `title` | string | Filename-derived (e.g., "Payment System") |
| `date` | string | ISO date from filename |
| `topic` | string | Derived from filename after date |
| `summary` | string | Content of "Meeting Context" section |
| `filePath` | string | Absolute path to .md file |

### ActionItem
Extracted from meeting note checkbox items.

| Property | Type | Description |
|----------|------|-------------|
| `description` | string | The action item text |
| `assignee` | string | Person responsible (if mentioned) |
| `status` | string | "open" or "done" (from checkbox state) |

### Person
A named individual mentioned in the KB.

| Property | Type | Description |
|----------|------|-------------|
| `name` | string | Full name |
| `role` | string | Job title or function |
| `org` | string | Organization name |

### Organization
A company, platform, or vendor.

| Property | Type | Description |
|----------|------|-------------|
| `name` | string | Organization name |
| `type` | string | platform / vendor / partner / customer-type |
| `description` | string | Brief description |

### Technology
A language, cloud service, database, tool, or protocol.

| Property | Type | Description |
|----------|------|-------------|
| `name` | string | Technology name |
| `category` | string | language / cloud / database / tool / protocol / framework |

### Integration
An external system integration.

| Property | Type | Description |
|----------|------|-------------|
| `name` | string | Integration name |
| `vendor` | string | Providing organization |
| `category` | string | clinical / payments / identity / comms / observability |

### FhirResource
A FHIR R4 resource type.

| Property | Type | Description |
|----------|------|-------------|
| `name` | string | Resource name (e.g., "Patient", "MedicationRequest") |
| `description` | string | Brief purpose |

### Phase
A migration phase from the phased roadmap.

| Property | Type | Description |
|----------|------|-------------|
| `name` | string | Phase name (e.g., "Foundation") |
| `number` | int | 0-3 |
| `weekRange` | string | "Weeks 1-4" |
| `goal` | string | Phase objective |
| `status` | string | planned / active / completed |

### Risk
An identified migration risk.

| Property | Type | Description |
|----------|------|-------------|
| `id` | string | Risk identifier |
| `title` | string | Risk title |
| `severity` | string | high / medium / low |
| `mitigation` | string | Mitigation strategy |

### Decision
A key architectural decision.

| Property | Type | Description |
|----------|------|-------------|
| `id` | string | Decision identifier |
| `title` | string | Decision title |
| `rationale` | string | Why this decision was made |

---

## Relationship Types

| Relationship | From | To | Description |
|-------------|------|----|-------------|
| `CONTAINS` | Domain | Document/MeetingNote | Folder contains file |
| `REFERENCES` | Document | Document | Markdown cross-link between files |
| `MENTIONS` | Document/MeetingNote | any entity | Document discusses this entity |
| `EMPLOYS` | Organization | Person | Person works at org |
| `OWNS` | Person | Domain | Person is responsible for domain |
| `USES` | Organization | Technology | Org uses this tech |
| `PROVIDES` | Organization | Integration | Vendor provides integration |
| `MAPS_TO` | Technology | Technology | Stack alignment (e.g., Lambda maps to Bots) |
| `MIGRATING_FROM` | Organization | Organization | Platform migration direction |
| `INTEGRATES_WITH` | Integration | Organization | Integration connects to platform |
| `DEPENDS_ON` | Phase | Phase | Phase sequencing |
| `DELIVERS` | Phase | Technology/Integration | Phase delivers capability |
| `MITIGATED_BY` | Risk | Decision | Decision addresses risk |
| `DECIDED_IN` | Decision | Document | Decision documented here |
| `REPRESENTED_BY` | Integration | FhirResource | FHIR resources for integration |
| `PRODUCED` | MeetingNote | ActionItem | Meeting produced this action item |
| `ATTENDED_BY` | MeetingNote | Person | Person attended meeting |
| `DISCUSSES` | MeetingNote | Document | Meeting relates to KB topic |

---

## Implementation

### Language & Driver
- **TypeScript** script using `neo4j-driver` (compatible with Memgraph Bolt protocol)
- Run with `npx tsx`
- Source: `~/Workspace/KB/scripts/load-graph.ts`

### Entity Extraction Strategy
Pattern matching on structured content (tables, headings, lists). The KB is highly structured:
- People: extracted from team tables and mentions
- Technologies: from Tech Stack tables, "Cloud & Infrastructure" tables
- Integrations: from integration tables across Medplum and OpenLoop docs
- FHIR Resources: from FHIR Glossary and capability tables
- Phases: from Phases.md structured sections
- Risks: from Risks.md
- Decisions: from "Key Architectural Decisions" numbered lists
- Organizations: from context (OpenLoop, Healthie, Medplum, Stripe, etc.)

### Idempotency
All writes use Cypher `MERGE` (not `CREATE`) so the script can be re-run as the KB evolves without duplicating nodes. Nodes are matched on their natural key (name for entities, filePath for documents).

### Execution Target
- Memgraph at `bolt://localhost:7687` (already running via Docker)
- No auth required (default Memgraph config)

---

## Example Cypher Queries

```cypher
// What technologies does OpenLoop use?
MATCH (o:Organization {name: "OpenLoop"})-[:USES]->(t:Technology)
RETURN t.name, t.category ORDER BY t.category;

// What documents discuss EventBridge?
MATCH (d:Document)-[:MENTIONS]->(t:Technology {name: "EventBridge"})
RETURN d.title, d.filePath;

// Show the migration phase dependency chain
MATCH path = (p1:Phase)-[:DEPENDS_ON*]->(p2:Phase)
RETURN path;

// What risks are mitigated by which decisions?
MATCH (r:Risk)-[:MITIGATED_BY]->(d:Decision)-[:DECIDED_IN]->(doc:Document)
RETURN r.title, d.title, doc.title;

// Find all action items assigned to Clint
MATCH (a:ActionItem {assignee: "Clint"})<-[:PRODUCED]-(m:MeetingNote)
RETURN a.description, a.status, m.date, m.topic;

// Navigate: Domain -> Documents -> Entities
MATCH (dom:Domain {name: "Migration"})-[:CONTAINS]->(doc:Document)-[:MENTIONS]->(e)
RETURN doc.title, labels(e)[0] AS entityType, e.name;
```

---

## Graph Visualization (Memgraph Lab)

The graph will be explorable in Memgraph Lab at `http://localhost:3000` (already running). Color coding by label:
- Domains: blue
- Documents/MeetingNotes: gray
- People: green
- Organizations: orange
- Technologies: purple
- Integrations: teal
- FhirResources: red
- Phases: yellow
- Risks: crimson
- Decisions: gold
