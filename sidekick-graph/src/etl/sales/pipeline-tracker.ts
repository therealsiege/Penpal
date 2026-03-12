import { GraphImporter } from "../graph/importer.js";
import { buildSalesStageNode, SalesStageData } from "../graph/node-builder.js";
import { buildCurrentStageRel } from "../graph/rel-builder.js";
import { normalizeName } from "../../shared/utils/normalize.js";

/** Canonical sales stages in order */
export const SALES_STAGES: SalesStageData[] = [
  { name: "Outreach", order: 1 },
  { name: "Qualified", order: 2 },
  { name: "Demo", order: 3 },
  { name: "Proposal", order: 4 },
  { name: "Closed Won", order: 5 },
  { name: "Closed Lost", order: 6 },
];

/** Map various funnel string values to canonical stage names */
const FUNNEL_MAPPING: Record<string, string> = {
  "outreach": "Outreach",
  "cold outreach": "Outreach",
  "initial outreach": "Outreach",
  "prospecting": "Outreach",
  "prospect": "Outreach",
  "qualified": "Qualified",
  "qualification": "Qualified",
  "qualified lead": "Qualified",
  "demo": "Demo",
  "demo scheduled": "Demo",
  "demo completed": "Demo",
  "demonstration": "Demo",
  "proposal": "Proposal",
  "proposal sent": "Proposal",
  "negotiation": "Proposal",
  "contract": "Proposal",
  "closed won": "Closed Won",
  "won": "Closed Won",
  "closed": "Closed Won",
  "customer": "Closed Won",
  "closed lost": "Closed Lost",
  "lost": "Closed Lost",
  "dead": "Closed Lost",
  "inactive": "Closed Lost",
};

/** Resolve a funnel string to a canonical stage name */
export function resolveStage(funnelValue: string): string | null {
  if (!funnelValue) return null;
  const normalized = normalizeName(funnelValue);
  return FUNNEL_MAPPING[normalized] || null;
}

/** Seed SalesStage nodes into the graph */
export function seedSalesStages(importer: GraphImporter): void {
  for (const stage of SALES_STAGES) {
    importer.addNode(buildSalesStageNode(stage));
  }
}

/** Create CURRENT_STAGE relationship for a lead based on its salesFunnel value */
export function trackLeadStage(
  importer: GraphImporter,
  leadName: string,
  leadCompany: string,
  salesFunnel: string,
): void {
  const stageName = resolveStage(salesFunnel);
  if (stageName) {
    importer.addRel(buildCurrentStageRel(leadName, leadCompany, stageName));
  }
}
