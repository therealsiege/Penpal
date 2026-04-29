import { getDriver } from "../../shared/connections.js";

export const leadDetailSchema = {
  name: "lead_detail",
  description:
    "Get full lead profile including relationships, event history, related documents, stage history, and suggested next actions based on current pipeline stage.",
  inputSchema: {
    type: "object" as const,
    properties: {
      leadId: {
        type: "string",
        description: "The lead name to look up (e.g., 'Dr. Smith Family Practice')",
      },
    },
    required: ["leadId"],
  },
};

function suggestedNextActions(stage: string): string[] {
  switch (stage.toLowerCase()) {
    case "outreach":
      return [
        "Send personalized intro email",
        "Research their EHR pain points",
        "Check NPI registry for practice details",
      ];
    case "qualified":
      return [
        "Schedule discovery call",
        "Prepare demo environment",
        "Identify decision makers",
      ];
    case "demo":
      return [
        "Send proposal with ROI analysis",
        "Identify decision makers",
        "Prepare implementation timeline",
      ];
    case "proposal":
      return [
        "Follow up on proposal",
        "Address objections",
        "Offer pilot program",
      ];
    case "negotiation":
      return [
        "Finalize contract terms",
        "Schedule implementation kickoff",
        "Prepare onboarding materials",
      ];
    case "closed won":
      return [
        "Begin onboarding",
        "Schedule training sessions",
        "Set up success metrics",
      ];
    case "closed lost":
      return [
        "Document loss reasons",
        "Schedule re-engagement in 90 days",
        "Analyze competitive positioning",
      ];
    default:
      return [
        "Review lead profile",
        "Determine appropriate pipeline stage",
        "Assign to business arm",
      ];
  }
}

export async function leadDetail(args: { leadId: string }): Promise<string> {
  const driver = getDriver();
  const session = driver.session();

  try {
    // Main lead query
    const result = await session.run(
      `MATCH (l:Lead)
       WHERE l.name = $name
       OPTIONAL MATCH (l)-[:CURRENT_STAGE]->(s:SalesStage)
       OPTIONAL MATCH (l)-[:USES_EHR]->(e:EHRSystem)
       OPTIONAL MATCH (l)-[:LOCATED_IN]->(t:Territory)
       OPTIONAL MATCH (l)-[:WORKS_AT]->(c:Company)
       RETURN l, s.name AS stage, e.name AS ehr,
              t.name AS territory, c.name AS companyNode`,
      { name: args.leadId },
    );

    if (result.records.length === 0) {
      return JSON.stringify({
        error: "Lead not found",
        leadId: args.leadId,
        suggestion: "Use search_leads to find the correct lead name.",
      });
    }

    const r = result.records[0];
    const l = r.get("l").properties;

    // Fetch related data in parallel
    const [eventsResult, docsResult, historyResult] = await Promise.all([
      session.run(
        `MATCH (l:Lead {name: $name})-[:HAD_EVENT]->(ev:Event)
         RETURN ev.type AS type, ev.date AS date, ev.detail AS detail
         ORDER BY ev.date DESC LIMIT 20`,
        { name: args.leadId },
      ),
      session.run(
        `MATCH (l:Lead {name: $name})<-[:ABOUT_LEAD]-(d:Document)
         RETURN d.title AS title, d.path AS path
         ORDER BY d.title LIMIT 20`,
        { name: args.leadId },
      ),
      session.run(
        `MATCH (l:Lead {name: $name})-[:ENTERED_STAGE]->(s:SalesStage)
         RETURN s.name AS stage, s.enteredAt AS enteredAt
         ORDER BY s.enteredAt DESC`,
        { name: args.leadId },
      ),
    ]);

    const stage = r.get("stage") ?? "";
    const updatedAt = l.updatedAt ?? l.createdAt ?? "";
    const daysSinceUpdate = updatedAt
      ? Math.floor((Date.now() - new Date(String(updatedAt)).getTime()) / (1000 * 60 * 60 * 24))
      : null;

    const lead = {
      name: String(l.name ?? ""),
      company: String(l.company ?? ""),
      score: toNum(l.leadScore),
      businessArm: String(l.businessArm ?? ""),
      stage,
      ehr: r.get("ehr") ?? "",
      location: String(l.location ?? ""),
      territory: r.get("territory") ?? "",
      nextAction: String(l.nextAction ?? ""),
      source: String(l.leadSource ?? ""),
      npi: String(l.npi ?? ""),
      phone: String(l.phone ?? ""),
      specialty: String(l.specialty ?? ""),
      website: String(l.website ?? ""),
      events: eventsResult.records.map((e) => ({
        type: e.get("type") ?? "",
        date: e.get("date") ?? "",
        detail: e.get("detail") ?? "",
      })),
      documents: docsResult.records.map((d) => ({
        title: d.get("title") ?? "",
        path: d.get("path") ?? "",
      })),
      stageHistory: historyResult.records.map((h) => ({
        stage: h.get("stage") ?? "",
        enteredAt: h.get("enteredAt") ?? "",
      })),
      suggestedNextActions: suggestedNextActions(stage),
      dataFreshness: {
        lastUpdated: updatedAt ? String(updatedAt) : "unknown",
        daysSinceUpdate,
        status:
          daysSinceUpdate === null
            ? "unknown"
            : daysSinceUpdate <= 7
              ? "fresh"
              : daysSinceUpdate <= 30
                ? "aging"
                : "stale",
      },
    };

    return JSON.stringify(lead, null, 2);
  } finally {
    await session.close();
  }
}

function toNum(val: unknown): number {
  if (val && typeof val === "object" && "toNumber" in val) {
    return (val as { toNumber(): number }).toNumber();
  }
  return typeof val === "number" ? val : 0;
}
