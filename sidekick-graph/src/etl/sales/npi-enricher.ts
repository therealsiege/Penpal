/**
 * NPI Lead Enricher
 *
 * Enriches existing NPI lead files with web data + EHR detection
 * via Firecrawl, re-scores, updates markdown in-place, and
 * pushes updated nodes to the graph.
 *
 * Usage:
 *   npm run npi:enrich -- --dry-run --limit 5
 *   npm run npi:enrich -- --limit 50
 *   npm run npi:enrich -- --limit 400 --state TX
 */

import fs from "fs";
import path from "path";
import { resolveVaultPath } from "../../shared/config.js";
import { getDriver, closeConnections } from "../../shared/connections.js";
import { stableId } from "../../shared/utils/id.js";
import { normalizeName } from "../../shared/utils/normalize.js";
import { GraphImporter } from "../graph/importer.js";
import { enrichWithFirecrawl, type EnrichmentResult } from "./shared-pipeline.js";
import { scoreLead, type LeadScoreInput } from "./lead-scorer.js";
import { ventureProfiles, businessArmLabel } from "./venture-config.js";
import { buildLeadUsesEHRRel } from "../graph/rel-builder.js";

// ─── Config ─────────────────────────────────────────────────────────────────

const MEDSCRUB = ventureProfiles.medscrub;
const LEADS_DIR = resolveVaultPath(MEDSCRUB.leadsDir);
const DEFAULT_LIMIT = 50;
const RATE_LIMIT_MS = 2000;

/** Sentinel value set by npi-activator for unenriched leads */
const UNENRICHED_SENTINEL = "Research practice size and EHR via web search";

// Known EHR systems to detect in enrichment results
const EHR_SYSTEMS = [
  "Epic", "Cerner", "athenahealth", "eClinicalWorks", "NextGen",
  "Allscripts", "Greenway", "Practice Fusion", "DrChrono",
  "Kareo", "ModMed", "AdvancedMD", "CureMD", "Amazing Charts",
  "Elation", "Meditech", "Oracle Health",
];

// ─── CLI Flags ──────────────────────────────────────────────────────────────

interface Flags {
  limit: number;
  state: string | null;
  dryRun: boolean;
}

function parseFlags(): Flags {
  const args = process.argv;
  const limitIdx = args.indexOf("--limit");
  const stateIdx = args.indexOf("--state");
  return {
    limit: limitIdx !== -1 && args[limitIdx + 1] ? parseInt(args[limitIdx + 1], 10) : DEFAULT_LIMIT,
    state: stateIdx !== -1 && args[stateIdx + 1] ? args[stateIdx + 1].toUpperCase() : null,
    dryRun: args.includes("--dry-run"),
  };
}

// ─── Lead File Parsing ──────────────────────────────────────────────────────

interface ParsedLeadFile {
  filePath: string;
  fileName: string;
  lines: string[];
  fields: Record<string, string>;
}

function parseLeadFile(filePath: string): ParsedLeadFile | null {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n");
    const fields: Record<string, string> = {};

    for (const line of lines) {
      const match = line.match(/^([A-Za-z\s]+?):\s*(.*)$/);
      if (match) {
        fields[match[1].trim()] = match[2].trim();
      }
    }

    return {
      filePath,
      fileName: path.basename(filePath),
      lines,
      fields,
    };
  } catch {
    return null;
  }
}

// ─── Search Query Builder ───────────────────────────────────────────────────

function buildSearchQuery(lead: ParsedLeadFile): string {
  const rawName = lead.fields["Company"] || "";
  // NPI names are "LASTNAME, FIRSTNAME" — reverse to "Dr. Firstname Lastname"
  const parts = rawName.split(",").map((p) => p.trim());
  const displayName = parts.length >= 2
    ? `Dr. ${parts[1]} ${parts[0]}`
    : `Dr. ${rawName}`;

  const specialty = lead.fields["Bio"]?.split(" practice in")[0] || "";
  const location = lead.fields["Location"] || "";

  return `${displayName} ${specialty} ${location}`.trim();
}

// ─── EHR Detection ──────────────────────────────────────────────────────────

function detectEHR(enrichment: EnrichmentResult): string | null {
  const allText = `${enrichment.description} ${enrichment.techStack.join(" ")}`.toLowerCase();

  for (const ehr of EHR_SYSTEMS) {
    if (allText.includes(ehr.toLowerCase())) {
      return ehr;
    }
  }
  return null;
}

// ─── Lead File Updater ──────────────────────────────────────────────────────

function updateLeadFile(
  lead: ParsedLeadFile,
  enrichment: EnrichmentResult,
  newScore: number,
  detectedEHR: string | null,
): void {
  const today = new Date().toISOString().split("T")[0];
  const newLines = [...lead.lines];

  for (let i = 0; i < newLines.length; i++) {
    const line = newLines[i];

    // Update Bio
    if (line.startsWith("Bio:")) {
      const existingBio = line.slice(4).trim();
      const enrichBits: string[] = [];
      if (enrichment.description) enrichBits.push(enrichment.description.slice(0, 300));
      if (enrichment.techStack.length > 0) enrichBits.push(`Tech: ${enrichment.techStack.join(", ")}`);
      if (enrichBits.length > 0) {
        newLines[i] = `Bio: ${existingBio}. ${enrichBits.join(". ")}`;
      }
    }

    // Update Notes
    if (line.startsWith("Notes:")) {
      const existingNotes = line.slice(6).trim();
      const enrichNote = `Web enrichment (${today}): ${enrichment.description.slice(0, 200)}. Tech: ${enrichment.techStack.join(", ") || "none detected"}.`;
      newLines[i] = `Notes: ${existingNotes} ${enrichNote}`;
    }

    // Update Lead Score
    if (line.startsWith("Lead Score:")) {
      newLines[i] = `Lead Score: ${newScore}`;
    }

    // Update Priority
    if (line.startsWith("Priority:")) {
      let priority: string;
      if (newScore >= 50) priority = "🔥 Hot";
      else if (newScore >= 30) priority = "🟡 Warm";
      else priority = "🔵 Cold";
      newLines[i] = `Priority: ${priority}`;
    }

    // Update Next Action
    if (line.startsWith("Next Action:")) {
      let nextAction: string;
      if (detectedEHR) {
        nextAction = `Prepare outreach — uses ${detectedEHR}`;
      } else if (enrichment.description.length > 20) {
        nextAction = "Qualify via phone";
      } else {
        nextAction = "Manual research — no web presence";
      }
      newLines[i] = `Next Action: ${nextAction}`;
    }
  }

  fs.writeFileSync(lead.filePath, newLines.join("\n"), "utf-8");
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const flags = parseFlags();

  console.log("╔══════════════════════════════════════╗");
  console.log("║   NPI Lead Enricher                  ║");
  console.log("╚══════════════════════════════════════╝");
  console.log(`  Target: MedScrub NPI leads`);
  console.log(`  Limit: ${flags.limit}`);
  if (flags.state) console.log(`  State filter: ${flags.state}`);
  if (flags.dryRun) console.log(`  DRY RUN — no files will be modified`);

  // Discover unenriched lead files
  if (!fs.existsSync(LEADS_DIR)) {
    console.error(`  Leads directory not found: ${LEADS_DIR}`);
    process.exit(1);
  }

  const allFiles = fs.readdirSync(LEADS_DIR).filter((f) => f.endsWith(".md"));
  console.log(`\n  Scanning ${allFiles.length} lead files...`);

  const candidates: ParsedLeadFile[] = [];

  for (const file of allFiles) {
    const parsed = parseLeadFile(path.join(LEADS_DIR, file));
    if (!parsed) continue;

    // Only process NPI-sourced leads with the sentinel Next Action
    if (parsed.fields["Lead Source"] !== "NPI Registry") continue;
    if (parsed.fields["Next Action"] !== UNENRICHED_SENTINEL) continue;

    // Optional state filter
    if (flags.state) {
      const location = parsed.fields["Location"] || "";
      if (!location.includes(flags.state)) continue;
    }

    candidates.push(parsed);
  }

  console.log(`  Found ${candidates.length} unenriched NPI leads`);
  const toProcess = candidates.slice(0, flags.limit);
  console.log(`  Will process: ${toProcess.length}`);

  if (flags.dryRun) {
    console.log("\n  DRY RUN — would enrich these leads:");
    for (const lead of toProcess.slice(0, 10)) {
      const query = buildSearchQuery(lead);
      console.log(`    ${lead.fields["Company"]} → "${query}"`);
    }
    if (toProcess.length > 10) console.log(`    ... and ${toProcess.length - 10} more`);
    return;
  }

  // Set up graph importer
  const driver = getDriver();
  const importer = new GraphImporter();

  let enriched = 0;
  let ehrDetected = 0;
  let noWebPresence = 0;
  const ehrCounts: Record<string, number> = {};

  try {
    for (let i = 0; i < toProcess.length; i++) {
      const lead = toProcess[i];
      const searchQuery = buildSearchQuery(lead);
      const companyName = lead.fields["Company"] || lead.fileName;

      console.log(`\n  [${i + 1}/${toProcess.length}] ${companyName}`);
      console.log(`    Search: "${searchQuery}"`);

      // Enrich via Firecrawl
      const enrichment = await enrichWithFirecrawl(searchQuery);

      // Detect EHR
      const detectedEHR = detectEHR(enrichment);
      if (detectedEHR) {
        ehrDetected++;
        ehrCounts[detectedEHR] = (ehrCounts[detectedEHR] || 0) + 1;
        console.log(`    EHR detected: ${detectedEHR}`);
      }

      if (enrichment.description.length <= 20) {
        noWebPresence++;
        console.log(`    No significant web presence found`);
      }

      // Re-score
      const location = lead.fields["Location"] || "";
      const scoreInput: LeadScoreInput = {
        createdAt: lead.fields["CreatedTime"] || new Date().toISOString(),
        notes: `${lead.fields["Notes"] || ""} ${enrichment.description}`,
        bio: `${lead.fields["Bio"] || ""} ${enrichment.description}`,
        emr: detectedEHR || "",
        htnMember: lead.fields["HTN Member"] === "Yes",
        businessArm: MEDSCRUB.name,
        salesFunnel: lead.fields["Sales Funnel"] || "Outreach",
        priority: "",
        jobTitle: lead.fields["JobTitle"] || "",
        type: lead.fields["Type"] || "Prospect",
        location,
      };

      const newScore = scoreLead(scoreInput, "clinical");
      console.log(`    Score: ${lead.fields["Lead Score"] || "?"} → ${newScore}`);

      // Update the file in-place
      updateLeadFile(lead, enrichment, newScore, detectedEHR);
      enriched++;

      // Queue graph updates
      const leadName = companyName;
      const leadId = stableId("Lead", normalizeName(leadName), normalizeName(leadName));

      importer.addNode({
        label: "Lead",
        properties: {
          id: leadId,
          leadScore: newScore,
          nextAction: detectedEHR
            ? `Prepare outreach — uses ${detectedEHR}`
            : enrichment.description.length > 20
              ? "Qualify via phone"
              : "Manual research — no web presence",
        },
      });

      // Create EHR node + relationship if detected
      if (detectedEHR) {
        importer.addNode({
          label: "EHRSystem",
          properties: {
            id: stableId("EHRSystem", normalizeName(detectedEHR)),
            name: detectedEHR,
          },
        });
        importer.addRel(buildLeadUsesEHRRel(leadName, leadName, detectedEHR));
      }

      // Rate limit
      if (i < toProcess.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_MS));
      }
    }

    // Flush graph updates
    if (enriched > 0) {
      console.log("\n  Flushing graph updates...");
      await importer.flush();
    }

  } finally {
    await closeConnections();
  }

  // Summary
  console.log("\n╔══════════════════════════════════════╗");
  console.log("║          Summary                     ║");
  console.log("╚══════════════════════════════════════╝");
  console.log(`  Leads enriched: ${enriched}`);
  console.log(`  EHR detected: ${ehrDetected}`);
  console.log(`  No web presence: ${noWebPresence}`);
  if (Object.keys(ehrCounts).length > 0) {
    console.log("\n  EHR breakdown:");
    for (const [ehr, count] of Object.entries(ehrCounts).sort((a, b) => b[1] - a[1])) {
      console.log(`    ${ehr}: ${count}`);
    }
  }
}

main().catch((err) => {
  console.error("NPI enrichment failed:", err);
  process.exit(1);
});
