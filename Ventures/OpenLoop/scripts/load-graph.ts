// scripts/load-graph.ts
// Main graph loader — connects to Memgraph, loads catalog entities + parsed documents,
// and wires up all relationships.

import neo4j, { Session } from "neo4j-driver";
import { readFileSync } from "fs";
import { basename } from "path";
import {
  domains,
  people,
  organizations,
  technologies,
  integrations,
  fhirResources,
  phases,
  risks,
  decisions,
  techMappings,
  projects,
  teams,
  incidents,
} from "./catalog.js";
import { parseKB, ParsedDocument } from "./parse-kb.js";

// ── helpers ──────────────────────────────────────────────────────────────────

async function run(session: Session, cypher: string, params: Record<string, unknown> = {}): Promise<void> {
  await session.run(cypher, params);
}

// ── 1. clearGraph ────────────────────────────────────────────────────────────

async function clearGraph(session: Session): Promise<void> {
  console.log("  Clearing graph...");
  await run(session, "MATCH (n) DETACH DELETE n");
}

// ── 2. createIndexes ─────────────────────────────────────────────────────────

async function createIndexes(session: Session): Promise<void> {
  console.log("  Creating indexes...");
  const indexes: [string, string][] = [
    ["Domain", "name"],
    ["Document", "filePath"],
    ["MeetingNote", "filePath"],
    ["Person", "name"],
    ["Organization", "name"],
    ["Technology", "name"],
    ["Integration", "name"],
    ["FhirResource", "name"],
    ["Phase", "number"],
    ["Risk", "id"],
    ["Decision", "id"],
    ["ActionItem", "description"],
    ["Project", "name"],
    ["Team", "name"],
    ["Topic", "name"],
    ["Incident", "id"],
  ];
  for (const [label, prop] of indexes) {
    await run(session, `CREATE INDEX ON :${label}(${prop})`);
  }
}

// ── 3. Node loaders (catalog entities) ───────────────────────────────────────

async function loadDomains(session: Session): Promise<void> {
  for (const d of domains) {
    await run(session, "MERGE (n:Domain {name: $name}) SET n.description = $description", {
      name: d.name,
      description: d.description,
    });
  }
  console.log(`    Domains: ${domains.length}`);
}

async function loadPeople(session: Session): Promise<void> {
  for (const p of people) {
    await run(session, "MERGE (n:Person {name: $name}) SET n.role = $role, n.org = $org", {
      name: p.name,
      role: p.role,
      org: p.org,
    });
  }
  console.log(`    People: ${people.length}`);
}

async function loadOrganizations(session: Session): Promise<void> {
  for (const o of organizations) {
    await run(
      session,
      "MERGE (n:Organization {name: $name}) SET n.type = $type, n.description = $description",
      { name: o.name, type: o.type, description: o.description },
    );
  }
  console.log(`    Organizations: ${organizations.length}`);
}

async function loadTechnologies(session: Session): Promise<void> {
  for (const t of technologies) {
    await run(session, "MERGE (n:Technology {name: $name}) SET n.category = $category", {
      name: t.name,
      category: t.category,
    });
  }
  console.log(`    Technologies: ${technologies.length}`);
}

async function loadIntegrations(session: Session): Promise<void> {
  for (const i of integrations) {
    await run(
      session,
      "MERGE (n:Integration {name: $name}) SET n.vendor = $vendor, n.category = $category",
      { name: i.name, vendor: i.vendor, category: i.category },
    );
  }
  console.log(`    Integrations: ${integrations.length}`);
}

async function loadFhirResources(session: Session): Promise<void> {
  for (const f of fhirResources) {
    await run(session, "MERGE (n:FhirResource {name: $name}) SET n.description = $description", {
      name: f.name,
      description: f.description,
    });
  }
  console.log(`    FhirResources: ${fhirResources.length}`);
}

async function loadPhases(session: Session): Promise<void> {
  for (const p of phases) {
    await run(
      session,
      "MERGE (n:Phase {number: $number}) SET n.name = $name, n.weekRange = $weekRange, n.goal = $goal, n.status = $status",
      { number: neo4j.int(p.number), name: p.name, weekRange: p.weekRange, goal: p.goal, status: p.status },
    );
  }
  console.log(`    Phases: ${phases.length}`);
}

async function loadRisks(session: Session): Promise<void> {
  for (const r of risks) {
    await run(
      session,
      "MERGE (n:Risk {id: $id}) SET n.title = $title, n.severity = $severity, n.mitigation = $mitigation",
      { id: r.id, title: r.title, severity: r.severity, mitigation: r.mitigation },
    );
  }
  console.log(`    Risks: ${risks.length}`);
}

async function loadDecisions(session: Session): Promise<void> {
  for (const d of decisions) {
    await run(session, "MERGE (n:Decision {id: $id}) SET n.title = $title, n.rationale = $rationale", {
      id: d.id,
      title: d.title,
      rationale: d.rationale,
    });
  }
  console.log(`    Decisions: ${decisions.length}`);
}

async function loadProjects(session: Session): Promise<void> {
  for (const p of projects) {
    await run(
      session,
      "MERGE (n:Project {name: $name}) SET n.status = $status, n.domain = $domain, n.description = $description",
      { name: p.name, status: p.status, domain: p.domain, description: p.description },
    );
  }
  console.log(`    Projects: ${projects.length}`);
}

async function loadTeams(session: Session): Promise<void> {
  for (const t of teams) {
    await run(session, "MERGE (n:Team {name: $name}) SET n.lead = $lead", {
      name: t.name,
      lead: t.lead,
    });
  }
  console.log(`    Teams: ${teams.length}`);
}

async function loadIncidents(session: Session): Promise<void> {
  for (const i of incidents) {
    await run(
      session,
      "MERGE (n:Incident {id: $id}) SET n.title = $title, n.date = $date, n.severity = $severity, n.rootCause = $rootCause, n.resolution = $resolution",
      { id: i.id, title: i.title, date: i.date, severity: i.severity, rootCause: i.rootCause, resolution: i.resolution },
    );
  }
  console.log(`    Incidents: ${incidents.length}`);
}

// ── 4. loadDocuments ─────────────────────────────────────────────────────────

async function loadDocuments(session: Session, docs: ParsedDocument[]): Promise<void> {
  let docCount = 0;
  let meetingCount = 0;
  let actionCount = 0;

  for (const doc of docs) {
    if (doc.type === "Document") {
      await run(
        session,
        `MERGE (n:Document {filePath: $filePath}) SET n.title = $title, n.summary = $summary, n.folder = $folder`,
        { filePath: doc.filePath, title: doc.title, summary: doc.summary, folder: doc.folder },
      );
      docCount++;
    } else {
      await run(
        session,
        `MERGE (n:MeetingNote {filePath: $filePath}) SET n.title = $title, n.summary = $summary, n.date = $date, n.topic = $topic`,
        {
          filePath: doc.filePath,
          title: doc.title,
          summary: doc.summary,
          date: doc.date ?? null,
          topic: doc.topic ?? null,
        },
      );
      meetingCount++;

      // Action items
      if (doc.actionItems && doc.actionItems.length > 0) {
        for (const ai of doc.actionItems) {
          await run(
            session,
            `MERGE (a:ActionItem {description: $description})
             SET a.assignee = $assignee, a.status = $status
             WITH a
             MATCH (m:MeetingNote {filePath: $filePath})
             MERGE (m)-[:PRODUCED]->(a)`,
            {
              description: ai.description,
              assignee: ai.assignee,
              status: ai.status,
              filePath: doc.filePath,
            },
          );

          // Link assignee to person if we can match
          if (ai.assignee) {
            await run(
              session,
              `MATCH (p:Person) WHERE p.name STARTS WITH $assignee
               MATCH (a:ActionItem {description: $description})
               MERGE (a)-[:ASSIGNED_TO]->(p)`,
              { assignee: ai.assignee, description: ai.description },
            );
          }

          actionCount++;
        }
      }
    }
  }
  console.log(`    Documents: ${docCount}, MeetingNotes: ${meetingCount}, ActionItems: ${actionCount}`);
}

// ── 5. Relationship loaders ──────────────────────────────────────────────────

async function loadDomainContains(session: Session, docs: ParsedDocument[]): Promise<void> {
  let count = 0;
  for (const doc of docs) {
    const folder = doc.folder;
    if (!folder) continue;
    const label = doc.type === "MeetingNote" ? "MeetingNote" : "Document";
    await run(
      session,
      `MATCH (d:Domain {name: $folder})
       MATCH (doc:${label} {filePath: $filePath})
       MERGE (d)-[:CONTAINS]->(doc)`,
      { folder, filePath: doc.filePath },
    );
    count++;
  }
  console.log(`    CONTAINS: ${count}`);
}

async function loadCrossRefs(session: Session, docs: ParsedDocument[]): Promise<void> {
  let count = 0;
  for (const doc of docs) {
    if (doc.crossRefs.length === 0) continue;
    const sourceLabel = doc.type === "MeetingNote" ? "MeetingNote" : "Document";
    for (const ref of doc.crossRefs) {
      const refBasename = basename(ref);
      const result = await session.run(
        `MATCH (src:${sourceLabel} {filePath: $srcPath})
         OPTIONAL MATCH (tgtDoc:Document) WHERE tgtDoc.filePath ENDS WITH $refBase
         OPTIONAL MATCH (tgtMN:MeetingNote) WHERE tgtMN.filePath ENDS WITH $refBase
         WITH src, coalesce(tgtDoc, tgtMN) AS tgt
         WHERE tgt IS NOT NULL
         MERGE (src)-[:REFERENCES]->(tgt)
         RETURN count(*) AS cnt`,
        { srcPath: doc.filePath, refBase: refBasename },
      );
      if (result.records.length > 0 && result.records[0].get("cnt").toNumber() > 0) {
        count++;
      }
    }
  }
  console.log(`    REFERENCES: ${count}`);
}

async function loadEmploysRelationships(session: Session): Promise<void> {
  let count = 0;
  for (const p of people) {
    await run(
      session,
      `MATCH (o:Organization {name: $org})
       MATCH (p:Person {name: $name})
       MERGE (o)-[:EMPLOYS]->(p)`,
      { org: p.org, name: p.name },
    );
    count++;
  }
  console.log(`    EMPLOYS: ${count}`);
}

async function loadOwnsRelationships(session: Session): Promise<void> {
  const owns = [
    { person: "Clint Johnson", domain: "Migration" },
    { person: "Clint Johnson", domain: "OpenLoop" },
  ];
  for (const o of owns) {
    await run(
      session,
      `MATCH (p:Person {name: $person})
       MATCH (d:Domain {name: $domain})
       MERGE (p)-[:OWNS]->(d)`,
      { person: o.person, domain: o.domain },
    );
  }
  console.log(`    OWNS: ${owns.length}`);
}

async function loadUsesRelationships(session: Session): Promise<void> {
  let count = 0;

  for (const t of technologies) {
    await run(
      session,
      `MATCH (o:Organization {name: $org})
       MATCH (t:Technology {name: $tech})
       MERGE (o)-[:USES]->(t)`,
      { org: "OpenLoop", tech: t.name },
    );
    count++;
  }

  const medplumTech = [
    "TypeScript", "PostgreSQL", "AWS CDK", "ECS Fargate",
    "Medplum Bots", "FHIR Subscriptions", "Medplum SDK", "FHIR R4",
    "BullMQ", "FHIRcast", "MCP", "Medplum React", "Medplum CLI",
    "pdfmake", "ElastiCache Redis", "Docker",
  ];
  for (const tech of medplumTech) {
    await run(
      session,
      `MATCH (o:Organization {name: $org})
       MATCH (t:Technology {name: $tech})
       MERGE (o)-[:USES]->(t)`,
      { org: "Medplum", tech },
    );
    count++;
  }

  await run(
    session,
    `MATCH (o:Organization {name: $org})
     MATCH (t:Technology {name: $tech})
     MERGE (o)-[:USES]->(t)`,
    { org: "Healthie", tech: "GraphQL" },
  );
  count++;

  console.log(`    USES: ${count}`);
}

async function loadProvidesRelationships(session: Session): Promise<void> {
  const vendorOrgMap: Record<string, string> = {
    Stripe: "Stripe",
    ChargeBee: "ChargeBee",
    "Candid Health": "Candid Health",
    "Health Gorilla": "Health Gorilla",
    "Photon Health": "Photon Health",
    DoseSpot: "DoseSpot",
    "Doxy.me": "Doxy.me",
    AWS: "AWS",
    Datadog: "Datadog",
    OpenAI: "OpenAI",
    Medplum: "Medplum",
  };

  let count = 0;
  for (const integ of integrations) {
    const orgName = vendorOrgMap[integ.vendor];
    if (!orgName) continue;
    await run(
      session,
      `MATCH (o:Organization {name: $org})
       MATCH (i:Integration {name: $integ})
       MERGE (o)-[:PROVIDES]->(i)`,
      { org: orgName, integ: integ.name },
    );
    count++;
  }
  console.log(`    PROVIDES: ${count}`);
}

async function loadTechMappings(session: Session): Promise<void> {
  for (const tm of techMappings) {
    await run(
      session,
      `MATCH (f:Technology {name: $from})
       MATCH (t:Technology {name: $to})
       MERGE (f)-[:MAPS_TO]->(t)`,
      { from: tm.from, to: tm.to },
    );
  }
  console.log(`    MAPS_TO: ${techMappings.length}`);
}

async function loadMigratingFrom(session: Session): Promise<void> {
  await run(
    session,
    `MATCH (ol:Organization {name: $ol})
     MATCH (h:Organization {name: $h})
     MERGE (ol)-[:MIGRATING_FROM]->(h)`,
    { ol: "OpenLoop", h: "Healthie" },
  );
  await run(
    session,
    `MATCH (ol:Organization {name: $ol})
     MATCH (m:Organization {name: $m})
     MERGE (ol)-[:MIGRATING_TO]->(m)`,
    { ol: "OpenLoop", m: "Medplum" },
  );
  console.log(`    MIGRATING_FROM: 1, MIGRATING_TO: 1`);
}

async function loadPhaseDependencies(session: Session): Promise<void> {
  let count = 0;
  for (const n of [1, 2, 3]) {
    await run(
      session,
      `MATCH (curr:Phase {number: $curr})
       MATCH (prev:Phase {number: $prev})
       MERGE (curr)-[:DEPENDS_ON]->(prev)`,
      { curr: neo4j.int(n), prev: neo4j.int(n - 1) },
    );
    count++;
  }
  console.log(`    DEPENDS_ON: ${count}`);
}

async function loadDecisionDocLinks(session: Session): Promise<void> {
  let count = 0;
  for (const d of decisions) {
    await run(
      session,
      `MATCH (dec:Decision {id: $id})
       MATCH (doc:Document) WHERE doc.filePath ENDS WITH $suffix
       MERGE (dec)-[:DECIDED_IN]->(doc)`,
      { id: d.id, suffix: "Architecture.md" },
    );
    count++;
  }
  console.log(`    DECIDED_IN: ${count}`);
}

async function loadMentions(session: Session, docs: ParsedDocument[]): Promise<void> {
  let count = 0;

  const entities: { name: string; label: string }[] = [
    ...technologies.map((t) => ({ name: t.name, label: "Technology" })),
    ...organizations.map((o) => ({ name: o.name, label: "Organization" })),
    ...integrations.map((i) => ({ name: i.name, label: "Integration" })),
    ...people.map((p) => ({ name: p.name, label: "Person" })),
    ...fhirResources.map((f) => ({ name: f.name, label: "FhirResource" })),
  ];

  for (const doc of docs) {
    const content = readFileSync(doc.filePath, "utf-8");
    const docLabel = doc.type === "MeetingNote" ? "MeetingNote" : "Document";

    for (const entity of entities) {
      // Count occurrences for weighted MENTIONS
      const regex = new RegExp(entity.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
      const matches = content.match(regex);
      if (matches && matches.length > 0) {
        await run(
          session,
          `MATCH (doc:${docLabel} {filePath: $filePath})
           MATCH (e:${entity.label} {name: $entityName})
           MERGE (doc)-[r:MENTIONS]->(e)
           SET r.count = $count`,
          { filePath: doc.filePath, entityName: entity.name, count: neo4j.int(matches.length) },
        );
        count++;
      }
    }
  }
  console.log(`    MENTIONS: ${count}`);
}

async function loadMeetingAttendees(session: Session, docs: ParsedDocument[]): Promise<void> {
  let count = 0;
  const meetingDocs = docs.filter((d) => d.type === "MeetingNote");

  for (const doc of meetingDocs) {
    const content = readFileSync(doc.filePath, "utf-8");
    for (const p of people) {
      if (content.includes(p.name)) {
        await run(
          session,
          `MATCH (m:MeetingNote {filePath: $filePath})
           MATCH (p:Person {name: $name})
           MERGE (m)-[:ATTENDED_BY]->(p)`,
          { filePath: doc.filePath, name: p.name },
        );
        count++;
      }
    }
  }
  console.log(`    ATTENDED_BY: ${count}`);
}

// ── 6. New relationship loaders ──────────────────────────────────────────────

async function loadMemberOf(session: Session): Promise<void> {
  let count = 0;
  for (const p of people) {
    if (!p.team) continue;
    await run(
      session,
      `MATCH (p:Person {name: $name})
       MATCH (t:Team {name: $team})
       MERGE (p)-[:MEMBER_OF]->(t)`,
      { name: p.name, team: p.team },
    );
    count++;
  }
  console.log(`    MEMBER_OF: ${count}`);
}

async function loadReportsTo(session: Session): Promise<void> {
  let count = 0;
  for (const p of people) {
    if (!p.reportsTo) continue;
    await run(
      session,
      `MATCH (p:Person {name: $name})
       MATCH (mgr:Person {name: $mgr})
       MERGE (p)-[:REPORTS_TO]->(mgr)`,
      { name: p.name, mgr: p.reportsTo },
    );
    count++;
  }
  console.log(`    REPORTS_TO: ${count}`);
}

async function loadTeamHierarchy(session: Session): Promise<void> {
  let count = 0;
  for (const t of teams) {
    if (!t.parent) continue;
    await run(
      session,
      `MATCH (child:Team {name: $child})
       MATCH (parent:Team {name: $parent})
       MERGE (child)-[:PART_OF]->(parent)`,
      { child: t.name, parent: t.parent },
    );
    count++;
  }
  // Also link team lead
  for (const t of teams) {
    await run(
      session,
      `MATCH (t:Team {name: $team})
       MATCH (p:Person {name: $lead})
       MERGE (p)-[:LEADS]->(t)`,
      { team: t.name, lead: t.lead },
    );
  }
  console.log(`    PART_OF: ${count}, LEADS: ${teams.length}`);
}

async function loadProjectDomainLinks(session: Session): Promise<void> {
  let count = 0;
  for (const p of projects) {
    await run(
      session,
      `MATCH (pr:Project {name: $name})
       MATCH (d:Domain {name: $domain})
       MERGE (d)-[:CONTAINS]->(pr)`,
      { name: p.name, domain: p.domain },
    );
    count++;
  }
  console.log(`    Project CONTAINS: ${count}`);
}

async function loadDecidedFor(session: Session): Promise<void> {
  let count = 0;
  for (const d of decisions) {
    if (!d.project) continue;
    await run(
      session,
      `MATCH (dec:Decision {id: $id})
       MATCH (pr:Project {name: $project})
       MERGE (dec)-[:DECIDED_FOR]->(pr)`,
      { id: d.id, project: d.project },
    );
    count++;
  }
  console.log(`    DECIDED_FOR: ${count}`);
}

async function loadThreatens(session: Session): Promise<void> {
  let count = 0;
  for (const r of risks) {
    if (!r.project) continue;
    await run(
      session,
      `MATCH (risk:Risk {id: $id})
       MATCH (pr:Project {name: $project})
       MERGE (risk)-[:THREATENS]->(pr)`,
      { id: r.id, project: r.project },
    );
    count++;
  }
  console.log(`    THREATENS: ${count}`);
}

async function loadIncidentRelationships(session: Session): Promise<void> {
  let causedByCount = 0;
  let affectedCount = 0;
  let discussedCount = 0;

  for (const inc of incidents) {
    // CAUSED_BY
    if (inc.causedBy) {
      await run(
        session,
        `MATCH (i:Incident {id: $id})
         MATCH (t:Technology {name: $tech})
         MERGE (i)-[:CAUSED_BY]->(t)`,
        { id: inc.id, tech: inc.causedBy },
      );
      causedByCount++;
    }
    // AFFECTED
    if (inc.affectedOrgs) {
      for (const org of inc.affectedOrgs) {
        await run(
          session,
          `MATCH (i:Incident {id: $id})
           MATCH (o:Organization {name: $org})
           MERGE (i)-[:AFFECTED]->(o)`,
          { id: inc.id, org },
        );
        affectedCount++;
      }
    }
    // DISCUSSED_IN — match by date
    await run(
      session,
      `MATCH (i:Incident {id: $id})
       MATCH (m:MeetingNote) WHERE m.date = $date
       MERGE (i)-[:DISCUSSED_IN]->(m)`,
      { id: inc.id, date: inc.date },
    );
    discussedCount++;
  }
  console.log(`    CAUSED_BY: ${causedByCount}, AFFECTED: ${affectedCount}, DISCUSSED_IN: ${discussedCount}`);
}

async function loadTopics(session: Session, docs: ParsedDocument[]): Promise<void> {
  let topicCount = 0;
  let discussesCount = 0;
  const meetingDocs = docs.filter((d) => d.type === "MeetingNote");

  for (const doc of meetingDocs) {
    if (!doc.topics || doc.topics.length === 0) continue;
    for (const topic of doc.topics) {
      await run(
        session,
        `MERGE (t:Topic {name: $name})
         WITH t
         MATCH (m:MeetingNote {filePath: $filePath})
         MERGE (m)-[:DISCUSSES]->(t)`,
        { name: topic, filePath: doc.filePath },
      );
      topicCount++;
      discussesCount++;
    }
  }
  // Deduplicate count for topics
  const result = await session.run("MATCH (t:Topic) RETURN count(t) AS c");
  const uniqueTopics = result.records[0].get("c").toNumber();
  console.log(`    Topics: ${uniqueTopics}, DISCUSSES: ${discussesCount}`);
}

async function loadTemporalChain(session: Session): Promise<void> {
  let count = 0;
  // Get all meeting notes sorted by date
  const result = await session.run(
    "MATCH (m:MeetingNote) WHERE m.date IS NOT NULL RETURN m.filePath AS fp, m.date AS d ORDER BY m.date ASC",
  );
  const meetings = result.records.map((r) => ({
    filePath: r.get("fp"),
    date: r.get("d"),
  }));

  for (let i = 0; i < meetings.length - 1; i++) {
    await run(
      session,
      `MATCH (m1:MeetingNote {filePath: $fp1})
       MATCH (m2:MeetingNote {filePath: $fp2})
       MERGE (m1)-[:NEXT]->(m2)`,
      { fp1: meetings[i].filePath, fp2: meetings[i + 1].filePath },
    );
    count++;
  }
  console.log(`    NEXT: ${count}`);
}

// ── 7. main ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const shouldClear = process.argv.includes("--clear");

  console.log("Connecting to Memgraph at bolt://localhost:7687...");
  const driver = neo4j.driver("bolt://localhost:7687");
  const session = driver.session();

  try {
    if (shouldClear) {
      await clearGraph(session);
    }

    await createIndexes(session);

    console.log("  Parsing KB...");
    const docs = parseKB();
    console.log(`    Parsed ${docs.length} documents`);

    // Load entity nodes
    console.log("  Loading entity nodes...");
    await loadDomains(session);
    await loadPeople(session);
    await loadOrganizations(session);
    await loadTechnologies(session);
    await loadIntegrations(session);
    await loadFhirResources(session);
    await loadPhases(session);
    await loadRisks(session);
    await loadDecisions(session);
    await loadProjects(session);
    await loadTeams(session);
    await loadIncidents(session);

    // Load document nodes + topics
    console.log("  Loading documents...");
    await loadDocuments(session, docs);

    // Load relationships
    console.log("  Loading relationships...");
    await loadDomainContains(session, docs);
    await loadCrossRefs(session, docs);
    await loadEmploysRelationships(session);
    await loadOwnsRelationships(session);
    await loadUsesRelationships(session);
    await loadProvidesRelationships(session);
    await loadTechMappings(session);
    await loadMigratingFrom(session);
    await loadPhaseDependencies(session);
    await loadDecisionDocLinks(session);
    await loadMentions(session, docs);
    await loadMeetingAttendees(session, docs);

    // New relationships
    console.log("  Loading enhanced relationships...");
    await loadMemberOf(session);
    await loadReportsTo(session);
    await loadTeamHierarchy(session);
    await loadProjectDomainLinks(session);
    await loadDecidedFor(session);
    await loadThreatens(session);
    await loadIncidentRelationships(session);
    await loadTopics(session, docs);
    await loadTemporalChain(session);

    // Print summary
    console.log("\n=== Summary ===");

    const nodeResult = await session.run("MATCH (n) RETURN count(n) AS total");
    const totalNodes = nodeResult.records[0].get("total").toNumber();

    const relResult = await session.run("MATCH ()-[r]->() RETURN count(r) AS total");
    const totalRels = relResult.records[0].get("total").toNumber();

    console.log(`Total nodes: ${totalNodes}`);
    console.log(`Total relationships: ${totalRels}`);

    const labelResult = await session.run(
      "MATCH (n) RETURN labels(n)[0] AS label, count(n) AS cnt ORDER BY cnt DESC",
    );
    console.log("Nodes by label:");
    for (const rec of labelResult.records) {
      console.log(`  ${rec.get("label")}: ${rec.get("cnt").toNumber()}`);
    }

    // Relationship type summary
    const relTypeResult = await session.run(
      "MATCH ()-[r]->() RETURN type(r) AS t, count(r) AS cnt ORDER BY cnt DESC",
    );
    console.log("Relationships by type:");
    for (const rec of relTypeResult.records) {
      console.log(`  ${rec.get("t")}: ${rec.get("cnt").toNumber()}`);
    }

    console.log("\nDone.");
  } finally {
    await session.close();
    await driver.close();
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
