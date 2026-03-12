import { stableId } from "../../shared/utils/id.js";
import { RelRecord } from "../db/queries.js";
import { normalizeName } from "../../shared/utils/normalize.js";
import { ParsedDocument } from "../parsers/markdown-parser.js";
import { ParsedLead } from "../parsers/lead-parser.js";
import { CRMRecord } from "../parsers/csv-parser.js";
import { ExtractedEntities } from "../parsers/entity-extractor.js";
import { InternalLink } from "../parsers/link-extractor.js";
import { companies } from "../dictionaries/companies.js";
import { people } from "../dictionaries/people.js";
import { ehrSystems } from "../dictionaries/ehr-systems.js";

// Document → Folder
export function buildInFolderRel(docRelPath: string, folderPath: string): RelRecord {
  return {
    fromLabel: "Document",
    fromId: stableId("Document", docRelPath),
    toLabel: "Folder",
    toId: stableId("Folder", folderPath),
    type: "IN_FOLDER",
  };
}

// Folder → Folder
export function buildParentFolderRel(childPath: string, parentPath: string): RelRecord {
  return {
    fromLabel: "Folder",
    fromId: stableId("Folder", childPath),
    toLabel: "Folder",
    toId: stableId("Folder", parentPath),
    type: "PARENT_FOLDER",
  };
}

// Document → Tag
export function buildTaggedWithRel(docRelPath: string, tag: string): RelRecord {
  return {
    fromLabel: "Document",
    fromId: stableId("Document", docRelPath),
    toLabel: "Tag",
    toId: stableId("Tag", tag),
    type: "TAGGED_WITH",
  };
}

// Document → Document (internal links)
export function buildLinksToRel(sourceRelPath: string, targetRelPath: string): RelRecord {
  return {
    fromLabel: "Document",
    fromId: stableId("Document", sourceRelPath),
    toLabel: "Document",
    toId: stableId("Document", targetRelPath),
    type: "LINKS_TO",
  };
}

// Document → entity mention relationships
export function buildMentionRels(
  docRelPath: string,
  entities: ExtractedEntities
): RelRecord[] {
  const rels: RelRecord[] = [];
  const docId = stableId("Document", docRelPath);

  for (const c of entities.companies) {
    rels.push({
      fromLabel: "Document", fromId: docId,
      toLabel: "Company", toId: stableId("Company", normalizeName(c.name)),
      type: "MENTIONS_COMPANY",
    });
  }

  for (const p of entities.people) {
    rels.push({
      fromLabel: "Document", fromId: docId,
      toLabel: "Person", toId: stableId("Person", normalizeName(p.name)),
      type: "MENTIONS_PERSON",
    });
  }

  for (const t of entities.technologies) {
    rels.push({
      fromLabel: "Document", fromId: docId,
      toLabel: "Technology", toId: stableId("Technology", normalizeName(t.name)),
      type: "MENTIONS_TECH",
    });
  }

  for (const e of entities.ehrSystems) {
    rels.push({
      fromLabel: "Document", fromId: docId,
      toLabel: "EHRSystem", toId: stableId("EHRSystem", normalizeName(e.name)),
      type: "MENTIONS_EHR",
    });
  }

  for (const s of entities.skills) {
    rels.push({
      fromLabel: "Document", fromId: docId,
      toLabel: "Skill", toId: stableId("Skill", s.skillId),
      type: "MENTIONS_SKILL",
    });
  }

  for (const r of entities.regulations) {
    rels.push({
      fromLabel: "Document", fromId: docId,
      toLabel: "Regulation", toId: stableId("Regulation", normalizeName(r.name)),
      type: "MENTIONS_REGULATION",
    });
  }

  return rels;
}

// Document → Lead (for lead doc files)
export function buildAboutLeadRel(docRelPath: string, leadName: string, leadCompany: string): RelRecord {
  return {
    fromLabel: "Document",
    fromId: stableId("Document", docRelPath),
    toLabel: "Lead",
    toId: stableId("Lead", normalizeName(leadName), normalizeName(leadCompany)),
    type: "ABOUT_LEAD",
  };
}

// Person → Company (WORKS_AT)
export function buildWorksAtRels(): RelRecord[] {
  const rels: RelRecord[] = [];
  for (const person of people) {
    if (!person.company) continue;
    // Find the company in our dictionary
    const company = companies.find(
      (c) =>
        normalizeName(c.name) === normalizeName(person.company!) ||
        c.aliases?.some((a) => normalizeName(a) === normalizeName(person.company!))
    );
    if (company) {
      rels.push({
        fromLabel: "Person",
        fromId: stableId("Person", normalizeName(person.name)),
        toLabel: "Company",
        toId: stableId("Company", normalizeName(company.name)),
        type: "WORKS_AT",
      });
    }
  }
  return rels;
}

// Company → Company (COMPETES_WITH)
export function buildCompetesWithRels(): RelRecord[] {
  const rels: RelRecord[] = [];
  const competitors = companies.filter((c) => c.type === "competitor");
  const ownCompanies = companies.filter((c) => c.type === "own");

  for (const own of ownCompanies) {
    for (const comp of competitors) {
      rels.push({
        fromLabel: "Company",
        fromId: stableId("Company", normalizeName(comp.name)),
        toLabel: "Company",
        toId: stableId("Company", normalizeName(own.name)),
        type: "COMPETES_WITH",
      });
    }
  }
  return rels;
}

// Lead → Company (CONTACT_AT)
export function buildLeadContactAtRel(leadName: string, leadCompany: string, companyName: string): RelRecord {
  return {
    fromLabel: "Lead",
    fromId: stableId("Lead", normalizeName(leadName), normalizeName(leadCompany)),
    toLabel: "Company",
    toId: stableId("Company", normalizeName(companyName)),
    type: "CONTACT_AT",
  };
}

// Lead → EHRSystem (USES_EHR)
export function buildLeadUsesEHRRel(leadName: string, leadCompany: string, ehrName: string): RelRecord {
  return {
    fromLabel: "Lead",
    fromId: stableId("Lead", normalizeName(leadName), normalizeName(leadCompany)),
    toLabel: "EHRSystem",
    toId: stableId("EHRSystem", normalizeName(ehrName)),
    type: "USES_EHR",
  };
}

/** Resolve an EMR name from a lead to a canonical EHR system name */
export function resolveEHRName(emrValue: string): string | null {
  const lower = emrValue.toLowerCase().trim();
  for (const ehr of ehrSystems) {
    if (normalizeName(ehr.name) === lower) return ehr.name;
    if (ehr.aliases?.some((a) => normalizeName(a) === lower)) return ehr.name;
  }
  return null;
}

// --- Phase 1: DocumentChunk relationships ---

/** Document → DocumentChunk (HAS_CHUNK) */
export function buildHasChunkRel(docRelPath: string, chunkDocPath: string, chunkIndex: number): RelRecord {
  return {
    fromLabel: "Document",
    fromId: stableId("Document", docRelPath),
    toLabel: "DocumentChunk",
    toId: stableId("DocumentChunk", chunkDocPath, String(chunkIndex)),
    type: "HAS_CHUNK",
    properties: { chunkIndex },
  };
}

/** DocumentChunk → DocumentChunk (NEXT_CHUNK) */
export function buildNextChunkRel(docPath: string, fromIndex: number, toIndex: number): RelRecord {
  return {
    fromLabel: "DocumentChunk",
    fromId: stableId("DocumentChunk", docPath, String(fromIndex)),
    toLabel: "DocumentChunk",
    toId: stableId("DocumentChunk", docPath, String(toIndex)),
    type: "NEXT_CHUNK",
  };
}

// --- Phase 2: Entity extraction relationships ---

/** Company → Market (OPERATES_IN) */
export function buildOperatesInRel(companyName: string, marketName: string): RelRecord {
  return {
    fromLabel: "Company",
    fromId: stableId("Company", normalizeName(companyName)),
    toLabel: "Market",
    toId: stableId("Market", normalizeName(marketName)),
    type: "OPERATES_IN",
  };
}

/** Skill → Market (ADDRESSES) */
export function buildAddressesRel(skillId: string, marketName: string): RelRecord {
  return {
    fromLabel: "Skill",
    fromId: stableId("Skill", skillId),
    toLabel: "Market",
    toId: stableId("Market", normalizeName(marketName)),
    type: "ADDRESSES",
  };
}

/** Company → Event (HAD_EVENT) */
export function buildHadEventRel(companyName: string, eventDescription: string, eventDate: string): RelRecord {
  return {
    fromLabel: "Company",
    fromId: stableId("Company", normalizeName(companyName)),
    toLabel: "Event",
    toId: stableId("Event", normalizeName(eventDescription), eventDate),
    type: "HAD_EVENT",
  };
}

/** Event → Document (REPORTED_IN) */
export function buildReportedInRel(eventDescription: string, eventDate: string, docRelPath: string): RelRecord {
  return {
    fromLabel: "Event",
    fromId: stableId("Event", normalizeName(eventDescription), eventDate),
    toLabel: "Document",
    toId: stableId("Document", docRelPath),
    type: "REPORTED_IN",
  };
}

/** DocumentChunk → Entity (MENTIONS_ENTITY) with confidence/context/sentiment */
export function buildChunkMentionsEntityRel(
  chunkDocPath: string,
  chunkIndex: number,
  entityLabel: string,
  entityId: string,
  properties: { confidence: number; context: string; sentiment?: string },
): RelRecord {
  return {
    fromLabel: "DocumentChunk",
    fromId: stableId("DocumentChunk", chunkDocPath, String(chunkIndex)),
    toLabel: entityLabel,
    toId: entityId,
    type: "MENTIONS_ENTITY",
    properties,
  };
}

// --- Phase 3: Sales pipeline + territory relationships ---

/** Lead → SalesStage (CURRENT_STAGE) */
export function buildCurrentStageRel(
  leadName: string,
  leadCompany: string,
  stageName: string,
): RelRecord {
  return {
    fromLabel: "Lead",
    fromId: stableId("Lead", normalizeName(leadName), normalizeName(leadCompany)),
    toLabel: "SalesStage",
    toId: stableId("SalesStage", normalizeName(stageName)),
    type: "CURRENT_STAGE",
  };
}

/** Lead → SalesStage (ENTERED_STAGE) with timestamps */
export function buildEnteredStageRel(
  leadName: string,
  leadCompany: string,
  stageName: string,
  enteredAt: string,
  exitedAt?: string,
): RelRecord {
  return {
    fromLabel: "Lead",
    fromId: stableId("Lead", normalizeName(leadName), normalizeName(leadCompany)),
    toLabel: "SalesStage",
    toId: stableId("SalesStage", normalizeName(stageName)),
    type: "ENTERED_STAGE",
    properties: { enteredAt, exitedAt: exitedAt || "" },
  };
}

/** Lead → Territory (LOCATED_IN) */
export function buildLocatedInRel(
  leadName: string,
  leadCompany: string,
  territoryName: string,
): RelRecord {
  return {
    fromLabel: "Lead",
    fromId: stableId("Lead", normalizeName(leadName), normalizeName(leadCompany)),
    toLabel: "Territory",
    toId: stableId("Territory", normalizeName(territoryName)),
    type: "LOCATED_IN",
  };
}

/** Territory → Territory (PART_OF) for state → region hierarchy */
export function buildPartOfRel(childTerritory: string, parentTerritory: string): RelRecord {
  return {
    fromLabel: "Territory",
    fromId: stableId("Territory", normalizeName(childTerritory)),
    toLabel: "Territory",
    toId: stableId("Territory", normalizeName(parentTerritory)),
    type: "PART_OF",
  };
}
