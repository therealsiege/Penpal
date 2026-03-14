
> Generated from Knowledge Graph + NPI Registry Enrichment
> Date: 2026-03-12 | Sources: CRM leads (443), NPI Registry API, graph analytics

---

## Design Partner Selection Criteria

A design partner is a practice that will co-develop and validate MedScrub's Revenue Engine features (CCM, APCM, MIPS) in exchange for early access and reduced pricing.

### Must-Have Criteria

- [ ] **Specialty**: Family Medicine or Internal Medicine
- [ ] **EHR**: athenahealth (athenaOne)
- [ ] **Practice Size**: 1-5 providers (sole proprietor or small group)
- [ ] **Geography**: TX, TN, CO, NC, or AL (matching pipeline concentration)
- [ ] **Medicare Indicators**: Specialty + geography suggest Medicare-heavy panel

### Nice-to-Have Criteria

- [ ] Lead score >= 50
- [ ] Already in CRM pipeline (Outreach stage or better)
- [ ] HTN member or referred lead
- [ ] Prior engagement (opened email, attended demo, etc.)
- [ ] Sole proprietor (faster decision-making)

---

## Candidate Query

The following Cypher query identifies design partner candidates from the knowledge graph:

```cypher
MATCH (l:Lead)-[:USES_EHR]->(e:EHRSystem {name: 'athenahealth'})
MATCH (l)-[:PRACTICES_AT]->(p:Practice)-[:IN_SPECIALTY]->(s:Specialty)
WHERE s.name IN ['Family Medicine', 'Internal Medicine']
MATCH (l)-[:LOCATED_IN]->(t:Territory)
WHERE t.name IN ['Texas', 'Tennessee', 'Colorado', 'North Carolina', 'Alabama']
OPTIONAL MATCH (l)-[:ELIGIBLE_FOR]->(prog:Program)
RETURN l.name, l.company, p.npi, s.name AS specialty, t.name AS state,
       l.leadScore, l.salesFunnel, l.priority,
       collect(DISTINCT prog.name) AS eligiblePrograms
ORDER BY l.leadScore DESC
LIMIT 15
```

---

## Shortlist (Pending ETL Run)

> Run the ETL with `--skip-embeddings --skip-llm` to populate NPI data, then execute the Cypher query above to generate the final shortlist.

### Expected Profile of Ideal Design Partner

| Attribute | Target |
|---|---|
| Practice Type | Independent family medicine or internal medicine |
| Provider Count | 1-5 (sole proprietor preferred) |
| EHR | athenahealth (athenaOne) |
| Location | TX, TN, CO, NC, or AL |
| Medicare Panel | 200-500 patients |
| Current Revenue Programs | Not yet billing CCM/RPM/APCM |
| Decision Maker | Physician owner (not employed physician) |
| Tech Adoption | Early adopter / tech-forward |

### Revenue Opportunity Per Design Partner

| Program | Annual Revenue (200 Medicare patients) | MedScrub Value |
|---|---|---|
| CCM (99490) | $13,260/year | Automates care plan + billing |
| CCM (99490 + 99439) | $27,888/year | Monthly touchpoint automation |
| APCM (G0557 moderate) | $124,800/year | Eligibility identification + tracking |
| MIPS | Avoid -9% penalty on all Medicare | Dashboard + quality reporting |
| **Combined** | **$40,000-$150,000+/year** | **"Revenue Engine" value proposition** |

---

## Outreach Strategy for Design Partners

### Phase 1: Identify (Week 1)
1. Run NPI-enriched graph query for top 15 candidates
2. Verify each candidate's practice is still active (NPI deactivation check)
3. Confirm athenahealth EHR via practice website or athena Marketplace
4. Check if practice currently bills CCM/RPM (CMS PECOS data if available)

### Phase 2: Qualify (Week 2)
1. Warm introduction via HTN network or existing connection
2. 15-minute discovery call focused on:
   - "What percentage of your patients are Medicare?"
   - "Are you currently billing CCM or RPM?"
   - "How do you handle between-visit patient outreach?"
   - "What's your biggest frustration with athenahealth?"
3. Score interest level 1-5

### Phase 3: Engage (Week 3-4)
1. Revenue opportunity analysis (personalized per practice)
2. Demo of MedScrub Revenue Engine prototype
3. Design partner agreement:
   - 90-day pilot period
   - Free access to revenue features during pilot
   - Weekly feedback sessions (30 min)
   - Case study participation after pilot
   - Discounted pricing post-pilot (50% off Year 1)

### Phase 4: Validate (Month 2-4)
1. Deploy CCM workflow automation at design partner practice
2. Track: patients identified, care plans created, claims submitted, revenue captured
3. Measure: time saved, revenue generated, feature gaps
4. Document: case study with real numbers

---

## NPI-Sourced Net-New Prospects

After the NPPES CSV scan completes, new prospects matching our criteria (Family Medicine or Internal Medicine, sole proprietor, in target states) will appear as Practice nodes with `source: "npi-registry"` in the graph. These are **not** in our CRM yet and represent expansion opportunities.

Query for NPI-sourced prospects:
```cypher
MATCH (p:Practice)
WHERE p.source = 'npi-registry'
  AND p.practiceState IN ['TX', 'TN', 'CO', 'NC', 'AL']
  AND p.isSoleProprietor = 'Y'
  AND p.taxonomyCode IN ['207Q00000X', '207R00000X']
RETURN p.name, p.npi, p.practiceCity, p.practiceState, p.taxonomyCode
ORDER BY p.practiceState, p.practiceCity
LIMIT 50
```
