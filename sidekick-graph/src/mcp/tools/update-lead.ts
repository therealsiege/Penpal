import fs from "fs";
import path from "path";
import { getDriver } from "../../shared/connections.js";
import { config, resolveVaultPath } from "../../shared/config.js";
import { stableId } from "../../shared/utils/id.js";
import { normalizeName } from "../../shared/utils/normalize.js";

export const updateLeadSchema = {
  name: "update_lead",
  description:
    "Update a lead in the sales pipeline. Can change stage, priority, notes, or next action. Updates both the vault markdown file and Memgraph.",
  inputSchema: {
    type: "object" as const,
    properties: {
      name: {
        type: "string",
        description: "Lead name (company or person name)",
      },
      company: {
        type: "string",
        description: "Company name (if different from lead name)",
      },
      stage: {
        type: "string",
        enum: ["Outreach", "Intro", "Discovery", "Warming", "Negotiating", "Won", "Lost"],
        description: "New sales pipeline stage",
      },
      notes: {
        type: "string",
        description: "Notes to append to the lead",
      },
      priority: {
        type: "string",
        enum: ["Cold", "Warm", "Hot"],
        description: "New priority level",
      },
      nextAction: {
        type: "string",
        description: "Next action item for this lead",
      },
    },
    required: ["name"],
  },
};

const PRIORITY_EMOJI: Record<string, string> = {
  Cold: "🔵 Cold",
  Warm: "🟡 Warm",
  Hot: "🔥 Hot",
};

const STAGE_MAP: Record<string, string> = {
  Outreach: "Outreach",
  Intro: "Qualified",
  Discovery: "Demo",
  Warming: "Demo",
  Negotiating: "Proposal",
  Won: "Closed Won",
  Lost: "Closed Lost",
};

export async function updateLead(args: {
  name: string;
  company?: string;
  stage?: string;
  notes?: string;
  priority?: string;
  nextAction?: string;
}): Promise<string> {
  const leadName = args.name;
  const company = args.company || leadName;
  const updates: string[] = [];

  // 1. Find the lead markdown file in vault
  const leadsDirs = [
    resolveVaultPath("Ventures/1Putt/MedScrub KB/Sales/Leads"),
    resolveVaultPath("Ventures/1Putt/Sales/Leads"),
  ];

  let leadFilePath: string | null = null;
  const normalizedSearch = normalizeName(leadName);

  for (const dir of leadsDirs) {
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith(".md")) continue;
      const nameMatch = file.match(/^(.+?)\s+[a-f0-9]{32}\.md$/);
      if (nameMatch && normalizeName(nameMatch[1]) === normalizedSearch) {
        leadFilePath = path.join(dir, file);
        break;
      }
    }
    if (leadFilePath) break;
  }

  // 2. Update markdown file if found
  if (leadFilePath) {
    let content = fs.readFileSync(leadFilePath, "utf-8");

    if (args.stage) {
      content = content.replace(/^Sales Funnel: .*/m, `Sales Funnel: ${args.stage}`);
      updates.push(`Stage → ${args.stage}`);
    }

    if (args.priority) {
      const emoji = PRIORITY_EMOJI[args.priority] || args.priority;
      content = content.replace(/^Priority: .*/m, `Priority: ${emoji}`);
      updates.push(`Priority → ${emoji}`);
    }

    if (args.nextAction) {
      if (content.match(/^Next Action: .*/m)) {
        content = content.replace(/^Next Action: .*/m, `Next Action: ${args.nextAction}`);
      } else {
        content += `\nNext Action: ${args.nextAction}`;
      }
      updates.push(`Next Action → ${args.nextAction}`);
    }

    if (args.notes) {
      const existingNotes = content.match(/^Notes: (.*)$/m);
      if (existingNotes) {
        const updated = `${existingNotes[1]} | ${new Date().toLocaleDateString()}: ${args.notes}`;
        content = content.replace(/^Notes: .*/m, `Notes: ${updated}`);
      } else {
        content += `\nNotes: ${args.notes}`;
      }
      updates.push(`Notes appended`);
    }

    fs.writeFileSync(leadFilePath, content, "utf-8");
  } else {
    updates.push("(Markdown file not found in vault)");
  }

  // 3. Update Memgraph node
  const driver = getDriver();
  const session = driver.session();

  try {
    const leadId = stableId("Lead", normalizeName(leadName), normalizeName(company));
    const setClause: string[] = [];
    const params: Record<string, unknown> = { leadId };

    if (args.stage) {
      setClause.push("l.salesFunnel = $stage");
      params.stage = args.stage;

      // Update CURRENT_STAGE relationship
      const canonicalStage = STAGE_MAP[args.stage] || args.stage;
      const stageId = stableId("SalesStage", normalizeName(canonicalStage));
      await session.run(
        `MATCH (l:Lead {id: $leadId})-[r:CURRENT_STAGE]->(:SalesStage)
         DELETE r`,
        { leadId },
      );
      await session.run(
        `MATCH (l:Lead {id: $leadId}), (s:SalesStage {id: $stageId})
         MERGE (l)-[:CURRENT_STAGE]->(s)`,
        { leadId, stageId },
      );
    }

    if (args.priority) {
      setClause.push("l.priority = $priority");
      params.priority = args.priority;
    }

    if (args.nextAction) {
      setClause.push("l.nextAction = $nextAction");
      params.nextAction = args.nextAction;
    }

    if (args.notes) {
      setClause.push("l.notes = l.notes + ' | ' + $notes");
      params.notes = `${new Date().toLocaleDateString()}: ${args.notes}`;
    }

    if (setClause.length > 0) {
      await session.run(
        `MATCH (l:Lead {id: $leadId})
         SET ${setClause.join(", ")}`,
        params,
      );
      updates.push("Memgraph updated");
    }
  } catch (err) {
    updates.push(`Memgraph error: ${(err as Error).message}`);
  } finally {
    await session.close();
  }

  return `Updated lead "${leadName}": ${updates.join(", ")}`;
}
