import { parseDate } from "../../shared/utils/dates.js";
import type { ScoringProfile } from "./venture-config.js";

export interface LeadScoreInput {
  createdAt: string;
  notes: string;
  bio: string;
  emr: string;
  htnMember: boolean;
  businessArm: string;
  salesFunnel: string;
  priority: string;
  jobTitle?: string;
  type?: string;
  location?: string;
}

/** Score a lead based on multiple signals. Returns 0-100. */
export function scoreLead(input: LeadScoreInput, profile: ScoringProfile = "clinical"): number {
  let score = 0;

  // ── Common factors (all profiles) ──────────────────────────────────────────

  // Recency (up to 25 points): more recent = higher score
  if (input.createdAt) {
    const created = parseDate(input.createdAt);
    if (created) {
      const createdDate = new Date(created);
      const now = new Date();
      const daysSince = (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince < 30) score += 25;
      else if (daysSince < 90) score += 20;
      else if (daysSince < 180) score += 15;
      else if (daysSince < 365) score += 10;
      else score += 5;
    }
  }

  // Notes depth (up to 20 points): longer notes indicate more engagement
  const notesLen = (input.notes || "").length + (input.bio || "").length;
  if (notesLen > 1000) score += 20;
  else if (notesLen > 500) score += 15;
  else if (notesLen > 200) score += 10;
  else if (notesLen > 50) score += 5;

  // Sales funnel position (up to 15 points)
  const funnel = (input.salesFunnel || "").toLowerCase();
  if (funnel.includes("closed won") || funnel.includes("customer")) score += 15;
  else if (funnel.includes("proposal") || funnel.includes("contract")) score += 12;
  else if (funnel.includes("demo")) score += 10;
  else if (funnel.includes("qualified")) score += 8;
  else if (funnel.includes("outreach") || funnel.includes("prospect")) score += 5;

  // Priority boost (up to 5 points)
  const priority = (input.priority || "").toLowerCase();
  if (priority.includes("high") || priority === "1") score += 5;
  else if (priority.includes("medium") || priority === "2") score += 3;

  // ── Profile-specific factors ───────────────────────────────────────────────

  const allText = `${input.notes || ""} ${input.bio || ""}`.toLowerCase();
  const titleAndType = `${input.jobTitle || ""} ${input.type || ""}`.toLowerCase();

  switch (profile) {
    case "clinical":
      score += scoreClinical(input, allText, titleAndType);
      break;
    case "integration":
      score += scoreIntegration(allText);
      break;
    case "consulting":
      score += scoreConsulting(allText, titleAndType);
      break;
  }

  return Math.min(100, score);
}

// ── Clinical profile (MedScrub) ──────────────────────────────────────────────

function scoreClinical(input: LeadScoreInput, allText: string, titleAndType: string): number {
  let score = 0;

  // EHR match (up to 15 points)
  if (input.emr) score += 15;

  // HTN membership (10 points)
  if (input.htnMember) score += 10;

  // Business arm alignment (up to 10 points)
  if (input.businessArm) score += 10;

  // Medicare-heavy specialty (up to 15 points)
  const ccmHighSpecialties = [
    "family medicine", "internal medicine", "geriatrics",
    "cardiology", "endocrinology",
  ];
  const medicareHeavySpecialties = [
    ...ccmHighSpecialties, "pulmonology", "nephrology",
  ];

  if (ccmHighSpecialties.some((s) => titleAndType.includes(s))) {
    score += 15;
  } else if (medicareHeavySpecialties.some((s) => titleAndType.includes(s))) {
    score += 10;
  } else if (titleAndType.includes("concierge")) {
    score += 8;
  }

  // Practice size signal (up to 5 points)
  if (allText.includes("solo") || allText.includes("independent")) {
    score += 5;
  } else if (allText.includes("group practice") || allText.includes("small practice")) {
    score += 4;
  }

  // MIPS eligibility signal (up to 5 points)
  if (allText.includes("mips") || allText.includes("quality") || allText.includes("medicare")) {
    score += 5;
  }

  return score;
}

// ── Integration profile (MedHook) ────────────────────────────────────────────

function scoreIntegration(allText: string): number {
  let score = 0;

  // Integration pain signals (up to 15 points)
  const integrationSignals = [
    "mirth", "rhapsody", "hl7", "fhir", "integration", "interoperability",
    "edi", "x12", "data exchange", "interface engine",
  ];
  if (integrationSignals.some((s) => allText.includes(s))) score += 15;

  // Funding stage (up to 10 points): Series A/B = actively spending on infra
  if (allText.match(/series\s+[ab]/i)) score += 10;
  else if (allText.match(/seed|pre-seed/i)) score += 6;
  else if (allText.match(/series\s+[c-z]/i)) score += 4;

  // Tech stack signals (up to 10 points)
  const techSignals = ["api", "developer", "platform", "sdk", "webhook", "rest"];
  if (techSignals.some((s) => allText.includes(s))) score += 10;

  // Digital health vertical (5 points)
  const verticalSignals = ["digital health", "health tech", "healthtech", "telehealth", "remote monitoring"];
  if (verticalSignals.some((s) => allText.includes(s))) score += 5;

  // Engineer count / hiring signals (5 points)
  const hiringSignals = ["hiring engineer", "engineering team", "developer", "cto", "vp engineering"];
  if (hiringSignals.some((s) => allText.includes(s))) score += 5;

  return score;
}

// ── Consulting profile (1Putt Health) ────────────────────────────────────────

function scoreConsulting(allText: string, titleAndType: string): number {
  let score = 0;

  // Organization size signals (up to 10 points)
  const orgSignals = ["health system", "hospital", "enterprise", "large practice", "multi-site"];
  if (orgSignals.some((s) => allText.includes(s))) score += 10;

  // Implementation signals (up to 15 points)
  const implSignals = ["migration", "implementation", "consulting", "rfp", "vendor selection", "go-live"];
  if (implSignals.some((s) => allText.includes(s))) score += 15;

  // Budget indicators (up to 10 points)
  const budgetSignals = ["funding", "budget", "investment", "raised", "capital"];
  if (budgetSignals.some((s) => allText.includes(s))) score += 10;

  // EHR platform mentions (5 points)
  const ehrSignals = ["epic", "cerner", "oracle health", "athenahealth", "meditech", "allscripts"];
  if (ehrSignals.some((s) => allText.includes(s))) score += 5;

  return score;
}
