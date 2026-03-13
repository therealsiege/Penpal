
> Auto-generated from the Sidekick Knowledge Graph (Memgraph + Qdrant)
> Date: 2026-03-12 | Nodes: 9,906+ | Relationships: 30,827+
> Updated: 2026-03-12 — Revenue Intelligence expansion (Phase 4)

---

## 1. Market Position

MedScrub operates across 25 identified markets. The core positioning spans:

| Core Market | Competitors in Market | Competitive Density |
|---|---|---|
| AI Ambient Scribes | 27 companies | Highest — table stakes |
| Revenue Cycle Management | 21 companies | High — but mostly enterprise |
| Prior Authorization | 15 companies | Medium — regulatory tailwind |
| Clinical Documentation | 8 companies | Medium |
| Healthcare Integration | 4 companies | Low — differentiator |
| EHR Integration | 4 companies | Low — differentiator |
| Chronic Care Management | 4 companies | Low |
| Agentic AI | 3 companies | Low — emerging |
| FHIR Compliance | MedScrub-unique | No direct competition |

**Key Insight**: MedScrub's strongest differentiation is at the infrastructure layer — FHIR-native CDR, multi-EHR integration, and healthcare data interoperability. Most competitors focus on the ambient scribing UX and are bolting on integrations as an afterthought.

---

## 2. Competitive Landscape

### Funding & Threat Level

| Competitor          | Funding                      | Centrality Score | Threat Level             |
| ------------------- | ---------------------------- | ---------------- | ------------------------ |
| Abridge             | $800M+ (Series E, a16z)      | 103,905          | Critical                 |
| Ambience Healthcare | $243M Series C               | 101,755          | Critical                 |
| Commure             | Merged with Athelas          | 125,801          | High                     |
| Heidi Health        | $65M Series B                | 90,326           | High                     |
| Nuance              | Microsoft-backed             | 18,489           | High (incumbent)         |
| Nabla               | $70M Series C                | 26,904           | Medium                   |
| Doximity            | Public company               | 61,607           | Medium (different focus) |
| Suki                | Undisclosed                  | 37,916           | Medium                   |
| Bunkerhill Health   | $30M (Sequoia, Y Combinator) | 31,550           | Medium                   |
| Freed               | Undisclosed                  | 30,923           | Medium                   |
| Corti               | $87M ($260M valuation)       | 26,551           | Medium                   |
| BastionGPT          | Bootstrapped, Dallas         | 23,183           | Low — closest analog     |
| Tortus              | $4.2M seed (Khosla)          | 14,641           | Low                      |
| DeepScribe          | Undisclosed                  | 12,785           | Low                      |
| Secai               | $6.2M Series A               | 520              | Low                      |
| Augmedix            | Undisclosed                  | 9,880            | Low                      |

### Recent Competitor Moves (last 12 months)

- **Abridge** raised $300M Series E from a16z (Jun 2025), $250M Series D (Feb 2025) — total $800M+
- **Ambience Healthcare** raised $243M Series C (Jul 2025), partnered with Cleveland Clinic
- **Heidi Health** raised $65M Series B from Point72 (Oct 2025)
- **Nabla** raised $70M Series C (Jun 2025)
- **Corti** raised $87M, $260M valuation (Feb 2026)
- **Bunkerhill Health** raised $30M from Sequoia + YC (Feb 2026)
- **Suki** expanding from scribing into CPT/E/M code generation (revenue cycle play)
- **Ambience** launching inpatient ICD-10 CDI module (revenue cycle play)
- **DeepScribe** launched pre-charting product
- **Freed** partnered with US Acute Care Solutions

**Pattern**: Competitors are converging on ambient scribing -> revenue cycle. The scribing moat is eroding. Differentiation must come from depth of EHR integration and breadth of clinical workflow automation.

### Markets Shared with Competitors

| Shared Market | Competitors Present |
|---|---|
| AI Ambient Scribes | All 15 competitors |
| Enterprise Patient/Clinical Reasoning | Abridge, Doximity, Heidi, Nabla, Suki, Corti, Secai, Bunkerhill, Freed, BastionGPT |
| Revenue Cycle Management | Ambience, Suki, Nuance, Commure, Corti, Abridge, Nabla, Doximity |
| Prior Authorization | Ambience, Nuance, Commure, Corti, Bunkerhill, Abridge, Nabla |
| Clinical Documentation | Tortus, Suki, Heidi, Abridge |
| Chronic Care Management | Abridge, Nabla |
| Agentic AI | Abridge, Nabla |

### Uncontested Markets (MedScrub only)

- FHIR Compliance
- Clinical Data Repository
- EHR Interoperability (infrastructure-level)
- Patient Identity Verification

---

## 3. athenaAmbient Threat Assessment

### What It Is

athenahealth is launching **athenaAmbient** — free ambient clinical note generation bundled into athenaOne. This directly commoditizes MedScrub's core scribing/SOAP note feature for the primary lead base.

### Timeline

- **Beta**: Rolling out to select practices in early 2026
- **GA**: Expected mid-to-late 2026
- **Impact window**: 6-12 months before widespread adoption

### What athenaAmbient Does

- Ambient listening during patient encounters
- Auto-generates SOAP notes within athenaOne workflow
- Pre-populates ICD-10 and CPT suggestions
- Zero incremental cost for existing athenaOne subscribers

### What athenaAmbient Does NOT Do

- No chronic care management workflows (CCM billing)
- No remote patient monitoring integration
- No APCM eligibility tracking or billing automation
- No MIPS quality measure dashboards
- No payer policy intelligence or prior auth automation
- No between-visit patient outreach automation
- No multi-EHR support (locked to athenahealth)
- No revenue capture beyond basic E/M coding

### Impact on MedScrub

| MedScrub Feature | athenaAmbient Overlap | Risk Level |
|---|---|---|
| SOAP Note Generator | Full overlap | Critical |
| ICD-10 Code Suggester | Partial overlap | High |
| Coding Optimization | Partial overlap (basic) | Medium |
| Pre-Visit Summary | No overlap | Safe |
| CCM / Care Plans | No overlap | Safe |
| Prior Auth | No overlap | Safe |
| Patient Communications | No overlap | Safe |
| Revenue Check | No overlap | Safe |
| Lab Triage / Explanation | No overlap | Safe |
| Screening Gaps | No overlap | Safe |

### Strategic Response

**99% of MedScrub leads are athenahealth practices.** When athenaAmbient ships, the scribing value proposition evaporates for this audience. MedScrub must:

1. **Reposition before GA**: Shift messaging from "AI scribe" to "AI practice revenue engine"
2. **Ship revenue features first**: CCM, APCM, MIPS, RPM tools must be live before athenaAmbient GA
3. **Keep scribing as hook**: Free or low-cost scribing that demos well, but the sale is on revenue capture
4. **Expand EHR footprint**: Reduce athenahealth dependency — Epic, eClinicalWorks, Cerner leads need active sourcing

---

## 4. CMS Revenue Programs

These are the billable CMS programs that MedScrub features can enable for practices. This is the core of the "AI Practice Revenue Engine" thesis.

### Chronic Care Management (CCM)

| Code | Description | Rate | Frequency |
|---|---|---|---|
| 99490 | First 20 min/month clinical staff time | $66.30 | Monthly |
| 99439 | Each additional 20 min/month | $50.16 | Monthly |
| 99491 | First 30 min/month, physician-directed | $97.56 | Monthly |

- **Eligibility**: 2+ chronic conditions expected to last 12+ months
- **Annual revenue per patient**: $795.60 (at 99490 alone)
- **Target specialties**: Family Medicine, Internal Medicine, Geriatrics, Cardiology, Endocrinology
- **Pipeline match**: 118 Family Medicine leads, 18 Internal Medicine leads — high overlap

### Remote Patient Monitoring (RPM)

| Code | Description | Rate | Frequency |
|---|---|---|---|
| 99453 | Device setup + patient education | $19.32 | Per episode |
| 99454 | Device supply (30-day period) | $55.72 | Monthly |
| 99457 | First 20 min/month clinical staff | $50.94 | Monthly |
| 99458 | Each additional 20 min/month | $42.22 | Monthly |
| 99445 | Lower-threshold monitoring (new 2025) | $44.00 | Monthly |

- **Eligibility**: Acute or chronic condition requiring device monitoring, 16+ data days/month
- **Annual revenue per patient**: $1,570.56 (full stack)
- **Key insight**: New 99445 code lowers the qualification threshold — more practices can bill

### Advanced Primary Care Management (APCM)

| Code | Description | Rate | Frequency |
|---|---|---|---|
| G0556 | Low complexity | $18.00 | Monthly |
| G0557 | Moderate complexity | $52.00 | Monthly |
| G0558 | High complexity | $86.00 | Monthly |

- **Eligibility**: Primary care practice, tiered by patient chronic condition count
- **Annual revenue per patient**: $624 (moderate), $1,032 (high complexity)
- **Cannot be billed alongside CCM** — practices choose one or the other
- **New program (2025)**: Most practices unaware of eligibility — education opportunity
- **Missing feature**: APCM eligibility calculator not in MedScrub backlog

### Transitional Care Management (TCM)

| Code | Description | Rate | Frequency |
|---|---|---|---|
| 99495 | Moderate complexity (14-day follow-up) | $168.28 | Per episode |
| 99496 | High complexity (7-day follow-up) | $240.04 | Per episode |

- **Eligibility**: Post-hospital/facility discharge, contact within 2 business days
- **Annual revenue per patient**: $480.08 (estimated 2 transitions/year)
- **MedScrub skills that support**: Post-Visit Follow-up message already shipped

### Annual Wellness Visit (AWV)

| Code | Description | Rate | Frequency |
|---|---|---|---|
| G0438 | Initial AWV | $185.64 | Annual |
| G0439 | Subsequent AWV | $130.65 | Annual |

- **Eligibility**: All Medicare beneficiaries
- **MedScrub skills that support**: USPSTF Screening Gaps, Pre-Visit Summary

### MIPS (Merit-based Incentive Payment System)

- **Payment adjustment**: Up to +/- 9% on all Medicare Part B reimbursement
- **Categories**: Quality (30%), Cost (30%), Improvement Activities (15%), Promoting Interoperability (25%)
- **Risk**: Practices that don't report face automatic -9% penalty
- **Opportunity**: MIPS dashboard = penalty avoidance = easy sell
- **Missing feature**: MIPS dashboard not in MedScrub backlog

### Revenue Per Patient Summary

| Program | Annual $/Patient | Pipeline Leads Eligible | Total Addressable |
|---|---|---|---|
| CCM | $795.60 | ~136 (FM + IM) | Highest |
| RPM | $1,570.56 | ~136 | Highest (requires device) |
| APCM | $624.00 | ~136 | High (new program) |
| TCM | $480.08 | ~136 | Medium |
| AWV | $130.65 | ~136 | Medium |
| MIPS | Penalty avoidance | All Medicare clinicians | Universal |

**Key Insight**: A single family medicine practice with 200 Medicare patients enrolled in CCM generates $159,120/year in new revenue. MedScrub's cut (SaaS fee or rev share) makes this a far more compelling sale than "save 2 hours/day on notes."

---

## 5. Lead Pipeline Analysis

### Pipeline Overview

| Stage | Leads | Notes |
|---|---|---|
| Outreach | 400 | Vast majority — early stage pipeline |
| Closed Won | 1 | |
| Closed Lost | 3 | |

### Lead Characteristics

- **275 MedScrub-arm leads**, average score 53.7
- **185 1PuttHealth-arm leads**
- All high-scoring leads are **small, independent physician practices** on athenahealth

### EHR Distribution

| EHR System | Leads Using | Integration Status |
|---|---|---|
| athenahealth | 109 | Implemented (FHIR R4, OAuth 2.0, 7 resource types) |
| Epic | 1 | Ready (SMART on FHIR + Bulk FHIR) |
| Oracle Cerner | 0 | Implemented (Millennium FHIR R4, JWT, 8 resource types) |
| eClinicalWorks | 0 | FHIR API + Vim |
| All others | 0 | API-level or planned |

**Key Insight**: 109 of 110 leads with known EHR are on athenahealth. Epic has massive doc coverage (388 docs) but only 1 lead. The pipeline is entirely athenahealth-dependent.

### Specialty Distribution

| Specialty | Leads | Opportunity |
|---|---|---|
| Family Medicine | 118 | Primary beachhead |
| Concierge | 26 | High-value, tech-forward |
| Internal Medicine | 18 | Adjacent to family med |
| Psychiatry | 9 | Behavioral health niche |
| Surgery | 7 | Complex documentation needs |
| ENT | 3 | Specialty expansion |
| Pediatric | 2 | |
| Orthopedic | 1 | |
| Neurology | 1 | |

### Territory Distribution

| Territory | Leads | Avg Score |
|---|---|---|
| Texas | 84 | 53.9 |
| Tennessee | 54 | 52.9 |
| Colorado | 44 | 54.7 |
| North Carolina | 43 | 54.6 |
| Alabama | 38 | 55.0 |
| California | 13 | — |
| Illinois | 6 | 50.0 |
| New York | 6 | — |
| Florida | 2 | 50.0 |
| All others | <3 each | — |

**Key Insight**: Pipeline is heavily concentrated in the South/Southeast (TX, TN, AL, NC = 219 leads, 72% of located leads). Colorado is the western outlier. Minimal presence on the coasts.

---

## 6. Revised Feature Prioritization (Weighted Framework)

### Scoring Methodology

Each feature scored 0-100 using weighted criteria:

| Criterion | Weight | Description |
|---|---|---|
| Revenue Impact | 30% | Direct/indirect revenue generation for practices |
| Competitive Moat | 25% | How defensible against athenaAmbient + funded competitors |
| Data Advantage | 20% | Leverages MedScrub's FHIR/CDR infrastructure uniquely |
| ICP Alignment | 15% | Matches small FM/IM athenahealth practice profile |
| Build Effort | 10% | Inverse — lower effort = higher score |

### Rescored Feature Priority

| Rank | Feature | Revenue | Moat | Data | ICP | Effort | Total | Status |
|---|---|---|---|---|---|---|---|---|
| 1 | **CCM Workflows** | 28 | 22 | 18 | 14 | 7 | **89** | Backlog |
| 2 | **APCM Eligibility Tool** | 27 | 25 | 16 | 14 | 6 | **88** | Not in backlog |
| 3 | **MIPS Dashboard** | 25 | 20 | 18 | 15 | 6 | **84** | Not in backlog |
| 4 | **Revenue Check (expanded)** | 26 | 18 | 16 | 13 | 8 | **81** | Backlog |
| 5 | **Payer Contract Analyzer** | 22 | 22 | 18 | 12 | 5 | **79** | Not in backlog |
| 6 | **Between-Visit Outreach** | 20 | 20 | 16 | 14 | 8 | **78** | Not in backlog |
| 7 | Prior Auth Automation | 18 | 18 | 16 | 12 | 7 | 71 | Shipped (partial) |
| 8 | Patient Summary | 12 | 15 | 14 | 12 | 9 | 62 | Backlog |
| 9 | Clinical Chat | 10 | 18 | 14 | 10 | 6 | 58 | Active dev |
| 10 | Patient Message Drafts | 10 | 12 | 12 | 12 | 9 | 55 | Backlog |

### Critical Gaps: Features Not in the Backlog

These scored highly but have no presence in MedScrub's current feature roadmap:

1. **APCM Eligibility Tool** (Score: 88) — New CMS program most practices don't know about. First-mover advantage is massive. Tool should identify eligible patients, calculate expected revenue, and automate billing workflows.

2. **MIPS Dashboard** (Score: 84) — Up to 9% Medicare penalty. Show practices their MIPS score, which measures are failing, and what MedScrub can automate to fix them. Penalty avoidance is an easy executive sale.

3. **Payer Contract Analyzer** (Score: 79) — Read payer contracts, identify underbilled codes, flag missing modifiers, compare reimbursement rates across payers. Deep data moat — requires CDR access.

4. **Between-Visit Outreach Automation** (Score: 78) — Automated patient outreach between visits for CCM/RPM compliance, care gap closure, medication adherence. Drives billable touchpoints.

---

## 7. Data Gap Analysis

### What the Knowledge Graph Cannot Answer Today

#### Financial & Revenue Data (Critical)

- No CMS claims data or billing history for leads/practices
- No payer mix data (% Medicare vs. commercial vs. Medicaid per lead)
- No practice revenue figures or financial health indicators
- No per-lead revenue potential calculations (requires payer mix + specialty + panel size)
- No reimbursement rate data by payer or geography

#### Usage & Product Telemetry

- No product usage data (which skills are used, how often, by whom)
- No conversion funnel metrics (demo → trial → paid → retained)
- No NPS or satisfaction scores
- No churn data or risk signals

#### Practice Firmographics

- No NPI data (practice size, provider count, taxonomy codes)
- No panel size estimates per lead/practice
- No Medicare patient volume per practice
- No practice technology stack beyond EHR (PM system, billing software)

#### Market Intelligence

- No real-time competitor pricing data
- No athena Marketplace app download counts or ratings
- No CMS PECOS enrollment data (which practices bill which programs)
- No geographic demand heatmaps for specific services

#### Sales Effectiveness

- No email open/reply rates for outreach campaigns
- No demo completion/conversion rates
- No sales cycle length data
- No win/loss reasons for closed deals

---

## 8. Recommended Data Sources

### Priority 1: Immediate (can start ingesting now)

| Source | Data Available | Impact | Integration Effort |
|---|---|---|---|
| **CMS NPPES/NPI Registry** | Provider name, specialty taxonomy, practice address, organization type | Enrich every lead with verified practice data | Low — public CSV download |
| **CMS Fee Schedule (PFS)** | Reimbursement rates by CPT code, GPCI geographic adjusters | Calculate exact revenue per lead by geography | Low — public CSV |
| **MGMA Benchmarks** (if accessible) | Practice revenue, staffing, payer mix by specialty/size | Revenue modeling per ICP segment | Medium — requires subscription |

### Priority 2: Near-term (within 30 days)

| Source | Data Available | Impact | Integration Effort |
|---|---|---|---|
| **CMS PECOS** | Which practices are enrolled in Medicare, which programs they bill | Identify CCM/RPM/APCM current billers vs. non-billers | Medium — public API |
| **athena Marketplace** | App listings, descriptions, reviews | Competitive intelligence on athena ecosystem | Medium — scrape + manual |
| **State Medical Board** | License status, disciplinary actions, practice locations | Lead validation and enrichment | Medium — varies by state |

### Priority 3: Strategic (60+ days)

| Source | Data Available | Impact | Integration Effort |
|---|---|---|---|
| **Payer coverage policies** | Prior auth requirements, covered services, formularies | Feed payer intelligence tools | High — varies by payer |
| **CMS Quality Payment Program** | MIPS scores by clinician (public) | Target low-scoring practices for MIPS dashboard | Medium — public data |
| **Hospital discharge data** (CMS) | Readmission rates, discharge volumes by geography | TCM opportunity sizing | High — large dataset |

---

## 9. Strategic Repositioning

### The Thesis: "Scribing is the hook, revenue capture is the product"

athenaAmbient will make ambient scribing a free commodity for 99% of MedScrub's leads within 12 months. The survival pivot:

**From**: "MedScrub — AI Clinical Assistant"
**To**: "MedScrub — AI Practice Revenue Engine"

### Why This Works

1. **athenaAmbient can't do it**: Revenue programs (CCM/RPM/APCM/MIPS) require cross-system data, longitudinal patient tracking, and billing workflow automation. athenaAmbient is a point-of-visit tool.

2. **The money is compelling**: A 5-provider family medicine practice with 500 Medicare patients can generate $397,800/year in CCM revenue alone. MedScrub's platform fee is trivially justified.

3. **Moat deepens with data**: Every patient enrolled in CCM/RPM through MedScrub creates longitudinal data that feeds better care plans, screening gap detection, and predictive analytics. Network effects emerge.

4. **ICP stays the same**: Small independent family medicine practices on athenahealth. Same lead list, different pitch.

5. **Competitors aren't there yet**: Abridge and Ambience are chasing enterprise deals and ambient scribing. Suki is the closest competitor moving toward RCM but targets larger practices. The small-practice revenue automation niche is wide open.

### Messaging Shift

| Old Pitch | New Pitch |
|---|---|
| "Save 2 hours/day on clinical notes" | "Unlock $800/patient/year in CMS revenue you're leaving on the table" |
| "AI-powered SOAP notes" | "AI-powered revenue capture + clinical workflow automation" |
| "We integrate with athenahealth" | "We find the patients in your panel that qualify for CCM, RPM, and APCM — and automate the billing" |
| Feature demo: SOAP note generation | Feature demo: Revenue opportunity dashboard showing $/patient/month |

---

## 10. Feature Validation Framework

### 4-Phase Process for New Feature Decisions

#### Phase 1: Problem Validation

- [ ] Is there a billable CMS code or reimbursement tied to this workflow?
- [ ] Do 10+ leads in the pipeline have this pain point?
- [ ] Is this problem mentioned in 5+ KB documents?
- [ ] Does the ICP (small FM/IM practice, athenahealth) experience this?

#### Phase 2: Solution Validation

- [ ] Can MedScrub's CDR/FHIR infrastructure uniquely enable this?
- [ ] Would athenaAmbient or a competitor ship this within 12 months?
- [ ] Does this require data that MedScrub already has access to?
- [ ] Can a v1 be built in under 4 weeks?

#### Phase 3: Value Quantification

- [ ] What is the $/patient/year this feature enables?
- [ ] What is the practice-level ROI (total annual revenue vs. MedScrub fee)?
- [ ] Does this create switching costs or data lock-in?
- [ ] Does this generate data that improves other features?

#### Phase 4: Prioritization Score

Apply the weighted framework from Section 6:
- Revenue Impact (30%) + Competitive Moat (25%) + Data Advantage (20%) + ICP Alignment (15%) + Build Effort (10%)

**Gate**: Only features scoring 70+ proceed to engineering. Features scoring 60-69 stay in backlog. Below 60 are rejected or deferred.

---

## 11. Regulatory Environment

| Regulation | Doc Mentions | Impact |
|---|---|---|
| HIPAA | 1,479 | Foundation — everything must be HIPAA-first |
| SOC 2 | 763 | Trust signal for practice owners |
| HITRUST | 267 | Enterprise credential — lower priority for small practices |
| HEDIS | 26 | Quality measures for managed care |
| CMS-0057-F | 8 | **Electronic Prior Auth API mandate (Jan 2026) — build for this** |
| USPSTF | 6 | Screening guidelines — skill already shipped |
| MIPS | 5 | **9% Medicare penalty risk — quality reporting opportunity** |
| AB 3030 | 4 | California AI disclosure in patient communications (Jan 2025) |

---

## 12. Technology Stack Signals

### Most Referenced Technologies in MedScrub KB

| Technology | Doc Mentions | Significance |
|---|---|---|
| FHIR | 34 | Core integration standard |
| OAuth 2.0 | 17 | Auth infrastructure |
| SMART on FHIR | 17 | App launch framework (Epic) |
| HL7 | 11 | Legacy integration |
| Next.js | 10 | Frontend stack |
| Medplum CDR | 9 | Central data layer |
| GPT-4 | 7 | AI backbone |
| Bulk FHIR | 7 | Population health data access |
| TypeScript | 7 | Development language |
| CDS Hooks | 6 | Clinical decision support standard |
| Docker | 6 | Deployment |
| Redis | 5 | Caching layer |

### What Competitors Use (cross-referenced)

Competitor docs most frequently co-mention these technologies:
- **Next.js** appears across Nuance (13), Abridge (10), Nabla (8), Ambience (8) — industry standard frontend
- **GPT-4** co-mentioned with Nuance (8), Abridge (8), Ambience (5) — competitors building on OpenAI
- **FHIR** appears with Heidi (6), Abridge (5), Commure (4) — integration becoming competitive
- **SMART on FHIR** across Commure (4), Heidi (4), DeepScribe (4), Abridge (4)

---

## 13. Knowledge Hub Documents

Most-linked documents in the KB (internal reference hubs):

| Document | Inbound Links | Type |
|---|---|---|
| athenahealth (Elion Health research) | 192 | General |
| Heidi Health (competitor profile) | 49 | Competitor |
| ixlayer (product research) | 25 | General |
| emtelligent (product research) | 20 | General |
| canvas (product research) | 12 | General |
| MedHook Engine | 10 | General |

---

## 14. Network & Advisors

| Person | Role | Company | Doc Mentions | Value |
|---|---|---|---|---|
| Patrick Carter | Advisor | Agilon Health | 67 | Highest-connected advisor |
| Clint Johnson | Founder | MedScrub | 25 | |
| Matt Wimberly | Collaborator | — | 11 | |
| Maurice Hill | Advisor | Optum (CPO) | 7 | Enterprise healthcare perspective |
| David LiCause | Customer | — | 4 | Customer voice |
| Rob Trachtman | Advisor | — | 2 | |
| Josh Spencer | Competitor Exec | BastionGPT (CEO) | 1 | Closest competitor analog |
| Shiv Rao | Competitor Exec | Abridge (CEO) | 1 | Market leader |

### HTN (Health Tech Nerds) Network

15 HTN member leads identified — all are healthcare tech founders/executives, not clinical practices. These are partnership/ecosystem contacts, not sales leads:
- Awell (VP + Chief of Staff), AlleyCorp Nord, GenHealth, Medicai, Valerie Health, Chino Technologies, Vivian Health, Assemble, Malama Health, Metriport, Flexpa, Foxbox Digital

---

## 15. Community Clusters (Graph Analytics)

The MAGE community detection algorithm identified these natural groupings:

|     | Key Members                                                  | Interpretation                           |
| --- | ------------------------------------------------------------ | ---------------------------------------- |
| 0   | All competitors + key EHRs                                   | The competitive arena                    |
| 1   | MedScrub, MedHook, core tech stack, all Skills, key advisors | MedScrub's product ecosystem             |
| 3   | Epic, athenahealth, Cerner, MEDITECH, Commure, FHIR tech     | The EHR/interoperability cluster         |
| 4   | OpenLoop, Elation, Healthie, Medplum, React Native           | The digital health / startup EHR cluster |
| 5   | Nuance, Optum, Agilon Health, MIPS/CMS regulations           | The enterprise/regulatory cluster        |
| 9   | 443 leads + all territories + sales stages                   | The sales pipeline                       |

**Key Insight**: MedScrub (Community 1) is structurally closest to the interoperability cluster (Community 3), not the competitor cluster (Community 0). This confirms the integration-first positioning is the right moat.

---

## 16. Strategic Recommendations (Updated)

### Do Now (0-3 months) — Revenue Engine Pivot

1. **Ship CCM Workflows** — $795.60/patient/year. 118 FM leads are immediate targets. Highest demand signal (20 mentions), lowest competition (4 companies).
2. **Build APCM Eligibility Tool** — New CMS program, most practices unaware. First-mover advantage. $624-$1,032/patient/year.
3. **Build MIPS Dashboard** — Penalty avoidance (-9%) sells itself. USPSTF Screening Gaps already shipped as foundation.
4. **Reposition messaging** — "AI Practice Revenue Engine" not "AI Clinical Assistant". Update website, pitch deck, demo flow.

### Do Next (3-6 months) — Deepen Revenue Moat

5. **Revenue Check expansion** — Proactive revenue identification across all CMS programs per patient
6. **Payer Contract Analyzer** — Deep data moat, leverages CDR uniquely
7. **Between-Visit Outreach Automation** — Drives billable CCM/RPM touchpoints between visits
8. **Prior Auth Automation (full)** — CMS-0057-F mandate creates urgency. Expand beyond MRI + Specialty Drug.

### Do Later (6-12 months) — Scale

9. **RPM Integration** — Highest per-patient revenue ($1,570/year) but requires device partnerships
10. **Expand to Epic leads** — 388 docs of coverage, 1 lead. Integration ready, pipeline empty.
11. **Clinical Chat (Agentic AI)** — Emerging market, only 3 companies. But lower revenue impact than programs above.
12. **Geographic expansion** — Coastal markets untapped. TX/TN/CO/NC/AL = 72% of pipeline.

### Don't Do

- **Compete on ambient scribing alone** — athenaAmbient makes this free
- **Enterprise Patient Communications at scale** — 10+ well-funded competitors
- **Healthcare AI Infrastructure platform play** — too broad, stay focused on clinical workflows
- **Build RPM before CCM/APCM** — RPM requires hardware partnerships; CCM/APCM are software-only
