
> Targeted questions to close specific blind spots with each advisor
> Date: 2026-03-13 | Priority: Ask these before committing engineering to Revenue Engine features

---

## Patrick Carter — Next Conversation

Patrick is the most credible voice on CCM and population health. He founded ChartSpan (a CCM company). He's the person to pressure-test the Revenue Engine thesis against.

### Must-Ask Questions

1. **"You founded ChartSpan. What percentage of independent FM/IM practices are already billing CCM through a third-party service like ChartSpan, TimeDoc, or Signallamp?"**
   - Why: Our internal analysis claims "no competitor offers CCM automation." Patrick's own company did exactly this. We need to understand the existing CCM outsourcing market before we build into it.

2. **"When you said population health screening is 'have to have' — what specific financial penalties have you seen hit practices? Can you give me a real dollar amount from a practice you've worked with?"**
   - Why: We're building our P0 around this claim. We need the real numbers, not estimates.

3. **"We're considering positioning MedScrub as a 'Revenue Engine' — CCM, APCM, MIPS automation — instead of a compliance/screening tool. What's your reaction?"**
   - Why: Tests whether the advisor who set our P0 priority (screening) agrees with the P0 our internal analysis produced (CCM revenue). His reaction will tell us which framing is right.

4. **"APCM launched in 2025. Are you seeing any adoption among independent practices? Would a tool that identifies APCM-eligible patients and automates billing be valuable?"**
   - Why: APCM is scored #2 internally with zero external validation. Patrick is the best person to validate or kill this.

5. **"For a 3-provider family medicine practice with 300 Medicare patients, what's a realistic CCM enrollment rate? Not the theoretical eligible pool — the actual number who consent, stay enrolled, and get billed monthly."**
   - Why: Our revenue projections assume 30% enrollment. Industry data suggests 5-15%. Patrick ran a CCM company — he knows the real number.

6. **"If you were building MedScrub today, would you lead with screening compliance or revenue capture? Which pitch gets a practice to say yes faster?"**
   - Why: Direct test of our positioning debate.

### Nice-to-Ask

7. "What killed ChartSpan deals? What objection did you hear most often?"
8. "How do practices currently handle USPSTF screening tracking? Spreadsheets? EHR reports? Nothing?"
9. "Would you be willing to introduce us to 2-3 practices you've worked with for design partner conversations?"

---

## Maurice Hill — Next Conversation

Maurice sees healthcare from the enterprise/Optum level. His value is understanding where the market is going, not where small practices are today. He also specifically offered to collaborate.

### Must-Ask Questions

1. **"You mentioned authorization denial responses save 2+ days. Can you walk me through the actual workflow a provider goes through today when a denial comes in? What does 'automate this' look like in practice?"**
   - Why: This was his highest-conviction recommendation. We need enough detail to scope a v0.1.

2. **"You said 'providers are desperate for AI to replace middle-management administrative tasks.' Can you rank the top 3 admin tasks you'd eliminate first?"**
   - Why: Tests whether CCM/APCM/MIPS are in his top 3, or whether it's completely different tasks (denial responses, HEDIS, scheduling).

3. **"We're seeing athenahealth bundle free ambient scribing (athenaAmbient) for 170K providers. From the Optum perspective, how does this change what small practices will pay for?"**
   - Why: Maurice understands enterprise dynamics. His read on athenaAmbient's impact carries more weight than our internal speculation.

4. **"You mentioned the 'Walmart of healthcare IT' — FHIR server setup for providers who can't afford Epic. Is that a viable standalone product, or is it a feature of something bigger?"**
   - Why: This was a distinctive recommendation no other advisor made. Need to understand if it's a throwaway idea or a real conviction.

5. **"Would Optum or organizations like Optum ever partner with a tool like MedScrub to push into small practices? Or is the small practice market too fragmented for enterprise interest?"**
   - Why: Tests whether there's a B2B2C channel through population health organizations.

6. **"You offered to collaborate. What specifically would be most useful? Introductions to practices? Product feedback on wireframes? Clinical workflow validation?"**
   - Why: He explicitly said he wants to help. Activate that offer with a specific ask.

### Nice-to-Ask

7. "During HEDIS season, what's the most painful part for providers you work with? Is it the data collection, the analysis, or the submission?"
8. "What does Optum use internally for CCM workflow management? Is there a gap for small practices that aren't on an Optum platform?"

---

## Rob Trachtman — Next Conversation

Rob's value is deep PA systems knowledge and the solo practitioner lens. He's also the connection to Polus Mui and the HTN community.

### Must-Ask Questions

1. **"Did you connect us with Polus Mui? What happened with that introduction?"**
   - Why: Polus runs a solo practice, has an engineer friend building similar tech, and is in the Health Tech Nerds community. This could be the fastest path to design partners.

2. **"You said solo practitioners are the best target. What software do they currently spend money on besides their EHR? What's their monthly software budget?"**
   - Why: We need to understand willingness to pay and competitive budget. If they spend $200/month total on non-EHR software, a $500/month MedScrub subscription is DOA.

3. **"For the prior auth evidence gathering use case — what would a v0.1 look like? Is it literally 'upload a payer policy PDF and a patient chart, and we tell you what documentation is missing'?"**
   - Why: Rob said this is the "really clean AI use case." We need to scope it concretely.

4. **"We're considering a 'Revenue Engine' positioning — helping practices capture CCM, APCM, MIPS revenue. From your experience with solo practitioners, would that pitch resonate? Or do they care more about time savings?"**
   - Why: Direct validation of Revenue Engine vs. time-savings positioning with the person who knows solo practitioners best.

5. **"You mentioned prior auth is 'intentionally designed as a hoop to jump through.' Does that mean practices will always need human involvement, or can the AI handle enough to make it worth automating?"**
   - Why: Calibrates how far we can take PA automation before hitting a ceiling.

6. **"Are there other communities besides HTN where technical physicians hang out? Where would you go to find 10 practices willing to beta test?"**
   - Why: Design partner sourcing beyond our CRM pipeline.

### Nice-to-Ask

7. "What's Soft Moss's pricing model? Per-practice, per-denial, retainer?"
8. "Are you seeing any new PA-related tools enter the market since we last spoke?"

---

## Design Partner Candidates — First Conversations

These questions are for the actual practices, not advisors. The advisors shape the strategy; the practices validate it.

### Qualifying Questions (First 5 Minutes)

1. "How many providers are in your practice?"
2. "What EHR are you on?"
3. "What percentage of your patients are Medicare?" **(Critical — qualifies the revenue thesis)**
4. "Are you currently billing for Chronic Care Management? If so, how?" **(Critical — exposes CCM market saturation)**

### Pain Discovery (Next 10 Minutes)

5. "What's the most time-consuming administrative task in your practice right now?"
6. "How do you currently track screening compliance for your patient panel? USPSTF, HEDIS?"
7. "When you get a prior auth denial, what happens? How long does it take to respond?"
8. "Have you heard of the APCM program? Are you enrolled?"
9. "What's your MIPS score? Do you know?"

### Value Testing (Last 5 Minutes)

10. "If I could show you every patient in your panel who qualifies for a CMS program you're not billing — and automate the paperwork — what would that be worth to you?"
11. "If I could cut your screening compliance work from 2 weeks to 2 hours per program, would you pay for that?"
12. "Which matters more to you right now: finding new revenue, or reducing the time you spend on paperwork?"

### The Kill Question

13. **"If this product existed today and cost $X/month, would you sign up? Not 'that sounds interesting' — would you actually pay?"**
   - Ask at three price points: $199/mo, $399/mo, $599/mo
   - Watch their face, not their words

---

## Closed-Lost Debrief Questions

For the 3 deals that said no. Offer $50 Amazon gift card for 15 minutes.

1. "What were you looking for when we first connected?"
2. "What made you decide not to move forward?"
3. "Did you end up using a different product? Which one?"
4. "What would have changed your mind?"
5. "If MedScrub could do one thing really well, what would make you reconsider?"

---

## Sequencing

| Priority | Who | When | Goal |
|---|---|---|---|
| 1 | Patrick Carter | This week | Validate or kill CCM/APCM/Revenue Engine thesis. Get real enrollment numbers. |
| 2 | 3 closed-lost leads | This week | Understand why they said no. Most valuable 45 minutes in the company. |
| 3 | Rob Trachtman | Next week | Activate Polus Mui connection. Validate PA evidence gathering scope. |
| 4 | Maurice Hill | Next week | Activate collaboration offer. Validate denial response use case scope. |
| 5 | 5 design partner candidates | Within 2 weeks | Test revenue pitch vs. compliance pitch. Get Medicare % data. |
