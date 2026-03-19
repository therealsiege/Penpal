# Technical Scholarly Summary

**eSpiral: An Epic-Embedded Tool for Curated Chart Review and Improved Diagnostic Reasoning in Residency Education**

Authors: [Founder’s Name, MD], [Your Name, Tech/Product Lead]

Affiliation: eSpiral Healthcare in collaboration with [Residency Program Name]

**Purpose**

Clinical educators and residents often struggle with incomplete or inefficient chart synthesis during pre-visit review. Key historical and laboratory data are scattered across the electronic health record (EHR), resulting in superficial HPIs, missed chronic issues, and inconsistent supervision feedback. eSpiral addresses this educational and clinical need by transforming the Epic EHR into a structured, visual presentation of the patient’s longitudinal medical history—enabling both deeper diagnostic reasoning and more consistent mentorship.

**Technical Overview**

eSpiral is a SMART-on-FHIR application integrated within Epic, designed as a 'History & Labs (H&L;) Curation' tool.

**Key architectural elements:**

• FHIR-based data retrieval: Reads core patient resources (Conditions, Observations, Diagnostic Reports, Medications, and Encounters).

- Adaptive curation layer: Aggregates and organizes this data into an interactive, timeline-based view of a patient’s history.
- AI-assisted analysis: Highlights clinically relevant patterns and generates resident-ready practice advisories that appear directly in the EHR.
- Secure deployment: Read-only SMART scopes, SSO authentication, and no PHI persistence beyond the session.

**Educational & Clinical Impact**

eSpiral reframes pre-visit chart review from a manual scavenger hunt into a guided, educational process:• For residents: Improves HPI completeness by visually surfacing chronic and unresolved conditions.• For preceptors: Reduces chart-prep time and ensures consistent educational touchpoints across encounters.

- For programs: Creates measurable teaching metrics aligned with ACGME Milestones and CCC review, transforming supervision into a quantifiable, reproducible process.

**Expected Outcomes / Measures of Scholarly Impact**

| **Domain** | **Anticipated Improvement** |
| --- | --- |
| Efficiency | ↓ preceptor chart-review time by 2–5 minutes per patient |
| Education | ↑ proportion of encounters with explicit teaching points |
| Quality | ↑ diagnostic yield and closure of high-value care gaps |
| Data Science | Generates structured analytics on resident engagement and supervision co |

**Conclusion**

eSpiral exemplifies scholarly innovation at the intersection of medical education and health informatics. By converting raw EHR data into a resident-centered narrative of the patient’s history, the platform enhances both patient care and the educational experience—meeting the ACGME definition of scholarly activity through system design, data-driven evaluation, and dissemination of innovation in teaching and clinical practice.