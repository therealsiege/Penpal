
> Navina (navina.ai) — Enterprise clinical AI copilot for value-based care
> Date: 2026-03-13 | Source: Website scrape + KLAS research
> Relevance: Validates the capability MedScrub is building, but serves a completely different customer

---

## What Navina Does

Navina is an AI-powered clinical copilot that transforms fragmented healthcare data into actionable insights at the point of care. Their core product has four modules:

| Module | What It Does |
|--------|-------------|
| **Clinician Copilot** | Combines historical data + ambient transcription for chart review, visit summaries, diagnosis support, documentation |
| **Risk Adjustment** | Surfaces HCC (Hierarchical Condition Category) recommendations with clinical evidence for RAF score optimization |
| **Quality Management** | Identifies clinical evidence for care gap closure, improves HEDIS measure satisfaction rates |
| **Analytics** | Tracks value-based metrics, usage, and performance across organizations |

---

## Market Position

- **#1 in 2025 Best in KLAS** for clinician digital workflow
- 20,000+ clinicians and care team members
- 86% weekly active provider rate
- 3.5M+ lives impacted
- 600+ AI algorithms for primary care
- EHR integrations: Epic, athenahealth, Veradigm

### Customers

ACOs, MSOs, health plans, and large physician groups: Jefferson City Medical Group, Privia Health, OnPoint Medical Group, Upperline Health, Innovacare Health, 20+ others.

### Pricing

Not disclosed. Enterprise sales model. Based on customer profile (ACOs, MSOs, health plans), likely $PMPM or enterprise contract pricing — far above small practice budgets.

---

## How Their Quality Management Works

Navina's care gap closure follows a six-step workflow:

1. **Payer gap ingestion** — Health plan sends care gap files to Navina
2. **AI-powered scrub** — ML analyzes clinical data to find evidence
3. **Quality team review** — Staff validates AI findings
4. **Clinician review** — Providers see gaps in clinical workflow
5. **Actionable insights** — Point-of-care alerts during patient visits
6. **Real-time tracking** — Dashboard monitors satisfaction rates

Key metric: Closes 1 in 3 gaps based on clinical evidence discovery. 12% increase in measure satisfaction rates. 100% patient coverage with automated data scrub.

---

## Where Navina Overlaps with MedScrub

| Capability | Navina | MedScrub |
|-----------|--------|----------|
| AI processing of unstructured clinical data | Yes | Yes (PHI proxy + CDR) |
| Care gap identification | Yes (from payer gap files) | Yes (proactive panel scan) |
| Point-of-care alerts | Yes | Yes (Pre-Visit Summary) |
| EHR integration (athena, Epic) | Yes | Yes |
| Risk stratification | Yes (HCC/RAF) | Planned (screening compliance) |

---

## Where Navina is NOT What MedScrub Is Building

| Dimension | Navina | MedScrub |
|-----------|--------|----------|
| **Core business** | HCC coding + RAF score optimization | Screening compliance from unstructured data |
| **Trigger for care gaps** | Payer sends gap file (reactive) | Proactive panel scan of unstructured docs |
| **Customer** | ACOs, MSOs, health plans | Independent 1-5 provider practices |
| **Revenue model** | Enterprise contracts | SaaS for small practices |
| **Pricing** | Enterprise (undisclosed, likely high $PMPM) | "Walmart" pricing for small practices |
| **Data flow** | Payer → Navina → Provider | EHR unstructured docs → AI → risk-stratified list |
| **Value proposition** | Maximize RAF scores + close payer-identified gaps | Identify screening needs before payer flags them |

### The Critical Difference

Navina's quality management module starts with the payer telling them which patients have gaps. Then Navina scrubs clinical data to find evidence that the gap is already closed (or confirm it's open).

MedScrub's Panel Screener starts with the patient chart — including unstructured documents the payer doesn't know about — and proactively identifies who needs screening. The faxed colonoscopy report sitting in the chart. The scanned intake form with family history. The specialist PDF that proves a 34-year-old needs colorectal screening because of first-degree relative history.

**Navina answers: "The payer says this patient has a gap — is that true?"**
**MedScrub answers: "Which of your 500 patients need screening, and here's the proof from documents nobody else can read?"**

---

## Strategic Implications

### Navina Validates the Market

Navina raised serious money, has 20K clinicians, won #1 KLAS, and proved that AI-powered clinical data extraction for care gap identification is valuable. This is not a speculative market.

### Navina Does Not Serve Our Customer

Their entire go-to-market is enterprise: ACOs, MSOs, health plans. A 3-provider family medicine practice in Nashville is not their customer. The small practice market — Patrick Carter's "Walmart" positioning — is wide open for this capability.

### Navina Could Become a Partner or Acquirer

If MedScrub builds the screening intelligence layer for small practices and proves it works, Navina (or a company like Navina) could be an eventual acquirer or integration partner. They have the enterprise relationships; we'd have the small practice coverage.

### Navina is Not a Competitive Threat Today

Different customer, different pricing, different data flow, different value proposition. Monitor but don't worry about them.

---

## Related Documents

- [[Strategic Direction Decision]] — Why we're building the intelligence layer
- [[CCM Market Competitive Analysis]] — CCM market players (different competitive set)
- [[Competitive Intelligence Matrix]] — Full ambient scribe competitive landscape
