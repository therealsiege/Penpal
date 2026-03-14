
> What MedScrub becomes as a CCM/APCM Revenue Engine
> Date: 2026-03-13
> Status: UNVALIDATED — Must pressure-test with Patrick Carter before committing engineering

---

## The Fundamental Shift

MedScrub today is a **single-encounter, single-patient tool**. Every skill works the same way: physician selects a patient, runs a skill, gets an output. It's reactive — the doctor initiates, the AI responds.

A CCM/APCM Revenue Engine is a **longitudinal, population-level system**. It runs continuously across the entire patient panel, tracks billing compliance over months, and proactively surfaces what needs to happen next. The doctor doesn't initiate — the system tells them what to do.

| Dimension | Current MedScrub | Revenue Engine MedScrub |
|---|---|---|
| Unit of work | Single patient encounter | Entire patient panel |
| Trigger | Physician clicks a skill | System identifies opportunities |
| Time horizon | This visit | This month (billing cycle) |
| Output | A document (note, letter, message) | A workflow (identify, consent, track, bill) |
| Revenue model | SaaS subscription for productivity | SaaS subscription justified by captured revenue |
| Daily habit | Pre-visit summary before appointments | Revenue dashboard at start of day |

---

## What Stays (Existing Foundation)

These shipped capabilities become building blocks for the Revenue Engine:

| Existing Skill | Revenue Engine Role |
|---|---|
| **Pre-Visit Summary** | Surfaces CCM/APCM-relevant conditions before every visit. Already supports APCM codes. |
| **USPSTF Screening Gaps** | Identifies AWV opportunities + MIPS quality measure gaps. Foundation for population screening. |
| **Care Gap Nudge** | Already generates patient outreach for overdue screenings. Extends to CCM monthly touchpoints. |
| **Diabetes Care Plan** | Template for CCM care plans. Extend to hypertension, COPD, CHF, CKD. |
| **Post-Visit Follow-up** | Already supports TCM codes (99495/99496). Becomes part of automated care coordination. |
| **Coding Optimization** | E/M code analysis. Extend to flag CCM/APCM billing opportunities missed during encounters. |
| **Daily Briefing** | Already supports APCM. Becomes the daily "revenue opportunities" dashboard. |
| **Lab Results Explanation** | Supports CCM documentation. Part of between-visit touchpoint evidence. |
| **Medplum CDR** | Longitudinal FHIR data store. This is the entire foundation — CCM requires tracking across months. |
| **PHI Proxy** | Enables safe AI processing of the full patient panel at scale. |

---

## What's New (Must Build)

### Layer 1: Population Intelligence (The Eyes)

These features scan the entire patient panel and surface opportunities. This is where the product shifts from reactive to proactive.

#### 1.1 Patient Eligibility Engine

**What it does**: Continuously scans CDR for patients meeting CMS program criteria.

| Program | Eligibility Logic | Data Source |
|---|---|---|
| CCM | 2+ chronic conditions expected to last 12+ months | Problem list, medication list, encounter history |
| APCM | Primary care attribution + chronic condition count (low/moderate/high) | Claims attribution, problem list |
| AWV | Medicare beneficiary, no AWV in past 12 months | Insurance, encounter history |
| TCM | Discharged from hospital/SNF in past 30 days | ADT notifications, encounter history |
| RPM | Acute or chronic condition requiring device monitoring | Problem list, vitals, orders |

**Output**: Ranked list of eligible patients per program with estimated annual revenue per patient.

**Architecture**: New background worker process that runs nightly against CDR. Not a skill — this is infrastructure.

#### 1.2 Revenue Dashboard

**What it does**: Shows the physician/office manager their panel's revenue opportunity at a glance.

```
Today's Revenue Dashboard — Dr. Smith
---
CCM Eligible (not enrolled):     87 patients    $69,157/year uncaptured
CCM Enrolled (due this month):   23 patients    12 need touchpoint by March 31
APCM Eligible:                  142 patients    $88,608/year uncaptured
AWV Overdue:                     34 patients    $4,442/year uncaptured
MIPS Score:                      62/100         At risk of -4% penalty
---
Next actions: 12 CCM touchpoints due, 5 care plans need update, 3 new enrollments ready
```

**Architecture**: New dashboard view in desktop + mobile app. Driven by Eligibility Engine data. Replaces or supplements the current Daily Briefing as the primary "start of day" view.

#### 1.3 Panel Screener (extends USPSTF Screening Gaps)

**What it does**: Runs screening compliance across entire panel, not just one patient at a time. Produces risk-stratified patient lists (Patrick Carter's recommendation — saves ~2 weeks of manual work per screening program).

**Architecture**: Batch mode extension of existing `screening-gap-analyzer` skill. Output is a population-level report, not a single-patient report.

---

### Layer 2: Enrollment Workflows (The Hands)

Once the Eligibility Engine identifies patients, these workflows handle the enrollment and consent process.

#### 2.1 CCM Enrollment Workflow

**Steps the system automates**:

1. **Identify** — Flag patient as CCM-eligible based on problem list (2+ chronic conditions)
2. **Consent** — Generate patient consent form (CMS requires written/verbal consent before billing). Track consent status.
3. **Care Plan** — Generate initial comprehensive care plan from CDR data (extends existing `care-plan-diabetes` to all chronic conditions)
4. **Assign** — Route to clinical staff for monthly touchpoint scheduling
5. **Track** — Monitor 20-minute minimum monthly touchpoint requirement for 99490 billing

**New skills needed**:
- `ccm-consent-generator` — Produces CMS-compliant consent documentation
- `ccm-care-plan` — Generalized chronic care plan (not just diabetes) from CDR
- `ccm-monthly-summary` — Documents the monthly touchpoint for billing evidence

#### 2.2 APCM Enrollment Workflow

**Steps**:

1. **Identify** — Flag patient based on primary care attribution + chronic condition tier (low/moderate/high)
2. **Tier** — Classify complexity: G0556 ($18/mo), G0557 ($52/mo), G0558 ($86/mo)
3. **Track** — Monitor required care activities per tier per month
4. **Bill** — Pre-populate claim with correct G-code and supporting documentation

**New skills needed**:
- `apcm-tier-classifier` — Determines patient complexity tier from CDR data
- `apcm-monthly-tracker` — Tracks required care activities per tier

**Key constraint**: APCM cannot be billed alongside CCM for the same patient. System must recommend which program is more revenue-optimal per patient.

---

### Layer 3: Billing Compliance (The Clock)

Revenue programs are monthly billing cycles. Miss a month, lose the revenue. This layer tracks deadlines.

#### 3.1 Monthly Billing Tracker

**What it does**: For every enrolled patient in every program, tracks:
- Has the required monthly touchpoint occurred?
- Is the documentation sufficient for billing?
- How many minutes have been logged? (CCM requires 20 min/month minimum for 99490)
- Is the care plan current?
- Is consent still valid?

**Output**:
- Daily task list: "These 12 patients need a CCM touchpoint before month-end"
- Billing readiness report: "These 45 patients are ready to bill. These 8 need documentation."
- Revenue captured this month vs. potential

**Architecture**: New data model in CDR for enrollment status, touchpoint tracking, and billing events. Needs a calendar/deadline-aware system.

#### 3.2 Claims Pre-Population

**What it does**: For each billable event, pre-populates the claim data:
- Patient demographics
- Correct CPT/HCPCS code (99490, 99439, G0557, etc.)
- Supporting diagnosis codes (from CDR problem list)
- Time documentation (for time-based codes)
- Required modifiers

**Output**: Claim-ready data that can be exported to the practice's billing system or pushed back to athenahealth via API.

**Architecture**: Requires write-back to athenahealth (charge posting API). This is a new integration surface.

#### 3.3 MIPS Quality Dashboard

**What it does**: Shows the practice's MIPS score across four categories, flags measures that are failing, and recommends actions.

| Category | Weight | What MedScrub Tracks |
|---|---|---|
| Quality (30%) | USPSTF screening compliance, chronic disease management | Existing screening-gap-analyzer data |
| Cost (30%) | Per-capita cost benchmarks | Requires claims data (not in CDR today) |
| Improvement Activities (15%) | Care coordination, patient engagement | CCM/APCM enrollment counts |
| Promoting Interoperability (25%) | EHR use metrics, health information exchange | Requires EHR audit logs |

**Honest assessment**: Quality and Improvement Activities are buildable. Cost and PI require data MedScrub doesn't have today. A v0.1 MIPS dashboard would cover Quality only.

---

### Layer 4: Revenue Reporting (The Proof)

#### 4.1 Monthly Revenue Report

**What it does**: Shows the practice how much revenue MedScrub captured this month.

```
March 2026 Revenue Report — Sunrise Family Medicine
---
CCM Revenue Captured:      $4,641.00  (70 patients x $66.30)
APCM Revenue Captured:     $3,120.00  (60 patients x $52.00)
AWV Revenue Captured:      $1,306.50  (10 patients x $130.65)
MIPS Penalty Avoided:      Estimated $3,750/month (9% of $500K Medicare billing)
---
Total Revenue Captured:    $12,817.50 this month
MedScrub Fee:              $X,XXX.XX
Net ROI:                   XX:1
---
Year-to-Date:              $38,452.50
```

**Why this matters**: This is the retention mechanism. If the doctor can see MedScrub generated $150K this year, they will never churn. The report is the product.

---

## What Changes in the Architecture

### CDR Extensions

The Medplum CDR needs new data models beyond FHIR clinical resources:

| New Data | Purpose |
|---|---|
| Enrollment status per patient per program | Track who's enrolled in CCM, APCM, RPM |
| Consent records | CMS requires documented consent for CCM |
| Monthly touchpoint logs | Time tracking for 99490 (20 min minimum) |
| Billing events | Claims submitted, paid, denied per patient per month |
| Program eligibility cache | Nightly scan results from Eligibility Engine |

### Skill SDK Extensions

Current skill SDK is designed for single-patient, single-shot workflows. Revenue Engine needs:

| Extension | Why |
|---|---|
| **Batch mode** | Run skills across entire panel (not one patient at a time) |
| **Scheduled execution** | Nightly eligibility scans, monthly billing prep |
| **State tracking** | Skills that persist state across months (enrollment, touchpoints) |
| **Write-back to EHR** | Push charges, care plans, documentation back to athenahealth |

### New Integration Surfaces

| Integration | Purpose | Complexity |
|---|---|---|
| athenahealth Charge Posting API | Push pre-populated claims | Medium |
| athenahealth Clinical Documents API | Write care plans back to chart | Medium (Cerner write-back already exists) |
| CMS PECOS API | Check which practices already bill programs | Low |
| CMS Fee Schedule | Dynamic reimbursement rates by geography | Low |

---

## Feature Priority (Revenue Engine Specific)

### v0.1 — "Show Me the Money" (4-6 weeks)

Ship the smallest thing that proves the thesis: **Can we show a practice how much revenue they're missing?**

| Feature | What Ships |
|---|---|
| Patient Eligibility Engine (CCM only) | Scan CDR for patients with 2+ chronic conditions. Output: patient list with estimated revenue. |
| Revenue Dashboard (read-only) | "You have 87 CCM-eligible patients = $69,157/year you're not capturing" |
| Panel Screener | Risk-stratified screening compliance across panel |

**No enrollment workflows. No billing. No claims.** Just identification + quantification. This is the demo hook and the design partner validation tool.

**Validation question**: "You have 87 patients eligible for CCM. That's $69K/year. Would you pay us to automate the enrollment and billing?"

### v0.2 — "Enroll and Track" (6-8 weeks after v0.1)

| Feature | What Ships |
|---|---|
| CCM Enrollment Workflow | Consent tracking, care plan generation, patient assignment |
| CCM Monthly Touchpoint Tracker | Time logging, documentation sufficiency, deadline alerts |
| APCM Tier Classifier | Identify patients and assign complexity tiers |
| CCM vs. APCM Optimizer | Recommend which program is more revenue-optimal per patient |

### v0.3 — "Bill and Prove" (6-8 weeks after v0.2)

| Feature | What Ships |
|---|---|
| Claims Pre-Population | Pre-fill 99490/99439/G0557/etc. with supporting documentation |
| athenahealth Charge Write-Back | Push charges directly into athena billing |
| Monthly Revenue Report | "MedScrub captured $12,817 this month" |
| MIPS Quality Dashboard (v1) | Quality category only |

---

## What Dies or Gets Demoted

If engineering goes all-in on Revenue Engine, these features lose priority:

| Feature | Current Status | Revenue Engine Status | Why |
|---|---|---|---|
| Clinical Chat | Active dev | Pause | Cool but not revenue-generating. Resume after v0.2. |
| Patient Message Drafts | Backlog | Deprioritize | Reactive inbox management. Revenue Engine is proactive. |
| Disability/FMLA Forms | Backlog | Kill | No revenue program linkage. |
| Patient Summary | Backlog | Deprioritize | Useful but not revenue-generating. |
| Clinical Guidelines Check | Backlog | Deprioritize | Quality improvement, not revenue capture. |

---

## What Stays and Gets Enhanced

| Feature | Enhancement | Why |
|---|---|---|
| Pre-Visit Summary | Add "Revenue Opportunities" section to every pre-visit brief | Every visit is a chance to enroll a patient in CCM/APCM |
| Daily Briefing | Morph into Revenue Dashboard | The physician's daily start-of-day becomes revenue-aware |
| USPSTF Screening Gaps | Batch mode for panel-level screening | Foundation for AWV revenue + MIPS quality |
| Care Gap Nudge | Extend to CCM monthly touchpoint outreach | Each message is a billable CCM touchpoint |
| Diabetes Care Plan | Generalize to all chronic conditions | CCM requires comprehensive care plans |
| Coding Optimization | Add CCM/APCM code suggestions | Flag missed billing opportunities at point of care |
| Post-Visit Follow-up | Auto-tag as CCM/TCM touchpoint evidence | Documentation for billing compliance |

---

## The Pricing Question

| Model | Pros | Cons | Risk |
|---|---|---|---|
| Per-provider SaaS ($300-600/mo) | Simple, predictable, legally safe | Disconnected from value delivered | Low |
| Per-enrolled-patient ($15-25/mo per CCM patient) | Scales with value, easy to justify | Requires tracking enrollment | Low |
| Revenue share (10-15% of captured revenue) | Perfect value alignment, massive upside | Anti-Kickback Statute gray area, requires claims data | **High — get legal review** |
| Tiered SaaS (base + per-program) | Base covers scribing, add-ons for CCM/APCM/MIPS | Moderate complexity | Low |

**Patrick Carter founded ChartSpan.** Ask him what pricing model worked for CCM automation.

---

## The Honest Risk Assessment

### This could work because:
- The CDR gives MedScrub longitudinal data that scribes don't have
- The Skill SDK architecture can extend to batch/scheduled modes
- 17 shipped skills already touch CCM/APCM billing codes
- Small practices are underserved by enterprise CCM platforms
- CMS ACCESS Model (July 2026) adds incentives for tech-enabled chronic care

### This could fail because:
- ChronicCareIQ, TimeDoc, and Signallamp already do CCM automation for small practices
- Real-world CCM enrollment rates are 5-15%, not the 30% in our projections
- The product shift from "encounter tool" to "panel management system" is architecturally significant
- Zero customers have asked for this — it's internally derived
- athenahealth could build CCM features into athenaOne
- APCM adoption may be near-zero in Year 1-2

### The one question that resolves it:
**Call Patrick Carter. He built and sold a CCM company. Ask him if MedScrub should do this.**
