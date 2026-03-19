> IAL2 identity proofing, electronic signatures, consent capture, and document attestation using FHIR resources. Based on the Flexpa model.

**See also:** [Platform Overview](Platform%20Overview.md) | [Access Control](Access%20Control%20&%20Multi-Tenancy.md) | [FHIR Glossary](FHIR%20R4%20Glossary.md)

## IAL2 Identity Verification

### What Is IAL2?

NIST SP 800-63-3 Identity Assurance Level 2 — requires evidence of real-world identity through document verification and biometric comparison. Required by CMS for patient access to health records.

| Level | Description |
|-------|-------------|
| IAL1 | Self-asserted (email/password), no proofing |
| IAL2 | Government ID + selfie/biometric match — required for CMS Patient Access APIs |
| AAL2 | Multi-factor authentication (know + have/are) |

### The Flexpa + ID.me Model

Architecture for FHIR-based patient identity verification (Oct 2025):

1. Patient clicks "Connect my records"
2. **ID.me verification (IAL2)** — gov ID + selfie → verified OIDC token with IAL2 claim
3. **Flexpa consent + data retrieval** — patient selects health plan, authenticates, consents → Flexpa retrieves claims via CMS Patient Access APIs
4. **Medplum CDR storage** — FHIR data loaded via `$everything` + batch transactions
5. **Provenance tracking** — each imported resource gets Provenance record

### Implementation Options

**Option A: ID.me as External Identity Provider**
- Configure ID.me as external OIDC provider in Medplum
- ID.me returns verified claims (name, DOB, address, SSN last 4)
- Map to FHIR Patient fields
- Store verification level as Patient.identifier with ID.me OID
- Create Provenance documenting verification event

**Option B: Custom Verification Bot**
- Bot receives patient registration webhook
- Bot calls ID.me API (or Persona, Jumio, Onfido)
- On success: update Patient with verified demographics
- Create Provenance with agent (verifier), target (Patient)
- Fire Subscription for downstream workflows

### FHIR Resources for Identity

| Resource | Purpose |
|----------|---------|
| Patient | Core demographics, verified fields, verification identifiers |
| Provenance | Audit trail — who verified what, when |
| Consent | Patient consent for data sharing |
| VerificationResult | Verification outcome recording (status, type, process, source) |
| DocumentReference | Store verification documents (ID scans) as Binary attachments |

---

## Document Signatures & Digital Consent

### FHIR Signature Datatype

Foundation for digital signatures in FHIR. Attachable to Bundle, Contract, Provenance.

| Field | Description |
|-------|-------------|
| `type` | Reason for signature (e.g., Author signature) |
| `when` | Timestamp |
| `who` | Signer reference (Patient, Practitioner, RelatedPerson) |
| `data` | Base64-encoded content (JWS, XML-DSig, or wet signature image) |
| `targetFormat` | MIME type of what was signed |
| `sigFormat` | MIME type of signature itself |

### Key FHIR Resources

**Consent** — Patient consent decisions
- status: draft | proposed | active | rejected | inactive
- scope: patient-privacy | research | treatment | advance-directive
- provision: detailed rules (actors, actions, purposes, data classes, time periods)

**Contract** — Legally binding agreements (BAAs, service agreements, provider contracts)
- Multiple signers with individual signature blocks
- Legal text provisions
- Executed contract document (signed PDF)

**Provenance** — Who did what to which resource and when
- target, recorded, activity, agent[], signature[], entity[]

**DocumentReference** — Storing signed documents (PDFs, scanned forms, notes)
- content[].attachment, authenticator, context, securityLabel

### Implementation Patterns

**Pattern 1: Consent Capture (Flexpa Model)**
1. Patient authenticates (IAL2 via ID.me)
2. Present consent form
3. Create Consent resource (status=active, scope=patient-privacy)
4. Attach signed PDF as sourceAttachment
5. Create Provenance linking Consent to patient + verification event
6. Subscription fires Bot to initiate data retrieval

**Pattern 2: SOAP Note Attestation**
1. Physician reviews AI-generated SOAP note
2. "Sign & Attest" captures digital signature (JWS or drawn)
3. Create DocumentReference + authenticator = Practitioner
4. Create Provenance with signature[], agent = Practitioner
5. Write back to EHR via DocumentReference.Create

**Pattern 3: Prior Authorization Signatures**
1. Generate prior auth document from patient data
2. Physician reviews and signs (Contract with signer = Practitioner)
3. Store signed PDF as Binary, reference from Contract.legallyBindingAttachment
4. Submit to payer with Provenance chain

### Medplum-Specific Features

- **Binary resource storage** — signed PDFs, images; S3 backend
- **Bot-based PDF generation** — server-side PDF creation with pdfmake
- **Subscription triggers** — auto-fire workflows on Consent/DocumentReference changes
- **Access Policies** — restrict Consent/signature resource access
- **AuditEvent** — immutable audit trail for all CRUD operations
