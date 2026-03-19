# Elion Health — Memgraph Analysis Queries

**Dataset:** 2,492 documents (2,228 products, 35 categories, 191 research, 37 reviews, 1 README)
**Graph:** 3,528 nodes, 10,316 relationships
**Run in:** Memgraph Lab (localhost:3003)

---

## 1. Overview & Inventory

### Total graph size
```cypher
MATCH (n) RETURN labels(n)[0] AS type, count(n) AS count ORDER BY count DESC;
```

### All relationships from Elion documents
```cypher
MATCH (d:Document)-[r]->(target)
WHERE d.relativePath STARTS WITH 'Research/Elion Health/'
RETURN type(r) AS relationship, labels(target)[0] AS target_type, count(r) AS count
ORDER BY count DESC;
```

### Documents per subfolder
```cypher
MATCH (d:Document)-[:IN_FOLDER]->(f:Folder)
WHERE f.path STARTS WITH 'Research/Elion Health'
RETURN f.name AS folder, count(d) AS docs
ORDER BY docs DESC;
```

### Relationship density by document type
```cypher
MATCH (d:Document)-[:IN_FOLDER]->(f:Folder)
WHERE f.path STARTS WITH 'Research/Elion Health'
OPTIONAL MATCH (d)-[r]->()
WITH f.name AS folder, count(DISTINCT d) AS docs, count(r) AS total_rels,
     toFloat(count(r)) / count(DISTINCT d) AS avg_rels_per_doc
RETURN folder, docs, total_rels, avg_rels_per_doc
ORDER BY avg_rels_per_doc DESC;
```
> Categories average 9.9 relationships per doc, Products average 3.1

---

## 2. Degree Centrality — Most Connected Entities

### Top 30 entities by inbound degree (most referenced)
```cypher
MATCH (n)<-[r]-(d:Document)
WHERE d.relativePath STARTS WITH 'Research/Elion Health/'
  AND NOT n:Document AND NOT n:Folder
WITH n, labels(n)[0] AS type, count(r) AS degree
ORDER BY degree DESC LIMIT 30
RETURN type, n.name AS entity, degree;
```
> Results: HIPAA (1,444), SOC 2 (752), Epic (343), athenahealth (228), HITRUST (264), eClinicalWorks (105), Next.js (101), SMART on FHIR (58), FHIR (55), GPT-4 (36)

### Products that are LINKED TO by the most other products (integration destinations)
```cypher
MATCH (d2:Document)-[:LINKS_TO]->(d:Document)
WHERE d.relativePath STARTS WITH 'Research/Elion Health/Products/'
  AND d2.relativePath STARTS WITH 'Research/Elion Health/Products/'
WITH d, count(DISTINCT d2) AS referenced_by
WHERE referenced_by >= 3
RETURN d.title AS product, referenced_by
ORDER BY referenced_by DESC LIMIT 20;
```
> athenahealth (192 inbound links), ixlayer (24), emtelligent (19)

---

## 3. EHR Ecosystem Analysis

### EHR mention counts across all products
```cypher
MATCH (d:Document)-[:MENTIONS_EHR]->(e:EHRSystem)
WHERE d.relativePath STARTS WITH 'Research/Elion Health/Products/'
RETURN e.name AS ehr, count(d) AS mentions
ORDER BY mentions DESC;
```

### Products with broadest EHR coverage (3+ EHRs)
```cypher
MATCH (d:Document)-[:MENTIONS_EHR]->(e:EHRSystem)
WHERE d.relativePath STARTS WITH 'Research/Elion Health/Products/'
WITH d, collect(DISTINCT e.name) AS ehrs, count(DISTINCT e) AS ehr_count
WHERE ehr_count >= 3
RETURN d.title AS product, ehr_count, ehrs
ORDER BY ehr_count DESC LIMIT 25;
```
> Epic, AdvancedMD, NextGen, Elation, Phreesia all cover 4 EHRs

### EHR co-occurrence matrix (which EHRs are integrated together)
```cypher
MATCH (d:Document)-[:MENTIONS_EHR]->(e1:EHRSystem),
      (d)-[:MENTIONS_EHR]->(e2:EHRSystem)
WHERE d.relativePath STARTS WITH 'Research/Elion Health/Products/'
  AND id(e1) < id(e2)
RETURN e1.name AS ehr_a, e2.name AS ehr_b, count(d) AS co_occurrences
ORDER BY co_occurrences DESC LIMIT 20;
```
> Epic + athenahealth (49), athena + eCW (42), Epic + Cerner (37), athena + AdvancedMD (31)

### Jaccard similarity between Epic and athenahealth ecosystems
```cypher
MATCH (d:Document)-[:MENTIONS_EHR]->(e:EHRSystem)
WHERE d.relativePath STARTS WITH 'Research/Elion Health/Products/'
  AND e.name IN ['Epic', 'athenahealth']
WITH e.name AS ehr, collect(d.title) AS products
WITH collect({ehr: ehr, products: products}) AS all_data
WITH all_data[0].products AS set_a, all_data[1].products AS set_b,
     all_data[0].ehr AS ehr_a, all_data[1].ehr AS ehr_b
WITH ehr_a, ehr_b, size(set_a) AS size_a, size(set_b) AS size_b,
     size([x IN set_a WHERE x IN set_b]) AS intersection
RETURN ehr_a, ehr_b, size_a, size_b, intersection,
       toFloat(intersection) / (size_a + size_b - intersection) AS jaccard_similarity;
```
> Jaccard = 0.113 — only 11.3% overlap between Epic and athenahealth vendor ecosystems. These are largely separate markets.

### Products sharing EHR integrations with Abridge (competitive adjacency)
```cypher
MATCH (abridge:Document {title: 'abridge'})-[:MENTIONS_EHR]->(e:EHRSystem)<-[:MENTIONS_EHR]-(other:Document)
WHERE other.relativePath STARTS WITH 'Research/Elion Health/Products/'
  AND other.title <> 'abridge'
RETURN other.title AS product, collect(e.name) AS shared_ehrs, count(e) AS overlap
ORDER BY overlap DESC LIMIT 15;
```

---

## 4. Compliance & Certification Analysis

### Certification combo distribution
```cypher
MATCH (d:Document)-[:MENTIONS_REGULATION]->(r:Regulation)
WHERE d.relativePath STARTS WITH 'Research/Elion Health/Products/'
WITH d, collect(r.name) AS certs
ORDER BY size(certs) DESC
WITH certs, count(*) AS product_count
WHERE product_count >= 5
RETURN certs, product_count
ORDER BY product_count DESC;
```
> HIPAA only: 668 | HIPAA + SOC 2: 523 | HIPAA + SOC 2 + HITRUST: 119 | HIPAA + HITRUST: 89

### Products with zero certifications
```cypher
MATCH (d:Document)
WHERE d.relativePath STARTS WITH 'Research/Elion Health/Products/'
  AND NOT EXISTS ((d)-[:MENTIONS_REGULATION]->())
RETURN count(d) AS products_no_certs;
```
> 687 products (31%) have no certifications listed

### Products with all three major certifications
```cypher
MATCH (d:Document)-[:MENTIONS_REGULATION]->(r1:Regulation {name: 'HIPAA'}),
      (d)-[:MENTIONS_REGULATION]->(r2:Regulation {name: 'SOC 2'}),
      (d)-[:MENTIONS_REGULATION]->(r3:Regulation {name: 'HITRUST'})
WHERE d.relativePath STARTS WITH 'Research/Elion Health/Products/'
RETURN count(d) AS products_all_three;
```
> 120 products (5.4%) have HIPAA + SOC 2 + HITRUST

### Regulation × Technology co-occurrence
```cypher
MATCH (d:Document)-[:MENTIONS_REGULATION]->(r:Regulation),
      (d)-[:MENTIONS_TECH]->(t:Technology)
WHERE d.relativePath STARTS WITH 'Research/Elion Health/Products/'
RETURN r.name AS regulation, t.name AS technology, count(d) AS co_occurrences
ORDER BY co_occurrences DESC LIMIT 20;
```
> HIPAA + FHIR (24), HIPAA + HL7 (17), SOC 2 + FHIR (15), HIPAA + SMART on FHIR (14), HIPAA + GPT-4 (7), HIPAA + Claude (5)

---

## 5. AI Platform Adoption

### LLM/AI platform mentions across health IT
```cypher
MATCH (d:Document)-[:MENTIONS_TECH]->(t:Technology)
WHERE d.relativePath STARTS WITH 'Research/Elion Health/Products/'
  AND t.name IN ['GPT-4', 'Claude', 'AWS Bedrock', 'Google Vertex AI']
RETURN t.name AS ai_platform, count(d) AS products
ORDER BY products DESC;
```
> GPT-4 (12 products), Claude (8), AWS Bedrock (4), Google Vertex AI (2)

### All technology mentions ranked
```cypher
MATCH (d:Document)-[:MENTIONS_TECH]->(t:Technology)
WHERE d.relativePath STARTS WITH 'Research/Elion Health/Products/'
RETURN t.name AS technology, count(d) AS mentions
ORDER BY mentions DESC;
```

---

## 6. Competitive Similarity (MedScrub-specific)

### Products matching MedScrub's entity profile (Epic + athena + HIPAA + FHIR)
```cypher
MATCH (d:Document)
WHERE d.relativePath STARTS WITH 'Research/Elion Health/Products/'
OPTIONAL MATCH (d)-[:MENTIONS_EHR]->(e:EHRSystem)
  WHERE e.name IN ['Epic', 'athenahealth', 'Oracle Cerner']
OPTIONAL MATCH (d)-[:MENTIONS_REGULATION]->(r:Regulation)
  WHERE r.name IN ['HIPAA', 'SOC 2', 'HITRUST']
OPTIONAL MATCH (d)-[:MENTIONS_TECH]->(t:Technology)
  WHERE t.name IN ['FHIR', 'SMART on FHIR', 'HL7']
WITH d, count(DISTINCT e) AS ehr_score, count(DISTINCT r) AS reg_score,
     count(DISTINCT t) AS tech_score,
     count(DISTINCT e) + count(DISTINCT r) + count(DISTINCT t) AS total_score
WHERE total_score >= 4
RETURN d.title AS product, ehr_score, reg_score, tech_score, total_score
ORDER BY total_score DESC LIMIT 25;
```
> Top: Evidently CDS (6), Lilee (6), Oracle Cerner (6), Fathom (5), Commure Scribe (5), Rhapsody (5)

### Products with Epic + HIPAA + FHIR (closest to MedScrub's core stack)
```cypher
MATCH (d:Document)-[:MENTIONS_EHR]->(e:EHRSystem {name: 'Epic'}),
      (d)-[:MENTIONS_REGULATION]->(r:Regulation {name: 'HIPAA'}),
      (d)-[:MENTIONS_TECH]->(t:Technology)
WHERE d.relativePath STARTS WITH 'Research/Elion Health/Products/'
  AND t.name IN ['FHIR', 'SMART on FHIR']
RETURN d.title AS product, collect(DISTINCT t.name) AS fhir_tech
ORDER BY product;
```
> Only 8 products: 314e Muspell, ELLKAY Opera, Evidently CDS, HealthConnect Copilot, Lana Health, Lilee, OpenDoctor, Rhinogram

### Product pairs with highest entity overlap (competitive clusters)
```cypher
MATCH (d1:Document)-[:MENTIONS_EHR]->(e:EHRSystem)<-[:MENTIONS_EHR]-(d2:Document),
      (d1)-[:MENTIONS_REGULATION]->(r:Regulation)<-[:MENTIONS_REGULATION]-(d2),
      (d1)-[:MENTIONS_TECH]->(t:Technology)<-[:MENTIONS_TECH]-(d2)
WHERE d1.relativePath STARTS WITH 'Research/Elion Health/Products/'
  AND d2.relativePath STARTS WITH 'Research/Elion Health/Products/'
  AND id(d1) < id(d2)
WITH d1.title AS product_a, d2.title AS product_b,
     count(DISTINCT e) + count(DISTINCT r) + count(DISTINCT t) AS shared_entities,
     collect(DISTINCT e.name) AS shared_ehrs,
     collect(DISTINCT t.name) AS shared_techs
WHERE shared_entities >= 5
RETURN product_a, product_b, shared_entities, shared_ehrs, shared_techs
ORDER BY shared_entities DESC LIMIT 20;
```

---

## 7. Breadth & Diversity Scoring

### Products with broadest entity diversity (most unique connections)
```cypher
MATCH (d:Document)
WHERE d.relativePath STARTS WITH 'Research/Elion Health/Products/'
OPTIONAL MATCH (d)-[:MENTIONS_EHR]->(e:EHRSystem)
OPTIONAL MATCH (d)-[:MENTIONS_REGULATION]->(r:Regulation)
OPTIONAL MATCH (d)-[:MENTIONS_TECH]->(t:Technology)
OPTIONAL MATCH (d)-[:MENTIONS_COMPANY]->(c:Company)
OPTIONAL MATCH (d)-[:LINKS_TO]->(l:Document)
WITH d.title AS product,
     count(DISTINCT e) AS ehrs,
     count(DISTINCT r) AS regs,
     count(DISTINCT t) AS techs,
     count(DISTINCT c) AS companies,
     count(DISTINCT l) AS links,
     count(DISTINCT e) + count(DISTINCT r) + count(DISTINCT t) +
     count(DISTINCT c) + count(DISTINCT l) AS breadth
WHERE breadth >= 8
RETURN product, ehrs, regs, techs, companies, links, breadth
ORDER BY breadth DESC LIMIT 20;
```
> Top: Freed (12), Rhapsody (11), Commure Scribe (11), Epic (11)

### Products with zero entity connections (isolated nodes)
```cypher
MATCH (d:Document)
WHERE d.relativePath STARTS WITH 'Research/Elion Health/Products/'
  AND NOT EXISTS ((d)-[:MENTIONS_EHR]->())
  AND NOT EXISTS ((d)-[:MENTIONS_REGULATION]->())
  AND NOT EXISTS ((d)-[:MENTIONS_TECH]->())
  AND NOT EXISTS ((d)-[:MENTIONS_COMPANY]->())
  AND NOT EXISTS ((d)-[:LINKS_TO]->(:Document))
RETURN count(d) AS isolated_products;
```

---

## 8. Prior Authorization Deep Dive

### Prior auth products with funding data
```cypher
MATCH (d:Document)
WHERE d.relativePath STARTS WITH 'Research/Elion Health/Products/'
  AND d.contentPreview CONTAINS 'prior auth'
RETURN d.title AS product
ORDER BY product;
```
> 105 products mention prior authorization

### Prior auth products mentioning CMS-0057-F
```cypher
MATCH (d:Document)
WHERE d.relativePath STARTS WITH 'Research/Elion Health/Products/'
  AND (d.contentPreview CONTAINS 'CMS-0057' OR d.contentPreview CONTAINS 'CMS 0057')
RETURN d.title AS product;
```

### Prior auth products with FHIR + Epic (CMS-0057-F ready)
```cypher
MATCH (d:Document)-[:MENTIONS_EHR]->(e:EHRSystem {name: 'Epic'}),
      (d)-[:MENTIONS_TECH]->(t:Technology)
WHERE d.relativePath STARTS WITH 'Research/Elion Health/Products/'
  AND d.contentPreview CONTAINS 'prior auth'
  AND t.name IN ['FHIR', 'SMART on FHIR']
RETURN d.title AS product, collect(t.name) AS fhir_tech;
```

---

## 9. Network Analysis

### Cross-document link graph (product integrations)
```cypher
MATCH (d:Document)-[:LINKS_TO]->(d2:Document)
WHERE d.relativePath STARTS WITH 'Research/Elion Health/Products/'
  AND d2.relativePath STARTS WITH 'Research/Elion Health/Products/'
RETURN d.title AS source, d2.title AS target
LIMIT 100;
```
> Visualize in Memgraph Lab as a force-directed graph

### Integration hubs (products that link to the most other products)
```cypher
MATCH (d:Document)-[:LINKS_TO]->(d2:Document)
WHERE d.relativePath STARTS WITH 'Research/Elion Health/Products/'
  AND d2.relativePath STARTS WITH 'Research/Elion Health/Products/'
WITH d, collect(DISTINCT d2.title) AS integrates_with,
     count(DISTINCT d2) AS integration_count
WHERE integration_count >= 2
RETURN d.title AS product, integration_count, integrates_with
ORDER BY integration_count DESC LIMIT 20;
```

### Two-hop product similarity: products that share the same integration targets
```cypher
MATCH (d1:Document)-[:LINKS_TO]->(shared:Document)<-[:LINKS_TO]-(d2:Document)
WHERE d1.relativePath STARTS WITH 'Research/Elion Health/Products/'
  AND d2.relativePath STARTS WITH 'Research/Elion Health/Products/'
  AND shared.relativePath STARTS WITH 'Research/Elion Health/Products/'
  AND id(d1) < id(d2)
RETURN d1.title AS product_a, d2.title AS product_b,
       collect(shared.title) AS shared_integrations,
       count(shared) AS overlap
ORDER BY overlap DESC LIMIT 15;
```

---

## 10. Market Segmentation

### Company age distribution (founded year buckets)
```cypher
// Run in shell — contentPreview doesn't reliably contain founded year
// Use file-based grep instead (see shell commands below)
```

**Shell command:**
```bash
grep -r '| Founded |' "/Users/cj/Sidekick/Research/Elion Health/Products/" | \
  grep -oE '[0-9]{4}' | sort | uniq -c | sort -k2n
```
> Peak founding years: 2017 (137), 2023 (137), 2020 (125), 2022 (123), 2019 (114)

### Employee size distribution
```bash
grep -r '| Employees |' "/Users/cj/Sidekick/Research/Elion Health/Products/" | \
  sed 's/.*| Employees | //' | sed 's/ |.*//' | sort | uniq -c | sort -rn
```
> 11-50 (652), 51-200 (488), 1-10 (293), 201-500 (242), 1001-5000 (205), 10000+ (133)

### Funding round distribution
```bash
grep -r '| Latest Round |' "/Users/cj/Sidekick/Research/Elion Health/Products/" | \
  sed 's/.*| Latest Round | //' | sed 's/ |.*//' | sort | uniq -c | sort -rn | head -15
```
> Seed (284), Series A (199), Series B (165), Private Equity (119), Series C (87), Venture (71), Pre-Seed (56), Series D (42)

---

## 11. Graph Math & Metrics

### Graph density (how interconnected is the Elion subgraph)
```cypher
MATCH (d:Document)
WHERE d.relativePath STARTS WITH 'Research/Elion Health/Products/'
WITH count(d) AS n
MATCH (d1:Document)-[:LINKS_TO]->(d2:Document)
WHERE d1.relativePath STARTS WITH 'Research/Elion Health/Products/'
  AND d2.relativePath STARTS WITH 'Research/Elion Health/Products/'
WITH n, count(*) AS edges
RETURN n AS nodes, edges,
       toFloat(edges) / (n * (n - 1)) AS density;
```
> Density = edges / (n * (n-1)). Low density = fragmented market.

### Average entity connections per product
```cypher
MATCH (d:Document)
WHERE d.relativePath STARTS WITH 'Research/Elion Health/Products/'
OPTIONAL MATCH (d)-[r]->()
WHERE NOT type(r) = 'IN_FOLDER'
WITH d, count(r) AS entity_connections
RETURN avg(entity_connections) AS avg_connections,
       min(entity_connections) AS min_connections,
       max(entity_connections) AS max_connections,
       percentileCont(entity_connections, 0.5) AS median_connections,
       percentileCont(entity_connections, 0.9) AS p90_connections;
```

### Entity type distribution per product (what gets extracted most)
```cypher
MATCH (d:Document)-[r]->(target)
WHERE d.relativePath STARTS WITH 'Research/Elion Health/Products/'
  AND NOT target:Folder
WITH type(r) AS rel_type, count(*) AS total,
     count(DISTINCT d) AS products_with
RETURN rel_type, total,
       products_with,
       toFloat(total) / products_with AS avg_per_product
ORDER BY total DESC;
```

---

## 12. Competitive Intelligence Queries

### Products mentioning both "de-identif" and "FHIR" in content
```cypher
MATCH (d:Document)
WHERE d.relativePath STARTS WITH 'Research/Elion Health/Products/'
  AND d.contentPreview CONTAINS 'de-identif'
  AND (d.contentPreview CONTAINS 'FHIR' OR d.contentPreview CONTAINS 'fhir')
RETURN d.title AS product;
```
> Any results here are the closest direct MedScrub competitors

### Products mentioning "LLM" or "large language model"
```cypher
MATCH (d:Document)
WHERE d.relativePath STARTS WITH 'Research/Elion Health/Products/'
  AND (d.contentPreview CONTAINS 'LLM' OR d.contentPreview CONTAINS 'large language model')
RETURN d.title AS product
ORDER BY product;
```

### Products in the Claude ecosystem
```cypher
MATCH (d:Document)-[:MENTIONS_TECH]->(t:Technology {name: 'Claude'})
WHERE d.relativePath STARTS WITH 'Research/Elion Health/Products/'
RETURN d.title AS product;
```

### Find MedScrub's "anti-competitors" — products in de-id space NOT mentioning FHIR
```cypher
MATCH (d:Document)
WHERE d.relativePath STARTS WITH 'Research/Elion Health/Products/'
  AND d.contentPreview CONTAINS 'de-identif'
  AND NOT EXISTS ((d)-[:MENTIONS_TECH]->(:Technology {name: 'FHIR'}))
  AND NOT EXISTS ((d)-[:MENTIONS_TECH]->(:Technology {name: 'SMART on FHIR'}))
RETURN d.title AS product;
```
> These are de-id vendors with no FHIR capability — MedScrub's FHIR-native approach differentiates against all of them

---

## 13. Visual Queries (for Memgraph Lab Graph View)

### Full entity graph for a specific product
```cypher
MATCH (d:Document {title: 'abridge'})-[r]->(target)
WHERE NOT target:Folder
RETURN d, r, target;
```
> Change 'abridge' to any product slug

### Epic ecosystem — all products and their shared entities
```cypher
MATCH (d:Document)-[:MENTIONS_EHR]->(e:EHRSystem {name: 'Epic'})
WHERE d.relativePath STARTS WITH 'Research/Elion Health/Products/'
OPTIONAL MATCH (d)-[:MENTIONS_REGULATION]->(r:Regulation)
OPTIONAL MATCH (d)-[:MENTIONS_TECH]->(t:Technology)
RETURN d, e, r, t LIMIT 200;
```

### Product integration network (wiki-link graph)
```cypher
MATCH (d1:Document)-[l:LINKS_TO]->(d2:Document)
WHERE d1.relativePath STARTS WITH 'Research/Elion Health/Products/'
  AND d2.relativePath STARTS WITH 'Research/Elion Health/Products/'
RETURN d1, l, d2;
```
> Force-directed layout reveals integration clusters

### MedScrub competitive neighborhood — products sharing 3+ entities
```cypher
MATCH (d:Document)-[:MENTIONS_EHR]->(e:EHRSystem),
      (d)-[:MENTIONS_REGULATION]->(r:Regulation),
      (d)-[:MENTIONS_TECH]->(t:Technology)
WHERE d.relativePath STARTS WITH 'Research/Elion Health/Products/'
  AND e.name IN ['Epic', 'athenahealth']
  AND r.name = 'HIPAA'
  AND t.name IN ['FHIR', 'SMART on FHIR']
RETURN d, e, r, t;
```
> Shows MedScrub's competitive neighborhood in graph form

---

## Key Findings Summary

| Metric | Value |
|--------|-------|
| Total Elion products | 2,228 |
| Products mentioning Epic | 283 (12.7%) |
| Products mentioning FHIR or SMART on FHIR | 58 (2.6%) |
| Products with HIPAA + SOC 2 + HITRUST | 120 (5.4%) |
| Products with no certifications | 687 (31%) |
| De-identification products | 23 (1.0%) |
| AI scribe products | 130+ (5.8%) |
| Prior auth products | 105 (4.7%) |
| Products combining de-id + scribe + FHIR | **0** |
| Epic-athena Jaccard similarity | 0.113 (separate ecosystems) |
| GPT-4 mentions | 12 products |
| Claude mentions | 8 products |
| Peak founding year | 2017 and 2023 (137 each) |
| Most common employee size | 11-50 (652 products) |
| Most common funding round | Seed (284 products) |

---

*Queries designed for Memgraph Lab. Some use `contentPreview` field (first ~500 chars). For deeper content search, use shell `grep` against the full markdown files at `/Users/cj/Sidekick/Research/Elion Health/Products/`.*
