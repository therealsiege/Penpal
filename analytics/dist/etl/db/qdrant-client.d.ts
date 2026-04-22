export declare const COLLECTIONS: {
    readonly documentChunks: "document_chunks";
    readonly documentSummaries: "document_summaries";
};
export declare function ensureCollections(): Promise<void>;
export interface ChunkPoint {
    id: string;
    vector: number[];
    payload: {
        documentId: string;
        documentPath: string;
        documentType: string;
        venture: string;
        headingPath: string;
        content: string;
        chunkIndex: number;
    };
}
export interface SummaryPoint {
    id: string;
    vector: number[];
    payload: {
        documentId: string;
        documentPath: string;
        documentType: string;
        venture: string;
        title: string;
        contentPreview: string;
    };
}
/** Upsert chunk vectors into Qdrant */
export declare function upsertChunks(points: ChunkPoint[]): Promise<void>;
/** Upsert document summary vectors into Qdrant */
export declare function upsertSummaries(points: SummaryPoint[]): Promise<void>;
export interface SearchResult {
    score: number;
    payload: Record<string, unknown>;
}
/** Search for similar chunks */
export declare function searchChunks(vector: number[], limit?: number, filter?: Record<string, unknown>): Promise<SearchResult[]>;
/** Search for similar documents */
export declare function searchSummaries(vector: number[], limit?: number, filter?: Record<string, unknown>): Promise<SearchResult[]>;
