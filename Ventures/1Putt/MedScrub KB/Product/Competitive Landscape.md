# (Feb 2026)

Created: February 25, 2026 12:51 AM
Tags: Strategy

## Adjacent Companies (Not Direct Competitors)

### Artera — Enterprise Patient Communications

- $111M raised, $100M+ CARR, 1,000+ health system customers
- AI voice + text agents for scheduling, reminders, intake, billing messages
- Not clinical — zero patient chart access. Different buyer (health systems vs solo docs).
- Insight: Validates "Patient Messages" tool — but Artera can't do clinically-informed messages because they don't read the chart.

### Bunkerhill Health — Enterprise Clinical Reasoning

- $30M raised (Sequoia, Optum Ventures, YC), ~35 employees
- "Carebricks" platform: ingest full patient record → clinical reasoning → automated actions
- FDA-cleared imaging algorithms (coronary calcium, aortic valve, etc.)
- Same philosophy as MedScrub but for health systems ($100K+ contracts). Validates our direction.
- Their "Carebricks Chat" = our Clinical Chat. Proves the concept at enterprise scale.

### Corti — Healthcare AI Infrastructure

- $87M raised, $260M valuation (Atomico, Prosus)
- Healthcare-specific foundation models: speech-to-text, text generation, agentic framework
- B2B2B: sells APIs to EHR vendors, not to physicians
- Agent library mirrors our tools (prior auth, coding, referrals, CDI). Different delivery layer.
- Potential supplier — if we ever need medical ASR, their API is worth evaluating.

### Secai — Voice AI for Canadian Clinics

- $6.2M Series A (Feb 2026), Montreal-based
- Voxira (AI phone receptionist) + NoteGen (clinical documentation)
- First government-certified voice AI (Quebec). Same ICP but adjacent problems.
- Too small and Canada-focused to worry about now.

### Claim Health — Post-Acute Care RCM

- $4.4M seed (YC, Maverick Ventures, Jan 2026)
- AI revenue platform for home health agencies: intake → auth → billing → denial management
- Different vertical entirely. "Revenue Check" and "Authorization Autopilot" concepts worth borrowing.

---

## Direct Competitors (Physician-Facing AI Tools)

- Abridge — $5.3B val, $208/mo, enterprise-only (Kaiser, Mayo). Ambient AI scribe.
- Heidi Health — $465M val, $70-99/mo, freemium, expanding US from Australia. Closest threat to our ICP.
- Nabla — $120M raised, $119/mo, NEJM-validated, agentic AI direction, API-first.
- Freed — $84/mo, popular with solo docs, pure AI scribe (no EHR data access).
- Suki — $299/mo, voice-first ambient AI, backed by Venrock.
- Nuance DAX — Microsoft, ~$830/mo, enterprise-only, dominant in large health systems.
- Doximity — Free AI scribe, 80% of US docs on platform, but AI is a feature not the core business.
- BastionGPT — Bootstrapped, $20-65/mo, HIPAA-compliant "safe ChatGPT" wrapper, cloud-hosted, no PHI proxy or FHIR.

---

## MedScrub's Unique Position

The ONLY tool that combines all four: (1) EHR data access via FHIR, (2) any consumer LLM, (3) PHI de-identification proxy, (4) affordable pricing for solo docs ($129/mo).

Every competitor is missing at least one piece. Scribes don't read the chart. Enterprise tools aren't affordable. Affordable tools don't have EHR integration. Nobody else has the PHI proxy.

**EHR breadth differentiator (March 2026):** MedScrub now has implemented FHIR R4 sync with three major EHRs — Epic, athenahealth, and Oracle Health (Cerner). Combined, these three EHRs cover approximately 60% of the US hospital market. No other physician-facing AI tool at our price point has this level of EHR connectivity.