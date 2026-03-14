
> The CCM/RPM automation market MedScrub would enter with a "Revenue Engine" pivot
> Date: 2026-03-13 | Sources: Web research, advisor conversations, CMS fee schedule data
> Status: CRITICAL — This market is mature, not a white space

---

## The Discovery

Our internal graph analysis concluded "no competitor offers CCM automation" and scored CCM Workflows as the #1 priority (89/100). **This was wrong.** The claim was only true within the narrow frame of ambient scribe competitors. The actual CCM automation market has 8+ established players, several operating for 5+ years.

Most critically: **ChartSpan — founded by our advisor Patrick Carter — is the nation's largest CCM program.** When Patrick told us screening compliance is "have to have," he may have been steering us toward a differentiated position *away from his own competitive space.*

---

## CCM Market Players

### Full-Service / Revenue-Share Model ($0 upfront to practice)

| Company | How It Works | Pricing | Key Stats |
|---|---|---|---|
| **ChartSpan** | End-to-end outsourced CCM: patient identification, consent, care plans, monthly wellness calls, billing. Practice does essentially nothing. | Revenue share (custom, practice-specific) | Nation's largest CCM program. 98% AWV completion rate. $76 PMPM cost reduction. **Founded by Patrick Carter.** |
| **Signallamp / TelliHealth** | Embeds own US-based RNs/LPNs into the practice's EHR. No software, no integrations, no workflow changes needed. | $0 out-of-pocket. Revenue share. "100% profitability guaranteed." | Rebranded as TelliHealth (3x healthcare CEO Asif Ahmad). Partners with Stratum Med (17 independent multi-specialty groups, ~12,000 physicians). |
| **1bios** | AI-powered tech + dedicated in-house care team. Handles enrollment to billing. | Custom | Designed specifically for small to mid-size practices. |

### SaaS / Practice-Operated Model (practice pays monthly, keeps 100% of revenue)

| Company | How It Works | Pricing | Key Stats |
|---|---|---|---|
| **ChronicCareIQ** | SaaS platform for practices to run CCM internally. Red/yellow/green patient dashboard. Automatic time tracking via phone system integration (CallerIQ). | Starting $500/mo flat fee | Supports CCM, RPM, **APCM**, PCM, TCM, BHI, RTM. 30+ EHR integrations including eCW, Dialpad, Five9. Free tier available. |
| **ThoroughCare** | Unified SaaS for CCM + AWV combined workflow. Care plan templates, time tracking, billing support. | $499-$2,499/mo (by patient volume, starts at 250 patients) | 600+ healthcare providers. NCQA Prevalidated. athena, Epic, AdvancedMD, DrChrono, Elation integrations. WebMD Ignite patient education. 2-year contract (90-day out clause). |
| **CureMD** | Cloud-based CCM integrated with EHR + practice management. | Custom | Automates chronic care workflows from outreach to Medicare-compliant documentation. |

### Hybrid Model (software + optional clinical staff)

| Company | How It Works | Pricing | Key Stats |
|---|---|---|---|
| **TimeDoc Health** | 3 tiers: Software Only, Hybrid, Full Service. Provides their own medically trained care managers as remote staff augmentation. | Custom quote per tier | 50+ EHR integrations. Turnkey APCM solutions. Flexible — practice chooses how much to outsource. |

### RPM-First with CCM Add-On

| Company | How It Works | Pricing | Key Stats |
|---|---|---|---|
| **Optimize Health** | RPM platform with CCM capabilities | Custom | RPM device logistics + monitoring |
| **HealthSnap** | Integrated RPM + CCM platform | Custom | Device-enabled chronic care |
| **HealthArc** | SaaS + Full Service RPM/CCM | Custom | Broad program coverage |

---

## Market Structure

### Two Competing Models

**Model 1: "We do it for you" (Full-Service)**
- Practice pays $0 upfront
- Vendor provides nurses who work in the practice's EHR
- Vendor handles enrollment, monthly calls, documentation, billing
- Revenue split: vendor takes 40-60% of CCM reimbursement
- Practice does essentially nothing — just signs the contract
- Examples: ChartSpan, Signallamp/TelliHealth

**Model 2: "We give you the tools" (SaaS)**
- Practice pays $500-$2,500/month
- Practice uses software to run CCM internally with their own staff
- Practice keeps 100% of CCM reimbursement
- Requires staff time, training, and workflow changes
- Examples: ChronicCareIQ, ThoroughCare

**Model 3: "Choose your level" (Hybrid)**
- Software platform + optional clinical staff augmentation
- Practice chooses how much to outsource vs. run internally
- Custom pricing based on service level
- Example: TimeDoc Health

### Pricing Benchmarks

| Model | Cost to Practice | Practice Keeps | Net Revenue per Patient |
|---|---|---|---|
| Full-service revenue share | $0 upfront | 40-60% of CCM revenue | ~$30-40/patient/month |
| SaaS flat fee | $500-$2,500/mo | 100% of revenue minus fee | ~$50-65/patient/month minus software |
| SaaS per-patient | $1-8/patient/month | 100% minus per-patient fee | $55-65/patient/month |
| Full-service per-patient | $20-30/patient/month | Revenue minus fee | $35-45/patient/month |

---

## What They All Have (Table Stakes)

Every CCM platform in this market offers:

- [ ] Patient eligibility identification (2+ chronic conditions)
- [ ] Consent tracking and management
- [ ] Care plan generation from templates
- [ ] Monthly touchpoint tracking and documentation
- [ ] Time tracking for billing compliance (99490 requires 20 min/month)
- [ ] Claims pre-population with correct CPT codes
- [ ] EHR integration (read patient data, write care plans back)
- [ ] Patient dashboard with status tracking
- [ ] Billing and revenue reporting
- [ ] Multi-program support (CCM + RPM + TCM at minimum)

---

## What None of Them Have

| Capability | Why It Matters | MedScrub Has It? |
|---|---|---|
| **Ambient scribing / SOAP note generation** | Point-of-care documentation | Yes (shipped) |
| **AI-powered clinical data extraction from unstructured sources** | Faxed specialist reports, scanned records — where screening compliance data lives | Yes (CDR + PHI proxy) |
| **Population health screening compliance** | Penalty-driven "have to have" per Patrick Carter | Partially (USPSTF Screening Gaps shipped) |
| **FHIR-native Clinical Data Repository** | Longitudinal data across EHR boundaries | Yes (Medplum CDR) |
| **Multi-EHR data aggregation** | Practices on athena can't see data from specialist on Epic | Yes (athena + Epic + Cerner integrations) |
| **Pre-visit intelligence with revenue opportunity surfacing** | "This patient qualifies for CCM — enroll today" at point of care | Yes (Pre-Visit Summary shipped) |
| **AI pattern recognition across patient panel** | "What am I not seeing?" — Maurice Hill's recommendation | Possible with CDR |
| **Prior auth evidence gathering** | Rob Trachtman's "clean AI use case" | In development (Payer Policy Gap-Finder) |
| **Risk-stratified patient lists from unstructured data** | Patrick Carter: saves ~2 weeks of manual work per screening program | Not shipped (planned) |

---

## The ChartSpan Problem

Patrick Carter founded ChartSpan. ChartSpan is the nation's largest CCM program. Key facts:

- **98% AWV completion rate** — this is an extraordinary number
- **$76 PMPM cost reduction** — proven ROI
- Full-service model: practice pays nothing, ChartSpan handles everything
- Patrick now works at CareMessage (501(c)(3), 60M texts/year across 7-8M patients)

### What this means for MedScrub:

1. Patrick knows the CCM market better than anyone we have access to
2. When he said **"population health screening is have to have"** and **"SOAP notes are nice to have"** — he was speaking from experience running a CCM company
3. He did NOT say "build a CCM platform." He said build screening compliance tooling
4. He may have been deliberately steering us toward the gap he saw that ChartSpan doesn't fill: **AI-powered unstructured data extraction for screening compliance**
5. Or he may have been avoiding pointing us at his own competitive space

**This must be asked directly.** See [[Advisor Questions — Next Conversations]].

---

## Three Strategic Paths

### Path A: Compete in CCM Head-On

Build what ChronicCareIQ and ThoroughCare already offer, but with AI and a CDR.

| Pros | Cons |
|---|---|
| Market is large ($3B) and growing (10.8% CAGR) | 8+ established players with 5+ years head start |
| CMS increasing reimbursement for independent practices in 2026 | Full-service model ($0 upfront, revenue share) is brutal to compete against |
| CDR gives unique longitudinal data advantage | ChronicCareIQ already supports APCM — "first-mover" claim is false |
| AI could automate what competitors do manually | Your own advisor's company is the market leader |
| Validated price point ($500-$2,500/mo) | Building compliant billing automation is months of work |

### Path B: Build What Nobody Has (Intelligence Layer)

AI-powered population health screening + patient eligibility identification that *feeds into* existing CCM workflows. MedScrub becomes the clinical intelligence layer.

| Pros | Cons |
|---|---|
| No CCM platform does AI-powered unstructured data extraction | Smaller market — "intelligence" is harder to sell than "revenue" |
| Directly validated by Patrick Carter ("have to have") | Practices may not understand the value until they see it |
| CDR + PHI proxy uniquely enables this | Doesn't capture the billing revenue (CCM platforms do) |
| Defensible moat — requires deep AI + clinical data infrastructure | Revenue model is less obvious than CCM billing |
| Complementary to CCM platforms, not competitive | Risk of being a feature, not a product |

### Path C: Partner with a CCM Platform

Integrate with ChronicCareIQ, ThoroughCare, or TimeDoc. MedScrub identifies patients + provides clinical AI. CCM platform handles enrollment, tracking, billing.

| Pros | Cons |
|---|---|
| Fastest path to market — no billing automation to build | Dependent on partner's roadmap and priorities |
| Access to partner's existing customer base | Revenue share reduces MedScrub's take |
| Plays to MedScrub's strengths (AI, CDR, clinical intelligence) | Partners could eventually build the AI features themselves |
| Validates demand before building own CCM workflows | Less control over the full customer experience |
| Could partner with ChartSpan via Patrick Carter | Partnership discussions take time |

### Path D: The Hybrid (Most Likely Right Answer)

Ship the intelligence layer (Path B) as v1. Use it as the enrollment hook for a lightweight CCM workflow (Path A). Explore partnerships (Path C) in parallel.

Concretely:
1. **v0.1**: Eligibility scanner + revenue dashboard (show practices their uncaptured revenue)
2. **v0.2**: If practices want MedScrub to also handle enrollment/tracking/billing, build it. If they already use ChronicCareIQ or ThoroughCare, integrate with it.
3. **Let customer demand decide** whether MedScrub becomes a full CCM platform or an intelligence layer that works alongside one.

---

## CMS 2026 Tailwinds

Regardless of path, the macro environment favors this market:

- **+3.26% PFS conversion factor increase** for non-APM providers in 2026
- **+4% site-of-service differential** specifically increasing reimbursement for independent office settings over hospitals — structural advantage for MedScrub's ICP
- **CCM exempt from -2.5% efficiency adjustment** that hits visit-based services
- **CMS ACCESS Model launching July 2026** — adds incentives for tech-enabled chronic care
- **Concurrent CCM + TCM billing** already operational from 2025

The market is getting *more* attractive for independent practices, not less.

---

## What To Do With This Information

| Action | Priority | Timeline |
|---|---|---|
| **Call Patrick Carter** and directly ask: "You founded ChartSpan. Should MedScrub build CCM or build the intelligence layer ChartSpan doesn't have?" | Critical | This week |
| **Request ChronicCareIQ demo** through a friendly practice to understand the actual product | High | This week |
| **Request ThoroughCare demo** — they integrate with athenahealth | High | This week |
| Update Competitive Intelligence Matrix with CCM market players | Medium | After demos |
| Decide: Path A / B / C / D | Critical | After Patrick conversation |

---

## Related Documents

- [[Advisor Feedback Tracker]] — What advisors actually validated vs. internal assumptions
- [[Advisor Questions — Next Conversations]] — Specific questions for Patrick about ChartSpan and CCM market
- [[Revenue Engine Product Morph]] — What the product looks like if we go Path A
- [[Critical Features to Win]] — Internal priority scoring (needs updating based on this analysis)
- [[Competitive Intelligence Matrix]] — Ambient scribe competitors (needs CCM players added)
