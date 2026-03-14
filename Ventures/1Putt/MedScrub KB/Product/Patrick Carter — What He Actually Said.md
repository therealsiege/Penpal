
> Synthesized advisor guidance from Patrick Carter, distilled from full conversation transcript
> Conversation date: March 6, 2026
> Patrick's current role: Director of Engineering, CareMessage (501(c)(3) — 60M texts/year, 7-8M patients)
> Background: Founded ChartSpan (nation's largest CCM program, 98% AWV completion, $76 PMPM cost reduction). Ex-Agilon Health. Former PA. 15+ years healthcare IT.

---

## The Core Thesis Patrick Gave Us

**Build AI that extracts structured intelligence from unstructured clinical documents — faxed specialist reports, scanned intake forms, PDFs in patient charts — and produces risk-stratified patient lists for screening compliance.**

This is the problem he saw at Agilon that couldn't be solved. It's the problem CareMessage faces today in identifying patients for outreach programs. And it's the gap that ChartSpan (his own CCM company) doesn't fill.

---

## What He Validated

### The Architecture Is Right

Patrick confirmed that MedScrub's PHI proxy + CDR combination is the correct technical foundation. The proxy enables safe AI processing of unstructured patient data. The CDR (Medplum) provides the longitudinal FHIR data store. Together, they enable population health analysis that's structurally impossible for conversation-based scribes.

### The Target Market Is Right

Small practices, multiple EHRs. Patrick relayed Maurice Hill's framing: enterprise players (Heidi, etc.) are offering end-to-end solutions at $800/seat for large organizations. MedScrub should be the "Walmart" — serving smaller practices and physicians across multiple EHRs that can't afford the enterprise tools.

### The Problem Is Real and Unsolved

Specific evidence from Patrick:

- **Colorectal cancer screening** requires complex logic beyond simple age criteria. Age 55+, OR age 34+ with first-degree relative history. The family history data lives in unstructured intake forms.
- **Colonoscopy records** from specialist offices exist only as faxed reports in patient charts — no structured EHR data.
- **Manual screening compliance** takes approximately 2 weeks per screening program.
- **Financial penalties** amount to tens of thousands of dollars per physician per year for non-compliance.
- **This is a "have to have"** because the government mandates screening compliance. SOAP notes are "nice to have."
- **Agilon couldn't solve this.** Patrick worked there and saw it firsthand.

### The Skill-Based Architecture Has Potential

Patrick was excited by the Codex-inspired "Skills" approach — customizable AI workflows that physicians could build themselves. He specifically suggested building screening "cards" where a doctor could configure parameters (age, demographics, risk factors) and run them against their panel.

---

## What He Steered Us Away From

### SOAP Notes as Primary Value Proposition

> "Every doctor will tell you it's a nice to have, not a have to have."

Patrick didn't dismiss SOAP notes — he said they're fine as a feature. But they shouldn't be the reason a practice buys MedScrub. Screening compliance should be.

### Competing with Enterprise AI Scribes

> "Big players — Heidi and some of these really big AI players — they're kind of going more end-to-end... they're only doing it for the big players because they cost like $800 a seat."

Don't try to out-feature Heidi, Abridge, or Ambience on scribing. They're enterprise. Be the Walmart.

### Generic "AI Clinical Assistant" Positioning

Features without financial penalty backing are "nice to have." Patrick's framing is that the product should lead with screening compliance (penalty avoidance) and USPSTF recommendations (reduce cognitive load), not with "AI assistant" messaging.

---

## What He Did NOT Say

This is equally important. Patrick never mentioned:

- CCM enrollment workflows
- CCM billing codes (99490, 99439)
- APCM eligibility or tier classification
- Monthly touchpoint tracking
- Claims pre-population
- Revenue dashboards
- MIPS scoring

He founded ChartSpan — the nation's largest CCM program. He could have said "build what I built." He didn't. He pointed upstream to the intelligence layer.

---

## The Output He Described

Patrick gave a very specific picture of what the product should produce:

> "The artifact out of that is a list of all of your patients broken up by risk factor — high risk, low risk, medium risk — that need to have screenings done."

> "I flag the ones that are coming in that have an appointment scheduled in the next two weeks."

> "If you walked in and you're like, 'this is what you would do to get a list of patients that need colorectal cancer screening,' and in 5-10 seconds, come back to it 20-30 minutes, let it do its thing... they will go bonkers. They'll be like, I don't care what it costs."

The output is:
1. A risk-stratified patient list (high/medium/low risk)
2. Filtered by upcoming appointments
3. Generated from a single skill/card click
4. Runs in background for 20-30 minutes against the panel
5. Result lands in inbox or dashboard

---

## The CareMessage Connection

Patrick is now at CareMessage, which sends 60M texts/year across 7-8M patients for community health centers. During the conversation, he described exactly the problem his current organization faces:

> "Where we are struggling is identifying those patients and getting the data out of the EHR that says, oh, that's a patient that needs a colorectal cancer screening."

CareMessage has the outreach engine (texts, patient engagement). They don't have the intelligence engine (which patients need what screening). This is a potential integration or partnership opportunity — MedScrub identifies the patients, CareMessage reaches them.

---

## Other Valuable Intel from Patrick

### EHR Integration Landscape

- NextGen is particularly difficult — requires extensive error handling and resilience
- NextGen recently changed pricing to become more expensive
- ECW has improved FHIR APIs in the past year but still has issues
- Athena has proprietary APIs beyond FHIR
- Vim is useful for some EHR connectivity (ECW, NextGen) but has limitations

### Grant Opportunities

- SBIR grants are a potential funding path — requires academic institution as PI
- Clarity Health grants likely coming back Q3/Q4 2026
- Patrick has a 250-page SBIR grant template from Baylor/Brandon collaboration — offered to share format
- Strategy: use AI to generate grant applications in the required format

### Market Context

- MedScrub is "halfway there to a really great idea" (relaying Maurice Hill's assessment)
- The hard part is selling, not building
- Billing at population health organizations is huge revenue opportunity
- Providers are reluctant to use AI because of data breach concerns — MedScrub's PHI proxy directly addresses this

---

## Action Items from This Conversation

| Action | Status |
|--------|--------|
| Patrick sends colorectal cancer screening guidelines/algorithms | Requested — message sent |
| Patrick answers: what format should the output be? | Requested — message sent |
| Patrick answers: who acts on the screening list (doctor, nurse, front desk)? | Requested — message sent |
| Explore CareMessage integration/partnership | Future — after v0.1 proven |
| Get SBIR grant template from Patrick | Future — Q3/Q4 timing |
| Build colorectal cancer screening card | Next — pending algorithm from Patrick |

---

## Related Documents

- [[Strategic Direction Decision]] — The decision Patrick's advice shaped
- [[Advisor Feedback Tracker]] — Structured comparison across all three advisors
- [[Advisor Questions — Next Conversations]] — Follow-up questions for Patrick
- [[v0.1 Product Spec — Panel Screener]] — The first build based on his guidance
