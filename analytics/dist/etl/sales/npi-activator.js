/**
 * NPI Prospect Activator
 *
 * Converts high-value NPI Practice nodes from the graph into
 * actionable MedScrub leads with outreach-ready markdown files.
 *
 * Filters:
 *  - Sole proprietors or small practices (most likely independent)
 *  - Target states: TX, TN, CO, NC, AL
 *  - Target specialties: Family Medicine, Internal Medicine, General Practice
 *  - Enumerated within last 10 years (active, not retired)
 *
 * Usage:
 *   npm run npi:activate
 *   npm run npi:activate -- --limit 100 --state TX
 */
import fs from "fs";
import path from "path";
import { resolveVaultPath } from "../../shared/config.js";
import { getDriver } from "../../shared/connections.js";
import { normalizeName } from "../../shared/utils/normalize.js";
import { ventureProfiles, businessArmLabel } from "./venture-config.js";
// ─── Config ─────────────────────────────────────────────────────────────────
const MEDSCRUB = ventureProfiles.medscrub;
const LEADS_DIR = resolveVaultPath(MEDSCRUB.leadsDir);
const DEFAULT_LIMIT = 200;
const PRIORITY_STATES = ["TX", "TN", "CO", "NC", "AL"];
const PRIORITY_SPECIALTIES = [
    "Family Medicine",
    "Internal Medicine",
    "General Practice",
    "Adult Medicine",
];
// ─── CLI Flags ──────────────────────────────────────────────────────────────
function parseFlags() {
    const args = process.argv;
    const limitIdx = args.indexOf("--limit");
    const stateIdx = args.indexOf("--state");
    return {
        limit: limitIdx !== -1 && args[limitIdx + 1] ? parseInt(args[limitIdx + 1], 10) : DEFAULT_LIMIT,
        state: stateIdx !== -1 && args[stateIdx + 1] ? args[stateIdx + 1].toUpperCase() : null,
        dryRun: args.includes("--dry-run"),
    };
}
// ─── Existing Lead Check ────────────────────────────────────────────────────
function getExistingLeadNPIs() {
    const npis = new Set();
    if (!fs.existsSync(LEADS_DIR))
        return npis;
    for (const file of fs.readdirSync(LEADS_DIR)) {
        if (!file.endsWith(".md"))
            continue;
        try {
            const content = fs.readFileSync(path.join(LEADS_DIR, file), "utf-8");
            const npiMatch = content.match(/NPI:\s*(\d{10})/);
            if (npiMatch)
                npis.add(npiMatch[1]);
        }
        catch { /* skip unreadable files */ }
    }
    return npis;
}
function getExistingLeadNames() {
    const names = new Set();
    if (!fs.existsSync(LEADS_DIR))
        return names;
    for (const file of fs.readdirSync(LEADS_DIR)) {
        if (!file.endsWith(".md"))
            continue;
        const nameMatch = file.match(/^(.+?)\s+[a-f0-9]{32}\.md$/);
        if (nameMatch)
            names.add(normalizeName(nameMatch[1]));
    }
    return names;
}
function generateId() {
    const chars = "0123456789abcdef";
    let id = "";
    for (let i = 0; i < 32; i++)
        id += chars[Math.floor(Math.random() * chars.length)];
    return id;
}
function scoreNPIProspect(p) {
    let score = 0;
    // Sole proprietor = likely independent (highest value for MedScrub)
    if (p.isSoleProprietor === "Y" || p.isSoleProprietor === "X")
        score += 20;
    // Priority specialty
    if (PRIORITY_SPECIALTIES.some((s) => p.specialty.includes(s)))
        score += 15;
    // Family Medicine > Internal Medicine > General Practice for MedScrub
    if (p.specialty.includes("Family Medicine"))
        score += 10;
    else if (p.specialty.includes("Internal Medicine"))
        score += 5;
    // Priority state
    if (PRIORITY_STATES.includes(p.state))
        score += 10;
    // Recency: enumerated in last 5 years = actively practicing
    if (p.enumerationDate) {
        const enumYear = parseInt(p.enumerationDate.slice(0, 4), 10);
        const currentYear = new Date().getFullYear();
        if (currentYear - enumYear <= 5)
            score += 10;
        else if (currentYear - enumYear <= 10)
            score += 5;
    }
    return Math.min(score, 100);
}
function writeLead(p, score) {
    const id = generateId();
    const fileName = `${p.name} ${id}.md`;
    const filePath = path.join(LEADS_DIR, fileName);
    const now = new Date();
    const createdTime = now.toLocaleDateString("en-US", {
        year: "numeric", month: "long", day: "numeric",
        hour: "numeric", minute: "2-digit", hour12: true,
    });
    let priority;
    if (score >= 45)
        priority = "🔥 Hot";
    else if (score >= 30)
        priority = "🟡 Warm";
    else
        priority = "🔵 Cold";
    const content = `# ${p.name}

Location: ${p.city}, ${p.state} ${p.zip}
Company: ${p.name}
NPI: ${p.npi}
JobTitle: ${p.isSoleProprietor === "Y" ? "Sole Proprietor" : "Provider"}
CreatedTime: ${createdTime}
Type: Prospect
Sales Funnel: Outreach
Bio: ${p.specialty} practice in ${p.city}, ${p.state}. ${p.isSoleProprietor === "Y" ? "Sole proprietor — likely independent practice." : ""}
Business Arm: ${businessArmLabel(MEDSCRUB)}
HTN Member: No
Lead Source: NPI Registry
Lead Score: ${score}
Notes: Activated from NPPES registry. NPI: ${p.npi}. Specialty: ${p.specialty}. Address: ${p.address}, ${p.city}, ${p.state} ${p.zip}. Enumerated: ${p.enumerationDate || "unknown"}.
Previous Attempts: No
Priority: ${priority}
Next Action: Research practice size and EHR via web search`;
    fs.writeFileSync(filePath, content, "utf-8");
    return fileName;
}
// ─── Main ───────────────────────────────────────────────────────────────────
async function main() {
    const flags = parseFlags();
    console.log("╔══════════════════════════════════════╗");
    console.log("║   NPI Prospect Activator             ║");
    console.log("╚══════════════════════════════════════╝");
    console.log(`  Target: MedScrub (independent primary care)`);
    console.log(`  Limit: ${flags.limit} leads`);
    if (flags.state)
        console.log(`  State filter: ${flags.state}`);
    if (flags.dryRun)
        console.log(`  DRY RUN — no files will be written`);
    // Query Memgraph for high-value NPI prospects
    const driver = getDriver();
    const session = driver.session();
    try {
        // Build the query with filters
        let stateFilter = `p.practiceState IN ['TX', 'TN', 'CO', 'NC', 'AL']`;
        if (flags.state) {
            stateFilter = `p.practiceState = '${flags.state}'`;
        }
        const query = `
      MATCH (p:Practice)
      WHERE p.source = 'npi-registry'
        AND ${stateFilter}
        AND p.specialty IN ['Family Medicine', 'Internal Medicine', 'General Practice', 'Adult Medicine']
        AND (p.isSoleProprietor = 'Y' OR p.isSoleProprietor = 'X')
      RETURN p.name AS name, p.npi AS npi, p.specialty AS specialty,
             p.address AS address, p.practiceCity AS city, p.practiceState AS state,
             p.practiceZip AS zip, p.isSoleProprietor AS isSoleProprietor,
             p.enumerationDate AS enumerationDate
      ORDER BY p.practiceState, p.specialty, p.name
      LIMIT ${flags.limit * 3}
    `;
        console.log("\n  Querying Memgraph for NPI prospects...");
        const result = await session.run(query);
        console.log(`  Found ${result.records.length} candidate prospects`);
        // Load existing leads for dedup
        const existingNPIs = getExistingLeadNPIs();
        const existingNames = getExistingLeadNames();
        console.log(`  Existing leads: ${existingNames.size} (${existingNPIs.size} with NPI)`);
        // Score, dedup, sort, and take top N
        const prospects = [];
        for (const record of result.records) {
            const p = {
                name: record.get("name") || "",
                npi: record.get("npi") || "",
                specialty: record.get("specialty") || "",
                address: record.get("address") || "",
                city: record.get("city") || "",
                state: record.get("state") || "",
                zip: record.get("zip") || "",
                isSoleProprietor: record.get("isSoleProprietor") || "",
                enumerationDate: record.get("enumerationDate") || "",
            };
            if (!p.name || p.name === ", ")
                continue;
            // Dedup
            if (p.npi && existingNPIs.has(p.npi))
                continue;
            if (existingNames.has(normalizeName(p.name)))
                continue;
            const score = scoreNPIProspect(p);
            prospects.push({ ...p, score });
        }
        // Sort by score descending, take top N
        prospects.sort((a, b) => b.score - a.score);
        const activated = prospects.slice(0, flags.limit);
        console.log(`  After dedup + scoring: ${prospects.length} eligible, activating top ${activated.length}`);
        // Write lead files
        if (!flags.dryRun) {
            if (!fs.existsSync(LEADS_DIR))
                fs.mkdirSync(LEADS_DIR, { recursive: true });
            let written = 0;
            const stateCounts = {};
            const specialtyCounts = {};
            for (const p of activated) {
                writeLead(p, p.score);
                written++;
                stateCounts[p.state] = (stateCounts[p.state] || 0) + 1;
                specialtyCounts[p.specialty] = (specialtyCounts[p.specialty] || 0) + 1;
            }
            console.log(`\n  ✓ Wrote ${written} lead files to ${MEDSCRUB.leadsDir}`);
            console.log("\n  By state:");
            for (const [state, count] of Object.entries(stateCounts).sort((a, b) => b[1] - a[1])) {
                console.log(`    ${state}: ${count}`);
            }
            console.log("\n  By specialty:");
            for (const [spec, count] of Object.entries(specialtyCounts).sort((a, b) => b[1] - a[1])) {
                console.log(`    ${spec}: ${count}`);
            }
        }
        else {
            console.log("\n  DRY RUN — would write these leads:");
            const preview = activated.slice(0, 10);
            for (const p of preview) {
                console.log(`    [${p.score}] ${p.name} — ${p.specialty}, ${p.city}, ${p.state}`);
            }
            if (activated.length > 10)
                console.log(`    ... and ${activated.length - 10} more`);
        }
        // Score distribution
        const hot = activated.filter((p) => p.score >= 45).length;
        const warm = activated.filter((p) => p.score >= 30 && p.score < 45).length;
        const cold = activated.filter((p) => p.score < 30).length;
        console.log(`\n  Score distribution: 🔥 ${hot} hot, 🟡 ${warm} warm, 🔵 ${cold} cold`);
    }
    finally {
        await session.close();
        await driver.close();
    }
}
const isDirectRun = process.argv[1]?.includes("npi-activator");
if (isDirectRun) {
    main().catch((err) => {
        console.error("NPI activation failed:", err);
        process.exit(1);
    });
}
export { main as activateNPIProspects };
