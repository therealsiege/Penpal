🎯 MedScrub Lead Generation System — How we find, qualify, and convert healthcare companies that need FHIR/interoperability help.

---

# Overview

MedScrub's lead generation system identifies healthcare companies that need FHIR integration, SMART on FHIR apps, clinical documentation tools, or interoperability consulting. We monitor multiple sources, qualify leads against our ICP, and push them into the CRM for structured outreach.

The system runs on a weekly cycle: scan sources → research companies → qualify → add to CRM → outreach. A weekly cron job (Mondays 9 AM CT) automates the scanning phase.

---

# Lead Sources

## Google Alerts

12 alert terms configured, weekly digest to [fuzeelogik@gmail.com](mailto:fuzeelogik@gmail.com) in 'Google Alerts' folder:

- FHIR integration startup
- SMART on FHIR app development
- healthcare interoperability company
- clinical documentation AI
- EHR integration startup
- Medplum developer
- fractional CTO healthcare
- healthcare API startup funding
- FHIR engineer hiring
- CMS interoperability rule compliance
- healthcare data exchange platform
- digital health FHIR

## LinkedIn Jobs

- Search: FHIR, SMART on FHIR, healthcare interoperability, HL7
- Filter: startups and mid-size companies
- Signal: Companies hiring FHIR engineers likely need interim/consulting help

## Wellfound / AngelList

- Healthcare startups hiring FHIR roles
- Filter by funding stage (Seed to Series B ideal)
- Look for integration/interoperability mentions in job descriptions

## Upwork

- FHIR integration projects
- Healthcare API development
- HL7/FHIR consulting gigs
- Signal: Companies posting projects need help NOW

## HN Who's Hiring

- Monthly thread on Hacker News
- Search for: FHIR, healthcare, EHR, clinical, interoperability
- Early-stage startups often post here

## Reddit

- r/healthIT — industry discussions, vendor complaints, integration questions
- r/FamilyMedicine — physician pain points with EHR/documentation

## Other Sources

- Health Tech Nerds job board — curated health tech roles
- BTG Talent — healthcare tech projects
- FHIR Community Chat ([chat.fhir.org](http://chat.fhir.org)) — developer discussions, project mentions

---

# Ideal Customer Profile (ICP)

<aside> 🎯 Healthcare startups and mid-size companies building FHIR-based apps, clinical documentation tools, or needing CMS compliance help.

</aside>

## Target Companies

- Building healthcare software that needs FHIR/HL7/interoperability
- Seed to Series C funding stage
- 10-500 employees
- US-based or US-market focused
- NOT large EHR vendors (Epic, Cerner, Oracle Health)
- NOT large consulting firms (Deloitte, Accenture)

## Target Roles

- CTO / VP Engineering — technical decision maker
- CEO / Founder — at early-stage companies
- VP Product — when building FHIR-dependent features

---

# Qualification Criteria

## Must Have (at least one)

- Building healthcare software that requires FHIR/HL7 integration
- Hiring FHIR engineers (signal: they need help and can't find it)
- Posting FHIR/interop projects on freelance platforms
- Mentioned in our alert sources in our domain

## Disqualifiers

- Large EHR vendors with in-house armies
- Companies outside healthcare
- No budget signals (unfunded, no revenue indicators)

---

# Lead Scoring

## 🔥 Hot

- Hiring fractional/consulting FHIR roles
- Early-stage startup needing FHIR expertise to ship product
- Posting FHIR projects on Upwork/freelance platforms
- Recently funded and building integrations

## 🟡 Warm

- Hiring full-time FHIR roles (may need interim help while searching)
- Well-funded and scaling their integration team
- In our domain but no immediate hiring signal

## 🔵 Cold

- Large companies with tangential fit
- No clear hiring or project signal
- Competitor/partner (potential referral, not direct sale)

---

# CRM Workflow

Leads flow through these stages in the Notion CRM:

- **Outreach** — Initial contact, cold email/LinkedIn message
- **Intro** — First conversation scheduled or completed
- **Discovery** — Understanding their needs, scoping potential work
- **Warming** — Proposal sent or engagement being defined
- **Negotiating** — Terms being finalized
- **Won** — Contract signed, work begins
- **Lost** — Didn't convert (capture reason for learning)

---

# Automation

Weekly cron job runs Mondays at 9 AM CT:

- Scans all lead sources for new signals
- Researches companies found (CEO/CTO, funding, tech stack)
- Checks for duplicates against existing CRM entries
- Adds qualified leads to Notion CRM with full details
- Uses Firecrawl for deep research (~30-40 searches per run, budget ~3k credits/cycle)

Manual review follows each automated run to prioritize outreach.