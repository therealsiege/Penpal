/**
 * wiki-generator.ts
 *
 * Generates high-value Knowledge Wiki pages using Claude synthesis.
 * Only creates pages for entities that actually matter — curated by
 * relationship count, lead score, or dictionary membership.
 *
 * Pages are LLM-synthesized intelligence, not formatted data dumps.
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import type { Session } from "neo4j-driver";
import { resolveVaultPath } from "../../shared/config.js";
import {
  getCompanies,
  getPeople,
  getTechnologies,
  getLeads,
  getCompetitorProducts,
} from "./wiki-queries.js";
import {
  synthesizeCompany,
  synthesizePerson,
  synthesizeTechnology,
  synthesizeLead,
  synthesizeProduct,
} from "./wiki-synthesizer.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WikiPage {
  relativePath: string;
  content: string;
  category: string;
  name: string;
}

export interface WikiGeneratorOptions {
  clean?: boolean;
  types?: string[];
  /** Min relationships for companies (default: 3) */
  minCompanyRels?: number;
  /** Min lead score (default: 30) */
  minLeadScore?: number;
  /** Max leads to generate (default: 50) */
  maxLeads?: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WIKI_ROOT = "Knowledge";
const INDEX_FILE = "index.md";
const LOG_FILE = "log.md";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sanitizeFilename(name: string): string {
  return name.replace(/[/\\:*?"<>|]/g, "-").replace(/\s+/g, " ").trim();
}

function contentHash(content: string): string {
  // Strip timestamps so re-runs with same data don't cause unnecessary writes
  const stable = content
    .replace(/^updated:.*$/m, "")
    .replace(/Last updated:.*$/m, "");
  return crypto.createHash("md5").update(stable).digest("hex");
}

function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function writeIfChanged(filePath: string, content: string): boolean {
  if (fs.existsSync(filePath)) {
    const existing = fs.readFileSync(filePath, "utf-8");
    if (contentHash(existing) === contentHash(content)) return false;
  }
  fs.writeFileSync(filePath, content, "utf-8");
  return true;
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

export async function generateWiki(
  session: Session,
  options: WikiGeneratorOptions = {},
): Promise<{ total: number; written: number; skipped: number }> {
  const allowedTypes = options.types
    ? new Set(options.types.map((t) => t.toLowerCase()))
    : null;

  const wikiDir = resolveVaultPath(WIKI_ROOT);

  if (options.clean && fs.existsSync(wikiDir)) {
    fs.rmSync(wikiDir, { recursive: true, force: true });
    console.log("  Cleaned existing Knowledge/ folder");
  }

  ensureDir(wikiDir);

  const pages: WikiPage[] = [];
  const stats = { total: 0, written: 0, skipped: 0 };

  // ── Companies (Claude-synthesized) ──
  if (!allowedTypes || allowedTypes.has("company")) {
    console.log("  Querying companies...");
    const companies = await getCompanies(session, options.minCompanyRels ?? 3);
    console.log(`    ${companies.length} companies meet threshold — synthesizing...`);
    for (const c of companies) {
      try {
        process.stdout.write(`    ${c.name}...`);
        const content = await synthesizeCompany(c);
        pages.push({
          relativePath: `Companies/${sanitizeFilename(c.name)}.md`,
          content,
          category: "Companies",
          name: c.name,
        });
        console.log(" done");
      } catch (err) {
        console.log(` FAILED: ${(err as Error).message}`);
      }
    }
  }

  // ── People (Claude-synthesized) ──
  if (!allowedTypes || allowedTypes.has("person")) {
    console.log("  Querying people...");
    const people = await getPeople(session);
    console.log(`    ${people.length} people — synthesizing...`);
    for (const p of people) {
      try {
        process.stdout.write(`    ${p.name}...`);
        const content = await synthesizePerson(p);
        pages.push({
          relativePath: `People/${sanitizeFilename(p.name)}.md`,
          content,
          category: "People",
          name: p.name,
        });
        console.log(" done");
      } catch (err) {
        console.log(` FAILED: ${(err as Error).message}`);
      }
    }
  }

  // ── Technologies (Claude-synthesized, 2+ doc mentions) ──
  if (!allowedTypes || allowedTypes.has("technology")) {
    console.log("  Querying technologies...");
    const technologies = await getTechnologies(session, 2);
    console.log(`    ${technologies.length} technologies — synthesizing...`);
    for (const t of technologies) {
      try {
        process.stdout.write(`    ${t.name}...`);
        const content = await synthesizeTechnology(t);
        pages.push({
          relativePath: `Technologies/${sanitizeFilename(t.name)}.md`,
          content,
          category: "Technologies",
          name: t.name,
        });
        console.log(" done");
      } catch (err) {
        console.log(` FAILED: ${(err as Error).message}`);
      }
    }
  }

  // ── Leads (Claude-synthesized, top by score) ──
  if (!allowedTypes || allowedTypes.has("lead")) {
    console.log("  Querying leads...");
    const leads = await getLeads(session, options.minLeadScore ?? 30, options.maxLeads ?? 50);
    console.log(`    ${leads.length} leads above threshold — synthesizing...`);
    for (const l of leads) {
      try {
        process.stdout.write(`    ${l.name}...`);
        const content = await synthesizeLead(l);
        pages.push({
          relativePath: `Leads/${sanitizeFilename(l.name)}.md`,
          content,
          category: "Leads",
          name: l.name,
        });
        console.log(" done");
      } catch (err) {
        console.log(` FAILED: ${(err as Error).message}`);
      }
    }
  }

  // ── Competitor Products (Claude-synthesized, always small set) ──
  if (!allowedTypes || allowedTypes.has("product")) {
    console.log("  Querying competitor products...");
    const products = await getCompetitorProducts(session);
    console.log(`    ${products.length} products — synthesizing...`);
    for (const p of products) {
      try {
        process.stdout.write(`    ${p.name}...`);
        const content = await synthesizeProduct(p);
        pages.push({
          relativePath: `Products/${sanitizeFilename(p.name)}.md`,
          content,
          category: "Products",
          name: p.name,
        });
        console.log(" done");
      } catch (err) {
        console.log(` FAILED: ${(err as Error).message}`);
      }
    }
  }

  // ── Write pages ──
  stats.total = pages.length;
  console.log(`\n  Writing ${pages.length} wiki pages...`);

  for (const page of pages) {
    const fullPath = path.join(wikiDir, page.relativePath);
    ensureDir(path.dirname(fullPath));
    if (writeIfChanged(fullPath, page.content)) {
      stats.written++;
    } else {
      stats.skipped++;
    }
  }

  // ── index.md ──
  const indexContent = generateIndex(pages);
  writeIfChanged(path.join(wikiDir, INDEX_FILE), indexContent);

  // ── log.md ──
  appendLog(wikiDir, stats);

  console.log(`  Done: ${stats.written} written, ${stats.skipped} unchanged, ${stats.total} total`);
  return stats;
}

// ---------------------------------------------------------------------------
// index.md
// ---------------------------------------------------------------------------

function generateIndex(pages: WikiPage[]): string {
  const grouped = new Map<string, string[]>();
  for (const page of pages) {
    if (!grouped.has(page.category)) grouped.set(page.category, []);
    grouped.get(page.category)!.push(page.name);
  }

  let md = `---
source: auto-generated from knowledge graph + Claude synthesis
updated: ${new Date().toISOString()}
---

# Knowledge Wiki

Auto-maintained intelligence pages synthesized from the knowledge graph.
Each page is written by Claude with analysis, not just data formatting.

`;

  for (const cat of ["Companies", "People", "Technologies", "Products", "Leads"]) {
    const names = grouped.get(cat);
    if (!names || names.length === 0) continue;
    names.sort();
    md += `## ${cat} (${names.length})\n\n`;
    for (const name of names) {
      md += `- [[${name}]]\n`;
    }
    md += "\n";
  }

  return md;
}

// ---------------------------------------------------------------------------
// log.md
// ---------------------------------------------------------------------------

function appendLog(
  wikiDir: string,
  stats: { total: number; written: number; skipped: number },
): void {
  const logPath = path.join(wikiDir, LOG_FILE);
  const entry = `[${new Date().toISOString()}] generate: ${stats.total} pages (${stats.written} updated, ${stats.skipped} unchanged)\n`;

  if (fs.existsSync(logPath)) {
    fs.appendFileSync(logPath, entry, "utf-8");
  } else {
    fs.writeFileSync(logPath, `# Knowledge Wiki Log\n\n${entry}`, "utf-8");
  }
}
