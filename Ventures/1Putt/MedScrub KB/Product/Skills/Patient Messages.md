## **Problem Statement**

Physicians spend 30-60 minutes daily responding to patient portal messages (MyChart, athena portal). Each message requires pulling up the patient's chart, reviewing context, and composing a clinically accurate yet patient-friendly response. This "pajama time" is a leading driver of burnout — the average PCP receives 50+ inbox messages per day.

Existing AI solutions (Epic's ART, Providence's Provaria) draft replies based on the message thread alone. MedScrub's competitive advantage is drafting messages with **full patient context from FHIR** — the AI knows the patient's medications, conditions, lab results, and visit history, not just what's in the message thread. And it runs through the PHI proxy, so patient data is de-identified before reaching the LLM.

## **Market Analysis**

### **Market Size**

Patient portal messaging volume has grown 157% since 2020 (Epic data). The average PCP receives 50+ inbox messages per day. With 350,000+ primary care physicians in the US, each spending 30-60 minutes daily on inbox management, this represents 175,000-350,000 physician-hours lost per day to messaging alone.

The clinical AI messaging market is nascent but growing fast. Epic's ART (Auto-Reply Technology) is already processing 1M+ AI-drafted replies per month across 150+ health organizations, demonstrating massive demand and adoption velocity.

### **Evidence Base**

| **Study / Product** | **Finding** | **Source** |
| --- | --- | --- |
| Epic ART | 150+ organizations, 1M+ AI-drafted replies per month | Epic 2025 |
| Providence Provaria | Screened 300K+ messages, reduced physician inbox volume by 57% | Providence Health 2025 |
| Providence Provaria | 50% faster response times to patient messages | Providence Health 2025 |
| UCSD Health (LLM messaging study) | AI-drafted replies decreased reply time by 5.9%, increased reply length 17.9% | UCSD / JAMA Network Open 2024 |
| UCSD Health | Patients read AI-drafted messages 21.8% longer, suggesting higher perceived quality | UCSD / JAMA Network Open 2024 |
| Sinsky et al. | Inbox management consumes 28 min/day of physician time beyond scheduled hours | Annals of Internal Medicine 2016 |
| AMA Physician Survey | 62.8% of physicians report burnout symptoms; EHR documentation/inbox is the #1 driver | AMA 2024 |
| KLAS Research | 89% of physicians say inbox burden negatively affects work-life balance | KLAS 2024 |
| California AB 3030 | Requires AI disclosure in patient-facing clinical communications (effective Jan 2025) | California Legislature |
| ONC HTI-2 Rule | Mandates transparency standards for AI in clinical decision-making (finalized 2025) | ONC/HHS |

### **Competitive Landscape**

| **Capability** | **Epic ART** | **Providence Provaria** | **Doximity GPT** | **ChatGPT (physician use)** | **MedScrub** |
| --- | --- | --- | --- | --- | --- |
| Input context | Message thread | Message thread + chart summary | None (physician types context) | None (physician types context) | Full FHIR record via CDR |
| PHI handling | Epic cloud | Epic cloud | Doximity cloud | OpenAI cloud (HIPAA risk) | Self-hosted proxy (de-identified) |
| Message types | Reply only | Reply + triage | Any (manual) | Any (manual) | Draft any message type (5 types) |
| EHR compatibility | Epic only | Epic only | None (clipboard) | None (clipboard) | Any EHR (clipboard V1, API V2) |
| Proactive messaging | No | No | No | No | Care gap nudges, pre-visit prep |
| Reading level control | No | No | No | Manual prompting | Yes (5th/8th/college grade) |
| Tone control | Learns physician style | No | Manual prompting | Manual prompting | Formal/conversational/empathetic |
| Regulatory compliance | Epic-managed | Epic-managed | None built-in | None built-in | AB 3030 disclosure built-in |
| Price | Included with Epic | Included with Epic | Free (limited) | $20/mo (personal) | Included with MedScrub |

### **MedScrub Differentiators**

1. **Full FHIR context**: AI knows the patient's medications, conditions, labs, and history — not just the message thread. A lab results message references the actual lab values and relevant medications.
2. **Proactive messaging**: Not just replies — physicians can initiate care gap nudges, pre-visit prep, and follow-up messages. No competitor does this.
3. **EHR-agnostic**: Works with any FHIR-enabled EHR via clipboard. Not locked to Epic or any single vendor.
4. **PHI safety**: Patient data is de-identified before reaching the LLM. No other messaging AI product offers self-hosted PHI protection.
5. **Regulatory built-in**: AB 3030 disclosure is automatic and configurable, not an afterthought.
6. **Reading level and tone control**: Adjustable per message, not per organization. Matches physician style and patient literacy.

## **User Stories**

1. **As a physician**, I want to draft a patient message about their lab results using AI that knows their full medical history, so I can send accurate, personalized responses in seconds instead of minutes.
2. **As a physician**, I want to generate post-visit follow-up messages that reference what we discussed, so patients get timely reinforcement of their care plan.
3. **As a physician**, I want to send care gap nudges (overdue screenings, vaccinations) that are personalized to the patient's conditions, so preventive care compliance improves.
4. **As a physician**, I want to control the tone and reading level of AI-drafted messages, so communication matches my style and the patient's health literacy.
5. **As a physician**, I want an AI disclosure automatically appended to drafted messages, so I comply with California AB 3030 and similar regulations.

## **Message Types**

### **1. Lab Results**

**Use case:** Patient's labs came back. Physician needs to explain results in plain language.

**AI context used:** Observation (labs), Condition (relevant diagnoses), MedicationRequest (meds that affect labs)

**Physician input:** Which labs to explain, interpretation notes, any action items

### **2. Post-Visit Follow-up**

**Use case:** After an appointment, physician sends care plan reinforcement.

**AI context used:** Encounter (recent visit), Condition (diagnoses discussed), MedicationRequest (new/changed meds), Procedure (ordered)

**Physician input:** Visit date, key discussion points, follow-up instructions

### **3. Pre-Visit Prep**

**Use case:** Before an upcoming appointment, physician sends preparation instructions.

**AI context used:** Condition (relevant conditions), MedicationRequest (bring medication list), Procedure (any prep needed)

**Physician input:** Appointment date/type, what to bring, fasting requirements

### **4. Care Gap Nudge**

**Use case:** Patient is overdue for screening, vaccination, or follow-up.

**AI context used:** Condition (risk factors), Observation (last screening dates), Immunization (vaccination history)

**Physician input:** Which gaps to address, urgency level

### **5. General Message**

**Use case:** Any other patient communication.

**AI context used:** Full patient summary

**Physician input:** Free-text description of what to communicate

## **UX Flow**

### **1. Patient Selection**

Standard workflow header — patient auto-loads from SMART on FHIR session, or physician selects from CDR via PatientSelectionModal.

### **2. Message Type Selection**

Grid of 5 message type cards (similar to focus area selection in Pre-Visit Planning):

- Each card shows: icon, title, description, estimated time saved
- Selecting a card reveals the type-specific form fields below

### **3. Context Form**

Dynamic form fields based on message type:

- **Lab Results:** Multi-select of recent labs (auto-populated from FHIR Observations/DiagnosticReports), interpretation notes textarea
- **Post-Visit:** Visit date picker, diagnoses discussed (auto-populated), instructions textarea
- **Pre-Visit Prep:** Appointment date, appointment type dropdown, what-to-bring checklist
- **Care Gap:** Checkboxes for overdue items (auto-populated from patient data), urgency level
- **General:** Free-text textarea

### **4. Tone & Style Controls**

- **Tone:** Formal / Conversational / Empathetic (dropdown)
- **Reading level:** 5th grade / 8th grade / College (slider or dropdown)
- **AI Disclosure:** Toggle (on by default) — appends: "This message was drafted with AI assistance and reviewed by your physician before sending."

### **5. Generate & Review**

- "Generate Message" button
- AI generates draft using patient FHIR context + physician input through PHI proxy pipeline
- Output displayed in message-preview format (styled like a portal message, not raw markdown)
- Physician reviews, edits in-place
- **Copy to Clipboard** button (primary action — physician pastes into EHR messaging)
- **Export as Text** button (secondary)
- No "Upload to EHR" button in V1

## **Acceptance Criteria**

### **AC-1: Patient Selection**

- [ ]  Patient auto-loads from SMART on FHIR session when available
- [ ]  Patient can be selected from Medplum CDR via PatientSelectionModal
- [ ]  Patient name and key demographics display in the workflow header
- [ ]  Changing patient resets the form and any generated output

### **AC-2: Message Type Selection**

- [ ]  5 message type cards render in a responsive grid
- [ ]  Each card shows icon, title, one-line description
- [ ]  Selecting a card highlights it and reveals the type-specific form below
- [ ]  Only one message type can be active at a time
- [ ]  Switching message type resets the form fields and any generated output

### **AC-3: Context Form — Lab Results**

- [ ]  Recent labs auto-populate from FHIR Observations and DiagnosticReports (last 90 days)
- [ ]  Labs display as multi-select checkboxes with name, value, date, and reference range
- [ ]  Interpretation notes textarea accepts free-text physician input
- [ ]  At least one lab must be selected before Generate is enabled

### **AC-4: Context Form — Post-Visit Follow-up**

- [ ]  Visit date picker defaults to today
- [ ]  Diagnoses discussed auto-populate from recent Encounter/Condition data
- [ ]  Follow-up instructions textarea accepts free text
- [ ]  Visit date is required before Generate is enabled

### **AC-5: Context Form — Pre-Visit Prep**

- [ ]  Appointment date picker (required)
- [ ]  Appointment type dropdown (Follow-up, Annual Wellness, Acute, New Patient, Procedure, Other)
- [ ]  "What to bring" checklist with common items (insurance card, medication list, imaging CDs, referral)
- [ ]  Fasting requirements toggle

### **AC-6: Context Form — Care Gap Nudge**

- [ ]  Overdue items auto-populate from patient data (screening dates from Observations, immunization history)
- [ ]  Each gap shows: item name, last completed date (or "No record"), recommended frequency
- [ ]  Urgency level selector (routine / important / urgent)
- [ ]  At least one care gap must be selected before Generate is enabled

### **AC-7: Context Form — General Message**

- [ ]  Free-text textarea with placeholder guidance
- [ ]  Minimum 10 characters required before Generate is enabled

### **AC-8: Tone & Style Controls**

- [ ]  Tone dropdown: Formal, Conversational, Empathetic (default: Conversational)
- [ ]  Reading level dropdown: 5th Grade, 8th Grade, College (default: 8th Grade)
- [ ]  AI Disclosure toggle is ON by default
- [ ]  Tone and reading level persist across sessions via localStorage

### **AC-9: Message Generation**

- [ ]  "Generate Message" button sends patient FHIR data through the 5-stage PHI proxy pipeline
- [ ]  Correct prompt template is selected based on message type
- [ ]  Loading state shows during generation
- [ ]  Generated message displays in a portal-message-style preview (not raw markdown)
- [ ]  Message is editable in-place after generation

### **AC-10: AI Disclosure (AB 3030)**

- [ ]  When disclosure toggle is ON, the following text is appended after re-identification: "This message was drafted with AI assistance and reviewed by your physician before sending."
- [ ]  Disclosure text is appended programmatically (not in the LLM prompt) to ensure 100% compliance
- [ ]  Disclosure text is configurable in settings
- [ ]  Disclosure is included in clipboard copy and text export

### **AC-11: Output Actions**

- [ ]  "Copy to Clipboard" copies the full message including disclosure (if enabled)
- [ ]  "Export as Text" downloads the message as a `.txt` file
- [ ]  Success feedback (toast/checkmark) confirms clipboard copy
- [ ]  No "Upload to EHR" button in V1

### **AC-12: Navigation**

- [ ]  Patient Messages appears in the Tasks grid with status `'active'` (previously `'build-next'`)
- [ ]  Route `/tasks/patient-messages` loads the PatientMessages page
- [ ]  Page is lazy-loaded

## **Regulatory: California AB 3030**

Effective January 1, 2025, California AB 3030 requires disclosure when generative AI is used in clinical communications with patients. Other states are expected to follow. The ONC HTI-2 Rule (finalized 2025) establishes federal transparency standards for AI used in clinical decision-making.

**Implementation:**

- AI disclosure toggle is ON by default
- Disclosure text appended after re-identification (not in the prompt — ensures it is always present regardless of LLM behavior)
- Default text: "This message was drafted with AI assistance and reviewed by your physician before sending."
- Text is configurable in settings (for physicians in states without disclosure requirements)
- Audit trail: every generated message logs whether disclosure was included

**Regulatory landscape by state (as of March 2026):**

- California (AB 3030) — AI disclosure required in patient communications
- Colorado (SB 24-205) — AI transparency in high-risk decisions
- Utah (AI Policy Act) — disclosure requirements for automated decisions in healthcare
- Additional states expected to introduce similar legislation in 2026

## **Technical Approach**

### **Pipeline**

Each message type is a skill (JSON definition file) executed through the generic `executeSkill()` pipeline:

1. Fetch patient FHIR bundle from CDR (`fetchStrategy: "everything"`)
2. De-identify via PHI proxy (reversible tokenization)
3. Select skill by message type, interpolate prompt template with physician inputs
4. Send to LLM (respects user's model selection)
5. Re-identify output
6. Append AB 3030 disclosure (via `postProcess: "appendDisclosure"` in skill JSON)

### **Skill Definitions**

4 messaging skills defined as `.skill.json` files in `desktop/src/skills/`:

- `message-lab-results.skill.json` -- Lab results explanation for patients
- `message-post-visit.skill.json` -- Post-visit follow-up and care plan reinforcement
- `message-pre-visit-prep.skill.json` -- Appointment preparation instructions
- `message-care-gap.skill.json` -- Overdue screening/vaccination reminders

The `general` message type uses the existing `patient-education` skill.

Each skill's system prompt enforces:

- Patient-friendly language at the specified reading level
- Concise portal message format (not a letter or education document)
- Clear action items for the patient
- No medical jargon without explanation

AB 3030 disclosure is appended programmatically via the `postProcess: "appendDisclosure"` field in each messaging skill, not by the LLM -- ensuring 100% compliance.

### **Why Clipboard-Only (V1)**

Epic's MyChart messaging uses proprietary APIs (SendMessage via Epic Interconnect), not FHIR Communication. The FHIR Communication resource is for inter-organizational referral messages, not patient portal messaging. athenahealth similarly uses proprietary endpoints.

Building EHR write-back for messaging requires:

- Epic Interconnect certification and API access
- Per-EHR integration work
- Additional compliance review

V1 generates the draft; the physician pastes into their EHR. This is the same workflow physicians already use with ChatGPT — but with full patient context and PHI safety.

**V2:** Add write-back for Epic via SendMessage API and athena via their messaging endpoints.

### **Key Files**

| **File** | **Purpose** |
| --- | --- |
| `src/skills/message-lab-results.skill.json` | Lab results message skill definition |
| `src/skills/message-post-visit.skill.json` | Post-visit follow-up skill definition |
| `src/skills/message-pre-visit-prep.skill.json` | Pre-visit prep message skill definition |
| `src/skills/message-care-gap.skill.json` | Care gap nudge skill definition |
| `src/skills/patient-message.ext.ts` | Extension: AB 3030 disclosure handling |
| `src/renderer/lib/skill-executor.ts` | Generic pipeline executor (`executeSkill()`) |
| `src/renderer/lib/workflow-manager.ts` | `executePatientMessageWorkflow` (thin wrapper) |
| `src/shared/messaging-types.ts` | Shared types |
| `src/renderer/pages/PatientMessages.tsx` | Main page |

## **Dependencies**

| **Dependency** | **Status** | **Impact** |
| --- | --- | --- |
| Skill SDK (skill-executor + skill-registry) | Shipped | Generic pipeline executes message skills via `executeSkill()`
| PHI proxy de-identification/re-identification | Shipped | Required for every message generation |
| Medplum CDR patient search | Shipped | Patient selection and FHIR data retrieval |
| PatientSelectionModal component | Shipped | Patient selection UX |
| `patient-education` skill | Shipped | Reused by the General message type
| Existing Observation/DiagnosticReport fetching | Shipped | Lab Results message type auto-populates from FHIR |
| `estimateWorkflowCost` utility | Shipped | Cost estimation before generation |

## **Success Metrics**

| **Metric** | **Target** | **Measurement Method** |
| --- | --- | --- |
| Time to draft a message | < 30 seconds (vs. 3-5 min manual) | In-app timing telemetry |
| Message quality (physician edit rate) | < 20% of messages need substantial edits | User survey at 30 days |
| Daily usage | > 40% of active physicians use it within first month | Analytics event tracking |
| Message types used | Lab Results and Post-Visit most popular (>70% of usage) | Analytics event tracking |
| AB 3030 compliance | 100% of generated messages include disclosure when enabled | Automated audit log check |
| Copy-to-clipboard action rate | > 90% of generated messages are copied | Analytics event tracking |
| Reading level accuracy | Messages score within 1 grade level of target (Flesch-Kincaid) | Quarterly manual audit of 100 messages |

## **Out of Scope (V1)**

- EHR write-back (sending messages directly to MyChart/athena portal)
- Message thread context (reading incoming patient messages from EHR)
- Message triage / urgency classification of incoming messages
- Bulk messaging (e.g., send care gap nudges to all patients at once)
- Multi-language support (English only in V1)
- Voice dictation input for message context
- Message templates library (physician-saved templates)
- Patient response tracking / read receipts

## **Risks and Mitigations**

| **Risk** | **Likelihood** | **Impact** | **Mitigation** |
| --- | --- | --- | --- |
| AI tone doesn't match physician's style | Medium | Medium | Tone controls + in-place editing before copying |
| Patient data is stale in CDR | Medium | High | Show "last synced" date, warn if data is > 7 days old |
| Regulatory landscape evolving | High | Medium | Configurable disclosure text, disclosure on by default, audit log |
| Physician forgets to review before sending | Low | High | UI prominently states "Review before sending" — human-in-the-middle is core to MedScrub |
| Clipboard workflow feels clunky | High | Medium | V2 adds EHR write-back; V1 is pragmatic given API constraints |
| Message contains inaccurate clinical information | Low | Critical | Full FHIR context reduces hallucination; physician review is mandatory; "Review before sending" warning |
| Reading level output doesn't match target | Medium | Low | Flesch-Kincaid validation in quarterly audits; prompt engineering refinement |

## **V2 Roadmap**

1. **EHR write-back** — Epic SendMessage API, athena messaging endpoints
2. **Message thread context** — Read incoming patient messages from EHR to draft contextual replies
3. **Message triage** — AI classifies incoming message urgency, routes to appropriate team member
4. **Bulk messaging** — Send personalized care gap nudges to cohorts of patients
5. **Multi-language support** — Spanish, Mandarin, Vietnamese (top non-English patient languages in US healthcare)
6. **Message templates library** — Physician-saved templates for common scenarios
7. **Smart Phrase integration** — Format output as Epic Smart Phrases for faster EHR insertion

## **Competitive Positioning**

| **Capability** | **Epic ART** | **Providence Provaria** | **MedScrub** |
| --- | --- | --- | --- |
| Input context | Message thread | Message thread + chart | Full FHIR record via CDR |
| PHI handling | Epic cloud | Epic cloud | Self-hosted proxy (de-identified) |
| Message types | Reply only | Reply + triage | Draft any message type |
| EHR lock-in | Epic only | Epic only | Any EHR (clipboard V1, API V2) |
| Proactive messaging | No | No | Care gap nudges, pre-visit prep |
| Reading level control | No | No | Yes (5th/8th/college) |
| Tone control | Learns physician style | No | Formal/conversational/empathetic |