/**
 * Daily Intelligence Briefing
 *
 * Queries the Memgraph knowledge graph and generates a daily
 * markdown briefing with pipeline summary, hot leads, territory
 * breakdown, competitive signals, and action items.
 *
 * Usage:
 *   npm run briefing
 */

import fs from "fs";
import path from "path";
import { resolveVaultPath } from "../../shared/config.js";
import { getDriver, verifyConnection, closeConnections } from "../../shared/connections.js";
import { ventureProfiles, businessArmLabel } from "./venture-config.js";
import { SALES_STAGES } from "./pipeline-tracker.js";

// ─── Helpers ────────────────────────────────────────────────────────────────

function toNumber(val: unknown): number {
  if (val && typeof val === "object" && "toNumber" in val) {
    return (val as { toNumber(): number }).toNumber();
  }
  return typeof val === "number" ? val : 0;
}

function toString(val: unknown): string {
  if (val == null) return "";
  return String(val);
}

const today = new Date().toISOString().split("T")[0];
const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

// ─── Section Builders ───────────────────────────────────────────────────────

async function pipelineSummary(session: ReturnType<ReturnType<typeof getDriver>["session"]>): Promise<string> {
  const result = await session.run(`
    MATCH (l:Lead)-[:CURRENT_STAGE]->(s:SalesStage)
    RETURN s.name AS stage, s.order AS stageOrder,
           l.businessArm AS businessArm,
           count(l) AS cnt,
           avg(l.leadScore) AS avgScore
    ORDER BY s.order
  `);

  const stageData = new Map<string, { total: number; avgScore: number; byArm: Map<string, number> }>();

  for (const record of result.records) {
    const stage = toString(record.get("stage"));
    const arm = toString(record.get("businessArm"));
    const cnt = toNumber(record.get("cnt"));
    const avg = toNumber(record.get("avgScore"));

    if (!stageData.has(stage)) {
      stageData.set(stage, { total: 0, avgScore: 0, byArm: new Map() });
    }
    const entry = stageData.get(stage)!;
    entry.total += cnt;
    entry.avgScore = Math.round(avg);
    entry.byArm.set(arm || "Unassigned", cnt);
  }

  let md = "## Pipeline Summary\n\n";
  md += "| Stage | Total | Avg Score | Breakdown |\n";
  md += "|-------|------:|----------:|----------|\n";

  let grandTotal = 0;
  for (const stageInfo of SALES_STAGES) {
    const data = stageData.get(stageInfo.name);
    if (!data) {
      md += `| ${stageInfo.name} | 0 | - | - |\n`;
      continue;
    }
    grandTotal += data.total;
    const breakdown = [...data.byArm.entries()]
      .map(([arm, cnt]) => `${arm}: ${cnt}`)
      .join(", ");
    md += `| ${stageInfo.name} | ${data.total} | ${data.avgScore} | ${breakdown} |\n`;
  }

  md += `\n**Total leads in pipeline: ${grandTotal}**\n`;
  return md;
}

async function newLeads(session: ReturnType<ReturnType<typeof getDriver>["session"]>): Promise<string> {
  const result = await session.run(
    `MATCH (l:Lead)
     WHERE l.createdAt >= $since
     RETURN l.name AS name, l.company AS company,
            l.businessArm AS businessArm, l.leadScore AS score,
            l.leadSource AS source
     ORDER BY l.leadScore DESC
     LIMIT 20`,
    { since: since24h },
  );

  if (result.records.length === 0) return "## New Leads (24h)\n\nNo new leads in the last 24 hours.\n";

  let md = "## New Leads (24h)\n\n";
  md += `| Name | Business Arm | Score | Source |\n`;
  md += `|------|-------------|------:|--------|\n`;

  for (const record of result.records) {
    md += `| ${toString(record.get("name"))} | ${toString(record.get("businessArm"))} | ${toNumber(record.get("score"))} | ${toString(record.get("source"))} |\n`;
  }

  return md;
}

async function hotLeads(session: ReturnType<ReturnType<typeof getDriver>["session"]>): Promise<string> {
  const result = await session.run(
    `MATCH (l:Lead)
     WHERE l.leadScore >= 45
     OPTIONAL MATCH (l)-[:CURRENT_STAGE]->(s:SalesStage)
     OPTIONAL MATCH (l)-[:USES_EHR]->(e:EHRSystem)
     RETURN l.name AS name, l.company AS company,
            l.leadScore AS score, l.businessArm AS businessArm,
            l.nextAction AS nextAction, s.name AS stage,
            e.name AS ehr
     ORDER BY l.leadScore DESC
     LIMIT 25`,
  );

  if (result.records.length === 0) return "## Hot Leads\n\nNo leads with score >= 45.\n";

  let md = "## Hot Leads (score >= 45)\n\n";
  md += `| Name | Arm | Score | Stage | EHR | Next Action |\n`;
  md += `|------|-----|------:|-------|-----|-------------|\n`;

  for (const record of result.records) {
    md += `| ${toString(record.get("name"))} | ${toString(record.get("businessArm"))} | ${toNumber(record.get("score"))} | ${toString(record.get("stage"))} | ${toString(record.get("ehr")) || "-"} | ${toString(record.get("nextAction"))} |\n`;
  }

  return md;
}

async function territoryBreakdown(session: ReturnType<ReturnType<typeof getDriver>["session"]>): Promise<string> {
  const result = await session.run(`
    MATCH (l:Lead)-[:LOCATED_IN]->(t:Territory)
    RETURN t.name AS territory, count(l) AS cnt,
           avg(l.leadScore) AS avgScore
    ORDER BY cnt DESC
  `);

  if (result.records.length === 0) return "## Territory Breakdown\n\nNo territory data available.\n";

  let md = "## Territory Breakdown\n\n";
  md += `| Territory | Leads | Avg Score |\n`;
  md += `|-----------|------:|----------:|\n`;

  for (const record of result.records) {
    md += `| ${toString(record.get("territory"))} | ${toNumber(record.get("cnt"))} | ${Math.round(toNumber(record.get("avgScore")))} |\n`;
  }

  return md;
}

async function competitiveSignals(session: ReturnType<ReturnType<typeof getDriver>["session"]>): Promise<string> {
  const result = await session.run(`
    MATCH (cp:CompetitorProduct)
    OPTIONAL MATCH (c:Company)-[:HAS_PRODUCT]->(cp)
    RETURN cp.name AS product, c.name AS company,
           cp.category AS category
    ORDER BY cp.name
    LIMIT 20
  `);

  if (result.records.length === 0) return "## Competitive Landscape\n\nNo competitor products tracked.\n";

  let md = "## Competitive Landscape\n\n";
  md += `| Product | Company | Category |\n`;
  md += `|---------|---------|----------|\n`;

  for (const record of result.records) {
    md += `| ${toString(record.get("product"))} | ${toString(record.get("company")) || "-"} | ${toString(record.get("category")) || "-"} |\n`;
  }

  return md;
}

async function actionItems(session: ReturnType<ReturnType<typeof getDriver>["session"]>): Promise<string> {
  const result = await session.run(`
    MATCH (l:Lead)
    WHERE l.nextAction IS NOT NULL AND l.nextAction <> ''
    RETURN l.name AS name, l.company AS company,
           l.nextAction AS nextAction, l.leadScore AS score,
           l.businessArm AS businessArm
    ORDER BY l.leadScore DESC
    LIMIT 30
  `);

  if (result.records.length === 0) return "## Action Items\n\nNo pending actions.\n";

  let md = "## Action Items\n\n";

  // Group by action type
  const grouped = new Map<string, Array<{ name: string; score: number; arm: string }>>();
  for (const record of result.records) {
    const action = toString(record.get("nextAction"));
    if (!grouped.has(action)) grouped.set(action, []);
    grouped.get(action)!.push({
      name: toString(record.get("name")),
      score: toNumber(record.get("score")),
      arm: toString(record.get("businessArm")),
    });
  }

  for (const [action, leads] of grouped.entries()) {
    md += `### ${action} (${leads.length})\n`;
    for (const lead of leads.slice(0, 5)) {
      md += `- ${lead.name} (${lead.arm}, score: ${lead.score})\n`;
    }
    if (leads.length > 5) md += `- ... and ${leads.length - 5} more\n`;
    md += "\n";
  }

  return md;
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log("╔══════════════════════════════════════╗");
  console.log("║   Daily Intelligence Briefing        ║");
  console.log("╚══════════════════════════════════════╝");
  console.log(`  Date: ${today}\n`);

  await verifyConnection();
  const driver = getDriver();
  const session = driver.session();

  const sections: string[] = [];
  sections.push(`# Daily Intelligence Briefing — ${today}\n`);

  const sectionBuilders = [
    { name: "Pipeline Summary", fn: pipelineSummary },
    { name: "New Leads (24h)", fn: newLeads },
    { name: "Hot Leads", fn: hotLeads },
    { name: "Territory Breakdown", fn: territoryBreakdown },
    { name: "Competitive Signals", fn: competitiveSignals },
    { name: "Action Items", fn: actionItems },
  ];

  for (const { name, fn } of sectionBuilders) {
    try {
      console.log(`  Building: ${name}...`);
      const md = await fn(session);
      sections.push(md);
    } catch (err) {
      console.warn(`  Failed: ${name} — ${(err as Error).message}`);
      sections.push(`## ${name}\n\nFailed to generate this section.\n`);
    }
  }

  await session.close();
  await closeConnections();

  // Write to vault
  const briefingDir = resolveVaultPath("1Putt/Daily Briefings");
  if (!fs.existsSync(briefingDir)) {
    fs.mkdirSync(briefingDir, { recursive: true });
  }

  const outputPath = path.join(briefingDir, `${today}.md`);
  const content = sections.join("\n---\n\n");
  fs.writeFileSync(outputPath, content, "utf-8");

  console.log(`\n  Briefing written to: ${outputPath}`);
  console.log(`  Sections: ${sectionBuilders.length}`);
}

main().catch((err) => {
  console.error("Briefing generation failed:", err);
  process.exit(1);
});
