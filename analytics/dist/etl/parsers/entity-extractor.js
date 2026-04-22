import { companies } from "../dictionaries/companies.js";
import { people } from "../dictionaries/people.js";
import { technologies } from "../dictionaries/technologies.js";
import { ehrSystems } from "../dictionaries/ehr-systems.js";
import { regulations } from "../dictionaries/regulations.js";
import { skills } from "../dictionaries/skills.js";
function buildRegex(entry) {
    const names = [entry.name, ...(entry.aliases || [])];
    // Escape regex special chars and create word-boundary pattern
    const escaped = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    // Sort by length descending so longer matches take priority
    escaped.sort((a, b) => b.length - a.length);
    return new RegExp(`\\b(?:${escaped.join("|")})\\b`, "i");
}
function findMatches(content, dict) {
    const matches = [];
    for (const entry of dict) {
        const regex = buildRegex(entry);
        if (regex.test(content)) {
            matches.push(entry);
        }
    }
    return matches;
}
export function extractEntities(content) {
    return {
        companies: findMatches(content, companies),
        people: findMatches(content, people),
        technologies: findMatches(content, technologies),
        ehrSystems: findMatches(content, ehrSystems),
        regulations: findMatches(content, regulations),
        skills: findMatches(content, skills),
    };
}
