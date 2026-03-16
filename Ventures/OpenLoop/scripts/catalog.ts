// scripts/catalog.ts
// Static entity catalog — curated from the OpenLoop KB.
// Each array is the canonical source for MERGE operations.

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface DomainDef {
  name: string;
  description: string;
}

export interface PersonDef {
  name: string;
  role: string;
  org: string;
  team?: string;       // → MEMBER_OF relationship
  reportsTo?: string;  // → REPORTS_TO relationship
}

export interface OrganizationDef {
  name: string;
  type: "platform" | "vendor" | "partner" | "customer-type";
  description: string;
}

export interface TechnologyDef {
  name: string;
  category: "language" | "cloud" | "database" | "tool" | "protocol" | "framework";
}

export interface IntegrationDef {
  name: string;
  vendor: string;
  category: "clinical" | "payments" | "identity" | "comms" | "observability";
}

export interface FhirResourceDef {
  name: string;
  description: string;
}

export interface PhaseDef {
  name: string;
  number: number;
  weekRange: string;
  goal: string;
  status: "planned" | "active" | "completed";
}

export interface RiskDef {
  id: string;
  title: string;
  severity: "high" | "medium" | "low";
  mitigation: string;
  project?: string;    // → THREATENS relationship
}

export interface DecisionDef {
  id: string;
  title: string;
  rationale: string;
  project?: string;    // → DECIDED_FOR relationship
}

export interface TechMappingDef {
  from: string;
  to: string;
}

export interface ProjectDef {
  name: string;
  status: "active" | "planned" | "completed" | "blocked";
  domain: string;
  description: string;
}

export interface TeamDef {
  name: string;
  lead: string;
  parent?: string;     // → PART_OF relationship
}

export interface IncidentDef {
  id: string;
  title: string;
  date: string;
  severity: "critical" | "major" | "minor";
  rootCause: string;
  resolution: string;
  causedBy?: string;       // Technology name → CAUSED_BY
  affectedOrgs?: string[]; // Organization names → AFFECTED
}

// ── Data ──────────────────────────────────────────────────────────────────────

export const domains: DomainDef[] = [
  { name: "OpenLoop", description: "Company overview, tech stack, payments & ESL" },
  { name: "Healthie", description: "Current EHR platform being migrated from" },
  { name: "Medplum", description: "Target FHIR R4 CDR being migrated to" },
  { name: "Migration", description: "Migration planning — phases, risks, architecture, data, validation" },
  { name: "Fhir", description: "FHIR R4 reference material and glossary" },
  { name: "Campfire", description: "Meeting notes and transcripts" },
];

export const people: PersonDef[] = [
  // Leadership
  { name: "Jon Lensing", role: "CEO / Co-Founder", org: "OpenLoop" },
  { name: "Christian Williams", role: "COO / Co-Founder", org: "OpenLoop" },
  { name: "Curtis Olson", role: "CTO", org: "OpenLoop", team: "Platform" },
  { name: "Mohit Joshipura", role: "CMO", org: "OpenLoop" },
  { name: "Alice Shang", role: "Chief of Staff", org: "OpenLoop" },
  { name: "Jamie Gray", role: "Head of Product", org: "OpenLoop", reportsTo: "Curtis Olson" },
  // Payments & Revenue
  { name: "Clint Johnson", role: "Lead Engineer — Payments & MedPlum", org: "OpenLoop", team: "Payments & Revenue", reportsTo: "Curtis Olson" },
  { name: "Brian", role: "PM — Payments (Independent Consultant)", org: "OpenLoop", team: "Payments & Revenue" },
  { name: "Alex Nima", role: "Engineer — Payments & Platform", org: "OpenLoop", team: "Payments & Revenue" },
  { name: "Scott Huff", role: "Engineer — ESL APIs", org: "OpenLoop", team: "Payments & Revenue" },
  { name: "Renato", role: "Engineer — Product Domain", org: "OpenLoop", team: "Payments & Revenue" },
  // Stripe
  { name: "Nilay", role: "Technical — Stripe Pro-Serve", org: "Stripe" },
  { name: "Connor", role: "Technical — Stripe Pro-Serve", org: "Stripe" },
  { name: "Justin", role: "Engagement Manager — Stripe", org: "Stripe" },
  { name: "Jessica", role: "Implementation Consultant — Stripe", org: "Stripe" },
  // Core Platform / Products & Services
  { name: "Shaun Wei", role: "Head of Products & Services", org: "OpenLoop", team: "Products & Services", reportsTo: "Curtis Olson" },
  { name: "Diego", role: "Engineer — EHR Facade / Customer Domain", org: "OpenLoop", team: "Core Platform" },
  { name: "Antonio", role: "Engineer", org: "OpenLoop", team: "Core Platform" },
  { name: "Lakshmi Ramamurthy", role: "Engineer", org: "OpenLoop", team: "Core Platform" },
  { name: "David Zhu", role: "Engineer — Implementation", org: "OpenLoop", team: "Products & Services" },
  { name: "Devin", role: "Product", org: "OpenLoop", team: "Products & Services" },
  { name: "Alejandro", role: "Engineer — found DynamoDB pagination bug", org: "OpenLoop", team: "Products & Services" },
  { name: "Carrie", role: "Engineer — Nashville", org: "OpenLoop", team: "Platform" },
  { name: "Matt Spalding", role: "RCM Initiatives Lead", org: "OpenLoop", team: "Products & Services" },
  // Comms Platform
  { name: "Leo", role: "Engineer — Amazon Connect", org: "OpenLoop", team: "Comms Platform" },
  { name: "NJ", role: "Engineer — Amazon Connect", org: "OpenLoop", team: "Comms Platform" },
  // RCM
  { name: "Kate", role: "RCM Team", org: "OpenLoop" },
  { name: "Kara", role: "RCM Team", org: "OpenLoop" },
  // Medplum
  { name: "Maddy Li", role: "Field Deployment Engineer (FDE)", org: "Medplum" },
  // OaksLab
  { name: "Tonda", role: "Contractor", org: "OaksLab" },
  { name: "Sergio", role: "Contractor — OMS", org: "OaksLab", team: "Products & Services" },
  // Operations / CS
  { name: "Gloria", role: "HeyRavia Representative", org: "HeyRavia" },
  { name: "Marisa", role: "Customer Support", org: "OpenLoop" },
  { name: "Rebecca", role: "Clinical Operations — Provider Outreach", org: "OpenLoop" },
  { name: "Kamal", role: "Analytics", org: "OpenLoop" },
  { name: "Josh", role: "Engineering", org: "OpenLoop" },
  { name: "Jake", role: "Operations / Billing", org: "OpenLoop" },
  { name: "Adrian", role: "OKR Owner — Clinical Efficiency", org: "OpenLoop" },
  { name: "Seth", role: "Client Success", org: "OpenLoop" },
  { name: "Bobby", role: "Product", org: "OpenLoop" },
  { name: "Goldberg", role: "IT Help Desk Lead", org: "OpenLoop" },
  { name: "Christine", role: "ID Verification", org: "OpenLoop" },
];

export const organizations: OrganizationDef[] = [
  { name: "OpenLoop", type: "platform", description: "B2B2C white-label telehealth — 20K+ clinicians, 50-state, 120+ clients" },
  { name: "Healthie", type: "vendor", description: "Current proprietary GraphQL EHR being migrated from" },
  { name: "Medplum", type: "vendor", description: "Open-source FHIR R4 CDR — migration target" },
  { name: "Stripe", type: "vendor", description: "Payment gateway — $1B+ processed, pro-serve engagement active" },
  { name: "ChargeBee", type: "vendor", description: "Subscription billing — ~12 customers" },
  { name: "Candid Health", type: "vendor", description: "Revenue cycle management — Medplum ecosystem billing partner" },
  { name: "Health Gorilla", type: "vendor", description: "HIE integration — labs, ADT, aggregated records" },
  { name: "Photon Health", type: "vendor", description: "E-prescribing — EPCS-certified" },
  { name: "Zus Health", type: "vendor", description: "HIE with analytics and longitudinal care views" },
  { name: "DoseSpot", type: "vendor", description: "Current e-prescribing via Healthie — being replaced" },
  { name: "Doxy.me", type: "vendor", description: "Current video platform — being replaced by Amazon Chime SDK" },
  { name: "AWS", type: "vendor", description: "Cloud provider — serverless architecture" },
  { name: "Surescripts", type: "vendor", description: "E-prescribing network for pharmacy connectivity" },
  { name: "HeyRavia", type: "partner", description: "Acquired AI company — call center automation, patient support and outreach" },
  { name: "Braintree", type: "vendor", description: "Payment processor — potential future ESL integration" },
  { name: "OaksLab", type: "partner", description: "Contractor team — workshop implementation, engineering support" },
  { name: "Junction", type: "vendor", description: "Automated lab ordering integration" },
  { name: "Stedi", type: "vendor", description: "RCM integration — X12/EDI" },
  { name: "XMD", type: "customer-type", description: "OpenLoop client — MWL vertical" },
  { name: "Gala", type: "customer-type", description: "OpenLoop client" },
  { name: "Taurus", type: "customer-type", description: "OpenLoop client — two-in-one rollout target" },
  { name: "Seasons", type: "partner", description: "Acquired company — registered dietitian services, insured payers" },
  { name: "RxNT", type: "vendor", description: "Current RCM tool — manual claims/EOB submission" },
  { name: "Future Health", type: "customer-type", description: "OpenLoop client — Jamie Gray came from here, FH+ API integration" },
  { name: "Triad", type: "partner", description: "Compound pharmacy — primary pharmacy partner" },
  { name: "Foothills", type: "partner", description: "Compound pharmacy — overflow/backup, ~1K orders/day capacity" },
  { name: "Precision", type: "partner", description: "Pharmacy — Woodwork orders" },
];

export const technologies: TechnologyDef[] = [
  { name: "TypeScript", category: "language" },
  { name: "Python", category: "language" },
  { name: "AWS Lambda", category: "cloud" },
  { name: "API Gateway", category: "cloud" },
  { name: "AppSync", category: "cloud" },
  { name: "EventBridge", category: "cloud" },
  { name: "SQS", category: "cloud" },
  { name: "SNS", category: "cloud" },
  { name: "Step Functions", category: "cloud" },
  { name: "S3", category: "cloud" },
  { name: "Athena", category: "cloud" },
  { name: "AWS CDK", category: "cloud" },
  { name: "ECS Fargate", category: "cloud" },
  { name: "ElastiCache Redis", category: "cloud" },
  { name: "Amazon Chime SDK", category: "cloud" },
  { name: "Amazon Connect", category: "cloud" },
  { name: "DynamoDB", category: "database" },
  { name: "Aurora PostgreSQL", category: "database" },
  { name: "PostgreSQL", category: "database" },
  { name: "Cursor", category: "tool" },
  { name: "Claude Code", category: "tool" },
  { name: "LocalStack", category: "tool" },
  { name: "Excalidraw", category: "tool" },
  { name: "Figma", category: "tool" },
  { name: "WIZ", category: "tool" },
  { name: "Linear", category: "tool" },
  { name: "Jira", category: "tool" },
  { name: "Datadog", category: "tool" },
  { name: "Docker", category: "tool" },
  { name: "FHIR R4", category: "protocol" },
  { name: "HL7v2", category: "protocol" },
  { name: "SMART on FHIR", category: "protocol" },
  { name: "OAuth2", category: "protocol" },
  { name: "GraphQL", category: "protocol" },
  { name: "Bolt", category: "protocol" },
  { name: "DICOM", category: "protocol" },
  { name: "Medplum Bots", category: "framework" },
  { name: "FHIR Subscriptions", category: "framework" },
  { name: "Medplum SDK", category: "framework" },
  { name: "AWS CodeArtifact", category: "cloud" },
  { name: "Mintlify", category: "tool" },
  { name: "Husky", category: "tool" },
  { name: "OpenSearch", category: "database" },
  { name: "Fathom", category: "tool" },
  { name: "Miro", category: "tool" },
  { name: "PlanDefinition", category: "framework" },
  { name: "Telescope", category: "tool" },
  { name: "Tableau", category: "tool" },
  { name: "Rippling", category: "tool" },
];

export const integrations: IntegrationDef[] = [
  { name: "Epic Systems", vendor: "Epic", category: "clinical" },
  { name: "Health Gorilla HIE", vendor: "Health Gorilla", category: "clinical" },
  { name: "Zus Health HIE", vendor: "Zus Health", category: "clinical" },
  { name: "Labcorp", vendor: "Health Gorilla", category: "clinical" },
  { name: "Quest Diagnostics", vendor: "Health Gorilla", category: "clinical" },
  { name: "Photon E-Prescribe", vendor: "Photon Health", category: "clinical" },
  { name: "DoseSpot E-Prescribe", vendor: "DoseSpot", category: "clinical" },
  { name: "Stripe Payments", vendor: "Stripe", category: "payments" },
  { name: "Stripe Billing", vendor: "Stripe", category: "payments" },
  { name: "ChargeBee Billing", vendor: "ChargeBee", category: "payments" },
  { name: "Candid Health RCM", vendor: "Candid Health", category: "payments" },
  { name: "Okta SSO", vendor: "Okta", category: "identity" },
  { name: "Auth0 SSO", vendor: "Auth0", category: "identity" },
  { name: "Google Auth", vendor: "Google", category: "identity" },
  { name: "Microsoft Entra", vendor: "Microsoft", category: "identity" },
  { name: "eFax", vendor: "eFax", category: "comms" },
  { name: "Amazon Chime Telehealth", vendor: "AWS", category: "comms" },
  { name: "Doxy.me Telehealth", vendor: "Doxy.me", category: "comms" },
  { name: "Datadog Monitoring", vendor: "Datadog", category: "observability" },
  { name: "Zoho Desk", vendor: "Zoho", category: "comms" },
  { name: "Junction Labs", vendor: "Junction", category: "clinical" },
  { name: "Stedi RCM", vendor: "Stedi", category: "payments" },
];

export const fhirResources: FhirResourceDef[] = [
  { name: "Patient", description: "Demographics, identifiers, contacts" },
  { name: "Practitioner", description: "Provider demographics, qualifications" },
  { name: "PractitionerRole", description: "Provider-org link — specialty, location, schedule" },
  { name: "Organization", description: "Healthcare organizations (OpenLoop clients)" },
  { name: "Encounter", description: "Patient-practitioner interaction (telehealth visit)" },
  { name: "Appointment", description: "Scheduled future encounter" },
  { name: "Schedule", description: "Available time slots for booking" },
  { name: "Slot", description: "Individual bookable time window" },
  { name: "Observation", description: "Measurements — vitals, lab values, assessments" },
  { name: "Condition", description: "Active/resolved diagnoses" },
  { name: "AllergyIntolerance", description: "Allergies and adverse reactions" },
  { name: "MedicationRequest", description: "Prescriptions (replaces DoseSpot)" },
  { name: "MedicationDispense", description: "Pharmacy dispensing records" },
  { name: "ServiceRequest", description: "Orders for labs, imaging, referrals" },
  { name: "DiagnosticReport", description: "Lab results, imaging reports" },
  { name: "DocumentReference", description: "Clinical documents, PDFs, scanned forms" },
  { name: "CarePlan", description: "Treatment plans with goals and activities" },
  { name: "Questionnaire", description: "Form definitions (intake, assessments)" },
  { name: "QuestionnaireResponse", description: "Patient answers to a Questionnaire" },
  { name: "Task", description: "Workflow tasks assigned to practitioners" },
  { name: "Communication", description: "Messages between patients and practitioners" },
  { name: "Coverage", description: "Patient insurance coverage" },
  { name: "Claim", description: "Submitted insurance claims" },
  { name: "ExplanationOfBenefit", description: "Payer response to a claim" },
  { name: "PaymentNotice", description: "Payment notifications" },
  { name: "Account", description: "Patient billing account" },
  { name: "ChargeItem", description: "Individual charges linked to encounters" },
  { name: "Invoice", description: "Maps to Stripe invoices for subscriptions" },
  { name: "Consent", description: "Patient consent decisions" },
  { name: "Contract", description: "BAAs, service agreements" },
  { name: "Provenance", description: "Who did what to which resource" },
  { name: "Subscription", description: "Event-driven notifications on resource changes" },
  { name: "AuditEvent", description: "Immutable log of system activity" },
  { name: "Binary", description: "Raw files (PDFs, images)" },
  { name: "OperationOutcome", description: "Structured error/success messages" },
  { name: "Bundle", description: "Container for multiple resources" },
  { name: "PlanDefinition", description: "Clinical protocol template — $apply generates CarePlan/Tasks" },
  { name: "MedicationKnowledge", description: "Drug catalog — compartment-tagged per client for med lists" },
  { name: "MedicationAdministration", description: "Record of patient ingesting medication" },
  { name: "MedicationStatement", description: "Summary of medication usage" },
  { name: "ClinicalImpression", description: "Unstructured clinical notes (Medplum-recommended)" },
  { name: "Goal", description: "Measurable patient target (e.g., weight goal)" },
  { name: "RiskAssessment", description: "Clinical risk propensity measurement" },
  { name: "CareTeam", description: "Group of providers assembled for a patient" },
  { name: "HealthcareService", description: "Represents verticals (MWL, TRT) for tenancy" },
  { name: "Immunization", description: "Vaccine records (CVX codes)" },
  { name: "CommunicationRequest", description: "Request for patient communication or education" },
];

export const phases: PhaseDef[] = [
  { name: "Foundation", number: 0, weekRange: "Weeks 1-4", goal: "Medplum on AWS, team trained, abstraction scaffolded", status: "planned" },
  { name: "Pilot Migration", number: 1, weekRange: "Weeks 5-12", goal: "One client live on Medplum", status: "planned" },
  { name: "Expand & Harden", number: 2, weekRange: "Weeks 13-24", goal: "50%+ clients migrated, API feature-complete", status: "planned" },
  { name: "Cutover & Decommission", number: 3, weekRange: "Weeks 25-36", goal: "Healthie decommissioned, full Medplum", status: "planned" },
];

export const risks: RiskDef[] = [
  { id: "R1", title: "Data loss or corruption during ETL", severity: "high", mitigation: "Validation suite, cross-reference table, dry-run mode, transaction bundles", project: "MedPlum Migration" },
  { id: "R2", title: "Patient visit disruption during dual-run", severity: "high", mitigation: "Clear SoR designation, no dual-write, per-client cutover, rollback plan", project: "MedPlum Migration" },
  { id: "R3", title: "FHIR data model gaps", severity: "high", mitigation: "Audit features per client, use FHIR Extensions, deprioritize low-usage", project: "MedPlum Migration" },
  { id: "R4", title: "Engineering team FHIR learning curve", severity: "high", mitigation: "Phase 0 training, FHIR Glossary, MCP tools, tiger team, pairing", project: "MedPlum Migration" },
  { id: "R5", title: "Healthie API rate limits during bulk export", severity: "medium", mitigation: "Request increase, stagger exports, backoff/retry, off-peak, checkpoints", project: "MedPlum Migration" },
  { id: "R6", title: "Medplum performance at OpenLoop scale", severity: "high", mitigation: "Load test Phase 2, Fargate auto-scaling, Aurora replicas, Redis, Datadog", project: "MedPlum Migration" },
  { id: "R7", title: "Abstraction layer becomes too complex", severity: "high", mitigation: "Start with one domain, 1:1 mappings, GraphQL support, code-gen, phase gate review", project: "MedPlum Migration" },
  { id: "R8", title: "Client integration breakage", severity: "high", mitigation: "Abstraction insulation, contract testing, API versioning, per-client QA, canary", project: "MedPlum Migration" },
  { id: "R9", title: "Compliance gap during transition", severity: "high", mitigation: "Medplum SOC 2/HIPAA, AuditEvent, AccessPolicy, audit scope expansion", project: "MedPlum Migration" },
  { id: "R10", title: "Healthie contract/timeline pressure", severity: "medium", mitigation: "Understand terms, negotiate extension, budget dual-run", project: "MedPlum Migration" },
  { id: "R11", title: "Provider network data sync (20K+ clinicians)", severity: "medium", mitigation: "Provider data in abstraction layer or shared Project, Phase 0 decision", project: "MedPlum Migration" },
  { id: "R12", title: "EPCS certification validation", severity: "medium", mitigation: "Test Phase 1, verify DEA, validate pharmacy network, keep DoseSpot fallback", project: "MedPlum Migration" },
  { id: "R13", title: "Scope creep (known org challenge)", severity: "high", mitigation: "Define done per phase, phase gates, separate backlogs, new-on-Medplum rule", project: "MedPlum Migration" },
];

export const decisions: DecisionDef[] = [
  { id: "D1", title: "MedPlum as internal FHIR layer", rationale: "Not exposed directly to most customers — behind Partners API", project: "MedPlum Migration" },
  { id: "D2", title: "Partners API as the product surface", rationale: "Domain-friendly REST for the 85% of non-healthcare customers", project: "MedPlum Migration" },
  { id: "D3", title: "Direct FHIR access for health systems", rationale: "API key to MedPlum instance for future enterprise customers", project: "MedPlum Migration" },
  { id: "D4", title: "Bots for integration logic", rationale: "Maps to existing Lambda patterns — serverless-native", project: "MedPlum Migration" },
  { id: "D5", title: "Event Gateway to ESB canonical events", rationale: "Vendor-agnostic events on Enterprise Service Bus", project: "Payments ESL" },
  { id: "D6", title: "Multi-tenant via MedPlum Projects", rationale: "Each client gets isolated data and access policies", project: "MedPlum Migration" },
  { id: "D7", title: "Payments replication into MedPlum", rationale: "ESL is SoR for payments, data replicates to CDR for holistic view", project: "Payments ESL" },
  { id: "D8", title: "Separate repos + accounts per domain", rationale: "Enforces boundaries, prevents cross-domain dependencies", project: "Payments ESL" },
  { id: "D9", title: "Cloud-hosted MedPlum over self-hosted", rationale: "Security team preference — reduces operational burden and attack surface", project: "MedPlum Migration" },
  { id: "D10", title: "Medical Weight Loss as first migration vertical", rationale: "Highest volume, well-understood workflow, good tenancy test case", project: "MedPlum Migration" },
  { id: "D11", title: "Organization = Client, HealthcareService = Vertical for tenancy", rationale: "meta.compartment + _compartment search for data isolation", project: "MedPlum Migration" },
  { id: "D12", title: "Main Questionnaire per vertical with Concept IDs", rationale: "linkId maps to atomic OpenLoop Concept IDs; clients customize wording not semantics", project: "MedPlum Migration" },
  { id: "D13", title: "PlanDefinition$apply for clinical protocol automation", rationale: "Moves business logic from code to editable FHIR data managed by non-technical staff", project: "MedPlum Migration" },
  { id: "D14", title: "Parameterized AccessPolicy for multi-tenant access", rationale: "Single policy template, parameterized per ProjectMembership with customer_organization", project: "MedPlum Migration" },
  { id: "D15", title: "Payments domain as sole Stripe entry point (black box)", rationale: "No other service calls Stripe directly — keeps system payment-provider-agnostic for future ChargeBee/Braintree support", project: "Payments ESL" },
  { id: "D16", title: "Aggregator + à la carte dual-layer API pattern", rationale: "Core endpoints exist independently; consumer-specific aggregators (Zoho, ClinicApp) compose them with different input formats", project: "Payments ESL" },
];

export const techMappings: TechMappingDef[] = [
  { from: "AWS Lambda", to: "Medplum Bots" },
  { from: "EventBridge", to: "FHIR Subscriptions" },
  { from: "API Gateway", to: "API Gateway" },
  { from: "Aurora PostgreSQL", to: "PostgreSQL" },
  { from: "S3", to: "Athena" },
  { from: "AWS CDK", to: "AWS CDK" },
];

// ── New: Projects ─────────────────────────────────────────────────────────────

export const projects: ProjectDef[] = [
  { name: "MedPlum Migration", status: "active", domain: "Migration", description: "Healthie → MedPlum FHIR R4 CDR migration" },
  { name: "Payments ESL", status: "active", domain: "OpenLoop", description: "Enterprise Service Layer — Stripe abstraction, multi-provider payment gateway" },
  { name: "Program Catalog", status: "active", domain: "OpenLoop", description: "Products/prices per org in DynamoDB, async sync to Stripe" },
  { name: "OMS", status: "planned", domain: "OpenLoop", description: "Order Management System — scheduled orders, pharmacy routing, visibility" },
  { name: "Patient Self-Service", status: "blocked", domain: "OpenLoop", description: "Subscription updates, pause, address change, medication change" },
  { name: "HeyRavia Automation", status: "active", domain: "OpenLoop", description: "Cancellation, rescheduling, refund automation via AI" },
  { name: "Client Ticketing", status: "active", domain: "OpenLoop", description: "Slack→ticket conversion for client support — Rouge, Vavoro, Velvet pilot" },
  { name: "RCM Automation", status: "planned", domain: "OpenLoop", description: "Automate claims, EOBs, reconciliation — replace manual RxNT" },
  { name: "Video Platform", status: "active", domain: "OpenLoop", description: "Doxy.me → Amazon Chime SDK + Connect migration" },
];

// ── New: Teams ────────────────────────────────────────────────────────────────

export const teams: TeamDef[] = [
  { name: "Platform", lead: "Curtis Olson" },
  { name: "Products & Services", lead: "Shaun Wei" },
  { name: "Payments & Revenue", lead: "Curtis Olson", parent: "Platform" },
  { name: "Core Platform", lead: "Curtis Olson", parent: "Platform" },
  { name: "Integrations", lead: "Curtis Olson", parent: "Platform" },
  { name: "Data Platform", lead: "Curtis Olson", parent: "Platform" },
  { name: "Infrastructure", lead: "Curtis Olson", parent: "Platform" },
  { name: "Comms Platform", lead: "Curtis Olson", parent: "Platform" },
];

// ── New: Incidents ────────────────────────────────────────────────────────────

export const incidents: IncidentDef[] = [
  {
    id: "INC-1",
    title: "Scheduled orders DynamoDB pagination failure",
    date: "2026-03-11",
    severity: "critical",
    rootCause: "DynamoDB query() paginates like scan() — cron only processed first page (~640 orders/day)",
    resolution: "Fix pagination, reroute ~1K orders from Triad to Foothills by swapping formulary IDs",
    causedBy: "DynamoDB",
    affectedOrgs: ["Triad", "Foothills", "Precision"],
  },
];
