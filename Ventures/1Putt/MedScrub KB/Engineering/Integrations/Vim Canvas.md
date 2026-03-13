Created: February 20, 2026 10:23 PM
Tags: Research

<aside>
🎯 1PuttHealth Strategy: "FHIR for Epic/Cerner, Vim for everyone else, Medplum for CDR" — Vim Canvas fills the mid-market EHR gap where FHIR consulting does not reach. Zero consultancies exist yet for Vim Canvas development.

</aside>

# 1. Platform Overview

Vim is the middleware platform for healthcare. Vim Canvas™ is a self-service platform that empowers app developers to embed applications into EHR workflows via iframe-based SDK (VimOS.js). Apps appear in the Vim Hub — a widget overlay on top of supported EHRs via Vim Connect.

## Architecture

- **Vim Connect** — Browser extension / desktop overlay that attaches to the EHR UI
- **Vim Hub** — Widget container visible to EHR users; your app lives here as an iframe
- **VimOS.js SDK** — JavaScript/TypeScript SDK providing auth, EHR state reading, write-back, subscriptions
- **App Manifest** — Configuration in developer console controlling permissions, activation triggers, UI behavior
- **Vim Console** — Self-service admin portal for partners to manage apps, users, permissions (console.getvim.com)
- **Sandbox EHR** — Testing environment with simulated EHR workflows for development

## The Vim Network (Scale)

- **10,800+ clinics** (small individual practices to large group organizations)
- **50,780+ Vim Connect users** (providers, admin users, and more)
- **15M+ patients detected**

## Security & Compliance

- SOC 2, HITRUST CSF, and HIPAA compliant environment
- US-only server requirement — app servers must be hosted in the United States (IP whitelisting NOT supported)
- Developers outside US can use VPN for dev/testing, but production server must be US-based

---

# 2. Supported EHRs

<aside>
💡 This is the critical differentiator — Vim supports EHRs NOT well-served by FHIR/SMART-on-FHIR. Epic and Cerner are notably ABSENT (they have their own ecosystems).

</aside>

### Currently Live

- **athenahealth** — Already in 1PuttHealth wheelhouse
- **eClinicalWorks (eCW)** — v11.52+, web/desktop/plugin. Huge market share
- **NextGen Enterprise** — Major ambulatory EHR
- **Practice Fusion** — Large SMB market
- **DrChrono** — Cloud-based, growing
- **Elation** — Primary care focused
- **Office Ally EHR 24/7** — First EHR partnership (2024)
- **eMedicalPractice** — Specialty-focused
- **MDland** — Smaller EHR
- **TouchWorks (Allscripts)**

### In Development

- eMDs (in testing) — more added based on customer demand

### NOT Supported (Have Own Ecosystems)

- Epic — App Orchard / SMART-on-FHIR
- Cerner/Oracle Health
- MEDITECH

### Browser & Platform Compatibility

- Chrome (Windows, Mac, Linux) ✅
- Edge (Windows, Mac, Linux) ✅
- Desktop Software: Windows only + eCW web plugin
- iPads / Mobile: ❌ NOT supported

---

# 3. VimOS.js SDK — Technical Reference

## Installation

Two methods: script tag or npm package. TypeScript V5+ required.

```bash
# NPM (recommended — async loading + TS autocomplete)
npm install vim-os-js-browser

# Script tag alternative
<script src="https://connect.getvim.com/vim-os-sdk/v2.x.x/vim-sdk.js"></script>
```

## Authentication (OAuth 2.0)

Vim uses OAuth 2.0 with OpenID Connect. Your app needs a backend server with two endpoints:

1. **Launch endpoint** — Receives the authorization code from Vim, exchanges it for tokens (access_token + id_token + refresh_token)
2. **App token endpoint** — Called by your frontend iframe to get the id_token needed for SDK initialization

Key OAuth endpoints:

- Authorization: https://auth.getvim.com/authorize
- Token: https://auth.getvim.com/oauth/token
- UserInfo: https://auth.getvim.com/userinfo
- JWKS: https://auth.getvim.com/.well-known/jwks.json

### SDK Initialization

```tsx
import { vimSdk } from "vim-os-js-browser";

const vimOS = await vimSdk.setup({
  // Called by SDK to get auth token from your backend
  authenticationUrl: async (tokenPayload) => {
    const res = await fetch("/api/vim/token", {
      method: "POST",
      body: JSON.stringify(tokenPayload),
    });
    const { idToken } = await res.json();
    return { idToken };
  },
});
```

## EHR Read Capabilities

Access via vimOS.ehr — provides real-time EHR state and subscription-based updates.

### Subscribable Resources

- **Patient** — demographics, insurance, identifiers (MRN, SSN), contact info, emergency contacts
- **Patient Lists** — problem list, medication list, allergy list, lab results (beta), vitals (beta). Rate limit: 10 req/min per user
- **Encounter** — encounter type, status, diagnoses, procedures, providers, assessment notes. Includes Chart Retrieval Request for full clinical notes
- **Referral** — referral details, target provider, diagnoses, priority, notes, authorization info
- **Orders** — order type, status, diagnoses, procedures, target provider, assessment. Supports Order Created workflow events
- **Claim** — claim lines, diagnoses, procedures, modifiers, rendering provider

### Subscription Pattern

```tsx
// Subscribe to patient changes in real-time
vimOS.ehr.subscribe("patient", (patient) => {
  console.log("Current patient:", patient?.demographics?.firstName);
});

// Subscribe to encounter
vimOS.ehr.subscribe("encounter", (encounter) => {
  console.log("Encounter diagnoses:", encounter?.diagnoses);
});

// Get current EHR state snapshot
const state = vimOS.ehr.ehrState;
const currentPatient = state.patient;
```

## EHR Write-back Capabilities

<aside>
✏️ Write-back requires explicit permissions in the app manifest and is rate-limited to 5 req/min per user.

</aside>

### Updatable Resources

- **Encounter** — Add/update diagnoses (ICD-10) and procedure codes (CPT/HCPCS)
- **Referral** — Update target provider (NPI lookup), diagnoses, notes, priority, authorization number
- **Order** — Update target provider, diagnoses, procedures, notes

### Write-back Example

```tsx
// Check if update is possible first
const canUpdate = await vimOS.ehr.encounter.canUpdate();
if (canUpdate.diagnoses) {
  await vimOS.ehr.encounter.update({
    diagnoses: [
      { code: "J06.9", description: "Acute upper respiratory infection" }
    ]
  });
}

// Update referral target provider by NPI
await vimOS.ehr.referral.update({
  targetProvider: {
    npiNumber: "1234567890",
    firstName: "Jane",
    lastName: "Smith"
  }
});
```

---

# 4. Vim Hub UI Features

The Vim Hub is the user-facing widget overlay where your app appears. VimOS.js provides full control over the Hub behavior:

- **Activation Status** — Enable/disable your app icon in the Hub dynamically based on EHR context
- **Tooltip Text** — Custom hover text for your app icon
- **Dynamic App Size** — Resize your iframe programmatically
- **Notifications Badge** — Show a count badge on your app icon
- **Push Notifications** — Send in-EHR push notifications to users
- **Microphone Badge** — Visual indicator for voice/recording features
- **Auto Popup** — Auto-expand your app when specific EHR events occur
- **App State** — Persist state across Hub open/close cycles

---

# 5. Developer Workflow

1. **Register** for Vim Canvas developer account at console.getvim.com
2. **Create Application** in App Developer Console — configure manifest (permissions, EHR resources, UI settings)
3. **Get Developer Keys** — Client ID and Secret from My Account page
4. **Install VimOS.js** SDK in your app (npm or script tag)
5. **Build & Test** against Sandbox EHR (simulated EHR environment)
6. **Submit for Review** — App review process → deploy to provider network

## App Settings (Optional)

You can inject an additional iframe into the Vim Console for clinic admins to configure your app (feature settings, default filters, themes, org-level preferences). Uses VimAppSettings SDK, visible in the preview store page.

---

# 6. Rate Limits & Constraints

- Patient Lists (problems, meds, allergies, labs, vitals): **10 requests/min per user**
- Write-back operations: **5 requests/min per user**
- Chart Retrieval: rate limited (specifics TBD)
- US-only hosting requirement for production servers
- Chrome + Edge only (no Firefox/Safari). Desktop only (no iPad/mobile)

---

# 7. Technical Stack & React Integration

Apps are standard web apps (React, Vue, etc.) loaded in an iframe. Vim provides official React hooks via useVimOsContext() — gives access to patient, encounter, referral, orders, claim, sessionContext, and hub controls.

Demo app stack: React + Vite + TypeScript + Shadcn/Radix UI + TailwindCSS + Cloudflare Pages Functions for backend auth. Sample apps on GitHub: github.com/getvim

---

# 8. MedScrub / 1PuttHealth Opportunity

<aside>
🚀 Vim Canvas fills the gap for EHRs where FHIR consulting does not reach. Zero consultancies exist for Vim Canvas development as of 2026. 1PuttHealth can be FIRST.

</aside>

### For 1PuttHealth (Consulting)

- Offer Vim Canvas app development to companies needing mid-market EHR integrations
- Position: FHIR for Epic/Cerner, Vim for everyone else, Medplum for CDR
- Build proof-of-concept to establish credibility as first Vim Canvas consultancy

### For MedScrub (Product)

- Deploy SOAP note generation directly inside mid-market EHRs via Vim Canvas
- Leverage Vim Hub for ambient scribe UI (auto-popup on encounter, microphone badge)
- Write-back SOAP notes as diagnosis/procedure codes directly to the encounter
- Chart Retrieval API enables pulling full clinical context for AI processing

---

# 9. Key Links & Resources

- **Developer Docs:** https://docs.getvim.com
- **Developer Console:** https://console.getvim.com/organization-admin
- **VimOS.js NPM:** https://www.npmjs.com/package/vim-os-js-browser
- **Demo Apps GitHub:** https://github.com/getvim
- **Vim Homepage:** https://getvim.com
- **Vim Canvas Page:** https://getvim.com/canvas
- **Security Info:** https://getvim.com/technology-security/
- **API Reference:** https://docs.getvim.com/api
- **Register for Access:** https://getvim.com/health-tech-innovators/
- **Support:** support@getvim.com

---

# 10. App Submission & Review

After building and testing against the Sandbox EHR, apps go through a submission and review process:

1. Complete app manifest with all required fields (permissions, UI config, activation rules)
2. Test thoroughly on Sandbox EHR using Mock EHR account
3. Preview store page to verify branding, screenshots, and settings UI
4. Submit for Vim review
5. After approval: deploy to Vim network (10,800+ clinics)

## Practice Onboarding

New practice onboarding follows: (1) App network onboarding (2) Create practice in console (3) Configure app access (4) User onboarding. Vim handles the EHR connectivity layer — you just need your web app.

---

*Last updated: February 2026. Raw scraped docs stored in .firecrawl/vim-canvas-kb/*

---

# 11. 1PuttHealth Console Account Details

<aside>
🔑 These are our actual Vim Canvas developer account credentials and app details.

</aside>

### Organization

- **Org Name:** 1PuttHealth
- **Org ID:** 3621
- **Client ID:** 44sJu1fpKTqWm5EHIlSyGEc3vipdXNWj
- **Client Secret:** (stored in console — view at console.getvim.com/organization-admin/my-account)
- **Console URL:** https://console.getvim.com/organization-admin

### Test Application (Draft)

- **App ID:** 7e8e41f9-79ef-4408-be85-5b3cdd363a8a
- **Version:** 1.0.0 (Draft status)
- **Created:** Dec 2025
- **Allowed iframe URLs:** https://localhost:3000, http://localhost:5173
- **Launch endpoint:** (not yet configured)
- **Token endpoint:** (not yet configured)

### Configured Permissions

Read permissions enabled:

- User session context (identifiers, demographics, contact, organization, EHR info)
- Patient (identifiers, demographics, address, contact, insurance, PCP, problem/med/allergy/vital/lab lists)
- Encounter (identifiers, basic info, subjective, objective, assessment, plan, patient instructions, general notes)

Vim Hub features requested:

- Counter notification badge, push notifications, auto-expand popup, always accessible from Hub, show patient details on Hub

### App Manifest Tabs

The manifest has 4 configuration tabs: (1) Information — name, icon, iframe URLs, auth endpoints (2) Vim Hub — UI behavior and features (3) EHR Workflow Resources — which EHR entities to read/write (Patient, Encounter, Referral, Order, Claim) (4) API — additional API configuration

---

# 12. Test App Manifest — Vim Hub Config

Current Vim Hub settings for the Test Application (from console):

### Layout Size

- **Classic (selected)** — 365px width x 90vh height (recommended)
- Large — 800px width x 90vh height
- Full screen — 100vw x 100vh

### Engagement Features (all enabled)

- **Notification badge** — Red label icon + number on app icon when Hub is closed
- **Push notifications** — Real-time push notifications with content when Hub is closed
- **Auto pop up** — Auto-expand app when specific business logic is triggered
- **App Always Available** — App always accessible in Hub regardless of workflow state
- **Patient details header** — Shows patient name, DOB, age, insurance on top of Hub

### REST Backend API (Tab 4)

Vim provides a REST backend-to-backend API for getting clinic appointment data (next 10 days). Currently NOT enabled on our test app. Useful for enriching data models or proactive patient communication. Requires agreeing to separate Terms and Conditions.

---

# 13. Demo App Reference Architecture

<aside>
📦 Source: github.com/getvim/vim-canvas-demo-app — Full analysis in .firecrawl/vim-canvas-kb/demo-app-analysis.md (827 lines)

</aside>

## Tech Stack

- React + Vite + TypeScript
- Shadcn/Radix UI + TailwindCSS (same stack as MedScrub!)
- Cloudflare Pages Functions for backend auth (serverless)
- Cloudflare D1 database for settings storage
- vim-os-js-browser SDK (v2.x.x)

## Architecture Pattern

Monorepo with a React SPA loaded as iframe inside Vim Hub. Backend is just 2 auth endpoints + 1 settings endpoint. The SDK does the heavy lifting.

1. `AppWrapper.tsx` — Loads VimOS SDK, wraps app in context providers
2. **Context providers per entity** — PatientContext, EncounterContext, ReferralContext, OrdersContext, ClaimContext (each subscribes to vimOS.ehr)
3. **Custom hooks** — usePatient(), useEncounter(), useUpdateEncounter(), useUpdateReferral() etc.
4. **Auth flow** — /api/launch (redirect to Vim OAuth) + /api/token (exchange code, validate JWT, return id_token)

## Write-back (Key Feature for MedScrub)

The demo app shows full write-back to encounters and referrals. This is the money feature for MedScrub:

- **Encounter write-back** — Push ICD-10 diagnosis codes + CPT procedure codes back to the EHR encounter. Uses canUpdate() to check per-field writability.
- **Referral write-back** — Update target provider (NPI lookup), diagnoses, notes, priority
- **Patient enhancement APIs** — getProblemList(), getMedicationList(), getAllergyList(), getLabResults(), getVitals() for additional clinical context

## MedScrub Integration Patterns

Key patterns to replicate from the demo app for MedScrub Vim Canvas integration:

1. Use same React Context provider pattern — one context per EHR entity with subscriptions
2. Auth endpoints can be added to existing MedScrub API — just needs /launch + /token
3. Write-back encounter updates for SOAP note → ICD-10 codes + CPT codes
4. Auto-popup on encounter open + microphone badge for ambient scribe
5. Push notification when SOAP note generation completes
6. Patient enhancement APIs for pulling full clinical context into AI processing
7. Chart Retrieval Request API for getting full clinical notes (encounter documentation)