# The Medplum Migration Guide: A Healthcare CTO's Playbook
**Lead Magnet Content - 1Putt Health**
**Version**: 1.0 | March 14, 2026

---

## INTRODUCTION: WHY THIS GUIDE MATTERS

If you're a healthcare technology leader evaluating Medplum, you're likely facing one of these challenges:

1. **Building a new EHR product** and choosing the right FHIR platform
2. **Migrating from legacy systems** (Epic, Cerner, Healthie, etc.) to a modern architecture
3. **Evaluating vendor options** (Canvas, Smile CDR, Google Cloud Healthcare API, etc.)
4. **Planning interoperability** to meet TEFCA and regulatory mandates

This guide answers the critical questions CTOs ask:

- What is Medplum, and when is it the right choice?
- What are the real migration pain points?
- How long does a Medplum migration actually take?
- What do we need to budget (team, time, cost)?
- How does it compare to alternatives?

---

## PART 1: MEDPLUM 101 FOR HEALTHCARE LEADERS

### What Makes Medplum Different

Medplum is not traditional EHR software. Here's the key distinction:

| Aspect | Traditional EHR (Epic, Cerner) | Medplum |
|--------|--------------------------------|---------|
| **What You Get** | Complete clinician UI + workflows | Backend only; you build the UI |
| **Who Should Use It** | Established practices, health systems | Developer teams, startups |
| **Customization** | Limited; vendor-driven roadmap | Unlimited; your codebase |
| **Time to "Usable"** | 2-3 years (implementation) | 3-6 months (MVP) |
| **Cost Model** | Licensing per provider/patient | Usage-based (storage, API calls) |
| **Interoperability** | Built-in but proprietary | FHIR-native (standards-based) |

**The Core Philosophy**: Medplum provides the healthcare data layer. You provide the clinical user experience.

### The Architecture

```
┌─────────────────────────────────┐
│  Your Custom UI (React, Vue, etc)
│  - Patient portal
│  - Provider dashboard
│  - Admin interfaces
└───────────────┬─────────────────┘
                │ REST APIs
┌───────────────▼─────────────────┐
│   Medplum Backend               │
│ - FHIR datastore                │
│ - Access control (AccessPolicy) │
│ - Automation (Bots)             │
│ - Webhooks (Subscriptions)       │
└───────────────┬─────────────────┘
                │
┌───────────────▼─────────────────┐
│   PostgreSQL Database           │
│   (HIPAA-compliant cloud or     │
│    on-premises)                 │
└─────────────────────────────────┘
```

---

## PART 2: MEDPLUM'S HIDDEN SUPERPOWERS (THAT MATTER FOR MIGRATION)

### 1. FHIR Bots: Serverless Healthcare Logic

**What They Are**: JavaScript functions that trigger on data changes

**Why They Matter for Migration**:
- Automate data transformation during migration
- Trigger validation checks on new data
- Integrate with external systems (labs, pharmacies, insurers)

**Real-World Migration Example**:
```javascript
// Bot: Transform legacy "visit_type" field to FHIR Encounter
addEventListener('Create', (event) => {
  const encounter = event.resource;

  // Map legacy values to FHIR standard codes
  const typeMapping = {
    'in_person': 'AMB', // ambulatory
    'telehealth': 'VR',  // virtual
    'hospital': 'IMP'    // inpatient
  };

  encounter.type = [{
    coding: [{
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: typeMapping[encounter.class]
    }]
  }];
});
```

**Cost Impact**: Bots are a paid feature on Medplum Hosted (~$1-2 per 10k invocations)

### 2. AccessPolicy: Fine-Grained Access Control

**Why It Matters**: Different from traditional role-based access

**Common Migration Challenge**: Your legacy system has roles like "Provider," "Nurse," "Billing." Medplum uses FHIR Compartments.

**Example AccessPolicy for Pediatric Practice**:
```json
{
  "resource": "AccessPolicy",
  "rule": [
    {
      "resource": "Patient",
      "action": "read",
      "condition": "user.isParentOf(Patient.id)"
    }
  ]
}
```

This allows a parent to see only their child's records—something difficult in traditional EHR systems.

### 3. SMART on FHIR: Third-Party App Integration

**Why It Matters**: Plug-and-play apps without rebuilding the EHR

**Migration Use Case**: You migrate from Healthie to Medplum; third-party scheduling apps continue working via SMART integration

**Developer Effort**: ~1-2 weeks per app vs. 3-4 weeks without SMART

### 4. Subscriptions (Webhooks): Real-Time Data Sync

**Why It Matters**: Push data to other systems without polling

**Migration Example**:
```
Patient created in Medplum
  → Webhook fired
  → Patient auto-synced to billing system
  → Invoice generated automatically
```

**Latency**: 100-500ms typical; good for most use cases but not real-time trading systems

---

## PART 3: THE 5 BIGGEST MEDPLUM MIGRATION PAIN POINTS

### Pain Point #1: Data Mapping to FHIR (40% of migration effort)

**The Problem**:
Your legacy system has a "Visit" table. FHIR uses "Encounter" resource with specific structure:

```
Legacy:
visit_id: 12345
patient_id: 999
visit_date: 2024-03-01
provider: "Dr. Smith"
diagnosis: "Hypertension"

Must map to FHIR Encounter:
{
  "resourceType": "Encounter",
  "id": "encounter-12345",
  "subject": { "reference": "Patient/999" },
  "period": { "start": "2024-03-01T09:00:00Z" },
  "participant": [{
    "individual": { "reference": "Practitioner/smith-123" }
  }],
  "diagnosis": [{
    "condition": { "reference": "Condition/hypertension-456" }
  }]
}
```

**The Hidden Challenge**: Data dependencies. You can't create Encounter without Patient and Practitioner existing first.

**Impact**:
- 6-12 weeks to map complex data models
- Requires healthcare domain knowledge
- Data validation errors cascade

**Mitigation Strategy**:
1. **Dependency Mapping** (Week 1-2): Create a graph of resource dependencies
2. **Pilot Migration** (Week 3-4): Migrate 100 patients, validate quality
3. **Refinement** (Week 5-6): Fix mapping logic based on pilot
4. **Full Migration** (Week 7-12): Bulk import remaining data

**Tools That Help**:
- Medplum CLI for data import
- Bulk FHIR API (NDJSON format)
- Custom Bots for transformation
- Conditional references for ID mapping

---

### Pain Point #2: FHIR Search Performance (30% of effort)

**The Problem**: Your legacy system's queries don't translate to FHIR search

**Legacy Query Example**:
```sql
SELECT * FROM visits
WHERE provider_id = 123
  AND visit_date BETWEEN '2024-01-01' AND '2024-03-31'
  AND diagnosis LIKE '%diabetes%'
ORDER BY visit_date DESC
```

**FHIR Equivalent**:
```
GET /Encounter?participant=Practitioner/123
&date=ge2024-01-01&date=le2024-03-31
&diagnosis=Condition?code=*diabetes*
&_sort=-date
&_count=100
```

**Medplum Constraints**:
- No custom search parameters (standard FHIR only)
- Chained searches limited to 2 levels deep
- Performance degrades with complex filters

**Real Cost**:
- Simple searches: OK
- Complex searches: May need application-level filtering
- Specialty-specific searches: May require custom Bots

**Mitigation**:
1. Use standard FHIR search parameters
2. Accept application-level post-filtering for complex queries
3. Build Bots to denormalize data if needed
4. Cache frequently-used searches in your app

**Benchmark**: Standard search queries execute in 50-200ms; complex chained searches in 500ms-2s

---

### Pain Point #3: Custom Workflows & Business Logic (25% of effort)

**The Problem**: Your workflows don't fit FHIR resources

**Example**:
Your orthopedic practice has a custom "Treatment Protocol" workflow:
1. Patient enters with injury
2. Auto-assign to protocol (conservative vs. surgical path)
3. Generate custom care plan
4. Track compliance

**FHIR Approach**:
- Injury = Condition resource
- Protocol = CarePlan resource
- Compliance tracking = Task resources
- Automation = Bots

**Medplum Limitation**: Can't create a custom "Protocol" resource type. Must extend CarePlan.

**Migration Effort**:
- Simple workflows: 2-4 weeks
- Complex specialty workflows: 8-12 weeks
- Very complex (multi-system orchestration): 12+ weeks

**Mitigation**:
1. **Use FHIR Extensions**: Add custom fields to standard resources
2. **Smart Bots**: Encapsulate business logic in automated workflows
3. **Custom Operations**: Define `$initiate-protocol` custom operation
4. **Accept Trade-offs**: Some specialized logic may require workarounds

---

### Pain Point #4: Authentication & User Management (20% of effort)

**The Problem**: Translating legacy roles/permissions to FHIR AccessPolicy

**Common Migration Scenarios**:

**Scenario A: Multi-location Practice**
```
Legacy: User "nurse_john" at "Location_1", can see all Patients at Location_1
FHIR: AccessPolicy must define "user.location == compartment.organization_id"
```

**Scenario B: Pediatric Practice (Parent Access)**
```
Legacy: Basic parent login; see child's records
FHIR: AccessPolicy must map "user.is_parent_of(patient.id)" to permissions
```

**Scenario C: Role-Based Transitions**
```
Legacy: "Provider" role → full access
FHIR: AccessPolicy must enumerate exact operations (read, write, delete, custom ops)
```

**Migration Effort**:
- Simple roles (provider, staff, patient): 2-4 weeks
- Complex role hierarchies: 4-8 weeks
- Special access patterns: 8+ weeks

**Medplum's Complexity**: AccessPolicy is powerful but requires learning FHIRPath expressions

**Mitigation**:
1. Start with simple AccessPolicies; add complexity incrementally
2. Use Medplum's pre-built templates
3. Test extensively with pilot users
4. Plan for 2-3 iterations before production

---

### Pain Point #5: Subscription Reliability & Latency (15% of effort)

**The Problem**: Webhooks (Subscriptions) are eventually consistent, not instant

**Real Scenario**:
Patient checks in → Encounter created → Webhook fires → Billing system updated → Invoice generated

**What Can Go Wrong**:
1. Webhook endpoint down → retry queue grows → data lag
2. Webhook takes 30s to process → real-time UI updates lag
3. Webhook fails silently → data inconsistency (requires manual reconciliation)

**Medplum Subscription Behavior**:
- Delivery latency: 100-500ms typical
- Retry logic: Exponential backoff (1s, 2s, 4s, 8s, 16s)
- Max retries: ~15 (before giving up)
- No guaranteed ordering (if 2 changes happen in quick succession)

**Impact**:
- Cannot use for real-time stock ticker-style updates
- Works fine for most healthcare workflows
- Not suitable for critical alerts without supplemental monitoring

**Mitigation**:
1. For critical workflows, poll as backup (e.g., every 30 seconds)
2. Implement idempotency in webhook receivers (handle duplicates)
3. Log all webhook events for audit trail
4. Set up monitoring/alerting for failed subscriptions
5. Use Websocket subscriptions for real-time apps (counts toward quota)

**Effort**: 2-4 weeks to design reliable subscription architecture

---

## PART 4: MIGRATION TIMELINE & BUDGET

### Typical Medplum Migration: 6-9 Months

**Phase 1: Planning & Design (4-6 weeks)**
- FHIR data mapping workshop
- Architecture design
- Pilot data validation
- Team training on FHIR/Medplum
- Estimated cost: 2-3 engineers x $200k/year = $8-12k

**Phase 2: Data Migration (8-12 weeks)**
- Build ETL pipelines (Bots, custom code)
- Migrate historical data (phased by business unit)
- Validation & quality checks
- Fix data inconsistencies
- Estimated cost: 3-4 engineers x $200k/year = $20-27k

**Phase 3: Integration & APIs (6-10 weeks)**
- Build custom UIs for key workflows
- Integrate external systems (labs, pharmacies)
- SMART on FHIR setup for third-party apps
- Testing (unit, integration, UAT)
- Estimated cost: 3-4 engineers x $200k/year = $20-27k

**Phase 4: Go-Live & Optimization (4-8 weeks)**
- Parallel run with legacy system
- Staff training
- Performance tuning
- Rollback procedures
- Estimated cost: 2-3 engineers x $200k/year = $8-12k

**Total Team Cost**: $56-78k (excluding management overhead)
**Infrastructure Cost**: $0-2k/month (Medplum Hosted or AWS self-hosted)
**Total Budget**: $100-150k for small-to-medium migration

### Timeline Comparison

| Migration Scenario | Timeline | Team Size | Budget |
|-------------------|----------|-----------|--------|
| Small startup (100 patients, simple workflows) | 3-4 months | 2 engineers | $30-40k |
| Mid-size practice (1k patients, standard workflows) | 6-9 months | 3-4 engineers | $80-120k |
| Large health system (100k patients, complex) | 12-18 months | 5-7 engineers | $300-500k |

---

## PART 5: MEDPLUM VS. COMPETITORS: DECISION MATRIX

### Quick Comparison: 5-Minute Overview

**Medplum is best if you:**
- Have a strong technical team
- Prioritize long-term flexibility
- Want open-source control
- Have a reasonable timeline
- Are building a novel EHR (not standard practice management)

**Canvas Medical is best if you:**
- Need faster go-to-market
- Want pre-built specialty workflows
- Have less technical resources
- Are willing to pay $4k/month

**Healthie is best if you:**
- Run a telehealth/virtual-first practice
- Need scheduling + billing out-of-box
- Want simpler setup
- Serve solo practices or group practices

**Smile CDR is best if you:**
- Are a large health system or payer
- Need enterprise SLAs and support
- Run massive scale (billions of resources)
- Can afford $50k+/month licensing

**Google Cloud Healthcare API is best if you:**
- Are a Google Cloud customer
- Need native BigQuery + AI/ML integration
- Want fully managed service
- Can accept vendor lock-in

### Head-to-Head Comparison: Top Concerns

| Concern | Medplum | Canvas | Healthie | Smile CDR |
|---------|---------|--------|----------|-----------|
| **Time to first patient** | 3-6 months | 1-2 months | 1 month | 2-3 months |
| **Cost to launch** | $80-120k | $120-200k | $50-80k | $200-400k |
| **Ongoing monthly cost** | $2-5k | $4-8k | $3-5k | $50k+ |
| **Customization flexibility** | 10/10 | 7/10 | 6/10 | 5/10 |
| **FHIR interoperability** | 10/10 | 7/10 | 8/10 | 10/10 |
| **Pre-built workflows** | 0/10 | 8/10 | 8/10 | 5/10 |
| **Learning curve** | Steep | Moderate | Easy | Moderate |
| **Vendor lock-in** | Low | High | High | Very High |

---

## PART 6: MIGRATION SUCCESS CHECKLIST

### Pre-Migration Assessment (Before You Commit)

- [ ] **Technical Readiness**
  - [ ] Team has Node.js/JavaScript experience (or willing to hire)
  - [ ] Team understands FHIR basics (or committed to training)
  - [ ] DevOps experience with Docker/Kubernetes (if self-hosting)

- [ ] **Data Readiness**
  - [ ] Legacy system data exported and validated
  - [ ] Data quality assessed (% completeness, data types)
  - [ ] Critical fields identified and documented
  - [ ] FHIR mapping worksheet created

- [ ] **Business Readiness**
  - [ ] Executive sponsor identified
  - [ ] 6-9 month timeline approved
  - [ ] Budget approved ($100-150k+)
  - [ ] Go-live date set (with flexibility for delays)
  - [ ] Success metrics defined

- [ ] **Regulatory Assessment**
  - [ ] HIPAA compliance requirements documented
  - [ ] State/local regulations reviewed (TEFCA, ONC mandates)
  - [ ] Audit trail requirements defined
  - [ ] Data residency requirements (on-prem vs. cloud)

### During Migration: Key Milestones

- [ ] **Weeks 1-4: Design & Planning**
  - Data mapping complete
  - Architecture reviewed
  - Team trained on Medplum
  - Pilot scope defined

- [ ] **Weeks 5-8: Pilot Migration**
  - 100-500 patients migrated
  - Data quality validated (>98% accuracy target)
  - Performance tested
  - Go/No-Go decision made

- [ ] **Weeks 9-20: Full Migration**
  - Historical data migrated
  - External systems integrated
  - Custom UIs built and tested
  - Stakeholder training completed

- [ ] **Weeks 21-24: Go-Live**
  - Parallel run with legacy system (2-4 weeks)
  - Staff training on new system
  - Cutover executed
  - Post-go-live support (2-4 weeks)

### Post-Migration: First 90 Days

- [ ] Monitor system performance (query latency, uptime)
- [ ] Track user adoption (login rates, feature usage)
- [ ] Log issues and prioritize fixes
- [ ] Gather feedback from clinical staff
- [ ] Optimize slow queries/workflows
- [ ] Plan Phase 2 features/integrations

---

## PART 7: RED FLAGS & WHAT TO AVOID

### Red Flag #1: "We Don't Have a Technical Team"

**Why It's a Problem**: Medplum requires developers. Not optional.

**What You Might Be Thinking**: "Can't we just hire an implementation partner?"
**Reality**: Partner can help, but you need in-house team ownership

**Better Path**: Hire 1-2 mid-level Node.js developers before starting migration

---

### Red Flag #2: "We Need This Done in 2 Months"

**Why It's a Problem**: Realistic timelines are 6-9 months. Rushing = quality issues, security gaps, go-live disasters.

**What Happens**:
- Data mapping rushed → data loss
- Testing skipped → bugs in production
- Parallel run shortened → staff not ready

**Better Path**:
- If truly urgent, consider a temporary hybrid (keep legacy system 3-6 months)
- Phase the migration (start with non-critical workflows)

---

### Red Flag #3: "We Want to Self-Host But Our Team Has No DevOps Experience"

**Why It's a Problem**: Self-hosting requires Kubernetes, cloud infrastructure, security compliance

**What You'll Face**:
- Deployment failures
- Database corruption
- Security vulnerabilities
- 24/7 on-call burden

**Better Path**: Start with Medplum Hosted ($2-5k/month). Switch to self-hosting after 12-18 months when team gains expertise.

---

### Red Flag #4: "Our Workflows Are Too Complex for FHIR"

**Why It's a Problem**: 95% of healthcare workflows can fit FHIR. If yours can't, Medplum isn't the right choice.

**What You Might Be Thinking**: "We have super unique orthopedic/behavioral/dermatology workflows"
**Reality**: Those workflows almost always map to FHIR. The issue is learning how.

**Better Path**:
- Audit your workflows with a FHIR expert
- Consider if you're over-engineering
- Simplify workflows to fit FHIR patterns

---

### Red Flag #5: "Regulatory Compliance is Nice-to-Have"

**Why It's a Problem**: HIPAA, TEFCA, HTI-4 are not optional. They're legal requirements.

**What's Changing**:
- Jan 2025: TEFCA penalties for non-compliance
- Jan 2027: HTI-4 enforcement (information blocking rules)
- July 2024: First info-blocking fines issued

**Better Path**:
- Build compliance into migration plan from day 1
- Budget for HITRUST certification ($30-50k)
- Involve legal/compliance in architecture review

---

## PART 8: RESOURCES & NEXT STEPS

### Step 1: Free Discovery (1-2 weeks)
- [ ] Download this guide (you're reading it!)
- [ ] Spend 2 hours on Medplum docs (medplum.com/docs)
- [ ] Watch case studies (medplum.com/case-studies)
- [ ] Review FHIR basics (medplum.com/docs/fhir-basics)

### Step 2: Proof of Concept (2-4 weeks)
- [ ] Create free Medplum account
- [ ] Import sample data (100 patients)
- [ ] Build simple UI (patient list, detail view)
- [ ] Estimate mapping effort for your data

### Step 3: Team Alignment (1-2 weeks)
- [ ] Present findings to executive sponsor
- [ ] Assess internal team capabilities
- [ ] Decide: Medplum vs. alternative vs. status quo
- [ ] Get approval for next phase

### Step 4: Partner & Plan (4-6 weeks)
- [ ] Hire/contract experienced Medplum implementer (if needed)
- [ ] Conduct full data assessment
- [ ] Create detailed migration plan
- [ ] Set realistic go-live date and budget

### Step 5: Execute (6-9 months)
- [ ] Follow phased approach (Design → Pilot → Full → Go-Live)
- [ ] Monitor progress weekly
- [ ] Adjust timeline as needed
- [ ] Plan for 2-3 iterations

---

## ABOUT 1PUTT HEALTH

**1Putt Health** is a healthcare technology consulting firm specializing in EHR migrations, FHIR implementations, and interoperability strategies for digital health companies, health systems, and healthcare startups.

**Our Expertise**:
- Medplum implementation & migration
- FHIR data mapping & architecture
- Healthcare regulatory compliance (HIPAA, TEFCA, HTI-4)
- Digital health product strategy

**We Help With**:
- Feasibility assessments
- Technical architecture design
- Migration planning & execution
- Team augmentation (engineers, architects)
- Vendor evaluation (Medplum vs. alternatives)

**Next Step**: Schedule a 30-minute discovery call with one of our Medplum experts.

---

## APPENDIX: FURTHER READING

**Medplum Official**
- [Medplum Docs](https://www.medplum.com/docs)
- [Migration Planning Guide](https://www.medplum.com/docs/migration/migration-planning)
- [FHIR Basics](https://www.medplum.com/docs/fhir-basics)
- [Case Studies](https://www.medplum.com/case-studies)

**FHIR & Healthcare Standards**
- [FHIR Specification](https://www.hl7.org/fhir/)
- [US Core Implementation Guide](https://hl7.org/fhir/us/core/)
- [TEFCA Final Rule](https://www.federalregister.gov/documents/2024/12/16/2024-29163/health-data-technology-and-interoperability-trusted-exchange-framework-and-common-agreement-tefca)

**Competitive Alternatives**
- [Canvas Medical](https://www.canvasmedical.com/)
- [Healthie](https://www.gethealthie.com/)
- [Smile CDR](https://www.smilecdr.com/)
- [Google Cloud Healthcare API](https://cloud.google.com/healthcare-api)

---

**Document Version**: 1.0 (March 14, 2026)
**Last Updated**: March 14, 2026
**License**: This guide is provided by 1Putt Health for educational purposes.
