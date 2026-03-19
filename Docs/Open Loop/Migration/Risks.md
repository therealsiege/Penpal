# Migration — Risk Register

> Identified risks for the Healthie → Medplum migration with likelihood, impact, and mitigations.

**See also:** [Phases](Phases.md) | [Data Migration](Data%20Migration.md) | [Architecture](Architecture.md)

---

## Risk Matrix

| ID | Risk | Likelihood | Impact | Severity | Phase |
|----|------|-----------|--------|----------|-------|
| R1 | Data loss or corruption during ETL | Medium | Critical | High | 1–2 |
| R2 | Patient visit disruption during dual-run | Low | Critical | High | 1–2 |
| R3 | FHIR data model gaps (Healthie features without FHIR equivalents) | High | Medium | High | 1 |
| R4 | Engineering team FHIR learning curve | High | Medium | High | 0–1 |
| R5 | Healthie API rate limits during bulk export | Medium | Medium | Medium | 1–2 |
| R6 | Medplum performance at OpenLoop scale (250K+ visits/mo) | Medium | High | High | 2 |
| R7 | Abstraction layer becomes too complex | Medium | High | High | 1–2 |
| R8 | Client integration breakage (API contract changes) | Medium | High | High | 2–3 |
| R9 | Compliance gap during transition (SOC 2, HIPAA) | Low | Critical | High | 0–3 |
| R10 | Healthie contract/timeline pressure | Medium | Medium | Medium | All |
| R11 | Provider network data sync (20K+ clinicians across tenants) | Medium | Medium | Medium | 1–2 |
| R12 | E-prescribe (EPCS) certification validation | Low | High | Medium | 1 |
| R13 | Scope creep and MVP definition (known org challenge) | High | Medium | High | All |

---

## Detailed Risk Analysis

### R1: Data Loss or Corruption During ETL

**Description:** Healthie → FHIR transformation introduces data errors. ID mapping breaks referential integrity. DateTime format mismatches. Coding misalignment.

**Mitigations:**
- Build comprehensive validation suite that runs after every ETL batch
- Cross-reference table for Healthie ID → FHIR ID mapping with bidirectional lookup
- Run ETL in dry-run mode first — validate without committing to Medplum
- Use Transaction bundles (atomic) for imports — all-or-nothing prevents partial states
- Keep Healthie data read-only (not deleted) until full validation completes
- Automated row-count reconciliation: Healthie record count vs. Medplum resource count

### R2: Patient Visit Disruption During Dual-Run

**Description:** During the dual-run period, providers might see stale or inconsistent data if sync between Healthie and Medplum falls behind.

**Mitigations:**
- Clear system-of-record designation per client (one system is authoritative, the other is read-only)
- No dual-write — writes go to the authoritative system only
- Cutover is per-client, not gradual (switch a client fully, don't split)
- Rollback plan: if Medplum fails for a client, revert to Healthie (requires data not deleted)

### R3: FHIR Data Model Gaps

**Description:** Healthie has features (food/nutrition tracking, some engagement tools) without direct FHIR R4 equivalents. Custom Healthie fields may not map cleanly.

**Mitigations:**
- Audit all Healthie features used by each client before migration (not all clients use all features)
- Use FHIR Extensions for OpenLoop-specific data (define StructureDefinitions)
- Deprioritize low-usage features (food tracking) — migrate what matters
- Document gaps explicitly — no surprises for clients or product team

### R4: Engineering Team FHIR Learning Curve

**Description:** ~40 engineers (primarily in Lima) know GraphQL/DynamoDB. FHIR R4 is a paradigm shift — different data model, different query language, different mental model.

**Mitigations:**
- Phase 0 training investment (FHIR fundamentals, Medplum SDK workshops)
- [FHIR Glossary](FHIR%20R4%20Glossary.md) designed specifically for this team
- MCP tools for AI-assisted development (both Healthie and Medplum)
- Small "tiger team" leads the migration — broader team learns by building features on Medplum
- Pair engineers with FHIR experience with new-to-FHIR engineers

### R5: Healthie API Rate Limits During Bulk Export

**Description:** Healthie's 250 RPS standard rate limit may throttle bulk data extraction, extending the migration timeline.

**Mitigations:**
- Request rate limit increase from Healthie (or use dedicated database tier at 1000 RPS)
- Stagger exports by client — don't try to export everything at once
- Implement exponential backoff and retry logic in the ETL pipeline
- Export during off-peak hours (nights/weekends)
- Cache/checkpoint exports — resume from where you left off

### R6: Medplum Performance at OpenLoop Scale

**Description:** Medplum is proven (Ro, Summer Health, CDC) but has not been validated at OpenLoop's specific load profile (250K+ monthly visits, 120+ tenants, 20K+ providers).

**Mitigations:**
- Load test in Phase 2 before broad rollout
- Medplum on ECS Fargate scales horizontally — configure auto-scaling
- Aurora PostgreSQL scales reads via replicas — configure for read-heavy workloads
- ElastiCache Redis reduces database load for search and session data
- Monitor with Datadog from day one — establish baselines in Phase 0
- Medplum team available on Discord for architecture review

### R7: Abstraction Layer Becomes Too Complex

**Description:** The abstraction layer between FHIR and the customer-facing API grows into a complex mapping layer that is hard to maintain and introduces bugs.

**Mitigations:**
- Start with one domain (scheduling) — validate the pattern before expanding
- Keep translations simple — 1:1 mappings where possible, not aggregations
- Use Medplum's built-in GraphQL support to reduce translation work
- Code-generate API types from FHIR StructureDefinitions where possible
- Review abstraction layer architecture at each phase gate

### R8: Client Integration Breakage

**Description:** Existing client integrations built against Healthie's API break when the backend switches to Medplum. Even through the abstraction layer, subtle behavior differences can surface.

**Mitigations:**
- Abstraction layer is the insulation — clients never talk to Medplum directly
- Contract testing: capture current Healthie API behavior, replay against abstraction layer
- Version the customer-facing API (v1 maintains Healthie parity, v2 adds FHIR capabilities)
- Client-by-client migration with dedicated QA per client
- Canary deployments — route a percentage of traffic to Medplum, compare responses

### R9: Compliance Gap During Transition

**Description:** During the dual-run period, audit trails, access controls, and data handling must remain HIPAA/SOC 2 compliant across both systems.

**Mitigations:**
- Medplum is SOC 2 Type II, HIPAA (BAA available) — no certification gap
- AuditEvent resources auto-generated by Medplum for all operations
- Access Policies enforce tenant isolation from day one
- Include Medplum infrastructure in OpenLoop's next SOC 2 audit scope
- Maintain Healthie's compliance posture until fully decommissioned

### R10: Healthie Contract/Timeline Pressure

**Description:** Healthie contract renewal timing or cost increases create pressure to migrate faster than quality allows.

**Mitigations:**
- Understand Healthie contract terms (renewal dates, termination notice periods)
- Negotiate Healthie contract extension if needed to avoid rushed migration
- Budget for dual-run period (paying for both platforms)

### R11: Provider Network Data Sync

**Description:** OpenLoop's 20K+ clinician network spans all clients. Keeping Practitioner data consistent across Medplum Projects is architecturally complex.

**Mitigations:**
- Provider data lives in the abstraction layer, not replicated per-tenant Project (see [Architecture](Architecture.md))
- Or: shared provider Project with read-only cross-references
- Provider data sync is a one-time design decision in Phase 0 — don't defer

### R12: EPCS Certification Validation

**Description:** Medplum is EPCS-certified, but OpenLoop needs to validate the specific e-prescribing workflow works for their use cases (replacing DoseSpot).

**Mitigations:**
- Test EPCS workflow in Phase 1 with pilot client
- Verify DEA registration and identity proofing requirements
- Validate pharmacy network connectivity
- Keep DoseSpot (via Healthie) as fallback until EPCS is validated

### R13: Scope Creep (Known Org Challenge)

**Description:** OpenLoop's engineering culture has documented struggles with scope creep and MVP definition. The migration could expand beyond what's needed.

**Mitigations:**
- Define "done" for each phase before starting (exit criteria in [Phases](Phases.md))
- Phase gates with explicit go/no-go decisions
- Migration backlog is separate from feature backlog — don't mix
- "New features on Medplum only" rule prevents dual-platform feature development
- Weekly migration-specific stand-up (not mixed with other priorities)
