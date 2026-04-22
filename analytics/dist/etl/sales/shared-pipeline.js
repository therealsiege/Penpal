import fs from "fs";
import path from "path";
import { config, resolveVaultPath } from "../../shared/config.js";
import { getAnthropic } from "../../shared/connections.js";
import { buildLeadNodeFromDoc } from "../graph/node-builder.js";
import { buildAboutLeadRel } from "../graph/rel-builder.js";
import { scoreLead } from "./lead-scorer.js";
import { trackLeadStage } from "./pipeline-tracker.js";
import { mapLeadToTerritory } from "./territory-mapper.js";
import { stableId } from "../../shared/utils/id.js";
import { normalizeName } from "../../shared/utils/normalize.js";
import { businessArmLabel } from "./venture-config.js";
// ─── Company Extraction via Claude ───────────────────────────────────────────
export async function extractCompanies(articles, venture) {
    if (articles.length === 0)
        return new Map();
    const anthropic = getAnthropic();
    const articleTexts = articles
        .map((a, i) => `[${i}] "${a.title}" (${a.source}) — ${a.snippet}`)
        .join("\n");
    const response = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        messages: [
            {
                role: "user",
                content: `Extract company names from these news articles that could be potential sales leads.

TARGET COMPANIES: ${venture.companyExtractionPrompt}

CRITICAL RULES:
1. Only extract companies that are POTENTIAL CUSTOMERS — companies we could sell to.
2. The article must contain a BUYING SIGNAL: fundraising, hiring, building integrations, migrating platforms, seeking vendors, launching products.
3. Do NOT extract companies merely mentioned in passing, quoted as sources, or referenced as industry examples.
4. Do NOT extract companies from promotional/spam content (self-promotion posts, press releases about awards, "best of" listicles).
5. For each company, include a 1-sentence "signal" explaining WHY this company might be a lead.

Articles:
${articleTexts}

Return ONLY a JSON array: [{"company": "Name", "signal": "Just raised Series A, building FHIR integration", "articles": [0, 2]}]
If no qualifying companies found, return [].`,
            },
        ],
    });
    const rawText = response.content[0].type === "text" ? response.content[0].text : "";
    // Strip markdown code fences if present
    const text = rawText.replace(/```(?:json)?\s*/g, "").replace(/```/g, "").trim();
    // Find the outermost JSON array by bracket matching
    let jsonStr = null;
    const start = text.indexOf("[");
    if (start !== -1) {
        let depth = 0;
        for (let i = start; i < text.length; i++) {
            if (text[i] === "[")
                depth++;
            else if (text[i] === "]")
                depth--;
            if (depth === 0) {
                jsonStr = text.slice(start, i + 1);
                break;
            }
        }
    }
    if (!jsonStr)
        return new Map();
    try {
        const extracted = JSON.parse(jsonStr);
        const companyMap = new Map();
        for (const entry of extracted) {
            if (!entry.company || entry.company.length < 2)
                continue;
            const relatedArticles = entry.articles
                .filter((i) => i >= 0 && i < articles.length)
                .map((i) => articles[i]);
            if (relatedArticles.length > 0) {
                // Attach the signal to the first article's snippet for downstream use
                if (entry.signal && relatedArticles[0]) {
                    relatedArticles[0] = { ...relatedArticles[0], snippet: `${entry.signal}. ${relatedArticles[0].snippet}` };
                }
                companyMap.set(entry.company, relatedArticles);
            }
        }
        return companyMap;
    }
    catch (err) {
        console.warn("  Failed to parse company extraction response:", err.message);
        console.warn("  Raw response:", text.slice(0, 500));
        return new Map();
    }
}
// ─── Deduplication ───────────────────────────────────────────────────────────
export function getExistingLeadNames(venture) {
    const names = new Set();
    const leadsDir = resolveVaultPath(venture.leadsDir);
    if (!fs.existsSync(leadsDir))
        return names;
    for (const file of fs.readdirSync(leadsDir)) {
        if (!file.endsWith(".md"))
            continue;
        const nameMatch = file.match(/^(.+?)\s+[a-f0-9]{32}\.md$/);
        if (nameMatch) {
            names.add(normalizeName(nameMatch[1]));
        }
    }
    return names;
}
// ─── Firecrawl Enrichment ────────────────────────────────────────────────────
export async function enrichWithFirecrawl(companyName) {
    const result = {
        description: "",
        fundingStage: "",
        employeeCount: "",
        techStack: [],
        decisionMaker: "",
        location: "",
    };
    const apiKey = process.env.FIRECRAWL_API_KEY || config.firecrawlApiKey;
    if (!apiKey) {
        console.warn("  FIRECRAWL_API_KEY not set, skipping enrichment");
        return result;
    }
    try {
        const searchRes = await fetch("https://api.firecrawl.dev/v1/search", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                query: `${companyName} healthcare site:${companyName.toLowerCase().replace(/\s+/g, "")}.com OR "${companyName}" healthcare startup`,
                limit: 3,
                scrapeOptions: { formats: ["markdown"] },
            }),
        });
        if (!searchRes.ok) {
            console.warn(`  Firecrawl search failed for ${companyName}: ${searchRes.status}`);
            return result;
        }
        const searchData = (await searchRes.json());
        if (!searchData.success || !searchData.data?.length)
            return result;
        const allText = searchData.data
            .map((r) => `${r.markdown || ""} ${r.metadata?.description || ""}`)
            .join("\n");
        result.description = searchData.data[0]?.metadata?.description || searchData.data[0]?.markdown?.slice(0, 500) || "";
        const topUrl = searchData.data[0]?.url;
        if (topUrl) {
            try {
                const homepage = new URL(topUrl).origin;
                const scrapeRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${apiKey}`,
                    },
                    body: JSON.stringify({
                        url: homepage,
                        formats: ["markdown"],
                        onlyMainContent: true,
                    }),
                });
                if (scrapeRes.ok) {
                    const scrapeData = (await scrapeRes.json());
                    if (scrapeData.success && scrapeData.data?.markdown) {
                        const homeText = scrapeData.data.markdown;
                        if (homeText.length > allText.length) {
                            result.description = scrapeData.data.metadata?.description || result.description;
                        }
                        extractSignals(homeText, result);
                    }
                }
            }
            catch {
                // Homepage scrape failed — use search results only
            }
        }
        extractSignals(allText, result);
    }
    catch (err) {
        console.warn(`  Firecrawl enrichment failed for ${companyName}:`, err.message);
    }
    return result;
}
function extractSignals(text, result) {
    const lower = text.toLowerCase();
    const techSignals = [
        "FHIR", "HL7", "SMART on FHIR", "EHR", "Epic", "Cerner", "athenahealth",
        "Medplum", "Hapi FHIR", "CMS", "interoperability",
    ];
    for (const signal of techSignals) {
        if (lower.includes(signal.toLowerCase()) && !result.techStack.includes(signal)) {
            result.techStack.push(signal);
        }
    }
    if (!result.fundingStage) {
        const fundingMatch = text.match(/(?:Series\s+[A-D]|Seed\s+(?:round|funding)|pre-seed|raised\s+\$[\d.]+[MBK])/i);
        if (fundingMatch)
            result.fundingStage = fundingMatch[0];
    }
    if (!result.employeeCount) {
        const empMatch = text.match(/(\d{1,4})\s*(?:employees|people|team\s*members)/i);
        if (empMatch)
            result.employeeCount = empMatch[1];
    }
    if (!result.decisionMaker) {
        const cxoMatch = text.match(/(?:CEO|CTO|Founder|Co-founder|Chief\s+\w+\s+Officer)[:\s]+([A-Z][a-z]+\s+[A-Z][a-z]+)/);
        if (cxoMatch)
            result.decisionMaker = cxoMatch[1];
    }
    if (!result.location) {
        const locationMatch = text.match(/(?:based in|headquartered in|located in)\s+([A-Z][a-zA-Z\s,]+?)(?:\.|,|\s+and|\s+is)/i);
        if (locationMatch)
            result.location = locationMatch[1].trim();
    }
}
// ─── Lead File Writer ────────────────────────────────────────────────────────
function generateNotionId() {
    const chars = "0123456789abcdef";
    let id = "";
    for (let i = 0; i < 32; i++) {
        id += chars[Math.floor(Math.random() * chars.length)];
    }
    return id;
}
export function writeLeadMarkdown(lead, leadSource) {
    const notionId = generateNotionId();
    const fileName = `${lead.companyName} ${notionId}.md`;
    const leadsDir = resolveVaultPath(lead.venture.leadsDir);
    if (!fs.existsSync(leadsDir)) {
        fs.mkdirSync(leadsDir, { recursive: true });
    }
    const filePath = path.join(leadsDir, fileName);
    const now = new Date();
    const createdTime = now.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
    });
    const sourceTitles = lead.sourceArticles
        .map((a) => `[${a.title}](${a.url})`)
        .join("; ");
    const techStackStr = lead.techStack.length > 0 ? lead.techStack.join(", ") : "";
    const bioLines = [lead.description];
    if (lead.fundingStage)
        bioLines.push(`Funding: ${lead.fundingStage}`);
    if (lead.employeeCount)
        bioLines.push(`~${lead.employeeCount} employees`);
    if (techStackStr)
        bioLines.push(`Tech signals: ${techStackStr}`);
    const content = `# ${lead.companyName}

Location: ${lead.sourceArticles[0]?.source || ""}
Company: ${lead.companyName}
JobTitle: ${lead.decisionMaker || ""}
CreatedTime: ${createdTime}
Type: Prospect
Sales Funnel: Outreach
Bio: ${bioLines.join(". ")}
Business Arm: ${businessArmLabel(lead.venture)}
HTN Member: No
Lead Source: ${leadSource}
Notes: Discovered via ${leadSource}. Keywords: ${[...new Set(lead.sourceArticles.map((a) => a.keyword))].join(", ")}. Sources: ${sourceTitles}
Previous Attempts: No
Priority: ${lead.priority}
Next Action: Research and qualify`;
    fs.writeFileSync(filePath, content, "utf-8");
    console.log(`  Wrote: ${fileName} (${lead.venture.name})`);
    return path.relative(config.vaultPath, filePath);
}
// ─── Graph Push ──────────────────────────────────────────────────────────────
export async function pushLeadToGraph(importer, lead, docRelPath, leadSource) {
    const parsedLead = {
        name: lead.companyName,
        company: lead.companyName,
        location: "",
        jobTitle: lead.decisionMaker || "",
        type: "Prospect",
        salesFunnel: "Outreach",
        priority: lead.priority.replace(/🔵\s*|🟡\s*|🔥\s*|🟢\s*|🟠\s*/g, "").trim(),
        emr: null,
        leadSource,
        bio: lead.description,
        notes: `Keywords: ${[...new Set(lead.sourceArticles.map((a) => a.keyword))].join(", ")}`,
        nextAction: "Research and qualify",
        businessArm: lead.venture.name,
        htnMember: false,
        previousAttempts: false,
        linkedIn: null,
        email: null,
        createdAt: new Date().toISOString(),
    };
    importer.addNode(buildLeadNodeFromDoc(parsedLead, docRelPath));
    importer.addRel(buildAboutLeadRel(docRelPath, lead.companyName, lead.companyName));
    trackLeadStage(importer, lead.companyName, lead.companyName, "Outreach");
    importer.addNode({
        label: "Lead",
        properties: {
            id: stableId("Lead", normalizeName(lead.companyName), normalizeName(lead.companyName)),
            leadScore: lead.score,
        },
    });
}
// ─── Enrichment + Score + Write Pipeline ─────────────────────────────────────
export async function processCompanyForVenture(companyName, articles, venture, importer, leadSource) {
    try {
        const enrichment = await enrichWithFirecrawl(companyName);
        const score = scoreLead({
            createdAt: new Date().toISOString(),
            notes: `Keywords: ${[...new Set(articles.map((a) => a.keyword))].join(", ")}. ${enrichment.description}`,
            bio: enrichment.description,
            emr: enrichment.techStack.some((t) => ["Epic", "Cerner", "athenahealth"].includes(t))
                ? enrichment.techStack.find((t) => ["Epic", "Cerner", "athenahealth"].includes(t))
                : "",
            htnMember: false,
            businessArm: venture.name,
            salesFunnel: "Outreach",
            priority: "",
            jobTitle: enrichment.decisionMaker,
            type: "Prospect",
            location: enrichment.location,
        }, venture.scoringProfile);
        let priority;
        if (score >= 50)
            priority = "🔥 Hot";
        else if (score >= 30)
            priority = "🟡 Warm";
        else
            priority = "🔵 Cold";
        const lead = {
            companyName,
            description: enrichment.description,
            fundingStage: enrichment.fundingStage,
            employeeCount: enrichment.employeeCount,
            techStack: enrichment.techStack,
            decisionMaker: enrichment.decisionMaker,
            sourceArticles: articles,
            score,
            priority,
            venture,
        };
        const relPath = writeLeadMarkdown(lead, leadSource);
        await pushLeadToGraph(importer, lead, relPath, leadSource);
        if (enrichment.location) {
            mapLeadToTerritory(importer, lead.companyName, lead.companyName, enrichment.location);
        }
        return true;
    }
    catch (err) {
        console.warn(`  Failed to process ${companyName}:`, err.message);
        return false;
    }
}
