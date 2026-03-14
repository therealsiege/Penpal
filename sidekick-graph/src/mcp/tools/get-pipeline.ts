import { getDriver } from "../../shared/connections.js";

export const getPipelineSchema = {
  name: "get_pipeline",
  description:
    "Full CRM pipeline view. Returns leads grouped by pipeline stage with scores, next actions, and company info. Can filter by stage, business arm, or minimum score.",
  inputSchema: {
    type: "object" as const,
    properties: {
      stage: {
        type: "string",
        description: "Filter by pipeline stage (e.g., Outreach, Qualified, Demo, Proposal, Closed Won)",
      },
      businessArm: {
        type: "string",
        description: "Filter by business arm (e.g., MedScrub, OpenLoop)",
      },
      minScore: {
        type: "number",
        description: "Only show leads with score >= this value",
      },
    },
    required: [],
  },
};

interface PipelineLead {
  name: string;
  company: string;
  stage: string;
  score: number | null;
  priority: string;
  nextAction: string;
  leadSource: string;
  location: string;
  businessArm: string;
}

interface PipelineStage {
  stage: string;
  order: number;
  count: number;
  avgScore: number;
  leads: PipelineLead[];
}

export async function getPipeline(args: {
  stage?: string;
  businessArm?: string;
  minScore?: number;
}): Promise<string> {
  const driver = getDriver();
  const session = driver.session();

  try {
    const whereClauses: string[] = [];
    const params: Record<string, unknown> = {};

    if (args.stage) {
      whereClauses.push("s.name = $stage");
      params.stage = args.stage;
    }
    if (args.businessArm) {
      whereClauses.push("l.businessArm CONTAINS $businessArm");
      params.businessArm = args.businessArm;
    }
    if (args.minScore !== undefined) {
      whereClauses.push("l.leadScore >= $minScore");
      params.minScore = args.minScore;
    }

    const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    const result = await session.run(
      `MATCH (s:SalesStage)
       OPTIONAL MATCH (l:Lead)-[:CURRENT_STAGE]->(s)
       ${whereStr}
       WITH s.name AS stage, s.order AS stageOrder,
            l.name AS name, l.company AS company,
            l.leadScore AS score, l.priority AS priority,
            l.nextAction AS nextAction, l.leadSource AS leadSource,
            l.location AS location, l.businessArm AS businessArm
       RETURN stage, stageOrder, name, company, score, priority,
              nextAction, leadSource, location, businessArm
       ORDER BY stageOrder, score DESC`,
      params,
    );

    // Group by stage
    const stageMap = new Map<string, PipelineStage>();

    for (const record of result.records) {
      const stageName = record.get("stage") as string;
      const rawOrder = record.get("stageOrder");
      const stageOrder = rawOrder && typeof rawOrder === "object" && "toNumber" in rawOrder
        ? (rawOrder as { toNumber(): number }).toNumber()
        : typeof rawOrder === "number"
          ? rawOrder
          : 0;

      if (!stageMap.has(stageName)) {
        stageMap.set(stageName, {
          stage: stageName,
          order: stageOrder,
          count: 0,
          avgScore: 0,
          leads: [],
        });
      }

      const stage = stageMap.get(stageName)!;
      const name = record.get("name") as string | null;

      if (name) {
        const rawScore = record.get("score");
        const score = rawScore && typeof rawScore === "object" && "toNumber" in rawScore
          ? (rawScore as { toNumber(): number }).toNumber()
          : typeof rawScore === "number"
            ? rawScore
            : null;

        stage.leads.push({
          name,
          company: (record.get("company") as string) || "",
          stage: stageName,
          score,
          priority: (record.get("priority") as string) || "",
          nextAction: (record.get("nextAction") as string) || "",
          leadSource: (record.get("leadSource") as string) || "",
          location: (record.get("location") as string) || "",
          businessArm: (record.get("businessArm") as string) || "",
        });
        stage.count++;
      }
    }

    // Calculate averages and format
    const stages = [...stageMap.values()].sort((a, b) => a.order - b.order);

    for (const stage of stages) {
      const scores = stage.leads
        .map((l) => l.score)
        .filter((s): s is number => s !== null);
      stage.avgScore = scores.length > 0
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : 0;
    }

    // Build summary
    const totalLeads = stages.reduce((sum, s) => sum + s.count, 0);
    const summary = {
      totalLeads,
      stages: stages.map((s) => ({
        stage: s.stage,
        count: s.count,
        avgScore: s.avgScore,
        leads: s.leads.slice(0, 20), // Cap at 20 per stage for readability
      })),
    };

    return JSON.stringify(summary, null, 2);
  } finally {
    await session.close();
  }
}
