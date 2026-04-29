/**
 * Intelligence Briefing
 *
 * Queries the Memgraph knowledge graph and local state files to generate
 * a briefing with: pipeline summary, new/hot leads, dispatched work
 * (GitHub pipeline + pod activity), competitive signals, and action items.
 *
 * Runs 3x/day after each ingestion cycle (7:30, 13:30, 19:30).
 *
 * Usage:
 *   npm run briefing
 */

import fs from "fs";
import path from "path";
import os from "os";
import { resolveVaultPath } from "../../shared/config.js";
import { getDriver, verifyConnection, closeConnections } from "../../shared/connections.js";
import { ventureProfiles, businessArmLabel } from "./venture-config.js";
import { SALES_STAGES } from "./pipeline-tracker.js";

// ─── Penpal state paths ────────────────────────────────────────────────────

const PENNY_DATA = path.resolve(os.homedir(), "sidekick", "Penpal", "data");
const PIPELINE_STATE = path.join(PENNY_DATA, "github-pipeline.json");
const POD_STATE = path.join(PENNY_DATA, "pod-workflows.json");
const TASK_QUEUE = path.join(PENNY_DATA, "task-queue.json");

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

// ─── Dispatch & Lab Work ───────────────────────────────────────────────

function readJsonSafe<T>(filePath: string, fallback: T): T {
  try {
    if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch { /* corrupted or missing */ }
  return fallback;
}

function dispatchWork(): string {
  let md = "## Dispatch Activity (24h)\n\n";

  // GitHub pipeline issues
  const pipeline = readJsonSafe<{ issues: Array<{
    number: number; repo: string; title: string; stage: string;
    size?: string; updatedAt: number; executorAttempts: number;
  }> }>(PIPELINE_STATE, { issues: [] });

  const recentIssues = pipeline.issues.filter(i => i.updatedAt > Date.now() - 24 * 60 * 60 * 1000);
  if (recentIssues.length > 0) {
    md += "### GitHub Issues\n\n";
    md += "| Issue | Stage | Size | Title |\n";
    md += "|-------|-------|------|-------|\n";
    for (const i of recentIssues.slice(0, 15)) {
      const emoji = i.stage === "done" ? "✅" : i.stage === "failed" ? "❌" : "⏳";
      md += `| ${i.repo}#${i.number} | ${emoji} ${i.stage} | ${i.size || "M"} | ${i.title.slice(0, 60)} |\n`;
    }
    const done = recentIssues.filter(i => i.stage === "done").length;
    const failed = recentIssues.filter(i => i.stage === "failed").length;
    const active = recentIssues.length - done - failed;
    md += `\n**${done} completed, ${failed} failed, ${active} in progress**\n\n`;
  } else {
    md += "No GitHub pipeline activity in the last 24h.\n\n";
  }

  // Pod workflows
  const pods = readJsonSafe<Array<{
    id: string; task: string; status: string; preset?: string;
    result?: string; createdAt?: number; updatedAt?: number;
  }>>(POD_STATE, []);

  const recentPods = pods.filter(p => (p.updatedAt || p.createdAt || 0) > Date.now() - 24 * 60 * 60 * 1000);
  if (recentPods.length > 0) {
    md += "### Pod Workflows\n\n";
    const passed = recentPods.filter(p => p.status === "done" || p.result?.includes("PASS")).length;
    const failed = recentPods.filter(p => p.status === "failed" || p.result?.includes("FAIL")).length;
    md += `**${recentPods.length} pods ran** — ${passed} passed, ${failed} failed\n\n`;
    for (const p of recentPods.slice(0, 10)) {
      const emoji = p.result?.includes("PASS") ? "✅" : p.result?.includes("FAIL") ? "❌" : "⏳";
      md += `- ${emoji} ${p.task?.slice(0, 60) || p.id} (${p.preset || "custom"})\n`;
    }
    md += "\n";
  }

  // Task queue
  const queue = readJsonSafe<{ tasks?: Array<{
    title: string; status: string; source?: string; updatedAt?: number; createdAt?: number;
  }> }>(TASK_QUEUE, { tasks: [] });

  const recentTasks = (queue.tasks || []).filter(t =>
    (t.updatedAt || t.createdAt || 0) > Date.now() - 24 * 60 * 60 * 1000
  );
  if (recentTasks.length > 0) {
    const completed = recentTasks.filter(t => t.status === "completed").length;
    md += `### Orchestrator Tasks\n\n**${recentTasks.length} tasks** — ${completed} completed\n\n`;
  }

  return md;
}

function interestingLeads(session: ReturnType<ReturnType<typeof getDriver>["session"]>): Promise<string> {
  // Find leads added in last 12h with high scores or notable signals
  const since12h = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
  return session.run(
    `MATCH (l:Lead)
     WHERE l.createdAt >= $since AND l.leadScore >= 30
     OPTIONAL MATCH (l)-[:USES_EHR]->(e:EHRSystem)
     RETURN l.name AS name, l.company AS company,
            l.businessArm AS arm, l.leadScore AS score,
            l.leadSource AS source, l.notes AS notes,
            e.name AS ehr
     ORDER BY l.leadScore DESC
     LIMIT 10`,
    { since: since12h },
  ).then(result => {
    if (result.records.length === 0) return "## Notable Leads\n\nNo high-scoring leads from recent ingestion.\n";

    let md = "## Notable Leads (recent, score >= 30)\n\n";
    for (const record of result.records) {
      const name = toString(record.get("name"));
      const score = toNumber(record.get("score"));
      const arm = toString(record.get("arm"));
      const source = toString(record.get("source"));
      const ehr = toString(record.get("ehr"));
      const notes = toString(record.get("notes"));
      md += `### ${name} — score ${score}\n`;
      md += `- **Arm:** ${arm} · **Source:** ${source}${ehr ? ` · **EHR:** ${ehr}` : ""}\n`;
      if (notes) md += `- ${notes.slice(0, 200)}\n`;
      md += "\n";
    }
    return md;
  });
}

// ─── Slack DM ──────────────────────────────────────────────────────────────

async function slackDmBriefing(briefingText: string, timeLabel: string): Promise<void> {
  const token = process.env.SLACK_BOT_TOKEN;
  const userId = process.env.SLACK_OWNER_USER_ID;
  if (!token || !userId) {
    console.log("  Slack DM skipped — SLACK_BOT_TOKEN or SLACK_OWNER_USER_ID not set");
    return;
  }

  try {
    // Open DM channel
    const openRes = await fetch("https://slack.com/api/conversations.open", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ users: userId }),
    });
    const openData = (await openRes.json()) as { ok: boolean; channel?: { id: string } };
    if (!openData.ok || !openData.channel?.id) {
      console.warn("  Slack DM: failed to open conversation");
      return;
    }

    // Truncate for Slack (max ~4000 chars for good UX)
    const truncated = briefingText.length > 3800
      ? briefingText.slice(0, 3800) + "\n\n_...truncated — full briefing in vault_"
      : briefingText;

    await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        channel: openData.channel.id,
        text: `:newspaper: *${timeLabel} Briefing — ${today}*\n\n${truncated}`,
        username: "Penny Briefing",
        icon_emoji: ":newspaper:",
      }),
    });
    console.log("  Slack DM sent");
  } catch (err) {
    console.warn(`  Slack DM failed: ${(err as Error).message}`);
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const hour = new Date().getHours();
  const timeLabel = hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : "Evening";

  console.log("╔══════════════════════════════════════╗");
  console.log(`║   ${timeLabel} Intelligence Briefing      ║`);
  console.log("╚══════════════════════════════════════╝");
  console.log(`  Date: ${today}\n`);

  // Dispatch section doesn't need graph — build it first
  const sections: string[] = [];
  sections.push(`# ${timeLabel} Briefing — ${today}\n`);

  try {
    console.log("  Building: Dispatch Activity...");
    sections.push(dispatchWork());
  } catch (err) {
    console.warn(`  Failed: Dispatch Activity — ${(err as Error).message}`);
  }

  await verifyConnection();
  const driver = getDriver();
  const session = driver.session();

  const sectionBuilders = [
    { name: "Notable Leads", fn: interestingLeads },
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

  // Write to vault — append time slot to filename for 3x/day
  const briefingDir = resolveVaultPath("1Putt/Daily Briefings");
  if (!fs.existsSync(briefingDir)) {
    fs.mkdirSync(briefingDir, { recursive: true });
  }

  const slot = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
  const outputPath = path.join(briefingDir, `${today}-${slot}.md`);
  const content = sections.join("\n---\n\n");
  fs.writeFileSync(outputPath, content, "utf-8");

  console.log(`\n  Briefing written to: ${outputPath}`);
  console.log(`  Sections: ${sectionBuilders.length + 1}`);

  // DM the briefing summary via Slack
  await slackDmBriefing(content, timeLabel);
}

main().catch((err) => {
  console.error("Briefing generation failed:", err);
  process.exit(1);
});
