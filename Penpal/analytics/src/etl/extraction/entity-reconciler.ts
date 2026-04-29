import fs from "fs";
import path from "path";
import { normalizeName } from "../../shared/utils/normalize.js";
import { companies } from "../dictionaries/companies.js";
import { people } from "../dictionaries/people.js";
import { technologies } from "../dictionaries/technologies.js";
import { ehrSystems } from "../dictionaries/ehr-systems.js";
import { regulations } from "../dictionaries/regulations.js";
import type { ExtractedEntity } from "./llm-extractor.js";

export interface ReconciledEntity {
  name: string;
  type: ExtractedEntity["type"];
  isNew: boolean;
  matchedDictionaryName?: string;
  confidence: number;
  context: string;
}

type DictEntry = { name: string; aliases?: string[] };

/** Build a lookup map from dictionary entries (name + aliases → canonical name) */
function buildLookup(entries: DictEntry[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const entry of entries) {
    map.set(normalizeName(entry.name), entry.name);
    for (const alias of entry.aliases || []) {
      map.set(normalizeName(alias), entry.name);
    }
  }
  return map;
}

const lookups: Record<string, Map<string, string>> = {
  company: buildLookup(companies),
  person: buildLookup(people),
  technology: buildLookup(technologies),
  ehr_system: buildLookup(ehrSystems),
  regulation: buildLookup(regulations),
};

/** Fuzzy match: check if normalized name is a substring of any dictionary key or vice versa */
function fuzzyMatch(name: string, lookup: Map<string, string>): string | null {
  const normalized = normalizeName(name);

  // Exact match
  const exact = lookup.get(normalized);
  if (exact) return exact;

  // Substring match (both directions)
  for (const [key, canonical] of lookup) {
    if (key.includes(normalized) || normalized.includes(key)) {
      // Only match if the overlap is significant (>60% of the shorter string)
      const shorter = Math.min(key.length, normalized.length);
      const longer = Math.max(key.length, normalized.length);
      if (shorter / longer > 0.6) {
        return canonical;
      }
    }
  }

  return null;
}

/** Reconcile LLM-extracted entities against existing dictionaries */
export function reconcileEntities(entities: ExtractedEntity[]): ReconciledEntity[] {
  const reconciled: ReconciledEntity[] = [];

  for (const entity of entities) {
    const lookup = lookups[entity.type];
    let matchedName: string | null = null;

    if (lookup) {
      matchedName = fuzzyMatch(entity.name, lookup);
    }

    reconciled.push({
      name: matchedName || entity.name,
      type: entity.type,
      isNew: !matchedName,
      matchedDictionaryName: matchedName || undefined,
      confidence: entity.confidence,
      context: entity.context,
    });
  }

  return reconciled;
}

export interface NewEntitiesReport {
  companies: { name: string; context: string; confidence: number }[];
  people: { name: string; context: string; confidence: number }[];
  technologies: { name: string; context: string; confidence: number }[];
  markets: { name: string; sources: string[] }[];
  events: { description: string; type: string; date?: string }[];
}

/** Write a JSON report of newly discovered entities for human review */
export function writeNewEntitiesReport(
  report: NewEntitiesReport,
  outputPath: string,
): void {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
  console.log(`  New entities report written to ${outputPath}`);
}
