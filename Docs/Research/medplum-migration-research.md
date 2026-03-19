# Medplum Deep Research: Migration Patterns, Use Cases & Competitive Intelligence
**Research Date**: March 14, 2026
**Purpose**: Lead magnet foundation for "Medplum Migration Guide" — 1Putt Health consulting
**Research Scope**: Platform overview, adoption patterns, migration pathways, pain points, competitive landscape

---

## SECTION 1: MEDPLUM OVERVIEW

### 1.1 What is Medplum?

**Medplum** is an open-source, API-first FHIR-native electronic health record (EHR) platform designed for developers and healthcare technology companies. It enables rapid development of HIPAA-compliant, interoperable healthcare applications without building from scratch.

**Key Characteristics:**
- **FHIR-Native Architecture**: Entire platform built around FHIR (Fast Healthcare Interoperability Resources) standard
- **Headless/Backend-Only**: Provides data layer and APIs; customers build their own clinical UIs
- **Developer-First**: Targets technical teams comfortable with TypeScript, APIs, and custom development
- **Open Source**: Apache 2.0 licensed with both self-hosted and managed cloud options
- **Modern Stack**: Node.js, PostgreSQL, cloud-native containerized architecture

### 1.2 Company Background

**Founding & Leadership:**
- Founded in 2021 by Reshma Khilnani (CEO), Cody Ebberson, and Rahul Agarwal
- Y Combinator S22 batch
- Three co-founders with healthcare technology pedigree:
  - **Reshma Khilnani**: Co-founder of MedXT (YC W13, acquired by Box), VP at YC, early career at Facebook/Microsoft
  - **Cody Ebberson**: Director of Engineering at One Medical, Healthcare Lead at Box, Harvard MBA
  - **Rahul Agarwal**: ML engineer at Palantir, Customer Impact at Applied Intuition

**Company Stage & Growth:**
- Community expanded rapidly in 2024:
  - GitHub stars: 2.2k (grew by 1,500 stars through 2024)
  - GitHub forks: 707
  - GitHub contributors: 115 (5x growth in 2024)
  - Discord community: 1,076 users (13x growth in 2024)
  - Maintainer team: 11 strong and growing

**Business Model:**
- Open source with optional managed service (Medplum Hosted)
- Freemium for development/testing
- Paid tiers for production deployments

---

## SECTION 2: PRICING & LIMITATIONS

### 2.1 Pricing Model

**Three Tiers:**
1. **Test Usage** (Free tier)
   - Low-volume development and testing
   - Limited concurrent subscriptions
   - Community support

2. **Growth Usage** (Paid)
   - Production deployments starting ~$2,000/month
   - Moderate data storage and API throughput
   - Email support

3. **Enterprise** (Custom)
   - Large-scale deployments
   - Premium support, SLAs
   - Dedicated infrastructure options

**Usage Metrics:**
- Websocket Subscriptions measured as max concurrent count
- API calls/data storage tiered
- Bot Invocations charged separately (custom logic execution)

### 2.2 Key Limitations Driving Migrations

**Technical Constraints:**
1. **No Custom Resource Types**: Cannot define entirely new resource types; limited to FHIR standard resources with extensions
2. **No Custom Search Parameters**: Limited ability to optimize search performance for specialized use cases
3. **FHIR Profile Validation Cost**: Running profile validation on every write can impact performance at scale
4. **Search Depth Constraints**: Chained searches have depth limitations to prevent performance issues (e.g., _include, _revinclude depth limits)
5. **Profile Complexity**: FHIR profile authoring requires understanding StructureDefinition or FHIR Shorthand (FSH)

**Operational Constraints:**
1. **Self-Hosting Complexity**: While possible, requires DevOps expertise (Docker, Kubernetes, cloud infrastructure)
2. **Developer-Only Fit**: Not suitable for organizations with no technical resources; requires hiring/partnering with developers
3. **Pre-built UI Gaps**: No out-of-the-box clinical interfaces; all UI must be custom-built
4. **Learning Curve**: Healthcare teams need to understand FHIR concepts, resources, and references

**Business Constraints:**
1. **Pricing Escalation**: Costs scale with usage; high-volume operations can become expensive
2. **Limited Features-as-Service**: For niche workflows (e.g., specific specialty workflows), you may need to build custom solutions
3. **Startup Cost**: MVP development still requires developer resources despite platform benefits

---

## SECTION 3: KEY FEATURES & CAPABILITIES

### 3.1 Core Platform Features

**FHIR Data Model**
- All data stored as FHIR resources (Patient, Observation, Condition, MedicationRequest, etc.)
- Out-of-box support for US Core profiles and USCDI (US Core Data for Interoperability)
- Custom FHIR extensions supported
- FHIR profiles/StructureDefinitions can be uploaded and validated

**Automation & Workflows**
- **Bots**: JavaScript code snippets triggered on resource creation/update
  - Run as sandboxed AWS Lambdas
  - Full Medplum client access for complex logic
  - Paid feature on Medplum Hosted
  - Common uses: data transformation, external system integration, validation rules

- **Subscriptions**: Event-driven webhooks
  - FHIR Subscriptions triggered on resource changes
  - Full JSON resource payloads posted to endpoints
  - HMAC signature support for security
  - Websocket subscriptions for real-time updates

**Access Control**
- **AccessPolicy Resource**: FHIR-native fine-grained access control
  - Define what users can access, read, write, delete
  - Row-level security (RLS) compatible
  - Can be applied to Bots for least-privilege automation
  - Compartment-based access patterns (patient, provider, organization)

**Interoperability**
- FHIR APIs (RESTful, standard operations)
- Bulk FHIR API for export/import (NDJSON format)
- SMART on FHIR support for third-party app integration
  - OAuth 2.0 with PKCE for mobile/web apps
  - SMART scopes for granular permissions
  - Demo implementations available
- Health Gorilla integration (lab orders, results delivery)
- HL7 v2, SFTP, CDA support through integration engine
- Custom FHIR operations support

**Authentication & Authorization**
- OAuth 2.0, OIDC
- SAML support
- SMART on FHIR scopes
- Project-based multi-tenancy with isolation

### 3.2 Developer Experience Features

**SDKs & Libraries**
- TypeScript/JavaScript client library
- React components for healthcare UIs (form builders, data displays)
- Design system for consistent UI patterns
- CLI for data import/export and project management

**Documentation & Community**
- Comprehensive docs at medplum.com/docs
- Active GitHub discussions
- Blog with implementation guides
- Case studies and reference architectures
- Demo repositories (Medplum Hello World, demo-bots)

---

## SECTION 4: WHO USES MEDPLUM & WHY

### 4.1 Target User Profile

**Ideal Customers:**
- Digital health startups (Series A-C) building specialized EHRs
- Healthcare technology companies needing backend infrastructure
- Medical device companies needing data aggregation
- Telehealth/RPM (Remote Patient Monitoring) platforms
- Specialty-focused practices wanting custom workflows
- Organizations seeking FHIR-first interoperability

**Team Requirements:**
- Strong technical team (product engineers, backend developers)
- Understanding of FHIR concepts and healthcare workflows
- Ability to build custom UIs (not using pre-built interfaces)
- DevOps capabilities for self-hosting (optional but common)

### 4.2 Real-World Case Studies

**Quilted Health**
- **Use Case**: Building comprehensive EHR for streamlined care coordination
- **Challenged By**: Previous system limitations on interoperability
- **Medplum Choice**: Headless architecture for complete customization + FHIR future-proofing
- **Key Benefit**: Seamless interoperability with external providers and labs

**Rewind (Type 2 Diabetes Management)**
- **Migration Trigger**: Outgrew simpler EHR platforms
- **Previous System**: Limited clinical documentation, basic patient access, inflexible workflows
- **Medplum Solution**: Tailored clinical documentation, enhanced metrics, customized workflows aligned to team productivity
- **Key Benefit**: Agile front-end with HIPAA-compliant backend; team could iterate on UX

**Healthcare Company (Healthie Replacement)**
- **Trigger**: Needed FHIR compliance beyond Healthie's capabilities
- **Solution**: Fully customizable Medplum-based system
- **Improvements**: Better charting, provider messaging, patient interactions

**Digital Health Startups (General)**
- Rapid MVP development for proof-of-concept
- Minimal upfront licensing costs for early validation
- Interoperability-by-default for health system integrations

---

## SECTION 5: MIGRATION PATHWAYS & PATTERNS

### 5.1 Common Migration Scenarios: TO Medplum

**From Legacy Systems:**
- From Mirth Connect (HL7 integration engine) → Medplum
- From simpler EHR platforms (Healthie, etc.) → Medplum for FHIR compliance
- From generic healthcare backends → Medplum for FHIR-native approach
- From Cerner/Epic custom extensions → Medplum for vendor-independent solution

**From Competing Platforms:**
- Canvas Medical → Medplum (cost, customization control)
- Healthie → Medplum (deeper FHIR support, flexibility)
- Commercial FHIR servers → Medplum (cost, open-source control)

### 5.2 Common Migration Scenarios: FROM Medplum

**When companies migrate away:**
1. **Outgrow developer-first model**: Need pre-built clinical workflows and UIs
2. **Scale/performance needs**: Hit limits on custom resource types or search optimization
3. **Enterprise vendor lock-in preference**: Prefer vendor support guarantees (Smile CDR, Google Cloud Healthcare API)
4. **Cost escalation**: Usage-based pricing becomes expensive at scale; prefer predictable licensing
5. **Non-technical leadership**: Require no-code/low-code solutions; Medplum's developer-first model too rigid
6. **Specialty-specific solutions**: Orthopedic, dental, mental health practices may prefer vertical solutions

### 5.3 Medplum's Recommended Migration Strategy: Phased Adoption

**Approach**: Run both old and new systems in parallel with predetermined sequence of small, focused cutover activities

**Advantages:**
- Lowest risk to business operations
- Team confidence building through small wins
- Testing in production-like environment
- Ability to rollback if issues arise
- Staff training without "big bang" risk

**Sequence**:
1. Start with non-critical data/workflows
2. Proceed business-unit or team-by-team
3. Final cutover only after stabilization
4. Maintain fallback to legacy system during transition

---

## SECTION 6: MIGRATION PAIN POINTS & CHALLENGES

### 6.1 Data Mapping & FHIR Conversion

**Core Challenge**: Mapping legacy data schemas to FHIR resources

**Specific Pain Points:**
1. **FHIR Dependency Graph**: Data split across multiple resources with references
   - Example: Patient → has Conditions → has MedicationRequests → have Medications
   - Must migrate in dependency order to maintain referential integrity
   - Failing to sequence properly creates dangling references

2. **Unique Identifier Problem**
   - Legacy system IDs don't match Medplum-assigned IDs
   - Solution: Use FHIR conditional references during migration
   - Challenge: Tracking mapping between old IDs and new FHIR resource IDs

3. **Data Format Transformation**
   - Date/time formats (ISO 8601 requirements in FHIR)
   - Name structures (full name vs. first/middle/last)
   - Code systems (legacy codes → LOINC, SNOMED CT, etc.)
   - Numeric precision and units

4. **Incomplete/Ambiguous Data**
   - Legacy systems with inconsistent data quality
   - Missing required FHIR fields
   - Interpretive decisions needed (e.g., is this field a Condition or Observation?)

**Industry Context**: Deloitte 2023 reported >75% of digital health startups cite integration/data standards challenges as major barriers to scale

### 6.2 FHIR Resource Compatibility

**Challenges:**
1. **Non-Standard Workflows**: Organization's workflows don't fit standard FHIR resources
   - Solution: Use extensions (add properties to existing resources)
   - Limitation: Can't create entirely new resource types

2. **Search Performance**: Standard FHIR search syntax may not match legacy system's capabilities
   - Chained searches have depth constraints in Medplum
   - Custom search parameters not supported
   - May need to build application-level filtering for complex queries

3. **US Core Profile Requirements**
   - Must-have fields for interoperability
   - May require data cleanup before compliance
   - Validation errors on write if data doesn't conform

### 6.3 Authentication & Authorization Migration

**Challenges:**
1. **User Provisioning**: Transferring user accounts, roles, permissions
   - Legacy role-based access vs. FHIR AccessPolicy (more granular)
   - Need to redefine permission model

2. **SMART on FHIR Scopes**: Different from legacy OAuth2 implementations
   - Scope syntax specific to FHIR (patient/Patient.read, user/Observation.write)
   - May require client app updates

3. **Multi-tenant Access Patterns**: If organization has compartments (pediatrics example: parent→children)
   - No built-in solution for complex compartment hierarchies
   - Requires custom AccessPolicy logic

### 6.4 Bots, Subscriptions & Workflows

**Pain Points:**
1. **Subscription Latency**: Event-driven webhooks may have delays
   - Real-time requirements may not be met
   - Websocket subscriptions more reliable but count toward billing

2. **Bot Limitations**:
   - Sandboxed environment may not support all libraries
   - Lambda cold-start latency
   - Resource limits on execution time/memory

3. **Workflow Translation**:
   - Legacy system automations must be rewritten as Bots
   - Testing Bots requires understanding JavaScript and Medplum API
   - Debugging in sandboxed environment is challenging

### 6.5 Self-Hosting vs. Managed Service Trade-offs

**Self-Hosting Pain Points:**
- DevOps expertise required (Kubernetes, Postgres, networking)
- Ongoing maintenance burden (patching, monitoring, backups)
- Compliance responsibility remains with organization
- Build time longer than managed service

**Managed Service Limitations:**
- Data sovereignty issues (for EU/regulated environments)
- Outages affect all customers
- Feature dependencies on Medplum's roadmap
- Pricing scales with usage

---

## SECTION 7: COMPETITIVE LANDSCAPE

### 7.1 Direct Competitors & Alternatives

**Smile CDR (formerly Smile Digital Health)**
- **Type**: Commercial FHIR server (powered by HAPI FHIR)
- **Strengths**:
  - Purpose-built clinical data repository
  - Enterprise-grade support and SLAs
  - MegaScale feature: 255k interactions/sec, 2B FHIR resources ingested in 26 hours
  - Higher licensing cost justified by reliability
- **Weakness**: Higher cost than Medplum; less developer flexibility
- **Typical Migration**: Large health systems, payers, HIEs moving from legacy EHRs to FHIR-first

**Canvas Medical**
- **Type**: Decoupled EHR with builder platform
- **Strengths**:
  - Pre-built clinical workflows and UIs (unlike Medplum headless)
  - AI-powered protocols and automation
  - Hybrid approach: use Canvas backend + custom front-end
  - Specialty solutions (orthopedic, dental)
  - Builder plan: $3,950/month for startups
- **Weakness**: Less flexible than fully open-source; licensing costs higher than Medplum free tier
- **Typical Migration**: Practices wanting faster go-to-market with pre-built UIs

**Healthie**
- **Type**: API-first, fully brandable EHR platform
- **Strengths**:
  - Complete suite (EMR, scheduling, billing, patient engagement)
  - Telehealth-first architecture
  - Modern UI out-of-box
  - Support for practices and digital health startups
- **Weakness**: Less FHIR-native than Medplum; less customizable for advanced use cases
- **Typical Migration**: Telehealth platforms, virtual clinics, coaching platforms

**HAPI FHIR (Open Source)**
- **Type**: Free, open-source FHIR server reference implementation
- **Strengths**:
  - No licensing costs
  - Widely deployed
  - Strong community
  - Apache 2.0 license
- **Weakness**: Requires more infrastructure setup; less opinionated than Medplum
- **Typical Use**: Organizations with strong DevOps wanting maximum control

**Google Cloud Healthcare API**
- **Type**: Managed FHIR service on Google Cloud
- **Strengths**:
  - Native BigQuery, AI/ML, Pub/Sub integration
  - Fully managed (no ops burden)
  - Enterprise-grade SLAs
  - HIPAA/BAA ready
- **Weakness**: Vendor lock-in to Google Cloud; limited customization
- **Typical Migration**: Google Cloud customers, organizations needing advanced analytics

**Azure Health Data Services**
- **Type**: Microsoft's managed FHIR service
- **Strengths**:
  - FHIR, HL7 v2, DICOM support
  - Integration with Azure Synapse, ML, Power BI
  - Customizable via FHIR Server for Azure
  - Enterprise support
- **Weakness**: Azure-only; expensive for small deployments
- **Typical Migration**: Microsoft Azure customers, health systems with existing Azure investments

**Health Gorilla**
- **Type**: Health Information Network (not a direct EHR)
- **Strengths**:
  - Qualified Health Information Network under TEFCA
  - Real-time clinical data exchange network
  - Lab ordering, results delivery
  - Reduces complexity of multi-system integration
- **Weakness**: Complementary to EHRs, not a replacement
- **Typical Integration**: Paired with Medplum or other EHRs for interoperability

### 7.2 Competitive Positioning Matrix

| Dimension | Medplum | Canvas | Healthie | Smile CDR | Google Cloud | HAPI FHIR |
|-----------|---------|--------|----------|-----------|--------------|-----------|
| **FHIR-Native** | ✅ Full | ⚠️ Partial | ✅ Yes | ✅ Full | ✅ Full | ✅ Full |
| **Open Source** | ✅ Yes | ❌ No | ❌ No | ❌ No | ❌ No | ✅ Yes |
| **Pre-built UI** | ❌ No | ✅ Yes | ✅ Yes | ❌ No | ❌ No | ❌ No |
| **Cost (Startup)** | 💰 $0-2k | 💰💰 $3.9k | 💰💰 $3k+ | 💰💰💰 $$$$ | 💰💰 $2-5k | 💰 $0 |
| **Vendor Lock-in** | Low | Medium | Medium | High | Very High | None |
| **Developer Flexibility** | ✅ High | ⚠️ Medium | ⚠️ Medium | ⚠️ Medium | ❌ Low | ✅ High |
| **Enterprise Support** | ⚠️ Growing | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | Community |
| **Compliance (HITRUST)** | ⏳ In Progress | ✅ Yes | ⚠️ Partial | ✅ Yes | ✅ Yes | N/A |

---

## SECTION 8: REGULATORY & COMPLIANCE DRIVERS

### 8.1 Key Regulatory Drivers for FHIR Migration

**21st Century Cures Act (Finalized Regulation)**
- Information blocking penalties: Organizations blocking data sharing can lose up to 75% of Medicare annual update
- Effective: July 2024 for full enforcement

**TEFCA (Trusted Exchange Framework & Common Agreement)**
- Final Rule published December 2024, effective January 15, 2025
- Establishes floor for nationwide interoperability
- Drives adoption of FHIR-based data exchange
- Medplum & competitors positioned to comply

**ONC Mandates (Office of National Coordinator)**
- USCDI (US Core Data for Interoperability) requirements expanding
- 2025: Updated CMS interoperability rules requiring standardized access to clinical data
- Next US Core version based on FHIR R6 (skipping R5)

**State & Federal Compliance (HTI-4 by January 2027)**
- Health data interoperability requirements for providers/payers
- Medplum roadmap prioritizes HITRUST certification and HTI-4 compliance

**Data Liquidity Mandate**
- Patients can request data in standard formats (FHIR)
- Drives organizations toward FHIR-first architectures

### 8.2 Medplum's 2026 Roadmap: Addressing Compliance

- **HITRUST Certification**: For hosted Medplum environment (key for enterprise sales)
- **HTI-4 Compliance**: Certified changes aligned to January 2027 enforcement
- **Schedule/Billing Tooling**: Revenue cycle management for provider organizations
- **Provider App**: Mobile app for clinical workflows
- **AI Tooling**: Integration with AI/ML for clinical decision support

---

## SECTION 9: DATA EXPORT, INTEGRATION & INTEROPERABILITY

### 9.1 Data Export Capabilities

**Bulk FHIR API (FHIR 2.0.0 Standard)**
- Initiates bulk data exports
- Supports Group-based exports (all patients in a group + their compartments)
- System-level exports (all resources in a project)
- Returns NDJSON format URLs for download
- Follows standard FHIR bulk export specification

**Bulk Import**
- Accepts NDJSON files (from other bulk exports)
- Handles conditional references and ID mapping
- Downloads attached files automatically

### 9.2 Integration & Webhook Patterns

**Subscriptions (Event-Driven Webhooks)**
- Subscribe to resource changes (e.g., "notify when new Observation created")
- Full JSON resource payload posted to endpoint
- HMAC signature support for security
- Websocket subscriptions for real-time updates

**Custom FHIR Operations**
- Define custom operations beyond standard REST CRUD
- Example: `$process-encounter` to trigger complex workflows
- Integrated with Bots for automation

**External System Integration**
- Health Gorilla integration for lab orders/results
- SFTP, HL7 v2, CDA support via integration engine
- OAuth/OIDC for third-party apps

---

## SECTION 10: GITHUB & COMMUNITY METRICS

### 10.1 Repository Health

**Main Repository (medplum/medplum)**
- Stars: 2.2k
- Forks: 707
- 2024 Growth: +1,500 stars (100% growth in single year)
- Contributors: 115 (5x growth in 2024)
- Active maintainers: 11

**Community Size**
- Discord: 1,076 users (13x growth in 2024)
- GitHub Discussions: Active Q&A
- "Good first issue" label for contributors

### 10.2 Documentation Quality

**Comprehensive Docs**
- Published at medplum.com/docs (Markdown-based)
- Covers: getting started, FHIR basics, migrations, integration, deployment
- Case studies and video content
- Actively maintained by community contributions

**Development Velocity**
- Monthly updates (recent: February 2026 update published)
- Regular blog posts on features and best practices
- Active GitHub releases and changelogs

---

## SECTION 11: DECISION FRAMEWORK FOR MEDPLUM MIGRATION

### 11.1 When Medplum is the Right Choice

✅ **Good Fit If:**
- You have a strong technical team (backend/frontend developers)
- You prioritize interoperability and FHIR compliance from day one
- You want vendor-independent, open-source control
- You're building a custom workflow (not standard practice management)
- You're a startup with limited licensing budget
- You want to move fast on MVP validation
- You're in a regulated environment (HIPAA, TEFCA, etc.)
- You value long-term flexibility over short-term speed

### 11.2 When to Look at Alternatives

❌ **Consider Alternatives If:**
- Your team has limited/no technical resources
- You need pre-built clinical UIs and workflows immediately
- You're a large health system preferring vendor support guarantees
- You have non-standard, specialty-specific workflows not easily extensible
- You need enterprise-grade uptime SLAs with vendor accountability
- Your use case requires custom resource types or highly optimized search
- You're primarily on Google/Azure ecosystem and want native integration
- You need turnkey revenue cycle management

### 11.3 Migration Decision Checklist

**Technical Assessment**
- [ ] Team has JavaScript/Node.js experience
- [ ] Team understands FHIR concepts (or committed to learning)
- [ ] Current legacy system well-documented
- [ ] Data quality validated (no critical gaps)
- [ ] Existing healthcare workflow documented

**Business Assessment**
- [ ] Timeline allows for 6-12 month phased migration
- [ ] Budget covers developer costs (primary cost, not licensing)
- [ ] Stakeholder buy-in for developer-first approach
- [ ] Compliance requirements identified (HIPAA, TEFCA, etc.)
- [ ] Clear migration ROI (cost savings, feature gains, interoperability)

**Operational Assessment**
- [ ] DevOps capacity for self-hosting (if needed)
- [ ] Testing infrastructure for parallel system operation
- [ ] Change management process for end-users
- [ ] Training plan for clinical staff
- [ ] Rollback plan if migration stalls

---

## SECTION 12: KEY RESOURCES & NEXT STEPS

### 12.1 Medplum Official Resources

- **Website & Docs**: https://www.medplum.com/
- **GitHub**: https://github.com/medplum/medplum
- **Case Studies**: https://www.medplum.com/case-studies
- **Blog & Roadmap**: https://www.medplum.com/blog
- **Pricing**: https://www.medplum.com/pricing
- **Migration Guides**:
  - Adoption Strategy: https://www.medplum.com/docs/migration/adoption-strategy
  - Planning & Sequencing: https://www.medplum.com/docs/migration/migration-planning
  - Data Conversion: https://www.medplum.com/docs/migration/convert-to-fhir
  - Mirth to Medplum: https://www.medplum.com/blog/medplum-for-mirth-users

### 12.2 Regulatory Resources

- **TEFCA Final Rule**: Federal Register (Dec 2024)
- **ONC Health Data Tech**: https://www.healthit.gov/
- **CMS Interoperability**: https://www.cms.gov/priorities/key-initiatives/burden-reduction/interoperability

### 12.3 Competitive Intelligence

- **FHIR Server Benchmarks**: https://fhir-benchmarks.com/
- **Smile CDR**: https://www.smilecdr.com/
- **Canvas Medical**: https://www.canvasmedical.com/
- **Healthie**: https://www.gethealthie.com/
- **Health Gorilla**: https://www.healthgorilla.com/

---

## APPENDIX A: MEDPLUM 2026 ROADMAP HIGHLIGHTS

**Regulatory Readiness (Q1-Q2 2026)**
- HITRUST certification for hosted environment
- HTI-4 compliance updates (enforcement Jan 2027)

**Scale & Performance (Throughout 2026)**
- Infrastructure investments for enterprise deployments
- Scheduling and site reliability improvements
- Websocket subscription stability improvements

**Developer Experience (Throughout 2026)**
- Enhanced scheduling tools
- Provider mobile app expansion
- AI integration tooling
- Plugin architecture

**Note**: FHIR R5 development paused—next focus R6 alignment (following US Core decision)

---

## APPENDIX B: MIGRATION DECISION MATRIX

Use this to evaluate if Medplum is right for your organization:

| Factor | Weight | Score (1-5) | Weighted Score |
|--------|--------|-------------|-----------------|
| Team Technical Capability | 25% | _ | _ |
| FHIR/Interop Priority | 25% | _ | _ |
| Timeline Flexibility | 20% | _ | _ |
| Budget Availability | 15% | _ | _ |
| Regulatory Compliance Need | 15% | _ | _ |
| **TOTAL** | **100%** | | **[__/5]** |

**Scoring Guide:**
- 4.5-5.0: Strong Medplum fit
- 3.5-4.4: Good fit with planning
- 2.5-3.4: Moderate fit; consider alternatives
- <2.5: Likely better alternatives

---

## DOCUMENT METADATA

**Research Sources (40+ sources)**
- Y Combinator Company Database
- Medplum Official Documentation
- GitHub Repository & Discussions
- Case Study Publications (VintaSoft, TechMagic, MinDBowser)
- Competitive Analysis (CBInsights, Elion)
- FHIR & Healthcare Standards Bodies
- Regulatory Filings (Federal Register)
- Industry Blogs & Whitepapers

**Limitations & Caveats**
- Pricing information accurate as of March 2026; verify with Medplum directly
- Case studies based on public disclosures; more private deployments likely exist
- Competitive positioning based on public feature comparisons; internal capabilities may differ
- Regulatory timeline subject to change; refer to official ONC/CMS sources for authoritative updates

**Recommended Review Cycle**: Quarterly (for pricing, roadmap, regulatory changes)
