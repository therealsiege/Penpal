# IAL2 Identity Verification with Medplum (Flexpa Model)

<aside>
🔐 How to implement NIST IAL2/AAL2 identity verification for patient onboarding using Medplum, following the Flexpa + ID.me model. Last updated: Feb 17, 2026.

</aside>

## What is IAL2?

NIST SP 800-63-3 defines Identity Assurance Levels (IAL) for identity proofing. IAL2 requires evidence of real-world identity through document verification and biometric comparison. This is the standard CMS and healthcare organizations require for patient access to health records.

- **IAL1** — Self-asserted identity (email/password). No proofing required.
- **IAL2** — Remote or in-person identity proofing. Government ID + selfie/biometric match. Required for CMS Patient Access APIs.
- **AAL2** — Multi-factor authentication (something you know + something you have/are).

---

## The Flexpa + ID.me Model

In October 2025, Flexpa partnered with ID.me to create the gold standard for patient identity verification in FHIR-based workflows. Here is how their architecture works and how MedScrub can replicate it:

### Architecture Overview

1. **Patient initiates onboarding** — User clicks "Connect my records" in the app.
2. **ID.me verification (IAL2)** — Patient is redirected to ID.me where they verify identity via government ID + selfie. ID.me returns a verified credential (OIDC token with IAL2 claim).
3. **Flexpa consent + data retrieval** — With verified identity, patient selects their health plan, authenticates with payer, and consents to data sharing. Flexpa retrieves claims/clinical data via CMS Patient Access APIs.
4. **Medplum CDR storage** — Flexpa loads the FHIR data into Medplum using $everything operation + batch transactions. Patient resource is created with verified identity markers.
5. **Provenance tracking** — Each imported resource gets a Provenance record linking it to the verification event, consent, and data source.

---

## Implementing IAL2 with Medplum

### Option A: ID.me as External Identity Provider

Medplum supports external OAuth2/OIDC identity providers out of the box. ID.me is a Kantara-accredited IAL2/AAL2 credential service provider with 154M+ users.

- Configure ID.me as an external identity provider in Medplum (docs/auth/external-identity-providers)
- ID.me returns OIDC tokens with verified claims (name, DOB, address, SSN last 4)
- Map verified claims to FHIR Patient resource fields
- Store verification level as Patient.identifier with system "urn:oid:2.16.840.1.113883.3.8775" (ID.me OID)
- Create Provenance resource documenting the verification event

### Option B: Custom Verification Bot

For more control, use a Medplum Bot to orchestrate the verification flow:

- Bot receives patient registration webhook
- Bot calls ID.me API (or alternative: Persona, Jumio, Onfido) to initiate identity proofing
- On successful verification, Bot updates Patient resource with verified demographics
- Bot creates Provenance resource with agent (verifier), target (Patient), and recorded timestamp
- Bot fires Subscription to trigger downstream workflows (e.g., data retrieval from payers)

---

## FHIR Resources for Identity Verification

- **Patient** — Core demographics. Store verified fields. Use identifier to track verification status and ID.me user ID.
- **Provenance** — Audit trail of who verified what and when. agent.who = verifier org, target = Patient, recorded = timestamp, activity = "verification".
- **Consent** — Record patient consent for data sharing. scope = "patient-privacy", category = data disclosure, patient = reference, dateTime = when consented.
- **VerificationResult** — FHIR R4 resource for recording verification outcomes. status (attested/validated/in-error), validationType, validationProcess, primarySource.
- **DocumentReference** — Store copies of verification documents (government ID scans) as Binary attachments with appropriate security labels.

---

## MedScrub Implementation Path

For MedScrub, the recommended approach:

1. **Phase 1 (Now):** Physician onboarding uses NPI verification (NPI Registry API) + email domain verification. No IAL2 needed for providers — they authenticate via Epic/athena SMART Launch which inherently provides institutional identity.
2. **Phase 2 (Patient-facing):** When MedScrub adds patient portal features, integrate ID.me as external IdP in Medplum. Patients verify once, get persistent credential. Use Flexpa integration for claims data retrieval after verification.
3. **Phase 3 (Regulatory):** Full IAL2 compliance for TEFCA participation. VerificationResult resources for audit. Provenance chain from identity → consent → data access.

---

## Key References

- **ID.me + Flexpa partnership:** [network.id.me/press-releases/id-me-and-flexpa-partner](https://network.id.me/press-releases/id-me-and-flexpa-partner-to-give-patients-trusted-access-to-their-health-data-fight-ai-driven-fraud-and-advance-healthcare-interoperability/)
- **Flexpa + Medplum integration guide:** [flexpa.com/docs/guides/medplum](https://www.flexpa.com/docs/guides/medplum)
- **Medplum case study:** [medplum.com/blog/flexpa-case-study](https://www.medplum.com/blog/flexpa-case-study)
- **Medplum external IdP docs:** [medplum.com/docs/auth/external-identity-providers](https://www.medplum.com/docs/auth/external-identity-providers)
- **NIST SP 800-63-3:** [pages.nist.gov/800-63-3](https://pages.nist.gov/800-63-3/)
- **Flexpa Quickstart (GitHub):** [github.com/flexpa/quickstart](https://github.com/flexpa/quickstart)