
> Structured tracker of advisor validation, pushback, and open questions
> Last updated: 2026-03-13 | Advisors: Patrick Carter, Maurice Hill, Rob Trachtman

---

## Advisor Profiles

| Advisor | Background | Last Conversation | Key Lens |
|---|---|---|---|
| Patrick Carter | Director of Engineering at CareMessage (501(c)(3) — 60M texts/year, 7-8M patients). Former PA. Founded ChartSpan (CCM company — 98% AWV completion rates, $76 PMPM cost reduction). Ex-Agilon Health. 15+ years healthcare IT. | Mar 6, 2026 | Population health compliance, screening penalties, CDR-enabled workflows |
| Maurice Hill | CPO at Optum. 25+ years healthcare informatics. HEDIS analytics, data-driven operations. | Feb 6, 2026 | Enterprise healthcare buyer, provider squeeze economics, admin burden |
| Rob Trachtman | Built Epic's prior authorization product. Runs Soft Moss (PA consulting for independent practices). | Feb 23, 2026 | Prior auth systems architecture, solo practitioner pain points, regulatory complexity |

---

## What Advisors Have Validated

### Unanimously Validated (All 3 Advisors)

| Claim | Patrick | Maurice | Rob | Implication |
|---|---|---|---|---|
| PHI proxy + CDR combination is unique and defensible | "Unstructured data extraction is the key technical capability" | "Technically sound and innovative" | "De-identification + clinical data approach is sound" | Core architecture is right |
| Solo/small practitioners are the right target | Population health screening for small practices | "Smaller providers who can't afford cloud stuff" | "Solo practitioners — more entrepreneurial, willing to be early adopters" | ICP confirmed: 1-5 provider practices |
| Providers are desperate for admin burden relief | Screening compliance takes ~2 weeks per program manually | "Provider squeeze is real" — 20%+ stock decline from Medicare rates | "Need to do many things without hiring more staff" | Pain is real and getting worse |

### Validated by 1-2 Advisors (Needs More Confirmation)

| Claim | Who Validated | Who Hasn't Weighed In | Status |
|---|---|---|---|
| Population health screening is "have to have" (penalty-driven) | Patrick (strongly) | Maurice (mentioned HEDIS), Rob (didn't address) | **Strongest signal — needs Maurice/Rob confirmation** |
| Auth denial response is high-value AI use case | Maurice ("saves 2+ days per denial") | Patrick, Rob (cautioned on full PA automation) | Partially validated |
| Prior auth evidence gathering is clean AI use case | Rob ("really, really clean use case for LLMs") | Patrick, Maurice | Needs broader validation |
| Daily briefing creates habit formation | Patrick | Maurice, Rob | Untested with real users |
| Desktop-first is right modality for small practices | Rob | Patrick, Maurice | Needs validation |

---

## What Advisors Pushed Back On

| Claim / Direction | Who Pushed Back | What They Said | Current Status |
|---|---|---|---|
| **Generic "AI Clinical Assistant" positioning** | Patrick | Features without financial penalty backing are "nice to have," not "have to have" | Repositioned to "AI Sidekick" in marketing |
| **Hospital departments as target market** | Rob | "Too many incumbents, need deep subject matter expertise, difficult to build trust as small entity" | Dropped from ICP |
| **Comprehensive prior auth automation** | Rob | "Intentionally designed as a hoop to jump through. Gets very complicated very fast." | Scoped down to evidence gathering only |
| **Competing with large healthcare companies on infrastructure** | Maurice | "Large healthcare companies already have AI doing masking PHI and doing it on-prem" | Pivoted to enablement for small practices |
| **Positioning as "protect your data from LLMs"** | Maurice | "Feels like extortion...shift from protection to enablement" | Repositioned from protection to productivity |
| **Targeting big players / enterprise** | Maurice | "It's probably not the first thing that people are looking for from the level of the big players" | Confirmed small practice focus |

---

## What Advisors Recommended (That We Haven't Built Yet)

| Recommendation | Advisor | Priority in Current Strategy | Status |
|---|---|---|---|
| **Population health screening compliance** | Patrick (strongly) | P0 in Product Strategy | Not shipped — MVP in backlog |
| **Risk-stratified patient lists** | Patrick | Part of P0 | Not shipped |
| **USPSTF tracking against patient records** | Patrick | Part of P0 (Screening Gaps skill exists) | Partially shipped |
| **Authorization denial response automation** | Maurice | Not explicitly prioritized | Not built |
| **HEDIS season medical record review** | Maurice | Related to P0 screening | Not built |
| **De-identified data marketplace** | Maurice | Not prioritized | Not in roadmap |
| **FHIR server setup for smaller providers ("Walmart of healthcare IT")** | Maurice | Not prioritized | Not in roadmap |
| **Payer policy matching against clinical records** | Rob | P2 (Prior Auth) | Not built |
| **Connect with Polus Mui / HTN community for testing** | Rob | Acknowledged | Unknown if connected |

---

## Internal Analysis vs. Advisor Validation — The Tension

| Topic | Internal Graph Analysis Says | Advisors Say | Gap |
|---|---|---|---|
| **#1 Priority** | CCM Workflows (Score: 89) | Population Health Screening (Patrick: "have to have") | **Major disconnect.** Graph analysis scored CCM highest. Patrick says screening comes first because penalties exist today. CCM is P2 in advisor framework. |
| **Revenue Pitch** | "$800/patient/year in CCM revenue" | "Tens of thousands in annual penalties per physician" for missed screenings (Patrick). "Enable providers to use AI for low-hanging fruit" (Maurice). | Revenue Engine pitch not validated by any advisor. Penalty avoidance framing has stronger advisor backing. |
| **APCM Eligibility** | Score: 88, "first-mover advantage" | Not mentioned by any advisor | **Zero advisor validation.** Entirely internal hypothesis. |
| **MIPS Dashboard** | Score: 84, "easy sell" | Not mentioned by any advisor | **Zero advisor validation.** |
| **Ambient Scribing** | "Dead as differentiator, athenaAmbient kills it" | Patrick: "nice to have." Maurice/Rob: didn't discuss scribing at all. | Advisors didn't frame scribing as a threat — they never prioritized it in the first place. |
| **CCM** | Tier 1 "Ship or Die" | Patrick: P2. Others: didn't specifically address. | CCM is important but advisors put screening compliance first. |
| **Target buyer** | Physician Owner, Office Manager, Billing Specialist | Patrick: Provider facing penalties. Maurice: "Providers desperate for relief." Rob: "Solo practitioners." | Advisors talk about the doctor, not the billing team. Revenue Engine pitch targets billing; advisor feedback targets clinical workflow. |

---

## Open Questions (Never Asked / Never Answered)

| Question | Why It Matters | Who To Ask |
|---|---|---|
| Are your practices actually billing CCM today? If so, how? | If they use ChronicCareIQ/TimeDoc already, our CCM pitch fails | Patrick (founded ChartSpan, a CCM company) |
| What percentage of your patients are Medicare? | Revenue math requires this; we don't have it for any lead | Design partner candidates |
| Would you pay for revenue optimization software vs. compliance software? | Tests Revenue Engine vs. Compliance Engine positioning | Maurice, Rob, design partners |
| Have you heard of APCM? Would you use a tool for it? | APCM is scored #2 internally with zero external validation | Patrick, billing consultants |
| What happened with the Polus Mui / HTN introduction? | Rob's strongest referral — community of technical doctors for testing | Rob |
| Why did the 3 closed-lost deals say no? | Most valuable data in the company | Closed-lost contacts |
| What features does the 1 closed-won customer actually use? | Ground truth on what matters | Existing customer |

---

## Advisor Credibility Weighting

Not all advisor input carries equal weight for every topic:

| Topic | Most Credible Advisor | Why |
|---|---|---|
| Population health / screening compliance | **Patrick Carter** | Founded ChartSpan (CCM company), 98% AWV completion, worked directly in compliance |
| Enterprise buyer behavior | **Maurice Hill** | CPO at Optum, 25 years at the largest healthcare company |
| Prior authorization systems | **Rob Trachtman** | Built Epic's PA product, currently consulting on PA for independent practices |
| Small practice economics | **Rob Trachtman** | Active consulting practice with solo providers |
| CCM market dynamics | **Patrick Carter** | Founded and ran a CCM company (ChartSpan) |
| AI in healthcare opportunity sizing | **Maurice Hill** | "Multiple billion dollar ideas in this space" — enterprise perspective |
