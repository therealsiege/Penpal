<aside> Low-threat competitor — HIPAA-compliant "safe ChatGPT" wrapper for healthcare. Cloud-hosted SaaS, no PHI de-identification, no FHIR, no CDR. Targets overlapping ICP (individual clinicians wanting HIPAA-safe AI).

</aside>

## Company Overview

BastionGPT is a Dallas-based company (FortaTech Security LLC dba BastionGPT) offering a HIPAA-compliant AI assistant for healthcare documentation. Positioned as "safe ChatGPT for healthcare" — a cloud-hosted wrapper around multiple LLMs (GPT-4, Claude, Gemini) with HIPAA BAA and SOC 2 compliance. Bootstrapped, targeting individual clinicians and small-medium practices.

### Key Facts

- Founded: 2023 | HQ: Dallas, TX
- Legal entity: FortaTech Security LLC dba BastionGPT
- Founder: Josh Spencer (CEO, cybersecurity background via FortaTech Security)
- Funding: Bootstrapped / no disclosed rounds
- Claimed reach: 9,000+ healthcare organizations, 250M+ documents processed

## Product & Features

- Multi-model AI assistant (GPT-4, Claude, Gemini) with HIPAA BAA
- Cloud-hosted SaaS — not self-hosted, no on-prem option
- Clinical note templates and document generation
- Role-based access control, audit logging
- SOC 2 compliance
- Claims 15+ EHR integrations (Epic, Cerner, athenahealth, NextGen, eClinicalWorks, Allscripts, Greenway, Kareo, DrChrono, Practice Fusion, SimplePractice, TherapyNotes, AdvancedMD, CareCloud, ModMed)

## EHR Integrations

- Claims integration with 15+ EHRs — breadth claim, but unclear depth
- Epic, Cerner, athenahealth, NextGen, eClinicalWorks (major EHRs)
- Allscripts, Greenway, Kareo, DrChrono, Practice Fusion (mid-tier)
- SimplePractice, TherapyNotes, AdvancedMD, CareCloud, ModMed (specialty/small practice)

## Pricing

- Starter: $20/user/month
- Professional: $45/user/month
- Enterprise: $65/user/month
- Significantly cheaper than scribes (Heidi $70-99, Nabla $119, Abridge $208) — but different product category

## Target Market

- Individual clinicians, therapists, mental health providers
- Small-medium practices
- Anyone wanting "HIPAA-safe ChatGPT" without ambient scribe

## Strengths & Weaknesses

**Strengths:** Low price point ($20-65/mo), multi-model AI choice, broad EHR integration claims, HIPAA BAA + SOC 2, easy to understand value prop ("safe ChatGPT"), cybersecurity pedigree from FortaTech.

**Weaknesses:** No PHI de-identification (data goes to cloud), no FHIR connectivity or CDR, no ambient scribe, no prior auth, "9,000+ orgs" claim unverified, bootstrapped with no disclosed funding, no clinical validation studies, cloud-only (no self-hosted option for PHI-sensitive orgs).

## MedScrub Differentiation

BastionGPT is a "safe ChatGPT wrapper" — fundamentally different architecture from MedScrub. They add HIPAA compliance around existing LLMs; MedScrub de-identifies PHI before it reaches any LLM. Key differences:

- **PHI handling:** BastionGPT trusts cloud infra + BAA. MedScrub strips PHI at the proxy layer — data never leaves the practice.
- **EHR data:** BastionGPT claims integrations but no FHIR R4 data sync. MedScrub reads the chart.
- **Clinical workflows:** BastionGPT = general AI assistant. MedScrub = purpose-built physician workspace (SOAP notes, prior auth, clinical chat).
- **Deployment:** BastionGPT = cloud-only SaaS. MedScrub = self-hosted proxy.

Lower threat than Heidi/Nabla — different product category. Worth monitoring for price pressure on the low end and their EHR integration claims.