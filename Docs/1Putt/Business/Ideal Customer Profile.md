# 1Putt Health — Ideal Customer Profile

Last updated: 2026-03-14

---

## Primary ICP: Series A-C Digital Health Startups

This is where 1Putt wins most often and delivers the most value. These companies have money, urgency, and a gap that 1Putt fills precisely.

### Company Characteristics
- **Stage:** Series A through Series C (post-product, scaling revenue)
- **Funding:** $5M-50M raised
- **Headcount:** 10-100 employees total, 3-25 engineers
- **Revenue:** $500K-10M ARR (or pre-revenue with enterprise LOIs)
- **Location:** US-based or selling into US healthcare market
- **Founded:** Within last 5 years

### Technical Profile
- Building or planning EHR integrations (Epic, Cerner/Oracle Health, athenahealth, eClinicalWorks)
- Using or evaluating integration middleware (Redox, Mirth Connect, Rhapsody, Health Gorilla)
- Working with clinical data: FHIR R4, HL7v2, CCDA, claims (837/835)
- Cloud infrastructure on AWS or Azure (not yet on GovCloud but should be)
- Engineering team is strong on product/web but weak on healthcare-specific protocols and compliance

### Business Signals
- Just signed or pursuing first health system or payer contract
- Enterprise prospect asking for HIPAA BAA, HITRUST certification, or SOC 2 report they don't have
- Board or investors asking about compliance posture and the answer is "we're working on it"
- CTO or VP Engineering is a generalist — strong technically but first time in healthcare
- Attempted a FHIR integration internally and it took 3x longer than expected
- Recently hired a Head of Partnerships or Enterprise Sales (sign they're going upmarket)

### Buyer Personas

**Primary buyer: CTO / VP Engineering**
- Age 28-45, typically 2-10 years of engineering leadership experience
- Strong in web/mobile/cloud, limited healthcare domain experience
- Frustrated by FHIR spec complexity, HL7v2 legacy, and compliance overhead
- Needs a trusted peer who has done this before, not a vendor who will sell them a platform
- Cares about: code quality, architecture decisions, not getting locked into bad vendors

**Secondary buyer: CEO / Founder**
- Non-technical or semi-technical founder who built v1 but needs help scaling
- Under pressure from investors to demonstrate enterprise readiness
- Wants someone who can speak to both the board and the engineering team
- Cares about: timeline, cost, credibility with enterprise customers

**Economic buyer: CFO / Head of Finance (at Series B+)**
- Evaluating build vs buy vs fractional hire economics
- Comparing 1Putt retainer ($10-15K/month) vs full-time VP Eng hire ($250-350K/year + equity + ramp time)
- Cares about: burn rate impact, time to value, contract flexibility

### Engagement Entry Points
1. **FHIR integration project** (most common) — they have a customer requiring Epic connectivity and need it in 8-12 weeks
2. **Fractional CTO** — CEO realizes they need a healthcare-experienced technical leader but can't afford or recruit one full-time
3. **Compliance fire drill** — enterprise deal contingent on HIPAA/HITRUST, timeline is 60-90 days
4. **Architecture review** — new technical leader wants independent assessment of inherited codebase

---

## Secondary ICP: Health Tech Companies Scaling Integration Infrastructure

### Company Characteristics
- **Stage:** Series B+ or bootstrapped/profitable
- **Headcount:** 25-200 employees
- **Revenue:** $5M-30M ARR
- **Integration maturity:** Has working integrations but they're brittle, slow, or built on legacy tech

### Technical Profile
- Running Mirth Connect or Rhapsody with 10-50+ channels/interfaces
- Integration infrastructure maintained by 1-2 people (key-person risk)
- Want to migrate to FHIR-based architecture but can't pause current operations
- Data quality issues across integrations (inconsistent mapping, missing validation)
- Performance problems under load (growing patient volume straining HL7v2 feeds)

### Business Signals
- Integration team member leaving (or already left) and nobody else understands the Mirth channels
- New customer segment requires integration pattern they haven't built before
- Compliance audit flagged integration-layer security gaps
- CEO said "we need to modernize our integration layer" in an all-hands

### Why They Hire 1Putt
They don't need a fractional CTO — they have technical leadership. They need a specialist who can assess their integration architecture, design a migration path, and execute the hardest parts of the transition without disrupting live production feeds.

**Typical engagement:** Technical Strategy ($20-25K) followed by Product Engineering ($40-80K project) for the migration.

---

## Tertiary ICP: Healthcare Investors

### Firm Characteristics
- **Type:** VC (healthcare or health tech focused), PE (growth equity, healthcare services)
- **AUM:** $100M-5B
- **Portfolio:** 5-30 health tech companies
- **Stage focus:** Series A-C (VC) or growth/buyout (PE)

### Buyer Persona: Deal Team Lead / Partner
- Evaluating acquisition or investment in health tech company
- Needs independent technical assessment to validate (or challenge) the company's claims
- Timeline is tight — diligence period is 2-4 weeks
- Values speed, credibility, and a clear written deliverable they can share with IC

### Why They Hire 1Putt
Generic technical diligence firms don't understand healthcare. They can assess code quality and infrastructure but can't evaluate FHIR conformance, HIPAA architecture, EHR integration maturity, or clinical data pipeline reliability. 1Putt can.

**Typical engagement:** Technical Due Diligence ($10-15K), 2-3 week turnaround.

**Strategic value:** Every diligence engagement is a two-sided lead gen opportunity. The investor becomes a repeat buyer (2-4 deals/year). The portfolio company becomes a potential retainer client.

---

## Anti-Patterns: Who 1Putt Should NOT Pursue

### Large Health Systems with IT Departments
- **Why not:** They have 50-500 person IT teams, established vendor relationships (Epic, Oracle, Accenture), and procurement processes that take 6-12 months. They hire Nordic or Tegria, not boutique firms.
- **Exception:** Innovation lab or digital health spinout from a health system — these act like startups.

### Pre-Seed / Unfunded Startups
- **Why not:** Budget under $25K for any engagement. Founders want free advice framed as "partnership." Scope creep is guaranteed because nothing is defined yet.
- **Exception:** Founder is a repeat entrepreneur with personal capital and clear timeline. Or: warm introduction from an advisor or investor where the relationship has long-term strategic value.

### Staff Augmentation Seekers
- **Why not:** Companies wanting to rent a developer at $75-100/hour to sit in their sprint and write tickets. This is a commodity market with razor-thin margins. 1Putt competes on expertise, not hours.
- **Red flag language:** "We just need another pair of hands," "Can you embed with our team and pick up tickets?"

### Companies with No Technical Decision-Maker
- **Why not:** If the person evaluating 1Putt can't make a technical architecture decision without committee approval, the sales cycle will drag and the engagement will be micromanaged by non-technical stakeholders.
- **Red flag:** "We'll need to get our board to approve the architecture recommendations before we can implement anything."

### Non-Healthcare Companies
- **Why not:** 1Putt's premium is healthcare domain expertise. A fintech company needing a fractional CTO should hire someone else. Don't dilute the brand.
- **Exception:** Adjacent industries (life sciences, health insurance, pharma) where clinical data and compliance expertise apply.

---

## Qualification Criteria

Use these five gates to qualify inbound and outbound leads. All five must be met to pursue actively.

| Gate | Criteria | How to Verify |
|------|----------|---------------|
| **Budget** | $25K+ available for initial engagement | Ask directly: "What budget range have you allocated for this?" |
| **Timeline** | Active project or decision within 90 days | "When do you need this completed by?" or "What's driving the timeline?" |
| **Authority** | Technical decision-maker is accessible and engaged | First call must include CTO, VP Eng, or technical founder |
| **Need** | Healthcare-specific technical gap that 1Putt uniquely fills | Discovery call confirms FHIR/integration/compliance need |
| **Fit** | Company matches primary or secondary ICP | Verify stage, funding, headcount, and technical profile |

### Lead Scoring (Internal Use)

| Signal | Points |
|--------|--------|
| Series A-C digital health startup | +20 |
| Actively building EHR integrations | +15 |
| CTO/VP Eng on first call | +15 |
| Budget confirmed $25K+ | +15 |
| Timeline under 90 days | +10 |
| Referred by advisor or existing client | +10 |
| HIPAA/HITRUST urgency | +10 |
| Enterprise deal contingent on compliance | +10 |
| Pre-seed / no funding | -20 |
| "Staff aug" language used | -15 |
| No technical decision-maker accessible | -15 |
| Non-healthcare company | -20 |

**Score interpretation:** 50+ = pursue aggressively. 30-49 = qualify further. Under 30 = pass or defer.
