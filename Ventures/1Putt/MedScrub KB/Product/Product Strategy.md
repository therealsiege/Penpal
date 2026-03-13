# March 2026

Created: March 6, 2026 1:15 PM
Tags: Strategy

## The Pivot: From Protection to Enablement

MedScrub started as a PHI de-identification proxy. Through conversations with three design partners, the product direction has crystallized: the proxy is the foundation, but the value proposition is the compliance and clinical workflows it enables. The shift is from “protect your data” to “remove your administrative burden.”

### The ‘Have to Have’ Insight

Patrick Carter (OpenLoop, Principal Architect, ex-Agilon) framed it clearly: population health screening compliance is “have to have” because providers face real financial penalties for non-compliance. SOAP notes are “nice to have” — productivity gains, but no penalty for not having them. This insight reorders our entire feature priority.

Specific examples: Colorectal cancer screening requires complex logic (age 55+, OR age 34+ with first-degree relative history). Colonoscopy records from specialist offices often exist only as faxed reports — not structured EHR data. Providers face tens of thousands of dollars in annual penalties per physician for missed screenings. The manual process of analyzing screening compliance takes ~2 weeks per program.

### Evidence from Design Partners

- **Maurice Hill (Optum, Feb 6):** “Provider squeeze” — providers need AI to replace admin burden, not just protect data. Shift from protection to enablement. High-value use cases: authorization denial responses (saves 2+ days), HEDIS season medical record review. “Patterns I don’t notice” — AI surfacing missed diagnoses from longitudinal data.
- **Rob Trachtman (ex-Epic PA, Feb 23):** Target solo practitioners — entrepreneurial, early adopters, need to do many things without more staff. Prior auth is intentionally complex; best AI use case is matching payer policies (unstructured PDFs) against clinical records. Human-in-the-middle is the realistic best outcome. Connected us to Polus Mui (Health Tech Nerds — community of technical doctors for testing).
- **Patrick Carter (OpenLoop, Mar 6):** Population health screening = “have to have.” Unstructured data extraction is the key technical capability. Risk-stratified patient lists save ~2 weeks of manual work per screening program. USPSTF recommendations should be tracked against patient records (e.g., 42-year-old with high cholesterol should be on baby aspirin — system should verify and flag). Tens of thousands of dollars at financial risk per physician annually.

### Updated Priority Framework

- **P0: Population Health Screening + Pre-Visit Planning + Daily Briefing** — Compliance-driven, CDR-enabled, daily habit formation. Financial penalties make this “have to have.”
- **P1: SOAP Notes + Coding Optimization** — Table stakes (every competitor does SOAP) + $205K/year found revenue per physician from coding optimization.
- **P2: Prior Auth + Care Gap Detection + CCM** — High value, regulatory tailwind (CMS-0057-F), >$100K/year staff time savings, $148K/year CCM revenue.
- **P3: Pattern Detection + Portal Messages + Referral Letters** — CDR depth leverage. Fast follows once P0-P2 establish the data foundation.

### Target Market

**Primary:** Independent/solo physicians and small practices (1-5 providers) with population health contracts and screening compliance requirements. Heavy documentation burden specialties: Family Medicine, Internal Medicine, Psychiatry. DPC/concierge practices.

**Secondary:** Population health organizations needing data extraction and compliance tracking.

**Pilot market:** Nashville, then Austin/Denver/Raleigh.

### Key Differentiator

MedScrub is the only platform that combines self-hosted PHI protection with a persistent Clinical Data Repository (Medplum). This enables population health, pre-visit planning, and care gap workflows that are structurally impossible for conversation-based scribes. The CDR is the moat — it makes every feature better over time as patient history accumulates.