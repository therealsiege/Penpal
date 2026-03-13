---
tags: [medhook, webapp, saas]
created: 2026-03-08
---

# Web App

The SaaS platform at **medhook.dev**. Handles user accounts, license key management, analytics from engine deployments, and billing.

**Stack:** Next.js 14 + Neon Postgres + Prisma + NextAuth.js + Stripe + Resend
**Deployed:** Vercel (US East, iad1 region)

## Pages

### Public
- **Landing** (`/`) — Hero, feature showcase, CTA
- **Pricing** (`/pricing`) — 3 tiers: Nonprofit (free), Credit Bundles ($299+), Enterprise
- **Docs** (`/docs`) — Documentation hub
- **About** (`/about`) — Company info
- **Contact** (`/contact`) — Contact form
- **Login/Signup** — NextAuth.js with GitHub, Google, and magic link email

### Dashboard (Authenticated)
- **Overview** (`/dashboard`) — Quick stats, 7-day analytics charts, usage bar
- **API Keys** (`/dashboard/api-keys`) — Create/revoke license keys
- **Billing** (`/dashboard/billing`) — Plan info, credits, upgrade links
- **Engine** (`/dashboard/engine`) — Self-hosted deployment guide
- **Settings** (`/dashboard/settings`) — Profile management
- **Onboarding** (`/dashboard/onboarding`) — Setup wizard

### Admin
- **Admin Panel** (`/admin`) — User management (ADMIN role required)

## License Key System

This is the connection between the web app and [[Engine]]:

- **Format:** `mdh_live_{32_hex_chars}` (production) or `mdh_test_{32_hex_chars}` (test)
- **Storage:** Only the SHA-256 hash is stored in the database
- **Full key shown once** at creation, then masked
- **Validation:** Engine sends key → web app hashes → looks up → returns plan info
- **Revocation:** Soft delete (set `revokedAt`), engine immediately denied

## Authentication

- **Session:** JWT with 30-day expiration
- **Providers:** GitHub OAuth, Google OAuth, Email magic links (via Resend)
- **Adapter:** PrismaAdapter for persistence
- **Desktop OAuth:** Custom `medhook://` protocol callback flow

## Analytics Sync

The [[Engine]] sends usage metrics to the web app via webhook:

```
POST /api/analytics/sync
Headers: X-Webhook-Signature (HMAC-SHA256)
Body: { licenseKey, timestamp, metrics: { workflows, successes, failures, duration, adapterCalls } }
```

Dashboard displays 7-day trending charts for workflow volume, execution time, and success rate.

## Database Schema

| Table | Purpose |
|-------|---------|
| `User` | Accounts with plan, credits, role (USER/ADMIN) |
| `License` | SHA-256 hashed keys with environment and revocation |
| `AnalyticsRecord` | Daily aggregated metrics per license |
| `Account` | NextAuth OAuth provider links |
| `Session` | JWT session data |
| `VerificationToken` | Email verification |

## Billing (Stripe)

- **Nonprofit:** Free tier
- **Credit Bundles:** $299+ (consumption-based)
- **Enterprise:** Custom pricing
- Routes: checkout, portal, webhook
- Status: Scaffolded, billing portal UI shows "coming soon"

## Security

- **Vercel headers:** X-Content-Type-Options, X-Frame-Options, CSP, HSTS (2-year)
- **Edge middleware:** Auth checks on protected routes
- **API validation:** Zod schemas, license format regex
- **Webhook verification:** HMAC-SHA256 for analytics sync

## Key Files

```
medhook.dev/src/lib/auth.ts                    — NextAuth configuration
medhook.dev/src/lib/prisma.ts                  — Database client
medhook.dev/src/lib/stripe.ts                  — Stripe integration
medhook.dev/src/lib/email.ts                   — Resend email service
medhook.dev/src/app/api/license/validate/       — License validation endpoint
medhook.dev/src/app/api/analytics/sync/         — Engine analytics webhook
medhook.dev/src/app/api/user/keys/              — License key CRUD
medhook.dev/prisma/schema.prisma               — Database schema
```

## Related

- [[Architecture]]
- [[Engine]]
- [[Desktop App]]
- [[API Reference]]
