import { RelRecord } from "../db/queries.js";
import { ExtractedEntities } from "../parsers/entity-extractor.js";
export declare function buildInFolderRel(docRelPath: string, folderPath: string): RelRecord;
export declare function buildParentFolderRel(childPath: string, parentPath: string): RelRecord;
export declare function buildTaggedWithRel(docRelPath: string, tag: string): RelRecord;
export declare function buildLinksToRel(sourceRelPath: string, targetRelPath: string): RelRecord;
export declare function buildMentionRels(docRelPath: string, entities: ExtractedEntities): RelRecord[];
export declare function buildAboutLeadRel(docRelPath: string, leadName: string, leadCompany: string): RelRecord;
export declare function buildWorksAtRels(): RelRecord[];
export declare function buildCompetesWithRels(): RelRecord[];
export declare function buildLeadContactAtRel(leadName: string, leadCompany: string, companyName: string): RelRecord;
export declare function buildLeadUsesEHRRel(leadName: string, leadCompany: string, ehrName: string): RelRecord;
/** Resolve an EMR name from a lead to a canonical EHR system name */
export declare function resolveEHRName(emrValue: string): string | null;
/** Company → Market (OPERATES_IN) */
export declare function buildOperatesInRel(companyName: string, marketName: string): RelRecord;
/** Skill → Market (ADDRESSES) */
export declare function buildAddressesRel(skillId: string, marketName: string): RelRecord;
/** Company → Event (HAD_EVENT) */
export declare function buildHadEventRel(companyName: string, eventDescription: string, eventDate: string): RelRecord;
/** Event → Document (REPORTED_IN) */
export declare function buildReportedInRel(eventDescription: string, eventDate: string, docRelPath: string): RelRecord;
/** Lead → SalesStage (CURRENT_STAGE) */
export declare function buildCurrentStageRel(leadName: string, leadCompany: string, stageName: string): RelRecord;
/** Lead → SalesStage (ENTERED_STAGE) with timestamps */
export declare function buildEnteredStageRel(leadName: string, leadCompany: string, stageName: string, enteredAt: string, exitedAt?: string): RelRecord;
/** Lead → Territory (LOCATED_IN) */
export declare function buildLocatedInRel(leadName: string, leadCompany: string, territoryName: string): RelRecord;
/** Territory → Territory (PART_OF) for state → region hierarchy */
export declare function buildPartOfRel(childTerritory: string, parentTerritory: string): RelRecord;
/** Skill → BillingCode (ENABLES_BILLING) */
export declare function buildEnablesBillingRel(skillId: string, billingCode: string, role: string): RelRecord;
/** BillingCode → Program (PART_OF_PROGRAM) */
export declare function buildPartOfProgramRel(billingCode: string, programId: string): RelRecord;
/** Lead → Program (ELIGIBLE_FOR) */
export declare function buildEligibleForRel(leadName: string, leadCompany: string, programId: string): RelRecord;
/** Lead → Practice (PRACTICES_AT) */
export declare function buildPracticesAtRel(leadName: string, leadCompany: string, practiceName: string): RelRecord;
/** Practice → Specialty (IN_SPECIALTY) */
export declare function buildInSpecialtyRel(practiceName: string, specialtyName: string): RelRecord;
/** Program → Specialty (ELIGIBLE_SPECIALTY) */
export declare function buildEligibleSpecialtyRel(programId: string, specialtyName: string): RelRecord;
/** Company → CompetitorProduct (HAS_PRODUCT) */
export declare function buildHasProductRel(companyName: string, productName: string, productCompany: string): RelRecord;
