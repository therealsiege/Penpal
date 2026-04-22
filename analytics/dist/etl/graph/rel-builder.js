import { stableId } from "../../shared/utils/id.js";
import { normalizeName } from "../../shared/utils/normalize.js";
import { companies } from "../dictionaries/companies.js";
import { people } from "../dictionaries/people.js";
import { ehrSystems } from "../dictionaries/ehr-systems.js";
// Document → Folder
export function buildInFolderRel(docRelPath, folderPath) {
    return {
        fromLabel: "Document",
        fromId: stableId("Document", docRelPath),
        toLabel: "Folder",
        toId: stableId("Folder", folderPath),
        type: "IN_FOLDER",
    };
}
// Folder → Folder
export function buildParentFolderRel(childPath, parentPath) {
    return {
        fromLabel: "Folder",
        fromId: stableId("Folder", childPath),
        toLabel: "Folder",
        toId: stableId("Folder", parentPath),
        type: "PARENT_FOLDER",
    };
}
// Document → Tag
export function buildTaggedWithRel(docRelPath, tag) {
    return {
        fromLabel: "Document",
        fromId: stableId("Document", docRelPath),
        toLabel: "Tag",
        toId: stableId("Tag", tag),
        type: "TAGGED_WITH",
    };
}
// Document → Document (internal links)
export function buildLinksToRel(sourceRelPath, targetRelPath) {
    return {
        fromLabel: "Document",
        fromId: stableId("Document", sourceRelPath),
        toLabel: "Document",
        toId: stableId("Document", targetRelPath),
        type: "LINKS_TO",
    };
}
// Document → entity mention relationships
export function buildMentionRels(docRelPath, entities) {
    const rels = [];
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
export function buildAboutLeadRel(docRelPath, leadName, leadCompany) {
    return {
        fromLabel: "Document",
        fromId: stableId("Document", docRelPath),
        toLabel: "Lead",
        toId: stableId("Lead", normalizeName(leadName), normalizeName(leadCompany)),
        type: "ABOUT_LEAD",
    };
}
// Person → Company (WORKS_AT)
export function buildWorksAtRels() {
    const rels = [];
    for (const person of people) {
        if (!person.company)
            continue;
        // Find the company in our dictionary
        const company = companies.find((c) => normalizeName(c.name) === normalizeName(person.company) ||
            c.aliases?.some((a) => normalizeName(a) === normalizeName(person.company)));
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
export function buildCompetesWithRels() {
    const rels = [];
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
export function buildLeadContactAtRel(leadName, leadCompany, companyName) {
    return {
        fromLabel: "Lead",
        fromId: stableId("Lead", normalizeName(leadName), normalizeName(leadCompany)),
        toLabel: "Company",
        toId: stableId("Company", normalizeName(companyName)),
        type: "CONTACT_AT",
    };
}
// Lead → EHRSystem (USES_EHR)
export function buildLeadUsesEHRRel(leadName, leadCompany, ehrName) {
    return {
        fromLabel: "Lead",
        fromId: stableId("Lead", normalizeName(leadName), normalizeName(leadCompany)),
        toLabel: "EHRSystem",
        toId: stableId("EHRSystem", normalizeName(ehrName)),
        type: "USES_EHR",
    };
}
/** Resolve an EMR name from a lead to a canonical EHR system name */
export function resolveEHRName(emrValue) {
    const lower = emrValue.toLowerCase().trim();
    for (const ehr of ehrSystems) {
        if (normalizeName(ehr.name) === lower)
            return ehr.name;
        if (ehr.aliases?.some((a) => normalizeName(a) === lower))
            return ehr.name;
    }
    return null;
}
// --- Phase 2: Entity extraction relationships ---
/** Company → Market (OPERATES_IN) */
export function buildOperatesInRel(companyName, marketName) {
    return {
        fromLabel: "Company",
        fromId: stableId("Company", normalizeName(companyName)),
        toLabel: "Market",
        toId: stableId("Market", normalizeName(marketName)),
        type: "OPERATES_IN",
    };
}
/** Skill → Market (ADDRESSES) */
export function buildAddressesRel(skillId, marketName) {
    return {
        fromLabel: "Skill",
        fromId: stableId("Skill", skillId),
        toLabel: "Market",
        toId: stableId("Market", normalizeName(marketName)),
        type: "ADDRESSES",
    };
}
/** Company → Event (HAD_EVENT) */
export function buildHadEventRel(companyName, eventDescription, eventDate) {
    return {
        fromLabel: "Company",
        fromId: stableId("Company", normalizeName(companyName)),
        toLabel: "Event",
        toId: stableId("Event", normalizeName(eventDescription), eventDate),
        type: "HAD_EVENT",
    };
}
/** Event → Document (REPORTED_IN) */
export function buildReportedInRel(eventDescription, eventDate, docRelPath) {
    return {
        fromLabel: "Event",
        fromId: stableId("Event", normalizeName(eventDescription), eventDate),
        toLabel: "Document",
        toId: stableId("Document", docRelPath),
        type: "REPORTED_IN",
    };
}
// --- Phase 3: Sales pipeline + territory relationships ---
/** Lead → SalesStage (CURRENT_STAGE) */
export function buildCurrentStageRel(leadName, leadCompany, stageName) {
    return {
        fromLabel: "Lead",
        fromId: stableId("Lead", normalizeName(leadName), normalizeName(leadCompany)),
        toLabel: "SalesStage",
        toId: stableId("SalesStage", normalizeName(stageName)),
        type: "CURRENT_STAGE",
    };
}
/** Lead → SalesStage (ENTERED_STAGE) with timestamps */
export function buildEnteredStageRel(leadName, leadCompany, stageName, enteredAt, exitedAt) {
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
export function buildLocatedInRel(leadName, leadCompany, territoryName) {
    return {
        fromLabel: "Lead",
        fromId: stableId("Lead", normalizeName(leadName), normalizeName(leadCompany)),
        toLabel: "Territory",
        toId: stableId("Territory", normalizeName(territoryName)),
        type: "LOCATED_IN",
    };
}
/** Territory → Territory (PART_OF) for state → region hierarchy */
export function buildPartOfRel(childTerritory, parentTerritory) {
    return {
        fromLabel: "Territory",
        fromId: stableId("Territory", normalizeName(childTerritory)),
        toLabel: "Territory",
        toId: stableId("Territory", normalizeName(parentTerritory)),
        type: "PART_OF",
    };
}
// --- Phase 4: Revenue Intelligence relationships ---
/** Skill → BillingCode (ENABLES_BILLING) */
export function buildEnablesBillingRel(skillId, billingCode, role) {
    return {
        fromLabel: "Skill",
        fromId: stableId("Skill", skillId),
        toLabel: "BillingCode",
        toId: stableId("BillingCode", billingCode),
        type: "ENABLES_BILLING",
        properties: { role },
    };
}
/** BillingCode → Program (PART_OF_PROGRAM) */
export function buildPartOfProgramRel(billingCode, programId) {
    return {
        fromLabel: "BillingCode",
        fromId: stableId("BillingCode", billingCode),
        toLabel: "Program",
        toId: stableId("Program", programId),
        type: "PART_OF_PROGRAM",
    };
}
/** Lead → Program (ELIGIBLE_FOR) */
export function buildEligibleForRel(leadName, leadCompany, programId) {
    return {
        fromLabel: "Lead",
        fromId: stableId("Lead", normalizeName(leadName), normalizeName(leadCompany)),
        toLabel: "Program",
        toId: stableId("Program", programId),
        type: "ELIGIBLE_FOR",
    };
}
/** Lead → Practice (PRACTICES_AT) */
export function buildPracticesAtRel(leadName, leadCompany, practiceName) {
    return {
        fromLabel: "Lead",
        fromId: stableId("Lead", normalizeName(leadName), normalizeName(leadCompany)),
        toLabel: "Practice",
        toId: stableId("Practice", normalizeName(practiceName)),
        type: "PRACTICES_AT",
    };
}
/** Practice → Specialty (IN_SPECIALTY) */
export function buildInSpecialtyRel(practiceName, specialtyName) {
    return {
        fromLabel: "Practice",
        fromId: stableId("Practice", normalizeName(practiceName)),
        toLabel: "Specialty",
        toId: stableId("Specialty", normalizeName(specialtyName)),
        type: "IN_SPECIALTY",
    };
}
/** Program → Specialty (ELIGIBLE_SPECIALTY) */
export function buildEligibleSpecialtyRel(programId, specialtyName) {
    return {
        fromLabel: "Program",
        fromId: stableId("Program", programId),
        toLabel: "Specialty",
        toId: stableId("Specialty", normalizeName(specialtyName)),
        type: "ELIGIBLE_SPECIALTY",
    };
}
// --- Phase 5: External Intelligence relationships ---
/** Company → CompetitorProduct (HAS_PRODUCT) */
export function buildHasProductRel(companyName, productName, productCompany) {
    return {
        fromLabel: "Company",
        fromId: stableId("Company", normalizeName(companyName)),
        toLabel: "CompetitorProduct",
        toId: stableId("CompetitorProduct", normalizeName(productCompany), normalizeName(productName)),
        type: "HAS_PRODUCT",
    };
}
