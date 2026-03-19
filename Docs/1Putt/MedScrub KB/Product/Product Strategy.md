# March 2026

Created: March 6, 2026 1:15 PM
Tags: Strategy

## The Pivot: From Protection to Intelligence

MedScrub started as a PHI de-identification proxy. Through advisor conversations and competitive analysis, the product direction has sharpened: the proxy + CDR are the foundation, and the value proposition is **AI-powered clinical intelligence from unstructured data** — specifically, population health screening compliance for independent practices.

See [[Strategic Direction Decision]] for the full reasoning behind this direction.

### The ‘Have to Have’ Insight

Patrick Carter (CareMessage, Director of Engineering; founded ChartSpan; ex-Agilon Health) framed it clearly: population health screening compliance is “have to have” because providers face real financial penalties for non-compliance. SOAP notes are “nice to have” — productivity gains, but no penalty for not having them. This insight reorders our entire feature priority.

The critical capability: **extracting structured intelligence from unstructured clinical documents.** Colonoscopy records from specialist offices exist only as faxed reports — not structured EHR data. Family history lives on scanned intake forms. The data needed for screening compliance is in the chart, but no one can read it at scale. MedScrub’s PHI proxy + CDR can.

Patrick saw this problem unsolved at Agilon (“we couldn’t conquer it”), sees it unsolved at CareMessage today (they struggle to identify which patients need screening from EHR data), and his own company ChartSpan doesn’t address it (ChartSpan automates CCM workflows downstream, not the upstream intelligence). See [[Patrick Carter — What He Actually Said]] for full synthesis.

### Evidence from Advisors

- **Patrick Carter (CareMessage, Mar 6):** Population health screening = “have to have.” Unstructured data extraction is the key technical capability. Risk-stratified patient lists save ~2 weeks of manual work per screening program. Financial penalties = tens of thousands per physician annually. SOAP notes are “nice to have.” This is what Agilon couldn’t solve. Colorectal cancer screening is the first card to build — complex eligibility logic requiring AI extraction from faxed reports and intake forms.
- **Maurice Hill (Optum, Feb 6):** “Provider squeeze” — providers need AI to replace admin burden. High-value use cases: authorization denial responses (saves 2+ days), HEDIS season medical record review. “Patterns I don’t notice” — AI surfacing missed diagnoses from longitudinal data.
- **Rob Trachtman (ex-Epic PA, Feb 23):** Target solo practitioners — entrepreneurial, early adopters. Prior auth evidence gathering is a “really clean AI use case.” Connected us to Polus Mui / Health Tech Nerds community.

### Competitive Validation

- **CCM Market (8+ players):** ChronicCareIQ, TimeDoc, ThoroughCare, Signallamp, ChartSpan — the CCM automation market is mature, not a white space. MedScrub should NOT compete here. See [[CCM Market Competitive Analysis]].
- **Navina (enterprise):** #1 KLAS, 20K clinicians, AI-powered care gap closure — but built for ACOs/MSOs/health plans at enterprise pricing. They work from payer gap files (reactive). MedScrub works from unstructured patient docs (proactive). Same capability, different customer, different direction. See [[Navina Competitive Analysis]].
- **Ambient scribes (athenaAmbient, Abridge, etc.):** Single-encounter tools. Cannot do panel-level population health analysis. athenaAmbient is free and bundled — scribing is commoditized. See [[Competitive Intelligence Matrix]].

### Updated Priority Framework

- **P0: Panel Screener (Population Health Screening)** — AI extraction from unstructured clinical documents, producing risk-stratified patient lists. First card: colorectal cancer screening. This is the “have to have” with financial penalties behind it. See [[v0.1 Product Spec — Panel Screener]].
- **P0 (supporting): Pre-Visit Summary + Daily Briefing** — Daily habit formation. Already shipped. Surfaces screening opportunities at point of care.
- **P1: SOAP Notes + Coding Optimization** — Table stakes. Every competitor does SOAP. Keep shipping but don’t lead with it.
- **P2: Additional Screening Programs** — Breast cancer, prostate, USPSTF medication recommendations. Same capability as P0, new screening algorithms.
- **P3: Prior Auth Evidence Gathering** — Rob Trachtman’s “clean AI use case.” Same core capability (match unstructured docs against policy requirements). Build after screening is proven.
- **Decided against: CCM/APCM Revenue Engine** — Mature market with 8+ established players. If practices want CCM automation, they should use ChronicCareIQ, TimeDoc, or ChartSpan. MedScrub’s screening intelligence can eventually feed into those systems. Let customer demand decide if we go downstream.

### First Build

**Colorectal Cancer Screening Card** — one screening program, one skill card, batch mode across the patient panel. Pending Patrick’s screening algorithm and answers on output format + end user. See [[v0.1 Product Spec — Panel Screener]].

### Target Market

**Primary:** Independent/solo physicians and small practices (1-5 providers) on athenahealth, Epic, or Cerner. Family Medicine and Internal Medicine. Medicare patient panels with screening compliance requirements.

**Secondary:** Population health organizations (like CareMessage) needing patient identification from unstructured data for outreach programs.

**Positioning:** The “Walmart” of clinical intelligence. Enterprise tools like Navina do AI-powered care gap identification for ACOs at enterprise prices. MedScrub does it for the 1-5 provider practice that can’t afford Navina and doesn’t have payer gap files.

**Pilot market:** Nashville, then Austin/Denver/Raleigh.

### Key Differentiator

MedScrub is the only platform that combines:
1. **PHI proxy** — safe AI processing of unstructured clinical documents at scale
2. **Clinical Data Repository** (Medplum) — longitudinal FHIR data store across EHR boundaries
3. **Panel-level intelligence** — proactive screening compliance from unstructured data, not reactive payer gap files

This combination enables population health screening that is structurally impossible for conversation-based scribes (single-encounter), unavailable from CCM platforms (they assume you know who the patients are), and priced out of reach by enterprise tools like Navina.

The upstream intelligence layer is also **complementary** to every CCM platform on the market — it feeds into their workflows rather than competing with them. This makes MedScrub a potential integration partner, not a competitor.