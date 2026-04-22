export interface ExtractedEntity {
    name: string;
    type: "company" | "person" | "technology" | "regulation" | "market" | "ehr_system";
    confidence: number;
    context: string;
}
export interface ExtractedRelationship {
    sourceEntity: string;
    sourceType: string;
    targetEntity: string;
    targetType: string;
    relationship: string;
    confidence: number;
}
export interface ExtractedEvent {
    type: "funding" | "launch" | "partnership" | "acquisition" | "regulatory" | "other";
    description: string;
    date?: string;
    companies: string[];
    confidence: number;
}
export interface LLMExtractionResult {
    entities: ExtractedEntity[];
    relationships: ExtractedRelationship[];
    events: ExtractedEvent[];
    markets: string[];
}
export declare function saveExtractionCache(): void;
/** Extract entities, relationships, and events from a document using Claude Haiku */
export declare function extractWithLLM(documentPath: string, content: string): Promise<LLMExtractionResult>;
