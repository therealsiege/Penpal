> Complete catalog of all 56 custom FHIR operations supported by the Medplum server. Source: `packages/server/src/fhir/operations/`

**See also:** [Platform Overview](Platform%20Overview.md) | [Developer Experience](Developer%20Experience.md) | [Bots & Subscriptions](Bots%20&%20Subscriptions.md)

---

## Scheduling Operations

| Operation | Resource | Description | File |
|-----------|----------|-------------|------|
| `$find` | Schedule | Find available appointment slots within a date range | `operations/find.ts` |
| `$book` | Appointment | Book one or more appointment slots atomically | `operations/book.ts` |

---

## Patient & Clinical Data

| Operation | Resource | Description | File |
|-----------|----------|-------------|------|
| `$everything` | Patient | Retrieve all resources in a patient's compartment | `operations/patienteverything.ts` |
| `$summary` | Patient | Generate International Patient Summary (IPS) composition | `operations/patientsummary.ts` |
| `$ccda-export` | Patient | Export patient summary as C-CDA XML document | `operations/ccdaexport.ts` |
| `$graph` | Any | Retrieve related resources based on a GraphDefinition | `operations/resourcegraph.ts` |
| `$refresh-reference-display` | Any | Update display strings on all references within a resource | `operations/refresh-reference-display.ts` |
| `$set-accounts` | Any | Update account references for a resource and its compartment | `operations/set-accounts.ts` |

---

## Care Plan & Clinical Workflow

| Operation | Resource | Description | File |
|-----------|----------|-------------|------|
| `$apply` | PlanDefinition | Convert PlanDefinition to CarePlan + RequestGroup + Tasks for a subject | `operations/plandefinitionapply.ts` |
| `$apply` | ChargeItemDefinition | Compute prices for a ChargeItem from its definition | `operations/chargeitemdefinitionapply.ts` |
| `$evaluate-measure` | Measure | Evaluate a clinical quality measure, return MeasureReport | `operations/evaluatemeasure.ts` |

---

## Questionnaire & Data Extraction

| Operation | Resource | Description | File |
|-----------|----------|-------------|------|
| `$extract` | QuestionnaireResponse | Extract FHIR resources from completed form using embedded mappings | `operations/extract.ts` |

**OpenLoop relevance:** Critical for intake flows. QuestionnaireResponse from patient intake → `$extract` auto-generates Observation, Condition, AllergyIntolerance resources without custom bot code.

---

## Terminology Operations

| Operation | Resource | Description | File |
|-----------|----------|-------------|------|
| `$expand` | ValueSet | Expand ValueSet to get all contained codes with filtering | `operations/expand.ts` |
| `$validate-code` | ValueSet | Validate whether a code belongs to a ValueSet | `operations/valuesetvalidatecode.ts` |
| `$validate-code` | CodeSystem | Validate whether a code belongs to a CodeSystem | `operations/codesystemvalidatecode.ts` |
| `$lookup` | CodeSystem | Look up a code's display string and properties | `operations/codesystemlookup.ts` |
| `$subsumes` | CodeSystem | Test is-a relationship between two codes | `operations/subsumes.ts` |
| `$import` | CodeSystem | Batch import codes and properties into a CodeSystem | `operations/codesystemimport.ts` |
| `$translate` | ConceptMap | Translate codes from one system to another | `operations/conceptmaptranslate.ts` |
| `$import` | ConceptMap | Import concept mappings into a ConceptMap | `operations/conceptmapimport.ts` |

---

## Bulk Data & Export

| Operation | Resource | Description | File |
|-----------|----------|-------------|------|
| `$export` | System | Bulk export all resources (system-level) | `operations/export.ts` |
| `$export` | Patient | Bulk export all patient resources (type-level) | `operations/export.ts` |
| `$export` | Group | Export all resources for patients in a group | `operations/groupexport.ts` |
| `$export` | Claim | Export claim as CMS-1500 PDF | `operations/claimexport.ts` |
| CSV Export | Any | Export resources as CSV with specified columns | `operations/csv.ts` |

---

## Bot Operations

| Operation | Resource | Description | File |
|-----------|----------|-------------|------|
| `$init` | Bot | Create a new Bot with source and executable code | `operations/botinit.ts` |
| `$deploy` | Bot | Deploy bot code to Lambda or Fission | `operations/deploy.ts` |
| `$execute` | Bot | Execute a bot and return the result | `operations/execute.ts` |
| Custom | Any | Execute custom operations defined by OperationDefinition + Bot | `operations/custom.ts` |

**Custom operations pattern:** Define an `OperationDefinition` resource pointing to a Bot. Medplum routes requests to the Bot, enabling arbitrary custom FHIR operations without server modification.

---

## SMART / OAuth Operations

| Operation | Resource | Description | File |
|-----------|----------|-------------|------|
| `$smart-launch` | ClientApplication | Initiate SMART App Launch flow | `operations/launch.ts` |
| `$rotate-secret` | ClientApplication | Rotate OAuth client secret | `operations/rotatesecret.ts` |

---

## Project Management

| Operation | Resource | Description | File |
|-----------|----------|-------------|------|
| `$init` | Project | Create a new project with owner and initial config | `operations/projectinit.ts` |
| `$clone` | Project | Clone a project including selected resource types | `operations/projectclone.ts` |
| `$expunge` | Any | Hard delete — permanently removes resource and all related data | `operations/expunge.ts` |

**OpenLoop relevance:** `$init` and `$clone` are critical for client onboarding automation. Clone a template project with standard AccessPolicies, Bots, and Subscriptions for each new client.

---

## Agent Operations (On-Premise Bridge)

| Operation | Resource | Description | File |
|-----------|----------|-------------|------|
| `$status` | Agent | Get connection status and version | `operations/agentstatus.ts` |
| `$bulk-status` | Agent | Get status for multiple agents at once | `operations/agentbulkstatus.ts` |
| `$push` | Agent | Push a message to an Agent for transmission (HL7/DICOM) | `operations/agentpush.ts` |
| `$upgrade` | Agent | Upgrade Agent to a specified version | `operations/agentupgrade.ts` |
| `$fetch-logs` | Agent | Fetch logs from an Agent | `operations/agentfetchlogs.ts` |
| `$reload-config` | Agent | Reload Agent configuration | `operations/agentreloadconfig.ts` |

---

## Subscription & WebSocket

| Operation | Resource | Description | File |
|-----------|----------|-------------|------|
| `$get-ws-binding-token` | Subscription | Get WebSocket binding token for real-time updates | `operations/getwsbindingtoken.ts` |
| `$resend` | Any | Re-trigger subscription evaluation for a resource | (via `repo.resendSubscriptions()`) |
| `$get-ws-sub-stats` | System | WebSocket subscription statistics (super admin) | `operations/getwssubstats.ts` |
| `$get-ws-sub-project-stats` | System | WebSocket stats per project (super admin) | `operations/getwssubprojectstats.ts` |
| `$clear-all-ws-subs` | System | Clear all active WebSocket subscriptions (super admin) | `operations/clearallwssubs.ts` |

---

## AI Operations

| Operation | Resource | Description | File |
|-----------|----------|-------------|------|
| `$ai` | Parameters | Call OpenAI API for text generation with FHIR function calling | `operations/ai.ts` |

Supports GPT-4/3.5-turbo, streaming responses, multi-turn conversation, and FHIR-aware function calling. Useful for clinical decision support, SOAP note generation, and prior auth document drafting.

---

## User Management

| Operation | Resource | Description | File |
|-----------|----------|-------------|------|
| `$update-email` | User | Update user email with optional verification | `operations/update-user-email.ts` |

---

## Structure Definition

| Operation | Resource | Description | File |
|-----------|----------|-------------|------|
| `$expand-profile` | StructureDefinition | Expand a profile and all nested profiles it references | `operations/structuredefinitionexpandprofile.ts` |

---

## Async Jobs

| Operation | Resource | Description | File |
|-----------|----------|-------------|------|
| `$cancel` | AsyncJob | Cancel a pending async job (bulk export, etc.) | `operations/asyncjobcancel.ts` |

---

## Database Administration (Super Admin Only)

| Operation | Description | File |
|-----------|-------------|------|
| `$explain` | Explain query execution plans with optional analysis | `operations/explain.ts` |
| `$db-stats` | Show database table size and index statistics | `operations/dbstats.ts` |
| `$db-indexes` | Show GIN index configuration for tables | `operations/dbindexes.ts` |
| `$db-invalid-indexes` | Show invalid or corrupted indexes | `operations/dbinvalidindexes.ts` |
| `$db-configure-indexes` | Configure GIN index parameters | `operations/db-configure-indexes.ts` |
| `$db-column-statistics` | Show PostgreSQL query planner statistics | `operations/db-column-statistics.ts` |
| `$db-configure-column-statistics` | Configure STATISTICS target for columns | `operations/db-configure-column-statistics.ts` |
| `$schema-diff` | Generate SQL migration statements to match expected schema | `operations/dbschemadiff.ts` |

**OpenLoop relevance:** These are essential for production tuning at scale (20K+ clinicians). Use `$explain` to optimize slow queries, `$db-stats` for capacity planning.

---

## Shared Utilities (`operations/utils/`)

| Utility | Purpose |
|---------|---------|
| `asyncjobexecutor.ts` | Async job execution and status tracking |
| `agentutils.ts` | Agent request/response handling |
| `bulkexporter.ts` | Bulk data export engine |
| `binary.ts` | Binary resource handling |
| `cms1500pdf.ts` | CMS-1500 form PDF generation |
| `caredate.ts` | Care date filtering |
| `find.ts` | Slot finding algorithm |
| `parameters.ts` | Operation parameter parsing/building |
| `scheduling.ts` | Scheduling business logic |
| `scheduling-parameters.ts` | Scheduling parameter extensions |
| `terminology.ts` | CodeSystem/ValueSet utilities |
