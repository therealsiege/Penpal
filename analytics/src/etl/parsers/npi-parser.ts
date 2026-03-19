import { createReadStream } from "fs";
import { parse } from "csv-parse";
import { config } from "../../shared/config.js";

export interface NPIRecord {
  npi: string;
  entityType: string;
  organizationName: string;
  providerLastName: string;
  providerFirstName: string;
  taxonomyCode: string;
  taxonomyDescription: string;
  practiceCity: string;
  practiceState: string;
  practiceZip: string;
  practiceAddress: string;
  isSoleProprietor: string;
  enumerationDate: string;
}

// Target taxonomy codes for primary care
const TARGET_TAXONOMIES = new Set([
  "207Q00000X", // Family Medicine
  "207R00000X", // Internal Medicine
  "208D00000X", // General Practice
  "207QA0505X", // Adult Medicine (FM subspecialty)
]);

const TARGET_STATES = new Set(["TX", "TN", "CO", "NC", "AL"]);

const TAXONOMY_DESCRIPTIONS: Record<string, string> = {
  "207Q00000X": "Family Medicine",
  "207R00000X": "Internal Medicine",
  "208D00000X": "General Practice",
  "207QA0505X": "Adult Medicine",
};

function rowToNPIRecord(row: Record<string, string>): NPIRecord {
  const taxonomyCode = (row["Healthcare Provider Taxonomy Code_1"] || "").trim();
  return {
    npi: (row["NPI"] || "").trim(),
    entityType: (row["Entity Type Code"] || "").trim(),
    organizationName: (row["Provider Organization Name (Legal Business Name)"] || "").trim(),
    providerLastName: (row["Provider Last Name (Legal Name)"] || "").trim(),
    providerFirstName: (row["Provider First Name"] || "").trim(),
    taxonomyCode,
    taxonomyDescription: TAXONOMY_DESCRIPTIONS[taxonomyCode] || "",
    practiceCity: (row["Provider Business Practice Location Address City Name"] || "").trim(),
    practiceState: (row["Provider Business Practice Location Address State Name"] || "").trim(),
    practiceZip: (row["Provider Business Practice Location Address Postal Code"] || "").trim(),
    practiceAddress: (row["Provider First Line Business Practice Location Address"] || "").trim(),
    isSoleProprietor: (row["Is Sole Proprietor"] || "").trim(),
    enumerationDate: (row["Provider Enumeration Date"] || "").trim(),
  };
}

/**
 * Stream the NPPES CSV and collect records matching target taxonomies + states.
 * Used for sourcing new design partner prospects.
 */
export async function streamNPIProspects(): Promise<NPIRecord[]> {
  const npiFilePath = config.npiFilePath;
  if (!npiFilePath) {
    console.log("  NPI file path not configured, skipping NPI prospect sourcing");
    return [];
  }

  console.log(`  Streaming NPPES CSV: ${npiFilePath}`);
  const prospects: NPIRecord[] = [];
  let rowCount = 0;

  const stream = createReadStream(npiFilePath).pipe(
    parse({ columns: true, quote: '"', relax_column_count: true })
  );

  for await (const row of stream) {
    rowCount++;
    if (rowCount % 1_000_000 === 0) {
      console.log(`    Processed ${(rowCount / 1_000_000).toFixed(0)}M rows, found ${prospects.length} prospects...`);
    }

    const taxonomyCode = (row["Healthcare Provider Taxonomy Code_1"] || "").trim();
    const practiceState = (row["Provider Business Practice Location Address State Name"] || "").trim();

    if (TARGET_TAXONOMIES.has(taxonomyCode) && TARGET_STATES.has(practiceState)) {
      prospects.push(rowToNPIRecord(row));
    }
  }

  console.log(`  Processed ${rowCount.toLocaleString()} total rows, found ${prospects.length} matching prospects`);
  return prospects;
}

/**
 * Stream the NPPES CSV and attempt to match existing leads by org name + state.
 * Returns a map of normalized key -> NPIRecord for enrichment.
 */
export async function enrichLeadsFromNPI(
  leads: Array<{ name: string; company: string; state: string }>
): Promise<Map<string, NPIRecord>> {
  const npiFilePath = config.npiFilePath;
  if (!npiFilePath) {
    console.log("  NPI file path not configured, skipping NPI enrichment");
    return new Map();
  }

  // Build lookup index: key = normalized org name + state
  const leadIndex = new Map<string, { name: string; company: string; state: string }>();
  for (const lead of leads) {
    if (lead.company) {
      const key = normalizeForMatch(lead.company) + "|" + (lead.state || "").toUpperCase().trim();
      leadIndex.set(key, lead);
    }
  }

  console.log(`  Matching ${leadIndex.size} leads against NPPES CSV...`);
  const matches = new Map<string, NPIRecord>();
  let rowCount = 0;

  const stream = createReadStream(npiFilePath).pipe(
    parse({ columns: true, quote: '"', relax_column_count: true })
  );

  for await (const row of stream) {
    rowCount++;
    if (rowCount % 1_000_000 === 0) {
      console.log(`    Processed ${(rowCount / 1_000_000).toFixed(0)}M rows, ${matches.size} matches...`);
    }

    const entityType = (row["Entity Type Code"] || "").trim();
    if (entityType !== "2") continue;

    const orgName = (row["Provider Organization Name (Legal Business Name)"] || "").trim();
    const state = (row["Provider Business Practice Location Address State Name"] || "").trim();
    if (!orgName || !state) continue;

    const key = normalizeForMatch(orgName) + "|" + state;
    if (leadIndex.has(key) && !matches.has(key)) {
      matches.set(key, rowToNPIRecord(row));
    }

    if (matches.size >= leadIndex.size) break;
  }

  console.log(`  Matched ${matches.size}/${leadIndex.size} leads with NPI records`);
  return matches;
}

/**
 * Query the NPI Registry API for real-time enrichment.
 */
export async function queryNPIApi(
  params: {
    organizationName?: string;
    firstName?: string;
    lastName?: string;
    state?: string;
    taxonomyDescription?: string;
    enumerationType?: string;
  }
): Promise<NPIRecord[]> {
  const url = new URL(config.npiApiBaseUrl);
  url.searchParams.set("version", "2.1");
  url.searchParams.set("limit", "200");

  if (params.organizationName) url.searchParams.set("organization_name", params.organizationName);
  if (params.firstName) url.searchParams.set("first_name", params.firstName);
  if (params.lastName) url.searchParams.set("last_name", params.lastName);
  if (params.state) url.searchParams.set("state", params.state);
  if (params.taxonomyDescription) url.searchParams.set("taxonomy_description", params.taxonomyDescription);
  if (params.enumerationType) url.searchParams.set("enumeration_type", params.enumerationType);

  const response = await fetch(url.toString());
  if (!response.ok) {
    console.warn(`  NPI API error: ${response.status} ${response.statusText}`);
    return [];
  }

  const data = await response.json() as {
    result_count: number;
    results?: Array<{
      number: string;
      enumeration_type: string;
      basic: {
        organization_name?: string;
        last_name?: string;
        first_name?: string;
        sole_proprietor?: string;
        enumeration_date?: string;
      };
      taxonomies?: Array<{ code: string; desc: string; primary: boolean }>;
      addresses?: Array<{
        address_purpose: string;
        address_1: string;
        city: string;
        state: string;
        postal_code: string;
      }>;
    }>;
  };

  if (!data.results) return [];

  return data.results.map((r) => {
    const primaryTaxonomy = r.taxonomies?.find((t) => t.primary) || r.taxonomies?.[0];
    const practiceAddr = r.addresses?.find((a) => a.address_purpose === "LOCATION") || r.addresses?.[0];

    return {
      npi: r.number,
      entityType: r.enumeration_type === "NPI-1" ? "1" : "2",
      organizationName: r.basic.organization_name || "",
      providerLastName: r.basic.last_name || "",
      providerFirstName: r.basic.first_name || "",
      taxonomyCode: primaryTaxonomy?.code || "",
      taxonomyDescription: primaryTaxonomy?.desc || "",
      practiceCity: practiceAddr?.city || "",
      practiceState: practiceAddr?.state || "",
      practiceZip: practiceAddr?.postal_code || "",
      practiceAddress: practiceAddr?.address_1 || "",
      isSoleProprietor: r.basic.sole_proprietor || "",
      enumerationDate: r.basic.enumeration_date || "",
    };
  });
}

/**
 * Batch query NPI API for a list of leads with 200ms delay between requests.
 */
export async function batchQueryNPIApi(
  leads: Array<{ name: string; company: string; state: string }>
): Promise<Map<string, NPIRecord>> {
  const results = new Map<string, NPIRecord>();
  let queried = 0;
  let matched = 0;

  for (const lead of leads) {
    if (!lead.company) continue;

    const state = (lead.state || "").toUpperCase().trim();
    if (!state || state.length !== 2) continue;

    try {
      const records = await queryNPIApi({
        organizationName: lead.company,
        state,
        enumerationType: "NPI-2",
      });

      if (records.length > 0) {
        const key = normalizeForMatch(lead.company) + "|" + state;
        results.set(key, records[0]);
        matched++;
      }
    } catch {
      // Skip on error, continue with next
    }

    queried++;
    if (queried % 50 === 0) {
      console.log(`    API queries: ${queried}/${leads.length}, matched: ${matched}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  console.log(`  API enrichment: queried ${queried}, matched ${matched}`);
  return results;
}

function normalizeForMatch(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .replace(/\b(llc|inc|corp|pllc|pa|pc|md|do|group|associates|clinic|medical|health|healthcare|practice)\b/g, "")
    .trim();
}
