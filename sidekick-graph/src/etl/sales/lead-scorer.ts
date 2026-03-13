import { parseDate } from "../../shared/utils/dates.js";

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
export function scoreLead(input: LeadScoreInput): number {
  let score = 0;

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

  // EHR match (up to 15 points): having a known EHR increases value
  if (input.emr) score += 15;

  // HTN membership (10 points)
  if (input.htnMember) score += 10;

  // Business arm alignment (up to 10 points)
  if (input.businessArm) score += 10;

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

  // --- Revenue-oriented scoring factors ---

  // Medicare-heavy specialty (up to 15 points): higher CCM/RPM/APCM potential
  const titleAndType = `${input.jobTitle || ""} ${input.type || ""}`.toLowerCase();
  const medicareHeavySpecialties = [
    "family medicine", "internal medicine", "geriatrics",
    "cardiology", "endocrinology", "pulmonology", "nephrology",
  ];
  const ccmHighSpecialties = [
    "family medicine", "internal medicine", "geriatrics",
    "cardiology", "endocrinology",
  ];

  if (ccmHighSpecialties.some((s) => titleAndType.includes(s))) {
    score += 15; // high CCM potential
  } else if (medicareHeavySpecialties.some((s) => titleAndType.includes(s))) {
    score += 10; // moderate Medicare revenue potential
  } else if (titleAndType.includes("concierge")) {
    score += 8; // tech-forward, willing to pay
  }

  // Practice size signal (up to 5 points): "solo", "group", "practice" in notes/bio
  const allText = `${input.notes || ""} ${input.bio || ""}`.toLowerCase();
  if (allText.includes("solo") || allText.includes("independent")) {
    score += 5; // ideal ICP — small independent practice
  } else if (allText.includes("group practice") || allText.includes("small practice")) {
    score += 4;
  }

  // MIPS eligibility signal (up to 5 points)
  if (allText.includes("mips") || allText.includes("quality") || allText.includes("medicare")) {
    score += 5;
  }

  return Math.min(100, score);
}
