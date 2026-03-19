---
tags: [medhook, security, hipaa, compliance]
created: 2026-03-08
---

# Security and Compliance

[[MedHook]] is built for healthcare — security and compliance are foundational, not afterthoughts. The self-hosted model means the customer controls their infrastructure and data, which simplifies HIPAA compliance.

## Encryption

### At Rest (AES-256-GCM)
- All adapter credentials encrypted before storage in Postgres
- **Algorithm:** AES-256-GCM (authenticated encryption with tamper detection)
- **Key derivation:** PBKDF2 with 100,000 iterations
- **Per-operation:** Random IV (12 bytes) + random salt (16 bytes)
- **Master key:** 64-character hex `ENCRYPTION_MASTER_KEY` environment variable
- **Implementation:** `engine/src/lib/encryption.ts`

### In Transit
- Engine API: JWT Bearer token authentication
- Web App: HTTPS (Vercel TLS)
- Desktop ↔ Web App: OAuth 2.0 over HTTPS
- Desktop token storage: Electron.safeStorage (platform-native encryption)

## Authentication

### Engine
- JWT tokens via `POST /api/auth/token`
- `ENGINE_AUTH_SECRET` for token signing
- Middleware validates JWT on all `/api/*` routes (except health and auth)
- Rate limiting: Token bucket algorithm

### Web App
- NextAuth.js with GitHub, Google, Email providers
- JWT sessions (30-day expiration)
- HMAC-SHA256 signature validation on analytics webhook

### Desktop
- OAuth 2.0 flow with `medhook://` custom protocol
- Tokens stored encrypted via Electron.safeStorage
- Auto-refresh on 401 responses

## Sandboxed Code Execution

Custom JavaScript transforms run in isolation:

- **Primary:** isolated-vm (full V8 isolate, 128 MB memory limit)
- **Fallback:** Node VM (if isolated-vm unavailable)
- **Timeouts:** 5 seconds for code, 1 second for expressions
- **No access to:** Node.js APIs, filesystem, network, process
- **Input:** Frozen (read-only) data objects

## SSRF Protection

- URL validation on all outbound HTTP requests from adapters
- Blocks requests to private/internal IP ranges
- `engine/src/lib/url-validator.ts`

## Audit Logging

- All workflow executions logged with full context
- Adapter operations tracked
- User actions recorded
- Stored in Postgres with 90-day retention
- Prometheus metrics for operational monitoring

## RBAC

- **Web App:** USER and ADMIN roles via NextAuth.js
- **Engine:** JWT-based access control
- **Desktop:** OAuth-authenticated, license-gated

## HIPAA Alignment

| Requirement | Status |
|------------|--------|
| Encryption at rest | ✅ AES-256-GCM |
| Encryption in transit | ✅ TLS/HTTPS |
| Audit logging | ✅ Full activity trail |
| Access control (RBAC) | ✅ Role-based |
| Self-hosted (data control) | ✅ Customer infrastructure |
| Session timeout | ⚠️ JWT 24h (recommended: 1-2h) |
| Multi-factor auth | ⚠️ Not yet implemented |
| IP allowlisting | ⚠️ Not yet implemented |
| BAA support | ⚠️ Process TBD |

## Security Audit Findings (2026-03-03)

### Fixed
- C-1: CORS wildcard → restricted
- C-2: JWT in query params → header-only

### Open (High Priority)
- H-1: SSRF protection needs allowlist/denylist for Generic REST adapter
- H-2: Rate limiting on all critical endpoints
- H-3: License validation enforcement in production
- H-4: Sensitive data in Oracle adapter logs

### Planned
- M-2: Content Security Policy headers
- L-2: Helmet.js security headers
- L-3: Dependency scanning in CI

## Web App Security Headers (Vercel)

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Strict-Transport-Security: max-age=63072000 (medhook.dev)
```

## Related

- [[Engine]]
- [[Web App]]
- [[Architecture]]
