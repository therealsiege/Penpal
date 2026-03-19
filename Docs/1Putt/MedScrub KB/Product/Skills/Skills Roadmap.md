Created: February 2026
Tags: Product, Engineering
*Updated: March 7, 2026*

## Skill SDK

All AI workflows are now defined as declarative `.skill.json` files executed through a single generic pipeline (`executeSkill()`). Adding a new skill requires creating a JSON file — no TypeScript changes, no rebuild. See [Architecture.md](Architecture.md) for technical details.

**Skill files:** `desktop/src/skills/*.skill.json`
**Extensions (complex logic):** `desktop/src/skills/*.ext.ts` (3 of 17 skills)
**Registry:** `desktop/src/renderer/lib/skill-registry.ts`
**Executor:** `desktop/src/renderer/lib/skill-executor.ts`

---

## Implemented Skills (17)

### Documentation (3)
| Skill ID | Name | Status | Notes |
|----------|------|--------|-------|
| `soap-note` | SOAP Note Generator | Shipped | Structured SOAP from encounter notes + CDR |
| `icd10-suggester` | ICD-10 Code Suggester | Shipped | Code suggestions from clinical narrative |
| `coding-optimization` | Coding Optimization | Shipped | E/M code analysis using 2021 AMA MDM. Extension: JSON parsing, skips re-identify |

### Pre-Visit (3)
| Skill ID | Name | Status | Notes |
|----------|------|--------|-------|
| `pre-visit-summary` | Pre-Visit Summary | Shipped | Single-patient visit prep from CDR. #1 most-used feature |
| `daily-briefing-header` | Daily Briefing Overview | Shipped | Schedule-wide summary for batch briefings |
| `screening-gap-analyzer` | USPSTF Screening Gaps | Shipped | Population-level screening compliance |

### Authorization (2)
| Skill ID | Name | Status | Notes |
|----------|------|--------|-------|
| `prior-auth-mri` | Prior Auth (MRI) | Shipped | MRI-specific medical necessity letter. Extension: prompt variant routing |
| `prior-auth-specialty-drug` | Prior Auth (Specialty Drug) | Shipped | Drug-specific auth letter. Extension: prompt variant routing |

### Patient Communication (4)
| Skill ID | Name | Status | Notes |
|----------|------|--------|-------|
| `message-lab-results` | Lab Results Message | Shipped | Patient-friendly lab explanation. AB 3030 disclosure appended |
| `message-post-visit` | Post-Visit Follow-up | Shipped | Care plan reinforcement after visit. AB 3030 disclosure appended |
| `message-pre-visit-prep` | Pre-Visit Prep Message | Shipped | Appointment preparation instructions. AB 3030 disclosure appended |
| `message-care-gap` | Care Gap Nudge | Shipped | Overdue screening/vaccination reminder. AB 3030 disclosure appended |

### Care Coordination (2)
| Skill ID | Name | Status | Notes |
|----------|------|--------|-------|
| `referral-letter` | Referral Letter | Shipped | Specialist referral with clinical history |
| `care-plan-diabetes` | Diabetes Care Plan | Shipped | Comprehensive diabetes management plan |

### Clinical (3)
| Skill ID | Name | Status | Notes |
|----------|------|--------|-------|
| `lab-results-explanation` | Lab Results Explanation | Shipped | Clinical lab interpretation for physicians |
| `lab-triage` | Lab Result Triage | Shipped | Urgency triage and follow-up recommendations |
| `patient-education` | Patient Education | Shipped | Condition-specific education materials |

---

## Active Development

1. **Clinical Chat**
	- What: Ask questions about a patient's chart in natural language, safely
	- Why: "Did this patient ever have an abnormal TSH?" — answered in seconds, not minutes of chart-digging
	- Status: Requires conversational interface, not yet a skill (multi-turn, not single-shot)

2. **Payer Policy Gap-Finder**
	- What: Match payer policy documents against clinical records to surface documentation gaps before prior auth submission
	- Why: Prior auth is 13+ hours/week for practices. Human-in-the-loop gap-finding is the honest, achievable use case.
	- Status: Requires document upload + external adapter support (Skill SDK Phase 3)

---

## Backlog (Future Skills)

1. **Revenue Check** — Pre-billing documentation and coding review. Catches gaps before claims go out. Inspired by Claim Health's "Revenue Assurance."
2. **Patient Message Drafts** — Portal message responses drafted from chart context (reply to incoming patient message, not proactive like current messaging skills).
3. **Disability/FMLA Forms** — Auto-populate disability and FMLA forms with cited clinical evidence from CDR.
4. **Clinical Guidelines Check** — Evaluate care plan against current guidelines. Flag deviations, suggest evidence-based adjustments. Inspired by Corti's Clinical Guidelines Agent.
5. **Patient Summary** — One-page longitudinal overview for referrals, transfers, or quick chart review. Different from pre-visit (appointment-focused).
6. **Chronic Care Management (CCM)** — Monthly check-in summaries, care plan updates, billing documentation for CCM codes.

---

## Skill SDK Roadmap

| Phase | Status | Description |
|-------|--------|-------------|
| Phase 1: Schema + Registry + Executor | Shipped | JSON skill files, Zod validation, generic pipeline, 17 skills converted |
| Phase 2: IPC + User Skills | Planned | Load skills from `~/.medscrub/skills/`, IT admin authoring |
| Phase 3: Adapter Runtime | Planned | External API connectors (FHIR queries, HTTP), output adapters (PDF, EHR write-back) |
| Phase 4: Skill UI | Future | Skill browser, editor for physicians, marketplace on medscrub.ai |
