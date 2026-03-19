
> Derived from Knowledge Graph analysis (77,127 nodes), competitive intelligence, and CMS revenue modeling
> Date: 2026-03-13

---

## The Core Thesis

Ambient scribing is dead as a differentiator. athenaAmbient makes it free for 170K providers (99% of our leads). The features that win are the ones **no competitor is building**.

---

## Tier 1: Ship or Die (0-3 months)

### CCM Workflow Automation (Priority Score: 89)

- **Revenue**: $795/patient/year
- **Pipeline match**: 136 FM+IM leads are immediate targets
- **Competition**: Only 4 companies touch this space, none automate end-to-end
- **What it does**: Identify eligible patients (2+ chronic conditions), generate care plans, track monthly touchpoints, pre-populate 99490/99439/99491 claims
- **Why we win**: Requires longitudinal patient data + billing workflow automation. Ambient scribes can't do this.

### APCM Eligibility Tool (Priority Score: 88)

- **Revenue**: $624-$1,032/patient/year
- **Competition**: Zero. No competitor offers this.
- **What it does**: New CMS program (2025) -- most practices don't know it exists. Identify eligible patients, calculate expected revenue, track complexity tiers (G0556/G0557/G0558), automate billing
- **Why we win**: First-mover advantage is massive. Practices need education + tooling simultaneously.

### MIPS Dashboard (Priority Score: 84)

- **Revenue**: Penalty avoidance -- up to -9% on all Medicare reimbursement
- **Competition**: No ambient scribe competitor does this
- **What it does**: Show practices their MIPS score, which quality measures are failing, and what MedScrub can automate to fix them
- **Why we win**: Easiest executive sale -- "stop losing money." USPSTF Screening Gaps skill already shipped as foundation.

---

## Tier 2: Deepen the Moat (3-6 months)

### Payer Contract Analyzer (Priority Score: 79)

- **What it does**: Read payer contracts, flag underbilled codes, compare reimbursement rates across payers, identify missing modifiers
- **Why we win**: Requires CDR access -- deep data moat that can't be replicated without MedScrub's FHIR infrastructure. No competitor has this capability.

### Between-Visit Outreach Automation (Priority Score: 78)

- **What it does**: Automated patient outreach between visits for CCM/RPM compliance, care gap closure, medication adherence
- **Why we win**: Each touchpoint is a billable event. This turns CCM from "nice to have" into a recurring revenue machine for practices. Post-Visit Follow-up skill already shipped as foundation.

### Revenue Check Expansion (Priority Score: 81)

- **What it does**: Proactive revenue identification across all CMS programs per patient. Surfaces every dollar a practice is leaving on the table.
- **Why we win**: Combines CDR data, payer intelligence, and billing code knowledge into a single actionable view.

### Prior Auth Automation -- Full (Priority Score: 71)

- **What it does**: Automate prior authorization workflows. CMS-0057-F mandate (Jan 2026) creates regulatory urgency.
- **Why we win**: Mandate-driven demand. Expand beyond current MRI + Specialty Drug coverage.

---

## What Makes These Unbeatable

The graph community detection algorithm revealed something structural: MedScrub's closest cluster is the **interoperability cluster** (Epic, athena, Cerner, FHIR), not the competitor cluster. The competitors are all fighting over the ambient scribing UX. MedScrub's moat is at the infrastructure layer:

1. **FHIR-native CDR** -- no competitor has this
2. **Multi-EHR data access** -- athenaAmbient is locked to athena; Abridge is Epic-focused
3. **Longitudinal patient data** -- revenue programs require tracking across visits, not just documenting one encounter
4. **Billing workflow automation** -- scribes write notes, MedScrub captures revenue

---

## What NOT to Build

| Don't Do | Why |
|---|---|
| Compete on ambient scribing quality | athenaAmbient makes it free for 99% of our leads |
| Build RPM before CCM/APCM | RPM requires device partnerships; CCM/APCM are software-only |
| Chase enterprise deals | Abridge ($800M) and Ambience ($243M) own that lane |
| Build a general clinical AI chatbot | BastionGPT, Sage, and a dozen others are there |
| Enterprise patient comms at scale | 10+ well-funded competitors |
| Healthcare AI infrastructure platform play | Too broad -- stay focused on clinical workflows |

---

## The Revenue Math

### 5-Provider Family Medicine Practice, 500 Medicare Patients

| Program | Eligible Patients | Revenue/Patient/Year | Annual Revenue |
|---|---|---|---|
| CCM (99490) | 150 | $795.60 | $119,340 |
| APCM (G0557 moderate) | 200 | $624.00 | $124,800 |
| MIPS penalty avoidance | All providers | +9% on Medicare | ~$45,000 saved |
| **Total new revenue** | | | **$289,140/year** |

MedScrub's platform fee pays for itself in the first month.

---

## The Pitch in One Line

> "athenaAmbient writes your notes for free. MedScrub finds the $400K/year you're leaving on the table."

---

## Scoring Methodology

Each feature scored 0-100 using weighted criteria:

| Criterion | Weight | Description |
|---|---|---|
| Revenue Impact | 30% | Direct/indirect revenue generation for practices |
| Competitive Moat | 25% | How defensible against athenaAmbient + funded competitors |
| Data Advantage | 20% | Leverages MedScrub's FHIR/CDR infrastructure uniquely |
| ICP Alignment | 15% | Matches small FM/IM athenahealth practice profile |
| Build Effort | 10% | Inverse -- lower effort = higher score |

---

## Related Documents

- [[Competitive Intelligence Matrix]] -- Feature/pricing comparison across 9 products
- [[Messaging Playbook]] -- Revenue Engine positioning, persona pitches, objection handlers
- [[Design Partner Shortlist]] -- Top pilot candidates with outreach strategy
- [[Graph Intelligence Report]] -- Full knowledge graph analysis
