import fs from "fs";
import { config } from "../../shared/config.js";

export interface WebIntelRecord {
  source: string;
  scrapedAt: string;
  company: string;
  product?: string;
  category: "ambient_scribe" | "revenue_cycle" | "clinical_ai" | "safe_ai" | "health_it" | "research";
  pricing?: string;
  features?: string[];
  doesNotDo?: string[];
  customerCount?: string;
  notableCustomers?: string[];
  positioning?: string;
  fundingInfo?: string;
}

export function parseWebIntel(): WebIntelRecord[] {
  const webIntelPath = config.webIntelPath;

  if (!fs.existsSync(webIntelPath)) {
    console.log("  web-intel.json not found, skipping web intel ingestion");
    return [];
  }

  const raw = fs.readFileSync(webIntelPath, "utf-8");
  const data = JSON.parse(raw) as WebIntelRecord[];

  console.log(`  Loaded ${data.length} web intel records`);
  return data;
}
