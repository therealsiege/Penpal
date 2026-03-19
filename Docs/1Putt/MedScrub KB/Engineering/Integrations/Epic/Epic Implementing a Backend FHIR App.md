## Overview

Backend FHIR apps run without user interaction — perfect for MedScrub's server-to-server data sync. Uses OAuth 2.0 client_credentials grant with private_key_jwt authentication.

## Information to Send to Customer

- Non-production and Production Client IDs
- JWK Set URL hosting your public keys
- List of FHIR resources your app needs access to
- For Bulk FHIR: high-level patient group criteria

## Information to Get from Customer

- FHIR base URL (their specific endpoint)
- Token endpoint URL (discoverable via .well-known/smart-configuration)
- For Bulk FHIR: Group FHIR IDs (customer runs utility to generate)

## Authentication Flow

1. Create JWT with claims: iss=clientId, sub=clientId, aud=tokenEndpoint, jti=unique, exp=<5min

2. Sign JWT with private key (RS256/RS384/ES256/ES384)

3. POST to token endpoint: grant_type=client_credentials, client_assertion_type=urn:ietf:params:oauth:client-assertion-type:jwt-bearer, client_assertion=JWT

4. Receive access_token (default 5 min expiry for backend apps)

5. Use access_token as Bearer token in FHIR API calls

## Key Setup Requirements

- Host JWK Set URL (HTTPS, publicly accessible)
- Register app on Vendor Services with Backend Systems user type
- Select Incoming APIs your app needs
- Customer must authorize your app for specific resource types + patient groups

## Key Rotation

- Add new key to JWK Set URL
- Transition your code to use new key
- Remove old key from JWK Set URL
- No downtime — multiple keys can coexist

## MedScrub Status

- ✅ Backend FHIR app registered and LIVE
- ✅ JWK Set URL hosted at medscrub.ai
- ✅ OAuth 2.0 client_credentials working