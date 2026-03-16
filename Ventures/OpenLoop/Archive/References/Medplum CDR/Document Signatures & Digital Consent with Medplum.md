# Document Signatures & Digital Consent with Medplum

<aside>
📝 How to implement electronic signatures, consent capture, and document attestation using Medplum FHIR resources. Follows Flexpa model for consent-driven data sharing. Last updated: Feb 17, 2026.

</aside>

## Overview

FHIR provides several resources for capturing digital signatures and consent. Medplum supports all of them natively. The Flexpa model demonstrates how to combine consent capture, document signing, and provenance tracking in a FHIR-compliant workflow.

---

## FHIR Signature Element

FHIR defines a Signature datatype that can be attached to Bundle, Contract, Provenance, and other resources. This is the foundation for digital signatures in FHIR.

- **`type`** — Coding indicating the reason for the signature (e.g., "1.2.840.10065.1.12.1.1" = Author signature)
- **`when`** — Timestamp of when the signature was created
- **`who`** — Reference to the signer (Patient, Practitioner, RelatedPerson)
- **`data`** — Base64-encoded signature content (JWS, XML-DSig, or image of wet signature)
- **`targetFormat`** — MIME type of what was signed (e.g., application/fhir+json)
- **`sigFormat`** — MIME type of the signature itself (e.g., application/jose for JWS)

---

## Key FHIR Resources

### Consent Resource

The primary resource for capturing patient consent decisions. Flexpa uses this for data-sharing consent.

- **status** — draft | proposed | active | rejected | inactive | entered-in-error
- **scope** — patient-privacy | research | treatment | advanced-care-directive
- **category** — What type of consent (HIPAA disclosure, research participation, etc.)
- **patient** — Reference to the consenting patient
- **dateTime** — When consent was given
- **performer** — Who is consenting (may differ from patient, e.g., guardian)
- **sourceAttachment / sourceReference** — The actual signed document (PDF, DocumentReference)
- **provision** — Detailed rules about what is/isn not permitted (actors, actions, purposes, data classes, time periods)

### Contract Resource

For legally binding agreements beyond simple consent (BAAs, service agreements, provider contracts).

- Supports multiple signers with individual signature blocks
- signer[] — Each signer has type, party (reference), and signature (Signature datatype)
- legal[] — Legal text provisions of the contract
- legallyBindingAttachment — The executed contract document (signed PDF)

### Provenance Resource

Tracks who did what to which resource and when. Essential for audit trails.

- **target** — References to resources this provenance applies to
- **recorded** — When the activity was recorded
- **activity** — What happened (CREATE, UPDATE, VERIFY, etc.)
- **agent[]** — Who was involved (type: author/verifier/attester, who: reference)
- **signature[]** — Digital signatures using the FHIR Signature datatype
- **entity[]** — Source resources (role: source/revision/quotation/removal)

### DocumentReference Resource

For storing signed documents (PDFs, scanned forms, clinical notes).

- content[].attachment — The actual document (inline base64 or URL to Binary resource)
- authenticator — Reference to who authenticated the document
- context — Clinical context (encounter, period, related resources)
- securityLabel — Access control tags (e.g., restricted, normal, very-restricted)

---

## Implementation Patterns

### Pattern 1: Consent Capture (Flexpa Model)

1. Patient authenticates (IAL2 verified via ID.me)
2. App presents consent form ("I authorize sharing my records with MedScrub")
3. On acceptance: create Consent resource (status=active, scope=patient-privacy)
4. Attach signed consent PDF as sourceAttachment or reference a DocumentReference
5. Create Provenance linking the Consent to the patient and verification event
6. FHIR Subscription on Consent fires Bot to initiate data retrieval workflow

### Pattern 2: SOAP Note Attestation

1. Physician reviews AI-generated SOAP note in MedScrub workspace
2. Physician clicks "Sign & Attest" — captures digital signature (JWS or drawn signature)
3. Create DocumentReference with the SOAP note content + authenticator = Practitioner
4. Create Provenance with signature[] containing the JWS, agent = Practitioner, activity = attestation
5. Write back to EHR via DocumentReference.Create (Epic) or filing interface

### Pattern 3: Prior Authorization Signatures

1. MedScrub generates prior auth document from patient data
2. Physician reviews and signs (Contract resource with signer = Practitioner)
3. Store signed PDF as Binary, reference from Contract.legallyBindingAttachment
4. Submit to payer with Provenance chain proving identity → attestation → submission

---

## Medplum-Specific Features

- **Binary resource storage** — Upload signed PDFs, images, and documents. Medplum supports file:// (local) and S3 storage backends.
- **Bot-based PDF generation** — Create PDF documents (consent forms, SOAP notes, prior auths) server-side using Medplum Bots with pdfmake.
- **Subscription triggers** — Automatically fire workflows when Consent or DocumentReference resources are created/updated.
- **Access Policies** — Restrict who can read/write Consent and signature resources. Ensure only verified users can attest documents.
- **AuditEvent** — Medplum automatically creates AuditEvent resources for all CRUD operations, providing an immutable audit trail.

---

## Key References

- **FHIR Signature datatype:** [hl7.org/fhir/R4/datatypes.html#Signature](https://hl7.org/fhir/R4/datatypes.html#Signature)
- **Consent resource:** [medplum.com/docs/api/fhir/resources/consent](https://www.medplum.com/docs/api/fhir/resources/consent)
- **Contract resource:** [medplum.com/docs/api/fhir/resources/contract](https://www.medplum.com/docs/api/fhir/resources/contract)
- **Provenance resource:** [medplum.com/docs/api/fhir/resources/provenance](https://www.medplum.com/docs/api/fhir/resources/provenance)
- **Medplum Binary data docs:** [medplum.com/docs/fhir-datastore/binary-data](https://www.medplum.com/docs/fhir-datastore/binary-data)
- **Medplum PDF Bot example:** [github.com/medplum/medplum-demo-bots/src/create-pdf.ts](https://github.com/medplum/medplum/blob/main/examples/medplum-demo-bots/src/create-pdf.ts)
- **Flexpa consent model:** [flexpa.com/docs/guides/medplum](https://www.flexpa.com/docs/guides/medplum)