# 1Putt Health — Service Offerings

Last updated: 2026-03-14

---

## Overview

1Putt Health delivers five core service lines. Each is designed to be sold independently or combined into a bundled engagement. All pricing below represents target ranges — adjust based on scope, urgency, and client budget capacity.

---

## 1. Fractional CTO / VP Engineering

**What it is:** Embedded technical leadership for digital health companies that need senior healthcare engineering expertise without a full-time executive hire. Clint operates as a member of the client's leadership team — attending standups, making architecture decisions, mentoring engineers, and interfacing with investors and board members on technical matters.

**Deliverables:**
- Weekly architecture and engineering leadership (20 hrs/week)
- Technical roadmap creation and quarterly updates
- Engineering team hiring support (job descriptions, interview loops, candidate evaluation)
- Vendor and platform evaluation with written recommendations
- Board/investor-facing technical updates (monthly or quarterly)
- HIPAA/compliance oversight integrated into engineering workflow
- Code review and PR oversight on critical paths

**Timeline:** 3-month minimum commitment. Most engagements run 6-12 months. Month-to-month after initial term.

**Ideal Client:**
- Series A-B digital health startup, 5-30 engineers
- Has raised $5-25M, shipping product but struggling with healthcare-specific technical debt
- CEO or non-technical founder making architecture decisions they shouldn't be making
- Needs someone who can talk to Epic, manage HIPAA, and lead standups in the same day

**Pricing:** $10,000-15,000/month retainer. Annual commitment gets 10% discount ($108K-162K/year vs $120K-180K). Travel expenses billed separately if on-site work required.

**Margin note:** This is the highest-LTV offering. Target 2-3 concurrent retainers max to maintain quality. At $12.5K avg x 3 clients = $37.5K/month baseline.

---

## 2. Technical Strategy Engagement

**What it is:** A structured assessment that produces a concrete technical roadmap. Designed for companies at an inflection point — post-fundraise, pre-enterprise sales, or facing a build-vs-buy decision on integrations.

**Deliverables:**
- Current-state architecture review (codebase audit, infrastructure assessment, integration inventory)
- Vendor evaluation matrix (scored comparison of 3-5 vendors/platforms relevant to client's needs)
- Technical roadmap document (12-month plan with quarterly milestones, resource requirements, and dependency mapping)
- Risk register (technical debt, compliance gaps, scalability bottlenecks)
- Executive presentation (30-min board-ready summary of findings and recommendations)

**Timeline:** 4-6 weeks. Week 1: stakeholder interviews and codebase access. Weeks 2-3: deep analysis. Weeks 4-5: document production. Week 6: presentation and Q&A.

**Ideal Client:**
- Series B-C company about to sign first health system contract and realizing their architecture won't scale
- Company evaluating Redox vs Smile CDR vs building in-house FHIR server
- Post-acquisition integration planning (two codebases, which survives?)
- New VP Engineering who inherited a codebase and needs an independent assessment

**Pricing:** $15,000-25,000 fixed fee. Scope-dependent — a pure vendor eval is $15K, a full architecture review with roadmap is $25K. 50% due at kickoff, 50% on delivery.

---

## 3. Technical Due Diligence

**What it is:** Independent technical assessment for investors or acquirers evaluating a healthcare technology company. Produces a structured diligence report covering code quality, architecture soundness, compliance posture, team capability, and technical risk.

**Deliverables:**
- Technical diligence report (20-40 pages):
  - Architecture assessment (scalability, reliability, security)
  - Code quality analysis (test coverage, documentation, dependency health)
  - HIPAA/compliance posture evaluation
  - Integration maturity (EHR connectivity, FHIR conformance, data pipeline reliability)
  - Team assessment (skill coverage, key-person risk, hiring needs)
  - Technical debt inventory with estimated remediation costs
- Risk summary matrix (Red/Yellow/Green scoring across 8-10 dimensions)
- Executive summary (2-page version for investment committee)
- 60-minute findings call with deal team

**Timeline:** 2-3 weeks. Requires codebase access, 3-4 hours of interviews with target company's engineering team, and access to infrastructure/monitoring dashboards.

**Ideal Client:**
- Healthcare-focused VC firms (Series A-C stage)
- PE firms evaluating health tech acquisitions
- Strategic acquirers (health systems, payers, pharma) buying technology companies
- Companies preparing for acquisition who want a pre-diligence self-assessment

**Pricing:** $8,000-15,000 fixed fee. Standard engagement is $10K. Premium (includes competitive technical benchmarking) is $15K. Net 15 payment terms for institutional investors.

**Growth note:** This is the best lead-gen service. Every diligence engagement introduces 1Putt to both the investor AND the target company. Either could become a retainer client.

---

## 4. Product Engineering

**What it is:** Hands-on engineering work for healthcare-specific technical challenges. This is not staff augmentation — 1Putt scopes and delivers defined workstreams with Clint directly involved in architecture and code review, with Tim Grey executing implementation.

**Core Workstreams:**

### FHIR Integration Development
- FHIR R4 server implementation or client integration
- Resource mapping and transformation pipelines
- Bulk FHIR data export/import
- SMART on FHIR app development

### Epic Connectivity
- Epic App Orchard submission and certification
- MyChart integration
- Epic FHIR API implementation (patient access, provider-facing, backend)
- CDS Hooks implementation

### Healthcare Data Pipeline
- HL7v2 to FHIR migration (Mirth Connect, Rhapsody modernization)
- Claims data ingestion and normalization (837/835, ERA/EOB)
- Clinical data warehousing (analytics-ready data models)
- ADT/ORM/ORU feed processing

### HIPAA-Compliant Architecture
- Cloud architecture design (AWS GovCloud, Azure Healthcare APIs)
- Encryption at rest and in transit implementation
- Audit logging and access control systems
- BAA-compliant infrastructure setup

**Deliverables:** Vary by workstream. All include working code (deployed or deployment-ready), technical documentation, and knowledge transfer session.

**Timeline:** 2-12 weeks depending on scope. Typical FHIR integration project is 4-8 weeks.

**Ideal Client:**
- Digital health company with a signed contract that requires EHR integration they can't build in-house
- Company migrating from Mirth/Rhapsody to modern FHIR-based architecture
- Startup building MVP that needs healthcare data infrastructure done right the first time

**Pricing:** $150-200/hour (blended rate, Clint at $200/hr, Tim at $150/hr). Project-based pricing available for well-defined scopes — typical FHIR integration project: $25,000-60,000. Retainer clients get priority scheduling and $25/hr discount.

---

## 5. Compliance Readiness

**What it is:** Structured program to prepare a digital health company for HIPAA compliance, HITRUST certification, or SOC 2 Type II audit. Not a checkbox exercise — 1Putt builds compliance into the engineering workflow so it's sustainable, not a one-time scramble.

**Deliverables:**

### HIPAA Gap Assessment ($12,000)
- Current-state compliance audit across all HIPAA safeguards (Administrative, Physical, Technical)
- Gap analysis report with prioritized remediation plan
- Policy template package (12-15 policies customized to company's tech stack)
- Risk assessment documentation (required under HIPAA Security Rule)
- 90-day remediation roadmap with owner assignments

### HITRUST Certification Prep ($15,000-20,000)
- Everything in HIPAA Gap Assessment, plus:
- HITRUST CSF control mapping (identify applicable controls)
- Evidence collection framework and templates
- Pre-assessment mock audit (simulate assessor review)
- Assessor selection guidance and introduction
- Remediation support through certification (up to 6 months of advisory)

### SOC 2 Type II Readiness ($12,000-18,000)
- Trust Services Criteria mapping (Security, Availability, Confidentiality)
- Control design and implementation guidance
- Evidence collection automation recommendations (Vanta, Drata, Secureframe evaluation)
- Auditor selection and preparation
- Gap remediation support

**Timeline:** HIPAA gap assessment: 3-4 weeks. HITRUST prep: 8-16 weeks (certification process itself takes additional 3-6 months). SOC 2 readiness: 6-10 weeks.

**Ideal Client:**
- Series A startup that just signed first enterprise customer requiring HIPAA BAA
- Company pursuing HITRUST because payer or health system contract requires it
- Company where engineering team has been ignoring compliance and board/investors are asking questions

**Pricing:** $12,000-20,000 fixed fee depending on scope. Ongoing compliance advisory available as $3,000-5,000/month add-on to any retainer engagement.

---

## Service Bundling Strategy

The highest-value engagements combine services. Common bundles:

| Bundle | Services | Typical Price | Discount |
|--------|----------|---------------|----------|
| Launch Package | Technical Strategy + HIPAA Gap Assessment | $25,000-40,000 | 10% |
| Full Stack | Fractional CTO + Product Engineering | $15,000-20,000/month | Priority pricing |
| Investor Ready | Technical Due Diligence + Compliance Readiness | $20,000-30,000 | 15% |
| Scale Package | Fractional CTO + HITRUST Prep + FHIR Integration | $18,000-25,000/month (6-month) | 12% |

Always lead with the Fractional CTO or Technical Strategy engagement — they create the longest client relationships and the most upsell surface area.
