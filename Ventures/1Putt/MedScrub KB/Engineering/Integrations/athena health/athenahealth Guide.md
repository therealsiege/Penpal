Created: February 17, 2026 12:22 AM
Tags: Athena, Research

### Docs

---

[athenahealth Event Notifications](athenahealth%20Guide/athenahealth%20Event%20Notifications%2030af3cf2487f81eb8100e6fe3c4abbbf.md)

[athenahealth Changed Data Subscriptions](athenahealth%20Guide/athenahealth%20Changed%20Data%20Subscriptions%2030af3cf2487f81e6800af8871e7d5524.md)

[athenahealth FHIR & Environment URLs](athenahealth%20Guide/athenahealth%20FHIR%20&%20Environment%20URLs%2030af3cf2487f81d5aaa5f5ced832bd66.md)

[athenahealth Token Endpoint](athenahealth%20Guide/athenahealth%20Token%20Endpoint%2030af3cf2487f81fd96fbc081bee318a1.md)

[athenahealth Backend Sync](athenahealth%20Guide/athenahealth%20Backend%20Sync%2030af3cf2487f8142b9a5e81e6b50ddf5.md)

## App Configuration

- App Name: MedScrub | Status: PREVIEW
- App Category: 2-Legged OAuth (backend)
- Client ID: 0oa10wpw6enBVODk3298
- Auth Method: JWK (self-hosted JWKS URL)
- JWKS URI: https://medscrub.ai/.well-known/jwks.json ✅ LIVE
- Organization: 1PuttHealth | 2 practices live

## Environment URLs

- Preview: https://api.preview.platform.athenahealth.com
- Production: https://api.platform.athenahealth.com
- URL pattern: {BaseURL}/v1/{practiceid}/{endpoint}

## FHIR R4 Base URLs

- Global Preview: https://api.preview.platform.athenahealth.com/fhir/r4
- Global Production: https://api.platform.athenahealth.com/fhir/r4
- Site-specific: {BaseURL}/{practiceid}/brand/{brandid}/csg/{chartsharinggroupid}/fhir/r4

## Authentication (2-Legged OAuth with JWKS)

JWT Claims: aud (token endpoint URL), exp (< 1hr from now), iss (client ID), sub (client ID). Sign with RS256 using private key, include kid header.

Token request: POST to token endpoint with grant_type=client_credentials, scope=athena/service/Athenanet.MDP.*, client_assertion_type=urn:ietf:params:oauth:client-assertion-type:jwt-bearer, client_assertion=JWT

- Preview token endpoint: https://api.preview.platform.athenahealth.com/oauth2/v1/token
- Production token endpoint: https://api.platform.athenahealth.com/oauth2/v1/token
- Access token default expiry: 60 minutes

## Current Scopes

### athenaOne Proprietary

- athena/service/Athenanet.MDP.* (full MDP API access)

### FHIR R4 SMART V1 (system/*.read)

- CarePlan, CareTeam, Condition, DocumentReference, Encounter
- Immunization, Medication, Observation, Patient, Practitioner, Procedure

## ⚠️ Missing Scopes (Need to Add)

- system/DocumentReference.write — required for SOAP note write-back
- system/AllergyIntolerance.read — needed for clinical context
- system/DiagnosticReport.read — needed for SOAP Objective section
- system/MedicationRequest.read — needed for active prescriptions

## Action Items

- ☐ Add missing FHIR read + write scopes in developer console
- ☐ Set up Changed Data Subscriptions for backend sync
- ☐ Test token generation flow end-to-end in Preview
- ☐ Move from PREVIEW to PRODUCTION when ready
- ☐ Evaluate Event Notifications (requires updated contract)