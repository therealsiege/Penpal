---
tags: [medhook, adapters, integrations]
created: 2026-03-08
---

# Adapters

The [[Engine]] ships with 10 adapters for connecting to healthcare systems. All extend the `BaseAdapter` abstract class with `read()`, `write()`, `testConnection()`, and a Zod config schema.

This is a massive expansion from [[Retrohook]] which only supported MLLP inbound and HTTPS/S3/Snowflake outbound.

## Adapter Registry

Adapters are registered on engine startup via `init-adapters.ts` into a global singleton registry. The workflow designer queries `/api/adapters` to list available types and their config schemas.

## Full Adapter List

### FHIR Adapters (4)

#### FHIR REST (`fhir-rest`)
- **Purpose:** Connect to any FHIR R4 server
- **Auth:** Basic, Bearer, OAuth2
- **Actions:** read, search, create, update
- **SSRF protection** on all outbound URLs

#### Epic FHIR (`epic-fhir`)
- **Purpose:** Epic EHR via FHIR R4 Backend Services
- **Auth:** JWT Bearer (private key + client ID)
- **Environments:** VendorServices, Sandbox, Production
- **Actions:** search-patients, get-patient-summary, discover-patients, search, read, write-document
- **Config:** privateKeyPEM, keyId, clientId, tokenUrl, fhirBaseUrl

#### Athena FHIR (`athena-fhir`)
- **Purpose:** Athena EHR via FHIR R4
- **Auth:** Bearer token
- **Actions:** Standard FHIR read/search/write

#### Oracle FHIR (`oracle-fhir`)
- **Purpose:** Oracle Health (Cerner) via FHIR R4
- **Auth:** Basic or Bearer
- **Actions:** Standard FHIR operations

### General Purpose (3)

#### Generic REST (`generic-rest`)
- **Purpose:** Any REST API
- **Auth:** Basic, Bearer, API Key
- **Actions:** GET, POST, PUT, DELETE, PATCH
- **Config:** baseUrl, headers, authentication
- **SSRF protection** on all URLs

#### SFTP (`sftp`)
- **Purpose:** File-based integrations
- **Auth:** Password or Private Key (with passphrase)
- **Actions:** download, upload, list, delete
- **Use cases:** Flat file drops, CSV imports/exports

#### Webhook Receiver (`webhook`)
- **Purpose:** Accept inbound HTTP requests
- **Auth:** Header validation, query param, HMAC signature
- **Actions:** Receive POST, return custom response
- **Use cases:** Incoming events from external systems

### Healthcare Protocols (3)

#### MLLP Outbound (`mllp`)
- **Purpose:** Send HL7v2 messages over TCP
- **Protocol:** MLLP framing (VT 0x0B ... FS 0x1C + CR 0x0D)
- **Actions:** send (write-only)
- **Returns:** Parsed ACK/NAK response with MSA segment
- **Config:** host, port, timeout
- See also: [[MLLP Server]] for inbound

#### X12 EDI (`x12`)
- **Purpose:** Parse and generate X12 EDI transactions
- **Supported:** 837 (claims), 835 (remittance), 270/271 (eligibility)
- **Actions:** parse, generate
- **Source:** SFTP polling or webhook upload

#### Medplum (`medplum`)
- **Purpose:** Medplum open-source FHIR server
- **Auth:** API token
- **Actions:** Standard FHIR operations
- **Use case:** Local FHIR server bundled in engine Docker stack

## Adapter Profile Model

Profiles store connection credentials per adapter:

```typescript
interface AdapterProfile {
  id: string
  name: string
  adapterType: string       // e.g., 'epic-fhir'
  config: Record<string, any>  // Encrypted with AES-256-GCM
  userId: string
  organizationId?: string
  createdAt: Date
}
```

All credentials are **encrypted at rest** using AES-256-GCM. See [[Security and Compliance]].

## Adding New Adapters

1. Create directory under `engine/src/adapters/{name}/`
2. Implement `BaseAdapter` with `read()`, `write()`, config schema
3. Register in `engine/src/lib/init-adapters.ts`
4. Adapter auto-appears in UI via `/api/adapters` endpoint

## Related

- [[Engine]]
- [[MLLP Server]]
- [[API Reference]]
- [[Security and Compliance]]
