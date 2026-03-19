---
tags: [medhook, api, reference, technical]
created: 2026-03-08
---

# API Reference

[[MedHook]] exposes APIs from two components: the [[Engine]] (self-hosted, JWT auth) and the [[Web App]] (SaaS, NextAuth sessions).

## Engine API

**Base URL:** `http://localhost:3000` (configurable)
**Auth:** `Authorization: Bearer <jwt_token>`
**Token:** `POST /api/auth/token` with `ENGINE_AUTH_SECRET`

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/token` | Get JWT token (rate limited) |

### Health & Diagnostics

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check (Redis, Postgres, license status) |
| GET | `/api/metrics` | Prometheus-format metrics |

### Workflow Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/workflows` | List all workflows |
| POST | `/api/workflows` | Create workflow |
| GET | `/api/workflows/:id` | Get workflow details |
| PUT | `/api/workflows/:id` | Update workflow |
| DELETE | `/api/workflows/:id` | Delete workflow |
| GET | `/api/workflows/templates` | List workflow templates |

### Execution

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/workflows/:id/execute` | Start execution |
| GET | `/api/executions/:id` | Get execution status |
| GET | `/api/executions/:id/logs` | Get execution logs |
| GET | `/api/executions/:id/stream` | SSE live stream |
| POST | `/api/executions/:id/cancel` | Cancel execution |

### Adapters

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/adapters` | List available adapter types |
| GET | `/api/adapters/:type` | Get adapter config schema |

### Adapter Profiles

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/adapter-profiles` | List profiles |
| POST | `/api/adapter-profiles` | Create profile |
| GET | `/api/adapter-profiles/:id` | Get profile |
| PUT | `/api/adapter-profiles/:id` | Update profile |
| DELETE | `/api/adapter-profiles/:id` | Delete profile |
| POST | `/api/adapter-profiles/:id/test` | Test connection |

### AI Mapping

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ai/suggest-mapping` | Claude-powered field mapping suggestions |

### System

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/batch` | Batch operations |
| GET | `/api/audit-logs` | Audit trail |

---

## Web App API

**Base URL:** `https://medhook.dev`
**Auth:** NextAuth.js session cookies (most routes) or license key (validation)

### License Management

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/user/keys` | Session | List user's license keys |
| POST | `/api/user/keys` | Session | Create new key (returns full key once) |
| DELETE | `/api/user/keys?id={id}` | Session | Revoke key (soft delete) |
| POST | `/api/license/validate` | None | Validate key (used by engine) |

### User

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/user/profile` | Session | Get user info |
| GET | `/api/user/usage` | Session | Usage stats + 7-day history |
| GET | `/api/user/accounts` | Session | List linked accounts |

### Analytics

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/analytics/sync` | License + HMAC | Webhook for engine metrics |

### Billing

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/billing/checkout` | Session | Create Stripe checkout session |
| GET | `/api/billing/portal` | Session | Stripe customer portal URL |
| POST | `/api/billing/webhook` | Stripe sig | Stripe event handler |

### Desktop Integration

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/desktop/token` | Session | Generate JWT for desktop |
| GET/POST | `/api/auth/desktop/keys` | Session | Desktop API key management |
| GET | `/api/desktop/releases` | None | App version info |

### Admin

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/admin/users` | ADMIN role | List all users |

## Error Response Format

```json
{
  "error": "Error description",
  "code": "ERROR_CODE",
  "details": {}
}
```

## Rate Limits

- **Engine auth:** Token bucket rate limiter
- **Web App authenticated:** 100 req/min
- **Web App unauthenticated:** 20 req/min

## Related

- [[Engine]]
- [[Web App]]
- [[Adapters]]
