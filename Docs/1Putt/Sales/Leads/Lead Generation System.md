🎯 MedScrub Lead Generation System — How we find, qualify, and convert healthcare companies that need FHIR/interoperability help.

---

# Overview

MedScrub's lead generation system identifies healthcare companies that need FHIR integration, SMART on FHIR apps, clinical documentation tools, or interoperability consulting. We monitor multiple sources, qualify leads against our ICP, and push them into the CRM for structured outreach.

The system runs on a daily cycle: scan sources → research companies → qualify → add to SideKick (CRM) → outreach. A daily cron job (8 AM CT) automates the scanning phase.

---

# Lead Sources

## Google Alerts

15 alert terms configured, delivered ad-hoc to [fuzeelogik@gmail.com](mailto:fuzeelogik@gmail.com) in 'Google Alerts' folder (emails arrive as Google finds articles — ingester queries `newer_than:2d` daily to catch everything):

**Company/hiring signals (high yield):**
- FHIR integration startup
- SMART on FHIR app development
- healthcare interoperability company
- clinical documentation AI
- EHR integration startup
- Medplum developer
- Medplum implementation
- fractional CTO healthcare
- healthcare API startup funding
- FHIR engineer hiring
- healthcare data exchange platform
- digital health FHIR
- HL7 FHIR developer
- Epic App Orchard developer
- digital health Series A

**Removed:** `CMS interoperability rule compliance` — pulls regulatory news, not company signals. Handle regulatory intel separately (see below).

> **Note on regulatory alerts:** Terms like "prior authorization API" or "TEFCA onboarding" surface CMS press releases and policy blogs, not small companies. Better sources:
> - TEFCA participant list (sequoiaproject.org) — check monthly for new orgs joining
> - CMS enforcement timeline — set calendar reminders at mandate deadlines, then proactively search
> - Health IT newsletters (HIMSS Daily, Politico Health) for regulatory context

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

## Hacker News (Automated)

Automated via `sources/hn-source.ts` — no API key required (Algolia API).

**Queries:**
- `healthcare FHIR` (tag: job, last 30 days)
- `health tech HIPAA` (tag: story, last 7 days)
- `clinical AI startup` (tag: story, last 7 days)
- `EHR integration startup` (tag: story, last 7 days)
- `digital health FHIR` (tag: story, last 7 days)

Also monitor the monthly "Who's Hiring" thread manually for FHIR/healthcare/EHR/clinical/interoperability mentions.

## Reddit (Automated)

Automated via `sources/reddit-source.ts` — no API key required (public JSON API).

**Subreddits monitored:**
- r/healthIT — industry discussions, vendor complaints, integration questions
- r/medicine — physician perspectives on health tech
- r/EHR — EHR-specific discussions
- r/healthinformatics — informatics and interoperability topics
- r/FamilyMedicine — physician pain points with EHR/documentation (manual)

**Search terms (per subreddit, last 7 days):**
- "AI HIPAA", "PHI AI", "AI documentation physician"
- "FHIR startup", "EHR integration", "clinical AI", "ambient scribe"

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

Daily cron job runs at 8 AM CT on Clint's Mac Studio:

- Fetches last 2 days of Google Alert emails from fuzeelogik@gmail.com
- Parses HTML digests, extracts company mentions via Claude Haiku
- Deduplicates against existing leads in vault
- Enriches each company via Firecrawl (search + homepage scrape) — ~2 credits/company
- Scores against MedScrub ICP (0-100)
- Writes markdown lead files to vault → SideKick ETL picks up → Memgraph + Qdrant
- Run manually: `cd ~/sidekick/sidekick-graph && npm run alerts:ingest`
- Logs: `~/sidekick/sidekick-graph/logs/alerts-ingest.log`

**SideKick is the CRM** (replaced Notion). Use MCP tools `get_pipeline` and `update_lead` to manage leads.

Manual review follows each automated run to prioritize outreach.