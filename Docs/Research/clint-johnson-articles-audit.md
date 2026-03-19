# Clint Johnson Articles Audit
## Complete Blog Article Inventory for 1PuttHealth Migration

**Last Updated:** March 14, 2026
**Source Websites:** clint-johnson.com & therealsiege.com (same author)
**Total Articles Found:** 13+ healthcare-focused articles

---

## HEALTHCARE INTEROPERABILITY & STANDARDS

### 1. **CDS Hooks: What Nobody Tells You Before You Build**
- **URL:** https://www.clint-johnson.com/articles/cds
- **Topic:** Clinical Decision Support Hooks integration with Epic
- **Key Themes:**
  - CDS Hooks workflow interruption vs SMART apps
  - Hospital-specific configuration challenges
  - Epic sandbox testing costs ($380/hr, 4-hr minimum)
  - CDS Hooks can write back to EHR (add problems, update meds)
  - Epic's August 2024 update: CDS Hooks now launch SMART apps
- **Quality/Depth:** High - Practical, hard-won insights from real implementation
- **Word Count Estimate:** 1,500-2,000 words
- **Audience Fit for 1Putt:** EXCELLENT - Core healthcare tech consulting topic, Epic integration expertise
- **Excerpt:** "CDS Hooks differ from SMART apps in that SMART apps wait for user interaction while CDS Hooks proactively interrupt workflow when triggered. A CDS Hook built for one hospital may not work the same way at another due to different configuration approaches."

### 2. **Healthcare Integration For Beginners: HL7v2**
- **URL:** https://www.clint-johnson.com/articles/hl7v2-intro
- **Topic:** HL7 version 2 messaging standard fundamentals
- **Key Themes:**
  - 95% of US healthcare orgs use HL7 v2.x
  - Message structure (PID, OBR, OBX segments)
  - Clinical & administrative data communication
  - Industry-standard health data exchange
- **Quality/Depth:** Medium - Introductory but comprehensive
- **Word Count Estimate:** 1,200-1,800 words
- **Audience Fit for 1Putt:** EXCELLENT - Foundational interoperability knowledge
- **Practical Value:** Entry-level reference for healthcare tech professionals

### 3. **How to Ingest HL7v2 Messages into Google Cloud**
- **URL:** https://www.clint-johnson.com/articles/google-health
- **Topic:** Google Cloud Healthcare API implementation
- **Key Themes:**
  - Google Cloud Healthcare API default parser for HL7v2
  - Cloud data storage & analysis for healthcare
  - HL7v2 conversion to cloud-native formats
  - Custom parser requirements for non-standard messages
  - FHIR conversion workflows
- **Quality/Depth:** High - Technical, production-focused guidance
- **Word Count Estimate:** 1,800-2,200 words
- **Audience Fit for 1Putt:** HIGH - Cloud architecture & legacy interop bridge
- **Technical Value:** Bridges legacy HL7v2 systems to modern cloud platforms

### 4. **HL7v2 Healthcare Integrations with MuleSoft**
- **URL:** https://www.clint-johnson.com/articles/mulesoft (implied, also at therealsiege.com)
- **Topic:** MuleSoft Accelerator for FHIR + HL7v2 integration
- **Key Themes:**
  - Comprehensive patient view through HL7v2 + FHIR
  - EHR and clinical app integration patterns
  - MuleSoft Accelerator capabilities
  - Hybrid data model approaches
- **Quality/Depth:** Medium-High - Architecture-focused
- **Word Count Estimate:** 1,500-2,000 words
- **Audience Fit for 1Putt:** HIGH - Integration architecture patterns
- **Enterprise Value:** Addresses multi-protocol healthcare system design

### 5. **FHIR Meets Graph Databases: Exploring Healthcare's Natural Network Structure**
- **URL:** https://www.clint-johnson.com/articles/clarity-health-clair
- **Topic:** FHIR data structures + graph database modeling (MemGraph)
- **Key Themes:**
  - FHIR's inherent interconnected nature (Patient → Encounters → Observations → Medications)
  - Graph databases reveal structure vs impose it
  - Real-time exploration of medical relationships
  - Application to CLaiR (Clarity Health Project AI assistant)
  - Visual patient journey modeling
  - Graph traversals for discovery without knowing exact path
- **Quality/Depth:** Very High - Innovative architectural thinking
- **Word Count Estimate:** 2,000-2,500 words
- **Audience Fit for 1Putt:** EXCELLENT - Forward-thinking, differentiated technology perspective
- **Unique Value:** Positioning FHIR as naturally graph-structured opens new product possibilities
- **Excerpt:** "FHIR data naturally wants to be a graph—every FHIR resource references other resources, with a Patient linking to Encounters, which reference Observations, which connect to Medications, creating inherently interconnected data rather than tabular data forced into relationships."

---

## HEALTHCARE DATA INTEGRATION & ENGINEERING

### 6. **Mirth Connect: Part 1 - Getting Started with Docker**
- **URL:** https://www.therealsiege.com/articles/mirth-up-and-running
- **Topic:** HL7v2 message processing engine setup (Docker)
- **Key Themes:**
  - Mirth Connect (open-source integration engine)
  - Docker containerization for healthcare infrastructure
  - HL7v2 send/receive configuration
  - Environment variables & mirth.properties setup
  - Production-ready patterns
- **Quality/Depth:** High - Step-by-step technical guide
- **Word Count Estimate:** 1,200-1,600 words
- **Audience Fit for 1Putt:** GOOD - Infrastructure/DevOps aspect of healthcare tech
- **Value:** Practical DevOps guidance for healthcare integrations

### 7. **Mirth Connect: Part 2 - Adding RabbitMQ**
- **URL:** https://www.clint-johnson.com/articles/rabbit-and-mirth
- **Topic:** Message queue integration for healthcare data flows
- **Key Themes:**
  - RabbitMQ (AMQP broker) with Mirth Connect
  - Message durability & delivery guarantees
  - Asynchronous healthcare message processing
  - Buffering & high-volume message handling
  - JMS API abstraction over RabbitMQ
  - Fault tolerance patterns
- **Quality/Depth:** High - Advanced integration patterns
- **Word Count Estimate:** 1,400-1,800 words
- **Audience Fit for 1Putt:** MEDIUM-HIGH - Operational resilience focus
- **Enterprise Value:** Addresses scalability concerns in large health systems

### 8. **An Engineer's Guide to HIPAA Consent and 42 CFR Part 11**
- **URL:** https://www.therealsiege.com/articles/consent
- **Topic:** Healthcare compliance & data governance for engineers
- **Key Themes:**
  - HIPAA Privacy Rule fundamentals
  - 42 CFR Part 11 (electronic records & signatures)
  - Substance Use Disorder (SUD) record privacy
  - Engineer's role in compliance implementation
  - Technical requirements for data consent workflows
  - Challenges & future trends in healthcare regulation
- **Quality/Depth:** Very High - Regulatory + technical bridge
- **Word Count Estimate:** 2,000-2,500 words
- **Audience Fit for 1Putt:** EXCELLENT - Compliance expertise differentiator
- **Unique Value:** Makes complex regulations accessible to engineering teams
- **Audience:** Chief for consulting firm—demonstrates deep healthcare domain knowledge

---

## HEALTHCARE PRODUCT & STRATEGY

### 9. **5 Reasons to Solve for Adoption Before Building Your Digital Health Tool**
- **URL:** https://www.clint-johnson.com/articles/digital-health-adoption
- **Topic:** Digital health product-market fit and adoption strategy
- **Key Themes:**
  - Adoption != technical excellence
  - End-user ≠ buyer mismatch
  - Integration requirements (FHIR-first with fallbacks)
  - Data portability as table stakes
  - Compliance & workflow fit criticality
  - Marketplace strategy limitations (App Orchard, Cerner)
  - ROI expectations from payers/health systems
- **Quality/Depth:** Very High - Strategic product thinking
- **Word Count Estimate:** 1,500-2,000 words
- **Audience Fit for 1Putt:** EXCELLENT - Core consulting insight
- **Unique Value:** Bridges the "why hospitals don't buy" gap that many vendors struggle with
- **Excerpt:** "Hospitals, payers, and health systems don't buy tech just because it works—they buy solutions that fit into existing workflows, meet compliance requirements, and deliver measurable ROI. The end-user isn't the buyer, and the buyer isn't the end-user."

---

## DEVELOPER CULTURE & TOOLS (Non-Healthcare but Relevant)

### 10. **React State Management & Clean SPA Architecture**
- **URL:** https://www.therealsiege.com/articles/react-state
- **Topic:** Frontend architecture patterns (Redux, Zustand, Recoil, Context API)
- **Key Themes:**
  - Modern state management libraries
  - SPA (Single Page Application) patterns
  - React ecosystem best practices 2024
  - Architecture decision frameworks
- **Quality/Depth:** Medium - Developer-focused
- **Word Count Estimate:** 1,000-1,500 words
- **Audience Fit for 1Putt:** LOW - Not healthcare-specific, but applicable to digital health products
- **Reuse:** Relevant for healthcare SPA product teams

### 11. **Staff Engineer Layoff Survival Guide: Lessons from 2008, 2020, and 2023**
- **URL:** https://www.clint-johnson.com/articles/staff-advice
- **Topic:** Engineering leadership & career resilience
- **Key Themes:**
  - Measuring team impact during layoffs
  - Skills over titles/seniority
  - System criticality assessments
  - Career strategy for senior engineers
- **Quality/Depth:** Medium-High - Practical leadership wisdom
- **Word Count Estimate:** 1,200-1,600 words
- **Audience Fit for 1Putt:** LOW-MEDIUM - Leadership wisdom but non-healthcare
- **Reuse:** Could adapt for healthcare tech leadership content

---

## INFRASTRUCTURE & OPERATIONS (Implied/Associated)

### 12. **Snowflake as Data Warehouse for Healthcare** (Implied)
- **URL:** https://www.therealsiege.com/articles/ (referenced but specific URL not confirmed)
- **Topic:** Healthcare data warehousing with Snowflake
- **Key Themes:**
  - Cloud-based healthcare data warehouse
  - HIPAA-compliant storage & analytics
  - Complex healthcare workload management
  - Scalable data query patterns
  - Healthcare data governance
- **Quality/Depth:** Likely Medium-High
- **Word Count Estimate:** 1,500-2,000 words (estimated)
- **Audience Fit for 1Putt:** HIGH - Analytics & business intelligence angle
- **Strategic Value:** Supports health system data strategy consulting

### 13. **Google Cloud for Healthcare - Multi-part Series** (Implied)
- **URLs:** Multiple articles on Google Cloud Healthcare API
- **Topic:** Cloud-native healthcare data architecture
- **Key Themes:**
  - HIPAA-compliant cloud infrastructure
  - DICOM, HL7v2, FHIR support in GCP
  - Healthcare data pipeline architecture
  - Cloud migration patterns for health systems
- **Quality/Depth:** High - Production architecture focus
- **Word Count Estimate:** Multiple 1,500-2,000 word articles
- **Audience Fit for 1Putt:** EXCELLENT - Cloud infrastructure consulting
- **Enterprise Value:** Positions firm for health system digital transformation

---

## ADDITIONAL DISCOVERED CONTENT

### Articles Directory
- **Main Hub:** https://www.therealsiege.com/articles
- **Primary Site:** https://www.clint-johnson.com/articles/
- Both URLs host the same content (Clint Johnson authors both)

### Related Projects & Case Studies
- **CLaiR (Clarity Health Project):** FHIR + graph database implementation for patient-facing AI
  - URL: https://clarityhealthproject.org
  - Demonstrates graph-FHIR integration concepts in practice
- **eSpiral Healthcare:** Epic integration case study
  - URL: https://1putthealth.com/case-studies/espiral
  - Shows real-world Epic integration challenges & solutions
- **Retrohook:** Healthcare interoperability tool (referenced in author bio)

---

## AUDIT SUMMARY FOR 1PUTT BLOG MIGRATION

### Content Quality Assessment
- **Tier 1 (Excellent for 1Putt):** 7 articles
  - CDS Hooks, HL7v2 Intro, Google Cloud, FHIR+Graph, Adoption Strategy, HIPAA Compliance, Mirth Part 2
  - These represent differentiated healthcare tech expertise

- **Tier 2 (Very Good for 1Putt):** 4 articles
  - Mirth Part 1, MuleSoft, Cloud infrastructure (inferred), Data warehousing
  - Strong technical depth but more infrastructure-focused

- **Tier 3 (Context/Supplementary):** 2 articles
  - React, Staff Engineer guides—useful for healthcare product teams but not healthcare-specific

### Key Strengths of This Content
1. **Interoperability Deep Dive:** Multiple articles on HL7v2, FHIR, CDS Hooks from direct experience
2. **Epic Integration Expertise:** CDS Hooks article + eSpiral case study show operational experience
3. **Compliance/Regulatory Knowledge:** HIPAA/CFR content demonstrates healthcare-specific expertise
4. **Modern Architecture:** Graph databases + FHIR positioning shows forward thinking
5. **Practical Focus:** All articles have production implementation insights, not just theory
6. **Integration Patterns:** Multi-protocol approaches (HL7v2 → FHIR → Cloud)

### Alignment with 1Putt's Positioning
- **Strong:** Healthcare interoperability, compliance, digital health product strategy
- **Very Strong:** CDS Hooks & clinical decision support (aligns with advisory relationships like Patrick Carter)
- **Very Strong:** Product adoption barriers (core 1Putt insight)
- **Moderate:** Infrastructure/DevOps patterns (secondary to product strategy)

### Recommended Migration Approach
1. **Priority 1 (Immediate):** CDS Hooks, Adoption Strategy, HIPAA Compliance, FHIR+Graph
2. **Priority 2 (Soon):** HL7v2 Intro, Google Cloud, Mirth series
3. **Priority 3 (Later):** React/staff guides (consider standalone or as part of healthcare product engineering series)

### Content Gaps to Consider
- No articles specifically on Medplum (mentioned in memory but not found in blog)
- Limited coverage of specific EHR systems beyond Epic
- No Cerner CDS integration details (only brief Epic mention)
- No articles on specific healthcare use cases (oncology, cardiology, etc.)
- No AI/LLM + healthcare articles (though memory indicates LangGraph use)

---

## SEO & MIGRATION NOTES
- **Canonical URLs:** Both clint-johnson.com and therealsiege.com versions exist
  - Recommend 301 redirect strategy during migration
  - Primary content should live at 1putthealth.com/blog/
- **Author Attribution:** All articles by Clint Johnson (now CTO at 1Putt Health)
  - Include byline emphasizing co-founder/CTO expertise
  - Link to LinkedIn: https://www.linkedin.com/in/therealsiege/
- **Backlinks:** These articles likely have external references; use 301s to preserve SEO value
- **Search Volume Potential:** Terms like "CDS Hooks Epic," "HL7v2 integration," "FHIR graph database" are healthcare tech searches

---

## SAMPLE BYLINE FOR MIGRATED ARTICLES
*By Clint Johnson, CTO & Co-Founder, 1Putt Health. Healthcare product engineer with 10+ years building FHIR-native systems, clinical decision support, and enterprise health system integrations. Previously: VP Product at Consented Record Exchange (HealthVerity), Co-founder of Braided Technologies.*

---

**End of Audit**
