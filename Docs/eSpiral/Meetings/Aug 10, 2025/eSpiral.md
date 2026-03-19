# eSpiral

A Team-Based Learning Platform for Residency Programs

<aside>

# Summary

---

eSpiral transforms how attending physicians supervise and teach residents by creating personalized, patient-specific practice advisories that scale clinical expertise across the entire residency program. 

Built directly into Epic's EHR using SMART on FHIR technology, it enables physicians to guide resident while decision-making without being physically present
for every patient interaction.

</aside>

<aside>

## Problem

---

- For Physicians: Attending physicians can't be everywhere at once, yet residents need
consistent guidance on complex cases
- For IT Staff: Need secure, compliant tools that integrate seamlessly with existing Epic
infrastructure without adding complexity
</aside>

<aside>

## Features

---

1. **One-Click Launch from Epic**
    - Launches directly from patient charts using Epic's Smart Launch
    - No separate logins or patient searches required
    - Maintains full context from the EHR session
    - HIPAA-compliant with automatic PHI handling
2. **Interactive Patient Journey Visualization**
    - Transforms messy patient charts into intuitive spiral timelines
    - 5-year patient history displayed at once
    - Each problem represented by medical icons positioned chronologically
    - Drag to navigate through different time periods
    - Click/tap to mark severity and group related conditions
3. **Advisory Builder for Teaching at Scale**
    - Create personalized practice advisories for specific patient scenarios
    - Include multimedia (images, audio recordings, references)
    - Set severity levels (info, warning, critical)
    - Advisories automatically trigger when residents encounter similar cases
    - Built-in AI assistance for crafting comprehensive guidance
4. **CDS Hooks Integration** 
    - Seamlessly integrates with Epic's Clinical Decision Support
    - Advisories appear at the point of care during:
        - Pre-visit planning
        - Chart reviews
        - Patient encounters
        - Care transitions
    - No workflow disruption - guidance appears when and where needed
</aside>

<aside>

## Technical Overview

---

- Standards-Based: Built on HL7 FHIR R4 and CDS Hooks 1.0 specifications
- Security: OAuth 2.0 authentication, encrypted data at rest (AES-256)
- Deployment: AWS serverless architecture (Lambda, DynamoDB, S3)
- Integration: Direct Epic MyChart integration via App Orchard listing
- Compliance: HIPAA-compliant, no PHI stored long-term
- Performance: Sub-second response times, handles 500+ concurrent users
- Browser Support: Works on all modern browsers, responsive design
</aside>

<aside>

## Resident Advisor Workflow

---

Dr. Clarkson's Workflow:

1. Reviews Teddy’s complex cardiac case
2. Opens eSpiral with one click from Epic
3. Sees interactive timeline of her 5-year cardiac history
4. Creates advisory highlighting key decision points for residents
5. Adds EKG images and voice notes explaining interpretation
6. Sets to "critical" severity for immediate attention
7. Next resident opening Teddy's chart automatically receives this guidance
8. Dr. Clarkson receives feedback on how his advice went.
</aside>

<aside>

## Benefits

---

**For Physicians**

- Scale expertise to all residents simultaneously
- Reduce repetitive teaching of common scenarios
- Track which advisories are most helpful
- Build institutional knowledge base
- Improve consistency of care across the program

**For IT/Administration**

- Minimal setup - leverages existing Epic infrastructure (FDI Record)
- No additional servers or maintenance required
- Automatic updates via cloud deployment
- Full audit trail and usage analytics
- ROI through reduced medical errors and improved efficiency
</aside>

<aside>

## Results So Far

---

- Currently proven on minimal scale at Infirmary Health.
- "Must have utility for quality goals in our residency program"
- Greater than 40% reduction in time spent on repetitive teaching
- Improves resident confidence
- Available on Epic's App Showroom
</aside>

<aside>

## Technical Details

---

**Advisory Storage**

- Private S3 buckets (no public access)
- Encryption at rest (SSE-S3)
- Encryption in transit (TLS 1.2+)
- Epic JWT role-based access control
- CloudTrail audit logging
- HIPAA Compliant AWS services
- Automated lifecycle policies
- File type/size validation

---

**Transcription**

1. Full HIPAA Compliance
    - SOC 2 Type II certified
    - Business Associate Agreement in place
    - Zero audio retention policy
    - Complete audit trail
2. Medical Specialization
    - Trained on medical vocabulary
    - Accurate drug name recognition
    - Understands clinical terminology
    - Handles medical abbreviations
3. Security First
    - Audio never stored, only transcribed
    - End-to-end encryption
    - API keys secured server-side
    - No client-side exposure
4. Workflow Benefits
    - Physicians can dictate advisories naturally
    - 5x faster than typing
    - Real-time transcription feedback
    - Editable results for accuracy
</aside>

<aside>

### One-time Implementation

---

- Setup Time: 2-4 hours for IT configuration
- Training: 30-minute sessions for physicians
- Support: Direct access to development team
- Contact: clint@espiral.healthcare
</aside>

Notes