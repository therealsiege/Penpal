// ─── Venture Profiles ────────────────────────────────────────────────────────
export const ventureProfiles = {
    medscrub: {
        name: "MedScrub",
        slug: "medscrub",
        leadsDir: "1Putt/MedScrub KB/Sales/Leads",
        alertKeywords: [
            "independent physician practice AI",
            "clinical AI small practice",
            "population health screening",
            "athenahealth AI",
            "USPSTF screening compliance",
            "ambient scribe primary care",
        ],
        rssFeeds: [
            { url: "https://histalk2.com/feed/", name: "HIStalk" },
            { url: "https://medcitynews.com/feed/", name: "MedCity News" },
            // CMS feed embeds HTML anchor tags in <link> elements; handled by cleanItemLink()
            { url: "https://www.cms.gov/newsroom/rss-feeds", name: "CMS Newsroom" },
        ],
        scoringProfile: "clinical",
        companyExtractionPrompt: `early-stage healthcare startups (Seed to Series C) that are:
- Building clinical AI or ambient scribe tools for primary care or independent practices
- Practice management platforms targeting small/independent physician groups
- Population health or screening compliance tools

EXCLUDE: large established companies (Epic, Cerner, Google, Amazon, UnitedHealth), news outlets, hospitals/health systems themselves, orthodontists, dental practices, specialty clinics, pharmaceutical companies, and insurance companies.
Only include a company if the article suggests they are BUILDING technology, not just USING it.`,
    },
    medhook: {
        name: "MedHook",
        slug: "medhook",
        leadsDir: "1Putt/MedHook KB/Sales/Leads",
        alertKeywords: [
            "healthcare data integration",
            "FHIR integration startup",
            "HL7 interoperability",
            "EHR API connectivity",
            "Mirth Connect alternative",
            "Rhapsody healthcare",
            "health data exchange platform",
        ],
        rssFeeds: [
            { url: "https://www.healthcareitnews.com/feed", name: "Healthcare IT News" },
            { url: "https://www.fiercehealthcare.com/rss/xml", name: "Fierce Healthcare" },
        ],
        scoringProfile: "integration",
        companyExtractionPrompt: `health tech startups or digital health companies (Seed to Series C) that show signals of NEEDING integration help:
- Actively building or struggling with EHR integrations (Epic, Cerner, athena)
- Using or replacing Mirth Connect, Rhapsody, or legacy HL7v2 infrastructure
- Building healthcare data platforms that need FHIR/HL7/X12 connectivity
- Hiring integration engineers or posting about integration challenges

EXCLUDE: large established companies (Epic, Cerner, Google, Amazon, Microsoft, Palantir), EHR vendors themselves, news outlets, hospitals, health systems, insurers, and pharmaceutical companies.
Only include companies that appear to be BUILDING integration technology or STRUGGLING with connectivity — not companies merely mentioned in passing.`,
    },
    "1putt": {
        name: "1Putt Health",
        slug: "1putt",
        leadsDir: "1Putt/Sales/Leads",
        alertKeywords: [
            "healthcare CTO hire",
            "FHIR consultant",
            "EHR migration consulting",
            "healthcare interoperability mandate",
            "health tech implementation partner",
            "healthcare IT consulting RFP",
            "digital health technical advisor",
            "Epic implementation consulting",
        ],
        rssFeeds: [
            { url: "https://histalk2.com/feed/", name: "HIStalk" },
            { url: "https://www.healthit.gov/buzz-blog/feed", name: "ONC HealthIT" },
        ],
        scoringProfile: "consulting",
        companyExtractionPrompt: `digital health companies or healthcare organizations that show signals of NEEDING consulting help:
- Companies announcing EHR migrations, platform re-architectures, or vendor transitions
- Startups that just raised funding and need to build a technical team or strategy
- Organizations issuing RFPs for healthcare IT implementation or interoperability
- Companies mentioned as hiring a CTO, VP of Engineering, or seeking technical advisors

EXCLUDE: large established consultancies (Deloitte, Accenture, McKinsey), EHR vendors, news outlets, government agencies, and companies merely mentioned in policy or regulatory news.
Only include companies with a clear signal they need EXTERNAL technical help — not companies reporting quarterly earnings or making acquisitions.`,
    },
};
// ─── Routing Helpers ─────────────────────────────────────────────────────────
/** Get a venture profile by slug. Returns undefined if not found. */
export function getVentureProfile(slug) {
    return ventureProfiles[slug.toLowerCase()];
}
/** Get all venture slugs. */
export function getVentureSlugs() {
    return Object.keys(ventureProfiles);
}
/**
 * Route an alert keyword to matching venture(s).
 * Returns all ventures whose alertKeywords include a case-insensitive substring match.
 */
export function routeAlertKeyword(keyword) {
    const lower = keyword.toLowerCase();
    const matches = [];
    for (const profile of Object.values(ventureProfiles)) {
        for (const ak of profile.alertKeywords) {
            if (lower.includes(ak.toLowerCase()) || ak.toLowerCase().includes(lower)) {
                matches.push(profile);
                break;
            }
        }
    }
    // If no specific match, default to 1Putt (general intelligence)
    if (matches.length === 0) {
        const fallback = ventureProfiles["1putt"];
        if (fallback)
            matches.push(fallback);
    }
    return matches;
}
/**
 * Route article text content to matching venture(s) by keyword signals.
 * Used by RSS ingester to determine which ventures an article is relevant to.
 */
function toStr(val) {
    if (val == null)
        return "";
    if (typeof val === "string")
        return val;
    if (typeof val === "object" && "_" in val)
        return String(val._);
    try {
        return JSON.stringify(val);
    }
    catch {
        return "";
    }
}
export function routeArticleToVentures(title, content) {
    const text = `${toStr(title)} ${toStr(content)}`.toLowerCase();
    const matches = [];
    // MedScrub signals
    const medscrubSignals = [
        "primary care", "family medicine", "internal medicine", "independent practice",
        "small practice", "physician practice", "clinical ai", "screening", "uspstf",
        "athenahealth", "ambient scribe", "population health", "preventive care",
        "practice management", "point of care",
    ];
    if (medscrubSignals.some((s) => text.includes(s))) {
        matches.push(ventureProfiles.medscrub);
    }
    // MedHook signals
    const medhookSignals = [
        "fhir", "hl7", "x12", "interoperability", "data integration", "ehr integration",
        "api connectivity", "mirth", "rhapsody", "health data exchange", "edi",
        "healthcare api", "data platform", "integration engine",
    ];
    if (medhookSignals.some((s) => text.includes(s))) {
        matches.push(ventureProfiles.medhook);
    }
    // 1Putt signals (broad — catches general healthcare IT)
    const oneputtSignals = [
        "consulting", "implementation", "ehr migration", "digital transformation",
        "health system", "hospital", "regulatory", "cms rule", "onc",
    ];
    if (oneputtSignals.some((s) => text.includes(s))) {
        matches.push(ventureProfiles["1putt"]);
    }
    // Default: if no match, route to 1Putt for general intelligence
    if (matches.length === 0) {
        matches.push(ventureProfiles["1putt"]);
    }
    return matches;
}
/** Business arm display string for a venture. */
export function businessArmLabel(profile) {
    switch (profile.slug) {
        case "medscrub":
            return "🟢 MedScrub";
        case "medhook":
            return "🔵 MedHook";
        case "1putt":
            return "🟠 1Putt Health";
        default:
            return profile.name;
    }
}
/** Parse --venture flag from process.argv */
export function parseVentureFlag() {
    const idx = process.argv.indexOf("--venture");
    if (idx === -1 || idx + 1 >= process.argv.length)
        return null;
    return process.argv[idx + 1].toLowerCase();
}
/** Get filtered venture profiles based on --venture flag. Returns all if no flag. */
export function getTargetVentures() {
    const flag = parseVentureFlag();
    if (flag) {
        const profile = getVentureProfile(flag);
        if (!profile) {
            console.error(`Unknown venture: "${flag}". Available: ${getVentureSlugs().join(", ")}`);
            process.exit(1);
        }
        return [profile];
    }
    return Object.values(ventureProfiles);
}
