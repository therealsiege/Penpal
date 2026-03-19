# Discovery Call Guide

Structured framework for 30-minute discovery calls. The goal is not to sell — it's to qualify and understand. If the fit is real, the deal will happen. If it's not, find out fast.

---

## Pre-Call Preparation (5 minutes)

Before every call, answer these:

- [ ] What does the company do? (one sentence)
- [ ] What stage are they? (funding, headcount, revenue model)
- [ ] Who am I talking to? (title, background, LinkedIn scan)
- [ ] What's their likely pain? (EHR integration, compliance, architecture, hiring)
- [ ] How did they find us / how did we find them?
- [ ] Any recent news? (funding round, partnership, product launch)

Have their website and LinkedIn open during the call. Take notes in real time.

---

## Call Structure

### 1. Opening — 2 minutes

**Goal:** Set the tone, confirm logistics, establish agenda.

> "Thanks for making the time, [Name]. I've got us down for 30 minutes — does that still work on your end?"

> "Here's what I'd like to cover: I want to understand what you're building, where you're at technically, and whether there's a way we can help. If there's not a fit, I'll tell you directly and point you to someone who might be better. Sound good?"

Key points:
- Confirm how much time they have (adjust if they say 15 min)
- State the agenda so they know what to expect
- Give them permission to say no — it builds trust

---

### 2. Company Understanding — 5 minutes

**Goal:** Get the full picture of who they are, what they sell, and where they are in the journey.

**Questions (pick 3-4, don't interrogate):**

- "Give me the 60-second version — what does [Company] do?"
- "Who's your buyer? Who's the end user?"
- "How far along are you? Live customers or still building?"
- "How big is the team today, and what does the eng team look like?"
- "What's the business model — SaaS, per-patient, licensing?"
- "Where are you in fundraising? Just raised, or heads-down building?"

**Listen for:**
- Whether they have product-market fit or are still searching
- Size and seniority of engineering team
- Whether they've sold to health systems before (signals compliance maturity)
- Revenue model — recurring vs. project-based affects urgency

---

### 3. Technical Deep Dive — 10 minutes

**Goal:** Understand their architecture, integration landscape, and what's not working.

This is where 1Putt differentiates. Go deep. Most consultants stay surface-level.

**Architecture Questions:**

- "Walk me through your stack at a high level."
- "Where does patient data come from? What format — HL7v2, FHIR, flat files, something else?"
- "Are you hosted on AWS, GCP, Azure? HIPAA-compliant setup or still getting there?"
- "Are you running your own FHIR server, using Medplum/Smile, or rolling custom?"

**Integration Questions:**

- "Which EHRs do you need to connect to? Have you started any of those?"
- "Are you going through Epic's App Orchard / Cerner's Code? Where are you in that process?"
- "What's the hardest integration problem you've hit so far?"
- "Are your health system customers giving you sandbox access, or are you still negotiating?"

**Team & Process Questions:**

- "Who on your team has done this before — healthcare integrations specifically?"
- "Do you have a CTO or VP Eng with healthcare experience?"
- "How are you handling HIPAA compliance today? BAAs in place with your infrastructure providers?"

**Listen for:**
- Confusion about FHIR versions or scoping (signals early stage)
- Mentions of "we tried but..." (signals active pain)
- No one on the team with healthcare experience (fractional CTO opportunity)
- Using general-purpose tools for healthcare-specific problems
- Timeline pressure from a customer or investor

---

### 4. Pain Qualification — 5 minutes

**Goal:** Understand urgency, cost of inaction, and whether this is a real problem or a nice-to-have.

**Questions:**

- "What happens if you don't solve this in the next 90 days?"
- "Is there a specific deal or customer driving the timeline?"
- "Have you tried to solve this internally? What happened?"
- "Are you evaluating other firms or approaches right now?"
- "What's the budget conversation look like — is this funded, or do you need to build a case?"

**The BANT Check (do this mentally, don't ask robotically):**

| Factor | What you need to know |
|--------|----------------------|
| **Budget** | Do they have consulting budget, or is this bootstrapped? Series A+ usually means yes. |
| **Authority** | Is this person the decision maker, or do they need to "run it by" someone? |
| **Need** | Is the pain acute (deal blocked, audit coming) or aspirational (want to be better)? |
| **Timeline** | Days/weeks = urgent. "Sometime this quarter" = lukewarm. "Next year" = nurture. |

---

### 5. Solution Alignment — 5 minutes

**Goal:** Show how 1Putt has solved this exact problem before. Be specific, not generic.

**Framework — match their pain to our experience:**

| Their Pain | Our Proof Point |
|-----------|----------------|
| EHR integration delays | "We've shipped [X] FHIR integrations into Epic and Cerner. The typical blockers are [specific examples]." |
| No healthcare CTO | "I've served as fractional CTO for [X] companies at your stage. Here's what that looks like day to day." |
| Compliance gaps | "We've taken [X] companies through SOC 2 and HITRUST. The key is scoping it to your architecture — most of the controls are irrelevant." |
| Architecture decisions | "We just helped a similar company migrate from [X] to [Y]. The decision came down to [specific tradeoff]." |
| Post-funding chaos | "The 90 days after a raise are where most teams make expensive architectural mistakes. We help sequence the decisions." |

**Rules for this section:**
- Talk for no more than 2 minutes — this is not a pitch
- Use one specific example, not a list of capabilities
- Connect your example directly to their stated problem
- If you don't have a relevant example, say so honestly

---

### 6. Next Steps — 3 minutes

**Goal:** Define the exact next action. Never end with "let's stay in touch."

**If strong fit:**

> "Based on what you've described, I think we can help. Here's what I'd suggest as a next step: I'll put together a lightweight scope document — not a full proposal, just enough to show you what the engagement would look like, timeline, and rough investment range. I can have that to you by [day]. Does that work?"

**If moderate fit:**

> "I want to think about this before suggesting an approach. Can I send you a few follow-up questions by email, and then we can decide if it makes sense to go deeper?"

**If no fit:**

> "I want to be straight with you — I don't think we're the right firm for this. Here's why: [honest reason]. What I'd recommend instead is [alternative — specific firm, approach, or hire]."

**Always confirm:**
- Who else needs to be involved in the decision?
- What's their timeline for making a decision?
- Best way to communicate — email, Slack, text?

---

## Green Lights (Strong Qualification Signals)

- Active pain with a deadline (customer deal, audit, board commitment)
- Series A-C with $5M+ raised
- No healthcare technical leadership on the team
- Already tried and failed to solve internally
- Decision maker is on the call
- They ask about pricing (means they're serious)
- They mention specific EHRs and specific problems with those EHRs
- They've been referred by someone in our network

## Red Flags (Disqualify or Proceed with Caution)

- Pre-seed or bootstrapped with no consulting budget
- "We just need someone to write code" (they want a contractor, not a strategist)
- No clear revenue model or customer traction
- Decision maker is absent and timeline is vague
- They want a fixed-price bid for an undefined scope
- Already working with another firm and shopping for a cheaper option
- Can't articulate what problem they're solving for patients/providers
- "We need this done in two weeks" with a complex scope (unrealistic expectations)

---

## Post-Call Actions (Within 24 Hours)

- [ ] Send a thank-you email summarizing what you heard and confirming next steps
- [ ] Update the lead record with qualification notes
- [ ] If proposing: draft scope document within 48 hours
- [ ] If nurturing: add to follow-up sequence with relevant content
- [ ] If disqualified: send a genuine referral if you have one

---

## Talk-to-Listen Ratio

Target: **30% talking, 70% listening.** If you're talking more than the prospect, you're pitching, not discovering. The person asking questions controls the conversation.
