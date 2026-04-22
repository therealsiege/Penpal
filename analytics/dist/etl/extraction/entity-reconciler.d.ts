import type { ExtractedEntity } from "./llm-extractor.js";
export interface ReconciledEntity {
    name: string;
    type: ExtractedEntity["type"];
    isNew: boolean;
    matchedDictionaryName?: string;
    confidence: number;
    context: string;
}
/** Reconcile LLM-extracted entities against existing dictionaries */
export declare function reconcileEntities(entities: ExtractedEntity[]): ReconciledEntity[];
export interface NewEntitiesReport {
    companies: {
        name: string;
        context: string;
        confidence: number;
    }[];
    people: {
        name: string;
        context: string;
        confidence: number;
    }[];
    technologies: {
        name: string;
        context: string;
        confidence: number;
    }[];
    markets: {
        name: string;
        sources: string[];
    }[];
    events: {
        description: string;
        type: string;
        date?: string;
    }[];
}
/** Write a JSON report of newly discovered entities for human review */
export declare function writeNewEntitiesReport(report: NewEntitiesReport, outputPath: string): void;
