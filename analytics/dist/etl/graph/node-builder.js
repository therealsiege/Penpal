import { stableId } from "../../shared/utils/id.js";
import { normalizeName } from "../../shared/utils/normalize.js";
export function buildDocumentNode(doc, venture) {
    return {
        label: "Document",
        properties: {
            id: stableId("Document", doc.relativePath),
            title: doc.title,
            relativePath: doc.relativePath,
            documentType: doc.documentType,
            venture: venture || "",
            createdAt: doc.createdAt || "",
            updatedAt: doc.updatedAt || "",
            contentPreview: doc.contentPreview,
            wordCount: doc.wordCount,
        },
    };
}
export function buildFolderNode(folderPath, name, depth, venture) {
    return {
        label: "Folder",
        properties: {
            id: stableId("Folder", folderPath),
            path: folderPath,
            name,
            depth,
            venture: venture || "",
        },
    };
}
export function buildTagNode(tag) {
    return {
        label: "Tag",
        properties: {
            id: stableId("Tag", tag),
            name: tag,
        },
    };
}
export function buildPersonNode(person) {
    return {
        label: "Person",
        properties: {
            id: stableId("Person", normalizeName(person.name)),
            name: person.name,
            company: person.company || "",
            role: person.role || "",
            title: person.title || "",
        },
    };
}
export function buildCompanyNode(company) {
    return {
        label: "Company",
        properties: {
            id: stableId("Company", normalizeName(company.name)),
            name: company.name,
            type: company.type,
            funding: company.funding || "",
            hq: company.hq || "",
        },
    };
}
export function buildTechnologyNode(tech) {
    return {
        label: "Technology",
        properties: {
            id: stableId("Technology", normalizeName(tech.name)),
            name: tech.name,
            category: tech.category,
        },
    };
}
export function buildEHRNode(ehr) {
    return {
        label: "EHRSystem",
        properties: {
            id: stableId("EHRSystem", normalizeName(ehr.name)),
            name: ehr.name,
            integrationMethod: ehr.integrationMethod || "",
        },
    };
}
export function buildSkillNode(skill) {
    return {
        label: "Skill",
        properties: {
            id: stableId("Skill", skill.skillId),
            skillId: skill.skillId,
            name: skill.name,
            category: skill.category,
            status: skill.status,
        },
    };
}
export function buildRegulationNode(reg) {
    return {
        label: "Regulation",
        properties: {
            id: stableId("Regulation", normalizeName(reg.name)),
            name: reg.name,
            description: reg.description,
        },
    };
}
export function buildLeadNodeFromDoc(lead, docRelPath, venture) {
    return {
        label: "Lead",
        properties: {
            id: stableId("Lead", normalizeName(lead.name), normalizeName(lead.company || "")),
            name: lead.name,
            company: lead.company || "",
            venture: venture || "",
            location: lead.location || "",
            jobTitle: lead.jobTitle || "",
            type: lead.type || "",
            salesFunnel: lead.salesFunnel || "",
            priority: lead.priority || "",
            emr: lead.emr || "",
            leadSource: lead.leadSource || "",
            bio: (lead.bio || "").slice(0, 500),
            notes: (lead.notes || "").slice(0, 500),
            nextAction: lead.nextAction || "",
            businessArm: lead.businessArm || "",
            htnMember: lead.htnMember,
            linkedIn: lead.linkedIn || "",
            email: lead.email || "",
            createdAt: lead.createdAt || "",
        },
    };
}
export function buildLeadNodeFromCRM(crm, venture) {
    return {
        label: "Lead",
        properties: {
            id: stableId("Lead", normalizeName(crm.name), normalizeName(crm.company || "")),
            name: crm.name,
            company: crm.company || "",
            venture: venture || "",
            location: crm.location || "",
            jobTitle: crm.jobTitle || "",
            type: crm.type || "",
            salesFunnel: crm.salesFunnel || "",
            priority: crm.priority || "",
            emr: crm.emr || "",
            leadSource: crm.leadSource || "",
            bio: (crm.bio || "").slice(0, 500),
            notes: (crm.notes || "").slice(0, 500),
            nextAction: crm.nextAction || "",
            businessArm: crm.businessArm || "",
            htnMember: crm.htnMember,
            dealSize: crm.dealSize || "",
            linkedIn: crm.linkedIn || "",
            email: crm.email || "",
            createdAt: crm.createdAt || "",
        },
    };
}
export function buildMarketNode(market) {
    return {
        label: "Market",
        properties: {
            id: stableId("Market", normalizeName(market.name)),
            name: market.name,
            description: market.description || "",
        },
    };
}
export function buildEventNode(event) {
    return {
        label: "Event",
        properties: {
            id: stableId("Event", normalizeName(event.description), event.date || ""),
            type: event.type,
            description: event.description,
            date: event.date || "",
            sourceDocumentId: event.sourceDocumentId || "",
        },
    };
}
export function buildSalesStageNode(stage) {
    return {
        label: "SalesStage",
        properties: {
            id: stableId("SalesStage", normalizeName(stage.name)),
            name: stage.name,
            order: stage.order,
        },
    };
}
export function buildTerritoryNode(territory) {
    return {
        label: "Territory",
        properties: {
            id: stableId("Territory", normalizeName(territory.name)),
            name: territory.name,
            type: territory.type,
        },
    };
}
export function buildPracticeNode(practice) {
    return {
        label: "Practice",
        properties: {
            id: stableId("Practice", normalizeName(practice.name)),
            name: practice.name,
            npi: practice.npi || "",
            address: practice.address || "",
            specialty: practice.specialty || "",
            organizationType: practice.organizationType || "",
            taxonomyCode: practice.taxonomyCode || "",
            practiceCity: practice.practiceCity || "",
            practiceState: practice.practiceState || "",
            practiceZip: practice.practiceZip || "",
            isSoleProprietor: practice.isSoleProprietor || "",
            enumerationDate: practice.enumerationDate || "",
            source: practice.source || "",
        },
    };
}
export function buildBillingCodeNode(code) {
    return {
        label: "BillingCode",
        properties: {
            id: stableId("BillingCode", code.code),
            code: code.code,
            description: code.description,
            rate: code.rate,
            program: code.program,
            frequency: code.frequency,
            eligibility: code.eligibility,
        },
    };
}
export function buildProgramNode(program) {
    return {
        label: "Program",
        properties: {
            id: stableId("Program", program.programId),
            programId: program.programId,
            name: program.name,
            fullName: program.fullName,
            annualRevenuePerPatient: program.annualRevenuePerPatient,
            payerRequirement: program.payerRequirement,
            description: program.description,
        },
    };
}
export function buildSpecialtyNode(specialty) {
    return {
        label: "Specialty",
        properties: {
            id: stableId("Specialty", normalizeName(specialty.name)),
            name: specialty.name,
            medicareHeavy: specialty.medicareHeavy,
            ccmPotential: specialty.ccmPotential,
        },
    };
}
// --- Phase 5: External Intelligence ---
export function buildCompetitorProductNode(record) {
    return {
        label: "CompetitorProduct",
        properties: {
            id: stableId("CompetitorProduct", normalizeName(record.company), normalizeName(record.product || record.company)),
            name: record.product || record.company,
            company: record.company,
            category: record.category,
            pricing: record.pricing || "",
            features: (record.features || []).join("; "),
            doesNotDo: (record.doesNotDo || []).join("; "),
            customerCount: record.customerCount || "",
            notableCustomers: (record.notableCustomers || []).join("; "),
            positioning: record.positioning || "",
            fundingInfo: record.fundingInfo || "",
            source: record.source,
            scrapedAt: record.scrapedAt,
        },
    };
}
