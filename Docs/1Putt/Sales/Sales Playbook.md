# 1Putt Health — Sales Playbook

Last updated: 2026-03-14

---

## Cold Outreach Templates

### Template 1: FHIR Integration Pain

**Subject:** Your Epic integration timeline

**Body:**

Hi [First Name],

I noticed [Company] is [building patient data workflows / connecting to EHR systems / working with clinical data — pick whichever matches their product]. Getting FHIR integrations production-ready is one of the most underestimated challenges in digital health — most teams estimate 4-6 weeks and end up at 4-6 months.

I'm Clint Johnson, founder of 1Putt Health. We specialize in FHIR and EHR integration for Series A-C digital health companies. We've built production Epic integrations, designed FHIR-native architectures, and we maintain our own healthcare data products (MedHook, MedScrub) — so we build this infrastructure daily, not just advise on it.

Would a 20-minute call make sense to compare notes on your integration approach? No pitch — happy to share what we've seen work (and fail) across similar companies.

Best,
Clint

**When to use:** LinkedIn profile or job posting shows they're hiring FHIR/integration engineers, or their product clearly requires EHR connectivity.

---

### Template 2: Compliance Urgency

**Subject:** HITRUST before your next enterprise deal

**Body:**

Hi [First Name],

Congrats on [the recent raise / the partnership with X / the growth — reference something specific]. As you move upmarket, the compliance conversation always accelerates — enterprise health system contracts increasingly require HITRUST or SOC 2, and the prep timeline is longer than most teams expect (3-6 months for HITRUST).

I run 1Putt Health — we help digital health startups get compliance-ready without slowing down product velocity. We've guided companies through HIPAA gap assessments, HITRUST prep, and SOC 2 readiness, building compliance into the engineering workflow rather than bolting it on afterward.

If compliance is on your radar for the next 6 months, I'd love to spend 20 minutes sharing what we've seen work. If it's not, feel free to ignore this entirely.

Clint Johnson
1Putt Health

**When to use:** Company recently raised Series A/B, is selling to health systems or payers, or job posting mentions "HIPAA" or "compliance."

---

### Template 3: Fractional CTO

**Subject:** Healthcare engineering leadership without the $350K hire

**Body:**

Hi [First Name],

Building a digital health product is hard enough — building one that passes health system security reviews, handles FHIR correctly, and scales under real clinical load requires healthcare-specific engineering leadership that's almost impossible to recruit.

I'm Clint Johnson. I run 1Putt Health and serve as fractional CTO for digital health startups. I've built HIPAA-compliant architectures, shipped Epic integrations, and designed clinical data pipelines — and I currently maintain two healthcare products (MedScrub for clinical AI, MedHook for data integration), so I'm writing this code every week.

If you're looking for senior healthcare engineering leadership without the 6-month recruitment cycle, I'd welcome a brief conversation.

Clint

**When to use:** Company has no CTO or their CTO is a generalist. Founder is non-technical. Recent CTO departure visible on LinkedIn.

---

### Outreach Rules
- Personalize the first sentence. Generic templates get deleted.
- One CTA only: a 20-minute call. Don't ask them to read a deck, visit a website, or watch a video.
- Send Tuesday-Thursday, 8-10am recipient's time zone.
- Follow up once (see cadence below). If no response after two touches, move to nurture.
- LinkedIn connection request with a short note (2-3 sentences) can supplement email but don't duplicate the full template.

---

## Discovery Call Guide

### Structure (30 minutes)

**Minutes 1-3: Set the frame**
"Thanks for making time. I'd like to understand what you're building and where you're hitting friction on the healthcare/technical side. I'll share relevant experience where it's useful. If there's a fit for us to work together, great — if not, I'm happy to point you in the right direction. Sound good?"

**Minutes 3-20: Discovery questions**

Ask these 10 questions. You don't need all 10 — adapt to the conversation. But hit at least 6.

1. **"Walk me through your product and who uses it."** (Understand the clinical workflow and end user. Listen for: which EHR systems their customers use, what clinical data they touch.)

2. **"What's your current integration architecture? How does patient data flow in and out?"** (Assess technical maturity. Listen for: Mirth, Rhapsody, Redox, direct FHIR, flat files, manual entry. Red flag: "We don't have integrations yet but we need them.")

3. **"What's driving the timeline on this? Is there a specific deal or deadline?"** (Qualify urgency. Listen for: signed contract with go-live date, board pressure, investor milestone. Red flag: "We're just exploring options.")

4. **"Who on your team has built healthcare integrations before?"** (Assess internal capability gap. Listen for: "Nobody, this is our first" or "We have one person who did some HL7 at their last company." Green flag: they know exactly what they don't know.)

5. **"What's your compliance posture today? HIPAA policies in place? HITRUST or SOC 2?"** (Identify compliance gap. Listen for: uncomfortable pause, "We have a BAA with AWS," "Our lawyer wrote some policies." Red flag: "We're not really worried about that yet.")

6. **"Have you been through an enterprise security review? How did it go?"** (Reveals real pain. Listen for: "It took 3 months and we almost lost the deal" or "We haven't done one yet but we have one coming.")

7. **"What does your engineering team look like? How many people, what's the stack?"** (Size the engagement. Listen for: team size, seniority, stack choices. Context for whether they need a fractional CTO vs project work.)

8. **"Have you evaluated any integration platforms — Redox, Health Gorilla, Smile CDR?"** (Understand where they are in the decision process. Listen for: which platforms, what concerns, budget constraints.)

9. **"What would success look like 6 months from now?"** (Align on outcomes, not deliverables. Listen for: specific metrics — "live integration with 3 health systems," "HITRUST certified," "CTO hired and onboarded.")

10. **"What budget have you set aside for this?"** (Ask directly. If they deflect, offer a range: "Engagements like this typically run $15K-50K depending on scope. Does that range work for your planning?")

**Minutes 20-25: Share relevant experience**
Connect their situation to specific work 1Putt has done. Be concrete — name the challenge, the approach, and the outcome. Don't present a slide deck.

**Minutes 25-30: Next steps**
If qualified: "Based on what you've described, here's what I'd recommend as a starting point: [specific service]. I'll send a 1-page scope outline by [day]. Can we schedule a follow-up for [specific date] to discuss?"

If not qualified: "It sounds like you're earlier in the process than where we typically engage. When you [specific trigger — sign that enterprise deal, hire your first engineer, complete your raise], reach back out and we'll pick this up."

### What to Listen For

**Strong buy signals:**
- They describe a specific deal at risk due to technical/compliance gaps
- They've already tried to solve this internally and failed
- CTO admits they're outside their depth on healthcare specifics
- They ask about timeline and pricing unprompted
- They reference a board meeting or investor update where this needs to be resolved

**Red flags:**
- "We're just gathering information right now" (no urgency)
- "Can you send us a proposal and we'll review internally?" (no champion)
- "What's your hourly rate?" as the first question (price shopping for staff aug)
- No technical decision-maker on the call
- "Our budget is $5K" for a project that clearly requires $25K+

---

## Objection Handling

### "We're thinking about hiring a full-time VP Engineering instead."

**Response:** "That's the right long-term move, and I'd encourage it. The question is timeline. A VP Eng search in healthcare takes 4-6 months — and that's from offer acceptance to the person being productive, not from when you start looking. I can be productive in week one while you run that search. Several of my clients started as fractional engagements and transitioned to full-time hires, and I helped them recruit and onboard that person. You're not choosing between me and a hire — you're choosing between starting now and starting in 6 months."

### "We found a development shop offshore that can do this for $40-50/hour."

**Response:** "For standard web development, offshore teams can be excellent. For healthcare integrations, the failure mode is different — it's not buggy code, it's architectural decisions that look fine until you hit an enterprise security review or a FHIR conformance test. I've been called in to remediate three offshore-built FHIR integrations in the past year. In each case, the rebuild cost more than building it right the first time. The question isn't hourly rate — it's whether the team has shipped production healthcare integrations that passed health system security reviews."

### "We're going to use Redox (or Health Gorilla, or Smile CDR) so we don't need consulting."

**Response:** "Redox is a great platform — we actually advise clients on whether Redox, Smile CDR, or direct FHIR is the right choice. But the platform doesn't eliminate the integration work. You still need to design your data model, map FHIR resources to your domain, handle edge cases in clinical data, pass the health system's security review, and maintain the integration over time. Redox handles the transport layer; you still own the application layer. That's where we help."

### "Your pricing is higher than we expected."

**Response:** "Understood. Let me put it in context. A fractional CTO at $12.5K/month costs $150K/year. A full-time VP Engineering in healthcare costs $280-350K in salary plus $50-100K in equity, benefits, and recruiting fees — call it $350-450K total cost in year one, with a 4-6 month ramp before they're productive. For project work at $175/hour, a typical FHIR integration runs $35-50K and takes 6-8 weeks. The same project done internally by a team learning FHIR for the first time takes 4-6 months and costs more in fully-loaded engineer time. I'm not the cheapest option — I'm the fastest path to production."

### "Can we start with a small paid pilot?"

**Response:** "Absolutely. The Technical Strategy Engagement is designed for exactly this. It's a 4-6 week, $15-25K fixed-fee project that produces a concrete deliverable — architecture review, vendor evaluation, and technical roadmap. It gives you a chance to evaluate our work and gives me enough context to scope any follow-on engagement accurately. If the roadmap doesn't deliver value, you've spent $20K and gotten a useful document. If it does, we move forward with clarity on both sides."

### "We need to think about it / discuss internally."

**Response:** "Of course. To help that conversation, I'll send a one-page summary of what we discussed and a recommended scope with pricing. What's the timeline for your decision? And who else needs to weigh in — I'm happy to jump on a call with them to answer technical questions directly."

(Then follow the cadence below. "Think about it" without a timeline is a soft no.)

---

## Proposal Template Structure

Every proposal follows this structure. Keep it under 5 pages. Nobody reads long proposals.

### Page 1: Executive Summary (Half Page)
- One paragraph: the client's situation and challenge
- One paragraph: 1Putt's recommended approach
- One line: timeline
- One line: investment (total cost, payment terms)

### Page 2: Understanding & Scope
- Restate the client's goals in their own words (proves you listened)
- Define scope explicitly — what IS included and what IS NOT included
- List assumptions (e.g., "Client provides codebase access by Day 3")

### Page 3: Approach & Timeline
- Phase breakdown with week-by-week milestones
- Deliverables listed under each phase
- Key meetings/checkpoints identified
- Dependencies and risks called out

### Page 4: Team & Credentials
- Clint's bio (2-3 sentences, focus on relevant healthcare experience)
- Tim's bio if he's on the project
- 1-2 relevant project references (anonymized if needed)
- Mention of MedScrub and MedHook as proof of active building

### Page 5: Investment & Terms
- Total fee (or monthly retainer amount)
- Payment schedule (e.g., 50/50, monthly, milestone-based)
- Contract term and termination clause (30-day notice for retainers)
- What's not included (travel, third-party software licenses, etc.)
- Expiration: proposal valid for 14 days

### Proposal Rules
- Send within 48 hours of discovery call. Speed signals professionalism.
- PDF format, not Google Doc or Word. It should look finished.
- Include exactly one option at the price you want, plus one premium option 30-40% higher. The premium option makes the standard option feel reasonable.
- Always include a "Next Steps" section at the bottom: "To proceed, reply to this email confirming the [Standard/Premium] option. We'll send a contract for signature within 24 hours."

---

## Pricing Psychology

### Anchor High
Always present the premium option first in conversation. "An engagement like this typically runs $20-30K. Based on your scope, I think we can do it for $18K." The anchor makes the actual price feel like a deal.

### Three Mental Models for the Buyer
Frame pricing against three alternatives the buyer is already considering:

1. **vs Full-time hire:** "A fractional CTO at $12.5K/month is 30% the cost of a full-time hire with zero recruiting risk."
2. **vs Revenue at risk:** "If this enterprise deal is worth $200K ARR and the integration delay costs you 3 months, that's $50K in deferred revenue. Our engagement costs less than the delay."
3. **vs Failure cost:** "Remediating a failed FHIR integration typically costs 2-3x what building it right costs. We've seen $60K cleanups on $25K projects."

### Annual Retainer Discount
Offer 10% discount for annual commitment on Fractional CTO engagements. This does two things: increases LTV and creates switching cost. A 12-month retainer at $12.5K/month with 10% discount = $135K (vs $150K month-to-month). The client saves $15K, 1Putt gets guaranteed revenue.

### Never Discount Without Getting Something
If the client pushes on price, trade — don't just reduce. Examples:
- "I can bring this to $15K if we reduce scope to exclude the vendor evaluation."
- "I can do $10K/month if we commit to 6 months instead of month-to-month."
- "I can lower the hourly rate to $150 if we prepay quarterly."

---

## Follow-Up Cadence

### After Discovery Call (Qualified Lead)

| Day | Action | Channel |
|-----|--------|---------|
| Day 0 | Send thank-you email with 2-3 bullet recap of what you heard | Email |
| Day 1-2 | Send proposal (PDF) | Email |
| Day 3 | "Wanted to make sure the proposal came through — any initial questions?" | Email |
| Day 7 | "Checking in on timing. Happy to jump on a quick call to walk through the proposal if helpful." | Email |
| Day 10 | Brief, value-add touch — share a relevant article, case study, or industry insight. No ask. | Email or LinkedIn |
| Day 14 | "The proposal I sent is valid through [date]. Want to schedule 15 minutes to discuss before then?" | Email |
| Day 21 | Phone call (if you have their number). Leave voicemail if no answer. | Phone |
| Day 30 | Final email: "I want to respect your time. If the timing isn't right, no worries — I'll check back in a quarter. If something's changed, I'm here." | Email |

### After Cold Outreach (No Response)

| Day | Action |
|-----|--------|
| Day 0 | Initial outreach email |
| Day 4 | Follow-up: "Bumping this up — worth a quick conversation?" (Reply to original thread) |
| Day 14 | New angle: different subject line, different value prop from the three templates |
| Day 30 | Move to nurture list. Add to quarterly check-in rotation. |

### Nurture (Long-Term)

- Add to LinkedIn — engage with their content periodically (like, comment with substance)
- Quarterly email with something genuinely useful (industry report, relevant article, or a specific observation about their company)
- Re-engage when trigger event occurs (new funding round, executive hire, partnership announcement, job posting for integration engineer)

### Rules
- Never follow up more than 5 times without a response. After 5 touches with no reply, they go to nurture-only.
- Every follow-up must add value or context. "Just checking in" with nothing else is a waste of everyone's time.
- Track all touches in the lead system. If you can't remember your last touchpoint with a prospect, you're not tracking well enough.
