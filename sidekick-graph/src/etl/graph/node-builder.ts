import { stableId } from "../../shared/utils/id.js";
import { NodeRecord } from "../db/queries.js";
import { ParsedDocument } from "../parsers/markdown-parser.js";
import { ParsedLead } from "../parsers/lead-parser.js";
import { CRMRecord } from "../parsers/csv-parser.js";
import { CompanyEntry } from "../dictionaries/companies.js";
import { PersonEntry } from "../dictionaries/people.js";
import { TechnologyEntry } from "../dictionaries/technologies.js";
import { EHREntry } from "../dictionaries/ehr-systems.js";
import { RegulationEntry } from "../dictionaries/regulations.js";
import { SkillEntry } from "../dictionaries/skills.js";
import { BillingCodeEntry } from "../dictionaries/cms-codes.js";
import { ProgramEntry, SpecialtyEntry } from "../dictionaries/revenue-model.js";
import { normalizeName } from "../../shared/utils/normalize.js";

export function buildDocumentNode(doc: ParsedDocument): NodeRecord {
  return {
    label: "Document",
    properties: {
      id: stableId("Document", doc.relativePath),
      title: doc.title,
      relativePath: doc.relativePath,
      documentType: doc.documentType,
      createdAt: doc.createdAt || "",
      updatedAt: doc.updatedAt || "",
      contentPreview: doc.contentPreview,
      wordCount: doc.wordCount,
    },
  };
}

export function buildFolderNode(folderPath: string, name: string, depth: number): NodeRecord {
  return {
    label: "Folder",
    properties: {
      id: stableId("Folder", folderPath),
      path: folderPath,
      name,
      depth,
    },
  };
}

export function buildTagNode(tag: string): NodeRecord {
  return {
    label: "Tag",
    properties: {
      id: stableId("Tag", tag),
      name: tag,
    },
  };
}

export function buildPersonNode(person: PersonEntry): NodeRecord {
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

export function buildCompanyNode(company: CompanyEntry): NodeRecord {
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

export function buildTechnologyNode(tech: TechnologyEntry): NodeRecord {
  return {
    label: "Technology",
    properties: {
      id: stableId("Technology", normalizeName(tech.name)),
      name: tech.name,
      category: tech.category,
    },
  };
}

export function buildEHRNode(ehr: EHREntry): NodeRecord {
  return {
    label: "EHRSystem",
    properties: {
      id: stableId("EHRSystem", normalizeName(ehr.name)),
      name: ehr.name,
      integrationMethod: ehr.integrationMethod || "",
    },
  };
}

export function buildSkillNode(skill: SkillEntry): NodeRecord {
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

export function buildRegulationNode(reg: RegulationEntry): NodeRecord {
  return {
    label: "Regulation",
    properties: {
      id: stableId("Regulation", normalizeName(reg.name)),
      name: reg.name,
      description: reg.description,
    },
  };
}

export function buildLeadNodeFromDoc(lead: ParsedLead, docRelPath: string): NodeRecord {
  return {
    label: "Lead",
    properties: {
      id: stableId("Lead", normalizeName(lead.name), normalizeName(lead.company || "")),
      name: lead.name,
      company: lead.company || "",
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

export function buildLeadNodeFromCRM(crm: CRMRecord): NodeRecord {
  return {
    label: "Lead",
    properties: {
      id: stableId("Lead", normalizeName(crm.name), normalizeName(crm.company || "")),
      name: crm.name,
      company: crm.company || "",
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

// --- Phase 2: Market, Event ---

export interface MarketData {
  name: string;
  description?: string;
}

export function buildMarketNode(market: MarketData): NodeRecord {
  return {
    label: "Market",
    properties: {
      id: stableId("Market", normalizeName(market.name)),
      name: market.name,
      description: market.description || "",
    },
  };
}

export interface EventData {
  type: string;
  description: string;
  date?: string;
  sourceDocumentId?: string;
}

export function buildEventNode(event: EventData): NodeRecord {
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

// --- Phase 3: SalesStage, Territory ---

export interface SalesStageData {
  name: string;
  order: number;
}

export function buildSalesStageNode(stage: SalesStageData): NodeRecord {
  return {
    label: "SalesStage",
    properties: {
      id: stableId("SalesStage", normalizeName(stage.name)),
      name: stage.name,
      order: stage.order,
    },
  };
}

export interface TerritoryData {
  name: string;
  type: "state" | "region";
}

export function buildTerritoryNode(territory: TerritoryData): NodeRecord {
  return {
    label: "Territory",
    properties: {
      id: stableId("Territory", normalizeName(territory.name)),
      name: territory.name,
      type: territory.type,
    },
  };
}

// --- Phase 4: Revenue Intelligence ---

export interface PracticeData {
  name: string;
  npi?: string;
  address?: string;
  specialty?: string;
  organizationType?: string;
}

export function buildPracticeNode(practice: PracticeData): NodeRecord {
  return {
    label: "Practice",
    properties: {
      id: stableId("Practice", normalizeName(practice.name)),
      name: practice.name,
      npi: practice.npi || "",
      address: practice.address || "",
      specialty: practice.specialty || "",
      organizationType: practice.organizationType || "",
    },
  };
}

export function buildBillingCodeNode(code: BillingCodeEntry): NodeRecord {
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

export function buildProgramNode(program: ProgramEntry): NodeRecord {
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

export function buildSpecialtyNode(specialty: SpecialtyEntry): NodeRecord {
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
