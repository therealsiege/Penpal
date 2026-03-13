<aside>
⚠️ ⚠️ BREAKING CHANGE (May 2026): All backend OAuth 2.0 apps MUST host public keys at a JWK Set URL. Static keys no longer supported.

</aside>
## Sandbox Configuration

- FHIR R4 endpoint: https://vendorservices.epic.com/interconnect-amcurprd-oauth/api/FHIR/R4
- Sample App Client ID: e3073934-68c1-4ca7-9b59-3d8b934187f1
- OpenID Connect issuer: replace /api/FHIR/R4 with /oauth2

## OAuth 2.0 Workflows

### SMART App Launch (UI-based)

- Standalone Launch: App initiates login → Epic login screen
- EHR Launch: Epic launches app with patient/encounter context, no re-auth

### Backend OAuth 2.0 (MedScrub)

- For apps pulling data without user interaction
- Uses private_key_jwt authentication with JWK Set URL

## Authentication Methods

- private_key_jwt (RECOMMENDED) — asymmetric crypto, no secret distribution, keys reusable across customers
- client_secret_basic/post — simpler but requires separate secrets per install
- none — only for apps launching without SSO

## private_key_jwt Benefits

- Never distribute your private key
- Keys reusable across Epic community members (cloud-based apps)
- Easy key rotation via JWK Set URL
- Preferred over mutual TLS (application layer vs transport layer)

## Launch Context Tokens

Returned in OAuth 2.0 token endpoint response:

- patient → Patient.Read — patient chart open during launch
- encounter → Encounter.Read — visit open during launch
- location → Location.Read — current patient location
- loginDepartment → Location.Read — provider's logged-in department
- appointment → Appointment.Read — scheduled appointment for current visit

## Deployment Architecture

### Cloud-Based (MedScrub)

- Single domain, different URL paths per community member
- Single private key + JWKS URL shared across customers

### On-Premises

- Different subdomains per community member
- Unique private keys + JWKS URLs per customer

## Client IDs & Scopes

- Two client IDs: non-production + production (used across all installs)
- SMART v1 scopes: .read and .write
- SMART v2 scopes (Nov 2024+): CRUDS syntax (.c, .r, .u, .d, .s)
- Scopes based on Incoming APIs configured on app page