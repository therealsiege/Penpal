---
tags: [medhook, roadmap, planning]
created: 2026-03-08
---

# Roadmap

Current status and future plans for [[MedHook]].

## What's Built (MVP Complete)

### Engine ✅
- DAG-based workflow execution engine (graph-executor)
- 10 adapters: FHIR REST, Epic FHIR, Athena, Oracle, Medplum, Generic REST, SFTP, Webhook, MLLP, X12
- 8 transform types including HL7v2↔FHIR conversion
- Trigger system: manual, webhook, cron, polling, MLLP, FHIR subscription, X12
- Message filtering (Mirth-inspired AND/OR rules)
- Parallel + loop + condition node execution
- Sandboxed JavaScript execution (isolated-vm)
- AES-256-GCM credential encryption
- JWT authentication + middleware
- AI-assisted field mapping (Claude API)
- Prometheus metrics + Grafana dashboards
- Audit logging
- 8-service Docker Compose stack
- Terraform templates for AWS, Azure, GCP
- Unit + E2E test suites

### Web App ✅
- NextAuth.js with GitHub, Google, email providers
- License key system (SHA-256 hashed, one-time display)
- Analytics dashboard with 7-day trending
- Engine analytics webhook (HMAC-signed)
- Stripe billing scaffolding
- Admin panel
- Dark mode
- Desktop OAuth flow

### Desktop App ✅
- Docker stack lifecycle management
- Visual workflow designer (ReactFlow)
- OAuth authentication with medhook.dev
- License key fetch/validate
- Service monitoring (health, logs, metrics)
- Adapter profile management
- Undo/redo workflow editing
- Template gallery
- AI mapping modal
- Auto-updater
- macOS, Windows, Linux builds

### Infrastructure ✅
- GitHub Actions CI (type check + unit tests)
- Integration test script
- Security audit documented
- Comprehensive docs (Architecture, API, Deployment, Security)

## What's Next

### Immediate Priorities
- [ ] SSRF allowlist/denylist for Generic REST adapter (security H-1)
- [ ] Rate limiting on all critical engine endpoints (security H-2)
- [ ] License validation enforcement in production (security H-3)
- [ ] Stripe billing integration (UI wired, backend scaffolded)
- [ ] First beta deployment with a real customer

### Short-term (Next 2-3 Months)
- [ ] Reduce JWT expiry from 24h to 1-2h
- [ ] Content Security Policy headers
- [ ] Dependency scanning in CI (npm audit)
- [ ] ESLint + Prettier in CI pipelines
- [ ] Documentation content for /docs pages
- [ ] Playwright E2E tests in CI
- [ ] No-code visual transformation builder
- [ ] Advanced cron scheduling patterns
- [ ] Code table management UI polish

### Medium-term (3-6 Months)
- [ ] MFA (multi-factor authentication)
- [ ] IP allowlisting
- [ ] GraphQL API (endpoint exists, needs implementation)
- [ ] Performance benchmarking and load testing
- [ ] CI/CD deployment automation (auto-push to clouds)
- [ ] Pre-commit hooks and formatting enforcement
- [ ] Dependabot for automated dependency updates
- [ ] Advanced error recovery strategies
- [ ] Workflow versioning and rollback

### Long-term (6-12 Months)
- [ ] 10+ production deployments
- [ ] $5K+ MRR (break-even)
- [ ] Community growth (GitHub stars, open-source engagement)
- [ ] Additional EHR-specific adapters (Allscripts, NextGen, etc.)
- [ ] FHIR Bulk Data export/import
- [ ] Multi-region deployment guides
- [ ] Workflow marketplace (share/sell templates)
- [ ] SOC 2 Type II certification

## Business Milestones

| Milestone | Target |
|-----------|--------|
| First paying customer | Month 6 |
| 10+ active deployments | Month 12 |
| Break-even ($5K+ MRR) | Month 18 |
| 300+ GitHub stars | Month 12 |

## Sprint History

| Sprint | Date | Focus |
|--------|------|-------|
| Initial scaffolding | 2026-02-27 | Project setup, architecture |
| Desktop app design | 2026-02-27 | Electron app design + implementation |
| Desktop-engine gaps | 2026-03-03 | Auth, license, sandbox, SSE |
| 20-agent MVP sprint | 2026-03-03 | Wave 1-3: infra, billing, testing, docs, polish |

See `docs/plans/` in the repo for detailed sprint design documents.

## Related

- [[MedHook]]
- [[Competitive Landscape]]
- [[Security and Compliance]]
