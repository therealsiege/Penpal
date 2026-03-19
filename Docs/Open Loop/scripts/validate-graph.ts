// scripts/validate-graph.ts
import neo4j from "neo4j-driver";

const BOLT_URL = process.env.MEMGRAPH_URL || "bolt://localhost:7687";

async function main() {
  const driver = neo4j.driver(BOLT_URL);
  const session = driver.session();
  let passed = 0;
  let failed = 0;

  async function assert(name: string, query: string, check: (records: any[]) => boolean) {
    const result = await session.run(query);
    if (check(result.records)) {
      console.log(`  ✓ ${name}`);
      passed++;
    } else {
      console.log(`  ✗ ${name}`);
      console.log(`    Query: ${query}`);
      console.log(`    Records: ${result.records.length}`);
      if (result.records.length > 0) {
        console.log(`    Value: ${result.records[0].get("c")}`);
      }
      failed++;
    }
  }

  console.log("=== Graph Validation ===\n");

  // ── Node counts ────────────────────────────────────────────────────────────
  console.log("Node counts:");
  await assert("6 domains", "MATCH (n:Domain) RETURN count(n) AS c", r => r[0].get("c").toNumber() === 6);
  await assert("42 people", "MATCH (n:Person) RETURN count(n) AS c", r => r[0].get("c").toNumber() === 42);
  await assert("28 organizations", "MATCH (n:Organization) RETURN count(n) AS c", r => r[0].get("c").toNumber() === 28);
  await assert("61 technologies", "MATCH (n:Technology) RETURN count(n) AS c", r => r[0].get("c").toNumber() === 61);
  await assert("26 integrations", "MATCH (n:Integration) RETURN count(n) AS c", r => r[0].get("c").toNumber() === 26);
  await assert("66 FHIR resources", "MATCH (n:FhirResource) RETURN count(n) AS c", r => r[0].get("c").toNumber() === 66);
  await assert("4 phases", "MATCH (n:Phase) RETURN count(n) AS c", r => r[0].get("c").toNumber() === 4);
  await assert("13 risks", "MATCH (n:Risk) RETURN count(n) AS c", r => r[0].get("c").toNumber() === 13);
  await assert("21 decisions", "MATCH (n:Decision) RETURN count(n) AS c", r => r[0].get("c").toNumber() === 21);
  await assert("66 documents", "MATCH (n:Document) RETURN count(n) AS c", r => r[0].get("c").toNumber() === 66);
  await assert("6 meeting notes", "MATCH (n:MeetingNote) RETURN count(n) AS c", r => r[0].get("c").toNumber() === 6);
  await assert("88 action items", "MATCH (n:ActionItem) RETURN count(n) AS c", r => r[0].get("c").toNumber() === 88);

  // New node types
  console.log("\nNew node types:");
  await assert("9 projects", "MATCH (n:Project) RETURN count(n) AS c", r => r[0].get("c").toNumber() === 9);
  await assert("8 teams", "MATCH (n:Team) RETURN count(n) AS c", r => r[0].get("c").toNumber() === 8);
  await assert("47 topics", "MATCH (n:Topic) RETURN count(n) AS c", r => r[0].get("c").toNumber() === 47);
  await assert("1 incident", "MATCH (n:Incident) RETURN count(n) AS c", r => r[0].get("c").toNumber() === 1);

  // ── Key relationships ──────────────────────────────────────────────────────
  console.log("\nRelationships:");
  await assert("All 6 domains contain docs", "MATCH (d:Domain)-[:CONTAINS]->(doc) RETURN count(DISTINCT d) AS c", r => r[0].get("c").toNumber() === 6);
  await assert("Cross-references exist", "MATCH ()-[r:REFERENCES]->() RETURN count(r) AS c", r => r[0].get("c").toNumber() > 0);
  await assert("42 people employed", "MATCH ()-[r:EMPLOYS]->() RETURN count(r) AS c", r => r[0].get("c").toNumber() === 42);
  await assert("Phase chain (3 depends_on)", "MATCH (p:Phase)-[:DEPENDS_ON]->() RETURN count(p) AS c", r => r[0].get("c").toNumber() === 3);
  await assert("OpenLoop migrating from Healthie", "MATCH (o:Organization {name:'OpenLoop'})-[:MIGRATING_FROM]->(h:Organization {name:'Healthie'}) RETURN count(*) AS c", r => r[0].get("c").toNumber() === 1);
  await assert("Tech mappings >= 8", "MATCH ()-[r:MAPS_TO]->() RETURN count(r) AS c", r => r[0].get("c").toNumber() >= 8);
  await assert("21 decisions linked to doc", "MATCH (d:Decision)-[:DECIDED_IN]->(doc:Document) RETURN count(d) AS c", r => r[0].get("c").toNumber() === 21);
  await assert("MENTIONS > 50", "MATCH ()-[r:MENTIONS]->() RETURN count(r) AS c", r => r[0].get("c").toNumber() > 50);
  await assert("Action items produced", "MATCH (m:MeetingNote)-[:PRODUCED]->(a:ActionItem) RETURN count(a) AS c", r => r[0].get("c").toNumber() > 0);

  // ── Enhanced relationships ─────────────────────────────────────────────────
  console.log("\nEnhanced relationships:");
  await assert("18 MEMBER_OF", "MATCH ()-[r:MEMBER_OF]->() RETURN count(r) AS c", r => r[0].get("c").toNumber() === 18);
  await assert("3 REPORTS_TO", "MATCH ()-[r:REPORTS_TO]->() RETURN count(r) AS c", r => r[0].get("c").toNumber() === 3);
  await assert("6 team PART_OF", "MATCH ()-[r:PART_OF]->() RETURN count(r) AS c", r => r[0].get("c").toNumber() === 6);
  await assert("8 LEADS", "MATCH ()-[r:LEADS]->() RETURN count(r) AS c", r => r[0].get("c").toNumber() === 8);
  await assert("21 DECIDED_FOR project", "MATCH ()-[r:DECIDED_FOR]->() RETURN count(r) AS c", r => r[0].get("c").toNumber() === 21);
  await assert("13 THREATENS project", "MATCH ()-[r:THREATENS]->() RETURN count(r) AS c", r => r[0].get("c").toNumber() === 13);
  await assert("Incident CAUSED_BY DynamoDB", "MATCH (i:Incident)-[:CAUSED_BY]->(t:Technology {name:'DynamoDB'}) RETURN count(*) AS c", r => r[0].get("c").toNumber() === 1);
  await assert("Incident AFFECTED 3 orgs", "MATCH (i:Incident)-[:AFFECTED]->(o:Organization) RETURN count(o) AS c", r => r[0].get("c").toNumber() === 3);
  await assert("49 DISCUSSES", "MATCH ()-[r:DISCUSSES]->() RETURN count(r) AS c", r => r[0].get("c").toNumber() === 49);
  await assert("2 NEXT (temporal chain)", "MATCH ()-[r:NEXT]->() RETURN count(r) AS c", r => r[0].get("c").toNumber() === 2);
  await assert("MENTIONS have count property", "MATCH ()-[r:MENTIONS]->() WHERE r.count > 0 RETURN count(r) AS c", r => r[0].get("c").toNumber() > 0);
  await assert("Action items ASSIGNED_TO people", "MATCH ()-[r:ASSIGNED_TO]->() RETURN count(r) AS c", r => r[0].get("c").toNumber() > 0);

  // ── Semantic checks ────────────────────────────────────────────────────────
  console.log("\nSemantic checks:");
  await assert("EventBridge in Tech Stack", "MATCH (d:Document)-[:MENTIONS]->(t:Technology {name:'EventBridge'}) WHERE d.filePath ENDS WITH 'Tech Stack.md' RETURN count(*) AS c", r => r[0].get("c").toNumber() >= 1);
  await assert("Stripe provides Stripe Payments", "MATCH (o:Organization {name:'Stripe'})-[:PROVIDES]->(i:Integration {name:'Stripe Payments'}) RETURN count(*) AS c", r => r[0].get("c").toNumber() === 1);
  await assert("Clint owns Migration", "MATCH (p:Person {name:'Clint Johnson'})-[:OWNS]->(d:Domain {name:'Migration'}) RETURN count(*) AS c", r => r[0].get("c").toNumber() === 1);
  await assert("Clint MEMBER_OF Payments & Revenue", "MATCH (p:Person {name:'Clint Johnson'})-[:MEMBER_OF]->(t:Team {name:'Payments & Revenue'}) RETURN count(*) AS c", r => r[0].get("c").toNumber() === 1);
  await assert("Payments ESL has decisions", "MATCH (d:Decision)-[:DECIDED_FOR]->(pr:Project {name:'Payments ESL'}) RETURN count(d) AS c", r => r[0].get("c").toNumber() >= 3);
  await assert("MedPlum Migration has risks", "MATCH (r:Risk)-[:THREATENS]->(pr:Project {name:'MedPlum Migration'}) RETURN count(r) AS c", r => r[0].get("c").toNumber() === 13);

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);

  await session.close();
  await driver.close();

  if (failed > 0) process.exit(1);
}

main().catch(console.error);
