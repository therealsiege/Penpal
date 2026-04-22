import { getDriver } from "../../shared/connections.js";
export const revenueOpportunitySchema = {
    name: "revenue_opportunity",
    description: "Calculate potential CMS revenue opportunity for a lead or practice based on specialty, EHR, and eligible programs (CCM, RPM, APCM, TCM, AWV, MIPS). Returns eligible programs with estimated annual revenue per patient and relevant billing codes.",
    inputSchema: {
        type: "object",
        properties: {
            leadName: {
                type: "string",
                description: "Name of the lead to analyze. If omitted, use specialty to find opportunities.",
            },
            specialty: {
                type: "string",
                description: "Medical specialty to analyze (e.g. 'Family Medicine', 'Internal Medicine'). Used as fallback if leadName is not provided.",
            },
        },
    },
};
export async function revenueOpportunity(args) {
    const driver = getDriver();
    const session = driver.session();
    try {
        const sections = [];
        // If leadName provided, get lead info and find eligible programs
        if (args.leadName) {
            // Get lead details
            const leadResult = await session.run(`MATCH (l:Lead)
         WHERE toLower(l.name) CONTAINS toLower($name)
         OPTIONAL MATCH (l)-[:USES_EHR]->(e:EHRSystem)
         OPTIONAL MATCH (l)-[:LOCATED_IN]->(t:Territory)
         OPTIONAL MATCH (l)-[:ELIGIBLE_FOR]->(p:Program)
         RETURN l.name AS name, l.company AS company, l.jobTitle AS jobTitle,
                l.emr AS emr, l.leadScore AS leadScore,
                e.name AS ehrName,
                t.name AS territory,
                collect(DISTINCT {
                  program: p.name,
                  fullName: p.fullName,
                  annualRevPerPatient: p.annualRevenuePerPatient,
                  payer: p.payerRequirement
                }) AS programs
         LIMIT 5`, { name: args.leadName });
            if (leadResult.records.length === 0) {
                return `No leads found matching "${args.leadName}".`;
            }
            for (const record of leadResult.records) {
                const name = record.get("name");
                const company = record.get("company");
                const ehr = record.get("ehrName") || record.get("emr") || "Unknown";
                const territory = record.get("territory") || "Unknown";
                const programs = record.get("programs");
                const eligiblePrograms = programs.filter((p) => p.program);
                sections.push(`## ${name}${company ? ` (${company})` : ""}`);
                sections.push(`- EHR: ${ehr}`);
                sections.push(`- Territory: ${territory}`);
                sections.push(`- Lead Score: ${record.get("leadScore") || "N/A"}`);
                sections.push("");
                if (eligiblePrograms.length > 0) {
                    sections.push("### Eligible CMS Programs");
                    sections.push("");
                    let totalAnnual = 0;
                    for (const p of eligiblePrograms) {
                        const rev = typeof p.annualRevPerPatient === "object" && p.annualRevPerPatient !== null
                            ? p.annualRevPerPatient.toNumber()
                            : (p.annualRevPerPatient ?? 0);
                        sections.push(`- **${p.program}** (${p.fullName}): $${rev.toFixed(2)}/patient/year [${p.payer}]`);
                        totalAnnual += rev;
                    }
                    sections.push("");
                    sections.push(`**Estimated total per eligible patient**: $${totalAnnual.toFixed(2)}/year`);
                }
                else {
                    sections.push("_No program eligibility computed. Run ETL to populate ELIGIBLE_FOR relationships._");
                }
                sections.push("");
            }
        }
        // Specialty-based analysis
        const specialtyName = args.specialty || (args.leadName ? null : "Family Medicine");
        if (specialtyName) {
            // Find programs eligible for this specialty
            const specResult = await session.run(`MATCH (p:Program)-[:ELIGIBLE_SPECIALTY]->(s:Specialty)
         WHERE toLower(s.name) CONTAINS toLower($specialty)
         OPTIONAL MATCH (bc:BillingCode)-[:PART_OF_PROGRAM]->(p)
         RETURN p.name AS program, p.fullName AS fullName,
                p.annualRevenuePerPatient AS annualRev,
                p.payerRequirement AS payer,
                collect(DISTINCT {code: bc.code, description: bc.description, rate: bc.rate}) AS codes
         ORDER BY p.annualRevenuePerPatient DESC`, { specialty: specialtyName });
            if (specResult.records.length > 0) {
                sections.push(`## Programs Available for ${specialtyName}`);
                sections.push("");
                for (const record of specResult.records) {
                    const program = record.get("program");
                    const fullName = record.get("fullName");
                    const annualRev = record.get("annualRev");
                    const rev = typeof annualRev === "object" && annualRev !== null
                        ? annualRev.toNumber()
                        : (annualRev ?? 0);
                    const codes = record.get("codes");
                    sections.push(`### ${program} — ${fullName}`);
                    sections.push(`Est. annual revenue per patient: $${rev.toFixed(2)}`);
                    sections.push(`Payer: ${record.get("payer")}`);
                    sections.push("");
                    const validCodes = codes.filter((c) => c.code);
                    if (validCodes.length > 0) {
                        sections.push("| Code | Description | Rate |");
                        sections.push("|------|-------------|------|");
                        for (const c of validCodes) {
                            const codeRate = typeof c.rate === "object" && c.rate !== null
                                ? c.rate.toNumber()
                                : (c.rate ?? 0);
                            sections.push(`| ${c.code} | ${c.description} | $${codeRate.toFixed(2)} |`);
                        }
                        sections.push("");
                    }
                }
            }
            // Find leads in this specialty eligible for programs
            const leadCount = await session.run(`MATCH (l:Lead)-[:ELIGIBLE_FOR]->(p:Program)
         WHERE toLower(l.jobTitle) CONTAINS toLower($specialty)
            OR toLower(l.type) CONTAINS toLower($specialty)
         RETURN p.name AS program, count(DISTINCT l) AS leadCount
         ORDER BY leadCount DESC`, { specialty: specialtyName });
            if (leadCount.records.length > 0) {
                sections.push(`### Leads Eligible by Program (${specialtyName})`);
                sections.push("");
                for (const record of leadCount.records) {
                    const count = record.get("leadCount");
                    const countVal = typeof count === "object" && count !== null
                        ? count.toNumber()
                        : count;
                    sections.push(`- ${record.get("program")}: ${countVal} leads`);
                }
            }
        }
        // Find skills that enable billing
        const skillResult = await session.run(`MATCH (s:Skill)-[r:ENABLES_BILLING]->(bc:BillingCode)-[:PART_OF_PROGRAM]->(p:Program)
       RETURN s.name AS skill, s.status AS status, r.role AS role,
              collect(DISTINCT bc.code) AS codes,
              collect(DISTINCT p.name) AS programs
       ORDER BY s.status, s.name`);
        if (skillResult.records.length > 0) {
            sections.push("");
            sections.push("## Skills → Revenue Mapping");
            sections.push("");
            sections.push("| Skill | Status | Role | Billing Codes | Programs |");
            sections.push("|-------|--------|------|---------------|----------|");
            for (const record of skillResult.records) {
                sections.push(`| ${record.get("skill")} | ${record.get("status")} | ${record.get("role")} | ${record.get("codes").join(", ")} | ${record.get("programs").join(", ")} |`);
            }
        }
        return sections.length > 0
            ? sections.join("\n")
            : "No revenue opportunity data found. Run ETL with revenue model to populate the graph.";
    }
    finally {
        await session.close();
    }
}
