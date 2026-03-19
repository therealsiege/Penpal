export interface EHREntry {
  name: string;
  aliases?: string[];
  integrationMethod?: string;
}

export const ehrSystems: EHREntry[] = [
  { name: "Epic", aliases: ["Epic Systems", "Epic EHR"], integrationMethod: "SMART on FHIR + Bulk FHIR" },
  { name: "athenahealth", aliases: ["Athena", "athena", "Athena One", "AthenaOne", "Athena Practice"], integrationMethod: "FHIR R4 API (OAuth 2.0, scheduled sync, 7 resource types) — ✅ Implemented" },
  { name: "NextGen", aliases: ["NextGen Healthcare", "NextGen EHR"], integrationMethod: "FHIR API + Vim" },
  { name: "eClinicalWorks", aliases: ["ECW", "eCW"], integrationMethod: "FHIR API + Vim" },
  { name: "Oracle Cerner", aliases: ["Cerner", "Oracle Health"], integrationMethod: "Millennium FHIR R4 API (backend services JWT, 8 resource types, DocumentReference write-back) — ✅ Implemented" },
  { name: "Elation", aliases: ["Elation Health", "Elation EHR"], integrationMethod: "FHIR API" },
  { name: "DrChrono", integrationMethod: "FHIR API" },
  { name: "Practice Fusion", integrationMethod: "FHIR API" },
  { name: "Healthie", aliases: ["Healthie EMR"], integrationMethod: "GraphQL API" },
  { name: "MEDITECH", integrationMethod: "FHIR R4" },
  { name: "SimplePractice", integrationMethod: "API" },
  { name: "TherapyNotes", integrationMethod: "API" },
  { name: "AdvancedMD", integrationMethod: "API" },
  { name: "CareCloud", integrationMethod: "API" },
  { name: "ModMed", aliases: ["Modernizing Medicine"], integrationMethod: "API" },
  { name: "Allscripts", aliases: ["Veradigm"], integrationMethod: "FHIR API" },
  { name: "Greenway Health", aliases: ["Greenway"], integrationMethod: "API" },
  { name: "Kareo", aliases: ["Tebra"], integrationMethod: "API" },
];
