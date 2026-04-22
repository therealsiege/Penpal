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
import { WebIntelRecord } from "../parsers/web-intel-parser.js";
export declare function buildDocumentNode(doc: ParsedDocument, venture?: string): NodeRecord;
export declare function buildFolderNode(folderPath: string, name: string, depth: number, venture?: string): NodeRecord;
export declare function buildTagNode(tag: string): NodeRecord;
export declare function buildPersonNode(person: PersonEntry): NodeRecord;
export declare function buildCompanyNode(company: CompanyEntry): NodeRecord;
export declare function buildTechnologyNode(tech: TechnologyEntry): NodeRecord;
export declare function buildEHRNode(ehr: EHREntry): NodeRecord;
export declare function buildSkillNode(skill: SkillEntry): NodeRecord;
export declare function buildRegulationNode(reg: RegulationEntry): NodeRecord;
export declare function buildLeadNodeFromDoc(lead: ParsedLead, docRelPath: string, venture?: string): NodeRecord;
export declare function buildLeadNodeFromCRM(crm: CRMRecord, venture?: string): NodeRecord;
export interface MarketData {
    name: string;
    description?: string;
}
export declare function buildMarketNode(market: MarketData): NodeRecord;
export interface EventData {
    type: string;
    description: string;
    date?: string;
    sourceDocumentId?: string;
}
export declare function buildEventNode(event: EventData): NodeRecord;
export interface SalesStageData {
    name: string;
    order: number;
}
export declare function buildSalesStageNode(stage: SalesStageData): NodeRecord;
export interface TerritoryData {
    name: string;
    type: "state" | "region";
}
export declare function buildTerritoryNode(territory: TerritoryData): NodeRecord;
export interface PracticeData {
    name: string;
    npi?: string;
    address?: string;
    specialty?: string;
    organizationType?: string;
    taxonomyCode?: string;
    practiceCity?: string;
    practiceState?: string;
    practiceZip?: string;
    isSoleProprietor?: string;
    enumerationDate?: string;
    source?: string;
}
export declare function buildPracticeNode(practice: PracticeData): NodeRecord;
export declare function buildBillingCodeNode(code: BillingCodeEntry): NodeRecord;
export declare function buildProgramNode(program: ProgramEntry): NodeRecord;
export declare function buildSpecialtyNode(specialty: SpecialtyEntry): NodeRecord;
export declare function buildCompetitorProductNode(record: WebIntelRecord): NodeRecord;
