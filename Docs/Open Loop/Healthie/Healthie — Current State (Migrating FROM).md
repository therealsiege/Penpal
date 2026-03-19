> OpenLoop's current EHR and practice management platform. API-first, GraphQL-based, proprietary data model.

**See also:** [Technical Deep Dive](Technical%20Deep%20Dive.md) | [Capability Mapping](Capability%20Mapping.md) | [Data Migration](Data%20Migration.md) | [FHIR Glossary](FHIR%20R4%20Glossary.md)

## Platform Summary

| Attribute         | Value                                              |
| ----------------- | -------------------------------------------------- |
| Providers         | 40,000+                                            |
| Monthly API calls | 400M+                                              |
| Response time     | 300–500ms average                                  |
| Uptime            | 99.9%+                                             |
| Founded           | 2015                                               |
| Stack             | Ruby/Postgres/React/React Native                   |
| Hosting           | Aptible + AWS                                      |
| API               | GraphQL (200+ queries, 150+ mutations, 300+ enums) |
| Rate limits       | 250 RPS standard, 1000 RPS with dedicated DB       |

## Core Capabilities Used by OpenLoop

- Patient management & charting
- Scheduling & appointments
- Forms & intake
- Chat/messaging
- Lab orders & results
- E-prescribe (DoseSpot)
- Billing & insurance (claims, CMS-1500)
- Documents & notes
- Care plans
- White-label settings
- Webhooks
- Food/nutrition tracking

## Developer Tools

| Tool | Details |
|------|---------|
| API Docs | https://docs.gethealthie.com |
| GraphQL Schema | 321KB reference (200+ queries, 150+ mutations) |
| Chat SDK | `@healthie/chat` — real-time messaging components |
| Forms SDK | `@healthie/sdk` — dynamic form rendering |
| Booking SDK | `@healthie/sdk` — calendar and packages |
| MCP Tool | https://github.com/healthie/healthie-dev-assist |

## Compliance

- HIPAA (BAA available)
- SOC 2
- PIPEDA, GDPR, PCI

## Strengths

- Proven scale — 400M+ monthly API calls, enterprise-grade
- API maturity — same API used by Healthie's own frontend
- White-label support — full headless implementation
- 5 hours/month dedicated Solutions Engineer support
- All major certifications in place

## Migration Drivers (Why Move Away)

- **No native FHIR** — proprietary GraphQL only, no interoperability standard
- **Closed API** — access restricted to Enterprise/Group plans
- **Vendor lock-in** — proprietary schema vs. industry-standard FHIR
- **Enterprise client requirements** — healthcare systems increasingly require FHIR R4
- **E-prescribe limitations** — DoseSpot via Healthie vs. native EPCS in Medplum

## Key Reference URLs

See [All Links — Healthie](References.md#healthie-current-state) for consolidated URLs.
