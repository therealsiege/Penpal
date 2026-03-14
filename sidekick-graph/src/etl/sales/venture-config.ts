import { config } from "../../shared/config.js";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RssFeed {
  url: string;
  name: string;
}

export type ScoringProfile = "clinical" | "integration" | "consulting";

export interface VentureProfile {
  name: string;
  slug: string;
  leadsDir: string;
  alertKeywords: string[];
  rssFeeds: RssFeed[];
  scoringProfile: ScoringProfile;
  companyExtractionPrompt: string;
}

// ─── Venture Profiles ────────────────────────────────────────────────────────

export const ventureProfiles: Record<string, VentureProfile> = {
  medscrub: {
    name: "MedScrub",
    slug: "medscrub",
    leadsDir: "Ventures/1Putt/MedScrub KB/Sales/Leads",
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
      { url: "https://www.beckershospitalreview.com/rss/health-it.xml", name: "Becker's Health IT" },
      { url: "https://www.cms.gov/blog/rss", name: "CMS Blog" },
    ],
    scoringProfile: "clinical",
    companyExtractionPrompt:
      "healthcare startups, clinical AI companies, practice management tools, or companies serving independent physician practices",
  },
  medhook: {
    name: "MedHook",
    slug: "medhook",
    leadsDir: "Ventures/1Putt/MedHook KB/Sales/Leads",
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
      { url: "https://www.healthcareitnews.com/rss", name: "Healthcare IT News" },
      { url: "https://www.fiercehealthcare.com/rss/xml", name: "Fierce Healthcare" },
    ],
    scoringProfile: "integration",
    companyExtractionPrompt:
      "health tech startups, digital health companies building EHR integrations, healthcare data platforms, or companies needing HL7/FHIR/X12 connectivity",
  },
  "1putt": {
    name: "1Putt Health",
    slug: "1putt",
    leadsDir: "Ventures/1Putt/Sales/Leads",
    alertKeywords: [
      "healthcare IT consulting",
      "health tech implementation",
      "EHR migration",
      "healthcare interoperability mandate",
    ],
    rssFeeds: [
      { url: "https://histalk2.com/feed/", name: "HIStalk" },
      { url: "https://www.healthit.gov/buzz-blog/feed", name: "ONC HealthIT" },
    ],
    scoringProfile: "consulting",
    companyExtractionPrompt:
      "healthcare organizations, hospitals, health systems, or companies seeking technology consulting, EHR implementations, or interoperability solutions",
  },
};

// ─── Routing Helpers ─────────────────────────────────────────────────────────

/** Get a venture profile by slug. Returns undefined if not found. */
export function getVentureProfile(slug: string): VentureProfile | undefined {
  return ventureProfiles[slug.toLowerCase()];
}

/** Get all venture slugs. */
export function getVentureSlugs(): string[] {
  return Object.keys(ventureProfiles);
}

/**
 * Route an alert keyword to matching venture(s).
 * Returns all ventures whose alertKeywords include a case-insensitive substring match.
 */
export function routeAlertKeyword(keyword: string): VentureProfile[] {
  const lower = keyword.toLowerCase();
  const matches: VentureProfile[] = [];

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
    if (fallback) matches.push(fallback);
  }

  return matches;
}

/**
 * Route article text content to matching venture(s) by keyword signals.
 * Used by RSS ingester to determine which ventures an article is relevant to.
 */
export function routeArticleToVentures(title: string, content: string): VentureProfile[] {
  const text = `${String(title || "")} ${String(content || "")}`.toLowerCase();
  const matches: VentureProfile[] = [];

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
export function businessArmLabel(profile: VentureProfile): string {
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
export function parseVentureFlag(): string | null {
  const idx = process.argv.indexOf("--venture");
  if (idx === -1 || idx + 1 >= process.argv.length) return null;
  return process.argv[idx + 1].toLowerCase();
}

/** Get filtered venture profiles based on --venture flag. Returns all if no flag. */
export function getTargetVentures(): VentureProfile[] {
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
