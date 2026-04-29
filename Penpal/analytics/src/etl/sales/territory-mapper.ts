import { GraphImporter } from "../graph/importer.js";
import { buildTerritoryNode, TerritoryData } from "../graph/node-builder.js";
import { buildLocatedInRel, buildPartOfRel } from "../graph/rel-builder.js";

/** US state abbreviation to full name mapping */
const STATE_ABBREV: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas",
  CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware",
  FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho",
  IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas",
  KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi",
  MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada",
  NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York",
  NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma",
  OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah",
  VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia",
  WI: "Wisconsin", WY: "Wyoming", DC: "District of Columbia",
};

/** Reverse map: full state name → abbreviation */
const STATE_NAMES: Record<string, string> = {};
for (const [abbrev, name] of Object.entries(STATE_ABBREV)) {
  STATE_NAMES[name.toLowerCase()] = abbrev;
}

/** US Census regions */
const REGIONS: Record<string, string[]> = {
  "Northeast": ["CT", "ME", "MA", "NH", "RI", "VT", "NJ", "NY", "PA"],
  "Southeast": ["AL", "AR", "DE", "FL", "GA", "KY", "LA", "MD", "MS", "NC", "SC", "TN", "VA", "WV", "DC"],
  "Midwest": ["IL", "IN", "IA", "KS", "MI", "MN", "MO", "NE", "ND", "OH", "SD", "WI"],
  "Southwest": ["AZ", "NM", "OK", "TX"],
  "West": ["AK", "CA", "CO", "HI", "ID", "MT", "NV", "OR", "UT", "WA", "WY"],
};

/** Build reverse lookup: state abbreviation → region */
const STATE_TO_REGION: Record<string, string> = {};
for (const [region, states] of Object.entries(REGIONS)) {
  for (const state of states) {
    STATE_TO_REGION[state] = region;
  }
}

/** Parse a location string to extract a US state */
export function parseState(location: string): string | null {
  if (!location) return null;
  const trimmed = location.trim();

  // Try matching "City, ST" pattern
  const commaMatch = trimmed.match(/,\s*([A-Z]{2})\s*$/);
  if (commaMatch && STATE_ABBREV[commaMatch[1]]) {
    return commaMatch[1];
  }

  // Try matching full state name
  const lower = trimmed.toLowerCase();
  for (const [name, abbrev] of Object.entries(STATE_NAMES)) {
    if (lower.includes(name)) {
      return abbrev;
    }
  }

  // Try matching just a state abbreviation (standalone)
  const abbrMatch = trimmed.match(/\b([A-Z]{2})\b/);
  if (abbrMatch && STATE_ABBREV[abbrMatch[1]]) {
    return abbrMatch[1];
  }

  return null;
}

/** Get region for a state abbreviation */
export function getRegion(stateAbbrev: string): string | null {
  return STATE_TO_REGION[stateAbbrev] || null;
}

const seededTerritories = new Set<string>();

/** Seed territory nodes and hierarchy, then link a lead to its territory */
export function mapLeadToTerritory(
  importer: GraphImporter,
  leadName: string,
  leadCompany: string,
  location: string,
): void {
  const stateAbbrev = parseState(location);
  if (!stateAbbrev) return;

  const stateName = STATE_ABBREV[stateAbbrev];
  const regionName = getRegion(stateAbbrev);

  // Seed state territory if not already done
  if (!seededTerritories.has(stateName)) {
    importer.addNode(buildTerritoryNode({ name: stateName, type: "state" }));
    seededTerritories.add(stateName);
  }

  // Seed region territory and link if applicable
  if (regionName && !seededTerritories.has(regionName)) {
    importer.addNode(buildTerritoryNode({ name: regionName, type: "region" }));
    seededTerritories.add(regionName);
  }

  if (regionName) {
    importer.addRel(buildPartOfRel(stateName, regionName));
  }

  // Link lead to state
  importer.addRel(buildLocatedInRel(leadName, leadCompany, stateName));
}
