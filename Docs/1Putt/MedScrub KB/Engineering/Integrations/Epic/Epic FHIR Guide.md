Created: February 17, 2026 12:22 AM
Tags: Epic, Research

### Docs

---

[Epic Implementing a Backend FHIR App](Epic%20FHIR%20Guide/Epic%20Implementing%20a%20Backend%20FHIR%20App%2030af3cf2487f812aba31c70affe617a2.md)

[Epic Filing Clinical Notes](Epic%20FHIR%20Guide/Epic%20Filing%20Clinical%20Notes%2030af3cf2487f818091a4ed49b1784079.md)

[Epic OAuth 2.0 Tutorial](Epic%20FHIR%20Guide/Epic%20OAuth%202%200%20Tutorial%2030af3cf2487f81369d7ed1f9b24ed478.md)

[Epic Bulk FHIR Data Access Tutorial](Epic%20FHIR%20Guide/Epic%20Bulk%20FHIR%20Data%20Access%20Tutorial%2030af3cf2487f81858321e694e60e99ad.md)

## Authentication (Backend OAuth 2.0 JWT)

Backend apps use private_key_jwt authentication. Create RSA/EC key pair, host public key at JWK Set URL. Epic verifies JWT signature against registered public key.

### JWT Claims

- iss: Client ID (from Epic App Orchard)
- sub: Client ID (same as iss)
- aud: Token endpoint URL (per organization)
- jti: Unique token identifier
- exp: Expiration (< 5 minutes from now)

### Key Details

- Supported algorithms: RS256, RS384, ES256, ES384
- Key rotation: add new key → transition → remove old key
- Token request: grant_type=client_credentials + client_assertion JWT

## FHIR Endpoints

- Public registry: https://open.epic.com/MyApps/EndpointsJson
- Small practices (hosted): https://epicproxy.et4001.epichosted.com/FHIRProxy/api/FHIR/
- FHIR R4 is primary (DSTU2 legacy)

## Bulk FHIR Data Access

- Only Group Export supported (not system-level)
- Format: ndjson | 14-day download window
- 24-hour default request frequency
- Max 1000 patients per group | Max 3000 resources per file
- Parameters: _type, _typeFilter, includeAssociatedData
- Auth: OAuth 2.0 (preferred) or HTTP Basic

## Writing Clinical Notes Back

### Method 1: DocumentReference.Create (FHIR)

Write plain text clinical notes to encounters. Simpler for SOAP notes. MedScrub's primary write-back method.

### Method 2: HL7v2 Incoming Transcriptions

TXA-2 document type mappings, encounter resolution via HL7v2 interface. More complex but supports richer document types.

### Method 3: HL7v2 MDM (Filing Documents)

For PDFs (base64 encoded). Gallery document management, DMS workflows.

## MedScrub Integration Status

- ✅ Epic: LIVE (SMART on FHIR + backend apps)
- ✅ Write-back: DocumentReference.Create for SOAP notes
- ✅ Bulk FHIR available for batch data sync