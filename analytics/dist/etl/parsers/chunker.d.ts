export interface DocumentChunk {
    documentPath: string;
    chunkIndex: number;
    headingPath: string;
    content: string;
    tokenCount: number;
}
export declare function countTokens(text: string): number;
export declare function freeEncoder(): void;
/** Chunk a markdown document into semantically coherent pieces */
export declare function chunkDocument(documentPath: string, rawContent: string): DocumentChunk[];
