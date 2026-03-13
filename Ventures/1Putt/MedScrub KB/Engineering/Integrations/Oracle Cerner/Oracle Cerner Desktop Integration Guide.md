<aside>
🏥 Implementation guide for adding Oracle Cerner (Oracle Health) FHIR R4 integration to the MedScrub desktop app. Assumes working Epic and athenahealth integrations already exist. ~60-70% code reuse from Epic.

</aside>

Target API: Millennium FHIR R4 • JSON only • SMART on FHIR auth • ~25-30% US hospital market

---

# 1. Prerequisites

### Accounts & Registration

- CernerCare account (free) — identity system for developer portal
- Register app in code Console (successor to code.cerner.com) as System type, Confidential privacy
- Receive client ID immediately upon registration
- System account auto-created in Cerner Central — manage client secret and JWKS config there

### JWKS Setup

MedScrub already publishes JWKS at medscrub.ai/.well-known/jwks.json (same keypair used for Epic and athenahealth). Register this URL in Cerner Central for your system account.

```bash
# Verify your JWKS endpoint
curl https://medscrub.ai/.well-known/jwks.json | jq .
```

<aside>
✅ Same JWKS/keypair as Epic — no new key generation needed. Just register the URL in Cerner Central.

</aside>

### Key URLs

| Resource | URL |
| --- | --- |
| FHIR R4 Docs | https://docs.oracle.com/en/industries/health/millennium-platform-apis/mfrap/ |
| Auth Framework | https://docs.oracle.com/en/industries/health/millennium-platform-apis/millennium-authorization-framework/ |
| Open Sandbox | https://fhir-open.cerner.com/r4/ec2458f2-1e24-41c8-b71b-0e701af7583d/ |
| Secure Sandbox | https://fhir-ehr-code.cerner.com/r4/ec2458f2-1e24-41c8-b71b-0e701af7583d/ |
| Developer Forums | https://forums.oracle.com/ords/apexds/domain/open-developer-experience |

---

# 2. Authentication Setup

Oracle Health uses SMART on FHIR (v1 + v2) on OAuth 2.0 — same spec as Epic. For MedScrub's backend data sync, use SMART Backend Services (client credentials with JWT).

### Step 1: Discover Endpoints

Always discover auth endpoints dynamically (never hardcode):

```bash
GET {fhir-base-url}/.well-known/smart-configuration

# Response includes:
# authorization_endpoint, token_endpoint, revocation_endpoint
```

### Step 2: Build JWT Assertion

Identical JWT structure to Epic's backend services flow:

```jsx
// JWT Claims (same pattern as Epic)
{
  "iss": "<client_id>",        // Your Cerner client ID
  "sub": "<client_id>",        // Same as iss
  "aud": "<token_endpoint>",   // Discovered token endpoint
  "exp": <now + 5min>,
  "jti": "<unique-uuid>"       // Must be unique per request
}
// Sign with RS384 using your private key (same key as Epic/athena)
```

### Step 3: Request Token

```
POST {token_endpoint}
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials
&scope=system/Patient.read system/Encounter.read system/Condition.read system/Observation.read system/DocumentReference.read system/DocumentReference.write system/MedicationRequest.read system/AllergyIntolerance.read system/Procedure.read system/DiagnosticReport.read system/Binary.read
&client_assertion_type=urn:ietf:params:oauth:client-assertion-type:jwt-bearer
&client_assertion={signed_jwt}
```

<aside>
⚠️ Wildcard scopes (*) are NOT supported. You must explicitly list every resource scope.

</aside>

### Auth: Epic vs Cerner Comparison

| Aspect | Epic | Cerner |
| --- | --- | --- |
| Backend auth | JWT + private key | JWT + JWKS or client secret |
| Auth server | Per-Epic instance | Centralized (authorization.cerner.com) |
| Scope format | SMART v2 preferred | SMART v1 and v2 both work |
| Discovery | .well-known/smart-configuration | Same — .well-known/smart-configuration |
| Key registration | App Orchard | Cerner Central |

---

# 3. Sandbox Testing

Cerner provides both open (no-auth) and secured sandbox environments with the same tenant UUID.

Tenant ID: ec2458f2-1e24-41c8-b71b-0e701af7583d

### Open Sandbox (No Auth — Read Only)

```bash
# Quick smoke test
curl -H "Accept: application/fhir+json" \
  "https://fhir-open.cerner.com/r4/ec2458f2-1e24-41c8-b71b-0e701af7583d/Patient/12742400"

# Get capability statement
curl -H "Accept: application/fhir+json" \
  "https://fhir-open.cerner.com/r4/ec2458f2-1e24-41c8-b71b-0e701af7583d/metadata"

# Search patients
curl -H "Accept: application/fhir+json" \
  "https://fhir-open.cerner.com/r4/ec2458f2-1e24-41c8-b71b-0e701af7583d/Patient?_id=12742400" 
```

### Secured Sandbox (Auth Required — Read + Write)

- Provider/System: https://fhir-ehr-code.cerner.com/r4/ec2458f2-1e24-41c8-b71b-0e701af7583d/
- Patient: https://fhir-myrecord.cerner.com/r4/ec2458f2-1e24-41c8-b71b-0e701af7583d/
- Test patient IDs: 12742400, 12457977 (pre-loaded synthetic data)

<aside>
💡 Start with the open sandbox to validate your FHIR parsing. Then move to secured sandbox for auth + write-back testing.

</aside>

---

# 4. FHIR Resources to Implement

All resources use JSON only (no XML). Base URL pattern: https://fhir-ehr.cerner.com/r4/{tenant-uuid}/{Resource}

| Resource | Read | Search | Create | Update | Cerner-Specific Quirks |
| --- | --- | --- | --- | --- | --- |
| Patient | ✅ | ✅ | ✅ | PATCH | Rich search params. Must provide ≥1 search param always. |
| Encounter | ✅ | ✅ | ✅ | PATCH | Search by patient/subject. _count supported. |
| Condition | ✅ | ✅ | ✅ | PUT | Categories: problem-list-item, encounter-diagnosis. |
| Observation | ✅ | ✅ | ✅ | PUT | Vitals, labs, social history. Proprietary codes common. |
| DocumentReference | ✅ | ✅ | ✅ | PUT | Write-back supported! Has $docref operation. See Section 7. |
| MedicationRequest | ✅ | ✅ | ✅ | PATCH | Covers prescriptions/orders. |
| AllergyIntolerance | ✅ | ✅ | ✅ | PUT | Full CRUD. |
| Procedure | ✅ | ✅ | ✅ | ❌ | No update support. |
| DiagnosticReport | ✅ | ✅ | ✅ | ❌ | Lab + radiology reports. No update. |
| Binary | ✅ | ❌ | ❌ | ❌ | Read-only. Supports $autogen-ccd-if for CCD docs. |

### Key Quirks Across All Resources

- DataAbsentReason: Cerner returns data-absent-reason extensions for missing required fields (instead of null). Your parser MUST handle these.
- Security filtering: What a system account sees may differ from provider context. Encounter/org-level security filters data.
- entered-in-error masking: Patient-persona access masks these records with data-absent-reason: masked.
- Search always requires params: No unscoped searches — always provide patient or _id.
- HTTP method override: If PUT/PATCH blocked, use POST with X-HTTP-Method-Override header.

---

# 5. Code Reuse from Epic

<aside>
♻️ Estimated 60-70% of Epic FHIR code ports directly to Cerner.

</aside>

### Ports Directly (No Changes)

- FHIR R4 resource parsing/serialization (same spec, same JSON structure)
- SMART on FHIR auth flow logic (same spec, different endpoint URLs)
- DocumentReference write-back structure (same resource type)
- Patient matching / search logic
- General FHIR search patterns (_id, patient, _lastUpdated)
- JWT signing logic (same JWKS keypair, same algorithm)
- Token refresh / caching patterns

### Needs Adaptation

- Tenant ID management: UUID-based path segment vs Epic's host-based routing
- Auth endpoint discovery: Centralized authorization.cerner.com vs per-site Epic instances
- Proprietary code mapping layer: NEW — biggest piece of new work (see Section 6)
- DataAbsentReason handling: Add extension parsing for missing fields
- Remove XML support: Cerner is JSON-only
- DocumentReference.type coding: Must use LOINC OR proprietary codes, not both
- Per-site config model: Store tenant UUID + production FHIR URL per customer

### Suggested Architecture

```tsx
// Abstract base class (shared)
class FHIRIntegration {
  abstract getBaseUrl(): string;
  abstract getTokenEndpoint(): string;
  abstract mapCodes(resource: FHIRResource): FHIRResource;
  
  // Shared: auth, search, parse, serialize
  async authenticate() { /* JWT + SMART backend services */ }
  async searchResource(type: string, params: Record<string, string>) { ... }
  parseResource(json: any): FHIRResource { ... }
}

// Epic implementation
class EpicIntegration extends FHIRIntegration { ... }

// Cerner implementation  
class CernerIntegration extends FHIRIntegration {
  tenantId: string;  // UUID per site
  getBaseUrl() { return `https://fhir-ehr.cerner.com/r4/${this.tenantId}`; }
  mapCodes(resource) { /* proprietary code mapping */ }
}
```

---

# 6. Proprietary Code System Mapping

<aside>
🚨 This is the #1 integration gotcha. Cerner heavily uses proprietary code sets that vary by tenant. Budget significant time for this.

</aside>

### The Problem

Cerner uses proprietary code sets with URIs like: https://fhir.cerner.com/{tenant-id}/codeSet/{number}

These codes are tenant-specific — the same clinical concept may have different codes at different health systems. Unlike Epic (which mostly uses standard terminologies), Cerner resources frequently include proprietary codes alongside or instead of LOINC/SNOMED/ICD-10.

### Common Code Sets You'll Encounter

| Code Set | Used For | Example |
| --- | --- | --- |
| Code Set 72 | Clinical event types (DocumentReference.type) | 2820507 = Admission Note Physician |
| Code Set 4 | Medication codes | Varies per tenant |
| Various | Observation categories, condition codes, etc. | Tenant-specific |

### Mitigation Strategy

- 1. Always prefer standard codes: When a resource includes both LOINC/SNOMED and proprietary codes, use the standard code.
- 2. Build a CodeMapper service: Translates between standard terminologies and Cerner proprietary codes per tenant.
- 3. Cache code mappings: Query the tenant's metadata/ValueSet to discover code mappings, cache aggressively.
- 4. Fallback gracefully: If you encounter an unknown proprietary code, log it and surface the display text rather than failing.

```tsx
// Code mapping service
class CernerCodeMapper {
  private cache: Map<string, Map<string, string>>; // tenantId -> (cernerCode -> standardCode)
  
  async mapToStandard(tenantId: string, codeSetUri: string, code: string): Promise<string | null> {
    // Check cache first
    // If miss, query tenant's code set or use pre-built mapping table
    // Return LOINC/SNOMED/ICD-10 equivalent
  }
  
  async mapFromStandard(tenantId: string, standardSystem: string, code: string): Promise<string | null> {
    // For write-back: convert standard code to tenant's proprietary code
    // Required for DocumentReference.type when filing notes
  }
}
```

<aside>
⚠️ For DocumentReference.Create, you MUST use either LOINC codes OR proprietary Code Set 72 codes for the type field — never both together. Each tenant may require their specific codes.

</aside>

---

# 7. Write-back / DocumentReference.Create

Filing clinical notes back to Cerner is fully supported via DocumentReference.Create — critical for MedScrub's core value prop.

### Supported MIME Types

- application/pdf
- text/plain;charset=utf-8
- text/html;charset=utf-8
- text/richtext;charset=utf-8 / text/rtf;charset=utf-8
- application/xml;charset=utf-8 / application/xhtml+xml;charset=utf-8

### Example: File a Clinical Note

```json
{
  "resourceType": "DocumentReference",
  "status": "current",
  "docStatus": "final",
  "type": {
    "coding": [
      {
        "system": "https://fhir.cerner.com/{tenant-id}/codeSet/72",
        "code": "2820507",
        "display": "Admission Note Physician",
        "userSelected": true
      }
    ]
  },
  "subject": { "reference": "Patient/12457977" },
  "author": [{ "reference": "Practitioner/3332064" }],
  "content": [{
    "attachment": {
      "contentType": "application/pdf",
      "data": "<base64-encoded-pdf>",
      "title": "MedScrub Clinical Summary",
      "creation": "2026-02-21T15:00:00.000Z"
    }
  }],
  "context": {
    "encounter": [{ "reference": "Encounter/97987761" }],
    "period": {
      "start": "2026-02-21T14:00:00.000Z",
      "end": "2026-02-21T15:00:00.000Z"
    }
  }
}
```

### Write-back Rules

- type coding: Use LOINC OR proprietary Code Set 72 — not both
- docStatus: Provider context → 'final' only. System context → 'final' or 'amended'.
- author: Provider context → must be the authenticated provider (single). System context → multiple allowed.
- content: Only ONE content entry allowed. Must be base64-encoded.
- All dates must include time component.
- authenticator field: Only available with system access (optional).

---

# 8. Bulk Data / Sync Patterns

### Bulk FHIR Export

Cerner supports FHIR Bulk Data Export ($export) using SMART Backend Services auth. Supports Patient/$export and system-level $export. Returns NDJSON files. Supports _since for incremental exports.

### Incremental Sync (Recommended for MedScrub)

| Strategy | Best For | How |
| --- | --- | --- |
| Date-filtered search | Small/medium volume | Poll every 5-15 min with _lastUpdated=gt{last-sync-time} |
| Bulk $export + _since | Large volume / nightly | Run $export with _since param, process NDJSON |

<aside>
⚠️ No native webhooks or FHIR Subscriptions. No CDS Hooks equivalent. For real-time triggers, you'd need HL7v2 ADT feeds via the health system's Millennium integration team.

</aside>

---

# 9. Go-Live Checklist

No App Orchard equivalent — Cerner uses direct per-site enablement. Less formal review but each health system must independently enable your app.

### Per-Site Enablement Process

- [ ]  Register app in code Console → receive client ID
- [ ]  Configure JWKS in Cerner Central (medscrub.ai/.well-known/jwks.json)
- [ ]  Build & test against open sandbox
- [ ]  Build & test against secured sandbox (auth + write-back)
- [ ]  Build proprietary code mapping layer
- [ ]  Validate app using Oracle's validation tools/guidance
- [ ]  Engage target health system — they must enable your app on their tenant
- [ ]  Health system admin grants access, configures allowed scopes
- [ ]  Receive production FHIR base URL and tenant UUID from site
- [ ]  Run integration tests against production tenant
- [ ]  Go live!

### Timeline Estimates

| Phase | Duration |
| --- | --- |
| App registration + sandbox dev | 2-4 weeks |
| Integration build (with Epic code reuse) | 4-8 weeks |
| Validation & testing | 2-4 weeks |
| Per-site enablement | 2-6 weeks per site |
| Total first integration | ~3-5 months |

---

# 10. Key Differences from Epic — Quick Reference

| Aspect | Epic | Cerner |
| --- | --- | --- |
| FHIR Version | R4 | R4 (same) |
| Auth Standard | SMART on FHIR v1+v2 | SMART on FHIR v1+v2 (same) |
| Auth Server | Per-Epic instance | Centralized authorization.cerner.com |
| Tenant Identifier | Client ID + host-based URL | UUID in URL path |
| Base URL Pattern | https://{epic-host}/api/FHIR/R4/ | https://fhir-ehr.cerner.com/r4/{tenant-uuid}/ |
| Data Format | JSON + XML | JSON only |
| App Marketplace | App Orchard (formal review) | None — direct per-site enablement |
| Bulk FHIR | ✅ $export | ✅ $export |
| CDS Hooks | ✅ Native | ❌ Not via FHIR |
| FHIR Subscriptions | Limited | ❌ Not supported |
| DocumentReference Write | ✅ | ✅ |
| Proprietary Codes | Mostly standard terminologies | Heavy proprietary code sets (biggest pain point) |
| Search Behavior | Flexible | Requires ≥1 param always |
| Go-Live Timeline | 3-6 months (App Orchard) | 3-5 months (less review, more per-site variation) |
| Market Share | ~38% US hospitals | ~25-30% US hospitals |

---

<aside>
📚 Questions? Check Oracle Health docs: https://docs.oracle.com/en/industries/health/millennium-platform-apis/mfrap/ or the developer forums: https://forums.oracle.com/ords/apexds/domain/open-developer-experience

</aside>