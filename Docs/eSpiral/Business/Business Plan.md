# Business Plan

### **1. Executive Summary**

**Company:** eSpiral, LLC

**Founded by:** Dr. David Clarkson, MD (Founder)

**Location:** Thomas Health + Remote

**Product:** eSpiral – a SMART on FHIR pre-visit chart review tool designed for clinical quality improvement and resident education.

**Target Users:** Physicians, residents, clinical staff, and healthcare organizations running Epic.

**Mission:**

To enhance care quality, reduce documentation errors, and improve medical education by enabling asynchronous, in-workflow chart review directly within Epic.

---

### **2. Problem Statement**

Clinicians and residents often enter patient encounters with incomplete or outdated information. Problem lists are neglected, past visit insights are buried, and supervisory feedback is often verbal and ephemeral.

*Challenges include:*

- Inefficient handoffs
- Fragmented patient history
- Lack of structured feedback loops
- Inconsistent resident oversight
- Missed billing or risk adjustment opportunities

---

### **3. Solution**

**eSpiral** embeds a pre-visit chart review system directly in Epic using SMART on FHIR and CDS Hooks. It enables:

- **Voice- or text-based review input** from attendings
- **Structured feedback** for residents (e.g., “Why did you not update the problem list?”)
- **Real-time decision support** and HCC code suggestions
- **Audit trails** and quality improvement data

This enhances team-based care, facilitates learning, and improves documentation quality.

---

### **4. Product Overview**

### **Features:**

- SMART on FHIR integration with Epic (no IT lift)
- CDS Hooks service for surfacing practice advisories
- Voice-to-text review input
- Curated checklists (Problem List, Medications, Risk Codes, Orders)
- Resident-focused UI with async feedback capture
- Cloud-based with health system-hosted option

### **Tech Stack:**

- Remix, Tailwind, Typescript
- AWS (HIPAA-compliant)
- FHIR R4 / CDS Hooks APIs
- Vendor Services staging + production environments for Epic

---

### **5. Market Analysis**

### **Total Addressable Market (TAM):**

- **Academic health systems**: ~150 with >1,000 residents
- **Mid-sized hospitals with residency programs**
- **Ambulatory groups using Epic**

### **Key Stakeholders:**

- CMIOs, program directors, quality leads, Epic analysts

### **Competitors:**

- None directly address async chart review + residency education with embedded Epic workflow. Nearest solutions focus on documentation or generic decision support (e.g., 3M M*Modal, IMO).

---

### **6. Go-To-Market Strategy**

**Stage 1: Academic Pilot Expansion**

- Partner with 3–5 academic systems in 2025 (e.g., MedStar, UPMC)
- Emphasize quality improvement, ACGME alignment, and HCC capture
- Offer white-glove onboarding via Grizzly Development

**Stage 2: Commercial Hospitals**

- Package with quality initiatives (e.g., “Problem List Clean-up Month”)
- Position as lightweight quality layer vs. full CDS system

**Marketing Channels:**

- Conference demos (e.g., AMIA, Epic UGM)
- Epic Showroom listing (already underway)
- Peer-reviewed articles and CMIO testimonials
- Social proof via case studies (e.g., Thomas Health, Dr. Clarkson quote)

### **7. Revenue Model**

**Pricing Structure:**

eSpiral is offered as a SaaS platform with physician-based pricing:

| **Component** | **Details** |
| --- | --- |
| **Monthly License** | **$40 per physician per month** |
| **Minimum Commitment** | 50 physicians or $2,000/month minimum |
| **Implementation Fee** | Optional one-time setup: $5,000–$15,000 (based on customization needs) |
| **Support & Maintenance** | Included in monthly license (basic), with advanced support options available |
| **Add-ons** | Custom CDS logic or Epic extensions available for additional fees ($5,000–$25,000/project) |

**Example Revenue Scenarios:**

| **Client Size** | **Monthly Revenue** | **Annual Revenue** |
| --- | --- | --- |
| 50 Physicians | $2,000 (minimum) | $24,000 |
| 100 Physicians | $4,000 | $48,000 |
| 300 Physicians | $12,000 | $144,000 |

**Projected Growth Path:**

- **Year 1 Target:** 5 health systems (~500 physicians total) → $20,000 MRR → **$240,000 ARR**
- **Year 2 Target:** 15 systems (~1,500 physicians) → $60,000 MRR → **$720,000 ARR**
- **Year 3 Target:** Expand to 50 systems (~5,000 physicians) → **$2.4M ARR**

**Notes:**

- Aligns with academic health systems’ size and budget flexibility.
- High gross margins due to low incremental cost per user.
- Pricing supports self-hosted and multi-tenant options with flexible SLAs.

### **8. Team**

- **Dr. David Clarkson, MD** – Clinical Vision & Founder
- **Clint Johnson** – CTO Engineering Lead
- **Peyton Clarkson** – Compliance advisory, security
- **Matt Wimberley** – CPO Product Lead

### **9. Operations & Support**

- Dedicated Slack + shared doc workspace per client
- Weekly demos with client stakeholders
- Documentation-first onboarding
- Asynchronous updates via Epic’s Vendor Services
- SOC 2 & HIPAA compliance maintained through partnership with Grizzly

### **10. Financial Projections (First 18 Months)**

| **Month** | **Clients** | **Revenue** | **Burn** | **Net** |
| --- | --- | --- | --- | --- |
| Q1 | 1 (pilot) | $2,000 | $30,000 | -$28,000 |
| Q2 | 2 more | $6,000 | $40,000 | -$34,000 |
| Q3 | +2 | $20,000 (setup) + $10,000 | $45,000 | -$15,000 |
| Q4 | +3 | $60,000 (setup) + $20,000 | $60,000 | Break-even |

### **11. Risks & Mitigations**

| **Risk** | **Mitigation** |
| --- | --- |
| Integration resistance | White-glove support, use Epic Vendor Services |
| Compliance | Partner with Grizzly (SOC 2, HIPAA certified) |
| Physician adoption | Embed into existing workflows, async input |
| Scaling support | Define onboarding SLAs, document updates async |

### **12. Milestones**

- ✅ Live in Epic at Thomas Health
- 🔄 Epic Showroom
- 🔜 3 Academic pilots by Q2–Q3
- 🔜 HITRUST path in parallel with early traction
- 🔜 Resident-initiated feedback loop (v2)

<aside>

## Notes

---

- Ask for IT for Residents and interested faculty… 
Initial H&L (curate the problem list)
- 90 residents cohorts
- Interactive sign off (transitions of care)
</aside>