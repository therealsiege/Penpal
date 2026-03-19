## POST /oauth2/v1/token

The OAuth token endpoint obtains access tokens. 2-legged OAuth (MedScrub) calls directly; 3-legged must first call authorize endpoint.

## 2-Legged Token Generation (MedScrub)

### Using JWKS (MedScrub's method)

JWT Claims required: aud (token endpoint URL), exp (<1hr, epoch seconds), iss (client ID), sub (client ID). Sign with RS256.

```bash
# Generate JWT assertion
JWT=$(node generate-jwt.js)

# Request token
curl -X POST "https://api.preview.platform.athenahealth.com/oauth2/v1/token" \
  -H "Accept: application/json" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials" \
  -d "scope=athena/service/Athenanet.MDP.*" \
  -d "client_assertion_type=urn:ietf:params:oauth:client-assertion-type:jwt-bearer" \
  -d "client_assertion=$JWT"
```

### Token Endpoints

- Preview: https://api.preview.platform.athenahealth.com/oauth2/v1/token
- Production: https://api.platform.athenahealth.com/oauth2/v1/token

## Token Response (2-legged)

```json
{
  "access_token": "bSQeVaRd47Tnof8GWbDZTud9ghLP",
  "expires_in": "300"
}
```

Default expiry: 60 minutes (both 2-legged and 3-legged). Use as Bearer token in subsequent API requests.

## Using the Access Token

```bash
curl "https://api.preview.platform.athenahealth.com/v1/{practiceid}/ping" \
  -H "Authorization: Bearer {access_token}"
```

## JWT Construction (Node.js)

```jsx
const njwt = require("njwt");
const fs = require("fs");
const privateKey = fs.readFileSync("private.pem");
const clientId = "0oa10wpw6enBVODk3298"; // MedScrub
const now = Math.floor(new Date().getTime() / 1000);
const expire = new Date((now + 300) * 1000);

const claims = {
  aud: "https://api.preview.platform.athenahealth.com/oauth2/v1/token",
};

const jwt = njwt
  .create(claims, privateKey, "RS256")
  .setHeader("kid", "<key-id>")
  .setIssuedAt(now)
  .setExpiration(expire)
  .setIssuer(clientId)
  .setSubject(clientId)
  .compact();
```