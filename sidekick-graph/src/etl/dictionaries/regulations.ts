export interface RegulationEntry {
  name: string;
  description: string;
  aliases?: string[];
}

export const regulations: RegulationEntry[] = [
  { name: "CMS-0057-F", description: "CMS Interoperability and Prior Authorization Final Rule", aliases: ["CMS 0057", "CMS-0057"] },
  { name: "HIPAA", description: "Health Insurance Portability and Accountability Act" },
  { name: "AB 3030", description: "California AI disclosure requirement for patient communications" },
  { name: "MIPS", description: "Merit-based Incentive Payment System" },
  { name: "HEDIS", description: "Healthcare Effectiveness Data and Information Set" },
  { name: "USPSTF", description: "US Preventive Services Task Force guidelines", aliases: ["US Preventative Services Task Force"] },
  { name: "SOC 2", description: "Service Organization Control 2 compliance", aliases: ["SOC2"] },
  { name: "HITRUST", description: "Health Information Trust Alliance certification" },
  { name: "SBIR", description: "Small Business Innovation Research grants" },
  { name: "STARS", description: "CMS Star Ratings for Medicare Advantage plans", aliases: ["Stars", "Stars Rating", "Stars ratings"] },
];
