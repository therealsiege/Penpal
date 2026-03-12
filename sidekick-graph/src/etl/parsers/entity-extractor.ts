import { companies, CompanyEntry } from "../dictionaries/companies.js";
import { people, PersonEntry } from "../dictionaries/people.js";
import { technologies, TechnologyEntry } from "../dictionaries/technologies.js";
import { ehrSystems, EHREntry } from "../dictionaries/ehr-systems.js";
import { regulations, RegulationEntry } from "../dictionaries/regulations.js";
import { skills, SkillEntry } from "../dictionaries/skills.js";

export interface ExtractedEntities {
  companies: CompanyEntry[];
  people: PersonEntry[];
  technologies: TechnologyEntry[];
  ehrSystems: EHREntry[];
  regulations: RegulationEntry[];
  skills: SkillEntry[];
}

type DictEntry = { name: string; aliases?: string[] };

function buildRegex(entry: DictEntry): RegExp {
  const names = [entry.name, ...(entry.aliases || [])];
  // Escape regex special chars and create word-boundary pattern
  const escaped = names.map((n) =>
    n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  );
  // Sort by length descending so longer matches take priority
  escaped.sort((a, b) => b.length - a.length);
  return new RegExp(`\\b(?:${escaped.join("|")})\\b`, "i");
}

function findMatches<T extends DictEntry>(content: string, dict: T[]): T[] {
  const matches: T[] = [];
  for (const entry of dict) {
    const regex = buildRegex(entry);
    if (regex.test(content)) {
      matches.push(entry);
    }
  }
  return matches;
}

export function extractEntities(content: string): ExtractedEntities {
  return {
    companies: findMatches(content, companies),
    people: findMatches(content, people),
    technologies: findMatches(content, technologies),
    ehrSystems: findMatches(content, ehrSystems),
    regulations: findMatches(content, regulations),
    skills: findMatches(content, skills),
  };
}
