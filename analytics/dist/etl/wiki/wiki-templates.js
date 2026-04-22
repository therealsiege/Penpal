/**
 * wiki-templates.ts
 *
 * Lightweight markdown templates for entity types that don't benefit
 * from LLM synthesis (practices, markets). High-value entities use
 * wiki-synthesizer.ts instead.
 */
const NOW = () => new Date().toISOString();
function prop(label, value) {
    if (!value)
        return "";
    return `- **${label}**: ${value}`;
}
function filterEmpty(lines) {
    return lines.filter(Boolean).join("\n");
}
export function practicePage(pr) {
    const tags = ["entity", "practice", pr.practiceState?.toLowerCase()].filter(Boolean);
    return `---
type: practice
aliases: [${pr.name}]
tags: [${tags.join(", ")}]
updated: ${NOW()}
source: auto-generated from knowledge graph
---

# ${pr.name}

## Properties
${filterEmpty([
        prop("NPI", pr.npi),
        prop("Specialty", pr.specialty),
        prop("City", pr.practiceCity),
        prop("State", pr.practiceState),
        prop("ZIP", pr.practiceZip),
    ])}

${pr.leads.length > 0 ? `## Leads\n${pr.leads.map((l) => `- [[${l}]]`).join("\n")}` : ""}

${pr.specialties.length > 0 ? `## Specialties\n${pr.specialties.map((s) => `- ${s}`).join("\n")}` : ""}

${pr.programs.length > 0 ? `## Programs\n${pr.programs.map((p) => `- ${p}`).join("\n")}` : ""}
`;
}
export function marketPage(m) {
    return `---
type: market
aliases: [${m.name}]
tags: [entity, market]
updated: ${NOW()}
source: auto-generated from knowledge graph
---

# ${m.name}

${m.description || ""}

${m.companies.length > 0 ? `## Companies\n${m.companies.map((c) => `- [[${c}]]`).join("\n")}` : ""}

${m.documents.length > 0 ? `## Mentioned In\n${m.documents.slice(0, 10).map((d) => `- [[${d.title}]]`).join("\n")}` : ""}
`;
}
