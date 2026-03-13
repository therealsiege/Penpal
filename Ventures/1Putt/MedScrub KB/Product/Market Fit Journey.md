
The evolution from PHI safety infrastructure to physician productivity tool.

## Genesis: Clarity Health Project

The PHI safety proxy originated while working on the Clarity Health Project with Patrick Carter, a PA and digital health guru. Patrick recognized the value in the HTTP API for de-identification and showed it to JP Polak at the Commons Project. Both saw tremendous value in the approach.

## Early Traction: API-First Approach

Started selling the HTTP API proxy and successfully onboarded early customers including HealthcarePriceTool (David LiCause) at [https://healthcarepricetool.com](https://healthcarepricetool.com). This validated the core PHI proxy concept at scale.

## Pivot Catalyst: Maurice Hill Insight

While searching for product-market fit, conversations with Maurice Hill from Optum's product team provided the crucial direction shift. Maurice pointed toward helping physicians directly rather than just providing infrastructure APIs.

## Evolution: End-User Product

Added the Medplum CDR to the proxy and developed two AI-based physician features:

- SOAP Notes Generation (voice + text input)
- Prior Authorization Prep automation

## Current Status (March 2026)

- ✅ MVP complete (desktop + mobile apps shipping)
- ✅ athenahealth FHIR R4 sync implemented (OAuth 2.0, scheduled imports, 7 resource types)
- ✅ Oracle Health (Cerner) FHIR R4 sync implemented (Millennium API, 8 resource types, DocumentReference write-back)
- ✅ Mobile push notifications operational (Expo Push Service, briefing/message routing)
- ✅ Mobile messaging with conversation store
- ✅ Branding updated: "AI Workspace" → "AI Sidekick"
- 🔄 Design partner validation ongoing (Maurice Hill, Rob Trachtman, Patrick Carter)
- 🔄 Cold outreach to Epic/athena/Oracle providers using CRM leads

## Strategic Architecture

MedScrub's unique value chain creates compounding advantages:

1. PHI Proxy → Trust & Safety
2. CDR (Medplum) → Data Gravity
3. AI Sidekick → Daily Habit Formation

Key Insight: The evolution from infrastructure (PHI proxy) to end-user product (physician tool) shows MedScrub is building something the market actually wants, not just what's technically possible.

## Milestones (March 2026)

### EHR Coverage Expansion
- ✅ athenahealth FHIR R4 sync complete — OAuth 2.0, scheduled imports, 7 resource types, 7 sandbox test patients
- ✅ Oracle Health (Cerner) FHIR R4 sync complete — Millennium FHIR R4 API, backend services JWT, 8 resource types, DocumentReference write-back
- Combined with existing Epic integration, MedScrub now covers the three largest US EHR platforms

### Mobile Messaging & Notifications
- ✅ Push notifications via Expo Push Service — briefing alerts, message routing, badge management
- ✅ Conversation store with paginated message retrieval and read tracking
- ✅ End-to-end daily briefing flow operational: desktop generates → platform stores → Expo pushes → mobile fetches → proxy re-identifies

### "AI Sidekick" Rebrand
- ✅ Updated medscrub.ai marketing pages from "AI Workspace" to "AI Sidekick"
- ✅ Removed "99.9%" accuracy claims from marketing-facing content, replaced with "HIPAA-grade" qualitative language
- ✅ Added HEDIS alongside USPSTF in screening compliance language

### Next Steps
- Physician validation with design partners (Maurice, Rob, Patrick)
- Cold outreach to Epic/athena/Oracle providers
- Population health screening MVP (P0 priority)
- Expert Determination certification (backlog — analysis endpoints built, formal cert deprioritized)
